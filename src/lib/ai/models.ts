/** 選択可能な Claude モデルと料金(USD / 100万トークン、2026-09 時点の公開価格)。 */
export const MODELS = [
  { id: "claude-opus-5-5", label: "Claude Opus 5.5(高品質・既定)", input: 4, output: 20 },
  { id: "claude-sonnet-5-5", label: "Claude Sonnet 5.5(バランス)", input: 2, output: 10 },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5(低コスト)", input: 1, output: 5 },
] as const;

export const DEFAULT_MODEL = "claude-opus-5-5";

/** サーバー側フォールバック(fallbacks: "default")に対応するモデル */
export const SERVER_FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-sonnet-5-5"]);

export function estimateUsd(model: string, tokensIn: number, tokensOut: number) {
  const m = MODELS.find((x) => x.id === model) ?? MODELS[0];
  return (tokensIn * m.input + tokensOut * m.output) / 1_000_000;
}

/** 表示用の概算為替レート(円/USD)。README のコスト試算と揃える。 */
export const JPY_PER_USD = 150;
