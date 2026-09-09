// ─── LOG TALLY SERVICE WORKER ─────────────────────────────────────────────────
const CACHE_NAME = 'log-tally-v1';
const APP_SHELL = [
  '/',
  '/index.html',
  '/css/style.css',
  '/js/config.js',
  '/js/app.js',
  '/js/keypad.js',
  '/js/speech.js',
  '/js/sheets.js',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(APP_SHELL.map(url => cache.add(url).catch(() => {})))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter(n => n !== CACHE_NAME).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('googleapis.com') || url.hostname.includes('accounts.google.com') || url.hostname.includes('googleusercontent.com')) return;
  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) {
        fetch(event.request).then((res) => { if (res && res.status === 200) caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone())); }).catch(() => {});
        return cached;
      }
      return fetch(event.request).then((res) => {
        if (!res || res.status !== 200) return res;
        caches.open(CACHE_NAME).then(c => c.put(event.request, res.clone()));
        return res;
      }).catch(() => caches.match('/index.html'));
    })
  );
});
