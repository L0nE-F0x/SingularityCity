/* ════════════════════════════════════════════════════════════════════════════
   SHARED — real launch data (Launch Library 2 / thespacedevs).

   THIS IS THE SOURCE OF TRUTH for "which rocket is launching, from where, when".
   Both the 2D city and First Person read it, so the two views can never disagree
   about a launch.

   Why this file exists: First Person used to fabricate launches on a random
   timer (a rocket every 60-180s from a random pad, toasted as if real) while the
   2D city drove them from this API. That is the same bug class as the jail and
   the court — a parallel simulation pretending to be live data. Anything that
   claims to be a real-world event belongs here, read by both apps, derived twice
   by neither.

   The cache key and TTL are deliberately shared with the 2D app: if a visitor
   has already loaded the 2D city, First Person starts with the same launch set
   and makes no second network call.

   ESM so First Person can import it natively. Named .js rather than .mjs so it
   inherits netlify.toml's /*.js Content-Type rule (a "*.js" glob does not match
   ".mjs"). The 2D app is classic scripts and still carries its own copy in
   js/space_data.js — see the switch-over note at the bottom of this file.
   ════════════════════════════════════════════════════════════════════════════ */

export const LAUNCH_CACHE_KEY = 'sc_launches';
export const LAUNCH_TTL_MS = 15 * 60 * 1000;

const ENDPOINT = 'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=20';

/**
 * Map a Launch Library provider name onto one of the city's space orgs (which is
 * also the pad's `org` field, so this is what binds a launch to a pad).
 * Order matters: specific commercial providers must be tested before the
 * country-level fallthroughs, or "China ..." would swallow Galactic Energy etc.
 */
export function getOrgForProvider(providerName) {
    const n = String(providerName || '').toLowerCase();
    if (!n) return null;

    // Specific commercial providers first.
    if (n.includes('spacex')) return 'spacex';
    if (n.includes('blue origin')) return 'blue_origin';
    if (n.includes('rocket lab')) return 'rocketlab';
    if (n.includes('northrop grumman')) return 'northrop_grumman';
    if (n.includes('firefly')) return 'firefly';
    if (n.includes('landspace')) return 'landspace';
    if (n.includes('ula') || n.includes('united launch')) return 'ula';

    // National agencies and their commercial operators.
    if (n.includes('nasa')) return 'nasa';
    if (n.includes('isro') || n.includes('indian space')) return 'isro';
    if (n.includes('jaxa') || n.includes('mitsubishi')) return 'jaxa';
    if (n.includes('roscosmos') || n.includes('russian federal')) return 'roscosmos';

    // European cluster — Arianespace, Avio (Vega), Isar, Rocket Factory Augsburg.
    if (n.includes('arianespace') || n.includes('esa') || n.includes('european space') ||
        n.includes('avio') || n.includes('isar') || n.includes('rocket factory')) return 'esa';

    // Chinese state + commercial — CASC, Galactic Energy, ExPace, Deep Blue, iSpace, Orienspace.
    if (n.includes('casc') || n.includes('china') || n.includes('galactic energy') ||
        n.includes('expace') || n.includes('deep blue') || n.includes('ispace') ||
        n.includes('orienspace')) return 'cnsa';

    return null;
}

/** Normalise one API row to the shape both apps store and render. */
function normalise(l) {
    return {
        id: l.id,
        name: l.name,
        net: l.net,                                  // NET = No Earlier Than (ISO)
        status: (l.status && l.status.abbrev) || 'TBD',
        provider: (l.launch_service_provider && l.launch_service_provider.name) || 'Unknown',
        rocket: (l.rocket && l.rocket.configuration && l.rocket.configuration.name) || 'Unknown',
        pad: (l.pad && l.pad.name) || 'Unknown',
        mission: (l.mission && l.mission.name) || null,
        image: l.image || null
    };
}

/** Read the shared cache without touching the network. Null when cold/stale. */
export function readCachedLaunches({ ignoreTtl = false } = {}) {
    try {
        const cached = JSON.parse(localStorage.getItem(LAUNCH_CACHE_KEY));
        if (!cached || !Array.isArray(cached.data)) return null;
        if (!ignoreTtl && Date.now() - cached.ts >= LAUNCH_TTL_MS) return null;
        return cached.data;
    } catch (_) {
        return null;
    }
}

/**
 * Fetch upcoming launches, preferring the shared cache.
 * Never throws and never returns null — on any failure it degrades to the last
 * known good list (even if stale), then to []. A network blip must not make the
 * Space Zone start inventing launches again.
 */
export async function fetchLaunches({ force = false } = {}) {
    if (!force) {
        const cached = readCachedLaunches();
        if (cached) return cached;
    }
    try {
        const r = await fetch(ENDPOINT, { signal: AbortSignal.timeout(10000) });
        if (!r.ok) {
            // 429 is expected without an API key — fall back rather than clearing.
            return readCachedLaunches({ ignoreTtl: true }) || [];
        }
        const d = await r.json();
        if (!d || !Array.isArray(d.results)) {
            return readCachedLaunches({ ignoreTtl: true }) || [];
        }
        const data = d.results.map(normalise);
        try {
            localStorage.setItem(LAUNCH_CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
        } catch (_) { /* quota — serving from memory is still correct */ }
        return data;
    } catch (_) {
        return readCachedLaunches({ ignoreTtl: true }) || [];
    }
}

/** Soonest launch still in the future, else the first known. */
export function getNextLaunch(launches) {
    if (!launches || !launches.length) return null;
    const now = Date.now();
    return launches.find(l => Date.parse(l.net) > now) || launches[0];
}

/** "T-2d 4h 11m" / "T-3h 2m 9s" / "T-4m 12s", or 'LAUNCHED' once NET passes. */
export function getCountdown(launch) {
    if (!launch || !launch.net) return null;
    const diff = Date.parse(launch.net) - Date.now();
    if (diff < 0) return 'LAUNCHED';
    const d = Math.floor(diff / 86400000);
    const h = Math.floor((diff % 86400000) / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);
    if (d > 0) return `T-${d}d ${h}h ${m}m`;
    if (h > 0) return `T-${h}h ${m}m ${s}s`;
    return `T-${m}m ${s}s`;
}

/**
 * Bind launches to pads by org. Returns { [orgKey]: launch } keeping only the
 * soonest still-relevant launch per org.
 *
 * `net` is No Earlier Than, so a launch routinely sits slightly in the past
 * while it is actually happening. GRACE_MS keeps it bound for a few minutes
 * after NET rather than dropping it the instant the clock passes — that window
 * is exactly when the pad should be showing ignition.
 */
export const LAUNCH_GRACE_MS = 5 * 60 * 1000;

export function matchLaunchesToOrgs(launches) {
    const byOrg = {};
    if (!launches) return byOrg;
    const now = Date.now();
    for (const l of launches) {
        const org = getOrgForProvider(l.provider);
        if (!org) continue;
        const diff = Date.parse(l.net) - now;
        if (isNaN(diff) || diff <= -LAUNCH_GRACE_MS) continue;
        const held = byOrg[org];
        if (!held || Date.parse(l.net) < Date.parse(held.net)) byOrg[org] = l;
    }
    return byOrg;
}
