// Minimal RSS 2.0 / Atom → rss2json-shaped JSON, no dependencies.
//
// Feeds in the wild are not reliably well-formed XML (HTML entities such as
// &nbsp; outside CDATA, stray ampersands), so this reads them with tolerant
// regexes instead of an XML parser. It only needs the handful of fields the
// city displays: titles, links, dates and short descriptions.
//
// Output matches what js/api.js used to get from api.rss2json.com:
//   { feed: { url, title, link, description, image },
//     items: [{ title, pubDate, link, guid, author, thumbnail, description,
//               content, enclosure, categories }] }
// pubDate is 'YYYY-MM-DD HH:MM:SS' in UTC, like rss2json (callers split it on
// the space). `content` is left empty: nothing reads it and full articles
// would multiply the payload.

const NAMED = {
    amp: '&',
    lt: '<',
    gt: '>',
    quot: '"',
    apos: "'",
    nbsp: ' ',
    hellip: '…',
    mdash: '—',
    ndash: '–',
    lsquo: '‘',
    rsquo: '’',
    sbquo: '‚',
    ldquo: '“',
    rdquo: '”',
    bdquo: '„',
    laquo: '«',
    raquo: '»',
    bull: '•',
    middot: '·',
    trade: '™',
    copy: '©',
    reg: '®',
    euro: '€',
    pound: '£',
    yen: '¥',
    cent: '¢',
    deg: '°',
    times: '×',
    divide: '÷',
    plusmn: '±',
    frac12: '½',
    frac14: '¼',
    frac34: '¾',
    eacute: 'é',
    egrave: 'è',
    aacute: 'á',
    agrave: 'à',
    iacute: 'í',
    oacute: 'ó',
    uacute: 'ú',
    ntilde: 'ñ',
    ccedil: 'ç',
    auml: 'ä',
    ouml: 'ö',
    uuml: 'ü',
    szlig: 'ß',
    zwj: '‍',
    zwnj: '‌',
    shy: '­',
};

export function decodeEntities(s) {
    if (!s || s.indexOf('&') < 0) return s || '';
    return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z][a-z0-9]*);/gi, (m, e) => {
        if (e[0] === '#') {
            const hex = e[1] === 'x' || e[1] === 'X';
            const cp = hex ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
            return cp > 0 && cp < 0x110000 ? String.fromCodePoint(cp) : m;
        }
        const v = NAMED[e] !== undefined ? NAMED[e] : NAMED[e.toLowerCase()];
        return v !== undefined ? v : m;
    });
}

// Raw element body → its markup: CDATA sections are literal, everything else is
// entity-escaped text, so decode only the parts outside CDATA.
function unwrap(raw) {
    if (!raw) return '';
    if (raw.indexOf('<![CDATA[') < 0) return decodeEntities(raw);
    let out = '';
    let i = 0;
    const re = /<!\[CDATA\[([\s\S]*?)\]\]>/g;
    let m;
    while ((m = re.exec(raw))) {
        out += decodeEntities(raw.slice(i, m.index)) + m[1];
        i = m.index + m[0].length;
    }
    return out + decodeEntities(raw.slice(i));
}

// Markup → one line of plain text (titles, author names).
function plain(markup) {
    return decodeEntities(String(markup || '').replace(/<[^>]*>/g, ' '))
        .replace(/\s+/g, ' ')
        .trim();
}

function escRe(name) {
    return name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Inner body of the first <name …>…</name> in `block` (namespaced names welcome).
function inner(block, name) {
    const re = new RegExp(`<${escRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escRe(name)}\\s*>`, 'i');
    const m = block.match(re);
    return m ? m[1] : null;
}

function firstInner(block, names) {
    for (const n of names) {
        const v = inner(block, n);
        if (v !== null && v.trim() !== '') return v;
    }
    return null;
}

// Every opening tag <name …> (or self-closing) as an attribute map.
function tags(block, name) {
    const re = new RegExp(`<${escRe(name)}(\\s[^>]*?)?\\s*/?>`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(block))) out.push(attrs(m[1] || ''));
    return out;
}

