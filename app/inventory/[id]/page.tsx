"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, formatDateTime, getStockStatus, MOVEMENT_TYPE_LABELS, Product, StockMovement } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import StockBadge from "@/components/StockBadge";

export default function ProductStockPage({ params }: { params: { id: string } }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [movements, setMovements] = useState<StockMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdjust, setShowAdjust] = useState(false);
  const [newStock, setNewStock] = useState("");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: m }] = await Promise.all([
      supabase.from("products").select("*, categories(name)").eq("id", params.id).single(),
      supabase
        .from("stock_movements")
        .select("*")
        .eq("product_id", params.id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);
    setProduct((p as Product) ?? null);
    setMovements((m ?? []) as StockMovement[]);
    if (p) setNewStock(String(p.current_stock));
    setLoading(false);
  }

  async function submitAdjustment(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!product) return;

    const target = Number(newStock);
    if (Number.isNaN(target) || target < 0) {
      setError("أدخل كمية صحيحة (لا يمكن أن تكون سالبة)");
      return;
    }
    const diff = target - product.current_stock;
    if (diff === 0) {
      setError("الكمية الجديدة مطابقة للكمية الحالية");
      return;
    }

    setSaving(true);

    await supabase.from("products").update({ current_stock: target }).eq("id", product.id);

    await supabase.from("stock_movements").insert({
      product_id: product.id,
      type: "manual_adjustment",
      quantity: diff,
      reference: reason || "تعديل يدوي للمخزون",
      previous_stock: product.current_stock,
      new_stock: target,
    });

    setSaving(false);
    setShowAdjust(false);
    setReason("");
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400">جارِ التحميل...</p>;
  if (!product) return <p className="p-10 text-center text-sm text-gray-400">المنتج غير موجود</p>;

  return (
    <div>
      <PageHeader title={product.name} />

      <div className="space-y-4 p-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{product.categories?.name || "بدون تصنيف"}</p>
            <StockBadge status={getStockStatus(product)} />
          </div>

          <div className="mt-3 grid grid-cols-3 gap-2 text-center text-xs">
            <div className="rounded-lg bg-gray-50 py-2">
              <p className="text-gray-400">الكمية الحالية</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">{product.current_stock}</p>
            </div>
            <div className="rounded-lg bg-gray-50 py-2">
              <p className="text-gray-400">الحد الأدنى</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">{product.min_stock}</p>
            </div>
            <div className="rounded-lg bg-gray-50 py-2">
              <p className="text-gray-400">قيمة المخزون منه (بسعر الشراء)</p>
              <p className="mt-0.5 text-sm font-bold text-gray-900">
                {formatEGP(product.current_stock * product.purchase_price)}
              </p>
            </div>
          </div>

          <button
            onClick={() => setShowAdjust((s) => !s)}
            className="mt-3 w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white"
          >
            {showAdjust ? "إغلاق" : "تعديل الكمية يدويًا"}
          </button>

          {showAdjust && (
            <form onSubmit={submitAdjustment} className="mt-3 space-y-2 border-t border-gray-100 pt-3">
              {error && <p className="text-xs text-red-600">{error}</p>}
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">الكمية الجديدة</span>
                <input
                  value={newStock}
                  onChange={(e) => setNewStock(e.target.value)}
                  type="number"
                  inputMode="decimal"
                  min={0}
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-gray-600">سبب التعديل (اختياري)</span>
                <input
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="مثال: جرد، تالف، خطأ إدخال..."
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
                />
              </label>
              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-xl bg-brand-600 py-3 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? "جارِ الحفظ..." : "حفظ التعديل"}
              </button>
            </form>
          )}
        </div>

        <section className="rounded-2xl bg-white p-4 shadow-sm">
          <h2 className="mb-2 text-sm font-bold text-gray-900">سجل حركة المخزون</h2>
          {movements.length === 0 ? (
            <p className="py-4 text-center text-xs text-gray-400">لا توجد حركات مسجلة بعد</p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {movements.map((m) => (
                <li key={m.id} className="py-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-800">{MOVEMENT_TYPE_LABELS[m.type]}</span>
                    <span className={`font-bold ${m.quantity >= 0 ? "text-brand-700" : "text-red-600"}`}>
                      {m.quantity >= 0 ? "+" : ""}
                      {m.quantity}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400">
                    {m.previous_stock} ← {m.new_stock} · {formatDateTime(m.created_at)}
                  </p>
                  {m.reference && <p className="text-xs text-gray-400">{m.reference}</p>}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
