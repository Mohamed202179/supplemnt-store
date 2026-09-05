"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { Supplier, Purchase, Payment, formatEGP, formatDate } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function SupplierDetailPage({ params }: { params: { id: string } }) {
  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: p }, { data: pay }] = await Promise.all([
      supabase.from("suppliers").select("*").eq("id", params.id).single(),
      supabase
        .from("purchases")
        .select("*")
        .eq("supplier_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("supplier_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
    setSupplier((s as Supplier) ?? null);
    setPurchases((p ?? []) as Purchase[]);
    setPayments((pay ?? []) as Payment[]);
    setLoading(false);
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!supplier || !value || value <= 0) {
      setError("أدخل مبلغًا صحيحًا");
      return;
    }
    if (value > supplier.current_debt) {
      setError(`المبلغ أكبر من المستحق الحالي (${formatEGP(supplier.current_debt)})`);
      return;
    }

    setSaving(true);
    const { error: payErr } = await supabase.from("payments").insert({
      supplier_id: supplier.id,
      amount: value,
    });

    if (payErr) {
      setSaving(false);
      setError("حدث خطأ أثناء تسجيل الدفعة");
      return;
    }

    await supabase
      .from("suppliers")
      .update({
        current_debt: supplier.current_debt - value,
        total_paid: supplier.total_paid + value,
      })
      .eq("id", supplier.id);

    setSaving(false);
    setAmount("");
    setShowPayment(false);
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400">جارِ التحميل...</p>;
  if (!supplier) return <p className="p-10 text-center text-sm text-gray-400">المورد غير موجود</p>;

  return (
    <div>
      <PageHeader title={supplier.name} />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">{supplier.company || "-"} {supplier.phone ? `· ${supplier.phone}` : ""}</p>
          {supplier.notes && <p className="mt-1 text-xs text-gray-500">{supplier.notes}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">إجمالي المشتريات منه</p>
              <p className="mt-1 font-bold text-gray-900">{formatEGP(supplier.total_purchases)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-400">المستحق له</p>
              <p className="mt-1 font-bold text-red-600">{formatEGP(supplier.current_debt)}</p>
            </div>
          </div>

          {supplier.current_debt > 0 && (
            <button
              onClick={() => setShowPayment((s) => !s)}
              className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white"
            >
              {showPayment ? "إغلاق" : "تسجيل دفعة له"}
            </button>
          )}

          {showPayment && (
            <form onSubmit={recordPayment} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="المبلغ المدفوع"
                className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
              />
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "جارِ الحفظ..." : "تأكيد الدفع"}
              </button>
            </form>
          )}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900">سجل المدفوعات</h2>
          {payments.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">لا توجد مدفوعات مسجلة</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {payments.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-gray-500">{formatDate(p.created_at)}</span>
                  <span className="font-bold text-brand-700">{formatEGP(p.amount)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900">سجل المشتريات</h2>
          {purchases.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">لا توجد مشتريات مسجلة</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {purchases.map((p) => (
                <li key={p.id} className="py-2 text-sm">
                  <Link href={`/purchases/${p.id}`} className="block">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-500">
                        {formatDate(p.created_at)}{" "}
                        {p.status === "cancelled" && <span className="text-red-500">(ملغاة)</span>}
                      </span>
                      <span className="font-bold text-gray-900">{formatEGP(p.total)}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      مدفوع {formatEGP(p.paid_amount)} · متبقي {formatEGP(p.remaining_amount)}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
