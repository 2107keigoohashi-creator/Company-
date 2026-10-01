"use client";

import { useActionState, useState } from "react";
import { Button, ErrorBox, inputClass } from "@/components/ui";
import { decideApproval, type DecideState } from "./actions";

export function DecisionForm({ approvalId }: { approvalId: string }) {
  const [mode, setMode] = useState<"idle" | "reject">("idle");
  const [approveState, approve, approving] = useActionState<DecideState, FormData>(
    decideApproval.bind(null, approvalId, "approved"),
    undefined,
  );
  const [rejectState, reject, rejecting] = useActionState<DecideState, FormData>(
    decideApproval.bind(null, approvalId, "rejected"),
    undefined,
  );
  const busy = approving || rejecting;

  return (
    <div className="space-y-2">
      <ErrorBox message={approveState?.error ?? rejectState?.error} />
      {mode === "idle" ? (
        <div className="grid grid-cols-2 gap-2">
          <Button variant="danger" onClick={() => setMode("reject")} disabled={busy}>
            ✕ 差し戻し
          </Button>
          <form
            action={approve}
            onSubmit={(e) => {
              if (!window.confirm("この成果物を承認しますか?(承認後も自動送信はされません)")) e.preventDefault();
            }}
          >
            <Button type="submit" variant="success" disabled={busy} className="w-full">
              ✓ 承認
            </Button>
          </form>
        </div>
      ) : (
        <form action={reject} className="space-y-2">
          <label className="block text-sm font-semibold text-rose-300" htmlFor={`c-${approvalId}`}>
            差し戻しコメント(必須)
          </label>
          <textarea
            id={`c-${approvalId}`}
            name="comment"
            required
            rows={3}
            className={inputClass}
            placeholder="何をどう直してほしいか"
          />
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="ghost" onClick={() => setMode("idle")} disabled={busy}>
              キャンセル
            </Button>
            <Button type="submit" variant="danger" disabled={busy}>
              差し戻す
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
