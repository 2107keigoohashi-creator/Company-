import { NextResponse } from "next/server";
import { getOwnerOrNull } from "@/lib/auth";
import { jsonCompletion } from "@/lib/ai/claude";
import { prepareAccountant } from "@/lib/ai/accountant";
import { recordUsage } from "@/lib/ai/usage";
import type { InvoiceItem } from "@/lib/types";

/** 経理社員による請求書明細の下書き(提案のみ。保存・確定はオーナー)。 */
export async function POST(request: Request) {
  const auth = await getOwnerOrNull();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user } = auth;
  const body = (await request.json().catch(() => ({}))) as { brief?: string; client?: string };
  const brief = String(body.brief ?? "").trim().slice(0, 3000);
  if (!brief) return NextResponse.json({ error: "請求内容のメモを入力してください" }, { status: 400 });

  const prep = await prepareAccountant(supabase);
  if (prep instanceof NextResponse) return prep;

  try {
    const r = await jsonCompletion<{ items: InvoiceItem[]; note: string }>({
      model: prep.settings.claude_model,
      maxTokens: 2048,
      system: prep.system,
      user: `次のメモから請求書の明細の下書きを作ってください。単価は税抜の円(整数)、税率は通常10、軽減税率対象のみ8。金額が不明な行は unit_price を 0 にして note で確認を促してください。\n宛先: ${body.client || "(未定)"}\nメモ:\n${brief}`,
      schema: {
        type: "object",
        properties: {
          items: {
            type: "array",
            items: {
              type: "object",
              properties: {
                description: { type: "string" },
                quantity: { type: "number" },
                unit_price: { type: "integer" },
                tax_rate: { type: "number", enum: [10, 8, 0] },
              },
              required: ["description", "quantity", "unit_price", "tax_rate"],
              additionalProperties: false,
            },
          },
          note: { type: "string" },
        },
        required: ["items", "note"],
        additionalProperties: false,
      },
      mock: () => ({
        items: [
          { description: "英語コーチングセッション(模擬)", quantity: 4, unit_price: 5000, tax_rate: 10 },
          { description: "教材制作費(模擬)", quantity: 1, unit_price: 30000, tax_rate: 10 },
        ],
        note: "(模擬)金額は仮です。確認してください。",
      }),
    });
    await recordUsage(supabase, user.id, "invoice_draft", r);
    const items = (r.data.items ?? []).slice(0, 100).map((i) => ({
      description: String(i.description).slice(0, 200),
      quantity: Number(i.quantity) > 0 ? Number(i.quantity) : 1,
      unit_price: Math.max(0, Math.round(Number(i.unit_price) || 0)),
      tax_rate: [10, 8, 0].includes(Number(i.tax_rate)) ? Number(i.tax_rate) : 10,
    }));
    return NextResponse.json({ items, note: r.data.note });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 502 });
  }
}
