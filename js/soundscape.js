/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUNDSCAPE (v2.0.0 — warm, velvety procedural city bed)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Continuous procedural WebAudio ambience built from two seamlessly loop-crossfaded 9-second
   stereo noise buffers (Pink −3 dB/oct and Brown −6 dB/oct) plus gentle filtered accents.
   Zero raw white noise, zero static crackle buffers, zero competing music/drones.

   Every continuous noise layer passes through dual-stage (4th-order, −24 dB/oct) low-pass
   filtering, and both output buses enforce a warm spectral ceiling so the ambient bed stays calm,
   non-fatiguing, and tucked cleanly beneath SingularityCity.mp3.

   Re-mixed ~8×/s from what is on screen:
     • zone mix   samples buildings across the viewport so districts cross-fade as you pan
                  (harbour surf & gulls, desert mission control, zoomed-in compute airflow,
                  park/forest breeze & fountain burble, campus hourly bell, quiet streets)
     • clock      G.getDayPhase(): dawn songbirds, rush-hour urban breath, night crickets/frogs
     • weather    Environment.weather / weatherIntensity / wind: warm pink/brown rainfall +
                  soft resonant water droplets, rolling thunder, snow hush, desert sandstorms
     • camera     zoom (close = district detail, far = soft air) and height (sky / deep tunnel)
     • entities   visible dense crowds, genuinely moving car pass-bys, underground metro trains,
                  on-screen helicopters, HN blimps, active on-screen rocket launches

   Everything connects exclusively into SND.ambientGain, so SFX toggles, Ambient volume and
   Terminal context mute cover it without touching SND.musicEl.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Soundscape = {
    ctx: null,
    snd: null,
    mode: 'outdoor',
    modeEnv: null,
    modeBld: null,
    // Dev hooks: force the clock (day phase 0..1) without touching the sim.
    debug: { dp: null },

    // Gain staging calibrated against SingularityCity.mp3 (−20.9 dBFS mono RMS at volume = 0.35;
    // 85.8% < 300 Hz, 0.3% > 2 kHz). Combined with SND.ambientGain (~0.35–0.40), clear-day scenes
    // stay <= −42 dBFS (20+ dB under music, > 2 kHz <= −52 dBFS) while active rain sits around
    // −35 to −30 dBFS outdoors and ~12 dB quieter & heavily muffled (~450 Hz) indoors.
    MASTER: 0.5,
    MAX_LIVE: 14,
    TRIM: {
        city: 0.48,
        wind: 0.36,
        sand: 0.72,
        rain: 1.78,
        waves: 0.54,
        servers: 0.32,
        turbine: 0.38,
        leaves: 0.34,
        fountain: 0.36,
        crickets: 0.028,
        neon: 0.018,
        crowd: 0.32,
        tunnel: 0.42,
        train: 0.62,
        heli: 0.62,
        blimp: 0.16,
        rocket: 1.05,
        room: 0.075,
        space: 0.16,
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
    _carWorldX: new WeakMap(),
    _trainState: new WeakMap(),
    _prevCx: null,
    _prevZoom: null,
    _gustT: 0,
    _gust: 0.5,
    _hour: -1,
    _cr: null, // cricket voice schedule
    _dropNext: 0,
    _fountainDropNext: 0,

    // ─── Boot ───────────────────────────────────────────────────────────────────────────────────
    init(snd) {
        if (this.ctx || !snd || !snd.ctx) return;
        this.snd = snd;
        const ctx = (this.ctx = snd.ctx);
        this.pink = this._makePink(9, 0.5);
        this.brown = this._makeBrown(9, 0.5);

        // Transparent peak safety limiter only (engages only above −8 dBFS, zero constant pumping).
        this.comp = ctx.createDynamicsCompressor();
        this.comp.threshold.value = -8;
        this.comp.knee.value = 6;
        this.comp.ratio.value = 12;
        this.comp.attack.value = 0.005;
        this.comp.release.value = 0.18;

        this.out = this._gain(this.MASTER);
        this.comp.connect(this.out);
        this.out.connect(snd.ambientGain);

        // Street bus: dual-stage (4th-order, −24 dB/oct) low-pass ceiling muffled by walls, snow,
        // distance or underground depth.
        this.bus = this._gain(1);
        this.busLP = this._filter('lowpass', 3200, 0.05);
        this.busLP2 = this._filter('lowpass', 3200, 0.05);
        this.busGain = this._gain(1);
        this._chain(this.bus, this.busLP, this.busLP2, this.busGain, this.comp);

        // Direct bus (room warmth, tunnel/train, space breath, indoor accents): also strictly
        // protected by a dual-stage (4th-order) low-pass ceiling so no harsh HF can ever leak.
        this.direct = this._gain(1);
        this.directLP = this._filter('lowpass', 2400, 0.05);
        this.directLP2 = this._filter('lowpass', 2400, 0.05);
        this._chain(this.direct, this.directLP, this.directLP2, this.comp);

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

    // ─── Seamless stereo Pink (−3 dB/oct) & Brown (−6 dB/oct) buffers ──────────────────────────
    _prng(seed) {
        let s = seed >>> 0 || 1;
        return () => {
            s ^= s << 13;
            s ^= s >>> 17;
            s ^= s << 5;
            return ((s >>> 0) / 4294967296) * 2 - 1;
        };
    },

    // Equal-power loop crossfade + DC removal + exact RMS normalization (0.22 RMS).
    _finalizeLoop(raw, n, xfade, targetRms) {
        const out = new Float32Array(n);
        const halfPi = Math.PI * 0.5;
        for (let i = 0; i < xfade; i++) {
            const u = i / xfade;
            out[i] = raw[i] * Math.sin(u * halfPi) + raw[n + i] * Math.cos(u * halfPi);
        }
        for (let i = xfade; i < n; i++) out[i] = raw[i];

        let mean = 0;
        for (let i = 0; i < n; i++) mean += out[i];
        mean /= n;
        let sq = 0;
        for (let i = 0; i < n; i++) {
            const v = out[i] - mean;
            out[i] = v;
            sq += v * v;
        }
        const rms = Math.sqrt(sq / n) || 1;
        const scale = targetRms / rms;
        for (let i = 0; i < n; i++) {
            const v = out[i] * scale;
            out[i] = v > 0.98 ? 0.98 : v < -0.98 ? -0.98 : v;
        }
        return out;
    },

    // Paul Kellet 7-stage Pink noise (−3 dB/oct), stereo decorrelated L/R, seamless loop.
    _makePink(secs, xfadeSecs) {
        const sr = this.ctx.sampleRate;
        const n = Math.floor(sr * (secs || 9));
        const xfade = Math.min(Math.floor(sr * (xfadeSecs || 0.5)), n >> 2);
        const warm = Math.floor(sr * 0.25);
        const total = n + xfade;
        const buf = this.ctx.createBuffer(2, n, sr);
        const hpA = Math.exp((-2 * Math.PI * 22) / sr);
        const seeds = [0x1a2b3c4d, 0x5e6f7a8b];
        for (let ch = 0; ch < 2; ch++) {
            const rand = this._prng(seeds[ch]);
            const raw = new Float32Array(total);
            let b0 = 0;
            let b1 = 0;
            let b2 = 0;
            let b3 = 0;
            let b4 = 0;
            let b5 = 0;
            let b6 = 0;
            let prevX = 0;
            let prevY = 0;
            for (let i = -warm; i < total; i++) {
                const w = rand();
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.969 * b2 + w * 0.153852;
                b3 = 0.8665 * b3 + w * 0.3104856;
                b4 = 0.55 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.016898;
                const x = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
                b6 = w * 0.115926;
                const y = hpA * (prevY + x - prevX);
                prevX = x;
                prevY = y;
                if (i >= 0) raw[i] = y;
            }
            buf.getChannelData(ch).set(this._finalizeLoop(raw, n, xfade, 0.22));
        }
        return buf;
    },

    // Leaky-integrator Brown noise (−6 dB/oct), stereo decorrelated L/R, seamless loop.
    _makeBrown(secs, xfadeSecs) {
        const sr = this.ctx.sampleRate;
        const n = Math.floor(sr * (secs || 9));
        const xfade = Math.min(Math.floor(sr * (xfadeSecs || 0.5)), n >> 2);
        const warm = Math.floor(sr * 0.25);
        const total = n + xfade;
        const buf = this.ctx.createBuffer(2, n, sr);
        const leak = Math.exp((-2 * Math.PI * 28) / sr);
        const step = Math.sqrt(1 - leak * leak);
        const hpA = Math.exp((-2 * Math.PI * 20) / sr);
        const seeds = [0x9c8d7e6f, 0x3b4c5d6e];
        for (let ch = 0; ch < 2; ch++) {
            const rand = this._prng(seeds[ch]);
            const raw = new Float32Array(total);
            let acc = 0;
            let prevX = 0;
            let prevY = 0;
            for (let i = -warm; i < total; i++) {
                acc = acc * leak + rand() * step;
                const y = hpA * (prevY + acc - prevX);
                prevX = acc;
                prevY = y;
                if (i >= 0) raw[i] = y;
            }
            buf.getChannelData(ch).set(this._finalizeLoop(raw, n, xfade, 0.22));
        }
        return buf;
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
        f.Q.value = q == null ? 0.707 : q;
        return f;
    },
    // Dual-stage (4th-order, −24 dB/oct) low-pass pair (Q ≈ 0 dB in W3C Web Audio = flat cutoff).
    _lp4(freq, q) {
        const qv = q == null ? 0.05 : q;
        return [this._filter('lowpass', freq, qv), this._filter('lowpass', freq, qv)];
    },
    _setLP4(pair, freq, now, tau) {
        const f = Math.max(60, freq);
        const t = tau || 0.35;
        pair[0].frequency.setTargetAtTime(f, now, t);
        pair[1].frequency.setTargetAtTime(f, now, t);
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
    _audible() {
        const snd = this.snd;
        if (!snd) return false;
        if (typeof snd._sfxAudible === 'function') return Boolean(snd._sfxAudible());
        const en = snd.enabled !== undefined ? snd.enabled : snd._sfxEnabled;
        return Boolean(en && !snd._sfxMutedByContext);
    },

    // ─── Layers ─────────────────────────────────────────────────────────────────────────────────
    // build(S) → { level: GainNode, nodes: [...], dest: 'bus' | 'direct', ...handles }
    // Every noise layer uses seamless stereo Pink/Brown buffers + dual-stage (4th-order) low-pass.
    LAYERS: {
        // Barely-there warm low urban breath (60–220 Hz brown noise, dual-LP).
        city(S) {
            const s = S._src(S.brown, 1, 0.2);
            const hp = S._filter('highpass', 58, 0.05);
            const lp = S._lp4(185);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], level], dest: 'bus' };
        },
        // Soft velvety brown-noise air (120–360 Hz, dual-LP); silent in calm clear downtown.
        wind(S) {
            const s = S._src(S.brown, 1, 1.4);
            const hp = S._filter('highpass', 95, 0.05);
            const lp = S._lp4(210);
            const gust = S._gain(0.75);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], gust, pan, level);
            return { level, nodes: [s, hp, lp[0], lp[1], gust, pan, level], dest: 'bus', lp, gust, pan };
        },
        // Warm mid-low desert sandstorm wind (220–750 Hz pink dual-LP); strictly 0 unless sandstorm.
        sand(S) {
            const s = S._src(S.pink, 1, 2.7);
            const hp = S._filter('highpass', 210, 0.05);
            const lp = S._lp4(480);
            const gust = S._gain(0.8);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], gust, level);
            return { level, nodes: [s, hp, lp[0], lp[1], gust, level], dest: 'bus', lp, gust };
        },
        // Warm dual-LP pink/brown rainfall wash (900–1700 Hz outdoors, muffled to ~400 Hz indoors
        // by busLP). Strictly 0 unless weather is drizzle/rain/thunderstorm.
        rain(S) {
            const sp = S._src(S.pink, 1, 0.6);
            const sb = S._src(S.brown, 1, 3.1);
            const gp = S._gain(0.88);
            const gb = S._gain(0.28);
            const hp = S._filter('highpass', 160, 0.05);
            const lp = S._lp4(1420);
            const level = S._gain(0);
            S._chain(sp, gp, hp);
            S._chain(sb, gb, hp);
            S._chain(hp, lp[0], lp[1], level);
            return { level, nodes: [sp, sb, gp, gb, hp, lp[0], lp[1], level], dest: 'bus', lp };
        },
        // Slow rhythmic warm ocean surf swell (80–420 Hz brown/pink dual-LP with 0.12 Hz wave LFO).
        waves(S) {
            const sb = S._src(S.brown, 1, 1.1);
            const sp = S._src(S.pink, 1, 4.3);
            const gb = S._gain(0.82);
            const gp = S._gain(0.24);
            const hp = S._filter('highpass', 72, 0.05);
            const lp = S._lp4(245);
            const swell = S._gain(0.58);
            const lfo = S._osc('sine', 0.12);
            const depth = S._gain(0.36);
            const fDepth = S._gain(110);
            lfo.connect(depth);
            depth.connect(swell.gain);
            lfo.connect(fDepth);
            fDepth.connect(lp[0].frequency);
            fDepth.connect(lp[1].frequency);
            const level = S._gain(0);
            S._chain(sb, gb, hp);
            S._chain(sp, gp, hp);
            S._chain(hp, lp[0], lp[1], swell, level);
            return {
                level,
                nodes: [sb, sp, gb, gp, hp, lp[0], lp[1], swell, lfo, depth, fDepth, level],
                dest: 'bus',
            };
        },
        // Quiet soft warm low compute airflow (110–320 Hz brown dual-LP, zero coil whine).
        servers(S) {
            const s = S._src(S.brown, 1, 0.9);
            const hp = S._filter('highpass', 105, 0.05);
            const lp = S._lp4(280);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], level], dest: 'bus' };
        },
        // Soft wind-farm blade breath (95–320 Hz brown dual-LP with smooth 0.68 Hz sine AM).
        turbine(S) {
            const s = S._src(S.brown, 1, 1.8);
            const hp = S._filter('highpass', 95, 0.05);
            const lp = S._lp4(310);
            const am = S._gain(0.6);
            const lfo = S._osc('sine', 0.68);
            const depth = S._gain(0.34);
            lfo.connect(depth);
            depth.connect(am.gain);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], am, level);
            return { level, nodes: [s, hp, lp[0], lp[1], am, lfo, depth, level], dest: 'bus' };
        },
        // Gentle slow-breathing warm pink foliage breeze (280–750 Hz dual-LP), zoomed into nature.
        leaves(S) {
            const s = S._src(S.pink, 1, 3.7);
            const hp = S._filter('highpass', 260, 0.05);
            const lp = S._lp4(480);
            const gust = S._gain(0.7);
            const pan = S._pan(0.15);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], gust, pan, level);
            return { level, nodes: [s, hp, lp[0], lp[1], gust, pan, level], dest: 'bus', lp, gust, pan };
        },
        // Soft warm low-mid park fountain burble (220–750 Hz dual-LP pink + slow LFO shimmer).
        fountain(S) {
            const s = S._src(S.pink, 1, 2.2);
            const hp = S._filter('highpass', 210, 0.05);
            const lp = S._lp4(520);
            const lfo = S._osc('sine', 0.35);
            const fDepth = S._gain(130);
            lfo.connect(fDepth);
            fDepth.connect(lp[0].frequency);
            fDepth.connect(lp[1].frequency);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], lfo, fDepth, level], dest: 'bus' };
        },
        // Night crickets: two warm field-cricket voices (< 3.8 kHz, soft pulse envelopes).
        crickets(S) {
            const o1 = S._osc('sine', 3280);
            const o2 = S._osc('sine', 3560);
            const g1 = S._gain(0);
            const g2 = S._gain(0);
            const p1 = S._pan(-0.45);
            const p2 = S._pan(0.45);
            const lp = S._filter('lowpass', 3800, 0.05);
            const level = S._gain(0);
            S._chain(o1, g1, p1, lp);
            S._chain(o2, g2, p2, lp);
            lp.connect(level);
            return { level, nodes: [o1, o2, g1, g2, p1, p2, lp, level], dest: 'bus', voices: [g1, g2] };
        },
        // Ultra-quiet warm low nightlife hum (soft 120 Hz triangle heavily dual-LP filtered).
        neon(S) {
            const o = S._osc('triangle', 120);
            const lp = S._lp4(220);
            const level = S._gain(0);
            S._chain(o, lp[0], lp[1], level);
            return { level, nodes: [o, lp[0], lp[1], level], dest: 'bus' };
        },
        // Ultra-subtle warm distant crowd murmur (180–580 Hz dual-LP pink, smooth slow sine LFOs).
        // Routed through street bus so it never bypasses busLP.
        crowd(S) {
            const s = S._src(S.pink, 1, 1.7);
            const hp = S._filter('highpass', 180, 0.05);
            const lp = S._lp4(460);
            const gA = S._gain(0.5);
            const gB = S._gain(0.5);
            const lfo1 = S._osc('sine', 0.23);
            const lfo2 = S._osc('sine', 0.37);
            const d1 = S._gain(0.22);
            const d2 = S._gain(0.2);
            lfo1.connect(d1);
            d1.connect(gA.gain);
            lfo2.connect(d2);
            d2.connect(gB.gain);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1]);
            S._chain(lp[1], gA, pan);
            S._chain(lp[1], gB, pan);
            if (pan) pan.connect(level);
            else {
                gA.connect(level);
                gB.connect(level);
            }
            return {
                level,
                nodes: [s, hp, lp[0], lp[1], gA, gB, lfo1, lfo2, d1, d2, pan, level],
                dest: 'bus',
                lp,
                pan,
            };
        },
        // Deep warm underground tunnel breath (45–135 Hz brown dual-LP).
        tunnel(S) {
            const s = S._src(S.brown, 1, 3.1);
            const hp = S._filter('highpass', 45, 0.05);
            const lp = S._lp4(130);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], level], dest: 'direct' };
        },
        // Warm low-end rolling metro rumble + gentle rhythmic rail-joint thump (zero crackle).
        train(S) {
            const r = S._src(S.brown, 0.75, 0.4);
            const hp = S._filter('highpass', 48, 0.05);
            const lp = S._lp4(135);
            const th = S._src(S.brown, 1, 4.6);
            const thBP = S._filter('bandpass', 210, 1.3);
            const thLP = S._lp4(310);
            const thAM = S._gain(0.2);
            const thLfo = S._osc('sine', 2.8);
            const thDepth = S._gain(0.16);
            thLfo.connect(thDepth);
            thDepth.connect(thAM.gain);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(r, hp, lp[0], lp[1], pan);
            S._chain(th, thBP, thLP[0], thLP[1], thAM, pan);
            if (pan) pan.connect(level);
            else {
                lp[1].connect(level);
                thAM.connect(level);
            }
            return {
                level,
                nodes: [r, hp, lp[0], lp[1], th, thBP, thLP[0], thLP[1], thAM, thLfo, thDepth, pan, level],
                dest: 'direct',
                roll: r,
                thumpLfo: thLfo,
                pan,
            };
        },
        // Smooth helicopter rotor thwop: warm LP (< 380 Hz) brown noise + smooth 12 Hz sine AM.
        heli(S) {
            const s = S._src(S.brown, 1, 0.8);
            const hp = S._filter('highpass', 65, 0.05);
            const lp = S._lp4(310);
            const am = S._gain(0.58);
            const lfo = S._osc('sine', 12);
            const depth = S._gain(0.36);
            lfo.connect(depth);
            depth.connect(am.gain);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], am, pan, level);
            return { level, nodes: [s, hp, lp[0], lp[1], am, lfo, depth, pan, level], dest: 'bus', pan };
        },
        // Ultra-quiet warm airy blimp drift (no pitched oscillator drone).
        blimp(S) {
            const s = S._src(S.brown, 1, 2.3);
            const hp = S._filter('highpass', 95, 0.05);
            const lp = S._lp4(240);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], pan, level);
            return { level, nodes: [s, hp, lp[0], lp[1], pan, level], dest: 'bus', pan };
        },
        // Active on-screen rocket launch: deep warm sub-rumble + low-mid roar (zero crackle).
        rocket(S) {
            const sub = S._src(S.brown, 0.65, 1.4);
            const subHP = S._filter('highpass', 40, 0.05);
            const subLP = S._lp4(150);
            const mid = S._src(S.pink, 0.85, 3.8);
            const midHP = S._filter('highpass', 140, 0.05);
            const midLP = S._lp4(460);
            const midAM = S._gain(0.45);
            const flut = S._osc('sine', 4.5);
            const fDepth = S._gain(0.14);
            flut.connect(fDepth);
            fDepth.connect(midAM.gain);
            const pan = S._pan(0);
            const level = S._gain(0);
            S._chain(sub, subHP, subLP[0], subLP[1], pan);
            S._chain(mid, midHP, midLP[0], midLP[1], midAM, pan);
            if (pan) pan.connect(level);
            else {
                subLP[1].connect(level);
                midAM.connect(level);
            }
            return {
                level,
                nodes: [
                    sub,
                    subHP,
                    subLP[0],
                    subLP[1],
                    mid,
                    midHP,
                    midLP[0],
                    midLP[1],
                    midAM,
                    flut,
                    fDepth,
                    pan,
                    level,
                ],
                dest: 'bus',
                pan,
            };
        },
        // Indoors: virtually silent ultra-soft warmth (< 180 Hz, ~−55 dBFS, zero HVAC hiss).
        room(S) {
            const s = S._src(S.brown, 1, 0.3);
            const hp = S._filter('highpass', 48, 0.05);
            const lp = S._lp4(155);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], level], dest: 'direct' };
        },
        // Orbit / Holomap: ultra-quiet warm airy breath (no pitched harmonic-clashing drone).
        space(S) {
            const s = S._src(S.brown, 1, 5.1);
            const hp = S._filter('highpass', 62, 0.05);
            const lp = S._lp4(190);
            const lfo = S._osc('sine', 0.06);
            const fDepth = S._gain(55);
            lfo.connect(fDepth);
            fDepth.connect(lp[0].frequency);
            fDepth.connect(lp[1].frequency);
            const level = S._gain(0);
            S._chain(s, hp, lp[0], lp[1], level);
            return { level, nodes: [s, hp, lp[0], lp[1], lfo, fDepth, level], dest: 'direct' };
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
        if (target > 0.00025) {
            if (!L) L = this._build(name);
            L.idle = 0;
        } else if (L) {
            L.idle += 0.125;
            if (L.idle > (linger || 8)) {
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
        f.vpH = vpH;
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
        // Openness strictly reflects open biomes (zero downtown wind floor).
        f.open = Math.min(
            1,
            g('desert') +
                0.8 * g('power') +
                0.7 * g('port') +
                0.55 * g('estate') +
                0.4 * (g('suburb') + g('forest')) +
                0.3 * g('park')
        );
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
        f.dawn = this._gauss(h, 6.4, 0.9) + 0.35 * this._gauss(h, 18.6, 0.8);
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
        const isRainWx = wx === 'drizzle' || wx === 'rain' || wx === 'thunderstorm';
        f.rain = isRainWx ? (wx === 'drizzle' ? 0.42 : wx === 'rain' ? 0.8 : 1) * k : 0;
        f.storm = wx === 'thunderstorm' ? k : 0;
        f.snow = wx === 'snow' ? k : 0;
        f.fog = wx === 'fog' ? k : 0;
        f.windy = E && E.wind ? Math.min(1, Math.abs(E.wind.x || 0) / 1.1) : 0;
        f.sandstorm = E && E.desertWeather === 'sandstorm' ? 1 : 0;
        f.wet = E ? Math.max(0, Math.min(1, E._wetness || 0)) : 0;
        f.winter = E && E.season === 'winter' ? 1 : 0;

        // Camera: close = detail, far = air; sky = wind; deep under = tunnel.
        f.near = Math.max(0, Math.min(1, (Z - 0.6) / 1.6));
        const groundY = G.groundY || vpH - 56;
        const gs = G.world ? G.world.y + groundY * Z : vpH * 0.75;
        f.under = Math.max(0, Math.min(1, (vpH * 0.6 - gs) / (vpH * 0.45)));
        f.sky = Math.max(0, Math.min(1, (gs - vpH * 0.95) / (vpH * 0.6)));
        f.wx = G.world ? G.world.x : 0;
        f.wy = G.world ? G.world.y : 0;
        if (inside) {
            f.near = 0.5;
            f.under = 0;
            f.sky = 0;
        }

        this._senseEntities(f);
        this._prevCx = f.cx;
        this._prevZoom = f.zoom;
    },

    _screenX(worldX) {
        return this._f.wx + worldX * this._f.zoom;
    },

    _senseEntities(f) {
        const e = this._e;
        const vpW = f.vpW;
        const street = this.mode === 'outdoor' || this.mode === 'train';

        // Visible citizens → crowd size and stereo centre.
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

        // Cars: warm Doppler pass-by ONLY for genuinely moving cars crossing a steady viewport
        // (ignores camera drag/pan/zoom and enforces >= 2.2 s cooldown).
        const now = this.ctx.currentTime;
        const camDragging =
            typeof Camera !== 'undefined' &&
            (Camera.isDragging ||
                Math.abs(Camera._velX || 0) > 0.5 ||
                Math.abs(Camera._momentumX || 0) > 0.5);
        const camSteady =
            !camDragging &&
            this._prevCx !== null &&
            Math.abs(f.cx - this._prevCx) < 6 &&
            Math.abs(f.zoom - this._prevZoom) < 0.015;
        if (this.mode === 'outdoor' && G.cars && G.cars.length) {
            const mid = vpW / 2;
            for (const car of G.cars) {
                if (!car || !car.gfx || car.gfx.visible === false) continue;
                const wx = car.gfx.x;
                const prevWx = this._carWorldX.get(car);
                this._carWorldX.set(car, wx);
                const x = this._screenX(wx);
                const side = x < mid ? -1 : 1;
                const prev = this._carSide.get(car);
                this._carSide.set(car, side);
                const dxWorld = prevWx !== undefined ? wx - prevWx : 0;
                const lastPassby = this._next.passby === undefined ? -Infinity : this._next.passby;
                if (
                    camSteady &&
                    prev &&
                    prev !== side &&
                    Math.abs(dxWorld) > 1.5 &&
                    Math.sign(dxWorld) === side &&
                    x > -40 &&
                    x < vpW + 40 &&
                    now - lastPassby >= 2.2
                ) {
                    this._next.passby = now;
                    this._passby(car, side);
                }
            }
        }

        // Metro: nearest moving train; only audible when riding (G.trainFocus) or deeply zoomed
        // underground (f.under > 0.35), or in a metro interior for arrival/departure cues.
        e.train = null;
        e.trainProx = 0;
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
            const hearMetro =
                this.mode === 'train' ||
                (this.mode === 'interior' && this.modeEnv === 'metro') ||
                (this.mode === 'outdoor' && f.under > 0.35);
            for (const t of trains) {
                if (!t || !isFinite(t.x)) continue;
                const dx = Math.abs(t.x - f.cx);
                const near = dx < f.span * 0.75;
                const prev = this._trainState.get(t);
                if (prev && prev !== t.state && hearMetro && (near || t === focus)) {
                    if (prev === 'moving' && t.state === 'waiting') this._arrive(t);
                    else if (prev === 'waiting' && t.state === 'moving') this._depart(t);
                }
                this._trainState.set(t, t.state);
                if (!street || t.state !== 'moving') continue;
                const p = t === focus ? 1 : Math.max(0, 1 - dx / (f.span * 0.5 + 650));
                if (p > best) {
                    best = p;
                    e.train = t;
                    e.trainProx = p;
                }
            }
        }

        // Helicopters clearly on-screen.
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
                if (x < -40 || x > vpW + 40) continue;
                const p = Math.max(0, 1 - Math.abs(x - vpW / 2) / (vpW * 0.6));
                if (p > e.heli) {
                    e.heli = p;
                    e.heliPan = (x / vpW) * 2 - 1;
                }
            }
        }

        // HN blimps drifting across the viewport.
        e.blimp = 0;
        if (street && typeof HNBlimps !== 'undefined' && HNBlimps._blimps) {
            for (const b of HNBlimps._blimps) {
                if (!b || !b.container || !b.container.parent) continue;
                const x = this._screenX(b.container.x);
                if (x < -40 || x > vpW + 40) continue;
                const p = Math.max(0, 1 - Math.abs(x - vpW / 2) / (vpW * 0.65));
                if (p > e.blimp) {
                    e.blimp = p;
                    e.blimpPan = (x / vpW) * 2 - 1;
                }
            }
        }

        // Active on-screen rocket launches only.
        e.rocket = 0;
        if (street && typeof SpaceEntities !== 'undefined' && SpaceEntities.rockets) {
            for (const id in SpaceEntities.rockets) {
                const r = SpaceEntities.rockets[id];
                if (!r || !r.cont) continue;
                let k = 0;
                if (r.state === 'ignition') k = 0.55;
                else if (r.state === 'liftoff') k = 1;
                else if (r.state === 'ascending') k = Math.max(0, 1 - (r.baseY - r.cont.y) / 2400);
                if (!k) continue;
                const rx = this._screenX(r.cont.x);
                if (rx < -vpW * 0.15 || rx > vpW * 1.15) continue;
                const prox = Math.max(0, 1 - Math.abs(rx - vpW / 2) / (vpW * 0.75));
                k *= prox;
                if (k > e.rocket) {
                    e.rocket = k;
                    e.rocketPan = Math.max(-1, Math.min(1, (rx / vpW) * 2 - 1)) * 0.8;
                }
            }
        }
    },

    // ─── The mix ────────────────────────────────────────────────────────────────────────────────
    _tick() {
        const ctx = this.ctx;
        if (!ctx || ctx.state !== 'running') return;
        const now = ctx.currentTime;
        if (!this._audible()) {
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
        // Indoors: busGain ~0.19 combined with 400 Hz 4th-order LP gives ~12 dB quieter muffled storm/rain.
        const out = mode === 'outdoor' ? 1 : mode === 'interior' ? 0.19 : mode === 'train' ? 0.4 : 0;
        const street = out > 0 ? 1 : 0;

        // Street bus dual-stage low-pass ceiling: warm outdoors, muffled by walls/snow/depth.
        let lp = 2400 + 1000 * f.near;
        lp *= 1 - 0.62 * f.snow;
        lp = Math.min(lp, 3400 * (1 - f.under) + 520 * f.under);
        if (mode === 'interior') lp = 400;
        if (mode === 'train') lp = 650;
        this._setLP4([this.busLP, this.busLP2], Math.max(220, lp), now, 0.4);
        this.busGain.gain.setTargetAtTime(out, now, mode === 'outdoor' ? 0.8 : 0.45);

        // Gusts: a slow organic swell shared by wind, sandstorm and zoomed-in leaves.
        this._gustT += 0.125;
        const t = this._gustT;
        this._gust += (0.5 + 0.28 * Math.sin(t * 0.72) + 0.18 * Math.sin(t * 0.31 + 1.3) - this._gust) * 0.18;
        this._gust += (Math.random() - 0.5) * 0.025;
        const gust = Math.max(0.12, Math.min(1, this._gust));

        const above = 1 - f.under;
        const bed = 0.65 + 0.35 * f.near;
        const quietSnow = 1 - 0.55 * f.snow;
        const breeze = this._ss(0.18, 0.72, f.windy);
        const zoomOut = this._ss(0.65, 0.42, f.zoom);

        // Barely-there warm low urban breath.
        this._set('city', street * f.urban * f.traffic * bed * quietSnow * (1 - 0.65 * f.under), now);

        // Wind: silent in calm clear downtown; soft velvety 120–360 Hz brown air only in breezy
        // open biomes, high altitude / far zoom-out, storms, or desert sandstorms.
        const windK =
            street *
            above *
            (f.open * breeze * 0.75 +
                0.55 * f.sky +
                0.25 * zoomOut +
                0.7 * f.storm +
                0.5 * f.sandstorm * g('desert')) *
            (1 - 0.5 * f.fog);
        const wind = this._set('wind', Math.min(1.2, windK), now);
        if (wind) {
            const wFreq = Math.min(350, 145 + 155 * gust + 50 * f.storm);
            this._setLP4(wind.lp, wFreq, now, 0.35);
            wind.gust.gain.setTargetAtTime(0.6 + 0.45 * gust, now, 0.35);
            this._setPan(wind.pan, Math.sin(t * 0.11) * 0.4, now, 0.55);
        }

        // Sand: STRICTLY 0 unless active desert sandstorm.
        const sandK = f.sandstorm > 0 ? street * above * g('desert') * f.sandstorm * (0.55 + 0.45 * gust) : 0;
        const sand = this._set('sand', sandK, now);
        if (sand) {
            this._setLP4(sand.lp, 300 + 380 * gust, now, 0.3);
            sand.gust.gain.setTargetAtTime(0.6 + 0.45 * gust, now, 0.3);
        }

        // Rain: STRICTLY 0 unless weather is drizzle/rain/thunderstorm.
        const rainK = f.rain > 0 ? street * f.rain * (1 - 0.55 * f.under) : 0;
        const rain = this._set('rain', rainK, now, 1.1);
        if (rain) {
            const rainCut = mode === 'interior' ? 950 : 980 + 580 * f.rain;
            this._setLP4(rain.lp, rainCut, now, 0.45);
        }

        // Ocean surf swell near port/coast.
        this._set('waves', street * above * g('port') * (0.8 + 0.25 * f.storm), now, 1.2);

        // Compute airflow only when zoomed into compute centers.
        this._set('servers', street * g('compute') * this._ss(0.25, 0.8, f.near), now);

        // Wind turbines only in breezy non-foggy power zones.
        this._set('turbine', street * above * g('power') * this._ss(0.14, 0.68, f.windy) * (1 - f.fog), now);

        // Foliage breeze only when closely zoomed into parks/forests AND breeze > 0.
        const foliage = Math.min(1, g('forest') + g('park') + 0.35 * g('estate'));
        const leavesK =
            street * above * foliage * this._ss(0.25, 0.8, f.near) * breeze * (1 - f.snow);
        const lv = this._set('leaves', leavesK, now);
        if (lv) {
            this._setLP4(lv.lp, 320 + 360 * gust, now, 0.35);
            lv.gust.gain.setTargetAtTime(0.55 + 0.45 * gust, now, 0.3);
            this._setPan(lv.pan, Math.sin(t * 0.19 + 2) * 0.45, now, 0.6);
        }

        // Park fountain burble only when tightly zoomed onto a park.
        const parkClose = this._ss(0.35, 0.85, f.near);
        this._set('fountain', street * above * g('park') * parkClose * (1 - 0.7 * f.winter), now);

        // Night crickets in nature (strictly off during the day, rain, snow, winter).
        const crick =
            street *
            above *
            Math.min(1, f.nature + 0.35 * g('graveyard') + 0.2 * g('campus')) *
            f.crickets *
            (1 - f.winter) *
            (1 - Math.min(1, f.rain * 1.5)) *
            (1 - f.snow);
        this._set('crickets', crick, now, 1.5);

        // Ultra-quiet warm low nightlife hum only when zoomed closely into neon nightlife.
        this._set(
            'neon',
            street * g('nightlife') * (0.2 + 0.8 * f.night) * this._ss(0.45, 0.9, f.near),
            now
        );

        // Soft distant crowd murmur ONLY when zoomed closely into dense crowds or occupied rooms.
        let crowdK = 0;
        let crowdPan = 0;
        if (mode === 'outdoor') {
            const dense = Math.min(1, Math.max(0, e.citizens - 3) / 10);
            crowdK = dense * this._ss(0.3, 0.85, f.near) * (1 - 0.6 * f.rain) * (1 - 0.85 * f.under);
            crowdPan = e.citizenPan;
        } else if (mode === 'interior') {
            const mod = typeof Interior !== 'undefined' && Interior.activeModule;
            const n = mod && Array.isArray(mod.avatars) ? mod.avatars.length : 0;
            const lively = /^(cafe|neon_bar|arena|gym|convention_center|black_market)$/.test(
                this.modeBld || ''
            );
            crowdK = Math.min(1, Math.max(0, n - 1) / 6) * (lively ? 1 : this.modeEnv === 'hq' ? 0.35 : 0.5);
        }
        const crowd = this._set('crowd', crowdK, now, 0.9);
        if (crowd) {
            this._setPan(crowd.pan, crowdPan, now, 0.6);
            this._setLP4(crowd.lp, mode === 'interior' ? 420 : 500, now, 0.45);
        }

        // Underground: ONLY when riding a train, inside a metro station, or genuinely zoomed deep
        // underground (f.under > 0.35). Zero leak on initial Camera.init framing.
        const deepUnder = this._ss(0.35, 0.85, f.under);
        const tunnelK =
            mode === 'train'
                ? 0.75
                : mode === 'interior' && this.modeEnv === 'metro'
                  ? 0.45
                  : mode === 'outdoor' && f.under > 0.35
                    ? 0.7 * deepUnder
                    : 0;
        this._set('tunnel', tunnelK, now, 0.8);

        let trainK = 0;
        if (e.train) {
            if (mode === 'train') trainK = 0.9;
            else if (mode === 'outdoor' && f.under > 0.35) trainK = e.trainProx * deepUnder;
        }
        const tr = this._set('train', trainK, now, 0.55, 6);
        if (tr && e.train) {
            const spd = Math.max(0.5, Math.min(8, Math.abs(e.train.speed || 2)));
            tr.roll.playbackRate.setTargetAtTime(0.6 + spd * 0.05, now, 0.4);
            tr.thumpLfo.frequency.setTargetAtTime(1.8 + spd * 0.45, now, 0.4);
            const px = mode === 'train' ? 0 : ((this._screenX(e.train.x) / f.vpW) * 2 - 1) * 0.8;
            this._setPan(tr.pan, px, now, 0.25);
        }

        const heli = this._set('heli', street * e.heli * (0.45 + 0.55 * f.near), now, 0.4, 5);
        if (heli) this._setPan(heli.pan, e.heliPan * 0.8, now, 0.25);

        const blimp = this._set('blimp', street * above * e.blimp * 0.75, now, 0.8, 5);
        if (blimp) this._setPan(blimp.pan, e.blimpPan * 0.75, now, 0.4);

        const rk = this._set('rocket', street * e.rocket, now, 0.6, 6);
        if (rk) this._setPan(rk.pan, e.rocketPan || 0, now, 0.4);

        this._set('room', mode === 'interior' ? 1 : 0, now, 0.9);
        this._set('space', mode === 'orbit' ? 1 : mode === 'holomap' ? 0.6 : 0, now, 1.5);
    },

    // ─── Timed and organic spot events ──────────────────────────────────────────────────────────
    // Fire `fn(weight)` every [min, max] seconds while `weight` is up; quieter weights wait longer.
    _maybe(kind, now, weight, min, max, fn) {
        let next = this._next[kind];
        if (next === undefined) {
            next = this._next[kind] = now + min * 0.5 + Math.random() * max;
        }
        if (weight <= 0.04) {
            if (next < now + min) this._next[kind] = now + min * Math.random() + 0.8;
            return;
        }
        if (now < next) return;
        fn.call(this, Math.min(1, weight));
        this._fired[kind] = (this._fired[kind] || 0) + 1;
        this._next[kind] = now + (min + Math.random() * (max - min)) / Math.max(0.35, Math.min(1, weight));
    },

    _schedule(now) {
        const f = this._f;
        const w = this._w;
        const g = (k) => w[k] || 0;
        const out = this.mode === 'outdoor';
        const near = f.near;
        const closeZoom = this._ss(0.25, 0.8, near);
        const dry = 1 - Math.min(1, f.rain * 1.4);
        const birdTime = Math.min(1, 0.35 * f.day + f.dawn);

        // Gentle resonant water droplets ONLY during active rain (replaces crackle static).
        if (f.rain > 0.05 && (out || this.mode === 'interior')) {
            const indoor = this.mode === 'interior';
            if (!this._dropNext || this._dropNext < now - 0.5) {
                this._dropNext = now + 0.15 + Math.random() * 0.35;
            }
            if (now >= this._dropNext) {
                this._rainDrop(f.rain, indoor);
                const rate = indoor ? 0.45 + 0.55 * f.rain : 1.1 + 2.4 * f.rain;
                this._dropNext = now + (0.45 + Math.random() * 1.1) / rate;
            }
        } else {
            this._dropNext = 0;
        }

        if (out) {
            // Very quiet delicate park fountain droplets only when zoomed tightly onto a park.
            const fountainW = g('park') * this._ss(0.4, 0.88, near) * (1 - f.under) * (1 - 0.7 * f.winter);
            if (fountainW > 0.1) {
                if (!this._fountainDropNext || this._fountainDropNext < now - 0.5) {
                    this._fountainDropNext = now + 0.4 + Math.random() * 0.7;
                }
                if (now >= this._fountainDropNext) {
                    this._fountainDrop(fountainW);
                    this._fountainDropNext = now + 0.5 + Math.random() * 0.95;
                }
            } else {
                this._fountainDropNext = 0;
            }

            this._maybe('gull', now, g('port') * f.day * dry, 8, 22, this._gull);
            this._maybe(
                'foghorn',
                now,
                g('port') > 0.3 ? g('port') : 0,
                f.fog > 0.3 ? 25 : 55,
                f.fog > 0.3 ? 50 : 120,
                this._foghorn
            );
            this._maybe(
                'bird',
                now,
                f.nature * birdTime * dry * (f.winter ? 0.35 : 1) * (1 - f.snow),
                3.5,
                10,
                this._bird
            );
            this._maybe(
                'frog',
                now,
                (g('park') + 0.3 * g('forest')) * f.night * (1 - f.winter) * dry,
                5,
                14,
                this._frog
            );
            this._maybe(
                'chime',
                now,
                (g('suburb') + g('estate')) * (f.windy > 0.3 ? 1 : 0) * dry,
                12,
                28,
                this._chime
            );
            this._maybe('quindar', now, g('desert') > 0.25 ? g('desert') : 0, 30, 70, this._quindar);
            this._maybe(
                'clank',
                now,
                (g('desert') * 0.55 + g('robotics') * 0.45 + g('port') * 0.35) * closeZoom,
                14,
                32,
                this._clank
            );
            this._maybe(
                'siren',
                now,
                f.urban * (0.45 + 0.55 * f.night) * (f.h > 1.5 && f.h < 5 ? 0.3 : 1),
                100,
                240,
                this._siren
            );
            this._maybe('horn', now, f.urban * f.traffic * f.day * closeZoom, 35, 90, this._horn);
            this._maybe('chirp', now, (g('compute') + g('network')) * closeZoom, 10, 25, this._chirp);
            this._maybe('servo', now, g('robotics') * closeZoom, 6, 16, this._servo);
            this._maybe('zap', now, g('power') * (0.35 + 0.65 * f.rain) * closeZoom, 16, 40, this._zap);
            this._maybe('clink', now, g('nightlife') * f.bar * closeZoom, 10, 24, this._clink);
            this._maybe('ghost', now, g('graveyard') * (0.3 + 0.7 * f.night), 18, 40, this._ghost);
            this._ecg(now, g('clinic') * this._ss(0.4, 0.85, near));
        }

        // Track the hour everywhere so a bell never tolls late when you step back outside.
        this._bell(now, out ? g('campus') : 0, f.h);

        // Indoors: distant muffled thunder during storms; delicate glass clinks in neon_bar/cafe
        // (zero competing bar beat/music).
        if (this.mode === 'interior') {
            this._maybe('thunderIn', now, f.storm, 14, 38, () => this.thunder(0.75));
            if (this.modeBld === 'neon_bar') {
                this._maybe('clinkIn', now, 1, 6, 16, (k) => this._clink(k * 1.4, this.direct));
            } else if (this.modeBld === 'cafe') {
                this._maybe('clinkCafe', now, 1, 9, 22, (k) => this._clink(k * 1.1, this.direct));
            }
        }

        this._crickets(now);
    },

    // Crickets: three smooth 24 ms pulses per chirp, written 0.3 s ahead with click-free ramps.
    _crickets(now) {
        const L = this._layers.crickets;
        if (!L) {
            this._cr = null;
            return;
        }
        if (!this._cr) this._cr = [now + Math.random() * 0.5, now + 0.3 + Math.random() * 0.5];
        const gaps = [0.68, 0.89];
        for (let v = 0; v < 2; v++) {
            const gp = L.voices[v].gain;
            while (this._cr[v] < now + 0.3) {
                const t0 = Math.max(this._cr[v], now + 0.01);
                for (let i = 0; i < 3; i++) {
                    const t = t0 + i * 0.052;
                    gp.setValueAtTime(0, t);
                    gp.linearRampToValueAtTime(1, t + 0.007);
                    gp.setValueAtTime(1, t + 0.02);
                    gp.linearRampToValueAtTime(0, t + 0.032);
                }
                this._cr[v] = t0 + gaps[v] + Math.random() * 0.3;
            }
        }
    },

    // Longevity Wing: gentle warm heart monitor at 72 BPM while zoomed closely in.
    _ecg(now, k) {
        if (k < 0.3) {
            this._ecgNext = 0;
            return;
        }
        if (!this._ecgNext || this._ecgNext < now) this._ecgNext = now + 0.12;
        while (this._ecgNext < now + 0.3) {
            this._tone({
                type: 'sine',
                f: 820,
                filter: ['lowpass', 1500, 0.707],
                a: 0.008,
                h: 0.045,
                r: 0.04,
                g: 0.008 * k,
                pan: 0.25,
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
        if (k < 0.18 || hour < 8 || hour > 21) return;
        const strikes = hour % 12 || 12;
        for (let i = 0; i < strikes; i++) this._bellStrike(now + 0.1 + i * 2.4, 0.032 * Math.min(1, k * 1.4));
        this._fired.bell = (this._fired.bell || 0) + 1;
    },

    // ─── One-shot voices ────────────────────────────────────────────────────────────────────────
    _ok(priority) {
        if (!this.ctx || this.ctx.state !== 'running' || !this._audible()) return false;
        const cap = priority ? this.MAX_LIVE + 4 : this.MAX_LIVE;
        return this._live < cap;
    },

    // Short-lived voice: (filters) → env → (pan) → dest. Every node is dropped when `last` ends.
    _voiceOut(filters, env, pan, dest) {
        if (filters && filters.length) {
            this._chain(...filters, env, pan, dest || this.bus);
            return filters[0];
        }
        this._chain(env, pan, dest || this.bus);
        return env;
    },
    _release(last, nodes) {
        this._live++;
        last.onended = () => {
            this._live = Math.max(0, this._live - 1);
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

    // Click-free envelope: linear attack (>= 5 ms), smooth exponential decay + linear finish at 0.0.
    _envelope(gp, t, a, h, r, peak) {
        const atk = Math.max(0.005, a || 0.005);
        const hold = Math.max(0, h || 0);
        const rel = Math.max(0.015, r || 0.02);
        const pk = Math.max(0.0001, peak || 0.0001);
        const tHold = t + atk + hold;
        const tExp = tHold + rel * 0.82;
        const tEnd = tHold + rel;
        gp.setValueAtTime(0, t);
        gp.linearRampToValueAtTime(pk, t + atk);
        if (hold > 0.0005) gp.setValueAtTime(pk, tHold);
        gp.exponentialRampToValueAtTime(Math.max(0.00008, pk * 0.02), tExp);
        gp.linearRampToValueAtTime(0, tEnd);
        return tEnd;
    },

    // Warm filtered noise burst (defaults to seamless Pink buffer; always low-pass protected).
    // o: { buf, rate, type, freq, freqEnd, q, lpFreq, a, h, r, g, pan, panEnd, dest, when, priority }
    _burst(o) {
        if (!this._ok(o.priority)) return;
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime + 0.01, o.when || 0);
        const buf = o.buf || this.pink;
        const s = ctx.createBufferSource();
        s.buffer = buf;
        s.loop = true;
        s.playbackRate.value = o.rate || 1;

        const env = this._gain(0);
        const tEnd = this._envelope(env.gain, t, o.a, o.h, o.r, o.g);
        const dur = Math.max(0.02, tEnd - t);

        const filters = [];
        if (o.type === 'lowpass') {
            const lp = this._lp4(o.freq || 600, o.q || 0.707);
            if (o.freqEnd) {
                for (const flt of lp) {
                    flt.frequency.setValueAtTime(o.freq, t);
                    flt.frequency.exponentialRampToValueAtTime(Math.max(50, o.freqEnd), tEnd);
                }
            }
            filters.push(lp[0], lp[1]);
        } else if (o.type) {
            const f1 = this._filter(o.type, o.freq || 800, o.q || 0.8);
            if (o.freqEnd) {
                f1.frequency.setValueAtTime(o.freq, t);
                f1.frequency.exponentialRampToValueAtTime(Math.max(60, o.freqEnd), tEnd);
            }
            const ceil = this._filter('lowpass', o.lpFreq || Math.min(2200, (o.freq || 800) * 1.8), 0.707);
            filters.push(f1, ceil);
        } else {
            filters.push(this._filter('lowpass', o.lpFreq || 1800, 0.707));
        }

        const pan = this._pan(o.pan || 0);
        if (pan && o.panEnd !== undefined) {
            pan.pan.setValueAtTime(o.pan || 0, t);
            pan.pan.linearRampToValueAtTime(o.panEnd, t + dur);
        }

        s.connect(this._voiceOut(filters, env, pan, o.dest));
        const maxOff = Math.max(0.1, (buf.duration || 8) - 0.1);
        s.start(t, Math.random() * maxOff);
        s.stop(tEnd + 0.02);
        this._release(s, [s, ...filters, env, pan]);
    },

    // Oscillator voice. o: { type, f | glide: [[dt, hz], ...], vib: [rate, depth],
    //                        partials: [[mult, amp], ...], filter: [type, hz, q], lpFreq,
    //                        a, h, r, g, pan, dest, when, priority }
    _tone(o) {
        if (!this._ok(o.priority)) return;
        const ctx = this.ctx;
        const t = Math.max(ctx.currentTime + 0.01, o.when || 0);
        const env = this._gain(0);
        const tEnd = this._envelope(env.gain, t, o.a, o.h, o.r, o.g);
        const stopAt = tEnd + 0.02;

        const filters = [];
        if (o.filter) filters.push(this._filter(o.filter[0], o.filter[1], o.filter[2]));
        if (o.lpFreq) {
            filters.push(this._filter('lowpass', o.lpFreq, 0.707));
        } else if (o.type && o.type !== 'sine' && (!o.filter || o.filter[0] !== 'lowpass')) {
            filters.push(this._filter('lowpass', 2000, 0.707));
        }

        const pan = this._pan(o.pan || 0);
        const head = this._voiceOut(filters, env, pan, o.dest);
        const nodes = [...filters, env, pan];
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
                lfo.stop(stopAt);
                nodes.push(lfo, d);
            }
            if (amp !== 1) {
                const ag = this._gain(amp);
                ag.connect(head);
                osc.connect(ag);
                nodes.push(ag);
            } else osc.connect(head);
            osc.start(t);
            osc.stop(stopAt);
            nodes.push(osc);
            last = osc;
        }
        if (last) this._release(last, nodes);
    },

    // Soft resonant damped water droplet (Minnaert bubble pitch glide, zero static crackle).
    _rainDrop(k, indoor) {
        const f0 = indoor ? 380 + Math.random() * 280 : 620 + Math.random() * 780;
        const dur = 0.032 + Math.random() * 0.018;
        this._tone({
            type: 'sine',
            glide: [
                [0, f0],
                [dur, f0 * (indoor ? 1.22 : 1.34)],
            ],
            filter: ['lowpass', indoor ? 720 : 1850, 0.707],
            a: 0.005,
            h: 0.004,
            r: dur + 0.016,
            g: (indoor ? 0.014 : 0.03) * Math.sqrt(Math.max(0.1, k)) * (0.65 + Math.random() * 0.55),
            pan: Math.random() * 1.5 - 0.75,
            dest: indoor ? this.direct : this.bus,
        });
    },

    _fountainDrop(k) {
        const f0 = 520 + Math.random() * 520;
        const dur = 0.036 + Math.random() * 0.02;
        this._tone({
            type: 'sine',
            glide: [
                [0, f0],
                [dur, f0 * 1.36],
            ],
            filter: ['lowpass', 1500, 0.707],
            a: 0.005,
            h: 0.004,
            r: dur + 0.018,
            g: 0.01 * k * (0.65 + Math.random() * 0.5),
            pan: Math.random() * 0.8 - 0.4,
        });
    },

    // Deep cinematic rolling thunder (accepts optional intensity 0.25..1.5); zero harsh HF crack.
    thunder(intensity) {
        if (!this._ok(true)) return;
        const k = intensity == null ? 1 : Math.max(0.25, Math.min(1.5, Number(intensity) || 1));
        const t = this.ctx.currentTime + 0.02;
        const close = Math.random() < 0.35;
        const pan = Math.random() * 1.1 - 0.55;
        this._fired.thunder = (this._fired.thunder || 0) + 1;
        if (close) {
            this._burst({
                buf: this.pink,
                rate: 0.85,
                type: 'bandpass',
                freq: 360,
                freqEnd: 150,
                q: 0.8,
                lpFreq: 950,
                a: 0.014,
                h: 0.04,
                r: 0.55,
                g: 0.36 * k,
                pan,
                when: t,
                priority: true,
            });
        }
        const n = 2 + Math.floor(Math.random() * 3);
        let at = t + (close ? 0.06 : 0.18);
        for (let i = 0; i < n; i++) {
            this._burst({
                buf: this.brown,
                rate: 0.65,
                type: 'lowpass',
                freq: Math.max(120, 270 - i * 45),
                freqEnd: 70,
                q: 0.75,
                a: 0.14 + Math.random() * 0.12,
                h: 0.2 + Math.random() * 0.35,
                r: 2.2 + Math.random() * 2.2,
                g: Math.max(0.24, 0.84 - i * 0.16) * (close ? 1 : 0.72) * k,
                pan: pan + (Math.random() - 0.5) * 0.35,
                when: at,
                priority: true,
            });
            at += 0.38 + Math.random() * 0.65;
        }
    },

    _gull(k) {
        const pan = Math.random() * 1.4 - 0.7;
        let t = this.ctx.currentTime + 0.05;
        const calls = 1 + Math.floor(Math.random() * 2);
        for (let i = 0; i < calls; i++) {
            const f0 = 960 + Math.random() * 180;
            this._tone({
                type: 'triangle',
                glide: [
                    [0, f0 * 0.9],
                    [0.08, f0 * 1.24],
                    [0.34, f0 * 0.78],
                ],
                vib: [22, 24],
                filter: ['bandpass', 1350, 2.0],
                lpFreq: 2100,
                a: 0.025,
                h: 0.16,
                r: 0.14,
                g: 0.026 * k,
                pan,
                when: t,
            });
            t += 0.42 + Math.random() * 0.22;
        }
    },

    _foghorn(k) {
        this._tone({
            type: 'triangle',
            f: 73.4,
            partials: [
                [1, 1],
                [1.006, 0.85],
                [2, 0.3],
            ],
            filter: ['lowpass', 290, 0.75],
            lpFreq: 320,
            a: 0.6,
            h: 1.8,
            r: 1.6,
            g: 0.07 * k,
            pan: Math.random() * 0.5 - 0.25,
        });
    },

    _bird(k) {
        const pan = Math.random() * 1.5 - 0.75;
        const g = (0.014 + Math.random() * 0.012) * k;
        let t = this.ctx.currentTime + 0.03;
        const kind = Math.random();
        if (kind < 0.45) {
            const n = 3 + Math.floor(Math.random() * 4);
            let fq = 1900 + Math.random() * 750;
            for (let i = 0; i < n; i++) {
                const d = 0.05 + Math.random() * 0.05;
                const f2 = fq * (0.88 + Math.random() * 0.28);
                this._tone({
                    type: 'sine',
                    glide: [
                        [0, fq],
                        [d, f2],
                    ],
                    lpFreq: 3200,
                    a: 0.008,
                    h: d * 0.5,
                    r: d * 0.5,
                    g,
                    pan,
                    when: t,
                });
                t += d + 0.018;
                fq = f2 > 3100 ? 2200 : f2;
            }
        } else if (kind < 0.78) {
            this._tone({
                type: 'sine',
                glide: [
                    [0, 2350],
                    [0.16, 2550],
                ],
                lpFreq: 3200,
                a: 0.02,
                h: 0.11,
                r: 0.06,
                g,
                pan,
                when: t,
            });
            this._tone({
                type: 'sine',
                glide: [
                    [0, 2250],
                    [0.22, 1820],
                ],
                lpFreq: 3200,
                a: 0.02,
                h: 0.14,
                r: 0.08,
                g,
                pan,
                when: t + 0.25,
            });
        } else {
            const n = 5 + Math.floor(Math.random() * 5);
            for (let i = 0; i < n; i++) {
                this._tone({
                    type: 'sine',
                    glide: [
                        [0, 2950 - i * 80],
                        [0.03, 2720 - i * 80],
                    ],
                    lpFreq: 3200,
                    a: 0.006,
                    h: 0.014,
                    r: 0.02,
                    g: g * 0.85,
                    pan,
                    when: t + i * 0.055,
                });
            }
        }
    },

    _frog(k) {
        const pan = Math.random() * 1.1 - 0.55;
        const t = this.ctx.currentTime + 0.03;
        for (let i = 0; i < 2; i++) {
            this._tone({
                type: 'triangle',
                glide: [
                    [0, 175 - i * 20],
                    [0.08, 138 - i * 16],
                ],
                filter: ['bandpass', 620, 3.2],
                lpFreq: 1100,
                a: 0.01,
                h: 0.05,
                r: 0.04,
                g: 0.048 * k,
                pan,
                when: t + i * 0.13,
            });
        }
    },

    _chime(k) {
        const notes = [523.25, 587.33, 659.25, 783.99, 880];
        const t = this.ctx.currentTime + 0.02;
        const n = 2 + Math.floor(Math.random() * 2);
        for (let i = 0; i < n; i++) {
            this._tone({
                type: 'sine',
                f: notes[Math.floor(Math.random() * notes.length)],
                partials: [
                    [1, 1],
                    [2, 0.2],
                ],
                lpFreq: 2400,
                a: 0.008,
                h: 0.02,
                r: 1.7,
                g: 0.008 * k,
                pan: 0.35,
                when: t + i * (0.16 + Math.random() * 0.25),
            });
        }
    },

    // Mission control radio: softened vintage Quindar tone, muffled voice syllables, outro tone.
    _quindar(k) {
        const t = this.ctx.currentTime + 0.05;
        const pan = -0.35;
        this._tone({
            type: 'sine',
            f: 1950,
            lpFreq: 2400,
            a: 0.008,
            h: 0.2,
            r: 0.02,
            g: 0.009 * k,
            pan,
            when: t,
        });
        let at = t + 0.32;
        const syll = 3 + Math.floor(Math.random() * 3);
        for (let i = 0; i < syll; i++) {
            const d = 0.11 + Math.random() * 0.18;
            this._burst({
                buf: this.pink,
                type: 'bandpass',
                freq: 920 + Math.random() * 380,
                q: 2.6,
                lpFreq: 1750,
                a: 0.022,
                h: d,
                r: 0.05,
                g: 0.024 * k,
                pan,
                when: at,
            });
            at += d + 0.07 + Math.random() * 0.1;
        }
        this._tone({
            type: 'sine',
            f: 1900,
            lpFreq: 2400,
            a: 0.008,
            h: 0.2,
            r: 0.02,
            g: 0.009 * k,
            pan,
            when: at + 0.1,
        });
    },

    _clank(k) {
        const pan = Math.random() * 1.2 - 0.6;
        this._tone({
            type: 'sine',
            f: 780,
            partials: [
                [1, 1],
                [2.1, 0.35],
                [2.95, 0.18],
            ],
            lpFreq: 2400,
            a: 0.006,
            h: 0.01,
            r: 0.42,
            g: 0.011 * k,
            pan,
        });
        this._burst({
            buf: this.pink,
            type: 'bandpass',
            freq: 950,
            q: 1.2,
            lpFreq: 1450,
            a: 0.006,
            h: 0.008,
            r: 0.045,
            g: 0.016 * k,
            pan,
        });
    },

    // Far-off dreamy city siren, gently muffled by distance.
    _siren(k) {
        const t = this.ctx.currentTime + 0.05;
        const glide = [[0, 540]];
        for (let i = 1; i <= 6; i++) glide.push([i * 1.35, i % 2 ? 760 : 540]);
        this._tone({
            type: 'sine',
            glide,
            filter: ['lowpass', 950, 0.707],
            a: 1.8,
            h: 3.6,
            r: 2.2,
            g: 0.008 * k,
            pan: Math.random() < 0.5 ? -0.55 : 0.55,
            when: t,
        });
    },

    _horn(k) {
        const t = this.ctx.currentTime + 0.02;
        const pan = Math.random() * 1.2 - 0.6;
        for (let i = 0; i < 2; i++) {
            this._tone({
                type: 'triangle',
                f: 349.2,
                partials: [
                    [1, 1],
                    [1.26, 0.9],
                ],
                filter: ['bandpass', 680, 1.0],
                lpFreq: 1150,
                a: 0.014,
                h: 0.12,
                r: 0.05,
                g: 0.014 * k,
                pan,
                when: t + i * 0.25,
            });
        }
    },

    _chirp(k) {
        const t = this.ctx.currentTime + 0.02;
        const f0 = 960 + Math.random() * 480;
        for (let i = 0; i < 3; i++) {
            this._tone({
                type: 'sine',
                f: f0 * (1 + 0.18 * i),
                lpFreq: 2000,
                a: 0.006,
                h: 0.02,
                r: 0.02,
                g: 0.008 * k,
                pan: Math.random() * 1.1 - 0.55,
                when: t + i * 0.055,
            });
        }
    },

    _servo(k) {
        const pan = Math.random() * 1.2 - 0.6;
        if (Math.random() < 0.65) {
            const up = Math.random() < 0.5;
            this._tone({
                type: 'triangle',
                glide: [
                    [0, up ? 180 : 340],
                    [0.42, up ? 340 : 180],
                ],
                filter: ['bandpass', 720, 1.8],
                lpFreq: 1300,
                a: 0.04,
                h: 0.3,
                r: 0.1,
                g: 0.024 * k,
                pan,
            });
        } else {
            this._burst({
                buf: this.pink,
                type: 'bandpass',
                freq: 820,
                freqEnd: 540,
                q: 1.2,
                lpFreq: 1400,
                a: 0.016,
                h: 0.1,
                r: 0.16,
                g: 0.026 * k,
                pan,
            });
        }
    },

    _zap(k) {
        const pan = Math.random() * 1.1 - 0.55;
        this._burst({
            buf: this.pink,
            type: 'bandpass',
            freq: 1050,
            freqEnd: 620,
            q: 1.8,
            lpFreq: 1800,
            a: 0.008,
            h: 0.06,
            r: 0.1,
            g: 0.018 * k,
            pan,
        });
        this._tone({
            type: 'triangle',
            f: 120,
            lpFreq: 340,
            a: 0.008,
            h: 0.05,
            r: 0.08,
            g: 0.012 * k,
            pan,
        });
    },

    _clink(k, dest) {
        const t = this.ctx.currentTime + 0.02;
        const pan = Math.random() * 1.1 - 0.55;
        for (const fq of [2180, 3040]) {
            this._tone({
                type: 'sine',
                f: fq * (0.98 + Math.random() * 0.04),
                lpFreq: 3400,
                a: 0.006,
                h: 0.005,
                r: 0.24,
                g: 0.0055 * k,
                pan,
                dest,
                when: t,
            });
        }
    },

    _ghost(k) {
        this._tone({
            type: 'sine',
            glide: [
                [0, 330],
                [2.4, 260],
            ],
            vib: [4.5, 9],
            filter: ['lowpass', 720, 0.707],
            a: 0.85,
            h: 0.75,
            r: 0.9,
            g: 0.008 * k,
            pan: Math.random() * 1.1 - 0.55,
        });
    },

    _bellStrike(at, g) {
        this._tone({
            type: 'sine',
            f: 196,
            partials: [
                [0.5, 0.55],
                [1, 1],
                [1.2, 0.45],
                [1.5, 0.35],
                [2, 0.25],
                [2.5, 0.12],
                [3, 0.08],
            ],
            filter: ['lowpass', 1750, 0.707],
            a: 0.008,
            h: 0.02,
            r: 3.4,
            g,
            pan: -0.2,
            when: at,
        });
    },

    // Moving car crossing steady viewport: warm LP (< 450 Hz) smooth tire/air swell, zero HF spray.
    _passby(car, dir) {
        const f = this._f;
        const truck = !!car.isTruck;
        const dur = truck ? 2.1 : 1.35;
        const k = 0.35 + 0.65 * f.near;
        const p0 = -0.8 * (dir || 1);
        const base = { a: dur * 0.45, h: 0.05, r: dur * 0.5, pan: p0, panEnd: -p0 };
        this._burst({
            ...base,
            buf: this.brown,
            rate: 1,
            type: 'lowpass',
            freq: 390,
            freqEnd: 185,
            q: 0.75,
            g: 0.055 * k,
        });
        if (truck) {
            this._burst({
                ...base,
                buf: this.brown,
                rate: 0.75,
                type: 'lowpass',
                freq: 145,
                freqEnd: 90,
                q: 0.75,
                g: 0.085 * k,
            });
        }
        this._fired.passby = (this._fired.passby || 0) + 1;
    },

    _arrive(t) {
        const px = Math.max(-0.75, Math.min(0.75, ((this._screenX(t.x) / this._f.vpW) * 2 - 1) * 0.75));
        const now = this.ctx.currentTime;
        this._burst({
            buf: this.pink,
            type: 'bandpass',
            freq: 1050,
            freqEnd: 620,
            q: 1.5,
            lpFreq: 1550,
            a: 0.06,
            h: 0.45,
            r: 0.42,
            g: 0.022,
            pan: px,
            dest: this.direct,
        });
        this._tone({
            type: 'sine',
            f: 659.25,
            lpFreq: 1800,
            a: 0.012,
            h: 0.12,
            r: 0.28,
            g: 0.018,
            pan: px,
            dest: this.direct,
            when: now + 0.9,
        });
        this._tone({
            type: 'sine',
            f: 523.25,
            lpFreq: 1800,
            a: 0.012,
            h: 0.12,
            r: 0.36,
            g: 0.018,
            pan: px,
            dest: this.direct,
            when: now + 1.15,
        });
        this._fired.arrive = (this._fired.arrive || 0) + 1;
    },

    _depart(t) {
        const px = Math.max(-0.75, Math.min(0.75, ((this._screenX(t.x) / this._f.vpW) * 2 - 1) * 0.75));
        this._tone({
            type: 'triangle',
            glide: [
                [0, 165],
                [2.2, 345],
            ],
            filter: ['lowpass', 620, 0.707],
            lpFreq: 680,
            a: 0.5,
            h: 1.2,
            r: 0.8,
            g: 0.012,
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

    // Dev: RMS / peak (dBFS) of the bed over `ms`, tapped after the safety limiter.
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
