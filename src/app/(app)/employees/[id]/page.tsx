import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { COMMON_RULES } from "@/lib/rules";
import type { Employee } from "@/lib/types";
import { PageHeader } from "@/components/ui";
import { updateEmployee } from "../actions";
import { EmployeeForm } from "./employee-form";

export const metadata: Metadata = { title: "社員の編集" };

export default async function EmployeePage({ params }: PageProps<"/employees/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const { data: employee } = await supabase.from("employees").select("*").eq("id", id).single<Employee>();
  if (!employee) notFound();
  return (
    <>
      <PageHeader title={`${employee.name} の設定`} back="/employees" />
      <EmployeeForm employee={employee} action={updateEmployee.bind(null, id)} />
      <details className="mt-6 rounded-xl border border-line bg-surface p-3">
        <summary className="cursor-pointer text-sm font-semibold text-muted">全社員共通ルール(編集不可)</summary>
        <pre className="mt-2 whitespace-pre-wrap text-xs text-muted">{COMMON_RULES}</pre>
      </details>
    </>
  );
}
