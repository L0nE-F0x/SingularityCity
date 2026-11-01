// ════════════════════════════════════════════════════════════════
// COMMODITY PRICE UPDATER — Netlify Scheduled Function
// Runs daily at 6:00 UTC. Fetches prices from multiple sources
// and writes to Supabase port_commodities table.
//
// Required env vars (set in Netlify dashboard → Site settings → Environment):
//   SUPABASE_URL          — Your Supabase project URL
//   SUPABASE_SERVICE_KEY  — Service role key (NOT anon key — needs write access)
//   FINNHUB_KEY           — Finnhub API key (free tier: 60 calls/min) — NVDA only
//
// Copper and crude oil come from FRED (Federal Reserve Bank of St. Louis),
// keyless CSV. They used to come from Finnhub /quote?symbol=HG and symbol=CL,
// but on that endpoint those are NYSE equities (Hamilton Insurance, Colgate),
// not COMEX futures — copper showed a share price × 2204.62 for months.
//
// Dry run (real FRED + Finnhub if keyed, NO DB write):
//   node netlify/functions/update-commodities.mjs --dryrun
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

// ── Helper: Upsert to Supabase ── (returns true on success so the handler can fail loudly)
async function upsertCommodity(id, updates) {
    if (!SUPABASE_URL || !SUPABASE_KEY) return false;
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
        if (!res.ok) { console.warn(`Supabase upsert failed for ${id}: ${res.status}`); return false; }
        console.log(`✅ Updated ${id}: $${updates.price}`);
        return true;
    } catch (e) {
        console.warn(`Supabase error for ${id}: ${e.message}`);
        return false;
    }
}

