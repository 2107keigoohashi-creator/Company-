import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { MoneyForm } from "../../money-form";
import { saveSale } from "../../actions";

export const metadata: Metadata = { title: "売上登録" };

export default function NewSalePage() {
  return (
    <>
      <PageHeader title="売上登録" back="/accounting/sales" />
      <MoneyForm kind="sale" action={saveSale.bind(null, null)} />
    </>
  );
}
