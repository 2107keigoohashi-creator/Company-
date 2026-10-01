"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="no-print fixed bottom-6 right-6 min-h-12 rounded-full bg-cyan-500 px-6 font-bold text-black shadow-lg"
    >
      PDF で保存 / 印刷
    </button>
  );
}
