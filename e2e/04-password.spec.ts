import { expect, test } from "@playwright/test";
import { env } from "./env";

test("設定画面でパスワードを変更し、新しいパスワードでログインできる", async ({ page, browser }) => {
  const next = `${env.ownerPassword}-changed`;
  await page.goto("/settings");
  await page.getByLabel("新しいパスワード(12文字以上)").fill("short");
  await page.getByLabel("新しいパスワード(確認)").fill("short");
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  // minLength によりブラウザ側で送信されない
  await expect(page.getByText("パスワードを変更しました")).toHaveCount(0);

  await page.getByLabel("新しいパスワード(12文字以上)").fill(next);
  await page.getByLabel("新しいパスワード(確認)").fill(next);
  await page.getByRole("button", { name: "パスワードを変更" }).click();
  await expect(page.getByText("パスワードを変更しました")).toBeVisible();

  const ctx = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const fresh = await ctx.newPage();
  await fresh.goto("/login");
  await fresh.getByLabel("メールアドレス").fill(env.ownerEmail);
  await fresh.getByLabel("パスワード").fill(next);
  await fresh.getByRole("button", { name: "ログイン" }).click();
  await expect(fresh).toHaveURL(/\/tasks/);
  await ctx.close();
});
