/* ════════════════════════════════════════════════════════════════════════════
   SHARED — commodity prices for the GPU supply-chain Port.

   THIS IS THE SOURCE OF TRUTH for what a rack, a wafer or a megawatt costs in
   both views.

   Unlike the rockets, the jail and the court, First Person was not inventing
   these — it simply had none. Its data.js says "port panels can colour a
   shortage without a live price feed", so shortages showed but prices never
   did, and the two views disagreed about the market.

   Prices come from Supabase `port_commodities` when present. Fallback estimates
   load FIRST so every commodity always has a price, then live rows overwrite
   whatever the table actually tracks — new commodities stay on fallback until
   the DB grows matching rows. That ordering matters: a partial table must never
   leave a commodity priceless.

   ESM so First Person imports it natively. The 2D app is classic scripts and
   still carries its own copy in js/port_zone.js; switching it over is a
   follow-up.
   ════════════════════════════════════════════════════════════════════════════ */

/** Estimated 2026-Q2 market. Every tracked commodity must appear here. */
export const FALLBACK_PRICES = {
    gpu_rubin:     { price: 3200000,   currency: 'USD', change_pct: 0.0,   supply_status: 'scarce',   updated: '2026-Q2' },
    gpu_b200:      { price: 42000,     currency: 'USD', change_pct: -4.8,  supply_status: 'tight',    updated: '2026-Q2' },
    gpu_h100:      { price: 21000,     currency: 'USD', change_pct: -18.5, supply_status: 'surplus',  updated: '2026-Q2' },
    euv_scanner:   { price: 380000000, currency: 'USD', change_pct: 8.6,   supply_status: 'critical', updated: '2026-Q2' },
    hbm_memory:    { price: 650,       currency: 'USD', change_pct: 31.0,  supply_status: 'critical', updated: '2026-Q2' },
    silicon_wafer: { price: 165,       currency: 'USD', change_pct: 9.4,   supply_status: 'tight',    updated: '2026-Q2' },
    helium:        { price: 38,        currency: 'USD', change_pct: 12.1,  supply_status: 'critical', updated: '2026-Q2' },
    rare_earth:    { price: 445,       currency: 'USD', change_pct: 24.3,  supply_status: 'scarce',   updated: '2026-Q2' },
    power_xfmr:    { price: 92000,     currency: 'USD', change_pct: 11.7,  supply_status: 'tight',    updated: '2026-Q2' },
    fiber_optic:   { price: 1150,      currency: 'USD', change_pct: -1.3,  supply_status: 'stable',   updated: '2026-Q2' },
    coolant_sys:   { price: 5200,      currency: 'USD', change_pct: 15.2,  supply_status: 'tight',    updated: '2026-Q2' },
    server_rack:   { price: 2350,      currency: 'USD', change_pct: 3.8,   supply_status: 'stable',   updated: '2026-Q2' },
    copper:        { price: 10400,     currency: 'USD', change_pct: 7.2,   supply_status: 'tight',    updated: '2026-Q2' },
    electricity:   { price: 74,        currency: 'USD', change_pct: 8.8,   supply_status: 'tight',    updated: '2026-Q2' }
};

/** Fresh copy of the fallbacks — callers mutate their own map, not this module's. */
export function fallbackPrices() {
    const out = {};
    for (const k of Object.keys(FALLBACK_PRICES)) out[k] = { ...FALLBACK_PRICES[k] };
    return out;
}

/**
 * Fallbacks overlaid with live Supabase rows. Never throws; on any failure the
 * caller still gets a complete price map.
 *
 * `supabase` is { url, key } — First Person talks REST directly rather than
 * pulling in the JS client the 2D app already has loaded.
 */
export async function fetchPrices({ url, key } = {}) {
    const prices = fallbackPrices();
    if (!url || !key) return prices;
    try {
        const r = await fetch(`${url}/rest/v1/port_commodities?select=*`, {
            headers: { apikey: key, Authorization: 'Bearer ' + key },
            signal: AbortSignal.timeout(6000)
        });
        if (!r.ok) return prices;                       // missing table / RLS → fallbacks stand
        const rows = await r.json();
        if (!Array.isArray(rows) || !rows.length) return prices;
        for (const row of rows) {
            if (!row || !row.id) continue;
            prices[row.id] = {
                price: row.price,
                currency: row.currency || 'USD',
                change_pct: row.change_pct || 0,
                updated: row.updated_at,
                supply_status: row.supply_status || 'stable'
            };
        }
    } catch (_) {
        /* offline → fallbacks stand */
    }
    return prices;
}

/** "$3.2M" / "$42.0K" / "$74" — compact enough for a panel column. */
export function formatPrice(entry) {
    if (!entry || typeof entry.price !== 'number') return '—';
    const p = entry.price;
    if (p >= 1e9) return '$' + (p / 1e9).toFixed(1) + 'B';
    if (p >= 1e6) return '$' + (p / 1e6).toFixed(1) + 'M';
    if (p >= 1e3) return '$' + (p / 1e3).toFixed(1) + 'K';
    return '$' + p;
}

/** Signed percentage move, e.g. "+31.0%" / "-4.8%" / "0.0%". */
export function formatChange(entry) {
    if (!entry || typeof entry.change_pct !== 'number') return '';
    const c = entry.change_pct;
    return (c > 0 ? '+' : '') + c.toFixed(1) + '%';
}
