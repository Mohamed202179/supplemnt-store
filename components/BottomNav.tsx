"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const items = [
  { href: "/", label: "الرئيسية", icon: "🏠" },
  { href: "/sales", label: "المبيعات", icon: "🧾" },
  { href: "/inventory", label: "المخزون", icon: "📦" },
  { href: "/customers", label: "العملاء", icon: "👥" },
  { href: "/more", label: "المزيد", icon: "☰" },
];

const morePrefixes = ["/more", "/purchases", "/suppliers", "/expenses", "/reports", "/debts", "/categories", "/products", "/settings"];

export default function BottomNav() {
  const pathname = usePathname();

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
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
