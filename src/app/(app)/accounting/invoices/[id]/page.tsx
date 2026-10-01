import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { invoiceTotals, yen } from "@/lib/money";
import { INVOICE_STATUS } from "@/lib/accounting";
import type { Invoice } from "@/lib/types";
import { Badge, Button, Card, LinkButton, PageHeader, buttonClass } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { deleteInvoice, setInvoiceStatus } from "../../actions";

export const metadata: Metadata = { title: "請求書" };

export default async function InvoicePage({ params }: PageProps<"/accounting/invoices/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: inv } = await supabase.from("invoices").select("*").eq("id", id).single<Invoice>();
  if (!inv) notFound();
  const totals = invoiceTotals(inv.items);
  const st = INVOICE_STATUS[inv.status];

  return (
    <>
      <PageHeader
        title={inv.number}
        back="/accounting/invoices"
        action={
          inv.status === "draft" ? (
            <LinkButton href={`/accounting/invoices/${id}/edit`} variant="ghost" className="!min-h-10 px-2">
              編集
            </LinkButton>
          ) : undefined
        }
      />
      <div className="space-y-4">
        <Card className="space-y-2">
          <Badge className={st.className}>{st.label}</Badge>
          <p className="text-lg font-bold">{inv.client} 御中</p>
          <p className="text-sm text-muted">
            発行日 {inv.issue_date} ・支払期限 {inv.due_date ?? "なし"}
            {inv.paid_at && ` ・入金日 ${inv.paid_at}`}
          </p>
          <ul className="divide-y divide-line text-sm">
            {inv.items.map((it, i) => (
              <li key={i} className="flex justify-between gap-2 py-2">
                <span>
                  {it.description}
                  <span className="block text-xs text-muted">
                    {it.quantity} × {yen(it.unit_price)}({it.tax_rate}%)
                  </span>
                </span>
                <span className="tabular-nums">{yen(Math.round(it.quantity * it.unit_price))}</span>
              </li>
            ))}
          </ul>
          <div className="border-t border-line pt-2 text-sm tabular-nums">
            <div className="flex justify-between">
              <span>小計</span>
              <span>{yen(inv.subtotal)}</span>
            </div>
            {totals.breakdown.map((b) => (
              <div key={b.rate} className="flex justify-between text-muted">
                <span>消費税 {b.rate}%</span>
                <span>{yen(b.tax)}</span>
              </div>
            ))}
            <div className="flex justify-between text-lg font-black">
              <span>合計</span>
              <span>{yen(inv.total)}</span>
            </div>
          </div>
          {inv.note && <p className="whitespace-pre-wrap text-sm text-muted">{inv.note}</p>}
        </Card>

        <a href={`/print/invoices/${id}`} target="_blank" className={buttonClass("secondary", "w-full")}>
          🖨 PDF で保存(印刷画面を開く)
        </a>
        <p className="text-xs text-muted">※ このアプリは請求書を送付しません。PDF を保存してオーナーが手動で送付してください。</p>

        {inv.status === "draft" && (
          <form action={setInvoiceStatus.bind(null, id, "confirmed")}>
            <ConfirmButton message="内容を確認し、この請求書を確定しますか?(確定後は編集できません)" variant="success" className="w-full">
              内容を確認して確定
            </ConfirmButton>
          </form>
        )}
        {inv.status === "confirmed" && (
          <div className="grid grid-cols-2 gap-2">
            <form action={setInvoiceStatus.bind(null, id, "draft")}>
              <Button type="submit" variant="ghost" className="w-full">
                下書きに戻す
              </Button>
            </form>
            <form action={setInvoiceStatus.bind(null, id, "paid")}>
              <ConfirmButton message="入金済みにしますか?" variant="success" className="w-full">
                入金済みにする
              </ConfirmButton>
            </form>
          </div>
        )}
        {inv.status === "paid" && (
          <form action={setInvoiceStatus.bind(null, id, "confirmed")}>
            <Button type="submit" variant="ghost" className="w-full">
              未入金に戻す
            </Button>
          </form>
        )}
        {inv.status === "draft" && (
          <form action={deleteInvoice.bind(null, id)}>
            <ConfirmButton message="この下書きを削除しますか?" variant="ghost" className="w-full text-rose-400">
              削除
            </ConfirmButton>
          </form>
        )}
      </div>
    </>
  );
}
