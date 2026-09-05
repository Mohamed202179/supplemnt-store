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
              <li key={s.id}>
                <Link
                  href={`/suppliers/${s.id}`}
                  className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50"
                >
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
