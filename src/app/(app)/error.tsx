"use client";

import { Button } from "@/components/ui";

export default function AppError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="space-y-4 py-10 text-center">
      <h2 className="text-lg font-bold">表示中にエラーが発生しました</h2>
      <p className="text-sm text-muted">{error.message || "時間をおいて再試行してください。"}</p>
      <Button onClick={reset}>再試行</Button>
    </div>
  );
}
