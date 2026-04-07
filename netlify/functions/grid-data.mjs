// ════════════════════════════════════════════════════════════════
// GLOBAL POWER GRID DATA — Netlify Serverless Function
// Proxies OpenStreetMap Overpass API queries server-side to avoid
// browser CORS/CSP issues and rate-limit problems.
// Caches results in-memory for 6 hours (warm container) and
// sends Cache-Control headers for CDN/browser caching.
// ════════════════════════════════════════════════════════════════

const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
];

const GRID_REGIONS = [
    [24, -130, 50, -60,  'North America'],
    [35,  -12, 62,  30,  'Europe'],
    [10,   60, 55, 145,  'Asia-Pacific'],
    [-35, -75, 12, -34,  'South America'],
    [-38, 112, -10, 155, 'Australia'],
    [20,   30, 42,  60,  'Middle East'],
    [-35,  10, 38,  52,  'Africa'],
];

// In-memory cache survives across warm function invocations
globalThis._gridCache = globalThis._gridCache || null;
globalThis._gridCacheTs = globalThis._gridCacheTs || 0;
const CACHE_TTL = 6 * 3600 * 1000; // 6 hours

function parseMW(str) {
    if (!str) return 0;
    const m = str.match(/([\d.,]+)\s*(GW|MW|kW|W)\b/i);
    if (!m) return 0;
    let v = parseFloat(m[1].replace(/,/g, ''));
    const u = m[2].toUpperCase();
    if (u === 'GW') v *= 1000;
    if (u === 'KW') v /= 1000;
    if (u === 'W')  v /= 1e6;
    return v;
}

function classifySource(src) {
    if (!src) return 'Other';
    const s = src.toLowerCase();
    if (s.includes('solar'))                                  return 'Solar';
    if (s.includes('wind'))                                   return 'Wind';
    if (s.includes('nuclear'))                                return 'Nuclear';
    if (s.includes('hydro') || s.includes('water'))           return 'Hydro';
    if (s.includes('coal') || s.includes('lignite'))          return 'Coal';
    if (s.includes('gas') && !s.includes('biogas'))           return 'Gas';
    if (s.includes('oil') || s.includes('diesel'))            return 'Oil';
    if (s.includes('biomass') || s.includes('biofuel') || s.includes('biogas') || s.includes('wood')) return 'Biomass';
    if (s.includes('waste'))                                  return 'Waste';
    if (s.includes('geothermal'))                             return 'Geothermal';
    if (s.includes('tidal') || s.includes('wave'))            return 'Tidal';
    return 'Other';
}

function classifyRegion(lat, lon) {
    for (const [south, west, north, east, label] of GRID_REGIONS) {
        if (lat >= south && lat <= north && lon >= west && lon <= east) return label;
    }
    return 'Other';
}

async function queryOverpass(query, endpointIdx) {
    const url = OVERPASS_ENDPOINTS[endpointIdx];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    try {
        const r = await fetch(url, {
            method: 'POST',
            body: 'data=' + encodeURIComponent(query),
            signal: controller.signal
        });
        clearTimeout(timer);
        if (r.status === 429) throw new Error('rate-limited');
        if (r.status === 504) throw new Error('server-busy');
        if (!r.ok) throw new Error('http-' + r.status);
        return await r.json();
    } catch (e) {
        clearTimeout(timer);
        throw e;
    }
}

async function fetchGridData() {
    // Build ONE combined query for all regions
    const bboxUnion = GRID_REGIONS.map(([s, w, n, e]) =>
        `  node["power"="plant"](${s},${w},${n},${e});\n  way["power"="plant"](${s},${w},${n},${e});`
    ).join('\n');

    const query = `[out:json][timeout:120];\n(\n${bboxUnion}\n);\nout tags center;`;

    // Try each endpoint
    for (let ep = 0; ep < OVERPASS_ENDPOINTS.length; ep++) {
        try {
            console.log(`⚡ Trying Overpass endpoint ${ep}...`);
            const data = await queryOverpass(query, ep);
            const elements = data.elements || [];
            console.log(`⚡ Got ${elements.length} elements from endpoint ${ep}`);
            return processElements(elements);
        } catch (e) {
            console.warn(`⚡ Endpoint ${ep} failed: ${e.message}`);
            if (ep < OVERPASS_ENDPOINTS.length - 1) {
                await new Promise(r => setTimeout(r, 3000));
            }
        }
    }
    throw new Error('All Overpass endpoints failed');
}

