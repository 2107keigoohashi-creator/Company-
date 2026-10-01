import Link from "next/link";
import { shiftMonth } from "@/lib/money";

export function MonthNav({ month, basePath }: { month: string; basePath: string }) {
  const [y, m] = month.split("-");
  return (
    <div className="mb-4 flex items-center justify-between rounded-xl border border-line bg-surface">
      <Link href={`${basePath}?month=${shiftMonth(month, -1)}`} className="flex h-11 w-14 items-center justify-center text-xl" aria-label="前月">
        ‹
      </Link>
      <span className="font-bold tabular-nums" data-testid="month-label">
        {y}年{Number(m)}月
      </span>
      <Link href={`${basePath}?month=${shiftMonth(month, 1)}`} className="flex h-11 w-14 items-center justify-center text-xl" aria-label="翌月">
        ›
      </Link>
    </div>
  );
}

export function resolveMonth(value: string | string[] | undefined, fallback: string) {
  return typeof value === "string" && /^\d{4}-\d{2}$/.test(value) ? value : fallback;
}
