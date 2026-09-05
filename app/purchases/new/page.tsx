"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, PurchaseCartLine, Supplier, Product } from "@/lib/types";

type Step = "supplier" | "products" | "cart";

export default function NewPurchasePage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("supplier");

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierSearch, setSupplierSearch] = useState("");
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [noSupplier, setNoSupplier] = useState(false);

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<PurchaseCartLine[]>([]);

  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase.from("suppliers").select("*").order("name").then(({ data }) => setSuppliers((data ?? []) as Supplier[]));
    supabase
      .from("products")
      .select("*, categories(name)")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  const filteredSuppliers = useMemo(
    () =>
      suppliers.filter(
        (s) =>
          !supplierSearch ||
          s.name.toLowerCase().includes(supplierSearch.toLowerCase()) ||
          (s.phone ?? "").includes(supplierSearch)
      ),
    [suppliers, supplierSearch]
  );

  const filteredProducts = useMemo(
    () =>
      products.filter(
        (p) =>
          !productSearch ||
          p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
          (p.barcode ?? "").includes(productSearch)
      ),
    [products, productSearch]
  );

  const subtotal = useMemo(
    () => cart.reduce((sum, l) => sum + l.unitCost * l.quantity, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - Number(discount || 0));
  const paid = Number(paidAmount || 0);
  const remaining = Math.max(0, total - paid);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        return prev.map((l) => (l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l));
      }
      return [...prev, { product, quantity: 1, unitCost: product.purchase_price }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => (l.product.id === productId ? { ...l, quantity: l.quantity + delta } : l))
        .filter((l) => l.quantity > 0)
    );
  }

  function changeCost(productId: string, value: string) {
    setCart((prev) =>
      prev.map((l) => (l.product.id === productId ? { ...l, unitCost: Number(value) || 0 } : l))
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  async function completePurchase() {
    setError("");

    if (cart.length === 0) {
      setError("أضف منتجًا واحدًا على الأقل");
      return;
    }
    if (!selectedSupplier && !noSupplier) {
      setError("اختر موردًا أو تابع بدون مورد");
      return;
    }

    setCompleting(true);

    const { data: purchase, error: purchaseErr } = await supabase
      .from("purchases")
      .insert({
        supplier_id: selectedSupplier?.id ?? null,
        supplier_name_snapshot: selectedSupplier ? null : "بدون مورد محدد",
        subtotal,
        discount: Number(discount) || 0,
        total,
        paid_amount: paid,
        remaining_amount: remaining,
        payment_status: remaining <= 0 ? "paid" : paid <= 0 ? "unpaid" : "partial",
      })
      .select()
      .single();

    if (purchaseErr || !purchase) {
      setCompleting(false);
      setError("حدث خطأ أثناء إنشاء فاتورة الشراء، حاول مرة أخرى");
      return;
    }

    for (const line of cart) {
      await supabase.from("purchase_items").insert({
        purchase_id: purchase.id,
        product_id: line.product.id,
        product_name_snapshot: line.product.name,
        quantity: line.quantity,
        unit_cost: line.unitCost,
        line_total: line.unitCost * line.quantity,
      });

      const newStock = line.product.current_stock + line.quantity;
      await supabase
        .from("products")
        .update({ current_stock: newStock, purchase_price: line.unitCost })
        .eq("id", line.product.id);

      await supabase.from("stock_movements").insert({
        product_id: line.product.id,
        type: "purchase",
        quantity: line.quantity,
        reference: `فاتورة شراء رقم ${purchase.purchase_number}`,
        previous_stock: line.product.current_stock,
        new_stock: newStock,
      });
    }

    if (selectedSupplier) {
      await supabase
        .from("suppliers")
        .update({
          current_debt: selectedSupplier.current_debt + remaining,
          total_purchases: selectedSupplier.total_purchases + total,
          total_paid: selectedSupplier.total_paid + paid,
        })
        .eq("id", selectedSupplier.id);
    }

    setCompleting(false);
    router.push("/purchases");
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3">
        <h1 className="text-lg font-bold text-gray-900">شراء جديد</h1>
        <div className="mt-2 flex gap-2 text-xs font-semibold">
          <StepPill active={step === "supplier"} done={!!selectedSupplier || noSupplier} onClick={() => setStep("supplier")}>
            1. المورد
          </StepPill>
          <StepPill active={step === "products"} done={cart.length > 0} onClick={() => setStep("products")}>
            2. المنتجات
          </StepPill>
          <StepPill active={step === "cart"} done={false} onClick={() => setStep("cart")}>
            3. الدفع
          </StepPill>
        </div>
      </div>

      {step === "supplier" && (
        <div className="space-y-3 p-4">
          <button
            onClick={() => {
              setNoSupplier(true);
              setSelectedSupplier(null);
              setStep("products");
            }}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-bold text-gray-600"
          >
            📦 شراء بدون مورد محدد
          </button>

          <input
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            placeholder="بحث عن مورد..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />

          <ul className="space-y-2">
            {filteredSuppliers.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setSelectedSupplier(s);
                    setNoSupplier(false);
                    setStep("products");
                  }}
                  className={`w-full rounded-xl border p-3 text-right text-sm ${
                    selectedSupplier?.id === s.id ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="font-bold text-gray-900">{s.name}</p>
                  <p className="text-xs text-gray-400">{s.company || s.phone || "-"}</p>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {step === "products" && (
        <div className="space-y-3 p-4">
          <input
            value={productSearch}
            onChange={(e) => setProductSearch(e.target.value)}
            placeholder="بحث بالاسم أو الباركود..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            autoFocus
          />

          <ul className="space-y-2">
            {filteredProducts.map((p) => {
              const inCart = cart.find((l) => l.product.id === p.id);
              return (
                <li key={p.id} className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      آخر سعر شراء: {formatEGP(p.purchase_price)} · متاح حاليًا {p.current_stock}
                    </p>
                  </div>
                  <button
                    onClick={() => addToCart(p)}
                    className="mr-2 shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                  >
                    {inCart ? `+ (${inCart.quantity})` : "إضافة"}
                  </button>
                </li>
              );
            })}
          </ul>

          {cart.length > 0 && (
            <button
              onClick={() => setStep("cart")}
              className="fixed bottom-6 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[336px] -translate-x-1/2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg"
            >
              متابعة ({cart.reduce((s, l) => s + l.quantity, 0)}) · {formatEGP(subtotal)}
            </button>
          )}
        </div>
      )}

      {step === "cart" && (
        <div className="space-y-3 p-4">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">لم تُضف منتجات بعد</p>
          ) : (
            <ul className="space-y-2">
              {cart.map((line) => (
                <li key={line.product.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">{line.product.name}</p>
                    <button onClick={() => removeLine(line.product.id)} className="text-xs text-red-500">
                      حذف
                    </button>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => changeQty(line.product.id, -1)}
                        className="h-8 w-8 rounded-lg bg-gray-100 text-lg font-bold text-gray-600"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-bold">{line.quantity}</span>
                      <button
                        onClick={() => changeQty(line.product.id, 1)}
                        className="h-8 w-8 rounded-lg bg-gray-100 text-lg font-bold text-gray-600"
                      >
                        +
                      </button>
                    </div>
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      سعر الوحدة
                      <input
                        value={line.unitCost}
                        onChange={(e) => changeCost(line.product.id, e.target.value)}
                        type="number"
                        inputMode="decimal"
                        min={0}
                        step="0.01"
                        className="w-20 rounded-lg border border-gray-200 px-2 py-1 text-left"
                      />
                    </label>
                  </div>
                  <p className="mt-1 text-left text-sm font-bold text-brand-700">
                    {formatEGP(line.unitCost * line.quantity)}
                  </p>
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-2 rounded-xl bg-white p-4 shadow-sm">
            <Row label="الإجمالي الفرعي" value={formatEGP(subtotal)} />
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-500">الخصم</span>
              <input
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-left"
              />
            </label>
            <Row label="الإجمالي" value={formatEGP(total)} bold />
            <label className="flex items-center justify-between text-sm">
              <span className="text-gray-500">المبلغ المدفوع</span>
              <input
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
                type="number"
                inputMode="decimal"
                min={0}
                placeholder={String(total)}
                className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-left"
              />
            </label>
            <Row label="المتبقي (مستحق للمورد)" value={formatEGP(remaining)} tone={remaining > 0 ? "danger" : "default"} />
          </div>

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <button
            onClick={completePurchase}
            disabled={completing || cart.length === 0}
            className="w-full rounded-xl bg-brand-600 py-4 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {completing ? "جارِ الحفظ..." : "إتمام الشراء"}
          </button>
        </div>
      )}
    </div>
  );
}

function StepPill({
  active,
  done,
  onClick,
  children,
}: {
  active: boolean;
  done: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 rounded-full py-1.5 ${
        active ? "bg-brand-600 text-white" : done ? "bg-brand-50 text-brand-700" : "bg-gray-100 text-gray-400"
      }`}
    >
      {children}
    </button>
  );
}

function Row({ label, value, bold, tone }: { label: string; value: string; bold?: boolean; tone?: "default" | "danger" }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className={`${bold ? "text-base font-bold" : "font-semibold"} ${tone === "danger" ? "text-red-600" : "text-gray-900"}`}>
        {value}
      </span>
    </div>
  );
}
