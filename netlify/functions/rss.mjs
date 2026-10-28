// Same-origin RSS/Atom → JSON for the city's headline feeds (/api/rss?url=…).
//
// api.rss2json.com started answering browsers with a Cloudflare challenge
// (HTTP 403, `cf-mitigated: challenge`, no CORS headers) in 2026-10, so every
// feed js/api.js read through it failed on singularitycity.net and the ticker
// fell back to "Live headlines temporarily unavailable". This fetches the feed
// server-side and returns the same shape rss2json did.
//
// Strict allowlist (./_shared/rss-feeds.mjs): anything else is a 400. Redirects
// are followed by hand and only within the feed's own host, so a feed can't
// bounce the function somewhere else.

import { TextDecoder } from 'node:util';
import { RSS_FEEDS } from './_shared/rss-feeds.mjs';
import { parseFeed } from './_shared/rss-parse.mjs';

const ALLOW = new Set(RSS_FEEDS);
const MAX_BYTES = 3 * 1024 * 1024; // Tom's Hardware alone is ~1 MB
const TTL = 5 * 60 * 1000;
const UA = 'SingularityCity/1.0 (+https://singularitycity.net)';
const cache = new Map(); // url → { ts, body }

const OK_HEADERS = {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'public, max-age=300, s-maxage=600',
    // Netlify's CDN caches per `url` query value, and may serve a stale copy
    // while it refreshes.
    'netlify-cdn-cache-control': 'public, s-maxage=600, stale-while-revalidate=1800',
    'netlify-vary': 'query=url',
};

function fail(status, message) {
    return new Response(JSON.stringify({ status: 'error', message, items: [] }), {
        status,
        headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
    });
}

async function fetchSameHost(url) {
    const host = new URL(url).hostname;
    let target = url;
    for (let hop = 0; hop < 4; hop++) {
        const res = await fetch(target, {
            redirect: 'manual',
            headers: {
                'user-agent': UA,
                accept: 'application/rss+xml, application/atom+xml, application/xml;q=0.9, text/xml;q=0.8, */*;q=0.5',
            },
            signal: AbortSignal.timeout(7000),
        });
        if (res.status >= 300 && res.status < 400 && res.headers.get('location')) {
            const next = new URL(res.headers.get('location'), target);
            if (next.hostname !== host) throw new Error('redirect off-host');
            // Tom's Hardware 301s to an http:// URL on its own host; stay on https.
            next.protocol = 'https:';
            target = next.href;
            continue;
        }
        return res;
    }
    throw new Error('too many redirects');
}

async function readCapped(res) {
    const type = res.headers.get('content-type') || '';
    const reader = res.body.getReader();
    const chunks = [];
    let total = 0;
    for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        total += value.length;
        if (total >= MAX_BYTES) {
            reader.cancel().catch(() => {});
            break; // parse the complete items we already have
        }
    }
    const bytes = new Uint8Array(Math.min(total, MAX_BYTES));
    let off = 0;
    for (const c of chunks) {
        const n = Math.min(c.length, bytes.length - off);
        bytes.set(c.subarray(0, n), off);
        off += n;
        if (off >= bytes.length) break;
    }
    const head = new TextDecoder('latin1').decode(bytes.subarray(0, 200));
    const charset =
        (type.match(/charset=([\w-]+)/i) || head.match(/encoding=["']([\w-]+)["']/i) || [])[1] || 'utf-8';
    try {
        return new TextDecoder(charset.toLowerCase()).decode(bytes);
    } catch {
        return new TextDecoder('utf-8').decode(bytes);
    }
}

export default async (req) => {
    const url = new URL(req.url).searchParams.get('url') || '';
    if (!ALLOW.has(url)) return fail(400, 'feed not allowed');

    const hit = cache.get(url);
    if (hit && Date.now() - hit.ts < TTL) return new Response(hit.body, { headers: OK_HEADERS });

    try {
        const res = await fetchSameHost(url);
        if (!res.ok) throw new Error('upstream HTTP ' + res.status);
        const data = parseFeed(await readCapped(res), { url, maxItems: 30 });
        if (!data.items.length) throw new Error('no items');
        const body = JSON.stringify({ status: 'ok', ...data });
        cache.set(url, { ts: Date.now(), body });
        return new Response(body, { headers: OK_HEADERS });
    } catch (err) {
        // A recent copy beats an empty ticker.
        if (hit) {
            return new Response(hit.body, {
                headers: { ...OK_HEADERS, 'cache-control': 'public, max-age=60', 'x-rss-stale': '1' },
            });
        }
        return fail(502, String((err && err.message) || err));
    }
};
