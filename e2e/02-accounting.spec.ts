import { expect, test } from "@playwright/test";

test("経費登録(経理AIの分類提案→確定)→ダッシュボードに反映", async ({ page }) => {
  await page.goto("/accounting");
  await expect(page.getByTestId("kpi-expenses")).toContainText("￥0");

  await page.goto("/accounting/expenses/new");
  await page.getByLabel("金額(円)").fill("11000");
  await page.getByLabel("入力方式").selectOption("incl");
  await expect(page.getByTestId("tax-preview")).toContainText("税抜 ￥10,000");
  await page.getByLabel("支払先").fill("Google 広告");
  await page.getByLabel("メモ").fill("10月のプロモーション");
  await page.getByRole("button", { name: "🧾 経理に分類を提案させる" }).click();
  await expect(page.getByText("経理AIの提案: 広告宣伝費")).toBeVisible();
  await expect(page.getByLabel("勘定科目(分類)")).toHaveValue("広告宣伝費");
  await page.getByRole("button", { name: "確認して確定" }).click();

  await expect(page).toHaveURL(/\/accounting\/expenses\?month=/);
  await expect(page.getByTestId("expense-row").first()).toContainText("確定");

  await page.getByRole("link", { name: "ダッシュボード" }).click();
  await expect(page.getByTestId("kpi-expenses")).toContainText("￥10,000");
  await expect(page.getByTestId("kpi-profit")).toContainText("-￥10,000");
  await expect(page.getByText("経費カテゴリ別内訳")).toBeVisible();
  await expect(page.getByTestId("usage-card")).toContainText("tokens");
});

test("下書きの経費はダッシュボードに含まれない", async ({ page }) => {
  await page.goto("/accounting/expenses/new");
  await page.getByLabel("金額(円)").fill("5500");
  await page.getByLabel("支払先").fill("文具店");
  await page.getByRole("button", { name: "下書き保存" }).click();
  await expect(page).toHaveURL(/\/accounting\/expenses\?month=/);
  await page.goto("/accounting");
  await expect(page.getByText("未確定の経費(下書き)が 1 件")).toBeVisible();
  await expect(page.getByTestId("kpi-expenses")).toContainText("￥10,000");
});

test("請求書: 経理AIで明細下書き→保存→確定→印刷画面", async ({ page }) => {
  await page.goto("/accounting/invoices/new");
  await page.getByLabel("宛先(取引先名)").fill("株式会社テスト");
  await page.getByText("🧾 経理に明細の下書きを作らせる").click();
  await page.getByPlaceholder("例: 10月分のコーチング").fill("コーチング4回と教材制作");
  await page.getByRole("button", { name: "下書きを作成(明細を置き換え)" }).click();
  await expect(page.getByTestId("invoice-total")).toHaveText("￥55,000");
  await page.getByRole("button", { name: "下書きとして保存" }).click();
  await expect(page).toHaveURL(/\/accounting\/invoices\/[0-9a-f-]{36}$/);

  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "内容を確認して確定" }).click();
  await expect(page.getByRole("button", { name: "入金済みにする" })).toBeVisible();

  const id = page.url().split("/").pop();
  await page.goto(`/print/invoices/${id}`);
  await expect(page.getByRole("heading", { name: "請求書" })).toBeVisible();
  await expect(page.getByText("株式会社テスト 御中")).toBeVisible();

  await page.goto("/accounting");
  await expect(page.getByText("未入金の請求書")).toBeVisible();
  await expect(page.getByRole("link", { name: /株式会社テスト/ })).toBeVisible();

  const res = await page.request.get("/api/export?type=invoices");
  expect(res.headers()["content-type"]).toContain("text/csv");
  expect(await res.text()).toContain("株式会社テスト");
});
