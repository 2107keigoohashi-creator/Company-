import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { invoiceTotals, yen } from "@/lib/money";
import type { Invoice } from "@/lib/types";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "請求書(印刷)" };

/** 請求書の印刷用 HTML。ブラウザの「PDF として保存」で PDF 化する(送付機能はない)。 */
export default async function PrintInvoicePage({ params }: PageProps<"/print/invoices/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const [{ data: inv }, settings] = await Promise.all([
    supabase.from("invoices").select("*").eq("id", id).single<Invoice>(),
    getSettings(supabase),
  ]);
  if (!inv) notFound();
  const totals = invoiceTotals(inv.items);

  return (
    <div className="min-h-dvh bg-white text-black print:min-h-0">
      <style>{`@page { size: A4; margin: 16mm; } body { background: #fff !important; }`}</style>
      <article className="mx-auto max-w-[800px] p-8 text-[13px] leading-relaxed print:p-0">
        {inv.status === "draft" && (
          <p className="mb-4 border-2 border-red-500 p-2 text-center font-bold text-red-600">下書き(未確定)</p>
        )}
        <header className="mb-8 flex items-start justify-between">
          <h1 className="text-3xl font-bold tracking-[0.5em]">請求書</h1>
          <dl className="text-right text-xs">
            <div>請求書番号: {inv.number}</div>
            <div>発行日: {inv.issue_date}</div>
          </dl>
        </header>

        <section className="mb-8 flex justify-between gap-8">
          <div className="flex-1">
            <p className="border-b border-black pb-1 text-xl font-bold">{inv.client} 御中</p>
            <p className="mt-4">下記のとおりご請求申し上げます。</p>
            <p className="mt-3 inline-block border-b-2 border-black text-2xl font-bold">ご請求金額 {yen(inv.total)}(税込)</p>
            {inv.due_date && <p className="mt-2">お支払期限: {inv.due_date}</p>}
          </div>
          <div className="w-64 text-right text-xs">
            <p className="text-base font-bold">{settings.company_name || "(社名未設定:設定画面で入力)"}</p>
            <p className="whitespace-pre-wrap">{settings.company_address}</p>
            {settings.invoice_registration_number && <p className="mt-1">登録番号: {settings.invoice_registration_number}</p>}
          </div>
        </section>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-400 p-2 text-left">品目</th>
              <th className="w-16 border border-gray-400 p-2">数量</th>
              <th className="w-28 border border-gray-400 p-2">単価(税抜)</th>
              <th className="w-14 border border-gray-400 p-2">税率</th>
              <th className="w-28 border border-gray-400 p-2">金額(税抜)</th>
            </tr>
          </thead>
          <tbody>
            {inv.items.map((it, i) => (
              <tr key={i}>
                <td className="border border-gray-400 p-2">{it.description}</td>
                <td className="border border-gray-400 p-2 text-right">{it.quantity}</td>
                <td className="border border-gray-400 p-2 text-right">{yen(it.unit_price)}</td>
                <td className="border border-gray-400 p-2 text-right">
                  {it.tax_rate}%{it.tax_rate === 8 ? "※" : ""}
                </td>
                <td className="border border-gray-400 p-2 text-right">{yen(Math.round(it.quantity * it.unit_price))}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <table className="ml-auto mt-4 w-72 border-collapse text-sm">
          <tbody>
            <tr>
              <th className="border border-gray-400 bg-gray-100 p-2 text-left">小計(税抜)</th>
              <td className="border border-gray-400 p-2 text-right">{yen(inv.subtotal)}</td>
            </tr>
            {totals.breakdown.map((b) => (
              <tr key={b.rate}>
                <th className="border border-gray-400 bg-gray-100 p-2 text-left font-normal">
                  {b.rate}%対象 {yen(b.base)} / 消費税
                </th>
                <td className="border border-gray-400 p-2 text-right">{yen(b.tax)}</td>
              </tr>
            ))}
            <tr>
              <th className="border border-gray-400 bg-gray-100 p-2 text-left">合計(税込)</th>
              <td className="border border-gray-400 p-2 text-right font-bold">{yen(inv.total)}</td>
            </tr>
          </tbody>
        </table>
        {inv.items.some((i) => i.tax_rate === 8) && <p className="mt-2 text-xs">※ は軽減税率対象</p>}

        {(inv.note || settings.invoice_note) && (
          <section className="mt-8">
            <h2 className="mb-1 font-bold">備考</h2>
            <p className="whitespace-pre-wrap border border-gray-400 p-3">
              {[inv.note, settings.invoice_note].filter(Boolean).join("\n")}
            </p>
          </section>
        )}
      </article>
      <PrintButton />
    </div>
  );
}
