/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SERVICE WORKER (v15 - Modular Asset Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CACHE_NAME = 'singularity-city-v285';

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
    '/js/personality.js',
    '/js/data.js',
    '/js/api.js',
    '/js/ui.js',
    '/js/snd.js',
    '/js/camera.js',
    '/js/environment.js',
    '/js/entities_gfx.js',
    '/js/entities.js',
    '/js/city_elevator.js',
    '/js/interior_city_props.js',
    '/js/interior_city_ai.js',
    '/js/interior_avatar_states.js',
    '/js/interior_city_core.js',
    '/js/interior_res_props.js',
    '/js/interior_res_ai.js',
    '/js/interior_res_core.js',
    '/js/power_zone.js',
    '/js/power_env.js',
    '/js/power_zone_interior.js',
    '/js/port_zone.js',
    '/js/port_env.js',
    '/js/interior_dc.js',
    '/js/interior_bar.js',
    '/js/npc_housing.js',
    '/js/street_vendors.js',
    '/js/interior_npc.js',
    '/js/interior_legacy.js',
    '/js/interior_metro.js',
    '/js/interior_newspaper.js',
    '/js/seasonal.js',
    '/js/seasonal_env.js',
    '/js/aurora.js',
    '/js/conference.js',
    '/js/university.js',
    '/js/court.js',
    '/js/vc_row.js',
    '/js/vc_row_env.js',
    '/js/interior_vcrow.js',
    '/js/backbone_zone.js',
    '/js/backbone_env.js',
    '/js/interior_backbone.js',
    '/js/robotics_zone.js',
    '/js/robotics_env.js',
    '/js/interior_robotics.js',
    '/js/longevity_zone.js',
    '/js/longevity_env.js',
    '/js/interior_longevity.js',
    '/js/xray_mode.js',
    '/js/multiplayer.js',
    '/js/interior_manager.js',
    '/js/datacenter_data.js',
    '/js/space_data.js',
    '/js/space_environment.js',
    '/js/space_entities.js',
    '/js/space_interior.js',
    '/js/orbit_mode.js',
    '/js/holomap.js',
    '/js/easter_eggs.js',
    '/js/persistence.js',
    '/js/macro_view.js',
    '/js/debug_overlay.js',
    '/js/bitmap_fonts.js',
    '/js/goals.js',
    '/js/auto_tour.js',
    '/js/newspaper.js',
    '/js/compute_worker.js',
    '/js/kardashev.js',
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
        }).then(() => self.clients.claim()) // immediately take control of all pages
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
            .catch(() => {
                // Network failed and not in cache — return offline fallback
                if (event.request.mode === 'navigate') {
                    return caches.match('/index.html');
                }
                return new Response('', { status: 503, statusText: 'Offline' });
            })
    );
});
