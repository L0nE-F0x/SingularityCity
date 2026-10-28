/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUNDSCAPE (v1.0.0 — procedural lofi city bed)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Outdoors used to be a sine "wind chime" on a timer. This is a continuous WebAudio bed built
   from two shared 4-second buffers (white noise + sparse crackle) and a handful of oscillators.
   No audio files.

   Re-mixed ~8×/s from what is on screen:
     • zone mix   samples the buildings under the viewport, so districts cross-fade as you pan
                  (harbour waves and gulls, desert wind and mission-control Quindar beeps, server
                  fans, mains hum and turbines, birds/crickets/frogs, the Neon Bar through a wall…)
     • clock      G.getDayPhase(): dawn chorus, rush-hour traffic, crickets after dark, the bar
                  after nine, a campus bell on the hour, a quiet city at 3 am
     • weather    Environment.weather / weatherIntensity / wind: rain hiss + patter, rolling
                  thunder on every lightning bolt, snow hush, sandstorms, no turbines in fog
     • camera     zoom (close = street detail, far = wide soft bed) and height (sky = wind,
                  tunnel = rumble)
     • entities   visible citizens (crowd murmur), cars (panned Doppler pass-bys), metro trains
                  (rumble, clack, brakes, door chimes), helicopters, HN blimps, real rocket launches

   Everything plays through SND.ambientGain, so the SFX toggle and Terminal's context mute
   cover it. SND.setAmbient() sets the mode: outdoor / interior (city muffled through the walls,
   room tone, the room's own murmur) / train / holomap / orbit.

   Layers are built on first use and torn down after a few seconds of silence, so a quiet
   district runs a dozen nodes rather than the whole kit.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Soundscape = {
    ctx: null,
    snd: null,
    mode: 'outdoor',
    modeEnv: null,
    modeBld: null,
    // Dev hooks: force the clock (day phase 0..1) without touching the sim.
    debug: { dp: null },

    // Per-layer gain at level 1, measured headless (Soundscape.meter after the compressor):
    // street beds land around −15 dB there, accents (patter, crickets) a little under, room tone
    // and the orbit pad well under, rocket and a passing train on top. MASTER then sits the whole
    // bed under the music (another −8 dB from SND.ambientGain).
    MASTER: 0.6,
    TRIM: {
        city: 1.4,
        wind: 1.6,
        sand: 0.9,
        rain: 1.5,
        patter: 3.5,
        waves: 1.1,
        servers: 0.7,
        mains: 0.1,
        turbine: 0.9,
        leaves: 0.5,
        fountain: 0.6,
        crickets: 0.08,
        bar: 0.5,
        neon: 0.25,
        crowd: 0.9,
        tunnel: 1.1,
        train: 2.2,
        heli: 1.8,
        blimp: 0.12,
        rocket: 2.6,
        room: 0.25,
        space: 0.07,
    },

    _layers: {},
    _next: {},
    _fired: {},
    _live: 0,
    _timer: null,
    _w: {},
    _f: {},
    _e: { citizens: 0, citizenPan: 0, train: null, heli: 0, heliPan: 0, blimp: 0, blimpPan: 0, rocket: 0 },
    _sorted: null,
    _sortedKey: '',
    _carSide: new WeakMap(),
    _trainState: new WeakMap(),
    _gustT: 0,
    _gust: 0.5,
    _hour: -1,
    _beat: 0,
    _cr: null, // cricket voices

    // ─── Boot ───────────────────────────────────────────────────────────────────────────────────
    init(snd) {
        if (this.ctx || !snd || !snd.ctx) return;
        this.snd = snd;
        const ctx = (this.ctx = snd.ctx);
        this.white = this._makeWhite();
        this.crackle = this._makeCrackle();

        // Glue + safety: thunder, rocket roar and a busy street can stack.
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -20;
        this.comp.knee.value = 12;
        this.comp.ratio.value = 3;
        this.comp.attack.value = 0.01;
        this.comp.release.value = 0.4;
        this.out = this._gain(this.MASTER);
        this.comp.connect(this.out);
        this.out.connect(snd.ambientGain);

        // Street bus: everything that should be muffled by walls, snow or depth.
        this.bus = this._gain(1);
        this.busLP = this._filter('lowpass', 12000, 0.5);
        this.busGain = this._gain(1);
        this.bus.connect(this.busLP);
        this.busLP.connect(this.busGain);
        this.busGain.connect(this.comp);
        // Direct bus: room tone, murmur, tunnel, space pad — they filter themselves.
        this.direct = this._gain(1);
        this.direct.connect(this.comp);

        this._timer = setInterval(() => this._tick(), 125);
    },

    // 'outdoor' | 'interior' | 'train' | 'holomap' | 'orbit', read from the game every tick:
    // the engine's zone loop calls SND.setAmbient('zone_…') twice a second even on a train
    // or in Orbit, so the ambient id can't be trusted for this.
    _detectMode() {
        let mode = 'outdoor';
        let bld = null;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) mode = 'orbit';
        else if ((typeof Holomap !== 'undefined' && Holomap.active) || G.viewMode === 'macro')
            mode = 'holomap';
        else if (G.activeInterior) {
            mode = 'interior';
            bld = String(G.activeInterior);
        } else if (G.trainFocus) mode = 'train';
        this.mode = mode;
        this.modeBld = bld;
        this.modeEnv = !bld
            ? null
            : bld.startsWith('metro_')
              ? 'metro'
              : bld.startsWith('house_')
                ? 'estate'
                : bld.startsWith('res_')
                  ? 'ai_housing'
                  : 'hq';
    },

    // ─── Shared buffers ─────────────────────────────────────────────────────────────────────────
    _makeWhite() {
        const sr = this.ctx.sampleRate;
        const n = Math.floor(sr * 4);
        const b = this.ctx.createBuffer(1, n, sr);
        const d = b.getChannelData(0);
        for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
        return b;
    },

    // Sparse 0.5–4 ms noise bursts with a power-law level spread (many faint, few loud):
    // rain patter, tyre spray, rocket crackle and train clack all come from this.
    _makeCrackle() {
        const sr = this.ctx.sampleRate;
        const n = Math.floor(sr * 4);
        const b = this.ctx.createBuffer(1, n, sr);
        const d = b.getChannelData(0);
        const short = Math.round(sr / 2000);
        for (let k = 0; k < 880; k++) {
            const at = Math.floor(Math.random() * n);
            const amp = Math.pow(Math.random(), 3) * (Math.random() < 0.5 ? -1 : 1);
            const len = short + Math.floor(Math.random() * short * 7);
            for (let i = 0; i < len && at + i < n; i++) {
                d[at + i] += amp * (Math.random() * 2 - 1) * Math.exp((-5 * i) / len);
            }
        }
        return b;
    },

    // ─── Node helpers ───────────────────────────────────────────────────────────────────────────
    _gain(v) {
        const g = this.ctx.createGain();
        g.gain.value = v;
        return g;
    },
    _filter(type, freq, q) {
        const f = this.ctx.createBiquadFilter();
        f.type = type;
        f.frequency.value = freq;
        f.Q.value = q == null ? 0.7 : q;
        return f;
    },
    _pan(v) {
        if (!this.ctx.createStereoPanner) return null;
        const p = this.ctx.createStereoPanner();
        p.pan.value = v || 0;
        return p;
    },
    _src(buf, rate, offset) {
        const s = this.ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.playbackRate.value = rate || 1;
        s.start(0, (offset || 0) % buf.duration);
        return s;
    },
    _osc(type, freq) {
        const o = this.ctx.createOscillator();
        o.type = type;
        o.frequency.value = freq;
        o.start();
        return o;
    },
    // Connect in order, skipping nulls (a missing StereoPanner on old Safari).
    _chain(...nodes) {
        let prev = null;
        for (const n of nodes) {
            if (!n) continue;
            if (prev) prev.connect(n);
            prev = n;
        }
        return prev;
    },
    _setPan(p, v, now, tau) {
        if (p) p.pan.setTargetAtTime(Math.max(-1, Math.min(1, v)), now, tau || 0.3);
    },

    // ─── Layers ─────────────────────────────────────────────────────────────────────────────────
    // build(S) → { level: GainNode, nodes: [...], dest: 'bus' | 'direct', ...handles }
    LAYERS: {
        // Distant traffic and the city's low roar: two decorrelated, slowed noise beds, wide.
        city(S) {
            const a = S._src(S.white, 0.5, 0);
            const b = S._src(S.white, 0.47, 1.9);
            const fa = S._filter('lowpass', 210, 0.5);
            const fb = S._filter('lowpass', 235, 0.5);
            const pa = S._pan(-0.6);
            const pb = S._pan(0.6);
            const level = S._gain(0);
            S._chain(a, fa, pa, level);
            S._chain(b, fb, pb, level);
            return { level, nodes: [a, b, fa, fb, pa, pb, level], dest: 'bus' };
        },
        // Gusting band of noise; the mixer walks its centre, level and pan.
        wind(S) {
            const s = S._src(S.white, 1, 0.7);
            const bp = S._filter('bandpass', 500, 0.6);
            const gust = S._gain(1);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, bp, gust, pan, level);
            return { level, nodes: [s, bp, gust, pan, level], dest: 'bus', bp, gust, pan };
        },
        // Fine sand hiss on top of the desert wind.
        sand(S) {
            const s = S._src(S.white, 1.15, 2.7);
            const bp = S._filter('bandpass', 3400, 0.7);
            const gust = S._gain(1);
            const level = S._gain(0);
            S._chain(s, bp, gust, level);
            return { level, nodes: [s, bp, gust, level], dest: 'bus', gust };
        },
        rain(S) {
            const a = S._src(S.white, 1, 0.3);
            const b = S._src(S.white, 0.93, 2.6);
            const fa = S._filter('bandpass', 2400, 0.45);
            const fb = S._filter('bandpass', 2000, 0.45);
            const pa = S._pan(-0.7);
            const pb = S._pan(0.7);
            const level = S._gain(0);
            S._chain(a, fa, pa, level);
            S._chain(b, fb, pb, level);
            return { level, nodes: [a, b, fa, fb, pa, pb, level], dest: 'bus' };
        },
        // Individual drops: light ones bright and fast, heavy ones low. Direct, so it can stay
        // audible indoors as rain on the windows.
        patter(S) {
            const a = S._src(S.crackle, 1.25, 0.4);
            const b = S._src(S.crackle, 0.6, 2.9);
            const fa = S._filter('highpass', 1400, 0.6);
            const fb = S._filter('bandpass', 700, 0.9);
            const gb = S._gain(0.7);
            const pa = S._pan(-0.45);
            const pb = S._pan(0.45);
            const tone = S._filter('lowpass', 9000, 0.5);
            const level = S._gain(0);
            S._chain(a, fa, pa, tone);
            S._chain(b, fb, gb, pb, tone);
            tone.connect(level);
            return { level, nodes: [a, b, fa, fb, gb, pa, pb, tone, level], dest: 'direct', tone };
        },
        // Swell on a ~9.5 s LFO with the wash cresting on top.
        waves(S) {
            const s = S._src(S.white, 0.8, 1.1);
            const lp = S._filter('lowpass', 650, 0.3);
            const swell = S._gain(0.55);
            const lfo = S._osc('sine', 0.105);
            const depth = S._gain(0.42);
            lfo.connect(depth);
            depth.connect(swell.gain);
            const w = S._src(S.white, 1.1, 3.3);
            const hp = S._filter('highpass', 1600, 0.5);
            const wash = S._gain(0.15);
            const depth2 = S._gain(0.14);
            lfo.connect(depth2);
            depth2.connect(wash.gain);
            const level = S._gain(0);
            S._chain(s, lp, swell, level);
            S._chain(w, hp, wash, level);
            return { level, nodes: [s, lp, swell, lfo, depth, w, hp, wash, depth2, level], dest: 'bus' };
        },
        // Server halls / cleanrooms: fan roar, 120 Hz hum, a faint coil whine.
        servers(S) {
            const s = S._src(S.white, 0.7, 0.9);
            const bp = S._filter('bandpass', 300, 0.7);
            const hum = S._osc('sine', 120);
            const hg = S._gain(0.06);
            const h3 = S._osc('triangle', 360);
            const h3g = S._gain(0.012);
            const whine = S._osc('sine', 8200);
            const wg = S._gain(0.0025);
            const level = S._gain(0);
            S._chain(s, bp, level);
            S._chain(hum, hg, level);
            S._chain(h3, h3g, level);
            S._chain(whine, wg, level);
            return { level, nodes: [s, bp, hum, hg, h3, h3g, whine, wg, level], dest: 'bus' };
        },
        // Transformer hum (US grid: 120 Hz and harmonics) with a slow beat.
        mains(S) {
            const o1 = S._osc('sine', 120);
            const o2 = S._osc('sine', 120.6);
            const o3 = S._osc('sine', 240);
            const o4 = S._osc('sine', 360);
            const g1 = S._gain(0.5);
            const g2 = S._gain(0.35);
            const g3 = S._gain(0.2);
            const g4 = S._gain(0.08);
            const level = S._gain(0);
            S._chain(o1, g1, level);
            S._chain(o2, g2, level);
            S._chain(o3, g3, level);
            S._chain(o4, g4, level);
            return { level, nodes: [o1, o2, o3, o4, g1, g2, g3, g4, level], dest: 'bus' };
        },
        // Wind-farm blade whoosh, one pass every ~1.4 s.
        turbine(S) {
            const s = S._src(S.white, 0.6, 1.6);
            const lp = S._filter('lowpass', 520, 0.6);
            const am = S._gain(0.5);
            const lfo = S._osc('sine', 0.72);
            const depth = S._gain(0.45);
            lfo.connect(depth);
            depth.connect(am.gain);
            const level = S._gain(0);
            S._chain(s, lp, am, level);
            return { level, nodes: [s, lp, am, lfo, depth, level], dest: 'bus' };
        },
        leaves(S) {
            const s = S._src(S.white, 1, 3.7);
            const hp = S._filter('highpass', 2600, 0.5);
            const gust = S._gain(1);
            const pan = S._pan(0.2);
            const level = S._gain(0);
            S._chain(s, hp, gust, pan, level);
            return { level, nodes: [s, hp, gust, pan, level], dest: 'bus', gust, pan };
        },
        fountain(S) {
            const a = S._src(S.white, 1, 2.2);
            const bp = S._filter('bandpass', 1700, 0.5);
            const b = S._src(S.crackle, 1.6, 1.1);
            const hp = S._filter('highpass', 2200, 0.6);
            const gb = S._gain(0.8);
            const level = S._gain(0);
            S._chain(a, bp, level);
            S._chain(b, hp, gb, level);
            return { level, nodes: [a, bp, b, hp, gb, level], dest: 'bus' };
        },
        // Two crickets; the scheduler writes their chirp envelopes ahead of time.
        crickets(S) {
            const o1 = S._osc('sine', 4380);
            const o2 = S._osc('sine', 4720);
            const g1 = S._gain(0);
            const g2 = S._gain(0);
            const p1 = S._pan(-0.5);
            const p2 = S._pan(0.45);
            const level = S._gain(0);
            S._chain(o1, g1, p1, level);
            S._chain(o2, g2, p2, level);
            return { level, nodes: [o1, o2, g1, g2, p1, p2, level], dest: 'bus', voices: [g1, g2] };
        },
        // The Neon Bar heard through its walls: kick, backbeat snare and a walking bass on a
        // lofi i–iv–VII–III loop. The scheduler plays it; the low-pass opens as you zoom in.
        bar(S) {
            const kick = S._osc('sine', 50);
            const kg = S._gain(0.0001);
            const sn = S._src(S.white, 1, 0.8);
            const sbp = S._filter('bandpass', 1400, 0.8);
            const sg = S._gain(0.0001);
            const bass = S._osc('triangle', 55);
            const bg = S._gain(0.0001);
            const lp = S._filter('lowpass', 260, 0.7);
            const level = S._gain(0);
            S._chain(kick, kg, lp);
            S._chain(sn, sbp, sg, lp);
            S._chain(bass, bg, lp);
            lp.connect(level);
            return {
                level,
                nodes: [kick, kg, sn, sbp, sg, bass, bg, lp, level],
                dest: 'direct', // muffles itself (lp), so it can also play inside the venues
                kick,
                kg,
                sg,
                bass,
                bg,
                lp,
            };
        },
        neon(S) {
            const o = S._osc('sawtooth', 120);
            const bp = S._filter('bandpass', 3100, 1.8);
            const level = S._gain(0);
            S._chain(o, bp, level);
            return { level, nodes: [o, bp, level], dest: 'bus' };
        },
        // Crowd babble: three formant bands of noise, each gated by a random syllable-rate
        // envelope (slow noise → low-pass → half-wave rectified).
        crowd(S) {
            const ctx = S.ctx;
            const s = S._src(S.white, 0.9, 1.7);
            const b1 = S._filter('bandpass', 520, 1.1);
            const b2 = S._filter('bandpass', 1500, 1.3);
            const b3 = S._filter('bandpass', 2600, 1.6);
            const a1 = S._gain(0);
            const a2 = S._gain(0);
            const a3 = S._gain(0);
            const rect = ctx.createWaveShaper();
            const curve = new Float32Array(256);
            for (let i = 0; i < 256; i++) curve[i] = Math.max(0, (i / 255) * 2 - 1);
            rect.curve = curve;
            const rect2 = ctx.createWaveShaper();
            rect2.curve = curve;
            const m1 = S._src(S.white, 0.37, 0.5);
            const l1 = S._filter('lowpass', 5, 0.7);
            const d1 = S._gain(70);
            const m2 = S._src(S.white, 0.29, 2.4);
            const l2 = S._filter('lowpass', 6.5, 0.7);
            const d2 = S._gain(70);
            S._chain(m1, l1, d1, rect);
            rect.connect(a1.gain);
            rect.connect(a3.gain);
            S._chain(m2, l2, d2, rect2);
            rect2.connect(a2.gain);
            const lp = S._filter('lowpass', 3500, 0.5);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, b1, a1, lp);
            S._chain(s, b2, a2, lp);
            S._chain(s, b3, a3, lp);
            S._chain(lp, pan, level);
            return {
                level,
                nodes: [s, b1, b2, b3, a1, a2, a3, rect, rect2, m1, l1, d1, m2, l2, d2, lp, pan, level],
                dest: 'direct',
                lp,
                pan,
            };
        },
        tunnel(S) {
            const s = S._src(S.white, 0.3, 3.1);
            const lp = S._filter('lowpass', 140, 0.6);
            const level = S._gain(0);
            S._chain(s, lp, level);
            return { level, nodes: [s, lp, level], dest: 'direct' };
        },
        // Metro rumble plus wheel clack (crackle played slowly; rate follows train speed).
        train(S) {
            const r = S._src(S.white, 0.42, 0.2);
            const lp = S._filter('lowpass', 110, 0.7);
            const c = S._src(S.crackle, 0.3, 1.2);
            const bp = S._filter('bandpass', 1100, 1.5);
            const cg = S._gain(0.8);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(r, lp, pan);
            S._chain(c, bp, cg, pan);
            if (pan) pan.connect(level);
            else {
                lp.connect(level);
                cg.connect(level);
            }
            return { level, nodes: [r, lp, c, bp, cg, pan, level], dest: 'direct', clack: c, pan };
        },
        // Rotor thwop: low noise chopped at the blade rate.
        heli(S) {
            const s = S._src(S.white, 0.6, 0.6);
            const lp = S._filter('lowpass', 420, 0.7);
            const am = S._gain(0.55);
            const lfo = S._osc('square', 17);
            const depth = S._gain(0.45);
            lfo.connect(depth);
            depth.connect(am.gain);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, lp, am, pan, level);
            return { level, nodes: [s, lp, am, lfo, depth, pan, level], dest: 'bus', pan };
        },
        blimp(S) {
            const o1 = S._osc('sine', 92);
            const o2 = S._osc('triangle', 184.5);
            const g2 = S._gain(0.35);
            const lp = S._filter('lowpass', 500, 0.6);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(o1, lp);
            S._chain(o2, g2, lp);
            S._chain(lp, pan, level);
            return { level, nodes: [o1, o2, g2, lp, pan, level], dest: 'bus', pan };
        },
        // A real launch from the Space Zone: low roar + crackle, audible across the city.
        rocket(S) {
            const r = S._src(S.white, 0.35, 1.4);
            const lp = S._filter('lowpass', 170, 0.6);
            const c = S._src(S.crackle, 0.95, 2.2);
            const bp = S._filter('bandpass', 420, 0.6);
            const cg = S._gain(1.6);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(r, lp, pan);
            S._chain(c, bp, cg, pan);
            if (pan) pan.connect(level);
            else {
                lp.connect(level);
                cg.connect(level);
            }
            return { level, nodes: [r, lp, c, bp, cg, pan, level], dest: 'bus', pan };
        },
        // Indoors: low room tone and a breath of HVAC.
        room(S) {
            const s = S._src(S.white, 0.25, 0.1);
            const lp = S._filter('lowpass', 200, 0.6);
            const h = S._src(S.white, 0.9, 1.3);
            const bp = S._filter('bandpass', 620, 0.5);
            const hg = S._gain(0.35);
            const level = S._gain(0);
            S._chain(s, lp, level);
            S._chain(h, bp, hg, level);
            return { level, nodes: [s, lp, h, bp, hg, level], dest: 'direct' };
        },
        // Orbit / Holomap: a deep, slowly breathing pad.
        space(S) {
            const o1 = S._osc('sine', 55);
            const o2 = S._osc('sine', 82.6);
            const o3 = S._osc('sine', 110.3);
            const g2 = S._gain(0.6);
            const g3 = S._gain(0.4);
            const lp = S._filter('lowpass', 380, 0.8);
            const lfo = S._osc('sine', 0.07);
            const depth = S._gain(150);
            lfo.connect(depth);
            depth.connect(lp.frequency);
            const level = S._gain(0);
            S._chain(o1, lp);
            S._chain(o2, g2, lp);
            S._chain(o3, g3, lp);
            lp.connect(level);
            return { level, nodes: [o1, o2, o3, g2, g3, lp, lfo, depth, level], dest: 'direct' };
        },
    },

    _build(name) {
        const L = this.LAYERS[name](this);
        L.target = 0;
        L.idle = 0;
        L.level.connect(L.dest === 'direct' ? this.direct : this.bus);
        this._layers[name] = L;
        return L;
    },

    _teardown(name) {
        const L = this._layers[name];
        if (!L) return;
        delete this._layers[name];
        for (const n of L.nodes) {
            if (!n) continue;
            if (typeof n.stop === 'function') {
                try {
                    n.stop();
                } catch (e) {
                    /* already stopped */
                }
            }
            try {
                n.disconnect();
            } catch (e) {
                /* already disconnected */
            }
        }
    },

    // Fade a layer toward `v` (0..1 before TRIM); builds it on demand, frees it after `linger`
    // seconds at zero.
    _set(name, v, now, tau, linger) {
        const target = Math.max(0, v) * (this.TRIM[name] || 1);
        let L = this._layers[name];
        if (target > 0.0004) {
            if (!L) L = this._build(name);
            L.idle = 0;
        } else if (L) {
            L.idle += 0.125;
            if (L.idle > (linger || 10)) {
                this._teardown(name);
                return null;
            }
        } else return null;
        if (Math.abs(L.target - target) > 1e-5) {
            L.level.gain.setTargetAtTime(target, now, tau || 0.6);
            L.target = target;
        }
        return L;
    },

    // ─── Senses: what the camera sees ───────────────────────────────────────────────────────────
    _catOf(b) {
        const id = b.id || '';
        const t = b.type || '';
        if (id.startsWith('port_')) return 'port';
        if (t === 'mission_control' || t === 'assembly' || t === 'tracking' || t === 'launchpad')
            return 'desert';
        if (id.startsWith('forest_') || id.startsWith('align_')) return 'forest';
        if (id.startsWith('npc_apt_') || id.startsWith('res_') || id === 'metro_res') return 'housing';
        if (id.startsWith('dc_') || id.startsWith('fab_') || id === 'metro_dc') return 'compute';
        if (t === 'university' || id.startsWith('uni_')) return 'campus';
        if (id === 'city_park' || id === 'park' || id === 'open_square') return 'park';
        if (id === 'graveyard') return 'graveyard';
        if (id.startsWith('vcrow_') || id === 'ai_index') return 'finance';
        if (id.startsWith('embassy_') || id.startsWith('diplomat_villa_')) return 'embassy';
        if (id === 'neon_bar' || id === 'black_market' || id === 'times_hq') return 'nightlife';
        if (id.startsWith('backbone_') || id.startsWith('agents_')) return 'network';
        if (id.startsWith('robotics_')) return 'robotics';
        if (id.startsWith('longevity_')) return 'clinic';
        if (id.startsWith('suburb_')) return 'suburb';
        if (id.startsWith('house_')) return 'estate';
        if (id.startsWith('power_')) return 'power';
        return 'downtown';
    },

    _buildings() {
        if (typeof BLDS === 'undefined' || !BLDS.length) return null;
        const key = BLDS.length + ':' + (G.cityW || 0);
        if (this._sortedKey !== key) {
            this._sortedKey = key;
            this._sorted = BLDS.filter((b) => b && isFinite(b.x))
                .slice()
                .sort((a, b) => a.x - b.x)
                .map((b) => ({ x: b.x, r: b.x + (b.w || 0), cat: this._catOf(b) }));
        }
        return this._sorted;
    },

    // Category of whatever stands at world x (the nearer neighbour inside a gap).
    _catAt(arr, x) {
        let lo = 0;
        let hi = arr.length - 1;
        if (x <= arr[0].x) return arr[0].cat;
        while (lo < hi) {
            const mid = (lo + hi + 1) >> 1;
            if (arr[mid].x <= x) lo = mid;
            else hi = mid - 1;
        }
        const a = arr[lo];
        if (x <= a.r || lo === arr.length - 1) return a.cat;
        const b = arr[lo + 1];
        return x - a.r <= b.x - x ? a.cat : b.cat;
    },

    _sense() {
        const w = this._w;
        for (const k in w) w[k] = 0;
        const f = this._f;
        const Z = typeof Camera !== 'undefined' ? Camera.zoom || 1 : 1;
        const vpW = G.vpW || 1280;
        const vpH = G.vpH || 720;
        let left = typeof Camera !== 'undefined' ? -Camera.x : 0;
        let span = vpW / Z;
        // Indoors the street camera is wherever you left it: hear the block you walked into.
        const inside = this.mode === 'interior' && G.bldById && G.bldById[this.modeBld];
        if (inside) {
            span = 900;
            left = inside.x + (inside.w || 0) / 2 - span / 2;
        }
        f.cx = left + span / 2;
        f.span = span;
        f.vpW = vpW;
        f.zoom = Z;

        // Zone mix: nine samples across the view plus a little either side.
        const arr = this._buildings();
        if (arr && arr.length) {
            const N = 9;
            for (let i = 0; i < N; i++) {
                const cat = this._catAt(arr, left - span * 0.15 + (span * 1.3 * (i + 0.5)) / N);
                w[cat] = (w[cat] || 0) + 1 / N;
            }
        } else w.downtown = 1;
        const g = (k) => w[k] || 0;
        f.urban = Math.min(
            1,
            g('downtown') +
                g('finance') +
                g('nightlife') +
                0.85 * g('housing') +
                0.6 * (g('compute') + g('campus') + g('network') + g('robotics') + g('clinic')) +
                0.5 * (g('embassy') + g('park') + g('graveyard')) +
                0.4 * g('port') +
                0.3 * (g('suburb') + g('power')) +
                0.15 * (g('estate') + g('forest') + g('desert'))
        );
        f.open =
            g('desert') +
            0.8 * g('power') +
            0.7 * g('port') +
            0.6 * g('estate') +
            0.5 * (g('suburb') + g('forest')) +
            0.4 * g('park') +
            0.25 *
                (1 -
                    g('desert') -
                    g('power') -
                    g('port') -
                    g('estate') -
                    g('suburb') -
                    g('forest') -
                    g('park'));
        f.nature = Math.min(
            1,
            g('forest') + 0.8 * g('park') + 0.7 * g('estate') + 0.6 * g('suburb') + 0.3 * g('campus')
        );

        // Clock.
        const dp =
            this.debug.dp != null
                ? this.debug.dp
                : typeof G.getDayPhase === 'function'
                  ? G.getDayPhase()
                  : 0.5;
        const h = (((dp % 1) + 1) % 1) * 24;
        f.h = h;
        f.day = this._ss(5.5, 7, h) * (1 - this._ss(18.5, 20.5, h));
        f.night = 1 - f.day;
        f.dawn = this._gauss(h, 6.4, 0.9) + 0.35 * this._gauss(h, 18.6, 0.8); // dawn chorus + evening song
        f.traffic = Math.max(
            0.18,
            Math.min(
                1,
                0.25 +
                    0.45 * this._ss(5.5, 8, h) * (1 - this._ss(21, 24, h)) +
                    0.3 * this._gauss(h, 8.5, 1.2) +
                    0.3 * this._gauss(h, 18, 1.5)
            )
        );
        const hh = h < 12 ? h + 24 : h; // continuous across midnight
        f.bar = this._ss(19.5, 21.5, hh) * (1 - this._ss(26.5, 28.5, hh));
        f.crickets = this._ss(20.5, 22, hh) * (1 - this._ss(28.5, 30, hh));

        // Weather.
        const E = typeof Environment !== 'undefined' ? Environment : null;
        const wx = E ? E.weather : 'clear';
        const k = E ? Math.max(0, Math.min(1, E.weatherIntensity || 0)) : 0;
        f.rain = (wx === 'drizzle' ? 0.35 : wx === 'rain' ? 0.75 : wx === 'thunderstorm' ? 1 : 0) * k;
        f.storm = wx === 'thunderstorm' ? k : 0;
        f.snow = wx === 'snow' ? k : 0;
        f.fog = wx === 'fog' ? k : 0;
        f.windy = E && E.wind ? Math.min(1, Math.abs(E.wind.x || 0) / 1.1) : 0.2;
        f.sandstorm = E && E.desertWeather === 'sandstorm' ? 1 : 0;
        f.wet = E ? Math.max(0, Math.min(1, E._wetness || 0)) : 0;
        f.winter = E && E.season === 'winter' ? 1 : 0;

        // Camera: close = detail, far = bed; sky = wind; tunnel = rumble.
        f.near = Math.max(0, Math.min(1, (Z - 0.6) / 1.6));
        const groundY = G.groundY || vpH - 56;
        const gs = G.world ? G.world.y + groundY * Z : vpH * 0.75;
        f.under = Math.max(0, Math.min(1, (vpH * 0.6 - gs) / (vpH * 0.45)));
        f.sky = Math.max(0, Math.min(1, (gs - vpH * 0.95) / (vpH * 0.6)));
        const ts = G.world ? G.world.y + (groundY + 120) * Z : vpH;
        f.tunnelVis = ts > -40 && ts < vpH + 40 ? 1 : 0;
        f.wx = G.world ? G.world.x : 0;
        if (inside) {
            f.near = 0.5;
            f.under = 0;
            f.sky = 0;
            f.tunnelVis = 0;
        }

        this._senseEntities(f);
    },

    _screenX(worldX) {
        return this._f.wx + worldX * this._f.zoom;
    },

    _senseEntities(f) {
        const e = this._e;
        const vpW = f.vpW;
        // Screen-space senses only mean something while the street is on screen.
        const street = this.mode === 'outdoor' || this.mode === 'train';
        // Visible citizens → crowd size and where it stands.
        let n = 0;
        let sx = 0;
        if (street && G.charRefs && G.charLayer) {
            for (const id in G.charRefs) {
                const r = G.charRefs[id];
                const c = r && r.c;
                if (!c || c.parent !== G.charLayer || c.visible === false) continue;
                const x = this._screenX(c.x);
                if (x < 0 || x > vpW) continue;
                n++;
                sx += x;
            }
        }
        e.citizens = n;
        e.citizenPan = n ? ((sx / n / vpW) * 2 - 1) * 0.7 : 0;

        // Cars: a Doppler pass-by when one crosses the middle of the screen.
        const now = this.ctx.currentTime;
        if (this.mode === 'outdoor' && G.cars && G.cars.length) {
            const mid = vpW / 2;
            for (const car of G.cars) {
                if (!car || !car.gfx || car.gfx.visible === false) continue;
                const x = this._screenX(car.gfx.x);
                const side = x < mid ? -1 : 1;
                const prev = this._carSide.get(car);
                this._carSide.set(car, side);
                if (
                    prev &&
                    prev !== side &&
                    x > -50 &&
                    x < vpW + 50 &&
                    now - (this._next.passby || 0) > 0.35
                ) {
                    this._next.passby = now;
                    this._passby(car, side); // relative motion: crossing into the right half = moving right
                }
            }
        }

        // Metro: nearest moving train, plus brake / door / spool cues on arrivals and departures.
        e.train = null;
        if (typeof Entities !== 'undefined') {
            let best = 0;
            const trains = [
                Entities.trainWest,
                Entities.trainEast,
                Entities.trainMid,
                Entities.trainDC,
                Entities.trainLongevity,
            ];
            const focus = G.trainFocus && Entities[G.trainFocus];
            for (const t of trains) {
                if (!t || !isFinite(t.x)) continue;
                const dx = Math.abs(t.x - f.cx);
                const near = dx < f.span * 0.8;
                const prev = this._trainState.get(t);
                if (prev && prev !== t.state && (near || t === focus) && street) {
                    if (prev === 'moving' && t.state === 'waiting') this._arrive(t);
                    else if (prev === 'waiting' && t.state === 'moving') this._depart(t);
                }
                this._trainState.set(t, t.state);
                if (!street || t.state !== 'moving') continue;
                const p = t === focus ? 1 : Math.max(0, 1 - dx / (f.span * 0.5 + 700));
                if (p > best) {
                    best = p;
                    e.train = t;
                    e.trainProx = p;
                }
            }
        }

        // Helicopters in the frame.
        e.heli = 0;
        if (street && typeof Entities !== 'undefined' && Entities.heliRefs) {
            for (const lab in Entities.heliRefs) {
                const hl = Entities.heliRefs[lab];
                if (!hl || !hl.cont || !hl.cont.visible) continue;
                if (
                    hl.state !== 'flying_to' &&
                    hl.state !== 'flying_home' &&
                    hl.state !== 'scenic_flight' &&
                    hl.state !== 'flying_to_hq' &&
                    hl.state !== 'takeoff' &&
                    hl.state !== 'landing' &&
                    hl.state !== 'landing_hq'
                )
                    continue;
                const x = this._screenX(hl.cont.x);
                const p = Math.max(0, 1 - Math.abs(x - vpW / 2) / (vpW * 0.9));
                if (p > e.heli) {
                    e.heli = p;
                    e.heliPan = (x / vpW) * 2 - 1;
                }
            }
        }

        // HN blimps drifting over.
        e.blimp = 0;
        if (street && typeof HNBlimps !== 'undefined' && HNBlimps._blimps) {
            for (const b of HNBlimps._blimps) {
                if (!b || !b.container || !b.container.parent) continue;
                const x = this._screenX(b.container.x);
                const p = Math.max(0, 1 - Math.abs(x - vpW / 2) / (vpW * 0.75));
                if (p > e.blimp) {
                    e.blimp = p;
                    e.blimpPan = (x / vpW) * 2 - 1;
                }
            }
        }

        // Real launches (SpaceEntities follows Launch Library): heard across the city.
        e.rocket = 0;
        if (typeof SpaceEntities !== 'undefined' && SpaceEntities.rockets) {
            for (const id in SpaceEntities.rockets) {
                const r = SpaceEntities.rockets[id];
                if (!r || !r.cont) continue;
                let k = 0;
                if (r.state === 'ignition') k = 0.55;
                else if (r.state === 'liftoff') k = 1;
                else if (r.state === 'ascending') k = Math.max(0, 1 - (r.baseY - r.cont.y) / 2600);
                if (!k) continue;
                k *= 1 / (1 + Math.abs(r.cont.x - f.cx) / 2600);
                if (k > e.rocket) {
                    e.rocket = k;
                    e.rocketPan = Math.max(-1, Math.min(1, (this._screenX(r.cont.x) / vpW) * 2 - 1)) * 0.8;
                }
            }
        }
    },

    // ─── The mix ────────────────────────────────────────────────────────────────────────────────
    _tick() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        const snd = this.snd;
        const audible = snd._sfxEnabled && !snd._sfxMutedByContext;
        if (!audible) {
            // Nothing to hear: let every layer wind down and free itself.
            for (const name in this._layers) this._set(name, 0, now, 0.3, 2);
            return;
        }
        if (typeof G === 'undefined' || !G.app) return;
        this._detectMode();
        this._sense();
        this._mix(now);
        this._schedule(now);
    },

    _mix(now) {
        const f = this._f;
        const w = this._w;
        const e = this._e;
        const g = (k) => w[k] || 0;
        const mode = this.mode;
        const out = mode === 'outdoor' ? 1 : mode === 'interior' ? 0.3 : mode === 'train' ? 0.55 : 0;
        const street = out > 0 ? 1 : 0; // street layers exist at all?

        // Street bus: walls, snow, depth and distance close the top end.
        let lp = 12000 - 5000 * (1 - f.near);
        lp *= 1 - 0.75 * f.snow;
        lp = Math.min(lp, 12000 * (1 - f.under) + 650 * f.under);
        if (mode === 'interior') lp = 380;
        if (mode === 'train') lp = 900;
        this.busLP.frequency.setTargetAtTime(Math.max(200, lp), now, 0.4);
        this.busGain.gain.setTargetAtTime(out, now, mode === 'outdoor' ? 0.8 : 0.5);

        // Gusts: a slow random walk shared by wind, sand and leaves.
        this._gustT += 0.125;
        const t = this._gustT;
        this._gust += (0.5 + 0.28 * Math.sin(t * 0.9) + 0.2 * Math.sin(t * 0.37 + 1.3) - this._gust) * 0.2;
        this._gust += (Math.random() - 0.5) * 0.04;
        const gust = Math.max(0.1, Math.min(1, this._gust));

        const above = 1 - f.under;
        const bed = 0.75 + 0.25 * f.near;
        const detail = 0.35 + 0.65 * f.near;
        const quietSnow = 1 - 0.5 * f.snow;

        this._set('city', street * f.urban * f.traffic * bed * quietSnow * (1 - 0.6 * f.under), now);
        const windK =
            street *
            above *
            (f.open * (0.35 + 0.65 * f.windy) + 0.3 * f.storm + 0.5 * f.sky + 0.2 * (1 - f.near)) *
            (1 - 0.5 * f.fog);
        const wind = this._set('wind', Math.min(1.4, windK), now);
        if (wind) {
            wind.bp.frequency.setTargetAtTime(330 + 520 * gust + 300 * f.storm, now, 0.3);
            wind.gust.gain.setTargetAtTime(0.55 + 0.7 * gust, now, 0.3);
            this._setPan(wind.pan, Math.sin(t * 0.13) * 0.5, now, 0.5);
        }
        const sand = this._set(
            'sand',
            street * above * g('desert') * (0.2 + 0.8 * f.sandstorm) * (0.4 + 0.6 * gust),
            now
        );
        if (sand) sand.gust.gain.setTargetAtTime(0.5 + 0.8 * gust, now, 0.25);

        this._set('rain', street * f.rain * (1 - 0.5 * f.under), now, 1.2);
        const pat = this._set(
            'patter',
            f.rain > 0
                ? Math.pow(f.rain, 0.7) *
                      (mode === 'outdoor'
                          ? (0.4 + 0.6 * f.near) * (1 - 0.7 * f.under)
                          : mode === 'interior'
                            ? 0.3
                            : mode === 'train'
                              ? 0.15
                              : 0)
                : 0,
            now,
            1.2
        );
        if (pat) pat.tone.frequency.setTargetAtTime(mode === 'interior' ? 2200 : 9000, now, 0.4);

        this._set('waves', street * above * g('port') * (0.85 + 0.3 * f.storm), now, 1.2);
        this._set('servers', street * g('compute') * detail, now);
        this._set('mains', street * g('power') * (0.4 + 0.6 * f.near), now);
        this._set('turbine', street * above * g('power') * (0.3 + 0.7 * f.windy) * (1 - f.fog), now);
        const lv = this._set(
            'leaves',
            street * above * f.nature * (0.25 + 0.75 * f.windy) * (1 - f.snow),
            now
        );
        if (lv) {
            lv.gust.gain.setTargetAtTime(0.4 + 0.9 * gust, now, 0.25);
            this._setPan(lv.pan, Math.sin(t * 0.21 + 2) * 0.6, now, 0.6);
        }
        this._set('fountain', street * above * g('park') * detail, now);

        const crick =
            street *
            above *
            Math.min(1, f.nature + 0.4 * g('graveyard') + 0.2 * g('campus')) *
            f.crickets *
            (1 - f.winter) *
            (1 - Math.min(1, f.rain * 1.5)) *
            (1 - f.snow);
        this._set('crickets', crick, now, 1.5);

        // The bar's loop: through the wall at night outside; inside the Neon Bar it's the room's
        // music (always on, walls gone), and the API Cafe plays it soft as a lofi café track.
        // It skips the street bus and muffles itself with its own low-pass.
        const venue = mode === 'interior' ? this.modeBld : null;
        let barK = street * g('nightlife') * f.bar * (1 - 0.4 * f.under);
        let barLP = 240 + 520 * f.near * g('nightlife');
        if (venue === 'neon_bar') {
            barK = 1.8; // the room's own music, louder than through the wall
            barLP = 2400;
        } else if (venue === 'cafe') {
            barK = 0.35;
            barLP = 1100;
        } else if (mode === 'interior') {
            barK *= 0.3; // next door, through two walls
            barLP = 200;
        } else if (mode === 'train') barK *= 0.5;
        const bar = this._set('bar', barK, now, 1.0);
        if (bar) bar.lp.frequency.setTargetAtTime(barLP, now, 0.5);
        this._set(
            'neon',
            street *
                (g('nightlife') + 0.3 * g('downtown') + 0.2 * g('finance')) *
                (0.25 + 0.75 * f.night) *
                f.near,
            now
        );

        // Murmur: the street's visible citizens outdoors, the room's own people indoors.
        let crowdK = 0;
        let crowdPan = 0;
        if (mode === 'outdoor') {
            crowdK =
                Math.min(1, Math.sqrt(e.citizens) / 8) * detail * (1 - 0.5 * f.rain) * (1 - 0.8 * f.under);
            crowdPan = e.citizenPan;
        } else if (mode === 'interior') {
            const mod = typeof Interior !== 'undefined' && Interior.activeModule;
            const n = mod && Array.isArray(mod.avatars) ? mod.avatars.length : 0;
            // A café or the arena chatters; an office floor hums along quietly.
            const lively = /^(cafe|neon_bar|arena|gym|convention_center|black_market)$/.test(
                this.modeBld || ''
            );
            crowdK = Math.min(0.8, Math.sqrt(n) / 6) * (lively ? 1 : this.modeEnv === 'hq' ? 0.45 : 0.65);
        }
        const crowd = this._set('crowd', crowdK, now, 0.8);
        if (crowd) {
            this._setPan(crowd.pan, crowdPan, now, 0.6);
            crowd.lp.frequency.setTargetAtTime(mode === 'interior' ? 2600 : 3500, now, 0.4);
        }

        // Underground: tunnel tone and the nearest metro train.
        const tunnelK =
            mode === 'train'
                ? 0.9
                : mode === 'interior' && this.modeEnv === 'metro'
                  ? 0.6
                  : mode === 'outdoor'
                    ? 0.9 * f.under + 0.12 * f.tunnelVis
                    : 0;
        this._set('tunnel', tunnelK, now, 0.8);
        let trainK = 0;
        if (e.train && (mode === 'outdoor' || mode === 'train')) {
            trainK = mode === 'train' ? 1 : e.trainProx * (0.3 + 0.7 * Math.max(f.under, 0.5 * f.tunnelVis));
        }
        const tr = this._set('train', trainK, now, 0.5, 6);
        if (tr && e.train) {
            const spd = Math.max(0.5, Math.abs(e.train.speed || 2));
            tr.clack.playbackRate.setTargetAtTime(0.12 + spd * 0.07, now, 0.4);
            const px = mode === 'train' ? 0 : ((this._screenX(e.train.x) / f.vpW) * 2 - 1) * 0.85;
            this._setPan(tr.pan, px, now, 0.25);
        }

        const heli = this._set('heli', street * e.heli * (0.4 + 0.6 * f.near), now, 0.4, 5);
        if (heli) this._setPan(heli.pan, e.heliPan * 0.85, now, 0.25);
        const blimp = this._set('blimp', street * above * e.blimp * 0.7, now, 0.8, 5);
        if (blimp) this._setPan(blimp.pan, e.blimpPan * 0.8, now, 0.4);
        const rk = this._set('rocket', street * e.rocket, now, 0.6, 6);
        if (rk) this._setPan(rk.pan, e.rocketPan || 0, now, 0.4);

        this._set('room', mode === 'interior' ? 1 : 0, now, 0.8);
        this._set('space', mode === 'orbit' ? 1 : mode === 'holomap' ? 0.6 : 0, now, 1.5);
    },

    // ─── Timed and rhythmic events ──────────────────────────────────────────────────────────────
    // Fire `fn(weight)` every [min, max] seconds while `weight` is up; quieter weights wait longer.
    _maybe(kind, now, weight, min, max, fn) {
        let next = this._next[kind];
        if (next === undefined) {
            next = this._next[kind] = now + Math.random() * max;
        }
        if (weight <= 0.03) {
            if (next < now + min) this._next[kind] = now + min * Math.random() + 0.5;
            return;
        }
        if (now < next) return;
        fn.call(this, Math.min(1, weight));
        this._fired[kind] = (this._fired[kind] || 0) + 1;
        this._next[kind] = now + (min + Math.random() * (max - min)) / Math.max(0.3, Math.min(1, weight));
    },

    _schedule(now) {
        const f = this._f;
        const w = this._w;
        const g = (k) => w[k] || 0;
        const out = this.mode === 'outdoor';
        const near = f.near;
        const dry = 1 - Math.min(1, f.rain * 1.4);
        const birdTime = Math.min(1, 0.35 * f.day + f.dawn);

        if (out) {
            this._maybe('gull', now, g('port') * f.day * dry, 4, 14, this._gull);
            this._maybe(
                'foghorn',
                now,
                g('port') > 0.3 ? g('port') : 0,
                f.fog > 0.3 ? 18 : 45,
                f.fog > 0.3 ? 35 : 100,
                this._foghorn
            );
            this._maybe(
                'bird',
                now,
                f.nature * birdTime * dry * (f.winter ? 0.4 : 1) * (1 - f.snow),
                0.8,
                3.5,
                this._bird
            );
            this._maybe(
                'frog',
                now,
                (g('park') + 0.3 * g('forest')) * f.night * (1 - f.winter) * dry,
                2.5,
                8,
                this._frog
            );
            this._maybe(
                'chime',
                now,
                (g('suburb') + g('estate')) * (f.windy > 0.35 ? 1 : 0) * dry,
                6,
                18,
                this._chime
            );
            this._maybe('quindar', now, g('desert') > 0.2 ? g('desert') : 0, 22, 55, this._quindar);
            this._maybe(
                'clank',
                now,
                g('desert') * 0.6 + g('robotics') * 0.5 + g('port') * 0.4,
                7,
                22,
                this._clank
            );
            this._maybe(
                'siren',
                now,
                f.urban * (0.5 + 0.5 * f.night) * (f.h > 1.5 && f.h < 5 ? 0.3 : 1),
                80,
                220,
                this._siren
            );
            this._maybe('horn', now, f.urban * f.traffic * f.day * near, 25, 70, this._horn);
            this._maybe('chirp', now, g('compute') + g('network'), 4, 12, this._chirp);
            this._maybe('servo', now, g('robotics'), 2, 6, this._servo);
            this._maybe('zap', now, g('power') * (0.4 + 0.6 * f.rain), 10, 30, this._zap);
            this._maybe('clink', now, g('nightlife') * f.bar * near, 8, 20, this._clink);
            this._maybe('ghost', now, g('graveyard') * (0.3 + 0.7 * f.night), 12, 30, this._ghost);
            this._ecg(now, g('clinic') * near);
        }
        // Track the hour everywhere so a bell never tolls late when you step back outside.
        this._bell(now, out ? g('campus') : 0, f.h);
        // Storms keep rolling while you're indoors (Environment pauses inside buildings).
        if (this.mode === 'interior') {
            this._maybe('thunderIn', now, f.storm, 12, 35, () => this.thunder());
            if (this.modeBld === 'neon_bar') {
                this._maybe('clinkIn', now, 1, 3, 9, (k) => this._clink(k * 2.5, this.direct));
            }
        }

        this._crickets(now);
        this._barBeat(now);
    },

    // Crickets: three 22 ms pulses per chirp, each voice on its own rhythm, written 0.3 s ahead.
    _crickets(now) {
        const L = this._layers.crickets;
        if (!L) {
            this._cr = null;
            return;
        }
        if (!this._cr) this._cr = [now + Math.random() * 0.5, now + 0.3 + Math.random() * 0.5];
        const gaps = [0.62, 0.81];
        for (let v = 0; v < 2; v++) {
            const gp = L.voices[v].gain;
            while (this._cr[v] < now + 0.3) {
                const t0 = Math.max(this._cr[v], now + 0.01);
                for (let i = 0; i < 3; i++) {
                    const t = t0 + i * 0.048;
                    gp.setValueAtTime(0, t);
                    gp.linearRampToValueAtTime(1, t + 0.006);
                    gp.setValueAtTime(1, t + 0.02);
                    gp.linearRampToValueAtTime(0, t + 0.028);
                }
                this._cr[v] = t0 + gaps[v] + Math.random() * 0.25;
            }
        }
    },

    // The Neon Bar's loop: 92 BPM, kick on every beat, snare on 2 and 4, eighth-note bass.
    _barBeat(now) {
        const L = this._layers.bar;
        if (!L) {
            this._barNext = 0;
            return;
        }
        const beat = 60 / 92;
        const roots = [55, 73.42, 49, 65.41]; // A1 D2 G1 C2 — Am7 · Dm7 · G7 · Cmaj7
        if (!this._barNext || this._barNext < now) this._barNext = now + 0.05;
        while (this._barNext < now + 0.3) {
            const t = this._barNext;
            const i = this._beat++;
            L.kick.frequency.setValueAtTime(130, t);
            L.kick.frequency.exponentialRampToValueAtTime(46, t + 0.11);
            L.kg.gain.setValueAtTime(0.0001, t);
            L.kg.gain.exponentialRampToValueAtTime(1, t + 0.004);
            L.kg.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
            if (i % 2 === 1) {
                L.sg.gain.setValueAtTime(0.0001, t);
                L.sg.gain.exponentialRampToValueAtTime(0.55, t + 0.004);
                L.sg.gain.exponentialRampToValueAtTime(0.0001, t + 0.17);
            }
            const root = roots[Math.floor(i / 4) % 4];
            for (let k = 0; k < 2; k++) {
                const tb = t + (k * beat) / 2;
                L.bass.frequency.setValueAtTime(k ? root * 2 : root, tb);
                L.bg.gain.setValueAtTime(0.0001, tb);
                L.bg.gain.exponentialRampToValueAtTime(0.5, tb + 0.012);
                L.bg.gain.exponentialRampToValueAtTime(0.0001, tb + beat * 0.45);
            }
            this._barNext = t + beat;
        }
    },

    // Longevity Wing: a heart monitor at 72 BPM while you're close.
    _ecg(now, k) {
        if (k < 0.15) {
            this._ecgNext = 0;
            return;
        }
        if (!this._ecgNext || this._ecgNext < now) this._ecgNext = now + 0.1;
        while (this._ecgNext < now + 0.3) {
            this._tone({
                type: 'sine',
                f: 1000,
                a: 0.004,
                h: 0.05,
                r: 0.03,
                g: 0.02 * k,
                pan: 0.3,
                when: this._ecgNext,
            });
            this._ecgNext += 60 / 72;
        }
    },

    // AI Academy's bell tolls the hour (8:00–21:00) when you're near the campus.
    _bell(now, k, h) {
        const hour = Math.floor(h);
        if (this._hour === -1) this._hour = hour;
        if (hour === this._hour) return;
        this._hour = hour;
        if (k < 0.15 || hour < 8 || hour > 21) return;
        const strikes = hour % 12 || 12;
        for (let i = 0; i < strikes; i++) this._bellStrike(now + 0.1 + i * 2.4, 0.06 * Math.min(1, k * 1.5));
        this._fired.bell = (this._fired.bell || 0) + 1;
    },

    // ─── One-shot voices ────────────────────────────────────────────────────────────────────────
    _ok() {
        return (
            this.ctx && this.ctx.state === 'running' && this.snd._sfxEnabled && !this.snd._sfxMutedByContext
        );
    },

    // Short-lived voice: (filter) → env → (pan) → dest. Every node is dropped when `last` ends.
    _voiceOut(filter, env, pan, dest) {
        if (filter) filter.connect(env);
        this._chain(env, pan, dest || this.bus);
        return filter || env;
    },
    _release(last, nodes) {
        this._live++;
        last.onended = () => {
            this._live--;
            for (const n of nodes) {
                if (!n) continue;
                try {
                    n.disconnect();
                } catch (e) {
                    /* gone */
                }
            }
        };
    },

    _envelope(gp, t, a, h, r, peak) {
        gp.setValueAtTime(0.0001, t);
        gp.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + Math.max(0.002, a));
        gp.setValueAtTime(Math.max(0.0002, peak), t + a + h);
        gp.exponentialRampToValueAtTime(0.0001, t + a + h + r);
    },

    // Noise burst. o: { buf, rate, type, freq, freqEnd, q, a, h, r, g, pan, panEnd, when }
    _burst(o) {
        if (!this._ok()) return;
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime + 0.01, o.when || 0);
        const dur = o.a + o.h + o.r;
        const s = ctx.createBufferSource();
        s.buffer = o.buf || this.white;
        s.loop = true;
        s.playbackRate.value = o.rate || 1;
        const filt = o.type ? this._filter(o.type, o.freq, o.q) : null;
        if (filt && o.freqEnd) {
            filt.frequency.setValueAtTime(o.freq, t);
            filt.frequency.exponentialRampToValueAtTime(o.freqEnd, t + dur);
        }
        const env = this._gain(0.0001);
        this._envelope(env.gain, t, o.a, o.h, o.r, o.g);
        const pan = this._pan(o.pan || 0);
        if (pan && o.panEnd !== undefined) {
            pan.pan.setValueAtTime(o.pan || 0, t);
            pan.pan.linearRampToValueAtTime(o.panEnd, t + dur);
        }
        s.connect(this._voiceOut(filt, env, pan, o.dest));
        s.start(t, Math.random() * 3.5);
        s.stop(t + dur + 0.05);
        this._release(s, [s, filt, env, pan]);
    },

    // Oscillator voice. o: { type, f | glide: [[dt, hz], ...], vib: [rate, depth],
    //                        partials: [[mult, amp], ...], filter: [type, hz, q],
    //                        a, h, r, g, pan, dest, when }
    _tone(o) {
        if (!this._ok()) return;
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime + 0.01, o.when || 0);
        const end = t + o.a + o.h + o.r + 0.05;
        const env = this._gain(0.0001);
        this._envelope(env.gain, t, o.a, o.h, o.r, o.g);
        const filt = o.filter ? this._filter(o.filter[0], o.filter[1], o.filter[2]) : null;
        const pan = this._pan(o.pan || 0);
        const head = this._voiceOut(filt, env, pan, o.dest);
        const nodes = [filt, env, pan];
        let last = null;
        for (const [mult, amp] of o.partials || [[1, 1]]) {
            const osc = ctx.createOscillator();
            osc.type = o.type || 'sine';
            if (o.glide) {
                osc.frequency.setValueAtTime(o.glide[0][1] * mult, t);
                for (let i = 1; i < o.glide.length; i++) {
                    osc.frequency.linearRampToValueAtTime(o.glide[i][1] * mult, t + o.glide[i][0]);
                }
            } else osc.frequency.setValueAtTime(o.f * mult, t);
            if (o.vib) {
                const lfo = ctx.createOscillator();
                lfo.frequency.value = o.vib[0];
                const d = this._gain(o.vib[1] * mult);
                lfo.connect(d);
                d.connect(osc.frequency);
                lfo.start(t);
                lfo.stop(end);
                nodes.push(lfo, d);
            }
            if (amp !== 1) {
                const ag = this._gain(amp);
                ag.connect(head);
                osc.connect(ag);
                nodes.push(ag);
            } else osc.connect(head);
            osc.start(t);
            osc.stop(end);
            nodes.push(osc);
            last = osc;
        }
        this._release(last, nodes);
    },

    // Rolling thunder: an optional close crack, then two to four ever-lower swells.
    thunder() {
        if (!this._ok()) return;
        const t = this.ctx.currentTime + 0.02;
        const close = Math.random() < 0.35;
        const pan = Math.random() * 1.2 - 0.6;
        this._fired.thunder = (this._fired.thunder || 0) + 1;
        if (close) {
            this._burst({
                type: 'highpass',
                freq: 900,
                q: 0.5,
                a: 0.004,
                h: 0.04,
                r: 0.6,
                g: 0.3,
                pan,
                when: t,
            });
        }
        const n = 2 + Math.floor(Math.random() * 3);
        let at = t + (close ? 0.05 : 0.2);
        for (let i = 0; i < n; i++) {
            this._burst({
                rate: 0.5,
                type: 'lowpass',
                freq: 420 - i * 80,
                freqEnd: 85,
                q: 0.6,
                a: 0.12 + Math.random() * 0.1,
                h: 0.2 + Math.random() * 0.4,
                r: 2.4 + Math.random() * 2.6,
                g: (0.85 - i * 0.17) * (close ? 1 : 0.65),
                pan: pan + (Math.random() - 0.5) * 0.4,
                when: at,
            });
            at += 0.35 + Math.random() * 0.7;
        }
    },

    _gull(k) {
        const pan = Math.random() * 1.6 - 0.8;
        let t = this.ctx.currentTime + 0.05;
        const calls = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < calls; i++) {
            const f0 = 1250 + Math.random() * 250;
            this._tone({
                type: 'sawtooth',
                glide: [
                    [0, f0 * 0.85],
                    [0.06, f0 * 1.25],
                    [0.32, f0 * 0.72],
                ],
                vib: [28, 35],
                filter: ['bandpass', 1900, 2.5],
                a: 0.02,
                h: 0.18,
                r: 0.12,
                g: 0.07 * k,
                pan,
                when: t,
            });
            t += 0.38 + Math.random() * 0.2;
        }
    },

    _foghorn(k) {
        this._tone({
            type: 'sawtooth',
            f: 73.4,
            partials: [
                [1, 1],
                [1.007, 1],
                [2, 0.4],
            ],
            filter: ['lowpass', 420, 0.8],
            a: 0.5,
            h: 2.0,
            r: 1.4,
            g: 0.16 * k,
            pan: Math.random() * 0.6 - 0.3,
        });
    },

    _bird(k) {
        const pan = Math.random() * 1.6 - 0.8;
        const g = (0.04 + Math.random() * 0.05) * k;
        let t = this.ctx.currentTime + 0.03;
        const kind = Math.random();
        if (kind < 0.45) {
            // Warble: a run of quick, wandering notes.
            const n = 4 + Math.floor(Math.random() * 6);
            let fq = 2600 + Math.random() * 1500;
            for (let i = 0; i < n; i++) {
                const d = 0.04 + Math.random() * 0.05;
                const f2 = fq * (0.85 + Math.random() * 0.35);
                this._tone({
                    glide: [
                        [0, fq],
                        [d, f2],
                    ],
                    a: 0.005,
                    h: d * 0.6,
                    r: d * 0.4,
                    g,
                    pan,
                    when: t,
                });
                t += d + 0.012;
                fq = f2 > 4800 ? 3000 : f2;
            }
        } else if (kind < 0.75) {
            // "Tee-yoo" whistle.
            this._tone({
                glide: [
                    [0, 3300],
                    [0.16, 3500],
                ],
                a: 0.02,
                h: 0.12,
                r: 0.05,
                g,
                pan,
                when: t,
            });
            this._tone({
                glide: [
                    [0, 3000],
                    [0.22, 2350],
                ],
                a: 0.02,
                h: 0.15,
                r: 0.07,
                g,
                pan,
                when: t + 0.24,
            });
        } else {
            // Falling trill.
            const n = 8 + Math.floor(Math.random() * 8);
            for (let i = 0; i < n; i++) {
                this._tone({
                    glide: [
                        [0, 5200 - i * 90],
                        [0.025, 4800 - i * 90],
                    ],
                    a: 0.003,
                    h: 0.012,
                    r: 0.012,
                    g: g * 0.8,
                    pan,
                    when: t + i * 0.05,
                });
            }
        }
    },

    _frog(k) {
        const pan = Math.random() * 1.2 - 0.6;
        const t = this.ctx.currentTime + 0.03;
        for (let i = 0; i < 2; i++) {
            this._tone({
                type: 'square',
                glide: [
                    [0, 190 - i * 25],
                    [0.07, 150 - i * 20],
                ],
                filter: ['bandpass', 900, 5],
                a: 0.005,
                h: 0.05,
                r: 0.03,
                g: 0.06 * k,
                pan,
                when: t + i * 0.11,
            });
        }
    },

    // The old outdoor wind chime, now only where there are porches and a breeze.
    _chime(k) {
        const notes = [523, 587, 659, 784, 880];
        const t = this.ctx.currentTime + 0.02;
        const n = 2 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i++) {
            this._tone({
                f: notes[Math.floor(Math.random() * notes.length)],
                partials: [
                    [1, 1],
                    [2.76, 0.3],
                ],
                a: 0.003,
                h: 0.02,
                r: 1.6,
                g: 0.012 * k,
                pan: 0.4,
                when: t + i * (0.12 + Math.random() * 0.25),
            });
        }
    },

    // Mission control radio: Quindar intro tone, a burst of squelchy voice, outro tone.
    _quindar(k) {
        const t = this.ctx.currentTime + 0.05;
        const pan = -0.35;
        this._tone({ f: 2525, a: 0.005, h: 0.24, r: 0.01, g: 0.018 * k, pan, when: t });
        let at = t + 0.35;
        const syll = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < syll; i++) {
            const d = 0.12 + Math.random() * 0.22;
            this._burst({
                type: 'bandpass',
                freq: 1200 + Math.random() * 500,
                q: 3,
                a: 0.02,
                h: d,
                r: 0.04,
                g: 0.05 * k,
                pan,
                when: at,
            });
            at += d + 0.06 + Math.random() * 0.1;
        }
        this._tone({ f: 2475, a: 0.005, h: 0.24, r: 0.01, g: 0.018 * k, pan, when: at + 0.1 });
    },

    _clank(k) {
        const pan = Math.random() * 1.4 - 0.7;
        this._tone({
            f: 1180,
            partials: [
                [1, 1],
                [2.5, 0.5],
                [3.92, 0.3],
            ],
            a: 0.002,
            h: 0.01,
            r: 0.45,
            g: 0.02 * k,
            pan,
        });
        this._burst({ type: 'highpass', freq: 2500, q: 0.7, a: 0.002, h: 0.005, r: 0.05, g: 0.04 * k, pan });
    },

    // Far-off siren: a slow wail, low-passed by distance, drifting across.
    _siren(k) {
        const t = this.ctx.currentTime + 0.05;
        const glide = [[0, 680]];
        for (let i = 1; i <= 6; i++) glide.push([i * 1.3, i % 2 ? 980 : 680]);
        this._tone({
            glide,
            filter: ['lowpass', 1400, 0.7],
            a: 1.5,
            h: 4.2,
            r: 2.0,
            g: 0.016 * k,
            pan: Math.random() < 0.5 ? -0.6 : 0.6,
            when: t,
        });
    },

    _horn(k) {
        const t = this.ctx.currentTime + 0.02;
        const pan = Math.random() * 1.4 - 0.7;
        for (let i = 0; i < 2; i++) {
            this._tone({
                type: 'square',
                f: 392,
                partials: [
                    [1, 1],
                    [1.26, 1],
                ],
                filter: ['bandpass', 850, 1],
                a: 0.01,
                h: 0.14,
                r: 0.04,
                g: 0.012 * k,
                pan,
                when: t + i * 0.24,
            });
        }
    },

    _chirp(k) {
        const t = this.ctx.currentTime + 0.02;
        const f0 = 1500 + Math.random() * 900;
        for (let i = 0; i < 3; i++) {
            this._tone({
                type: 'square',
                f: f0 * (1 + 0.25 * i),
                filter: ['lowpass', 3000, 0.7],
                a: 0.002,
                h: 0.025,
                r: 0.01,
                g: 0.006 * k,
                pan: Math.random() * 1.2 - 0.6,
                when: t + i * 0.045,
            });
        }
    },

    _servo(k) {
        const pan = Math.random() * 1.4 - 0.7;
        if (Math.random() < 0.6) {
            const up = Math.random() < 0.5;
            this._tone({
                type: 'sawtooth',
                glide: [
                    [0, up ? 180 : 420],
                    [0.45, up ? 420 : 180],
                ],
                filter: ['bandpass', 1200, 2],
                a: 0.04,
                h: 0.35,
                r: 0.08,
                g: 0.02 * k,
                pan,
            });
        } else {
            this._burst({
                type: 'highpass',
                freq: 3000,
                q: 0.6,
                a: 0.01,
                h: 0.12,
                r: 0.15,
                g: 0.03 * k,
                pan,
            }); // pneumatics
        }
    },

    _zap(k) {
        this._burst({
            buf: this.crackle,
            rate: 2,
            type: 'highpass',
            freq: 2500,
            q: 0.6,
            a: 0.004,
            h: 0.1,
            r: 0.12,
            g: 0.12 * k,
            pan: Math.random() * 1.2 - 0.6,
        });
    },

    _clink(k, dest) {
        const t = this.ctx.currentTime + 0.02;
        const pan = Math.random() * 1.2 - 0.6;
        for (const fq of [3150, 4730]) {
            this._tone({
                f: fq * (0.97 + Math.random() * 0.06),
                a: 0.002,
                h: 0.005,
                r: 0.25,
                g: 0.008 * k,
                pan,
                dest,
                when: t,
            });
        }
    },

    _ghost(k) {
        this._tone({
            glide: [
                [0, 380],
                [2.4, 300],
            ],
            vib: [5, 12],
            filter: ['lowpass', 900, 0.7],
            a: 0.8,
            h: 0.8,
            r: 0.8,
            g: 0.014 * k,
            pan: Math.random() * 1.2 - 0.6,
        });
    },

    _bellStrike(at, g) {
        // A bell's partials: hum, prime, minor third, fifth, nominal and two uppers.
        this._tone({
            f: 196,
            partials: [
                [0.5, 0.6],
                [1, 1],
                [1.2, 0.5],
                [1.5, 0.4],
                [2, 0.3],
                [2.5, 0.15],
                [3, 0.1],
            ],
            a: 0.003,
            h: 0.02,
            r: 3.2,
            g,
            pan: -0.2,
            when: at,
        });
    },

    // Car crossing the middle of the screen: Doppler-swept noise panned with it; trucks add
    // rumble, wet roads add tyre spray.
    _passby(car, dir) {
        const f = this._f;
        const truck = !!car.isTruck;
        const dur = truck ? 2.2 : 1.4;
        const k = 0.35 + 0.65 * f.near;
        const p0 = -0.85 * (dir || 1);
        const base = { a: dur * 0.45, h: 0.05, r: dur * 0.5, pan: p0, panEnd: -p0 };
        this._burst({ ...base, rate: 0.7, type: 'bandpass', freq: 950, freqEnd: 520, q: 0.9, g: 0.09 * k });
        if (truck) this._burst({ ...base, rate: 0.5, type: 'lowpass', freq: 170, q: 0.7, g: 0.22 * k });
        if (f.wet > 0.3) this._burst({ ...base, type: 'highpass', freq: 3200, q: 0.6, g: 0.05 * f.wet * k });
        this._fired.passby = (this._fired.passby || 0) + 1;
    },

    _arrive(t) {
        const px = Math.max(-0.8, Math.min(0.8, ((this._screenX(t.x) / this._f.vpW) * 2 - 1) * 0.8));
        const now = this.ctx.currentTime;
        this._burst({
            type: 'bandpass',
            freq: 3000,
            freqEnd: 2100,
            q: 2,
            a: 0.05,
            h: 0.5,
            r: 0.4,
            g: 0.04,
            pan: px,
            dest: this.direct,
        });
        this._tone({
            f: 659,
            a: 0.01,
            h: 0.12,
            r: 0.25,
            g: 0.03,
            pan: px,
            dest: this.direct,
            when: now + 0.9,
        });
        this._tone({
            f: 523,
            a: 0.01,
            h: 0.12,
            r: 0.35,
            g: 0.03,
            pan: px,
            dest: this.direct,
            when: now + 1.15,
        });
        this._fired.arrive = (this._fired.arrive || 0) + 1;
    },

    _depart(t) {
        const px = Math.max(-0.8, Math.min(0.8, ((this._screenX(t.x) / this._f.vpW) * 2 - 1) * 0.8));
        this._tone({
            type: 'sawtooth',
            glide: [
                [0, 220],
                [2.4, 470],
            ],
            filter: ['lowpass', 1200, 0.7],
            a: 0.5,
            h: 1.4,
            r: 0.8,
            g: 0.014,
            pan: px,
            dest: this.direct,
        });
        this._fired.depart = (this._fired.depart || 0) + 1;
    },

    // ─── Dev ────────────────────────────────────────────────────────────────────────────────────
    debugState() {
        const r = (v) => Math.round(v * 1000) / 1000;
        const layers = {};
        for (const n in this._layers) layers[n] = r(this._layers[n].target);
        const zones = {};
        for (const k in this._w) if (this._w[k] > 0) zones[k] = r(this._w[k]);
        const f = {};
        for (const k of [
            'h',
            'day',
            'dawn',
            'traffic',
            'bar',
            'crickets',
            'rain',
            'storm',
            'snow',
            'fog',
            'windy',
            'near',
            'under',
            'sky',
            'urban',
            'open',
            'nature',
        ]) {
            if (this._f[k] !== undefined) f[k] = r(this._f[k]);
        }
        let nodes = 0;
        for (const n in this._layers) nodes += this._layers[n].nodes.filter(Boolean).length;
        return {
            mode: this.mode + (this.modeEnv ? ':' + this.modeEnv : ''),
            ctx: this.ctx ? this.ctx.state : 'none',
            zones,
            factors: f,
            layers,
            citizens: this._e.citizens,
            train: this._e.train ? r(this._e.trainProx || 0) : 0,
            heli: r(this._e.heli),
            blimp: r(this._e.blimp),
            rocket: r(this._e.rocket),
            fired: { ...this._fired },
            layerNodes: nodes,
            liveVoices: this._live,
        };
    },

    // Dev: RMS / peak (dBFS) of the bed over `ms`, tapped after the compressor.
    meter(ms) {
        if (!this.ctx) return Promise.resolve(null);
        const an = this.ctx.createAnalyser();
        an.fftSize = 2048;
        this.out.connect(an);
        const buf = new Float32Array(an.fftSize);
        let sum = 0;
        let count = 0;
        let peak = 0;
        return new Promise((resolve) => {
            const id = setInterval(() => {
                an.getFloatTimeDomainData(buf);
                for (let i = 0; i < buf.length; i++) {
                    const v = buf[i];
                    sum += v * v;
                    if (Math.abs(v) > peak) peak = Math.abs(v);
                }
                count += buf.length;
            }, 40);
            setTimeout(() => {
                clearInterval(id);
                this.out.disconnect(an);
                const db = (x) => (x > 0 ? Math.round(20 * Math.log10(x) * 10) / 10 : -120);
                resolve({ rmsDb: db(Math.sqrt(sum / Math.max(1, count))), peakDb: db(peak) });
            }, ms || 1000);
        });
    },

    _ss(a, b, x) {
        const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
        return t * t * (3 - 2 * t);
    },
    _gauss(x, mu, s) {
        const d = (x - mu) / s;
        return Math.exp(-0.5 * d * d);
    },
};
