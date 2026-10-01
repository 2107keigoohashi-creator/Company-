"use client";

import { useActionState, useRef, useState } from "react";
import type { ApprovalType, Employee, Task } from "@/lib/types";
import { APPROVAL_TYPE, PRIORITY } from "@/lib/labels";
import { toJstInput } from "@/lib/time";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import type { FormState } from "./actions";

export function TaskForm({
  employees,
  task,
  action,
  submitLabel,
}: {
  employees: Pick<Employee, "id" | "name" | "responsibilities" | "enabled">[];
  task?: Task;
  action: (prev: FormState, formData: FormData) => Promise<FormState>;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [employeeId, setEmployeeId] = useState(task?.employee_id ?? "");
  const [suggestion, setSuggestion] = useState<string | null>(null);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  async function askPresident() {
    const fd = new FormData(formRef.current!);
    setAssigning(true);
    setAssignError(null);
    setSuggestion(null);
    try {
      const res = await fetch("/api/assign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: fd.get("title"), instruction: fd.get("instruction") }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "提案を取得できませんでした");
      setEmployeeId(json.employeeId);
      setSuggestion(`社長の提案: ${json.name} — ${json.reason}`);
    } catch (e) {
      setAssignError(e instanceof Error ? e.message : String(e));
    } finally {
      setAssigning(false);
    }
  }

  return (
    <form ref={formRef} action={formAction} className="space-y-4">
      <ErrorBox message={state?.error} />
      <Field label="タイトル">
        <input name="title" required maxLength={200} defaultValue={task?.title} className={inputClass} placeholder="例: 新機能告知のX投稿を作成" />
      </Field>
      <Field label="詳細指示" hint="目的・対象・トーン・文字数などを書くと精度が上がります">
        <textarea name="instruction" rows={6} defaultValue={task?.instruction} className={inputClass} />
      </Field>

      <div className="space-y-2">
        <Field label="担当社員">
          <select
            name="employee_id"
            required
            value={employeeId}
            onChange={(e) => setEmployeeId(e.target.value)}
            className={inputClass}
          >
            <option value="">選択してください</option>
            {employees.map((e) => (
              <option key={e.id} value={e.id} disabled={!e.enabled}>
                {e.name}({e.responsibilities.slice(0, 18)}){e.enabled ? "" : " ※無効"}
              </option>
            ))}
          </select>
        </Field>
        <Button type="button" variant="secondary" onClick={askPresident} disabled={assigning} className="w-full">
          {assigning ? "社長が検討中…" : "👔 社長におまかせ(担当を提案)"}
        </Button>
        {suggestion && <p className="rounded-xl bg-surface-2 p-3 text-sm text-accent">{suggestion}</p>}
        <ErrorBox message={assignError} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="優先度">
          <select name="priority" defaultValue={task?.priority ?? "normal"} className={inputClass}>
            {Object.entries(PRIORITY).map(([k, v]) => (
              <option key={k} value={k}>
                {v.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="期限">
          <input name="due_at" type="datetime-local" defaultValue={toJstInput(task?.due_at)} className={inputClass} />
        </Field>
      </div>

      <Field label="承認種別" hint="外部に出る/取り消せない成果物は承認必須にしてください">
        <select name="approval_type" defaultValue={task?.approval_type ?? "none"} className={inputClass}>
          {(Object.keys(APPROVAL_TYPE) as ApprovalType[]).map((k) => (
            <option key={k} value={k}>
              {APPROVAL_TYPE[k].label}
            </option>
          ))}
        </select>
      </Field>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "保存中…" : submitLabel}
      </Button>
    </form>
  );
}
