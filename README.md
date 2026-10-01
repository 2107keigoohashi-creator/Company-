# CALLOUT HQ

英語学習アプリ事業「CALLOUT」(esports×英語学習 / XERO DIVISION)の運営会社を、オーナー1人 + AI社員8役で回すための経営管理アプリです。スマホ(幅390px前後)での利用を前提にした PWA です。

- **タスクボード** — カンバン(未着手 / 実行中 / 承認待ち / 完了 / 却下)、秘書ビュー(今日・今週・期限超過)、AI社員による実行(ストリーミング)、修正依頼による再実行とバージョン履歴
- **承認フロー** — 外部に出る/取り消せない成果物は承認必須。承認受信箱で「承認」「差し戻し(コメント必須)」。全操作の監査ログ
- **経理・売上ダッシュボード** — 売上・経費・請求書の登録、経理AIによる下書き(経費の分類候補・請求書明細)、KPI・月次推移・カテゴリ内訳、請求書の PDF 保存、CSV エクスポート

> このアプリは **外部への送信・投稿・支払いを一切自動実行しません**。承認済みの成果物は「実行可」になり、オーナーが手動で使います。

## 技術スタック

| 用途 | 採用 |
|---|---|
| フレームワーク | Next.js 16 (App Router) + TypeScript + Tailwind CSS v4 |
| DB / 認証 | Supabase (Postgres + Auth)、全テーブル RLS |
| AI | Anthropic Claude API(`@anthropic-ai/sdk`、サーバー側 Route Handler からのみ呼び出し) |
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

### 3. Claude API

`ANTHROPIC_API_KEY` を設定します。キーはサーバー側でのみ使われ、クライアントには渡りません。
キー無しで画面を試したい場合は `AI_MOCK=1` にすると固定の模擬応答で動きます。

### 4. 起動

```bash
npm run dev     # http://localhost:3000
```

スマホでは「ホーム画面に追加」で PWA としてインストールできます。

### 5. Vercel へのデプロイ

1. リポジトリを Vercel にインポート
2. Environment Variables に `.env.example` の値(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `OWNER_EMAIL`, `ANTHROPIC_API_KEY`)を設定。`AI_MOCK` と E2E 用の変数は本番に設定しない
3. Supabase の **Authentication > URL Configuration** の Site URL に Vercel の URL を設定

タスク実行の Route Handler は `maxDuration = 300` 秒です。Vercel のプランによって上限が異なるため、長い成果物で途中終了する場合はプランの関数実行時間を確認してください。

## 環境変数

| 変数 | 必須 | 説明 |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | ✓ | Supabase の URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | ✓ | Supabase の anon キー(RLS が前提) |
| `OWNER_EMAIL` | ✓ | アプリを使えるオーナーのメール。これ以外のアカウントは全ページ・API が拒否される |
| `ANTHROPIC_API_KEY` | ✓ | Claude API キー(サーバー専用) |
| `AI_MOCK` | | `1` で Claude を呼ばずに模擬応答(テスト・デモ用) |
| `SUPABASE_SERVICE_ROLE_KEY` / `E2E_OWNER_PASSWORD` | E2E のみ | ローカル Supabase でテストユーザーを作り直すために使用。**アプリ本体は service_role キーを使いません** |

## 画面構成(下部タブ)

| タブ | 内容 |
|---|---|
| タスク | カンバン(横スワイプ)/ 秘書ビュー、新規タスク(「社長におまかせ」で担当提案)、詳細(実行・修正依頼・コメント・履歴) |
| 承認 | 承認待ちの受信箱(内容プレビュー・担当・理由・影響)、承認 / 差し戻し、最近の判断 |
| 経理 | ダッシュボード、売上、経費(下書き→確定)、請求書(下書き→確定→入金済、PDF 保存) |
| 社員 | 8 人の AI社員の名前・役割・できること・禁止事項・system prompt の編集、有効/無効 |
| 設定 | Claude のモデル・1実行あたりの上限・月次上限、請求書の自社情報、今月の利用量、パスワード変更、監査ログ、ログアウト |

## 承認フローの安全設計

「AI社員の API 経路からは承認状態を変更できない」ことを、アプリと DB の二重で担保しています。

- `approvals` テーブルは `authenticated` ロールから **UPDATE / DELETE 権限を剥奪**。INSERT も `status = 'pending'` のみ許可
- 承認・差し戻しは security definer 関数 `decide_approval()` だけが行える。オーナー操作の Server Action(`src/app/(app)/approvals/actions.ts`)からのみ呼び出し、AI 実行経路(`/api/tasks/[id]/run`)は呼ばない
- `tasks.status` を `ready`(承認済・実行可)/ `rejected` にできるのは `decide_approval()` 経由のみ(トリガーで検証)。承認必須タスクは `ready` を経ずに `done` にできず、承認待ち中は承認種別も変更できない
- 差し戻しはコメント必須(DB でも検証)。決定は監査ログに同一トランザクションで記録
- `audit_logs` / `ai_usage` は追記のみ。RLS の対象外である TRUNCATE は全テーブルで剥奪
- 全 AI社員の system prompt の先頭に、編集できない共通ルール(未成年配慮・「AI発音判定」と言わない・取り消せない行為は案として提出・口座/カード番号を扱わない・税務法務は専門家に要確認・「要判断事項」を明記)を付与(`src/lib/ai/rules.ts`)

## Claude API のコスト対策と試算

