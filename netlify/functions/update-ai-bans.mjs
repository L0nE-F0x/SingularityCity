// ════════════════════════════════════════════════════════════════════════════
// UPDATE AI BANS — Netlify Scheduled Function (every 6h).
//
// Self-maintains the `ai_bans` table that powers the AI Detention Center
// (js/jail.js → JailData.fetchRemoteBans). It reads live AI-regulation news,
// detects "a government banned/suspended <model> in <country>" events, and:
//   • UPSERTS a row per (model × jurisdiction), keyed by ban_key, active=true,
//     last_seen=now  → the model is detained for visitors in that country.
//   • DELETES its own rows whose news hasn't reappeared for STALE_DAYS
//     → the ban is presumed lifted and the model walks back home.
// It only ever touches rows it owns (managed_by='news_bot'); hand-added
// (managed_by='manual') rows are left alone.
//
// Conservative on purpose (it writes to a public production table):
//   requires a ban verb + a known model line + a government/authority actor +
//   an explicit jurisdiction, and skips negations/lifts ("reinstated", "no
//   ban", "appeal", …) and lab-as-actor phrasing ("OpenAI bans accounts …").
//   Anything wrong self-heals within STALE_DAYS once the news rotates out.
//
// Required env vars: SUPABASE_URL, SUPABASE_SERVICE_KEY (same as collect-events).
// Run locally:  node netlify/functions/update-ai-bans.mjs --selftest
// ════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const STALE_DAYS = 21;   // delete a bot row if its ban hasn't been seen in the news this long
const MAX_ROWS = 60;     // sanity cap on rows written per run
const NEWS_WINDOW = '45d';

// ─── CLASSIFIER ──────────────────────────────────────────────────────────────
const BAN_RE = /\b(ban|bans|banned|banning|block|blocks|blocked|blocking|suspend|suspends|suspended|suspension|restrict|restricts|restricted|outlaw|outlawed|prohibit|prohibits|prohibited|bar|bars|barred|removed from|pull(?:s|ed)? from)\b/i;
// "orders / pulled / took / forced <model> offline" — allow a word or two between the verb and "offline".
const OFFLINE_RE = /\b(order(?:s|ed)?|pull(?:s|ed)?|take[sn]?|took|forc(?:e|es|ed)|knock(?:s|ed)?)\b[\w\s'’]{0,18}\boffline\b/i;
const RELEASE_RE = /\b(not banned|won'?t ban|no ban|despite|reject|rejects|rejected|unban|unbanned|lift|lifts|lifted|lifting|overturn|overturned|restore|restored|reinstate|reinstated|allow|allowed|approve|approved|avoid|avoids|avoided|reverse|reversed|appeal|appeals)\b/i;

// model token → row target (a lab id to jail wholesale, or a name regex)
const MODEL_MATCHERS = [
    // Specific sub-brands first so a headline about one frontier model doesn't jail a whole family.
    { id: 'fable',    re: /\b(fable|mythos)\b/i, target: { match_name: 'fable|mythos' } },
    { id: 'deepseek', re: /\bdeepseek\b/i, target: { match_lab: 'deepseek' } },
    { id: 'grok',     re: /\bgrok\b/i,     target: { match_name: 'grok' } },
    { id: 'gemini',   re: /\bgemini\b/i,   target: { match_name: 'gemini' } },
    { id: 'chatgpt',  re: /\b(chatgpt|gpt-?\d)\b/i, target: { match_name: 'gpt' } },
    { id: 'claude',   re: /\bclaude\b/i,   target: { match_name: 'claude' } },
    { id: 'llama',    re: /\bllama\b/i,    target: { match_name: 'llama' } },
    { id: 'qwen',     re: /\bqwen\b/i,     target: { match_name: 'qwen' } },
    { id: 'mistral',  re: /\bmistral\b/i,  target: { match_name: 'mistral' } },
];

const EU = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
const COUNTRIES = [
    { re: /\bt[uü]rkiye\b|\bturkey\b|\bturkish\b/i, code: 'TR', name: 'Turkey' },
    { re: /\bgermany\b|\bgerman\b/i,    code: 'DE', name: 'Germany' },
    { re: /\bczech/i,                   code: 'CZ', name: 'Czechia' },
    { re: /\baustralia\b|\baustralian\b/i, code: 'AU', name: 'Australia' },
    { re: /\bitaly\b|\bitalian\b/i,     code: 'IT', name: 'Italy' },
    { re: /\bfrance\b/i,                code: 'FR', name: 'France' },   // not 'french' (Mistral origin)
    { re: /\bspain\b|\bspanish\b/i,     code: 'ES', name: 'Spain' },
    { re: /\bindia\b|\bindian\b/i,      code: 'IN', name: 'India' },
    { re: /\bchina\b/i,                 code: 'CN', name: 'China' },    // not 'chinese' (DeepSeek/Qwen origin)
    { re: /\bcanada\b|\bcanadian\b/i,   code: 'CA', name: 'Canada' },
    { re: /\bsouth korea\b|\bkorean\b/i, code: 'KR', name: 'South Korea' },
    { re: /\bunited kingdom\b|\bbritain\b|\bbritish\b|\bu\.k\.\b/i, code: 'GB', name: 'United Kingdom' },
    { re: /\beuropean union\b|\be\.u\.\b/i, code: 'EU', name: 'European Union' },
    { re: /\bunited states\b|\busa\b|\bamerica\b|\bu\.s\.a?\.?\b|\bus\s+(?:states?|government|federal|lawmakers?|senate|congress|officials?|regulators?|administration)\b/i, code: 'US', name: 'United States' },
];

// Returns a ban descriptor for a headline, or null if it isn't a clear state ban.
function classify(title) {
    const low = (title || '').toLowerCase();
    if (!BAN_RE.test(low) && !OFFLINE_RE.test(low)) return null;
    if (RELEASE_RE.test(low)) return null;          // a lift / appeal / negation, not a new ban
    const matcher = MODEL_MATCHERS.find(m => m.re.test(low));
    if (!matcher) return null;
    // lab-as-actor guard: skip "<model> bans/blocks/… <something>" (the LAB is doing the banning).
    // Only present-tense active verbs — past participles ("DeepSeek blocked") are passive = a real ban.
    if (new RegExp(matcher.re.source + '\\s+(bans|blocks|blocking|banning|restricts|restricting|suspends|suspending|prohibits|bars)\\b', 'i').test(low)) return null;
    // jurisdiction
    let scope = null, label = null, code = null;
    if (/\b(worldwide|globally|global ban|every country|all countries)\b/i.test(low)) {
        scope = 'global'; label = 'Worldwide'; code = 'GLOBAL';
    } else {
        const c = COUNTRIES.find(cn => cn.re.test(low));
        if (c) { scope = (c.code === 'EU') ? JSON.stringify({ countries: EU }) : JSON.stringify({ countries: [c.code] }); label = c.name; code = c.code; }
    }
    if (!scope) return null;                        // no jurisdiction → too ambiguous to act on
    return { matcher, scope, label, code };
}

// ─── NEWS SOURCE (Google News RSS — server-side, no CORS, no key) ─────────────
const QUERIES = [
    '(DeepSeek OR Grok OR Gemini OR ChatGPT OR Claude OR Llama OR Qwen OR Mistral) (banned OR blocked OR suspended OR restricted OR prohibited) (government OR court OR regulator OR ministry OR watchdog)',
    'AI chatbot banned government court country',
    'AI model suspended regulator data privacy',
];

async function fetchText(url, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, headers: { 'user-agent': 'SingularityCity-BanBot/1.0' } });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.text();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`[fetch] ${url} — ${e.message}`);
        return null;
    }
}

