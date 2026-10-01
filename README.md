# CALLOUT HQ

英語学習アプリ事業「CALLOUT」(esports×英語学習 / XERO DIVISION)の運営会社を、オーナー1人 + AI社員8役で回すための経営管理アプリです。スマホ(幅390px前後)での利用を前提にした PWA です。

**作業は Claude(claude.ai / Claude Code)に頼み、このアプリは進捗と経過を記録・管理します。** アプリから Claude API は呼びません(API キー・従量課金は不要)。

- **オフィスビュー** — 見下ろし型のオフィス図で 8 人の作業状況(作業中・承認待ち・差し戻し・着手待ち・待機)と今のタスク・進捗%を表示。「社長からの指示」欄からタスク登録、承認待ち・期限超過・今週の完了、最新の動き(15 秒ごとに自動更新)
- **タスクボード** — カンバン(未着手 / 実行中 / 承認待ち / 完了 / 却下)、秘書ビュー(今日・今週・期限超過)、進捗(%)とやりとりのタイムライン、成果物の版管理、修正依頼
- **承認フロー** — 外部に出る/取り消せない成果物は承認必須。承認受信箱で「承認」「差し戻し(コメント必須)」。全操作の監査ログ
- **経理・売上ダッシュボード** — 売上・経費・請求書の登録、KPI・月次推移・カテゴリ内訳、請求書の PDF 保存、CSV エクスポート

> このアプリは **外部への送信・投稿・支払いを一切自動実行しません**。承認済みの成果物は「実行可」になり、オーナーが手動で使います。

## 使い方(Claude との連携)

1. アプリでタスクを作る(または Claude に「○○をタスク登録して」と頼む)
2. タスク詳細の「Claude への依頼文をコピー」を Claude に貼り付ける
3. Claude が Supabase コネクタ経由で `hq_*` 関数を呼び、進捗と成果物を記録する(画面に貼り付けて手入力もできる)
4. 承認が必要なものは「承認」タブで、オーナーが承認 / 差し戻し

Claude 側の準備は、アプリの「社員 > Claude の使い方」(`/guide`)に出る指示文を、claude.ai のプロジェクト指示または CLAUDE.md に一度貼り付けるだけです。Claude に Supabase コネクタ(このプロジェクトに接続したもの)が必要です。

| 関数(service 側のみ。Web のログインユーザーは呼べない) | 内容 |
|---|---|
| `hq_create_task(title, instruction, employee_key, priority, due_at, approval_type)` | タスク登録 |
| `hq_log(task_id, note, progress, status)` | 進捗報告(状態は `todo` / `running` のみ指定可) |
| `hq_submit_result(task_id, output_md, note)` | 成果物の提出。承認必須のタスクは自動で「承認待ち」。再提出は新しい版 |

承認・差し戻し・完了は、Claude 側の関数にはありません(オーナーがアプリで行います)。

## 技術スタック

| 用途 | 採用 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 |
| DB / 認証 | Supabase (Postgres + Auth)、全テーブル RLS |
| グラフ | Recharts |
| テスト | Playwright(モバイルビューポート E2E) |
| デプロイ | Vercel 想定 |

## セットアップ

### 1. 依存関係

```bash
npm install
cp .env.example .env.local   # 値を埋める
```

### 2. Supabase

> **セットアップ済みの本番プロジェクト**: `CALLOUT HQ`(ref `zbnwrsgmxyfbbiycmtzc`、東京リージョン)。
> `supabase/migrations/` の 3 ファイルは適用済み、オーナーアカウントと 8 人の AI社員も作成済みです。
>
> ```
> NEXT_PUBLIC_SUPABASE_URL=https://zbnwrsgmxyfbbiycmtzc.supabase.co
> NEXT_PUBLIC_SUPABASE_ANON_KEY=(ダッシュボード > Project Settings > API Keys の anon / publishable キー)
> ```
>
> 残りの手動作業: 下記 3(新規登録をオフ)。以下は新しく作り直す場合の手順です。

1. Supabase で新規プロジェクトを作成
2. マイグレーションを適用(どちらか)
   - CLI: `npx supabase link --project-ref <ref>` → `npx supabase db push`
   - ダッシュボードの SQL Editor で `supabase/migrations/` の各ファイルを番号順に実行
3. **Authentication > Providers > Email** で「Allow new users to sign up」を **オフ**
4. **Authentication > Users > Add user** でオーナーのアカウントを作成(メール + パスワード、Auto Confirm)
5. `.env.local` に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `OWNER_EMAIL`(4 で作ったメール)を設定

