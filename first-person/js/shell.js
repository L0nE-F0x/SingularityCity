/* ============================================================================
   SHELL — view toggle + shared chrome for the integrated product.

   Views:
     - fp   : Three.js first-person
     - map  : Canvas city overview (same store, no Pixi)
     - pixi : Hard-swap navigation to the 2D Pixi city at the site root.
              'pixi' is the wire value shared with sc_integrated_bridge.js via
              the resume token — do not rename it to match the new URL.
   ============================================================================ */

import { CityStore } from './store/city_store.js';
import { INTEGRATION, flagEnabled } from './store/config.js';
import { G, CELL_W, CELL_D, CITY_W, CITY_D, SEA_X } from './state.js';
import { City } from './city.js';
import { DISTRICTS, LABS, BLDS } from './data.js';
import { goPixi2D } from './store/nav.js';

let _els = {};
let _mapCanvas = null;
let _mapCtx = null;
let _raf = 0;
let _unsub = null;
let _lastToken = null;

function ensureDom() {
    if (document.getElementById('scShell')) return;

    const shell = document.createElement('div');
    shell.id = 'scShell';
    shell.innerHTML = `
      <div class="sc-shell-bar" role="banner">
        <div class="sc-shell-brand">
          <span class="sc-shell-mark">🏙</span>
          <span class="sc-shell-title">SINGULARITY CITY</span>
          <span class="sc-shell-mode" id="scShellMode">FP</span>
        </div>
        <div class="sc-shell-views" role="toolbar" aria-label="View mode">
          <button type="button" class="sc-shell-btn active" data-view="fp" title="First-person streets">🚶 First Person</button>
          <button type="button" class="sc-shell-btn" data-view="map" title="Top-down city map (shared state)">🗺 City Map</button>
        </div>
        <div class="sc-shell-meta">
          <span id="scLiveBadge" class="sc-live-badge offline" title="Live data status">OFFLINE</span>
          <span id="scShellClock" class="sc-shell-clock">--:--</span>
          ${flagEnabled('classic2dLink')
            ? `<button type="button" class="sc-shell-link sc-shell-pixi-btn" id="scGoPixi" title="Switch to the 2D pixel city">🗺 2D City</button>`
            : ''}
        </div>
      </div>
      <div id="scMapView" class="sc-map-view hidden" aria-hidden="true">
        <div class="sc-map-hud">
          <div>
            <div class="sc-map-h1">City Map</div>
            <div class="sc-map-sub" id="scMapSub">Shared CityStore · same clock, weather, news &amp; progress as First Person</div>
          </div>
          <div class="sc-map-side">
            <div id="scMapWeather">—</div>
            <div id="scMapIndex">AI INDEX —</div>
            <div id="scMapCotd">COTD —</div>
          </div>
        </div>
        <canvas id="scMapCanvas" width="1200" height="900"></canvas>
        <div class="sc-map-news" id="scMapNews"></div>
        <div class="sc-map-hint">Click a district to resume First Person near its centre · Esc / 🚶 to return · V toggles</div>
      </div>
    `;
    document.body.appendChild(shell);

    _els = {
        shell,
        mode: document.getElementById('scShellMode'),
        live: document.getElementById('scLiveBadge'),
        clock: document.getElementById('scShellClock'),
        mapView: document.getElementById('scMapView'),
        mapSub: document.getElementById('scMapSub'),
        mapWeather: document.getElementById('scMapWeather'),
        mapIndex: document.getElementById('scMapIndex'),
        mapCotd: document.getElementById('scMapCotd'),
        mapNews: document.getElementById('scMapNews'),
        buttons: [...shell.querySelectorAll('[data-view]')]
    };
    _mapCanvas = document.getElementById('scMapCanvas');
    _mapCtx = _mapCanvas.getContext('2d');

    for (const btn of _els.buttons) {
        btn.addEventListener('click', () => Shell.setView(btn.dataset.view));
    }
    const goPixiBtn = document.getElementById('scGoPixi');
    if (goPixiBtn) {
        goPixiBtn.addEventListener('click', (e) => {
            e.preventDefault();
            Shell.goPixi();
        });
    }
    _mapCanvas.addEventListener('click', onMapClick);
    _mapCanvas.addEventListener('mousemove', onMapMove);
    _mapCanvas.addEventListener('mouseleave', () => { _mapHover = null; });
    window.addEventListener('keydown', (e) => {
        if (e.code === 'Escape' && CityStore.getView() === 'map') {
            Shell.setView('fp');
        }
        if (e.code === 'KeyP' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (G.terminalOpen) return;
            Shell.goPixi();
            return;
        }
        if (e.code === 'KeyV' && !e.ctrlKey && !e.metaKey && !e.altKey) {
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            if (G.terminalOpen) return;
            if (G.panelOpen && CityStore.getView() !== 'map') return;
            Shell.setView(CityStore.getView() === 'fp' ? 'map' : 'fp');
        }
    });
}

