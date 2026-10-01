"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fromJstInput } from "@/lib/time";

export type FormState = { error?: string } | undefined;

const TaskSchema = z.object({
  title: z.string().trim().min(1, "タイトルを入力してください").max(200),
  instruction: z.string().trim().max(10000).default(""),
  employee_id: z.string().uuid("担当社員を選んでください"),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  due_at: z.string().optional(),
  approval_type: z.enum(["none", "external_post", "email_reply", "invoice_issue", "expense_confirm", "code_deploy"]),
});

function parseTask(formData: FormData) {
  const parsed = TaskSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" } as const;
  const { due_at, ...rest } = parsed.data;
  return { data: { ...rest, due_at: fromJstInput(due_at) } } as const;
}

export async function createTask(_prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireOwner();
  const parsed = parseTask(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { data, error } = await supabase
    .from("tasks")
    .insert({ ...parsed.data, owner_id: user.id })
    .select("id")
    .single();
  if (error || !data) return { error: error?.message ?? "作成できませんでした" };

  await audit(supabase, user.id, {
    actor: "owner",
    action: "task.created",
    targetType: "task",
    targetId: data.id,
    detail: { title: parsed.data.title, approval_type: parsed.data.approval_type },
  });
  revalidatePath("/tasks");
  redirect(`/tasks/${data.id}`);
}

export async function updateTask(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireOwner();
  const parsed = parseTask(formData);
  if ("error" in parsed) return { error: parsed.error };

  const { error } = await supabase.from("tasks").update(parsed.data).eq("id", id);
  if (error) {
    return {
      error: error.code === "42501" ? "承認待ち・承認済みのタスクは承認種別を変更できません" : error.message,
    };
  }
  await audit(supabase, user.id, { actor: "owner", action: "task.updated", targetType: "task", targetId: id });
  revalidatePath("/tasks");
  redirect(`/tasks/${id}`);
}

export async function deleteTask(id: string) {
  const { supabase, user } = await requireOwner();
  const { data: task } = await supabase.from("tasks").select("title").eq("id", id).single();
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(supabase, user.id, {
    actor: "owner",
    action: "task.deleted",
    targetType: "task",
    targetId: id,
    detail: { title: task?.title },
  });
  revalidatePath("/tasks");
  redirect("/tasks");
}

/** 承認済み(実行可)/承認不要タスクを「完了」にする。承認必須タスクは DB 側でも ready 以外から完了にできない。 */
export async function markDone(id: string) {
  const { supabase, user } = await requireOwner();
  const { error } = await supabase.from("tasks").update({ status: "done" }).eq("id", id);
  if (error) throw new Error(error.code === "42501" ? "承認が必要なタスクです" : error.message);
  await audit(supabase, user.id, { actor: "owner", action: "task.completed", targetType: "task", targetId: id });
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
}

export async function addComment(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireOwner();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "コメントを入力してください" };
  const { error } = await supabase
    .from("task_comments")
    .insert({ owner_id: user.id, task_id: id, body: body.slice(0, 10000), author: "owner", kind: "comment" });
  if (error) return { error: error.message };
  await audit(supabase, user.id, { actor: "owner", action: "task.commented", targetType: "task", targetId: id });
  revalidatePath(`/tasks/${id}`);
  return {};
}
