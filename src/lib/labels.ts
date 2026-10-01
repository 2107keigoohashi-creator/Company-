import type { ApprovalStatus, ApprovalType, Priority, TaskStatus } from "./types";

/** 状態は色と文言の両方で区別する */
export const TASK_STATUS: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "未着手", className: "bg-slate-700 text-slate-100" },
  running: { label: "実行中", className: "bg-sky-600 text-white" },
  pending_approval: { label: "承認待ち", className: "bg-amber-400 text-black" },
  ready: { label: "承認済・実行可", className: "bg-emerald-500 text-black" },
  done: { label: "完了", className: "bg-emerald-800 text-emerald-50" },
  rejected: { label: "却下・差し戻し", className: "bg-rose-600 text-white" },
};

export const BOARD_COLUMNS: { key: string; label: string; statuses: TaskStatus[] }[] = [
  { key: "todo", label: "未着手", statuses: ["todo"] },
  { key: "running", label: "実行中", statuses: ["running"] },
  { key: "pending_approval", label: "承認待ち", statuses: ["pending_approval"] },
  { key: "done", label: "完了", statuses: ["ready", "done"] },
  { key: "rejected", label: "却下", statuses: ["rejected"] },
];

export const PRIORITY: Record<Priority, { label: string; className: string; rank: number }> = {
  urgent: { label: "緊急", className: "text-rose-400", rank: 0 },
  high: { label: "高", className: "text-amber-300", rank: 1 },
  normal: { label: "中", className: "text-slate-300", rank: 2 },
  low: { label: "低", className: "text-slate-500", rank: 3 },
};

export const APPROVAL_TYPE: Record<
  ApprovalType,
  { label: string; reason: string; impact: string }
> = {
  none: { label: "承認不要(社内向け)", reason: "", impact: "" },
  external_post: {
    label: "対外投稿(SNS/記事)",
    reason: "外部に公開される投稿・記事のため",
    impact: "公開後は不特定多数(未成年を含む)の目に触れ、取り消しが困難です",
  },
  email_reply: {
    label: "メール・問い合わせ返信",
    reason: "顧客・外部へ送る文面のため",
    impact: "送信後は取り消せません。約束・回答内容が会社の公式見解になります",
  },
  invoice_issue: {
    label: "請求書発行",
    reason: "取引先へ金額を請求する書類のため",
    impact: "金額・宛先の誤りは信用と入金に影響します",
  },
  expense_confirm: {
    label: "支出・経費確定",
    reason: "会社のお金が出ていく/帳簿に確定するため",
    impact: "支払い後は取り消しが困難で、会計記録に残ります",
  },
  code_deploy: {
    label: "コードのデプロイ・本番変更",
    reason: "本番環境の動作が変わるため",
    impact: "ユーザーに直接影響し、障害の可能性があります。ロールバック手順の確認を",
  },
};

export const APPROVAL_STATUS: Record<ApprovalStatus, { label: string; className: string }> = {
  pending: { label: "承認待ち", className: "bg-amber-400 text-black" },
  approved: { label: "承認済", className: "bg-emerald-500 text-black" },
  rejected: { label: "差し戻し", className: "bg-rose-600 text-white" },
  superseded: { label: "再実行により無効", className: "bg-slate-600 text-slate-100" },
};