function processElements(elements) {
    const bySource = {};
    const byRegion = {};
    let plantCount = 0;
    let totalMW = 0;

    const sourceEmojis = {
        Solar: '☀️', Wind: '💨', Nuclear: '☢️', Hydro: '🌊', Coal: '🏭',
        Gas: '🔥', Oil: '🛢️', Biomass: '🌿', Waste: '♻️', Geothermal: '🌋',
        Tidal: '🌊', Other: '⚡'
    };
    const sourceColors = {
        Solar: '#fbbf24', Wind: '#4ade80', Nuclear: '#22d3ee', Hydro: '#06b6d4',
        Coal: '#94a3b8', Gas: '#f97316', Oil: '#78716c', Biomass: '#a3e635',
        Waste: '#a78bfa', Geothermal: '#ef4444', Tidal: '#0ea5e9', Other: '#64748b'
    };

    for (const el of elements) {
        const tags = el.tags || {};
        const src = tags['plant:source'] || tags['generator:source'] || '';
        const mwStr = tags['plant:output:electricity'] || tags['generator:output:electricity'] || '';
        const mw = parseMW(mwStr);
        const name = tags.name || tags.operator || '';
        const type = classifySource(src);

        const lat = el.lat ?? el.center?.lat ?? 0;
        const lon = el.lon ?? el.center?.lon ?? 0;
        const region = classifyRegion(lat, lon);

        if (!bySource[type]) bySource[type] = { count: 0, totalMW: 0, emoji: sourceEmojis[type] || '⚡', color: sourceColors[type] || '#64748b', plants: [] };
        bySource[type].count++;
        bySource[type].totalMW += mw;
        if (mw >= 100 && bySource[type].plants.length < 5) {
            bySource[type].plants.push({ name: name || type + ' plant', mw });
        }

        if (!byRegion[region]) byRegion[region] = { count: 0, totalMW: 0 };
        byRegion[region].count++;
        byRegion[region].totalMW += mw;

        plantCount++;
        totalMW += mw;
    }

    const sorted = Object.entries(bySource)
        .map(([type, d]) => ({ type, ...d }))
        .sort((a, b) => b.totalMW - a.totalMW);

    const renewTypes = new Set(['Solar', 'Wind', 'Hydro', 'Biomass', 'Geothermal', 'Tidal']);
    const fossilTypes = new Set(['Coal', 'Gas', 'Oil']);
    let renewMW = 0, fossilMW = 0;
    sorted.forEach(s => {
        if (renewTypes.has(s.type)) renewMW += s.totalMW;
        if (fossilTypes.has(s.type)) fossilMW += s.totalMW;
    });

    return {
        sources: sorted,
        byRegion: Object.entries(byRegion)
            .map(([region, d]) => ({ region, ...d }))
            .sort((a, b) => b.totalMW - a.totalMW),
        plantCount,
        totalMW,
        renewMW,
        fossilMW,
        renewPct: totalMW > 0 ? (renewMW / totalMW) * 100 : 0,
        fossilPct: totalMW > 0 ? (fossilMW / totalMW) * 100 : 0,
        regionsScanned: Object.keys(byRegion).length,
        regionsTotal: GRID_REGIONS.length,
        fetchedAt: new Date().toISOString()
    };
}

export default async (_req) => {
    // Return cached data if still fresh
    if (globalThis._gridCache && (Date.now() - globalThis._gridCacheTs) < CACHE_TTL) {
        console.log('⚡ Returning cached grid data');
        return new Response(JSON.stringify(globalThis._gridCache), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=21600, s-maxage=21600',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }

    try {
        const data = await fetchGridData();
        globalThis._gridCache = data;
        globalThis._gridCacheTs = Date.now();

        console.log(`⚡ Grid data: ${data.plantCount} plants, ${Math.round(data.totalMW)} MW, ${data.renewPct.toFixed(1)}% renewable`);

        return new Response(JSON.stringify(data), {
            status: 200,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'public, max-age=21600, s-maxage=21600',
                'Access-Control-Allow-Origin': '*'
            }
        });
    } catch (e) {
        console.error('⚡ Grid fetch failed:', e.message);
        return new Response(JSON.stringify({ error: e.message }), {
            status: 502,
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
};
