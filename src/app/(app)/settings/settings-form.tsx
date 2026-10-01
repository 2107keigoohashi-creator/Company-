"use client";

import { useActionState } from "react";
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
