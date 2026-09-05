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
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

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
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50"
                >
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
