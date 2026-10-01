"use client";

import { useActionState, useState } from "react";
import { splitTax, todayJst, yen, type TaxMode } from "@/lib/money";
import { EXPENSE_CATEGORIES, SALES_CATEGORIES, TAX_RATES } from "@/lib/accounting";
import type { Expense, Sale } from "@/lib/types";
import { Button, ErrorBox, Field, inputClass } from "@/components/ui";
import type { AccState } from "./actions";

type Props =
  | { kind: "sale"; row?: Sale; action: (p: AccState, fd: FormData) => Promise<AccState> }
  | { kind: "expense"; row?: Expense; action: (p: AccState, fd: FormData) => Promise<AccState> };

export function MoneyForm(props: Props) {
  const { kind, row, action } = props;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [amount, setAmount] = useState(row ? String(row.amount) : "");
  const [mode, setMode] = useState<TaxMode>("incl");
  const [rate, setRate] = useState(row?.tax_rate ?? 10);
  const [category, setCategory] = useState(row?.category ?? "");
  const expense = kind === "expense" ? props.row : undefined;

  const n = Number(amount);
  const preview = amount && Number.isFinite(n) ? splitTax(n, rate, mode) : null;
  const categories = kind === "sale" ? SALES_CATEGORIES : EXPENSE_CATEGORIES;

  return (
    <form action={formAction} className="space-y-4">
      <ErrorBox message={state?.error} />
      <Field label="日付">
        <input name="date" type="date" required defaultValue={row?.date ?? todayJst()} className={inputClass} />
      </Field>

      <div className="grid grid-cols-[1fr_auto] gap-3">
        <Field label="金額(円)">
          <input
            name="input_amount"
            type="number"
            inputMode="numeric"
            min={0}
            step={1}
            required
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="入力方式">
          <select name="tax_mode" value={mode} onChange={(e) => setMode(e.target.value as TaxMode)} className={inputClass}>
            <option value="incl">税込</option>
            <option value="excl">税抜</option>
          </select>
        </Field>
      </div>
      <Field label="税率">
        <select name="tax_rate" value={rate} onChange={(e) => setRate(Number(e.target.value))} className={inputClass}>
          {TAX_RATES.map((r) => (
            <option key={r} value={r}>
              {r}%{r === 8 ? "(軽減)" : r === 0 ? "(非課税/不課税)" : ""}
            </option>
          ))}
        </select>
      </Field>
      {preview && (
        <p className="rounded-xl bg-surface-2 p-3 text-sm tabular-nums" data-testid="tax-preview">
          税抜 {yen(preview.amount_excl)} + 税 {yen(preview.tax_amount)} = <b>税込 {yen(preview.amount)}</b>
        </p>
      )}

      {kind === "sale" ? (
        <Field label="取引先">
          <input name="client" defaultValue={(row as Sale | undefined)?.client} className={inputClass} />
        </Field>
      ) : (
        <Field label="支払先">
          <input name="vendor" defaultValue={expense?.vendor} className={inputClass} />
        </Field>
      )}
      <Field label="メモ">
        <textarea name="note" rows={2} defaultValue={row?.note} className={inputClass} />
      </Field>

      <Field label={kind === "sale" ? "区分" : "勘定科目(分類)"}>
        <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
          <option value="">未分類</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </Field>

      {kind === "expense" && (
        <p className="text-xs text-muted">
          ※ 分類は目安です。税務上の扱いは断定できないため、判断に迷うものは税理士など専門家に確認してください。
        </p>
      )}

      {kind === "sale" ? (
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "保存中…" : "保存"}
        </Button>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          <Button type="submit" name="intent" value="draft" variant="secondary" disabled={pending}>
            下書き保存
          </Button>
          <Button type="submit" name="intent" value="confirm" variant="success" disabled={pending}>
            確認して確定
          </Button>
        </div>
      )}
    </form>
  );
}
