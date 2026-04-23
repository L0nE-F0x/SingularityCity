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

        // URL deep-link only — auto-bootstrap if explicit ?mode=terminal. No preference persistence.
        let urlWantsTerminal = false;
        try {
            const p = new URLSearchParams(window.location.search);
            const mode = p.get('mode');
            if (mode === 'terminal' || mode === 'data') urlWantsTerminal = true;
        } catch (e) {}

        if (urlWantsTerminal) {
            this._pendingOpen = true;
            this._autoBootstrap();
        }
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
        this._syncUrl(true);
    },

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('terminal-mode');
        this._syncUrl(false);
    },

    toggle() { if (this.isOpen) this.close(); else this.open(); },

    _syncUrl(terminalOn) {
        try {
            const url = new URL(window.location.href);
            if (terminalOn) url.searchParams.set('mode', 'terminal');
            else url.searchParams.delete('mode');
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
        { id: 'news',       title: 'LIVE NEWS',         cols: 3, rows: 2, live: true, hint: 'Hacker News + tech headlines' },
        { id: 'events',     title: 'ACTIVITY STREAM',   cols: 3, rows: 2, live: true, hint: 'Scrolling sim events' },
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
            return `
                <div class="tm-panel${p.live ? ' tm-panel-live-on' : ''}" data-panel="${p.id}" style="${style}">
                    <div class="tm-panel-h">
                        <span class="tm-panel-title">${p.title}</span>
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
                    <span class="tm-stat"><span class="tm-lbl">TICK</span><span class="tm-val" id="tm-tick">—</span></span>
                    <span class="tm-stat"><span class="tm-lbl">CITIZENS</span><span class="tm-val" id="tm-citizens">—</span></span>
                    <span class="tm-stat"><span class="tm-lbl">BLDS</span><span class="tm-val" id="tm-buildings">—</span></span>
                    <span class="tm-stat"><span class="tm-lbl">K-SCALE</span><span class="tm-val" id="tm-kardashev">—</span></span>
                    <span class="tm-stat"><span class="tm-lbl">FPS</span><span class="tm-val" id="tm-fps">—</span></span>
                    <span class="tm-stat"><span class="tm-lbl">UTC</span><span class="tm-val" id="tm-clock">—</span></span>
                </div>
                <div class="tm-topbar-right">
                    <button class="tm-cta-btn" onclick="Terminal.close()" title="Switch to pixel-art city view (D)">▶ ENTER CITY</button>
                </div>
            </div>
            <div class="tm-grid">${panelsHtml}</div>
            <div class="tm-footer">
                <span class="tm-foot-chunk"><kbd>D</kbd> toggle city / terminal</span>
                <span class="tm-foot-chunk tm-foot-mid">PHASE 4 · 14 panels · charts live · sim running behind shell</span>
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
            }
        });
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
        this._renderEvents();
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
        const sorted = this._sortLabRows(rows);
        const sig = this._labsSort.col + ':' + this._labsSort.dir + ':' + sorted.length + ':' +
                    sorted.slice(0, 6).map(r => r.id + (r.score || 0).toFixed(1) + (r.elo || 0)).join('|');
        if (this._sigCache.labs === sig) return;
        this._sigCache.labs = sig;

        if (!sorted.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for model data…</div>';
            return;
        }

        const arrow = (c) => this._labsSort.col !== c ? '' : (this._labsSort.dir === 'asc' ? ' ▴' : ' ▾');
        const fmtScore = (s) => s == null ? '—' : s.toFixed(0);
        const fmtElo   = (e) => e == null ? '—' : e.toFixed(0);
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

        const body = sorted.map((r, i) => `
            <tr>
                <td class="tm-rank">${i + 1}</td>
                <td class="tm-lab-name">
                    <span class="tm-lab-dot" style="background:${r.color}"></span>
                    ${escape(r.name)}
                    ${r.apex ? '<span class="tm-apex" title="Apex lab">♕</span>' : ''}
                </td>
                <td class="tm-region tm-region-${r.region.toLowerCase()}">${escape(r.region)}</td>
                <td class="tm-num">${r.models}</td>
                <td class="tm-num">${fmtScore(r.score)}</td>
                <td class="tm-flagship">${escape(r.flagship || '—')}</td>
                <td class="tm-num tm-elo">${fmtElo(r.elo)}</td>
            </tr>
        `).join('');

        host.innerHTML = `
            <div class="tm-scroll">
                <table class="tm-table tm-labs-table">
                    <thead>
                        <tr>
                            <th class="tm-rank">#</th>
                            <th data-col="name">LAB${arrow('name')}</th>
                            <th data-col="region">REG${arrow('region')}</th>
                            <th data-col="models" class="tm-num">MODELS${arrow('models')}</th>
                            <th data-col="score" class="tm-num">AVG${arrow('score')}</th>
                            <th data-col="flagship">FLAGSHIP${arrow('flagship')}</th>
                            <th data-col="elo" class="tm-num">ELO${arrow('elo')}</th>
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
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
        const hex = (n) => '#' + (typeof n === 'number' ? n.toString(16).padStart(6, '0') : '8a8aa0');

        host.innerHTML = `
            <div class="tm-align-grid tm-scroll">
                ${AlignmentForest.BLDS.map(o => `
                    <div class="tm-align-card" style="border-left-color:${hex(o.shield)}">
                        <div class="tm-align-top">
                            <span class="tm-align-name" style="color:${hex(o.shield)}">${escape(o.name)}</span>
                            <span class="tm-align-year">${o.founded || ''}</span>
                        </div>
                        <div class="tm-align-focus">${escape(o.focus || '')}</div>
                        <div class="tm-align-meta">
                            <span class="tm-align-lead">${escape(o.lead || '')}</span>
                        </div>
                        <div class="tm-align-loc">📍 ${escape(o.location || '')}</div>
                    </div>
                `).join('')}
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
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
        const MAX = 24;

        host.innerHTML = `
            <div class="tm-scroll tm-news-list">
                ${items.slice(0, MAX).map(n => {
                    const url = n.url ? ` href="${escape(n.url)}" target="_blank" rel="noopener"` : '';
                    const tag = n.source === 'HN' ? 'tm-tag-hn' : 'tm-tag-news';
                    const score = (n.source === 'HN' && typeof n.score === 'number')
                        ? `<span class="tm-news-score" title="${n.comments || 0} comments">▲ ${n.score}</span>` : '';
                    return `
                        <div class="tm-news-item">
                            <span class="tm-news-source ${tag}">${escape(n.source)}</span>
                            <a class="tm-news-title"${url}>${escape(n.title)}</a>
                            ${score}
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
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

        host.innerHTML = `
            <div class="tm-scroll tm-events-list">
                ${log.slice(0, 30).map(e => `
                    <div class="tm-event-item tm-ev-${classify(e.msg)}">
                        <span class="tm-event-time">${escape(e.t || '')}</span>
                        <span class="tm-event-msg">${e.msg || ''}</span>
                    </div>
                `).join('')}
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
        const sig = 'c:' + op.length + ':' + totalMW + ':' + fabs.length + ':' + construction + ':' + lastMW + ':' + (hist.length || 0);
        if (this._sigCache.compute === sig) return;
        this._sigCache.compute = sig;

        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + ' GW' : Math.round(n).toLocaleString() + ' MW';

        host.innerHTML = `
            <div class="tm-row-layout">
                <div class="tm-col tm-col-stat">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${(totalMW >= 1000 ? (totalMW/1000).toFixed(1) : Math.round(totalMW).toLocaleString())}</span>
                        <span class="tm-stat-unit">${totalMW >= 1000 ? 'GW' : 'MW'}</span>
                    </div>
                    <div class="tm-ministats">
                        <span><b>${op.length}</b> DCs</span>
                        <span><b>${fabs.length}</b> fabs</span>
                        <span><b>${construction}</b> build</span>
                    </div>
                </div>
                <div class="tm-col tm-col-donut">
                    ${this._svgDonut(segments, { size: 88, thick: 13, center: fmtMW(totalMW) })}
                    <div class="tm-donut-legend">
                        ${segments.slice(0, 4).map(s => `
                            <div class="tm-legend-row"><span class="tm-legend-dot" style="background:${s.color}"></span><span class="tm-legend-lbl">${s.label}</span></div>
                        `).join('')}
                    </div>
                </div>
                <div class="tm-col tm-col-spark">
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
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

        host.innerHTML = `
            <div class="tm-scroll tm-deals-list">
                ${deals.slice(0, 10).map(d => {
                    const url = d.url ? ` href="${escape(d.url)}" target="_blank" rel="noopener"` : '';
                    const amt = d.amount ? `<span class="tm-deal-amt">${escape(d.amount)}</span>` : '';
                    const round = d.round ? `<span class="tm-deal-round">${escape(d.round)}</span>` : '';
                    return `
                        <div class="tm-deal-item">
                            ${amt}
                            <a class="tm-deal-headline"${url}>${escape(d.headline || '')}</a>
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

        const sig = 'em:' + countries.map(c => c.id).join(',');
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
        const hex = (n) => '#' + n.toString(16).padStart(6, '0');

        host.innerHTML = `
            <div class="tm-scroll tm-matrix-wrap">
                <table class="tm-matrix">
                    <thead>
                        <tr>
                            <th></th>
                            ${countries.map(c => `<th style="color:${hex(c.accent)}">${c.code}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
                        ${countries.map(r => `
                            <tr>
                                <th style="color:${hex(r.accent)}">${r.code}</th>
                                ${countries.map(c => {
                                    const s = getScore(r.id, c.id);
                                    return `<td class="${cellCls(s)}" title="${r.code} → ${c.code}: ${s === null ? 'self' : s}">${s === null ? '·' : s}</td>`;
                                }).join('')}
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
                <div class="tm-m-legend">
                    <span class="tm-m-dot tm-m-good"></span>aligned
                    <span class="tm-m-dot tm-m-neutral"></span>neutral
                    <span class="tm-m-dot tm-m-cool"></span>tense
                    <span class="tm-m-dot tm-m-cold"></span>restricted
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

        const sig = 'p:' + supply.toFixed(0) + ':' + demand.toFixed(0) + ':' + sources.length + ':' + (this._history.supply_mw.length || 0);
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
        const fmtMW = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'GW' : Math.round(n) + 'MW';

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-power-hero">
                    ${this._svgDonut(segments, {
                        size: 110, thick: 16,
                        center: (supply >= 1000 ? (supply/1000).toFixed(1) : Math.round(supply)),
                        centerSub: (supply >= 1000 ? 'GW' : 'MW') + ' supply'
                    })}
                    <div class="tm-power-readouts">
                        <div class="tm-readout">
                            <span class="tm-readout-lbl">DEMAND</span>
                            <span class="tm-readout-val">${fmtMW(demand)}</span>
                        </div>
                        <div class="tm-readout">
                            <span class="tm-readout-lbl">RESERVE</span>
                            <span class="tm-readout-val" style="color:${reserveColor}">${reserveP >= 0 ? '+' : ''}${reserveP.toFixed(0)}%</span>
                        </div>
                        <div class="tm-readout">
                            <span class="tm-readout-lbl">SOURCES</span>
                            <span class="tm-readout-val">${segments.length}</span>
                        </div>
                    </div>
                </div>
                <div class="tm-power-legend">
                    ${segments.slice(0, 6).map(s => `
                        <div class="tm-legend-row">
                            <span class="tm-legend-dot" style="background:${s.color}"></span>
                            <span class="tm-legend-lbl">${s.label}</span>
                            <span class="tm-legend-val">${fmtMW(s.value)}</span>
                        </div>
                    `).join('')}
                </div>
                <div class="tm-spark-block">
                    <div class="tm-spark-hd">
                        <span class="tm-spark-t">SUPPLY</span>
                        ${this._svgSpark(this._history.supply_mw, { w: 120, h: 28, color: '#34d399' })}
                    </div>
                    <div class="tm-spark-hd">
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

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${fmt(units)}</span>
                        <span class="tm-stat-unit">units</span>
                    </div>
                    <div class="tm-stat-sub">${facilities} facilities</div>
                </div>
                <div class="tm-col tm-col-wide">
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

        host.innerHTML = `
            <div class="tm-long-grid">
                <div class="tm-long-cell">
                    <span class="tm-long-num">${fmt(compounds)}</span>
                    <span class="tm-long-lbl">compounds</span>
                    ${this._svgSpark(hC, { w: 110, h: 24, color: '#34d399' })}
                </div>
                <div class="tm-long-cell">
                    <span class="tm-long-num">${trials}</span>
                    <span class="tm-long-lbl">trials</span>
                    ${this._svgSpark(hT, { w: 110, h: 24, color: '#fbbf24' })}
                </div>
                <div class="tm-long-cell">
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

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-agents-hero">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${active.toLocaleString()}</span>
                        <span class="tm-stat-unit">active</span>
                    </div>
                    <div class="tm-ministats">
                        <span><b>${swarms}</b> swarms</span>
                        <span><b>${fmtK(tools)}</b> tool calls/hr</span>
                    </div>
                </div>
                <div class="tm-agents-spark">
                    <div class="tm-spark-lbl">TASKS/HR · ${fmtK(tasks)}</div>
                    ${this._svgSpark(hTasks, { w: 240, h: 36, color: '#22d3ee' })}
                </div>
                <div class="tm-agents-spark">
                    <div class="tm-spark-lbl">ACTIVE AGENTS</div>
                    ${this._svgSpark(hActive, { w: 240, h: 30, color: '#34d399' })}
                </div>
                <div class="tm-agents-gauge">
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
        const pctColor = (p) => p >= 60 ? '#34d399' : p >= 30 ? '#fbbf24' : '#f87171';

        const rows = keys.map(k => {
            const v = inv[k] || {};
            const cap = v.capacity || 1;
            const pct = Math.max(0, Math.min(100, (v.stock || 0) / cap * 100));
            return { k, pct, stock: v.stock || 0 };
        }).sort((a, b) => a.pct - b.pct);

        host.innerHTML = `
            <div class="tm-col-layout">
                <div class="tm-bars tm-bars-dense">
                    ${rows.slice(0, 5).map(r => `
                        <div class="tm-bar-row">
                            <span class="tm-bar-lbl">${names[r.k] || r.k}</span>
                            <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${r.pct.toFixed(0)}%;background:${pctColor(r.pct)}"></div></div>
                            <span class="tm-bar-val">${r.pct.toFixed(0)}%</span>
                        </div>
                    `).join('')}
                </div>
                <div class="tm-spark-block tm-spark-block-pad">
                    <div class="tm-spark-hd">
                        <span class="tm-spark-t">GPU STOCK</span>
                        ${this._svgSpark(this._history.supply_gpu, { w: 120, h: 24, color: '#22d3ee' })}
                    </div>
                    <div class="tm-spark-hd">
                        <span class="tm-spark-t">HBM</span>
                        ${this._svgSpark(this._history.supply_hbm, { w: 120, h: 24, color: '#a78bfa' })}
                    </div>
                </div>
                ${bottlenecks.length ? `
                    <div class="tm-subhd">Bottlenecks</div>
                    <div class="tm-bn-list">
                        ${bottlenecks.slice(0, 3).map(b => `
                            <div class="tm-bn-row">
                                <span class="tm-bn-name">${b.name}</span>
                                <span class="tm-bn-load" style="color:${pctColor(100 - (b.load || 0))}">${b.load || 0}%</span>
                            </div>
                        `).join('')}
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

        host.innerHTML = `
            <div class="tm-k-layout">
                <div class="tm-k-left">
                    <div class="tm-stat-big tm-k-big">
                        <span class="tm-stat-unit">K</span>
                        <span class="tm-stat-num">${score.toFixed(3)}</span>
                    </div>
                    <div class="tm-kprog">
                        <div class="tm-kprog-track"><div class="tm-kprog-fill" style="width:${pct.toFixed(1)}%"></div></div>
                        <div class="tm-kprog-labels"><span>0.700</span><span>1.000</span></div>
                    </div>
                    <div class="tm-k-next">${next ? `▲ NEXT: ${((next.obj && (next.obj.name || next.obj.id)) || 'milestone')} @ ${next.threshold.toFixed(3)}` : '⟡ APEX'}</div>
                    <div class="tm-k-spark">
                        <div class="tm-spark-lbl">K-SCORE TREND</div>
                        ${this._svgSpark(this._history.kardashev_score, { w: 220, h: 32, color: '#fbbf24' })}
                    </div>
                </div>
                <div class="tm-k-right">
                    ${pillarEntries.length >= 3 ? this._svgRadar(pillarEntries, { size: 180, pad: 24 }) : '<div class="tm-empty">No pillars</div>'}
                    <div class="tm-k-pillars">
                        ${pillarEntries.map(p => `
                            <div class="tm-k-pillar">
                                <span class="tm-k-pillar-name">${p.label}</span>
                                <span class="tm-k-pillar-val">${Math.round(p.value * 100)}</span>
                            </div>
                        `).join('')}
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
        const sig = 'pop:' + sim;
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
        const sorted = Object.entries(byZone).sort((a, b) => b[1] - a[1]);
        const top = sorted.slice(0, 6);
        const other = sorted.slice(6).reduce((s, [, v]) => s + v, 0);
        const segments = top.map(([z, n]) => ({ label: z, value: n, color: zoneColors[z] || '#8a8aa0' }));
        if (other) segments.push({ label: 'other', value: other, color: '#4a4a5a' });

        host.innerHTML = `
            <div class="tm-row-layout tm-row-tight">
                <div class="tm-col tm-col-stat">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${sim.toLocaleString()}</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">${sorted.length} zones</div>
                </div>
                <div class="tm-col tm-col-donut">
                    ${this._svgDonut(segments, { size: 70, thick: 11 })}
                </div>
                <div class="tm-col tm-col-wide">
                    <div class="tm-pop-list">
                        ${top.slice(0, 4).map(([z, n]) => `
                            <div class="tm-pop-row">
                                <span class="tm-legend-dot" style="background:${zoneColors[z] || '#8a8aa0'}"></span>
                                <span class="tm-pop-lbl">${z.toUpperCase()}</span>
                                <span class="tm-pop-val">${n}</span>
                            </div>
                        `).join('')}
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
        if (typeof enterCity === 'function') enterCity();
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Terminal.init());
    } else {
        Terminal.init();
    }
}
