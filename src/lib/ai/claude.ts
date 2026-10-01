import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { SERVER_FALLBACK_MODELS } from "./models";

export interface CompletionResult {
  text: string;
  tokensIn: number;
  tokensOut: number;
  model: string;
  truncated: boolean;
}

export interface CompletionRequest {
  model: string;
  maxTokens: number;
  system: string;
  user: string;
}

export class AiError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
  }
}

export const isMock = () => process.env.AI_MOCK === "1";

let client: Anthropic | null = null;
function getClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new AiError("ANTHROPIC_API_KEY が設定されていません(.env を確認)", false);
  }
  client ??= new Anthropic();
  return client;
}

function fallbackParams(model: string) {
  return SERVER_FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const }
    : {};
}

function toAiError(err: unknown): AiError {
  if (err instanceof AiError) return err;
  if (err instanceof Anthropic.RateLimitError) {
    return new AiError("Claude API のレート制限に達しました。少し待って再実行してください。", true);
  }
  if (err instanceof Anthropic.AuthenticationError) {
    return new AiError("Claude API の認証に失敗しました(APIキーを確認)。", false);
  }
  if (err instanceof Anthropic.BadRequestError) {
    return new AiError(`Claude API がリクエストを拒否しました: ${err.message}`, false);
  }
  if (err instanceof Anthropic.APIConnectionError) {
    return new AiError("Claude API に接続できませんでした。再実行してください。", true);
  }
  if (err instanceof Anthropic.APIError) {
    return new AiError(`Claude API エラー (${err.status ?? "?"}): ${err.message}`, true);
  }
  return new AiError(err instanceof Error ? err.message : String(err), true);
}

/** ストリーミング生成。テキスト片ごとに onText を呼び、最終結果を返す。 */
export async function streamCompletion(
  req: CompletionRequest,
  onText: (chunk: string) => void,
): Promise<CompletionResult> {
  if (isMock()) return mockStream(req, onText);
  try {
    const stream = getClient().beta.messages.stream({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      ...fallbackParams(req.model),
    });
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        onText(event.delta.text);
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      throw new AiError("Claude がこの依頼への回答を辞退しました。指示内容を見直してください。", false);
    }
    const text = final.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("");
    return {
      text,
      tokensIn:
        final.usage.input_tokens +
        (final.usage.cache_creation_input_tokens ?? 0) +
        (final.usage.cache_read_input_tokens ?? 0),
      tokensOut: final.usage.output_tokens,
      model: final.model,
      truncated: final.stop_reason === "max_tokens",
    };
  } catch (err) {
    throw toAiError(err);
  }
}

/** JSON Schema で構造化出力を得る(非ストリーミング・短い応答用)。 */
export async function jsonCompletion<T>(
  req: CompletionRequest & { schema: Record<string, unknown>; mock: () => T },
): Promise<{ data: T; tokensIn: number; tokensOut: number; model: string }> {
  if (isMock()) {
    return { data: req.mock(), tokensIn: 120, tokensOut: 40, model: req.model };
  }
  try {
    const res = await getClient().beta.messages.create({
      model: req.model,
      max_tokens: req.maxTokens,
      system: req.system,
      messages: [{ role: "user", content: req.user }],
      output_config: { format: { type: "json_schema", schema: req.schema } },
      ...fallbackParams(req.model),
    });
    if (res.stop_reason === "refusal") {
      throw new AiError("Claude がこの依頼への回答を辞退しました。", false);
    }
    if (res.stop_reason === "max_tokens") {
      throw new AiError("応答が長すぎて途中で切れました。", true);
    }
    const text = res.content.map((b) => (b.type === "text" ? b.text : "")).join("");
    let data: T;
    try {
      data = JSON.parse(text) as T;
    } catch {
      throw new AiError("Claude の応答を解釈できませんでした。再実行してください。", true);
    }
    return {
      data,
      tokensIn: res.usage.input_tokens,
      tokensOut: res.usage.output_tokens,
      model: res.model,
    };
  } catch (err) {
    throw toAiError(err);
  }
}

// ---------------------------------------------------------------------------
// モック(AI_MOCK=1): E2E テストと API キー無しのデモ用
// ---------------------------------------------------------------------------
async function mockStream(
  req: CompletionRequest,
  onText: (chunk: string) => void,
): Promise<CompletionResult> {
  if (req.user.includes("[[MOCK_FAIL]]")) {
    await new Promise((r) => setTimeout(r, 200));
    throw new AiError("(模擬)Claude API エラー: 一時的に利用できません。", true);
  }
  const revision = /## オーナーからの修正依頼\n([\s\S]*?)(\n## |$)/.exec(req.user)?.[1]?.trim();
  const title = /タイトル: (.*)/.exec(req.user)?.[1] ?? "タスク";
  const text = [
    `# ${title}(模擬成果物)`,
    "",
    "これは AI_MOCK=1 のときに返される模擬応答です。",
    "",
    "## 成果物",
    "- 案1: 「伝わる英語」で、試合中のコールアウトを鍛えよう。",
    "- 案2: 一言で伝わる。それがチームを勝たせる英語。",
    ...(revision ? ["", "## 修正対応", `- 修正依頼「${revision}」を反映しました。`] : []),
    "",
    "## 要判断事項",
    "- 投稿時期をオーナーが決定してください。",
  ].join("\n");
  const chunks = text.match(/[\s\S]{1,12}/g) ?? [];
  for (const c of chunks) {
    onText(c);
    await new Promise((r) => setTimeout(r, 15));
  }
  return {
    text,
    tokensIn: Math.ceil((req.system.length + req.user.length) / 2),
    tokensOut: Math.ceil(text.length / 2),
    model: req.model,
    truncated: false,
  };
}
