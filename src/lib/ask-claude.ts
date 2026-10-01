import { APPROVAL_TYPE } from "./labels";
import type { ApprovalType } from "./types";

export function supabaseProjectRef() {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
  } catch {
    return "";
  }
}

/** Claude に貼り付ける依頼文(タスクID・使う関数・厳守事項入り) */
export function buildAskClaudeText(args: { taskId: string; employeeName: string | null; approvalType: ApprovalType }) {
  const { taskId: id, employeeName, approvalType } = args;
  return [
    `CALLOUT HQ のタスクを進めてください。(Supabase プロジェクト: ${supabaseProjectRef()} / タスクID: ${id})`,
    `担当役割: ${employeeName ?? "未設定"} / 承認種別: ${approvalType === "none" ? "なし" : APPROVAL_TYPE[approvalType].label}`,
    "",
    "1. まず tasks / employees / task_comments / task_runs を読み、指示・担当社員の指針・オーナーのコメント(修正依頼・差し戻し)を把握する",
    `2. 作業を始めたら: select hq_log('${id}', '着手しました', 10, 'running');`,
    `3. 区切りごとに: select hq_log('${id}', '進捗メモ', 50);`,
    `4. 完成したら: select hq_submit_result('${id}', '<Markdown の成果物>', '提出メモ');`,
    "",
    "送信・公開・投稿・支払い・本番反映などは実行せず、案として提出すること。承認・差し戻しはオーナーがアプリで行うので、承認の操作はしないこと。",
    "判断が必要な点は成果物の最後に「## 要判断事項」として書くこと。詳しいルールはアプリの /guide を参照。",
  ].join("\n");
}
