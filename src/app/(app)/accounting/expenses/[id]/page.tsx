import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { EXPENSE_STATUS } from "@/lib/accounting";
import type { Expense } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyForm } from "../../money-form";
import { deleteExpense, saveExpense } from "../../actions";

export const metadata: Metadata = { title: "経費編集" };

export default async function ExpensePage({ params }: PageProps<"/accounting/expenses/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: row } = await supabase.from("expenses").select("*").eq("id", id).single<Expense>();
  if (!row) notFound();
  return (
    <>
      <PageHeader title="経費編集" back={`/accounting/expenses?month=${row.date.slice(0, 7)}`} />
      <p className="mb-4">
        <Badge className={EXPENSE_STATUS[row.status].className}>{EXPENSE_STATUS[row.status].label}</Badge>
      </p>
      <MoneyForm kind="expense" row={row} action={saveExpense.bind(null, id)} />
      <form action={deleteExpense.bind(null, id)} className="mt-6">
        <ConfirmButton message="この経費を削除しますか?" variant="ghost" className="w-full text-rose-400">
          削除
        </ConfirmButton>
      </form>
    </>
  );
}
