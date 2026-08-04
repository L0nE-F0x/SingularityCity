/* ════════════════════════════════════════════════════════════════════════════
   SHARED — which AI models are detained, and where that applies.

   THIS IS THE SOURCE OF TRUTH for the AI Detention Center in both views.

   The jail is a factual statement about AI regulation, not set dressing. A model
   appears behind bars because a real government actually restricted it, and it
   walks back out when that restriction lifts. Two properties make that work and
   must not be lost:

     • JURISDICTION SCOPE — a ban scoped to {countries:['TR']} is only visible to
       viewers connecting from Turkey. 'global' shows for everyone. A US viewer
       and a Turkish viewer correctly see different detainees.
     • EXPIRY — any rule with an `until` date stops applying past that date, so
       releases happen on their own. A seeded rule with no expiry can never
       release; the Claude Fable 5 / Mythos 5 export directive (Jun 2026, lifted
       later that month) is why that lesson is written down. Never seed a rule
       without an `until`.

   First Person previously ignored all of this and arrested a RANDOM citizen
   every 8 seconds ("jailbreak flavor"), which made the jail meaningless. It now
   reads these rules.

   Rules come from three places, unioned fresh on every scan:
     1. BANS         — curated, sourced seed rules below.
     2. remote rows  — Supabase `ai_bans`, written by the scheduled function
                       netlify/functions/update-ai-bans.mjs. Lets detentions be
                       edited with no code change or redeploy. Inert if absent.
     3. news-derived — off by default; the server-side function does this
                       authoritatively now.

   ESM so First Person imports it natively. The 2D app is classic scripts and
   still carries its own copy in js/jail.js; switching it over is a follow-up.
   ════════════════════════════════════════════════════════════════════════════ */

/**
 * Curated seed rules. Keep these sourced and dated — they describe real
 * government action against a model line, NOT an arbitrary version ceiling.
 *   scope: 'global'                  → every viewer
 *   scope: { countries: ['TR', …] }  → only viewers in those countries
 *   until: 'YYYY-MM-DD'              → optional; rule expires, model is released
 */
export const BANS = [
    {
        id: 'deepseek_govt',
        label: 'Government Device Ban',
        authority: 'AU · CZ · DE · U.S. states',
        scope: { countries: ['AU', 'CZ', 'DE', 'US'] },
        reason: 'Banned from government devices in your jurisdiction over data-security concerns.',
        source: 'https://cybernews.com/security/us-lawmakers-bill-bans-chinese-ai-models-across-federal-agencies/',
        test: (m) => m.lab === 'deepseek' || /deepseek/i.test(m.name || '')
    },
    {
        id: 'grok_turkey',
        label: 'Turkey (Court Order)',
        authority: 'Republic of Türkiye',
        scope: { countries: ['TR'] },
        reason: 'Access blocked nationwide by a Turkish court order.',
        source: 'https://www.computerweekly.com/news/366619153/US-lawmakers-move-to-ban-DeepSeek-AI-tool',
        test: (m) => /\bgrok\b/i.test(m.name || '') || /grok/i.test(m.id || '')
    }
];

/**
 * Minimal IANA timezone → ISO-3166 map covering the jurisdictions the rules care
 * about. Used as an instant offline/localhost fallback before the Netlify geo
 * lookup lands.
 */
export const TZ_COUNTRY = {
    'Europe/Istanbul': 'TR',
    'Europe/Berlin': 'DE',
    'Europe/Busingen': 'DE',
    'Europe/Prague': 'CZ',
    'Australia/Sydney': 'AU',
    'Australia/Melbourne': 'AU',
    'Australia/Brisbane': 'AU',
    'Australia/Perth': 'AU',
    'Australia/Adelaide': 'AU',
    'Australia/Hobart': 'AU',
    'Australia/Darwin': 'AU',
    'America/New_York': 'US',
    'America/Chicago': 'US',
    'America/Denver': 'US',
    'America/Los_Angeles': 'US',
    'America/Phoenix': 'US',
    'America/Detroit': 'US',
    'America/Anchorage': 'US',
    'Pacific/Honolulu': 'US',
    'Asia/Jakarta': 'ID',
    'Asia/Makassar': 'ID',
    'Asia/Jayapura': 'ID',
    'Asia/Pontianak': 'ID',
    'Europe/London': 'GB',
    'Europe/Paris': 'FR',
    'Asia/Tokyo': 'JP',
    'Asia/Shanghai': 'CN',
    'Asia/Kolkata': 'IN'
};

