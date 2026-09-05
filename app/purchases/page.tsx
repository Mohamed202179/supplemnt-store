"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDate, Purchase } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function PurchasesPage() {
  const [purchases, setPurchases] = useState<Purchase[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("purchases").select("*").order("created_at", { ascending: false });
    setPurchases((data ?? []) as Purchase[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () =>
      purchases.filter(
        (p) =>
          !search ||
          (p.supplier_name_snapshot ?? "").toLowerCase().includes(search.toLowerCase()) ||
          String(p.purchase_number).includes(search)
      ),
    [purchases, search]
  );

  return (
    <div>
      <PageHeader
        title="المشتريات"
        action={
          <Link href="/purchases/new" className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-bold text-white">
            + شراء جديد
          </Link>
        }
      />

      <div className="space-y-3 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الفاتورة أو اسم المورد..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد مشتريات بعد</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link
                  href={`/purchases/${p.id}`}
                  className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        فاتورة #{p.purchase_number}{" "}
                        {p.status === "cancelled" && <span className="text-xs text-red-500">(ملغاة)</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {p.supplier_name_snapshot || "بدون مورد"} · {formatDate(p.created_at)}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900">{formatEGP(p.total)}</span>
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
