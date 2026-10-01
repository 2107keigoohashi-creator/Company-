import { NextResponse } from "next/server";
import { getOwnerOrNull } from "@/lib/auth";
import { jsonCompletion } from "@/lib/ai/claude";
import { prepareAccountant } from "@/lib/ai/accountant";
import { recordUsage } from "@/lib/ai/usage";
import { EXPENSE_CATEGORIES } from "@/lib/accounting";

/** 経理社員による経費の分類候補(提案のみ。確定はオーナー)。 */
export async function POST(request: Request) {
  const auth = await getOwnerOrNull();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user } = auth;
  const body = (await request.json().catch(() => ({}))) as { vendor?: string; note?: string; amount?: number };
  const vendor = String(body.vendor ?? "").slice(0, 200);
  const note = String(body.note ?? "").slice(0, 1000);
  if (!vendor && !note) return NextResponse.json({ error: "支払先かメモを入力してください" }, { status: 400 });

  const prep = await prepareAccountant(supabase);
  if (prep instanceof NextResponse) return prep;

  try {
    const r = await jsonCompletion<{ category: string; reason: string }>({
      model: prep.settings.claude_model,
      maxTokens: 1024,
      system: prep.system,
      user: `次の経費の勘定科目の候補を1つ選び、理由を1文で述べてください。判断が難しい場合は理由に「専門家に要確認」と添えてください。\n支払先: ${vendor || "(なし)"}\n金額: ${Number(body.amount) || "不明"}円\nメモ: ${note || "(なし)"}`,
      schema: {
        type: "object",
        properties: {
          category: { type: "string", enum: EXPENSE_CATEGORIES },
          reason: { type: "string" },
        },
        required: ["category", "reason"],
        additionalProperties: false,
      },
      mock: () => ({
        category: /広告|ads|プロモ/i.test(vendor + note) ? "広告宣伝費" : /サーバ|AWS|Vercel|通信|ドメイン/i.test(vendor + note) ? "通信費" : "消耗品費",
        reason: "(模擬)支払先とメモから推定しました。",
      }),
    });
    await recordUsage(supabase, user.id, "expense_suggest", r);
    return NextResponse.json(r.data);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
