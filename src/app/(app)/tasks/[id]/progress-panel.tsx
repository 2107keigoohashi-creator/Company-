"use client";

import { useActionState, useRef, useState } from "react";
import { Button, Card, ErrorBox, Field, inputClass } from "@/components/ui";
import type { TaskStatus } from "@/lib/types";
import type { FormState } from "../actions";

type Act = (prev: FormState, fd: FormData) => Promise<FormState>;

function useResettingAction(action: Act) {
  const ref = useRef<HTMLFormElement>(null);
  const [state, formAction, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const r = await action(prev, fd);
    if (!r?.error) ref.current?.reset();
    return r;
  }, undefined);
  return { ref, state, formAction, pending };
}

export function ProgressPanel({
  status,
  progress,
  hasResult,
  askClaudeText,
  updateProgress,
  submitResult,
  requestRevision,
}: {
  status: TaskStatus;
  progress: number;
  hasResult: boolean;
  askClaudeText: string;
  updateProgress: Act;
  submitResult: Act;
  requestRevision: Act;
}) {
  const [copied, setCopied] = useState(false);
  const { ref: progRef, state: progState, formAction: progAction, pending: progPending } = useResettingAction(updateProgress);
  const { ref: resRef, state: resState, formAction: resAction, pending: resPending } = useResettingAction(submitResult);
  const { ref: revRef, state: revState, formAction: revAction, pending: revPending } = useResettingAction(requestRevision);
  const canWork = status === "todo" || status === "running" || status === "rejected";
  const canSubmit = status !== "ready" && status !== "done";
  const canRevise = hasResult && status !== "todo" && status !== "running";

  async function copy() {
    try {
      await navigator.clipboard.writeText(askClaudeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("コピーして Claude に貼り付けてください", askClaudeText);
    }
  }

  return (
    <section className="space-y-3" aria-label="進捗と成果物の記録">
      {canWork && (
        <Card className="space-y-2">
          <h3 className="font-bold">Claude に作業を頼む</h3>
          <p className="text-xs text-muted">
            下のボタンで依頼文をコピーし、Claude(claude.ai / Claude Code)に貼り付けるだけです。Claude が進捗と成果物をこのアプリに記録します。
          </p>
          <Button type="button" onClick={copy} className="w-full" data-testid="copy-ask">
            {copied ? "✓ コピーしました" : "📋 Claude への依頼文をコピー"}
          </Button>
        </Card>
      )}

      {canWork && (
        <Card>
          <form ref={progRef} action={progAction} className="space-y-3">
            <h3 className="font-bold">進捗を記録</h3>
            <ErrorBox message={progState?.error} />
            <div className="grid grid-cols-2 gap-3">
              <Field label="状態">
                <select name="status" defaultValue={status === "running" ? "running" : "todo"} className={inputClass}>
                  <option value="todo">未着手</option>
                  <option value="running">実行中</option>
                </select>
              </Field>
              <Field label={`進捗 ${progress}% →`}>
                <input name="progress" type="number" min={0} max={100} step={5} defaultValue={progress} className={inputClass} />
              </Field>
            </div>
            <Field label="メモ">
              <input name="note" className={inputClass} placeholder="例: 構成案をClaudeと相談中" />
            </Field>
            <Button type="submit" variant="secondary" disabled={progPending} className="w-full">
              進捗を記録
            </Button>
          </form>
        </Card>
      )}

      {canSubmit && (
        <Card>
          <form ref={resRef} action={resAction} className="space-y-3">
            <h3 className="font-bold">成果物を登録(貼り付け)</h3>
            <p className="text-xs text-muted">
              Claude の出力(Markdown)を貼り付けます。承認が必要なタスクは「承認待ち」になります。再登録すると新しい版(v2, v3…)として残ります。
            </p>
            <ErrorBox message={resState?.error} />
            <textarea name="output_md" rows={8} required className={`${inputClass} font-mono text-sm`} placeholder="# 成果物…" />
            <input name="note" className={inputClass} placeholder="メモ(任意)" />
            <Button type="submit" disabled={resPending} className="w-full" data-testid="submit-result">
              {resPending ? "登録中…" : "成果物を登録"}
            </Button>
          </form>
        </Card>
      )}

      {canRevise && (
        <Card>
          <form ref={revRef} action={revAction} className="space-y-3">
            <h3 className="font-bold">修正を依頼</h3>
            <p className="text-xs text-muted">承認待ちは無効になり、タスクは「未着手」に戻ります。Claude に依頼文を渡すと修正版が提出されます。</p>
            <ErrorBox message={revState?.error} />
            <textarea name="body" rows={3} required className={inputClass} placeholder="例: もっとカジュアルに。絵文字を1つ入れて" />
            <Button type="submit" variant="secondary" disabled={revPending} className="w-full">
              修正依頼を記録
            </Button>
          </form>
        </Card>
      )}
    </section>
  );
}
