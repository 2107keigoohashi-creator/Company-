import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "@/lib/types";

export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error || !data) throw new Error("設定が見つかりません。再ログインしてください。");
  return data as Settings;
}
