"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Home,
  ShoppingCart,
  Package,
  ShoppingBag,
  Users,
  CreditCard,
  Truck,
  Receipt,
  BarChart3,
  Tag,
  Settings,
  LogOut,
  LucideIcon,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { useLanguage } from "@/components/LanguageProvider";
import { useRole } from "@/components/RoleProvider";
import { TranslationKey } from "@/lib/i18n";

const items: { href: string; labelKey: TranslationKey; Icon: LucideIcon; ownerOnly?: boolean }[] = [
  { href: "/", labelKey: "nav_home", Icon: Home },
  { href: "/sales", labelKey: "nav_sales", Icon: ShoppingCart },
  { href: "/inventory", labelKey: "nav_inventory", Icon: Package },
  { href: "/products", labelKey: "nav_products", Icon: ShoppingBag, ownerOnly: true },
  { href: "/customers", labelKey: "nav_customers", Icon: Users },
  { href: "/debts", labelKey: "nav_debts", Icon: CreditCard },
  { href: "/purchases", labelKey: "nav_purchases", Icon: ShoppingBag, ownerOnly: true },
  { href: "/suppliers", labelKey: "nav_suppliers", Icon: Truck, ownerOnly: true },
  { href: "/expenses", labelKey: "nav_expenses", Icon: Receipt, ownerOnly: true },
  { href: "/reports", labelKey: "nav_reports", Icon: BarChart3, ownerOnly: true },
  { href: "/categories", labelKey: "nav_categories", Icon: Tag, ownerOnly: true },
  { href: "/settings", labelKey: "nav_settings", Icon: Settings },
];

export default function DesktopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useLanguage();
  const { isOwner } = useRole();
  const visibleItems = items.filter((item) => !item.ownerOnly || isOwner);

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <nav className="sticky top-0 z-40 hidden border-b border-gray-200 bg-white md:block dark:border-gray-800 dark:bg-gray-900">
      <div className="mx-auto flex max-w-5xl items-center gap-1 overflow-x-auto px-4 py-2">
        <span className="ml-2 flex shrink-0 items-center gap-1.5 text-sm font-bold text-brand-700 dark:text-brand-300">
          <img src="/icons/icon-192.png" alt="Daily Dose" className="h-6 w-6 rounded-md object-cover" />
          Daily Dose
        </span>
        {visibleItems.map((item) => {
          const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          const Icon = item.Icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium ${
                active ? "bg-brand-600 text-white" : "text-gray-600 hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {t(item.labelKey)}
            </Link>
          );
        })}
        <button
          onClick={logout}
          className="mr-auto flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </nav>
  );
}
