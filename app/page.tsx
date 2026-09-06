"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDate, Product, Sale } from "@/lib/types";
import { useLanguage } from "@/components/LanguageProvider";

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
  const { t, lang } = useLanguage();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [headerImageUrl, setHeaderImageUrl] = useState<string | null>(null);

  useEffect(() => {
    load();
    supabase
      .from("app_settings")
      .select("header_image_url")
      .eq("id", 1)
      .single()
      .then(({ data }) => setHeaderImageUrl((data as any)?.header_image_url ?? null));
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
      <div
        className="relative overflow-hidden px-4 pb-10 pt-6 text-white md:mx-4 md:mt-4 md:rounded-2xl"
        style={{
          backgroundImage: headerImageUrl
            ? `linear-gradient(to bottom, rgba(0,0,0,0.5), rgba(48,44,183,0.8)), url('${headerImageUrl}')`
            : "linear-gradient(135deg, #302cb7, #4641d2)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <p className="text-sm opacity-90">{t("dashboard_welcome")} 👋</p>
        <h1 className="text-xl font-bold">Daily Dose Supplements</h1>
      </div>

      <div className="-mt-5 space-y-4 px-4 md:mt-4">
        {loading || !data ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm">
            {t("loading")}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
              <StatCard
                href="/sales/history"
                label={t("stat_today_sales")}
                value={formatEGP(data.todaySales, lang)}
                sub={`${data.todayInvoices} ${t("stat_invoices_suffix")}`}
              />
              <StatCard href="/inventory" label={t("stat_inventory_value")} value={formatEGP(data.inventoryValue, lang)} />
              <StatCard href="/debts" label={t("stat_total_debts")} value={formatEGP(data.totalDebts, lang)} tone="warn" />
              <StatCard
                href="/inventory"
                label={t("stat_low_stock")}
                value={String(data.lowStockProducts.length)}
                tone={data.lowStockProducts.length ? "danger" : "default"}
              />
              <StatCard
                href="/reports"
                label={t("stat_month_profit")}
                value={formatEGP(data.monthProfit, lang)}
                tone={data.monthProfit >= 0 ? "default" : "danger"}
              />
              <StatCard href="/expenses" label={t("stat_month_expenses")} value={formatEGP(data.monthExpenses, lang)} tone="warn" />
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Link
                href="/sales"
                className="block w-full rounded-2xl bg-brand-600 py-4 text-center text-base font-bold text-white shadow-sm active:bg-brand-700"
              >
                {t("btn_new_sale")}
              </Link>
              <Link
                href="/purchases/new"
                className="block w-full rounded-2xl border-2 border-brand-600 bg-white py-4 text-center text-base font-bold text-brand-700 active:bg-brand-50"
              >
                {t("btn_new_purchase")}
              </Link>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {data.lowStockProducts.length > 0 && (
                <section className="rounded-2xl bg-white p-4 shadow-sm">
                  <h2 className="mb-2 text-sm font-bold text-gray-900">{t("stat_low_stock")}</h2>
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
                    {t("view_all_inventory")}
                  </Link>
                </section>
              )}

              <section className="rounded-2xl bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-bold text-gray-900">{t("section_recent_sales")}</h2>
                {data.recentSales.length === 0 ? (
                  <p className="py-4 text-center text-sm text-gray-400">{t("no_sales_yet")}</p>
                ) : (
                  <ul className="divide-y divide-gray-100">
                    {data.recentSales.map((s) => (
                      <li key={s.id}>
                        <Link href={`/sales/${s.id}`} className="flex items-center justify-between py-2 text-sm">
                          <div>
                            <p className="font-medium text-gray-800">
                              {s.customers?.name || s.customer_name_snapshot || t("cash_customer")}{" "}
                              {s.status === "cancelled" && (
                                <span className="text-xs text-red-500">{t("cancelled_label")}</span>
                              )}
                            </p>
                            <p className="text-xs text-gray-400">{formatDate(s.created_at)}</p>
                          </div>
                          <span className="font-bold text-gray-900">{formatEGP(s.total, lang)}</span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Link href="/sales/history" className="mt-2 block text-center text-xs font-semibold text-brand-600">
                  {t("view_all_sales")}
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
