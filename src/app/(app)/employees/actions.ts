"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireOwner } from "@/lib/auth";
import { audit } from "@/lib/audit";

export type EmployeeState = { error?: string } | undefined;

const Schema = z.object({
  name: z.string().trim().min(1, "名前を入力してください").max(50),
  role: z.string().trim().min(1).max(50),
  responsibilities: z.string().trim().max(1000),
  capabilities: z.string().trim().max(2000),
  prohibitions: z.string().trim().max(2000),
  system_prompt: z.string().trim().max(8000),
  enabled: z.preprocess((v) => v === "on", z.boolean()),
});

export async function updateEmployee(id: string, _prev: EmployeeState, formData: FormData): Promise<EmployeeState> {
  const { supabase, user } = await requireOwner();
  const raw = Object.fromEntries(formData);
  const parsed = Schema.safeParse({ ...raw, enabled: raw.enabled ?? "off" });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "入力内容を確認してください" };
  const { error } = await supabase.from("employees").update(parsed.data).eq("id", id);
  if (error) return { error: error.message };
  await audit(supabase, user.id, {
    actor: "owner",
    action: "employee.updated",
    targetType: "employee",
    targetId: id,
    detail: { name: parsed.data.name, enabled: parsed.data.enabled },
  });
  revalidatePath("/employees");
  redirect("/employees");
}
