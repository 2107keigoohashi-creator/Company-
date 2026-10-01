import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";

/** 監査ログ(追記のみ)。actor は "owner" / "ai:<employee key>" / "system" */
export async function audit(
  supabase: SupabaseClient,
  ownerId: string,
  entry: {
    actor: string;
    action: string;
    targetType: string;
    targetId?: string | null;
    detail?: Record<string, unknown>;
  },
) {
  const { error } = await supabase.from("audit_logs").insert({
    owner_id: ownerId,
    actor: entry.actor,
    action: entry.action,
    target_type: entry.targetType,
    target_id: entry.targetId ?? null,
    detail: entry.detail ?? {},
  });
  if (error) console.error("audit log failed", error.message);
}