function clockString(dp) {
    const h = Math.floor(dp * 24);
    const m = Math.floor((dp * 24 - h) * 60);
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function applyChrome(snap) {
    if (!_els.mode) return;
    _els.mode.textContent = snap.view === 'map' ? 'MAP' : 'FP';
    for (const btn of _els.buttons) {
        btn.classList.toggle('active', btn.dataset.view === snap.view);
    }
    const live = snap.live || {};
    _els.live.textContent = live.online ? 'LIVE' : (live.error ? 'CACHE' : 'OFFLINE');
    _els.live.className = 'sc-live-badge ' + (live.online ? 'online' : 'offline');
    _els.live.title = live.sources?.length
        ? `Sources: ${live.sources.join(', ')}${live.models != null ? ` · ${live.models} models` : ''}`
        : 'Live data';
    _els.clock.textContent = clockString(snap.dayPhase);

    if (snap.view === 'map') {
        _els.mapWeather.textContent = `${snap.weather?.state || 'clear'} · ${Math.round((snap.weather?.intensity || 0) * 100)}%`;
        _els.mapIndex.textContent = `AI INDEX ${Math.round(snap.aiIndex)}`;
        if (snap.cotd) {
            const lab = LABS[snap.cotd.lab]?.name || snap.cotd.lab || '';
            _els.mapCotd.textContent = `COTD ${snap.cotd.name || snap.cotd.modelId}${lab ? ' · ' + lab : ''}`;
        } else {
            _els.mapCotd.textContent = 'COTD —';
        }
        const news = (snap.news || []).slice(0, 6);
        _els.mapNews.innerHTML = news.map(n =>
            `<a href="${n.url || '#'}" target="_blank" rel="noopener"><b>${n.source || 'News'}</b> ${escapeHtml(n.headline || '')}</a>`
        ).join('');
    }
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[c]);
}

