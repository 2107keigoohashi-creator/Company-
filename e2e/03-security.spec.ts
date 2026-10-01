import { expect, test } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

test.describe("権限", () => {
  test("未ログインはどのページも見られない", async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
    const page = await ctx.newPage();
    for (const path of ["/tasks", "/approvals", "/accounting", "/employees", "/settings"]) {
      await page.goto(path);
      await expect(page).toHaveURL(/\/login/);
    }
    const res = await page.request.post("/api/assign", { data: { title: "x" } });
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  test("オーナーのトークンでも approvals を直接更新できない(承認は decide_approval のみ)", async () => {
    const supabase = createClient(env.supabaseUrl, env.anonKey, { auth: { persistSession: false } });
    const { error: loginError } = await supabase.auth.signInWithPassword({
      email: env.ownerEmail,
      password: env.ownerPassword,
    });
    expect(loginError).toBeNull();

    const { data: approvals } = await supabase.from("approvals").select("id, task_id").limit(1);
    expect(approvals?.length).toBeGreaterThan(0);
    const { error: updateError } = await supabase
      .from("approvals")
      .update({ status: "approved" })
      .eq("id", approvals![0].id);
    expect(updateError).not.toBeNull();

    // tasks.status を直接 ready にもできない
    const { error: taskError } = await supabase
      .from("tasks")
      .update({ status: "ready" })
      .eq("id", approvals![0].task_id);
    expect(taskError?.message).toContain("decide_approval");

    // 承認待ちの承認を「approved」として新規作成することもできない
    const { error: insertError } = await supabase.from("approvals").insert({
      task_id: approvals![0].task_id,
      task_run_id: "00000000-0000-0000-0000-000000000000",
      type: "external_post",
      status: "approved",
    });
    expect(insertError).not.toBeNull();
  });
});
