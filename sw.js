/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SERVICE WORKER (v15 - Modular Asset Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'singularity-city-v25';

// BUG FIX: Updated CORE_ASSETS to reflect the new modular architecture filenames!
const CORE_ASSETS = [
    '/',
    '/index.html',
    '/manifest.json',
    '/og-image.png',
    '/favicon.ico',
    '/favicon-32.png',
    '/icon-192.png',
    '/icon-512.png',
    '/css/styles.css',
    '/js/data.js',
    '/js/api.js',
    '/js/ui.js',
    '/js/snd.js',
    '/js/camera.js',
    '/js/environment.js',
    '/js/entities_gfx.js',
    '/js/entities.js',
    '/js/interior_city_props.js',
    '/js/interior_city_ai.js',
    '/js/interior_city_core.js',
    '/js/interior_res_props.js',
    '/js/interior_res_ai.js',
    '/js/interior_res_core.js',
    '/js/interior_manager.js',
    '/js/burn_tracker.js',
    '/js/space_data.js',
    '/js/space_environment.js',
    '/js/space_entities.js',
    '/js/space_interior.js',
    '/js/holomap.js',
    '/js/engine.js'
];

self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(CORE_ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(cacheNames => {
            return Promise.all(
                cacheNames.map(cacheName => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});

self.addEventListener('fetch', event => {
    event.respondWith(
        caches.match(event.request)
            .then(response => {
                if (response) {
                    return response;
                }
                return fetch(event.request);
            })
    );
});
