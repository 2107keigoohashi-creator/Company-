import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { BOARD_COLUMNS, PRIORITY } from "@/lib/labels";
import { isOverdue, jstBoundaries } from "@/lib/time";
import type { Employee, TaskComment, TaskStatus } from "@/lib/types";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { TaskCard, type TaskWithEmployee } from "./task-card";
import { OfficeView, type FeedItem } from "./office/office-view";
import type { MemberStatus, OfficeMember } from "./office/office-map";

export const metadata: Metadata = { title: "タスク" };

function sortTasks(a: TaskWithEmployee, b: TaskWithEmployee) {
  const p = PRIORITY[a.priority].rank - PRIORITY[b.priority].rank;
  if (p !== 0) return p;
  if (a.due_at && b.due_at) return a.due_at.localeCompare(b.due_at);
  if (a.due_at) return -1;
  if (b.due_at) return 1;
  return b.created_at.localeCompare(a.created_at);
}

export default async function TasksPage({ searchParams }: PageProps<"/tasks">) {
  const { view } = await searchParams;
  const { supabase } = await requireOwner();
  const { data } = await supabase
    .from("tasks")
    .select("*, employees(name)")
    .order("created_at", { ascending: false })
    .limit(500)
    .returns<TaskWithEmployee[]>();
  const tasks = (data ?? []).sort(sortTasks);
  const mode = view === "schedule" ? "schedule" : view === "board" ? "board" : "office";
  const office = mode === "office" ? await loadOffice(supabase, tasks) : null;

  return (
    <>
      <PageHeader
        title="タスク"
        action={
          <LinkButton href="/tasks/new" className="!min-h-10 px-3">
            ＋ 新規
          </LinkButton>
        }
      />
      <div role="tablist" className="mb-4 grid grid-cols-3 rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
        {(
          [
            ["office", "/tasks", "オフィス"],
            ["board", "/tasks?view=board", "ボード"],
            ["schedule", "/tasks?view=schedule", "秘書ビュー"],
          ] as const
        ).map(([key, href, label]) => (
          <Link
            key={key}
            role="tab"
            aria-selected={mode === key}
            href={href}
            className={`flex min-h-10 items-center justify-center rounded-lg ${mode === key ? "bg-surface-2 text-accent" : "text-muted"}`}
          >
            {label}
          </Link>
        ))}
      </div>
      {office ? (
        <OfficeView members={office.members} feed={office.feed} stats={office.stats} />
      ) : mode === "schedule" ? (
        <ScheduleView tasks={tasks} />
      ) : (
        <BoardView tasks={tasks} />
      )}
    </>
  );
}

function BoardView({ tasks }: { tasks: TaskWithEmployee[] }) {
  const columns = BOARD_COLUMNS.map((c) => ({
    ...c,
    tasks: tasks.filter((t) => c.statuses.includes(t.status)),
  }));
  return (
    <>
      <nav aria-label="列へ移動" className="mb-3 flex gap-2 overflow-x-auto pb-1 text-xs">
        {columns.map((c) => (
          <a key={c.key} href={`#col-${c.key}`} className="shrink-0 rounded-full border border-line px-3 py-2 text-muted">
            {c.label} <b className="text-fg">{c.tasks.length}</b>
          </a>
        ))}
      </nav>
      <div className="board -mx-4 flex gap-3 overflow-x-auto px-4 pb-4">
        {columns.map((c) => (
          <section
            key={c.key}
            id={`col-${c.key}`}
            data-testid={`column-${c.key}`}
            aria-label={c.label}
            className="w-[82vw] max-w-xs shrink-0 scroll-ml-4"
          >
            <h2 className="mb-2 flex items-center justify-between text-sm font-bold text-muted">
              {c.label}
              <span className="rounded-full bg-surface-2 px-2">{c.tasks.length}</span>
            </h2>
            <div className="space-y-2">
              {c.tasks.length === 0 ? <Empty>なし</Empty> : c.tasks.map((t) => <TaskCard key={t.id} task={t} />)}
            </div>
          </section>
        ))}
      </div>
      <p className="text-center text-xs text-muted">← 横にスワイプで列を移動 →</p>
    </>
  );
}

