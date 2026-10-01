"use client";

import { useActionState, useRef } from "react";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import type { FormState } from "../actions";

export function CommentForm({ action }: { action: (prev: FormState, fd: FormData) => Promise<FormState> }) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (!r?.error) ref.current?.reset();
    return r;
  }, undefined);
  return (
    <form ref={ref} action={formAction} className="space-y-2">
      <ErrorBox message={state?.error} />
      <textarea name="body" rows={2} required placeholder="メモ・コメント(次回実行時にAI社員へ渡されます)" className={inputClass} />
      <Button type="submit" variant="secondary" disabled={pending} className="w-full">
        コメントを追加
      </Button>
    </form>
  );
}
