"""Threaded static server for local playtesting.

`python -m http.server` is single-threaded: one browser keep-alive connection
blocks every other request, so a second tab (or a second browser) hangs with
ERR_EMPTY_RESPONSE. This serves the same folder with a thread per connection.

    python serve.py [port]        # default 8931
"""
import base64
import html
import json
import os
import re
import sys
import threading
import time
import urllib.error
import urllib.request
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

# Same paths as the Netlify redirects. ZeroEval does not send CORS headers, so a
# local playtest has to fetch it from this origin or the bench panel stays empty.
DEV_PROXIES = (
    ('/api/zeroeval/', 'https://api.zeroeval.com/'),
    ('/api/arena/', 'https://raw.githubusercontent.com/'),
)

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8931
ROOT = os.path.dirname(os.path.abspath(__file__))   # serve this folder, whatever the cwd
SHOTS = os.path.join(ROOT, '.shots')                # dev-only screenshot drop (gitignored)

# /api/rss mirrors netlify/functions/rss.mjs so local playtests get headlines.
# One allowlist for both: the quoted https URLs in _shared/rss-feeds.mjs.
with open(os.path.join(ROOT, 'netlify', 'functions', '_shared', 'rss-feeds.mjs'), encoding='utf-8') as _f:
    RSS_FEEDS = set(re.findall(r"'(https://[^']+)'", _f.read()))
_rss_cache = {}
_rss_lock = threading.Lock()


def _rss_text(raw):
    """Element body -> markup: CDATA literal, the rest entity-decoded."""
    if not raw:
        return ''
    parts = re.split(r'<!\[CDATA\[(.*?)\]\]>', raw, flags=re.S)
    return ''.join(p if i % 2 else html.unescape(p) for i, p in enumerate(parts))


def _rss_plain(markup):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]*>', ' ', markup or ''))).strip()


def _rss_inner(block, name):
    n = re.escape(name)
    m = re.search(r'<%s(?:\s[^>]*)?>(.*?)</%s\s*>' % (n, n), block, re.S | re.I)
    return m.group(1) if m else None


