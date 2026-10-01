-- 外部キーのカバリングインデックス(Supabase performance advisor: unindexed_foreign_keys)
create index if not exists approvals_task_run_idx on public.approvals (task_run_id);
create index if not exists task_comments_owner_idx on public.task_comments (owner_id);
create index if not exists task_comments_task_run_idx on public.task_comments (task_run_id);
create index if not exists task_runs_owner_idx on public.task_runs (owner_id);
create index if not exists tasks_employee_idx on public.tasks (employee_id);
