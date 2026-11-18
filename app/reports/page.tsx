"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product, Customer, PAYMENT_METHODS } from "@/lib/types";
import { brand } from "@/lib/brand";
import PaymentMethodIcon from "@/components/PaymentMethodIcon";
import PageHeader from "@/components/PageHeader";
import OwnerGate from "@/components/OwnerGate";

type RangeKey = "today" | "week" | "month" | "custom";

interface MethodRow {
  sales: number; // مدفوع من فواتير البيع
  collections: number; // تحصيل ديون عملاء
  refunds: number; // مرتجعات اترّدت فلوس
  suppliers: number; // سداد موردين
}
const emptyMethodRow = (): MethodRow => ({ sales: 0, collections: 0, refunds: 0, suppliers: 0 });
const methodKey = (m: string | null | undefined) => (m === "cash" || m === "instapay" || m === "wallet" ? m : "unknown");

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

function ReportsPageContent() {
  const [range, setRange] = useState<RangeKey>("today");
  const [customStart, setCustomStart] = useState("");
  const [customEnd, setCustomEnd] = useState("");
  const [loading, setLoading] = useState(true);

  const [salesTotal, setSalesTotal] = useState(0);
  const [invoiceCount, setInvoiceCount] = useState(0);
  const [grossProfit, setGrossProfit] = useState(0);
  const [expensesTotal, setExpensesTotal] = useState(0);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [methodRows, setMethodRows] = useState<Record<string, MethodRow> | null>(null);

  const { startISO, endISO } = useMemo(() => {
    const now = new Date();
    let start: Date;
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (range === "today") {
      start = new Date(now);
      start.setHours(0, 0, 0, 0);
    } else if (range === "week") {
      start = new Date(now);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
    } else if (range === "month") {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      start = customStart ? new Date(customStart) : new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
      if (customEnd) {
        end = new Date(customEnd);
        end.setHours(23, 59, 59, 999);
      }
    }

    return { startISO: start.toISOString(), endISO: end.toISOString() };
  }, [range, customStart, customEnd]);

  useEffect(() => {
    loadReports();
    loadStatic();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO]);

  async function loadStatic() {
    const [{ data: prods }, { data: custs }] = await Promise.all([
      supabase.from("products").select("*").eq("is_active", true),
      supabase.from("customers").select("*").gt("current_debt", 0).order("current_debt", { ascending: false }),
    ]);
    setProducts((prods ?? []) as Product[]);
    setCustomers((custs ?? []) as Customer[]);
  }

  async function loadReports() {
    setLoading(true);

    const [{ data: sales }, { data: expenses }, { data: saleItems }, { data: returnsData }] = await Promise.all([
      supabase
        .from("sales")
        .select("total, profit")
        .eq("status", "completed")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
      supabase
        .from("expenses")
        .select("amount")
        .gte("expense_date", startISO.slice(0, 10))
        .lte("expense_date", endISO.slice(0, 10)),
      supabase
        .from("sale_items")
        .select("product_name_snapshot, quantity, line_total, sales!inner(status, created_at)")
        .eq("sales.status", "completed")
        .gte("sales.created_at", startISO)
        .lte("sales.created_at", endISO),
      supabase
        .from("sale_returns")
        .select("net_value, profit_reversed, sales!inner(status)")
        .eq("sales.status", "completed")
        .gte("created_at", startISO)
        .lte("created_at", endISO),
    ]);

    // المرتجعات بتتخصم من المبيعات والربح في الفترة
    const retRows = (returnsData ?? []) as any[];
    const returnsNet = retRows.reduce((sum, r) => sum + Number(r.net_value), 0);
    const returnsProfit = retRows.reduce((sum, r) => sum + Number(r.profit_reversed), 0);

    const salesRows = sales ?? [];
    setSalesTotal(salesRows.reduce((sum: number, s: any) => sum + Number(s.total), 0) - returnsNet);
    setInvoiceCount(salesRows.length);
    setGrossProfit(salesRows.reduce((sum: number, s: any) => sum + Number(s.profit), 0) - returnsProfit);
    setExpensesTotal((expenses ?? []).reduce((sum: number, e: any) => sum + Number(e.amount), 0));

    const grouped = new Map<string, TopProduct>();
    for (const row of (saleItems ?? []) as any[]) {
      const key = row.product_name_snapshot;
      const existing = grouped.get(key) ?? { name: key, quantity: 0, revenue: 0 };
      existing.quantity += Number(row.quantity);
      existing.revenue += Number(row.line_total);
      grouped.set(key, existing);
    }
    setTopProducts(Array.from(grouped.values()).sort((a, b) => b.quantity - a.quantity).slice(0, 5));

    // حركة الفلوس حسب طريقة الدفع (البراندات الجديدة بس: الأعمدة مش موجودة في legacy)
    if (brand.mode === "v2") {
      const [{ data: mSales }, { data: mPays }, { data: mRets }] = await Promise.all([
        supabase
          .from("sales")
          .select("paid_amount, payment_method")
          .eq("status", "completed")
          .gt("paid_amount", 0)
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("payments")
          .select("amount, payment_method, supplier_id")
          .eq("status", "active")
          .gte("created_at", startISO)
          .lte("created_at", endISO),
        supabase
          .from("sale_returns")
          .select("refund_amount, refund_method")
          .gt("refund_amount", 0)
          .gte("created_at", startISO)
          .lte("created_at", endISO),
      ]);
      const rows: Record<string, MethodRow> = {};
      const row = (m: string | null | undefined) => (rows[methodKey(m)] ??= emptyMethodRow());
      for (const s of (mSales ?? []) as any[]) row(s.payment_method).sales += Number(s.paid_amount);
      for (const p of (mPays ?? []) as any[]) {
        if (p.supplier_id) row(p.payment_method).suppliers += Number(p.amount);
        else row(p.payment_method).collections += Number(p.amount);
      }
      for (const x of (mRets ?? []) as any[]) row(x.refund_method).refunds += Number(x.refund_amount);
      setMethodRows(rows);
    } else {
      setMethodRows(null);
    }

    setLoading(false);
  }

  // Inventory value uses cost (purchase price) — consistent with the
  // dashboard and inventory page, since this represents money tied up
  // in stock, not potential sale revenue.
  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.purchase_price * p.current_stock, 0),
    [products]
  );
  const lowStock = useMemo(() => products.filter((p) => getStockStatus(p) === "low"), [products]);
  const outOfStock = useMemo(() => products.filter((p) => getStockStatus(p) === "out"), [products]);
  const avgInvoice = invoiceCount > 0 ? salesTotal / invoiceCount : 0;
  const netProfit = grossProfit - expensesTotal;
  const totalCustomerDebts = customers.reduce((sum, c) => sum + c.current_debt, 0);

  return (
    <div>
      <PageHeader showBack title="التقارير" />

      <div className="space-y-4 p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["today", "week", "month", "custom"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                range === r ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {r === "today" ? "اليوم" : r === "week" ? "آخر 7 أيام" : r === "month" ? "هذا الشهر" : "مخصص"}
            </button>
          ))}
        </div>

        {range === "custom" && (
          <div className="grid grid-cols-2 gap-2">
            <input
              type="date"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-3 py-2 text-sm"
            />
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>
        ) : (
          <>
            <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">ملخص المبيعات</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="إجمالي المبيعات" value={formatEGP(salesTotal)} />
                <MiniStat label="عدد الفواتير" value={String(invoiceCount)} />
                <MiniStat label="متوسط الفاتورة" value={formatEGP(avgInvoice)} />
              </div>
            </section>

            <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">ملخص الأرباح</h2>
              <div className="space-y-1.5 text-sm">
                <Row label="إجمالي الربح (قبل المصروفات)" value={formatEGP(grossProfit)} />
                <Row label="المصروفات" value={formatEGP(expensesTotal)} tone="danger" />
                <Row label="صافي الربح" value={formatEGP(netProfit)} bold tone={netProfit >= 0 ? "default" : "danger"} />
              </div>
            </section>

            {methodRows && <PaymentMethodsSection rows={methodRows} />}

            <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">الأكثر مبيعًا</h2>
              {topProducts.length === 0 ? (
                <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">لا توجد مبيعات في هذه الفترة</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {topProducts.map((p) => (
                    <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{p.name}</span>
                      <span className="font-bold text-gray-900 dark:text-gray-100">{p.quantity} قطعة</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">المخزون</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="قيمة المخزون (تكلفة)" value={formatEGP(inventoryValue)} />
                <MiniStat label="مخزون منخفض" value={String(lowStock.length)} tone={lowStock.length ? "warn" : "default"} />
                <MiniStat label="نفذ من المخزون" value={String(outOfStock.length)} tone={outOfStock.length ? "danger" : "default"} />
              </div>
            </section>

            <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900 dark:text-gray-100">مديونيات العملاء</h2>
              <MiniStat label="إجمالي المديونيات" value={formatEGP(totalCustomerDebts)} tone={totalCustomerDebts ? "danger" : "default"} full />
              {customers.length > 0 && (
                <ul className="mt-3 divide-y divide-gray-100 dark:divide-gray-800">
                  {customers.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-700 dark:text-gray-300">{c.name}</span>
                      <span className="font-bold text-red-600">{formatEGP(c.current_debt)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function PaymentMethodsSection({ rows }: { rows: Record<string, MethodRow> }) {
  const order = [...PAYMENT_METHODS.map((m) => m.value as string), "unknown"];
  const net = (r: MethodRow) => r.sales + r.collections - r.refunds - r.suppliers;
  const visible = order.filter((k) => {
    const r = rows[k];
    return r && (r.sales || r.collections || r.refunds || r.suppliers);
  });
  const total = visible.reduce((sum, k) => sum + net(rows[k]), 0);
  return (
    <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold text-gray-900 dark:text-gray-100">طرق الدفع</h2>
      <p className="mb-3 text-[11px] text-gray-400 dark:text-gray-500">
        الداخل: مبيعات وتحصيل ديون. الخارج: مرتجعات مردودة وسداد موردين. (فواتير الشراء مش داخلة)
      </p>
      {visible.length === 0 ? (
        <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">لا توجد حركة في هذه الفترة</p>
      ) : (
        <div className="space-y-3">
          {visible.map((k) => {
            const r = rows[k];
            const label = PAYMENT_METHODS.find((m) => m.value === k)?.label ?? "غير محدد (فواتير قديمة)";
            return (
              <div key={k} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-800">
                <p className="mb-2 flex items-center gap-2 text-sm font-bold text-gray-900 dark:text-gray-100">
                  {k !== "unknown" && <PaymentMethodIcon method={k as "cash" | "instapay" | "wallet"} className="h-5 w-5" />}
                  {label}
                </p>
                <div className="space-y-1.5 text-sm">
                  {r.sales > 0 && <Row label="مبيعات" value={formatEGP(r.sales)} />}
                  {r.collections > 0 && <Row label="تحصيل ديون" value={formatEGP(r.collections)} />}
                  {r.refunds > 0 && <Row label="مرتجعات مردودة" value={`- ${formatEGP(r.refunds)}`} tone="danger" />}
                  {r.suppliers > 0 && <Row label="سداد موردين" value={`- ${formatEGP(r.suppliers)}`} tone="danger" />}
                  <Row label="الصافي" value={formatEGP(net(r))} bold tone={net(r) >= 0 ? "default" : "danger"} />
                </div>
              </div>
            );
          })}
          <Row label="إجمالي الصافي" value={formatEGP(total)} bold tone={total >= 0 ? "default" : "danger"} />
        </div>
      )}
    </section>
  );
}

function MiniStat({
  label,
  value,
  tone = "default",
  full,
}: {
  label: string;
  value: string;
  tone?: "default" | "warn" | "danger";
  full?: boolean;
}) {
  const toneClass = tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-gray-900 dark:text-gray-100";
  return (
    <div className={`rounded-xl bg-gray-50 dark:bg-gray-800 p-2.5 ${full ? "text-center" : ""}`}>
      <p className="text-[11px] text-gray-400 dark:text-gray-500">{label}</p>
      <p className={`mt-0.5 text-sm font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

function Row({
  label,
  value,
  bold,
  tone = "default",
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">{label}</span>
      <span className={`${bold ? "text-base font-bold" : "font-semibold"} ${tone === "danger" ? "text-red-600" : "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </span>
    </div>
  );
}

export default function ReportsPage() {
  return (
    <OwnerGate>
      <ReportsPageContent />
    </OwnerGate>
  );
}
