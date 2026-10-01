-- 方針変更: 作業は Claude 側(claude.ai / Claude Code)で行い、アプリは進捗と経過を記録・管理するだけにする。
--  * アプリから Claude API を呼ばない(利用量・上限の仕組みを撤去)
--  * Claude は Supabase コネクタ経由で hq_* 関数を呼び、タスク登録・進捗報告・成果物提出を行う
--  * hq_* 関数は service 側(postgres / service_role)からのみ実行可。Web のログインユーザーからは呼べない
--  * 承認・差し戻しは従来どおり decide_approval()(オーナーのログイン必須)のみ。hq_* には承認を行う関数はない

-- ---------------------------------------------------------------------------
-- 1. Claude API 関連の撤去
-- ---------------------------------------------------------------------------
drop table if exists public.ai_usage;
alter table public.settings
  drop column if exists claude_model,
  drop column if exists max_tokens_per_run,
  drop column if exists monthly_token_limit,
  drop column if exists stop_on_limit;

-- ---------------------------------------------------------------------------
-- 2. 進捗の記録
-- ---------------------------------------------------------------------------
alter table public.tasks
  add column if not exists progress smallint not null default 0 check (progress between 0 and 100);

alter table public.task_comments drop constraint if exists task_comments_author_check;
alter table public.task_comments add constraint task_comments_author_check
  check (author in ('owner', 'claude', 'system'));
alter table public.task_comments drop constraint if exists task_comments_kind_check;
alter table public.task_comments add constraint task_comments_kind_check
  check (kind in ('comment', 'progress', 'revision', 'rejection'));

-- 成果物の提出元(model 列に残っている AI モデル名は意味を変える)
alter table public.task_runs alter column model set default '';
comment on column public.task_runs.model is '提出元("claude" / "owner")';

