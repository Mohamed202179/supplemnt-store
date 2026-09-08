"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  Menu,
  TrendingUp,
  Wallet,
  Package,
  CreditCard,
  Receipt,
  AlertTriangle,
  CalendarClock,
  ShoppingCart,
  PackagePlus,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDate, Product, Sale } from "@/lib/types";
import { useLanguage } from "@/components/LanguageProvider";
import { useRole } from "@/components/RoleProvider";
import SalesChart, { DayPoint } from "@/components/SalesChart";

interface DashboardData {
  todaySales: number;
  todayInvoices: number;
  inventoryValue: number;
  totalDebts: number;
  lowStockProducts: Product[];
  expiringProducts: Product[];
  recentSales: Sale[];
  monthProfit: number;
  monthExpenses: number;
  weekSeries: DayPoint[];
}

export default function DashboardPage() {
  const { t, lang } = useLanguage();
  const { isOwner } = useRole();
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  async function load() {
    setLoading(true);

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);
    const sevenDaysAgo = new Date(startOfDay);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6);

    const [
      { data: todaySalesData },
      { data: products },
      { data: customers },
      { data: recentSales },
      { data: monthSales },
      { data: monthExpensesData },
      { data: weekSales },
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
      supabase
        .from("sales")
        .select("total, profit, created_at")
        .eq("status", "completed")
        .gte("created_at", sevenDaysAgo.toISOString()),
    ]);

    const todaySales = (todaySalesData ?? []).reduce((sum, s: any) => sum + Number(s.total), 0);
    const todayInvoices = (todaySalesData ?? []).length;
    const allProducts = (products ?? []) as Product[];
    const inventoryValue = allProducts.reduce(
      (sum, p) => sum + Number(p.purchase_price) * Number(p.current_stock),
      0
    );
    const totalDebts = (customers ?? []).reduce((sum, c: any) => sum + Number(c.current_debt), 0);
    const lowStockProducts = allProducts.filter((p) => p.current_stock <= p.min_stock);

    const ninetyDaysFromNow = new Date();
    ninetyDaysFromNow.setDate(ninetyDaysFromNow.getDate() + 90);
    const expiringProducts = allProducts
      .filter((p) => p.expiry_date && new Date(p.expiry_date) <= ninetyDaysFromNow)
      .sort((a, b) => new Date(a.expiry_date!).getTime() - new Date(b.expiry_date!).getTime());

    const monthGrossProfit = (monthSales ?? []).reduce((sum, s: any) => sum + Number(s.profit), 0);
    const monthExpenses = (monthExpensesData ?? []).reduce((sum, e: any) => sum + Number(e.amount), 0);

    const weekSeries: DayPoint[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = new Date(startOfDay);
      day.setDate(day.getDate() - i);
      const key = day.toDateString();
      const dayRows = (weekSales ?? []).filter((s: any) => new Date(s.created_at).toDateString() === key);
      weekSeries.push({
        label: day.toLocaleDateString(lang === "ar" ? "ar-EG" : "en-US", { weekday: "short" }),
        sales: dayRows.reduce((sum: number, s: any) => sum + Number(s.total), 0),
        profit: dayRows.reduce((sum: number, s: any) => sum + Number(s.profit), 0),
      });
    }

    setData({
      todaySales,
      todayInvoices,
      inventoryValue,
      totalDebts,
      lowStockProducts,
      expiringProducts,
      recentSales: (recentSales ?? []) as Sale[],
      monthProfit: monthGrossProfit - monthExpenses,
      monthExpenses,
      weekSeries,
    });
    setLoading(false);
  }

  const alertCount = data ? data.lowStockProducts.length + data.expiringProducts.length : 0;

  return (
    <div>
      <div
        className="relative overflow-hidden px-4 pb-8 pt-4 text-white md:mx-4 md:mt-4 md:rounded-2xl"
        style={{
          backgroundImage: headerImageUrl
            ? `linear-gradient(to bottom, rgba(10,10,20,0.55), rgba(20,15,50,0.88)), url('${headerImageUrl}')`
            : "linear-gradient(135deg, #1a1740, #302cb7)",
          backgroundSize: "cover",
          backgroundPosition: "center",
        }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <img src="/icons/icon-192.png" alt="Daily Dose" className="h-9 w-9 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-bold leading-tight">Daily Dose</p>
              <p className="text-[10px] leading-tight opacity-70">Supplements</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/inventory" className="relative">
              <Bell className="h-5 w-5" />
              {alertCount > 0 && (
                <span className="absolute -right-1.5 -top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {alertCount}
                </span>
              )}
            </Link>
            <Link href="/more">
              <Menu className="h-5 w-5" />
            </Link>
          </div>
        </div>

        <p className="mt-5 text-sm opacity-90">{t("dashboard_welcome")} 👋</p>
        <h1 className="text-xl font-bold">Daily Dose Supplements</h1>
      </div>

      <div className="-mt-4 space-y-4 px-4 md:mt-4">
        {loading || !data ? (
          <div className="rounded-2xl bg-white p-6 text-center text-sm text-gray-400 shadow-sm dark:bg-gray-900 dark:text-gray-500">
            {t("loading")}
          </div>
        ) : (
          <>
            {isOwner && (data.lowStockProducts.length > 0 || data.expiringProducts.length > 0) && (
              <div className="grid grid-cols-2 gap-3">
                {data.lowStockProducts.length > 0 && (
                  <Link
                    href="/inventory"
                    className="rounded-2xl bg-amber-50 p-3 shadow-sm dark:bg-amber-500/10"
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                    <p className="mt-2 text-xl font-bold text-amber-700 dark:text-amber-300">
                      {data.lowStockProducts.length}
                    </p>
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">{t("stat_low_stock")}</p>
                  </Link>
                )}
                {data.expiringProducts.length > 0 && (
                  <Link href="/inventory" className="rounded-2xl bg-red-50 p-3 shadow-sm dark:bg-red-500/10">
                    <CalendarClock className="h-5 w-5 text-red-600 dark:text-red-400" />
                    <p className="mt-2 text-xl font-bold text-red-700 dark:text-red-300">
                      {data.expiringProducts.length}
                    </p>
                    <p className="text-xs font-medium text-red-700 dark:text-red-400">
                      {t("section_expiring_products")}
                    </p>
                  </Link>
                )}
              </div>
            )}

            {isOwner && (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                <IconStatCard
                  href="/sales/history"
                  icon={<TrendingUp className="h-5 w-5" />}
                  iconClass="bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300"
                  label={t("stat_today_sales")}
                  value={formatEGP(data.todaySales, lang)}
                  sub={`${data.todayInvoices} ${t("stat_invoices_suffix")}`}
                />
                <IconStatCard
                  href="/inventory"
                  icon={<Package className="h-5 w-5" />}
                  iconClass="bg-purple-50 text-purple-700 dark:bg-purple-500/20 dark:text-purple-300"
                  label={t("stat_inventory_value")}
                  value={formatEGP(data.inventoryValue, lang)}
                />
                <IconStatCard
                  href="/debts"
                  icon={<CreditCard className="h-5 w-5" />}
                  iconClass="bg-orange-50 text-orange-700 dark:bg-orange-500/20 dark:text-orange-300"
                  label={t("stat_total_debts")}
                  value={formatEGP(data.totalDebts, lang)}
                />
                <IconStatCard
                  href="/reports"
                  icon={<Wallet className="h-5 w-5" />}
                  iconClass="bg-green-50 text-green-700 dark:bg-green-500/20 dark:text-green-300"
                  label={t("stat_month_profit")}
                  value={formatEGP(data.monthProfit, lang)}
                  valueClass={data.monthProfit < 0 ? "text-red-600 dark:text-red-400" : undefined}
                />
                <IconStatCard
                  href="/expenses"
                  icon={<Receipt className="h-5 w-5" />}
                  iconClass="bg-blue-50 text-blue-700 dark:bg-blue-500/20 dark:text-blue-300"
                  label={t("stat_month_expenses")}
                  value={formatEGP(data.monthExpenses, lang)}
                />
              </div>
            )}

            {isOwner && (
              <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
                <div className="mb-1 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-gray-900 dark:text-gray-100">المبيعات والأرباح</h2>
                  <div className="flex items-center gap-3 text-[11px]">
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-brand-600" /> المبيعات
                    </span>
                    <span className="flex items-center gap-1 text-gray-500 dark:text-gray-400">
                      <span className="h-2 w-2 rounded-full bg-amber-500" /> الأرباح
                    </span>
                  </div>
                </div>
                <SalesChart data={data.weekSeries} />
              </section>
            )}

            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <Link
                href="/sales"
                className="flex w-full items-center justify-center gap-2 rounded-2xl bg-brand-600 py-4 text-center text-base font-bold text-white shadow-sm active:bg-brand-700"
              >
                <ShoppingCart className="h-5 w-5" />
                {t("btn_new_sale")}
              </Link>
              {isOwner && (
                <Link
                  href="/purchases/new"
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-brand-600 bg-white py-4 text-center text-base font-bold text-brand-700 active:bg-brand-50 dark:bg-gray-900 dark:text-brand-300 dark:active:bg-gray-800"
                >
                  <PackagePlus className="h-5 w-5" />
                  {t("btn_new_purchase")}
                </Link>
              )}
            </div>

            <section className="rounded-2xl bg-white p-4 shadow-sm dark:bg-gray-900">
              <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">{t("section_recent_sales")}</h2>
              {data.recentSales.length === 0 ? (
                <p className="py-4 text-center text-sm text-gray-400 dark:text-gray-500">{t("no_sales_yet")}</p>
              ) : (
                <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                  {data.recentSales.map((s) => (
                    <li key={s.id}>
                      <Link href={`/sales/${s.id}`} className="flex items-center gap-3 py-2 text-sm">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
                          <Receipt className="h-4 w-4" />
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-gray-800 dark:text-gray-200">
                            {s.customers?.name || s.customer_name_snapshot || t("cash_customer")}{" "}
                            {s.status === "cancelled" && (
                              <span className="text-xs text-red-500">{t("cancelled_label")}</span>
                            )}
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500">{formatDate(s.created_at)}</p>
                        </div>
                        <span className="font-bold text-gray-900 dark:text-gray-100">{formatEGP(s.total, lang)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
              <Link href="/sales/history" className="mt-2 block text-center text-xs font-semibold text-brand-600">
                {t("view_all_sales")}
              </Link>
            </section>
          </>
        )}
      </div>
    </div>
  );
}

function IconStatCard({
  href,
  icon,
  iconClass,
  label,
  value,
  sub,
  valueClass,
}: {
  href: string;
  icon: React.ReactNode;
  iconClass: string;
  label: string;
  value: string;
  sub?: string;
  valueClass?: string;
}) {
  return (
    <Link href={href} className="block rounded-2xl bg-white p-4 shadow-sm active:bg-gray-50 dark:bg-gray-900 dark:active:bg-gray-800">
      <span className={`flex h-9 w-9 items-center justify-center rounded-xl ${iconClass}`}>{icon}</span>
      <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className={`mt-0.5 text-base font-bold text-gray-900 dark:text-gray-100 ${valueClass ?? ""}`}>{value}</p>
      {sub && <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{sub}</p>}
    </Link>
  );
}
