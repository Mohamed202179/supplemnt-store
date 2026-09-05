"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Purchase, PurchaseItem, formatEGP, formatDateTime, paymentStatusLabel } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function PurchaseDetailPage({ params }: { params: { id: string } }) {
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [items, setItems] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const [{ data: p }, { data: it }] = await Promise.all([
      supabase.from("purchases").select("*").eq("id", params.id).single(),
      supabase.from("purchase_items").select("*").eq("purchase_id", params.id),
    ]);
    setPurchase((p as Purchase) ?? null);
    setItems((it ?? []) as PurchaseItem[]);
    setLoading(false);
  }

  async function cancelPurchase() {
    if (!purchase) return;
    if (!confirm("سيتم خصم الكميات التي أضافها هذا الشراء من المخزون. هل تريد إلغاء الشراء؟")) return;

    setError("");
    setCancelling(true);

    // Safety check: make sure cancelling won't push any product's stock negative
    // (i.e. some of the purchased quantity has already been resold).
    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabase
        .from("products")
        .select("id, name, current_stock")
        .eq("id", item.product_id)
        .single();
      if (product && product.current_stock - item.quantity < 0) {
        setCancelling(false);
        setError(
          `لا يمكن إلغاء الشراء: جزء من كمية "${product.name}" تم بيعه بالفعل ولا يمكن خصمها من المخزون.`
        );
        return;
      }
    }

    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabase
        .from("products")
        .select("id, current_stock")
        .eq("id", item.product_id)
        .single();
      if (!product) continue;

      const newStock = product.current_stock - item.quantity;
      await supabase.from("products").update({ current_stock: newStock }).eq("id", item.product_id);

      await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        type: "purchase_cancellation",
        quantity: -item.quantity,
        reference: `إلغاء فاتورة شراء رقم ${purchase.purchase_number}`,
        previous_stock: product.current_stock,
        new_stock: newStock,
      });
    }

    await supabase
      .from("purchases")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", purchase.id);

    if (purchase.supplier_id) {
      const { data: supplier } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", purchase.supplier_id)
        .single();
      if (supplier) {
        await supabase
          .from("suppliers")
          .update({
            total_purchases: Math.max(0, supplier.total_purchases - purchase.total),
            total_paid: Math.max(0, supplier.total_paid - purchase.paid_amount),
            current_debt: Math.max(0, supplier.current_debt - purchase.remaining_amount),
          })
          .eq("id", purchase.supplier_id);
      }
    }

    setCancelling(false);
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400">جارِ التحميل...</p>;
  if (!purchase) return <p className="p-10 text-center text-sm text-gray-400">فاتورة الشراء غير موجودة</p>;

  return (
    <div>
      <PageHeader title={`فاتورة شراء #${purchase.purchase_number}`} />

      <div className="space-y-4 p-4">
        {purchase.status === "cancelled" && (
          <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600">
            تم إلغاء هذه الفاتورة
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{purchase.supplier_name_snapshot || "بدون مورد"}</span>
            <span>{formatDateTime(purchase.created_at)}</span>
          </div>

          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{item.product_name_snapshot}</span>
                  <span className="font-bold text-gray-900">{formatEGP(item.line_total)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {item.quantity} × {formatEGP(item.unit_cost)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <Row label="الإجمالي الفرعي" value={formatEGP(purchase.subtotal)} />
            <Row label="الخصم" value={formatEGP(purchase.discount)} />
            <Row label="الإجمالي" value={formatEGP(purchase.total)} bold />
            <Row label="المدفوع" value={formatEGP(purchase.paid_amount)} />
            <Row label="المتبقي" value={formatEGP(purchase.remaining_amount)} tone="danger" />
            <Row label="حالة الدفع" value={paymentStatusLabel(purchase.payment_status)} />
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {purchase.status === "completed" && (
          <button
            onClick={cancelPurchase}
            disabled={cancelling}
            className="w-full rounded-xl bg-red-50 py-3.5 text-sm font-bold text-red-600 disabled:opacity-60"
          >
            {cancelling ? "جارِ الإلغاء..." : "إلغاء فاتورة الشراء"}
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? "font-bold" : "font-medium"} ${tone === "danger" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