-- ---------------------------------------------------------------------------
-- 3. 成果物の提出(内部実装)。どのロールにも直接は公開しない。
-- ---------------------------------------------------------------------------
create or replace function public.hq_submit_result_impl(
  p_owner uuid, p_task_id uuid, p_output_md text, p_note text, p_actor text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  t public.tasks;
  v integer;
  rid uuid;
  next_status text;
  label record;
begin
  if coalesce(btrim(p_output_md), '') = '' then
    raise exception '成果物が空です' using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task_id and owner_id = p_owner for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if t.status in ('ready', 'done') then
    raise exception 'この課題は承認済み/完了です。新しい作業は別タスクとして登録してください(status=%)', t.status
      using errcode = '55000';
  end if;

  update public.approvals
     set status = 'superseded', decided_at = now()
   where task_id = t.id and owner_id = p_owner and status = 'pending';

  select coalesce(max(version), 0) + 1 into v from public.task_runs where task_id = t.id;
  insert into public.task_runs (owner_id, task_id, version, output_md, model, status, finished_at)
  values (p_owner, t.id, v, p_output_md, case when p_actor = 'owner' then 'owner' else 'claude' end, 'succeeded', now())
  returning id into rid;

  if t.approval_type <> 'none' then
    insert into public.approvals (owner_id, task_id, task_run_id, type, status, reason, impact)
    values (
      p_owner, t.id, rid, t.approval_type, 'pending',
      case t.approval_type
        when 'external_post' then '外部に公開される投稿・記事のため'
        when 'email_reply' then '顧客・外部へ送る文面のため'
        when 'invoice_issue' then '取引先へ金額を請求する書類のため'
        when 'expense_confirm' then '会社のお金が出ていく/帳簿に確定するため'
        when 'code_deploy' then '本番環境の動作が変わるため'
      end,
      case t.approval_type
        when 'external_post' then '公開後は不特定多数(未成年を含む)の目に触れ、取り消しが困難です'
        when 'email_reply' then '送信後は取り消せません。約束・回答内容が会社の公式見解になります'
        when 'invoice_issue' then '金額・宛先の誤りは信用と入金に影響します'
        when 'expense_confirm' then '支払い後は取り消しが困難で、会計記録に残ります'
        when 'code_deploy' then 'ユーザーに直接影響し、障害の可能性があります。ロールバック手順の確認を'
      end
    );
    next_status := 'pending_approval';
  else
    next_status := 'done';
  end if;

  update public.tasks set status = next_status, progress = 100 where id = t.id;

  if coalesce(btrim(p_note), '') <> '' then
    insert into public.task_comments (owner_id, task_id, task_run_id, body, author, kind)
    values (p_owner, t.id, rid, p_note, case when p_actor = 'owner' then 'owner' else 'claude' end, 'progress');
  end if;

  insert into public.audit_logs (owner_id, actor, action, target_type, target_id, detail)
  values (p_owner, p_actor,
          case when next_status = 'pending_approval' then 'task_run.submitted_for_approval' else 'task_run.submitted' end,
          'task_run', rid, jsonb_build_object('task_id', t.id, 'version', v));

  return jsonb_build_object('task_id', t.id, 'version', v, 'task_status', next_status);
end;
$$;
revoke all on function public.hq_submit_result_impl(uuid, uuid, text, text, text) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 4. オーナー(画面)からの成果物登録: 貼り付け用
-- ---------------------------------------------------------------------------
create or replace function public.submit_result_as_owner(p_task_id uuid, p_output_md text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated' using errcode = '42501';
  end if;
  return public.hq_submit_result_impl(auth.uid(), p_task_id, p_output_md, p_note, 'owner');
end;
$$;
revoke all on function public.submit_result_as_owner(uuid, text, text) from public, anon;
grant execute on function public.submit_result_as_owner(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. Claude 用 API(Supabase コネクタ / SQL から呼ぶ)。Web ユーザーからは呼べない。
-- ---------------------------------------------------------------------------
create or replace function public.hq_owner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select owner_id from public.settings order by updated_at limit 1
$$;
revoke all on function public.hq_owner_id() from public, anon, authenticated;

-- タスク登録
create or replace function public.hq_create_task(
  p_title text,
  p_instruction text default '',
  p_employee_key text default null,
  p_priority text default 'normal',
  p_due_at timestamptz default null,
  p_approval_type text default 'none'
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  o uuid := public.hq_owner_id();
  eid uuid;
  tid uuid;
begin
  if o is null then
    raise exception 'オーナーが未設定です。先にアプリへログインしてください' using errcode = '55000';
  end if;
  if p_employee_key is not null then
    select id into eid from public.employees where owner_id = o and key = p_employee_key;
    if eid is null then
      raise exception '社員キーが不正です: %(president/secretary/writer/designer/marketer/engineer/accountant/customer)', p_employee_key
        using errcode = '22023';
    end if;
  end if;
  insert into public.tasks (owner_id, title, instruction, employee_id, priority, due_at, approval_type)
  values (o, p_title, coalesce(p_instruction, ''), eid, p_priority, p_due_at, p_approval_type)
  returning id into tid;
  insert into public.audit_logs (owner_id, actor, action, target_type, target_id, detail)
  values (o, 'claude', 'task.created', 'task', tid, jsonb_build_object('title', p_title, 'approval_type', p_approval_type));
  return tid;
end;
$$;
revoke all on function public.hq_create_task(text, text, text, text, timestamptz, text) from public, anon, authenticated;

-- 進捗報告(状態は todo / running のみ指定可。承認・完了には変更できない)
create or replace function public.hq_log(
  p_task_id uuid,
  p_note text,
  p_progress integer default null,
  p_status text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  o uuid := public.hq_owner_id();
  t public.tasks;
begin
  if p_status is not null and p_status not in ('todo', 'running') then
    raise exception 'status は todo / running のみ指定できます(完了・承認は成果物の提出とオーナーの承認で行います)'
      using errcode = '22023';
  end if;
  select * into t from public.tasks where id = p_task_id and owner_id = o for update;
  if not found then
    raise exception 'task not found' using errcode = 'P0002';
  end if;
  if t.status in ('pending_approval', 'ready', 'done') then
    raise exception 'この課題は承認待ち/承認済み/完了のため、進捗は更新できません(status=%)', t.status
      using errcode = '55000';
  end if;
  update public.tasks
     set progress = coalesce(least(greatest(p_progress, 0), 100), progress),
         status = coalesce(p_status, status)
   where id = t.id;
  insert into public.task_comments (owner_id, task_id, body, author, kind)
  values (o, t.id, coalesce(nullif(btrim(p_note), ''), '(進捗を更新)'), 'claude', 'progress');
  insert into public.audit_logs (owner_id, actor, action, target_type, target_id, detail)
  values (o, 'claude', 'task.progress', 'task', t.id,
          jsonb_build_object('progress', p_progress, 'status', p_status));
end;
$$;
revoke all on function public.hq_log(uuid, text, integer, text) from public, anon, authenticated;

-- 成果物の提出。承認が必要なタスクは自動で「承認待ち」になる(承認はオーナーのみ)。
create or replace function public.hq_submit_result(p_task_id uuid, p_output_md text, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.hq_submit_result_impl(public.hq_owner_id(), p_task_id, p_output_md, p_note, 'claude');
end;
$$;
revoke all on function public.hq_submit_result(uuid, text, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 6. 承認はアプリ(PostgREST 経由のオーナーのログイン)からのみ
--    Supabase コネクタ等の SQL 接続(session_user = postgres)からは、JWT claims を偽装しても承認できない。
--    ※ 生の SQL 権限を持つ接続を完全に封じることはできない(README「承認の安全設計」参照)。
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
  if session_user <> 'authenticator' then
    raise exception '承認・差し戻しはアプリ(オーナーのログイン)からのみ実行できます' using errcode = '42501';
  end if;
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