function resizeMapCanvas() {
    if (!_mapCanvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    /* Measure the element, don't predict it.

       This used to guess the size from the window (`innerHeight - 160`) and
       write it to style.width/height — but the CSS lays the canvas out with
       `flex: 1`, which won. So the backing store was sized for a height the
       element never had, drawMap painted using the real clientHeight, and the
       leftover rows of the buffer stayed black: a dead band across the bottom
       of the map. Let CSS own the box and follow it. */
    const r = _mapCanvas.getBoundingClientRect();
    const w = Math.max(320, Math.round(r.width));
    const h = Math.max(240, Math.round(r.height));
    _mapCanvas.width = Math.floor(w * dpr);
    _mapCanvas.height = Math.floor(h * dpr);
    _mapCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    _shellCache.canvas = null;   // the baked plan is sized to the old canvas
}

/* ── CITY MAP ────────────────────────────────────────────────────────────────
   Was: one flat rectangle per district, 3px grey dots for buildings, a pink
   circle for you. It carried no information the district list didn't already
   give you, and the two things that actually make this city legible from above
   — the road grid and where the labs are — were both missing entirely.

   Now it draws the real plan: coastline, the avenue/street grid straight out of
   City.roads, every building at its true footprint, lab HQs in their brand
   colour, the metro lines between stations, and live citizen density.

   Two layers. Everything fixed (ground, roads, buildings, labels) renders ONCE
   into an offscreen canvas and is blitted per frame; only the moving parts —
   citizens, you, the hover highlight — are redrawn. Without that split this is
   ~5,000 fills every frame at 60fps for a screen nobody is even walking in. */

/* The baked plan is cached PER CALLER. There are two maps on screen in this
   product — the full-screen City Map view and the in-game M panel — and they
   are different sizes, so a single module-level cache would rebake on every
   frame as they take turns. */
const _shellCache = { canvas: null, key: '' };
let _mapHover = null;       // district under the cursor
const _mapProj = { ox: 0, oy: 0, s: 1 };

/* Uniform scale, centred. The old projection scaled x and z independently to
   fill the canvas, which stretched the city into whatever shape the window
   happened to be — a map that lies about distance is worse than no map. */
function mapProject(W, H) {
    const worldW = CITY_W + 900;
    const worldD = CITY_D + 900;
    const s = Math.min((W - 32) / worldW, (H - 32) / worldD);
    _mapProj.s = s;
    _mapProj.ox = (W - worldW * s) / 2 + (CITY_W / 2 + 450) * s;
    _mapProj.oy = (H - worldD * s) / 2 + (CITY_D / 2 + 450) * s;
    return _mapProj;
}
const mx2 = (x) => _mapProj.ox + x * _mapProj.s;
const mz2 = (z) => _mapProj.oy + z * _mapProj.s;

const hexOf = (n, fallback) => (typeof n === 'number'
    ? '#' + (n >>> 0).toString(16).padStart(6, '0').slice(-6) : fallback);

/** Bake the parts of the map that never move. */
function buildMapStatic(W, H) {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const s = _mapProj.s;

    /* ── sea, beach, land ──
       The sea is a BAND, not everything left of the coast. Filling the whole
       left of the canvas meant that on a wide window the map read as one third
       city and two thirds featureless water. */
    g.fillStyle = '#070b14';
    g.fillRect(0, 0, W, H);
    const seaX = mx2(SEA_X);
    const landX0 = mx2(-CITY_W / 2 - 420);
    const landX1 = mx2(CITY_W / 2 + 420);
    const landY0 = mz2(-CITY_D / 2 - 420);
    const landY1 = mz2(CITY_D / 2 + 420);
    g.fillStyle = '#16241a';                          // countryside
    g.fillRect(landX0, landY0, landX1 - landX0, landY1 - landY0);
    const seaX0 = Math.max(landX0 - 1, mx2(SEA_X - 1400));
    const grad = g.createLinearGradient(seaX0, 0, seaX, 0);
    grad.addColorStop(0, '#0a2740');
    grad.addColorStop(1, '#12496b');
    g.fillStyle = grad;
    g.fillRect(seaX0, landY0, seaX - seaX0, landY1 - landY0);
    g.fillStyle = '#c2a878';
    g.fillRect(seaX - 3, landY0, 7, landY1 - landY0); // beach
    // a hairline round the mapped area so the plan sits on a sheet
    g.strokeStyle = 'rgba(148,163,184,.22)';
    g.lineWidth = 1;
    g.strokeRect(landX0 + .5, landY0 + .5, landX1 - landX0 - 1, landY1 - landY0 - 1);

    const districts = City.districts?.length ? City.districts : [];

    // ── district plots ──
    for (const d of districts) {
        const x = mx2(d.cx - CELL_W / 2), y = mz2(d.cz - CELL_D / 2);
        const w = CELL_W * s, h = CELL_D * s;
        g.fillStyle = hexOf(d.biomeDef?.ground, '#1a2332');
        g.fillRect(x, y, w, h);
        g.strokeStyle = 'rgba(148,163,184,.16)';
        g.lineWidth = 1;
        g.strokeRect(x + .5, y + .5, w - 1, h - 1);
    }

    /* ── the road grid ──
       The single biggest thing the old map was missing. Every avenue, street,
       ring road and district cross-road, at its real carriageway width — this
       is what turns a chart of coloured squares into a city plan. */
    for (const r of City.roads || []) {
        const w = r.vertical ? r.carriage : r.w;
        const d = r.vertical ? r.d : r.carriage;
        g.fillStyle = r.inner ? '#1c2430' : '#252d3a';
        g.fillRect(mx2(r.x - w / 2), mz2(r.z - d / 2), Math.max(1, w * s), Math.max(1, d * s));
    }
    // centre lines on the main avenues only, so the hierarchy reads
    g.strokeStyle = 'rgba(216,194,74,.5)';
    g.lineWidth = Math.max(0.6, 1 * s * 40);
    g.setLineDash([6, 5]);
    g.beginPath();
    for (const ax of City.avenueXs || []) { g.moveTo(mx2(ax), mz2(-CITY_D / 2)); g.lineTo(mx2(ax), mz2(CITY_D / 2)); }
    for (const sz of City.streetZs || []) { g.moveTo(mx2(-CITY_W / 2), mz2(sz)); g.lineTo(mx2(CITY_W / 2), mz2(sz)); }
    g.stroke();
    g.setLineDash([]);

    // ── background infill blocks: the built-up texture between landmarks ──
    g.fillStyle = 'rgba(122,138,160,.30)';
    for (const b of City.infill || []) {
        g.fillRect(mx2(b.x - b.w / 2), mz2(b.z - b.d / 2),
            Math.max(1, b.w * s), Math.max(1, b.d * s));
    }

    /* ── named buildings, at their true footprint ──
       A lab HQ gets its brand colour, so you can find Anthropic or Alibaba at a
       glance. That is the other half of what a map of THIS city is for. */
    for (const p of G.placements || []) {
        if (p.x == null) continue;
        const b = p.b || {};
        let col = 'rgba(203,213,225,.72)';
        if (b.lab && LABS[b.lab]) col = LABS[b.lab].color;
        else if (b.type === 'park' || b.type === 'graveyard') col = '#3f7a46';
        else if (b.type === 'metro') col = '#22d3ee';
        else if (b.type === 'villa') col = '#d9b45e';
        else if (b.type === 'launchpad') col = '#e2e8f0';
        else if (b.type === 'datacenter' || b.type === 'fab') col = '#7dd3fc';
        g.fillStyle = col;
        const w = Math.max(2, (p.w || 60) * s), h = Math.max(2, (p.d || 60) * s);
        g.fillRect(mx2(p.x) - w / 2, mz2(p.z) - h / 2, w, h);
    }

    // ── metro lines, drawn over the plan in their own colours ──
    for (const route of (G.metro?.routes || [])) {
        const pts = (route.stops || []).map(id => G.bldById[id]).filter(Boolean);
        if (pts.length < 2) continue;
        g.strokeStyle = hexOf(route.color, '#22d3ee');
        g.lineWidth = 2.2;
        g.globalAlpha = 0.85;
        g.beginPath();
        pts.forEach((b, i) => (i ? g.lineTo(mx2(b.worldX), mz2(b.worldZ)) : g.moveTo(mx2(b.worldX), mz2(b.worldZ))));
        g.stroke();
        g.globalAlpha = 1;
        for (const b of pts) {
            g.fillStyle = '#0a0e1a';
            g.beginPath(); g.arc(mx2(b.worldX), mz2(b.worldZ), 4, 0, 7); g.fill();
            g.strokeStyle = '#e2e8f0'; g.lineWidth = 1.6; g.stroke();
        }
    }

    // ── district labels, on a chip so they stay readable over the plan ──
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.font = '600 10px "JetBrains Mono", ui-monospace, monospace';
    /* Labels are clipped to their own cell. At small canvas sizes a full
       district name is wider than the plot it names, so they used to run into
       each other and the row read as one long smear of letters. */
    const cellPx = CELL_W * s;
    if (cellPx > 42) {
        for (const d of districts) {
            const full = (d.label || d.id || '').replace(/^[^\w]*\s*/, '').toUpperCase();
            const room = cellPx - 8;
            let label = full;
            if (g.measureText(label).width > room) {
                while (label.length > 3 && g.measureText(label + '…').width > room) {
                    label = label.slice(0, -1);
                }
                label = label.replace(/[\s'']+$/, '') + '…';
            }
            const lx = mx2(d.cx), ly = mz2(d.cz - CELL_D / 2) + 11;
            const tw = g.measureText(label).width;
            g.fillStyle = 'rgba(7,11,20,.82)';
            g.fillRect(lx - tw / 2 - 4, ly - 7, tw + 8, 14);
            g.fillStyle = '#cbd5e1';
            g.fillText(label, lx, ly);
        }
    }

    // ── scale bar ──
    // Scale bar and compass sit on the sheet, not adrift in the sea.
    const barW = (1000 / 10) * s * 2;                  // 200 m at 10 units/m
    const bx = landX0 + 12, by = landY1 - 14;
    g.fillStyle = 'rgba(226,232,240,.85)';
    g.fillRect(bx, by, barW, 3);
    g.fillRect(bx, by - 5, 2, 8);
    g.fillRect(bx + barW - 2, by - 5, 2, 8);
    g.font = '9px "JetBrains Mono", ui-monospace, monospace';
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.fillText('200 m', bx, by - 9);
    const nx = landX1 - 18, ny = landY0 + 16;
    g.textAlign = 'center';
    g.font = '600 11px "JetBrains Mono", ui-monospace, monospace';
    g.fillText('N', nx, ny);
    g.beginPath(); g.moveTo(nx, ny + 5); g.lineTo(nx + 4, ny + 15); g.lineTo(nx - 4, ny + 15); g.closePath();
    g.fillStyle = 'rgba(226,232,240,.6)'; g.fill();

    return c;
}

/* Draw the whole city map into any 2D context. Exported so the in-game M
   panel renders the SAME map as the full-screen view — it used to carry its own
   older copy, which is why the two looked nothing like each other. */
export function paintCityMap(ctx, W, H, cache, opts = {}) {
    mapProject(W, H);

    // Rebake only when the canvas or the city changed.
    const key = `${W}x${H}:${City.districts?.length || 0}:${(G.placements || []).length}`;
    if (!cache.canvas || cache.key !== key) {
        cache.canvas = buildMapStatic(W, H);
        cache.key = key;
    }
    ctx.clearRect(0, 0, W, H);
    ctx.drawImage(cache.canvas, 0, 0);
    const _mapHoverLocal = opts.hover !== undefined ? opts.hover : _mapHover;

    /* ── live layer ──
       Citizen density. The city has ~720 of them and where they are at 09:00 is
       completely different from 22:00; a static plan cannot show that. */
    const list = G.citizens?.list || [];
    ctx.fillStyle = 'rgba(125,211,252,.55)';
    for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c.indoors) continue;                       // parked off-world
        ctx.fillRect(mx2(c.x) - 1, mz2(c.z) - 1, 2, 2);
    }
    // founders stand out — they are who people look for
    ctx.fillStyle = '#fbbf24';
    for (const c of list) {
        if (!c.model?.founder || c.indoors) continue;
        ctx.beginPath(); ctx.arc(mx2(c.x), mz2(c.z), 2.6, 0, 7); ctx.fill();
    }

    // metro trains, live on their lines
    for (const t of (G.metro?.trains || [])) {
        ctx.fillStyle = hexOf(t.color, '#22d3ee');
        ctx.fillRect(mx2(t.x) - 2.5, mz2(t.z) - 2.5, 5, 5);
    }

    // hovered district
    if (_mapHoverLocal) {
        const d = _mapHoverLocal;
        ctx.strokeStyle = 'rgba(103,232,249,.9)';
        ctx.lineWidth = 2;
        ctx.strokeRect(mx2(d.cx - CELL_W / 2) + 1, mz2(d.cz - CELL_D / 2) + 1,
            CELL_W * _mapProj.s - 2, CELL_D * _mapProj.s - 2);
    }

    // visited districts
    const visited = CityStore.getSnapshot().progress.visitedDistricts || {};
    ctx.strokeStyle = 'rgba(74,222,128,.55)';
    ctx.lineWidth = 1.5;
    for (const d of (City.districts || [])) {
        if (!visited[d.id]) continue;
        ctx.strokeRect(mx2(d.cx - CELL_W / 2) + 3, mz2(d.cz - CELL_D / 2) + 3,
            CELL_W * _mapProj.s - 6, CELL_D * _mapProj.s - 6);
    }

    /* ── you ──
       An arrow, not a dot: on a map the size of a city, which way you are
       facing is most of what you want to know. */
    if (G.camera) {
        const px = mx2(G.camera.position.x), pz = mz2(G.camera.position.z);
        const yaw = G.player?.yaw ?? 0;
        const dx = -Math.sin(yaw), dz = -Math.cos(yaw);
        ctx.save();
        ctx.translate(px, pz);
        ctx.rotate(Math.atan2(dx, -dz));
        ctx.fillStyle = '#f472b6';
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(0, -9); ctx.lineTo(6, 7); ctx.lineTo(0, 3.5); ctx.lineTo(-6, 7);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.restore();
        // view cone
        ctx.strokeStyle = 'rgba(244,114,182,.28)';
        ctx.beginPath();
        ctx.moveTo(px, pz);
        ctx.arc(px, pz, 46, Math.atan2(dz, dx) - 0.5, Math.atan2(dz, dx) + 0.5);
        ctx.closePath();
        ctx.fillStyle = 'rgba(244,114,182,.12)';
        ctx.fill();
    }
}

