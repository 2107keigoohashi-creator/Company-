export const SALES_CATEGORIES = ["アプリ課金", "サブスクリプション", "スポンサー・協賛", "受託・制作", "イベント", "その他"];

export const EXPENSE_CATEGORIES = [
  "広告宣伝費",
  "外注費",
  "通信費",
  "支払手数料",
  "消耗品費",
  "旅費交通費",
  "会議費",
  "接待交際費",
  "地代家賃",
  "水道光熱費",
  "新聞図書費",
  "研修費",
  "雑費",
];

export const TAX_RATES = [10, 8, 0];

export const INVOICE_STATUS = {
  draft: { label: "下書き", className: "bg-slate-700 text-slate-100" },
  confirmed: { label: "確定・未入金", className: "bg-amber-400 text-black" },
  paid: { label: "入金済", className: "bg-emerald-600 text-white" },
} as const;

export const EXPENSE_STATUS = {
  draft: { label: "下書き", className: "bg-slate-700 text-slate-100" },
  confirmed: { label: "確定", className: "bg-emerald-700 text-white" },
} as const;
