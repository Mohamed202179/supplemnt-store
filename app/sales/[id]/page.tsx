"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { ops, opError } from "@/lib/ops";
import {
  Sale,
  SaleItem,
  SaleReturn,
  SaleReturnItem,
  Customer,
  PAYMENT_METHODS,
  PaymentMethod,
  formatEGP,
  paymentStatusLabel,
  paymentMethodLabel,
} from "@/lib/types";
import { useRole } from "@/components/RoleProvider";
import { useTheme } from "@/components/ThemeProvider";
import PaymentMethodIcon from "@/components/PaymentMethodIcon";
import { renderInvoiceImage, InvoiceImageData } from "@/lib/invoiceImage";
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
  RotateCcw,
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
  const [returns, setReturns] = useState<SaleReturn[]>([]);
  const [returnItems, setReturnItems] = useState<SaleReturnItem[]>([]);
  const [showReturn, setShowReturn] = useState(false);
  const [retQty, setRetQty] = useState<Record<string, number>>({});
  const [retNote, setRetNote] = useState("");
  const [retMethod, setRetMethod] = useState<PaymentMethod>("cash");
  const [returning, setReturning] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const imageRef = useRef<File | null>(null); // الصورة المجهّزة مسبقًا للمشاركة
  const [imageState, setImageState] = useState<"preparing" | "ready" | "failed">("preparing");
  const [imageErr, setImageErr] = useState("");

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

    if (brand.mode === "v2") {
      const { data: rs } = await supabase.from("sale_returns").select("*").eq("sale_id", params.id).order("created_at");
      const list = (rs ?? []) as SaleReturn[];
      setReturns(list);
      if (list.length > 0) {
        const { data: ri } = await supabase.from("sale_return_items").select("*").in("return_id", list.map((r) => r.id));
        setReturnItems((ri ?? []) as SaleReturnItem[]);
      } else {
        setReturnItems([]);
      }
    }

    if (s?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", s.customer_id).single();
      setCustomer((c as Customer) ?? null);
    } else {
      setCustomer(null);
    }
    setLoading(false);
  }

  // ----- المرتجعات: إجماليات وحسابات -----
  const retNet = returns.reduce((sum, r) => sum + Number(r.net_value), 0);
  const retDebt = returns.reduce((sum, r) => sum + Number(r.debt_reduction), 0);
  const retRefund = returns.reduce((sum, r) => sum + Number(r.refund_amount), 0);
  const returnedByItem = new Map<string, number>();
  for (const ri of returnItems) {
    if (ri.sale_item_id) returnedByItem.set(ri.sale_item_id, (returnedByItem.get(ri.sale_item_id) ?? 0) + Number(ri.quantity));
  }
  const returnableQty = (it: SaleItem) => Number(it.quantity) - (returnedByItem.get(it.id) ?? 0);
  const hasReturnable = items.some((it) => returnableQty(it) > 0);
  const fullyReturned = items.length > 0 && !hasReturnable;
  const remainingAfter = sale ? Math.max(0, Number(sale.remaining_amount) - retDebt) : 0;

  // معاينة المرتجع (نفس معادلة قاعدة البيانات)
  function previewReturn() {
    const round2 = (n: number) => Math.round(n * 100) / 100;
    let itemsValue = 0;
    let count = 0;
    for (const it of items) {
      const q = retQty[it.id] ?? 0;
      if (q > 0) {
        itemsValue += Number(it.unit_price) * q;
        count += 1;
      }
    }
    if (!sale) return { itemsValue, net: 0, debtRed: 0, refund: 0, count };
    const disc = Number(sale.subtotal) > 0 ? round2((Number(sale.discount) * itemsValue) / Number(sale.subtotal)) : 0;
    const net = Math.max(0, Math.min(itemsValue - disc, Number(sale.total) - retNet));
    const debtRed = Math.min(net, remainingAfter);
    return { itemsValue, net, debtRed, refund: net - debtRed, count };
  }

  function changeRetQty(it: SaleItem, delta: number) {
    setRetQty((prev) => {
      const cur = prev[it.id] ?? 0;
      const next = Math.max(0, Math.min(returnableQty(it), cur + delta));
      return { ...prev, [it.id]: next };
    });
  }

  async function submitReturn() {
    if (!sale) return;
    const lines = items
      .filter((it) => (retQty[it.id] ?? 0) > 0)
      .map((it) => ({ sale_item_id: it.id, quantity: retQty[it.id] }));
    if (lines.length === 0) {
      setError("اختر صنفًا وكمية للمرتجع");
      return;
    }
    const pv = previewReturn();
    if (!confirm("تأكيد المرتجع؟ هيرجع المخزون ويتعدل حساب العميل.")) return;
    setError("");
    setReturning(true);
    try {
      await ops.createSaleReturn(sale.id, lines, retNote.trim() || null, pv.refund > 0 ? retMethod : null);
      setShowReturn(false);
      setRetQty({});
      setRetNote("");
      flash("تم تسجيل المرتجع");
      await load();
    } catch (e) {
      setError(opError(e));
    }
    setReturning(false);
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

  function flash(msg: string, ms = 3500) {
    setNotice(msg);
    setTimeout(() => setNotice(""), ms);
  }

  function buildInvoiceText(): string {
    if (!sale) return "";
    const name = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
    const lines: string[] = [];
    lines.push(`🧾 ${brand.name}`);
    lines.push(`فاتورة رقم #${sale.invoice_number}${sale.status === "cancelled" ? " (ملغاة)" : ""}`);
    lines.push(`التاريخ: ${formatInvoiceDate(sale.created_at)} - ${formatInvoiceTime(sale.created_at)}`);
    lines.push(`العميل: ${name}`);
    if (paymentMethodLabel(sale.payment_method)) lines.push(`طريقة الدفع: ${paymentMethodLabel(sale.payment_method)}`);
    lines.push("────────────");
    for (const it of items) {
      lines.push(`• ${it.product_name_snapshot}: ${formatQty(it.quantity)} × ${formatEGP(it.unit_price)} = ${formatEGP(it.line_total)}`);
    }
    lines.push("────────────");
    lines.push(`الإجمالي الفرعي: ${formatEGP(sale.subtotal)}`);
    if (Number(sale.discount) > 0) lines.push(`الخصم: ${formatEGP(sale.discount)}`);
    lines.push(`الإجمالي: ${formatEGP(sale.total)}`);
    lines.push(`المدفوع: ${formatEGP(sale.paid_amount)}`);
    if (retNet > 0) lines.push(`المرتجع: - ${formatEGP(retNet)}`);
    if (remainingAfter > 0) lines.push(`المتبقي: ${formatEGP(remainingAfter)}`);
    lines.push("شكرًا لتعاملكم معنا 🙏");
    return lines.join("\n");
  }

  // بيانات صورة الفاتورة (بتتبعت للعميل كصورة)
  function buildImageData(): InvoiceImageData | null {
    if (!sale) return null;
    const name = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
    const remainingAmt = Math.max(0, Number(sale.remaining_amount) - retDebt);
    const rowsBefore = [{ label: "الإجمالي الفرعي", value: formatEGP(sale.subtotal) }];
    if (Number(sale.discount) > 0) rowsBefore.push({ label: "الخصم", value: `- ${formatEGP(sale.discount)}` });
    const rowsAfter: { label: string; value: string; danger?: boolean }[] = [
      { label: "المدفوع", value: formatEGP(sale.paid_amount) },
    ];
    if (retNet > 0) {
      rowsAfter.push({ label: "المرتجع", value: `- ${formatEGP(retNet)}` });
      rowsAfter.push({ label: "الصافي بعد المرتجع", value: formatEGP(Number(sale.total) - retNet) });
    }
    if (remainingAmt > 0) rowsAfter.push({ label: "المتبقي", value: formatEGP(remainingAmt), danger: true });
    const p = brand.palette;
    return {
      brandName: brand.name,
      logoUrl: brand.icon192,
      palette: { dark: p.dark, c600: p[600], c500: p[500], c100: p[100], c50: p[50] },
      invoiceNumber: Number(sale.invoice_number).toLocaleString("ar-EG", { useGrouping: false }),
      dateLabel: formatInvoiceDate(sale.created_at),
      timeLabel: formatInvoiceTime(sale.created_at),
      customerName: name,
      phone: customer?.phone ?? null,
      paymentMethodLabel: paymentMethodLabel(sale.payment_method),
      paymentMethodKey: sale.payment_method ?? null,
      paymentLogoUrl:
        sale.payment_method === "instapay" || sale.payment_method === "wallet" ? `/payment/${sale.payment_method}.png` : null,
      paymentStatusLabel: paymentStatusLabel(sale.payment_status),
      cancelled: sale.status === "cancelled",
      items: items.map((it) => ({
        name: it.product_name_snapshot,
        qty: formatQty(it.quantity),
        unit: formatEGP(it.unit_price),
        total: formatEGP(it.line_total),
      })),
      rowsBefore,
      total: formatEGP(sale.total),
      rowsAfter,
    };
  }

  function downloadBlob(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  async function shareText() {
    const text = buildInvoiceText();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: `فاتورة #${sale?.invoice_number}`, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash("تم نسخ الفاتورة، الصقها في واتساب أو أي تطبيق");
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      flash("تعذّرت المشاركة على هذا الجهاز");
    }
  }

  // مشاركة الفاتورة كصورة (قايمة المشاركة بتاعة الجهاز: واتساب وغيره).
  // الصورة بتتجهّز مسبقًا أول ما الصفحة تفتح، لأن سفاري على الآيفون بيرفض المشاركة لو اتأخرنا بعد الضغطة.
  async function shareInvoice(hint?: string) {
    if (!sale) return;
    let file = imageRef.current;
    if (!file && imageState === "preparing") {
      flash("جارِ تجهيز الصورة… اضغط مرة أخرى بعد ثانية");
      return;
    }
    try {
      if (!file) {
        setSharing(true);
        const data = buildImageData();
        if (!data) return;
        const blob = await renderInvoiceImage(data);
        file = new File([blob], `invoice-${sale.invoice_number}.png`, { type: "image/png" });
        imageRef.current = file;
      }
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: `فاتورة #${sale.invoice_number}` });
        if (hint) flash(hint);
        return;
      }
      // مفيش مشاركة ملفات (غالبًا كمبيوتر): ننزّل الصورة
      downloadBlob(file, file.name);
      flash("تم تحميل صورة الفاتورة، أرفقها في واتساب");
    } catch (e) {
      const err = e as { name?: string; message?: string } | null;
      if (err?.name === "AbortError") return; // المستخدم قفل نافذة المشاركة
      setImageErr(`${err?.name || "Error"}: ${err?.message || ""}`);
      setImageState("failed");
      flash("تعذّر إرسال الصورة — اتبعتت كنص", 15000);
      await shareText(); // لو الصورة فشلت نبعتها كنص بدل ما نوقف
    } finally {
      setSharing(false);
    }
  }

  // تجهيز الصورة في الخلفية أول ما بيانات الفاتورة تحمّل
  useEffect(() => {
    if (loading || !sale) return;
    let cancelled = false;
    imageRef.current = null;
    setImageState("preparing");
    setImageErr("");
    const data = buildImageData();
    if (!data) return;
    renderInvoiceImage(data)
      .then((blob) => {
        if (cancelled) return;
        imageRef.current = new File([blob], `invoice-${sale.invoice_number}.png`, { type: "image/png" });
        setImageState("ready");
      })
      .catch((e) => {
        if (cancelled) return;
        const err = e as { name?: string; message?: string } | null;
        setImageErr(`${err?.name || "Error"}: ${err?.message || ""}`);
        setImageState("failed");
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, sale, items, customer, returns]);

  // الطباعة: على التطبيق المثبّت على شاشة الآيفون window.print() مش بتشتغل،
  // فبنفتح قايمة المشاركة بصورة الفاتورة (فيها خيار "طباعة"). في باقي الحالات طباعة عادية.
  function printInvoice() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && standalone) {
      void shareInvoice("اختر «طباعة» من القائمة");
      return;
    }
    window.print();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!sale) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">الفاتورة غير موجودة</p>;

  const cancelled = sale.status === "cancelled";
  const customerName = customer?.name || sale.customer_name_snapshot || "عميل نقدي";
  const remaining = remainingAfter;
  const pv = previewReturn();

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
          {returns.length > 0 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-500/20 dark:text-amber-300">
              <RotateCcw className="h-3.5 w-3.5" />
              {fullyReturned ? "مرتجع كامل" : "مرتجع جزئي"}
            </span>
          )}
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
          {paymentMethodLabel(sale.payment_method) && (
            <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <PaymentMethodIcon method={sale.payment_method} className="h-4 w-4 text-gray-500 dark:text-gray-400" />
              طريقة الدفع: {paymentMethodLabel(sale.payment_method)}
            </p>
          )}
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
          {retNet > 0 && <Row label="المرتجع" value={`- ${formatEGP(retNet)}`} />}
          {retNet > 0 && <Row label="الصافي بعد المرتجع" value={formatEGP(Number(sale.total) - retNet)} bold />}
          {retRefund > 0 && <Row label="تم رده للعميل" value={formatEGP(retRefund)} />}
          <Row label="المتبقي" value={formatEGP(remaining)} tone={remaining > 0 ? "danger" : "default"} bold={remaining > 0} />
        </div>

        {/* سجل المرتجعات */}
        {returns.length > 0 && (
          <div className="space-y-2 rounded-2xl border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-500/30 dark:bg-amber-500/10">
            <p className="flex items-center gap-1.5 text-xs font-bold text-amber-800 dark:text-amber-300">
              <RotateCcw className="h-4 w-4" />
              المرتجعات ({returns.length.toLocaleString("ar-EG")})
            </p>
            {returns.map((r) => (
              <div key={r.id} className="rounded-xl bg-white p-2.5 text-xs dark:bg-gray-900">
                <p className="text-gray-500 dark:text-gray-400">
                  {formatInvoiceDate(r.created_at)} · {formatInvoiceTime(r.created_at)}
                </p>
                <ul className="my-1 space-y-0.5">
                  {returnItems
                    .filter((ri) => ri.return_id === r.id)
                    .map((ri) => (
                      <li key={ri.id} className="flex justify-between gap-2">
                        <span className="min-w-0 truncate text-gray-800 dark:text-gray-200">
                          {ri.product_name_snapshot} × {formatQty(ri.quantity)}
                        </span>
                        <span className="shrink-0 font-semibold">{formatEGP(ri.line_total)}</span>
                      </li>
                    ))}
                </ul>
                <p className="font-bold text-gray-900 dark:text-gray-100">صافي المرتجع: {formatEGP(r.net_value)}</p>
                {Number(r.debt_reduction) > 0 && (
                  <p className="text-gray-600 dark:text-gray-300">اتخصم من الدين: {formatEGP(r.debt_reduction)}</p>
                )}
                {Number(r.refund_amount) > 0 && (
                  <p className="text-gray-600 dark:text-gray-300">
                    اتردّ للعميل: {formatEGP(r.refund_amount)}
                    {paymentMethodLabel(r.refund_method) ? ` (${paymentMethodLabel(r.refund_method)})` : ""}
                  </p>
                )}
                {r.note && <p className="text-gray-500 dark:text-gray-400">ملاحظة: {r.note}</p>}
              </div>
            ))}
          </div>
        )}

        {/* مرتجع جزئي (المالك فقط، في البراندات الجديدة) */}
        {brand.mode === "v2" && isOwner && sale.status === "completed" && hasReturnable && (
          <>
            {!showReturn ? (
              <button
                onClick={() => setShowReturn(true)}
                className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-amber-300 bg-amber-50 py-3 text-sm font-bold text-amber-800 active:bg-amber-100 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-300"
              >
                <RotateCcw className="h-4 w-4" />
                مرتجع جزئي
              </button>
            ) : (
              <div className="space-y-3 rounded-2xl border border-amber-300 bg-amber-50/60 p-3 dark:border-amber-500/40 dark:bg-amber-500/10">
                <p className="text-sm font-bold text-gray-900 dark:text-gray-100">مرتجع جزئي</p>
                <ul className="space-y-2">
                  {items
                    .filter((it) => returnableQty(it) > 0)
                    .map((it) => (
                      <li key={it.id} className="flex items-center justify-between gap-2 rounded-xl bg-white p-2.5 text-sm dark:bg-gray-900">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{it.product_name_snapshot}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            متاح للإرجاع {formatQty(returnableQty(it))} × {formatEGP(it.unit_price)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => changeRetQty(it, -1)}
                            className="h-8 w-8 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            aria-label="تقليل"
                          >
                            −
                          </button>
                          <span className="w-8 text-center font-bold">{formatQty(retQty[it.id] ?? 0)}</span>
                          <button
                            type="button"
                            onClick={() => changeRetQty(it, 1)}
                            className="h-8 w-8 rounded-lg bg-gray-100 text-lg font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                            aria-label="زيادة"
                          >
                            +
                          </button>
                        </div>
                      </li>
                    ))}
                </ul>

                {pv.count > 0 && (
                  <div className="space-y-1 rounded-xl bg-white p-3 text-sm dark:bg-gray-900">
                    <Row label="صافي المرتجع" value={formatEGP(pv.net)} bold />
                    {pv.debtRed > 0 && <Row label="يتخصم من الدين" value={formatEGP(pv.debtRed)} />}
                    {pv.refund > 0 && <Row label="يتردّ للعميل" value={formatEGP(pv.refund)} />}
                  </div>
                )}

                {pv.refund > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-gray-600 dark:text-gray-300">طريقة رد المبلغ</p>
                    <div className="grid grid-cols-3 gap-2">
                      {PAYMENT_METHODS.map((m) => {
                        const active = retMethod === m.value;
                        return (
                          <button
                            key={m.value}
                            type="button"
                            onClick={() => setRetMethod(m.value)}
                            aria-pressed={active}
                            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl border-2 px-1 py-2 text-[11px] font-bold ${
                              active
                                ? "border-brand-600 bg-brand-600 text-white"
                                : "border-gray-200 bg-white text-gray-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
                            }`}
                          >
                            <PaymentMethodIcon method={m.value} className="h-6 w-6" />
                            <span className="max-w-full truncate">{m.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <input
                  value={retNote}
                  onChange={(e) => setRetNote(e.target.value)}
                  placeholder="ملاحظة (اختياري)"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />

                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => void submitReturn()}
                    disabled={returning || pv.count === 0}
                    className="rounded-xl bg-amber-600 py-3 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {returning ? "جارِ الحفظ..." : "تأكيد المرتجع"}
                  </button>
                  <button
                    onClick={() => {
                      setShowReturn(false);
                      setRetQty({});
                    }}
                    className="rounded-xl bg-gray-100 py-3 text-sm font-bold text-gray-700 dark:bg-gray-800 dark:text-gray-200"
                  >
                    إلغاء
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* مشاركة وطباعة */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => void shareInvoice()}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white active:opacity-90 disabled:opacity-60"
          >
            <Share2 className="h-4 w-4" />
            {sharing ? "جارِ التجهيز..." : "مشاركة"}
          </button>
          <button
            onClick={printInvoice}
            disabled={sharing}
            className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white py-3 text-sm font-bold text-gray-700 active:bg-gray-50 disabled:opacity-60 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200"
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
        {imageState === "preparing" && (
          <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">جارِ تجهيز صورة الفاتورة…</p>
        )}
        {imageState === "failed" && (
          <p className="break-words text-center text-[11px] text-amber-700 dark:text-amber-300">
            تعذّر تجهيز الصورة: <span dir="ltr">{imageErr}</span>
          </p>
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
        returnedNet={retNet}
        remainingAfter={remainingAfter}
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
  returnedNet,
  remainingAfter,
}: {
  sale: Sale;
  items: SaleItem[];
  customerName: string;
  phone: string | null;
  returnedNet: number;
  remainingAfter: number;
}) {
  const cancelled = sale.status === "cancelled";
  const remaining = remainingAfter;
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
        {paymentMethodLabel(sale.payment_method) && <p>طريقة الدفع: {paymentMethodLabel(sale.payment_method)}</p>}
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
        {returnedNet > 0 && (
          <div className="flex justify-between">
            <span>المرتجع</span>
            <span>- {formatEGP(returnedNet)}</span>
          </div>
        )}
        {returnedNet > 0 && (
          <div className="flex justify-between font-bold">
            <span>الصافي بعد المرتجع</span>
            <span>{formatEGP(Number(sale.total) - returnedNet)}</span>
          </div>
        )}
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
