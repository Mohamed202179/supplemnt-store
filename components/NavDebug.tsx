"use client";

// TEMPORARY navigation diagnostics overlay. Remove this file and its mount in
// app/layout.tsx when finished. Renders nothing unless ?navdebug=1 was used.
// Passive only: it listens to events, never calls preventDefault, never
// touches history, and never navigates.

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { navClearLog, navDebugEnabled, navLog, navReadLog, navSnapshot } from "@/lib/navDebug";

export default function NavDebug() {
  const pathname = usePathname();
  const [enabled, setEnabled] = useState(false);
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!navDebugEnabled()) return;
    setEnabled(true);

    const nav = performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as unknown as { standalone?: boolean }).standalone === true;
    let sameOriginReferrer: boolean | string = "none";
    try {
      sameOriginReferrer = document.referrer ? new URL(document.referrer).origin === window.location.origin : "none";
    } catch {
      /* ignore */
    }
    // type: navigate | reload | back_forward | prerender (a NEW document load)
    navLog("doc-load", { navType: nav?.type ?? "unknown", standalone, sameOriginReferrer, ...navSnapshot() });

    const onPop = () => navLog("popstate", navSnapshot());
    const onShow = (e: PageTransitionEvent) =>
      navLog("pageshow", { persisted: e.persisted, ...navSnapshot() });
    const onHide = (e: PageTransitionEvent) =>
      navLog("pagehide", { persisted: e.persisted, ...navSnapshot() });
    const onVis = () => navLog("visibility", { state: document.visibilityState, ...navSnapshot() });
    const refresh = () => setLines(navReadLog());

    window.addEventListener("popstate", onPop);
    window.addEventListener("pageshow", onShow);
    window.addEventListener("pagehide", onHide);
    document.addEventListener("visibilitychange", onVis);
    window.addEventListener("navdebug:update", refresh);
    refresh();

    return () => {
      window.removeEventListener("popstate", onPop);
      window.removeEventListener("pageshow", onShow);
      window.removeEventListener("pagehide", onHide);
      document.removeEventListener("visibilitychange", onVis);
      window.removeEventListener("navdebug:update", refresh);
    };
  }, []);

  // Route change (client-side navigation) — fires when usePathname changes.
  useEffect(() => {
    if (!enabled) return;
    navLog("route", navSnapshot());
  }, [pathname, enabled]);

  if (!enabled) return null;

  async function copy() {
    try {
      await navigator.clipboard.writeText(navReadLog().join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable: user can select the text instead */
    }
  }

  return (
    <div dir="ltr" style={{ position: "fixed", zIndex: 9999, right: 8, bottom: 84, fontFamily: "monospace" }}>
      {open ? (
        <div
          style={{
            position: "fixed",
            left: 12,
            right: 12,
            bottom: 84,
            maxHeight: "50vh",
            display: "flex",
            flexDirection: "column",
            background: "rgba(0,0,0,0.88)",
            color: "#d1fae5",
            borderRadius: 8,
            fontSize: 10,
            padding: 8,
          }}
        >
          <div style={{ display: "flex", gap: 8, marginBottom: 6 }}>
            <button onClick={copy} style={{ color: "#fff", border: "1px solid #888", padding: "2px 8px", borderRadius: 4 }}>
              {copied ? "Copied" : "Copy"}
            </button>
            <button onClick={navClearLog} style={{ color: "#fff", border: "1px solid #888", padding: "2px 8px", borderRadius: 4 }}>
              Clear
            </button>
            <button onClick={() => setOpen(false)} style={{ color: "#fff", border: "1px solid #888", padding: "2px 8px", borderRadius: 4, marginInlineStart: "auto" }}>
              Close
            </button>
          </div>
          <pre style={{ overflow: "auto", whiteSpace: "pre-wrap", margin: 0, userSelect: "text" }}>
            {lines.join("\n") || "(no events yet)"}
          </pre>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          style={{ background: "rgba(0,0,0,0.75)", color: "#fff", fontSize: 10, padding: "4px 8px", borderRadius: 999 }}
        >
          NAV {lines.length}
        </button>
      )}
    </div>
  );
}
