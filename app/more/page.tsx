"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";

const items = [
  { href: "/products", label: "المنتجات", icon: "🛍️", desc: "إضافة وتعديل المنتجات" },
  { href: "/purchases", label: "المشتريات", icon: "🛒", desc: "فواتير الشراء من الموردين" },
  { href: "/suppliers", label: "الموردين", icon: "🚚", desc: "بيانات الموردين ومديونياتهم" },
  { href: "/debts", label: "مديونيات العملاء", icon: "💰", desc: "متابعة وتحصيل الديون" },
  { href: "/expenses", label: "المصروفات", icon: "🧾", desc: "إيجار، كهرباء، رواتب وغيرها" },
  { href: "/reports", label: "التقارير", icon: "📊", desc: "المبيعات، الأرباح، المخزون" },
  { href: "/categories", label: "التصنيفات", icon: "🏷️", desc: "إدارة تصنيفات المنتجات" },
];

export default function MorePage() {
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div>
      <PageHeader title="المزيد" />
      <div className="space-y-2 p-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm active:bg-gray-50"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{item.label}</p>
              <p className="text-xs text-gray-400">{item.desc}</p>
            </div>
            <span className="text-gray-300">←</span>
          </Link>
        ))}

        <button
          onClick={logout}
          className="mt-4 w-full rounded-2xl bg-red-50 py-3.5 text-sm font-bold text-red-600"
        >
          تسجيل الخروج
        </button>
      </div>
    </div>
  );
}
