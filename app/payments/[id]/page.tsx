"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { Payment, Customer, Supplier, formatEGP, paymentMethodLabel } from "@/lib/types";
import { useRole } from "@/components/RoleProvider";
import PaymentMethodIcon from "@/components/PaymentMethodIcon";
import { renderReceiptImage, ReceiptImageData } from "@/lib/receiptImage";
import { CalendarDays, CheckCircle2, ChevronRight, Clock, Phone, Printer, Receipt, Share2, User } from "lucide-react";

function formatReceiptDate(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-EG", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
}

function formatReceiptTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" });
}

// إيصال دفعة: تحصيل من عميل (customer_id) أو سداد لمورد (supplier_id)
export default function PaymentReceiptPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { isOwner, roleLoaded } = useRole();
  const [payment, setPayment] = useState<Payment | null>(null);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [sharing, setSharing] = useState(false);
  const [imageState, setImageState] = useState<"preparing" | "ready" | "failed">("preparing");
  const [imageErr, setImageErr] = useState("");
  const imageRef = useRef<File | null>(null);

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  async function load() {
    setLoading(true);
    const { data: p } = await supabase.from("payments").select("*").eq("id", params.id).single();
    const pay = (p as Payment) ?? null;
    setPayment(pay);
    if (pay?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", pay.customer_id).single();
      setCustomer((c as Customer) ?? null);
    } else if (pay?.supplier_id) {
      const { data: s } = await supabase.from("suppliers").select("*").eq("id", pay.supplier_id).single();
      setSupplier((s as Supplier) ?? null);
    }
    setLoading(false);
  }

  function flash(msg: string, ms = 3500) {
    setNotice(msg);
    setTimeout(() => setNotice(""), ms);
  }

  const isSupplier = !!payment?.supplier_id;
  const title = isSupplier ? "سند سداد لمورد" : "إيصال استلام دفعة";
  const partyLabel = isSupplier ? "المورد" : "العميل";
  const partyName = (isSupplier ? supplier?.name : customer?.name) || partyLabel;
  const phone = (isSupplier ? supplier?.phone : customer?.phone) ?? null;
  const method = payment?.payment_method ?? null;
  const methodLabel = paymentMethodLabel(method);
  const balanceAfter = payment?.balance_after != null ? Number(payment.balance_after) : null;
  const balanceBefore = balanceAfter != null && payment ? balanceAfter + Number(payment.amount) : null;
  const beforeLabel = isSupplier ? "المستحق للمورد قبل الدفعة" : "المديونية قبل الدفعة";
  const afterLabel = isSupplier ? "المتبقي للمورد" : "المتبقي من المديونية";

  function buildReceiptText(): string {
    if (!payment) return "";
    const lines: string[] = [];
    lines.push(`🧾 ${brand.name}`);
    lines.push(title);
    lines.push(`التاريخ: ${formatReceiptDate(payment.created_at)} - ${formatReceiptTime(payment.created_at)}`);
    lines.push(`${partyLabel}: ${partyName}`);
    if (methodLabel) lines.push(`طريقة الدفع: ${methodLabel}`);
    lines.push("────────────");
    if (balanceBefore != null) lines.push(`${beforeLabel}: ${formatEGP(balanceBefore)}`);
    lines.push(`المبلغ المدفوع: ${formatEGP(payment.amount)}`);
    if (balanceAfter != null) lines.push(`${afterLabel}: ${formatEGP(balanceAfter)}`);
    lines.push("شكرًا لتعاملكم معنا 🙏");
    return lines.join("\n");
  }

  function buildImageData(): ReceiptImageData | null {
    if (!payment) return null;
    const p = brand.palette;
    return {
      brandName: brand.name,
      logoUrl: brand.icon192,
      palette: { dark: p.dark, c600: p[600], c500: p[500], c100: p[100], c50: p[50] },
      title,
      partyLabel,
      partyName,
      phone,
      dateLabel: formatReceiptDate(payment.created_at),
      timeLabel: formatReceiptTime(payment.created_at),
      paymentMethodLabel: methodLabel,
      paymentMethodKey: method,
      paymentLogoUrl: method === "instapay" || method === "wallet" ? `/payment/${method}.png` : null,
      amountLabel: "المبلغ المدفوع",
      amount: formatEGP(payment.amount),
      rowsBefore: balanceBefore != null ? [{ label: beforeLabel, value: formatEGP(balanceBefore) }] : [],
      rowsAfter: balanceAfter != null ? [{ label: afterLabel, value: formatEGP(balanceAfter), danger: balanceAfter > 0 }] : [],
      note: payment.note,
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
    const text = buildReceiptText();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash("تم نسخ الإيصال، الصقه في واتساب أو أي تطبيق");
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      flash("تعذّرت المشاركة على هذا الجهاز");
    }
  }

  // الصورة بتتجهّز مسبقًا أول ما الصفحة تفتح (سفاري على الآيفون بيرفض المشاركة لو اتأخرنا بعد الضغطة)
  async function shareReceipt(hint?: string) {
    if (!payment) return;
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
        const blob = await renderReceiptImage(data);
        file = new File([blob], `receipt-${payment.id.slice(0, 8)}.png`, { type: "image/png" });
        imageRef.current = file;
      }
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title });
        if (hint) flash(hint);
        return;
      }
      downloadBlob(file, file.name);
      flash("تم تحميل صورة الإيصال، أرفقها في واتساب");
    } catch (e) {
      const err = e as { name?: string; message?: string } | null;
      if (err?.name === "AbortError") return;
      setImageErr(`${err?.name || "Error"}: ${err?.message || ""}`);
      setImageState("failed");
      flash("تعذّر إرسال الصورة — اتبعتت كنص", 15000);
      await shareText();
    } finally {
      setSharing(false);
    }
  }

  useEffect(() => {
    if (loading || !payment) return;
    let cancelled = false;
    imageRef.current = null;
    setImageState("preparing");
    setImageErr("");
    const data = buildImageData();
    if (!data) return;
    renderReceiptImage(data)
      .then((blob) => {
        if (cancelled) return;
        imageRef.current = new File([blob], `receipt-${payment.id.slice(0, 8)}.png`, { type: "image/png" });
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
  }, [loading, payment, customer, supplier]);

  // على التطبيق المثبّت على شاشة الآيفون window.print() مش بتشتغل: بنفتح قايمة المشاركة (فيها "طباعة")
  function printReceipt() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && standalone) {
      void shareReceipt("اختر «طباعة» من القائمة");
      return;
    }
    window.print();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!payment) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">الإيصال غير موجود</p>;
  if (isSupplier && roleLoaded && !isOwner) {
    return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">ليس لديك صلاحية للوصول لهذه الصفحة</p>;
  }

  return (
    <div>
      <div className="print:hidden">
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
              <Receipt className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">{title}</h1>
              <p className="truncate text-xs text-white/70">{partyName}</p>
            </div>
          </div>
        </header>

        <div className="space-y-3 p-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
              <CheckCircle2 className="h-3.5 w-3.5" />
              تم الدفع
            </span>
          </div>

          <div className="space-y-1.5 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
              <User className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <span className="truncate">{partyName}</span>
            </p>
            {phone && (
              <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
                <span dir="ltr">{phone}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
              {formatReceiptDate(payment.created_at)}
            </p>
            <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <Clock className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
              {formatReceiptTime(payment.created_at)}
            </p>
            {methodLabel && (
              <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <PaymentMethodIcon method={method} className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                طريقة الدفع: {methodLabel}
              </p>
            )}
          </div>

          <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {balanceBefore != null && <Row label={beforeLabel} value={formatEGP(balanceBefore)} />}
            <div className="flex items-center justify-between gap-2 rounded-xl bg-emerald-50 p-3 dark:bg-emerald-500/10">
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">المبلغ المدفوع</span>
              <span className="text-lg font-extrabold text-emerald-700 dark:text-emerald-300">{formatEGP(payment.amount)}</span>
            </div>
            {balanceAfter != null ? (
              <Row label={afterLabel} value={formatEGP(balanceAfter)} bold tone={balanceAfter > 0 ? "danger" : "default"} />
            ) : (
              <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">
                دفعة قديمة: المتبقي وقت الدفع مش متسجل
              </p>
            )}
            {payment.note && <p className="text-xs text-gray-500 dark:text-gray-400">ملاحظة: {payment.note}</p>}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void shareReceipt()}
              disabled={sharing}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white active:opacity-90 disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {sharing ? "جارِ التجهيز..." : "مشاركة"}
            </button>
            <button
              onClick={printReceipt}
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
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">جارِ تجهيز صورة الإيصال…</p>
          )}
          {imageState === "failed" && (
            <p className="break-words text-center text-[11px] text-amber-700 dark:text-amber-300">
              تعذّر تجهيز الصورة: <span dir="ltr">{imageErr}</span>
            </p>
          )}
        </div>
      </div>

      {/* نسخة الطباعة: بتظهر عند الطباعة فقط */}
      <div dir="rtl" className="hidden bg-white p-4 text-black print:block">
        <div className="text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={brand.icon192} alt={brand.shortName} className="mx-auto h-14 w-14 rounded-xl object-cover" />
          <h1 className="mt-1 text-xl font-extrabold">{brand.name}</h1>
          <p className="text-sm">{title}</p>
        </div>
        <div className="mt-3 space-y-0.5 border-y border-gray-400 py-2 text-xs">
          <p>
            {partyLabel}: {partyName}
          </p>
          {phone && (
            <p>
              الهاتف: <span dir="ltr">{phone}</span>
            </p>
          )}
          <p>
            التاريخ: {formatReceiptDate(payment.created_at)} - {formatReceiptTime(payment.created_at)}
          </p>
          {methodLabel && <p>طريقة الدفع: {methodLabel}</p>}
        </div>
        <div className="mt-2 space-y-0.5 text-xs">
          {balanceBefore != null && (
            <div className="flex justify-between">
              <span>{beforeLabel}</span>
              <span>{formatEGP(balanceBefore)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-gray-400 pt-1 text-sm font-extrabold">
            <span>المبلغ المدفوع</span>
            <span>{formatEGP(payment.amount)}</span>
          </div>
          {balanceAfter != null && (
            <div className="flex justify-between font-bold">
              <span>{afterLabel}</span>
              <span>{formatEGP(balanceAfter)}</span>
            </div>
          )}
          {payment.note && <p>ملاحظة: {payment.note}</p>}
        </div>
        <p className="mt-4 text-center text-xs">شكرًا لتعاملكم معنا</p>
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500 dark:text-gray-400">{label}</span>
      <span
        className={`${bold ? "font-bold" : "font-medium"} ${
          tone === "danger" ? "text-red-600 dark:text-red-300" : "text-gray-900 dark:text-gray-100"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
