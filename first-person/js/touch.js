/* ══════════════════════════════════════════════════════════════════════════
   TOUCH CONTROLS — phones and tablets.

   The desktop controller is built on pointer lock: `Player.locked` gates
   movement, jump, head-bob and mouse-look, and `pointerlockchange` opens the
   pause menu the moment it is lost. No mobile browser implements pointer
   lock, so on a phone the city booted, rendered, and then stood perfectly
   still with the pause menu in your face. That is the whole of "FP doesn't
   work on mobile" — not a rendering problem.

   This module supplies the missing half:
     · a dynamic-origin thumb stick on the left (analog — a light push walks)
     · drag-anywhere-else look, geared separately from mouse sensitivity
     · on-screen E / jump / sprint, plus menu · map · free-fly · fullscreen
     · tap-to-interact when the crosshair already has something under it

   Everything routes through the SAME paths the keyboard uses: the buttons
   dispatch real KeyboardEvents and the stick writes Player.moveX/moveZ. No
   other module has to know it is being driven by a thumb.
   ══════════════════════════════════════════════════════════════════════════ */
import { G } from './state.js';

const STICK_R = 58;        // px — max knob travel from its origin
const STICK_DEAD = 6;      // px — ignore thumb jitter
const SPRINT_AT = 0.94;    // stick magnitude that auto-sprints
const TOUCH_GAIN = 2.1;    // touch look is coarser than a mouse
const TAP_MS = 260;        // below this (and TAP_PX) a drag counts as a tap
const TAP_PX = 14;

/* Coarse pointer + a real touchscreen. `hover: none` catches the handful of
   Android browsers that report a fine pointer for a stylus. `?touch=1` / `=0`
   force it either way, which is the only way to exercise this from a desktop
   browser's device emulation — emulation fakes touch events but not always
   the media queries. */
export function detectTouch() {
    try {
        const q = new URLSearchParams(location.search).get('touch');
        if (q === '1') return true;
        if (q === '0') return false;
        const coarse = matchMedia('(pointer: coarse)').matches || matchMedia('(hover: none)').matches;
        const hasTouch = (navigator.maxTouchPoints || 0) > 0 || 'ontouchstart' in window;
        return coarse && hasTouch;
    } catch (e) { return false; }
}

// Fire a real key event so every existing keydown handler works unchanged.
function key(code) {
    document.dispatchEvent(new KeyboardEvent('keydown', { code, key: code, bubbles: true, cancelable: true }));
    setTimeout(() => document.dispatchEvent(
        new KeyboardEvent('keyup', { code, key: code, bubbles: true })), 40);
}

