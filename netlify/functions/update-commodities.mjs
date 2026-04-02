// ════════════════════════════════════════════════════════════════
// COMMODITY PRICE UPDATER — Netlify Scheduled Function
// Runs daily at 6:00 UTC. Fetches prices from multiple sources
// and writes to Supabase port_commodities table.
//
// Required env vars (set in Netlify dashboard → Site settings → Environment):
//   SUPABASE_URL          — Your Supabase project URL
//   SUPABASE_SERVICE_KEY  — Service role key (NOT anon key — needs write access)
//   FINNHUB_KEY           — Finnhub API key (free tier: 60 calls/min)
// ════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const FINNHUB_KEY = process.env.FINNHUB_KEY;

// ── Helper: Fetch JSON with timeout ──
async function fetchJSON(url, timeoutMs = 8000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timer);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`Fetch failed: ${url} — ${e.message}`);
        return null;
    }
}

// ── Helper: Upsert to Supabase ──
async function upsertCommodity(id, updates) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return;
    const row = { id, ...updates, updated_at: new Date().toISOString() };
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/port_commodities?on_conflict=id`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': SUPABASE_KEY,
                'Authorization': `Bearer ${SUPABASE_KEY}`,
                'Prefer': 'resolution=merge-duplicates'
            },
            body: JSON.stringify(row)
        });
        if (!res.ok) console.warn(`Supabase upsert failed for ${id}: ${res.status}`);
        else console.log(`✅ Updated ${id}: $${updates.price}`);
    } catch (e) {
        console.warn(`Supabase error for ${id}: ${e.message}`);
    }
}

// ── Price Fetchers ──

// Copper via Finnhub (COMEX futures HG)
async function fetchCopper() {
    if (!FINNHUB_KEY) return null;
    const data = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=HG&token=${FINNHUB_KEY}`);
    if (data && data.c) {
        // Finnhub returns copper in USD/lb, convert to USD/tonne (1 tonne = 2204.62 lbs)
        const pricePerTonne = Math.round(data.c * 2204.62);
        const changePct = data.dp || 0;
        return { price: pricePerTonne, change_pct: Math.round(changePct * 10) / 10 };
    }
    return null;
}

// Crude oil via Finnhub (proxy for energy costs)
async function fetchCrudeOil() {
    if (!FINNHUB_KEY) return null;
    const data = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=CL&token=${FINNHUB_KEY}`);
    if (data && data.c) {
        return { price: Math.round(data.c * 10) / 10, change_pct: data.dp || 0 };
    }
    return null;
}

// NVIDIA stock as GPU demand proxy
async function fetchNVDA() {
    if (!FINNHUB_KEY) return null;
    const data = await fetchJSON(`https://finnhub.io/api/v1/quote?symbol=NVDA&token=${FINNHUB_KEY}`);
    if (data && data.c) {
        return { stockPrice: data.c, changePct: data.dp || 0 };
    }
    return null;
}

// Metals via metals.dev (free, no key required, public JSON)
async function fetchMetalsPrices() {
    try {
        const data = await fetchJSON('https://api.metals.dev/v1/latest?api_key=demo&currency=USD');
        if (data && data.metals) return data.metals;
    } catch (e) { /* silent */ }
    return null;
}

// ── Supply status heuristics ──
function deriveSupplyStatus(changePct) {
    if (changePct > 20) return 'critical';
    if (changePct > 10) return 'scarce';
    if (changePct > 5) return 'tight';
    if (changePct < -5) return 'surplus';
    return 'stable';
}

