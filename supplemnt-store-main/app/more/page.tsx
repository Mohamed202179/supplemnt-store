"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, ShoppingBag, Tag, ShoppingCart, Truck, CreditCard, BarChart3, Receipt, Settings, LogOut, LucideIcon } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { useRole } from "@/components/RoleProvider";
import { TranslationKey } from "@/lib/i18n";

interface MoreItem {
  href: string;
  Icon: LucideIcon;
  labelKey: TranslationKey;
  descKey: TranslationKey;
  ownerOnly?: boolean;
}

interface MoreSection {
  titleKey: TranslationKey;
  items: MoreItem[];
}

const sections: MoreSection[] = [
  {
    titleKey: "more_section_catalog",
    items: [
      { href: "/products", Icon: ShoppingBag, labelKey: "item_products_label", descKey: "item_products_desc", ownerOnly: true },
      { href: "/categories", Icon: Tag, labelKey: "item_categories_label", descKey: "item_categories_desc", ownerOnly: true },
    ],
  },
  {
    titleKey: "more_section_purchasing",
    items: [
      { href: "/purchases", Icon: ShoppingCart, labelKey: "item_purchases_label", descKey: "item_purchases_desc", ownerOnly: true },
      { href: "/suppliers", Icon: Truck, labelKey: "item_suppliers_label", descKey: "item_suppliers_desc", ownerOnly: true },
    ],
  },
  {
    titleKey: "more_section_finance",
    items: [
      { href: "/debts", Icon: CreditCard, labelKey: "item_debts_label", descKey: "item_debts_desc" },
      { href: "/reports", Icon: BarChart3, labelKey: "item_reports_label", descKey: "item_reports_desc", ownerOnly: true },
      { href: "/expenses", Icon: Receipt, labelKey: "item_expenses_label", descKey: "item_expenses_desc", ownerOnly: true },
    ],
  },
  {
    titleKey: "more_section_account",
    items: [{ href: "/settings", Icon: Settings, labelKey: "item_settings_label", descKey: "item_settings_desc" }],
  },
];

export default function MorePage() {
  const router = useRouter();
  const { t } = useLanguage();
  const { isOwner } = useRole();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div>
      <PageHeader title={t("more_title")} />
      <div className="space-y-5 p-4">
        {sections.map((section) => {
          const visibleItems = section.items.filter((item) => !item.ownerOnly || isOwner);
          if (visibleItems.length === 0) return null;
          return (
            <div key={section.titleKey}>
              <p className="mb-1.5 px-1 text-xs font-bold text-gray-400 dark:text-gray-500">{t(section.titleKey)}</p>
              <div className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-sm dark:divide-gray-800 dark:bg-gray-900">
                {visibleItems.map((item) => {
                  const Icon = item.Icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className="flex items-center gap-3 p-4 active:bg-gray-50 dark:active:bg-gray-800"
                    >
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold text-gray-900 dark:text-gray-100">{t(item.labelKey)}</p>
                        <p className="text-xs text-gray-400 dark:text-gray-500">{t(item.descKey)}</p>
                      </div>
                      <ChevronLeft className="h-4 w-4 shrink-0 text-gray-300 dark:text-gray-600" />
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}

        <button
          onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-red-50 py-3.5 text-sm font-bold text-red-600 dark:bg-red-500/10 dark:text-red-400"
        >
          <LogOut className="h-4 w-4" />
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
