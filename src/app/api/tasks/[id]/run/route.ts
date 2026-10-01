import { NextResponse } from "next/server";
import { getOwnerOrNull } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { streamCompletion, AiError } from "@/lib/ai/claude";
import { buildSystemPrompt, buildTaskPrompt } from "@/lib/ai/prompts";
import { checkBudget, getSettings, recordUsage } from "@/lib/ai/usage";
import { APPROVAL_TYPE } from "@/lib/labels";
import type { Employee, Task, TaskComment, TaskRun } from "@/lib/types";

export const maxDuration = 300;

/** ストリームの末尾に付ける区切り。以降は結果の JSON。 */
const RESULT_SEPARATOR = "\u0000";
const STALE_RUN_MS = 10 * 60_000;

/**
 * タスク実行(AI社員の API 経路)。
 * この経路は成果物の保存と「承認待ち(pending)」の作成のみを行い、承認状態を決定することはない。
 * (approvals の UPDATE 権限は DB 側で剥奪済み。決定は decide_approval() のみ)
 */
export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getOwnerOrNull();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user } = auth;
  const { id } = await ctx.params;

  let revisionNote: string | null = null;
  try {
    const body = (await request.json().catch(() => ({}))) as { revisionNote?: unknown };
    if (typeof body.revisionNote === "string" && body.revisionNote.trim()) {
      revisionNote = body.revisionNote.trim().slice(0, 5000);
    }
  } catch {
    // body なし
  }

  const { data: task } = await supabase.from("tasks").select("*").eq("id", id).single<Task>();
  if (!task) return NextResponse.json({ error: "タスクが見つかりません" }, { status: 404 });
  if (!task.employee_id) {
    return NextResponse.json({ error: "担当社員を設定してください" }, { status: 400 });
  }
  const { data: employee } = await supabase
    .from("employees")
    .select("*")
    .eq("id", task.employee_id)
    .single<Employee>();
  if (!employee) return NextResponse.json({ error: "担当社員が見つかりません" }, { status: 400 });
  if (!employee.enabled) {
    return NextResponse.json({ error: `${employee.name} は無効化されています` }, { status: 400 });
  }

  const { data: runs } = await supabase
    .from("task_runs")
    .select("*")
    .eq("task_id", id)
    .order("version", { ascending: false })
    .returns<TaskRun[]>();
  const latest = runs?.[0] ?? null;
  if (
    latest?.status === "running" &&
    Date.now() - new Date(latest.created_at).getTime() < STALE_RUN_MS
  ) {
    return NextResponse.json({ error: "このタスクは実行中です" }, { status: 409 });
  }
  if (latest?.status === "running") {
    await supabase
      .from("task_runs")
      .update({ status: "failed", error: "タイムアウト(応答なし)", finished_at: new Date().toISOString() })
      .eq("id", latest.id);
  }

  const settings = await getSettings(supabase);
  const budgetError = await checkBudget(supabase, settings);
  if (budgetError) return NextResponse.json({ error: budgetError }, { status: 429 });

  if (revisionNote) {
    await supabase.from("task_comments").insert({
      owner_id: user.id,
      task_id: id,
      task_run_id: latest?.id ?? null,
      body: revisionNote,
      author: "owner",
      kind: "revision",
    });
  }

  // 古い承認待ちを無効化(pending → superseded のみ。承認にはならない)
  await supabase.rpc("supersede_pending_approvals", { p_task_id: id });

  const version = (latest?.version ?? 0) + 1;
  const { data: run, error: runError } = await supabase
    .from("task_runs")
    .insert({
      owner_id: user.id,
      task_id: id,
      version,
      model: settings.claude_model,
      status: "running",
      revision_note: revisionNote,
    })
    .select("*")
    .single<TaskRun>();
  if (runError || !run) {
    return NextResponse.json({ error: runError?.message ?? "実行を開始できません" }, { status: 500 });
  }

  const { error: statusError } = await supabase.from("tasks").update({ status: "running" }).eq("id", id);
  if (statusError) {
    await supabase
      .from("task_runs")
      .update({ status: "failed", error: statusError.message, finished_at: new Date().toISOString() })
      .eq("id", run.id);
    return NextResponse.json({ error: statusError.message }, { status: 400 });
  }

  await audit(supabase, user.id, {
    actor: "owner",
    action: revisionNote ? "task.revision_requested" : "task.run_requested",
    targetType: "task",
    targetId: id,
    detail: { version, employee: employee.key },
  });

  const { data: comments } = await supabase
    .from("task_comments")
    .select("*")
    .eq("task_id", id)
    .order("created_at")
    .returns<TaskComment[]>();

  const { data: relatedRows } = await supabase
    .from("task_runs")
    .select("output_md, created_at, tasks!inner(title, employee_id)")
    .eq("tasks.employee_id", employee.id)
    .eq("status", "succeeded")
    .neq("task_id", id)
    .order("created_at", { ascending: false })
    .limit(2);
  const related = (relatedRows ?? []).map((r) => {
    const t = r.tasks as unknown as { title: string };
    return { title: t.title, output_md: r.output_md as string };
  });

  const previousSucceeded = runs?.find((r) => r.status === "succeeded") ?? null;
  const system = buildSystemPrompt(employee);
  const userPrompt = buildTaskPrompt({
    task,
    previousRun: previousSucceeded,
    comments: comments ?? [],
    revisionNote,
    related,
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let open = true;
      const send = (text: string) => {
        if (!open) return;
        try {
          controller.enqueue(encoder.encode(text));
        } catch {
          // クライアントが離脱しても生成と保存は続ける
          open = false;
        }
      };

      let result: Record<string, unknown>;
      try {
        const r = await streamCompletion(
          {
            model: settings.claude_model,
            maxTokens: settings.max_tokens_per_run,
            system,
            user: userPrompt,
          },
          send,
        );
        let output = r.text;
        if (r.truncated) {
          const note = "\n\n> ⚠️ 出力が1実行あたりの上限トークンに達したため途中で終了しました。";
          output += note;
          send(note);
        }
        await recordUsage(supabase, user.id, "task_run", r);
        await supabase
          .from("task_runs")
          .update({
            status: "succeeded",
            output_md: output,
            model: r.model,
            tokens_in: r.tokensIn,
            tokens_out: r.tokensOut,
            finished_at: new Date().toISOString(),
          })
          .eq("id", run.id);

        let nextStatus: Task["status"] = "done";
        if (task.approval_type !== "none") {
          const label = APPROVAL_TYPE[task.approval_type];
          const { error: apErr } = await supabase.from("approvals").insert({
            owner_id: user.id,
            task_id: id,
            task_run_id: run.id,
            type: task.approval_type,
            status: "pending",
            reason: label.reason,
            impact: label.impact,
          });
          if (apErr) throw new AiError(`承認依頼を作成できませんでした: ${apErr.message}`, true);
          nextStatus = "pending_approval";
        }
        await supabase.from("tasks").update({ status: nextStatus }).eq("id", id);
        await audit(supabase, user.id, {
          actor: `ai:${employee.key}`,
          action: nextStatus === "pending_approval" ? "task_run.submitted_for_approval" : "task_run.succeeded",
          targetType: "task_run",
          targetId: run.id,
          detail: { task_id: id, version, tokens_in: r.tokensIn, tokens_out: r.tokensOut },
        });
        result = { status: "succeeded", taskStatus: nextStatus, version };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await supabase
          .from("task_runs")
          .update({ status: "failed", error: message, finished_at: new Date().toISOString() })
          .eq("id", run.id);
        await supabase.from("tasks").update({ status: "todo" }).eq("id", id);
        await audit(supabase, user.id, {
          actor: `ai:${employee.key}`,
          action: "task_run.failed",
          targetType: "task_run",
          targetId: run.id,
          detail: { task_id: id, version, error: message },
        });
        result = {
          status: "failed",
          error: message,
          retryable: err instanceof AiError ? err.retryable : true,
          version,
        };
      }
      send(RESULT_SEPARATOR + JSON.stringify(result));
      if (open) controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Accel-Buffering": "no",
    },
  });
}
