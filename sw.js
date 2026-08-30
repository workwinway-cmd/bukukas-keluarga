// Service Worker — Buku Kas Keluarga
// Meng-cache "app shell" (HTML/manifest/ikon + library CDN yang dipakai) supaya
// aplikasi tetap bisa dibuka walau HP sedang offline. Data transaksi TIDAK
// disimpan di sini — itu tetap lewat localStorage / sinkron cloud di dalam app.
const CACHE_NAME = 'bukukas-shell-v2';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Strategi: network-first untuk dokumen HTML (biar update terbaru selalu dicoba dulu),
// cache-first untuk aset statis (ikon/manifest/library), dan SELALU lewatkan (jangan
// dicache) permintaan ke API sinkron (Cloudflare Worker) & GitHub supaya data selalu segar.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.pathname.includes('/api/state') || url.hostname.includes('api.github.com')) {
    return; // biarkan lewat langsung ke jaringan, tidak dicache
  }

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req).then((res) => {
        if (res && res.status === 200 && (url.origin === self.location.origin || url.hostname === 'cdnjs.cloudflare.com' || url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
    })
  );
});
