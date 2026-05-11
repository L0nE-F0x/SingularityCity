// ════════════════════════════════════════════════════════════════════════════
// SC EVENTS COLLECTOR — Netlify Scheduled Function (hourly).
//
// Polls multiple live AI/industry data sources, classifies each entry into
// one of the city's reaction archetypes, and upserts into the Supabase
// sc_events table. The client reads from this table on boot so reactions,
// Citizen of the Day picks, and Daily Briefings work even when the user
// hasn't had the city open for days — events accumulate server-side.
//
// Phase 1 sources (this file):
//   • Hacker News AI-tagged stories  → reaction archetypes via keywords
//   • HuggingFace trending models    → 'release' / Launch Party at author lab
//   • Launch Library 2 launches      → 'launch' (informational; reaction
//                                       archetype is a future Phase 2 addition)
//
// Phase 2 sources (later):
//   • arXiv AI papers, ZeroEval ELO shake-ups, Finnhub AI-stock moves,
//     direct Anthropic/OpenAI/xAI/Google new-model releases
//
// Required env vars:
//   SUPABASE_URL          — Project URL
//   SUPABASE_SERVICE_KEY  — Service role key (bypasses RLS for writes)
//
// Schedule: hourly. The unique PK (`source:source_id`) makes re-runs no-ops.
// ════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

// ─── HELPERS ────────────────────────────────────────────────────────────────
async function fetchJSON(url, opts = {}, timeoutMs = 10000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        const res = await fetch(url, { signal: controller.signal, ...opts });
        clearTimeout(timer);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return await res.json();
    } catch (e) {
        clearTimeout(timer);
        console.warn(`[fetch] ${url} — ${e.message}`);
        return null;
    }
}

function utcDateString(d) {
    d = d || new Date();
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
}

// ─── CLASSIFIER (mirrors js/news_reactivity.js — keep in sync) ──────────────
// Order matters: first match wins. Founder names included because HN headlines
// often reference Sam Altman / Elon / etc. rather than the lab.
const LAB_KEYWORDS = [
    ['anthropic',    /\b(anthropic|claude|dario amodei|amodei)\b/i],
    ['openai',       /\b(openai|chatgpt|sam altman|altman|gpt-?\d|sora|o1|o2|o3|o4)\b/i],
    ['google',       /\b(google|deepmind|gemini|hassabis|pichai|alphabet)\b/i],
    ['xai',          /\b(xai|x\.ai|grok|elon musk|musk)\b/i],
    ['meta',         /\b(meta|llama|zuckerberg|mark zuck|fb research)\b/i],
    ['mistral',      /\b(mistral|arthur mensch|mensch|mixtral)\b/i],
    ['deepseek',     /\b(deepseek|liang wenfeng)\b/i],
    ['microsoft',    /\b(microsoft|nadella|copilot|bing chat)\b/i],
    ['nvidia',       /\b(nvidia|jensen huang|cuda|h100|h200|b100|blackwell)\b/i],
    ['tesla',        /\b(tesla|optimus)\b/i],
    ['alibaba',      /\b(alibaba|qwen|tongyi)\b/i],
    ['cohere',       /\b(cohere|aidan gomez|command r)\b/i],
    ['perplexity',   /\b(perplexity|aravind)\b/i],
    ['stability',    /\b(stable diffusion|stability ai)\b/i],
    ['hugging_face', /\b(hugging ?face)\b/i]
];
const SENTIMENT = {
    emergency:  /\b(fired|lawsuit|sued|breach(es|ed)?|hack(ed|s)?|leak(ed|s)?|exposed|whistleblow|board fires|departs|resigns|stepping down|class action|criminal|fraud|insider trading)\b/i,
    regulatory: /\b(regulation|regulat(es|ed|ing)|ban(ned)?|eu ai act|congress|senate|ftc|doj|antitrust|hearing|subpoena|investig(ation|ates)|complaint|fines?|copyright suit)\b/i,
    crisis:     /\b(controversy|criticized|under fire|backlash|outage|down|crash|recall|apologi[sz]e|delays?|deprecat(es|ed|ing)|shut(s|ting)? down)\b/i,
    celebrate:  /\b(raises?|releases?|launches?|launched|ships?|shipped|announces?|unveils?|debuts?|tops?|beats?|sets record|breakthrough|introduces?|open[- ]?sources?|funded|partnership|partners with|acquires?|valuation|ipo|integration with)\b/i
};
const ARCHETYPES = {
    celebrate:  { archetype: 'Launch Party',     emoji: '🎉' },
    crisis:     { archetype: 'Crisis Flicker',   emoji: '😰' },
    emergency:  { archetype: 'Emergency Huddle', emoji: '🚁' },
    regulatory: { archetype: 'Court Convene',    emoji: '⚖️' }
};

// Skip these prefixes when defaulting unscored stories to 'celebrate' — they
// indicate user-content / tutorials / Q&A rather than industry news.
const NOT_NEWS_PREFIX = /^(show hn|ask hn|how to|tutorial|guide|why does|why is|why are|explained|the case for|the case against|q&a|interview with)/i;

