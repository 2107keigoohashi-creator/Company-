import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

function required(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`E2E には環境変数 ${name} が必要です(README の「E2E テスト」を参照)`);
  return v;
}

export const env = {
  supabaseUrl: required("NEXT_PUBLIC_SUPABASE_URL"),
  anonKey: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  serviceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  ownerEmail: required("OWNER_EMAIL"),
  ownerPassword: required("E2E_OWNER_PASSWORD"),
};

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(env.supabaseUrl)) {
  // テストはオーナーユーザーを削除・再作成するため、ローカル以外では実行させない
  throw new Error("E2E はローカル Supabase でのみ実行できます(NEXT_PUBLIC_SUPABASE_URL がローカルではありません)");
}
