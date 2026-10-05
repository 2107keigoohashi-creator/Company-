import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export const btn = {
  base: "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none",
  primary: "bg-accent text-black hover:bg-accent-strong",
  secondary: "bg-surface-2 text-fg border border-line hover:border-accent/60",
  danger: "bg-rose-600 text-white hover:bg-rose-500",
  success: "bg-emerald-500 text-black hover:bg-emerald-400",
  ghost: "text-muted hover:text-fg",
};

export function buttonClass(variant: keyof typeof btn = "primary", extra = "") {
  return `${btn.base} ${btn[variant]} ${extra}`;
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<"button"> & { variant?: Exclude<keyof typeof btn, "base"> }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function LinkButton({
  variant = "primary",
  className = "",
  ...props
}: ComponentProps<typeof Link> & { variant?: Exclude<keyof typeof btn, "base"> }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className = "", ...props }: ComponentProps<"div">) {
  return <div className={`rounded-2xl border border-line bg-surface p-4 ${className}`} {...props} />;
}

export function Badge({ className = "", children }: { className?: string; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-bold ${className}`}>
      {children}
    </span>
  );
}

/**
 * 画面上部の固定ヘッダー。帯は画面いっぱいに広げ、中身は本文の幅にそろえる。
 * (本文より広いオフィスビューでも、スクロールしたときに帯が途中で切れて重ならない)
 */
export function PageHeader({
  title,
  back,
  action,
  wide = false,
}: {
  title: string;
  back?: string;
  action?: ReactNode;
  wide?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 mb-4 ml-[calc(50%-50vw)] w-screen border-b border-line bg-bg/95 pt-[env(safe-area-inset-top)] backdrop-blur">
      <div className={`mx-auto flex min-h-14 items-center gap-2 px-4 ${wide ? "max-w-[74rem]" : "max-w-xl"}`}>
        {back && (
          <Link href={back} aria-label="戻る" className="-ml-2 flex h-11 w-11 items-center justify-center text-xl text-muted">
            ‹
          </Link>
        )}
        <h1 className="flex-1 truncate text-lg font-bold tracking-wide">{title}</h1>
        {action}
      </div>
    </header>
  );
}

export const inputClass =
  "w-full min-h-11 rounded-xl border border-line bg-surface-2 px-3 py-2 text-base text-fg placeholder:text-muted/60 focus:border-accent focus:outline-none";

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block space-y-1">
      <span className="text-sm font-semibold text-muted">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted/80">{hint}</span>}
    </label>
  );
}

export function ErrorBox({ message }: { message?: string | null }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-xl border border-rose-500/50 bg-rose-950/60 p-3 text-sm text-rose-200">
      ⚠️ {message}
    </p>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-xl border border-dashed border-line p-6 text-center text-sm text-muted">{children}</p>;
}

export function ProgressBar({ value, className = "" }: { value: number; className?: string }) {
  return (
    <div
      className={`h-2 overflow-hidden rounded-full bg-surface-2 ${className}`}
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label="進捗"
    >
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${value}%` }} />
    </div>
  );
}
