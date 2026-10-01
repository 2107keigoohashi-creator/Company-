import { createClient } from "@supabase/supabase-js";
import { expect, type Page } from "@playwright/test";
import { env } from "./env";

/** Claude が Supabase コネクタ(SQL)で使うのと同じ、service 側の接続 */
export function claudeClient() {
  return createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
}

export async function createTask(
  page: Page,
  opts: { title: string; instruction?: string; employee?: string; approval?: string; due?: string },
) {
  await page.goto("/tasks/new");
  await page.getByLabel("タイトル").fill(opts.title);
  if (opts.instruction) await page.getByLabel("詳細指示").fill(opts.instruction);
  const employee = await page
    .locator("select[name=employee_id] option", { hasText: opts.employee ?? "ライター" })
    .first()
    .getAttribute("value");
  await page.getByLabel(/担当社員/).selectOption(employee!);
  if (opts.approval) await page.getByLabel("承認種別").selectOption({ label: opts.approval });
  if (opts.due) await page.getByLabel("期限").fill(opts.due);
  await page.getByRole("button", { name: "タスクを作成" }).click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

/** 成果物(Markdown)を貼り付けて登録する */
export async function pasteResult(page: Page, markdown: string, expectedStatus: string) {
  await page.getByPlaceholder("# 成果物…").fill(markdown);
  await page.getByTestId("submit-result").click();
  await expect(page.getByTestId("task-status")).toHaveText(expectedStatus);
}
