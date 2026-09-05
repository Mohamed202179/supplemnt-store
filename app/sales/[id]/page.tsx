"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Sale, SaleItem, Customer, formatEGP, formatDateTime, paymentStatusLabel } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function SaleDetailPage({ params }: { params: { id: string } }) {
  const [sale, setSale] = useState<Sale | null>(null);
  const [items, setItems] = useState<SaleItem[]>([]);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [loading, setLoading] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    load();
  }, [params.id]);

  async function load() {
    setLoading(true);
    const [{ data: s }, { data: it }] = await Promise.all([
      supabase.from("sales").select("*").eq("id", params.id).single(),
      supabase.from("sale_items").select("*").eq("sale_id", params.id),
    ]);
    setSale((s as Sale) ?? null);
    setItems((it ?? []) as SaleItem[]);

    if (s?.customer_id) {
      const { data: c } = await supabase.from("customers").select("*").eq("id", s.customer_id).single();
      setCustomer((c as Customer) ?? null);
    } else {
      setCustomer(null);
    }
    setLoading(false);
  }

  async function cancelSale() {
    if (!sale) return;
    if (!confirm("سيتم إرجاع الكميات المباعة إلى المخزون وتصفير الدين المرتبط بهذه الفاتورة. هل تريد إلغاء البيع؟"))
      return;

    setError("");
    setCancelling(true);

    for (const item of items) {
      if (!item.product_id) continue;
      const { data: product } = await supabase
        .from("products")
        .select("id, current_stock")
        .eq("id", item.product_id)
        .single();
      if (!product) continue;

      const newStock = product.current_stock + item.quantity;
      await supabase.from("products").update({ current_stock: newStock }).eq("id", item.product_id);

      await supabase.from("stock_movements").insert({
        product_id: item.product_id,
        type: "sale_cancellation",
        quantity: item.quantity,
        reference: `إلغاء فاتورة رقم ${sale.invoice_number}`,
        previous_stock: product.current_stock,
        new_stock: newStock,
      });
    }

    await supabase
      .from("sales")
      .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
      .eq("id", sale.id);

    if (sale.customer_id) {
      const { data: cust } = await supabase.from("customers").select("*").eq("id", sale.customer_id).single();
      if (cust) {
        await supabase
          .from("customers")
          .update({
            current_debt: Math.max(0, cust.current_debt - sale.remaining_amount),
            total_purchases: Math.max(0, cust.total_purchases - sale.total),
          })
          .eq("id", sale.customer_id);
      }
    }

    setCancelling(false);
    load();
  }

  if (loading) return <p className="p-10 text-center text-sm text-gray-400">جارِ التحميل...</p>;
  if (!sale) return <p className="p-10 text-center text-sm text-gray-400">الفاتورة غير موجودة</p>;

  return (
    <div>
      <PageHeader title={`فاتورة #${sale.invoice_number}`} />

      <div className="space-y-4 p-4">
        {sale.status === "cancelled" && (
          <div className="rounded-xl bg-red-50 p-3 text-center text-sm font-bold text-red-600">
            تم إلغاء هذه الفاتورة
          </div>
        )}

        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between text-sm text-gray-500">
            <span>{customer?.name || sale.customer_name_snapshot || "عميل نقدي"}</span>
            <span>{formatDateTime(sale.created_at)}</span>
          </div>

          <ul className="mt-3 divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="py-2 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-gray-800">{item.product_name_snapshot}</span>
                  <span className="font-bold text-gray-900">{formatEGP(item.line_total)}</span>
                </div>
                <p className="text-xs text-gray-400">
                  {item.quantity} × {formatEGP(item.unit_price)}
                </p>
              </li>
            ))}
          </ul>

          <div className="mt-3 space-y-1 border-t border-gray-100 pt-3 text-sm">
            <Row label="الإجمالي الفرعي" value={formatEGP(sale.subtotal)} />
            <Row label="الخصم" value={formatEGP(sale.discount)} />
            <Row label="الإجمالي" value={formatEGP(sale.total)} bold />
            <Row label="المدفوع" value={formatEGP(sale.paid_amount)} />
            <Row label="المتبقي" value={formatEGP(sale.remaining_amount)} tone="danger" />
            <Row label="حالة الدفع" value={paymentStatusLabel(sale.payment_status)} />
          </div>
        </div>

        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        {sale.status === "completed" && (
          <button
            onClick={cancelSale}
            disabled={cancelling}
            className="w-full rounded-xl bg-red-50 py-3.5 text-sm font-bold text-red-600 disabled:opacity-60"
          >
            {cancelling ? "جارِ الإلغاء..." : "إلغاء البيع / استرجاع"}
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
