"use client";

import { useActionState, useRef } from "react";
import { Button, Card, ErrorBox, Field, inputClass } from "@/components/ui";
import { changePassword, type SettingsState } from "./actions";

export function PasswordForm() {
  const ref = useRef<HTMLFormElement>(null);
  const [state, action, pending] = useActionState(async (prev: SettingsState, fd: FormData) => {
    const r = await changePassword(prev, fd);
    if (r?.saved) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <Card>
      <form ref={ref} action={action} className="space-y-3">
        <h2 className="font-bold">パスワード変更</h2>
        <ErrorBox message={state?.error} />
        {state?.saved && <p className="rounded-xl bg-emerald-950/60 p-3 text-sm text-emerald-200">パスワードを変更しました</p>}
        <Field label="新しいパスワード(12文字以上)">
          <input name="password" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
        </Field>
        <Field label="新しいパスワード(確認)">
          <input name="confirm" type="password" autoComplete="new-password" minLength={12} required className={inputClass} />
        </Field>
        <Button type="submit" variant="secondary" disabled={pending} className="w-full">
          {pending ? "変更中…" : "パスワードを変更"}
        </Button>
      </form>
    </Card>
  );
}
