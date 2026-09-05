"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, Product, Category } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StockBadge from "@/components/StockBadge";

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase
        .from("products")
        .select("*, categories(name)")
        .eq("is_active", true)
        .order("created_at", { ascending: false }),
      supabase.from("categories").select("*").order("name"),
    ]);
    setProducts((prods ?? []) as Product[]);
    setCategories((cats ?? []) as Category[]);
    setLoading(false);
  }

  async function deactivate(id: string) {
    if (!confirm("هل تريد إيقاف تفعيل هذا المنتج؟ لن يظهر في نقطة البيع بعد ذلك.")) return;
    await supabase.from("products").update({ is_active: false }).eq("id", id);
    load();
  }

  const filtered = useMemo(() => {
    return products.filter((p) => {
      const matchesSearch =
        !search ||
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        (p.brand ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (p.barcode ?? "").includes(search);
      const matchesCategory = categoryFilter === "all" || p.category_id === categoryFilter;
      const matchesLowStock = !lowStockOnly || p.current_stock <= p.min_stock;
      return matchesSearch && matchesCategory && matchesLowStock;
    });
  }, [products, search, categoryFilter, lowStockOnly]);

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
          className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none"
        />

        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            onClick={() => setCategoryFilter("all")}
            className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
              categoryFilter === "all" ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"
            }`}
          >
            الكل
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              onClick={() => setCategoryFilter(c.id)}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-semibold ${
                categoryFilter === c.id ? "bg-brand-600 text-white" : "bg-white text-gray-600 border border-gray-200"
              }`}
            >
              {c.name}
            </button>
          ))}
        </div>

        <label className="flex w-fit items-center gap-2 text-xs font-medium text-gray-600">
          <input
            type="checkbox"
            checked={lowStockOnly}
            onChange={(e) => setLowStockOnly(e.target.checked)}
            className="h-4 w-4 accent-brand-600"
          />
          عرض المخزون المنخفض فقط
        </label>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد منتجات مطابقة</p>
        ) : (
          <ul className="grid grid-cols-1 gap-2 md:grid-cols-2">
            {filtered.map((p) => (
              <li key={p.id} className="rounded-2xl bg-white p-3 shadow-sm">
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
                  </div>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-gray-100 pt-2 text-sm">
                  <span className="text-gray-500">الكمية: <b className="text-gray-800">{p.current_stock}</b></span>
                  <span className="font-bold text-brand-700">{formatEGP(p.selling_price)}</span>
                </div>
                <div className="mt-2 flex gap-2">
                  <Link
                    href={`/products/${p.id}/edit`}
                    className="flex-1 rounded-lg bg-gray-100 py-2 text-center text-xs font-semibold text-gray-700"
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
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
