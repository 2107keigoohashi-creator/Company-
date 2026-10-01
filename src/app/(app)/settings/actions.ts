"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { MODELS } from "@/lib/ai/models";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

const Schema = z.object({
  claude_model: z.enum(MODELS.map((m) => m.id) as [string, ...string[]]),
  max_tokens_per_run: z.coerce.number().int().min(256).max(64000),
  monthly_token_limit: z.coerce.number().int().min(0),
  stop_on_limit: z.preprocess((v) => v === "on", z.boolean()),
  company_name: z.string().trim().max(200),
  company_address: z.string().trim().max(500),
  invoice_registration_number: z
    .string()
    .trim()
    .regex(/^(T\d{13})?$/, "インボイス登録番号は「T + 13桁の数字」で入力してください(無い場合は空欄)"),
  invoice_note: z.string().trim().max(1000),
});

export async function saveSettings(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { supabase, user } = await requireOwner();
  const raw = Object.fromEntries(formData);
  const parsed = Schema.safeParse({ ...raw, stop_on_limit: raw.stop_on_limit ?? "off" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  const { error } = await supabase.from("settings").update(parsed.data).eq("owner_id", user.id);
  if (error) return { error: error.message };
  await audit(supabase, user.id, {
    actor: "owner",
    action: "settings.updated",
    targetType: "settings",
    detail: {
      claude_model: parsed.data.claude_model,
      max_tokens_per_run: parsed.data.max_tokens_per_run,
      monthly_token_limit: parsed.data.monthly_token_limit,
      stop_on_limit: parsed.data.stop_on_limit,
    },
  });
  revalidatePath("/settings");
  return { saved: true };
}
