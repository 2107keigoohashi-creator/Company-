import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import { TaskForm } from "../task-form";
import { createTask } from "../actions";

export const metadata: Metadata = { title: "新規タスク" };

export default async function NewTaskPage() {
  const { supabase } = await requireOwner();
  const { data: employees } = await supabase
    .from("employees")
    .select("id, name, responsibilities, enabled")
    .order("sort_order");
  return (
    <>
      <PageHeader title="新規タスク" back="/tasks" />
      <TaskForm employees={employees ?? []} action={createTask} submitLabel="タスクを作成" />
    </>
  );
}