/** Which district is at this world point (null outside every cell). */
export function cityMapDistrictAt(wx, wz) { return districtAtWorld(wx, wz); }

/** World point under a mouse event on a canvas the map was painted into. */
export function cityMapWorldAt(canvas, ev) {
    const rect = canvas.getBoundingClientRect();
    mapProject(rect.width, rect.height);
    return {
        x: (ev.clientX - rect.left - _mapProj.ox) / _mapProj.s,
        z: (ev.clientY - rect.top - _mapProj.oy) / _mapProj.s
    };
}

function drawMap() {
    if (!_mapCtx || CityStore.getView() !== 'map') return;
    paintCityMap(_mapCtx, _mapCanvas.clientWidth || 1200, _mapCanvas.clientHeight || 900, _shellCache);
    _raf = requestAnimationFrame(drawMap);
}

/** World position under a mouse event, in the map's projection. */
function mapWorldAt(ev) {
    const rect = _mapCanvas.getBoundingClientRect();
    mapProject(rect.width, rect.height);
    return {
        x: (ev.clientX - rect.left - _mapProj.ox) / _mapProj.s,
        z: (ev.clientY - rect.top - _mapProj.oy) / _mapProj.s
    };
}

function districtAtWorld(wx, wz) {
    let best = null, bestD = Infinity;
    for (const d of (City.districts || [])) {
        const dx = wx - d.cx, dz = wz - d.cz;
        // inside the cell, not merely nearest — clicking the sea should do nothing
        if (Math.abs(dx) > CELL_W / 2 || Math.abs(dz) > CELL_D / 2) continue;
        const dist = dx * dx + dz * dz;
        if (dist < bestD) { bestD = dist; best = d; }
    }
    return best;
}

