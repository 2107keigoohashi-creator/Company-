"use client";

import { useActionState } from "react";
import type { Employee } from "@/lib/types";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import type { EmployeeState } from "../actions";

export function EmployeeForm({
  employee,
  action,
}: {
  employee: Employee;
  action: (prev: EmployeeState, fd: FormData) => Promise<EmployeeState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  return (
    <form action={formAction} className="space-y-4">
      <ErrorBox message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="名前">
          <input name="name" defaultValue={employee.name} required className={inputClass} />
        </Field>
        <Field label="役割">
          <input name="role" defaultValue={employee.role} required className={inputClass} />
        </Field>
      </div>
      <Field label="担当">
        <textarea name="responsibilities" rows={2} defaultValue={employee.responsibilities} className={inputClass} />
      </Field>
      <Field label="できること">
        <textarea name="capabilities" rows={3} defaultValue={employee.capabilities} className={inputClass} />
      </Field>
      <Field label="禁止事項">
        <textarea name="prohibitions" rows={3} defaultValue={employee.prohibitions} className={inputClass} />
      </Field>
      <Field label="個別の指針(Claude が作業時に読みます)" hint="全社員共通ルール(未成年配慮・取り消せない行為は案として提出 等)は「Claude の使い方」の指示文に含まれます">
        <textarea name="system_prompt" rows={8} defaultValue={employee.system_prompt} className={`${inputClass} font-mono text-sm`} />
      </Field>
      <label className="flex min-h-11 items-center gap-3 text-sm">
        <input type="checkbox" name="enabled" defaultChecked={employee.enabled} className="h-5 w-5 accent-cyan-400" />
        有効(無効にするとタスクを実行できません)
      </label>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "保存中…" : "保存"}
      </Button>
    </form>
  );
}
