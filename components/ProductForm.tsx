"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Category, Product } from "@/lib/types";

interface Props {
  initial?: Product;
}

export default function ProductForm({ initial }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: initial?.name ?? "",
    category_id: initial?.category_id ?? "",
    brand: initial?.brand ?? "",
    flavor: initial?.flavor ?? "",
    size: initial?.size ?? "",
    barcode: initial?.barcode ?? "",
    purchase_price: initial?.purchase_price?.toString() ?? "",
    selling_price: initial?.selling_price?.toString() ?? "",
    current_stock: initial?.current_stock?.toString() ?? "0",
    min_stock: initial?.min_stock?.toString() ?? "0",
    expiry_date: initial?.expiry_date ?? "",
  });

  useEffect(() => {
    supabase
      .from("categories")
      .select("*")
      .order("name")
      .then(({ data }) => setCategories((data ?? []) as Category[]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!form.name.trim()) {
      setError("اسم المنتج مطلوب");
      return;
    }
    if (Number(form.selling_price) < 0 || Number(form.purchase_price) < 0) {
      setError("الأسعار يجب أن تكون أرقامًا صحيحة");
      return;
    }

    setSaving(true);

    const payload = {
      name: form.name.trim(),
      category_id: form.category_id || null,
      brand: form.brand || null,
      flavor: form.flavor || null,
      size: form.size || null,
      barcode: form.barcode || null,
      purchase_price: Number(form.purchase_price) || 0,
      selling_price: Number(form.selling_price) || 0,
      current_stock: Number(form.current_stock) || 0,
      min_stock: Number(form.min_stock) || 0,
      expiry_date: form.expiry_date || null,
    };

    let result;
    if (initial) {
      result = await supabase.from("products").update(payload).eq("id", initial.id);
    } else {
      result = await supabase.from("products").insert(payload);
    }

    setSaving(false);

    if (result.error) {
      setError(
        result.error.message.includes("barcode")
          ? "هذا الباركود مستخدم بالفعل لمنتج آخر"
          : "حدث خطأ أثناء الحفظ، حاول مرة أخرى"
      );
      return;
    }

    router.push("/products");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4 p-4">
      {error && (
        <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>
      )}

      <Field label="اسم المنتج *">
        <input
          value={form.name}
          onChange={(e) => update("name", e.target.value)}
          className="input"
          placeholder="مثال: واي بروتين 2 كيلو"
        />
      </Field>

      <Field label="التصنيف">
        <select value={form.category_id} onChange={(e) => update("category_id", e.target.value)} className="input">
          <option value="">بدون تصنيف</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الماركة">
          <input value={form.brand} onChange={(e) => update("brand", e.target.value)} className="input" />
        </Field>
        <Field label="النكهة">
          <input value={form.flavor} onChange={(e) => update("flavor", e.target.value)} className="input" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الحجم">
          <input value={form.size} onChange={(e) => update("size", e.target.value)} className="input" />
        </Field>
        <Field label="الباركود">
          <input value={form.barcode} onChange={(e) => update("barcode", e.target.value)} className="input" inputMode="numeric" />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="سعر الشراء (ج.م)">
          <input
            value={form.purchase_price}
            onChange={(e) => update("purchase_price", e.target.value)}
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
          />
        </Field>
        <Field label="سعر البيع (ج.م) *">
          <input
            value={form.selling_price}
            onChange={(e) => update("selling_price", e.target.value)}
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
            step="0.01"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="الكمية الحالية">
          <input
            value={form.current_stock}
            onChange={(e) => update("current_stock", e.target.value)}
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
          />
        </Field>
        <Field label="الحد الأدنى للمخزون">
          <input
            value={form.min_stock}
            onChange={(e) => update("min_stock", e.target.value)}
            className="input"
            type="number"
            inputMode="decimal"
            min={0}
          />
        </Field>
      </div>

      <Field label="تاريخ انتهاء الصلاحية (اختياري)">
        <input
          value={form.expiry_date}
          onChange={(e) => update("expiry_date", e.target.value)}
          className="input"
          type="date"
        />
      </Field>

      <button
        type="submit"
        disabled={saving}
        className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
      >
        {saving ? "جارِ الحفظ..." : initial ? "حفظ التعديلات" : "إضافة المنتج"}
      </button>

      <style jsx global>{`
        .input {
          width: 100%;
          border-radius: 0.75rem;
          border: 1px solid #e5e7eb;
          background: white;
          padding: 0.75rem 1rem;
          font-size: 0.95rem;
        }
        .input:focus {
          outline: none;
          border-color: #12a05a;
        }
      `}</style>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-gray-600">{label}</span>
      {children}
    </label>
  );
}
