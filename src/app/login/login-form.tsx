"use client";

import { useActionState } from "react";
import { signIn } from "./actions";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";

export function LoginForm({ initialError }: { initialError?: string }) {
  const [state, action, pending] = useActionState(signIn, initialError ? { error: initialError } : undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      <Field label="メールアドレス">
        <input name="email" type="email" autoComplete="email" required className={inputClass} />
      </Field>
      <Field label="パスワード">
        <input name="password" type="password" autoComplete="current-password" required className={inputClass} />
      </Field>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "ログイン中…" : "ログイン"}
      </Button>
    </form>
  );
}