初回ログイン時に、設定行と 8 人の AI社員(社長・秘書・ライター・デザイナー・マーケター・エンジニア・経理・カスタマー)が自動で作成されます(`bootstrap_owner()`)。

### 3. 起動

```bash
npm run dev     # http://localhost:3000
```

スマホでは「ホーム画面に追加」で PWA としてインストールできます。

### 4. Vercel へのデプロイ

1. リポジトリを Vercel にインポート
2. Environment Variables に `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `OWNER_EMAIL` を設定。E2E 用の変数は本番に設定しない
3. Supabase の **Authentication > URL Configuration** の Site URL に Vercel の URL を設定

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase の URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase の anon キー(RLS が前提) |
| `OWNER_EMAIL` | ✓ | アプリを使えるオーナーのメール。これ以外のアカウントは全ページ・API が拒否される |
| `SUPABASE_SERVICE_ROLE_KEY` / `E2E_OWNER_PASSWORD` | E2E のみ | ローカル Supabase でテストユーザーを作り直すために使用。**アプリ本体は service_role キーを使いません** |

## 画面構成(下部タブ)

| タブ | 内容 |
|---|---|
| タスク | オフィスビュー(既定)/ カンバン(横スワイプ)/ 秘書ビュー、新規タスク、詳細(Claude への依頼文コピー・進捗・成果物の貼り付け登録・修正依頼・やりとり・版履歴) |
| 承認 | 承認待ちの受信箱(内容プレビュー・担当・理由・影響)、承認 / 差し戻し、最近の判断 |
| 経理 | ダッシュボード、売上、経費(下書き→確定)、請求書(下書き→確定→入金済、PDF 保存、CSV) |
| 社員 | 8 人の役割・できること・禁止事項・個別の指針の編集、有効/無効、「Claude の使い方」(指示文) |
| 設定 | 請求書の自社情報、パスワード変更、監査ログ、ログアウト |

## 承認フローの安全設計

「Claude 側から承認状態を変えられない」ことを、アプリと DB の二重で担保しています。

- `approvals` テーブルは `authenticated` ロールから **UPDATE / DELETE 権限を剥奪**。INSERT も `status = 'pending'` のみ許可
- 承認・差し戻しは security definer 関数 `decide_approval()` だけが行える。呼び出せるのはアプリ(PostgREST 経由のオーナーのログイン)のみで、SQL 接続(`session_user` が `authenticator` 以外)からは JWT claims を偽装しても拒否される
- Claude 用の `hq_*` 関数には承認・差し戻し・完了の機能がない。`hq_*` は Web のログインユーザー・anon からは実行不可(service 側のみ)
- `tasks.status` を `ready`(承認済・実行可)/ `rejected` にできるのは `decide_approval()` 経由のみ(トリガーで検証)。承認必須タスクは `ready` を経ずに `done` にできず、承認待ち中は承認種別も変更できない
- 差し戻しはコメント必須(DB でも検証)。決定は監査ログに同一トランザクションで記録。Claude の操作も `actor = 'claude'` で記録
- `audit_logs` は追記のみ。RLS の対象外である TRUNCATE は全テーブルで剥奪

> **限界(重要)**: Supabase コネクタは生の SQL を実行できるため、Claude が意図的に表を直接書き換える(`set_config` でトリガーの目印を立てる等)余地は技術的には残ります。これを完全に封じるには、Claude に `hq_*` 関数だけを持つ専用 DB ロール(または Edge Function + トークン)を渡す構成が必要です。当面は「指示文の厳守事項」と、承認前の内容確認・監査ログで運用してください。

## E2E テスト

ローカル Supabase(Docker)で、モバイルビューポート(390×844)の E2E を実行します。

```bash
npx supabase start            # 表示される anon / service_role キーを .env.local に設定
# .env.local の例:
#   NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321
#   NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon key>
#   SUPABASE_SERVICE_ROLE_KEY=<service_role key>
#   OWNER_EMAIL=owner@callout.test
#   E2E_OWNER_PASSWORD=<任意>
npm run test:e2e
```

テストはローカル Supabase のオーナーユーザーを毎回削除・再作成します(ローカル以外の URL では実行を拒否します)。

カバーしているシナリオ:

- タスク作成 → 進捗記録(カンバンに % 表示)→ 成果物の貼り付け登録 → 承認待ち → 承認 → 実行可 → 完了(監査ログ確認込み)
- 差し戻し(コメント必須)→ 修正版を登録 → v2 が承認待ち
- 承認不要タスクの完了 → 修正依頼で未着手に戻る → v2 登録(履歴保持)
- 秘書ビューの期限超過ハイライト、Claude の使い方ページ
- オフィスビュー: 社員を選んで指示 → Enter でタスク登録 → Claude の進捗が見取り図・最新の動きに反映、部屋のズーム
- **Claude 側の記録**: `hq_create_task` / `hq_log` / `hq_submit_result` で登録・進捗・提出 → 画面に反映。Claude は完了・承認にできず、承認済みタスクには提出できない
- 経費登録(分類を選んで確定)→ ダッシュボードに反映、下書きは集計外
- 請求書(明細入力 → 確定 → 印刷画面)、CSV エクスポート
- 未ログイン時の全ページ拒否、オーナーのトークンでも承認状態を直接変更できないこと、`hq_*` をログインユーザーが呼べないこと、SQL 経由の承認偽装の拒否
- 設定画面でのパスワード変更と、新しいパスワードでの再ログイン

## 仕様上の前提(開始前の確認事項への暫定対応)

| 確認事項 | このリポジトリでの扱い |
|---|---|
| Supabase プロジェクト | 環境変数で接続先を渡す方式。新規プロジェクトにマイグレーションを適用して使う |
| 請求書の自社情報 | 設定画面で入力(社名・所在地・インボイス登録番号は任意)。未入力時は請求書に「社名未設定」と表示 |
| Claude の使い方 | アプリは Claude API を呼ばない。作業は Claude 側(claude.ai / Claude Code)で行い、利用枠もそちらに依存する |

## TODO: 個人情報の取り扱い方針(要・専門家確認)

未成年ユーザーが多い事業のため、運用開始前に弁護士など専門家の確認が必要です。

- [ ] **顧客情報の保存範囲**: 問い合わせ対応タスクに入力してよい情報の範囲(氏名・メール・保護者情報の扱い)。現状アプリ側に個人情報専用の項目はなく、タスクの指示文・成果物に自由記述で入る点に注意
- [ ] **保持期間**: タスク・成果物・コメント・監査ログ・経理データの保存期間と削除手順(会計帳簿の法定保存期間との整合)
- [ ] **第三者提供**: Claude に渡す情報の範囲(依頼文・タスクの指示文に個人情報を入れない運用)と、プライバシーポリシーへの記載
- [ ] **未成年の個人情報**: 学校成績などのセンシティブ情報は扱わない方針(AI の共通ルールには記載済み)を運用ルールとして明文化
- [ ] **アクセス管理**: オーナー端末の紛失時の対応(Supabase でのセッション無効化手順)

## 今後の検討課題

- **外部連携**(承認済み成果物の実行): SNS 投稿・メール送信・会計ソフト API・GitHub デプロイなど。承認済み(`ready`)のみ実行可能にし、実行も監査ログに残す設計を前提に別途検討
- **複数ユーザー化**: 全テーブルに `owner_id` を持たせてあるため、`organizations` テーブルとメンバー/ロール(オーナー・閲覧者・承認者)を追加し、RLS を組織単位に拡張する。`OWNER_EMAIL` による単一オーナー判定はロール判定に置き換え
- **通知**: 承認待ち発生時のプッシュ通知(Web Push)
- **成果物ファイル**: デザイナーの SVG/HTML 成果物を Supabase Storage に保存してプレビュー
- **請求書 PDF の自動生成**: 現状はブラウザの印刷機能で PDF 保存。サーバー側 PDF 生成(日本語フォント埋め込み)は必要に応じて検討
- **Claude 専用の権限**: `hq_*` 関数だけを持つ専用 DB ロール、または Edge Function + トークンを用意し、生の SQL 権限を Claude に渡さない構成にする(承認の安全性を強化)

## ディレクトリ構成

```
src/
  app/
    (app)/            ログイン後の画面(下部タブ)
      tasks/          タスクボード・詳細・実行パネル
      approvals/      承認受信箱
      accounting/     経理ダッシュボード・売上・経費・請求書
      employees/      AI社員の編集
      settings/       設定・利用量・監査ログ
    api/export        CSV エクスポート
    print/invoices/   請求書の印刷用 HTML
    login/            ログイン
  lib/
    rules.ts          全社員共通ルール(Claude 用の指示文に含まれる)
    supabase/         Supabase クライアント
  proxy.ts            未ログイン/非オーナーのリダイレクト
supabase/migrations/  スキーマ・RLS・承認関数・社員 seed
e2e/                  Playwright テスト
```
