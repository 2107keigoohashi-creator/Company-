import { expect, test } from "@playwright/test";
import { createTask, pasteResult } from "./helpers";

test.describe("タスク → 進捗 → 成果物 → 承認フロー(手入力)", () => {
  test("作成→進捗記録→成果物登録→承認待ち→承認→実行可→完了", async ({ page }) => {
    const id = await createTask(page, {
      title: "新機能告知のX投稿",
      instruction: "新しいボイスチャット練習モードを告知するX投稿を3案",
      approval: "対外投稿(SNS/記事)",
    });
    await expect(page.getByTestId("task-status")).toHaveText("未着手");

    // Claude への依頼文(タスクIDと使う関数が入っている)
    await expect(page.getByTestId("copy-ask")).toBeVisible();

    // 進捗の記録 → カンバンの「実行中」列に進捗つきで出る
    await page.getByLabel("状態").selectOption("running");
    await page.getByLabel(/進捗 \d+%/).fill("40");
    await page.getByPlaceholder("例: 構成案をClaudeと相談中").fill("構成案を作成中");
    await page.getByRole("button", { name: "進捗を記録" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("実行中");
    await expect(page.getByText("構成案を作成中")).toBeVisible();
    await page.goto("/tasks");
    await expect(page.getByTestId("column-running")).toContainText("新機能告知のX投稿");
    await expect(page.getByTestId("column-running")).toContainText("40%");

    // 成果物を貼り付け → 承認待ち
    await page.goto(`/tasks/${id}`);
    await pasteResult(page, "# 案1\n「伝わる英語」で、試合中のコールアウトを鍛えよう。\n\n## 要判断事項\n- 投稿時期", "承認待ち");
    await expect(page.getByTestId("latest-output")).toContainText("要判断事項");

    // 承認タブのバッジ → 承認
    await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByLabel("承認待ち 1 件")).toBeVisible();
    await page.locator('nav a[href="/approvals"]').click();
    const item = page.getByTestId("approval-item").filter({ hasText: "新機能告知のX投稿" });
    await expect(item).toContainText("対外投稿(SNS/記事)");
    await expect(item).toContainText("影響");
    await expect(item).toContainText("伝わる英語");
    page.once("dialog", (d) => d.accept());
    await item.getByRole("button", { name: "✓ 承認" }).click();
    await expect(page.getByText("承認待ちはありません")).toBeVisible();

    await page.goto(`/tasks/${id}`);
    await expect(page.getByTestId("task-status")).toHaveText("承認済・実行可");
    await expect(page.getByText("外部への送信・投稿・支払いを自動では行いません")).toBeVisible();
    await page.getByRole("button", { name: "使用済みにして完了" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("完了");

    await page.goto("/settings");
    await expect(page.getByTestId("audit-log").filter({ hasText: "approval.approved" })).toHaveCount(1);
  });

  test("差し戻し(コメント必須)→修正版を登録→新バージョンが承認待ち", async ({ page }) => {
    const id = await createTask(page, {
      title: "問い合わせ返信: 返金について",
      employee: "カスタマー",
      approval: "メール・問い合わせ返信",
    });
    await pasteResult(page, "返金いたします。", "承認待ち");

    await page.goto("/approvals");
    const item = page.getByTestId("approval-item").filter({ hasText: "問い合わせ返信: 返金について" });
    await item.getByRole("button", { name: "✕ 差し戻し" }).click();
    const comment = item.getByLabel("差し戻しコメント(必須)");
    await expect(comment).toHaveAttribute("required", "");
    await comment.fill("返金は約束せず、規約ページへの案内にしてください");
    await item.getByRole("button", { name: "差し戻す" }).click();
    await expect(page.getByText("承認待ちはありません")).toBeVisible();

    await page.goto(`/tasks/${id}`);
    await expect(page.getByTestId("task-status")).toHaveText("却下・差し戻し");
    await expect(page.getByText("返金は約束せず、規約ページへの案内にしてください").first()).toBeVisible();

    await pasteResult(page, "規約ページをご案内します。", "承認待ち");
    await expect(page.getByText("最新の成果物 v2")).toBeVisible();
    await expect(page.locator("summary", { hasText: "v1" })).toContainText("差し戻し");
    await expect(page.locator("summary", { hasText: "v2" })).toContainText("承認待ち");
  });

  test("承認不要タスクは登録で完了になり、修正依頼で未着手に戻って v2 を登録できる", async ({ page }) => {
    await createTask(page, { title: "週次進捗まとめ", employee: "秘書" });
    await pasteResult(page, "# 今週の進捗\n- A\n- B\n- C\n- D", "完了");

    await page.getByPlaceholder("例: もっとカジュアルに。絵文字を1つ入れて").fill("箇条書きを3つまでに");
    await page.getByRole("button", { name: "修正依頼を記録" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("未着手");
    await expect(page.getByText("箇条書きを3つまでに").first()).toBeVisible();

    await pasteResult(page, "# 今週の進捗\n- A\n- B\n- C", "完了");
    await expect(page.getByText("最新の成果物 v2")).toBeVisible();
    await expect(page.locator("summary", { hasText: "v1" })).toBeVisible();
  });

  test("秘書ビューで期限超過がハイライトされる", async ({ page }) => {
    await createTask(page, { title: "期限切れの請求書確認", employee: "経理", due: "2020-01-01T10:00" });
    await page.goto("/tasks?view=schedule");
    await expect(page.getByText("期限を過ぎたタスクが 1 件あります")).toBeVisible();
    await expect(page.getByTestId("schedule-overdue")).toContainText("期限切れの請求書確認");
  });

  test("Claude 用ガイドページが表示される", async ({ page }) => {
    await page.goto("/guide");
    await expect(page.getByRole("heading", { name: "基本の流れ" })).toBeVisible();
    await expect(page.getByText("hq_submit_result").first()).toBeVisible();
    await expect(page.getByText("承認・差し戻し・完了の操作はしない")).toBeVisible();
  });
});
