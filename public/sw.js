const CACHE_NAME = "landscaip-v1";

self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener("fetch", (event) => {
  // Network-first strategy for all requests
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});
