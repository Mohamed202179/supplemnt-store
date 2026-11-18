"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { ops, opError } from "@/lib/ops";
import { Customer, Sale, Payment, PaymentMethod, formatEGP, formatDate, paymentMethodLabel } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import PaymentMethodPicker from "@/components/PaymentMethodPicker";
import PaymentMethodIcon from "@/components/PaymentMethodIcon";

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPayment, setShowPayment] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
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

    if (brand.mode === "v2") {
      let paymentId: string;
      try {
        paymentId = await ops.customerPayment(customer.id, value, null, method);
      } catch (e) {
        setSaving(false);
        setError(opError(e));
        return;
      }
      setSaving(false);
      setAmount("");
      setMethod("cash");
      setShowPayment(false);
      load();
      router.push(`/payments/${paymentId}`); // إيصال الدفعة (طباعة / مشاركة)
      return;
    }

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

  if (loading) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>;
  if (!customer) return <p className="p-10 text-center text-sm text-gray-400 dark:text-gray-500">العميل غير موجود</p>;

  return (
    <div>
      <PageHeader showBack title={customer.name} />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
          <p className="text-xs text-gray-400 dark:text-gray-500">{customer.phone || "بدون رقم هاتف"}</p>
          {customer.notes && <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{customer.notes}</p>}

          <div className="mt-3 grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
              <p className="text-xs text-gray-400 dark:text-gray-500">إجمالي المشتريات</p>
              <p className="mt-1 font-bold text-gray-900 dark:text-gray-100">{formatEGP(customer.total_purchases)}</p>
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
            <form onSubmit={recordPayment} className="mt-3 space-y-2 border-t border-gray-100 dark:border-gray-800 pt-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <input
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                step="0.01"
                placeholder="المبلغ المدفوع"
                className="w-full rounded-xl border border-gray-200 dark:border-gray-700 px-4 py-3 text-sm dark:bg-gray-800 dark:text-gray-100"
              />
              {brand.mode === "v2" && <PaymentMethodPicker value={method} onChange={setMethod} />}
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

        <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">سجل المدفوعات</h2>
          {brand.mode === "v2" && payments.length > 0 && (
            <p className="mb-1 text-[11px] text-gray-400 dark:text-gray-500">اضغط على أي دفعة لفتح إيصالها وطباعته</p>
          )}
          {payments.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">لا توجد مدفوعات مسجلة</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {payments.map((p) => {
                const inner = (
                  <div className={`flex w-full items-center justify-between ${p.status === "cancelled" ? "line-through opacity-50" : ""}`}>
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {formatDate(p.created_at)}
                      {p.status === "cancelled" && <span className="ms-2 text-[11px] font-bold text-red-500">ملغاة</span>}
                    </span>
                    <span className="flex items-center gap-2">
                      {paymentMethodLabel(p.payment_method) && (
                        <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
                          <PaymentMethodIcon method={p.payment_method} className="h-4 w-4" />
                          {paymentMethodLabel(p.payment_method)}
                        </span>
                      )}
                      <span className="text-start">
                        <span className="block font-bold text-brand-700">{formatEGP(p.amount)}</span>
                        {p.balance_after != null && (
                          <span className="block text-[11px] text-gray-400 dark:text-gray-500">
                            المتبقي {formatEGP(Number(p.balance_after))}
                          </span>
                        )}
                      </span>
                    </span>
                  </div>
                );
                return (
                  <li key={p.id}>
                    {brand.mode === "v2" ? (
                      <Link href={`/payments/${p.id}`} className="flex items-center justify-between py-2 text-sm active:opacity-70">
                        {inner}
                      </Link>
                    ) : (
                      <div className="flex items-center justify-between py-2 text-sm">{inner}</div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-2xl bg-white dark:bg-gray-900 p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900 dark:text-gray-100">سجل المبيعات</h2>
          {sales.length === 0 ? (
            <p className="py-3 text-center text-xs text-gray-400 dark:text-gray-500">لا توجد مبيعات مسجلة</p>
          ) : (
            <ul className="divide-y divide-gray-100 dark:divide-gray-800">
              {sales.map((s) => (
                <li key={s.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                      {formatDate(s.created_at)}{" "}
                      {s.status === "cancelled" && <span className="text-red-500">(ملغاة)</span>}
                    </span>
                    <span className="font-bold text-gray-900 dark:text-gray-100">{formatEGP(s.total)}</span>
                  </div>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
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
