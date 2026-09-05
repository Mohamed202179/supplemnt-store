"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Expense, ExpenseCategory, EXPENSE_CATEGORY_LABELS, formatEGP, formatDate } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

const categories: ExpenseCategory[] = ["rent", "electricity", "transportation", "salaries", "marketing", "other"];

export default function ExpensesPage() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<ExpenseCategory>("other");
  const [amount, setAmount] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("expenses").select("*").order("expense_date", { ascending: false });
    setExpenses((data ?? []) as Expense[]);
    setLoading(false);
  }

  async function addExpense(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const value = Number(amount);
    if (!title.trim() || !value || value <= 0) {
      setError("أدخل عنوان المصروف ومبلغًا صحيحًا");
      return;
    }
    setSaving(true);
    const { error: insertErr } = await supabase.from("expenses").insert({
      title: title.trim(),
      category,
      amount: value,
      notes: notes || null,
    });
    setSaving(false);
    if (insertErr) {
      setError("حدث خطأ أثناء حفظ المصروف");
      return;
    }
    setTitle("");
    setAmount("");
    setNotes("");
    setCategory("other");
    setShowForm(false);
    load();
  }

  async function deleteExpense(id: string) {
    if (!confirm("هل تريد حذف هذا المصروف؟")) return;
    await supabase.from("expenses").delete().eq("id", id);
    load();
  }

  const totalThisMonth = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((e) => {
        const d = new Date(e.expense_date);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, e) => sum + e.amount, 0);
  }, [expenses]);

  return (
    <div>
      <PageHeader
        title="المصروفات"
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
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-xs text-gray-500">إجمالي مصروفات هذا الشهر</p>
          <p className="mt-1 text-xl font-bold text-red-600">{formatEGP(totalThisMonth)}</p>
        </div>

        {showForm && (
          <form onSubmit={addExpense} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            {error && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-600">{error}</div>}
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان المصروف *"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as ExpenseCategory)}
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {EXPENSE_CATEGORY_LABELS[c]}
                </option>
              ))}
            </select>
            <input
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              type="number"
              inputMode="decimal"
              min={0}
              step="0.01"
              placeholder="المبلغ (ج.م) *"
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
              disabled={saving}
              className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60"
            >
              {saving ? "جارِ الحفظ..." : "حفظ المصروف"}
            </button>
          </form>
        )}

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : expenses.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد مصروفات مسجلة</p>
        ) : (
          <ul className="space-y-2">
            {expenses.map((e) => (
              <li key={e.id} className="rounded-2xl bg-white p-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900">{e.title}</p>
                    <p className="text-xs text-gray-400">
                      {EXPENSE_CATEGORY_LABELS[e.category]} · {formatDate(e.expense_date)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-red-600">{formatEGP(e.amount)}</span>
                    <button onClick={() => deleteExpense(e.id)} className="text-xs text-gray-400">
                      حذف
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
