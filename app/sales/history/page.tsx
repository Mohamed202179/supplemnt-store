"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDateTime, Sale } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function SalesHistoryPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "completed" | "cancelled">("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("sales").select("*").order("created_at", { ascending: false }).limit(200);
    setSales((data ?? []) as Sale[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () =>
      sales.filter((s) => {
        const matchesSearch =
          !search ||
          (s.customer_name_snapshot ?? "").toLowerCase().includes(search.toLowerCase()) ||
          String(s.invoice_number).includes(search);
        const matchesStatus = statusFilter === "all" || s.status === statusFilter;
        return matchesSearch && matchesStatus;
      }),
    [sales, search, statusFilter]
  );

  return (
    <div>
      <PageHeader title="سجل المبيعات" />

      <div className="space-y-3 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث برقم الفاتورة أو اسم العميل..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        <div className="flex gap-2">
          {(["all", "completed", "cancelled"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${
                statusFilter === s ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {s === "all" ? "الكل" : s === "completed" ? "مكتملة" : "ملغاة"}
            </button>
          ))}
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد فواتير مطابقة</p>
        ) : (
          <ul className="space-y-2">
            {filtered.map((s) => (
              <li key={s.id}>
                <Link href={`/sales/${s.id}`} className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">
                        فاتورة #{s.invoice_number}{" "}
                        {s.status === "cancelled" && <span className="text-xs text-red-500">(ملغاة)</span>}
                      </p>
                      <p className="text-xs text-gray-400">
                        {s.customer_name_snapshot || "عميل مسجل"} · {formatDateTime(s.created_at)}
                      </p>
                    </div>
                    <span className="font-bold text-gray-900">{formatEGP(s.total)}</span>
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
