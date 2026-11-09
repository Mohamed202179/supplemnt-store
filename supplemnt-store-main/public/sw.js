// Minimal service worker — Phase 1.
// Only caches the app shell so "Add to Home Screen" behaves like an app.
// No offline data sync yet (data always comes live from Supabase).

const CACHE_NAME = "supplement-store-shell-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", () => {
  // Network-first passthrough — intentionally not caching API/data
  // requests so the store owner always sees live stock/sales data.
});
