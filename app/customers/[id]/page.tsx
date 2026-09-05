"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Customer, Sale, Payment, formatEGP, formatDate } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
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
    const [{ data: c }, { data: s }, { data: p }] = await Promise.all([
      supabase.from("customers").select("*").eq("id", params.id).single(),
      supabase
        .from("sales")
        .select("*")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("payments")
        .select("*")
        .eq("customer_id", params.id)
        .order("created_at", { ascending: false }),
    ]);
    setCustomer((c as Customer) ?? null);
    setSales((s ?? []) as Sale[]);
    setPayments((p ?? []) as Payment[]);
    setLoading(false);
  }

  async function recordPayment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!customer || !value || value <= 0) {
      setError("أدخل مبلغًا صحيحًا");
      return;
    }
    if (value > customer.current_debt) {
      setError(`المبلغ أكبر من المديونية الحالية (${formatEGP(customer.current_debt)})`);
      return;
    }

    setSaving(true);
    const { error: payErr } = await supabase.from("payments").insert({
      customer_id: customer.id,
      amount: value,
    });

    if (payErr) {
      setSaving(false);
      setError("حدث خطأ أثناء تسجيل الدفعة");
      return;
    }

    await supabase
      .from("customers")
      .update({
        current_debt: customer.current_debt - value,
        last_transaction_at: new Date().toISOString(),
      })
      .eq("id", customer.id);

    setSaving(false);
    setAmount("");
    setShowPayment(false);
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400">جارِ التحميل...</p>;
  if (!customer) return <p className="p-10 text-center text-sm text-gray-400">العميل غير موجود</p>;

  return (
    <div>
      <PageHeader title={customer.name} />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-400">{customer.phone || "بدون رقم هاتف"}</p>
          {customer.notes && <p className="mt-1 text-xs text-gray-500">{customer.notes}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 p-3">
              <p className="text-xs text-gray-400">إجمالي المشتريات</p>
              <p className="mt-1 font-bold text-gray-900">{formatEGP(customer.total_purchases)}</p>
            </div>
            <div className="rounded-xl bg-red-50 p-3">
              <p className="text-xs text-red-400">الرصيد المستحق</p>
              <p className="mt-1 font-bold text-red-600">{formatEGP(customer.current_debt)}</p>
            </div>
          </div>

          {customer.current_debt > 0 && (
            <button
              onClick={() => setShowPayment((s) => !s)}
              className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white"
            >
              {showPayment ? "إغلاق" : "تسجيل دفعة"}
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
          <h2 className="mb-2 text-sm font-bold text-gray-900">سجل المبيعات</h2>
          {sales.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400">لا توجد مبيعات مسجلة</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {sales.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500">
                      {formatDate(s.created_at)}{" "}
                      {s.status === "cancelled" && <span className="text-red-500">(ملغاة)</span>}
                    </span>
                    <span className="font-bold text-gray-900">{formatEGP(s.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400">
                    مدفوع {formatEGP(s.paid_amount)} · متبقي {formatEGP(s.remaining_amount)}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
