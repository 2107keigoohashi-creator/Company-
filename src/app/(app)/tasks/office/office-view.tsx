"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState, type KeyboardEvent } from "react";
import { APPROVAL_TYPE, TASK_STATUS } from "@/lib/labels";
import type { ApprovalType, TaskStatus } from "@/lib/types";
import { Badge, Button, ErrorBox, ProgressBar, inputClass } from "@/components/ui";
import { quickInstruction, type InstructionState } from "../actions";
import { MEMBER_STATUS, OfficeMap, ROOMS, ROOM_H, ROOM_W, VIEW_H, VIEW_W, type OfficeMember } from "./office-map";

export interface FeedItem {
  id: string;
  at: string;
  actor: "owner" | "claude" | "system";
  text: string;
  taskId: string;
  taskTitle: string;
}

export interface OfficeStats {
  pendingApprovals: number;
  overdue: number;
  doneThisWeek: number;
}

const REFRESH_MS = 15_000;
const ACTOR = { owner: "オーナー", claude: "Claude", system: "システム" } as const;

function timeAgo(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "たった今";
  if (s < 3600) return `${Math.floor(s / 60)}分前`;
  if (s < 86400) return `${Math.floor(s / 3600)}時間前`;
  return `${Math.floor(s / 86400)}日前`;
}

