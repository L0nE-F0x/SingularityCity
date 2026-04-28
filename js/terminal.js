/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (v4.0 — Phase 4: Visual Dashboard)
   A Bloomberg-inspired data dashboard that runs alongside the PixiJS pixel-art city. Same sim,
   no art. For users who want the data without the toy.

   Phase 4 changes:
     • Auto-boot only on explicit ?mode=terminal (no localStorage preference)
     • Comprehensive city-HUD hide list (Kardashev speedometer, reactions, zoom pill, scan log)
     • Fixed citizen count + K-scale data sources (NPCHousing.REGISTRY + Kardashev.score)
     • Fixed population panel data source
     • Default labs sort: ELO desc (apex first, obscure labs sink)
     • Dense 12×8 grid — 96 cells, no empty space
     • SVG chart primitives: sparkline, donut, pentagon radar, semicircular gauge
     • History ring buffers for time-series visualisations
     • Panels rebuilt with charts: donuts (POWER, COMPUTE, POPULATION), radar (KARDASHEV),
       gauge (AGENTS), sparklines (ROBOTICS, LONGEVITY, SUPPLY, AGENTS)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Terminal = {
    isOpen: false,
    _built: false,
    _pendingOpen: false,
    _loopTimer: null,
    _initialized: false,

    // Per-panel state
    _labsSort: { col: 'elo', dir: 'desc' },
    _sigCache: {},          // Panel-id → last-rendered signature (cheap change-detection)

    // Interactive filters (click a legend dot / row to highlight a slice; click again clears)
    _filter: { compute: null, power: null, population: null, labs: null, supply: null, kardashev: null },

    // Hover tooltip — single DOM node reused across every [data-tip] element
    _tip: null,

    // History ring buffers for sparklines (64 samples × 250ms = 16s window)
    _HISTORY_MAX: 64,
    _history: {
        supply_mw: [], demand_mw: [],
        dc_total_mw: [],
        robotics_units: [],
        longevity_compounds: [], longevity_trials: [], longevity_genomes: [],
        agents_active: [], agents_tasks: [], agents_errors: [],
        kardashev_score: [],
        supply_gpu: [], supply_hbm: []
    },

    _pushHistory(key, val) {
        const h = this._history[key];
        if (!h) return;
        h.push(val);
        if (h.length > this._HISTORY_MAX) h.shift();
    },

    _captureHistory() {
        try {
            if (typeof PowerZone !== 'undefined') {
                if (typeof PowerZone.getTotalSupply === 'function')
                    this._pushHistory('supply_mw', PowerZone.getTotalSupply() || 0);
                if (typeof PowerZone.getTotalDemand === 'function')
                    this._pushHistory('demand_mw', PowerZone.getTotalDemand() || 0);
            }
            if (typeof DC_FACILITIES !== 'undefined' && Array.isArray(DC_FACILITIES)) {
                const mw = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type !== 'chipfab')
                    .reduce((s, d) => s + (d.power_mw || 0), 0);
                this._pushHistory('dc_total_mw', mw);
            }
            if (typeof RoboticsZone !== 'undefined')
                this._pushHistory('robotics_units', RoboticsZone.unitsProduced || 0);
            if (typeof LongevityZone !== 'undefined') {
                this._pushHistory('longevity_compounds', LongevityZone.compoundsScreened || 0);
                this._pushHistory('longevity_trials', LongevityZone.trialsActive || 0);
                this._pushHistory('longevity_genomes', LongevityZone.genomesSequenced || 0);
            }
            if (typeof AgentsZone !== 'undefined' && AgentsZone.agentStats) {
                const s = AgentsZone.agentStats;
                this._pushHistory('agents_active', s.activeAgents || 0);
                this._pushHistory('agents_tasks', s.tasksPerHour || 0);
                this._pushHistory('agents_errors', s.errorRate || 0);
            }
            if (typeof Kardashev !== 'undefined') {
                const k = (typeof Kardashev.score === 'number') ? Kardashev.score
                        : (typeof Kardashev.currentLevel === 'function') ? Kardashev.currentLevel()
                        : (typeof Kardashev.level === 'number') ? Kardashev.level : 0;
                this._pushHistory('kardashev_score', k);
            }
            if (typeof SupplyChain !== 'undefined' && SupplyChain.inventory) {
                const inv = SupplyChain.inventory;
                const gpuStock = (inv.gpu_h100 && inv.gpu_h100.stock || 0) + (inv.gpu_b200 && inv.gpu_b200.stock || 0);
                this._pushHistory('supply_gpu', gpuStock);
                this._pushHistory('supply_hbm', (inv.hbm_memory && inv.hbm_memory.stock) || 0);
            }
        } catch (e) {}
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // INIT + LIFECYCLE
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    init() {
        if (this._initialized) return;
        this._initialized = true;

        // D hotkey — toggles terminal/city without stealing focus from form fields or modals
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.target && e.target.isContentEditable) return;
            if (e.key !== 'd' && e.key !== 'D') return;
            const ov = document.querySelector('.ov.open, .modal.open');
            if (ov) return;
            e.preventDefault();
            this.toggle();
        });

        // Defensive: strip any stale ?mode=terminal from the URL. Previously the URL
        // was pinned while Terminal was open, so closing the tab stranded the param
        // and auto-booted Terminal on every subsequent visit. We no longer auto-boot
        // from URL at all — the landing page ALWAYS shows so the user can choose.
        try {
            const p = new URLSearchParams(window.location.search);
            if (p.has('mode')) {
                p.delete('mode');
                const q = p.toString();
                const newUrl = window.location.pathname + (q ? '?' + q : '') + window.location.hash;
                window.history.replaceState(null, '', newUrl);
            }
        } catch (e) {}

        // Defensive: clear any stale preference key from the pre-Phase-4 version.
        try { localStorage.removeItem('sc_terminal_pref'); } catch (e) {}

        // No auto-bootstrap. Terminal opens only when the user clicks the landing
        // button or presses D after entering the city.
    },

    _autoBootstrap() {
        const tryBoot = () => {
            if (typeof enterCity === 'function') {
                const landing = document.getElementById('landing');
                if (landing && landing.classList.contains('exit')) return;
                enterCity();
            } else {
                setTimeout(tryBoot, 40);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(tryBoot, 0));
        } else {
            setTimeout(tryBoot, 0);
        }
    },

    tryAutoOpen() {
        if (this._pendingOpen) {
            this._pendingOpen = false;
            this.open();
        }
    },

    open() {
        if (this.isOpen) return;
        this.isOpen = true;
        document.body.classList.add('terminal-mode');
        this._buildShell();
        this._startUpdateLoop();
        // Mute SFX & ambient while in Terminal; soundtrack stays on.
        if (typeof SND !== 'undefined' && SND.setContextMute) SND.setContextMute(true);
        // NOTE: We no longer pin ?mode=terminal to the URL while Terminal is open.
        // Doing so used to mean that closing the tab stranded the param in the
        // address bar, and the next visit auto-booted Terminal before the user
        // could choose. The param is consumed once on init() and never re-emitted.
    },

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('terminal-mode');
        this._hideTip();
        if (typeof SND !== 'undefined' && SND.setContextMute) SND.setContextMute(false);
        // Defensive — strip ?mode=terminal if anything put it back.
        this._syncUrl(false);
    },

    toggle() { if (this.isOpen) this.close(); else this.open(); },

    _syncUrl(terminalOn) {
        try {
            const url = new URL(window.location.href);
            // We only ever clear the param now. Never set it.
            url.searchParams.delete('mode');
            window.history.replaceState(null, '', url);
        } catch (e) {}
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // SHELL — 12×8 grid, 96 cells, no empty space.
    // cols/rows per panel let us fill the grid exactly.
    //
    //   Row 1-2: [LABS 6×2]        [NEWS 3×2]     [EVENTS 3×2]
    //   Row 3-4: [ALIGN 3×2]       [EMBASSY 4×2]  [KARDASHEV 5×2]
    //   Row 5:   [COMPUTE 6×1]     [CAPITAL 6×1]
    //   Row 6-7: [POWER 4×2]       [SUPPLY 4×2]   [AGENTS 4×2]
    //   Row 8:   [POPULATION 4×1]  [ROBOTICS 4×1] [LONGEVITY 4×1]
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    PANELS: [
        { id: 'labs',       title: 'AI LABS',           cols: 6, rows: 2, live: true, hint: 'Sortable table — ELO, compute, valuation, flagship' },
        { id: 'news',       title: 'LIVE NEWS',         cols: 6, rows: 2, live: true, hint: 'Hacker News + tech headlines' },
        { id: 'alignment',  title: 'ALIGNMENT',         cols: 3, rows: 2, live: true, hint: 'Five orgs — focus, lead, location' },
        { id: 'embassy',    title: 'EMBASSY RELATIONS', cols: 4, rows: 2, live: true, hint: '6×6 bilateral matrix' },
        { id: 'kardashev',  title: 'KARDASHEV',         cols: 5, rows: 2, live: true, hint: 'K-scale + 5-pillar radar' },
        { id: 'compute',    title: 'COMPUTE INFRA',     cols: 6, rows: 1, live: true, hint: 'MW capacity · operator donut · trend' },
        { id: 'capital',    title: 'CAPITAL FLOWS',     cols: 6, rows: 1, live: true, hint: 'VC deal ticker' },
        { id: 'power',      title: 'POWER GRID',        cols: 4, rows: 2, live: true, hint: 'Source donut · demand trend' },
        { id: 'supply',     title: 'SUPPLY CHAIN',      cols: 4, rows: 2, live: true, hint: 'Inventory bars · bottlenecks' },
        { id: 'agents',     title: 'AGENTS',            cols: 4, rows: 2, live: true, hint: 'Active · error gauge · task trend' },
        { id: 'population', title: 'POPULATION',        cols: 4, rows: 1, live: true, hint: 'NPC count · workplace donut' },
        { id: 'robotics',   title: 'ROBOTICS',          cols: 4, rows: 1, live: true, hint: 'Units · capability curve' },
        { id: 'longevity',  title: 'LONGEVITY',         cols: 4, rows: 1, live: true, hint: 'Compound / trial / genome trends' }
    ],

    _buildShell() {
        if (this._built) return;
        this._built = true;
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        const tag = (p) => p.live
            ? '<span class="tm-panel-live"><span class="tm-live-dot"></span>LIVE</span>'
            : `<span class="tm-panel-tag">${p.phase || ''}</span>`;

        const body = (p) => p.live
            ? `<div class="tm-panel-body tm-body-${p.id}" id="tm-body-${p.id}"></div>`
            : `<div class="tm-panel-body"><div class="tm-placeholder"><div class="tm-placeholder-grid"></div><div class="tm-placeholder-hint">${p.hint}</div></div></div>`;

        const panelsHtml = this.PANELS.map(p => {
            const style = `grid-column: span ${p.cols}; grid-row: span ${p.rows};`;
            const infoTip = this._tipAttr(
                `<div class="tm-tip-hd">${this._esc(p.title)}</div>` +
                `<div class="tm-tip-body">${this._esc(p.hint || '')}</div>`
            );
            return `
                <div class="tm-panel${p.live ? ' tm-panel-live-on' : ''}" data-panel="${p.id}" style="${style}">
                    <div class="tm-panel-h">
                        <span class="tm-panel-title">${p.title}</span>
                        <span class="tm-panel-info" data-tip="${infoTip}">i</span>
                        ${tag(p)}
                    </div>
                    ${body(p)}
                </div>
            `;
        }).join('');

        shell.innerHTML = `
            <div class="tm-topbar">
                <div class="tm-logo">
                    <span class="tm-logo-dot"></span>
                    <span class="tm-logo-main">SINGULARITY</span>
                    <span class="tm-logo-suf">⟫ TERMINAL</span>
                </div>
                <div class="tm-status" id="tm-status">
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Sim tick</div><div class=&quot;tm-tip-body&quot;>60 ticks per in-game day. Advances while city runs behind shell.</div>')}"><span class="tm-lbl">TICK</span><span class="tm-val" id="tm-tick">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Citizens</div><div class=&quot;tm-tip-body&quot;>Total NPCs in housing registry. Each has a home, workplace, and schedule.</div>')}"><span class="tm-lbl">CITIZENS</span><span class="tm-val" id="tm-citizens">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Buildings</div><div class=&quot;tm-tip-body&quot;>All structures placed across city + space zones.</div>')}"><span class="tm-lbl">BLDS</span><span class="tm-val" id="tm-buildings">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Kardashev score</div><div class=&quot;tm-tip-body&quot;>Civilizational energy-mastery index. Earth today ≈ 0.73. K = 1.0 is Type I.</div>')}"><span class="tm-lbl">K-SCALE</span><span class="tm-val" id="tm-kardashev">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Frames per second</div><div class=&quot;tm-tip-body&quot;>Pixi renderer FPS — sim still runs even when terminal is showing.</div>')}"><span class="tm-lbl">FPS</span><span class="tm-val" id="tm-fps">—</span></span>
                    <span class="tm-stat" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Wall clock</div><div class=&quot;tm-tip-body&quot;>Real-world UTC time.</div>')}"><span class="tm-lbl">UTC</span><span class="tm-val" id="tm-clock">—</span></span>
                </div>
                <div class="tm-topbar-right">
                    <button class="tm-cta-btn" onclick="Terminal.close()" title="Switch to pixel-art city view (D)">▶ ENTER CITY</button>
                </div>
            </div>
            <div class="tm-grid">${panelsHtml}</div>
            <div class="tm-footer">
                <span class="tm-foot-chunk"><kbd>D</kbd> toggle city / terminal</span>
                <span class="tm-foot-chunk tm-foot-mid">PHASE 4 · 13 panels · charts live · sim running behind shell</span>
                <span class="tm-foot-chunk" id="tm-version">—</span>
            </div>
        `;

        // Version badge
        const v = document.getElementById('tm-version');
        if (v) {
            const ver = (typeof G !== 'undefined' && G.VERSION) ? G.VERSION : '';
            v.textContent = ver ? ('v' + ver) : '';
        }

        this._bindInteractions();
        this._renderAlignment(); // Static — rendered once on build
    },

    _bindInteractions() {
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        // ── Click: labs header sort + data-action dispatch ──
        shell.addEventListener('click', (e) => {
            const th = e.target.closest('th[data-col]');
            if (th) {
                const col = th.dataset.col;
                if (this._labsSort.col === col) {
                    this._labsSort.dir = this._labsSort.dir === 'asc' ? 'desc' : 'asc';
                } else {
                    this._labsSort.col = col;
                    this._labsSort.dir = (col === 'name' || col === 'region') ? 'asc' : 'desc';
                }
                this._sigCache.labs = null;
                this._renderLabs();
                return;
            }
            const actEl = e.target.closest('[data-action]');
            if (actEl) {
                // Don't hijack real anchor links — let the browser follow them.
                const a = e.target.closest('a[href]');
                if (a && a.getAttribute('href')) return;
                e.preventDefault();
                this._onAction(actEl.getAttribute('data-action'));
            }
        });

        // ── Hover: delegated tooltip via [data-tip] ──
        shell.addEventListener('pointermove', (e) => {
            const tipEl = e.target.closest && e.target.closest('[data-tip]');
            if (!tipEl) { this._hideTip(); return; }
            this._showTip(tipEl.getAttribute('data-tip'), e.clientX, e.clientY);
        });
        shell.addEventListener('pointerleave', () => this._hideTip());
        // Hide on scroll — prevents stale tooltip when the grid scrolls
        shell.addEventListener('scroll', () => this._hideTip(), true);
        // Global safety: hide if terminal closes
        window.addEventListener('blur', () => this._hideTip());
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // SVG CHART PRIMITIVES
    // All helpers return an inline SVG string ready to drop into innerHTML.
    // No dependencies, CSS-stylable, scales cleanly.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _svgSpark(vals, opts = {}) {
        const w = opts.w || 120;
        const h = opts.h || 32;
        const color = opts.color || '#22d3ee';
        const fill = opts.fill !== false;
        if (!vals || vals.length < 2) {
            return `<svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"><text x="${w/2}" y="${h/2}" text-anchor="middle" class="tm-spark-empty">—</text></svg>`;
        }
        const min = Math.min(...vals);
        const max = Math.max(...vals);
        const range = (max - min) || Math.abs(max) || 1;
        const stepX = w / (vals.length - 1);
        const y = (v) => h - ((v - min) / range) * (h - 6) - 3;
        const points = vals.map((v, i) => `${(i * stepX).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
        const areaPoints = `0,${h} ${points} ${w},${h}`;
        const lastX = (vals.length - 1) * stepX;
        const lastY = y(vals[vals.length - 1]);
        return `
            <svg class="tm-spark" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">
                ${fill ? `<polygon points="${areaPoints}" fill="${color}" opacity="0.14"/>` : ''}
                <polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
                <circle cx="${lastX.toFixed(1)}" cy="${lastY.toFixed(1)}" r="2.2" fill="${color}" style="filter:drop-shadow(0 0 3px ${color})"/>
            </svg>
        `;
    },

    _svgDonut(segments, opts = {}) {
        const size = opts.size || 80;
        const thick = opts.thick || 12;
        const cx = size / 2, cy = size / 2;
        const r = (size - thick) / 2 - 1;
        const c = 2 * Math.PI * r;
        const total = segments.reduce((s, x) => s + (x.value || 0), 0);
        if (total <= 0) {
            return `<svg class="tm-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#14142a" stroke-width="${thick}"/>
            </svg>`;
        }
        let offset = 0;
        const parts = segments.map(seg => {
            const frac = (seg.value || 0) / total;
            const dash = frac * c;
            if (dash <= 0.01) return '';
            const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none"
                stroke="${seg.color || '#8a8aa0'}" stroke-width="${thick}"
                stroke-dasharray="${dash.toFixed(2)} ${(c - dash).toFixed(2)}"
                stroke-dashoffset="${(-offset).toFixed(2)}"
                transform="rotate(-90 ${cx} ${cy})"/>`;
            offset += dash;
            return el;
        }).join('');
        const center = opts.center || '';
        const centerSub = opts.centerSub || '';
        return `
            <svg class="tm-donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#14142a" stroke-width="${thick}"/>
                ${parts}
                ${center ? `<text x="${cx}" y="${cy + 1}" text-anchor="middle" class="tm-donut-c">${center}</text>` : ''}
                ${centerSub ? `<text x="${cx}" y="${cy + 12}" text-anchor="middle" class="tm-donut-cs">${centerSub}</text>` : ''}
            </svg>
        `;
    },

    _svgRadar(values, opts = {}) {
        const size = opts.size || 140;
        const cx = size / 2, cy = size / 2;
        const pad = opts.pad || 18;
        const r = size / 2 - pad;
        const n = values.length || 1;
        if (n < 3) {
            return `<svg class="tm-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}"></svg>`;
        }
        const axisPts = [];
        const ringPts = [[], [], [], []];
        const dataPts = [];
        for (let i = 0; i < n; i++) {
            const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
            const cosA = Math.cos(a), sinA = Math.sin(a);
            axisPts.push({
                x: cx + cosA * r, y: cy + sinA * r,
                lx: cx + cosA * (r + 11), ly: cy + sinA * (r + 11),
                label: values[i].label || ''
            });
            const v = Math.max(0, Math.min(1, values[i].value || 0));
            dataPts.push({ x: cx + cosA * r * v, y: cy + sinA * r * v });
            [0.25, 0.5, 0.75, 1.0].forEach((k, ki) => {
                ringPts[ki].push(`${(cx + cosA * r * k).toFixed(1)},${(cy + sinA * r * k).toFixed(1)}`);
            });
        }
        const rings = ringPts.map((pts, i) => {
            const alpha = 0.06 + i * 0.03;
            return `<polygon points="${pts.join(' ')}" fill="none" stroke="rgba(138,138,160,${alpha})" stroke-width="0.7"/>`;
        }).join('');
        const axes = axisPts.map(p =>
            `<line x1="${cx}" y1="${cy}" x2="${p.x.toFixed(1)}" y2="${p.y.toFixed(1)}" stroke="rgba(138,138,160,0.12)" stroke-width="0.7"/>`
        ).join('');
        const labels = axisPts.map(p =>
            `<text x="${p.lx.toFixed(1)}" y="${p.ly.toFixed(1)}" text-anchor="middle" dominant-baseline="middle" class="tm-radar-lbl">${p.label}</text>`
        ).join('');
        const polyPts = dataPts.map(p => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
        const poly = `<polygon points="${polyPts}" fill="rgba(34,211,238,0.22)" stroke="#22d3ee" stroke-width="1.4" style="filter:drop-shadow(0 0 4px rgba(34,211,238,0.4))"/>`;
        const dots = dataPts.map(p =>
            `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="2.2" fill="#22d3ee"/>`
        ).join('');
        return `
            <svg class="tm-radar" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
                ${rings}${axes}${poly}${dots}${labels}
            </svg>
        `;
    },

    _svgGauge(value, opts = {}) {
        const w = opts.w || 120;
        const h = opts.h || 72;
        const cx = w / 2;
        const cy = h - 10;
        const r = Math.min(w / 2 - 10, h - 18);
        const v = Math.max(0, Math.min(1, value));
        const pt = (a) => ({
            x: cx + Math.cos(a) * r,
            y: cy - Math.sin(a) * r
        });
        const start = pt(Math.PI);   // left
        const end = pt(0);            // right
        const valPt = pt(Math.PI * (1 - v));
        const trackPath = `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${end.x.toFixed(1)} ${end.y.toFixed(1)}`;
        const fillPath = v > 0.001
            ? `M ${start.x.toFixed(1)} ${start.y.toFixed(1)} A ${r} ${r} 0 0 1 ${valPt.x.toFixed(1)} ${valPt.y.toFixed(1)}`
            : '';
        const color = opts.color || (v < 0.33 ? '#34d399' : v < 0.66 ? '#fbbf24' : '#f87171');
        const label = opts.label || '';
        const sub = opts.sub || '';
        return `
            <svg class="tm-gauge" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
                <path d="${trackPath}" fill="none" stroke="#14142a" stroke-width="9" stroke-linecap="round"/>
                ${fillPath ? `<path d="${fillPath}" fill="none" stroke="${color}" stroke-width="9" stroke-linecap="round" style="filter:drop-shadow(0 0 4px ${color})"/>` : ''}
                ${label ? `<text x="${cx}" y="${cy - 8}" text-anchor="middle" class="tm-gauge-v" fill="${color}">${label}</text>` : ''}
                ${sub ? `<text x="${cx}" y="${cy + 4}" text-anchor="middle" class="tm-gauge-s">${sub}</text>` : ''}
            </svg>
        `;
    },

    // Stacked horizontal bar — [{label, value, color}]
    _svgStackBar(segments, opts = {}) {
        const w = opts.w || 240;
        const h = opts.h || 14;
        const total = segments.reduce((s, x) => s + (x.value || 0), 0) || 1;
        let off = 0;
        const parts = segments.map(seg => {
            const width = (seg.value || 0) / total * w;
            const rect = `<rect x="${off.toFixed(1)}" y="0" width="${width.toFixed(1)}" height="${h}" fill="${seg.color || '#8a8aa0'}"/>`;
            off += width;
            return rect;
        }).join('');
        return `<svg class="tm-stackbar" width="100%" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none">${parts}</svg>`;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // TOOLTIP + ACTION SYSTEM
    // Any element with `data-tip="..."` gets a Bloomberg-amber hover tooltip.
    // Any element with `data-action="kind:arg"` fires _onAction on click (cursor:pointer via CSS).
    // Tooltip HTML is already HTML-safe when composed — we only attribute-escape the quotes.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _esc(s) {
        return String(s == null ? '' : s).replace(/[<>&"']/g, c =>
            ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
    },

    // Attribute-safe encoding for composed tooltip HTML (content is assumed already HTML-safe).
    _tipAttr(html) {
        return String(html == null ? '' : html).replace(/"/g, '&quot;');
    },

    _ensureTooltip() {
        if (this._tip && document.body.contains(this._tip)) return this._tip;
        const t = document.createElement('div');
        t.className = 'tm-tooltip';
        t.style.display = 'none';
        document.body.appendChild(t);
        this._tip = t;
        return t;
    },

    _showTip(html, x, y) {
        if (!html) { this._hideTip(); return; }
        const t = this._ensureTooltip();
        t.innerHTML = html;
        t.style.display = 'block';
        // Measure after reflow for edge-aware placement
        t.style.left = '-9999px';
        t.style.top = '0px';
        const r = t.getBoundingClientRect();
        const vw = window.innerWidth, vh = window.innerHeight;
        let left = x + 14, top = y + 16;
        if (left + r.width > vw - 8)  left = x - r.width - 14;
        if (top  + r.height > vh - 8) top  = y - r.height - 14;
        if (left < 4) left = 4;
        if (top  < 4) top  = 4;
        t.style.left = left + 'px';
        t.style.top  = top + 'px';
    },

    _hideTip() {
        if (this._tip) this._tip.style.display = 'none';
    },

    // Delegated click handler for data-action elements.
    // Format: "kind:arg" — kind ∈ { labs, event, align, filter, embassy, pillar, news, deal }.
    _onAction(raw) {
        if (!raw) return;
        const idx = raw.indexOf(':');
        const kind = idx < 0 ? raw : raw.slice(0, idx);
        const arg  = idx < 0 ? ''  : raw.slice(idx + 1);

        switch (kind) {
            case 'labs': {
                // Toggle label filter on labs table
                this._filter.labs = (this._filter.labs === arg) ? null : arg;
                this._sigCache.labs = null;
                this._renderLabs();
                break;
            }
            case 'filter': {
                // arg = "panel:key" — toggle highlight for a donut/legend segment
                const sep = arg.indexOf(':');
                if (sep < 0) return;
                const panel = arg.slice(0, sep);
                const key   = arg.slice(sep + 1);
                if (!this._filter) this._filter = {};
                this._filter[panel] = (this._filter[panel] === key) ? null : key;
                this._sigCache[panel] = null;  // force re-render
                // Also re-render immediately if the panel has a render method
                const fn = this['_render' + panel.charAt(0).toUpperCase() + panel.slice(1)];
                if (typeof fn === 'function') fn.call(this);
                break;
            }
            case 'embassy': {
                // arg = "a_b" — toggle bilateral focus
                this._filter.embassy = (this._filter.embassy === arg) ? null : arg;
                this._sigCache.embassy = null;
                this._renderEmbassy();
                break;
            }
            case 'pillar': {
                this._filter.kardashev = (this._filter.kardashev === arg) ? null : arg;
                this._sigCache.kardashev = null;
                this._renderKardashev();
                break;
            }
            // labs-row, align, event: extensibility hooks — reserved but not routed yet
            default: break;
        }
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // UPDATE LOOP — 4 Hz
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _startUpdateLoop() {
        if (this._loopTimer) return;
        const tick = () => {
            if (!this.isOpen) return;
            this._captureHistory();
            this._refresh();
        };
        this._loopTimer = setInterval(tick, 250);
        tick();
    },

    _refresh() {
        this._refreshTopBar();
        this._renderLabs();
        this._renderNews();
        // Alignment is static — rendered once on build
        this._renderCompute();
        this._renderCapital();
        this._renderEmbassy();
        this._renderPower();
        this._renderRobotics();
        this._renderLongevity();
        this._renderAgents();
        this._renderSupply();
        this._renderKardashev();
        this._renderPopulation();
    },

    _refreshTopBar() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && el.textContent !== val) el.textContent = val;
        };
        const G_ = (typeof G !== 'undefined') ? G : null;

        set('tm-tick', G_ ? String(G_.tick || 0) : '—');

        // FIX: citizens from NPCHousing.REGISTRY (authoritative) not G.agents/G.humans
        let citizens = '—';
        try {
            if (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) {
                citizens = NPCHousing.REGISTRY.length.toLocaleString();
            }
        } catch (e) {}
        set('tm-citizens', citizens);

        set('tm-buildings', (typeof BLDS !== 'undefined') ? BLDS.length.toLocaleString() : '—');

        // FIX: K-scale reads Kardashev.score first (the actual live field)
        let kscale = '—';
        try {
            if (typeof Kardashev !== 'undefined') {
                if (typeof Kardashev.score === 'number') kscale = Kardashev.score.toFixed(3);
                else if (typeof Kardashev.currentLevel === 'function') kscale = Kardashev.currentLevel().toFixed(3);
                else if (typeof Kardashev.level === 'number') kscale = Kardashev.level.toFixed(3);
            }
        } catch (e) {}
        set('tm-kardashev', kscale);

        let fps = '—';
        try { if (G_ && G_.app && G_.app.ticker) fps = G_.app.ticker.FPS.toFixed(0); } catch (e) {}
        set('tm-fps', fps);

        set('tm-clock', new Date().toISOString().substr(11, 8) + ' UTC');
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · AI LABS — sortable table, default ELO desc
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _computeLabRows() {
        const rows = [];
        if (typeof LABS === 'undefined' || typeof G === 'undefined' || !Array.isArray(G.models)) return rows;
        const BM_ = (typeof BM !== 'undefined') ? BM : {};

        Object.keys(LABS).forEach(labId => {
            const lab = LABS[labId];
            if (!lab) return;
            const models = G.models.filter(m => m.lab === labId);
            if (!models.length && labId !== 'other') return;

            let scoreSum = 0, scoreN = 0;
            let topElo = null, flagshipName = null;
            for (const m of models) {
                const b = BM_[m.id];
                if (!b) continue;
                const vals = [b.MMLU, b.HumanEval, b.MATH, b.GPQA].filter(v => typeof v === 'number');
                if (vals.length) {
                    const avg = vals.reduce((a, x) => a + x, 0) / vals.length;
                    scoreSum += avg; scoreN++;
                }
                if (typeof b.ELO === 'number') {
                    if (topElo === null || b.ELO > topElo) {
                        topElo = b.ELO;
                        flagshipName = m.name || m.id;
                    }
                }
            }
            const avgScore = scoreN ? (scoreSum / scoreN) : null;

            const hq = (G.bldById && G.bldById['bld_' + labId]) || null;
            const isApex = !!(hq && hq.isTopLab);

            rows.push({
                id: labId,
                name: lab.name || labId,
                color: lab.color || '#8a8aa0',
                region: (lab.region || '?').toUpperCase(),
                models: models.length,
                score: avgScore,
                flagship: flagshipName,
                elo: topElo,
                apex: isApex
            });
        });
        return rows;
    },

    _sortLabRows(rows) {
        const { col, dir } = this._labsSort;
        const mul = (dir === 'asc') ? 1 : -1;
        const get = (r) => {
            switch (col) {
                case 'name':     return (r.name || '').toLowerCase();
                case 'region':   return r.region || '';
                case 'models':   return r.models || 0;
                case 'score':    return r.score == null ? -1 : r.score;
                case 'elo':      return r.elo == null ? -1 : r.elo;
                case 'flagship': return (r.flagship || '').toLowerCase();
                default:         return 0;
            }
        };
        return rows.slice().sort((a, b) => {
            // Primary: selected column
            const av = get(a), bv = get(b);
            if (av < bv) return -1 * mul;
            if (av > bv) return 1 * mul;
            // Secondary tiebreak: apex always wins
            if (a.apex !== b.apex) return a.apex ? -1 : 1;
            // Tertiary: ELO desc (labs with ELO rank above those without)
            const ae = a.elo == null ? -1 : a.elo;
            const be = b.elo == null ? -1 : b.elo;
            return be - ae;
        });
    },

    _renderLabs() {
        const host = document.getElementById('tm-body-labs');
        if (!host) return;
        const rows = this._computeLabRows();
        const sortedAll = this._sortLabRows(rows);
        // Apply region filter if active
        const regionFilter = this._filter.labs;
        const sorted = regionFilter ? sortedAll.filter(r => r.region === regionFilter) : sortedAll;

        const sig = this._labsSort.col + ':' + this._labsSort.dir + ':' + (regionFilter || '') + ':' + sorted.length + ':' +
                    sorted.slice(0, 6).map(r => r.id + (r.score || 0).toFixed(1) + (r.elo || 0)).join('|');
        if (this._sigCache.labs === sig) return;
        this._sigCache.labs = sig;

        if (!sortedAll.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for model data…</div>';
            return;
        }

        const arrow = (c) => this._labsSort.col !== c ? '' : (this._labsSort.dir === 'asc' ? ' ▴' : ' ▾');
        const fmtScore = (s) => s == null ? '—' : s.toFixed(0);
        const fmtElo   = (e) => e == null ? '—' : e.toFixed(0);
        const esc = (s) => this._esc(s);

        // Header column tooltips explain what each column shows
        const thTip = {
            name:     'Lab name. Click to sort A→Z / Z→A.',
            region:   'HQ region. US · EU · CN · UK · IN · AE. Click a pill in a row to filter.',
            models:   'Total shipped models tracked in this sim.',
            score:    'Average benchmark score across MMLU · HumanEval · MATH · GPQA.',
            flagship: 'Top ELO model from this lab.',
            elo:      'LMArena-style head-to-head ELO of the lab\'s top model.'
        };
        const thTipAttr = (c) => this._tipAttr(
            `<div class="tm-tip-hd">${esc(c.toUpperCase())}</div>` +
            `<div class="tm-tip-body">${esc(thTip[c] || '')}</div>` +
            `<div class="tm-tip-foot">click to sort · click again to reverse</div>`
        );

        const body = sorted.map((r, i) => {
            const regionLbl = { US:'United States', EU:'Europe', CN:'China', UK:'United Kingdom', IN:'India', AE:'UAE' }[r.region] || r.region;
            const rowTip = this._tipAttr(
                `<div class="tm-tip-hd" style="color:${esc(r.color)}">${esc(r.name)}${r.apex ? ' <span class="tm-tip-crown">♕</span>' : ''}</div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Region</span><b>${esc(regionLbl)}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Models</span><b>${r.models}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Avg score</span><b>${fmtScore(r.score)}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Flagship</span><b>${esc(r.flagship || '—')}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Top ELO</span><b style="color:#22d3ee">${fmtElo(r.elo)}</b></div>` +
                (r.apex ? `<div class="tm-tip-foot">Apex lab — currently holds a benchmark crown</div>` : '')
            );
            const regionTip = this._tipAttr(
                `<div class="tm-tip-hd">${esc(r.region)}</div>` +
                `<div class="tm-tip-body">Click to filter labs by <b>${esc(regionLbl)}</b></div>`
            );
            return `
                <tr data-tip="${rowTip}">
                    <td class="tm-rank">${i + 1}</td>
                    <td class="tm-lab-name">
                        <span class="tm-lab-dot" style="background:${r.color}"></span>
                        ${esc(r.name)}
                        ${r.apex ? '<span class="tm-apex" data-tip="' + this._tipAttr('<b>Apex lab</b><br/>Holds a benchmark crown') + '">♕</span>' : ''}
                    </td>
                    <td class="tm-region tm-region-${r.region.toLowerCase()} tm-clickable" data-action="labs:${esc(r.region)}" data-tip="${regionTip}">${esc(r.region)}</td>
                    <td class="tm-num">${r.models}</td>
                    <td class="tm-num">${fmtScore(r.score)}</td>
                    <td class="tm-flagship">${esc(r.flagship || '—')}</td>
                    <td class="tm-num tm-elo">${fmtElo(r.elo)}</td>
                </tr>
            `;
        }).join('');

        const filterBadge = regionFilter
            ? `<div class="tm-filter-badge" data-action="labs:${esc(regionFilter)}" data-tip="${this._tipAttr('Click to clear region filter')}">FILTER · ${esc(regionFilter)} <span class="tm-filter-x">×</span></div>`
            : '';

        host.innerHTML = `
            ${filterBadge}
            <div class="tm-scroll">
                <table class="tm-table tm-labs-table">
                    <thead>
                        <tr>
                            <th class="tm-rank">#</th>
                            <th data-col="name"     data-tip="${thTipAttr('name')}">LAB${arrow('name')}</th>
                            <th data-col="region"   data-tip="${thTipAttr('region')}">REG${arrow('region')}</th>
                            <th data-col="models"   class="tm-num" data-tip="${thTipAttr('models')}">MODELS${arrow('models')}</th>
                            <th data-col="score"    class="tm-num" data-tip="${thTipAttr('score')}">AVG${arrow('score')}</th>
                            <th data-col="flagship" data-tip="${thTipAttr('flagship')}">FLAGSHIP${arrow('flagship')}</th>
                            <th data-col="elo"      class="tm-num" data-tip="${thTipAttr('elo')}">ELO${arrow('elo')}</th>
                        </tr>
                    </thead>
                    <tbody>${body}</tbody>
                </table>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ALIGNMENT ORGS — static cards
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderAlignment() {
        const host = document.getElementById('tm-body-alignment');
        if (!host) return;
        if (typeof AlignmentForest === 'undefined' || !Array.isArray(AlignmentForest.BLDS)) {
            host.innerHTML = '<div class="tm-empty">Alignment data unavailable</div>';
            return;
        }
        const esc = (s) => this._esc(s);
        const hex = (n) => '#' + (typeof n === 'number' ? n.toString(16).padStart(6, '0') : '8a8aa0');

        host.innerHTML = `
            <div class="tm-align-grid tm-scroll">
                ${AlignmentForest.BLDS.map(o => {
                    const color = hex(o.shield);
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd" style="color:${esc(color)}">${esc(o.name)}</div>` +
                        `<div class="tm-tip-body">${esc(o.focus || '')}</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Lead</span><b>${esc(o.lead || '—')}</b></div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Founded</span><b>${esc(o.founded || '—')}</b></div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Location</span><b>${esc(o.location || '—')}</b></div>` +
                        `<div class="tm-tip-foot">AI safety organization — Alignment Forest</div>`
                    );
                    return `
                        <div class="tm-align-card" style="border-left-color:${color}" data-tip="${tip}">
                            <div class="tm-align-top">
                                <span class="tm-align-name" style="color:${color}">${esc(o.name)}</span>
                                <span class="tm-align-year">${esc(o.founded || '')}</span>
                            </div>
                            <div class="tm-align-focus">${esc(o.focus || '')}</div>
                            <div class="tm-align-meta">
                                <span class="tm-align-lead">${esc(o.lead || '')}</span>
                            </div>
                            <div class="tm-align-loc">📍 ${esc(o.location || '')}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · LIVE NEWS
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _collectNewsItems() {
        const items = [];
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories)) {
            for (const s of HNBlimps._stories) {
                if (!s || !s.title) continue;
                items.push({ source: 'HN', title: s.title, url: s.url, score: s.score, comments: s.descendants });
            }
        }
        if (typeof API !== 'undefined' && Array.isArray(API.liveNews)) {
            for (const n of API.liveNews) {
                if (!n) continue;
                items.push({
                    source: (n.source || 'NEWS').toUpperCase().replace(/\s+/g, ''),
                    title: n.headline || n.title,
                    url: n.url
                });
            }
        }
        return items;
    },

    _renderNews() {
        const host = document.getElementById('tm-body-news');
        if (!host) return;
        const items = this._collectNewsItems();
        const sig = 'n:' + items.length + ':' + (items[0] ? (items[0].title || '').slice(0, 40) : '');
        if (this._sigCache.news === sig) return;
        this._sigCache.news = sig;

        if (!items.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for headlines…</div>';
            return;
        }
        const esc = (s) => this._esc(s);
        const MAX = 24;

        host.innerHTML = `
            <div class="tm-scroll tm-news-list">
                ${items.slice(0, MAX).map(n => {
                    const url = n.url ? ` href="${esc(n.url)}" target="_blank" rel="noopener"` : '';
                    const tag = n.source === 'HN' ? 'tm-tag-hn' : 'tm-tag-news';
                    const isHN = n.source === 'HN';
                    const scoreBlock = (isHN && typeof n.score === 'number')
                        ? `<span class="tm-news-score">▲ ${n.score}</span>` : '';
                    const itemTip = this._tipAttr(
                        `<div class="tm-tip-hd">${esc(n.source)}</div>` +
                        `<div class="tm-tip-body">${esc(n.title)}</div>` +
                        (isHN && typeof n.score === 'number'
                            ? `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b>▲ ${n.score}</b></div>` +
                              `<div class="tm-tip-row"><span class="tm-tip-k">Comments</span><b>${n.comments || 0}</b></div>`
                            : '') +
                        (n.url ? `<div class="tm-tip-foot">Click to open in new tab ↗</div>` : '')
                    );
                    const srcTip = this._tipAttr(
                        `<div class="tm-tip-hd">${esc(n.source)}</div>` +
                        `<div class="tm-tip-body">${isHN ? 'Hacker News — ranked by upvotes' : 'Live tech news feed'}</div>`
                    );
                    return `
                        <div class="tm-news-item" data-tip="${itemTip}">
                            <span class="tm-news-source ${tag}" data-tip="${srcTip}">${esc(n.source)}</span>
                            <a class="tm-news-title"${url}>${esc(n.title)}</a>
                            ${scoreBlock}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ACTIVITY STREAM (was EVENTS LOG)
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderEvents() {
        const host = document.getElementById('tm-body-events');
        if (!host) return;
        const log = (typeof UI !== 'undefined' && Array.isArray(UI.scanLog)) ? UI.scanLog : [];
        const sig = 'e:' + log.length + ':' + (log[0] ? ((log[0].t || '') + (log[0].msg || '').slice(0, 24)) : '');
        if (this._sigCache.events === sig) return;
        this._sigCache.events = sig;

        if (!log.length) {
            host.innerHTML = '<div class="tm-empty">No events yet</div>';
            return;
        }
        const classify = (msg) => {
            const s = String(msg || '');
            if (/^🚀|^🛰️/.test(s))                        return 'launch';
            if (/^💰|^💼/.test(s))                         return 'deal';
            if (/^🏆|^👑/.test(s))                          return 'trophy';
            if (/^🏗️|^🧬/.test(s))                         return 'build';
            if (/^⚖️|^🏛️/.test(s))                         return 'policy';
            if (/^✨|^☄️|^🌙|^🏜️/.test(s))                  return 'env';
            if (/^📊|^👻/.test(s))                          return 'model';
            return 'other';
        };
        const catLabel = {
            launch: 'Launch event',
            deal:   'Capital / business',
            trophy: 'Benchmark trophy',
            build:  'Construction / biotech',
            policy: 'Regulatory / court',
            env:    'Environmental',
            model:  'Model shipment',
            other:  'Sim event'
        };
        const esc = (s) => this._esc(s);

        host.innerHTML = `
            <div class="tm-scroll tm-events-list">
                ${log.slice(0, 30).map(e => {
                    const cat = classify(e.msg);
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd tm-tip-hd-${cat}">${esc(catLabel[cat])}</div>` +
                        `<div class="tm-tip-body">${esc(e.msg || '')}</div>` +
                        `<div class="tm-tip-foot">${esc(e.t || '')} — activity stream</div>`
                    );
                    return `
                        <div class="tm-event-item tm-ev-${cat}" data-tip="${tip}">
                            <span class="tm-event-time">${esc(e.t || '')}</span>
                            <span class="tm-event-msg">${e.msg || ''}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · COMPUTE INFRA (6×1) — big MW · operator donut · MW trend sparkline · mini stats
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderCompute() {
        const host = document.getElementById('tm-body-compute');
        if (!host) return;
        if (typeof DC_FACILITIES === 'undefined' || !Array.isArray(DC_FACILITIES)) {
            host.innerHTML = '<div class="tm-empty">Compute data unavailable</div>';
            return;
        }

        const op = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type !== 'chipfab');
        const fabs = DC_FACILITIES.filter(d => d && d.status === 'operational' && d.type === 'chipfab');
        const totalMW = op.reduce((s, d) => s + (d.power_mw || 0), 0);
        const construction = DC_FACILITIES.filter(d => d && d.status === 'construction').length;

        // Operator aggregation (top 5 by MW)
        const byOp = {};
        op.forEach(d => {
            const o = d.operator || d.name || 'other';
            byOp[o] = (byOp[o] || 0) + (d.power_mw || 0);
        });
        const opColors = ['#22d3ee', '#fbbf24', '#a78bfa', '#34d399', '#fb923c', '#f472b6'];
        const topOps = Object.entries(byOp).sort((a, b) => b[1] - a[1]).slice(0, 5);
        const otherMW = Object.entries(byOp).sort((a, b) => b[1] - a[1]).slice(5).reduce((s, [,v]) => s + v, 0);
        const segments = topOps.map(([name, mw], i) => ({ label: name, value: mw, color: opColors[i] }));
        if (otherMW > 0) segments.push({ label: 'other', value: otherMW, color: '#4a4a5a' });

        const hist = this._history.dc_total_mw;
        const lastMW = hist[hist.length - 1] || 0;
        const focusOp = this._filter.compute;
        const sig = 'c:' + op.length + ':' + totalMW + ':' + fabs.length + ':' + construction + ':' + lastMW + ':' + (hist.length || 0) + ':' + (focusOp || '');
        if (this._sigCache.compute === sig) return;
        this._sigCache.compute = sig;

        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + ' GW' : Math.round(n).toLocaleString() + ' MW';
        const esc = (s) => this._esc(s);
        const pct = (v) => totalMW > 0 ? ((v / totalMW) * 100).toFixed(1) + '%' : '—';

        // Apply filter: dim segments that aren't the focused operator
        const dimmed = segments.map(s => focusOp && s.label !== focusOp
            ? { ...s, color: '#2a2a3a' }
            : s);

        // Sparkline delta
        const firstMW = hist[0] || 0;
        const deltaMW = lastMW - firstMW;
        const deltaTxt = (deltaMW >= 0 ? '+' : '') + Math.round(deltaMW) + ' MW (16s)';
        const deltaCls = deltaMW > 0 ? 'tm-tip-good' : deltaMW < 0 ? 'tm-tip-bad' : 'tm-tip-muted';

        const heroTip = this._tipAttr(
            `<div class="tm-tip-hd">Compute capacity</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Total</span><b>${fmtMW(totalMW)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Datacenters</span><b>${op.length}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Chip fabs</span><b>${fabs.length}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Under build</span><b>${construction}</b></div>`
        );
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Operator share</div>` +
            `<div class="tm-tip-body">${segments.length} operators · click legend dot to focus</div>`
        );
        const sparkTip = this._tipAttr(
            `<div class="tm-tip-hd">MW trend (16s)</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${fmtMW(lastMW)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span><b class="${deltaCls}">${deltaTxt}</b></div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout">
                <div class="tm-col tm-col-stat" data-tip="${heroTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${(totalMW >= 1000 ? (totalMW/1000).toFixed(1) : Math.round(totalMW).toLocaleString())}</span>
                        <span class="tm-stat-unit">${totalMW >= 1000 ? 'GW' : 'MW'}</span>
                    </div>
                    <div class="tm-ministats">
                        <span data-tip="${this._tipAttr('<b>' + op.length + '</b> operational datacenters')}"><b>${op.length}</b> DCs</span>
                        <span data-tip="${this._tipAttr('<b>' + fabs.length + '</b> operational chip fabs')}"><b>${fabs.length}</b> fabs</span>
                        <span data-tip="${this._tipAttr('<b>' + construction + '</b> sites under construction')}"><b>${construction}</b> build</span>
                    </div>
                </div>
                <div class="tm-col tm-col-donut" data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, { size: 88, thick: 13, center: fmtMW(totalMW) })}
                    <div class="tm-donut-legend">
                        ${segments.slice(0, 4).map(s => {
                            const active = focusOp === s.label;
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd" style="color:${esc(s.color)}">${esc(s.label)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Capacity</span><b>${fmtMW(s.value)}</b></div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${pct(s.value)}</b></div>` +
                                `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} operator</div>`
                            );
                            return `
                                <div class="tm-legend-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:compute:${esc(s.label)}" data-tip="${tip}">
                                    <span class="tm-legend-dot" style="background:${s.color}"></span>
                                    <span class="tm-legend-lbl">${esc(s.label)}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
                <div class="tm-col tm-col-spark" data-tip="${sparkTip}">
                    <div class="tm-spark-lbl">MW TREND</div>
                    ${this._svgSpark(hist, { w: 200, h: 54, color: '#22d3ee' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · CAPITAL FLOWS (6×1) — horizontal deal ticker
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderCapital() {
        const host = document.getElementById('tm-body-capital');
        if (!host) return;
        const deals = (typeof API !== 'undefined' && Array.isArray(API.vcDeals)) ? API.vcDeals : [];
        const sig = 'cap:' + deals.length + ':' + (deals[0] ? (deals[0].headline || '').slice(0, 30) : '');
        if (this._sigCache.capital === sig) return;
        this._sigCache.capital = sig;

        if (!deals.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for deal flow…</div>';
            return;
        }
        const esc = (s) => this._esc(s);

        host.innerHTML = `
            <div class="tm-scroll tm-deals-list">
                ${deals.slice(0, 10).map(d => {
                    const url = d.url ? ` href="${esc(d.url)}" target="_blank" rel="noopener"` : '';
                    const amt = d.amount ? `<span class="tm-deal-amt">${esc(d.amount)}</span>` : '';
                    const round = d.round ? `<span class="tm-deal-round">${esc(d.round)}</span>` : '';
                    const tip = this._tipAttr(
                        `<div class="tm-tip-hd">VC deal</div>` +
                        (d.amount ? `<div class="tm-tip-row"><span class="tm-tip-k">Amount</span><b class="tm-tip-good">${esc(d.amount)}</b></div>` : '') +
                        (d.round  ? `<div class="tm-tip-row"><span class="tm-tip-k">Round</span><b>${esc(d.round)}</b></div>`  : '') +
                        `<div class="tm-tip-body">${esc(d.headline || '')}</div>` +
                        (d.url ? `<div class="tm-tip-foot">Click to open source ↗</div>` : '')
                    );
                    return `
                        <div class="tm-deal-item" data-tip="${tip}">
                            ${amt}
                            <a class="tm-deal-headline"${url}>${esc(d.headline || '')}</a>
                            ${round}
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · EMBASSY RELATIONS — 6×6 matrix
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    EMBASSY_RELATIONS: {
        'us_cn': 22, 'us_eu': 82, 'us_uk': 90, 'us_in': 70, 'us_ae': 62,
        'cn_eu': 48, 'cn_uk': 40, 'cn_in': 28, 'cn_ae': 72,
        'eu_uk': 75, 'eu_in': 65, 'eu_ae': 58,
        'uk_in': 78, 'uk_ae': 68,
        'in_ae': 76
    },

    _renderEmbassy() {
        const host = document.getElementById('tm-body-embassy');
        if (!host) return;
        if (typeof EmbassyRow === 'undefined' || !Array.isArray(EmbassyRow.BLDS)) {
            host.innerHTML = '<div class="tm-empty">Embassy data unavailable</div>';
            return;
        }
        const countries = EmbassyRow.BLDS.map(b => ({
            id: String(b.country || '').toLowerCase(),
            code: String(b.country || '').toUpperCase(),
            accent: (typeof b.accent === 'number') ? b.accent : 0x8a8aa0
        })).filter(c => c.id);

        const focus = this._filter.embassy;
        const sig = 'em:' + countries.map(c => c.id).join(',') + ':' + (focus || '');
        if (this._sigCache.embassy === sig) return;
        this._sigCache.embassy = sig;

        const relations = this.EMBASSY_RELATIONS;
        const getScore = (a, b) => {
            if (a === b) return null;
            if (relations[a + '_' + b] != null) return relations[a + '_' + b];
            if (relations[b + '_' + a] != null) return relations[b + '_' + a];
            return 50;
        };
        const cellCls = (s) => {
            if (s === null) return 'tm-m-self';
            if (s >= 75) return 'tm-m-good';
            if (s >= 55) return 'tm-m-neutral';
            if (s >= 35) return 'tm-m-cool';
            return 'tm-m-cold';
        };
        const scoreLabel = (s) => {
            if (s === null) return 'self';
            if (s >= 75) return 'Aligned · open flow';
            if (s >= 55) return 'Neutral · standard trade';
            if (s >= 35) return 'Tense · export controls';
            return 'Restricted · heavy sanctions';
        };
        const scoreClass = (s) => {
            if (s === null) return 'tm-tip-muted';
            if (s >= 75) return 'tm-tip-good';
            if (s >= 55) return 'tm-tip-warn';
            if (s >= 35) return 'tm-tip-warn';
            return 'tm-tip-bad';
        };
        const hex = (n) => '#' + n.toString(16).padStart(6, '0');
        const countryName = { us:'United States', cn:'China', eu:'Europe', uk:'United Kingdom', in:'India', ae:'UAE' };
        const esc = (s) => this._esc(s);

        // Build tip for a header cell (country column/row label)
        const headerTip = (code, id) => this._tipAttr(
            `<div class="tm-tip-hd">${esc(code)}</div>` +
            `<div class="tm-tip-body">${esc(countryName[id] || code)}</div>` +
            `<div class="tm-tip-foot">Click any cell to focus this country's row & column</div>`
        );

        host.innerHTML = `
            <div class="tm-scroll tm-matrix-wrap">
                <table class="tm-matrix">
                    <thead>
                        <tr>
                            <th></th>
                            ${countries.map(c => `<th style="color:${hex(c.accent)}" data-tip="${headerTip(c.code, c.id)}">${c.code}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${countries.map(r => `
                            <tr>
                                <th style="color:${hex(r.accent)}" data-tip="${headerTip(r.code, r.id)}">${r.code}</th>
                                ${countries.map(c => {
                                    const s = getScore(r.id, c.id);
                                    const key = r.id + '_' + c.id;
                                    const keyRev = c.id + '_' + r.id;
                                    const isFocus = focus && (focus === key || focus === keyRev || focus === r.id || focus === c.id);
                                    const dimCls = focus && !isFocus ? ' tm-dim' : '';
                                    const tip = this._tipAttr(
                                        `<div class="tm-tip-hd">${esc(r.code)} → ${esc(c.code)}</div>` +
                                        (s === null
                                            ? `<div class="tm-tip-body tm-tip-muted">Self-reference</div>`
                                            : `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b class="${scoreClass(s)}">${s}/100</b></div>` +
                                              `<div class="tm-tip-body ${scoreClass(s)}">${esc(scoreLabel(s))}</div>` +
                                              `<div class="tm-tip-foot">Click to focus this pair on the matrix</div>`)
                                    );
                                    const action = s === null ? '' : ` data-action="embassy:${key}"`;
                                    const click  = s === null ? '' : ' tm-clickable';
                                    return `<td class="${cellCls(s)}${click}${dimCls}" data-tip="${tip}"${action}>${s === null ? '·' : s}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="tm-m-legend">
                    <span class="tm-m-dot tm-m-good"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-good&quot;>Aligned</b><br/>Score 75-100<br/>Open trade, shared research')}"></span>aligned
                    <span class="tm-m-dot tm-m-neutral" data-tip="${this._tipAttr('<b class=&quot;tm-tip-warn&quot;>Neutral</b><br/>Score 55-74<br/>Standard bilateral')}"></span>neutral
                    <span class="tm-m-dot tm-m-cool"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-warn&quot;>Tense</b><br/>Score 35-54<br/>Export controls')}"></span>tense
                    <span class="tm-m-dot tm-m-cold"    data-tip="${this._tipAttr('<b class=&quot;tm-tip-bad&quot;>Restricted</b><br/>Score <35<br/>Heavy sanctions')}"></span>restricted
                    ${focus ? `<span class="tm-filter-badge tm-filter-inline" data-action="embassy:${esc(focus)}" data-tip="${this._tipAttr('Click to clear focus')}">FOCUS · ${esc(focus.toUpperCase().replace('_', ' → '))} <span class="tm-filter-x">×</span></span>` : ''}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · POWER GRID (4×2) — donut source mix + sparkline supply/demand + reserve readout
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderPower() {
        const host = document.getElementById('tm-body-power');
        if (!host) return;
        if (typeof PowerZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Grid offline</div>';
            return;
        }

        const supply = (typeof PowerZone.getTotalSupply === 'function') ? PowerZone.getTotalSupply() : 0;
        const demand = (typeof PowerZone.getTotalDemand === 'function') ? PowerZone.getTotalDemand() : 0;
        const balance = supply - demand;
        const reserveP = supply > 0 ? (balance / supply * 100) : 0;
        const sources = Array.isArray(PowerZone.SOURCES) ? PowerZone.SOURCES : [];

        const focusSrc = this._filter.power;
        const sig = 'p:' + supply.toFixed(0) + ':' + demand.toFixed(0) + ':' + sources.length + ':' + (this._history.supply_mw.length || 0) + ':' + (focusSrc || '');
        if (this._sigCache.power === sig) return;
        this._sigCache.power = sig;

        const srcColors = {
            solar: '#facc15', wind: '#22d3ee', nuclear: '#a78bfa',
            coal: '#78716c', hydro: '#60a5fa', gas: '#fb923c',
            geothermal: '#f472b6', fusion: '#c084fc'
        };
        const segments = sources.map(s => ({
            label: s.name || s.id,
            value: s.mw || 0,
            color: srcColors[s.id] || srcColors[(s.name || '').toLowerCase()] || '#8a8aa0'
        })).filter(s => s.value > 0);

        const reserveColor = reserveP >= 10 ? '#34d399' : reserveP >= 0 ? '#fbbf24' : '#f87171';
        const reserveStat = reserveP >= 10 ? 'Healthy headroom' : reserveP >= 0 ? 'Tight margin' : 'Deficit — blackouts likely';
        const reserveCls  = reserveP >= 10 ? 'tm-tip-good'    : reserveP >= 0 ? 'tm-tip-warn'  : 'tm-tip-bad';
        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'GW' : Math.round(n) + 'MW';
        const pctShare = (v) => supply > 0 ? ((v / supply) * 100).toFixed(1) + '%' : '—';
        const esc = (s) => this._esc(s);

        // Dim non-focused segments
        const dimmed = segments.map(s => focusSrc && s.label !== focusSrc
            ? { ...s, color: '#2a2a3a' }
            : s);

        // Hero / donut tooltip
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Power supply</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Total</span><b>${fmtMW(supply)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Sources</span><b>${segments.length}</b></div>` +
            `<div class="tm-tip-foot">Click a legend row to filter a source</div>`
        );
        const demandTip = this._tipAttr(
            `<div class="tm-tip-hd">Grid demand</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Draw</span><b>${fmtMW(demand)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Of supply</span><b>${supply > 0 ? (demand/supply*100).toFixed(0) : 0}%</b></div>`
        );
        const reserveTip = this._tipAttr(
            `<div class="tm-tip-hd">Spare capacity</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Margin</span><b class="${reserveCls}">${reserveP >= 0 ? '+' : ''}${reserveP.toFixed(1)}%</b></div>` +
            `<div class="tm-tip-body ${reserveCls}">${esc(reserveStat)}</div>`
        );
        const sourcesTip = this._tipAttr(
            `<div class="tm-tip-hd">Generation mix</div>` +
            `<div class="tm-tip-body">${segments.length} active sources</div>`
        );

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-power-hero">
                    <div data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, {
                        size: 110, thick: 16,
                        center: (supply >= 1000 ? (supply/1000).toFixed(1) : Math.round(supply)),
                        centerSub: (supply >= 1000 ? 'GW' : 'MW') + ' supply'
                    })}
                    </div>
                    <div class="tm-power-readouts">
                        <div class="tm-readout" data-tip="${demandTip}">
                            <span class="tm-readout-lbl">DEMAND</span>
                            <span class="tm-readout-val">${fmtMW(demand)}</span>
                        </div>
                        <div class="tm-readout" data-tip="${reserveTip}">
                            <span class="tm-readout-lbl">RESERVE</span>
                            <span class="tm-readout-val" style="color:${reserveColor}">${reserveP >= 0 ? '+' : ''}${reserveP.toFixed(0)}%</span>
                        </div>
                        <div class="tm-readout" data-tip="${sourcesTip}">
                            <span class="tm-readout-lbl">SOURCES</span>
                            <span class="tm-readout-val">${segments.length}</span>
                        </div>
                    </div>
                </div>
                <div class="tm-power-legend">
                    ${segments.slice(0, 6).map(s => {
                        const active = focusSrc === s.label;
                        const tip = this._tipAttr(
                            `<div class="tm-tip-hd" style="color:${esc(s.color)}">${esc(s.label)}</div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Output</span><b>${fmtMW(s.value)}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${pctShare(s.value)}</b></div>` +
                            `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} source</div>`
                        );
                        return `
                            <div class="tm-legend-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:power:${esc(s.label)}" data-tip="${tip}">
                                <span class="tm-legend-dot" style="background:${s.color}"></span>
                                <span class="tm-legend-lbl">${esc(s.label)}</span>
                                <span class="tm-legend-val">${fmtMW(s.value)}</span>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="tm-spark-block">
                    <div class="tm-spark-hd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Supply trend (16s)</div><div class=&quot;tm-tip-body&quot;>Total grid output over the last 64 ticks</div>')}">
                        <span class="tm-spark-t">SUPPLY</span>
                        ${this._svgSpark(this._history.supply_mw, { w: 120, h: 28, color: '#34d399' })}
                    </div>
                    <div class="tm-spark-hd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Demand trend (16s)</div><div class=&quot;tm-tip-body&quot;>Grid draw from datacenters + zones</div>')}">
                        <span class="tm-spark-t">DEMAND</span>
                        ${this._svgSpark(this._history.demand_mw, { w: 120, h: 28, color: '#fbbf24' })}
                    </div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ROBOTICS (4×1) — units + capability curve
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderRobotics() {
        const host = document.getElementById('tm-body-robotics');
        if (!host) return;
        if (typeof RoboticsZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Robotics unavailable</div>';
            return;
        }
        const units = RoboticsZone.unitsProduced || 0;
        const facilities = Array.isArray(RoboticsZone.BLDS) ? RoboticsZone.BLDS.length : 0;
        const hist = this._history.robotics_units;
        const lastVal = hist[hist.length - 1] || 0;

        const sig = 'r:' + units + ':' + facilities + ':' + lastVal + ':' + hist.length;
        if (this._sigCache.robotics === sig) return;
        this._sigCache.robotics = sig;

        const capability = units > 0 ? Math.min(100, Math.log10(units + 1) * 22) : 0;
        const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        const firstVal = hist[0] || 0;
        const deltaTxt = ((lastVal - firstVal) >= 0 ? '+' : '') + fmt(lastVal - firstVal);
        const deltaCls = (lastVal - firstVal) > 0 ? 'tm-tip-good' : (lastVal - firstVal) < 0 ? 'tm-tip-bad' : 'tm-tip-muted';

        const statTip = this._tipAttr(
            `<div class="tm-tip-hd">Humanoid production</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Units</span><b>${units.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Facilities</span><b>${facilities}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span><b class="${deltaCls}">${deltaTxt}</b></div>`
        );
        const capTip = this._tipAttr(
            `<div class="tm-tip-hd">Capability index</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b>${capability.toFixed(1)} / 100</b></div>` +
            `<div class="tm-tip-body">Log-scaled from fleet size: log10(N+1) × 22</div>` +
            `<div class="tm-tip-foot">Units trend sparkline shown below</div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat" data-tip="${statTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${fmt(units)}</span>
                        <span class="tm-stat-unit">units</span>
                    </div>
                    <div class="tm-stat-sub">${facilities} facilities</div>
                </div>
                <div class="tm-col tm-col-wide" data-tip="${capTip}">
                    <div class="tm-cap-row">
                        <span class="tm-cap-lbl">CAPABILITY</span>
                        <span class="tm-cap-val">${capability.toFixed(0)}</span>
                    </div>
                    <div class="tm-meter-track"><div class="tm-meter-fill" style="width:${capability.toFixed(1)}%"></div></div>
                    ${this._svgSpark(hist, { w: 180, h: 30, color: '#a78bfa' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · LONGEVITY (4×1) — three stat cells with sparklines each
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderLongevity() {
        const host = document.getElementById('tm-body-longevity');
        if (!host) return;
        if (typeof LongevityZone === 'undefined') {
            host.innerHTML = '<div class="tm-empty">Longevity unavailable</div>';
            return;
        }
        const compounds = LongevityZone.compoundsScreened || 0;
        const trials = LongevityZone.trialsActive || 0;
        const genomes = LongevityZone.genomesSequenced || 0;
        const hC = this._history.longevity_compounds;
        const hT = this._history.longevity_trials;
        const hG = this._history.longevity_genomes;

        const sig = 'l:' + compounds + ':' + trials + ':' + genomes + ':' + hC.length;
        if (this._sigCache.longevity === sig) return;
        this._sigCache.longevity = sig;

        const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        const mkTip = (hd, body, current, hist, unit) => {
            const first = hist[0] || 0;
            const last  = hist[hist.length - 1] || 0;
            const d = last - first;
            const dCls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return this._tipAttr(
                `<div class="tm-tip-hd">${hd}</div>` +
                `<div class="tm-tip-body">${body}</div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Current</span><b>${current.toLocaleString()} ${unit}</b></div>` +
                `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span><b class="${dCls}">${(d >= 0 ? '+' : '') + fmt(d)}</b></div>`
            );
        };

        host.innerHTML = `
            <div class="tm-long-grid">
                <div class="tm-long-cell" data-tip="${mkTip('Compounds screened', 'Molecules tested against longevity targets in lab pipelines.', compounds, hC, 'compounds')}">
                    <span class="tm-long-num">${fmt(compounds)}</span>
                    <span class="tm-long-lbl">compounds</span>
                    ${this._svgSpark(hC, { w: 110, h: 24, color: '#34d399' })}
                </div>
                <div class="tm-long-cell" data-tip="${mkTip('Active trials', 'Clinical trials currently running in longevity facilities.', trials, hT, 'trials')}">
                    <span class="tm-long-num">${trials}</span>
                    <span class="tm-long-lbl">trials</span>
                    ${this._svgSpark(hT, { w: 110, h: 24, color: '#fbbf24' })}
                </div>
                <div class="tm-long-cell" data-tip="${mkTip('Genomes sequenced', 'Full human genomes processed for biomarker & lifespan research.', genomes, hG, 'genomes')}">
                    <span class="tm-long-num">${fmt(genomes)}</span>
                    <span class="tm-long-lbl">genomes</span>
                    ${this._svgSpark(hG, { w: 110, h: 24, color: '#22d3ee' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · AGENTS (4×2) — active + gauge + tasks sparkline + swarm/tool metrics
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderAgents() {
        const host = document.getElementById('tm-body-agents');
        if (!host) return;
        const s = (typeof AgentsZone !== 'undefined' && AgentsZone.agentStats) ? AgentsZone.agentStats : null;
        if (!s) {
            host.innerHTML = '<div class="tm-empty">Agent data unavailable</div>';
            return;
        }

        const active = s.activeAgents || 0;
        const tasks  = s.tasksPerHour || 0;
        const tools  = s.toolCalls    || 0;
        const err    = s.errorRate    || 0;
        const swarms = s.swarmSize    || 0;
        const hTasks = this._history.agents_tasks;
        const hActive = this._history.agents_active;

        const sig = 'a:' + active + ':' + tasks + ':' + tools + ':' + err.toFixed(2) + ':' + hTasks.length;
        if (this._sigCache.agents === sig) return;
        this._sigCache.agents = sig;

        const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();
        // Error gauge: clamp 0..5% → 0..1 (so 2.5% fills half the gauge)
        const errNorm = Math.min(1, err / 5);
        const errCls  = err < 1.5 ? 'tm-tip-good' : err < 3 ? 'tm-tip-warn' : 'tm-tip-bad';
        const errLbl  = err < 1.5 ? 'Nominal' : err < 3 ? 'Elevated' : 'Critical';
        const sparkDelta = (hist) => {
            const a = hist[0] || 0, b = hist[hist.length - 1] || 0, d = b - a;
            const cls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return `<b class="${cls}">${(d >= 0 ? '+' : '') + fmtK(d)}</b>`;
        };

        const heroTip = this._tipAttr(
            `<div class="tm-tip-hd">Agent fleet</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Active</span><b>${active.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Swarms</span><b>${swarms}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Tool calls/hr</span><b>${fmtK(tools)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Tasks/hr</span><b>${fmtK(tasks)}</b></div>`
        );
        const tasksTip = this._tipAttr(
            `<div class="tm-tip-hd">Task throughput</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${fmtK(tasks)} / hr</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span>${sparkDelta(hTasks)}</div>`
        );
        const activeTip = this._tipAttr(
            `<div class="tm-tip-hd">Active agent trend</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${active.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ (16s)</span>${sparkDelta(hActive)}</div>`
        );
        const gaugeTip = this._tipAttr(
            `<div class="tm-tip-hd">Error rate</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Rate</span><b class="${errCls}">${err.toFixed(2)}%</b></div>` +
            `<div class="tm-tip-body ${errCls}">${errLbl}</div>` +
            `<div class="tm-tip-foot">Gauge full scale = 5%</div>`
        );

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-agents-hero" data-tip="${heroTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${active.toLocaleString()}</span>
                        <span class="tm-stat-unit">active</span>
                    </div>
                    <div class="tm-ministats">
                        <span><b>${swarms}</b> swarms</span>
                        <span><b>${fmtK(tools)}</b> tool calls/hr</span>
                    </div>
                </div>
                <div class="tm-agents-spark" data-tip="${tasksTip}">
                    <div class="tm-spark-lbl">TASKS/HR · ${fmtK(tasks)}</div>
                    ${this._svgSpark(hTasks, { w: 240, h: 36, color: '#22d3ee' })}
                </div>
                <div class="tm-agents-spark" data-tip="${activeTip}">
                    <div class="tm-spark-lbl">ACTIVE AGENTS</div>
                    ${this._svgSpark(hActive, { w: 240, h: 30, color: '#34d399' })}
                </div>
                <div class="tm-agents-gauge" data-tip="${gaugeTip}">
                    ${this._svgGauge(errNorm, { w: 140, h: 72, label: err.toFixed(2) + '%', sub: 'ERROR RATE' })}
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · SUPPLY CHAIN (4×2) — bars + sparklines + bottlenecks
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderSupply() {
        const host = document.getElementById('tm-body-supply');
        if (!host) return;
        const SC = (typeof SupplyChain !== 'undefined') ? SupplyChain : null;
        const inv = SC && SC.inventory ? SC.inventory : null;
        const bottlenecks = (typeof SUPPLY_CHAIN !== 'undefined' && Array.isArray(SUPPLY_CHAIN.bottlenecks))
            ? SUPPLY_CHAIN.bottlenecks : [];

        if (!inv) {
            host.innerHTML = '<div class="tm-empty">Supply chain unavailable</div>';
            return;
        }
        const keys = Object.keys(inv);
        const sig = 's:' + keys.map(k => k + ':' + ((inv[k] && inv[k].stock) | 0)).join('|') + '|b:' + bottlenecks.length + ':' + this._history.supply_gpu.length;
        if (this._sigCache.supply === sig) return;
        this._sigCache.supply = sig;

        const names = {
            gpu_h100: 'H100', gpu_b200: 'B200',
            helium: 'He', hbm_memory: 'HBM',
            coolant_sys: 'Coolant', electricity: 'Power'
        };
        const fullNames = {
            gpu_h100: 'NVIDIA H100 GPU',
            gpu_b200: 'NVIDIA B200 GPU',
            helium: 'Helium (coolant)',
            hbm_memory: 'High-bandwidth memory',
            coolant_sys: 'Liquid cooling systems',
            electricity: 'Grid power (MW)'
        };
        const pctColor = (p) => p >= 60 ? '#34d399' : p >= 30 ? '#fbbf24' : '#f87171';
        const pctCls   = (p) => p >= 60 ? 'tm-tip-good' : p >= 30 ? 'tm-tip-warn' : 'tm-tip-bad';
        const pctLbl   = (p) => p >= 60 ? 'Healthy' : p >= 30 ? 'Tight' : 'Shortage';
        const esc = (s) => this._esc(s);

        const rows = keys.map(k => {
            const v = inv[k] || {};
            const cap = v.capacity || 1;
            const pct = Math.max(0, Math.min(100, (v.stock || 0) / cap * 100));
            return { k, pct, stock: v.stock || 0, cap };
        }).sort((a, b) => a.pct - b.pct);

        const sparkDelta = (hist) => {
            const a = hist[0] || 0, b = hist[hist.length - 1] || 0, d = b - a;
            const cls = d > 0 ? 'tm-tip-good' : d < 0 ? 'tm-tip-bad' : 'tm-tip-muted';
            return `<b class="${cls}">${(d >= 0 ? '+' : '') + Math.round(d).toLocaleString()}</b>`;
        };

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-bars tm-bars-dense">
                    ${rows.slice(0, 5).map(r => {
                        const tip = this._tipAttr(
                            `<div class="tm-tip-hd">${esc(fullNames[r.k] || r.k)}</div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Stock</span><b>${r.stock.toLocaleString()}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Capacity</span><b>${r.cap.toLocaleString()}</b></div>` +
                            `<div class="tm-tip-row"><span class="tm-tip-k">Fill</span><b class="${pctCls(r.pct)}">${r.pct.toFixed(1)}%</b></div>` +
                            `<div class="tm-tip-body ${pctCls(r.pct)}">${pctLbl(r.pct)}</div>`
                        );
                        return `
                        <div class="tm-bar-row" data-tip="${tip}">
                            <span class="tm-bar-lbl">${esc(names[r.k] || r.k)}</span>
                            <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${r.pct.toFixed(0)}%;background:${pctColor(r.pct)}"></div></div>
                            <span class="tm-bar-val">${r.pct.toFixed(0)}%</span>
                        </div>
                    `;
                    }).join('')}
                </div>
                <div class="tm-spark-block tm-spark-block-pad">
                    <div class="tm-spark-hd" data-tip="${this._tipAttr(
                        `<div class="tm-tip-hd">GPU stockpile (16s)</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span>${sparkDelta(this._history.supply_gpu)}</div>` +
                        `<div class="tm-tip-body">Combined H100 + B200 inventory</div>`
                    )}">
                        <span class="tm-spark-t">GPU STOCK</span>
                        ${this._svgSpark(this._history.supply_gpu, { w: 120, h: 24, color: '#22d3ee' })}
                    </div>
                    <div class="tm-spark-hd" data-tip="${this._tipAttr(
                        `<div class="tm-tip-hd">HBM memory (16s)</div>` +
                        `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span>${sparkDelta(this._history.supply_hbm)}</div>` +
                        `<div class="tm-tip-body">High-bandwidth memory inventory</div>`
                    )}">
                        <span class="tm-spark-t">HBM</span>
                        ${this._svgSpark(this._history.supply_hbm, { w: 120, h: 24, color: '#a78bfa' })}
                    </div>
                </div>
                ${bottlenecks.length ? `
                    <div class="tm-subhd" data-tip="${this._tipAttr('<div class=&quot;tm-tip-hd&quot;>Supply bottlenecks</div><div class=&quot;tm-tip-body&quot;>Upstream chokepoints throttling production</div>')}">Bottlenecks</div>
                    <div class="tm-bn-list">
                        ${bottlenecks.slice(0, 3).map(b => {
                            const load = b.load || 0;
                            const health = 100 - load;
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd">${esc(b.name)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Load</span><b class="${pctCls(health)}">${load}%</b></div>` +
                                `<div class="tm-tip-body">At ${load}% capacity — ${load >= 90 ? 'critical' : load >= 70 ? 'stressed' : 'normal'}</div>`
                            );
                            return `
                                <div class="tm-bn-row" data-tip="${tip}">
                                    <span class="tm-bn-name">${esc(b.name)}</span>
                                    <span class="tm-bn-load" style="color:${pctColor(health)}">${load}%</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                ` : ''}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · KARDASHEV (5×2) — big K + progress + pentagon radar + sparkline
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderKardashev() {
        const host = document.getElementById('tm-body-kardashev');
        if (!host) return;
        const K = (typeof Kardashev !== 'undefined') ? Kardashev : null;
        if (!K) {
            host.innerHTML = '<div class="tm-empty">Kardashev offline</div>';
            return;
        }

        let score = 0;
        if (typeof K.score === 'number') score = K.score;
        else if (typeof K.currentLevel === 'function') { try { score = K.currentLevel(); } catch (e) {} }
        else if (typeof K.level === 'number') score = K.level;

        const pct = Math.max(0, Math.min(100, ((score - 0.7) / 0.3) * 100));
        const sig = 'k:' + score.toFixed(4) + ':' + this._history.kardashev_score.length;
        if (this._sigCache.kardashev === sig) return;
        this._sigCache.kardashev = sig;

        // Next milestone — MILESTONES uses `k` field
        let next = null;
        if (Array.isArray(K.MILESTONES)) {
            for (const m of K.MILESTONES) {
                const t = (typeof m.k === 'number') ? m.k
                        : (typeof m.score === 'number') ? m.score
                        : (typeof m.threshold === 'number') ? m.threshold : null;
                if (t !== null && t > score) { next = { obj: m, threshold: t }; break; }
            }
        }

        // Pillar entries for radar
        const pillars = K.pillars || {};
        const pillarEntries = Object.entries(pillars).map(([k, v]) => {
            const val = (typeof v === 'number') ? v : (v && typeof v.score === 'number') ? v.score : 0;
            return { label: k.slice(0, 4).toUpperCase(), value: val <= 1 ? val : val / 100 };
        }).slice(0, 6);

        const esc = (s) => this._esc(s);
        const pillarNames = { compute: 'Compute', energy: 'Energy', cognition: 'Cognition', biology: 'Biology', space: 'Space', population: 'Population', alignment: 'Alignment' };
        const kHist = this._history.kardashev_score;
        const kFirst = kHist[0] || 0, kLast = kHist[kHist.length - 1] || 0, kDelta = kLast - kFirst;
        const kDeltaCls = kDelta > 0 ? 'tm-tip-good' : kDelta < 0 ? 'tm-tip-bad' : 'tm-tip-muted';

        const scoreTip = this._tipAttr(
            `<div class="tm-tip-hd">Kardashev scale</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Score</span><b style="color:#fbbf24">K = ${score.toFixed(3)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Type I target</span><b>K = 1.000</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Progress</span><b>${pct.toFixed(1)}% of gap</b></div>` +
            `<div class="tm-tip-body">Civilizational energy-mastery index. Earth sits near 0.73 today.</div>`
        );
        const progTip = this._tipAttr(
            `<div class="tm-tip-hd">K-gap bar</div>` +
            `<div class="tm-tip-body">Maps 0.700 → 1.000. Right edge is Type I.</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Current</span><b>${pct.toFixed(1)}%</b></div>`
        );
        const nextTip = next ? this._tipAttr(
            `<div class="tm-tip-hd">Next milestone</div>` +
            `<div class="tm-tip-body">${esc((next.obj && (next.obj.name || next.obj.id)) || 'milestone')}</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Fires at</span><b>K = ${next.threshold.toFixed(3)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">To go</span><b class="tm-tip-warn">${(next.threshold - score).toFixed(3)}</b></div>`
        ) : this._tipAttr(`<div class="tm-tip-hd">Apex reached</div><div class="tm-tip-body">Type I Kardashev achieved. No further milestones tracked.</div>`);
        const sparkTip = this._tipAttr(
            `<div class="tm-tip-hd">K-score trend (16s)</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Now</span><b>${score.toFixed(4)}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Δ</span><b class="${kDeltaCls}">${(kDelta >= 0 ? '+' : '') + kDelta.toFixed(4)}</b></div>`
        );
        const radarTip = this._tipAttr(
            `<div class="tm-tip-hd">Pillar radar</div>` +
            `<div class="tm-tip-body">${pillarEntries.length} civilizational pillars. Each axis shows 0-100% of Type I target.</div>` +
            `<div class="tm-tip-foot">Hover a pillar chip for details</div>`
        );

        host.innerHTML = `
            <div class="tm-k-layout">
                <div class="tm-k-left">
                    <div class="tm-stat-big tm-k-big" data-tip="${scoreTip}">
                        <span class="tm-stat-unit">K</span>
                        <span class="tm-stat-num">${score.toFixed(3)}</span>
                    </div>
                    <div class="tm-kprog" data-tip="${progTip}">
                        <div class="tm-kprog-track"><div class="tm-kprog-fill" style="width:${pct.toFixed(1)}%"></div></div>
                        <div class="tm-kprog-labels"><span>0.700</span><span>1.000</span></div>
                    </div>
                    <div class="tm-k-next" data-tip="${nextTip}">${next ? `▲ NEXT: ${esc((next.obj && (next.obj.name || next.obj.id)) || 'milestone')} @ ${next.threshold.toFixed(3)}` : '⟡ APEX'}</div>
                    <div class="tm-k-spark" data-tip="${sparkTip}">
                        <div class="tm-spark-lbl">K-SCORE TREND</div>
                        ${this._svgSpark(this._history.kardashev_score, { w: 220, h: 32, color: '#fbbf24' })}
                    </div>
                </div>
                <div class="tm-k-right">
                    <div data-tip="${radarTip}">
                    ${pillarEntries.length >= 3 ? this._svgRadar(pillarEntries, { size: 180, pad: 24 }) : '<div class="tm-empty">No pillars</div>'}
                    </div>
                    <div class="tm-k-pillars">
                        ${pillarEntries.map(p => {
                            const pct100 = Math.round(p.value * 100);
                            const full = pillarNames[p.label.toLowerCase()] || pillarNames[(p.label || '').toLowerCase().slice(0,4)] || p.label;
                            const pTip = this._tipAttr(
                                `<div class="tm-tip-hd">${esc(full)}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Progress</span><b style="color:#22d3ee">${pct100}%</b></div>` +
                                `<div class="tm-tip-body">${esc(p.label)} pillar contribution to K-score</div>`
                            );
                            return `
                                <div class="tm-k-pillar" data-tip="${pTip}">
                                    <span class="tm-k-pillar-name">${esc(p.label)}</span>
                                    <span class="tm-k-pillar-val">${pct100}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · POPULATION (4×1) — NPC count + workplace donut
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderPopulation() {
        const host = document.getElementById('tm-body-population');
        if (!host) return;
        const NH = (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) ? NPCHousing : null;
        const reg = NH ? NH.REGISTRY : [];

        // FIX: use NPCHousing.REGISTRY.length as the authoritative citizen count
        const sim = reg.length;
        const focusZone = this._filter.population;
        const sig = 'pop:' + sim + ':' + (focusZone || '');
        if (this._sigCache.population === sig) return;
        this._sigCache.population = sig;

        if (!sim) {
            host.innerHTML = `
                <div class="tm-stat-block">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">0</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">no registry</div>
                </div>
            `;
            return;
        }

        // Group by workplace zone prefix
        const byZone = {};
        for (const n of reg) {
            const w = String(n.workplace || 'other').toLowerCase();
            let zone = w.split(/[_:]/)[0];
            if (zone === 'dc' || zone === 'bld') zone = 'compute';
            if (zone === 'other' && w.includes('court')) zone = 'court';
            byZone[zone] = (byZone[zone] || 0) + 1;
        }
        const zoneColors = {
            compute:  '#22d3ee',
            power:    '#fbbf24',
            agents:   '#a78bfa',
            embassy:  '#60a5fa',
            vcrow:    '#34d399',
            robotics: '#fb923c',
            longev:   '#f472b6',
            backbone: '#c084fc',
            align:    '#f87171',
            univ:     '#818cf8',
            court:    '#facc15',
            space:    '#38bdf8',
            port:     '#4ade80',
            other:    '#6a6a80'
        };
        const zoneLabel = {
            compute:'Datacenters & labs', power:'Power grid', agents:'Agent platforms',
            embassy:'Embassy row', vcrow:'VC row', robotics:'Robotics', longev:'Longevity',
            backbone:'Backbone zone', align:'Alignment forest', univ:'University',
            court:'Court', space:'Spaceport', port:'Port', other:'Other / unemployed'
        };
        const sorted = Object.entries(byZone).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 6);
        const other = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
        const segments = top.map(([z, n]) => ({ label: z, value: n, color: zoneColors[z] || '#8a8aa0' }));
        if (other) segments.push({ label: 'other', value: other, color: '#4a4a5a' });
        const dimmed = segments.map(s => focusZone && s.label !== focusZone
            ? { ...s, color: '#2a2a3a' }
            : s);
        const esc = (s) => this._esc(s);

        const statTip = this._tipAttr(
            `<div class="tm-tip-hd">Population registry</div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Citizens</span><b>${sim.toLocaleString()}</b></div>` +
            `<div class="tm-tip-row"><span class="tm-tip-k">Zones</span><b>${sorted.length}</b></div>` +
            `<div class="tm-tip-body">Authoritative count from NPCHousing.REGISTRY</div>`
        );
        const donutTip = this._tipAttr(
            `<div class="tm-tip-hd">Workplace distribution</div>` +
            `<div class="tm-tip-body">Where the city's citizens commute to each morning</div>` +
            `<div class="tm-tip-foot">Click a zone row to focus</div>`
        );

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat" data-tip="${statTip}">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${sim.toLocaleString()}</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">${sorted.length} zones</div>
                </div>
                <div class="tm-col tm-col-donut" data-tip="${donutTip}">
                    ${this._svgDonut(dimmed, { size: 70, thick: 11 })}
                </div>
                <div class="tm-col tm-col-wide">
                    <div class="tm-pop-list">
                        ${top.slice(0, 4).map(([z, n]) => {
                            const active = focusZone === z;
                            const share = ((n / sim) * 100).toFixed(1) + '%';
                            const tip = this._tipAttr(
                                `<div class="tm-tip-hd" style="color:${esc(zoneColors[z] || '#8a8aa0')}">${esc((zoneLabel[z] || z).toUpperCase())}</div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Workers</span><b>${n}</b></div>` +
                                `<div class="tm-tip-row"><span class="tm-tip-k">Share</span><b>${share}</b></div>` +
                                `<div class="tm-tip-foot">Click to ${active ? 'clear' : 'focus'} zone</div>`
                            );
                            return `
                                <div class="tm-pop-row tm-clickable${active ? ' tm-active' : ''}" data-action="filter:population:${esc(z)}" data-tip="${tip}">
                                    <span class="tm-legend-dot" style="background:${zoneColors[z] || '#8a8aa0'}"></span>
                                    <span class="tm-pop-lbl">${esc(z.toUpperCase())}</span>
                                    <span class="tm-pop-val">${n}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;
    }
};

if (typeof window !== 'undefined') {
    window.Terminal = Terminal;

    window.enterTerminal = function () {
        Terminal._pendingOpen = true;
        // Pass the terminal flag so enterCity() animates the correct button and
        // themes the loading screen amber. enterCity() will call Terminal.open()
        // once the sim is booted.
        if (typeof enterCity === 'function') enterCity({ terminal: true });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Terminal.init());
    } else {
        Terminal.init();
    }
}
