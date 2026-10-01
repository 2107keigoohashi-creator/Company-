import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { todayJst } from "@/lib/money";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "../invoice-form";
import { saveInvoice } from "../../actions";

export const metadata: Metadata = { title: "請求書作成" };

export default async function NewInvoicePage() {
  const { supabase } = await requireOwner();
  const ym = todayJst().slice(0, 7).replace("-", "");
  const { count } = await supabase
    .from("invoices")
    .select("id", { count: "exact", head: true })
    .like("number", `INV-${ym}-%`);
  const defaultNumber = `INV-${ym}-${String((count ?? 0) + 1).padStart(3, "0")}`;
  return (
    <>
      <PageHeader title="請求書作成" back="/accounting/invoices" />
      <InvoiceForm defaultNumber={defaultNumber} action={saveInvoice.bind(null, null)} />
    </>
  );
}