export function OfficeView({
  members,
  feed,
  stats,
}: {
  members: OfficeMember[];
  feed: FeedItem[];
  stats: OfficeStats;
}) {
  const router = useRouter();
  const [room, setRoom] = useState<string>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bubbles, setBubbles] = useState(true);
  const [tags, setTags] = useState(true);
  const [refreshedAt, setRefreshedAt] = useState(() => Date.now());
  const president = members.find((m) => m.key === "president" && m.enabled) ?? members.find((m) => m.enabled);
  const [assignee, setAssignee] = useState(president?.id ?? "");
  const instructionRef = useRef<HTMLTextAreaElement>(null);

  // Claude の記録を拾うため、表示中は定期的に再取得する
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
        setRefreshedAt(Date.now());
      }
    }, REFRESH_MS);
    return () => clearInterval(timer);
  }, [router]);

  const current = ROOMS.find((r) => r.key === room);
  const viewBox = current ? `${current.x - 10} ${current.y - 10} ${ROOM_W + 20} ${ROOM_H + 20}` : `0 0 ${VIEW_W} ${VIEW_H}`;
  const selected = members.find((m) => m.id === selectedId) ?? null;

  const count = (s: string) => members.filter((m) => m.status === s).length;
  const working = count("working");
  const review = count("review");
  const waiting = members.filter((m) => m.enabled && ["queued", "idle", "rejected"].includes(m.status)).length;
  const headline =
    working > 0
      ? `${working}人が作業中です${review ? `。承認待ちが${review}件あります` : ""}`
      : review > 0
        ? `承認待ちが${review}件あります。承認タブで確認してください`
        : "全員が手を空けています。指示をお待ちしています";

  function selectMember(id: string) {
    setSelectedId((cur) => (cur === id ? null : id));
  }

  function instructTo(member: OfficeMember) {
    setAssignee(member.id);
    instructionRef.current?.focus();
    instructionRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="office-wide space-y-4" data-testid="office-view">
      {/* ツールバー */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-line bg-surface p-2">
        <div className="-mx-1 flex max-w-full gap-1.5 overflow-x-auto px-1" role="group" aria-label="表示する部屋">
          {[{ key: "all", ja: "全体" }, ...ROOMS].map((r) => (
            <button
              key={r.key}
              type="button"
              onClick={() => setRoom(r.key)}
              aria-pressed={room === r.key}
              className={`min-h-10 shrink-0 rounded-lg border px-3 text-xs font-bold ${
                room === r.key ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
              }`}
            >
              {r.ja}
            </button>
          ))}
        </div>
        <div className="ml-auto flex items-center gap-3 px-1 text-xs text-muted">
          <label className="flex min-h-10 items-center gap-1.5">
            <input type="checkbox" checked={tags} onChange={(e) => setTags(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
            名札
          </label>
          <label className="flex min-h-10 items-center gap-1.5">
            <input type="checkbox" checked={bubbles} onChange={(e) => setBubbles(e.target.checked)} className="h-4 w-4 accent-cyan-400" />
            吹き出し
          </label>
        </div>
      </div>

      {/* 見取り図 */}
      <div className="overflow-x-auto rounded-2xl border border-line bg-[#05070b]">
        <div style={{ minWidth: room === "all" ? 760 : undefined }}>
          <OfficeMap
            members={members}
            viewBox={viewBox}
            selectedId={selectedId}
            showBubbles={bubbles}
            showTags={tags}
            onSelect={selectMember}
          />
        </div>
      </div>

      {/* 選択した社員 */}
      {selected && (
        <section className="space-y-3 rounded-2xl border border-accent/40 bg-surface p-4" aria-label={`${selected.name} の状況`} data-testid="member-panel">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-lg font-bold">{selected.name}</p>
              <p className="text-xs text-muted">{selected.responsibilities}</p>
            </div>
            <span className="text-sm font-bold" style={{ color: MEMBER_STATUS[selected.status].color }}>
              {MEMBER_STATUS[selected.status].icon} {MEMBER_STATUS[selected.status].label}
            </span>
          </div>
          {selected.open.length === 0 ? (
            <p className="text-sm text-muted">担当中のタスクはありません。</p>
          ) : (
            <ul className="space-y-2">
              {selected.open.map((t) => (
                <li key={t.id}>
                  <Link href={`/tasks/${t.id}`} className="block rounded-xl border border-line bg-bg/60 p-3 text-sm">
                    <span className="flex items-center gap-2">
                      <Badge className={TASK_STATUS[t.status as TaskStatus].className}>{TASK_STATUS[t.status as TaskStatus].label}</Badge>
                      <span className="flex-1 truncate font-semibold">{t.title}</span>
                    </span>
                    {t.status === "running" && (
                      <span className="mt-2 flex items-center gap-2 text-xs text-sky-300">
                        <ProgressBar value={t.progress} className="flex-1" />
                        {t.progress}%
                      </span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {selected.enabled && (
            <Button type="button" variant="secondary" className="w-full" onClick={() => instructTo(selected)}>
              {selected.name} に指示を出す
            </Button>
          )}
        </section>
      )}

      {/* ステータスバー */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl border border-line bg-surface px-4 py-3 text-sm" role="status">
        <span className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${working ? "bg-sky-400 office-pulse" : "bg-emerald-400"}`} aria-hidden />
          {headline}
        </span>
        <span className="ml-auto text-xs text-muted tabular-nums">
          <b className="text-sky-300">● 作業中 {working}</b> ／ <b className="text-amber-300">◆ 承認待ち {review}</b> ／ ○ 待機 {waiting}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-[1.3fr_1fr]">
        <InstructionBox
          members={members}
          assignee={assignee}
          setAssignee={setAssignee}
          textareaRef={instructionRef}
        />

        <div className="space-y-4">
          <section className="grid grid-cols-3 gap-2" aria-label="今の状況">
            <StatTile href="/approvals" label="承認待ち" value={stats.pendingApprovals} icon="◆" tone="text-amber-300" testid="stat-approvals" />
            <StatTile href="/tasks?view=schedule" label="期限超過" value={stats.overdue} icon="!" tone="text-rose-300" testid="stat-overdue" />
            <StatTile href="/tasks?view=board" label="今週の完了" value={stats.doneThisWeek} icon="✓" tone="text-emerald-300" testid="stat-done" />
          </section>

          <section className="rounded-2xl border border-line bg-surface p-4" aria-label="最新の動き">
            <div className="mb-2 flex items-baseline justify-between">
              <h2 className="text-sm font-bold">最新の動き</h2>
              <span className="text-[11px] text-muted">15秒ごとに自動更新</span>
            </div>
            {feed.length === 0 ? (
              <p className="text-sm text-muted">まだ記録はありません。</p>
            ) : (
              <ul className="divide-y divide-line">
                {feed.map((f) => (
                  <li key={f.id}>
                    <Link href={`/tasks/${f.taskId}`} className="block py-2 text-sm">
                      <span className="flex items-center gap-2 text-xs text-muted">
                        <b className={f.actor === "claude" ? "text-violet-300" : "text-accent"}>{ACTOR[f.actor]}</b>
                        <span className="truncate">{f.taskTitle}</span>
                        <span className="ml-auto shrink-0">{timeAgo(f.at, refreshedAt)}</span>
                      </span>
                      <span className="line-clamp-2">{f.text}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function StatTile({
  href,
  label,
  value,
  icon,
  tone,
  testid,
}: {
  href: string;
  label: string;
  value: number;
  icon: string;
  tone: string;
  testid: string;
}) {
  return (
    <Link href={href} className="rounded-2xl border border-line bg-surface p-3 text-center" data-testid={testid}>
      <p className={`text-3xl font-black tabular-nums ${value ? tone : "text-muted"}`}>{value}</p>
      <p className="mt-1 text-[11px] font-semibold text-muted">
        <span aria-hidden className={value ? tone : ""}>
          {icon}{" "}
        </span>
        {label}
      </p>
    </Link>
  );
}

function InstructionBox({
  members,
  assignee,
  setAssignee,
  textareaRef,
}: {
  members: OfficeMember[];
  assignee: string;
  setAssignee: (id: string) => void;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [copied, setCopied] = useState(false);
  const [state, action, pending] = useActionState<InstructionState, FormData>(async (prev, fd) => {
    const r = await quickInstruction(prev, fd);
    if (r?.created && textareaRef.current) textareaRef.current.value = "";
    setCopied(false);
    return r;
  }, undefined);

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    // 日本語変換中の Enter は送信しない
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      formRef.current?.requestSubmit();
    }
  }

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
    } catch {
      window.prompt("コピーして Claude に貼り付けてください", text);
    }
  }

  return (
    <section className="flex flex-col rounded-2xl border border-line bg-surface p-4" aria-label="社長からの指示">
      <h2 className="mb-2 text-sm font-bold">社長からの指示</h2>
      {state?.created ? (
        <div className="mb-3 space-y-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 p-3 text-sm" data-testid="instruction-created">
          <p>
            <b>{state.created.employee}</b> に「{state.created.title}」を登録しました。依頼文を Claude に貼り付けてください。
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" onClick={() => copy(state.created!.askText)}>
              {copied ? "✓ コピーしました" : "📋 依頼文をコピー"}
            </Button>
            <Link href={`/tasks/${state.created.id}`} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-line text-sm font-semibold">
              タスクを開く
            </Link>
          </div>
        </div>
      ) : (
        <p className="mb-3 text-sm text-muted">指示を書いて Enter で登録(改行は Shift+Enter)。1行目がタスク名になります。</p>
      )}
      <ErrorBox message={state?.error} />
      <form ref={formRef} action={action} className="mt-auto space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <select
            name="employee_id"
            aria-label="担当"
            value={assignee}
            onChange={(e) => setAssignee(e.target.value)}
            className={inputClass}
          >
            {members
              .filter((m) => m.enabled)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.key === "president" ? "社長(おまかせ)" : m.name}
                </option>
              ))}
          </select>
          <select name="approval_type" aria-label="承認" defaultValue="none" className={inputClass}>
            {(Object.keys(APPROVAL_TYPE) as ApprovalType[]).map((k) => (
              <option key={k} value={k}>
                {k === "none" ? "承認不要" : `承認: ${APPROVAL_TYPE[k].label}`}
              </option>
            ))}
          </select>
        </div>
        <div className="flex gap-2">
          <textarea
            ref={textareaRef}
            name="body"
            rows={2}
            required
            onKeyDown={onKeyDown}
            placeholder="ここに指示を書いて Enter"
            aria-label="指示"
            className={`${inputClass} flex-1 resize-none`}
          />
          <Button type="submit" disabled={pending} className="self-stretch px-5">
            {pending ? "…" : "送信"}
          </Button>
        </div>
      </form>
    </section>
  );
}
