// ════════════════════════════════════════════════════════════════════════════════
// FOUNDERS INDEX — public directory of all tracker pages.
//
// Routes:
//   GET /founders   →  Static-feeling HTML grid of all tracked founders, each
//                     linking to /founder/:slug. Each card shows name, role, lab,
//                     and lab color. Designed for SEO crawlability — every founder
//                     tracker is one click from this page.
// ════════════════════════════════════════════════════════════════════════════════

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://uojpqygjbxranpdvkwwz.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || 'sb_publishable_ucIgRt4nL0kY_ZHbcz92nQ_8O0PzeNA';

const CACHE_TTL = 10 * 60 * 1000;
let cache = { ts: 0, html: null };

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

async function loadFoundersAndLabs() {
    const headers = { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` };
    const [foundersRes, labsRes] = await Promise.all([
        fetch(`${SUPABASE_URL}/rest/v1/founders?select=*`, { headers, signal: AbortSignal.timeout(8000) }),
        fetch(`${SUPABASE_URL}/rest/v1/labs?select=id,name,color,icon`, { headers, signal: AbortSignal.timeout(8000) })
    ]);
    if (!foundersRes.ok) throw new Error('founders HTTP ' + foundersRes.status);
    if (!labsRes.ok) throw new Error('labs HTTP ' + labsRes.status);
    const founders = await foundersRes.json();
    const labsArr = await labsRes.json();
    const labs = {};
    for (const l of labsArr) labs[l.id] = l;
    return { founders, labs };
}

function renderHtml(founders, labs) {
    // Group by lab for visual rhythm.
    const byLab = {};
    for (const f of founders) {
        if (!byLab[f.lab_id]) byLab[f.lab_id] = [];
        byLab[f.lab_id].push(f);
    }
    const labOrder = Object.keys(byLab).sort((a, b) => {
        const an = (labs[a] && labs[a].name) || a;
        const bn = (labs[b] && labs[b].name) || b;
        return an.localeCompare(bn);
    });

    const sections = labOrder.map(labId => {
        const lab = labs[labId] || { name: labId, color: '#64748b', icon: '🏢' };
        const cards = byLab[labId].map(f => {
            const slug = slugify(f.name);
            const role = escapeHtml(f.role || 'Founder');
            return `<a class="card" href="/founder/${slug}" style="border-color:${escapeHtml(lab.color || '#22d3ee')}55;">
                <div class="card-emoji">${escapeHtml(lab.icon || '🏢')}</div>
                <div class="card-body">
                    <div class="card-name">${escapeHtml(f.name)}</div>
                    <div class="card-role">${role}</div>
                    <div class="card-lab" style="color:${escapeHtml(lab.color || '#22d3ee')};">${escapeHtml(lab.name || labId)}</div>
                </div>
                <div class="card-arrow">↗</div>
            </a>`;
        }).join('');
        return `<section class="lab-section">
            <h2 style="color:${escapeHtml(lab.color || '#22d3ee')};">${escapeHtml(lab.icon || '🏢')} ${escapeHtml(lab.name || labId)}</h2>
            <div class="grid">${cards}</div>
        </section>`;
    }).join('');

    const title = 'Founder Trackers — Singularity City';
    const desc = 'Live trackers for every AI lab founder. Watch their pixel avatars move through Singularity City in real time — at HQ, at home, in the helicopter, or out at the retreat.';

    return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="${escapeHtml(desc)}">
<meta property="og:title" content="${escapeHtml(title)}">
<meta property="og:description" content="${escapeHtml(desc)}">
<meta property="og:url" content="${SITE}/founders">
<meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${escapeHtml(title)}">
<meta name="twitter:description" content="${escapeHtml(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.png">
<link rel="icon" type="image/x-icon" href="/favicon.ico">
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>
:root { color-scheme: dark; }
* { box-sizing: border-box; }
body { margin:0; background:#060610; color:#e8e8f0; font-family:'JetBrains Mono', monospace; line-height:1.5; }
.wrap { max-width:1100px; margin:0 auto; padding:48px 20px 80px; }
header { text-align:center; margin-bottom:48px; }
header h1 { font-family:'Press Start 2P', monospace; font-size:clamp(18px, 2.6vw, 28px); color:#22d3ee; letter-spacing:4px; margin:0 0 14px; text-shadow:0 0 20px rgba(34,211,238,0.45); }
header p { color:#a0a0b8; font-size:13px; max-width:640px; margin:0 auto; }
.back-link { display:inline-block; margin-top:18px; padding:8px 14px; border:1px solid rgba(34,211,238,0.45); color:#22d3ee; text-decoration:none; font-size:11px; letter-spacing:1.5px; }
.back-link:hover { background:rgba(34,211,238,0.1); }
.lab-section { margin-bottom:36px; }
.lab-section h2 { font-family:'Press Start 2P', monospace; font-size:13px; letter-spacing:2px; margin:0 0 16px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.08); }
.grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(260px, 1fr)); gap:12px; }
.card {
    display:flex; align-items:center; gap:12px;
    padding:14px 16px;
    background:rgba(15, 12, 28, 0.6);
    border:1px solid rgba(34,211,238,0.2);
    border-radius:6px;
    text-decoration:none;
    color:#e8e8f0;
    transition:all .18s ease;
    position:relative;
}
.card:hover { background:rgba(34,211,238,0.07); transform:translateY(-1px); box-shadow:0 6px 22px -8px rgba(34,211,238,0.35); }
.card-emoji { font-size:28px; line-height:1; flex-shrink:0; }
.card-body { flex:1; min-width:0; }
.card-name { font-weight:700; font-size:13px; color:#e8e8f0; }
.card-role { font-size:10px; color:#8a8aa0; margin-top:2px; }
.card-lab { font-size:10px; margin-top:2px; letter-spacing:0.5px; text-transform:uppercase; }
.card-arrow { color:#22d3ee; font-size:14px; opacity:.6; }
.card:hover .card-arrow { opacity:1; }
footer { text-align:center; margin-top:48px; padding-top:24px; border-top:1px solid rgba(255,255,255,0.05); color:#5a5a78; font-size:10px; }
</style>
</head>
<body>
<div class="wrap">
<header>
    <h1>FOUNDER TRACKERS</h1>
    <p>Click any founder to live-track their pixel avatar moving through the city. The camera follows them at HQ, at home, on a helicopter ride to Silicon Woods, or out for a drive.</p>
    <a class="back-link" href="/">← Back to the city</a>
</header>
${sections || '<p style="text-align:center;color:#888">No founders loaded.</p>'}
<footer>Singularity City · Data synced from the live AI industry simulation</footer>
</div>
</body>
</html>`;
}

export default async (_req, _ctx) => {
    const now = Date.now();
    if (cache.html && now - cache.ts < CACHE_TTL) {
        return new Response(cache.html, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=600' }
        });
    }
    try {
        const { founders, labs } = await loadFoundersAndLabs();
        const html = renderHtml(founders, labs);
        cache = { ts: now, html };
        return new Response(html, {
            status: 200,
            headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300, s-maxage=600' }
        });
    } catch (err) {
        return new Response('Founders index error: ' + (err && err.message || err), {
            status: 502,
            headers: { 'content-type': 'text/plain; charset=utf-8' }
        });
    }
};

export const config = {
    path: '/founders'
};