// ── Helper: ids already present in the table (used to seed static rows ONCE) ──
async function existingCommodityIds() {
    try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/port_commodities?select=id`, {
            headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
        });
        if (!res.ok) return null;
        return new Set((await res.json()).map(r => r.id));
    } catch {
        return null;
    }
}

// ── Price Fetchers ──

// Last two numeric observations of a FRED series, oldest first: [{ date, value }, { date, value }].
// fredgraph.csv needs no key; `cosd` trims the download to recent rows. Days with no
// observation come through as "." or empty and are skipped.
async function fetchFredLatest(seriesId, timeoutMs = 10000) {
    const since = new Date(Date.now() - 200 * 86400000).toISOString().slice(0, 10);
    const url = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${seriesId}&cosd=${since}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, {
            signal: controller.signal,
            headers: { 'user-agent': 'SingularityCity-PortBot/1.0' }
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const rows = [];
        for (const line of (await res.text()).trim().split('\n').slice(1)) {
            const [date, raw] = line.trim().split(',');
            const value = parseFloat(raw);
            if (/^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(value)) rows.push({ date, value });
        }
        if (rows.length < 2) throw new Error(`only ${rows.length} observation(s)`);
        return rows.slice(-2);
    } catch (e) {
        console.warn(`FRED ${seriesId} failed — ${e.message}`);
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// A price is published only if it is recent and inside a plausible band, so a wrong
// series, symbol or unit fails loudly instead of reaching the Port.
function plausible(label, latest, { min, max, maxAgeDays }) {
    const ageDays = (Date.now() - Date.parse(`${latest.date}T00:00:00Z`)) / 86400000;
    if (!(latest.value >= min && latest.value <= max)) {
        console.error(`✖ ${label} ${latest.value} on ${latest.date} is outside ${min}–${max} — not written`);
        return false;
    }
    if (ageDays > maxAgeDays) {
        console.error(`✖ ${label} newest observation ${latest.date} is ${Math.round(ageDays)} days old (max ${maxAgeDays}) — not written`);
        return false;
    }
    return true;
}

const pctChange = (prev, latest) => Math.round(((latest.value - prev.value) / prev.value) * 1000) / 10;

// Copper — FRED PCOPPUSDM: IMF global copper price, USD per metric tonne, monthly average.
// FRED posts each month a few weeks after it ends, so the newest value can be ~2 months old.
async function fetchCopper() {
    const obs = await fetchFredLatest('PCOPPUSDM');
    if (!obs) return null;
    const [prev, latest] = obs;
    if (!plausible('copper', latest, { min: 3000, max: 40000, maxAgeDays: 120 })) return null;
    const month = new Date(`${latest.date}T00:00:00Z`).toLocaleString('en-US', { month: 'short', year: 'numeric', timeZone: 'UTC' });
    return { price: Math.round(latest.value), change_pct: pctChange(prev, latest), month };
}

// Crude oil — FRED DCOILWTICO: WTI spot, USD per barrel, daily (proxy for energy costs).
async function fetchCrudeOil() {
    const obs = await fetchFredLatest('DCOILWTICO');
    if (!obs) return null;
    const [prev, latest] = obs;
    if (!plausible('WTI', latest, { min: 10, max: 300, maxAgeDays: 21 })) return null;
    return { price: Math.round(latest.value * 10) / 10, change_pct: pctChange(prev, latest), date: latest.date };
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

// ── Supply status heuristics ──
function deriveSupplyStatus(changePct) {
    if (changePct > 20) return 'critical';
    if (changePct > 10) return 'scarce';
    if (changePct > 5) return 'tight';
    if (changePct < -5) return 'surplus';
    return 'stable';
}

// ── Main handler ──
export default async (_req) => {
    console.log('🚢 Commodity price update starting...');

    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars');
        return new Response(JSON.stringify({ error: 'Missing Supabase config' }), { status: 500 });
    }

    const results = {};
    let failed = 0;
    const track = async (id, data) => {
        if (await upsertCommodity(id, data)) results[id] = data.price; else failed++;
    };

    // 1. Copper (Grade A) — monthly average; change_pct is month over month
    const copper = await fetchCopper();
    if (copper) {
        await track('copper', {
            name: 'Copper (Grade A)', price: copper.price, unit: 'tonne',
            change_pct: copper.change_pct, supply_status: deriveSupplyStatus(copper.change_pct),
            category: 'materials', source: `FRED PCOPPUSDM (IMF global copper, ${copper.month} avg)`
        });
    } else {
        failed++; // keyless source — a miss means FRED is down or the value failed its sanity check
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

        await track('gpu_h100', {
            name: 'NVIDIA H100 80GB', price: h100Adj, unit: 'unit',
            change_pct: Math.round(nvda.changePct * 0.5 * 10) / 10,
            // Widest threshold first — the old ordering made 'scarce' unreachable.
            supply_status: nvda.changePct > 15 ? 'scarce' : nvda.changePct > 5 ? 'tight' : 'stable',
            category: 'compute', source: `Modeled from NVDA stock ($${nvda.stockPrice})`
        });

        await track('gpu_b200', {
            name: 'NVIDIA B200', price: b200Adj, unit: 'unit',
            change_pct: Math.round(nvda.changePct * 0.7 * 10) / 10,
            supply_status: 'scarce',
            category: 'compute', source: `Derived from NVDA stock ($${nvda.stockPrice})`
        });

        // HBM memory tracks with GPU demand
        const hbmBase = 900;
        const hbmAdj = Math.round(hbmBase * (1 + (nvda.changePct / 100) * 0.8));
        await track('hbm_memory', {
            name: 'HBM3e Memory', price: hbmAdj, unit: 'stack',
            change_pct: Math.round(nvda.changePct * 0.8 * 10) / 10,
            supply_status: nvda.changePct > 3 ? 'scarce' : 'tight',
            category: 'compute', source: 'Derived from GPU demand trends'
        });
    }

    // 3. Electricity — derive from crude oil proxy
    const oil = await fetchCrudeOil();
    if (oil) {
        // Industrial electricity roughly tracks energy markets
        // Base: $68/MWh when oil ~$70/bbl
        const elecBase = 68;
        const oilNorm = oil.price / 70;
        const elecPrice = Math.round(elecBase * oilNorm);
        await track('electricity', {
            name: 'Electricity (Industrial)', price: elecPrice, unit: 'MWh',
            change_pct: Math.round(oil.change_pct * 0.6 * 10) / 10,
            supply_status: deriveSupplyStatus(oil.change_pct * 0.6),
            category: 'power', source: `Derived from WTI crude ($${oil.price}/bbl on ${oil.date}, FRED)`
        });

        // Power transformers track with energy infrastructure demand
        const xfmrBase = 85000;
        const xfmrAdj = Math.round(xfmrBase * (1 + (oil.change_pct / 100) * 0.3));
        await track('power_xfmr', {
            name: 'Power Transformers', price: xfmrAdj, unit: 'unit',
            change_pct: Math.round(oil.change_pct * 0.3 * 10) / 10,
            supply_status: 'tight',
            category: 'power', source: 'Derived from energy market'
        });
    } else {
        failed++;
    }

    // 4. Static estimates — SEEDED ONCE, never re-stamped. These are hand-authored
    // snapshots with frozen change_pct values; rewriting them daily used to give
    // them a fresh updated_at, presenting fiction as fresh data (helium sat at
    // "+28.4% / critical" for months, "updated today"). Seeding only when the row
    // is missing keeps the table populated on first run while letting updated_at
    // honestly reflect when the estimate was authored.
    const staticSeeds = [
        { id: 'helium', name: 'Liquid Helium', price: 35, unit: 'L', change_pct: 28.4, supply_status: 'critical', category: 'cooling', source: 'Static estimate (BLM/USGS, seeded once)' },
        { id: 'silicon_wafer', name: 'Silicon Wafers (300mm)', price: 142, unit: 'wafer', change_pct: 3.1, supply_status: 'stable', category: 'fabrication', source: 'Static estimate (SEMI.org, seeded once)' },
        { id: 'rare_earth', name: 'Rare Earth (Nd/Ga)', price: 380, unit: 'kg', change_pct: 15.7, supply_status: 'tight', category: 'materials', source: 'Static estimate (Shanghai Metals Market, seeded once)' },
        { id: 'fiber_optic', name: 'Fiber Optic Cable', price: 1200, unit: 'km', change_pct: -2.1, supply_status: 'stable', category: 'network', source: 'Static estimate (Corning/Furukawa, seeded once)' },
        { id: 'coolant_sys', name: 'Liquid Cooling Systems', price: 4500, unit: 'unit', change_pct: 18.9, supply_status: 'tight', category: 'cooling', source: 'Static estimate (CoolIT/Vertiv, seeded once)' },
        { id: 'server_rack', name: 'Server Rack Chassis', price: 2200, unit: 'unit', change_pct: 1.4, supply_status: 'stable', category: 'infra', source: 'Static estimate (OCP pricing, seeded once)' }
    ];

    const present = await existingCommodityIds();
    if (present === null) {
        console.warn('  ⚠ could not read existing commodity ids — skipping static seeding this run');
    } else {
        for (const item of staticSeeds) {
            if (present.has(item.id)) continue; // already seeded — leave updated_at honest
            const { id, ...data } = item;
            if (await upsertCommodity(id, data)) results[id] = data.price; else failed++;
        }
    }

    console.log(`🚢 Commodity update complete: ${Object.keys(results).length} prices updated, ${failed} failed`);
    // Fail loudly (collect-events convention) so a dead writer shows red in the dashboard.
    const ok = failed === 0 && Object.keys(results).length > 0;
    return new Response(JSON.stringify({ success: ok, updated: results, failed }), {
        status: ok ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
    });
};

// ── Live dry run (real feeds, NO DB write): node update-commodities.mjs --dryrun ──
if (process.argv.includes('--dryrun')) {
    (async () => {
        const copper = await fetchCopper();
        const oil = await fetchCrudeOil();
        console.log('copper', copper ? `${copper.price} USD/t (${copper.month} avg, ${copper.change_pct}% m/m)` : 'NOT WRITTEN');
        console.log('WTI   ', oil ? `${oil.price} USD/bbl (${oil.date}, ${oil.change_pct}%)` : 'NOT WRITTEN');
        if (oil) console.log('electricity model', Math.round(68 * (oil.price / 70)), 'USD/MWh');
        const fakeHG = { date: new Date().toISOString().slice(0, 10), value: 77294 };
        console.log('sanity band rejects the old HG artefact:', !plausible('copper', fakeHG, { min: 3000, max: 40000, maxAgeDays: 120 }));
        process.exit(copper && oil ? 0 : 1);
    })();
}

// ── Netlify scheduled function config ──
export const config = {
    schedule: "0 6 * * *"  // Run daily at 06:00 UTC
};