function decodeEntities(s) {
    return (s || '')
        .replace(/<!\[CDATA\[(.*?)\]\]>/gs, '$1')
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"').replace(/&#39;|&apos;|&#x27;/g, "'")
        .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(+n))
        .trim();
}

// Light RSS item extraction (no XML dep — same spirit as collect-events' regex parsing).
function parseRss(xml) {
    const items = [];
    const blocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
    for (const b of blocks) {
        const t = b.match(/<title>([\s\S]*?)<\/title>/);
        const l = b.match(/<link>([\s\S]*?)<\/link>/);
        if (!t) continue;
        let title = decodeEntities(t[1]);
        // Google News appends " - Publisher" — strip it for a cleaner reason line.
        title = title.replace(/\s+-\s+[^-]+$/, '').trim();
        items.push({ title, link: l ? decodeEntities(l[1]) : null });
    }
    return items;
}

async function fetchBanNews() {
    const out = [];
    const seen = new Set();
    for (const q of QUERIES) {
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(q + ' when:' + NEWS_WINDOW)}&hl=en-US&gl=US&ceid=US:en`;
        const xml = await fetchText(url);
        if (!xml) continue;
        for (const it of parseRss(xml)) {
            const k = it.title.toLowerCase();
            if (seen.has(k)) continue;
            seen.add(k);
            out.push(it);
        }
    }
    return out;
}

// ─── SUPABASE WRITES (service role bypasses RLS) ─────────────────────────────
async function sbFetch(path, opts) {
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
        ...opts,
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            ...(opts.headers || {}),
        },
    });
}

async function upsertBans(rows) {
    if (!rows.length) return { written: 0, error: null };
    const res = await sbFetch('ai_bans?on_conflict=ban_key', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(rows),
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[supabase] upsert HTTP ${res.status}: ${detail}`);
        return { written: 0, error: `HTTP ${res.status}: ${detail.slice(0, 400)}` };
    }
    return { written: rows.length, error: null };
}

async function deleteStaleBans(cutoffISO) {
    // Delete only bot-owned rows whose ban hasn't been re-seen since the cutoff.
    const res = await sbFetch(`ai_bans?managed_by=eq.news_bot&last_seen=lt.${encodeURIComponent(cutoffISO)}`, {
        method: 'DELETE',
        headers: { Prefer: 'return=representation' },
    });
    if (!res.ok) {
        const detail = await res.text().catch(() => '');
        console.error(`[supabase] delete HTTP ${res.status}: ${detail}`);
        return { deleted: 0, error: `HTTP ${res.status}: ${detail.slice(0, 400)}` };
    }
    const gone = await res.json().catch(() => []);
    return { deleted: Array.isArray(gone) ? gone.length : 0, error: null };
}

