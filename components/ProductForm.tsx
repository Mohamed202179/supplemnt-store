"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Category, Product, ProductGroup } from "@/lib/types";
import { Camera } from "lucide-react";

interface Props {
  initial?: Product;
  presetGroupId?: string;
}

type GroupMode = "none" | "existing" | "new";

export default function ProductForm({ initial, presetGroupId }: Props) {
  const router = useRouter();
  const [categories, setCategories] = useState<Category[]>([]);
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [imageUrl, setImageUrl] = useState<string | null>(initial?.image_url ?? null);
  const [imagePreview, setImagePreview] = useState<string | null>(initial?.image_url ?? null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  const initialGroupId = initial?.group_id ?? presetGroupId ?? "";
  const [groupMode, setGroupMode] = useState<GroupMode>(initialGroupId ? "existing" : "none");
  const [selectedGroupId, setSelectedGroupId] = useState(initialGroupId);
  const [newGroupName, setNewGroupName] = useState("");

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
    supabase
      .from("product_groups")
      .select("*")
      .order("name")
      .then(({ data }) => setGroups((data ?? []) as ProductGroup[]));
  }, []);

  function update<K extends keyof typeof form>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("اختر ملف صورة صالح (JPG, PNG...)");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError("حجم الصورة كبير جدًا (الحد الأقصى 5 ميجا)");
      return;
    }

    setError("");
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }

  function removeImage() {
    setImageFile(null);
    setImagePreview(null);
    setImageUrl(null);
  }

  async function uploadImageIfNeeded(): Promise<{ url: string | null; failed: boolean }> {
    if (!imageFile) return { url: imageUrl, failed: false };

    setUploadingImage(true);
    const ext = imageFile.name.split(".").pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadErr } = await supabase.storage
      .from("product-images")
      .upload(path, imageFile, { upsert: false });

    setUploadingImage(false);

    if (uploadErr) {
      return { url: null, failed: true };
    }

    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    return { url: data.publicUrl, failed: false };
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
    if (groupMode === "new" && !newGroupName.trim()) {
      setError("أدخل اسم المجموعة الجديدة");
      return;
    }
    if (groupMode === "existing" && !selectedGroupId) {
      setError("اختر مجموعة من القائمة");
      return;
    }

    setSaving(true);

    let finalImageUrl = imageUrl;
    if (imageFile) {
      const uploadResult = await uploadImageIfNeeded();
      if (uploadResult.failed) {
        setSaving(false);
        setError("حدث خطأ أثناء رفع الصورة، حاول مرة أخرى");
        return;
      }
      finalImageUrl = uploadResult.url;
    } else if (imagePreview === null) {
      finalImageUrl = null;
    }

    // Resolve the group_id: create a new group first if needed.
    let finalGroupId: string | null = null;
    if (groupMode === "existing") {
      finalGroupId = selectedGroupId;
    } else if (groupMode === "new") {
      const { data: newGroup, error: groupErr } = await supabase
        .from("product_groups")
        .insert({
          name: newGroupName.trim(),
          category_id: form.category_id || null,
          brand: form.brand || null,
          image_url: finalImageUrl,
        })
        .select()
        .single();

      if (groupErr || !newGroup) {
        setSaving(false);
        setError("حدث خطأ أثناء إنشاء المجموعة، حاول مرة أخرى");
        return;
      }
      finalGroupId = newGroup.id;
    }

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
      image_url: finalImageUrl,
      group_id: finalGroupId,
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

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-500">صورة المنتج (اختياري)</span>
        {imagePreview ? (
          <div className="relative w-full">
            <img
              src={imagePreview}
              alt="معاينة المنتج"
              className="h-40 w-full rounded-xl border border-gray-200 dark:border-gray-700 object-cover"
            />
            <button
              type="button"
              onClick={removeImage}
              className="absolute left-2 top-2 rounded-full bg-white dark:bg-gray-900 px-3 py-1 text-xs font-bold text-red-600 shadow"
            >
              إزالة
            </button>
          </div>
        ) : (
          <label className="flex h-32 w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500">
            <Camera className="h-7 w-7" />
            <span className="text-xs font-semibold">اضغط لإضافة صورة</span>
            <input type="file" accept="image/*" onChange={handleImageSelect} className="hidden" />
          </label>
        )}
      </div>

      <div className="rounded-xl border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 p-3">
        <span className="mb-2 block text-xs font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-500">
          هل هذا المنتج له أطعمة أو أحجام مختلفة؟
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setGroupMode("none")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold ${
              groupMode === "none" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
            }`}
          >
            منتج مستقل
          </button>
          <button
            type="button"
            onClick={() => setGroupMode("existing")}
            disabled={groups.length === 0}
            className={`flex-1 rounded-lg py-2 text-xs font-bold disabled:opacity-40 ${
              groupMode === "existing" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
            }`}
          >
            جزء من مجموعة موجودة
          </button>
          <button
            type="button"
            onClick={() => setGroupMode("new")}
            className={`flex-1 rounded-lg py-2 text-xs font-bold ${
              groupMode === "new" ? "bg-brand-600 text-white" : "bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 dark:text-gray-500 border border-gray-200 dark:border-gray-700"
            }`}
          >
            + مجموعة جديدة
          </button>
        </div>

        {groupMode === "existing" && (
          <select
            value={selectedGroupId}
            onChange={(e) => setSelectedGroupId(e.target.value)}
            className="input mt-2"
          >
            <option value="">اختر المجموعة...</option>
            {groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.name}
              </option>
            ))}
          </select>
        )}

        {groupMode === "new" && (
          <input
            value={newGroupName}
            onChange={(e) => setNewGroupName(e.target.value)}
            placeholder="اسم المجموعة (مثال: واي بروتين - Optimum Nutrition)"
            className="input mt-2"
          />
        )}

        {groupMode !== "none" && (
          <p className="mt-2 text-[11px] text-gray-400 dark:text-gray-500">
            استخدم حقلي "النكهة" و"الحجم" تحت عشان تميّز هذا الطعم/الحجم عن باقي المجموعة.
          </p>
        )}
      </div>

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
        disabled={saving || uploadingImage}
        className="w-full rounded-xl bg-brand-600 py-3.5 text-base font-bold text-white shadow-sm active:bg-brand-700 disabled:opacity-60"
      >
        {uploadingImage ? "جارِ رفع الصورة..." : saving ? "جارِ الحفظ..." : initial ? "حفظ التعديلات" : "إضافة المنتج"}
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
      <span className="mb-1.5 block text-xs font-semibold text-gray-600 dark:text-gray-400 dark:text-gray-500">{label}</span>
      {children}
    </label>
  );
}
