"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { TranslationKey } from "@/lib/i18n";

const items: { href: string; labelKey: TranslationKey }[] = [
  { href: "/", labelKey: "nav_home" },
  { href: "/sales", labelKey: "nav_sales" },
  { href: "/inventory", labelKey: "nav_inventory" },
  { href: "/products", labelKey: "nav_products" },
  { href: "/customers", labelKey: "nav_customers" },
  { href: "/debts", labelKey: "nav_debts" },
  { href: "/purchases", labelKey: "nav_purchases" },
  { href: "/suppliers", labelKey: "nav_suppliers" },
  { href: "/expenses", labelKey: "nav_expenses" },
  { href: "/reports", labelKey: "nav_reports" },
  { href: "/categories", labelKey: "nav_categories" },
  { href: "/settings", labelKey: "nav_settings" },
];

export default function DesktopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white md:block">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
        <span className="ml-2 flex shrink-0 items-center gap-1.5 text-sm font-bold text-brand-700">
          <img src="/icons/icon-192.png" alt="Daily Dose" className="h-6 w-6 rounded-md object-cover" />
          Daily Dose
        </span>
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
              {t(item.labelKey)}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="mr-auto shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50"
        >
          {t("logout")}
        </button>
      </div>
    </nav>
  );
}
