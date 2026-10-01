-- CALLOUT HQ 初期スキーマ
-- 方針:
--  * 全テーブルに owner_id を持たせ、RLS で owner_id = auth.uid() のみ許可する
--  * 承認状態(approvals.status / tasks.status の ready・rejected)は
--    security definer 関数 decide_approval() 経由でしか変更できない
--  * audit_logs は追記のみ(UPDATE / DELETE 不可)

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- 共通: updated_at 自動更新
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- settings: オーナーごとの設定(Claude利用上限・請求書の自社情報)
-- ---------------------------------------------------------------------------
create table public.settings (
  owner_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  claude_model text not null default 'claude-opus-5-5',
  max_tokens_per_run integer not null default 8000 check (max_tokens_per_run between 256 and 64000),
  monthly_token_limit bigint not null default 2000000 check (monthly_token_limit >= 0),
  stop_on_limit boolean not null default true,
  company_name text not null default '',
  company_address text not null default '',
  invoice_registration_number text not null default '',
  invoice_note text not null default '',
  updated_at timestamptz not null default now()
);
create trigger settings_touch before update on public.settings
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- employees: AI社員
-- ---------------------------------------------------------------------------
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  key text not null,
  name text not null,
  role text not null,
  responsibilities text not null default '',
  capabilities text not null default '',
  prohibitions text not null default '',
  system_prompt text not null default '',
  enabled boolean not null default true,
  sort_order integer not null default 0,
  updated_at timestamptz not null default now(),
  unique (owner_id, key)
);
create trigger employees_touch before update on public.employees
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- tasks
-- ---------------------------------------------------------------------------
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null check (char_length(title) between 1 and 200),
  instruction text not null default '',
  employee_id uuid references public.employees (id) on delete set null,
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  due_at timestamptz,
  -- todo: 未着手 / running: 実行中 / pending_approval: 承認待ち
  -- ready: 承認済み・実行可 / done: 完了 / rejected: 却下(差し戻し)
  status text not null default 'todo'
    check (status in ('todo', 'running', 'pending_approval', 'ready', 'done', 'rejected')),
  approval_type text not null default 'none'
    check (approval_type in ('none', 'external_post', 'email_reply', 'invoice_issue', 'expense_confirm', 'code_deploy')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index tasks_owner_status_idx on public.tasks (owner_id, status);
create index tasks_owner_due_idx on public.tasks (owner_id, due_at);
create trigger tasks_touch before update on public.tasks
  for each row execute function public.touch_updated_at();

-- 承認を経ずに ready / rejected にしたり、承認必須タスクを done にしたりできないようにする
create or replace function public.guard_task_status()
returns trigger
language plpgsql
as $$
declare
  via_decision boolean := coalesce(current_setting('app.approval_decision', true), '') = 'owner';
begin
  if tg_op = 'INSERT' then
    if new.status <> 'todo' then
      raise exception 'new tasks must start as todo' using errcode = '42501';
    end if;
    return new;
  end if;
  if new.status is distinct from old.status then
    if new.status in ('ready', 'rejected') and not via_decision then
      raise exception 'task status "%" can only be set through decide_approval()', new.status
        using errcode = '42501';
    end if;
    if new.status = 'done' and old.approval_type <> 'none' and old.status <> 'ready' then
      raise exception 'approval is required before completing this task'
        using errcode = '42501';
    end if;
    if new.status = 'pending_approval' and old.approval_type = 'none' then
      raise exception 'this task does not require approval';
    end if;
  end if;
  -- 承認待ち・承認済みの間は承認種別を変更させない(承認のすり抜け防止)
  if new.approval_type is distinct from old.approval_type
     and old.status in ('pending_approval', 'ready') then
    raise exception 'approval_type cannot be changed while awaiting/after approval'
      using errcode = '42501';
  end if;
  return new;
end;
$$;
create trigger tasks_guard_status before insert or update on public.tasks
  for each row execute function public.guard_task_status();

-- ---------------------------------------------------------------------------
-- task_runs: 実行履歴(バージョン)
-- ---------------------------------------------------------------------------
create table public.task_runs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  version integer not null,
  output_md text not null default '',
  model text not null default '',
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  status text not null default 'running' check (status in ('running', 'succeeded', 'failed')),
  error text,
  revision_note text,
  created_at timestamptz not null default now(),
  finished_at timestamptz,
  unique (task_id, version)
);
create index task_runs_task_idx on public.task_runs (task_id, version desc);

