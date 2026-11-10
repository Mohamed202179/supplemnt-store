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
  Printer,
  Share2,
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
  const [notice, setNotice] = useState("");

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

  function flash(msg: string) {
    setNotice(msg);
    setTimeout(() => setNotice(""), 3500);
  }

  function buildInvoiceText(): string {
    if (!sale) return "";
    const name = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
    const lines: string[] = [];
    lines.push(`🧾 ${brand.name}`);
    lines.push(`فاتورة رقم #${sale.invoice_number}${sale.status === "cancelled" ? " (ملغاة)" : ""}`);
    lines.push(`التاريخ: ${formatInvoiceDate(sale.created_at)} - ${formatInvoiceTime(sale.created_at)}`);
    lines.push(`العميل: ${name}`);
    lines.push("────────────");
    for (const it of items) {
      lines.push(`• ${it.product_name_snapshot}: ${formatQty(it.quantity)} × ${formatEGP(it.unit_price)} = ${formatEGP(it.line_total)}`);
    }
    lines.push("────────────");
    lines.push(`الإجمالي الفرعي: ${formatEGP(sale.subtotal)}`);
    if (Number(sale.discount) > 0) lines.push(`الخصم: ${formatEGP(sale.discount)}`);
    lines.push(`الإجمالي: ${formatEGP(sale.total)}`);
    lines.push(`المدفوع: ${formatEGP(sale.paid_amount)}`);
    if (Number(sale.remaining_amount) > 0) lines.push(`المتبقي: ${formatEGP(sale.remaining_amount)}`);
    lines.push("شكرًا لتعاملكم معنا 🙏");
    return lines.join("\n");
  }

  async function shareInvoice() {
    const text = buildInvoiceText();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `فاتورة #${sale?.invoice_number}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash("تم نسخ الفاتورة، الصقها في واتساب أو أي تطبيق");
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return; // المستخدم قفل نافذة المشاركة
      try {
        await navigator.clipboard.writeText(text);
        flash("تم نسخ الفاتورة، الصقها في واتساب أو أي تطبيق");
      } catch {
        flash("تعذّرت المشاركة على هذا الجهاز");
      }
    }
  }

  function printInvoice() {
    window.print();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!sale) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">الفاتورة غير موجودة</p>;

  const cancelled = sale.status === "cancelled";
  const customerName = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
  const remaining = Number(sale.remaining_amount);

  return (
    <div>
      <div className="print:hidden">
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

        {/* مشاركة وطباعة */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={shareInvoice}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white active:opacity-90"
          >
            <Share2 className="h-4 w-4" />
            مشاركة
          </button>
          <button
            onClick={printInvoice}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 active:bg-gray-50 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
          >
            <Printer className="h-4 w-4" />
            طباعة
          </button>
        </div>
        {notice && (
          <div className="rounded-xl bg-emerald-50 p-3 text-center text-sm font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {notice}
          </div>
        )}

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

      <PrintableInvoice
        sale={sale}
        items={items}
        customerName={customerName}
        phone={customer?.phone ?? null}
      />
    </div>
  );
}

// نسخة الطباعة: بتظهر عند الطباعة فقط (ألوان ثابتة فاتحة بغض النظر عن الوضع الليلي)
function PrintableInvoice({
  sale,
  items,
  customerName,
  phone,
}: {
  sale: Sale;
  items: SaleItem[];
  customerName: string;
  phone: string | null;
}) {
  const cancelled = sale.status === "cancelled";
  const remaining = Number(sale.remaining_amount);
  return (
    <div dir="rtl" className="hidden bg-white p-4 text-black print:block">
      <div className="text-center">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={brand.icon192} alt={brand.shortName} className="mx-auto h-14 w-14 rounded-xl object-cover" />
        <h1 className="mt-1 text-xl font-extrabold">{brand.name}</h1>
        <p className="text-sm">فاتورة بيع رقم #{sale.invoice_number}</p>
        {cancelled && <p className="mt-1 text-base font-extrabold">*** فاتورة ملغاة ***</p>}
      </div>

      <div className="mt-3 space-y-0.5 border-y border-gray-400 py-2 text-xs">
        <p>العميل: {customerName}</p>
        {phone && (
          <p>
            الهاتف: <span dir="ltr">{phone}</span>
          </p>
        )}
        <p>
          التاريخ: {formatInvoiceDate(sale.created_at)} - {formatInvoiceTime(sale.created_at)}
        </p>
      </div>

      <table className="mt-2 w-full text-xs">
        <thead>
          <tr className="border-b border-gray-400 text-start">
            <th className="py-1 text-start font-bold">الصنف</th>
            <th className="py-1 text-center font-bold">الكمية</th>
            <th className="py-1 text-center font-bold">السعر</th>
            <th className="py-1 text-end font-bold">الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} className="border-b border-gray-200">
              <td className="py-1 pe-1">{it.product_name_snapshot}</td>
              <td className="py-1 text-center">{formatQty(it.quantity)}</td>
              <td className="py-1 text-center">{formatEGP(it.unit_price)}</td>
              <td className="py-1 text-end font-semibold">{formatEGP(it.line_total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-2 space-y-0.5 text-xs">
        <div className="flex justify-between">
          <span>الإجمالي الفرعي</span>
          <span>{formatEGP(sale.subtotal)}</span>
        </div>
        {Number(sale.discount) > 0 && (
          <div className="flex justify-between">
            <span>الخصم</span>
            <span>{formatEGP(sale.discount)}</span>
          </div>
        )}
        <div className="flex justify-between border-t border-gray-400 pt-1 text-sm font-extrabold">
          <span>الإجمالي</span>
          <span>{formatEGP(sale.total)}</span>
        </div>
        <div className="flex justify-between">
          <span>المدفوع</span>
          <span>{formatEGP(sale.paid_amount)}</span>
        </div>
        {remaining > 0 && (
          <div className="flex justify-between font-bold">
            <span>المتبقي</span>
            <span>{formatEGP(remaining)}</span>
          </div>
        )}
      </div>

      <p className="mt-4 text-center text-xs">شكرًا لتعاملكم معنا</p>
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
