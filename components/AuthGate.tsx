"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import DesktopNav from "@/components/DesktopNav";
import { useRole } from "@/components/RoleProvider";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);
  const { hasAccess } = useRole();

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setAuthed(!!data.session);
      setChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!checked) return;
    if (!authed && pathname !== "/login" && pathname !== "/reset-password") {
      router.replace("/login");
    }
    if (authed && pathname === "/login") {
      router.replace("/");
    }
  }, [checked, authed, pathname, router]);

  if (pathname === "/login" || pathname === "/reset-password") return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">جارِ التحقق...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-950">
        <p className="text-sm text-gray-400">جارِ التحويل لتسجيل الدخول...</p>
      </div>
    );
  }

  if (!hasAccess) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-50 p-6 text-center dark:bg-gray-950">
        <p className="text-base font-bold text-gray-900 dark:text-gray-100">ليس لديك صلاحية على هذا المتجر</p>
        <p className="text-sm text-gray-500 dark:text-gray-400">تواصل مع صاحب المتجر لإضافتك.</p>
        <button
          onClick={async () => {
            await supabase.auth.signOut();
            router.replace("/login");
          }}
          className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
        >
          تسجيل الخروج
        </button>
      </div>
    );
  }

  return (
    <>
      <DesktopNav />
      <div className="mx-auto min-h-screen max-w-md bg-gray-50 pb-24 dark:bg-gray-950 md:max-w-5xl md:pb-6">
        <main className="safe-top">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
