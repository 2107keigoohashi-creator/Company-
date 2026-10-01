"use client";

import { useActionState } from "react";
import { MODELS } from "@/lib/ai/models";
import type { Settings } from "@/lib/types";
import { Button, Card, ErrorBox, Field, inputClass } from "@/components/ui";
import { saveSettings } from "./actions";

export function SettingsForm({ settings }: { settings: Settings }) {
  const [state, action, pending] = useActionState(saveSettings, undefined);
  return (
    <form action={action} className="space-y-4">
      <ErrorBox message={state?.error} />
      {state?.saved && <p className="rounded-xl bg-emerald-950/60 p-3 text-sm text-emerald-200">保存しました</p>}

      <Card className="space-y-4">
        <h2 className="font-bold">Claude API(コスト対策)</h2>
        <Field label="使用モデル">
          <select name="claude_model" defaultValue={settings.claude_model} className={inputClass}>
            {MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label} 入力${m.input}/出力${m.output} per 1M
              </option>
            ))}
          </select>
        </Field>
        <Field label="1実行あたりの最大出力トークン" hint="256〜64000。長文の成果物が途中で切れる場合は増やす">
          <input name="max_tokens_per_run" type="number" min={256} max={64000} defaultValue={settings.max_tokens_per_run} className={inputClass} />
        </Field>
        <Field label="月次の利用トークン上限(入力+出力)">
          <input name="monthly_token_limit" type="number" min={0} step={1000} defaultValue={settings.monthly_token_limit} className={inputClass} />
        </Field>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input type="checkbox" name="stop_on_limit" defaultChecked={settings.stop_on_limit} className="h-5 w-5 accent-cyan-400" />
          上限を超えたら AI の実行を止める
        </label>
      </Card>

      <Card className="space-y-4">
        <h2 className="font-bold">請求書に記載する自社情報</h2>
        <Field label="社名">
          <input name="company_name" defaultValue={settings.company_name} className={inputClass} />
        </Field>
        <Field label="所在地">
          <textarea name="company_address" rows={2} defaultValue={settings.company_address} className={inputClass} />
        </Field>
        <Field label="インボイス登録番号" hint="例: T1234567890123(未登録なら空欄)">
          <input name="invoice_registration_number" defaultValue={settings.invoice_registration_number} className={inputClass} />
        </Field>
        <Field label="請求書の備考(振込先などは記載しない運用を推奨)">
          <textarea name="invoice_note" rows={2} defaultValue={settings.invoice_note} className={inputClass} />
        </Field>
      </Card>

      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "保存中…" : "設定を保存"}
      </Button>
    </form>
  );
}
