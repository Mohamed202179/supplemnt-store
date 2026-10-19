"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, Sale } from "@/lib/types";
import { useTheme } from "@/components/ThemeProvider";
import {
  ArrowDownUp,
  CalendarDays,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  FileText,
  Moon,
  Package,
  Phone,
  Search,
  ShoppingBag,
  SlidersHorizontal,
  Sun,
  User,
  XCircle,
} from "lucide-react";

type StatusFilter = "all" | "completed" | "cancelled";
type SortOrder = "newest" | "oldest";

// Sale row as returned by the extended select below. phone / sale_items are
// absent when the safe fallback query (the original one) is used.
type SaleRow = Omit<Sale, "customers"> & {
  customers?: { name: string; phone?: string | null } | null;
  sale_items?: { product_name_snapshot: string; quantity: number }[] | null;
};

const LOAD_LIMIT = 200;
const MAX_ITEMS_SHOWN = 3;

const EXTENDED_SELECT = "*, customers(name, phone), sale_items(product_name_snapshot, quantity)";
const BASIC_SELECT = "*, customers(name)";

// Local-time "YYYY-MM-DD" key, comparable with <input type="date"> values.
function localDateKey(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

function formatInvoiceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatQty(q: number): string {
  return Number(q).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

export default function SalesHistoryPage() {
  const router = useRouter();
  const { resolvedTheme, setThemeMode } = useTheme();
  const isDark = resolvedTheme === "dark";

  const [sales, setSales] = useState<SaleRow[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    setLoadError(false);

    // Preferred query: also pulls customer phone and sale items (existing columns / FKs).
    const primary = await supabase
      .from("sales")
      .select(EXTENDED_SELECT)
      .order("created_at", { ascending: false })
      .limit(LOAD_LIMIT);

    let rows: unknown = primary.data;

    // Safe fallback: the original query, if the extended one fails for any reason.
    if (primary.error) {
      const fallback = await supabase
        .from("sales")
        .select(BASIC_SELECT)
        .order("created_at", { ascending: false })
        .limit(LOAD_LIMIT);
      rows = fallback.data;
      if (fallback.error) setLoadError(true);
    }

    setSales(((rows ?? []) as unknown) as SaleRow[]);
    setLoading(false);
  }

  // Counts are based on the loaded invoices only (not search / date filtered).
  const counts = useMemo(
    () => ({
      all: sales.length,
      completed: sales.filter((s) => s.status === "completed").length,
      cancelled: sales.filter((s) => s.status === "cancelled").length,
    }),
    [sales]
  );

  const filtered = useMemo(() => {
    const list = sales.filter((s) => {
      const matchesSearch =
        !search ||
        (s.customers?.name ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (s.customer_name_snapshot ?? "").toLowerCase().includes(search.toLowerCase()) ||
        String(s.invoice_number).includes(search);
      const matchesStatus = statusFilter === "all" || s.status === statusFilter;
      const key = localDateKey(s.created_at);
      const matchesFrom = !dateFrom || key >= dateFrom;
      const matchesTo = !dateTo || key <= dateTo;
      return matchesSearch && matchesStatus && matchesFrom && matchesTo;
    });
    // Data is loaded newest-first; "oldest" simply reverses the loaded order.
    return sortOrder === "newest" ? list : [...list].reverse();
  }, [sales, search, statusFilter, sortOrder, dateFrom, dateTo]);

  const hasDateFilter = Boolean(dateFrom || dateTo);

  const chips: { key: StatusFilter; label: string; count: number }[] = [
    { key: "all", label: "الكل", count: counts.all },
    { key: "completed", label: "مكتملة", count: counts.completed },
    { key: "cancelled", label: "ملغاة", count: counts.cancelled },
  ];

  return (
    <div>
      {/* Navy header (sales history only) */}
      <header className="sticky top-0 z-30 bg-gradient-to-br from-[#0b1736] via-[#14234f] to-[#1d3270] px-4 pb-5 pt-4 text-white shadow-md">
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.back()}
            className="-me-1 shrink-0 rounded-lg p-1.5 text-white/80 active:bg-white/10"
            aria-label="رجوع"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-xl font-bold">سجل المبيعات</h1>
            <p className="truncate text-xs text-white/70">جميع فواتير المبيعات مرتبة بشكل منتظم</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden text-xs text-white/80 min-[400px]:inline">
              {isDark ? "وضع الليل" : "وضع النهار"}
            </span>
            <div className="flex items-center rounded-full bg-white/10 p-1" role="group" aria-label="تبديل المظهر">
              <button
                onClick={() => setThemeMode("light")}
                aria-label="وضع النهار"
                aria-pressed={!isDark}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  !isDark ? "bg-white/25 text-amber-300" : "text-white/60"
                }`}
              >
                <Sun className="h-4 w-4" />
              </button>
              <button
                onClick={() => setThemeMode("dark")}
                aria-label="وضع الليل"
                aria-pressed={isDark}
                className={`flex h-7 w-7 items-center justify-center rounded-full ${
                  isDark ? "bg-white/25 text-white" : "text-white/60"
                }`}
              >
                <Moon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4">
        {/* Search + filter button */}
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-4 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث برقم الفاتورة أو اسم العميل..."
              className="w-full rounded-2xl border border-gray-200 bg-white py-3 pe-4 ps-12 text-sm text-gray-900 shadow-sm focus:border-[#1d3270] focus:outline-none dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100"
            />
          </div>
          <button
            onClick={() => setShowFilters((v) => !v)}
            aria-label="تصفية حسب التاريخ"
            aria-expanded={showFilters}
            className={`relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border shadow-sm ${
              showFilters || hasDateFilter
                ? "border-[#1d3270] bg-[#1d3270] text-white"
                : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
            }`}
          >
            <SlidersHorizontal className="h-5 w-5" />
            {hasDateFilter && (
              <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white bg-amber-400 dark:border-gray-900" />
            )}
          </button>
        </div>

        {/* Date range filter (applies to the loaded invoices) */}
        {showFilters && (
          <div className="rounded-2xl border border-gray-200 bg-white p-3 shadow-sm dark:border-gray-700 dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-3">
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                من تاريخ
                <input
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-[#1d3270] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:[color-scheme:dark]"
                />
              </label>
              <label className="block text-xs font-semibold text-gray-600 dark:text-gray-300">
                إلى تاريخ
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 [color-scheme:light] focus:border-[#1d3270] focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100 dark:[color-scheme:dark]"
                />
              </label>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2">
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                يُطبَّق النطاق على الفواتير المحمّلة فقط.
              </p>
              {hasDateFilter && (
                <button
                  onClick={() => {
                    setDateFrom("");
                    setDateTo("");
                  }}
                  className="shrink-0 text-xs font-semibold text-red-600 dark:text-red-300"
                >
                  مسح التاريخ
                </button>
              )}
            </div>
          </div>
        )}

        {/* Status chips + sort toggle */}
        <div className="flex flex-wrap items-center gap-2">
          {chips.map((c) => {
            const active = statusFilter === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setStatusFilter(c.key)}
                aria-pressed={active}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${
                  active
                    ? "border-[#1d3270] bg-[#1d3270] text-white dark:border-[#2c4690] dark:bg-[#2c4690]"
                    : "border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
                }`}
              >
                {c.key === "completed" && (
                  <CheckCircle2 className={`h-4 w-4 ${active ? "text-white" : "text-emerald-600 dark:text-emerald-400"}`} />
                )}
                {c.key === "cancelled" && (
                  <XCircle className={`h-4 w-4 ${active ? "text-white" : "text-red-600 dark:text-red-400"}`} />
                )}
                {c.label}
                <span
                  className={`rounded-full px-2 py-0.5 text-[11px] ${
                    active
                      ? "bg-white text-[#1d3270]"
                      : "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300"
                  }`}
                >
                  {c.count.toLocaleString("ar-EG")}
                </span>
              </button>
            );
          })}
          <button
            onClick={() => setSortOrder((o) => (o === "newest" ? "oldest" : "newest"))}
            className="ms-auto flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-300"
          >
            <ArrowDownUp className="h-4 w-4" />
            {sortOrder === "newest" ? "الأحدث أولاً" : "الأقدم أولاً"}
          </button>
        </div>
        {!loading && !loadError && (
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            الأعداد محسوبة من الفواتير المحمّلة فقط ({counts.all.toLocaleString("ar-EG")}
            {counts.all >= LOAD_LIMIT ? "، الحد الأقصى" : ""}) وقد لا تشمل كل السجلات.
          </p>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>
        ) : loadError ? (
          <div className="py-10 text-center">
            <p className="text-sm text-red-600 dark:text-red-300">تعذّر تحميل الفواتير.</p>
            <button
              onClick={load}
              className="mt-3 rounded-full border border-gray-200 bg-white px-4 py-1.5 text-xs font-semibold text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">لا توجد فواتير مطابقة</p>
        ) : (
          <ul className="space-y-3">
            {filtered.map((s) => {
              const cancelled = s.status === "cancelled";
              const items = s.sale_items ?? [];
              const shown = items.slice(0, MAX_ITEMS_SHOWN);
              const extra = items.length - shown.length;
              const customerName = s.customers?.name || s.customer_name_snapshot || "عميل نقدي";
              const phone = s.customers?.phone;
              return (
                <li key={s.id}>
                  <Link
                    href={`/sales/${s.id}`}
                    className="block rounded-2xl border border-gray-100 bg-white p-3 shadow-sm active:bg-gray-50 dark:border-gray-800 dark:bg-gray-900 dark:active:bg-gray-800"
                  >
                    <div className="grid grid-cols-2 gap-3 md:grid-cols-[170px_1fr_1fr_170px] md:items-center">
                      {/* Invoice number + status */}
                      <div className="col-span-2 flex items-center justify-between gap-2 md:col-span-1 md:flex-col md:items-start md:justify-center">
                        <div className="flex items-center gap-2 md:flex-col md:items-start">
                          <span className="rounded-lg bg-gray-100 px-2.5 py-1 text-xs font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
                            فاتورة #{s.invoice_number}
                          </span>
                          <span
                            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
                              cancelled
                                ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                            }`}
                          >
                            {cancelled ? <XCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                            {cancelled ? "ملغاة" : "مكتملة"}
                          </span>
                        </div>
                        <ChevronLeft className="h-5 w-5 shrink-0 text-gray-400 dark:text-gray-500 md:hidden" />
                      </div>

                      {/* Customer, phone, date, time */}
                      <div className="min-w-0 space-y-1 text-sm md:border-s md:border-gray-100 md:ps-4 dark:md:border-gray-800">
                        <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
                          <User className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                          <span className="truncate">{customerName}</span>
                        </p>
                        {phone && (
                          <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                            <Phone className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
                            <span dir="ltr">{phone}</span>
                          </p>
                        )}
                        <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
                          {formatInvoiceDate(s.created_at)}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
                          {formatInvoiceTime(s.created_at)}
                        </p>
                      </div>

                      {/* Products (up to 3) */}
                      <div className="order-4 col-span-2 min-w-0 border-t border-gray-100 pt-3 text-sm md:order-none md:col-span-1 md:border-s md:border-t-0 md:pt-0 md:ps-4 dark:border-gray-800 dark:md:border-gray-800">
                        <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
                          <Package className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
                          المنتجات
                        </p>
                        {shown.length === 0 ? (
                          <p className="text-xs text-gray-400 dark:text-gray-500">—</p>
                        ) : (
                          <ul className="space-y-0.5">
                            {shown.map((it, i) => (
                              <li
                                key={i}
                                className="flex items-center justify-between gap-2 text-xs text-gray-600 dark:text-gray-300"
                              >
                                <span className="truncate">{it.product_name_snapshot}</span>
                                <span className="shrink-0 text-gray-500 dark:text-gray-400">
                                  {formatQty(it.quantity)} ×
                                </span>
                              </li>
                            ))}
                            {extra > 0 && (
                              <li className="text-xs font-semibold text-gray-500 dark:text-gray-400">
                                +{extra.toLocaleString("ar-EG")} أخرى
                              </li>
                            )}
                          </ul>
                        )}
                      </div>
                      {/* Total */}
                      <div
                        className={`order-3 flex items-center justify-between gap-2 rounded-xl p-3 md:order-none ${
                          cancelled ? "bg-red-50 dark:bg-red-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"
                        }`}
                      >
                        <div className="min-w-0">
                          <p className="text-xs text-gray-600 dark:text-gray-300">الإجمالي</p>
                          <p className="truncate text-lg font-extrabold text-gray-900 dark:text-gray-100">
                            {formatEGP(s.total)}
                          </p>
                        </div>
                        <span
                          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
                            cancelled
                              ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
                          }`}
                        >
                          <ShoppingBag className="h-4 w-4" />
                        </span>
                      </div>

                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