/** Instant local guess at the viewer's country. Never throws; null if unknown. */
export function countryFromLocale() {
    try {
        const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
        if (TZ_COUNTRY[tz]) return TZ_COUNTRY[tz];
        if (/^Australia\//.test(tz)) return 'AU';
        if (/^America\/(New_York|Chicago|Denver|Los_Angeles|Phoenix|Detroit|Anchorage|Indiana)/.test(tz)) return 'US';
        const langs = typeof navigator !== 'undefined'
            ? (navigator.languages || [navigator.language || ''])
            : [''];
        for (const l of langs) {
            const m = /[-_]([A-Za-z]{2})$/.exec(l || '');
            if (m) return m[1].toUpperCase();
        }
    } catch (_) { /* ignore */ }
    return null;
}

/**
 * Best-effort accurate country via the same-origin Netlify geo function.
 * Resolves to null offline / on localhost / if the function is absent, in which
 * case the caller keeps the locale heuristic.
 */
export async function fetchViewerCountry() {
    try {
        const r = await fetch('/api/geo', { signal: AbortSignal.timeout(4000) });
        if (!r || !r.ok) return null;
        const d = await r.json();
        return d && d.country ? String(d.country).toUpperCase() : null;
    } catch (_) {
        return null;
    }
}

/** Geo scope + time expiry. */
export function ruleAppliesToViewer(rule, viewerCountry) {
    if (!rule) return false;
    if (rule.until && Date.now() > Date.parse(rule.until)) return false;   // lifted
    const scope = rule.scope || 'global';
    if (scope === 'global') return true;
    if (scope.countries) return !!viewerCountry && scope.countries.indexOf(viewerCountry) !== -1;
    return true;
}

/** Supabase `ai_bans` rows → rule objects with the same shape as BANS. */
export function normaliseRemoteBans(rows) {
    if (!Array.isArray(rows)) return [];
    return rows
        .filter(r => r && r.active !== false && (r.match_lab || r.match_name))
        .map(r => {
            const lab = r.match_lab ? String(r.match_lab).toLowerCase() : null;
            let nameRe = null;
            if (r.match_name) {
                try { nameRe = new RegExp(r.match_name, 'i'); } catch (_) { nameRe = null; }
            }
            let scope = 'global';
            if (r.scope) {
                try {
                    scope = typeof r.scope === 'string'
                        ? (r.scope === 'global' ? 'global' : JSON.parse(r.scope))
                        : r.scope;
                } catch (_) { scope = 'global'; }
            }
            return {
                id: 'remote_' + (r.id != null ? r.id : Math.random().toString(36).slice(2)),
                label: r.label || r.authority || 'Suspended',
                authority: r.authority || r.label || 'Government order',
                scope,
                until: r.until || null,
                reason: r.reason || 'Suspended by government order.',
                source: r.source || null,
                derived: true,
                test: (m) => (!!lab && m.lab === lab) || (!!nameRe && nameRe.test(m.name || ''))
            };
        });
}

/**
 * Evaluate every model against every applicable rule.
 * Returns Map<modelId, rule>. A model absent from the map is free — callers
 * should treat that as "release now", which is how expiry produces walk-outs.
 *
 * `models` need only expose { id, name, lab } — the same shape in both views.
 */
export function selectDetained(models, rules, viewerCountry) {
    const out = new Map();
    if (!models || !rules) return out;
    const applicable = rules.filter(r => ruleAppliesToViewer(r, viewerCountry));
    if (!applicable.length) return out;
    for (const m of models) {
        if (!m) continue;
        for (const rule of applicable) {
            let hit = false;
            try { hit = !!rule.test(m); } catch (_) { hit = false; }   // never let one bad rule stop the scan
            if (hit) { out.set(m.id, rule); break; }
        }
    }
    return out;
}
