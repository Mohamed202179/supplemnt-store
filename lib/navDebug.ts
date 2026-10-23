// TEMPORARY navigation diagnostics. Remove this file (and its 4 call sites)
// once the swipe-back investigation is finished.
//
// Active only after the page has been opened with ?navdebug=1 (remembered for
// that browser tab via sessionStorage; ?navdebug=0 turns it off). It records
// navigation METADATA only: sanitized pathname, history.length, event names.
// It never records the query string, URL hash (which can hold auth tokens),
// session/user data, customer data, or environment values.
// It does not change routing and never touches browser history.

const FLAG_KEY = "navdebug:on";
const LOG_KEY = "navdebug:log";
const MAX_LINES = 300;

type Value = string | number | boolean | null | undefined;

export function navDebugEnabled(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const param = new URLSearchParams(window.location.search).get("navdebug");
    if (param === "1") window.sessionStorage.setItem(FLAG_KEY, "1");
    if (param === "0") {
      window.sessionStorage.removeItem(FLAG_KEY);
      window.sessionStorage.removeItem(LOG_KEY);
    }
    return window.sessionStorage.getItem(FLAG_KEY) === "1";
  } catch {
    return false;
  }
}

// Replace id-like path segments (UUIDs, long numbers) so no record ids are logged.
export function sanitizePath(path: string): string {
  return path
    .split("/")
    .map((seg) =>
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(seg) || /^\d{4,}$/.test(seg)
        ? ":id"
        : seg
    )
    .join("/");
}

// Current navigation metadata (pathname only — never search or hash).
export function navSnapshot(): Record<string, Value> {
  if (typeof window === "undefined") return {};
  const state = window.history.state as { __NA?: unknown } | null;
  return {
    path: sanitizePath(window.location.pathname),
    hl: window.history.length,
    nextState: state ? (state.__NA ? "next" : "other") : "none",
  };
}

export function navReadLog(): string[] {
  try {
    return JSON.parse(window.sessionStorage.getItem(LOG_KEY) || "[]") as string[];
  } catch {
    return [];
  }
}

export function navClearLog(): void {
  try {
    window.sessionStorage.removeItem(LOG_KEY);
    window.dispatchEvent(new Event("navdebug:update"));
  } catch {
    /* ignore */
  }
}

export function navLog(event: string, data?: Record<string, Value>): void {
  if (!navDebugEnabled()) return;
  try {
    const d = new Date();
    const p = (n: number, w = 2) => String(n).padStart(w, "0");
    const ts = `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
    const fields = data
      ? " " +
        Object.entries(data)
          .map(([k, v]) => `${k}=${String(v)}`)
          .join(" ")
      : "";
    const lines = navReadLog();
    lines.push(`${ts} ${event}${fields}`);
    window.sessionStorage.setItem(LOG_KEY, JSON.stringify(lines.slice(-MAX_LINES)));
    window.dispatchEvent(new Event("navdebug:update"));
  } catch {
    /* diagnostics must never break the app */
  }
}
