import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth";
import { APPROVAL_STATUS, APPROVAL_TYPE, PRIORITY, TASK_STATUS } from "@/lib/labels";
import { formatJst, isOverdue } from "@/lib/time";
import type { Approval, Task, TaskComment, TaskRun } from "@/lib/types";
import { Badge, Button, Card, LinkButton, PageHeader, ProgressBar } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { ConfirmButton } from "@/components/confirm-button";
import { addComment, deleteTask, markDone, requestRevision, submitResult, updateProgress } from "../actions";
import { ProgressPanel } from "./progress-panel";
import { CommentForm } from "./comment-form";

export const metadata: Metadata = { title: "タスク詳細" };

const AUTHOR = { owner: "オーナー", claude: "Claude", system: "システム" } as const;

const COMMENT_KIND = {
  comment: { label: "コメント", className: "bg-slate-700 text-slate-100" },
  progress: { label: "進捗", className: "bg-sky-800 text-sky-100" },
  revision: { label: "修正依頼", className: "bg-sky-700 text-white" },
  rejection: { label: "差し戻し", className: "bg-rose-600 text-white" },
};

export default async function TaskDetailPage({ params }: PageProps<"/tasks/[id]">) {
  const { id } = await params;
  const { supabase } = await requireOwner();

  const [{ data: task }, { data: runs }, { data: comments }, { data: approvals }] = await Promise.all([
    supabase.from("tasks").select("*, employees(name, key)").eq("id", id).single<Task & { employees: { name: string; key: string } | null }>(),
    supabase.from("task_runs").select("*").eq("task_id", id).order("version", { ascending: false }).returns<TaskRun[]>(),
    supabase.from("task_comments").select("*").eq("task_id", id).order("created_at").returns<TaskComment[]>(),
    supabase.from("approvals").select("*").eq("task_id", id).order("created_at", { ascending: false }).returns<Approval[]>(),
  ]);
  if (!task) notFound();

  const st = TASK_STATUS[task.status];
  const latestSucceeded = runs?.find((r) => r.status === "succeeded") ?? null;
  const pendingApproval = approvals?.find((a) => a.status === "pending");
  const overdue = isOverdue(task.due_at, task.status);
  const projectRef = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
    } catch {
      return "";
    }
  })();
  const askClaudeText = [
    `CALLOUT HQ のタスクを進めてください。(Supabase プロジェクト: ${projectRef} / タスクID: ${id})`,
    `担当役割: ${task.employees?.name ?? "未設定"} / 承認種別: ${task.approval_type === "none" ? "なし" : APPROVAL_TYPE[task.approval_type].label}`,
    "",
    "1. まず tasks / employees / task_comments / task_runs を読み、指示・担当社員の指針・オーナーのコメント(修正依頼・差し戻し)を把握する",
    `2. 作業を始めたら: select hq_log('${id}', '着手しました', 10, 'running');`,
    `3. 区切りごとに: select hq_log('${id}', '進捗メモ', 50);`,
    `4. 完成したら: select hq_submit_result('${id}', '<Markdown の成果物>', '提出メモ');`,
    "",
    "送信・公開・投稿・支払い・本番反映などは実行せず、案として提出すること。承認・差し戻しはオーナーがアプリで行うので、承認の操作はしないこと。",
    "判断が必要な点は成果物の最後に「## 要判断事項」として書くこと。詳しいルールはアプリの /guide を参照。",
  ].join("\n");

  return (
    <>
      <PageHeader
        title="タスク詳細"
        back="/tasks"
        action={
          <LinkButton href={`/tasks/${id}/edit`} variant="ghost" className="!min-h-10 px-2">
            編集
          </LinkButton>
        }
      />

      <div className="space-y-4">
        <Card className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={st.className}>
              <span data-testid="task-status">{st.label}</span>
            </Badge>
            {task.approval_type !== "none" && (
              <Badge className="border border-amber-400/60 text-amber-300">🔒 {APPROVAL_TYPE[task.approval_type].label}</Badge>
            )}
          </div>
          <h2 className="text-lg font-bold leading-snug">{task.title}</h2>
          <dl className="grid grid-cols-3 gap-2 text-sm">
            <div>
              <dt className="text-xs text-muted">担当</dt>
              <dd>{task.employees?.name ?? "未設定"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">優先度</dt>
              <dd className={PRIORITY[task.priority].className}>{PRIORITY[task.priority].label}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted">期限</dt>
              <dd className={overdue ? "font-bold text-rose-400" : ""}>
                {task.due_at ? formatJst(task.due_at) : "なし"}
                {overdue && " ⚠超過"}
              </dd>
            </div>
          </dl>
          {(task.status === "running" || task.progress > 0) && task.status !== "done" && (
            <div className="flex items-center gap-2 text-xs text-sky-300">
              <ProgressBar value={task.progress} className="flex-1" />
              <span className="tabular-nums">{task.progress}%</span>
            </div>
          )}
          {task.instruction && (
            <details open={!latestSucceeded}>
              <summary className="cursor-pointer text-sm font-semibold text-muted">指示</summary>
              <p className="mt-2 whitespace-pre-wrap text-sm">{task.instruction}</p>
            </details>
          )}
        </Card>

        {pendingApproval && (
          <Link
            href={`/approvals#approval-${pendingApproval.id}`}
            className="block rounded-2xl border border-amber-400/70 bg-amber-950/40 p-4 text-sm font-semibold text-amber-200"
          >
            ⏳ この成果物はオーナーの承認待ちです → 承認画面へ
          </Link>
        )}
        {task.status === "ready" && (
          <Card className="space-y-3 border-emerald-500/60">
            <p className="text-sm font-semibold text-emerald-300">
              ✅ 承認済み・実行可。このアプリは外部への送信・投稿・支払いを自動では行いません。成果物をコピーして手動で使用してください。
            </p>
            <form action={markDone.bind(null, id)}>
              <Button type="submit" variant="success" className="w-full">
                使用済みにして完了
              </Button>
            </form>
          </Card>
        )}

        {latestSucceeded && (
          <Card>
            <div className="mb-2 flex items-center justify-between text-xs text-muted">
              <span className="font-bold text-fg">最新の成果物 v{latestSucceeded.version}</span>
              <span>{formatJst(latestSucceeded.finished_at ?? latestSucceeded.created_at)}</span>
            </div>
            <div data-testid="latest-output">
              <Markdown>{latestSucceeded.output_md}</Markdown>
            </div>
          </Card>
        )}

        <ProgressPanel
          status={task.status}
          progress={task.progress}
          hasResult={!!latestSucceeded}
          askClaudeText={askClaudeText}
          updateProgress={updateProgress.bind(null, id)}
          submitResult={submitResult.bind(null, id)}
          requestRevision={requestRevision.bind(null, id)}
        />

        <section className="space-y-2">
          <h3 className="text-sm font-bold text-muted">進捗・やりとり</h3>
          {(comments ?? []).map((c) => (
            <div key={c.id} className="rounded-xl bg-surface p-3 text-sm">
              <div className="mb-1 flex items-center gap-2 text-xs text-muted">
                <Badge className={COMMENT_KIND[c.kind].className}>{COMMENT_KIND[c.kind].label}</Badge>
                <span className="font-semibold text-fg">{AUTHOR[c.author]}</span>
                {formatJst(c.created_at)}
              </div>
              <p className="whitespace-pre-wrap">{c.body}</p>
            </div>
          ))}
          <CommentForm action={addComment.bind(null, id)} />
        </section>

        {runs && runs.length > 0 && (
          <section className="space-y-2">
            <h3 className="text-sm font-bold text-muted">実行履歴</h3>
            {runs.map((r) => {
              const ap = approvals?.find((a) => a.task_run_id === r.id);
              return (
                <details key={r.id} className="rounded-xl border border-line bg-surface p-3">
                  <summary className="flex cursor-pointer flex-wrap items-center gap-2 text-sm">
                    <b>v{r.version}</b>
                    <Badge
                      className={
                        r.status === "succeeded"
                          ? "bg-emerald-800 text-emerald-50"
                          : r.status === "failed"
                            ? "bg-rose-700 text-white"
                            : "bg-sky-600 text-white"
                      }
                    >
                      {r.status === "succeeded" ? "成功" : r.status === "failed" ? "失敗" : "実行中"}
                    </Badge>
                    {ap && <Badge className={APPROVAL_STATUS[ap.status].className}>{APPROVAL_STATUS[ap.status].label}</Badge>}
                    <span className="text-xs text-muted">{formatJst(r.created_at)}</span>
                  </summary>
                  <div className="mt-2 space-y-2">
                    <p className="text-xs text-muted">
                      提出元: {r.model === "owner" ? "オーナー(貼り付け)" : "Claude"}
                    </p>
                    {r.revision_note && <p className="text-xs text-sky-300">修正依頼: {r.revision_note}</p>}
                    {r.error && <p className="text-sm text-rose-300">エラー: {r.error}</p>}
                    {ap?.owner_comment && <p className="text-xs text-rose-300">差し戻しコメント: {ap.owner_comment}</p>}
                    {r.output_md && <Markdown>{r.output_md}</Markdown>}
                  </div>
                </details>
              );
            })}
          </section>
        )}

        <form action={deleteTask.bind(null, id)} className="pt-4">
          <ConfirmButton message="このタスクと履歴を削除しますか?" variant="ghost" className="w-full text-rose-400">
            タスクを削除
          </ConfirmButton>
        </form>
      </div>
    </>
  );
}