function attrs(s) {
    const out = {};
    const re = /([\w:-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    let m;
    while ((m = re.exec(s))) out[m[1].toLowerCase()] = decodeEntities(m[3] !== undefined ? m[3] : m[4]);
    return out;
}

function blocks(xml, name) {
    const re = new RegExp(`<${escRe(name)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escRe(name)}\\s*>`, 'gi');
    const out = [];
    let m;
    while ((m = re.exec(xml))) out.push(m[1]);
    return out;
}

function pad(n) {
    return n < 10 ? '0' + n : String(n);
}

// Any date string Date.parse understands (RFC 822 incl. PDT/EST, ISO 8601) →
// rss2json's 'YYYY-MM-DD HH:MM:SS' UTC. Unknown → ''.
export function rssDate(s) {
    const t = Date.parse(String(s || '').trim());
    if (!Number.isFinite(t)) return '';
    const d = new Date(t);
    return (
        `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ` +
        `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}`
    );
}

// Cut HTML to roughly `max` characters without leaving half a tag at the end.
function clipHtml(html, max) {
    if (html.length <= max) return html;
    return html.slice(0, max).replace(/<[^>]*$/, '') + '…';
}

function firstImg(html) {
    const m = html && html.match(/<img\b[^>]*?\bsrc\s*=\s*["']([^"']+)["']/i);
    return m ? decodeEntities(m[1]) : '';
}

const isHttp = (u) => /^https?:\/\//i.test(u || '');

function rssItem(b, descMax) {
    const title = plain(unwrap(inner(b, 'title')));
    let link = plain(unwrap(inner(b, 'link')));
    const guidRaw = inner(b, 'guid');
    const guid = plain(unwrap(guidRaw));
    if (!isHttp(link)) link = plain(unwrap(inner(b, 'feedburner:origLink')));
    if (!isHttp(link) && isHttp(guid)) link = guid;
    const descHtml = unwrap(firstInner(b, ['description', 'content:encoded']) || '');
    const enc = tags(b, 'enclosure')[0] || null;
    const media = tags(b, 'media:thumbnail')[0] || tags(b, 'media:content').find((a) => a.url) || null;
    let thumbnail = media && media.url ? media.url : '';
    if (!thumbnail && enc && /^image\//i.test(enc.type || '')) thumbnail = enc.url || '';
    if (!thumbnail) thumbnail = firstImg(descHtml) || firstImg(unwrap(inner(b, 'content:encoded') || ''));
    return {
        title,
        pubDate: rssDate(plain(unwrap(firstInner(b, ['pubDate', 'dc:date', 'published', 'updated']) || ''))),
        link,
        guid: guid || link,
        author: plain(unwrap(firstInner(b, ['dc:creator', 'author']) || '')),
        thumbnail,
        description: clipHtml(descHtml.trim(), descMax),
        content: '',
        enclosure:
            enc && enc.url ? { link: enc.url, type: enc.type || '', length: Number(enc.length) || 0 } : {},
        categories: blocks(b, 'category')
            .map((c) => plain(unwrap(c)))
            .filter(Boolean),
    };
}

function atomLink(b) {
    const links = tags(b, 'link').filter((a) => a.href);
    const alt = links.find((a) => !a.rel || a.rel === 'alternate');
    return (alt || links[0] || {}).href || '';
}

function atomItem(b, descMax) {
    const descHtml = unwrap(firstInner(b, ['summary', 'content']) || '');
    const author = inner(b, 'author');
    return {
        title: plain(unwrap(inner(b, 'title'))),
        pubDate: rssDate(plain(unwrap(firstInner(b, ['published', 'updated']) || ''))),
        link: atomLink(b),
        guid: plain(unwrap(inner(b, 'id'))),
        author: author ? plain(unwrap(inner(author, 'name') || author)) : '',
        thumbnail: (tags(b, 'media:thumbnail')[0] || {}).url || firstImg(descHtml),
        description: clipHtml(descHtml.trim(), descMax),
        content: '',
        enclosure: {},
        categories: tags(b, 'category')
            .map((a) => a.term || a.label || '')
            .filter(Boolean),
    };
}

export function parseFeed(xml, { url = '', maxItems = 30, descMax = 1200 } = {}) {
    const text = String(xml || '');
    const head = text.slice(0, 4000);
    const atom = /<feed[\s>]/i.test(head) && !/<rss[\s>]/i.test(head) && !/<rdf:RDF[\s>]/i.test(head);
    const itemTag = atom ? 'entry' : 'item';
    const firstItem = text.search(new RegExp(`<${itemTag}[\\s>]`, 'i'));
    const top = firstItem > 0 ? text.slice(0, firstItem) : text;

    let feed;
    if (atom) {
        feed = {
            url,
            title: plain(unwrap(inner(top, 'title'))),
            link: atomLink(top),
            description: plain(unwrap(inner(top, 'subtitle'))),
            image: plain(unwrap(firstInner(top, ['logo', 'icon']) || '')),
        };
    } else {
        const image = inner(top, 'image');
        feed = {
            url,
            title: plain(unwrap(inner(top.replace(/<image[\s>][\s\S]*?<\/image>/i, ''), 'title'))),
            link: plain(unwrap(inner(top.replace(/<image[\s>][\s\S]*?<\/image>/i, ''), 'link'))),
            description: plain(unwrap(inner(top, 'description'))),
            image: image ? plain(unwrap(inner(image, 'url'))) : '',
        };
    }

    const items = [];
    for (const b of blocks(text, itemTag)) {
        const it = atom ? atomItem(b, descMax) : rssItem(b, descMax);
        if (!it.title || !isHttp(it.link)) continue;
        items.push(it);
        if (items.length >= maxItems) break;
    }
    return { feed, items };
}
