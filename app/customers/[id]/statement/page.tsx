"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { Customer, formatEGP, paymentMethodLabel } from "@/lib/types";
import { renderStatementImage, StatementImageData } from "@/lib/statementImage";
import { CalendarDays, ChevronRight, FileText, Phone, Printer, Share2, User } from "lucide-react";

// حركة واحدة على مديونية العميل: فاتورة (عليه) أو دفعة / مرتجع (له)
interface Entry {
  id: string;
  at: string;
  desc: string;
  detail?: string;
  debit: number;
  credit: number;
  href?: string;
}
interface Row extends Entry {
  balance: number;
  zero: boolean;
}

const MAX_IMG_ROWS = 120; // الصورة بتعرض آخر عدد حركات بس عشان ماتبقاش طويلة جدًا
const r2 = (n: number) => Math.round(n * 100) / 100;
const num = (n: number) => Number(n).toLocaleString("ar-EG", { maximumFractionDigits: 2 });
const shortDate = (iso: string) => new Date(iso).toLocaleDateString("ar-EG", { day: "numeric", month: "numeric", year: "2-digit" });
const longDate = (iso: string) => new Date(iso).toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });
const inputDate = (s: string) => new Date(s + "T00:00:00").toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric" });

export default function CustomerStatementPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [showPaid, setShowPaid] = useState(false);
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
    const [{ data: c }, { data: s }, { data: p }, { data: r }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", params.id).single(),
      supabase
        .from("sales")
        .select("id, invoice_number, created_at, total, paid_amount, remaining_amount")
        .eq("customer_id", params.id)
        .eq("status", "completed"),
      supabase.from("payments").select("*").eq("customer_id", params.id),
      brand.mode === "v2"
        ? supabase
            .from("sale_returns")
            .select("id, return_number, sale_id, debt_reduction, created_at, sales(invoice_number, status)")
            .eq("customer_id", params.id)
        : Promise.resolve({ data: [] as unknown[] }),
    ]);
    setCustomer((c as Customer) ?? null);

    const list: Entry[] = [];
    for (const x of (s ?? []) as any[]) {
      const remaining = Number(x.remaining_amount) || 0;
      list.push({
        id: `s-${x.id}`,
        at: x.created_at,
        desc: `فاتورة #${x.invoice_number}`,
        detail: `إجمالي ${num(Number(x.total))} · مدفوع ${num(Number(x.paid_amount))}`,
        debit: remaining,
        credit: 0,
        href: `/sales/${x.id}`,
      });
    }
    for (const x of (p ?? []) as any[]) {
      if (x.status === "cancelled") continue; // الدفعة الملغاة أثرها صفر
      const label = paymentMethodLabel(x.payment_method);
      list.push({
        id: `p-${x.id}`,
        at: x.created_at,
        desc: label ? `دفعة (${label})` : "دفعة",
        debit: 0,
        credit: Number(x.amount) || 0,
        href: brand.mode === "v2" ? `/payments/${x.id}` : undefined,
      });
    }
    for (const x of (r ?? []) as any[]) {
      if (x.sales?.status === "cancelled") continue; // فاتورة ملغاة: الفاتورة ومرتجعها أثرهم صفر
      const red = Number(x.debt_reduction) || 0;
      if (red <= 0) continue;
      list.push({
        id: `r-${x.id}`,
        at: x.created_at,
        desc: `مرتجع من فاتورة #${x.sales?.invoice_number ?? ""}`.trim(),
        debit: 0,
        credit: red,
        href: `/sales/${x.sale_id}`,
      });
    }
    list.sort((a, b) => new Date(a.at).getTime() - new Date(b.at).getTime());
    setEntries(list);
    setLoading(false);
  }

  function flash(msg: string, ms = 3500) {
    setNotice(msg);
    setTimeout(() => setNotice(""), ms);
  }

  // الرصيد الجاري: بيبدأ من "رصيد سابق" = الدين الحالي − صافي كل الحركات (عشان الكشف دايمًا يقفل على الدين الحقيقي)
  const view = useMemo(() => {
    if (!customer) return null;
    const net = entries.reduce((sum, e) => sum + e.debit - e.credit, 0);
    let bal = r2(Number(customer.current_debt) - net);
    if (Math.abs(bal) < 0.01) bal = 0;
    const fromMs = from ? new Date(from + "T00:00:00").getTime() : null;
    const toMs = to ? new Date(to + "T23:59:59.999").getTime() : null;
    let startBalance = bal;
    const rows: Row[] = [];
    for (const e of entries) {
      const t = new Date(e.at).getTime();
      if (toMs !== null && t > toMs) break;
      bal = r2(bal + e.debit - e.credit);
      if (fromMs !== null && t < fromMs) {
        startBalance = bal;
        continue;
      }
      rows.push({ ...e, balance: bal, zero: e.debit === 0 && e.credit === 0 });
    }
    const visible = showPaid ? rows : rows.filter((r) => !r.zero);
    const closing = rows.length ? rows[rows.length - 1].balance : startBalance;
    return {
      startBalance,
      rows: visible,
      totalDebit: r2(visible.reduce((s, r) => s + r.debit, 0)),
      totalCredit: r2(visible.reduce((s, r) => s + r.credit, 0)),
      closing,
    };
  }, [customer, entries, from, to, showPaid]);

  const periodLabel =
    from || to ? `من ${from ? inputDate(from) : "البداية"} إلى ${to ? inputDate(to) : "اليوم"}` : "كل الفترات";
  const closingLabel = to ? "الرصيد في نهاية الفترة" : "الرصيد المستحق";

  function buildImageData(): StatementImageData | null {
    if (!customer || !view) return null;
    const p = brand.palette;
    let rows = view.rows;
    let opening = view.startBalance;
    let note: string | null = null;
    if (rows.length > MAX_IMG_ROWS) {
      const first = rows[rows.length - MAX_IMG_ROWS];
      opening = r2(first.balance - first.debit + first.credit);
      rows = rows.slice(-MAX_IMG_ROWS);
      note = `معروض آخر ${MAX_IMG_ROWS} حركة، والرصيد السابق يشمل الحركات الأقدم`;
    }
    const hasOpening = Math.abs(opening) >= 0.01;
    return {
      brandName: brand.name,
      logoUrl: brand.icon192,
      palette: { dark: p.dark, c600: p[600], c500: p[500], c100: p[100], c50: p[50] },
      customerName: customer.name,
      phone: customer.phone,
      periodLabel,
      printedAt: longDate(new Date().toISOString()),
      openingLabel: hasOpening ? "رصيد سابق" : null,
      openingValue: hasOpening ? num(opening) : null,
      rows: rows.map((r) => ({
        date: shortDate(r.at),
        desc: r.desc,
        debit: r.debit > 0 ? num(r.debit) : "",
        credit: r.credit > 0 ? num(r.credit) : "",
        balance: num(r.balance),
      })),
      totalDebit: formatEGP(view.totalDebit),
      totalCredit: formatEGP(view.totalCredit),
      closingLabel,
      closingValue: formatEGP(view.closing),
      closingDanger: view.closing > 0,
      note,
    };
  }

  function buildText(): string {
    if (!customer || !view) return "";
    const lines: string[] = [`🧾 ${brand.name}`, "كشف حساب", `العميل: ${customer.name}`, `الفترة: ${periodLabel}`, "────────────"];
    const rows = view.rows.slice(-30);
    if (view.rows.length > rows.length) lines.push("(آخر 30 حركة)");
    for (const r of rows) {
      const amt = r.debit > 0 ? `+${num(r.debit)}` : r.credit > 0 ? `-${num(r.credit)}` : "0";
      lines.push(`${shortDate(r.at)} | ${r.desc} | ${amt} | الرصيد ${num(r.balance)}`);
    }
    lines.push("────────────", `${closingLabel}: ${formatEGP(view.closing)}`, "شكرًا لتعاملكم معنا 🙏");
    return lines.join("\n");
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
    const text = buildText();
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({ title: "كشف حساب", text });
        return;
      }
      await navigator.clipboard.writeText(text);
      flash("تم نسخ الكشف، الصقه في واتساب أو أي تطبيق");
    } catch (e) {
      if ((e as { name?: string } | null)?.name === "AbortError") return;
      flash("تعذّرت المشاركة على هذا الجهاز");
    }
  }

  // الصورة بتتجهّز مسبقًا (سفاري على الآيفون بيرفض المشاركة لو اتأخرنا بعد الضغطة)
  async function shareStatement(hint?: string) {
    if (!customer) return;
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
        const blob = await renderStatementImage(data);
        file = new File([blob], `statement-${customer.name}.png`, { type: "image/png" });
        imageRef.current = file;
      }
      if (typeof navigator !== "undefined" && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({ files: [file], title: "كشف حساب" });
        if (hint) flash(hint);
        return;
      }
      downloadBlob(file, file.name);
      flash("تم تحميل صورة الكشف، أرفقها في واتساب");
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
    if (loading || !customer || !view) return;
    let cancelled = false;
    imageRef.current = null;
    setImageState("preparing");
    setImageErr("");
    const data = buildImageData();
    if (!data) return;
    renderStatementImage(data)
      .then((blob) => {
        if (cancelled) return;
        imageRef.current = new File([blob], `statement-${customer.name}.png`, { type: "image/png" });
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
  }, [loading, customer, view]);

  // على التطبيق المثبّت على شاشة الآيفون window.print() مش بتشتغل: بنفتح قايمة المشاركة (فيها "طباعة")
  function printStatement() {
    const ua = navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    if (isIOS && standalone) {
      void shareStatement("اختر «طباعة» من القائمة");
      return;
    }
    window.print();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!customer || !view) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">العميل غير موجود</p>;

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
              <FileText className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="truncate text-xl font-bold">كشف حساب</h1>
              <p className="truncate text-xs text-white/70">{customer.name}</p>
            </div>
          </div>
        </header>

        <div className="space-y-3 p-4">
          <div className="space-y-1.5 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <p className="flex items-center gap-1.5 font-bold text-gray-900 dark:text-gray-100">
              <User className="h-4 w-4 shrink-0 text-gray-500 dark:text-gray-400" />
              <span className="truncate">{customer.name}</span>
            </p>
            {customer.phone && (
              <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
                <Phone className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
                <span dir="ltr">{customer.phone}</span>
              </p>
            )}
            <p className="flex items-center gap-1.5 text-xs text-gray-600 dark:text-gray-300">
              <CalendarDays className="h-3.5 w-3.5 shrink-0 text-gray-500 dark:text-gray-400" />
              {periodLabel}
            </p>
          </div>

          {/* الفترة */}
          <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="grid grid-cols-2 gap-2">
              <label className="text-xs text-gray-500 dark:text-gray-400">
                من
                <input
                  type="date"
                  value={from}
                  max={to || undefined}
                  onChange={(e) => setFrom(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
              <label className="text-xs text-gray-500 dark:text-gray-400">
                إلى
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  onChange={(e) => setTo(e.target.value)}
                  className="mt-1 w-full rounded-xl border border-gray-200 px-2 py-2 text-sm dark:border-gray-700 dark:bg-gray-800 dark:text-gray-100"
                />
              </label>
            </div>
            <div className="flex items-center justify-between gap-2">
              <label className="flex items-center gap-2 text-xs text-gray-600 dark:text-gray-300">
                <input type="checkbox" checked={showPaid} onChange={(e) => setShowPaid(e.target.checked)} />
                إظهار الفواتير المدفوعة بالكامل
              </label>
              {(from || to) && (
                <button
                  onClick={() => {
                    setFrom("");
                    setTo("");
                  }}
                  className="text-xs font-bold text-brand-700 dark:text-brand-300"
                >
                  كل الفترات
                </button>
              )}
            </div>
          </div>

          {/* الحركات */}
          <div className="rounded-2xl border border-gray-100 bg-white p-3 shadow-sm dark:border-gray-800 dark:bg-gray-900">
            {Math.abs(view.startBalance) >= 0.01 && (
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 text-sm dark:border-gray-800">
                <span className="font-bold text-gray-700 dark:text-gray-200">{from ? "رصيد أول الفترة" : "رصيد سابق"}</span>
                <span className="font-bold text-gray-900 dark:text-gray-100">{formatEGP(view.startBalance)}</span>
              </div>
            )}
            {view.rows.length === 0 ? (
              <p className="py-6 text-center text-xs text-gray-400 dark:text-gray-500">لا توجد حركات في هذه الفترة</p>
            ) : (
              <ul className="divide-y divide-gray-100 dark:divide-gray-800">
                {view.rows.map((r) => {
                  const inner = (
                    <>
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-gray-900 dark:text-gray-100">{r.desc}</p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">
                          {shortDate(r.at)}
                          {r.detail ? ` · ${r.detail}` : ""}
                        </p>
                      </div>
                      <div className="shrink-0 text-end">
                        <p
                          className={`font-bold ${
                            r.debit > 0 ? "text-red-600 dark:text-red-300" : r.credit > 0 ? "text-emerald-600 dark:text-emerald-300" : "text-gray-400"
                          }`}
                        >
                          {r.debit > 0 ? `+ ${num(r.debit)}` : r.credit > 0 ? `− ${num(r.credit)}` : "—"}
                        </p>
                        <p className="text-[11px] text-gray-400 dark:text-gray-500">الرصيد {num(r.balance)}</p>
                      </div>
                    </>
                  );
                  return (
                    <li key={r.id}>
                      {r.href ? (
                        <Link href={r.href} className="flex items-start justify-between gap-3 py-2.5 text-sm active:opacity-70">
                          {inner}
                        </Link>
                      ) : (
                        <div className="flex items-start justify-between gap-3 py-2.5 text-sm">{inner}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {/* الملخص */}
          <div className="space-y-2 rounded-2xl border border-gray-100 bg-white p-3 text-sm shadow-sm dark:border-gray-800 dark:bg-gray-900">
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">إجمالي عليه (فواتير)</span>
              <span className="font-medium text-red-600 dark:text-red-300">{formatEGP(view.totalDebit)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-500 dark:text-gray-400">إجمالي له (دفعات ومرتجع)</span>
              <span className="font-medium text-emerald-600 dark:text-emerald-300">{formatEGP(view.totalCredit)}</span>
            </div>
            <div
              className={`flex items-center justify-between rounded-xl p-3 ${
                view.closing > 0 ? "bg-red-50 dark:bg-red-500/10" : "bg-emerald-50 dark:bg-emerald-500/10"
              }`}
            >
              <span className="text-sm font-bold text-gray-900 dark:text-gray-100">{closingLabel}</span>
              <span
                className={`text-lg font-extrabold ${
                  view.closing > 0 ? "text-red-600 dark:text-red-300" : "text-emerald-700 dark:text-emerald-300"
                }`}
              >
                {formatEGP(view.closing)}
              </span>
            </div>
            <p className="text-[11px] text-gray-400 dark:text-gray-500">
              الفواتير المدفوعة كاش بالكامل مش بتظهر لأنها مفيهاش مديونية (فعّل الخيار اللي فوق لو عايزها).
            </p>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => void shareStatement()}
              disabled={sharing}
              className="flex items-center justify-center gap-2 rounded-xl bg-brand-600 py-3 text-sm font-bold text-white active:opacity-90 disabled:opacity-60"
            >
              <Share2 className="h-4 w-4" />
              {sharing ? "جارِ التجهيز..." : "مشاركة"}
            </button>
            <button
              onClick={printStatement}
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
            <p className="text-center text-[11px] text-gray-400 dark:text-gray-500">جارِ تجهيز صورة الكشف…</p>
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
          <p className="text-sm">كشف حساب</p>
        </div>
        <div className="mt-3 space-y-0.5 border-y border-gray-400 py-2 text-xs">
          <p>العميل: {customer.name}</p>
          {customer.phone && (
            <p>
              الهاتف: <span dir="ltr">{customer.phone}</span>
            </p>
          )}
          <p>الفترة: {periodLabel}</p>
          <p>تاريخ الكشف: {longDate(new Date().toISOString())}</p>
        </div>
        <table className="mt-2 w-full border-collapse text-[11px]">
          <thead>
            <tr className="border-b border-gray-500 text-right">
              <th className="py-1">التاريخ</th>
              <th className="py-1">البيان</th>
              <th className="py-1">عليه</th>
              <th className="py-1">له</th>
              <th className="py-1">الرصيد</th>
            </tr>
          </thead>
          <tbody>
            {Math.abs(view.startBalance) >= 0.01 && (
              <tr className="border-b border-gray-300 font-bold">
                <td className="py-1" />
                <td className="py-1">{from ? "رصيد أول الفترة" : "رصيد سابق"}</td>
                <td />
                <td />
                <td className="py-1">{num(view.startBalance)}</td>
              </tr>
            )}
            {view.rows.map((r) => (
              <tr key={r.id} className="border-b border-gray-300">
                <td className="py-1">{shortDate(r.at)}</td>
                <td className="py-1">{r.desc}</td>
                <td className="py-1">{r.debit > 0 ? num(r.debit) : ""}</td>
                <td className="py-1">{r.credit > 0 ? num(r.credit) : ""}</td>
                <td className="py-1">{num(r.balance)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2 space-y-0.5 text-xs">
          <div className="flex justify-between">
            <span>إجمالي عليه (فواتير)</span>
            <span>{formatEGP(view.totalDebit)}</span>
          </div>
          <div className="flex justify-between">
            <span>إجمالي له (دفعات ومرتجع)</span>
            <span>{formatEGP(view.totalCredit)}</span>
          </div>
          <div className="flex justify-between border-t border-gray-400 pt-1 text-sm font-extrabold">
            <span>{closingLabel}</span>
            <span>{formatEGP(view.closing)}</span>
          </div>
        </div>
        <p className="mt-4 text-center text-xs">شكرًا لتعاملكم معنا</p>
      </div>
    </div>
  );
}
