const CACHE_NAME = "aldawly-tools-v27-remove-all-extra-search-buttons";
const APP_SHELL = [
  "/",
  "/index.html",
  "/products.html",
  "/store.css",
  "/assets/app-icon.svg",
  "/assets/app-icon-192.svg",
  "/assets/app-icon-512.svg",
  "/assets/app-icon-192.png",
  "/assets/app-icon-512.png"
];
self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", event => {
  const request = event.request;
  const requestUrl = new URL(request.url);
  if (request.method !== "GET" || requestUrl.origin !== self.location.origin) return;
  // API responses are dynamic and must never enter the offline asset cache.
  if (requestUrl.pathname.startsWith("/api/")) return;
  event.respondWith(fetch(request, {cache:"no-store"}).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    // Only document navigations may fall back to the home page.
    // Returning index.html for a failed CSS/JS/image request causes MIME errors.
    if (request.mode === "navigate") {
      const home = await caches.match("/index.html");
      if (home) return home;
    }
    return new Response("المحتوى غير متاح دون اتصال بالإنترنت.", {
      status: 503,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" }
    });
  }));
});