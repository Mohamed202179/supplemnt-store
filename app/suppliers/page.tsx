"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, Supplier } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [company, setCompany] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editCompany, setEditCompany] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("suppliers").select("*").order("name");
    setSuppliers((data ?? []) as Supplier[]);
    setLoading(false);
  }

  async function addSupplier(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    await supabase.from("suppliers").insert({
      name: name.trim(),
      phone: phone || null,
      company: company || null,
      notes: notes || null,
    });
    setSaving(false);
    setName("");
    setPhone("");
    setCompany("");
    setNotes("");
    setShowForm(false);
    load();
  }

  function startEdit(s: Supplier) {
    setError("");
    setEditingId(s.id);
    setEditName(s.name);
    setEditPhone(s.phone ?? "");
    setEditCompany(s.company ?? "");
    setEditNotes(s.notes ?? "");
  }

  function cancelEdit() {
    setEditingId(null);
  }

  async function saveEdit(id: string) {
    setError("");
    if (!editName.trim()) {
      setError("اسم المورد مطلوب");
      return;
    }
    setSavingEdit(true);
    const { error: updateErr } = await supabase
      .from("suppliers")
      .update({
        name: editName.trim(),
        phone: editPhone || null,
        company: editCompany || null,
        notes: editNotes || null,
      })
      .eq("id", id);
    setSavingEdit(false);

    if (updateErr) {
      setError("حدث خطأ أثناء حفظ التعديل");
      return;
    }
    setEditingId(null);
    load();
  }

  async function deleteSupplier(s: Supplier) {
    const warning =
      s.current_debt > 0
        ? `تنبيه: يوجد مبلغ مستحق لهذا المورد قدره ${formatEGP(s.current_debt)}. حذفه سيفقد تتبع هذا الدين. هل تريد المتابعة؟`
        : "سيتم حذف هذا المورد نهائيًا. فواتير الشراء السابقة ستبقى محفوظة لكن بدون ربط بمورد. هل تريد المتابعة؟";
    if (!confirm(warning)) return;

    await supabase.from("suppliers").delete().eq("id", s.id);
    load();
  }

  const filtered = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          !search ||
          s.name.toLowerCase().includes(search.toLowerCase()) ||
          (s.phone ?? "").includes(search) ||
          (s.company ?? "").toLowerCase().includes(search.toLowerCase())
      ),
    [suppliers, search]
  );

  return (
    <div>
      <PageHeader
        title="الموردين"
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
          <form onSubmit={addSupplier} className="space-y-3 rounded-2xl bg-white p-4 shadow-sm">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="اسم المورد *"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
            <input
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="اسم الشركة (اختياري)"
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
              {saving ? "جارِ الحفظ..." : "حفظ المورد"}
            </button>
          </form>
        )}

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الهاتف أو الشركة..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا يوجد موردون</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li key={s.id} className="rounded-2xl bg-white p-3 shadow-sm">
                {editingId === s.id ? (
                  <div className="space-y-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      placeholder="اسم المورد *"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <input
                      value={editCompany}
                      onChange={(e) => setEditCompany(e.target.value)}
                      placeholder="اسم الشركة"
                      className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
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
                        onClick={() => saveEdit(s.id)}
                        disabled={savingEdit}
                        className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingEdit ? "جارِ الحفظ..." : "حفظ"}
                      </button>
                      <button
                        onClick={cancelEdit}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-xs font-bold text-gray-600"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <Link href={`/suppliers/${s.id}`} className="block active:opacity-70">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-bold text-gray-900">{s.name}</p>
                          <p className="text-xs text-gray-400">{s.company || s.phone || "-"}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-xs text-gray-400">مستحق له</p>
                          <p className={`font-bold ${s.current_debt > 0 ? "text-red-600" : "text-brand-700"}`}>
                            {formatEGP(s.current_debt)}
                          </p>
                        </div>
                      </div>
                    </Link>
                    <div className="mt-2 flex gap-2 border-t border-gray-100 pt-2">
                      <button
                        onClick={() => startEdit(s)}
                        className="flex-1 rounded-lg bg-gray-100 py-2 text-center text-xs font-semibold text-gray-700"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => deleteSupplier(s)}
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
