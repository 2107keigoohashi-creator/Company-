"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/tasks", label: "タスク", icon: "▦" },
  { href: "/approvals", label: "承認", icon: "✓" },
  { href: "/accounting", label: "経理", icon: "¥" },
  { href: "/employees", label: "社員", icon: "◉" },
  { href: "/settings", label: "設定", icon: "⚙" },
];

export function BottomNav({ pendingApprovals }: { pendingApprovals: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="メインメニュー"
      className="no-print safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur"
    >
      <ul className="mx-auto grid max-w-xl grid-cols-5">
        {TABS.map((t) => {
          const active = pathname === t.href || pathname.startsWith(t.href + "/");
          return (
            <li key={t.href}>
              <Link
                href={t.href}
                aria-current={active ? "page" : undefined}
                className={`relative flex min-h-16 flex-col items-center justify-center gap-0.5 text-xs font-semibold ${
                  active ? "text-accent" : "text-muted"
                }`}
              >
                <span aria-hidden className="text-xl leading-none">
                  {t.icon}
                </span>
                {t.label}
                {t.href === "/approvals" && pendingApprovals > 0 && (
                  <span
                    className="absolute right-[22%] top-2 min-w-5 rounded-full bg-amber-400 px-1 text-center text-[11px] font-black text-black"
                    aria-label={`承認待ち ${pendingApprovals} 件`}
                  >
                    {pendingApprovals}
                  </span>
                )}
                {active && <span className="absolute inset-x-6 top-0 h-0.5 rounded bg-accent" />}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
