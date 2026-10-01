import { estimateUsd, JPY_PER_USD } from "@/lib/ai/models";
import type { Settings } from "@/lib/types";
import { Card } from "./ui";

export function UsageCard({
  usage,
  settings,
}: {
  usage: { tokensIn: number; tokensOut: number; total: number; rows: { model: string; tokens_in: number; tokens_out: number }[] };
  settings: Settings;
}) {
  const usd = usage.rows.reduce((s, r) => s + estimateUsd(r.model, r.tokens_in, r.tokens_out), 0);
  const ratio = settings.monthly_token_limit > 0 ? Math.min(1, usage.total / settings.monthly_token_limit) : 1;
  const over = usage.total >= settings.monthly_token_limit;
  return (
    <Card className="space-y-2" data-testid="usage-card">
      <div className="flex items-baseline justify-between">
        <h2 className="text-sm font-bold text-muted">今月の Claude 利用量</h2>
        <span className="text-xs text-muted">{settings.claude_model}</span>
      </div>
      <p className="text-2xl font-black tabular-nums">
        {usage.total.toLocaleString()}
        <span className="text-sm font-normal text-muted"> / {settings.monthly_token_limit.toLocaleString()} tokens</span>
      </p>
      <div className="h-2 overflow-hidden rounded-full bg-surface-2" role="progressbar" aria-valuenow={Math.round(ratio * 100)} aria-valuemin={0} aria-valuemax={100}>
        <div
          className={`h-full ${over ? "bg-rose-500" : ratio > 0.8 ? "bg-amber-400" : "bg-accent"}`}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
      <p className="text-xs text-muted">
        入力 {usage.tokensIn.toLocaleString()} ・出力 {usage.tokensOut.toLocaleString()} ・概算 ${usd.toFixed(2)}(約
        {Math.round(usd * JPY_PER_USD).toLocaleString()}円)
      </p>
      {over && (
        <p className="text-xs font-bold text-rose-300">
          {settings.stop_on_limit ? "⛔ 上限に達したため AI 実行を停止中" : "⚠ 上限超過(停止設定はオフ)"}
        </p>
      )}
    </Card>
  );
}
