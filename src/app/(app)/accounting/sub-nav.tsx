"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/accounting", label: "ダッシュボード" },
  { href: "/accounting/sales", label: "売上" },
  { href: "/accounting/expenses", label: "経費" },
  { href: "/accounting/invoices", label: "請求書" },
];

export function AccountingNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="経理メニュー" className="no-print -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 text-sm">
      {ITEMS.map((i) => {
        const active = i.href === "/accounting" ? pathname === i.href : pathname.startsWith(i.href);
        return (
          <Link
            key={i.href}
            href={i.href}
            className={`flex min-h-10 shrink-0 items-center rounded-full border px-4 font-semibold ${
              active ? "border-accent bg-accent/15 text-accent" : "border-line text-muted"
            }`}
          >
            {i.label}
          </Link>
        );
      })}
    </nav>
  );
}