// Build the deduped row set from current news.
function buildRows(news, nowISO) {
    const rows = [];
    const seen = new Set();
    for (const it of news) {
        const c = classify(it.title);
        if (!c) continue;
        const ban_key = `news:${c.matcher.id}:${c.code}`;
        if (seen.has(ban_key)) continue;
        seen.add(ban_key);
        rows.push({
            ban_key,
            managed_by: 'news_bot',
            label: c.label,
            authority: c.label,
            scope: c.scope,
            reason: it.title.slice(0, 240),
            source: it.link,
            active: true,
            last_seen: nowISO,
            ...c.matcher.target,
        });
        if (rows.length >= MAX_ROWS) break;
    }
    return rows;
}

// ─── ENTRY POINT ─────────────────────────────────────────────────────────────
export default async (_req) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error(msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }
    const startedAt = Date.now();
    console.log('⛓️  update-ai-bans running…');

    const news = await fetchBanNews().catch(e => { console.warn('news error:', e.message); return []; });
    const nowISO = new Date().toISOString();
    const rows = buildRows(news, nowISO);

    const up = await upsertBans(rows);
    const cutoff = new Date(Date.now() - STALE_DAYS * 86400000).toISOString();
    const del = await deleteStaleBans(cutoff);

    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const summary = {
        ok: !up.error && !del.error,
        headlines: news.length,
        detected: rows.length,
        written: up.written,
        deletedStale: del.deleted,
        ...(up.error ? { upsertError: up.error } : {}),
        ...(del.error ? { deleteError: del.error } : {}),
        hint: (up.error || del.error)
            ? "Writes failed — run netlify/functions/sc_ai_bans_schema.sql in the Supabase SQL Editor (the current version, with ban_key/managed_by/last_seen), then re-run this."
            : undefined,
        bans: rows.map(r => ({ ban_key: r.ban_key, scope: r.scope })),
        elapsedSec: elapsed,
    };
    console.log(`  ✅ ${news.length} headlines · ${rows.length} bans · ${up.written} written · ${del.deleted} expired · ${elapsed}s`);
    return new Response(JSON.stringify(summary, null, 2), { status: 200, headers: { 'content-type': 'application/json' } });
};

// Run every 6 hours.
export const config = { schedule: '0 */6 * * *' };

// ─── LIVE DRY-RUN (real Google News, NO DB write): node update-ai-bans.mjs --dryrun ──
if (process.argv.includes('--dryrun')) {
    (async () => {
        const news = await fetchBanNews();
        console.log(`fetched ${news.length} headlines`);
        const rows = buildRows(news, new Date().toISOString());
        console.log(`\n${rows.length} ban(s) detected:`);
        for (const r of rows) console.log(`  ⛓️  ${r.ban_key.padEnd(22)} ${JSON.stringify(r.scope).padEnd(26)} ${(r.match_lab || r.match_name)}  ←  ${r.reason}`);
        if (process.argv.includes('--verbose')) { console.log('\nall headlines:'); news.forEach(n => console.log('  · ' + n.title)); }
        process.exit(0);
    })();
}

// ─── LOCAL SELF-TEST (no network / no DB): node update-ai-bans.mjs --selftest ──
if (process.argv.includes('--selftest')) {
    const samples = [
        ["DeepSeek blocked nationwide in Turkey by court order", true, 'news:deepseek:TR'],
        ["Italy's privacy watchdog bans Google Gemini over data breach", true, 'news:gemini:IT'],
        ["German government bars DeepSeek from official devices", true, 'news:deepseek:DE'],
        ["India's IT ministry orders Grok offline pending review", true, 'news:grok:IN'],
        ["Anthropic Claude reinstated in France after successful appeal", false, null], // release wording
        ["EU lawmakers reject proposal to ban Qwen, no decision reached", false, null], // negation
        ["OpenAI bans thousands of accounts in China for misuse", false, null],         // lab-as-actor
        ["Gemini tops the leaderboard again this quarter", false, null],                // no ban/actor
        ["Senate debates AI safety rules for ChatGPT and Claude", false, null],         // no jurisdiction-scoped ban verb? has 'rules' not ban
        ["US states move to ban DeepSeek on government devices", true, 'news:deepseek:US'],
    ];
    let pass = 0;
    for (const [title, shouldHit, expectKey] of samples) {
        const c = classify(title);
        const got = c ? `news:${c.matcher.id}:${c.code}` : null;
        const ok = shouldHit ? (got === expectKey) : (c === null);
        console.log(`${ok ? '✅' : '❌'}  ${got || '(skip)'}  ←  ${title}`);
        if (ok) pass++;
    }
    console.log(`\n${pass}/${samples.length} cases correct`);
    process.exit(pass === samples.length ? 0 : 1);
}
