import { expect, test } from "@playwright/test";
import { createTask, runAndWait } from "./helpers";

test.describe("タスク → 実行 → 承認フロー", () => {
  test("タスク作成→実行→承認待ち→承認→実行可→完了", async ({ page }) => {
    const id = await createTask(page, {
      title: "新機能告知のX投稿",
      instruction: "新しいボイスチャット練習モードを告知するX投稿を3案",
      approval: "対外投稿(SNS/記事)",
    });
    await expect(page.getByTestId("task-status")).toHaveText("未着手");

    await runAndWait(page, "▶ AI社員に実行させる", "承認待ち");
    await expect(page.getByTestId("latest-output")).toContainText("要判断事項");

    // 承認タブのバッジ
    await expect(page.getByRole("navigation", { name: "メインメニュー" }).getByLabel("承認待ち 1 件")).toBeVisible();

    await page.locator('nav a[href="/approvals"]').click();
    await expect(page).toHaveURL(/\/approvals/);
    const item = page.getByTestId("approval-item").filter({ hasText: "新機能告知のX投稿" });
    await expect(item).toContainText("対外投稿(SNS/記事)");
    await expect(item).toContainText("ライター");
    await expect(item).toContainText("影響");
    await expect(item).toContainText("模擬成果物");

    page.once("dialog", (d) => d.accept());
    await item.getByRole("button", { name: "✓ 承認" }).click();
    await expect(page.getByText("承認待ちはありません")).toBeVisible();

    await page.goto(`/tasks/${id}`);
    await expect(page.getByTestId("task-status")).toHaveText("承認済・実行可");
    await expect(page.getByText("外部への送信・投稿・支払いを自動では行いません")).toBeVisible();
    await page.getByRole("button", { name: "使用済みにして完了" }).click();
    await expect(page.getByTestId("task-status")).toHaveText("完了");

    // カンバンの「完了」列に表示される
    await page.goto("/tasks");
    await expect(page.getByTestId("column-done")).toContainText("新機能告知のX投稿");

    // 監査ログ
    await page.goto("/settings");
    const logs = page.getByTestId("audit-log");
    await expect(logs.filter({ hasText: "approval.approved" })).toHaveCount(1);
    await expect(logs.filter({ hasText: "task_run.submitted_for_approval" }).first()).toContainText("ai:writer");
  });

  test("差し戻し(コメント必須)→再実行で新バージョンが承認待ちになる", async ({ page }) => {
    const id = await createTask(page, {
      title: "問い合わせ返信: 返金について",
      employee: "カスタマー",
      approval: "メール・問い合わせ返信",
    });
    await runAndWait(page, "▶ AI社員に実行させる", "承認待ち");

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

    await runAndWait(page, "↻ 差し戻しを反映して再実行", "承認待ち");
    await expect(page.getByTestId("latest-output")).toContainText("返金は約束せず");
    await expect(page.getByText("最新の成果物 v2")).toBeVisible();
    // v1 は差し戻し、v2 は承認待ちとして履歴に残る
    await expect(page.locator("summary", { hasText: "v1" })).toContainText("差し戻し");
    await expect(page.locator("summary", { hasText: "v2" })).toContainText("承認待ち");
  });

  test("承認不要タスクは修正依頼で再実行でき、履歴が残る", async ({ page }) => {
    await createTask(page, { title: "週次進捗まとめ", employee: "秘書" });
    await runAndWait(page, "▶ AI社員に実行させる", "完了");

    await page.getByRole("button", { name: "✎ 修正依頼して再実行" }).click();
    await page.getByLabel("修正依頼(新しいバージョンとして再実行されます)").fill("箇条書きを3つまでに");
    await page.getByRole("button", { name: "修正依頼を送る" }).click();
    await expect(page.getByText("最新の成果物 v2")).toBeVisible();
    await expect(page.getByTestId("latest-output")).toContainText("箇条書きを3つまでに");
    await expect(page.locator("summary", { hasText: "v1" })).toBeVisible();
  });

  test("Claude API が失敗してもエラー表示と再実行ができる", async ({ page }) => {
    await createTask(page, { title: "失敗するタスク", instruction: "[[MOCK_FAIL]]", employee: "エンジニア" });
    await page.getByRole("button", { name: "▶ AI社員に実行させる" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "実行に失敗しました" })).toContainText("一時的に利用できません");
    await expect(page.getByTestId("task-status")).toHaveText("未着手");
    await expect(page.getByRole("button", { name: "↻ 再実行" })).toBeEnabled();
  });

  test("秘書ビューで期限超過がハイライトされる", async ({ page }) => {
    await page.goto("/tasks/new");
    await page.getByLabel("タイトル").fill("期限切れの請求書確認");
    const employee = await page.locator("select[name=employee_id] option", { hasText: "経理" }).first().getAttribute("value");
    await page.getByLabel("担当社員").selectOption(employee!);
    await page.getByLabel("期限").fill("2020-01-01T10:00");
    await page.getByRole("button", { name: "タスクを作成" }).click();
    await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);

    await page.goto("/tasks?view=schedule");
    await expect(page.getByText("期限を過ぎたタスクが 1 件あります")).toBeVisible();
    await expect(page.getByTestId("schedule-overdue")).toContainText("期限切れの請求書確認");
  });
});
