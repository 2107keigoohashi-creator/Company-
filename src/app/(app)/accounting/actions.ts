"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { invoiceTotals, splitTax } from "@/lib/money";

export type AccState = { error?: string } | undefined;

const MoneyBase = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日付を入力してください"),
  input_amount: z.coerce.number().int("金額は整数(円)で入力してください").min(0).max(10_000_000_000),
  tax_mode: z.enum(["excl", "incl"]),
  tax_rate: z.coerce.number().min(0).max(100),
  category: z.string().trim().max(50),
  note: z.string().trim().max(1000).default(""),
});

function money(data: z.infer<typeof MoneyBase>) {
  const { input_amount, tax_mode, ...rest } = data;
  return { ...rest, ...splitTax(input_amount, data.tax_rate, tax_mode) };
}

function refreshAccounting() {
  revalidatePath("/accounting", "layout");
}

// ---------------------------------------------------------------------------
// 売上
// ---------------------------------------------------------------------------
const SaleSchema = MoneyBase.extend({ client: z.string().trim().max(200).default("") });

export async function saveSale(id: string | null, _prev: AccState, formData: FormData): Promise<AccState> {
  const { supabase, user } = await requireOwner();
  const parsed = SaleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const row = money(parsed.data);
  const res = id
    ? await supabase.from("sales").update(row).eq("id", id).select("id").single()
    : await supabase.from("sales").insert({ ...row, owner_id: user.id }).select("id").single();
  if (res.error) return { error: res.error.message };
  await audit(supabase, user.id, {
    actor: "owner",
    action: id ? "sale.updated" : "sale.created",
    targetType: "sale",
    targetId: res.data.id,
    detail: { date: row.date, amount: row.amount },
  });
  refreshAccounting();
  redirect(`/accounting/sales?month=${row.date.slice(0, 7)}`);
}

export async function deleteSale(id: string) {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("sales").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, { actor: "owner", action: "sale.deleted", targetType: "sale", targetId: id });
  refreshAccounting();
  redirect("/accounting/sales");
}

// ---------------------------------------------------------------------------
// 経費(下書き → オーナー確定)
// ---------------------------------------------------------------------------
const ExpenseSchema = MoneyBase.extend({
  vendor: z.string().trim().max(200).default(""),
  ai_note: z.string().trim().max(1000).default(""),
  intent: z.enum(["draft", "confirm"]).default("draft"),
});

export async function saveExpense(id: string | null, _prev: AccState, formData: FormData): Promise<AccState> {
  const { supabase, user } = await requireOwner();
  const parsed = ExpenseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { intent, ...data } = parsed.data;
  if (intent === "confirm" && !data.category) return { error: "確定するには勘定科目(分類)を選んでください" };
  const row = { ...money(data), status: intent === "confirm" ? "confirmed" : "draft" };
  const res = id
    ? await supabase.from("expenses").update(row).eq("id", id).select("id").single()
    : await supabase.from("expenses").insert({ ...row, owner_id: user.id }).select("id").single();
  if (res.error) return { error: res.error.message };
  await audit(supabase, user.id, {
    actor: "owner",
    action: intent === "confirm" ? "expense.confirmed" : id ? "expense.updated" : "expense.created",
    targetType: "expense",
    targetId: res.data.id,
    detail: { date: row.date, amount: row.amount, category: row.category },
  });
  refreshAccounting();
  redirect(`/accounting/expenses?month=${row.date.slice(0, 7)}`);
}

export async function deleteExpense(id: string) {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("expenses").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, { actor: "owner", action: "expense.deleted", targetType: "expense", targetId: id });
  refreshAccounting();
  redirect("/accounting/expenses");
}

// ---------------------------------------------------------------------------
// 請求書(下書き → 確定 → 入金済)。送付はしない。
// ---------------------------------------------------------------------------
const ItemSchema = z.object({
  description: z.string().trim().min(1, "明細の品目を入力してください").max(200),
  quantity: z.coerce.number().positive("数量は正の数で入力してください").max(1_000_000),
  unit_price: z.coerce.number().int("単価は整数(円)で入力してください").min(0).max(10_000_000_000),
  tax_rate: z.coerce.number().min(0).max(100),
});

const InvoiceSchema = z.object({
  number: z.string().trim().min(1, "請求書番号を入力してください").max(50),
  client: z.string().trim().min(1, "宛先を入力してください").max(200),
  issue_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "発行日を入力してください"),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).or(z.literal("")).optional(),
  note: z.string().trim().max(2000).default(""),
  items: z.array(ItemSchema).min(1, "明細を1行以上入力してください").max(100),
});

export async function saveInvoice(id: string | null, _prev: AccState, formData: FormData): Promise<AccState> {
  const { supabase, user } = await requireOwner();
  let items: unknown;
  try {
    items = JSON.parse(String(formData.get("items") ?? "[]"));
  } catch {
    return { error: "明細の形式が不正です" };
  }
  const parsed = InvoiceSchema.safeParse({ ...Object.fromEntries(formData), items });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message };
  const { due_date, ...data } = parsed.data;

  if (id) {
    const { data: current } = await supabase.from("invoices").select("status").eq("id", id).single();
    if (current && current.status !== "draft") return { error: "確定済みの請求書は編集できません" };
  }
  const totals = invoiceTotals(data.items);
  const row = {
    ...data,
    due_date: due_date || null,
    subtotal: totals.subtotal,
    tax: totals.tax,
    total: totals.total,
  };
  const res = id
    ? await supabase.from("invoices").update(row).eq("id", id).select("id").single()
    : await supabase.from("invoices").insert({ ...row, owner_id: user.id, status: "draft" }).select("id").single();
  if (res.error) {
    return { error: res.error.code === "23505" ? "同じ請求書番号が既にあります" : res.error.message };
  }
  await audit(supabase, user.id, {
    actor: "owner",
    action: id ? "invoice.updated" : "invoice.created",
    targetType: "invoice",
    targetId: res.data.id,
    detail: { number: row.number, total: row.total },
  });
  refreshAccounting();
  redirect(`/accounting/invoices/${res.data.id}`);
}

export async function setInvoiceStatus(id: string, status: "confirmed" | "paid" | "draft") {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase
    .from("invoices")
    .update({ status, paid_at: status === "paid" ? new Date().toISOString().slice(0, 10) : null })
    .eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, { actor: "owner", action: `invoice.${status}`, targetType: "invoice", targetId: id });
  refreshAccounting();
}

export async function deleteInvoice(id: string) {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("invoices").delete().eq("id", id).eq("status", "draft");
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, { actor: "owner", action: "invoice.deleted", targetType: "invoice", targetId: id });
  refreshAccounting();
  redirect("/accounting/invoices");
}
