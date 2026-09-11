"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import PageHeader from "@/components/PageHeader";
import OwnerGate from "@/components/OwnerGate";
import { Tag, Camera, X } from "lucide-react";

async function uploadCategoryImage(file: File): Promise<{ url: string | null; failed: boolean }> {
  const ext = file.name.split(".").pop();
  const path = `category-${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

  const { error } = await supabase.storage.from("product-images").upload(path, file, { upsert: false });
  if (error) return { url: null, failed: true };

  const { data } = supabase.storage.from("product-images").getPublicUrl(path);
  return { url: data.publicUrl, failed: false };
}

function ImagePicker({
  previewUrl,
  onSelect,
  onRemove,
  size = "h-16 w-16",
}: {
  previewUrl: string | null;
  onSelect: (file: File) => void;
  onRemove: () => void;
  size?: string;
}) {
  return previewUrl ? (
    <div className={`relative shrink-0 ${size}`}>
      <img src={previewUrl} alt="" className="h-full w-full rounded-xl border border-gray-100 dark:border-gray-700 object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -left-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-white text-red-600 shadow dark:bg-gray-800"
      >
        <X className="h-3 w-3" />
      </button>
    </div>
  ) : (
    <label
      className={`flex shrink-0 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 text-gray-400 dark:text-gray-500 ${size}`}
    >
      <Camera className="h-5 w-5" />
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) onSelect(file);
        }}
      />
    </label>
  );
}

function CategoriesPageContent() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Add-new-category form state
  const [name, setName] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Inline edit state (one category at a time)
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");
  const [editingImageUrl, setEditingImageUrl] = useState<string | null>(null);
  const [editingImageFile, setEditingImageFile] = useState<File | null>(null);
  const [editingImagePreview, setEditingImagePreview] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  useEffect(() => {
    load();
  }, []);

  async function load() {
    setLoading(true);
    const { data } = await supabase.from("categories").select("*").order("name");
    setCategories((data ?? []) as Category[]);
    setLoading(false);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!name.trim()) return;

    setSaving(true);

    let imageUrl: string | null = null;
    if (newImageFile) {
      const result = await uploadCategoryImage(newImageFile);
      if (result.failed) {
        setSaving(false);
        setError("حدث خطأ أثناء رفع الصورة، حاول مرة أخرى");
        return;
      }
      imageUrl = result.url;
    }

    const { error: insertErr } = await supabase.from("categories").insert({ name: name.trim(), image_url: imageUrl });
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message.includes("duplicate") ? "هذا التصنيف موجود بالفعل" : "حدث خطأ أثناء الإضافة");
      return;
    }
    setName("");
    setNewImageFile(null);
    setNewImagePreview(null);
    load();
  }

  function startEdit(c: Category) {
    setError("");
    setEditingId(c.id);
    setEditingName(c.name);
    setEditingImageUrl(c.image_url);
    setEditingImageFile(null);
    setEditingImagePreview(c.image_url);
  }

  async function saveEdit(id: string) {
    setError("");
    if (!editingName.trim()) return;

    setSavingEdit(true);

    let finalImageUrl = editingImageUrl;
    if (editingImageFile) {
      const result = await uploadCategoryImage(editingImageFile);
      if (result.failed) {
        setSavingEdit(false);
        setError("حدث خطأ أثناء رفع الصورة، حاول مرة أخرى");
        return;
      }
      finalImageUrl = result.url;
    }

    const { error: updateErr } = await supabase
      .from("categories")
      .update({ name: editingName.trim(), image_url: finalImageUrl })
      .eq("id", id);

    setSavingEdit(false);
    if (updateErr) {
      setError("حدث خطأ أثناء الحفظ");
      return;
    }
    setEditingId(null);
    load();
  }

  async function deleteCategory(id: string) {
    if (!confirm("سيتم إلغاء ربط المنتجات بهذا التصنيف (لن تُحذف المنتجات نفسها). هل تريد المتابعة؟")) return;
    await supabase.from("categories").delete().eq("id", id);
    load();
  }

  return (
    <div>
      <PageHeader title="التصنيفات" />

      <div className="space-y-3 p-4">
        {error && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-600">{error}</div>}

        <form onSubmit={addCategory} className="flex items-center gap-2 rounded-2xl bg-white dark:bg-gray-900 p-3 shadow-sm">
          <ImagePicker
            previewUrl={newImagePreview}
            onSelect={(file) => {
              setNewImageFile(file);
              setNewImagePreview(URL.createObjectURL(file));
            }}
            onRemove={() => {
              setNewImageFile(null);
              setNewImagePreview(null);
            }}
          />
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم تصنيف جديد..."
            className="flex-1 rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 text-sm dark:text-gray-100"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="shrink-0 rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? "..." : "إضافة"}
          </button>
        </form>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">جارِ التحميل...</p>
        ) : categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400 dark:text-gray-500">لا توجد تصنيفات بعد</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="rounded-2xl bg-white dark:bg-gray-900 p-3 shadow-sm">
                {editingId === c.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ImagePicker
                        previewUrl={editingImagePreview}
                        onSelect={(file) => {
                          setEditingImageFile(file);
                          setEditingImagePreview(URL.createObjectURL(file));
                        }}
                        onRemove={() => {
                          setEditingImageFile(null);
                          setEditingImagePreview(null);
                          setEditingImageUrl(null);
                        }}
                      />
                      <input
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        className="flex-1 rounded-lg border border-gray-200 dark:border-gray-700 px-3 py-2 text-sm dark:bg-gray-800 dark:text-gray-100"
                        autoFocus
                      />
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => saveEdit(c.id)}
                        disabled={savingEdit}
                        className="flex-1 rounded-lg bg-brand-600 py-2 text-xs font-bold text-white disabled:opacity-60"
                      >
                        {savingEdit ? "جارِ الحفظ..." : "حفظ"}
                      </button>
                      <button
                        onClick={() => setEditingId(null)}
                        className="flex-1 rounded-lg bg-gray-100 dark:bg-gray-800 py-2 text-xs font-bold text-gray-600 dark:text-gray-400"
                      >
                        إلغاء
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    {c.image_url ? (
                      <img src={c.image_url} alt={c.name} className="h-11 w-11 shrink-0 rounded-xl border border-gray-100 dark:border-gray-700 object-cover" />
                    ) : (
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-50 dark:bg-brand-500/20 text-brand-700 dark:text-brand-300">
                        <Tag className="h-5 w-5" />
                      </div>
                    )}
                    <span className="flex-1 font-medium text-gray-900 dark:text-gray-100">{c.name}</span>
                    <button
                      onClick={() => startEdit(c)}
                      className="shrink-0 rounded-lg bg-gray-100 dark:bg-gray-800 px-3 py-2 text-xs font-semibold text-gray-700 dark:text-gray-300"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="shrink-0 rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                    >
                      حذف
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

export default function CategoriesPage() {
  return (
    <OwnerGate>
      <CategoriesPageContent />
    </OwnerGate>
  );
}
