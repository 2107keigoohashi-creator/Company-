"use client";

import { useState } from "react";
import { Button } from "@/components/ui";

export function CopyBlock({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      window.prompt("コピーして貼り付けてください", text);
    }
  }
  return (
    <div className="space-y-2">
      <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded-xl border border-line bg-bg p-3 text-xs">{text}</pre>
      <Button type="button" onClick={copy} className="w-full">
        {copied ? "✓ コピーしました" : `📋 ${label}`}
      </Button>
    </div>
  );
}
