import type { Metadata } from "next";
import Link from "next/link";
import { requireOwner } from "@/lib/auth";
import { APPROVAL_STATUS, APPROVAL_TYPE } from "@/lib/labels";
import { formatJst } from "@/lib/time";
import type { Approval } from "@/lib/types";
import { Badge, Card, Empty, PageHeader } from "@/components/ui";
import { Markdown } from "@/components/markdown";
import { DecisionForm } from "./decision-form";

export const metadata: Metadata = { title: "承認" };

type Row = Approval & {
  tasks: { title: string; employees: { name: string } | null } | null;
  task_runs: { version: number; output_md: string } | null;
};

export default async function ApprovalsPage() {
  const { supabase } = await requireOwner();
  const select = "*, tasks(title, employees(name)), task_runs(version, output_md)";
  const [{ data: pending }, { data: history }] = await Promise.all([
    supabase.from("approvals").select(select).eq("status", "pending").order("created_at").returns<Row[]>(),
    supabase
      .from("approvals")
      .select(select)
      .in("status", ["approved", "rejected"])
      .order("decided_at", { ascending: false })
      .limit(30)
      .returns<Row[]>(),
  ]);

  return (
    <>
      <PageHeader title={`承認待ち(${pending?.length ?? 0})`} />
      <p className="mb-4 text-xs text-muted">
        承認しても、このアプリは送信・投稿・支払いを自動で実行しません。承認済みの成果物は「実行可」になり、オーナーが手動で使用します。
      </p>

      <div className="space-y-4">
        {(pending ?? []).length === 0 && <Empty>承認待ちはありません 🎉</Empty>}
        {(pending ?? []).map((a) => (
          <Card key={a.id} id={`approval-${a.id}`} data-testid="approval-item" className="space-y-3 border-amber-400/50">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className={APPROVAL_STATUS.pending.className}>承認待ち</Badge>
              <Badge className="border border-line text-fg">{APPROVAL_TYPE[a.type].label}</Badge>
            </div>
            <Link href={`/tasks/${a.task_id}`} className="block text-base font-bold underline-offset-2 hover:underline">
              {a.tasks?.title}
            </Link>
            <dl className="space-y-1 text-sm">
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted">担当</dt>
                <dd>
                  {a.tasks?.employees?.name ?? "—"}(v{a.task_runs?.version}・{formatJst(a.created_at)})
                </dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted">理由</dt>
                <dd>{a.reason}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="w-12 shrink-0 text-muted">影響</dt>
                <dd className="text-amber-200">{a.impact}</dd>
              </div>
            </dl>
            <details open className="rounded-xl border border-line bg-bg/60 p-3">
              <summary className="cursor-pointer text-sm font-semibold text-muted">内容プレビュー</summary>
              <div className="mt-2 max-h-[50vh] overflow-y-auto">
                <Markdown>{a.task_runs?.output_md ?? ""}</Markdown>
              </div>
            </details>
            <DecisionForm approvalId={a.id} />
          </Card>
        ))}
      </div>

      {(history ?? []).length > 0 && (
        <section className="mt-8 space-y-2">
          <h2 className="text-sm font-bold text-muted">最近の判断</h2>
          {history!.map((a) => (
            <Link
              key={a.id}
              href={`/tasks/${a.task_id}`}
              className="flex items-center gap-2 rounded-xl bg-surface p-3 text-sm"
            >
              <Badge className={APPROVAL_STATUS[a.status].className}>{APPROVAL_STATUS[a.status].label}</Badge>
              <span className="flex-1 truncate">{a.tasks?.title}</span>
              <span className="text-xs text-muted">{formatJst(a.decided_at)}</span>
            </Link>
          ))}
        </section>
      )}
    </>
  );
}
