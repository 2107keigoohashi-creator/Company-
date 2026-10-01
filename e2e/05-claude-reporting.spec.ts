import { expect, test } from "@playwright/test";
import { claudeClient } from "./helpers";

// Claude が Supabase コネクタ(service 側の SQL 接続)から hq_* 関数で記録する流れ
test("Claude が登録→進捗→成果物提出すると画面に反映され、承認はオーナーだけができる", async ({ page }) => {
  const claude = claudeClient();

  const created = await claude.rpc("hq_create_task", {
    p_title: "Claude登録: SNS投稿案",
    p_instruction: "Claude 側で作業して提出する",
    p_employee_key: "writer",
    p_priority: "high",
    p_approval_type: "external_post",
  });
  expect(created.error).toBeNull();
  const taskId = created.data as string;

  expect((await claude.rpc("hq_log", { p_task_id: taskId, p_note: "着手しました", p_progress: 30, p_status: "running" })).error).toBeNull();
  await page.goto(`/tasks/${taskId}`);
  await expect(page.getByTestId("task-status")).toHaveText("実行中");
  await expect(page.getByText("着手しました")).toBeVisible();
  await expect(page.getByText("Claude", { exact: true }).first()).toBeVisible();

  // Claude は「完了」「承認済み」にはできない
  const bad = await claude.rpc("hq_log", { p_task_id: taskId, p_note: "x", p_status: "done" });
  expect(bad.error).not.toBeNull();

  const submitted = await claude.rpc("hq_submit_result", {
    p_task_id: taskId,
    p_output_md: "# 案1\nClaudeが書いた投稿案",
    p_note: "提出します",
  });
  expect(submitted.error).toBeNull();
  expect(submitted.data).toMatchObject({ version: 1, task_status: "pending_approval" });

  // 承認待ち中は進捗更新も再提出で上書きもできない(再提出は新しい版になる)
  expect((await claude.rpc("hq_log", { p_task_id: taskId, p_note: "x" })).error).not.toBeNull();

  await page.reload();
  await expect(page.getByTestId("task-status")).toHaveText("承認待ち");
  await expect(page.getByTestId("latest-output")).toContainText("Claudeが書いた投稿案");

  // 承認できるのはオーナーだけ: 画面から承認 → 承認済み。Claude は承認済みタスクに提出できない
  await page.goto("/approvals");
  const item = page.getByTestId("approval-item").filter({ hasText: "Claude登録: SNS投稿案" });
  page.once("dialog", (d) => d.accept());
  await item.getByRole("button", { name: "✓ 承認" }).click();
  await expect(item).toHaveCount(0);
  const after = await claude.rpc("hq_submit_result", { p_task_id: taskId, p_output_md: "後出し" });
  expect(after.error).not.toBeNull();

  await page.goto("/settings");
  await expect(page.getByTestId("audit-log").filter({ hasText: "task_run.submitted_for_approval" }).first()).toContainText("claude");
});
