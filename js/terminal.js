/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   TERMINAL MODE (v1.0 — Phase 1 Shell)
   A Bloomberg-inspired data dashboard that runs alongside the PixiJS pixel-art city. Same sim,
   no art. For users who want the data without the toy.

   Phase 1 scope:
     • Landing-page dual CTA (pixel city / terminal) and deep-link ?mode=terminal
     • Fullscreen dashboard shell with top status bar + 14 placeholder panels + footer
     • D hotkey toggles between pixel and terminal views without touching the sim
     • Preference persisted in localStorage — returning users land in their preferred mode
     • 4 Hz DOM update loop (not 60 Hz) for the status bar
     • Sim keeps running in the background either way

   Future phases fill the panel bodies with real widgets (AI labs table, live news, capital
   flows sankey, embassy matrix, etc.). Phase 1 is plumbing only.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Terminal = {
    isOpen: false,
    _built: false,
    _pendingOpen: false,
    _loopTimer: null,
    _initialized: false,

    // Called once at script load. Binds the D hotkey, reads the URL, and if a deep-link or
    // stored preference is present, auto-bootstraps the app straight into terminal mode
    // (skipping the pixel-art landing page).
    init() {
        if (this._initialized) return;
        this._initialized = true;

        // ─── D HOTKEY ───
        window.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            const tag = (e.target && e.target.tagName) || '';
            if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
            if (e.target && e.target.isContentEditable) return;
            if (e.key !== 'd' && e.key !== 'D') return;
            // Skip when any modal overlay is open
            const ov = document.querySelector('.ov.open, .modal.open');
            if (ov) return;
            e.preventDefault();
            this.toggle();
        });

        // ─── URL + PREFERENCE ───
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
            // Auto-bootstrap: skip the landing page entirely. Wait until enterCity() is
            // defined (engine.js loads last), then fire it — the open() call happens at
            // the end of enterCity() via tryAutoOpen().
            this._autoBootstrap();
        }
    },

    _autoBootstrap() {
        const tryBoot = () => {
            if (typeof enterCity === 'function') {
                enterCity();
            } else {
                // engine.js not loaded yet — retry shortly
                setTimeout(tryBoot, 40);
            }
        };
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => setTimeout(tryBoot, 0));
        } else {
            setTimeout(tryBoot, 0);
        }
    },

    // Called from the end of enterCity() in engine.js. If a pending open flag is set
    // (from URL, preference, or enterTerminal()), flip the mode now that the sim is live.
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

    toggle() {
        if (this.isOpen) this.close();
        else this.open();
    },

    _syncUrl(terminalOn) {
        try {
            const url = new URL(window.location.href);
            if (terminalOn) url.searchParams.set('mode', 'terminal');
            else url.searchParams.delete('mode');
            window.history.replaceState(null, '', url);
        } catch (e) {}
    },

    // ─── SHELL ─────────────────────────────────────────────────────────────────────
    // 14 panels on a 12-col grid. Sizes are hints — grid-auto-flow:dense packs them.
    // Bodies are placeholders in Phase 1. Each panel's `tag` shows which phase fills it.
    PANELS: [
        { id: 'labs',       title: 'AI LABS',            size: 'lg', phase: 'Phase 2', hint: 'Sortable table — capability tier, compute, valuation, latest model, safety score' },
        { id: 'alignment',  title: 'ALIGNMENT ORGS',     size: 'md', phase: 'Phase 2', hint: 'Five cards — focus, lead, papers, funding' },
        { id: 'news',       title: 'LIVE NEWS',          size: 'md', phase: 'Phase 2', hint: 'Newspaper headlines + HN blimp feed, sentiment-coloured' },
        { id: 'events',     title: 'EVENTS LOG',         size: 'md', phase: 'Phase 2', hint: 'Scrolling sim events — deals, releases, policy moves' },
        { id: 'compute',    title: 'COMPUTE INFRA',      size: 'md', phase: 'Phase 3', hint: 'Datacenter table · total EFLOPS sparkline · power draw' },
        { id: 'capital',    title: 'CAPITAL FLOWS',      size: 'md', phase: 'Phase 3', hint: 'VC → lab sankey · top-10 deal ticker' },
        { id: 'embassy',    title: 'EMBASSY RELATIONS',  size: 'md', phase: 'Phase 3', hint: '6×6 country matrix · green/red trade cells' },
        { id: 'power',      title: 'POWER GRID',         size: 'sm', phase: 'Phase 3', hint: 'MW draw · source mix · reserve margin' },
        { id: 'robotics',   title: 'ROBOTICS',           size: 'sm', phase: 'Phase 3', hint: 'Units shipped · capability curve' },
        { id: 'longevity',  title: 'LONGEVITY',          size: 'sm', phase: 'Phase 3', hint: 'Treatments · biomarkers' },
        { id: 'agents',     title: 'AGENTS',             size: 'sm', phase: 'Phase 3', hint: 'Deployment · tasks per minute' },
        { id: 'supply',     title: 'SUPPLY CHAIN',       size: 'sm', phase: 'Phase 3', hint: 'Chips → fab → datacenter bottlenecks' },
        { id: 'kardashev',  title: 'KARDASHEV',          size: 'sm', phase: 'Phase 3', hint: 'Progress bar + milestones' },
        { id: 'population', title: 'POPULATION',         size: 'sm', phase: 'Phase 3', hint: 'NPC by role · commute flow' }
    ],

    _buildShell() {
        if (this._built) return;
        this._built = true;
        const shell = document.getElementById('terminal-shell');
        if (!shell) return;

        const panelsHtml = this.PANELS.map(p => `
            <div class="tm-panel tm-size-${p.size}" data-panel="${p.id}">
                <div class="tm-panel-h">
                    <span class="tm-panel-title">${p.title}</span>
                    <span class="tm-panel-tag">${p.phase}</span>
                </div>
                <div class="tm-panel-body">
                    <div class="tm-placeholder">
                        <div class="tm-placeholder-grid"></div>
                        <div class="tm-placeholder-hint">${p.hint}</div>
                    </div>
                </div>
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
                <span class="tm-foot-chunk tm-foot-mid">PHASE 1 · shell only — panels populate in subsequent ships</span>
                <span class="tm-foot-chunk" id="tm-version">—</span>
            </div>
        `;

        // Version badge (once)
        const v = document.getElementById('tm-version');
        if (v) {
            const ver = (typeof G !== 'undefined' && G.VERSION) ? G.VERSION : '';
            v.textContent = ver ? ('v' + ver) : '';
        }
    },

    // ─── UPDATE LOOP ───────────────────────────────────────────────────────────────
    // Refresh the top bar at 4 Hz. DOM updates are cheap if we only touch changed cells
    // (the `set` helper compares textContent before writing). Phase 2+ panel widgets
    // will hook into this same loop.
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
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el && el.textContent !== val) el.textContent = val;
        };
        const G_ = (typeof G !== 'undefined') ? G : null;

        set('tm-tick', G_ ? String(G_.tick || 0) : '—');

        // Citizens: sum of agents + humans (if they exist)
        let citizens = '—';
        if (G_) {
            let n = 0;
            if (Array.isArray(G_.agents)) n += G_.agents.length;
            if (Array.isArray(G_.humans)) n += G_.humans.length;
            citizens = n.toLocaleString();
        }
        set('tm-citizens', citizens);

        set('tm-buildings', (typeof BLDS !== 'undefined') ? BLDS.length.toLocaleString() : '—');

        // Kardashev reading — defensive, module may not be present
        let kscale = '—';
        try {
            if (typeof Kardashev !== 'undefined') {
                if (typeof Kardashev.currentLevel === 'function') kscale = Kardashev.currentLevel().toFixed(3);
                else if (typeof Kardashev.level === 'number') kscale = Kardashev.level.toFixed(3);
            }
        } catch (e) {}
        set('tm-kardashev', kscale);

        let fps = '—';
        try {
            if (G_ && G_.app && G_.app.ticker) fps = G_.app.ticker.FPS.toFixed(0);
        } catch (e) {}
        set('tm-fps', fps);

        set('tm-clock', new Date().toISOString().substr(11, 8) + ' UTC');
    }
};

if (typeof window !== 'undefined') {
    window.Terminal = Terminal;

    // Landing-page counterpart to enterCity(). Same bootstrap, just flips the pending
    // flag so Terminal.open() fires at the end of enterCity().
    window.enterTerminal = function () {
        Terminal._pendingOpen = true;
        if (typeof enterCity === 'function') enterCity();
    };

    // Bind hotkey + read URL now that the script has loaded.
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => Terminal.init());
    } else {
        Terminal.init();
    }
}
