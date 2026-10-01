import type { Metadata } from "next";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "ログイン" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { error } = await searchParams;
  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center gap-8 px-6">
      <div className="space-y-2 text-center">
        <p className="text-xs font-bold tracking-[0.3em] text-accent">XERO DIVISION</p>
        <h1 className="text-3xl font-black tracking-wider">CALLOUT HQ</h1>
        <p className="text-sm text-muted">AI社員と回す経営管理</p>
      </div>
      <LoginForm initialError={error === "not_owner" ? "このアカウントでは利用できません" : undefined} />
    </main>
  );
}
