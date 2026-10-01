import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { monthRange, todayJst, yen } from "@/lib/money";
import { EXPENSE_STATUS } from "@/lib/accounting";
import type { Expense } from "@/lib/types";
import { Badge, Empty, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { MonthNav, resolveMonth } from "@/components/month-nav";

export const metadata: Metadata = { title: "経費" };

export default async function ExpensesPage({ searchParams }: PageProps<"/accounting/expenses">) {
  const month = resolveMonth((await searchParams).month, todayJst().slice(0, 7));
  const { supabase } = await requireOwner();
  const { start, end } = monthRange(month);
  const { data } = await supabase
    .from("expenses")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .returns<Expense[]>();
  const rows = data ?? [];
  const confirmed = rows.filter((r) => r.status === "confirmed").reduce((s, r) => s + r.amount, 0);
  const drafts = rows.filter((r) => r.status === "draft");

  return (
    <>
      <PageHeader title="経費" action={<LinkButton href="/accounting/expenses/new" className="!min-h-10 px-3">＋ 登録</LinkButton>} />
      <MonthNav month={month} basePath="/accounting/expenses" />
      <p className="mb-3 text-sm text-muted">
        確定合計 <b className="text-lg text-fg tabular-nums">{yen(confirmed)}</b>
        {drafts.length > 0 && <span className="ml-2 text-amber-300">下書き {drafts.length} 件(未確定)</span>}
      </p>
      <ul className="space-y-2">
        {rows.length === 0 && <Empty>この月の経費はまだありません</Empty>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/accounting/expenses/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3" data-testid="expense-row">
              <span className="w-12 text-xs text-muted tabular-nums">{r.date.slice(5).replace("-", "/")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.vendor || "(支払先なし)"}</span>
                <span className="flex items-center gap-2 text-xs text-muted">
                  <Badge className={EXPENSE_STATUS[r.status].className}>{EXPENSE_STATUS[r.status].label}</Badge>
                  {r.category || "未分類"}
                </span>
              </span>
              <span className="font-bold tabular-nums">{yen(r.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <a href={`/api/export?type=expenses&month=${month}`} className={buttonClass("secondary", "mt-6 w-full")}>
        CSV エクスポート({month}・確定分)
      </a>
    </>
  );
}
