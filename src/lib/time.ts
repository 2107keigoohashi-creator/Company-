const TZ = "Asia/Tokyo";
const JST_OFFSET = 9 * 3600_000;

export function formatJst(iso: string | null | undefined, withTime = true) {
  if (!iso) return "";
  return new Date(iso).toLocaleString("ja-JP", {
    timeZone: TZ,
    month: "numeric",
    day: "numeric",
    weekday: "short",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });
}

/** ISO → <input type="datetime-local"> 用(JST) */
export function toJstInput(iso: string | null | undefined) {
  if (!iso) return "";
  return new Date(new Date(iso).getTime() + JST_OFFSET).toISOString().slice(0, 16);
}

/** <input type="datetime-local">(JST) → ISO */
export function fromJstInput(value: string | null | undefined) {
  if (!value) return null;
  const d = new Date(`${value}:00+09:00`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** JST の今日 0:00 / 明日 0:00 / 7日後 0:00 (Date) */
export function jstBoundaries(now = new Date()) {
  const jst = new Date(now.getTime() + JST_OFFSET);
  const today = Date.UTC(jst.getUTCFullYear(), jst.getUTCMonth(), jst.getUTCDate()) - JST_OFFSET;
  return {
    todayStart: new Date(today),
    tomorrowStart: new Date(today + 86400_000),
    weekEnd: new Date(today + 7 * 86400_000),
  };
}

export function isOverdue(dueAt: string | null, status: string, now = new Date()) {
  return !!dueAt && !["done", "ready"].includes(status) && new Date(dueAt) < now;
}
