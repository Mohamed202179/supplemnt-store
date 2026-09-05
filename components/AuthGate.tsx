"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import BottomNav from "@/components/BottomNav";
import DesktopNav from "@/components/DesktopNav";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [checked, setChecked] = useState(false);
  const [authed, setAuthed] = useState(false);

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
    if (!authed && pathname !== "/login") {
      router.replace("/login");
    }
    if (authed && pathname === "/login") {
      router.replace("/");
    }
  }, [checked, authed, pathname, router]);

  // Login page renders on its own, with no nav chrome around it.
  if (pathname === "/login") return <>{children}</>;

  if (!checked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">جارِ التحقق...</p>
      </div>
    );
  }

  if (!authed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-400">جارِ التحويل لتسجيل الدخول...</p>
      </div>
    );
  }

  return (
    <>
      <DesktopNav />
      <div className="mx-auto min-h-screen max-w-md bg-gray-50 pb-24 md:max-w-5xl md:pb-6">
        <main className="safe-top">{children}</main>
      </div>
      <BottomNav />
    </>
  );
}
