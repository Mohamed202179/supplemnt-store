"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { ops, opError } from "@/lib/ops";
import { Sale, SaleItem, Customer, formatEGP, paymentStatusLabel } from "@/lib/types";
import { useRole } from "@/components/RoleProvider";
import { useTheme } from "@/components/ThemeProvider";
import {
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  FileText,
  Moon,
  Package,
  Phone,
  Sun,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

function formatInvoiceDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatInvoiceTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

function formatQty(q: number): string {
  return Number(q).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
}

export default function SaleDetailPage({ params }: { params: { id: string } }) {
  const { isOwner } = useRole();
  const router = useRouter();
  const { resolvedTheme, setThemeMode } = useTheme();
  const isDark = resolvedTheme === "dark";
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: it }] = await Promise.all([
      supabase.from("sales").select("*").eq("id", params.id).single(),
      supabase.from("sale_items").select("*").eq("sale_id", params.id),
    ]);
    setSale((s as Sale) ?? null);
    setItems((it ?? []) as SaleItem[]);

    if (s?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", s.customer_id).single();
      setCustomer((c as Customer) ?? null);
    } else {
      setCustomer(null);
    }
    setLoading(false);
  }

  async function cancelSale() {
    if (!sale) return;
    if (!confirm("سيتم إرجاع الكميات المباعة إلى المخزون وتصفير الدين المرتبط بهذه الفاتورة. هل تريد إلغاء البيع؟"))
      return;

    setError("");
    setCancelling(true);

    if (brand.mode === "v2") {
      try {
        await ops.cancelSale(sale.id);
      } catch (e) {
        setError(opError(e));
      }
      setCancelling(false);
      load();
      return;
    }

    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabase
        .from("products")
        .select("id, current_stock")
        .eq("id", item.product_id)
        .single();
      if (!product) continue;

      const newStock = product.current_stock + item.quantity;
      await supabase.from("products").update({ current_stock: newStock }).eq("id", item.product_id);

      await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        type: "sale_cancellation",
        quantity: item.quantity,
        reference: `إلغاء فاتورة رقم ${sale.invoice_number}`,
        previous_stock: product.current_stock,
        new_stock: newStock,
      });
    }

    await supabase
      .from("sales")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", sale.id);

    if (sale.customer_id) {
      const { data: cust } = await supabase.from("customers").select("*").eq("id", sale.customer_id).single();
      if (cust) {
        await supabase
          .from("customers")
          .update({
            current_debt: Math.max(0, cust.current_debt - sale.remaining_amount),
            total_purchases: Math.max(0, cust.total_purchases - sale.total),
          })
          .eq("id", sale.customer_id);
      }
    }

    setCancelling(false);
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!sale) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">الفاتورة غير موجودة</p>;

  const cancelled = sale.status === "cancelled";
  const customerName = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
  const remaining = Number(sale.remaining_amount);

  return (
    <div>
      {/* هيدر بنفس تصميم سجل المبيعات */}
      <header className="sticky top-0 z-30 bg-gradient-to-br from-[rgb(var(--brand-dark))] via-brand-600 to-brand-500 px-4 pb-5 pt-4 text-white shadow-md">
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
            <h1 className="truncate text-xl font-bold">فاتورة #{sale.invoice_number}</h1>
            <p className="truncate text-xs text-white/70">{customerName}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
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
        {/* الحالة */}
        <div className="flex flex-wrap items-center gap-2">
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
          <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-gray-800 dark:text-gray-200">
            <Wallet className="h-3.5 w-3.5" />
            {paymentStatusLabel(sale.payment_status)}
          </span>
        </div>

        {cancelled && (
          <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-300">
            تم إلغاء هذه الفاتورة
          </div>
        )}

        {/* العميل والتاريخ */}
        <div className="space-y-1.5 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
            <User className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            <span className="truncate">{customerName}</span>
          </p>
          {customer?.phone && (
            <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <Phone className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
              <span dir="ltr">{customer.phone}</span>
            </p>
          )}
          <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
            {formatInvoiceDate(sale.created_at)}
          </p>
          <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
            <Clock className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
            {formatInvoiceTime(sale.created_at)}
          </p>
        </div>

        {/* المنتجات */}
        <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <p className="mb-1 flex items-center gap-1.5 text-xs font-bold text-gray-900 dark:text-gray-100">
            <Package className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
            المنتجات ({items.length.toLocaleString("ar-EG")})
          </p>
          <ul className="divide-y divide-gray-100 dark:divide-gray-800">
            {items.map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">{item.product_name_snapshot}</span>
                  <span className="shrink-0 font-bold text-gray-900 dark:text-gray-100">{formatEGP(item.line_total)}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  {formatQty(item.quantity)} × {formatEGP(item.unit_price)}
                </p>
              </li>
            ))}
          </ul>
        </div>

        {/* الإجمالي */}
        <div
          className={`flex items-center justify-between gap-2 rounded-xl p-3 ${
            cancelled ? "bg-red-50 dark:bg-red-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"
          }`}
        >
          <div className="min-w-0">
            <p className="text-xs text-gray-600 dark:text-gray-300">الإجمالي</p>
            <p className="truncate text-lg font-extrabold text-gray-900 dark:text-gray-100">{formatEGP(sale.total)}</p>
          </div>
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              cancelled
                ? "bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-300"
                : "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300"
            }`}
          >
            <Wallet className="h-4 w-4" />
          </span>
        </div>

        {/* تفاصيل الحساب */}
        <div className="space-y-1.5 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
          <Row label="الإجمالي الفرعي" value={formatEGP(sale.subtotal)} />
          <Row label="الخصم" value={formatEGP(sale.discount)} />
          <Row label="المدفوع" value={formatEGP(sale.paid_amount)} />
          <Row label="المتبقي" value={formatEGP(remaining)} tone={remaining > 0 ? "danger" : "default"} bold={remaining > 0} />
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {sale.status === "completed" && isOwner && (
          <button
            onClick={cancelSale}
            disabled={cancelling}
            className="w-full rounded-xl bg-red-50 py-3.5 text-sm font-bold text-red-600 disabled:opacity-60 dark:bg-red-500/10 dark:text-red-300"
          >
            {cancelling ? "جارِ الإلغاء..." : "إلغاء البيع / استرجاع"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${tone === "danger" ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-gray-100"}`}>
        {value}
      </span>
    </div>
  );
}
