import { NextResponse } from "next/server";
import { getOwnerOrNull } from "@/lib/auth";
import { jsonCompletion } from "@/lib/ai/claude";
import { buildSystemPrompt } from "@/lib/ai/prompts";
import { checkBudget, getSettings, recordUsage } from "@/lib/ai/usage";
import type { Employee } from "@/lib/types";

/** 「社長におまかせ」: 社長AIが担当社員を提案する(提案のみ。決定はオーナー)。 */
export async function POST(request: Request) {
  const auth = await getOwnerOrNull();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user } = auth;

  const body = (await request.json().catch(() => ({}))) as { title?: string; instruction?: string };
  const title = (body.title ?? "").trim();
  const instruction = (body.instruction ?? "").trim();
  if (!title && !instruction) {
    return NextResponse.json({ error: "タイトルか指示を入力してください" }, { status: 400 });
  }

  const { data: employees } = await supabase
    .from("employees")
    .select("*")
    .eq("enabled", true)
    .order("sort_order")
    .returns<Employee[]>();
  const president = employees?.find((e) => e.key === "president");
  if (!employees?.length || !president) {
    return NextResponse.json({ error: "社長が無効化されています" }, { status: 400 });
  }

  const settings = await getSettings(supabase);
  const budgetError = await checkBudget(supabase, settings);
  if (budgetError) return NextResponse.json({ error: budgetError }, { status: 429 });

  const keys = employees.map((e) => e.key);
  const roster = employees.map((e) => `- ${e.key}: ${e.name} … ${e.responsibilities}`).join("\n");

  try {
    const r = await jsonCompletion<{ employee_key: string; reason: string }>({
      model: settings.claude_model,
      maxTokens: 1024,
      system: buildSystemPrompt(president),
      user: `次のタスクを担当させるのに最適な社員を1人選び、理由を1〜2文で述べてください。\n\n## 社員一覧\n${roster}\n\n## タスク\nタイトル: ${title}\n指示: ${instruction || "(なし)"}`,
      schema: {
        type: "object",
        properties: {
          employee_key: { type: "string", enum: keys },
          reason: { type: "string" },
        },
        required: ["employee_key", "reason"],
        additionalProperties: false,
      },
      mock: () => {
        const text = `${title} ${instruction}`;
        const guess =
          [
            ["writer", /投稿|記事|SNS|ブログ|文章/],
            ["accountant", /請求|経費|会計|売上/],
            ["customer", /問い合わせ|FAQ|返信/],
            ["engineer", /コード|自動化|バグ|デプロイ/],
            ["designer", /バナー|デザイン|資料/],
            ["marketer", /広告|分析|集客/],
            ["secretary", /予定|進捗|まとめ/],
          ].find(([, re]) => (re as RegExp).test(text))?.[0] ?? "president";
        return { employee_key: guess as string, reason: "(模擬)内容から判断しました。" };
      },
    });
    await recordUsage(supabase, user.id, "assign", r);
    const picked = employees.find((e) => e.key === r.data.employee_key);
    if (!picked) return NextResponse.json({ error: "提案を解釈できませんでした" }, { status: 502 });
    return NextResponse.json({ employeeId: picked.id, name: picked.name, reason: r.data.reason });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : String(err) },
      { status: 502 },
    );
  }
}
