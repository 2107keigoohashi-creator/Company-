import { NextResponse, type NextRequest } from "next/server";
import { getOwnerOrNull } from "@/lib/auth";
import { audit } from "@/lib/audit";
import { monthRange } from "@/lib/money";
import type { Expense, Invoice, Sale } from "@/lib/types";

function csvCell(v: unknown) {
  let s = v == null ? "" : String(v);
  // CSV インジェクション対策(表計算ソフトで数式として解釈されないように)
  if (/^[=+\-@\t\r]/.test(s) && !/^-?\d+(\.\d+)?$/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(header: string[], rows: unknown[][]) {
  // Excel で文字化けしないよう UTF-8 BOM を付ける
  return "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}

/** 会計ソフト取り込み用 CSV。type=sales|expenses|invoices, month=YYYY-MM(invoices は任意) */
export async function GET(request: NextRequest) {
  const auth = await getOwnerOrNull();
  if (!auth) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { supabase, user } = auth;
  const type = request.nextUrl.searchParams.get("type");
  const month = request.nextUrl.searchParams.get("month");
  const validMonth = month && /^\d{4}-\d{2}$/.test(month) ? month : null;

  let csv: string;
  if (type === "sales" || type === "expenses") {
    if (!validMonth) return NextResponse.json({ error: "month=YYYY-MM を指定してください" }, { status: 400 });
    const { start, end } = monthRange(validMonth);
    if (type === "sales") {
      const { data, error } = await supabase.from("sales").select("*").gte("date", start).lt("date", end).order("date").returns<Sale[]>();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      csv = toCsv(
        ["日付", "区分", "取引先", "税抜金額", "税率(%)", "消費税額", "税込金額", "メモ"],
        (data ?? []).map((r) => [r.date, r.category, r.client, r.amount_excl, r.tax_rate, r.tax_amount, r.amount, r.note]),
      );
    } else {
      const { data, error } = await supabase
        .from("expenses")
        .select("*")
        .eq("status", "confirmed")
        .gte("date", start)
        .lt("date", end)
        .order("date")
        .returns<Expense[]>();
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      csv = toCsv(
        ["日付", "勘定科目", "支払先", "税抜金額", "税率(%)", "消費税額", "税込金額", "メモ"],
        (data ?? []).map((r) => [r.date, r.category, r.vendor, r.amount_excl, r.tax_rate, r.tax_amount, r.amount, r.note]),
      );
    }
  } else if (type === "invoices") {
    let q = supabase.from("invoices").select("*").order("issue_date");
    if (validMonth) {
      const { start, end } = monthRange(validMonth);
      q = q.gte("issue_date", start).lt("issue_date", end);
    }
    const { data, error } = await q.returns<Invoice[]>();
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    csv = toCsv(
      ["請求書番号", "発行日", "支払期限", "取引先", "税抜合計", "消費税", "税込合計", "状態", "入金日"],
      (data ?? []).map((r) => [
        r.number,
        r.issue_date,
        r.due_date,
        r.client,
        r.subtotal,
        r.tax,
        r.total,
        { draft: "下書き", confirmed: "確定", paid: "入金済" }[r.status],
        r.paid_at,
      ]),
    );
  } else {
    return NextResponse.json({ error: "type は sales / expenses / invoices" }, { status: 400 });
  }

  await audit(supabase, user.id, {
    actor: "owner",
    action: "export.csv",
    targetType: type,
    detail: { month: validMonth },
  });
  const filename = `callout-${type}${validMonth ? `-${validMonth}` : ""}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
