"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";
import { UserRole } from "@/lib/types";

interface RoleContextValue {
  role: UserRole | null;
  isOwner: boolean;
  roleLoaded: boolean;
  /** false = مستخدم مسجّل بس مش عضو في البراند ده (بيحصل في البراندات من نوع v2 فقط) */
  hasAccess: boolean;
}

const RoleContext = createContext<RoleContextValue>({ role: null, isOwner: false, roleLoaded: false, hasAccess: true });

export function RoleProvider({ children }: { children: React.ReactNode }) {
  const [role, setRole] = useState<UserRole | null>(null);
  const [roleLoaded, setRoleLoaded] = useState(false);
  const [hasAccess, setHasAccess] = useState(true);

  useEffect(() => {
    let mounted = true;

    async function loadRole() {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;

      if (!userId) {
        if (mounted) {
          setRole(null);
          setRoleLoaded(true);
        }
        return;
      }

      if (brand.mode === "v2") {
        // البراندات الجديدة: الدور من عضوية المستخدم في البراند (مفيش عضوية = مفيش دخول)
        const { data: r } = await supabase.rpc("my_role");
        if (mounted) {
          const known = r === "owner" || r === "cashier";
          setRole(known ? (r as UserRole) : null);
          setHasAccess(known);
          setRoleLoaded(true);
        }
        return;
      }

      const { data } = await supabase.from("profiles").select("role").eq("id", userId).single();
      if (mounted) {
        setRole((data?.role as UserRole) ?? "cashier");
        setRoleLoaded(true);
      }
    }

    loadRole();

    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      loadRole();
    });

    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return (
    <RoleContext.Provider value={{ role, isOwner: role === "owner", roleLoaded, hasAccess }}>
      {children}
    </RoleContext.Provider>
  );
}

export function useRole(): RoleContextValue {
  return useContext(RoleContext);
}
