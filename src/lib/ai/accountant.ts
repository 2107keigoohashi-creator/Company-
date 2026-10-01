import "server-only";
import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Employee, Settings } from "@/lib/types";
import { buildSystemPrompt } from "./prompts";
import { checkBudget, getSettings } from "./usage";

/** 経理社員を呼ぶ前の共通チェック。失敗時は NextResponse を返す。 */
export async function prepareAccountant(
  supabase: SupabaseClient,
): Promise<{ system: string; settings: Settings } | NextResponse> {
  const { data: accountant } = await supabase
    .from("employees")
    .select("*")
    .eq("key", "accountant")
    .single<Employee>();
  if (!accountant?.enabled) {
    return NextResponse.json({ error: "経理社員が無効化されています" }, { status: 400 });
  }
  const settings = await getSettings(supabase);
  const budgetError = await checkBudget(supabase, settings);
  if (budgetError) return NextResponse.json({ error: budgetError }, { status: 429 });
  return { system: buildSystemPrompt(accountant), settings };
}
