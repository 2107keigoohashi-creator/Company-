import { chromium, type FullConfig } from "@playwright/test";
import { createClient } from "@supabase/supabase-js";
import { env } from "./env";

/** テスト用オーナーを作り直して(= データ初期化)ログイン状態を保存する */
export default async function globalSetup(config: FullConfig) {
  const admin = createClient(env.supabaseUrl, env.serviceRoleKey, { auth: { persistSession: false } });
  const { data: list, error } = await admin.auth.admin.listUsers({ perPage: 1000 });
  if (error) throw error;
  const existing = list.users.find((u) => u.email?.toLowerCase() === env.ownerEmail.toLowerCase());
  if (existing) {
    const { error: delErr } = await admin.auth.admin.deleteUser(existing.id);
    if (delErr) throw delErr;
  }
  const { error: createErr } = await admin.auth.admin.createUser({
    email: env.ownerEmail,
    password: env.ownerPassword,
    email_confirm: true,
  });
  if (createErr) throw createErr;

  const { baseURL } = config.projects[0].use;
  const browser = await chromium.launch();
  const page = await browser.newPage({ baseURL });
  await page.goto("/login");
  await page.getByLabel("メールアドレス").fill(env.ownerEmail);
  await page.getByLabel("パスワード").fill(env.ownerPassword);
  await page.getByRole("button", { name: "ログイン" }).click();
  await page.waitForURL("**/tasks");
  await page.context().storageState({ path: "e2e/.auth/owner.json" });
  await browser.close();
}