-- ---------------------------------------------------------------------------
-- task_comments
-- ---------------------------------------------------------------------------
create table public.task_comments (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  task_run_id uuid references public.task_runs (id) on delete set null,
  body text not null check (char_length(body) between 1 and 10000),
  author text not null default 'owner' check (author in ('owner', 'system')),
  -- comment: 通常 / revision: 修正依頼 / rejection: 差し戻し理由
  kind text not null default 'comment' check (kind in ('comment', 'revision', 'rejection')),
  created_at timestamptz not null default now()
);
create index task_comments_task_idx on public.task_comments (task_id, created_at);

-- ---------------------------------------------------------------------------
-- approvals
-- ---------------------------------------------------------------------------
create table public.approvals (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  task_id uuid not null references public.tasks (id) on delete cascade,
  task_run_id uuid not null references public.task_runs (id) on delete cascade,
  type text not null
    check (type in ('external_post', 'email_reply', 'invoice_issue', 'expense_confirm', 'code_deploy')),
  -- superseded: 再実行により新しい版に置き換えられた
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected', 'superseded')),
  reason text not null default '',
  impact text not null default '',
  owner_comment text,
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index approvals_owner_status_idx on public.approvals (owner_id, status, created_at desc);
create unique index approvals_one_pending_per_task on public.approvals (task_id) where status = 'pending';

-- ---------------------------------------------------------------------------
-- audit_logs (追記のみ)
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  actor text not null,
  action text not null,
  target_type text not null,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index audit_logs_owner_idx on public.audit_logs (owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- ai_usage: Claude API 利用量(タスク実行以外の呼び出しも含む)
-- ---------------------------------------------------------------------------
create table public.ai_usage (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  source text not null check (source in ('task_run', 'assign', 'expense_suggest', 'invoice_draft')),
  model text not null,
  tokens_in integer not null default 0,
  tokens_out integer not null default 0,
  created_at timestamptz not null default now()
);
create index ai_usage_owner_idx on public.ai_usage (owner_id, created_at);

-- ---------------------------------------------------------------------------
-- 経理: sales / expenses / invoices (金額は円・整数)
-- ---------------------------------------------------------------------------
create table public.sales (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount_excl integer not null check (amount_excl >= 0),
  tax_rate numeric(4, 2) not null default 10 check (tax_rate >= 0 and tax_rate <= 100),
  tax_amount integer not null check (tax_amount >= 0),
  amount integer not null check (amount >= 0), -- 税込
  category text not null default '',
  client text not null default '',
  note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sales_owner_date_idx on public.sales (owner_id, date);
create trigger sales_touch before update on public.sales
  for each row execute function public.touch_updated_at();

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date date not null,
  amount_excl integer not null check (amount_excl >= 0),
  tax_rate numeric(4, 2) not null default 10 check (tax_rate >= 0 and tax_rate <= 100),
  tax_amount integer not null check (tax_amount >= 0),
  amount integer not null check (amount >= 0), -- 税込
  category text not null default '',
  vendor text not null default '',
  note text not null default '',
  ai_note text not null default '',
  status text not null default 'draft' check (status in ('draft', 'confirmed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index expenses_owner_date_idx on public.expenses (owner_id, date);
create trigger expenses_touch before update on public.expenses
  for each row execute function public.touch_updated_at();

create table public.invoices (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  number text not null,
  client text not null,
  issue_date date not null,
  due_date date,
  -- [{ "description": text, "quantity": number, "unit_price": int, "tax_rate": number }]
  items jsonb not null default '[]'::jsonb check (jsonb_typeof(items) = 'array'),
  subtotal integer not null default 0,
  tax integer not null default 0,
  total integer not null default 0,
  note text not null default '',
  status text not null default 'draft' check (status in ('draft', 'confirmed', 'paid')),
  paid_at date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (owner_id, number)
);
create index invoices_owner_due_idx on public.invoices (owner_id, status, due_date);
create trigger invoices_touch before update on public.invoices
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.settings enable row level security;
alter table public.employees enable row level security;
alter table public.tasks enable row level security;
alter table public.task_runs enable row level security;
alter table public.task_comments enable row level security;
alter table public.approvals enable row level security;
alter table public.audit_logs enable row level security;
alter table public.ai_usage enable row level security;
alter table public.sales enable row level security;
alter table public.expenses enable row level security;
alter table public.invoices enable row level security;

-- 標準: 自分のデータのみ全操作可
do $$
declare
  t text;
begin
  foreach t in array array['settings', 'employees', 'tasks', 'task_runs', 'task_comments', 'sales', 'expenses', 'invoices']
  loop
    execute format(
      'create policy %I on public.%I for all to authenticated using (owner_id = (select auth.uid())) with check (owner_id = (select auth.uid()))',
      t || '_owner_all', t
    );
  end loop;
end;
$$;

-- approvals: 参照と「pending での新規作成」のみ。更新・削除はポリシーなし(= 不可)
create policy approvals_owner_select on public.approvals
  for select to authenticated using (owner_id = (select auth.uid()));
create policy approvals_owner_insert_pending on public.approvals
  for insert to authenticated
  with check (
    owner_id = (select auth.uid())
    and status = 'pending'
    and decided_at is null
    and owner_comment is null
    and exists (select 1 from public.tasks t where t.id = task_id and t.owner_id = (select auth.uid()))
  );
revoke update, delete on public.approvals from authenticated, anon;

-- audit_logs: 参照と追記のみ
create policy audit_logs_owner_select on public.audit_logs
  for select to authenticated using (owner_id = (select auth.uid()));
create policy audit_logs_owner_insert on public.audit_logs
  for insert to authenticated with check (owner_id = (select auth.uid()));
revoke update, delete on public.audit_logs from authenticated, anon;

-- ai_usage: 参照と追記のみ
create policy ai_usage_owner_select on public.ai_usage
  for select to authenticated using (owner_id = (select auth.uid()));
create policy ai_usage_owner_insert on public.ai_usage
  for insert to authenticated with check (owner_id = (select auth.uid()));
revoke update, delete on public.ai_usage from authenticated, anon;

-- anon には何も渡さない
revoke all on all tables in schema public from anon;

-- ---------------------------------------------------------------------------
-- 承認の決定(オーナー操作専用)
-- アプリ側では「オーナー操作の Server Action」からのみ呼ぶ。AI実行経路のコードからは呼ばない。
-- ---------------------------------------------------------------------------
create or replace function public.decide_approval(p_approval_id uuid, p_decision text, p_comment text default null)
returns public.approvals
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  a public.approvals;
  trimmed text := nullif(btrim(coalesce(p_comment, '')), '');
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'invalid decision: %', p_decision;
  end if;
  if p_decision = 'rejected' and trimmed is null then
    raise exception '差し戻しにはコメントが必要です' using errcode = '23514';
  end if;

  select * into a from public.approvals where id = p_approval_id and owner_id = uid for update;
  if not found then
    raise exception 'approval not found' using errcode = 'P0002';
  end if;
  if a.status <> 'pending' then
    raise exception 'この承認は既に処理済みです(%)', a.status using errcode = '55000';
  end if;

  perform set_config('app.approval_decision', 'owner', true);

  update public.approvals
     set status = p_decision, owner_comment = trimmed, decided_at = now()
   where id = a.id
   returning * into a;

  update public.tasks
     set status = case when p_decision = 'approved' then 'ready' else 'rejected' end
   where id = a.task_id and owner_id = uid;

  if p_decision = 'rejected' then
    insert into public.task_comments (owner_id, task_id, task_run_id, body, author, kind)
    values (uid, a.task_id, a.task_run_id, trimmed, 'owner', 'rejection');
  end if;

  insert into public.audit_logs (owner_id, actor, action, target_type, target_id, detail)
  values (uid, 'owner', 'approval.' || p_decision, 'approval', a.id,
          jsonb_build_object('task_id', a.task_id, 'task_run_id', a.task_run_id, 'type', a.type, 'comment', trimmed));

  perform set_config('app.approval_decision', '', true);
  return a;
end;
$$;
revoke all on function public.decide_approval(uuid, text, text) from public, anon;
grant execute on function public.decide_approval(uuid, text, text) to authenticated;

-- 再実行時: 古い pending 承認を superseded にする(承認にはならない。pending → superseded のみ)
create or replace function public.supersede_pending_approvals(p_task_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  n integer;
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  update public.approvals
     set status = 'superseded', decided_at = now()
   where task_id = p_task_id and owner_id = uid and status = 'pending';
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.supersede_pending_approvals(uuid) from public, anon;
grant execute on function public.supersede_pending_approvals(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 初回ログイン時のセットアップ(設定行 + 8社員の seed)
-- ---------------------------------------------------------------------------
create or replace function public.bootstrap_owner()
returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;

  insert into public.settings (owner_id) values (uid) on conflict (owner_id) do nothing;

  insert into public.employees (owner_id, key, name, role, responsibilities, capabilities, prohibitions, system_prompt, sort_order)
  values
    (uid, 'president', '社長', '社長',
     '意思決定の補助、戦略立案、他社員への振り分け提案',
     '事業戦略・優先順位づけの提案 / 論点整理 / タスクを適切な社員に振り分ける提案',
     '最終意思決定をしない(オーナーが決める) / 数値の断定的な将来予測',
     'あなたは英語学習アプリ事業「CALLOUT」(esports×英語学習、XERO DIVISION)の運営会社の社長役のAI社員です。オーナーの意思決定を補助します。選択肢は2〜3案に絞り、それぞれのメリット・リスク・必要リソースを簡潔に示し、推奨案を1つ挙げてください。実行は担当社員に振り分ける前提で、誰に何を頼むべきかも書いてください。',
     10),
    (uid, 'secretary', '秘書', '秘書',
     '予定とタスクの管理、進捗まとめ',
     '進捗サマリー / 期限・優先度の整理 / 会議アジェンダや議事メモの作成',
     'オーナーの予定を勝手に確定しない / 外部への連絡を送らない',
     'あなたはCALLOUT運営会社の秘書役のAI社員です。タスクと予定を整理し、オーナーが一目で状況を把握できるようにまとめます。今日やるべきこと・期限が近いもの・止まっているものを明確に分け、箇条書きで簡潔に書いてください。',
     20),
    (uid, 'writer', 'ライター', 'ライター',
     '記事、SNS投稿の作成',
     'ブログ記事 / X・Instagram・TikTok向け投稿文 / キャッチコピー',
     '投稿・公開をしない(案として提出) / 誇大表現・効果の断定 / 未成年を煽る表現',
     'あなたはCALLOUT運営会社のライター役のAI社員です。esportsが好きな若いプレイヤーに向けて、「伝わる英語を鍛える」をトーンに、親しみやすく、でも誇張しない文章を書きます。媒体ごとの文字数制限を意識し、投稿案は複数パターン(2〜3案)を出してください。ハッシュタグ案も添えてください。',
     30),
    (uid, 'designer', 'デザイナー', 'デザイナー',
     'バナー、資料のデザイン案(HTML/SVG/指示書)',
     'バナーのSVG/HTMLモック / スライド構成案 / デザイン指示書(配色・フォント・レイアウト)',
     '第三者の商標・ゲーム公式素材の無断使用を前提にしない / 公開しない',
     'あなたはCALLOUT運営会社のデザイナー役のAI社員です。esportsらしい引き締まったダークトーンのブランドで、デザイン案を作ります。成果物は (1) 狙いとコンセプト (2) 配色・フォント・レイアウトの指示書 (3) 必要に応じてSVGまたはHTMLのモック(コードブロック) の順で出してください。画像素材の権利に注意し、要確認点を明記してください。',
     40),
    (uid, 'marketer', 'マーケター', 'マーケター',
     '分析、広告文の作成',
     '施策の分析・仮説 / 広告文・LP文言案 / KPI設計',
     '広告出稿・予算確定をしない / 根拠のない数値の断定',
     'あなたはCALLOUT運営会社のマーケター役のAI社員です。仮説・根拠・検証方法をセットで示し、施策を提案します。広告文は媒体ごとに複数案を出し、ターゲット(年齢層・ゲームタイトル・英語レベル)を明記してください。データがない部分は「仮定」と明示してください。',
     50),
    (uid, 'engineer', 'エンジニア', 'エンジニア',
     'コード生成、自動化',
     'コード・スクリプトの作成 / 自動化手順の設計 / 技術調査のまとめ',
     '本番環境へのデプロイ・設定変更を実行しない(手順として提出) / 秘密情報をコードに埋め込まない',
     'あなたはCALLOUT運営会社のエンジニア役のAI社員です。動作するコードを、前提・使い方・テスト方法とセットで提出します。本番環境への反映はオーナーの承認後に手動で行う前提で、反映手順とロールバック手順も書いてください。APIキーなどの秘密情報は環境変数で扱ってください。',
     60),
    (uid, 'accountant', '経理', '経理',
     '請求書、経費管理',
     '請求書明細の下書き / 経費の勘定科目(分類)候補 / 月次の収支サマリー',
     '支払い・振込をしない / 口座番号・カード番号を扱わない / 税務判断を断定しない',
     'あなたはCALLOUT運営会社の経理役のAI社員です。請求書や経費の下書きを作り、オーナーが確認して確定する前提で作業します。金額は日本円、税込/税抜と税率を明記してください。税務・会計上の判断が必要な点は断定せず「税理士など専門家に要確認」と添えてください。',
     70),
    (uid, 'customer', 'カスタマー', 'カスタマー',
     'FAQ、問い合わせ対応案',
     'FAQ作成 / 問い合わせへの返信文案 / よくある質問の分類',
     '返信を送信しない(案として提出) / 返金・補償を約束しない / 保護者・未成年の個人情報を記録しない',
     'あなたはCALLOUT運営会社のカスタマーサポート役のAI社員です。ユーザーには未成年も多いため、丁寧でわかりやすい言葉を使います。返信文案は「そのまま使える文面」と「オーナーが確認すべき点」に分けて提出してください。返金や規約判断が絡むものは要判断事項として挙げてください。',
     80)
  on conflict (owner_id, key) do nothing;
end;
$$;
grant execute on function public.bootstrap_owner() to authenticated;
