-- task_comments に Claude の進捗を記録できるようにする(author に claude、kind に progress を追加)
alter table public.task_comments drop constraint if exists task_comments_author_check;
alter table public.task_comments add constraint task_comments_author_check
  check (author in ('owner', 'claude', 'system'));
alter table public.task_comments drop constraint if exists task_comments_kind_check;
alter table public.task_comments add constraint task_comments_kind_check
  check (kind in ('comment', 'progress', 'revision', 'rejection'));

