// ============================================================
// العمليات المالية للبراندات من نوع "v2": كل عملية = استدعاء دالة واحدة في قاعدة
// البيانات (Transaction واحدة، قفل للصفوف، فحص صلاحيات). مش بتستخدم في Daily Dose.
// ============================================================
import { supabase } from "@/lib/supabase/client";

/** رسالة مناسبة للعرض. رسائل RAISE EXCEPTION من القاعدة (P0001) عربي جاهز؛ غيرها عام. */
export function opError(e: unknown): string {
  const err = e as { code?: string; message?: string } | null;
  if (err?.code === "P0001" && err.message) return err.message;
  return "حدث خطأ غير متوقع، حاول مرة أخرى";
}

async function rpc<T = unknown>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw error;
  return data as T;
}

export const ops = {
  createSale: (a: {
    customerId: string | null;
    walkInName: string;
    items: { product_id: string; quantity: number }[];
    discount: number;
    paid: number;
    createdAt: string;
  }) =>
    rpc<string>("create_sale", {
      p_customer_id: a.customerId,
      p_walk_in_name: a.walkInName,
      p_items: a.items,
      p_discount: a.discount,
      p_paid: a.paid,
      p_created_at: a.createdAt,
    }),

  cancelSale: (saleId: string) => rpc("cancel_sale", { p_sale_id: saleId }),

  createPurchase: (a: {
    supplierId: string | null;
    items: { product_id: string; quantity: number; unit_cost: number }[];
    discount: number;
    paid: number;
  }) =>
    rpc<string>("create_purchase", {
      p_supplier_id: a.supplierId,
      p_items: a.items,
      p_discount: a.discount,
      p_paid: a.paid,
    }),

  cancelPurchase: (purchaseId: string) => rpc("cancel_purchase", { p_purchase_id: purchaseId }),

  adjustStock: (productId: string, target: number, reason: string | null) =>
    rpc("adjust_stock", { p_product_id: productId, p_target: target, p_reason: reason }),

  customerPayment: (customerId: string, amount: number, note: string | null = null) =>
    rpc("record_customer_payment", { p_customer_id: customerId, p_amount: amount, p_note: note }),

  supplierPayment: (supplierId: string, amount: number, note: string | null = null) =>
    rpc("record_supplier_payment", { p_supplier_id: supplierId, p_amount: amount, p_note: note }),
};
