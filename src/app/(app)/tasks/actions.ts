"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { fromJstInput } from "@/lib/time";
import { buildAskClaudeText } from "@/lib/ask-claude";

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

/** 進捗の更新(オーナーが手で記録する場合)。状態は 未着手/実行中 のみ。 */
export async function updateProgress(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireOwner();
  const parsed = z
    .object({
      progress: z.coerce.number().int().min(0).max(100),
      status: z.enum(["todo", "running"]),
      note: z.string().trim().max(5000).default(""),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "入力内容を確認してください" };
  const { error } = await supabase
    .from("tasks")
    .update({ progress: parsed.data.progress, status: parsed.data.status })
    .eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("task_comments").insert({
    owner_id: user.id,
    task_id: id,
    body: parsed.data.note || `進捗 ${parsed.data.progress}%`,
    author: "owner",
    kind: "progress",
  });
  await audit(supabase, user.id, {
    actor: "owner",
    action: "task.progress",
    targetType: "task",
    targetId: id,
    detail: { progress: parsed.data.progress, status: parsed.data.status },
  });
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  return {};
}

/** Claude の成果物(Markdown)を貼り付けて登録する。承認が必要なタスクは「承認待ち」になる。 */
export async function submitResult(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase } = await requireOwner();
  const output = String(formData.get("output_md") ?? "");
  const note = String(formData.get("note") ?? "").trim();
  if (!output.trim()) return { error: "成果物を貼り付けてください" };
  if (output.length > 200_000) return { error: "成果物が長すぎます(20万文字まで)" };
  const { error } = await supabase.rpc("submit_result_as_owner", {
    p_task_id: id,
    p_output_md: output,
    p_note: note || null,
  });
  if (error) return { error: error.message };
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/approvals");
  return {};
}

/** 修正依頼: 承認待ちを無効化してタスクを「未着手」に戻し、依頼内容を記録する(Claude が次に拾う)。 */
export async function requestRevision(id: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { supabase, user } = await requireOwner();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "修正してほしい内容を入力してください" };
  const { error: supErr } = await supabase.rpc("supersede_pending_approvals", { p_task_id: id });
  if (supErr) return { error: supErr.message };
  const { error } = await supabase.from("tasks").update({ status: "todo", progress: 0 }).eq("id", id);
  if (error) return { error: error.message };
  await supabase.from("task_comments").insert({
    owner_id: user.id,
    task_id: id,
    body: body.slice(0, 10000),
    author: "owner",
    kind: "revision",
  });
  await audit(supabase, user.id, { actor: "owner", action: "task.revision_requested", targetType: "task", targetId: id });
  revalidatePath(`/tasks/${id}`);
  revalidatePath("/tasks");
  revalidatePath("/approvals");
  return {};
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

export type InstructionState =
  | { error?: string; created?: { id: string; title: string; employee: string; askText: string } }
  | undefined;

/** オフィス画面の「社長からの指示」: 1行目をタイトルにしてタスクを登録し、Claude への依頼文を返す */
export async function quickInstruction(_prev: InstructionState, formData: FormData): Promise<InstructionState> {
  const { supabase, user } = await requireOwner();
  const body = String(formData.get("body") ?? "").trim();
  if (!body) return { error: "指示を入力してください" };
  const parsed = z
    .object({
      employee_id: z.string().uuid("担当を選んでください"),
      approval_type: z.enum(["none", "external_post", "email_reply", "invoice_issue", "expense_confirm", "code_deploy"]),
    })
    .safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };

  const firstLine = body.split("\n")[0].trim();
  const title = firstLine.length > 60 ? `${firstLine.slice(0, 60)}…` : firstLine;
  const { data, error } = await supabase
    .from("tasks")
    .insert({ owner_id: user.id, title, instruction: body.slice(0, 10000), ...parsed.data })
    .select("id, approval_type, employees(name)")
    .single<{ id: string; approval_type: Parameters<typeof buildAskClaudeText>[0]["approvalType"]; employees: { name: string } | null }>();
  if (error || !data) return { error: error?.message ?? "登録できませんでした" };

  await audit(supabase, user.id, {
    actor: "owner",
    action: "task.created",
    targetType: "task",
    targetId: data.id,
    detail: { title, via: "office" },
  });
  revalidatePath("/tasks");
  const employee = data.employees?.name ?? "";
  return {
    created: {
      id: data.id,
      title,
      employee,
      askText: buildAskClaudeText({ taskId: data.id, employeeName: employee, approvalType: data.approval_type }),
    },
  };
}
