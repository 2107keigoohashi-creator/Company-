import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import type { Employee } from "@/lib/types";
import { Badge, PageHeader } from "@/components/ui";

export const metadata: Metadata = { title: "社員" };

export default async function EmployeesPage() {
  const { supabase } = await requireOwner();
  const [{ data: employees }, { data: tasks }] = await Promise.all([
    supabase.from("employees").select("*").order("sort_order").returns<Employee[]>(),
    supabase.from("tasks").select("employee_id, status").not("status", "in", "(done,ready)"),
  ]);
  const openCount = new Map<string, number>();
  for (const t of tasks ?? []) {
    if (t.employee_id) openCount.set(t.employee_id, (openCount.get(t.employee_id) ?? 0) + 1);
  }

  return (
    <>
      <PageHeader title="AI社員" />
      <ul className="space-y-2">
        {(employees ?? []).map((e) => (
          <li key={e.id}>
            <Link href={`/employees/${e.id}`} className="flex items-center gap-3 rounded-2xl border border-line bg-surface p-4">
              <span
                aria-hidden
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-black ${
                  e.enabled ? "bg-accent/15 text-accent" : "bg-surface-2 text-muted"
                }`}
              >
                {e.name.slice(0, 1)}
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 font-bold">
                  {e.name}
                  {!e.enabled && <Badge className="bg-slate-700 text-slate-200">無効</Badge>}
                </p>
                <p className="truncate text-xs text-muted">{e.responsibilities}</p>
              </div>
              <span className="text-xs text-muted">未完了 {openCount.get(e.id) ?? 0}</span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
