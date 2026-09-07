"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product, ProductGroup } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StockBadge from "@/components/StockBadge";

function ExpiryNote({ expiryDate }: { expiryDate: string | null }) {
  if (!expiryDate) return null;
  const daysLeft = Math.ceil((new Date(expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
  if (daysLeft > 90) return null;
  return (
    <p className={`mt-0.5 text-xs font-semibold ${daysLeft < 0 ? "text-red-600" : "text-amber-600"}`}>
      {daysLeft < 0 ? "منتهي الصلاحية" : `ينتهي خلال ${daysLeft} يوم`}
    </p>
  );
}

export default function InventoryPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: prods }, { data: grps }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("current_stock", { ascending: true }),
      supabase.from("product_groups").select("*, categories(name)").order("name"),
    ]);
    setProducts((prods ?? []) as Product[]);
    setGroups((grps ?? []) as ProductGroup[]);
    setLoading(false);
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const standaloneProducts = useMemo(
    () =>
      products.filter((p) => !p.group_id && (!search || p.name.toLowerCase().includes(search.toLowerCase()))),
    [products, search]
  );

  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => {
        const variants = products.filter((p) => p.group_id === g.id);
        const matches =
          !search ||
          g.name.toLowerCase().includes(search.toLowerCase()) ||
          variants.some((v) => v.name.toLowerCase().includes(search.toLowerCase()));
        return { group: g, variants, matches };
      })
      .filter((entry) => entry.variants.length > 0 && entry.matches);
  }, [groups, products, search]);

  const totalValue = useMemo(
    () => products.reduce((sum, p) => sum + p.current_stock * p.purchase_price, 0),
    [products]
  );

  const isEmpty = standaloneProducts.length === 0 && visibleGroups.length === 0;

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
        ) : isEmpty ? (
          <div className="py-10 text-center">
            <p className="text-sm text-gray-400">لا توجد منتجات بعد</p>
            <Link href="/products/new" className="mt-3 inline-block rounded-xl bg-brand-600 px-4 py-2 text-sm font-bold text-white">
              + إضافة أول منتج
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {visibleGroups.map(({ group, variants }) => {
              const expanded = expandedGroups.has(group.id);
              const totalStock = variants.reduce((sum, v) => sum + v.current_stock, 0);
              const groupValue = variants.reduce((sum, v) => sum + v.current_stock * v.purchase_price, 0);
              return (
                <div key={group.id} className="rounded-2xl bg-white shadow-sm">
                  <button onClick={() => toggleGroup(group.id)} className="flex w-full items-center gap-3 p-3 text-right">
                    {group.image_url ? (
                      <img
                        src={group.image_url}
                        alt={group.name}
                        className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xl text-gray-300">
                        🛍️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-900">{group.name}</p>
                      <p className="text-xs text-gray-400">{variants.length} طعم/حجم</p>
                      <div className="mt-1 flex gap-3 text-xs">
                        <span className="text-gray-500">
                          إجمالي الكمية: <b className="text-gray-800">{totalStock}</b>
                        </span>
                        <span className="font-bold text-brand-700">{formatEGP(groupValue)}</span>
                      </div>
                    </div>
                    <span className="shrink-0 text-gray-300">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="space-y-2 border-t border-gray-100 p-3">
                      {variants.map((p) => (
                        <Link
                          key={p.id}
                          href={`/inventory/${p.id}`}
                          className="block rounded-xl bg-gray-50 p-3 active:bg-gray-100"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-gray-800">
                              {p.flavor || "-"} {p.size ? `· ${p.size}` : ""}
                            </p>
                            <StockBadge status={getStockStatus(p)} />
                          </div>
                          <ExpiryNote expiryDate={p.expiry_date} />
                          <div className="mt-2 grid grid-cols-2 gap-2 text-center text-xs">
                            <div className="rounded-lg bg-white py-1.5">
                              <p className="text-gray-400">الكمية</p>
                              <p className="mt-0.5 font-bold text-gray-800">{p.current_stock}</p>
                            </div>
                            <div className="rounded-lg bg-white py-1.5">
                              <p className="text-gray-400">الإجمالي (تكلفة)</p>
                              <p className="mt-0.5 font-bold text-brand-700">
                                {formatEGP(p.current_stock * p.purchase_price)}
                              </p>
                            </div>
                          </div>
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {standaloneProducts.map((p) => (
              <Link
                key={p.id}
                href={`/inventory/${p.id}`}
                className="block rounded-2xl bg-white p-3 shadow-sm active:bg-gray-50"
              >
                <div className="flex items-start gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-xl text-gray-300">
                      📦
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate font-bold text-gray-900">{p.name}</p>
                      <StockBadge status={getStockStatus(p)} />
                    </div>
                    <p className="text-xs text-gray-400">
                      {p.brand || "-"} {p.flavor ? `· ${p.flavor}` : ""} {p.size ? `· ${p.size}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">{p.categories?.name || "بدون تصنيف"}</p>
                    <ExpiryNote expiryDate={p.expiry_date} />
                  </div>
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 border-t border-gray-100 pt-2 text-center text-xs">
                  <div className="rounded-lg bg-gray-50 py-2">
                    <p className="text-gray-400">الكمية</p>
                    <p className="mt-0.5 font-bold text-gray-800">{p.current_stock}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <p className="text-gray-400">الحد الأدنى</p>
                    <p className="mt-0.5 font-bold text-gray-800">{p.min_stock}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 py-2">
                    <p className="text-gray-400">الإجمالي (سعر الشراء)</p>
                    <p className="mt-0.5 font-bold text-brand-700">{formatEGP(p.current_stock * p.purchase_price)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