- 1実行あたりの `max_tokens` 上限(設定画面、既定 8,000)
- 月次の利用トークン上限(既定 2,000,000)。超過時は実行を停止(設定でオフ可)
- 関連する過去成果物は最大 2 件・各 4,000 文字に制限してプロンプトに含める(超過分は明示して省略)
- 利用量は全 AI 呼び出し(タスク実行・担当提案・経費分類・請求書下書き)を `ai_usage` に記録し、設定画面と経理ダッシュボードに表示
- Claude Opus 5.5 / Sonnet 5.5 では、安全分類器による辞退時に API 側で代替モデルが自動で再試行する `fallbacks: "default"`(beta)を有効にしています

**試算**(1回のタスク実行 ≒ 入力 3,000 / 出力 2,000 トークン、1ドル=150円で概算):

| モデル | 料金(入力/出力 per 1M) | 1回あたり | 月300回 |
|---|---|---|---|
| Claude Opus 5.5(既定・高品質) | $4 / $20 | 約 $0.05(約8円) | 約 $16(約2,300円) |
| Claude Sonnet 5.5 | $2 / $10 | 約 $0.026(約4円) | 約 $8(約1,200円) |
| Claude Haiku 4.5 | $1 / $5 | 約 $0.013(約2円) | 約 $4(約600円) |

既定の月次上限 2,000,000 トークン(入力6:出力4 と仮定)は、Opus 5.5 で約 $21(約3,100円)に相当します。実際の料金は Anthropic Console で確認してください。

## E2E テスト

ローカル Supabase(Docker)と模擬 AI で、モバイルビューポート(390×844)の E2E を実行します。

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

- タスク作成 → 実行(ストリーミング)→ 承認待ち → 承認 → 実行可 → 完了(監査ログ確認込み)
- 差し戻し(コメント必須)→ 再実行 → v2 が承認待ち
- 承認不要タスクの修正依頼 → 再実行(履歴保持)
- Claude API 失敗時のエラー表示と再実行
- 秘書ビューの期限超過ハイライト
- 経費登録(経理AIの分類提案 → 確定)→ ダッシュボードに反映、下書きは集計外
- 請求書(経理AIの明細下書き → 確定 → 印刷画面)、CSV エクスポート
- 未ログイン時の全ページ拒否、オーナーのトークンでも承認状態を直接変更できないこと
- 設定画面でのパスワード変更と、新しいパスワードでの再ログイン

## 仕様上の前提(開始前の確認事項への暫定対応)

| 確認事項 | このリポジトリでの扱い |
|---|---|
| Supabase プロジェクト | 環境変数で接続先を渡す方式。新規プロジェクトにマイグレーションを適用して使う |
| 請求書の自社情報 | 設定画面で入力(社名・所在地・インボイス登録番号は任意)。未入力時は請求書に「社名未設定」と表示 |
| Claude モデルと月次上限 | 既定は Claude Opus 5.5、月 2,000,000 トークンで停止。設定画面で Sonnet 5.5 / Haiku 4.5 への変更と上限調整が可能 |

## TODO: 個人情報の取り扱い方針(要・専門家確認)

未成年ユーザーが多い事業のため、運用開始前に弁護士など専門家の確認が必要です。

- [ ] **顧客情報の保存範囲**: 問い合わせ対応タスクに入力してよい情報の範囲(氏名・メール・保護者情報の扱い)。現状アプリ側に個人情報専用の項目はなく、タスクの指示文・成果物に自由記述で入る点に注意
- [ ] **保持期間**: タスク・成果物・コメント・監査ログ・経理データの保存期間と削除手順(会計帳簿の法定保存期間との整合)
- [ ] **第三者提供**: Claude API(Anthropic)へ送信されるデータの範囲と、プライバシーポリシーへの記載
- [ ] **未成年の個人情報**: 学校成績などのセンシティブ情報は扱わない方針(AI の共通ルールには記載済み)を運用ルールとして明文化
- [ ] **アクセス管理**: オーナー端末の紛失時の対応(Supabase でのセッション無効化手順)

## 今後の検討課題

- **外部連携**(承認済み成果物の実行): SNS 投稿・メール送信・会計ソフト API・GitHub デプロイなど。承認済み(`ready`)のみ実行可能にし、実行も監査ログに残す設計を前提に別途検討
- **複数ユーザー化**: 全テーブルに `owner_id` を持たせてあるため、`organizations` テーブルとメンバー/ロール(オーナー・閲覧者・承認者)を追加し、RLS を組織単位に拡張する。`OWNER_EMAIL` による単一オーナー判定はロール判定に置き換え
- **通知**: 承認待ち発生時のプッシュ通知(Web Push)
- **成果物ファイル**: デザイナーの SVG/HTML 成果物を Supabase Storage に保存してプレビュー
- **請求書 PDF の自動生成**: 現状はブラウザの印刷機能で PDF 保存。サーバー側 PDF 生成(日本語フォント埋め込み)は必要に応じて検討
- **プロンプトキャッシュ**: 社員の system prompt が長くなった場合に prompt caching を導入してコスト削減

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
    api/
      tasks/[id]/run  タスク実行(Claude ストリーミング)
      assign          社長による担当提案
      accounting/*    経理AIの下書き
      export          CSV エクスポート
    print/invoices/   請求書の印刷用 HTML
    login/            ログイン
  lib/
    ai/               Claude 呼び出し・共通ルール・プロンプト・利用量
    supabase/         Supabase クライアント
  proxy.ts            未ログイン/非オーナーのリダイレクト
supabase/migrations/  スキーマ・RLS・承認関数・社員 seed
e2e/                  Playwright テスト
```