function ScheduleView({ tasks }: { tasks: TaskWithEmployee[] }) {
  const now = new Date();
  const { tomorrowStart, weekEnd } = jstBoundaries(now);
  const open = tasks
    .filter((t) => !["done", "ready"].includes(t.status) && t.due_at)
    .sort((a, b) => a.due_at!.localeCompare(b.due_at!));
  const overdue = open.filter((t) => new Date(t.due_at!) < now);
  const today = open.filter((t) => new Date(t.due_at!) >= now && new Date(t.due_at!) < tomorrowStart);
  const week = open.filter((t) => new Date(t.due_at!) >= tomorrowStart && new Date(t.due_at!) < weekEnd);
  const noDue = tasks.filter((t) => !["done", "ready"].includes(t.status) && !t.due_at);

  const groups = [
    { key: "overdue", label: "⚠ 期限超過", tasks: overdue, className: "text-rose-400" },
    { key: "today", label: "今日", tasks: today, className: "text-accent" },
    { key: "week", label: "今週(7日以内)", tasks: week, className: "text-fg" },
    { key: "nodue", label: "期限なし(未完了)", tasks: noDue, className: "text-muted" },
  ];
  return (
    <div className="space-y-6">
      {overdue.length > 0 && (
        <p role="alert" className="rounded-xl border border-rose-500/60 bg-rose-950/50 p-3 text-sm font-semibold text-rose-200">
          期限を過ぎたタスクが {overdue.length} 件あります
        </p>
      )}
      {groups.map((g) => (
        <section key={g.key} data-testid={`schedule-${g.key}`}>
          <h2 className={`mb-2 text-sm font-bold ${g.className}`}>
            {g.label}({g.tasks.length})
          </h2>
          <div className="space-y-2">
            {g.tasks.length === 0 ? <Empty>なし</Empty> : g.tasks.map((t) => <TaskCard key={t.id} task={t} showStatus />)}
          </div>
        </section>
      ))}
    </div>
  );
}

type Supabase = Awaited<ReturnType<typeof requireOwner>>["supabase"];

const STATUS_PRIORITY: Record<string, number> = { running: 0, pending_approval: 1, rejected: 2, todo: 3 };

/** 社員ごとの「今の状態」と「今のタスク」、最新の動きを組み立てる */
async function loadOffice(supabase: Supabase, tasks: TaskWithEmployee[]) {
  const [{ data: employees }, { data: comments }, { data: runs }] = await Promise.all([
    supabase.from("employees").select("*").order("sort_order").returns<Employee[]>(),
    supabase
      .from("task_comments")
      .select("id, body, author, kind, created_at, task_id, tasks(title)")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<(TaskComment & { tasks: { title: string } | null })[]>(),
    supabase
      .from("task_runs")
      .select("id, version, model, created_at, task_id, tasks(title)")
      .eq("status", "succeeded")
      .order("created_at", { ascending: false })
      .limit(8)
      .returns<{ id: string; version: number; model: string; created_at: string; task_id: string; tasks: { title: string } | null }[]>(),
  ]);

  const members: OfficeMember[] = (employees ?? []).map((e) => {
    const open = tasks
      .filter((t) => t.employee_id === e.id && t.status in STATUS_PRIORITY)
      .sort((a, b) => STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] || sortTasks(a, b));
    const top = open[0];
    const status: MemberStatus = !e.enabled
      ? "off"
      : !top
        ? "idle"
        : ({ running: "working", pending_approval: "review", rejected: "rejected", todo: "queued" } as const)[
            top.status as "running" | "pending_approval" | "rejected" | "todo"
          ];
    return {
      id: e.id,
      key: e.key,
      name: e.name,
      role: e.role,
      responsibilities: e.responsibilities,
      enabled: e.enabled,
      status,
      current: top ? { id: top.id, title: top.title, progress: top.progress, status: top.status } : null,
      open: open.slice(0, 6).map((t) => ({ id: t.id, title: t.title, status: t.status as TaskStatus, progress: t.progress })),
    };
  });

  const KIND = { comment: "コメント", progress: "進捗", revision: "修正依頼", rejection: "差し戻し" } as const;
  const feed: FeedItem[] = [
    ...(comments ?? []).map((c) => ({
      id: `c-${c.id}`,
      at: c.created_at,
      actor: c.author,
      text: `${KIND[c.kind]}: ${c.body}`,
      taskId: c.task_id,
      taskTitle: c.tasks?.title ?? "",
    })),
    ...(runs ?? []).map((r) => ({
      id: `r-${r.id}`,
      at: r.created_at,
      actor: (r.model === "owner" ? "owner" : "claude") as FeedItem["actor"],
      text: `成果物 v${r.version} を提出`,
      taskId: r.task_id,
      taskTitle: r.tasks?.title ?? "",
    })),
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 8);

  const weekAgo = Date.now() - 7 * 86400_000;
  const stats = {
    pendingApprovals: tasks.filter((t) => t.status === "pending_approval").length,
    overdue: tasks.filter((t) => isOverdue(t.due_at, t.status)).length,
    doneThisWeek: tasks.filter((t) => (t.status === "done" || t.status === "ready") && new Date(t.updated_at).getTime() >= weekAgo).length,
  };
  return { members, feed, stats };
}
