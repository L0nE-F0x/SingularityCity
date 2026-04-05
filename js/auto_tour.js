/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AUTO-TOUR / SCREENSAVER MODE (v1.0.0 — Phase 2b)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Idle-triggered hands-free camera tour that cycles through 8 landmark stops across the city.
   Designed for kiosk/demo use and ambient "set it and forget it" viewing.

   Behaviour
     • After `IDLE_MS` of no user input (pointer/wheel/key/touch), the tour auto-starts.
     • Camera glides to the first stop, holds for `HOLD_MS`, glides to the next — repeat forever.
     • Any real input cancels the tour and restores manual control.
     • `T` key toggles the tour on/off manually.
     • Refuses to start during: orbit mode, interior mode, macro view, tracking, X-ray,
       or while any modal overlay / pointer-events element is the active element.

   Implementation
     • Drives the camera purely via `Camera.targetX` / `Camera.targetZoom`. The existing
       lerp in `Camera.update()` handles smoothing, so no new easing code is needed.
     • Stops are rebuilt lazily on first start from `G.bldById` — if a landmark is missing
       the stop is skipped. If fewer than 3 stops survive, the tour aborts and logs a warning.
     • The DOM overlay is a tiny bottom-center banner that fades in when active. No PIXI.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const AutoTour = {
    active: false,
    _bootOk: false,
    embedSticky: false,  // When true (embed mode) the tour ignores user input and never auto-exits.

    // Tuning
    IDLE_MS: 60000,      // 60 s of no input → auto-start
    HOLD_MS: 7000,       // dwell time at each stop (camera.js lerps during this window too)
    MIN_STOPS: 3,        // abort start if fewer landmarks than this resolve

    // Tour stops — filled on first start. Each entry:
    //   { bldId, label, zoom, yOffset, xOffset }
    // `zoom` is the target Camera.zoom (1.0 = default). `yOffset` nudges camera up so the
    // landmark's label area sits mid-screen rather than at the extreme bottom.
    _stopDefs: [
        { bldId: 'mission_control',   label: 'Space Port',         zoom: 1.00, yOffset: -40 },
        { bldId: 'metro_dc',          label: 'Compute District',   zoom: 1.10, yOffset: -20 },
        { bldId: 'uni_main',          label: 'AI Academy',         zoom: 1.15, yOffset: -20 },
        { bldId: 'court_hearing',     label: 'AI Court',           zoom: 1.20, yOffset: -10 },
        { bldId: 'bld_1',             label: 'Legacy Systems',     zoom: 1.10, yOffset: -30 },
        { bldId: 'park',              label: 'Leaderboard Park',   zoom: 1.15, yOffset: -20 },
        { bldId: 'arena',             label: 'LMSYS Arena',        zoom: 1.10, yOffset: -20 },
        { bldId: 'visitor_monument',  label: 'Visitor Monument',   zoom: 1.25, yOffset:  -5 },
        { bldId: 'metro_longevity',   label: 'Longevity Wing',     zoom: 1.10, yOffset: -20 },
    ],
    _stops: [],           // resolved stops with concrete x/y/zoom

    // Runtime state
    _idx: 0,
    _stopStartedAt: 0,
    _lastInputAt: 0,
    _overlayEl: null,
    _labelEl: null,
    _savedZoom: 1,        // camera zoom at the moment we took control
    _savedTargetX: 0,
    _savedTargetY: 0,

    init() {
        if (this._bootOk) return;
        this._bootOk = true;
        this._lastInputAt = performance.now();

        // Build the DOM overlay once — hidden until active
        const el = document.createElement('div');
        el.id = 'autoTourOverlay';
        el.style.cssText = [
            'position:fixed',
            'left:50%',
            'bottom:96px',
            'transform:translateX(-50%)',
            'z-index:99998',
            'padding:10px 18px',
            'background:rgba(0,0,0,0.72)',
            'border:1px solid rgba(120,220,255,0.45)',
            'border-radius:6px',
            'color:#9fd',
            'font:12px/1.5 "Press Start 2P", "Courier New", monospace',
            'letter-spacing:0.5px',
            'text-shadow:0 0 4px rgba(120,220,255,0.6)',
            'pointer-events:none',
            'opacity:0',
            'transition:opacity 400ms ease',
            'text-align:center',
            'user-select:none',
            'backdrop-filter:blur(3px)',
            '-webkit-backdrop-filter:blur(3px)',
        ].join(';');
        el.innerHTML =
            '<div style="color:#8df;font-size:10px;margin-bottom:4px">◆ AUTO-TOUR</div>' +
            '<div id="autoTourLabel" style="color:#cfe;font-size:11px">—</div>' +
            '<div style="color:#69c;font-size:8px;margin-top:5px;letter-spacing:1px">MOVE MOUSE OR PRESS T TO EXIT</div>';
        document.body.appendChild(el);
        this._overlayEl = el;
        this._labelEl = el.querySelector('#autoTourLabel');

        // Input listeners — any genuine input bumps the idle timer AND cancels an active tour.
        // Use capture phase so we see the event even if downstream handlers stop propagation.
        const bump = () => this._onUserInput();
        window.addEventListener('pointerdown', bump, true);
        window.addEventListener('pointermove', (e) => {
            // Ignore micro-jitter (< 3px) so a resting hand doesn't keep the tour paused
            if (this._lastMoveX === undefined) { this._lastMoveX = e.clientX; this._lastMoveY = e.clientY; return; }
            const dx = e.clientX - this._lastMoveX;
            const dy = e.clientY - this._lastMoveY;
            if (dx * dx + dy * dy < 9) return;
            this._lastMoveX = e.clientX;
            this._lastMoveY = e.clientY;
            bump();
        }, true);
        window.addEventListener('wheel', bump, { capture: true, passive: true });
        window.addEventListener('touchstart', bump, { capture: true, passive: true });
        window.addEventListener('keydown', (e) => {
            // Manual toggle on T
            if ((e.key === 't' || e.key === 'T') &&
                !(e.target && (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.isContentEditable))) {
                e.preventDefault();
                this.toggle();
                return;
            }
            // Any other key just counts as input
            bump();
        }, true);
    },

    // Called from engine.update() once per frame
    update() {
        if (!this._bootOk) return;

        const now = performance.now();

        if (this.active) {
            this._tickActive(now);
            return;
        }

        // Idle watchdog — if enough quiet time has passed and we're in a safe state, start
        if (now - this._lastInputAt >= this.IDLE_MS && this._canStart()) {
            this.start();
        }
    },

    _canStart() {
        if (typeof G === 'undefined' || !G.app) return false;
        if (G.activeInterior) return false;
        if (G.viewMode === 'macro') return false;
        if (G.tracking) return false;
        if (typeof OrbitMode !== 'undefined' && (OrbitMode.active || OrbitMode._transitioning)) return false;
        if (typeof XRayMode !== 'undefined' && XRayMode.active) return false;
        // Don't auto-start while an overlay/modal is open (ov = overlay panels, modal = bigger dialogs)
        if (document.querySelector('.ov.open, .modal.open, #settingsPanel.open')) return false;
        // Don't auto-start during initial boot sequence
        if (typeof G !== 'undefined' && G.tick < 120) return false;
        return true;
    },

    toggle() {
        if (this.active) this.stop('toggle');
        else {
            if (!this._canStart()) {
                // Nudge the user so they understand why T did nothing
                if (typeof UI !== 'undefined' && UI.addToast) {
                    UI.addToast('Auto-tour unavailable in this mode');
                }
                return;
            }
            this.start();
        }
    },

    start() {
        if (this.active) return;
        // Self-gate — never start in a blocking mode, even if called directly
        if (!this._canStart()) return;

        // Build/refresh stops from live BLDS — skip any landmarks that don't exist
        this._stops = this._resolveStops();
        if (this._stops.length < this.MIN_STOPS) {
            console.warn('[AutoTour] Not enough landmarks resolved:', this._stops.length);
            return;
        }

        // Find the nearest stop to the current camera x so the first transition is short.
        const camCenterX = -Camera.x + (G.vpW / 2) / Camera.zoom;
        let bestIdx = 0;
        let bestDist = Infinity;
        for (let i = 0; i < this._stops.length; i++) {
            const d = Math.abs(this._stops[i].worldX - camCenterX);
            if (d < bestDist) { bestDist = d; bestIdx = i; }
        }
        // Start one *before* the nearest so the first visible transition is forward motion
        this._idx = (bestIdx - 1 + this._stops.length) % this._stops.length;

        this._savedZoom = Camera.targetZoom;
        this._savedTargetX = Camera.targetX;
        this._savedTargetY = Camera.targetY;

        this.active = true;
        this._stopStartedAt = performance.now();
        this._advance(); // immediately queue the first destination
        this._showOverlay();
    },

    stop(reason) {
        if (!this.active) return;
        this.active = false;
        this._hideOverlay();
        // Release camera control gracefully — keep current position but restore user zoom if it
        // drifted far from the original. We intentionally don't snap back; the user should see
        // where the tour ended so they can resume navigating from there.
        if (reason === 'toggle' && this._savedZoom) {
            Camera.targetZoom = this._savedZoom;
        }
    },

    _onUserInput() {
        this._lastInputAt = performance.now();
        // Embed mode: never exit the tour on user input — kiosks/iframes should loop forever.
        if (this.embedSticky) return;
        if (this.active) this.stop('input');
    },

    _tickActive(now) {
        // Safety — bail out if the player entered a blocking mode while the tour was running
        if (!this._canStart()) {
            this.stop('mode-change');
            return;
        }

        // Advance to next stop when hold time elapsed
        if (now - this._stopStartedAt >= this.HOLD_MS) {
            this._idx = (this._idx + 1) % this._stops.length;
            this._advance();
            this._stopStartedAt = now;
        }
    },

    // Push the current stop's target into Camera. Camera.update()'s lerp handles the glide.
    _advance() {
        const s = this._stops[this._idx];
        if (!s) return;
        // Center the landmark horizontally on the screen
        Camera.targetX = -(s.worldX) + (G.vpW / 2) / s.zoom;
        // Slight upward tilt so the label/rooftop sits in the upper-middle third
        const groundAnchor = G.groundY * (1 / s.zoom - 1);
        Camera.targetY = groundAnchor + (s.yOffset || 0);
        Camera.targetZoom = s.zoom;
        // Update the overlay label
        if (this._labelEl) this._labelEl.textContent = s.label;
    },

    _resolveStops() {
        const out = [];
        if (typeof G === 'undefined' || !G.bldById) return out;
        for (const def of this._stopDefs) {
            const b = G.bldById[def.bldId];
            if (!b) continue;
            out.push({
                bldId: def.bldId,
                label: def.label,
                worldX: b.x + b.w / 2 + (def.xOffset || 0),
                zoom: def.zoom || 1.0,
                yOffset: def.yOffset || 0,
            });
        }
        return out;
    },

    _showOverlay() {
        if (!this._overlayEl) return;
        // In embed mode, suppress the "MOVE MOUSE OR PRESS T TO EXIT" hint since it doesn't apply.
        if (this.embedSticky) {
            const hint = this._overlayEl.querySelector('div:last-child');
            if (hint && hint.textContent && hint.textContent.indexOf('MOVE MOUSE') !== -1) {
                hint.style.display = 'none';
            }
        }
        this._overlayEl.style.opacity = '1';
    },

    _hideOverlay() {
        if (!this._overlayEl) return;
        this._overlayEl.style.opacity = '0';
    },
};
