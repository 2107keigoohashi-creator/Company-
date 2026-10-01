import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { getSettings, monthlyUsage } from "@/lib/ai/usage";
import { monthRange, shiftMonth, todayJst, yen } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/accounting";
import type { Invoice } from "@/lib/types";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { MonthNav, resolveMonth } from "@/components/month-nav";
import { UsageCard } from "@/components/usage-card";
import { CategoryChart, TrendChart, type TrendPoint } from "./charts";

export const metadata: Metadata = { title: "経理ダッシュボード" };

const TREND_MONTHS = 6;

function pctChange(cur: number, prev: number) {
  if (prev === 0) return cur === 0 ? 0 : null;
  return ((cur - prev) / Math.abs(prev)) * 100;
}

export default async function AccountingDashboard({ searchParams }: PageProps<"/accounting">) {
  const month = resolveMonth((await searchParams).month, todayJst().slice(0, 7));
  const { supabase } = await requireOwner();

  const firstMonth = shiftMonth(month, -(TREND_MONTHS - 1));
  const from = monthRange(firstMonth).start;
  const to = monthRange(month).end;
  const today = todayJst();
  const soon = new Date(Date.parse(today) + 7 * 86400_000).toISOString().slice(0, 10);

  const [{ data: sales }, { data: expenses }, { data: invoices }, { count: draftCount }, settings, usage] = await Promise.all([
    supabase.from("sales").select("date, amount_excl").gte("date", from).lt("date", to),
    supabase.from("expenses").select("date, amount_excl, category").eq("status", "confirmed").gte("date", from).lt("date", to),
    supabase.from("invoices").select("*").eq("status", "confirmed").order("due_date", { ascending: true, nullsFirst: false }).returns<Invoice[]>(),
    supabase.from("expenses").select("id", { count: "exact", head: true }).eq("status", "draft"),
    getSettings(supabase),
    monthlyUsage(supabase),
  ]);

  const months = Array.from({ length: TREND_MONTHS }, (_, i) => shiftMonth(firstMonth, i));
  const trend: TrendPoint[] = months.map((m) => {
    const s = (sales ?? []).filter((r) => r.date.startsWith(m)).reduce((a, r) => a + r.amount_excl, 0);
    const e = (expenses ?? []).filter((r) => r.date.startsWith(m)).reduce((a, r) => a + r.amount_excl, 0);
    return { month: `${Number(m.slice(5))}月`, sales: s, expenses: e, profit: s - e };
  });
  const cur = trend[TREND_MONTHS - 1];
  const prev = trend[TREND_MONTHS - 2];

  const byCategory = new Map<string, number>();
  for (const r of expenses ?? []) {
    if (!r.date.startsWith(month)) continue;
    const k = r.category || "未分類";
    byCategory.set(k, (byCategory.get(k) ?? 0) + r.amount_excl);
  }
  const categories = [...byCategory.entries()].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);

  const kpis = [
    { label: "売上", value: cur.sales, change: pctChange(cur.sales, prev.sales), goodWhenUp: true, testid: "kpi-sales" },
    { label: "経費", value: cur.expenses, change: pctChange(cur.expenses, prev.expenses), goodWhenUp: false, testid: "kpi-expenses" },
    { label: "粗利", value: cur.profit, change: pctChange(cur.profit, prev.profit), goodWhenUp: true, testid: "kpi-profit" },
  ];

  return (
    <>
      <PageHeader title="経理ダッシュボード" />
      <MonthNav month={month} basePath="/accounting" />

      <div className="space-y-4">
        <section className="grid grid-cols-3 gap-2" aria-label="今月の主要指標(税抜)">
          {kpis.map((k) => {
            const up = (k.change ?? 0) > 0;
            const good = k.change === null || k.change === 0 ? null : up === k.goodWhenUp;
            return (
              <Card key={k.label} className="p-3" data-testid={k.testid}>
                <p className="text-xs font-semibold text-muted">{k.label}</p>
                <p className={`mt-1 text-base font-black tabular-nums ${k.value < 0 ? "text-rose-300" : ""}`}>{yen(k.value)}</p>
                <p className={`mt-0.5 text-[11px] tabular-nums ${good === null ? "text-muted" : good ? "text-emerald-300" : "text-rose-300"}`}>
                  前月比 {k.change === null ? "—" : `${up ? "▲" : k.change < 0 ? "▼" : "±"}${Math.abs(k.change).toFixed(0)}%`}
                </p>
              </Card>
            );
          })}
        </section>
        <p className="-mt-2 text-[11px] text-muted">※ 金額は税抜。経費は確定分のみ。</p>

        {(draftCount ?? 0) > 0 && (
          <Link href="/accounting/expenses" className="block rounded-xl border border-amber-400/60 bg-amber-950/40 p-3 text-sm text-amber-200">
            未確定の経費(下書き)が {draftCount} 件あります → 確認する
          </Link>
        )}

        <Card>
          <h2 className="mb-2 text-sm font-bold">月次推移(直近{TREND_MONTHS}か月)</h2>
          <TrendChart data={trend} />
          <details className="mt-2 text-xs">
            <summary className="cursor-pointer text-muted">表で見る</summary>
            <table className="mt-2 w-full tabular-nums">
              <thead className="text-muted">
                <tr>
                  <th className="text-left font-normal">月</th>
                  <th className="text-right font-normal">売上</th>
                  <th className="text-right font-normal">経費</th>
                  <th className="text-right font-normal">粗利</th>
                </tr>
              </thead>
              <tbody>
                {trend.map((t) => (
                  <tr key={t.month}>
                    <td>{t.month}</td>
                    <td className="text-right">{yen(t.sales)}</td>
                    <td className="text-right">{yen(t.expenses)}</td>
                    <td className="text-right">{yen(t.profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-bold">経費カテゴリ別内訳({Number(month.slice(5))}月)</h2>
          {categories.length === 0 ? <Empty>確定済みの経費はありません</Empty> : <CategoryChart data={categories} />}
        </Card>

        <Card>
          <h2 className="mb-2 text-sm font-bold">未入金の請求書</h2>
          {(invoices ?? []).length === 0 ? (
            <Empty>未入金の請求書はありません</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {invoices!.map((inv) => {
                const overdue = !!inv.due_date && inv.due_date < today;
                const dueSoon = !overdue && !!inv.due_date && inv.due_date <= soon;
                return (
                  <li key={inv.id}>
                    <Link href={`/accounting/invoices/${inv.id}`} className="flex min-h-12 items-center gap-2 py-2 text-sm">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">{inv.client}</span>
                        <span className={`text-xs ${overdue ? "font-bold text-rose-400" : dueSoon ? "text-amber-300" : "text-muted"}`}>
                          {inv.due_date ? `期限 ${inv.due_date}` : "期限なし"}
                          {overdue ? " ⚠ 期限超過" : dueSoon ? " ⏰ 期限間近" : ""}
                        </span>
                      </span>
                      <Badge className={INVOICE_STATUS.confirmed.className}>未入金</Badge>
                      <span className="font-bold tabular-nums">{yen(inv.total)}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <UsageCard usage={usage} settings={settings} />
      </div>
    </>
  );
}
