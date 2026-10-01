import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { yen } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/accounting";
import type { Invoice } from "@/lib/types";
import { Badge, Empty, LinkButton, PageHeader, buttonClass } from "@/components/ui";

export const metadata: Metadata = { title: "請求書" };

export default async function InvoicesPage() {
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("invoices")
    .select("*")
    .order("issue_date", { ascending: false })
    .limit(200)
    .returns<Invoice[]>();
  const rows = data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return (
    <>
      <PageHeader title="請求書" action={<LinkButton href="/accounting/invoices/new" className="!min-h-10 px-3">＋ 作成</LinkButton>} />
      <ul className="space-y-2">
        {rows.length === 0 && <Empty>請求書はまだありません</Empty>}
        {rows.map((r) => {
          const overdue = r.status === "confirmed" && r.due_date && r.due_date < today;
          return (
            <li key={r.id}>
              <Link href={`/accounting/invoices/${r.id}`} className={`block rounded-xl border bg-surface p-3 ${overdue ? "border-rose-500/70" : "border-line"}`}>
                <div className="flex items-center gap-2">
                  <Badge className={INVOICE_STATUS[r.status].className}>{INVOICE_STATUS[r.status].label}</Badge>
                  <span className="flex-1 truncate font-semibold">{r.client}</span>
                  <span className="font-bold tabular-nums">{yen(r.total)}</span>
                </div>
                <div className="mt-1 flex justify-between text-xs text-muted">
                  <span>{r.number}</span>
                  <span className={overdue ? "font-bold text-rose-400" : ""}>
                    {r.due_date ? `期限 ${r.due_date}${overdue ? " ⚠超過" : ""}` : "期限なし"}
                  </span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
      <a href="/api/export?type=invoices" className={buttonClass("secondary", "mt-6 w-full")}>
        CSV エクスポート(全請求書)
      </a>
    </>
  );
}
