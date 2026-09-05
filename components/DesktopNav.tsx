"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

const items = [
  { href: "/", label: "الرئيسية" },
  { href: "/sales", label: "المبيعات" },
  { href: "/inventory", label: "المخزون" },
  { href: "/customers", label: "العملاء" },
  { href: "/debts", label: "المديونيات" },
  { href: "/purchases", label: "المشتريات" },
  { href: "/suppliers", label: "الموردين" },
  { href: "/expenses", label: "المصروفات" },
  { href: "/reports", label: "التقارير" },
  { href: "/categories", label: "التصنيفات" },
];

export default function DesktopNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white md:block">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
        <span className="ml-2 shrink-0 text-sm font-bold text-brand-700">💊 متجر المكملات</span>
        {items.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {item.label}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="mr-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          تسجيل الخروج
        </button>
      </div>
    </nav>
  );
}
