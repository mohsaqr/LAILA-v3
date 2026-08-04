// Bumped from laila-v1 so the activate handler below deletes the old cache.
// That cache holds cross-origin runtime scripts this worker should never have
// stored; a rename is what actually evicts them from browsers already carrying
// a poisoned copy.
const CACHE_NAME = 'laila-v2';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first with cache fallback
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only ever handle same-origin requests.
  //
  // This worker exists to cache the app's own shell. Left unguarded it
  // intercepts EVERY GET on every origin — the WebR and Pyodide runtimes, the
  // Google Fonts files — and it handles them badly in two ways:
  //
  //   1. The not-in-cache branch below has no .catch(), so any fetch rejection
  //      rejects respondWith, which the browser reports to the caller as a hard
  //      network error. In webR that surfaces as
  //      "Worker loading error: Network error loading .../webr-worker.js"
  //      and no R lab can start.
  //   2. A cross-origin script, once cached, is served from cache indefinitely
  //      — the runtimes get pinned to whatever copy was stored first.
  //
  // Neither belongs to a shell cache. Returning without calling respondWith
  // hands the request back to the browser untouched.
  if (url.origin !== self.location.origin) {
    return;
  }

  // Skip API requests - always go to network
  if (url.pathname.startsWith('/api')) {
    return;
  }

  // Skip non-GET requests
  if (request.method !== 'GET') {
    return;
  }

  // For navigation requests (HTML pages), try network first
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // Clone the response before caching
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
          return response;
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then((cachedResponse) => {
            return cachedResponse || caches.match('/');
          });
        })
    );
    return;
  }

  // For static assets, try cache first, then network
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in background
        event.waitUntil(
          fetch(request).then((response) => {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, response);
            });
          }).catch(() => {})
        );
        return cachedResponse;
      }

      // Not in cache, fetch from network
      return fetch(request).then((response) => {
        // Cache successful responses for static assets
        if (response.ok && (
          url.pathname.endsWith('.js') ||
          url.pathname.endsWith('.css') ||
          url.pathname.endsWith('.png') ||
          url.pathname.endsWith('.svg') ||
          url.pathname.endsWith('.woff2')
        )) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseClone);
          });
        }
        return response;
      });
    })
  );
});
