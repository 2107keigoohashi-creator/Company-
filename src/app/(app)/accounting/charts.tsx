"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

// 検証済みパレット(dark, surface #121722): 売上=blue / 経費=orange / 粗利=aqua
const C = { sales: "#3987e5", expenses: "#d95926", profit: "#199e70" };
const AXIS = { fill: "#8b97ad", fontSize: 11 };
const GRID = "#263044";

const yenShort = (v: number) =>
  Math.abs(v) >= 10000 ? `${(v / 10000).toLocaleString("ja-JP", { maximumFractionDigits: 1 })}万` : v.toLocaleString("ja-JP");
const yenFull = (v: unknown) => `¥${Number(v).toLocaleString("ja-JP")}`;

const tooltipProps = {
  contentStyle: { background: "#1a2130", border: "1px solid #263044", borderRadius: 12, fontSize: 12, color: "#e8edf6" },
  labelStyle: { color: "#e8edf6", fontWeight: 700 },
  itemStyle: { color: "#e8edf6" },
  cursor: { fill: "rgba(139,151,173,0.12)" },
  formatter: (v: unknown) => yenFull(v),
};

export type TrendPoint = { month: string; sales: number; expenses: number; profit: number };

export function TrendChart({ data }: { data: TrendPoint[] }) {
  return (
    <div className="h-64" role="img" aria-label="月次推移: 売上・経費(棒)と粗利(線)、税抜">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -8 }} barGap={2}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
          <YAxis tickFormatter={yenShort} tick={AXIS} axisLine={false} tickLine={false} width={48} />
          <Tooltip {...tooltipProps} />
          <Legend wrapperStyle={{ fontSize: 12, color: "#c3c9d6" }} iconSize={10} />
          <Bar dataKey="sales" name="売上" fill={C.sales} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Bar dataKey="expenses" name="経費" fill={C.expenses} radius={[4, 4, 0, 0]} maxBarSize={18} />
          <Line
            dataKey="profit"
            name="粗利"
            stroke={C.profit}
            strokeWidth={2}
            dot={{ r: 4, fill: C.profit, stroke: "#121722", strokeWidth: 2 }}
            activeDot={{ r: 6 }}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function CategoryChart({ data }: { data: { category: string; amount: number }[] }) {
  const height = Math.max(120, data.length * 36 + 16);
  return (
    <div style={{ height }} role="img" aria-label="経費カテゴリ別内訳(税抜)">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 56, bottom: 0, left: 0 }}>
          <XAxis type="number" hide />
          <YAxis type="category" dataKey="category" tick={{ ...AXIS, fill: "#c3c9d6" }} width={84} axisLine={false} tickLine={false} />
          <Tooltip {...tooltipProps} />
          <Bar dataKey="amount" name="経費" fill={C.sales} radius={[0, 4, 4, 0]} barSize={18}>
            <LabelList dataKey="amount" position="right" formatter={(v: unknown) => yenShort(Number(v))} style={{ fill: "#e8edf6", fontSize: 11 }} />
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
