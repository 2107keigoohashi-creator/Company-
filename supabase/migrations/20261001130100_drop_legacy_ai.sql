-- 不要になった Claude API 関連の撤去(利用量テーブルと設定列)。いずれも未使用・空に近いデータのみ。
-- ※ DROP TABLE / DROP COLUMN は Supabase コネクタ経由だと確認待ちになるため、他の変更とは別ファイルにしてある。
drop table if exists public.ai_usage;
alter table public.settings
  drop column if exists claude_model,
  drop column if exists max_tokens_per_run,
  drop column if exists monthly_token_limit,
  drop column if exists stop_on_limit;
