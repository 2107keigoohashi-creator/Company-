import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { monthRange, todayJst, yen } from "@/lib/money";
import type { Sale } from "@/lib/types";
import { Empty, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { MonthNav, resolveMonth } from "@/components/month-nav";

export const metadata: Metadata = { title: "売上" };

export default async function SalesPage({ searchParams }: PageProps<"/accounting/sales">) {
  const month = resolveMonth((await searchParams).month, todayJst().slice(0, 7));
  const { supabase } = await requireOwner();
  const { start, end } = monthRange(month);
  const { data } = await supabase
    .from("sales")
    .select("*")
    .gte("date", start)
    .lt("date", end)
    .order("date", { ascending: false })
    .returns<Sale[]>();
  const rows = data ?? [];
  const total = rows.reduce((s, r) => s + r.amount, 0);
  const excl = rows.reduce((s, r) => s + r.amount_excl, 0);

  return (
    <>
      <PageHeader title="売上" action={<LinkButton href="/accounting/sales/new" className="!min-h-10 px-3">＋ 登録</LinkButton>} />
      <MonthNav month={month} basePath="/accounting/sales" />
      <p className="mb-3 text-sm text-muted">
        合計 <b className="text-lg text-fg tabular-nums">{yen(total)}</b>(税抜 {yen(excl)})
      </p>
      <ul className="space-y-2">
        {rows.length === 0 && <Empty>この月の売上はまだありません</Empty>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/accounting/sales/${r.id}`} className="flex items-center gap-3 rounded-xl border border-line bg-surface p-3">
              <span className="w-12 text-xs text-muted tabular-nums">{r.date.slice(5).replace("-", "/")}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-semibold">{r.client || r.category || "売上"}</span>
                <span className="block truncate text-xs text-muted">{r.category}{r.note && ` ・${r.note}`}</span>
              </span>
              <span className="font-bold tabular-nums">{yen(r.amount)}</span>
            </Link>
          </li>
        ))}
      </ul>
      <a href={`/api/export?type=sales&month=${month}`} className={buttonClass("secondary", "mt-6 w-full")}>
        CSV エクスポート({month})
      </a>
    </>
  );
}
