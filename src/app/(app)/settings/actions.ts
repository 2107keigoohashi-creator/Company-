"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type SettingsState = { error?: string; saved?: boolean } | undefined;

const Schema = z.object({
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
  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  const { error } = await supabase.from("settings").update(parsed.data).eq("owner_id", user.id);
  if (error) return { error: error.message };
  await audit(supabase, user.id, {
    actor: "owner",
    action: "settings.updated",
    targetType: "settings",
    detail: { company_name: parsed.data.company_name },
  });
  revalidatePath("/settings");
  return { saved: true };
}

export async function changePassword(_prev: SettingsState, formData: FormData): Promise<SettingsState> {
  const { supabase, user } = await requireOwner();
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  if (password.length < 12) return { error: "パスワードは12文字以上にしてください" };
  if (password !== confirm) return { error: "確認用パスワードが一致しません" };
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { error: `変更できませんでした: ${error.message}` };
  await audit(supabase, user.id, { actor: "owner", action: "auth.password_changed", targetType: "user" });
  return { saved: true };
}