def _rss_date(s):
    s = (s or '').strip()
    if not s:
        return ''
    try:
        d = parsedate_to_datetime(s)
    except (TypeError, ValueError, IndexError):
        try:
            d = datetime.fromisoformat(s.replace('Z', '+00:00'))
        except ValueError:
            return ''
    if d.tzinfo is None:
        d = d.replace(tzinfo=timezone.utc)
    return d.astimezone(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')


def _rss_parse(xml, url, max_items=30):
    """Minimal RSS 2.0 / Atom -> rss2json-shaped dict (fields the city reads)."""
    atom = re.search(r'<feed[\s>]', xml[:4000], re.I) and not re.search(r'<rss[\s>]', xml[:4000], re.I)
    tag = 'entry' if atom else 'item'
    items = []
    for m in re.finditer(r'<%s(?:\s[^>]*)?>(.*?)</%s\s*>' % (tag, tag), xml, re.S | re.I):
        b = m.group(1)
        title = _rss_plain(_rss_text(_rss_inner(b, 'title')))
        if atom:
            links = re.findall(r'<link\b([^>]*)>', b, re.I)
            alt = [l for l in links if 'href' in l and ('rel=' not in l or 'alternate' in l)] or links
            lm = re.search(r'href\s*=\s*["\']([^"\']+)', alt[0]) if alt else None
            link = html.unescape(lm.group(1)) if lm else ''
            date = _rss_inner(b, 'published') or _rss_inner(b, 'updated')
            desc = _rss_text(_rss_inner(b, 'summary') or _rss_inner(b, 'content') or '')
        else:
            link = _rss_plain(_rss_text(_rss_inner(b, 'link')))
            date = _rss_inner(b, 'pubDate') or _rss_inner(b, 'dc:date')
            desc = _rss_text(_rss_inner(b, 'description') or _rss_inner(b, 'content:encoded') or '')
        if not title or not link.startswith('http'):
            continue
        desc = desc.strip()
        if len(desc) > 1200:
            desc = re.sub(r'<[^>]*$', '', desc[:1200]) + '…'
        items.append({'title': title, 'pubDate': _rss_date(_rss_plain(date or '')), 'link': link,
                      'guid': link, 'author': '', 'thumbnail': '', 'description': desc,
                      'content': '', 'enclosure': {}, 'categories': []})
        if len(items) >= max_items:
            break
    return {'status': 'ok', 'feed': {'url': url}, 'items': items}


class _SameHostRedirect(urllib.request.HTTPRedirectHandler):
    """Follow a feed's redirects only within its own host (Tom's Hardware 301s)."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):
        if urlparse(newurl).hostname != urlparse(req.full_url).hostname:
            raise urllib.error.HTTPError(newurl, code, 'redirect off-host', headers, fp)
        return super().redirect_request(req, fp, code, msg, headers, newurl.replace('http://', 'https://', 1))


_rss_opener = urllib.request.build_opener(_SameHostRedirect)


class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

    def do_GET(self):
        if self.path.startswith('/api/rss?') or self.path == '/api/rss':
            self._rss()
            return
        for prefix, origin in DEV_PROXIES:
            if self.path.startswith(prefix):
                self._proxy(origin + self.path[len(prefix):])
                return
        return super().do_GET()

    def _json(self, status, obj):
        body = json.dumps(obj).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def _rss(self):
        url = (parse_qs(urlparse(self.path).query).get('url') or [''])[0]
        if url not in RSS_FEEDS:
            self._json(400, {'status': 'error', 'message': 'feed not allowed', 'items': []})
            return
        with _rss_lock:
            hit = _rss_cache.get(url)
        if hit and time.time() - hit[0] < 300:
            self._json(200, hit[1])
            return
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'SingularityCity-dev (+https://singularitycity.net)'})
            with _rss_opener.open(req, timeout=10) as res:
                raw = res.read(3 * 1024 * 1024)
                charset = res.headers.get_content_charset() or 'utf-8'
            data = _rss_parse(raw.decode(charset, errors='replace'), url)
            if not data['items']:
                raise ValueError('no items')
            with _rss_lock:
                _rss_cache[url] = (time.time(), data)
            self._json(200, data)
        except Exception as e:  # noqa: BLE001 — any upstream failure is a 502 for the client
            if hit:
                self._json(200, hit[1])
            else:
                self._json(502, {'status': 'error', 'message': str(e), 'items': []})

    def _proxy(self, url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'SingularityCity-dev'})
            with urllib.request.urlopen(req, timeout=25) as res:
                body = res.read()
                self.send_response(getattr(res, 'status', 200))
                self.send_header('Content-Type', res.headers.get('Content-Type', 'application/json'))
                self.send_header('Content-Length', str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        except Exception as e:
            msg = str(e).encode()
            self.send_response(502)
            self.send_header('Content-Type', 'text/plain; charset=utf-8')
            self.send_header('Content-Length', str(len(msg)))
            self.end_headers()
            self.wfile.write(msg)

    def do_POST(self):
        """Dev-only: POST a canvas data URL to /__shot?name=foo and it lands in
        .shots/foo.jpg. Playtesting a WebGL scene means looking at frames, and
        pulling them back through the page as base64 is far slower than letting
        the page hand the bytes straight to disk."""
        if not self.path.startswith('/__shot'):
            self.send_error(404)
            return
        from urllib.parse import urlparse, parse_qs
        name = (parse_qs(urlparse(self.path).query).get('name') or ['shot'])[0]
        name = ''.join(ch for ch in name if ch.isalnum() or ch in '-_')[:64] or 'shot'
        body = self.rfile.read(int(self.headers.get('Content-Length') or 0)).decode('utf-8')
        if ',' in body:
            body = body.split(',', 1)[1]
        os.makedirs(SHOTS, exist_ok=True)
        path = os.path.join(SHOTS, name + '.jpg')
        with open(path, 'wb') as f:
            f.write(base64.b64decode(body))
        self.send_response(200)
        self.send_header('Content-Length', '2')
        self.end_headers()
        self.wfile.write(b'ok')

    def log_message(self, fmt, *args):
        pass  # quiet; errors still surface via log_error


if __name__ == '__main__':
    srv = ThreadingHTTPServer(('127.0.0.1', PORT), partial(Handler, directory=ROOT))
    srv.daemon_threads = True
    print(f'Singularity City FP - http://localhost:{PORT}')
    srv.serve_forever()
