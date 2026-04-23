/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (v2.0 — Phase 2: Anchor Four Panels)
   A Bloomberg-inspired data dashboard that runs alongside the PixiJS pixel-art city. Same sim,
   no art. For users who want the data without the toy.

   Phase 1 delivered the plumbing: landing CTA, URL routing, D hotkey, shell + placeholders.
   Phase 2 populates the anchor-four panels with real data:
     • AI LABS         — sortable table of every lab, its models, avg benchmark, flagship ELO
     • ALIGNMENT ORGS  — 5 compact cards (MIRI/METR/Apollo/Redwood/FAR) from AlignmentForest.BLDS
     • LIVE NEWS       — merged feed: Hacker News AI stories + tech headlines (TechCrunch/Verge/VB)
     • EVENTS LOG      — scrolling sim events pulled from UI.scanLog[]

   Remaining panels keep their Phase-1 placeholders until Phase 3.

   All widgets use a per-panel signature cache so the 4 Hz refresh only rebuilds a panel body
   when the underlying data has actually changed. Sim keeps ticking regardless.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Terminal = {
    isOpen: false,
    _built: false,
    _pendingOpen: false,
    _loopTimer: null,
    _initialized: false,

    // Per-panel state
    _labsSort: { col: 'score', dir: 'desc' },
    _sigCache: {},          // Panel-id → last-rendered signature (cheap change-detection)

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

        // URL + preference — auto-bootstrap if explicit deep-link or saved preference
        let urlWantsTerminal = false;
        try {
            const p = new URLSearchParams(window.location.search);
            const mode = p.get('mode');
            if (mode === 'terminal' || mode === 'data') urlWantsTerminal = true;
        } catch (e) {}

        let prefWantsTerminal = false;
        try {
            if (localStorage.getItem('sc_terminal_pref') === '1') prefWantsTerminal = true;
        } catch (e) {}

        if (urlWantsTerminal || prefWantsTerminal) {
            this._pendingOpen = true;
            this._autoBootstrap();
        }
    },

    _autoBootstrap() {
        const tryBoot = () => {
            if (typeof enterCity === 'function') {
                const landing = document.getElementById('landing');
                if (landing && landing.classList.contains('exit')) return; // already booting
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
        try { localStorage.setItem('sc_terminal_pref', '1'); } catch (e) {}
    },

    close() {
        if (!this.isOpen) return;
        this.isOpen = false;
        document.body.classList.remove('terminal-mode');
        this._syncUrl(false);
        try { localStorage.removeItem('sc_terminal_pref'); } catch (e) {}
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
    // SHELL
    // Panels flagged `live: true` get populated by the refresh loop. Others keep Phase-1
    // placeholder cards until the next phase fills them.
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    PANELS: [
        { id: 'labs',       title: 'AI LABS',           size: 'lg', live: true,  hint: 'Sortable table — capability tier, compute, valuation, latest model, safety score' },
        { id: 'alignment',  title: 'ALIGNMENT ORGS',    size: 'md', live: true,  hint: 'Five cards — focus, lead, papers, funding' },
        { id: 'news',       title: 'LIVE NEWS',         size: 'md', live: true,  hint: 'Hacker News + tech headline feed, refreshed from live APIs' },
        { id: 'events',     title: 'EVENTS LOG',        size: 'md', live: true,  hint: 'Scrolling sim events — deals, releases, policy moves' },
        { id: 'compute',    title: 'COMPUTE INFRA',     size: 'md', phase: 'Phase 3', hint: 'Datacenter table · total EFLOPS sparkline · power draw' },
        { id: 'capital',    title: 'CAPITAL FLOWS',     size: 'md', phase: 'Phase 3', hint: 'VC → lab sankey · top-10 deal ticker' },
        { id: 'embassy',    title: 'EMBASSY RELATIONS', size: 'md', phase: 'Phase 3', hint: '6×6 country matrix · green/red trade cells' },
        { id: 'power',      title: 'POWER GRID',        size: 'sm', phase: 'Phase 3', hint: 'MW draw · source mix · reserve margin' },
        { id: 'robotics',   title: 'ROBOTICS',          size: 'sm', phase: 'Phase 3', hint: 'Units shipped · capability curve' },
        { id: 'longevity',  title: 'LONGEVITY',         size: 'sm', phase: 'Phase 3', hint: 'Treatments · biomarkers' },
        { id: 'agents',     title: 'AGENTS',            size: 'sm', phase: 'Phase 3', hint: 'Deployment · tasks per minute' },
        { id: 'supply',     title: 'SUPPLY CHAIN',      size: 'sm', phase: 'Phase 3', hint: 'Chips → fab → datacenter bottlenecks' },
        { id: 'kardashev',  title: 'KARDASHEV',         size: 'sm', phase: 'Phase 3', hint: 'Progress bar + milestones' },
        { id: 'population', title: 'POPULATION',        size: 'sm', phase: 'Phase 3', hint: 'NPC by role · commute flow' }
    ],

    _buildShell() {
        if (this._built) return;
        this._built = true;
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        const tag = (p) => p.live
            ? '<span class="tm-panel-live"><span class="tm-live-dot"></span>LIVE</span>'
            : `<span class="tm-panel-tag">${p.phase}</span>`;

        const body = (p) => p.live
            ? `<div class="tm-panel-body tm-body-${p.id}" id="tm-body-${p.id}"></div>`
            : `<div class="tm-panel-body"><div class="tm-placeholder"><div class="tm-placeholder-grid"></div><div class="tm-placeholder-hint">${p.hint}</div></div></div>`;

        const panelsHtml = this.PANELS.map(p => `
            <div class="tm-panel tm-size-${p.size}${p.live ? ' tm-panel-live-on' : ''}" data-panel="${p.id}">
                <div class="tm-panel-h">
                    <span class="tm-panel-title">${p.title}</span>
                    ${tag(p)}
                </div>
                ${body(p)}
            </div>
        `).join('');

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
                <span class="tm-foot-chunk tm-foot-mid">PHASE 2 · AI labs · news · events · alignment are live</span>
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

        // One-shot alignment render (data is static after init)
        this._renderAlignment();
    },

    // Click handlers — delegated from the shell root. Currently just the labs-table column sort.
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
                    // Sensible default: text cols ascend, numeric cols descend
                    this._labsSort.dir = (col === 'name' || col === 'region') ? 'asc' : 'desc';
                }
                this._sigCache.labs = null; // force re-render
                this._renderLabs();
            }
        });
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // UPDATE LOOP — 4 Hz
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _startUpdateLoop() {
        if (this._loopTimer) return;
        const tick = () => {
            if (!this.isOpen) return;
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
    },

    _refreshTopBar() {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && el.textContent !== val) el.textContent = val;
        };
        const G_ = (typeof G !== 'undefined') ? G : null;

        set('tm-tick', G_ ? String(G_.tick || 0) : '—');

        let citizens = '—';
        if (G_) {
            let n = 0;
            if (Array.isArray(G_.agents)) n += G_.agents.length;
            if (Array.isArray(G_.humans)) n += G_.humans.length;
            citizens = n.toLocaleString();
        }
        set('tm-citizens', citizens);

        set('tm-buildings', (typeof BLDS !== 'undefined') ? BLDS.length.toLocaleString() : '—');

        let kscale = '—';
        try {
            if (typeof Kardashev !== 'undefined') {
                if (typeof Kardashev.currentLevel === 'function') kscale = Kardashev.currentLevel().toFixed(3);
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
    // PANEL · AI LABS — sortable table of every lab
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    // Compute per-lab stats directly from the sim's live state. Doesn't rely on evolveCity()'s
    // `perLab` (which is local to engine.js) — iterates G.models instead so we always read
    // the latest data.
    _computeLabRows() {
        const rows = [];
        if (typeof LABS === 'undefined' || typeof G === 'undefined' || !Array.isArray(G.models)) return rows;

        const BM_ = (typeof BM !== 'undefined') ? BM : {};

        Object.keys(LABS).forEach(labId => {
            const lab = LABS[labId];
            if (!lab) return;
            const models = G.models.filter(m => m.lab === labId);
            if (!models.length && labId !== 'other') return; // skip truly empty labs

            // Average benchmark score across all models with any benchmark data
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

            // Is this the apex lab?
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
            const av = get(a), bv = get(b);
            if (av < bv) return -1 * mul;
            if (av > bv) return 1 * mul;
            return 0;
        });
    },

    _renderLabs() {
        const host = document.getElementById('tm-body-labs');
        if (!host) return;

        const rows = this._computeLabRows();
        const sorted = this._sortLabRows(rows);

        // Cheap change-detection: sig is the sort state + row count + a rolling hash of scores
        const sig = this._labsSort.col + ':' + this._labsSort.dir + ':' + sorted.length + ':' +
                    sorted.slice(0, 6).map(r => r.id + (r.score || 0).toFixed(1) + (r.elo || 0)).join('|');
        if (this._sigCache.labs === sig) return;
        this._sigCache.labs = sig;

        if (!sorted.length) {
            host.innerHTML = '<div class="tm-empty">Waiting for model data…</div>';
            return;
        }

        const arrow = (c) => {
            if (this._labsSort.col !== c) return '';
            return this._labsSort.dir === 'asc' ? ' ▴' : ' ▾';
        };

        const fmtScore = (s) => s == null ? '—' : s.toFixed(0);
        const fmtElo   = (e) => e == null ? '—' : e.toFixed(0);
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));

        const body = sorted.map((r, i) => `
            <tr>
                <td class="tm-rank">${i + 1}</td>
                <td class="tm-lab-name">
                    <span class="tm-lab-dot" style="background:${r.color}"></span>
                    ${escape(r.name)}
                    ${r.apex ? '<span class="tm-apex" title="Apex lab (highest ELO)">♕</span>' : ''}
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
    // PANEL · ALIGNMENT ORGS — 5 compact cards, static after init
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
    // PANEL · LIVE NEWS — merged HN + tech feed
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _collectNewsItems() {
        const items = [];
        // Hacker News (tagged so we can surface the score)
        if (typeof HNBlimps !== 'undefined' && Array.isArray(HNBlimps._stories)) {
            for (const s of HNBlimps._stories) {
                if (!s || !s.title) continue;
                items.push({
                    source: 'HN',
                    title: s.title,
                    url: s.url,
                    score: s.score,
                    comments: s.descendants
                });
            }
        }
        // Tech/RSS feeds
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
                        ? `<span class="tm-news-score" title="${n.comments || 0} comments">▲ ${n.score}</span>`
                        : '';
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
    // PANEL · EVENTS LOG — scrolling list of recent sim events
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderEvents() {
        const host = document.getElementById('tm-body-events');
        if (!host) return;

        const log = (typeof UI !== 'undefined' && Array.isArray(UI.scanLog)) ? UI.scanLog : [];
        const sig = 'e:' + log.length + ':' + (log[0] ? ((log[0].t || '') + (log[0].msg || '').slice(0, 24)) : '');
        if (this._sigCache.events === sig) return;
        this._sigCache.events = sig;

        if (!log.length) {
            host.innerHTML = '<div class="tm-empty">No events yet · fire a scan to populate</div>';
            return;
        }

        // UI.addLog prepends (newest first). Take up to 30.
        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
        // scanLog entries' msg is HTML (from existing UI). We keep HTML but classify by leading emoji.
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
