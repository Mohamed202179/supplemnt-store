"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useRole } from "@/components/RoleProvider";

// Wraps a page that only the store owner should be able to use.
// A cashier who navigates here directly (e.g. by typing the URL) sees a
// brief message and gets redirected home — this backs up the database-level
// permission checks, it isn't the only line of defense.
export default function OwnerGate({ children }: { children: React.ReactNode }) {
  const { isOwner, roleLoaded } = useRole();
  const router = useRouter();

  useEffect(() => {
    if (roleLoaded && !isOwner) {
      router.replace("/");
    }
  }, [roleLoaded, isOwner, router]);

  if (!roleLoaded) {
    return <p className="p-10 text-center text-sm text-gray-400">جارِ التحقق...</p>;
  }

  if (!isOwner) {
    return <p className="p-10 text-center text-sm text-gray-400">ليس لديك صلاحية للوصول لهذه الصفحة</p>;
  }

  return <>{children}</>;
}
