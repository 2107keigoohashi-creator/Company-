"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth";

export type DecideState = { error?: string; done?: boolean } | undefined;

/**
 * 承認/差し戻し。オーナーのセッションでのみ実行でき(requireOwner)、
 * DB 側も decide_approval() 以外では承認状態を変更できない。
 * 監査ログは decide_approval() 内で同一トランザクションで記録される。
 */
export async function decideApproval(
  approvalId: string,
  decision: "approved" | "rejected",
  _prev: DecideState,
  formData: FormData,
): Promise<DecideState> {
  const { supabase } = await requireOwner();
  const comment = String(formData.get("comment") ?? "").trim();
  if (decision === "rejected" && !comment) {
    return { error: "差し戻しにはコメントが必要です" };
  }
  const { error } = await supabase.rpc("decide_approval", {
    p_approval_id: approvalId,
    p_decision: decision,
    p_comment: comment || null,
  });
  if (error) return { error: error.message };
  revalidatePath("/approvals");
  revalidatePath("/tasks");
  return { done: true };
}