function classifyTitle(title) {
    const t = String(title || '');
    let lab = null;
    for (const [labId, re] of LAB_KEYWORDS) {
        if (re.test(t)) { lab = labId; break; }
    }
    let sentiment = null;
    if      (SENTIMENT.emergency.test(t))  sentiment = 'emergency';
    else if (SENTIMENT.regulatory.test(t)) sentiment = 'regulatory';
    else if (SENTIMENT.crisis.test(t))     sentiment = 'crisis';
    else if (SENTIMENT.celebrate.test(t))  sentiment = 'celebrate';
    // Fallback: lab matched clearly but no sentiment verb — default to
    // 'celebrate' (Launch Party) UNLESS the headline is obviously a tutorial,
    // Show HN, or Q&A. This loosens the gate so we capture stories like
    // "GPT-4 architecture deep dive" or "Anthropic publishes research paper"
    // where the headline mentions a lab but lacks an explicit sentiment verb.
    else if (lab && !NOT_NEWS_PREFIX.test(t)) {
        sentiment = 'celebrate';
    }
    return { lab, sentiment };
}

// HuggingFace model author → lab id (heuristic).
const HF_AUTHOR_LAB = {
    'anthropic':              'anthropic',
    'openai':                 'openai',
    'google':                 'google',
    'google-deepmind':        'google',
    'meta-llama':             'meta',
    'meta':                   'meta',
    'mistralai':              'mistral',
    'deepseek-ai':            'deepseek',
    'microsoft':              'microsoft',
    'nvidia':                 'nvidia',
    'tesla':                  'tesla',
    'qwen':                   'alibaba',
    'alibaba':                'alibaba',
    'cohere':                 'cohere',
    'perplexity-ai':          'perplexity',
    'stabilityai':            'stability'
};

// ─── HACKER NEWS ────────────────────────────────────────────────────────────
const AI_KEYWORDS = [
    'ai', 'a\\.i\\.', 'gpt', 'gpt-\\d', 'llm', 'llms', 'agi', 'asi',
    'claude', 'gemini', 'llama', 'deepseek', 'qwen', 'mistral', 'grok',
    'openai', 'anthropic', 'groq', 'xai', 'perplexity', 'cohere',
    'chatgpt', 'copilot', 'midjourney', 'dall-e', 'sora', 'runway',
    'transformer', 'transformers', 'rlhf', 'dpo', 'rag',
    'agent', 'agents', 'agentic',
    'machine learning', 'deep learning', 'neural network', 'neural networks',
    'diffusion', 'stable diffusion',
    'inference', 'benchmark', 'benchmarks', 'eval', 'evals',
    'fine-tune', 'fine-tuning', 'fine tuning', 'pretraining', 'pre-training',
    'reasoning model', 'reasoning models',
    'hugging face', 'huggingface',
    'mamba', 'moe', 'mixture of experts'
];
const HN_RE = new RegExp('\\b(' + AI_KEYWORDS.join('|') + ')\\b', 'i');

