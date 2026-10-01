import type { Metadata } from "next";
import { requireOwner } from "@/lib/auth";
import { COMMON_RULES } from "@/lib/rules";
import { Card, PageHeader } from "@/components/ui";
import { CopyBlock } from "./copy-block";

export const metadata: Metadata = { title: "Claude の使い方" };

export default async function GuidePage() {
  await requireOwner();
  const ref = (() => {
    try {
      return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname.split(".")[0];
    } catch {
      return "(プロジェクトID)";
    }
  })();

  const instructions = `あなたは「CALLOUT」(英語学習アプリ。esports×英語学習 / XERO DIVISION)運営会社のAI社員です。
作業はこの会話で行い、進捗と成果物は CALLOUT HQ(Supabase プロジェクト ${ref})に Supabase コネクタで記録します。

## 作業の進め方
1. 依頼されたタスクの内容を読む:
   select t.id, t.title, t.instruction, t.status, t.approval_type, e.name, e.system_prompt, e.prohibitions
   from tasks t left join employees e on e.id = t.employee_id where t.id = '<タスクID>';
   select kind, author, body, created_at from task_comments where task_id = '<タスクID>' order by created_at;  -- 修正依頼・差し戻しの理由
2. 着手: select hq_log('<タスクID>', '着手しました', 10, 'running');
3. 途中経過: select hq_log('<タスクID>', '○○まで完了', 50);
4. 完成: select hq_submit_result('<タスクID>', '<Markdown の成果物>', '提出メモ');
   (承認が必要なタスクは自動で「承認待ち」になり、オーナーがアプリで承認/差し戻しします)
5. 新しい仕事を頼まれたとき: select hq_create_task('<題名>', '<指示>', '<社員キー>', 'normal', null, 'none');
   社員キー: president / secretary / writer / designer / marketer / engineer / accountant / customer
   承認種別: none / external_post / email_reply / invoice_issue / expense_confirm / code_deploy
6. 作業待ちの一覧: select id, title, status from tasks where status in ('todo','rejected') order by created_at;

## 厳守事項
- 承認・差し戻し・完了の操作はしない(承認はオーナーがアプリで行う)。tasks / approvals を直接 update/delete しない。
- 送信・公開・投稿・支払い・契約・本番反映は実行しない。案として成果物に書く。
${COMMON_RULES.split("\n").filter((l) => l.startsWith("- ")).join("\n")}`;

  return (
    <>
      <PageHeader title="Claude の使い方" back="/employees" />
      <div className="space-y-4 text-sm">
        <Card className="space-y-2">
          <h2 className="font-bold">基本の流れ</h2>
          <ol className="list-decimal space-y-1 pl-5">
            <li>アプリでタスクを作る(または Claude に「○○をタスク登録して」と頼む)</li>
            <li>タスク詳細の「Claude への依頼文をコピー」を Claude に貼り付ける</li>
            <li>Claude が進捗と成果物をアプリに記録する(貼り付けで手入力もできます)</li>
            <li>承認が必要なものは「承認」タブで、オーナーが承認 / 差し戻し</li>
          </ol>
          <p className="text-xs text-muted">Claude API は使いません。Claude 側の利用枠(claude.ai / Claude Code)で作業します。</p>
        </Card>

        <Card className="space-y-2">
          <h2 className="font-bold">最初に一度だけ: Claude に覚えてもらう指示</h2>
          <p className="text-xs text-muted">
            claude.ai の「プロジェクト」の指示(Project instructions)や、Claude Code の CLAUDE.md に貼り付けておくと、毎回の依頼が短く済みます。
            Claude には Supabase コネクタ(このプロジェクトに接続したもの)が必要です。
          </p>
          <CopyBlock text={instructions} label="指示文をコピー" />
        </Card>

        <Card className="space-y-1 text-xs text-muted">
          <h2 className="text-sm font-bold text-fg">安全面について</h2>
          <p>
            アプリの承認ボタン(オーナーのログイン)以外では、承認・差し戻しができません。Claude 用の関数 hq_* には承認を行う機能がなく、
            SQL 経由で承認を偽装しても拒否されます。
          </p>
          <p>
            ただし Supabase コネクタは生の SQL を実行できるため、技術的には Claude が意図的に表を直接書き換える余地は残ります。
            上の「厳守事項」を必ず指示に入れ、承認待ちの内容は承認前にご自身で確認してください。すべての操作は設定画面の監査ログに残ります。
          </p>
        </Card>
      </div>
    </>
  );
}
