"use client";

import { useActionState, useState } from "react";
import { invoiceTotals, todayJst, yen } from "@/lib/money";
import { TAX_RATES } from "@/lib/accounting";
import type { Invoice, InvoiceItem } from "@/lib/types";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import type { AccState } from "../actions";

const EMPTY_ITEM: InvoiceItem = { description: "", quantity: 1, unit_price: 0, tax_rate: 10 };

export function InvoiceForm({
  invoice,
  defaultNumber,
  action,
}: {
  invoice?: Invoice;
  defaultNumber?: string;
  action: (p: AccState, fd: FormData) => Promise<AccState>;
}) {
  const [state, formAction, pending] = useActionState(action, undefined);
  const [items, setItems] = useState<InvoiceItem[]>(invoice?.items?.length ? invoice.items : [EMPTY_ITEM]);
  const [note, setNote] = useState(invoice?.note ?? "");
  const totals = invoiceTotals(items.map((i) => ({ ...i, quantity: Number(i.quantity) || 0, unit_price: Number(i.unit_price) || 0 })));

  function update(idx: number, patch: Partial<InvoiceItem>) {
    setItems((xs) => xs.map((x, i) => (i === idx ? { ...x, ...patch } : x)));
  }

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBox message={state?.error} />
      <div className="grid grid-cols-2 gap-3">
        <Field label="請求書番号">
          <input name="number" required defaultValue={invoice?.number ?? defaultNumber} className={inputClass} />
        </Field>
        <Field label="宛先(取引先名)">
          <input name="client" required defaultValue={invoice?.client} className={inputClass} />
        </Field>
        <Field label="発行日">
          <input name="issue_date" type="date" required defaultValue={invoice?.issue_date ?? todayJst()} className={inputClass} />
        </Field>
        <Field label="支払期限">
          <input name="due_date" type="date" defaultValue={invoice?.due_date ?? ""} className={inputClass} />
        </Field>
      </div>

      <section className="space-y-3">
        <h3 className="text-sm font-bold text-muted">明細(単価は税抜)</h3>
        {items.map((it, idx) => (
          <div key={idx} className="space-y-2 rounded-2xl border border-line bg-surface p-3">
            <input
              aria-label="品目"
              value={it.description}
              onChange={(e) => update(idx, { description: e.target.value })}
              placeholder="品目"
              className={inputClass}
            />
            <div className="grid grid-cols-[4rem_1fr_5rem] gap-2">
              <input
                aria-label="数量"
                type="number"
                min={0}
                step="any"
                value={it.quantity}
                onChange={(e) => update(idx, { quantity: e.target.value as unknown as number })}
                className={inputClass}
              />
              <input
                aria-label="単価"
                type="number"
                inputMode="numeric"
                min={0}
                value={it.unit_price}
                onChange={(e) => update(idx, { unit_price: e.target.value as unknown as number })}
                className={inputClass}
              />
              <select
                aria-label="税率"
                value={it.tax_rate}
                onChange={(e) => update(idx, { tax_rate: Number(e.target.value) })}
                className={inputClass}
              >
                {TAX_RATES.map((r) => (
                  <option key={r} value={r}>
                    {r}%
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="tabular-nums text-muted">小計 {yen(Math.round((Number(it.quantity) || 0) * (Number(it.unit_price) || 0)))}</span>
              {items.length > 1 && (
                <button type="button" className="min-h-11 px-2 text-rose-400" onClick={() => setItems((xs) => xs.filter((_, i) => i !== idx))}>
                  削除
                </button>
              )}
            </div>
          </div>
        ))}
        <Button type="button" variant="secondary" className="w-full" onClick={() => setItems((xs) => [...xs, EMPTY_ITEM])}>
          ＋ 明細を追加
        </Button>
      </section>

      <div className="rounded-2xl bg-surface-2 p-4 text-sm tabular-nums">
        <div className="flex justify-between">
          <span>小計(税抜)</span>
          <span>{yen(totals.subtotal)}</span>
        </div>
        {totals.breakdown.map((b) => (
          <div key={b.rate} className="flex justify-between text-muted">
            <span>
              消費税 {b.rate}%(対象 {yen(b.base)})
            </span>
            <span>{yen(b.tax)}</span>
          </div>
        ))}
        <div className="mt-1 flex justify-between border-t border-line pt-1 text-base font-black">
          <span>合計(税込)</span>
          <span data-testid="invoice-total">{yen(totals.total)}</span>
        </div>
      </div>

      <Field label="備考">
        <textarea name="note" rows={2} value={note} onChange={(e) => setNote(e.target.value)} className={inputClass} />
      </Field>
      <input
        type="hidden"
        name="items"
        value={JSON.stringify(
          items.map((i) => ({ ...i, quantity: Number(i.quantity), unit_price: Number(i.unit_price) })),
        )}
      />
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "保存中…" : "下書きとして保存"}
      </Button>
    </form>
  );
}
