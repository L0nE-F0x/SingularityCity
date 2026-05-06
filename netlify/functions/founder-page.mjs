// ════════════════════════════════════════════════════════════════════════════════
// FOUNDER TRACKER — per-founder pretty URL with SEO meta tags.
//
// Routes (via netlify.toml redirect):
//   GET /founder/:slug   →  Returns rewritten index.html with og:title,
//                           og:description, og:url, twitter:* set to that
//                           founder. Injects window.SC_FOUNDER_SLUG so the
//                           client knows to boot in tracker mode.
//
// The page is otherwise identical to the regular city — same JS bundle, same
// boot flow. Founder mode is a thin client overlay (see js/founder_tracker.js).
//
// Implementation: fetches `/` from the same site (cached in memory) so we don't
// have to keep a hand-written HTML template in sync with index.html. Founders
// are pulled from Supabase at request time, also cached in memory.
// ════════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uojpqygjbxranpdvkwwz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ucIgRt4nL0kY_ZHbcz92nQ_8O0PzeNA';

const FOUNDERS_TTL = 10 * 60 * 1000;
const INDEX_TTL    =  5 * 60 * 1000;

let foundersCache = { ts: 0, founders: [], labs: {} };
let indexCache    = { ts: 0, html: '' };

const SITE = 'https://singularitycity.net';

function slugify(name) {
    return String(name || '')
        .toLowerCase()
        .normalize('NFKD').replace(/[̀-ͯ]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function escapeHtml(s) {
    return String(s == null ? '' : s)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

async function loadFounders() {
    const now = Date.now();
    if (now - foundersCache.ts < FOUNDERS_TTL && foundersCache.founders.length) return foundersCache;

    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const [foundersRes, labsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/founders?select=*`, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(`${SUPABASE_URL}/rest/v1/labs?select=id,name,color,icon,ticker`, { headers, signal: AbortSignal.timeout(8000) })
    ]);
    if (!foundersRes.ok) throw new Error('founders fetch HTTP ' + foundersRes.status);
    if (!labsRes.ok) throw new Error('labs fetch HTTP ' + labsRes.status);

    const founders = await foundersRes.json();
    const labsArr = await labsRes.json();
    const labs = {};
    for (const l of labsArr) labs[l.id] = l;

    foundersCache = { ts: now, founders, labs };
    return foundersCache;
}

async function loadIndexHtml(origin) {
    const now = Date.now();
    if (indexCache.html && now - indexCache.ts < INDEX_TTL) return indexCache.html;

    // Fetch the live index.html from the same site. Bypass any redirect loops
    // by appending a noop query param the redirect rule doesn't match.
    const url = `${origin}/index.html`;
    const res = await fetch(url, {
        headers: { 'cache-control': 'no-cache' },
        signal: AbortSignal.timeout(10000)
    });
    if (!res.ok) throw new Error(`index.html fetch HTTP ${res.status}`);
    const html = await res.text();
    if (!html || html.length < 500) throw new Error('index.html too short');

    indexCache = { ts: now, html };
    return html;
}

function rewriteMeta(html, founder, lab) {
    const labName = (lab && lab.name) || founder.lab_id || 'an AI lab';
    const role = founder.role || 'Founder';
    const fact = founder.fact || '';
    const slug = slugify(founder.name);

    const title = `Where is ${founder.name} right now? — Singularity City`;
    const desc = `Live tracker for ${founder.name}, ${role} at ${labName}. Watch their pixel avatar move through the AI industry simulation in real time.${fact ? ' ' + fact : ''}`;
    const url = `${SITE}/founder/${slug}`;
    const ogImage = `${SITE}/og-image.png`;

    html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(title)}</title>`);
    html = html.replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${escapeHtml(desc)}">`);
    html = html.replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${escapeHtml(title)}">`);
    html = html.replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${escapeHtml(desc)}">`);
    html = html.replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${escapeHtml(url)}">`);
    html = html.replace(/<meta property="og:image" content="[^"]*">/, `<meta property="og:image" content="${escapeHtml(ogImage)}">`);
    html = html.replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${escapeHtml(title)}">`);
    html = html.replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${escapeHtml(desc)}">`);
    html = html.replace(/<meta name="twitter:image" content="[^"]*">/, `<meta name="twitter:image" content="${escapeHtml(ogImage)}">`);

    // Inject founder slug + name + lab so the client boots in tracker mode
    // without an extra Supabase round-trip.
    const inject = `<script>
window.SC_FOUNDER_SLUG = ${JSON.stringify(slug)};
window.SC_FOUNDER_NAME = ${JSON.stringify(founder.name)};
window.SC_FOUNDER_LAB  = ${JSON.stringify(founder.lab_id)};
window.SC_FOUNDER_ROLE = ${JSON.stringify(role)};
window.SC_FOUNDER_FACT = ${JSON.stringify(fact || '')};
</script>
</head>`;
    html = html.replace(/<\/head>/, inject);
    return html;
}

function notFoundHtml(slug, founders) {
    const links = founders
        .slice(0, 60)
        .map(f => {
            const s = slugify(f.name);
            return `<li><a href="/founder/${s}">${escapeHtml(f.name)}</a> <span style="color:#888">— ${escapeHtml(f.lab_id || '')}</span></li>`;
        })
        .join('');
    return `<!doctype html><html><head>
<meta charset="utf-8">
<title>Founder not found — Singularity City</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<style>
body { background:#060610; color:#e8e8f0; font:14px/1.5 'JetBrains Mono', monospace; padding:48px 24px; max-width:680px; margin:0 auto; }
h1 { color:#22d3ee; font-family:'Press Start 2P', monospace; font-size:18px; margin-bottom:8px; }
ul { list-style:none; padding:0; column-count:2; column-gap:24px; }
li { margin:6px 0; break-inside:avoid; }
a { color:#fbbf24; text-decoration:none; }
a:hover { text-decoration:underline; }
.back { display:inline-block; margin-top:24px; padding:8px 14px; border:1px solid #22d3ee; color:#22d3ee; text-decoration:none; }
</style>
</head><body>
<h1>404 — No founder named "${escapeHtml(slug)}"</h1>
<p>Try one of these instead:</p>
<ul>${links}</ul>
<a class="back" href="/">← Back to the city</a> &nbsp; <a class="back" href="/founders">All founders</a>
</body></html>`;
}

export default async (req, _ctx) => {
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/founder\/([^/]+)\/?$/);
    if (!m) return new Response('Bad request', { status: 400 });
    const slug = decodeURIComponent(m[1]).toLowerCase();
    const origin = url.origin;

    try {
        const { founders, labs } = await loadFounders();
        const founder = founders.find(f => slugify(f.name) === slug);

        if (!founder) {
            return new Response(notFoundHtml(slug, founders), {
                status: 404,
                headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=60' }
            });
        }

        const lab = labs[founder.lab_id];
        const indexHtml = await loadIndexHtml(origin);
        const out = rewriteMeta(indexHtml, founder, lab);

        return new Response(out, {
            status: 200,
            headers: {
                'content-type': 'text/html; charset=utf-8',
                'cache-control': 'public, max-age=300, s-maxage=600'
            }
        });
    } catch (err) {
        return new Response('Founder page error: ' + (err && err.message || err), {
            status: 502,
            headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
    }
};
