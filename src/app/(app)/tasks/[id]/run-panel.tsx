"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import type { TaskRun, TaskStatus } from "@/lib/types";

const RESULT_SEPARATOR = "\u0000";

type RunResult =
  | { status: "succeeded"; taskStatus: TaskStatus; version: number }
  | { status: "failed"; error: string; retryable: boolean; version: number };

export function RunPanel({
  taskId,
  taskStatus,
  latestRun,
  hasEmployee,
}: {
  taskId: string;
  taskStatus: TaskStatus;
  latestRun: Pick<TaskRun, "version" | "status" | "output_md" | "error"> | null;
  hasEmployee: boolean;
}) {
  const router = useRouter();
  const [streaming, setStreaming] = useState(false);
  const [output, setOutput] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState("");
  const [showRevision, setShowRevision] = useState(false);

  const serverRunning = taskStatus === "running" && latestRun?.status === "running";
  const lastFailed = latestRun?.status === "failed";
  const hasSucceeded = latestRun?.status === "succeeded";
  const rejected = taskStatus === "rejected";

  async function run(revisionNote?: string) {
    setStreaming(true);
    setError(null);
    setOutput("");
    try {
      const res = await fetch(`/api/tasks/${taskId}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ revisionNote }),
      });
      if (!res.ok || !res.body) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? `実行できませんでした (${res.status})`);
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const sep = buffer.indexOf(RESULT_SEPARATOR);
        setOutput(sep >= 0 ? buffer.slice(0, sep) : buffer);
      }
      const sep = buffer.indexOf(RESULT_SEPARATOR);
      if (sep < 0) throw new Error("通信が途中で切れました。画面を更新して結果を確認してください。");
      const result = JSON.parse(buffer.slice(sep + 1)) as RunResult;
      if (result.status === "failed") setError(result.error);
      else {
        setRevision("");
        setShowRevision(false);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setStreaming(false);
      router.refresh();
    }
  }

  return (
    <section className="space-y-3" aria-label="実行">
      {!hasEmployee && <ErrorBox message="担当社員を設定すると実行できます" />}
      {serverRunning && !streaming && (
        <p className="rounded-xl bg-sky-950/60 p-3 text-sm text-sky-200">
          実行中です… しばらくしてから画面を更新してください。
        </p>
      )}

      {(streaming || output) && (
        <div className="rounded-2xl border border-sky-600/60 bg-surface p-4" data-testid="stream-output">
          <p className="mb-2 text-xs font-bold text-sky-300">
            {streaming ? "● 生成中(ストリーミング)…" : "生成結果"}
          </p>
          <div className="md text-sm">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{output ?? ""}</ReactMarkdown>
          </div>
        </div>
      )}

      {error && (
        <div className="space-y-2">
          <ErrorBox message={`実行に失敗しました: ${error}`} />
        </div>
      )}
      {!error && lastFailed && !streaming && !output && (
        <ErrorBox message={`実行に失敗しました(v${latestRun?.version}): ${latestRun?.error ?? "不明なエラー"}`} />
      )}

      <div className="grid gap-2">
        {!hasSucceeded || lastFailed || error || rejected ? (
          <Button
            onClick={() => run()}
            disabled={streaming || serverRunning || !hasEmployee}
            data-testid="run-button"
          >
            {streaming
              ? "実行中…"
              : rejected && !lastFailed && !error
                ? "↻ 差し戻しを反映して再実行"
                : latestRun
                  ? "↻ 再実行"
                  : "▶ AI社員に実行させる"}
          </Button>
        ) : null}

        {hasSucceeded && !streaming && (
          <>
            {!showRevision ? (
              <Button variant="secondary" onClick={() => setShowRevision(true)} disabled={serverRunning}>
                ✎ 修正依頼して再実行
              </Button>
            ) : (
              <form
                className="space-y-2 rounded-2xl border border-line bg-surface p-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (revision.trim()) run(revision.trim());
                }}
              >
                <label className="block text-sm font-semibold text-muted" htmlFor="revision">
                  修正依頼(新しいバージョンとして再実行されます)
                </label>
                <textarea
                  id="revision"
                  name="revision"
                  rows={3}
                  required
                  value={revision}
                  onChange={(e) => setRevision(e.target.value)}
                  className={inputClass}
                  placeholder="例: もっとカジュアルに。絵文字を1つ入れて"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Button type="button" variant="ghost" onClick={() => setShowRevision(false)}>
                    キャンセル
                  </Button>
                  <Button type="submit" disabled={!revision.trim()}>
                    修正依頼を送る
                  </Button>
                </div>
              </form>
            )}
          </>
        )}
      </div>
    </section>
  );
}
