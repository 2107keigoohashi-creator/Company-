import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Settings } from "@/lib/types";

/** JST 基準の今月 1 日 0:00 (UTC ISO) */
export function startOfMonthJstIso(now = new Date()) {
  const jst = new Date(now.getTime() + 9 * 3600_000);
  const start = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), 1) - 9 * 3600_000;
  return new Date(start).toISOString();
}

export async function monthlyUsage(supabase: SupabaseClient) {
  const { data, error } = await supabase
    .from("ai_usage")
    .select("model, tokens_in, tokens_out")
    .gte("created_at", startOfMonthJstIso());
  if (error) throw new Error(error.message);
  let tokensIn = 0;
  let tokensOut = 0;
  for (const r of data ?? []) {
    tokensIn += r.tokens_in;
    tokensOut += r.tokens_out;
  }
  return { tokensIn, tokensOut, total: tokensIn + tokensOut, rows: data ?? [] };
}

export async function getSettings(supabase: SupabaseClient): Promise<Settings> {
  const { data, error } = await supabase.from("settings").select("*").single();
  if (error || !data) throw new Error("設定が見つかりません。再ログインしてください。");
  return data as Settings;
}

/** 上限超過なら日本語のエラーメッセージ、問題なければ null */
export async function checkBudget(supabase: SupabaseClient, settings: Settings) {
  if (!settings.stop_on_limit) return null;
  const usage = await monthlyUsage(supabase);
  if (usage.total >= settings.monthly_token_limit) {
    return `今月の Claude 利用トークン上限(${settings.monthly_token_limit.toLocaleString()})に達したため実行を停止しています。設定で上限を変更できます。`;
  }
  return null;
}

export async function recordUsage(
  supabase: SupabaseClient,
  ownerId: string,
  source: "task_run" | "assign" | "expense_suggest" | "invoice_draft",
  r: { model: string; tokensIn: number; tokensOut: number },
) {
  const { error } = await supabase.from("ai_usage").insert({
    owner_id: ownerId,
    source,
    model: r.model,
    tokens_in: r.tokensIn,
    tokens_out: r.tokensOut,
  });
  if (error) console.error("recordUsage failed", error.message);
}
