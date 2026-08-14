const CACHE_NAME = 'resonance-v2';
const STREAM_CACHE_NAME = 'resonance-streams-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME && k !== STREAM_CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Range requests should be looked up / stored under a Range-stripped key
// so a full 200 response can be cached once and reused for offline playback + seeking.
function strippedRequest(request) {
  if (!request.headers.has('range')) return request;
  return new Request(request.url, {
    method: request.method,
    headers: request.headers,
    mode: request.mode,
    credentials: request.credentials,
  });
}

// Fetch: network first for API, cache first for static,
// network-first-with-cache-fallback for streams and artwork.
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Stream + artwork: cache for offline playback
  if (isSameOrigin && (url.pathname.match(/\/api\/tracks\/[^/]+\/(stream|transcoded)/) || url.pathname.endsWith('/artwork'))) {
    const cacheKey = strippedRequest(request);
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok && !request.headers.has('range') && request.method === 'GET') {
            const clone = response.clone();
            caches.open(STREAM_CACHE_NAME).then((cache) => cache.put(cacheKey, clone));
          }
          return response;
        })
        .catch(() =>
          caches.match(cacheKey).then((cached) => cached || Response.error())
        )
    );
    return;
  }

  // API requests: network only (auth required)
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/rest/')) {
    event.respondWith(fetch(request));
    return;
  }

  // Static assets: cache first, network fallback
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (response.ok && request.method === 'GET') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    })
  );
});
