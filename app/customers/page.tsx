"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, Customer } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function CustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // add form
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // edit form
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // quick payment
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [savingPayment, setSavingPayment] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("customers").select("*").order("name");
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  async function addCustomer(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("customers").insert({ name: name.trim(), phone: phone || null, notes: notes || null });
    setSaving(false);
    setName("");
    setPhone("");
    setNotes("");
    setShowForm(false);
    load();
  }

  function startEdit(c: Customer) {
    setError("");
    setPayingId(null);
    setEditingId(c.id);
    setEditName(c.name);
    setEditPhone(c.phone ?? "");
    setEditNotes(c.notes ?? "");
  }

  async function saveEdit(id: string) {
    setError("");
    if (!editName.trim()) {
      setError("اسم العميل مطلوب");
      return;
    }
    setSavingEdit(true);
    const { error: updateErr } = await supabase
      .from("customers")
      .update({ name: editName.trim(), phone: editPhone || null, notes: editNotes || null })
      .eq("id", id);
    setSavingEdit(false);
    if (updateErr) {
      setError("حدث خطأ أثناء حفظ التعديل");
      return;
    }
    setEditingId(null);
    load();
  }

  async function deleteCustomer(c: Customer) {
    const warning =
      c.current_debt > 0
        ? `تنبيه: يوجد دين مستحق على هذا العميل قدره ${formatEGP(c.current_debt)}. حذفه سيفقد تتبع هذا الدين. هل تريد المتابعة؟`
        : "سيتم حذف هذا العميل نهائيًا. فواتير البيع السابقة ستبقى محفوظة لكن بدون ربط بعميل. هل تريد المتابعة؟";
    if (!confirm(warning)) return;
    await supabase.from("customers").delete().eq("id", c.id);
    load();
  }

  function startPayment(c: Customer) {
    setError("");
    setEditingId(null);
    setPayingId(c.id);
    setPayAmount("");
  }

  async function submitPayment(c: Customer) {
    setError("");
    const value = Number(payAmount);
    if (!value || value <= 0) {
      setError("أدخل مبلغًا صحيحًا");
      return;
    }
    if (value > c.current_debt) {
      setError(`المبلغ أكبر من الدين الحالي (${formatEGP(c.current_debt)})`);
      return;
    }

    setSavingPayment(true);
    const { error: payErr } = await supabase.from("payments").insert({
      customer_id: c.id,
      amount: value,
    });

    if (payErr) {
      setSavingPayment(false);
      setError("حدث خطأ أثناء تسجيل الدفعة");
      return;
    }

    await supabase
      .from("customers")
      .update({
        current_debt: c.current_debt - value,
        last_transaction_at: new Date().toISOString(),
      })
      .eq("id", c.id);

    setSavingPayment(false);
    setPayingId(null);
    setPayAmount("");
    load();
  }

  const filtered = useMemo(
    () =>
      customers.filter(
        (c) =>
          !search ||
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search)
      ),
    [customers, search]
  );

  return (
    <div>
      <PageHeader
        title="العملاء"
        action={
          <button
            onClick={() => setShowForm((s) => !s)}
            className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-bold text-white"
          >
            {showForm ? "إغلاق" : "+ إضافة"}
          </button>
        }
      />

      <div className="space-y-3 p-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {showForm && (
          <form onSubmit={addCustomer} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم العميل *"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="رقم الهاتف"
              inputMode="tel"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="ملاحظات (اختياري)"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "جارِ الحفظ..." : "حفظ العميل"}
            </button>
          </form>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو رقم الهاتف..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا يوجد عملاء</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white p-3 shadow-sm">
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم العميل *"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <input
                      value={editPhone}
                      onChange={(e) => setEditPhone(e.target.value)}
                      placeholder="رقم الهاتف"
                      inputMode="tel"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <input
                      value={editNotes}
                      onChange={(e) => setEditNotes(e.target.value)}
                      placeholder="ملاحظات"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(c.id)}
                        disabled={savingEdit}
                        className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingEdit ? "جارِ الحفظ..." : "حفظ"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-bold text-gray-600"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : payingId === c.id ? (
                  <div className="space-y-2">
                    <p className="text-sm font-bold text-gray-900">{c.name}</p>
                    <p className="text-xs text-gray-400">الدين الحالي: {formatEGP(c.current_debt)}</p>
                    <input
                      value={payAmount}
                      onChange={(e) => setPayAmount(e.target.value)}
                      type="number"
                      inputMode="decimal"
                      min={0}
                      step="0.01"
                      placeholder="المبلغ المدفوع"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitPayment(c)}
                        disabled={savingPayment}
                        className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingPayment ? "جارِ الحفظ..." : "تأكيد الدفع"}
                      </button>
                      <button
                        onClick={() => setPayingId(null)}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-bold text-gray-600"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link href={`/customers/${c.id}`} className="block active:opacity-70">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{c.name}</p>
                          <p className="text-xs text-gray-400">{c.phone || "بدون رقم هاتف"}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-400">الرصيد المستحق</p>
                          <p className={`font-bold ${c.current_debt > 0 ? "text-red-600" : "text-brand-700"}`}>
                            {formatEGP(c.current_debt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2">
                      {c.current_debt > 0 && (
                        <button
                          onClick={() => startPayment(c)}
                          className="flex-1 rounded-lg bg-brand-50 py-2 text-center text-xs font-semibold text-brand-700"
                        >
                          تسجيل دفعة
                        </button>
                      )}
                      <button
                        onClick={() => startEdit(c)}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-center text-xs font-semibold text-gray-700"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => deleteCustomer(c)}
                        className="flex-1 rounded-lg bg-red-50 py-2 text-center text-xs font-semibold text-red-600"
                      >
                        حذف
                      </button>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
