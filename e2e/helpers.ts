import { expect, type Page } from "@playwright/test";

export async function createTask(
  page: Page,
  opts: { title: string; instruction?: string; employee?: string; approval?: string },
) {
  await page.goto("/tasks/new");
  await page.getByLabel("タイトル").fill(opts.title);
  if (opts.instruction) await page.getByLabel("詳細指示").fill(opts.instruction);
  const employee = await page
    .locator("select[name=employee_id] option", { hasText: opts.employee ?? "ライター" })
    .first()
    .getAttribute("value");
  await page.getByLabel("担当社員").selectOption(employee!);
  if (opts.approval) await page.getByLabel("承認種別").selectOption({ label: opts.approval });
  await page.getByRole("button", { name: "タスクを作成" }).click();
  await page.waitForURL(/\/tasks\/[0-9a-f-]{36}$/);
  return page.url().split("/").pop()!;
}

export async function runAndWait(page: Page, buttonName: RegExp | string, expectedStatus: string) {
  await page.getByRole("button", { name: buttonName }).click();
  await expect(page.getByTestId("task-status")).toHaveText(expectedStatus);
}