function onMapMove(ev) {
    const w = mapWorldAt(ev);
    _mapHover = districtAtWorld(w.x, w.z);
    _mapCanvas.style.cursor = _mapHover ? 'pointer' : 'crosshair';
    if (_els.mapSub) {
        _els.mapSub.textContent = _mapHover
            ? `${_mapHover.label} — click to walk here`
            : 'Shared CityStore · same clock, weather, news & progress as First Person';
    }
}

function onMapClick(ev) {
    if (!City.districts?.length) return;
    /* Uses the map's own projection rather than re-deriving one. The old copy
       here had drifted from the renderer's — same padding, different centring —
       so clicks landed in a different district than the one under the cursor. */
    const w = mapWorldAt(ev);
    const best = districtAtWorld(w.x, w.z);
    if (!best) return;

    const token = CityStore.captureResume('fp', {
        districtId: best.id,
        x: best.cx,
        z: best.cz + CELL_D * 0.35,
        yaw: Math.PI
    });
    _lastToken = token;
    Shell.setView('fp');
    if (G.player?.teleport) {
        G.player.teleport(token.x, token.z, token.yaw);
    }
    G.ui?.banner?.(best.label || best.id, 'resumed from City Map');
    G.progress?.visitDistrict?.(best.id);
}

function enterMap() {
    ensureDom();
    _els.mapView.classList.remove('hidden');
    _els.mapView.setAttribute('aria-hidden', 'false');
    document.body.classList.add('sc-view-map');
    resizeMapCanvas();
    cancelAnimationFrame(_raf);
    drawMap();
    G.panelOpen = true;
    try { document.exitPointerLock?.(); } catch (_) { /* ignore */ }
}

