import { expect, test } from "@playwright/test";
import { claudeClient } from "./helpers";

test("オフィス: 指示を送るとタスク登録され、Claude の進捗が見取り図と最新の動きに反映される", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByTestId("office-view")).toBeVisible();

  // マーケターを選んで「指示を出す」
  await page.getByTestId("member-marketer").click();
  await expect(page.getByTestId("member-panel")).toContainText("マーケター");
  await page.getByRole("button", { name: "マーケター に指示を出す" }).click();
  await expect(page.getByLabel("担当")).toHaveValue(/.+/);

  // Enter で送信(1行目がタスク名)
  const input = page.getByLabel("指示", { exact: true });
  await input.fill("秋キャンペーンの広告文を3案");
  await input.press("Shift+Enter");
  await input.pressSequentially("ターゲットは中高生のFPSプレイヤー");
  await input.press("Enter");
  const created = page.getByTestId("instruction-created");
  await expect(created).toContainText("マーケター");
  await expect(created).toContainText("秋キャンペーンの広告文を3案");
  await expect(created.getByRole("button", { name: /依頼文をコピー/ })).toBeVisible();

  // 未着手 → 吹き出しと状態
  const marketer = page.getByTestId("member-marketer");
  await expect(marketer).toHaveAttribute("data-status", "queued");

  // Claude が進捗を記録 → 作業中・進捗%・最新の動き
  const taskId = (await created.getByRole("link", { name: "タスクを開く" }).getAttribute("href"))!.split("/").pop()!;
  const claude = claudeClient();
  expect((await claude.rpc("hq_log", { p_task_id: taskId, p_note: "ターゲット整理中", p_progress: 45, p_status: "running" })).error).toBeNull();
  await page.reload();
  await expect(marketer).toHaveAttribute("data-status", "working");
  await expect(marketer).toContainText("45%");
  await expect(page.getByRole("status")).toContainText("作業中");
  await expect(page.getByLabel("最新の動き")).toContainText("ターゲット整理中");

  // 部屋のズーム
  await page.getByRole("button", { name: "戦略・開発室" }).click();
  await expect(page.getByRole("button", { name: "戦略・開発室" })).toHaveAttribute("aria-pressed", "true");
});
