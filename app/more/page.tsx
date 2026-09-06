"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import PageHeader from "@/components/PageHeader";
import { useLanguage } from "@/components/LanguageProvider";
import { TranslationKey } from "@/lib/i18n";

const items: { href: string; icon: string; labelKey: TranslationKey; descKey: TranslationKey }[] = [
  { href: "/products", icon: "🛍️", labelKey: "item_products_label", descKey: "item_products_desc" },
  { href: "/purchases", icon: "🛒", labelKey: "item_purchases_label", descKey: "item_purchases_desc" },
  { href: "/suppliers", icon: "🚚", labelKey: "item_suppliers_label", descKey: "item_suppliers_desc" },
  { href: "/debts", icon: "💰", labelKey: "item_debts_label", descKey: "item_debts_desc" },
  { href: "/expenses", icon: "🧾", labelKey: "item_expenses_label", descKey: "item_expenses_desc" },
  { href: "/reports", icon: "📊", labelKey: "item_reports_label", descKey: "item_reports_desc" },
  { href: "/categories", icon: "🏷️", labelKey: "item_categories_label", descKey: "item_categories_desc" },
  { href: "/settings", icon: "⚙️", labelKey: "item_settings_label", descKey: "item_settings_desc" },
];

export default function MorePage() {
  const router = useRouter();
  const { t } = useLanguage();

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/login");
  }

  return (
    <div>
      <PageHeader title={t("more_title")} />
      <div className="space-y-2 p-4">
        {items.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="flex items-center gap-3 rounded-2xl bg-white p-4 shadow-sm active:bg-gray-50"
          >
            <span className="text-2xl">{item.icon}</span>
            <div className="min-w-0 flex-1">
              <p className="font-bold text-gray-900">{t(item.labelKey)}</p>
              <p className="text-xs text-gray-400">{t(item.descKey)}</p>
            </div>
            <span className="text-gray-300">←</span>
          </Link>
        ))}

        <button
          onClick={logout}
          className="mt-4 w-full rounded-2xl bg-red-50 py-3.5 text-sm font-bold text-red-600"
        >
          {t("logout")}
        </button>
      </div>
    </div>
  );
}
