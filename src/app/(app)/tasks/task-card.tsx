import Link from "next/link";
import { Badge, ProgressBar } from "@/components/ui";
import { PRIORITY, TASK_STATUS } from "@/lib/labels";
import { formatJst, isOverdue } from "@/lib/time";
import type { Task } from "@/lib/types";

export type TaskWithEmployee = Task & { employees: { name: string } | null };

export function TaskCard({ task, showStatus = false }: { task: TaskWithEmployee; showStatus?: boolean }) {
  const overdue = isOverdue(task.due_at, task.status);
  const st = TASK_STATUS[task.status];
  return (
    <Link
      href={`/tasks/${task.id}`}
      data-testid="task-card"
      className={`block rounded-xl border bg-surface p-3 active:bg-surface-2 ${
        overdue ? "border-rose-500/70" : "border-line"
      }`}
    >
      <div className="mb-1 flex items-start gap-2">
        <span className={`text-xs font-bold ${PRIORITY[task.priority].className}`}>
          {PRIORITY[task.priority].label}
        </span>
        <p className="flex-1 font-semibold leading-snug">{task.title}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
        <span>{task.employees?.name ?? "担当未設定"}</span>
        {task.due_at && (
          <span className={overdue ? "font-bold text-rose-400" : ""}>
            {overdue ? "⚠ 期限超過 " : "期限 "}
            {formatJst(task.due_at)}
          </span>
        )}
        {(showStatus || task.status === "ready") && <Badge className={st.className}>{st.label}</Badge>}
        {task.approval_type !== "none" && <span title="承認必須">🔒承認必須</span>}
      </div>
      {task.status === "running" && (
        <div className="mt-2 flex items-center gap-2 text-xs text-sky-300">
          <ProgressBar value={task.progress} className="flex-1" />
          <span className="tabular-nums">{task.progress}%</span>
        </div>
      )}
    </Link>
  );
}
