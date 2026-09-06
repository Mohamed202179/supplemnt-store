"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDate, Product, Sale } from "@/lib/types";

interface DashboardData {
  todaySales: number;
  todayInvoices: number;
  inventoryValue: number;
  totalDebts: number;
  lowStockProducts: Product[];
  recentSales: Sale[];
  monthProfit: number;
  monthExpenses: number;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

    const [
      { data: todaySalesData },
      { data: products },
      { data: customers },
      { data: recentSales },
      { data: monthSales },
      { data: monthExpensesData },
    ] = await Promise.all([
      supabase
        .from("sales")
        .select("total")
        .eq("status", "completed")
        .gte("created_at", startOfDay.toISOString()),
      supabase.from("products").select("*").eq("is_active", true),
      supabase.from("customers").select("current_debt"),
      supabase
        .from("sales")
        .select("*, customers(name)")
        .order("created_at", { ascending: false })
        .limit(5),
      supabase
        .from("sales")
        .select("profit")
        .eq("status", "completed")
        .gte("created_at", startOfMonth.toISOString()),
      supabase.from("expenses").select("amount").gte("expense_date", startOfMonth.toISOString().slice(0, 10)),
    ]);

    const todaySales = (todaySalesData ?? []).reduce((sum, s: any) => sum + Number(s.total), 0);
    const todayInvoices = (todaySalesData ?? []).length;
    const allProducts = (products ?? []) as Product[];
    // Inventory value uses cost (purchase price), not selling price —
    // this reflects money actually tied up in stock, not potential revenue.
    const inventoryValue = allProducts.reduce(
      (sum, p) => sum + Number(p.purchase_price) * Number(p.current_stock),
      0
    );
    const totalDebts = (customers ?? []).reduce((sum, c: any) => sum + Number(c.current_debt), 0);
    const lowStockProducts = allProducts.filter((p) => p.current_stock <= p.min_stock);
    const monthGrossProfit = (monthSales ?? []).reduce((sum, s: any) => sum + Number(s.profit), 0);
    const monthExpenses = (monthExpensesData ?? []).reduce((sum, e: any) => sum + Number(e.amount), 0);

    setData({
      todaySales,
      todayInvoices,
      inventoryValue,
      totalDebts,
      lowStockProducts,
      recentSales: (recentSales ?? []) as Sale[],
      monthProfit: monthGrossProfit - monthExpenses,
      monthExpenses,
    });
    setLoading(false);
  }

  return (
    <div>
      <div className="bg-brand-600 px-4 pb-8 pt-4 text-white md:rounded-2xl md:mt-4 md:mx-4">
        <p className="text-sm opacity-90">أهلاً بك 👋</p>
        <h1 className="text-xl font-bold">متجر المكملات الغذائية</h1>
      </div>

      <div className="-mt-5 space-y-4 px-4 md:mt-4">
        {loading || !data ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            جارِ التحميل...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                href="/sales/history"
                label="مبيعات اليوم"
                value={formatEGP(data.todaySales)}
                sub={`${data.todayInvoices} فاتورة`}
              />
              <StatCard href="/inventory" label="قيمة المخزون (تكلفة)" value={formatEGP(data.inventoryValue)} />
              <StatCard href="/debts" label="إجمالي المديونيات" value={formatEGP(data.totalDebts)} tone="warn" />
              <StatCard
                href="/inventory"
                label="منتجات قليلة المخزون"
                value={String(data.lowStockProducts.length)}
                tone={data.lowStockProducts.length ? "danger" : "default"}
              />
              <StatCard
                href="/reports"
                label="صافي ربح الشهر"
                value={formatEGP(data.monthProfit)}
                tone={data.monthProfit >= 0 ? "default" : "danger"}
              />
              <StatCard href="/expenses" label="مصروفات الشهر" value={formatEGP(data.monthExpenses)} tone="warn" />
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Link
                href="/sales"
                className="block w-full rounded-2xl bg-brand-600 py-4 text-center text-base font-bold text-white shadow-sm active:bg-brand-700"
              >
                + بيع جديد
              </Link>
              <Link
                href="/purchases/new"
                className="block w-full rounded-2xl border-2 border-brand-600 bg-white py-4 text-center text-base font-bold text-brand-700 active:bg-brand-50"
              >
                + شراء جديد
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.lowStockProducts.length > 0 && (
                <section className="rounded-2xl bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-bold text-gray-900">منتجات قليلة المخزون</h2>
                  <ul className="divide-y divide-gray-100">
                    {data.lowStockProducts.slice(0, 5).map((p) => (
                      <li key={p.id}>
                        <Link href={`/inventory/${p.id}`} className="flex items-center justify-between py-2 text-sm">
                          <span className="text-gray-700">{p.name}</span>
                          <span className="font-semibold text-amber-600">{p.current_stock}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link href="/inventory" className="mt-2 block text-center text-xs font-semibold text-brand-600">
                    عرض كل المخزون ←
                  </Link>
                </section>
              )}

              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-bold text-gray-900">آخر عمليات البيع</h2>
                {data.recentSales.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">لا توجد مبيعات بعد</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.recentSales.map((s) => (
                      <li key={s.id}>
                        <Link href={`/sales/${s.id}`} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <p className="font-medium text-gray-800">
                              {s.customers?.name || s.customer_name_snapshot || "عميل نقدي"}{" "}
                              {s.status === "cancelled" && (
                                <span className="text-xs text-red-500">(ملغاة)</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(s.created_at)}</p>
                          </div>
                          <span className="font-bold text-gray-900">{formatEGP(s.total)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/sales/history" className="mt-2 block text-center text-xs font-semibold text-brand-600">
                  عرض كل المبيعات ←
                </Link>
              </section>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({
  href,
  label,
  value,
  sub,
  tone = "default",
}: {
  href: string;
  label: string;
  value: string;
  sub?: string;
  tone?: "default" | "warn" | "danger";
}) {
  const toneClass =
    tone === "warn" ? "text-amber-600" : tone === "danger" ? "text-red-600" : "text-gray-900";
  return (
    <Link href={href} className="block rounded-2xl bg-white p-4 shadow-sm active:bg-gray-50">
      <p className="text-xs text-gray-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400">{sub}</p>}
    </Link>
  );
}