export const Touch = {
    enabled: false,
    root: null,
    _stick: { id: null, ox: 0, oy: 0, x: 0, y: 0, mag: 0 },
    _look: { id: null, x: 0, y: 0, t: 0, moved: 0 },
    _sprintLatch: false,
    _els: {},
    // Held state for the two buttons free-fly reads as climb / descend.
    held: { interact: false, jump: false },

    init() {
        if (this.enabled) return;
        this.enabled = true;
        G.touchMode = true;
        document.body.classList.add('sc-touch');
        this._buildDOM();
        this._bind();
        this._prepCopy();
        this._injectPauseModes();
    },

    /* ── DOM ──────────────────────────────────────────────────────────────
       Built here rather than in index.html so the desktop page never carries
       a dozen dead nodes, and so the whole layer can be dropped by simply not
       calling init(). */
    _buildDOM() {
        const r = document.createElement('div');
        r.id = 'touchUI';
        r.className = 'hidden';   // shown by show(), once the start screen is gone
        r.innerHTML = [
            '<div id="tcStickRing"><div id="tcStickKnob"></div></div>',
            '<div id="tcHome"></div>',
            '<div id="tcPad">',
            '<button class="tc-btn tc-e" type="button" data-act="interact" aria-label="Interact">E</button>',
            '<button class="tc-btn tc-jump" type="button" data-act="jump" aria-label="Jump">&#9650;</button>',
            '<button class="tc-btn tc-sprint" type="button" data-act="sprint" aria-label="Sprint">&raquo;</button>',
            '</div>',
            '<div id="tcTop">',
            '<button class="tc-mini" type="button" data-act="menu" aria-label="Menu">&#9776;</button>',
            '<button class="tc-mini" type="button" data-act="map" aria-label="Minimap">&#128506;</button>',
            '<button class="tc-mini tc-fly" type="button" data-act="fly" aria-label="Free-fly" title="Free-fly">&#129413;</button>',
            '<button class="tc-mini tc-full" type="button" data-act="full" aria-label="Fullscreen"></button>',
            '</div>'
        ].join('');
        document.body.appendChild(r);
        this.root = r;
        this._els.ring = r.querySelector('#tcStickRing');
        this._els.knob = r.querySelector('#tcStickKnob');
        this._els.home = r.querySelector('#tcHome');
        this._els.sprint = r.querySelector('.tc-sprint');

        /* Rotate nudge. Dismissible, and dismissed for good once taken: a
           phone with rotation locked would otherwise be shown a wall it can
           never get past. */
        const rot = document.createElement('div');
        rot.id = 'tcRotate';
        rot.className = 'hidden';
        rot.innerHTML = '<div class="tc-rot-icon">&#128241;</div>' +
            '<div>Turn your device sideways<br><small>the city is built for landscape</small></div>' +
            '<button type="button" id="tcRotateSkip">Continue anyway</button>';
        document.body.appendChild(rot);
        this._els.rotate = rot;
        rot.querySelector('#tcRotateSkip').addEventListener('click', () => {
            this._rotateDismissed = true;
            rot.classList.add('hidden');
        });
    },

    _bind() {
        const cv = G.canvas;

        /* touchstart is bound to the CANVAS, not the window: every overlay in
           this app (HUD, panels, pause, terminal, tutorial, the touch pad
           itself) sits above it, so "the target is the canvas" is already the
           test for "not on a control". move/end go on the window so a drag
           that slides over a button still tracks. */
        cv.addEventListener('touchstart', e => this._start(e), { passive: false });
        window.addEventListener('touchmove', e => this._move(e), { passive: false });
        window.addEventListener('touchend', e => this._end(e), { passive: false });
        window.addEventListener('touchcancel', e => this._end(e), { passive: false });

        // iOS Safari pinch-zooms the page even with touch-action: none.
        ['gesturestart', 'gesturechange', 'gestureend'].forEach(t =>
            document.addEventListener(t, e => e.preventDefault(), { passive: false }));

        // ── action buttons ──
        this.root.querySelectorAll('[data-act]').forEach(btn => {
            const act = btn.dataset.act;
            const down = e => {
                e.preventDefault();
                e.stopPropagation();
                btn.classList.add('down');
                if (act === 'jump' || act === 'interact') this.held[act] = true;
                this._press(act, btn);
            };
            const up = e => {
                if (e) { e.preventDefault(); e.stopPropagation(); }
                btn.classList.remove('down');
                if (act === 'jump' || act === 'interact') this.held[act] = false;
            };
            btn.addEventListener('touchstart', down, { passive: false });
            btn.addEventListener('touchend', up, { passive: false });
            btn.addEventListener('touchcancel', () => up(), { passive: false });
            /* Hybrid devices and `?touch=1` on a desktop browser never fire
               touch events. Route their clicks to the same handler, but only
               when no touch has already claimed the button. */
            btn.addEventListener('click', e => {
                e.preventDefault();
                if (!btn.classList.contains('down')) { this._press(act, btn); }
                btn.classList.remove('down');
            });
        });

        // Portrait nudge
        const checkOrient = () => {
            if (!G.started) return;
            const portrait = innerHeight > innerWidth * 1.05;
            this._els.rotate.classList.toggle('hidden', !portrait || this._rotateDismissed);
        };
        window.addEventListener('resize', checkOrient);
        window.addEventListener('orientationchange', () => setTimeout(checkOrient, 250));
        this._checkOrient = checkOrient;
    },

    /* Start screen and hint bar are written for a keyboard. Rewrite them
       rather than adding a second copy to index.html that then has to be kept
       in sync with the first. */
    _prepCopy() {
        const ctl = document.querySelector('.start-controls');
        if (ctl) {
            ctl.innerHTML = [
                ['STICK', 'walk'], ['DRAG', 'look'], ['PUSH FAR', 'sprint'],
                ['E', 'enter / talk'], ['&#9650;', 'jump'], ['&#9776;', 'menu + panels'],
                ['&#128506;', 'minimap'], ['&#129413;', 'free-fly'],
                ['<i class="tc-ico-full"></i>', 'fullscreen'], ['TAP', 'what you see']
            ].map(kv => '<div><b>' + kv[0] + '</b> ' + kv[1] + '</div>').join('');
        }
        const foot = document.querySelector('.start-foot');
        if (foot) foot.textContent = 'Headphones recommended · turn your phone sideways · the top-right button goes fullscreen';
        const hint = document.getElementById('hintBar');
        if (hint) hint.innerHTML = 'Left thumb walks · drag to look · <b>E</b> interacts · <b>☰</b> menu · <b>🦅</b> free-fly';
    },

    // Shown once the start screen is gone (it would otherwise sit over ENTER).
    show() {
        this.root?.classList.remove('hidden');
        this._checkOrient?.();
    },

    // ── gesture handling ─────────────────────────────────────────────────
    /* Stick zone is the left 45% of the screen below a third of its height.
       Above that line is the clock/weather corner, and reaching up there with
       a left thumb is a look gesture, not a walk. */
    _inStickZone(x, y) {
        return x < innerWidth * 0.45 && y > innerHeight * 0.33;
    },

    _start(e) {
        if (!G.started || G.panelOpen || G.paused || G.terminalOpen) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (this._stick.id == null && this._inStickZone(t.clientX, t.clientY)) {
                this._stick.id = t.identifier;
                this._stick.ox = t.clientX;
                this._stick.oy = t.clientY;
                this._stick.x = 0; this._stick.y = 0; this._stick.mag = 0;
                this._els.ring.style.left = t.clientX + 'px';
                this._els.ring.style.top = t.clientY + 'px';
                this._els.ring.classList.add('on');
                this._els.home.classList.add('used');
                this._knob(0, 0);
            } else if (this._look.id == null) {
                this._look.id = t.identifier;
                this._look.x = t.clientX;
                this._look.y = t.clientY;
                this._look.t = performance.now();
                this._look.moved = 0;
            }
        }
        // any touch counts as activity for the idle screensaver
        if (G.tour && G.tour._lastInputAt != null) G.tour._lastInputAt = performance.now();
    },

    _move(e) {
        if (this._stick.id == null && this._look.id == null) return;
        e.preventDefault();
        for (const t of e.changedTouches) {
            if (t.identifier === this._stick.id) {
                let dx = t.clientX - this._stick.ox;
                let dy = t.clientY - this._stick.oy;
                const d = Math.hypot(dx, dy);
                /* Drag past the ring and the origin follows, instead of the
                   knob pinning to the rim. Without this a long walk slowly
                   loses its dead zone and the stick starts to feel sticky. */
                if (d > STICK_R) {
                    const k = (d - STICK_R) / d;
                    this._stick.ox += dx * k;
                    this._stick.oy += dy * k;
                    this._els.ring.style.left = this._stick.ox + 'px';
                    this._els.ring.style.top = this._stick.oy + 'px';
                    dx -= dx * k; dy -= dy * k;
                }
                const mag = Math.hypot(dx, dy);
                if (mag < STICK_DEAD) {
                    this._stick.x = 0; this._stick.y = 0; this._stick.mag = 0;
                } else {
                    // rescale so the dead zone doesn't cost travel
                    const s = (mag - STICK_DEAD) / (STICK_R - STICK_DEAD) / mag;
                    this._stick.x = Math.max(-1, Math.min(1, dx * s));
                    this._stick.y = Math.max(-1, Math.min(1, dy * s));
                    this._stick.mag = Math.min(1, Math.hypot(this._stick.x, this._stick.y));
                }
                this._knob(dx, dy);
            } else if (t.identifier === this._look.id) {
                const dx = t.clientX - this._look.x;
                const dy = t.clientY - this._look.y;
                this._look.x = t.clientX;
                this._look.y = t.clientY;
                this._look.moved += Math.abs(dx) + Math.abs(dy);
                const g = TOUCH_GAIN * (G.settings.touchSensitivity || 1);
                if (G.player) G.player.look(dx * g, dy * g);
            }
        }
    },

    _end(e) {
        for (const t of e.changedTouches) {
            if (t.identifier === this._stick.id) {
                this._stick.id = null;
                this._stick.x = 0; this._stick.y = 0; this._stick.mag = 0;
                this._els.ring.classList.remove('on');
            } else if (t.identifier === this._look.id) {
                const quick = performance.now() - this._look.t < TAP_MS && this._look.moved < TAP_PX;
                this._look.id = null;
                /* A tap only acts when E would have acted anyway. Firing it
                   unconditionally turned every look-adjust into a stray
                   building panel. When there is nothing to touch we do NOT
                   preventDefault, so the synthetic mousedown still reaches
                   interact.js and the blimp / moon raycast keeps working. */
                if (quick && G.started && !G.panelOpen && !G.paused) {
                    if ((G.interact && G.interact.target) || G.inside || G.ridingMetro) {
                        e.preventDefault();
                        key('KeyE');
                    }
                }
            }
        }
    },

    _knob(dx, dy) {
        const d = Math.hypot(dx, dy);
        const k = d > STICK_R ? STICK_R / d : 1;
        this._els.knob.style.transform =
            'translate(-50%,-50%) translate(' + (dx * k) + 'px,' + (dy * k) + 'px)';
    },

    // ── buttons ──────────────────────────────────────────────────────────
    _press(act, btn) {
        if (G.audio && G.audio.resume) { try { G.audio.resume(); } catch (_) { /* ignore */ } }
        switch (act) {
            // While flying these two are climb / descend and are read as held
            // state by FlyMode.update — firing E would open a building panel
            // from 400 m up.
            case 'interact': if (!G.flyMode) key('KeyE'); break;
            case 'jump': if (!G.flyMode && G.player) G.player.jump(); break;
            case 'sprint':
                this._sprintLatch = !this._sprintLatch;
                btn.classList.toggle('latched', this._sprintLatch);
                break;
            case 'menu':
                if (G.panelOpen) G.ui.closePanel();
                else if (G.paused) G.ui.hidePause();
                else G.ui.showPause();
                break;
            case 'map': {
                const mm = document.getElementById('minimap');
                if (mm) mm.classList.toggle('hidden');
                break;
            }
            case 'fly':
                // Call the mode directly. Synthesising KeyC is how the pause
                // grid used to do this, and on some mobile WebKits the
                // KeyboardEvent's `code` never sticks, so the handler no-ops.
                if (G.flyModeSys) G.flyModeSys.toggle();
                else key('KeyC');
                break;
            case 'full': this.toggleFullscreen(); break;
        }
    },

    /* Fullscreen is what actually makes a phone playable: it reclaims the URL
       bar (~90 px out of a 390 px-tall landscape viewport) and stops the
       pull-to-refresh gesture at the top edge. Orientation lock is best
       effort — Android honours it inside fullscreen, iOS ignores it. */
    async toggleFullscreen() {
        try {
            if (document.fullscreenElement || document.webkitFullscreenElement) {
                if (document.exitFullscreen) await document.exitFullscreen();
                else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
                return;
            }
            const el = document.documentElement;
            if (el.requestFullscreen) await el.requestFullscreen({ navigationUI: 'hide' });
            else if (el.webkitRequestFullscreen) el.webkitRequestFullscreen();
            try {
                if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape');
            } catch (_) { /* iOS / desktop reject this */ }
        } catch (_) { /* gesture rules vary by browser; never throw into the loop */ }
    },

    /* Every keyboard-only mode, as buttons. Without this the whole second half
       of the feature list — free-fly, orbit, x-ray, holomap, the tour, the
       terminal — is unreachable on a device with no keys. Free-fly also has
       its own HUD button (data-act=fly); the pause entry is the same toggle
       for people who look here first.

       Call the mode APIs directly rather than synthesising KeyboardEvents:
       on several mobile WebKits `new KeyboardEvent({ code: 'KeyC' })` leaves
       `event.code` empty, so the desktop keydown handler never fires. */
    _injectPauseModes() {
        const grid = document.querySelector('#pauseMenu .pause-grid');
        if (!grid || document.getElementById('tcModeFly')) return;
        const before = document.getElementById('pauseGoPixi') || null;
        const add = (id, label, run) => {
            const b = document.createElement('button');
            b.type = 'button';
            b.id = id;
            b.textContent = label;
            b.onclick = () => {
                if (G.ui) G.ui.hidePause();
                // one frame later, so the menu is gone before the mode grabs
                // the camera and re-reads G.paused
                setTimeout(run, 30);
            };
            grid.insertBefore(b, before);
        };
        add('tcModeFly', '🦅 Free-fly', () => G.flyModeSys?.toggle?.());
        add('tcModeOrbit', '🛰 Orbit', () => G.orbitModeSys?.toggle?.());
        add('tcModeTour', '🎬 Auto-tour', () => G.tour?.toggle?.());
        add('tcModeXray', '🔭 X-ray', () => G.xrayModeSys?.toggle?.());
        add('tcModeHolo', '🌐 Holomap', () => G.holomap?.toggle?.());
        add('tcModeTerm', '💻 Terminal', () => G.terminal?.toggle?.());
    },

    /* Free-fly rebinds the pad: E becomes descend, ▲ becomes climb. Relabel
       so the buttons say what they now do. */
    setFlyLabels(on) {
        if (!this.root) return;
        const e = this.root.querySelector('.tc-e');
        const j = this.root.querySelector('.tc-jump');
        const f = this.root.querySelector('.tc-fly');
        if (e) e.innerHTML = on ? '&#9660;' : 'E';
        if (j) j.innerHTML = '&#9650;';
        if (f) {
            f.classList.toggle('latched', !!on);
            f.setAttribute('aria-label', on ? 'Land' : 'Free-fly');
            f.title = on ? 'Land' : 'Free-fly';
        }
        this.root.classList.toggle('flying', !!on);
    },

    // Stick state for consumers that own the camera themselves (free-fly).
    axes() {
        return {
            x: this._stick.x,
            z: -this._stick.y,
            mag: this._stick.mag,
            sprint: this._sprintLatch || this._stick.mag > SPRINT_AT
        };
    },

    /* Called from Player.update. Writing straight into the player each frame
       (rather than the player reaching in here) keeps this module free of any
       knowledge of walk speed, sprint or collision. */
    apply(p) {
        /* Drop the stick when something takes the screen. Desktop gets this
           for free: opening a panel releases pointer lock, which is the same
           flag movement is gated on. Touch has no lock to lose, so a stick
           still held when a building card opened kept walking the player
           through the city behind it. */
        if (G.panelOpen || G.paused || G.terminalOpen) {
            if (this._stick.id != null) {
                this._stick.id = null;
                this._els.ring.classList.remove('on');
            }
            this._stick.x = 0; this._stick.y = 0; this._stick.mag = 0;
            this._look.id = null;
            this.held.jump = false;
            this.held.interact = false;
        }
        p.moveX = this._stick.x;
        p.moveZ = -this._stick.y;      // screen-down is backwards
        p.touchSprint = this._sprintLatch || this._stick.mag > SPRINT_AT;
    }
};
