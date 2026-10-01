-- Supabase の既定権限では authenticated / anon に TRUNCATE が付与される。
-- TRUNCATE は RLS の対象外のため、追記のみのテーブル(approvals / audit_logs / ai_usage)を含め全テーブルで剥奪する。
revoke truncate on all tables in schema public from authenticated, anon;
alter default privileges in schema public revoke truncate on tables from authenticated, anon;
