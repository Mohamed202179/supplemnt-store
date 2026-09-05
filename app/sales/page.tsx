"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase/client";
import { formatEGP, getStockStatus, CartLine, Customer, Product } from "@/lib/types";

type Step = "customer" | "products" | "cart";

export default function SalesPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("customer");

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [walkIn, setWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState("");

  const [products, setProducts] = useState<Product[]>([]);
  const [productSearch, setProductSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);

  const [discount, setDiscount] = useState("0");
  const [paidAmount, setPaidAmount] = useState("");
  const [completing, setCompleting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    supabase
      .from("customers")
      .select("*")
      .order("name")
      .then(({ data }) => setCustomers((data ?? []) as Customer[]));
    supabase
      .from("products")
      .select("*, categories(name)")
      .eq("is_active", true)
      .order("name")
      .then(({ data }) => setProducts((data ?? []) as Product[]));
  }, []);

  const filteredCustomers = useMemo(
    () =>
      customers.filter(
        (c) =>
          !customerSearch ||
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          (c.phone ?? "").includes(customerSearch)
      ),
    [customers, customerSearch]
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
    () => cart.reduce((sum, line) => sum + line.product.selling_price * line.quantity, 0),
    [cart]
  );
  const total = Math.max(0, subtotal - Number(discount || 0));
  const paid = Number(paidAmount || 0);
  const remaining = Math.max(0, total - paid);

  function addToCart(product: Product) {
    setCart((prev) => {
      const existing = prev.find((l) => l.product.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > product.current_stock) return prev;
        return prev.map((l) =>
          l.product.id === product.id ? { ...l, quantity: l.quantity + 1 } : l
        );
      }
      if (product.current_stock < 1) return prev;
      return [...prev, { product, quantity: 1 }];
    });
  }

  function changeQty(productId: string, delta: number) {
    setCart((prev) =>
      prev
        .map((l) => {
          if (l.product.id !== productId) return l;
          const newQty = l.quantity + delta;
          if (newQty > l.product.current_stock) return l;
          return { ...l, quantity: newQty };
        })
        .filter((l) => l.quantity > 0)
    );
  }

  function removeLine(productId: string) {
    setCart((prev) => prev.filter((l) => l.product.id !== productId));
  }

  async function completeSale() {
    setError("");

    if (cart.length === 0) {
      setError("أضف منتجًا واحدًا على الأقل");
      return;
    }
    if (!selectedCustomer && !walkIn) {
      setError("اختر عميلًا أو بيع نقدي");
      return;
    }
    if (walkIn && selectedCustomer) {
      setError("اختر إما عميل مسجل أو بيع نقدي، وليس الاثنين");
      return;
    }

    // Final stock safety check right before completing.
    for (const line of cart) {
      if (line.quantity > line.product.current_stock) {
        setError(`الكمية المطلوبة من "${line.product.name}" غير متوفرة في المخزون.`);
        return;
      }
    }

    setCompleting(true);

    const profit = cart.reduce(
      (sum, l) => sum + (l.product.selling_price - l.product.purchase_price) * l.quantity,
      0
    );

    const paymentStatus = remaining <= 0 ? "paid" : paid <= 0 ? "unpaid" : "partial";

    const { data: sale, error: saleErr } = await supabase
      .from("sales")
      .insert({
        customer_id: selectedCustomer?.id ?? null,
        customer_name_snapshot: selectedCustomer ? null : walkInName.trim() || "عميل نقدي",
        subtotal,
        discount: Number(discount) || 0,
        total,
        paid_amount: paid,
        remaining_amount: remaining,
        payment_status: paymentStatus,
        profit,
      })
      .select()
      .single();

    if (saleErr || !sale) {
      setCompleting(false);
      setError("حدث خطأ أثناء إنشاء الفاتورة، حاول مرة أخرى");
      return;
    }

    // Insert sale items, adjust stock, and record stock movements.
    for (const line of cart) {
      await supabase.from("sale_items").insert({
        sale_id: sale.id,
        product_id: line.product.id,
        product_name_snapshot: line.product.name,
        quantity: line.quantity,
        unit_price: line.product.selling_price,
        unit_cost: line.product.purchase_price,
        line_total: line.product.selling_price * line.quantity,
      });

      const newStock = line.product.current_stock - line.quantity;
      await supabase.from("products").update({ current_stock: newStock }).eq("id", line.product.id);

      await supabase.from("stock_movements").insert({
        product_id: line.product.id,
        type: "sale",
        quantity: -line.quantity,
        reference: `فاتورة رقم ${sale.invoice_number}`,
        previous_stock: line.product.current_stock,
        new_stock: newStock,
      });
    }

    // Update customer debt / totals if this was a registered customer.
    if (selectedCustomer) {
      await supabase
        .from("customers")
        .update({
          current_debt: selectedCustomer.current_debt + remaining,
          total_purchases: selectedCustomer.total_purchases + total,
          last_transaction_at: new Date().toISOString(),
        })
        .eq("id", selectedCustomer.id);
    }

    setCompleting(false);
    router.push("/");
    router.refresh();
  }

  return (
    <div>
      <div className="sticky top-0 z-30 border-b border-gray-200 bg-white px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-bold text-gray-900">بيع جديد</h1>
          <Link href="/sales/history" className="text-xs font-semibold text-brand-600">
            سجل المبيعات ←
          </Link>
        </div>
        <div className="mt-2 flex gap-2 text-xs font-semibold">
          <StepPill active={step === "customer"} done={!!selectedCustomer || walkIn} onClick={() => setStep("customer")}>
            1. العميل
          </StepPill>
          <StepPill active={step === "products"} done={cart.length > 0} onClick={() => setStep("products")}>
            2. المنتجات
          </StepPill>
          <StepPill active={step === "cart"} done={false} onClick={() => setStep("cart")}>
            3. الدفع
          </StepPill>
        </div>
      </div>

      {step === "customer" && (
        <div className="space-y-3 p-4">
          <button
            onClick={() => {
              setWalkIn(true);
              setSelectedCustomer(null);
              setStep("products");
            }}
            className="w-full rounded-xl border-2 border-dashed border-gray-300 bg-white py-3 text-sm font-bold text-gray-600"
          >
            🧍 بيع نقدي (عميل بدون حساب)
          </button>

          {walkIn && (
            <input
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              placeholder="اسم العميل (اختياري)"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
            />
          )}

          <input
            value={customerSearch}
            onChange={(e) => setCustomerSearch(e.target.value)}
            placeholder="بحث عن عميل مسجل..."
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm"
          />

          <ul className="space-y-2">
            {filteredCustomers.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => {
                    setSelectedCustomer(c);
                    setWalkIn(false);
                    setStep("products");
                  }}
                  className={`w-full rounded-xl border p-3 text-right text-sm ${
                    selectedCustomer?.id === c.id ? "border-brand-500 bg-brand-50" : "border-gray-200 bg-white"
                  }`}
                >
                  <p className="font-bold text-gray-900">{c.name}</p>
                  <p className="text-xs text-gray-400">{c.phone || "-"}</p>
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
              const status = getStockStatus(p);
              const inCart = cart.find((l) => l.product.id === p.id);
              return (
                <li
                  key={p.id}
                  className="flex items-center justify-between rounded-xl bg-white p-3 shadow-sm"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-gray-900">{p.name}</p>
                    <p className="text-xs text-gray-400">
                      {formatEGP(p.selling_price)} · متاح {p.current_stock}
                    </p>
                  </div>
                  <button
                    disabled={status === "out"}
                    onClick={() => addToCart(p)}
                    className="mr-2 shrink-0 rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white disabled:bg-gray-200 disabled:text-gray-400"
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
              className="fixed bottom-24 left-1/2 z-40 w-[calc(100%-2rem)] max-w-[336px] -translate-x-1/2 rounded-xl bg-brand-600 py-3.5 text-sm font-bold text-white shadow-lg"
            >
              عرض السلة ({cart.reduce((s, l) => s + l.quantity, 0)}) · {formatEGP(subtotal)}
            </button>
          )}
        </div>
      )}

      {step === "cart" && (
        <div className="space-y-3 p-4">
          {cart.length === 0 ? (
            <p className="py-10 text-center text-sm text-gray-400">السلة فارغة</p>
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
                  <div className="mt-2 flex items-center justify-between">
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
                        disabled={line.quantity >= line.product.current_stock}
                        className="h-8 w-8 rounded-lg bg-gray-100 text-lg font-bold text-gray-600 disabled:opacity-40"
                      >
                        +
                      </button>
                    </div>
                    <span className="font-bold text-brand-700">
                      {formatEGP(line.product.selling_price * line.quantity)}
                    </span>
                  </div>
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
            <Row label="المتبقي (دين)" value={formatEGP(remaining)} tone={remaining > 0 ? "danger" : "default"} />
          </div>

          {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

          <button
            onClick={completeSale}
            disabled={completing || cart.length === 0}
            className="w-full rounded-xl bg-brand-600 py-4 text-base font-bold text-white shadow-sm disabled:opacity-60"
          >
            {completing ? "جارِ الحفظ..." : "إتمام البيع"}
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

function Row({
  label,
  value,
  bold,
  tone,
}: {
  label: string;
  value: string;
  bold?: boolean;
  tone?: "default" | "danger";
}) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span
        className={`${bold ? "text-base font-bold" : "font-semibold"} ${
          tone === "danger" ? "text-red-600" : "text-gray-900"
        }`}
      >
        {value}
      </span>
    </div>
  );
}
