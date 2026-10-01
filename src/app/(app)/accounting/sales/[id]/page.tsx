import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import type { Sale } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { ConfirmButton } from "@/components/confirm-button";
import { MoneyForm } from "../../money-form";
import { deleteSale, saveSale } from "../../actions";

export const metadata: Metadata = { title: "売上編集" };

export default async function SalePage({ params }: PageProps<"/accounting/sales/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: row } = await supabase.from("sales").select("*").eq("id", id).single<Sale>();
  if (!row) notFound();
  return (
    <>
      <PageHeader title="売上編集" back={`/accounting/sales?month=${row.date.slice(0, 7)}`} />
      <MoneyForm kind="sale" row={row} action={saveSale.bind(null, id)} />
      <form action={deleteSale.bind(null, id)} className="mt-6">
        <ConfirmButton message="この売上を削除しますか?" variant="ghost" className="w-full text-rose-400">
          削除
        </ConfirmButton>
      </form>
    </>
  );
}
