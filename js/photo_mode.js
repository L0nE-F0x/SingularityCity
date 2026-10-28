/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PHOTO MODE (v1.0.0)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Compose and capture a postcard of the city. Every piece of UI steps aside, a small control
   strip sets the look's time of day and weather, a frame preset letterboxes the shot, and SNAP
   renders the canvas at native resolution (optionally inside a pixel postcard border) to save,
   copy or post on X. CLIP records 6 s of the canvas, with an optional time-lapse and drift.

   Opened from the 📷 toolbar button or P. Esc (or P) closes it and restores the camera, the
   weather and the clock exactly. Refuses in the Terminal, the Holomap and Orbit.

   The time scrub is look-only. While it is set, the look's entry points run with the chosen
   day phase: Environment.update (the pixel palette, sky, backdrop, neon and reflections; the
   classic sky, sun, moon and lights), PixelArt.interiorFrame (the pixel sky and lamps indoors),
   CityAmbience.update and Shadows.update. G.getDayPhase is shadowed only for the duration of
   those calls (port water and puddles read it in there). Every routine — Entities, NPC housing,
   vendors, interior avatars — still runs on the real clock, so the city keeps its people.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PhotoMode = {
    active: false,
    lookDp: null, // chosen day phase, or null = the real clock
    wx: null, // pinned weather key, or null = the city's own weather
    frame: 'free',
    postcard: false,
    grid: false,
    bubbles: true,
    drift: 0, // -1 ← · 0 off · 1 →
    timelapse: false,
    scale: 1, // export scale: 1 = native, 2 = every pixel doubled
    sound: false, // record the city's sound into clips (off: X wants AAC, Linux Chrome has Opus)
    hideUI: false,
    collapsed: false,

    CLIP_MS: 6000,
    TIMELAPSE_SPAN: 0.375, // 9 hours of look clock across one clip

    FRAMES: [
        ['free', 'FREE', null],
        ['16:9', '16:9', 16 / 9],
        ['9:16', '9:16', 9 / 16],
        ['1:1', '1:1', 1],
        ['4:5', '4:5', 4 / 5],
    ],
    TIMES: [
        ['dawn', 'DAWN', 0.258],
        ['noon', 'NOON', 0.5],
        ['golden', 'GOLDEN', 0.75],
        ['dusk', 'DUSK', 0.8],
        ['night', 'NIGHT', 0.92],
    ],
    WEATHER: [
        ['clear', 'Clear', '☀️'],
        ['partly_cloudy', 'Partly cloudy', '⛅'],
        ['overcast', 'Overcast', '☁️'],
        ['fog', 'Fog', '🌫️'],
        ['drizzle', 'Drizzle', '🌦️'],
        ['rain', 'Rain', '🌧️'],
        ['thunderstorm', 'Thunderstorm', '⛈️'],
        ['snow', 'Snow', '❄️'],
        ['cherry', 'Cherry blossoms', '🌸'],
        ['leaves', 'Autumn leaves', '🍂'],
    ],
    ZONE_NAMES: {
        port: 'Trade Port',
        desert: 'Space Port',
        npc_housing: 'Worker Blocks',
        compute: 'Compute District',
        residential: 'Residential Sector',
        university: 'AI Academy',
        court: 'Civic Center',
        jail: 'AI Detention Center',
        city_park: 'Central Park',
        vcrow: 'VC Row',
        nightlife: 'Neon Nightlife',
        estates: "Billionaire's Row",
        backbone: 'The Backbone',
        robotics: 'Robotics Factory',
        longevity: 'Longevity Wing',
        agents: 'Agent District',
        suburbia: 'Suburbia',
        power: 'Power Grid',
    },

    _root: null,
    _saved: null,
    _wrapped: null,
    _hooks: null,
    _shotReq: null,
    _rec: null,
    _last: null, // last capture { canvas, place, dp }
    _place: '',
    _lightA: 0,
    _tick: 0,

    /* ═══════════════════════════════════════════════════════════════ */
    init() {
        if (this._inited) return;
        this._inited = true;
        // Capture phase on window, registered at load: runs before AutoTour's (T) capture
        // listener and every bubble-phase hotkey (D terminal, ` debug), so nothing can switch
        // modes underneath an open photo.
        window.addEventListener('keydown', (e) => this._onKey(e), true);
        window.addEventListener('resize', () => {
            if (this.active) this._layout();
        });
    },

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    _blockReason() {
        if (typeof G === 'undefined' || !G.app || !G.app.stage) return 'boot';
        const wrap = document.getElementById('gameWrap');
        if (!wrap || !wrap.classList.contains('active')) return 'boot';
        if (document.body.classList.contains('terminal-mode'))
            return 'Close the Terminal first — photo mode shoots the city.';
        if (G.viewMode === 'macro')
            return 'Switch back to Street View first — photo mode shoots the city, not the Holomap.';
        if (typeof OrbitMode !== 'undefined' && (OrbitMode.active || OrbitMode._transitioning))
            return 'Come back down from orbit first — photo mode works on the street and inside buildings.';
        return null;
    },

    enter() {
        if (this.active) return;
        const why = this._blockReason();
        if (why) {
            if (why !== 'boot' && typeof UI !== 'undefined' && UI.addToast) UI.addToast('📷 ' + why);
            return;
        }
        if (typeof AutoTour !== 'undefined' && AutoTour.active && AutoTour.stop) AutoTour.stop('photo');

        const E = typeof Environment !== 'undefined' ? Environment : null;
        const IZ = this._iz();
        this._saved = {
            interior: G.activeInterior || null,
            cam:
                typeof Camera !== 'undefined'
                    ? {
                          x: Camera.x,
                          y: Camera.y,
                          tx: Camera.targetX,
                          ty: Camera.targetY,
                          z: Camera.zoom,
                          tz: Camera.targetZoom,
                      }
                    : null,
            iz: IZ ? { tx: IZ.tx, ty: IZ.ty, x: IZ.x, y: IZ.y, layer: IZ.layer } : null,
            wx: E
                ? {
                      weather: E.weather,
                      weatherIntensity: E.weatherIntensity,
                      weatherTargetIntensity: E.weatherTargetIntensity,
                      weatherPending: E.weatherPending,
                      nextWeatherTick: E.nextWeatherTick,
                  }
                : null,
            hidden: [],
        };
        this.active = true;
        this.lookDp = null;
        this.wx = null;
        this.drift = 0;
        this.hideUI = false;
        // On a phone the full strip covers half the view: open folded until the user unfolds it.
        if (!this._foldChosen) this.collapsed = window.innerHeight <= 500 || window.innerWidth <= 560;
        this._place = '';
        this._build();
        document.body.classList.add('pm-on');
        this._root.hidden = false;
        this._root.classList.toggle('pm-classic', !this._pixel());
        const btn = document.getElementById('btnPhoto');
        if (btn) btn.classList.add('on');

        this._muteTaps(true);

        // Other explorers' cursors and reactions don't belong in a postcard.
        if (typeof Multiplayer !== 'undefined') {
            for (const k of ['_ghostLayer', '_reactionGfx']) {
                const o = Multiplayer[k];
                if (o && !o.destroyed) {
                    this._saved.hidden.push([o, o.renderable]);
                    o.renderable = false;
                }
            }
        }

        this._hooks = {
            pre: () => this._tickPreLoop(),
            mid: () => this._tickPreRender(),
            post: () => this._tickPost(),
        };
        const P = PIXI.UPDATE_PRIORITY;
        G.app.ticker.add(this._hooks.pre, null, P.HIGH);
        G.app.ticker.add(this._hooks.mid, null, P.LOW + 2);
        G.app.ticker.add(this._hooks.post, null, P.UTILITY);

        if (!this.bubbles) this._hideBubbles(true);
        this._layout();
        this._syncAll();
        if (typeof SND !== 'undefined' && SND.playTone) {
            SND.playTone(660, 'square', 0.05, 0.03);
            setTimeout(() => SND.playTone && SND.playTone(990, 'square', 0.06, 0.03), 60);
        }
    },

    exit() {
        if (!this.active) return;
        if (this._rec) this._stopClip(true);
        this._closeResult();
        this.active = false;

        // Clock
        this.lookDp = null;
        this._unwrapClock();
        // Weather (snow cover and wet streets melt and dry on their own)
        if (this.wx) this._restoreWeather();
        this.wx = null;
        // Bubbles
        if (!this.bubbles) this._showBubbles();
        // Hooks and listeners
        if (this._hooks && G.app) {
            G.app.ticker.remove(this._hooks.pre);
            G.app.ticker.remove(this._hooks.mid);
            G.app.ticker.remove(this._hooks.post);
        }
        this._hooks = null;
        this._muteTaps(false);
        const s = this._saved || { hidden: [] };
        for (const [o, r] of s.hidden) if (o && !o.destroyed) o.renderable = r;

        // Camera — only when we're still where we started.
        const sameInterior = (G.activeInterior || null) === s.interior;
        if (sameInterior && !s.interior && s.cam && typeof Camera !== 'undefined' && !G.tracking) {
            Camera.x = s.cam.x;
            Camera.y = s.cam.y;
            Camera.targetX = s.cam.tx;
            Camera.targetY = s.cam.ty;
            Camera.zoom = s.cam.z;
            Camera.targetZoom = s.cam.tz;
            Camera._momentumX = Camera._momentumY = 0;
        }
        const IZ = this._iz();
        if (sameInterior && s.iz && IZ && IZ.layer === s.iz.layer) {
            IZ.tx = s.iz.tx;
            IZ.ty = s.iz.ty;
            IZ.x = s.iz.x;
            IZ.y = s.iz.y;
        }

        document.body.classList.remove('pm-on');
        if (this._root) this._root.hidden = true;
        const btn = document.getElementById('btnPhoto');
        if (btn) btn.classList.remove('on');
        this._saved = null;
    },

    // Clicks on the city (a building's panel, a citizen, a door) are muted while composing.
    // Pixi only notifies interactive objects, and the stage isn't one, so a capture listener
    // there never fires: the taps are dropped at the event boundary instead. pointerdown still
    // flows, so dragging and the interior pan keep working.
    _muteTaps(on) {
        const B = G.app && G.app.renderer && G.app.renderer.events && G.app.renderer.events.rootBoundary;
        if (!B) return;
        if (on && !this._tapMute) {
            const own = Object.prototype.hasOwnProperty.call(B, 'dispatchEvent');
            const orig = B.dispatchEvent;
            const MUTE = { pointertap: 1, click: 1, tap: 1, rightclick: 1 };
            const wrapper = function (e, type) {
                if (MUTE[type || (e && e.type)]) return;
                return orig.call(this, e, type);
            };
            B.dispatchEvent = wrapper;
            this._tapMute = { B, own, orig, wrapper };
        } else if (!on && this._tapMute) {
            const m = this._tapMute;
            if (m.B.dispatchEvent === m.wrapper) {
                if (m.own) m.B.dispatchEvent = m.orig;
                else delete m.B.dispatchEvent;
            }
            this._tapMute = null;
        }
    },

    /* ═══ Look clock ═════════════════════════════════════════════════ */
    _night(dp) {
        return dp > 0.83 || dp < 0.25;
    },

    _realDp() {
        return typeof G !== 'undefined' && G.getDayPhase ? G.getDayPhase() : 0.5;
    },

    _dp() {
        return this.lookDp == null ? this._realDp() : this.lookDp;
    },

    setTime(dp) {
        if (dp == null) {
            this.lookDp = null;
            this._unwrapClock();
        } else {
            if (this.lookDp == null && typeof G !== 'undefined' && G.lightLayer)
                this._lightA = G.lightLayer.alpha;
            this.lookDp = ((dp % 1) + 1) % 1;
            this._wrapClock();
        }
        this._syncTime();
        this._postcardDirty = true;
    },

    _wrapClock() {
        if (this._wrapped) return;
        this._wrapped = [];
        const self = this;
        const night = this._night;
        const scoped = (obj, name, remap) => {
            if (!obj || typeof obj[name] !== 'function') return;
            const orig = obj[name];
            const wrapper = function () {
                const L = self.lookDp;
                if (L == null) return orig.apply(this, arguments);
                const args = remap ? remap(arguments, L) : arguments;
                const real = G.getDayPhase;
                G.getDayPhase = function () {
                    return L;
                };
                try {
                    return orig.apply(this, args);
                } finally {
                    G.getDayPhase = real;
                }
            };
            obj[name] = wrapper;
            self._wrapped.push({ obj, name, orig, wrapper });
        };
        if (typeof Environment !== 'undefined') scoped(Environment, 'update', (a, L) => [L, night(L), a[2]]);
        if (typeof PixelArt !== 'undefined') scoped(PixelArt, 'interiorFrame');
        if (typeof CityAmbience !== 'undefined') scoped(CityAmbience, 'update', (a, L) => [L, night(L)]);
        if (typeof Shadows !== 'undefined') scoped(Shadows, 'update', (a, L) => [L]);
    },

    _unwrapClock() {
        if (!this._wrapped) return;
        for (const w of this._wrapped) {
            // If something wrapped over us since, our wrapper stays in its chain as a
            // pass-through (lookDp is null), which is harmless.
            if (w.obj[w.name] === w.wrapper) w.obj[w.name] = w.orig;
        }
        this._wrapped = null;
        if (typeof Environment !== 'undefined') Environment._lastSky = null;
    },

    /* ═══ Weather ════════════════════════════════════════════════════ */
    setWeather(key) {
        const E = typeof Environment !== 'undefined' ? Environment : null;
        if (!E) return;
        if (!key) {
            if (this.wx) this._restoreWeather();
            this.wx = null;
        } else {
            this.wx = key;
            this._pinWeather(true);
        }
        this._syncWeather();
    },

    _pinWeather(changed) {
        const E = Environment;
        const k = this.wx;
        if (E.weather !== k) {
            E.weather = k;
            changed = true;
        }
        if (changed) {
            if (E.rainDrops) E.rainDrops.length = 0;
            if (E.snowFlakes) E.snowFlakes.length = 0;
            if (E.petals) E.petals.length = 0;
        }
        E.weatherPending = null;
        const info = E._WEATHER_INFO && E._WEATHER_INFO[k];
        E.weatherTargetIntensity = info ? info.peak : 0;
        E.nextWeatherTick = G.tick + 100000;
        // A postcard shouldn't wait a minute for the snow to settle or the street to soak.
        if (k === 'snow') E._snowAccum = Math.min(1, (E._snowAccum || 0) + 0.012);
        if (k === 'rain' || k === 'drizzle' || k === 'thunderstorm')
            E._wetness = Math.min(1, (E._wetness || 0) + 0.012);
    },

    _restoreWeather() {
        const E = typeof Environment !== 'undefined' ? Environment : null;
        const s = this._saved && this._saved.wx;
        if (!E || !s) return;
        const changed = E.weather !== s.weather;
        E.weather = s.weather;
        E.weatherIntensity = s.weatherIntensity;
        E.weatherTargetIntensity = s.weatherTargetIntensity;
        E.weatherPending = s.weatherPending;
        E.nextWeatherTick = Math.max(s.nextWeatherTick || 0, (G.tick || 0) + 600);
        if (changed) {
            if (E.rainDrops) E.rainDrops.length = 0;
            if (E.snowFlakes) E.snowFlakes.length = 0;
            if (E.petals) E.petals.length = 0;
        }
    },

    /* ═══ Per-frame hooks ════════════════════════════════════════════ */
    // Before the game loop: weather pin, drift, the time-lapse clock.
    _tickPreLoop() {
        if (!this.active) return;
        if (this.wx && typeof Environment !== 'undefined') this._pinWeather(false);
        const r = this._rec;
        if (r && r.timelapse) {
            const p = Math.min(1, (performance.now() - r.t0) / this.CLIP_MS);
            this.lookDp = (((r.dp0 + p * this.TIMELAPSE_SPAN) % 1) + 1) % 1;
            this._wrapClock();
        }
        if (
            this.drift &&
            !G.activeInterior &&
            !G.trainFocus &&
            !G.tracking &&
            typeof Camera !== 'undefined'
        ) {
            Camera.targetX -= (this.drift * 0.8) / Math.max(0.25, Camera.zoom || 1);
        }
    },

    // After the game loop, before the skin and the render: bubbles, lights, idle timers.
    _tickPreRender() {
        if (!this.active) return;
        this._tick++;
        const L = this.lookDp;
        if (L != null) {
            const n = this._night(L);
            this._lightA += ((n ? 1 : 0) - this._lightA) * 0.08;
            if (G.lightLayer) G.lightLayer.alpha = this._lightA;
            if (typeof Entities !== 'undefined' && typeof Entities._headlightAlpha === 'number') {
                const E = typeof Environment !== 'undefined' ? Environment : null;
                const bad =
                    E &&
                    ((E.isRainy && E.isRainy()) ||
                        E.weather === 'snow' ||
                        E.weather === 'overcast' ||
                        E.weather === 'fog');
                const want = n ? 1 : bad ? 0.5 : 0;
                Entities._headlightAlpha += (want - Entities._headlightAlpha) * 0.08;
            }
        }
        if (!this.bubbles) this._hideBubbles(this._tick % 30 === 0);
        if (this._tick % 60 === 0) {
            if (typeof AutoTour !== 'undefined') AutoTour._lastInputAt = performance.now();
            this._syncTime();
            const place = this._placeName();
            if (place !== this._place) {
                this._place = place;
                this._postcardDirty = true;
            }
        }
        if (this.postcard && this._postcardDirty) this._drawPreview();
    },

    // After the render, while the drawing buffer is still valid: stills and clip frames.
    _tickPost() {
        if (this._shotReq) {
            const req = this._shotReq;
            this._shotReq = null;
            try {
                req.resolve(this._grab(req.rect));
            } catch (e) {
                req.reject(e);
            }
        }
        if (this._rec) this._recFrame();
    },

    _hideBubbles(all) {
        if (all && G.charRefs) {
            for (const id in G.charRefs) {
                const r = G.charRefs[id];
                if (r && r.chat && !r.chat.destroyed) r.chat.renderable = false;
            }
        }
        const m = typeof Interior !== 'undefined' ? Interior.activeModule : null;
        if (m && G.activeInterior && Array.isArray(m.bubbles)) {
            for (const b of m.bubbles) {
                const c = b && (b.cont || b.c || b);
                if (c && c.renderable !== undefined && !c.destroyed) c.renderable = false;
            }
        }
    },

    _showBubbles() {
        if (G.charRefs) {
            for (const id in G.charRefs) {
                const r = G.charRefs[id];
                if (r && r.chat && !r.chat.destroyed) r.chat.renderable = true;
            }
        }
        const m = typeof Interior !== 'undefined' ? Interior.activeModule : null;
        if (m && Array.isArray(m.bubbles)) {
            for (const b of m.bubbles) {
                const c = b && (b.cont || b.c || b);
                if (c && c.renderable !== undefined && !c.destroyed) c.renderable = true;
            }
        }
    },

    /* ═══ Capture ════════════════════════════════════════════════════ */
    _res() {
        return (G.app && G.app.renderer && G.app.renderer.resolution) || 1;
    },

    // The frame in CSS px, centred in the viewport.
    _frameRect() {
        const W = G.vpW || window.innerWidth;
        const H = G.vpH || window.innerHeight;
        const f = this.FRAMES.find((x) => x[0] === this.frame);
        const a = f && f[2];
        if (!a) return { x: 0, y: 0, w: W, h: H };
        let w = W;
        let h = W / a;
        if (h > H) {
            h = H;
            w = H * a;
        }
        w = Math.floor(w);
        h = Math.floor(h);
        return { x: Math.floor((W - w) / 2), y: Math.floor((H - h) / 2), w, h };
    },

    // Device-pixel source rect for a CSS rect, even-sized (video encoders want even dims).
    _srcRect(r) {
        const res = this._res();
        const view = G.app.view;
        let sw = Math.min(view.width, Math.round(r.w * res));
        let sh = Math.min(view.height, Math.round(r.h * res));
        sw -= sw % 2;
        sh -= sh % 2;
        const sx = Math.max(0, Math.min(view.width - sw, Math.round(r.x * res)));
        const sy = Math.max(0, Math.min(view.height - sh, Math.round(r.y * res)));
        return { sx, sy, sw, sh, res };
    },

    // Resolved by _tickPost on the next frame. If the ticker is stalled (a hidden tab), render
    // once by hand and copy straight after, still inside the same task.
    _requestFrame(rect) {
        return new Promise((resolve, reject) => {
            const req = { rect, resolve, reject };
            this._shotReq = req;
            setTimeout(() => {
                if (this._shotReq !== req) return;
                this._shotReq = null;
                try {
                    G.app.renderer.render(G.app.stage);
                    resolve(this._grab(rect));
                } catch (e) {
                    reject(e);
                }
            }, 1200);
        });
    },

    // Copies the just-rendered frame (same tick as the render, so the WebGL drawing buffer is
    // still valid) over the page's own backdrop: the canvas is transparent where the classic
    // sky is a CSS gradient on #viewport, and interiors set that background too.
    _grab(rect) {
        const s = this._srcRect(rect || this._frameRect());
        const c = document.createElement('canvas');
        c.width = s.sw;
        c.height = s.sh;
        const ctx = c.getContext('2d');
        this._paintBackdrop(ctx, s);
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(G.app.view, s.sx, s.sy, s.sw, s.sh, 0, 0, s.sw, s.sh);
        return c;
    },

    // s: { sy (source top, device px), res, k (output scale, default 1) }. The computed styles
    // are re-read at most every 250 ms so a recording doesn't force a style pass every frame.
    _paintBackdrop(ctx, s) {
        const W = ctx.canvas.width;
        const H = ctx.canvas.height;
        const now = performance.now();
        let bd = this._bdCache;
        if (!bd || now - bd.t > 250) {
            const vp = document.getElementById('viewport');
            const cs = vp ? getComputedStyle(vp) : null;
            bd = this._bdCache = {
                t: now,
                body: this._solid(getComputedStyle(document.body).backgroundColor) || '#060610',
                col: cs ? this._solid(cs.backgroundColor) : null,
                stops: cs ? this._parseGradient(cs.backgroundImage) : null,
                vh: (vp && vp.clientHeight) || G.vpH,
            };
        }
        const k = s.k || 1;
        ctx.fillStyle = bd.body;
        ctx.fillRect(0, 0, W, H);
        if (bd.col) {
            ctx.fillStyle = bd.col;
            ctx.fillRect(0, 0, W, H);
        }
        if (bd.stops) {
            // The gradient spans the viewport element; place it for this crop.
            const top = -s.sy * k;
            const g = ctx.createLinearGradient(0, top, 0, top + bd.vh * s.res * k);
            for (const st of bd.stops) {
                try {
                    g.addColorStop(st.pos, st.color);
                } catch (e) {
                    /* unparseable stop */
                }
            }
            ctx.fillStyle = g;
            ctx.fillRect(0, 0, W, H);
        }
    },

    _solid(c) {
        if (!c || c === 'transparent') return null;
        const m = /rgba?\(([^)]+)\)/.exec(c);
        if (m) {
            const p = m[1].split(',').map((x) => parseFloat(x));
            if (p.length > 3 && p[3] === 0) return null;
        }
        return c;
    },

    _parseGradient(s) {
        if (!s || s === 'none') return null;
        const m = /linear-gradient\((.*)\)\s*$/.exec(s);
        if (!m) return null;
        const parts = [];
        let depth = 0;
        let cur = '';
        for (const ch of m[1]) {
            if (ch === '(') depth++;
            if (ch === ')') depth--;
            if (ch === ',' && depth === 0) {
                parts.push(cur.trim());
                cur = '';
            } else cur += ch;
        }
        if (cur.trim()) parts.push(cur.trim());
        if (parts.length && /^(to\s|-?[\d.]+(deg|rad|turn|grad))/.test(parts[0])) parts.shift();
        if (parts.length < 2) return null;
        const stops = parts.map((p) => {
            const pm = /^(.*?)(?:\s+(-?[\d.]+)%)?$/.exec(p);
            return { color: pm[1].trim(), pos: pm[2] != null ? parseFloat(pm[2]) / 100 : null };
        });
        stops[0].pos = stops[0].pos == null ? 0 : stops[0].pos;
        stops[stops.length - 1].pos = stops[stops.length - 1].pos == null ? 1 : stops[stops.length - 1].pos;
        for (let i = 1; i < stops.length - 1; i++) {
            if (stops[i].pos != null) continue;
            let j = i;
            while (stops[j].pos == null) j++;
            const a = stops[i - 1].pos;
            const b = stops[j].pos;
            for (let k = i; k < j; k++) stops[k].pos = a + ((b - a) * (k - i + 1)) / (j - i + 1);
        }
        for (const st of stops) st.pos = Math.max(0, Math.min(1, st.pos));
        return stops;
    },

    // Scale (nearest neighbour, every pixel doubled) and the postcard border.
    _compose(src, k) {
        let out = src;
        if (k !== 1) {
            out = document.createElement('canvas');
            out.width = src.width * k;
            out.height = src.height * k;
            const c = out.getContext('2d');
            c.imageSmoothingEnabled = false;
            c.drawImage(src, 0, 0, out.width, out.height);
        }
        if (this.postcard) {
            const u = this._unit() * k;
            this._drawPostcard(out.getContext('2d'), out.width, out.height, u, this._caption());
        }
        return out;
    },

    // One postcard "pixel": two CSS px (one art pixel at zoom 1), in device pixels.
    _unit() {
        return Math.max(1, Math.round(2 * this._res()));
    },

    async snap() {
        if (!this.active || this._rec || this._busy) return;
        this._busy = true;
        try {
            if (this.postcard) await this._fonts();
            this._flash();
            this._shutter();
            const raw = await this._requestFrame(this._frameRect());
            const out = this._compose(raw, this.scale);
            this._last = {
                canvas: out,
                kind: 'png',
                place: this._placeName(),
                dp: this._dp(),
                wx: this._wxNow(),
            };
            this._showResult();
        } catch (e) {
            this._note('Capture failed: ' + (e && e.message ? e.message : e));
        } finally {
            this._busy = false;
        }
    },

    _flash() {
        const f = this._root && this._root.querySelector('.pm-flash');
        if (!f) return;
        f.classList.remove('go');
        void f.offsetWidth;
        f.classList.add('go');
    },

    _shutter() {
        if (typeof SND === 'undefined' || !SND.playTone) return;
        SND.playTone(1700, 'square', 0.03, 0.05);
        setTimeout(() => SND.playTone && SND.playTone(620, 'square', 0.05, 0.04), 45);
    },

    /* ═══ Clip ═══════════════════════════════════════════════════════ */
    // H.264 in MP4 is what X takes; ask for it by codec, because a bare 'video/mp4' lets Chrome
    // put VP9 in the box. With sound, AAC when the browser has it (Linux Chrome doesn't), else
    // Opus, which plays everywhere but may not upload to X.
    _pickMime(withAudio) {
        if (typeof MediaRecorder === 'undefined' || !MediaRecorder.isTypeSupported) return '';
        const v = withAudio
            ? [
                  'video/mp4;codecs=avc1.640028,mp4a.40.2',
                  'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
                  'video/mp4;codecs=avc1,mp4a.40.2',
                  'video/mp4;codecs=avc1.640028,opus',
                  'video/mp4;codecs=avc1,opus',
                  'video/webm;codecs=vp9,opus',
                  'video/webm;codecs=vp8,opus',
                  'video/webm',
              ]
            : [
                  'video/mp4;codecs=avc1.640028',
                  'video/mp4;codecs=avc1.4D401F',
                  'video/mp4;codecs=avc1.42E01E',
                  'video/mp4;codecs=avc1',
                  'video/webm;codecs=vp9',
                  'video/webm;codecs=vp8',
                  'video/webm',
              ];
        return v.find((t) => MediaRecorder.isTypeSupported(t)) || '';
    },

    // The city's sound, mixed into one track: SND's master bus plus the music element.
    _audioTrack() {
        if (!this.sound || typeof SND === 'undefined' || !SND.ctx || !SND.masterGain) return null;
        try {
            const ctx = SND.ctx;
            if (ctx.state !== 'running') return null;
            const dest = ctx.createMediaStreamDestination();
            SND.masterGain.connect(dest);
            let musicSrc = null;
            const el = SND.musicEl;
            if (el && !el.paused && typeof el.captureStream === 'function') {
                try {
                    const ms = el.captureStream();
                    if (ms.getAudioTracks().length) {
                        musicSrc = ctx.createMediaStreamSource(ms);
                        const g = ctx.createGain();
                        g.gain.value = el.volume;
                        musicSrc.connect(g).connect(dest);
                        musicSrc._pmGain = g;
                    }
                } catch (e) {
                    musicSrc = null;
                }
            }
            const track = dest.stream.getAudioTracks()[0];
            if (!track) return null;
            return {
                track,
                stop() {
                    try {
                        SND.masterGain.disconnect(dest);
                    } catch (e) {
                        /* already gone */
                    }
                    if (musicSrc) {
                        try {
                            musicSrc.disconnect();
                            musicSrc._pmGain.disconnect();
                        } catch (e) {
                            /* already gone */
                        }
                    }
                    track.stop();
                },
            };
        } catch (e) {
            return null;
        }
    },

    startClip() {
        if (!this.active || this._rec || this._busy) return;
        if (typeof MediaRecorder === 'undefined' || !G.app.view.captureStream) {
            this._note('This browser cannot record the canvas — try Chrome, Edge or Firefox.');
            return;
        }
        const fr = this._frameRect();
        const s = this._srcRect(fr);
        // Encoders and X both like ≤ 1080p: cap the long side at 1920.
        const k = Math.min(1, 1920 / Math.max(s.sw, s.sh));
        const ow = Math.max(2, Math.round(s.sw * k) - (Math.round(s.sw * k) % 2));
        const oh = Math.max(2, Math.round(s.sh * k) - (Math.round(s.sh * k) % 2));
        const rc = document.createElement('canvas');
        rc.width = ow;
        rc.height = oh;
        const rctx = rc.getContext('2d');
        rctx.imageSmoothingEnabled = k < 1;
        if (k < 1) rctx.imageSmoothingQuality = 'high';
        let overlay = null;
        if (this.postcard) {
            overlay = document.createElement('canvas');
            overlay.width = ow;
            overlay.height = oh;
            const u = Math.max(1, Math.round(this._unit() * k));
            this._drawPostcard(overlay.getContext('2d'), ow, oh, u, this._caption(this.timelapse));
        }
        const stream = rc.captureStream(30);
        const audio = this._audioTrack();
        if (audio) stream.addTrack(audio.track);
        const mime = this._pickMime(!!audio);
        let rec;
        try {
            rec = new MediaRecorder(stream, mime ? { mimeType: mime, videoBitsPerSecond: 12e6 } : undefined);
        } catch (e) {
            if (audio) audio.stop();
            this._note('Recording failed to start: ' + e.message);
            return;
        }
        const chunks = [];
        rec.ondataavailable = (e) => {
            if (e.data && e.data.size) chunks.push(e.data);
        };
        const r = {
            rec,
            rc,
            rctx,
            s,
            ow,
            oh,
            overlay,
            audio,
            chunks,
            mime: rec.mimeType || mime || 'video/webm',
            t0: performance.now(),
            timelapse: this.timelapse,
            dp0: this._dp(),
            lookBefore: this.lookDp,
            place: this._placeName(),
            wx: this._wxNow(),
        };
        rec.onstop = () => this._clipDone(r);
        this._rec = r;
        // Paint the first frame now so the stream never starts black.
        this._recFrame();
        rec.start(250);
        this._root.classList.add('pm-recording');
        this._syncRec();
    },

    _recFrame() {
        const r = this._rec;
        if (!r) return;
        const s = r.s;
        this._paintBackdrop(r.rctx, { sy: s.sy, res: s.res, k: r.ow / s.sw });
        r.rctx.drawImage(G.app.view, s.sx, s.sy, s.sw, s.sh, 0, 0, r.ow, r.oh);
        if (r.overlay) r.rctx.drawImage(r.overlay, 0, 0);
        const left = this.CLIP_MS - (performance.now() - r.t0);
        if (this._tick % 6 === 0) this._syncRec(left);
        if (left <= 0) this._stopClip(false);
    },

    _stopClip(abort) {
        const r = this._rec;
        if (!r) return;
        this._rec = null;
        r.aborted = !!abort;
        try {
            if (r.rec.state !== 'inactive') r.rec.stop();
        } catch (e) {
            /* already stopped */
        }
        if (r.audio) r.audio.stop();
        if (r.timelapse) {
            if (r.lookBefore == null) this.setTime(null);
            else this.setTime(r.lookBefore);
        }
        if (this._root) this._root.classList.remove('pm-recording');
        this._syncRec();
    },

    _clipDone(r) {
        if (r.aborted || !r.chunks.length) return;
        const type = r.mime.split(';')[0];
        const blob = new Blob(r.chunks, { type });
        const ext = type.indexOf('mp4') >= 0 ? 'mp4' : 'webm';
        const name = this._fileName(r.place, ext);
        this._download(blob, name);
        const m = r.mime.toLowerCase();
        const codec = /avc1|avc3|h264/.test(m) ? 'H.264' : /vp9/.test(m) ? 'VP9' : /vp8/.test(m) ? 'VP8' : '';
        const xReady = ext === 'mp4' && codec === 'H.264' && !/opus/.test(m);
        this._last = {
            blob,
            kind: ext,
            codec,
            xReady,
            place: r.place,
            dp: r.dp0,
            w: r.ow,
            h: r.oh,
            name,
            wx: r.wx,
        };
        if (this.active) this._showResult();
    },

    /* ═══ Output ═════════════════════════════════════════════════════ */
    _fileName(place, ext) {
        const d = new Date();
        const p = (n) => String(n).padStart(2, '0');
        const slug = String(place || 'city')
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '')
            .slice(0, 40);
        const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
        return `singularity-city-${slug}-${stamp}.${ext}`;
    },

    _download(blob, name) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = name;
        a.rel = 'noopener';
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 10000);
    },

    _blobOf(canvas) {
        return new Promise((resolve, reject) =>
            canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('encode failed'))), 'image/png')
        );
    },

    async savePng() {
        const L = this._last;
        if (!L || !L.canvas) return;
        const b = await this._blobOf(L.canvas);
        this._download(b, this._fileName(L.place, 'png'));
        this._note('Saved ' + L.canvas.width + '×' + L.canvas.height + ' PNG.');
    },

    async copyPng() {
        const L = this._last;
        if (!L || !L.canvas) return false;
        const CI = window.ClipboardItem;
        if (!CI || !navigator.clipboard || !navigator.clipboard.write) {
            this._note("This browser can't copy images — use Save instead.");
            return false;
        }
        try {
            // Promise form keeps Safari's user-activation window; Chrome takes it too.
            await navigator.clipboard.write([new CI({ 'image/png': this._blobOf(L.canvas) })]);
        } catch (e) {
            try {
                const b = await this._blobOf(L.canvas);
                await navigator.clipboard.write([new CI({ 'image/png': b })]);
            } catch (e2) {
                this._note("Couldn't copy — use Save instead.");
                return false;
            }
        }
        this._note('Copied — paste it anywhere.');
        return true;
    },

    async postX() {
        const L = this._last;
        if (!L) return;
        const text = this._postText(L);
        let how = '';
        if (L.canvas) {
            const ok = await this.copyPng();
            if (ok) how = 'Image copied — paste it into your post (Ctrl/⌘+V).';
            else {
                await this.savePng();
                how = 'Image saved — attach it to your post.';
            }
        } else how = 'Clip saved — attach it to your post.';
        window.open('https://x.com/intent/post?text=' + encodeURIComponent(text), '_blank', 'noopener');
        this._note(how);
    },

    _wxNow() {
        return typeof Environment !== 'undefined' ? Environment.weather : '';
    },

    _timeWord(dp) {
        if (dp < 0.23) return 'Late night';
        if (dp < 0.29) return 'Dawn';
        if (dp < 0.45) return 'Morning';
        if (dp < 0.6) return 'Midday';
        if (dp < 0.72) return 'Afternoon';
        if (dp < 0.79) return 'Golden hour';
        if (dp < 0.85) return 'Dusk';
        return 'Night';
    },

    _postText(L) {
        const wxP = {
            rain: ' in the rain',
            drizzle: ' in the drizzle',
            thunderstorm: ' in a thunderstorm',
            snow: ' in the snow',
            fog: ' in the fog',
            overcast: ' under grey skies',
            cherry: ' under cherry blossoms',
            leaves: ' among falling leaves',
        };
        const w = L.wx || '';
        const lead = L.kind === 'png' ? '📸' : '🎬';
        return (
            `${lead} ${this._timeWord(L.dp)}${wxP[w] || ''} at ${L.place}, Singularity City — ` +
            `the whole AI industry, alive as a pixel city.\n\nhttps://singularitycity.net`
        );
    },

    /* ═══ Place and caption ══════════════════════════════════════════ */
    _placeName() {
        if (typeof G === 'undefined') return 'Singularity City';
        if (G.activeInterior) {
            const b = G.bldById && G.bldById[G.activeInterior];
            return (b && b.name) || 'Inside';
        }
        if (typeof Camera === 'undefined' || typeof BLDS === 'undefined') return 'Downtown';
        const z = Camera.zoom || 1;
        const wx = -Camera.x + (G.vpW || window.innerWidth) / (2 * z);
        let best = null;
        let bd = Infinity;
        for (const b of BLDS) {
            const d = wx < b.x ? b.x - wx : wx > b.x + b.w ? wx - (b.x + b.w) : 0;
            if (d < bd) {
                bd = d;
                best = b;
            }
        }
        const zone = (G.zoneBounds || []).find((zb) => wx >= zb.x0 && wx <= zb.x1);
        const zName = zone ? this.ZONE_NAMES[zone.zone] : null;
        const id = best ? best.id : '';
        // Close in: the building. Wide: the district.
        if (best && bd < 40 && z >= 1.25 && best.name) return best.name;
        if (zName) return zName;
        if (zone && zone.zone === 'forest' && best && best.name) return best.name;
        if (/^embassy_|^diplomat_villa_/.test(id)) return 'Embassy Row';
        if (best && bd < 40 && best.name && z >= 1) return best.name;
        return 'Downtown';
    },

    _caption(noTime) {
        const dp = this._dp();
        const mins = Math.floor(dp * 1440);
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const d = new Date();
        const MON = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
        const date = `${d.getDate()} ${MON[d.getMonth()]} ${d.getFullYear()}`;
        return {
            brand: 'SINGULARITY CITY',
            place: String(this._place || this._placeName()).toUpperCase(),
            when: noTime ? date : `${date}  ${hh}:${mm}`,
            url: 'SINGULARITYCITY.NET',
        };
    },

    async _fonts() {
        if (this._fontsOk || !document.fonts || !document.fonts.load) return;
        try {
            await Promise.race([
                document.fonts.load('16px "Silkscreen"'),
                new Promise((r) => setTimeout(r, 1500)),
            ]);
        } catch (e) {
            /* fallback face */
        }
        this._fontsOk = true;
    },

    // Text drawn at 8 units (one font pixel per unit) and thresholded, so it stays crisp.
    _pixText(text, u, color) {
        const size = 8 * u;
        const m = document.createElement('canvas').getContext('2d');
        m.font = `${size}px "Silkscreen", "Press Start 2P", monospace`;
        const w = Math.ceil(m.measureText(text).width) + 2 * u;
        const h = Math.ceil(size * 1.25);
        const c = document.createElement('canvas');
        c.width = Math.max(1, w);
        c.height = Math.max(1, h);
        const ctx = c.getContext('2d');
        ctx.font = m.font;
        ctx.textBaseline = 'alphabetic';
        ctx.fillStyle = color;
        ctx.fillText(text, u, Math.round(size));
        const img = ctx.getImageData(0, 0, c.width, c.height);
        const p = img.data;
        for (let i = 3; i < p.length; i += 4) p[i] = p[i] >= 110 ? 255 : 0;
        ctx.putImageData(img, 0, 0);
        return c;
    },

    // Pixel postcard: a dark frame with a neon inner line, cyan corner studs, and a caption bar
    // along the bottom. Drawn inside the crop, so the frame preset's ratio stays exact.
    _drawPostcard(ctx, W, H, u, cap) {
        ctx.save();
        ctx.imageSmoothingEnabled = false;
        const band = (inset, thick, color) => {
            ctx.fillStyle = color;
            ctx.fillRect(inset, inset, W - 2 * inset, thick);
            ctx.fillRect(inset, H - inset - thick, W - 2 * inset, thick);
            ctx.fillRect(inset, inset, thick, H - 2 * inset);
            ctx.fillRect(W - inset - thick, inset, thick, H - 2 * inset);
        };
        band(0, u, '#000000');
        band(u, 3 * u, '#15122a');
        band(4 * u, u, '#ff4fd8');
        band(5 * u, u, 'rgba(0,0,0,0.75)');
        // Corner studs
        ctx.fillStyle = '#4ff0ff';
        for (const [x, y] of [
            [u, u],
            [W - 4 * u, u],
            [u, H - 4 * u],
            [W - 4 * u, H - 4 * u],
        ])
            ctx.fillRect(x, y, 3 * u, 3 * u);
        ctx.fillStyle = '#15122a';
        for (const [x, y] of [
            [2 * u, 2 * u],
            [W - 3 * u, 2 * u],
            [2 * u, H - 3 * u],
            [W - 3 * u, H - 3 * u],
        ])
            ctx.fillRect(x, y, u, u);

        // Caption bar: brand · place on the left, date · url on the right. When it doesn't fit,
        // the url goes first, then the date, then the place.
        if (cap) {
            const inner = 6 * u;
            const barH = 13 * u;
            const by = H - inner - barH;
            const left = [
                [cap.brand, '#4ff0ff'],
                [cap.place, '#f5f0ff'],
            ].map(([t, c]) => this._pixText(t, u, c));
            const right = [
                [cap.when, '#facc15'],
                [cap.url, '#a8a0c4'],
            ].map(([t, c]) => this._pixText(t, u, c));
            const gap = 4 * u;
            const wOf = (arr) => arr.reduce((s, c) => s + c.width, 0) + Math.max(0, arr.length - 1) * gap * 2;
            const avail = W - 2 * inner - 6 * u;
            const fits = () => wOf(left) + (right.length ? gap * 3 + wOf(right) : 0) <= avail;
            while (!fits() && right.length) right.pop();
            while (!fits() && left.length > 1) left.pop();
            ctx.fillStyle = 'rgba(11,9,24,0.9)';
            ctx.fillRect(inner, by, W - 2 * inner, barH);
            ctx.fillStyle = 'rgba(79,240,255,0.85)';
            ctx.fillRect(inner, by, W - 2 * inner, u);
            if (fits()) {
                const ty = by + Math.round((barH - left[0].height) / 2) + u;
                const row = (arr, x0) => {
                    let x = x0;
                    for (let i = 0; i < arr.length; i++) {
                        if (i) {
                            ctx.fillStyle = '#ff4fd8';
                            ctx.fillRect(x + gap - u, by + Math.round(barH / 2), u, u);
                            x += gap * 2;
                        }
                        ctx.drawImage(arr[i], x, ty);
                        x += arr[i].width;
                    }
                };
                row(left, inner + 3 * u);
                if (right.length) row(right, W - inner - 3 * u - wOf(right));
            }
        }
        ctx.restore();
    },

    /* ═══ UI ═════════════════════════════════════════════════════════ */
    _pixel() {
        return document.documentElement.classList.contains('px-ui');
    },

    _iz() {
        const IZ = typeof PL !== 'undefined' && PL.InteriorZoom;
        return IZ && IZ.layer && !IZ.layer.destroyed ? IZ : null;
    },

    // A pixel icon when the skin's icon set is there, else the emoji.
    _ic(key, emoji) {
        const I = typeof PL !== 'undefined' && PL.Icons;
        if (this._pixel() && I && I.has(key)) return I.html(key, 'pm-ic');
        return `<span class="pm-emo" aria-hidden="true">${emoji}</span>`;
    },

    _build() {
        if (this._root) return;
        const root = document.createElement('div');
        root.id = 'pmRoot';
        root.className = 'pm-root';
        root.hidden = true;
        const times = this.TIMES.map(
            ([k, l, dp]) => `<button class="pm-b pm-t" data-time="${dp}" title="${l}">${l}</button>`
        ).join('');
        const wx = this.WEATHER.map(
            ([k, l, e]) =>
                `<button class="pm-b pm-w" data-wx="${k}" title="${l}" aria-label="${l}">${this._ic('wx_' + k, e)}</button>`
        ).join('');
        const frames = this.FRAMES.map(
            ([k, l]) => `<button class="pm-b pm-f" data-frame="${k}" title="Frame ${l}">${l}</button>`
        ).join('');
        root.innerHTML = `
<div class="pm-frame"><div class="pm-grid"></div><canvas class="pm-pc"></canvas></div>
<div class="pm-flash"></div>
<div class="pm-rec" aria-live="polite"><span class="pm-rec-dot"></span><span class="pm-rec-t">REC 6.0s</span><button class="pm-b pm-rec-stop" data-act="stopclip">STOP</button></div>
<div class="pm-bar" role="toolbar" aria-label="Photo mode">
  <div class="pm-row pm-row-a">
    <div class="pm-grp pm-time">
      <button class="pm-b pm-live" data-act="live" title="Follow the real clock">${this._ic('pm_live', '🕒')}<span>LIVE</span></button>
      <input class="pm-slider pm-clock-in" type="range" min="0" max="1439" step="1" aria-label="Time of day">
      <span class="pm-clock">--:--</span>
      ${times}
    </div>
    <div class="pm-grp pm-wx">
      <button class="pm-b pm-w pm-auto" data-wx="" title="The city's own weather">AUTO</button>${wx}
    </div>
  </div>
  <div class="pm-row pm-row-b">
    <div class="pm-grp pm-frames">${frames}</div>
    <div class="pm-grp pm-opts">
      <button class="pm-b" data-opt="postcard" title="Pixel postcard border with a caption">${this._ic('pm_postcard', '🖼️')}<span>POSTCARD</span></button>
      <button class="pm-b" data-opt="grid" title="Rule-of-thirds guide (G)">${this._ic('pm_grid', '#')}<span>GRID</span></button>
      <button class="pm-b" data-opt="bubbles" title="Chat bubbles (B)">${this._ic('pm_bubble', '💬')}<span>BUBBLES</span></button>
      <button class="pm-b pm-out" data-opt="drift" title="Slow camera drift">${this._ic('pm_drift', '↔')}<span class="pm-drift-l">DRIFT</span></button>
      <button class="pm-b" data-opt="timelapse" title="Clips sweep 9 hours of light">${this._ic('pm_timelapse', '⏳')}<span>TIMELAPSE</span></button>
      <button class="pm-b" data-opt="scale" title="Export size: native or every pixel doubled"><span class="pm-scale-l">1×</span></button>
      <button class="pm-b" data-opt="sound" title="Record the city's sound into clips">${this._ic('pm_sound', '🔊')}<span>SOUND</span></button>
    </div>
    <div class="pm-grp pm-zoom">
      <span class="pm-lbl">ZOOM</span>
      <input class="pm-slider pm-zoom-in" type="range" min="0.5" max="3" step="0.5" aria-label="Zoom">
      <span class="pm-zoom-v">1×</span>
    </div>
    <div class="pm-grp pm-go">
      <button class="pm-b pm-snap" data-act="snap" title="Take the photo (Space)">${this._ic('pm_snap', '📷')}<span>SNAP</span></button>
      <button class="pm-b pm-clip" data-act="clip" title="Record a 6 s clip (R)">${this._ic('pm_rec', '⏺')}<span>CLIP 6s</span></button>
      <button class="pm-b pm-fold" data-act="fold" title="Fold the controls (H hides them)" aria-label="Fold controls">▾</button>
      <button class="pm-b pm-exit" data-act="exit" title="Leave photo mode (Esc)">${this._ic('pm_exit', '✕')}<span>EXIT</span></button>
    </div>
  </div>
  <div class="pm-hint">Drag to frame · Space snap · R clip · H hide · [ ] time · Esc exit</div>
  <div class="pm-note" aria-live="polite"></div>
</div>
<button class="pm-b pm-mini" data-act="unhide" title="Show the controls (H)" aria-label="Show photo controls">${this._ic('pm_snap', '📷')}</button>
<div class="pm-result" hidden>
  <div class="pm-card">
    <div class="pm-card-t">${this._ic('pm_snap', '📷')}<span class="pm-card-title">POSTCARD READY</span></div>
    <canvas class="pm-thumb"></canvas>
    <div class="pm-meta"></div>
    <div class="pm-acts">
      <button class="pm-b pm-hot" data-act="save">SAVE</button>
      <button class="pm-b" data-act="copy">COPY</button>
      <button class="pm-b" data-act="post">POST ON 𝕏</button>
      <button class="pm-b" data-act="back">KEEP SHOOTING</button>
    </div>
    <div class="pm-note pm-card-note" aria-live="polite"></div>
  </div>
</div>`;
        document.body.appendChild(root);
        this._root = root;

        root.addEventListener('click', (e) => this._onClick(e));
        const t = root.querySelector('.pm-clock-in');
        t.addEventListener('input', () => this.setTime(+t.value / 1440));
        const z = root.querySelector('.pm-zoom-in');
        z.addEventListener('input', () => this._setZoom(+z.value));
        // Keep drags on the controls from panning the city underneath.
        for (const ev of ['pointerdown', 'wheel', 'touchstart'])
            root.addEventListener(ev, (e) => {
                if (e.target.closest('.pm-bar, .pm-result, .pm-mini, .pm-rec')) e.stopPropagation();
            });
    },

    _onClick(e) {
        const b = e.target.closest('button');
        if (!b || !this._root.contains(b)) return;
        if (typeof UI !== 'undefined' && UI.uiClick && !b.dataset.act) UI.uiClick();
        if (b.dataset.time) return this.setTime(+b.dataset.time);
        if (b.dataset.wx !== undefined) return this.setWeather(b.dataset.wx || null);
        if (b.dataset.frame) return this.setFrame(b.dataset.frame);
        const o = b.dataset.opt;
        if (o) {
            if (o === 'drift') this.drift = this.drift === 0 ? 1 : this.drift === 1 ? -1 : 0;
            else if (o === 'scale') this.scale = this.scale === 1 ? 2 : 1;
            else {
                this[o] = !this[o];
                if (o === 'bubbles' && this.bubbles) this._showBubbles();
                if (o === 'bubbles' && !this.bubbles) this._hideBubbles(true);
                if (o === 'postcard') this._postcardDirty = true;
            }
            this._syncOpts();
            this._layout();
            return;
        }
        switch (b.dataset.act) {
            case 'live':
                return this.setTime(null);
            case 'snap':
                return this.snap();
            case 'clip':
                return this.startClip();
            case 'stopclip':
                return this._stopClip(false);
            case 'fold':
                this.collapsed = !this.collapsed;
                this._foldChosen = true;
                return this._layout();
            case 'unhide':
                this.hideUI = false;
                return this._layout();
            case 'exit':
                return this.exit();
            case 'save':
                if (!this._last) return;
                if (this._last.canvas) return this.savePng();
                this._download(this._last.blob, this._last.name);
                return this._note('Saved again.');
            case 'copy':
                return this.copyPng();
            case 'post':
                return this.postX();
            case 'back':
                return this._closeResult();
        }
    },

    setFrame(k) {
        if (!this.FRAMES.find((f) => f[0] === k)) return;
        this.frame = k;
        this._postcardDirty = true;
        this._layout();
        this._syncOpts();
    },

    _setZoom(v) {
        if (typeof Camera === 'undefined' || G.activeInterior) return;
        const z0 = Camera.targetZoom || 1;
        const z1 = Math.max(0.5, Math.min(3, v));
        // Keep the centre of the view where it is.
        const cx = -Camera.targetX + G.vpW / (2 * z0);
        Camera.targetZoom = z1;
        Camera.targetX = -cx + G.vpW / (2 * z1);
        this._syncZoom();
    },

    _layout() {
        const R = this._root;
        if (!R) return;
        R.classList.toggle('pm-hide', this.hideUI);
        R.classList.toggle('pm-folded', this.collapsed);
        const fold = R.querySelector('.pm-fold');
        fold.textContent = this.collapsed ? '▴ MORE' : '▾';
        fold.title = this.collapsed
            ? 'Time, weather, frames and options'
            : 'Fold the controls (H hides them)';
        R.classList.toggle('pm-indoor', !!G.activeInterior);
        const fr = this._frameRect();
        const f = R.querySelector('.pm-frame');
        f.style.left = fr.x + 'px';
        f.style.top = fr.y + 'px';
        f.style.width = fr.w + 'px';
        f.style.height = fr.h + 'px';
        f.classList.toggle('pm-framed', this.frame !== 'free');
        f.classList.toggle('pm-thirds', this.grid);
        const pc = R.querySelector('.pm-pc');
        pc.hidden = !this.postcard;
        if (this.postcard) {
            const res = this._res();
            const w = Math.round(fr.w * res);
            const h = Math.round(fr.h * res);
            if (pc.width !== w || pc.height !== h) {
                pc.width = w;
                pc.height = h;
            }
            this._postcardDirty = true;
        }
    },

    async _drawPreview() {
        this._postcardDirty = false;
        const pc = this._root && this._root.querySelector('.pm-pc');
        if (!pc || pc.hidden || !pc.width) return;
        await this._fonts();
        const ctx = pc.getContext('2d');
        ctx.clearRect(0, 0, pc.width, pc.height);
        this._drawPostcard(ctx, pc.width, pc.height, this._unit(), this._caption());
    },

    _syncAll() {
        this._syncTime();
        this._syncWeather();
        this._syncOpts();
        this._syncZoom();
        this._syncRec();
    },

    _syncTime() {
        const R = this._root;
        if (!R) return;
        const dp = this._dp();
        const mins = Math.floor(dp * 1440) % 1440;
        const inp = R.querySelector('.pm-clock-in');
        if (document.activeElement !== inp) inp.value = mins;
        const hh = String(Math.floor(mins / 60)).padStart(2, '0');
        const mm = String(mins % 60).padStart(2, '0');
        const live = this.lookDp == null;
        R.querySelector('.pm-clock').textContent = `${hh}:${mm}`;
        R.querySelector('.pm-live').classList.toggle('on', live);
        R.querySelectorAll('.pm-t').forEach((b) => {
            b.classList.toggle('on', !live && Math.abs(+b.dataset.time - dp) < 0.002);
        });
        const cap = this._caption();
        if (cap.when !== this._capWhen) {
            this._capWhen = cap.when;
            this._postcardDirty = true;
        }
    },

    _syncWeather() {
        const R = this._root;
        if (!R) return;
        R.querySelectorAll('.pm-w').forEach((b) =>
            b.classList.toggle('on', (b.dataset.wx || null) === this.wx)
        );
    },

    _syncOpts() {
        const R = this._root;
        if (!R) return;
        R.querySelectorAll('.pm-f').forEach((b) => b.classList.toggle('on', b.dataset.frame === this.frame));
        R.querySelectorAll('[data-opt]').forEach((b) => {
            const o = b.dataset.opt;
            const on = o === 'drift' ? this.drift !== 0 : o === 'scale' ? this.scale === 2 : !!this[o];
            b.classList.toggle('on', on);
        });
        const dl = R.querySelector('.pm-drift-l');
        if (dl) dl.textContent = this.drift === 1 ? 'DRIFT →' : this.drift === -1 ? 'DRIFT ←' : 'DRIFT';
        const sl = R.querySelector('.pm-scale-l');
        if (sl) sl.textContent = this.scale === 2 ? '2× SIZE' : '1× SIZE';
    },

    _syncZoom() {
        const R = this._root;
        if (!R || typeof Camera === 'undefined') return;
        const inp = R.querySelector('.pm-zoom-in');
        const px = this._pixel();
        inp.step = px ? '0.5' : '0.1';
        const z = Camera.targetZoom || 1;
        if (document.activeElement !== inp) inp.value = z;
        R.querySelector('.pm-zoom-v').textContent = (Math.round(z * 10) / 10).toString() + '×';
    },

    _syncRec(left) {
        const R = this._root;
        if (!R) return;
        const on = !!this._rec;
        R.querySelector('.pm-rec').classList.toggle('on', on);
        if (on && left != null)
            R.querySelector('.pm-rec-t').textContent = 'REC ' + Math.max(0, left / 1000).toFixed(1) + 's';
        R.querySelector('.pm-snap').disabled = on;
        R.querySelector('.pm-clip').disabled = on;
    },

    _note(msg) {
        const R = this._root;
        if (!R) return;
        R.querySelectorAll('.pm-note').forEach((n) => {
            n.textContent = msg;
        });
        clearTimeout(this._noteT);
        this._noteT = setTimeout(() => {
            R.querySelectorAll('.pm-note').forEach((n) => {
                n.textContent = '';
            });
        }, 6000);
    },

    _showResult() {
        const R = this._root;
        const L = this._last;
        if (!R || !L) return;
        const box = R.querySelector('.pm-result');
        const th = box.querySelector('.pm-thumb');
        const title = box.querySelector('.pm-card-title');
        const meta = box.querySelector('.pm-meta');
        const save = box.querySelector('[data-act="save"]');
        const copy = box.querySelector('[data-act="copy"]');
        if (L.canvas) {
            const maxW = Math.min(520, window.innerWidth - 80);
            const maxH = Math.min(320, window.innerHeight - 220);
            const k = Math.min(maxW / L.canvas.width, maxH / L.canvas.height, 1);
            th.width = Math.max(1, Math.round(L.canvas.width * k));
            th.height = Math.max(1, Math.round(L.canvas.height * k));
            const c = th.getContext('2d');
            c.imageSmoothingEnabled = true;
            c.imageSmoothingQuality = 'high';
            c.drawImage(L.canvas, 0, 0, th.width, th.height);
            th.hidden = false;
            title.textContent = this.postcard ? 'POSTCARD READY' : 'PHOTO READY';
            meta.textContent = `${L.place} · ${L.canvas.width}×${L.canvas.height} PNG`;
            save.textContent = 'SAVE PNG';
            copy.hidden = false;
        } else {
            th.hidden = true;
            title.textContent = 'CLIP SAVED';
            const fmt = L.kind.toUpperCase() + (L.codec ? ' ' + L.codec : '');
            meta.textContent =
                `${L.place} · ${L.w}×${L.h} ${fmt} · ${this.CLIP_MS / 1000}s — in your downloads.` +
                (L.xReady
                    ? ' Ready for X.'
                    : L.kind === 'mp4'
                      ? ' X wants AAC sound: turn SOUND off for an X-ready clip.'
                      : ' X needs MP4: record in Chrome or Edge.');
            save.textContent = 'SAVE AGAIN';
            copy.hidden = true;
        }
        box.hidden = false;
        const first = box.querySelector('[data-act="save"]');
        if (first && first.focus) first.focus({ preventScroll: true });
    },

    _closeResult() {
        const box = this._root && this._root.querySelector('.pm-result');
        if (box) box.hidden = true;
    },

    /* ═══ Keys ═══════════════════════════════════════════════════════ */
    _onKey(e) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        const t = e.target;
        const tag = (t && t.tagName) || '';
        const typing =
            (tag === 'INPUT' && t.type !== 'range' && t.type !== 'checkbox' && t.type !== 'button') ||
            tag === 'TEXTAREA' ||
            tag === 'SELECT' ||
            (t && t.isContentEditable);
        const k = e.key;
        if (!this.active) {
            if (typing || (k !== 'p' && k !== 'P')) return;
            if (this._blockReason() === 'boot') return;
            e.preventDefault();
            e.stopImmediatePropagation();
            this.enter();
            return;
        }
        if (typing && k !== 'Escape') return;
        const onButton = t && t.closest && t.closest('#pmRoot button');
        const resultOpen = this._root && !this._root.querySelector('.pm-result').hidden;
        let done = true;
        if (k === 'Escape') {
            if (this._rec) this._stopClip(false);
            else if (resultOpen) this._closeResult();
            else if (this.hideUI) {
                this.hideUI = false;
                this._layout();
            } else this.exit();
        } else if (k === 'p' || k === 'P') this.exit();
        else if ((k === ' ' || k === 'Enter') && onButton) done = false;
        else if (k === ' ') {
            if (!resultOpen) this.snap();
        } else if (k === 'r' || k === 'R') {
            if (!resultOpen) this.startClip();
        } else if (k === 'h' || k === 'H') {
            this.hideUI = !this.hideUI;
            this._layout();
        } else if (k === 'g' || k === 'G') {
            this.grid = !this.grid;
            this._syncOpts();
            this._layout();
        } else if (k === 'b' || k === 'B') {
            this.bubbles = !this.bubbles;
            if (this.bubbles) this._showBubbles();
            else this._hideBubbles(true);
            this._syncOpts();
        } else if (k === '[' || k === ']') {
            const step = (k === '[' ? -10 : 10) / 1440;
            this.setTime(this._dp() + step);
        } else if (k >= '1' && k <= '5') this.setFrame(this.FRAMES[+k - 1][0]);
        else if ('tTdD`~'.indexOf(k) >= 0) {
            // City hotkeys that would switch modes underneath the photo: swallowed.
        } else done = false;
        if (done) {
            e.preventDefault();
            e.stopImmediatePropagation();
        }
    },
};

PhotoMode.init();
