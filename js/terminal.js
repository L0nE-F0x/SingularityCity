/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (v3.0 — Phase 3: Full Dashboard)
   A Bloomberg-inspired data dashboard that runs alongside the PixiJS pixel-art city. Same sim,
   no art. For users who want the data without the toy.

   Phase 1 delivered the plumbing: landing CTA, URL routing, D hotkey, shell + placeholders.
   Phase 2 populated the anchor-four: AI Labs, Alignment Orgs, Live News, Events Log.
   Phase 3 populates the remaining ten:
     • COMPUTE INFRA   — operational datacenters, sorted by MW (from DC_FACILITIES)
     • CAPITAL FLOWS   — top-10 VC deal ticker (from API.vcDeals)
     • EMBASSY RELATIONS — 6×6 bilateral matrix (AI policy + trade alignment heuristic)
     • POWER GRID      — supply/demand balance + source mix bars (PowerZone)
     • ROBOTICS        — cumulative units + capability index (RoboticsZone)
     • LONGEVITY       — compounds screened / trials / genomes (LongevityZone)
     • AGENTS          — active agents + tasks/tools per hour (AgentsZone.agentStats)
     • SUPPLY CHAIN    — inventory bars + bottleneck indicators (SupplyChain + SUPPLY_CHAIN)
     • KARDASHEV       — 0.7→1.0 progress bar + pillar breakdown (Kardashev.score + pillars)
     • POPULATION      — roles grouped by workplace zone (NPCHousing.REGISTRY)

   Every panel uses a signature cache so the 4 Hz refresh only rewrites DOM when the underlying
   data has actually changed. Sim keeps ticking regardless.
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
        { id: 'compute',    title: 'COMPUTE INFRA',     size: 'md', live: true, hint: 'Datacenter table · total EFLOPS sparkline · power draw' },
        { id: 'capital',    title: 'CAPITAL FLOWS',     size: 'md', live: true, hint: 'VC → lab sankey · top-10 deal ticker' },
        { id: 'embassy',    title: 'EMBASSY RELATIONS', size: 'md', live: true, hint: '6×6 country matrix · green/red trade cells' },
        { id: 'power',      title: 'POWER GRID',        size: 'sm', live: true, hint: 'MW draw · source mix · reserve margin' },
        { id: 'robotics',   title: 'ROBOTICS',          size: 'sm', live: true, hint: 'Units shipped · capability curve' },
        { id: 'longevity',  title: 'LONGEVITY',         size: 'sm', live: true, hint: 'Treatments · biomarkers' },
        { id: 'agents',     title: 'AGENTS',            size: 'sm', live: true, hint: 'Deployment · tasks per minute' },
        { id: 'supply',     title: 'SUPPLY CHAIN',      size: 'sm', live: true, hint: 'Chips → fab → datacenter bottlenecks' },
        { id: 'kardashev',  title: 'KARDASHEV',         size: 'sm', live: true, hint: 'Progress bar + milestones' },
        { id: 'population', title: 'POPULATION',        size: 'sm', live: true, hint: 'NPC by role · commute flow' }
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
                <span class="tm-foot-chunk tm-foot-mid">PHASE 3 · all 14 panels live · sim running behind shell</span>
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
        // Phase 2 — anchor four
        this._renderLabs();
        this._renderNews();
        this._renderEvents();
        // Alignment is static — rendered once on build
        // Phase 3 — remaining ten (signature cache keeps static panels cheap)
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
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · COMPUTE INFRA — headline MW + top 8 operational datacenters
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

        const sig = 'c:' + op.length + ':' + totalMW + ':' + fabs.length + ':' + construction;
        if (this._sigCache.compute === sig) return;
        this._sigCache.compute = sig;

        const escape = (s) => String(s || '').replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&#39;' }[c]));
        const top = op.slice().sort((a, b) => (b.power_mw || 0) - (a.power_mw || 0)).slice(0, 8);

        host.innerHTML = `
            <div class="tm-head-row">
                <div class="tm-stat-big">
                    <span class="tm-stat-num">${totalMW.toLocaleString()}</span>
                    <span class="tm-stat-unit">MW</span>
                </div>
                <div class="tm-head-meta">
                    <div><span class="tm-head-n">${op.length}</span> DCs</div>
                    <div><span class="tm-head-n">${fabs.length}</span> fabs</div>
                    <div><span class="tm-head-n">${construction}</span> building</div>
                </div>
            </div>
            <div class="tm-scroll tm-compute-body">
                <table class="tm-table">
                    <thead><tr>
                        <th>FACILITY</th>
                        <th class="tm-num">MW</th>
                    </tr></thead>
                    <tbody>
                        ${top.map(d => `
                            <tr>
                                <td class="tm-compute-name" style="box-shadow:inset 2px 0 0 ${d.color || '#8a8aa0'}">${escape(d.name)}</td>
                                <td class="tm-num">${(d.power_mw || 0).toLocaleString()}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · CAPITAL FLOWS — live VC deal ticker
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
                ${deals.slice(0, 12).map(d => {
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
    // PANEL · EMBASSY RELATIONS — 6×6 bilateral matrix
    // Scores are a curated heuristic (AI policy + trade alignment), 0–100. Not tracked by the
    // sim, so this is static data — can be swapped for a Supabase feed later.
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
            return 50; // unknown → neutral
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
    // PANEL · POWER GRID — supply MW + source mix + reserve margin
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

        const sig = 'p:' + supply.toFixed(0) + ':' + demand.toFixed(0) + ':' + sources.length;
        if (this._sigCache.power === sig) return;
        this._sigCache.power = sig;

        const total = sources.reduce((s, x) => s + (x.mw || 0), 0) || 1;
        const srcColors = {
            solar: '#facc15',
            wind: '#22d3ee',
            nuclear: '#a78bfa',
            coal: '#78716c',
            hydro: '#60a5fa',
            gas: '#fb923c'
        };
        const reserveColor = reserveP >= 10 ? '#34d399' : reserveP >= 0 ? '#fbbf24' : '#f87171';

        host.innerHTML = `
            <div class="tm-head-row">
                <div class="tm-stat-big">
                    <span class="tm-stat-num">${Math.round(supply).toLocaleString()}</span>
                    <span class="tm-stat-unit">MW</span>
                </div>
                <div class="tm-head-meta">
                    <div><span class="tm-head-n">${Math.round(demand).toLocaleString()}</span> demand</div>
                    <div><span class="tm-head-n" style="color:${reserveColor}">${reserveP.toFixed(0)}%</span> reserve</div>
                </div>
            </div>
            <div class="tm-bars tm-bars-dense">
                ${sources.map(s => {
                    const pct = (s.mw || 0) / total * 100;
                    const color = srcColors[s.id] || srcColors[(s.name || '').toLowerCase()] || '#8a8aa0';
                    return `
                        <div class="tm-bar-row">
                            <span class="tm-bar-lbl">${s.name || s.id}</span>
                            <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${pct.toFixed(1)}%;background:${color}"></div></div>
                            <span class="tm-bar-val">${(s.mw || 0).toLocaleString()}</span>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · ROBOTICS — cumulative units + capability index
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

        const sig = 'r:' + units + ':' + facilities;
        if (this._sigCache.robotics === sig) return;
        this._sigCache.robotics = sig;

        // Capability index — soft log curve so it grows visibly in early game
        const capability = units > 0 ? Math.min(100, Math.log10(units + 1) * 22) : 0;

        host.innerHTML = `
            <div class="tm-stat-block">
                <div class="tm-stat-big">
                    <span class="tm-stat-num">${units.toLocaleString()}</span>
                    <span class="tm-stat-unit">units</span>
                </div>
                <div class="tm-stat-sub">lifetime · ${facilities} facilities</div>
            </div>
            <div class="tm-meter">
                <div class="tm-meter-top">
                    <span class="tm-meter-lbl">CAPABILITY</span>
                    <span class="tm-meter-val">${capability.toFixed(0)}</span>
                </div>
                <div class="tm-meter-track">
                    <div class="tm-meter-fill" style="width:${capability.toFixed(1)}%"></div>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · LONGEVITY — compounds / trials / genomes triplet
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

        const sig = 'l:' + compounds + ':' + trials + ':' + genomes;
        if (this._sigCache.longevity === sig) return;
        this._sigCache.longevity = sig;

        const fmt = (n) => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        host.innerHTML = `
            <div class="tm-stat-grid tm-stat-grid-3">
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-m">${fmt(compounds)}</span>
                    <span class="tm-stat-lbl">compounds<br>screened</span>
                </div>
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-m">${trials}</span>
                    <span class="tm-stat-lbl">active<br>trials</span>
                </div>
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-m">${fmt(genomes)}</span>
                    <span class="tm-stat-lbl">genomes<br>sequenced</span>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · AGENTS — deployed count + tasks/tools/errors
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

        const sig = 'a:' + active + ':' + tasks + ':' + tools + ':' + err.toFixed(2);
        if (this._sigCache.agents === sig) return;
        this._sigCache.agents = sig;

        const fmtK = (n) => n >= 1000 ? (n / 1000).toFixed(1) + 'K' : n.toString();

        host.innerHTML = `
            <div class="tm-stat-block">
                <div class="tm-stat-big">
                    <span class="tm-stat-num">${active.toLocaleString()}</span>
                    <span class="tm-stat-unit">agents</span>
                </div>
                <div class="tm-stat-sub">active · ${s.swarmSize || 0} swarms</div>
            </div>
            <div class="tm-stat-grid tm-stat-grid-3">
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-s">${fmtK(tasks)}</span>
                    <span class="tm-stat-lbl">tasks/hr</span>
                </div>
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-s">${fmtK(tools)}</span>
                    <span class="tm-stat-lbl">tool calls/hr</span>
                </div>
                <div class="tm-stat-cell">
                    <span class="tm-stat-num tm-stat-num-s" style="color:${err > 0.4 ? '#f87171' : '#34d399'}">${err.toFixed(2)}%</span>
                    <span class="tm-stat-lbl">error rate</span>
                </div>
            </div>
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · SUPPLY CHAIN — inventory utilization + bottleneck indicators
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
        const sig = 's:' + keys.map(k => k + ':' + ((inv[k] && inv[k].stock) | 0)).join('|') + '|b:' + bottlenecks.length;
        if (this._sigCache.supply === sig) return;
        this._sigCache.supply = sig;

        const names = {
            gpu_h100: 'H100 GPU',
            gpu_b200: 'B200 GPU',
            helium: 'Helium',
            hbm_memory: 'HBM',
            coolant_sys: 'Coolant',
            electricity: 'Power'
        };
        const pctColor = (p) => p >= 60 ? '#34d399' : p >= 30 ? '#fbbf24' : '#f87171';

        const rows = keys.map(k => {
            const v = inv[k] || {};
            const cap = v.capacity || 1;
            const pct = Math.max(0, Math.min(100, (v.stock || 0) / cap * 100));
            return { k, pct, stock: v.stock || 0 };
        }).sort((a, b) => a.pct - b.pct); // most stressed first

        host.innerHTML = `
            <div class="tm-bars tm-bars-dense">
                ${rows.slice(0, 4).map(r => `
                    <div class="tm-bar-row">
                        <span class="tm-bar-lbl">${names[r.k] || r.k}</span>
                        <div class="tm-bar-track"><div class="tm-bar-fill" style="width:${r.pct.toFixed(0)}%;background:${pctColor(r.pct)}"></div></div>
                        <span class="tm-bar-val">${r.pct.toFixed(0)}%</span>
                    </div>
                `).join('')}
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
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · KARDASHEV — progress bar 0.7→1.0 + pillar breakdown
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

        // Map 0.700..1.000 → 0..100 for the progress bar
        const pct = Math.max(0, Math.min(100, ((score - 0.7) / 0.3) * 100));

        const sig = 'k:' + score.toFixed(4);
        if (this._sigCache.kardashev === sig) return;
        this._sigCache.kardashev = sig;

        // Find next milestone above current score
        let next = null;
        if (Array.isArray(K.MILESTONES)) {
            for (const m of K.MILESTONES) {
                const t = (typeof m.score === 'number') ? m.score : m.threshold;
                if (typeof t === 'number' && t > score) { next = m; break; }
            }
        }

        // Pillars — may be { energy: number, ... } or { energy: { score: num } }
        const pillars = K.pillars || {};
        const pillarEntries = Object.entries(pillars).map(([k, v]) => {
            const val = (typeof v === 'number') ? v : (v && typeof v.score === 'number') ? v.score : 0;
            return { k, val };
        });

        host.innerHTML = `
            <div class="tm-head-row">
                <div class="tm-stat-big">
                    <span class="tm-stat-unit">K</span>
                    <span class="tm-stat-num">${score.toFixed(3)}</span>
                </div>
                <div class="tm-head-meta">
                    <div class="tm-k-next">${next ? `▲ ${next.name || next.id || 'next'}` : '⟡ apex'}</div>
                </div>
            </div>
            <div class="tm-kprog">
                <div class="tm-kprog-track"><div class="tm-kprog-fill" style="width:${pct.toFixed(1)}%"></div></div>
                <div class="tm-kprog-labels"><span>0.700</span><span>1.000</span></div>
            </div>
            ${pillarEntries.length ? `
                <div class="tm-k-pillars">
                    ${pillarEntries.map(p => `
                        <div class="tm-k-pillar">
                            <span class="tm-k-pillar-name">${p.k.slice(0, 6).toUpperCase()}</span>
                            <span class="tm-k-pillar-val">${Math.round((p.val <= 1 ? p.val * 100 : p.val))}</span>
                        </div>
                    `).join('')}
                </div>
            ` : ''}
        `;
    },

    // ═══════════════════════════════════════════════════════════════════════════════════════════
    // PANEL · POPULATION — role count + top workplace zones
    // ═══════════════════════════════════════════════════════════════════════════════════════════

    _renderPopulation() {
        const host = document.getElementById('tm-body-population');
        if (!host) return;
        const NH = (typeof NPCHousing !== 'undefined' && Array.isArray(NPCHousing.REGISTRY)) ? NPCHousing : null;
        const reg = NH ? NH.REGISTRY : [];

        // Sim population (live)
        let sim = 0;
        if (typeof G !== 'undefined') {
            if (Array.isArray(G.agents)) sim += G.agents.length;
            if (Array.isArray(G.humans)) sim += G.humans.length;
        }

        const sig = 'pop:' + reg.length + ':' + sim;
        if (this._sigCache.population === sig) return;
        this._sigCache.population = sig;

        if (!reg.length) {
            host.innerHTML = `
                <div class="tm-stat-block">
                    <div class="tm-stat-big">
                        <span class="tm-stat-num">${sim.toLocaleString()}</span>
                        <span class="tm-stat-unit">NPCs</span>
                    </div>
                    <div class="tm-stat-sub">roster unavailable</div>
                </div>
            `;
            return;
        }

        // Group registry by workplace zone prefix
        const byZone = {};
        for (const n of reg) {
            const w = String(n.workplace || 'other').toLowerCase();
            let zone = w.split(/[_:]/)[0];
            if (zone === 'dc' || zone === 'bld') zone = 'compute';
            if (zone === 'other' && w.includes('court')) zone = 'court';
            byZone[zone] = (byZone[zone] || 0) + 1;
        }
        const sorted = Object.entries(byZone).sort((a, b) => b[1] - a[1]).slice(0, 5);

        host.innerHTML = `
            <div class="tm-stat-block">
                <div class="tm-stat-big">
                    <span class="tm-stat-num">${sim.toLocaleString()}</span>
                    <span class="tm-stat-unit">NPCs</span>
                </div>
                <div class="tm-stat-sub">${reg.length} named roles</div>
            </div>
            <div class="tm-pop-list">
                ${sorted.map(([z, n]) => `
                    <div class="tm-pop-row">
                        <span class="tm-pop-lbl">${z.toUpperCase()}</span>
                        <span class="tm-pop-val">${n}</span>
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
