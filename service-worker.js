/* Theatre service worker — offline-first shell.
   Bump CACHE when you change the app so clients pick up the new version. */
const CACHE = "theatre-v5";
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.webmanifest",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-maskable-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);

  // Cross-origin (Google sign-in / Drive API) — always go to the network, never cache.
  if (url.origin !== location.origin) return;

  // library.json — network-first so newly added pages show up; cache for offline.
  if (url.pathname.endsWith("library.json")) {
    e.respondWith(
      fetch(req)
        .then(resp => { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return resp; })
        .catch(() => caches.match(req))
    );
    return;
  }

  // App shell / navigations — network-first so updates show when online, cache when offline.
  if (req.mode === "navigate") {
    e.respondWith(
      fetch(req)
        .then(resp => { const copy = resp.clone(); caches.open(CACHE).then(c => c.put(req, copy)); return resp; })
        .catch(() => caches.match(req).then(r => r || caches.match("./index.html")))
    );
    return;
  }

  // Other same-origin assets (icons, future study pages) — cache-first, fill on miss.
  e.respondWith(
    caches.match(req).then(cached =>
      cached || fetch(req).then(resp => {
        const copy = resp.clone();
        caches.open(CACHE).then(c => c.put(req, copy));
        return resp;
      }).catch(() => cached)
    )
  );
});
