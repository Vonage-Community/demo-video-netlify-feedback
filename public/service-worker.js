const CACHE_NAME = 'feedback-dashboard-v1';

// Static assets to cache immediately upon installation
const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/app.js',
    '/dashboard.html',
    '/dashboard.css',
    '/dashboard.js',
    // Add the URL of your QR Code library so it works offline
    'https://cdnjs.cloudflare.com/ajax/libs/qrcodejs/1.0.0/qrcode.min.js'
];

// Install Event: Pre-cache static assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(STATIC_ASSETS);
        })
    );
    self.skipWaiting();
});

// Activate Event: Clean up old caches if you change the CACHE_NAME version
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.filter((name) => name !== CACHE_NAME)
                    .map((name) => caches.delete(name))
            );
        })
    );
    self.clients.claim();
});

// Fetch Event: Handle network routing
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);

    // STRATEGY 1: Network-First for API calls (Fallback to cache if offline)
    if (url.pathname.startsWith('/api/')) {
        event.respondWith(
            fetch(event.request)
                .then((response) => {
                    // If network succeeds, clone the response and update the cache
                    const clonedResponse = response.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, clonedResponse);
                    });
                    return response;
                })
                .catch(() => {
                    // If network fails (offline), serve the last known API response from cache
                    return caches.match(event.request);
                })
        );
        return; // Exit fetch handler for API routes
    }

    // STRATEGY 2: Cache-First for static assets (CSS, JS, HTML, Images)
    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            // Return cached version if found
            if (cachedResponse) {
                return cachedResponse;
            }
            // Otherwise fetch from network and cache it for next time
            return fetch(event.request).then((networkResponse) => {
                const clonedResponse = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, clonedResponse);
                });
                return networkResponse;
            });
        })
    );
});