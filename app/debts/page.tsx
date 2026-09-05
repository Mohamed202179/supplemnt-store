"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDate, Customer } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function DebtsPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("customers")
      .select("*")
      .gt("current_debt", 0)
      .order("current_debt", { ascending: false });
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  const totalDebts = useMemo(() => customers.reduce((sum, c) => sum + c.current_debt, 0), [customers]);

  return (
    <div>
      <PageHeader title="المديونيات" />

      <div className="space-y-3 p-4">
        <div className="rounded-2xl bg-red-50 p-4">
          <p className="text-xs text-red-500">إجمالي المديونيات على العملاء</p>
          <p className="mt-1 text-xl font-bold text-red-600">{formatEGP(totalDebts)}</p>
        </div>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : customers.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد مديونيات حالياً 🎉</p>
        ) : (
          <ul className="space-y-2">
            {customers.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/customers/${c.id}`}
                  className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-bold text-gray-900">{c.name}</p>
                      <p className="text-xs text-gray-400">
                        {c.last_transaction_at ? `آخر عملية: ${formatDate(c.last_transaction_at)}` : "لا توجد عمليات"}
                      </p>
                    </div>
                    <span className="font-bold text-red-600">{formatEGP(c.current_debt)}</span>
                  </div>
                  <div className="mt-1 text-xs text-gray-400">
                    إجمالي المشتريات: {formatEGP(c.total_purchases)}
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
