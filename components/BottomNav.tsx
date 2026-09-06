"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLanguage } from "@/components/LanguageProvider";
import { TranslationKey } from "@/lib/i18n";

const items: { href: string; labelKey: TranslationKey; icon: string }[] = [
  { href: "/", labelKey: "nav_home", icon: "🏠" },
  { href: "/sales", labelKey: "nav_sales", icon: "🧾" },
  { href: "/inventory", labelKey: "nav_inventory", icon: "📦" },
  { href: "/customers", labelKey: "nav_customers", icon: "👥" },
  { href: "/more", labelKey: "nav_more", icon: "☰" },
];

const morePrefixes = ["/more", "/purchases", "/suppliers", "/expenses", "/reports", "/debts", "/categories", "/products", "/settings"];

export default function BottomNav() {
  const pathname = usePathname();
  const { t } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 mx-auto max-w-md border-t border-gray-200 bg-white safe-bottom md:hidden">
      <ul className="grid grid-cols-5">
        {items.map((item) => {
          let active: boolean;
          if (item.href === "/") {
            active = pathname === "/";
          } else if (item.href === "/more") {
            active = morePrefixes.some((p) => pathname.startsWith(p));
          } else {
            active = pathname.startsWith(item.href);
          }
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                className={`flex flex-col items-center justify-center gap-0.5 py-2.5 text-[11px] font-medium ${
                  active ? "text-brand-600" : "text-gray-400"
                }`}
              >
                <span className="text-xl leading-none">{item.icon}</span>
                {t(item.labelKey)}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
