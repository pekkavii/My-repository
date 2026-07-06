// Nuclear Accident Model — Service Worker
// Caches all app files for offline use

const CACHE_NAME = 'nuclear-model-v1';
const ASSETS = [
    '/My-repository/',
    '/My-repository/index.html',
    '/My-repository/script.js',
    '/My-repository/styles.css',
    '/My-repository/power_plants.json',
    '/My-repository/favicon.ico',
    '/My-repository/manifest.json',
    // Leaflet from CDN
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.js',
    'https://unpkg.com/leaflet@1.7.1/dist/leaflet.css',
];

// Install: cache all assets
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME).then(cache => {
            console.log('Service worker: caching files');
            // Cache what we can — CDN resources may fail in some environments
            return Promise.allSettled(
                ASSETS.map(url => cache.add(url).catch(() => {
                    console.warn('Could not cache:', url);
                }))
            );
        })
    );
    self.skipWaiting();
});

// Activate: remove old caches
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            )
        )
    );
    self.clients.claim();
});

// Fetch: serve from cache, fall back to network
self.addEventListener('fetch', event => {
    // Skip non-GET and open-meteo weather API (always needs network)
    if (event.request.method !== 'GET') return;
    if (event.request.url.includes('open-meteo.com')) return;

    event.respondWith(
        caches.match(event.request).then(cached => {
            if (cached) return cached;
            return fetch(event.request).then(response => {
                // Cache successful responses for future offline use
                if (response && response.status === 200) {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
                }
                return response;
            }).catch(() => {
                // Offline fallback for navigation requests
                if (event.request.destination === 'document') {
                    return caches.match('/My-repository/index.html');
                }
            });
        })
    );
});