function leaveMap() {
    if (_els.mapView) {
        _els.mapView.classList.add('hidden');
        _els.mapView.setAttribute('aria-hidden', 'true');
    }
    document.body.classList.remove('sc-view-map');
    cancelAnimationFrame(_raf);
    G.panelOpen = false;
}

export const Shell = {
    init() {
        if (!flagEnabled('viewToggle')) return;
        ensureDom();
        applyChrome(CityStore.getSnapshot());
        _unsub = CityStore.subscribe((patch, full) => {
            applyChrome(full);
            if (patch.view != null) {
                if (full.view === 'map') enterMap();
                else leaveMap();
            }
        });
        window.addEventListener('resize', () => {
            if (CityStore.getView() === 'map') resizeMapCanvas();
        });
        if (CityStore.getView() === 'map') enterMap();
        else leaveMap();

        // Capture-phase P so pointer-lock / other handlers cannot swallow the shortcut
        window.addEventListener('keydown', (e) => {
            if (e.code !== 'KeyP' || e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
            e.preventDefault();
            e.stopPropagation();
            this.goPixi();
        }, true);
    },

    setView(view) {
        if (!flagEnabled('viewToggle')) return;
        if (view !== 'fp' && view !== 'map') return;
        if (view === CityStore.getView()) return;

        CityStore.saveProgress();
        const extra = {};
        if (G.camera) {
            extra.x = G.camera.position.x;
            extra.z = G.camera.position.z;
            if (G.player?.yaw != null) extra.yaw = G.player.yaw;
        }
        if (G.inside?.id) extra.buildingId = G.inside.id;
        _lastToken = CityStore.captureResume(view, extra);
        CityStore.setView(view);

        try {
            const u = new URL(location.href);
            u.searchParams.set('view', view);
            history.replaceState(null, '', u.toString());
        } catch (_) { /* ignore */ }

        if (view === 'fp' && G.started) {
            G.ui?.addToast?.('First Person · click canvas to look', 'info');
        }
        if (view === 'map') {
            G.ui?.addToast?.('City Map · shared CityStore state', 'info');
        }
    },

    goPixi() {
        goPixi2D();
    },

    lastResumeToken() { return _lastToken; },

    dispose() {
        if (_unsub) _unsub();
        cancelAnimationFrame(_raf);
        leaveMap();
    }
};

if (typeof window !== 'undefined') window.Shell = Shell;





