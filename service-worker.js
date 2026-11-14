const CACHE_NAME = "aldawly-tools-v16-custom-domain";
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
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  event.respondWith(fetch(request, {cache:"no-store"}).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
    }
    return response;
  }).catch(() => caches.match(request).then(cached => cached || caches.match("/index.html"))));
});