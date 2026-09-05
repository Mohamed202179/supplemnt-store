"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Category } from "@/lib/types";
import PageHeader from "@/components/PageHeader";

export default function CategoriesPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

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
    const { error: insertErr } = await supabase.from("categories").insert({ name: name.trim() });
    setSaving(false);
    if (insertErr) {
      setError(insertErr.message.includes("duplicate") ? "هذا التصنيف موجود بالفعل" : "حدث خطأ أثناء الإضافة");
      return;
    }
    setName("");
    load();
  }

  function startEdit(c: Category) {
    setEditingId(c.id);
    setEditingName(c.name);
  }

  async function saveEdit(id: string) {
    if (!editingName.trim()) return;
    await supabase.from("categories").update({ name: editingName.trim() }).eq("id", id);
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

        <form onSubmit={addCategory} className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="اسم تصنيف جديد..."
            className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !name.trim()}
            className="rounded-xl bg-brand-600 px-4 py-3 text-sm font-bold text-white disabled:opacity-60"
          >
            إضافة
          </button>
        </form>

        {loading ? (
          <p className="py-10 text-center text-sm text-gray-400">جارِ التحميل...</p>
        ) : categories.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-400">لا توجد تصنيفات بعد</p>
        ) : (
          <ul className="space-y-2">
            {categories.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-2xl bg-white p-3 shadow-sm">
                {editingId === c.id ? (
                  <>
                    <input
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                      autoFocus
                    />
                    <button
                      onClick={() => saveEdit(c.id)}
                      className="rounded-lg bg-brand-600 px-3 py-2 text-xs font-bold text-white"
                    >
                      حفظ
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-bold text-gray-600"
                    >
                      إلغاء
                    </button>
                  </>
                ) : (
                  <>
                    <span className="flex-1 font-medium text-gray-900">{c.name}</span>
                    <button
                      onClick={() => startEdit(c)}
                      className="rounded-lg bg-gray-100 px-3 py-2 text-xs font-semibold text-gray-700"
                    >
                      تعديل
                    </button>
                    <button
                      onClick={() => deleteCategory(c.id)}
                      className="rounded-lg bg-red-50 px-3 py-2 text-xs font-semibold text-red-600"
                    >
                      حذف
                    </button>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
