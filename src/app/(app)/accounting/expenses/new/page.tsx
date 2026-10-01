import type { Metadata } from "next";
import { PageHeader } from "@/components/ui";
import { MoneyForm } from "../../money-form";
import { saveExpense } from "../../actions";

export const metadata: Metadata = { title: "経費登録" };

export default function NewExpensePage() {
  return (
    <>
      <PageHeader title="経費登録" back="/accounting/expenses" />
      <MoneyForm kind="expense" action={saveExpense.bind(null, null)} />
    </>
  );
}
