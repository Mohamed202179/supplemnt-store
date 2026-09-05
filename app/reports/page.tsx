"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product, Customer } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

type RangeKey = "today" | "week" | "month" | "custom";

interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
}

export default function ReportsPage() {
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

    const [{ data: sales }, { data: expenses }, { data: saleItems }] = await Promise.all([
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
    ]);

    const salesRows = sales ?? [];
    setSalesTotal(salesRows.reduce((sum: number, s: any) => sum + Number(s.total), 0));
    setInvoiceCount(salesRows.length);
    setGrossProfit(salesRows.reduce((sum: number, s: any) => sum + Number(s.profit), 0));
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

    setLoading(false);
  }

  const inventoryValue = useMemo(
    () => products.reduce((sum, p) => sum + p.selling_price * p.current_stock, 0),
    [products]
  );
  const lowStock = useMemo(() => products.filter((p) => getStockStatus(p) === "low"), [products]);
  const outOfStock = useMemo(() => products.filter((p) => getStockStatus(p) === "out"), [products]);
  const avgInvoice = invoiceCount > 0 ? salesTotal / invoiceCount : 0;
  const netProfit = grossProfit - expensesTotal;
  const totalCustomerDebts = customers.reduce((sum, c) => sum + c.current_debt, 0);

  return (
    <div>
      <PageHeader title="التقارير" />

      <div className="space-y-4 p-4">
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(["today", "week", "month", "custom"] as RangeKey[]).map((r) => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                range === r ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"
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
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm"
            />
          </div>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : (
          <>
            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">ملخص المبيعات</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="إجمالي المبيعات" value={formatEGP(salesTotal)} />
                <MiniStat label="عدد الفواتير" value={String(invoiceCount)} />
                <MiniStat label="متوسط الفاتورة" value={formatEGP(avgInvoice)} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">ملخص الأرباح</h2>
              <div className="space-y-1.5 text-sm">
                <Row label="إجمالي الربح (قبل المصروفات)" value={formatEGP(grossProfit)} />
                <Row label="المصروفات" value={formatEGP(expensesTotal)} tone="danger" />
                <Row label="صافي الربح" value={formatEGP(netProfit)} bold tone={netProfit >= 0 ? "default" : "danger"} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">الأكثر مبيعًا</h2>
              {topProducts.length === 0 ? (
                <p className="py-3 text-center text-xs text-gray-400">لا توجد مبيعات في هذه الفترة</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {topProducts.map((p) => (
                    <li key={p.name} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-700">{p.name}</span>
                      <span className="font-bold text-gray-900">{p.quantity} قطعة</span>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">المخزون</h2>
              <div className="grid grid-cols-3 gap-2 text-center">
                <MiniStat label="قيمة المخزون" value={formatEGP(inventoryValue)} />
                <MiniStat label="مخزون منخفض" value={String(lowStock.length)} tone={lowStock.length ? "warn" : "default"} />
                <MiniStat label="نفذ من المخزون" value={String(outOfStock.length)} tone={outOfStock.length ? "danger" : "default"} />
              </div>
            </section>

            <section className="rounded-2xl bg-white p-4 shadow-sm">
              <h2 className="mb-3 text-sm font-bold text-gray-900">مديونيات العملاء</h2>
              <MiniStat label="إجمالي المديونيات" value={formatEGP(totalCustomerDebts)} tone={totalCustomerDebts ? "danger" : "default"} full />
              {customers.length > 0 && (
                <ul className="mt-3 divide-y divide-gray-100">
                  {customers.slice(0, 5).map((c) => (
                    <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                      <span className="text-gray-700">{c.name}</span>
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
  const toneClass = tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <div className={`rounded-xl bg-gray-50 p-2.5 ${full ? "text-center" : ""}`}>
      <p className="text-[11px] text-gray-400">{label}</p>
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
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? "text-base font-bold" : "font-semibold"} ${tone === "danger" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
