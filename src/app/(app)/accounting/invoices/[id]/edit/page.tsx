import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import type { Invoice } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { InvoiceForm } from "../../invoice-form";
import { saveInvoice } from "../../../actions";

export const metadata: Metadata = { title: "請求書編集" };

export default async function EditInvoicePage({ params }: PageProps<"/accounting/invoices/[id]/edit">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: invoice } = await supabase.from("invoices").select("*").eq("id", id).single<Invoice>();
  if (!invoice) notFound();
  if (invoice.status !== "draft") redirect(`/accounting/invoices/${id}`);
  return (
    <>
      <PageHeader title="請求書編集" back={`/accounting/invoices/${id}`} />
      <InvoiceForm invoice={invoice} action={saveInvoice.bind(null, id)} />
    </>
  );
}
