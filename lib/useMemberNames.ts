"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { brand } from "@/lib/brand";

// أسماء أعضاء البراند (user_id -> الاسم) لعرض "بواسطة فلان". بتتجاب مرة واحدة وبتتخزّن.
type Names = Record<string, string>;
let cache: Names | null = null;
let inflight: Promise<Names | null> | null = null;

async function fetchNames(): Promise<Names | null> {
  const { data, error } = await supabase.rpc("member_names");
  if (error || !data) return null; // مثلًا الـ SQL لسه ماتشغّلش: نكمّل من غير أسماء
  const map: Names = {};
  for (const r of data as { user_id: string; name: string | null }[]) {
    if (r.name) map[r.user_id] = r.name;
  }
  return map;
}

export function useMemberNames(): Names {
  const [names, setNames] = useState<Names>(cache ?? {});
  useEffect(() => {
    if (brand.mode !== "v2" || cache) return;
    if (!inflight) {
      inflight = fetchNames().then((m) => {
        if (m) cache = m;
        inflight = null;
        return m;
      });
    }
    let alive = true;
    inflight.then((m) => {
      if (alive && m) setNames(m);
    });
    return () => {
      alive = false;
    };
  }, []);
  return names;
}
