import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { BOARD_COLUMNS, PRIORITY } from "@/lib/labels";
import { jstBoundaries } from "@/lib/time";
import { Empty, LinkButton, PageHeader } from "@/components/ui";
import { TaskCard, type TaskWithEmployee } from "./task-card";

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
  const isSchedule = view === "schedule";

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
      <div role="tablist" className="mb-4 grid grid-cols-2 rounded-xl border border-line bg-surface p-1 text-sm font-semibold">
        <Link
          role="tab"
          aria-selected={!isSchedule}
          href="/tasks"
          className={`flex min-h-10 items-center justify-center rounded-lg ${!isSchedule ? "bg-surface-2 text-accent" : "text-muted"}`}
        >
          ボード
        </Link>
        <Link
          role="tab"
          aria-selected={isSchedule}
          href="/tasks?view=schedule"
          className={`flex min-h-10 items-center justify-center rounded-lg ${isSchedule ? "bg-surface-2 text-accent" : "text-muted"}`}
        >
          秘書ビュー(期限)
        </Link>
      </div>
      {isSchedule ? <ScheduleView tasks={tasks} /> : <BoardView tasks={tasks} />}
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
