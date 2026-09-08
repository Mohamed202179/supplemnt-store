"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product, Category, ProductGroup } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StockBadge from "@/components/StockBadge";
import OwnerGate from "@/components/OwnerGate";

function ProductsPageContent() {
  const [products, setProducts] = useState<Product[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: prods }, { data: grps }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("product_groups").select("*, categories(name)").order("name"),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts((prods ?? []) as Product[]);
    setGroups((grps ?? []) as ProductGroup[]);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  }

  async function deactivate(id: string) {
    if (!confirm("هل تريد إيقاف تفعيل هذا المنتج؟ لن يظهر في نقطة البيع بعد ذلك.")) return;
    await supabase.from("products").update({ is_active: false }).eq("id", id);
    load();
  }

  function toggleGroup(id: string) {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function matchesSearchAndFilters(p: Product) {
    const matchesSearch =
      !search ||
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      (p.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
      (p.barcode ?? "").includes(search);
    const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
    const matchesLowStock = !lowStockOnly || p.current_stock <= p.min_stock;
    return matchesSearch && matchesCategory && matchesLowStock;
  }

  const standaloneProducts = useMemo(
    () => products.filter((p) => !p.group_id && matchesSearchAndFilters(p)),
    [products, search, categoryFilter, lowStockOnly]
  );

  const visibleGroups = useMemo(() => {
    return groups
      .map((g) => {
        const variants = products.filter((p) => p.group_id === g.id);
        const matchingVariants = variants.filter(matchesSearchAndFilters);
        return { group: g, variants, matchingVariants };
      })
      .filter((entry) => entry.variants.length > 0 && entry.matchingVariants.length > 0);
  }, [groups, products, search, categoryFilter, lowStockOnly]);

  const isEmpty = standaloneProducts.length === 0 && visibleGroups.length === 0;

  return (
    <div>
      <PageHeader
        title="المنتجات"
        action={
          <Link
            href="/products/new"
            className="rounded-full bg-brand-600 px-3 py-1.5 text-sm font-bold text-white"
          >
            + إضافة
          </Link>
        }
      />

      <div className="space-y-3 p-4">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="بحث بالاسم أو الماركة أو الباركود..."
          className="w-full rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              categoryFilter === "all" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
            }`}
          >
            الكل
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                categoryFilter === c.id ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <label className="flex w-fit items-center gap-2 text-xs font-medium text-gray-600 dark:text-gray-400 dark:text-gray-500">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          عرض المخزون المنخفض فقط
        </label>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>
        ) : isEmpty ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">لا توجد منتجات مطابقة</p>
        ) : (
          <div className="space-y-2">
            {visibleGroups.map(({ group, variants }) => {
              const expanded = expandedGroups.has(group.id);
              const totalStock = variants.reduce((sum, v) => sum + v.current_stock, 0);
              return (
                <div key={group.id} className="rounded-2xl bg-white dark:bg-gray-900 shadow-sm">
                  <button
                    onClick={() => toggleGroup(group.id)}
                    className="flex w-full items-center gap-3 p-3 text-right"
                  >
                    {group.image_url ? (
                      <img
                        src={group.image_url}
                        alt={group.name}
                        className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 dark:border-gray-800 object-cover"
                      />
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800 text-xl text-gray-300">
                        🛍️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-900 dark:text-gray-100">{group.name}</p>
                      <p className="text-xs text-gray-400 dark:text-gray-500">{group.categories?.name || "بدون تصنيف"}</p>
                      <p className="mt-1 text-xs font-semibold text-brand-600">
                        {variants.length} طعم/حجم · إجمالي الكمية {totalStock}
                      </p>
                    </div>
                    <span className="shrink-0 text-gray-300">{expanded ? "▲" : "▼"}</span>
                  </button>

                  {expanded && (
                    <div className="space-y-2 border-t border-gray-100 dark:border-gray-800 p-3">
                      {variants.map((p) => (
                        <div key={p.id} className="rounded-xl bg-gray-50 dark:bg-gray-800 p-3">
                          <div className="flex items-start justify-between gap-2">
                            <p className="text-sm font-bold text-gray-800 dark:text-gray-200">
                              {p.flavor || "-"} {p.size ? `· ${p.size}` : ""}
                            </p>
                            <StockBadge status={getStockStatus(p)} />
                          </div>
                          <div className="mt-1 flex items-center justify-between text-sm">
                            <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                              الكمية: <b className="text-gray-800 dark:text-gray-200">{p.current_stock}</b>
                            </span>
                            <span className="font-bold text-brand-700">{formatEGP(p.selling_price)}</span>
                          </div>
                          <div className="mt-2 flex gap-2">
                            <Link
                              href={`/products/${p.id}/edit`}
                              className="flex-1 rounded-lg bg-white dark:bg-gray-900 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700"
                            >
                              تعديل
                            </Link>
                            <button
                              onClick={() => deactivate(p.id)}
                              className="flex-1 rounded-lg bg-red-50 py-2 text-center text-xs font-semibold text-red-600"
                            >
                              إيقاف
                            </button>
                          </div>
                        </div>
                      ))}
                      <Link
                        href={`/products/new?group=${group.id}`}
                        className="block w-full rounded-xl border-2 border-dashed border-brand-300 bg-brand-50 py-2.5 text-center text-xs font-bold text-brand-700"
                      >
                        + أضف طعم/حجم جديد لنفس المنتج
                      </Link>
                    </div>
                  )}
                </div>
              );
            })}

            {standaloneProducts.map((p) => (
              <div key={p.id} className="rounded-2xl bg-white dark:bg-gray-900 p-3 shadow-sm">
                <div className="flex items-start gap-3">
                  {p.image_url ? (
                    <img
                      src={p.image_url}
                      alt={p.name}
                      className="h-14 w-14 shrink-0 rounded-xl border border-gray-100 dark:border-gray-800 object-cover"
                    />
                  ) : (
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-gray-50 dark:bg-gray-800 text-xl text-gray-300">
                      📦
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-bold text-gray-900 dark:text-gray-100">{p.name}</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500">
                      {p.brand || "-"} {p.flavor ? `· ${p.flavor}` : ""} {p.size ? `· ${p.size}` : ""}
                    </p>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400 dark:text-gray-500">{p.categories?.name || "بدون تصنيف"}</p>
                  </div>
                  <StockBadge status={getStockStatus(p)} />
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 dark:border-gray-800 pt-2 text-sm">
                  <span className="text-gray-500 dark:text-gray-400 dark:text-gray-500">
                    الكمية: <b className="text-gray-800 dark:text-gray-200">{p.current_stock}</b>
                  </span>
                  <span className="font-bold text-brand-700">{formatEGP(p.selling_price)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/products/${p.id}/edit`}
                    className="flex-1 rounded-lg bg-gray-100 dark:bg-gray-800 py-2 text-center text-xs font-semibold text-gray-700 dark:text-gray-300"
                  >
                    تعديل
                  </Link>
                  <button
                    onClick={() => deactivate(p.id)}
                    className="flex-1 rounded-lg bg-red-50 py-2 text-center text-xs font-semibold text-red-600"
                  >
                    إيقاف
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function ProductsPage() {
  return (
    <OwnerGate>
      <ProductsPageContent />
    </OwnerGate>
  );
}