async function collectFromHN() {
    const ids = await fetchJSON('https://hacker-news.firebaseio.com/v0/topstories.json');
    if (!Array.isArray(ids)) return [];
    const candidates = ids.slice(0, 60);
    const items = await Promise.all(candidates.map(id =>
        fetchJSON(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    ));
    const out = [];
    for (const it of items) {
        if (!it || it.type !== 'story' || !it.title || it.deleted || it.dead) continue;
        if (!HN_RE.test(it.title)) continue;
        const { lab, sentiment } = classifyTitle(it.title);
        if (!sentiment) continue;            // unclassified → skip
        const arche = ARCHETYPES[sentiment];
        const ts = it.time ? new Date(it.time * 1000) : new Date();
        out.push({
            id: 'hn:' + it.id,
            source: 'hn',
            event_type: sentiment,
            archetype: arche.archetype,
            emoji: arche.emoji,
            lab,
            title: it.title,
            url: it.url || `https://news.ycombinator.com/item?id=${it.id}`,
            score: Math.min(100, Math.max(0, it.score || 0)),
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return out;
}

// ─── HUGGINGFACE TRENDING ───────────────────────────────────────────────────
async function collectFromHF() {
    // Pull the 100 most-recently-CREATED models and filter to recognized
    // major-lab authors. sort=downloads was returning all-time classics
    // (Llama-2 etc.) which always fail the <14-day freshness gate. sort by
    // creation date gives us actual new releases.
    const models = await fetchJSON(
        'https://huggingface.co/api/models?sort=createdAt&direction=-1&limit=100&full=false'
    );
    if (!Array.isArray(models)) return [];

    const out = [];
    const seenLabs = new Set();  // limit one event per lab per run so HF
                                  // mass-uploaders don't dominate
    for (const m of models) {
        if (!m || !m.id) continue;
        const parts = String(m.id).split('/');
        if (parts.length < 2) continue;
        const author = parts[0].toLowerCase();
        const lab = HF_AUTHOR_LAB[author];
        if (!lab) continue;                  // skip random uploaders
        if (seenLabs.has(lab)) continue;
        seenLabs.add(lab);

        // HF API inconsistently returns createdAt vs lastModified vs
        // created_at depending on version — try all three.
        const tsRaw = m.createdAt || m.lastModified || m.created_at;
        const ts = tsRaw ? new Date(tsRaw) : new Date();
        // Window: 30 days. Gives us breathing room when no fresh release in a
        // given week, and a month-old flagship still makes a fine briefing.
        const ageDays = (Date.now() - ts.getTime()) / 86400000;
        if (ageDays > 30) continue;

        out.push({
            id: 'hf:' + m.id,
            source: 'hf',
            event_type: 'celebrate',
            archetype: 'Launch Party',
            emoji: '🎉',
            lab,
            title: `New release from ${labLabel(lab)}: ${parts[1]}`,
            url: `https://huggingface.co/${m.id}`,
            score: Math.min(100, Math.floor(Math.log10((m.downloads || 0) + 1) * 12)),
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return out;
}

function labLabel(labId) {
    const names = {
        openai: 'OpenAI', anthropic: 'Anthropic', google: 'Google DeepMind',
        xai: 'xAI', meta: 'Meta', mistral: 'Mistral', deepseek: 'DeepSeek',
        microsoft: 'Microsoft', nvidia: 'NVIDIA', tesla: 'Tesla',
        alibaba: 'Alibaba', cohere: 'Cohere', perplexity: 'Perplexity',
        stability: 'Stability AI', hugging_face: 'Hugging Face'
    };
    return names[labId] || labId;
}

// ─── LAUNCH LIBRARY 2 (rocket launches) ─────────────────────────────────────
// Logged as informational events. Phase 2 will wire a 🚀 archetype that
// triggers a rocket animation at the space port; for now they're stored but
// the client will filter them out of reaction triggers.
async function collectFromLaunchLib() {
    // Upcoming launches in next 7 days
    const data = await fetchJSON(
        'https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&hide_recent_previous=true'
    );
    if (!data || !Array.isArray(data.results)) return [];
    const out = [];
    for (const r of data.results) {
        if (!r || !r.id || !r.net) continue;
        const ts = new Date(r.net);
        const ageDays = Math.abs(Date.now() - ts.getTime()) / 86400000;
        if (ageDays > 7) continue;
        const provider = (r.launch_service_provider && r.launch_service_provider.name) || 'Unknown';
        out.push({
            id: 'll2:' + r.id,
            source: 'launch_lib',
            event_type: 'launch',
            archetype: 'Launch Party',
            emoji: '🚀',
            lab: null,
            title: `${provider} launch: ${r.name || 'mission'}`,
            url: r.url || 'https://thespacedevs.com',
            score: 60,
            ts: ts.toISOString(),
            event_date: utcDateString(ts)
        });
    }
    return out;
}

// ─── SUPABASE UPSERT ────────────────────────────────────────────────────────
async function upsertEvents(events) {
    if (!events.length) return { written: 0, failed: 0 };
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
        return { written: 0, failed: events.length };
    }
    // PostgREST bulk upsert. on_conflict=id means re-runs are no-ops.
    const res = await fetch(`${SUPABASE_URL}/rest/v1/sc_events?on_conflict=id`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'resolution=merge-duplicates,return=minimal'
        },
        body: JSON.stringify(events)
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        console.error(`[supabase] upsert HTTP ${res.status}: ${text}`);
        return { written: 0, failed: events.length };
    }
    return { written: events.length, failed: 0 };
}

// ─── ENTRY POINT ────────────────────────────────────────────────────────────
export default async (_req) => {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
        const msg = 'Missing SUPABASE_URL or SUPABASE_SERVICE_KEY env vars';
        console.error(msg);
        return new Response(JSON.stringify({ error: msg }), { status: 500 });
    }

    const startedAt = Date.now();
    console.log('🛰️  collect-events running…');

    const [hn, hf, ll] = await Promise.all([
        collectFromHN().catch(e => { console.warn('HN error:', e.message); return []; }),
        collectFromHF().catch(e => { console.warn('HF error:', e.message); return []; }),
        collectFromLaunchLib().catch(e => { console.warn('LL2 error:', e.message); return []; })
    ]);
    console.log(`  sources: ${hn.length} HN · ${hf.length} HF · ${ll.length} LL2`);

    const all = [...hn, ...hf, ...ll];
    const { written, failed } = await upsertEvents(all);

    const elapsed = Math.round((Date.now() - startedAt) / 100) / 10;
    const summary = {
        ok: failed === 0,
        sources: { hn: hn.length, hf: hf.length, ll: ll.length },
        written,
        failed,
        elapsedSec: elapsed
    };
    console.log(`  ✅ done · ${written} written · ${failed} failed · ${elapsed}s`);
    return new Response(JSON.stringify(summary, null, 2), {
        status: failed === 0 ? 200 : 500,
        headers: { 'content-type': 'application/json' }
    });
};

// Run every hour on the hour
export const config = {
    schedule: '0 * * * *'
};
