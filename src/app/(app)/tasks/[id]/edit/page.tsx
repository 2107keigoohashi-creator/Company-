import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { PageHeader } from "@/components/ui";
import type { Task } from "@/lib/types";
import { TaskForm } from "../../task-form";
import { updateTask } from "../../actions";

export const metadata: Metadata = { title: "タスク編集" };

export default async function EditTaskPage({ params }: PageProps<"/tasks/[id]/edit">) {
  const { id } = await params;
  const { supabase } = await requireOwner();
  const [{ data: task }, { data: employees }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).single<Task>(),
    supabase.from("employees").select("id, name, responsibilities, enabled").order("sort_order"),
  ]);
  if (!task) notFound();
  return (
    <>
      <PageHeader title="タスク編集" back={`/tasks/${id}`} />
      <TaskForm employees={employees ?? []} task={task} action={updateTask.bind(null, id)} submitLabel="保存" />
    </>
  );
}
