"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StockBadge from "@/components/StockBadge";

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase
      .from("products")
      .select("*, categories(name)")
      .eq("is_active", true)
      .order("current_stock", { ascending: true });
    setProducts((data ?? []) as Product[]);
    setLoading(false);
  }

  const filtered = useMemo(
    () => products.filter((p) => !search || p.name.toLowerCase().includes(search.toLowerCase())),
    [products, search]
  );

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + p.current_stock * p.purchase_price, 0),
    [products]
  );

  return (
    <div>
      <PageHeader
        title="المخزون"
        action={
          <Link href="/products/new" className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-bold text-white">
            + منتج جديد
          </Link>
        }
      />

      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between rounded-2xl bg-white p-4 shadow-sm">
          <div>
            <p className="text-xs text-gray-500">إجمالي قيمة المخزون (بسعر الشراء)</p>
            <p className="mt-1 text-xl font-bold text-brand-700">{formatEGP(totalValue)}</p>
          </div>
          <Link href="/products" className="shrink-0 rounded-xl bg-gray-100 px-3 py-2 text-xs font-bold text-gray-700">
            إدارة المنتجات ←
          </Link>
        </div>

        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث عن منتج..."
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">لا توجد منتجات بعد</p>
            <Link href="/products/new" className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              + إضافة أول منتج
            </Link>
          </div>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {filtered.map((p) => (
              <li key={p.id}>
                <Link href={`/inventory/${p.id}`} className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-bold text-gray-900">{p.name}</p>
                    <StockBadge status={getStockStatus(p)} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-2 text-center text-xs">
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-gray-400">الكمية</p>
                      <p className="mt-0.5 font-bold text-gray-800">{p.current_stock}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-gray-400">الحد الأدنى</p>
                      <p className="mt-0.5 font-bold text-gray-800">{p.min_stock}</p>
                    </div>
                    <div className="rounded-lg bg-gray-50 py-2">
                      <p className="text-gray-400">سعر البيع</p>
                      <p className="mt-0.5 font-bold text-gray-800">{formatEGP(p.selling_price)}</p>
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
