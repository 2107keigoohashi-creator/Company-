/** 金額ユーティリティ(円・整数)。端数は切り捨て。 */

export type TaxMode = "excl" | "incl";

export function splitTax(input: number, taxRate: number, mode: TaxMode) {
  const rate = taxRate / 100;
  if (mode === "excl") {
    const amount_excl = Math.round(input);
    const tax_amount = Math.floor(amount_excl * rate);
    return { amount_excl, tax_amount, amount: amount_excl + tax_amount };
  }
  const amount = Math.round(input);
  const amount_excl = Math.ceil(amount / (1 + rate));
  return { amount_excl, tax_amount: amount - amount_excl, amount };
}

/** 請求書: 税率ごとに税抜合計 → 税額を計算(インボイス方式: 税率ごとに1回端数処理) */
export function invoiceTotals(items: { quantity: number; unit_price: number; tax_rate: number }[]) {
  const byRate = new Map<number, number>();
  for (const it of items) {
    const line = Math.round(it.quantity * it.unit_price);
    byRate.set(it.tax_rate, (byRate.get(it.tax_rate) ?? 0) + line);
  }
  let subtotal = 0;
  let tax = 0;
  const breakdown: { rate: number; base: number; tax: number }[] = [];
  for (const [rate, base] of [...byRate.entries()].sort((a, b) => b[0] - a[0])) {
    const t = Math.floor((base * rate) / 100);
    subtotal += base;
    tax += t;
    breakdown.push({ rate, base, tax: t });
  }
  return { subtotal, tax, total: subtotal + tax, breakdown };
}

const yenFmt = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY" });
export function yen(n: number | null | undefined) {
  return yenFmt.format(n ?? 0);
}

/** JST の YYYY-MM-DD */
export function todayJst(): string {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10);
}

/** "YYYY-MM" から月初・翌月初の日付文字列 */
export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const start = `${y}-${String(m).padStart(2, "0")}-01`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  const end = `${ny}-${String(nm).padStart(2, "0")}-01`;
  return { start, end };
}

export function shiftMonth(ym: string, delta: number) {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