// ── Main handler ──
export default async (req) => {
    console.log('🚢 Commodity price update starting...');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
        return new Response(JSON.stringify({ error: 'Missing Supabase config' }), { status: 500 });
    }

    const results = {};

    // 1. Copper (LME Grade A)
    const copper = await fetchCopper();
    if (copper) {
        await upsertCommodity('copper', {
            name: 'Copper (Grade A)', price: copper.price, unit: 'tonne',
            change_pct: copper.change_pct, supply_status: deriveSupplyStatus(copper.change_pct),
            category: 'materials', source: 'Finnhub (COMEX HG futures)'
        });
        results.copper = copper.price;
    }

    // 2. GPU prices — derive from NVIDIA stock movement
    const nvda = await fetchNVDA();
    if (nvda) {
        // H100 price inversely correlated with supply; stock price reflects demand
        // Base: $30K when NVDA ~$130, scale with stock movement
        const h100Base = 30000;
        const h100Adj = Math.round(h100Base * (1 + (nvda.changePct / 100) * 0.5));
        const b200Base = 45000;
        const b200Adj = Math.round(b200Base * (1 + (nvda.changePct / 100) * 0.7));

        await upsertCommodity('gpu_h100', {
            name: 'NVIDIA H100 80GB', price: h100Adj, unit: 'unit',
            change_pct: Math.round(nvda.changePct * 0.5 * 10) / 10,
            supply_status: nvda.changePct > 5 ? 'tight' : nvda.changePct > 15 ? 'scarce' : 'stable',
            category: 'compute', source: `Derived from NVDA stock ($${nvda.stockPrice})`
        });
        results.gpu_h100 = h100Adj;

        await upsertCommodity('gpu_b200', {
            name: 'NVIDIA B200', price: b200Adj, unit: 'unit',
            change_pct: Math.round(nvda.changePct * 0.7 * 10) / 10,
            supply_status: 'scarce',
            category: 'compute', source: `Derived from NVDA stock ($${nvda.stockPrice})`
        });
        results.gpu_b200 = b200Adj;

        // HBM memory tracks with GPU demand
        const hbmBase = 900;
        const hbmAdj = Math.round(hbmBase * (1 + (nvda.changePct / 100) * 0.8));
        await upsertCommodity('hbm_memory', {
            name: 'HBM3e Memory', price: hbmAdj, unit: 'stack',
            change_pct: Math.round(nvda.changePct * 0.8 * 10) / 10,
            supply_status: nvda.changePct > 3 ? 'scarce' : 'tight',
            category: 'compute', source: 'Derived from GPU demand trends'
        });
        results.hbm_memory = hbmAdj;
    }

    // 3. Electricity — derive from crude oil proxy
    const oil = await fetchCrudeOil();
    if (oil) {
        // Industrial electricity roughly tracks energy markets
        // Base: $68/MWh when oil ~$70/bbl
        const elecBase = 68;
        const oilNorm = oil.price / 70;
        const elecPrice = Math.round(elecBase * oilNorm);
        await upsertCommodity('electricity', {
            name: 'Electricity (Industrial)', price: elecPrice, unit: 'MWh',
            change_pct: Math.round(oil.change_pct * 0.6 * 10) / 10,
            supply_status: deriveSupplyStatus(oil.change_pct * 0.6),
            category: 'power', source: `Derived from crude oil ($${oil.price}/bbl)`
        });
        results.electricity = elecPrice;

        // Power transformers track with energy infrastructure demand
        const xfmrBase = 85000;
        const xfmrAdj = Math.round(xfmrBase * (1 + (oil.change_pct / 100) * 0.3));
        await upsertCommodity('power_xfmr', {
            name: 'Power Transformers', price: xfmrAdj, unit: 'unit',
            change_pct: Math.round(oil.change_pct * 0.3 * 10) / 10,
            supply_status: 'tight',
            category: 'power', source: 'Derived from energy market'
        });
        results.power_xfmr = xfmrAdj;
    }

    // 4. Static estimates (updated less frequently — these need manual or specialized API updates)
    const staticUpdates = [
        { id: 'helium', name: 'Liquid Helium', price: 35, unit: 'L', change_pct: 28.4, supply_status: 'critical', category: 'cooling', source: 'Industrial gas market estimate (BLM/USGS)' },
        { id: 'silicon_wafer', name: 'Silicon Wafers (300mm)', price: 142, unit: 'wafer', change_pct: 3.1, supply_status: 'stable', category: 'fabrication', source: 'SEMI.org estimate' },
        { id: 'rare_earth', name: 'Rare Earth (Nd/Ga)', price: 380, unit: 'kg', change_pct: 15.7, supply_status: 'tight', category: 'materials', source: 'Shanghai Metals Market estimate' },
        { id: 'fiber_optic', name: 'Fiber Optic Cable', price: 1200, unit: 'km', change_pct: -2.1, supply_status: 'stable', category: 'network', source: 'Corning/Furukawa estimate' },
        { id: 'coolant_sys', name: 'Liquid Cooling Systems', price: 4500, unit: 'unit', change_pct: 18.9, supply_status: 'tight', category: 'cooling', source: 'CoolIT/Vertiv estimate' },
        { id: 'server_rack', name: 'Server Rack Chassis', price: 2200, unit: 'unit', change_pct: 1.4, supply_status: 'stable', category: 'infra', source: 'OCP pricing estimate' }
    ];

    for (const item of staticUpdates) {
        const { id, ...data } = item;
        await upsertCommodity(id, data);
        results[id] = data.price;
    }

    console.log(`🚢 Commodity update complete: ${Object.keys(results).length} prices updated`);
    return new Response(JSON.stringify({ success: true, updated: results }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

// ── Netlify scheduled function config ──
export const config = {
    schedule: "0 6 * * *"  // Run daily at 06:00 UTC
};
