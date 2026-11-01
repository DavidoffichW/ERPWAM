const CACHE_VERSION = 'erp-static-v0.2.2-erpwam';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './erpwam-mark.svg', './runtime-manifest.json'];

async function primeAppShell() {
  const cache = await caches.open(CACHE_VERSION);
  const indexUrl = new URL('./index.html', self.location.href);
  const indexResponse = await fetch(indexUrl, { cache: 'reload' });
  if (!indexResponse.ok) throw new Error(`Application shell returned ${indexResponse.status}.`);
  const html = await indexResponse.clone().text();
  const scopeUrl = new URL('./', self.location.href);
  const discoveredAssets = [...html.matchAll(/(?:src|href)="([^"]+)"/g)]
    .map((match) => new URL(match[1], indexUrl))
    .filter((url) => url.origin === scopeUrl.origin && url.href.startsWith(scopeUrl.href))
    .map((url) => url.href);
  const shellUrls = APP_SHELL.map((path) => new URL(path, self.location.href).href);
  await cache.addAll([...new Set([...shellUrls, ...discoveredAssets])]);
}

self.addEventListener('install', (event) => {
  event.waitUntil(primeAppShell());
});

self.addEventListener('activate', (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key.startsWith('erp-static-') && key !== CACHE_VERSION).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request).then(async (response) => {
      if (response.ok && response.type !== 'opaque') {
        const cache = await caches.open(CACHE_VERSION);
        await cache.put(new URL('./index.html', self.location.href).href, response.clone());
      }
      return response;
    }).catch(async () => {
      const cached = await caches.match(new URL('./index.html', self.location.href).href, { ignoreVary: true });
      return cached ?? Response.error();
    }));
    return;
  }
  event.respondWith(caches.match(request, { ignoreVary: true }).then((cached) => cached || fetch(request).then((response) => {
    if (!response.ok || response.type === 'opaque') return response;
    const copy = response.clone();
    event.waitUntil(caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy)));
    return response;
  }).catch(() => undefined)));
});
