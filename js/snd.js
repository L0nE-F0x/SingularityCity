/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUND & AUDIO LAYER (v18.0.0 - Warm Procedural SFX & Soundtrack Engine)
   The ambient bed lives in js/soundscape.js; this file owns the context, mixer bus, music, and 2D SFX.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SND = {
    ctx: null,
    masterGain: null,
    limiter: null,
    ambientGain: null,
    sfxGain: null,
    _sfxBus: null,
    _polyGain: null,
    _polyTarget: 1.0,
    musicEl: null,

    _sfxEnabled: true,
    _musicEnabled: true,
    _sfxMutedByContext: false, // Terminal mode mutes SFX/ambient without touching user pref
    _sfxVolume: 1.0,
    _ambientVolume: 1.0,
    _baseSfxGain: 0.42,
    _baseAmbientGain: 0.35,

    _maxVoices: 12,
    _activeVoices: [],
    _cooldowns: Object.create(null),
    _pinkBuf: null,
    _brownBuf: null,
    _noiseCursor: 0,
    _listenersBound: false,
    _hiddenSuspend: false,

    currentAmbient: null,
    ambientInterval: null,

    _sfxAudible() {
        return Boolean(
            this.ctx && this._sfxEnabled && !this._sfxMutedByContext && this.ctx.state !== 'closed'
        );
    },

    _canPlaySfx() {
        return this._sfxAudible() && this._sfxVolume > 0.0001;
    },

    // Getters/Setters to maintain compatibility with engine.js save states and UI controls
    get enabled() {
        return this._sfxEnabled;
    },
    set enabled(v) {
        this.setEnabled(v);
    },

    get sfxVolume() {
        return this._sfxVolume;
    },
    set sfxVolume(v) {
        this.setSfxVolume(v);
    },

    get ambientVolume() {
        return this._ambientVolume;
    },
    set ambientVolume(v) {
        this.setAmbientVolume(v);
    },

    setEnabled(on) {
        this._sfxEnabled = !!on;
        this._applyGains();
    },

    setSfxVolume(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        this._sfxVolume = Math.max(0, Math.min(1, n));
        this._applyGains();
    },

    setAmbientVolume(v) {
        const n = Number(v);
        if (!Number.isFinite(n)) return;
        this._ambientVolume = Math.max(0, Math.min(1, n));
        this._applyGains();
    },

    _applyGains(immediate) {
        if (!this.ctx) return;
        const audible = this._sfxAudible();
        const now = this.ctx.currentTime;
        const sfxTarget = audible ? this._baseSfxGain * this._sfxVolume : 0;
        const ambTarget = audible ? this._baseAmbientGain * this._ambientVolume : 0;

        if (this.sfxGain) {
            const p = this.sfxGain.gain;
            if (p.cancelScheduledValues) p.cancelScheduledValues(now);
            if (immediate) p.setValueAtTime(sfxTarget, now);
            else p.setTargetAtTime(sfxTarget, now, 0.025);
        }
        if (this.ambientGain) {
            const p = this.ambientGain.gain;
            if (p.cancelScheduledValues) p.cancelScheduledValues(now);
            if (immediate) p.setValueAtTime(ambTarget, now);
            else p.setTargetAtTime(ambTarget, now, 0.08);
        }
    },

    _applySfxGain() {
        this._applyGains();
    },

    setContextMute(muted) {
        this._sfxMutedByContext = !!muted;
        this._applyGains();
    },

    get musicEnabled() {
        return this._musicEnabled;
    },
    set musicEnabled(v) {
        this._musicEnabled = !!v;
        if (this.musicEl) {
            if (this._musicEnabled && this.ctx && this.ctx.state === 'running') {
                this.musicEl.play().catch(() => {});
            } else {
                this.musicEl.pause();
            }
        }
        try {
            localStorage.setItem('sc_music', this._musicEnabled);
        } catch (e) {
            /* storage unavailable */
        }
    },

    startMusic() {
        if (this.musicEl && this._musicEnabled) {
            this.musicEl.play().catch(() => {});
        }
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
    },

    init() {
        if (this.ctx) return;

        const AudioCtx =
            typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
        if (!AudioCtx) return;

        this.ctx = new AudioCtx();
        this._activeVoices = [];
        this._cooldowns = Object.create(null);
        this._noiseCursor = 0;

        // Master output bus (tapped directly by js/photo_mode.js for clip recording)
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.value = 1.0;
        this.masterGain.connect(this.ctx.destination);

        // Transparent peak safety limiter before masterGain
        this.limiter = this.ctx.createDynamicsCompressor();
        this.limiter.threshold.value = -6;
        this.limiter.knee.value = 6;
        this.limiter.ratio.value = 12;
        this.limiter.attack.value = 0.003;
        this.limiter.release.value = 0.15;
        this.limiter.connect(this.masterGain);

        // Discrete SFX bus with gentle warm low-pass tone shaper (eliminates harsh >4 kHz buzz)
        this.sfxGain = this.ctx.createGain();
        this.sfxGain.gain.value = this._sfxAudible() ? this._baseSfxGain * this._sfxVolume : 0;
        this.sfxGain.connect(this.limiter);

        const sfxTone = this.ctx.createBiquadFilter();
        sfxTone.type = 'lowpass';
        sfxTone.frequency.value = 3200;
        sfxTone.Q.value = 0.55;
        sfxTone.connect(this.sfxGain);

        this._polyGain = this.ctx.createGain();
        this._polyGain.gain.value = 1.0;
        this._polyTarget = 1.0;
        this._polyGain.connect(sfxTone);
        this._sfxBus = this._polyGain;

        // Continuous ambient bus (used by Soundscape)
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.gain.value = this._sfxAudible() ? this._baseAmbientGain * this._ambientVolume : 0;
        this.ambientGain.connect(this.limiter);

        // Build cached seamless stereo Pink & Brown noise buffers once on init
        this._pinkBuf = this._makePinkBuffer(3.0);
        this._brownBuf = this._makeBrownBuffer(3.0);

        // Initialize Background Music (standalone HTMLAudioElement — untouched)
        if (typeof Audio !== 'undefined') {
            this.musicEl = new Audio('SingularityCity.mp3?v=362');
            this.musicEl.loop = true;
            this.musicEl.volume = 0.35;
        }

        try {
            const savedMusic = localStorage.getItem('sc_music');
            if (savedMusic !== null) this._musicEnabled = savedMusic === 'true';
        } catch (e) {
            /* storage unavailable */
        }

        // Procedural ambient bed (js/soundscape.js) plays through ambientGain.
        if (typeof Soundscape !== 'undefined') Soundscape.init(this);

        if (!this._listenersBound && typeof document !== 'undefined' && document.addEventListener) {
            this._listenersBound = true;

            // Browsers block autoplay. This unlocks audio context and plays music on the first
            // user gesture — a click, a tap, a drag or a key.
            const gestures = ['click', 'touchstart', 'pointerdown', 'keydown'];
            const unlock = () => {
                if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
                this.startMusic();
                gestures.forEach((ev) => document.removeEventListener(ev, unlock));
            };
            gestures.forEach((ev) => document.addEventListener(ev, unlock));

            // A hidden tab stops synthesizing (the music <audio> element is left alone).
            document.addEventListener('visibilitychange', () => {
                if (!this.ctx) return;
                if (document.hidden) {
                    if (this.ctx.state === 'running') {
                        this._hiddenSuspend = true;
                        this.ctx.suspend();
                    }
                } else if (this._hiddenSuspend) {
                    this._hiddenSuspend = false;
                    this.ctx.resume();
                }
            });
        }
    },

    // ─── Seamless Cached Noise Buffers ──────────────────────────────────────────────────────────
    _makePinkBuffer(seconds) {
        const sr = this.ctx.sampleRate || 44100;
        const len = Math.max(1024, Math.floor(sr * seconds));
        const xfade = Math.min(Math.floor(sr * 0.15), Math.floor(len * 0.25));
        const total = len + xfade;
        const buf = this.ctx.createBuffer(2, len, sr);

        for (let ch = 0; ch < 2; ch++) {
            const raw = new Float32Array(total);
            let b0 = 0;
            let b1 = 0;
            let b2 = 0;
            let b3 = 0;
            let b4 = 0;
            let b5 = 0;
            let b6 = 0;

            for (let i = -256; i < total; i++) {
                const w = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.969 * b2 + w * 0.153852;
                b3 = 0.8665 * b3 + w * 0.3104856;
                b4 = 0.55 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.016898;
                const sample = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;
                b6 = w * 0.115926;
                if (i >= 0) raw[i] = sample;
            }

            this._finalizeLoopChannel(buf.getChannelData(ch), raw, len, xfade, 0.22);
        }
        return buf;
    },

    _makeBrownBuffer(seconds) {
        const sr = this.ctx.sampleRate || 44100;
        const len = Math.max(1024, Math.floor(sr * seconds));
        const xfade = Math.min(Math.floor(sr * 0.15), Math.floor(len * 0.25));
        const total = len + xfade;
        const buf = this.ctx.createBuffer(2, len, sr);

        for (let ch = 0; ch < 2; ch++) {
            const raw = new Float32Array(total);
            let acc = 0;

            for (let i = -256; i < total; i++) {
                acc = acc * 0.992 + (Math.random() * 2 - 1) * 0.06;
                if (acc > 1) acc = 1;
                else if (acc < -1) acc = -1;
                if (i >= 0) raw[i] = acc;
            }

            this._finalizeLoopChannel(buf.getChannelData(ch), raw, len, xfade, 0.25);
        }
        return buf;
    },

    _finalizeLoopChannel(dst, raw, len, xfade, targetRms) {
        let sum = 0;
        for (let i = 0; i < len; i++) {
            let v = raw[i];
            if (i < xfade) {
                const t = i / xfade;
                v = raw[i] * Math.sin(t * Math.PI * 0.5) + raw[len + i] * Math.cos(t * Math.PI * 0.5);
            }
            dst[i] = v;
            sum += v;
        }
        const mean = sum / len;
        let sq = 0;
        for (let i = 0; i < len; i++) {
            const v = dst[i] - mean;
            dst[i] = v;
            sq += v * v;
        }
        const rms = Math.sqrt(sq / len) || 1;
        const scale = targetRms / rms;
        for (let i = 0; i < len; i++) {
            const v = dst[i] * scale;
            dst[i] = v > 0.9 ? 0.9 : v < -0.9 ? -0.9 : v;
        }
    },

    // ─── Cooldowns & Polyphony Management ───────────────────────────────────────────────────────
    _cooldown(key, ms) {
        if (!this.ctx) return false;
        const nowMs = this.ctx.currentTime * 1000;
        const last = this._cooldowns[key];
        if (last !== undefined && nowMs >= last && nowMs - last < ms) return false;
        this._cooldowns[key] = nowMs;
        return true;
    },

    _pruneVoices(now) {
        if (!this._activeVoices.length) return;
        let write = 0;
        for (let i = 0; i < this._activeVoices.length; i++) {
            const v = this._activeVoices[i];
            if (!v.stopped && v.endTime > now) {
                this._activeVoices[write++] = v;
            }
        }
        this._activeVoices.length = write;
    },

    _releaseVoice(voice, now) {
        if (!voice || voice.stopped) return;
        voice.stopped = true;
        const g = voice.voiceGain.gain;
        if (g.cancelScheduledValues) g.cancelScheduledValues(now);
        if (voice.startTime >= now) {
            // Voice has not sounded yet — silence it cleanly before onset
            g.setValueAtTime(0, now);
        } else {
            // Voice is mid-envelope — fade smoothly over 8ms to avoid any click
            g.setValueAtTime(1, now);
            g.linearRampToValueAtTime(0, now + 0.008);
        }
    },

    _allocVoice(startTime, endTime) {
        const now = this.ctx.currentTime;
        this._pruneVoices(now);
        const wasIdle = this._activeVoices.length === 0;

        while (this._activeVoices.length >= this._maxVoices) {
            const oldest = this._activeVoices.shift();
            this._releaseVoice(oldest, now);
        }

        const voiceGain = this.ctx.createGain();
        voiceGain.gain.setValueAtTime(1, now);
        voiceGain.connect(this._sfxBus || this.sfxGain);

        const voice = {
            startTime,
            endTime,
            voiceGain,
            stopped: false,
        };
        this._activeVoices.push(voice);

        // Smooth polyphony headroom scaling when >6 voices overlap (single SFX use <=6 voices)
        if (this._polyGain) {
            const count = this._activeVoices.length;
            const target = count > 6 ? 6 / count : 1.0;
            if (target !== this._polyTarget) {
                const p = this._polyGain.gain;
                if (p.cancelScheduledValues) p.cancelScheduledValues(now);
                if (wasIdle && target === 1.0) {
                    p.setValueAtTime(1.0, now);
                } else {
                    p.setTargetAtTime(target, now, target < this._polyTarget ? 0.003 : 0.03);
                }
                this._polyTarget = target;
            }
        }

        return voice;
    },

    // ─── Click-Free Synthesis Primitives ────────────────────────────────────────────────────────
    _applyEnvelope(param, t0, attack, hold, tEnd, peak, curve) {
        const tPeak = t0 + attack;
        const tHold = hold > 0 ? Math.min(tPeak + hold, tEnd - 0.006) : tPeak;
        const decayStart = tHold > tPeak ? tHold : tPeak;
        const decayDur = tEnd - decayStart;

        param.setValueAtTime(0, t0);
        param.linearRampToValueAtTime(peak, tPeak);
        if (tHold > tPeak) {
            param.setValueAtTime(peak, tHold);
        }

        if (decayDur > 0.024 && curve !== 'linear' && peak > 0.0005) {
            const tail = Math.min(0.022, decayDur * 0.2);
            const expEnd = tEnd - tail;
            const knee = Math.max(0.0002, Math.min(peak * 0.04, peak * 0.5));
            param.exponentialRampToValueAtTime(knee, expEnd);
            param.linearRampToValueAtTime(0, tEnd);
        } else {
            param.linearRampToValueAtTime(0, tEnd);
        }
    },

    _tone(opts) {
        if (!this._canPlaySfx()) return;
        const ctx = this.ctx;
        const delay = Math.max(0, Number(opts.delay) || 0);
        const attack = Math.max(0.003, Number(opts.attack) || 0.006);
        const hold = Math.max(0, Number(opts.hold) || 0);
        const dur = Math.max(attack + 0.012, Number(opts.dur) || 0.1);
        const vol = Math.max(0.0005, Math.min(0.9, Number(opts.vol) || 0.25));
        const freq = Math.max(20, Math.min(16000, Number(opts.freq) || 440));
        const type = opts.type || 'sine';

        const t0 = ctx.currentTime + delay;
        const tEnd = t0 + dur;
        const stopAt = tEnd + 0.008;

        const voice = this._allocVoice(t0, stopAt);

        const osc = ctx.createOscillator();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, t0);
        if (opts.detune && osc.detune) {
            osc.detune.setValueAtTime(opts.detune, t0);
        }
        if (opts.slideTo) {
            const targetFreq = Math.max(20, Math.min(16000, Number(opts.slideTo)));
            const slideEnd = opts.slideDur ? Math.min(tEnd, t0 + Math.max(0.008, opts.slideDur)) : tEnd;
            osc.frequency.exponentialRampToValueAtTime(targetFreq, slideEnd);
        }

        const env = ctx.createGain();
        env.gain.value = 0;
        this._applyEnvelope(env.gain, t0, attack, hold, tEnd, vol, opts.curve);

        // Warm smoothing filter for explicit LP requests or rich waveforms (square/sawtooth)
        let lpFreq = Number(opts.lp) || 0;
        if (!lpFreq && (type === 'square' || type === 'sawtooth')) {
            lpFreq = Math.min(2000, Math.max(850, freq * 2.6));
        }

        if (lpFreq > 0) {
            const flt = ctx.createBiquadFilter();
            flt.type = 'lowpass';
            const startLp = Math.max(60, Math.min(12000, lpFreq));
            flt.frequency.setValueAtTime(startLp, t0);
            flt.Q.value = opts.q !== undefined ? opts.q : 0.7;
            if (opts.lpTo) {
                const endLp = Math.max(60, Math.min(12000, Number(opts.lpTo)));
                flt.frequency.exponentialRampToValueAtTime(endLp, tEnd);
            }
            osc.connect(flt);
            flt.connect(env);
        } else {
            osc.connect(env);
        }

        env.connect(voice.voiceGain);
        osc.onended = () => {
            voice.stopped = true;
            try {
                voice.voiceGain.disconnect();
            } catch (e) {
                /* already disconnected */
            }
        };

        osc.start(t0);
        osc.stop(stopAt);
    },

    _noise(opts) {
        if (!this._canPlaySfx()) return;
        const buf = opts.color === 'brown' ? this._brownBuf : this._pinkBuf;
        if (!buf) return;

        const ctx = this.ctx;
        const delay = Math.max(0, Number(opts.delay) || 0);
        const attack = Math.max(0.003, Number(opts.attack) || 0.004);
        const hold = Math.max(0, Number(opts.hold) || 0);
        const dur = Math.max(attack + 0.012, Number(opts.dur) || 0.04);
        const vol = Math.max(0.0005, Math.min(1.0, Number(opts.vol) || 0.25));

        const t0 = ctx.currentTime + delay;
        const tEnd = t0 + dur;
        const stopAt = tEnd + 0.008;

        const voice = this._allocVoice(t0, stopAt);

        const src = ctx.createBufferSource();
        src.buffer = buf;
        src.loop = true;

        const filterType = opts.filterType || 'lowpass';
        const flt = ctx.createBiquadFilter();
        flt.type = filterType;
        const fStart = Math.max(40, Math.min(10000, Number(opts.freq) || 1000));
        flt.frequency.setValueAtTime(fStart, t0);
        flt.Q.value = opts.q !== undefined ? opts.q : 0.9;
        if (opts.freqTo) {
            const fEnd = Math.max(40, Math.min(10000, Number(opts.freqTo)));
            flt.frequency.exponentialRampToValueAtTime(fEnd, tEnd);
        }

        const env = ctx.createGain();
        env.gain.value = 0;
        this._applyEnvelope(env.gain, t0, attack, hold, tEnd, vol, opts.curve);

        src.connect(flt);
        if (filterType !== 'lowpass' && opts.lp) {
            const lp = ctx.createBiquadFilter();
            lp.type = 'lowpass';
            lp.frequency.setValueAtTime(Math.max(100, Math.min(6000, Number(opts.lp))), t0);
            lp.Q.value = 0.6;
            flt.connect(lp);
            lp.connect(env);
        } else {
            flt.connect(env);
        }

        env.connect(voice.voiceGain);
        src.onended = () => {
            voice.stopped = true;
            try {
                voice.voiceGain.disconnect();
            } catch (e) {
                /* already disconnected */
            }
        };

        const maxOff = Math.max(0, (buf.duration || 2.0) - 0.1);
        this._noiseCursor = (this._noiseCursor + 0.37) % (maxOff || 1);
        src.start(t0, this._noiseCursor);
        src.stop(stopAt);
    },

    // ─── Backwards-Compatible Fallback Tone Synthesizer ─────────────────────────────────────────
    // Supports BOTH legacy (freq, type, dur, vol, slideTo, delay) and (freq, dur, type, vol, slideTo, delay).
    playTone(freq, arg2, arg3, arg4, arg5, arg6) {
        if (!this._canPlaySfx()) return;
        let type = 'sine';
        let dur = 0.1;
        let vol = 0.1;
        let slideTo = null;
        let delay = 0;

        if (typeof arg2 === 'string') {
            type = arg2;
            dur = arg3 !== undefined ? arg3 : 0.1;
            vol = arg4 !== undefined ? arg4 : 0.1;
            slideTo = arg5 !== undefined ? arg5 : null;
            delay = arg6 !== undefined ? arg6 : 0;
        } else if (typeof arg2 === 'number') {
            dur = arg2;
            type = typeof arg3 === 'string' ? arg3 : 'sine';
            vol = arg4 !== undefined ? arg4 : 0.1;
            slideTo = arg5 !== undefined ? arg5 : null;
            delay = arg6 !== undefined ? arg6 : 0;
        }

        this._tone({
            freq,
            type,
            dur,
            vol: Math.max(0.005, Math.min(0.85, Number(vol) || 0.1)),
            slideTo,
            delay,
            attack: Math.max(0.004, Math.min(0.015, dur * 0.12)),
        });
    },

    // ─── Overhauled 2D SFX Palette (Harmonized to SingularityCity's B-minor / D-major warmth) ───

    // Crisp, subtle warm wood/glass tactile micro-click
    uiClick() {
        if (!this._canPlaySfx() || !this._cooldown('uiClick', 35)) return;
        this._tone({
            freq: 740,
            slideTo: 510,
            type: 'sine',
            vol: 0.36,
            dur: 0.024,
            attack: 0.003,
        });
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 1550,
            q: 2.0,
            lp: 2400,
            vol: 0.42,
            dur: 0.019,
            attack: 0.003,
        });
    },

    // Ultra-soft muted glass tick (hover feedback — gently subordinate to uiClick)
    uiHover() {
        if (!this._canPlaySfx() || !this._cooldown('uiHover', 90)) return;
        this._tone({
            freq: 987.77,
            slideTo: 880,
            type: 'sine',
            vol: 0.18,
            dur: 0.022,
            attack: 0.004,
        });
    },

    // Clean subtle warm glass card glide up
    panelOpen() {
        if (!this._canPlaySfx() || !this._cooldown('panelOpen', 70)) return;
        this._tone({
            freq: 440,
            slideTo: 587.33,
            type: 'sine',
            vol: 0.38,
            dur: 0.095,
            attack: 0.008,
        });
        this._tone({
            freq: 880,
            type: 'triangle',
            lp: 1850,
            vol: 0.25,
            dur: 0.115,
            delay: 0.032,
            attack: 0.01,
        });
    },

    // Clean subtle warm glass card glide down
    panelClose() {
        if (!this._canPlaySfx() || !this._cooldown('panelClose', 70)) return;
        this._tone({
            freq: 587.33,
            slideTo: 369.99,
            type: 'sine',
            vol: 0.38,
            dur: 0.09,
            attack: 0.006,
        });
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 920,
            q: 1.4,
            lp: 1700,
            vol: 0.24,
            dur: 0.05,
            delay: 0.008,
            attack: 0.006,
        });
    },

    // Warm subtle doorway/interior transition cue
    enterBuilding() {
        if (!this._canPlaySfx() || !this._cooldown('enterBuilding', 120)) return;
        this._noise({
            color: 'brown',
            filterType: 'lowpass',
            freq: 440,
            freqTo: 210,
            q: 0.7,
            vol: 0.44,
            dur: 0.15,
            attack: 0.016,
        });
        this._tone({
            freq: 293.66,
            type: 'triangle',
            lp: 1100,
            vol: 0.36,
            dur: 0.16,
            delay: 0.015,
            attack: 0.01,
        });
        this._tone({
            freq: 369.99,
            type: 'sine',
            vol: 0.3,
            dur: 0.22,
            delay: 0.065,
            attack: 0.012,
        });
    },

    // Subtle airy outward doorway transition
    exitBuilding() {
        if (!this._canPlaySfx() || !this._cooldown('exitBuilding', 120)) return;
        this._noise({
            color: 'pink',
            filterType: 'lowpass',
            freq: 360,
            freqTo: 820,
            q: 0.65,
            vol: 0.26,
            dur: 0.15,
            attack: 0.018,
        });
        this._tone({
            freq: 369.99,
            type: 'sine',
            vol: 0.34,
            dur: 0.14,
            delay: 0.01,
            attack: 0.008,
        });
        this._tone({
            freq: 293.66,
            type: 'triangle',
            lp: 1100,
            vol: 0.3,
            dur: 0.2,
            delay: 0.06,
            attack: 0.012,
        });
    },

    // Soft modern transit chime confirmation (ascending F#5 -> B5)
    boardTrain() {
        if (!this._canPlaySfx() || !this._cooldown('boardTrain', 150)) return;
        this._tone({
            freq: 739.99,
            type: 'sine',
            vol: 0.34,
            dur: 0.22,
            attack: 0.008,
        });
        this._tone({
            freq: 987.77,
            type: 'sine',
            vol: 0.36,
            dur: 0.34,
            delay: 0.105,
            attack: 0.008,
        });
        this._tone({
            freq: 293.66,
            type: 'triangle',
            lp: 900,
            vol: 0.22,
            dur: 0.28,
            delay: 0.105,
            attack: 0.018,
        });
    },

    // Soft modern transit arrival chime (descending B5 -> F#5 + gentle door sigh)
    exitTrain() {
        if (!this._canPlaySfx() || !this._cooldown('exitTrain', 150)) return;
        this._tone({
            freq: 987.77,
            type: 'sine',
            vol: 0.32,
            dur: 0.18,
            attack: 0.008,
        });
        this._tone({
            freq: 739.99,
            type: 'sine',
            vol: 0.32,
            dur: 0.28,
            delay: 0.095,
            attack: 0.008,
        });
        this._noise({
            color: 'pink',
            filterType: 'lowpass',
            freq: 740,
            freqTo: 300,
            q: 0.7,
            vol: 0.24,
            dur: 0.16,
            delay: 0.02,
            attack: 0.016,
        });
    },

    // Smooth airy holographic bloom swell
    holomapOpen() {
        if (!this._canPlaySfx() || !this._cooldown('holomapOpen', 180)) return;
        this._tone({
            freq: 293.66,
            slideTo: 587.33,
            type: 'sine',
            vol: 0.32,
            dur: 0.46,
            attack: 0.05,
        });
        this._tone({
            freq: 440,
            slideTo: 880,
            type: 'triangle',
            lp: 1650,
            vol: 0.22,
            dur: 0.42,
            delay: 0.04,
            attack: 0.06,
        });
        this._tone({
            freq: 739.99,
            type: 'sine',
            vol: 0.2,
            dur: 0.4,
            delay: 0.11,
            attack: 0.075,
        });
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 520,
            freqTo: 1350,
            q: 1.0,
            lp: 1950,
            vol: 0.22,
            dur: 0.34,
            attack: 0.055,
        });
    },

    // Smooth airy holographic collapse swell
    holomapClose() {
        if (!this._canPlaySfx() || !this._cooldown('holomapClose', 180)) return;
        this._tone({
            freq: 440,
            slideTo: 293.66,
            type: 'sine',
            vol: 0.32,
            dur: 0.35,
            attack: 0.022,
        });
        this._tone({
            freq: 739.99,
            slideTo: 440,
            type: 'triangle',
            lp: 1500,
            lpTo: 620,
            vol: 0.22,
            dur: 0.29,
            delay: 0.02,
            attack: 0.02,
        });
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 1180,
            freqTo: 400,
            q: 1.0,
            lp: 1750,
            vol: 0.2,
            dur: 0.25,
            attack: 0.022,
        });
    },

    // Soft resonant lens-lock glide
    holomapZoom() {
        if (!this._canPlaySfx() || !this._cooldown('holomapZoom', 100)) return;
        this._tone({
            freq: 369.99,
            slideTo: 739.99,
            type: 'triangle',
            lp: 1700,
            vol: 0.4,
            dur: 0.22,
            attack: 0.016,
        });
        this._tone({
            freq: 1174.66,
            type: 'sine',
            vol: 0.3,
            dur: 0.16,
            delay: 0.095,
            attack: 0.008,
        });
    },

    // Soft sleek camera wake chime
    photoEnter() {
        if (!this._canPlaySfx() || !this._cooldown('photoEnter', 150)) return;
        this._tone({
            freq: 880,
            type: 'sine',
            vol: 0.38,
            dur: 0.09,
            attack: 0.006,
        });
        this._tone({
            freq: 1174.66,
            type: 'sine',
            vol: 0.38,
            dur: 0.16,
            delay: 0.062,
            attack: 0.006,
        });
    },

    // Crisp realistic mechanical camera shutter (curtain transients + damped mirror thump)
    photoShutter() {
        if (!this._canPlaySfx() || !this._cooldown('photoShutter', 120)) return;
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 1650,
            q: 1.3,
            lp: 2600,
            vol: 0.72,
            dur: 0.024,
            attack: 0.003,
        });
        this._tone({
            freq: 170,
            slideTo: 66,
            type: 'sine',
            vol: 0.48,
            dur: 0.048,
            delay: 0.004,
            attack: 0.003,
        });
        this._noise({
            color: 'pink',
            filterType: 'bandpass',
            freq: 1200,
            q: 1.5,
            lp: 2100,
            vol: 0.48,
            dur: 0.028,
            delay: 0.042,
            attack: 0.004,
        });
    },

    // Crisp warm radio/news ticker pop
    blimpPop() {
        if (!this._canPlaySfx() || !this._cooldown('blimpPop', 80)) return;
        this._tone({
            freq: 520,
            slideTo: 260,
            type: 'sine',
            vol: 0.38,
            dur: 0.056,
            attack: 0.004,
        });
        this._tone({
            freq: 987.77,
            slideTo: 739.99,
            type: 'triangle',
            lp: 1950,
            vol: 0.24,
            dur: 0.04,
            delay: 0.012,
            attack: 0.003,
        });
    },

    // Sleek warm radar/telemetry sonar ping with soft harmonic shimmer tail
    scan() {
        if (!this._canPlaySfx() || !this._cooldown('scan', 200)) return;
        this._tone({
            freq: 587.33,
            slideTo: 880,
            type: 'triangle',
            lp: 1750,
            vol: 0.28,
            dur: 0.14,
            attack: 0.008,
        });
        this._tone({
            freq: 880,
            type: 'sine',
            vol: 0.38,
            dur: 0.44,
            delay: 0.075,
            attack: 0.006,
        });
        this._tone({
            freq: 1318.51,
            type: 'sine',
            vol: 0.16,
            dur: 0.34,
            delay: 0.095,
            attack: 0.014,
        });
    },

    // Warm uplifting Rhodes/marimba-style harmonic arpeggio
    birth() {
        if (!this._canPlaySfx() || !this._cooldown('birth', 250)) return;
        this._tone({
            freq: 293.66,
            type: 'sine',
            vol: 0.24,
            dur: 0.48,
            attack: 0.016,
        });
        const notes = [587.33, 739.99, 880, 1174.66];
        for (let i = 0; i < notes.length; i++) {
            this._tone({
                freq: notes[i],
                type: i < 3 ? 'triangle' : 'sine',
                lp: i < 3 ? 1750 : 0,
                vol: i === 3 ? 0.36 : 0.3,
                dur: i === 3 ? 0.46 : 0.26,
                delay: i * 0.072,
                attack: 0.006,
            });
        }
        this._tone({
            freq: 1760,
            type: 'sine',
            vol: 0.12,
            dur: 0.32,
            delay: 0.225,
            attack: 0.012,
        });
    },

    // Gentle wistful descending warm bell/Rhodes cadence
    retire() {
        if (!this._canPlaySfx() || !this._cooldown('retire', 250)) return;
        this._tone({
            freq: 440,
            type: 'triangle',
            lp: 1400,
            vol: 0.34,
            dur: 0.32,
            attack: 0.012,
        });
        this._tone({
            freq: 369.99,
            type: 'triangle',
            lp: 1200,
            vol: 0.32,
            dur: 0.38,
            delay: 0.135,
            attack: 0.014,
        });
        this._tone({
            freq: 293.66,
            type: 'sine',
            vol: 0.36,
            dur: 0.54,
            delay: 0.27,
            attack: 0.018,
        });
        this._tone({
            freq: 246.94,
            type: 'sine',
            vol: 0.22,
            dur: 0.58,
            delay: 0.27,
            attack: 0.03,
        });
    },

    // Polished warm crystalline Dmaj9 chime bloom
    achieve() {
        if (!this._canPlaySfx() || !this._cooldown('achieve', 300)) return;
        this._tone({
            freq: 293.66,
            type: 'sine',
            vol: 0.26,
            dur: 0.74,
            attack: 0.025,
        });
        const chord = [587.33, 739.99, 880, 1174.66, 1318.51];
        for (let i = 0; i < chord.length; i++) {
            this._tone({
                freq: chord[i],
                type: i < 3 ? 'triangle' : 'sine',
                lp: i < 3 ? 2100 : 0,
                lpTo: i < 3 ? 1200 : 0,
                vol: i === 4 ? 0.28 : 0.26,
                dur: 0.42 + i * 0.07,
                delay: i * 0.062,
                attack: 0.007,
            });
        }
    },

    // Celebratory warm shimmering synth-brass swell + soft sub warmth
    launch() {
        if (!this._canPlaySfx() || !this._cooldown('launch', 400)) return;
        this._tone({
            freq: 146.83,
            type: 'sine',
            vol: 0.32,
            dur: 0.96,
            attack: 0.08,
            hold: 0.18,
        });
        this._tone({
            freq: 220,
            type: 'triangle',
            lp: 380,
            lpTo: 1650,
            vol: 0.26,
            dur: 0.92,
            delay: 0.02,
            attack: 0.1,
            hold: 0.18,
        });
        this._tone({
            freq: 293.66,
            type: 'triangle',
            lp: 440,
            lpTo: 1900,
            vol: 0.26,
            dur: 0.94,
            delay: 0.05,
            attack: 0.12,
            hold: 0.2,
        });
        this._tone({
            freq: 369.99,
            type: 'triangle',
            lp: 480,
            lpTo: 2050,
            vol: 0.21,
            dur: 0.88,
            delay: 0.09,
            attack: 0.14,
            hold: 0.16,
        });
        this._tone({
            freq: 880,
            type: 'sine',
            vol: 0.2,
            dur: 0.64,
            delay: 0.18,
            attack: 0.05,
        });
        this._noise({
            color: 'brown',
            filterType: 'lowpass',
            freq: 240,
            freqTo: 620,
            q: 0.7,
            vol: 0.26,
            dur: 0.6,
            attack: 0.1,
        });
    },

    // Ethereal shimmering warm harmonic pad swell
    aurora() {
        if (!this._canPlaySfx() || !this._cooldown('aurora', 600)) return;
        const pad = [
            { freq: 246.94, type: 'sine', vol: 0.28, delay: 0, attack: 0.24, hold: 0.28, dur: 1.35 },
            {
                freq: 369.99,
                type: 'triangle',
                lp: 1100,
                vol: 0.22,
                delay: 0.05,
                attack: 0.28,
                hold: 0.26,
                dur: 1.38,
            },
            { freq: 440, type: 'sine', vol: 0.2, delay: 0.1, attack: 0.32, hold: 0.22, dur: 1.4 },
            { freq: 587.33, type: 'sine', vol: 0.18, delay: 0.16, attack: 0.36, hold: 0.18, dur: 1.42 },
            { freq: 659.25, type: 'sine', vol: 0.14, delay: 0.22, attack: 0.4, hold: 0.14, dur: 1.36 },
        ];
        for (let i = 0; i < pad.length; i++) {
            this._tone(pad[i]);
        }
    },

    // Warm academic carillon chime flourish
    graduation() {
        if (!this._canPlaySfx() || !this._cooldown('graduation', 400)) return;
        const notes = [587.33, 659.25, 739.99, 880];
        for (let i = 0; i < notes.length; i++) {
            this._tone({
                freq: notes[i],
                type: 'triangle',
                lp: 1850,
                vol: i === 3 ? 0.34 : 0.28,
                dur: i === 3 ? 0.66 : 0.36,
                delay: i * 0.105,
                attack: 0.008,
            });
        }
        this._tone({
            freq: 293.66,
            type: 'sine',
            vol: 0.28,
            dur: 0.72,
            delay: 0.315,
            attack: 0.015,
        });
        this._tone({
            freq: 1174.66,
            type: 'sine',
            vol: 0.18,
            dur: 0.54,
            delay: 0.315,
            attack: 0.01,
        });
    },

    // Magical celestial glockenspiel/bell pitch climb (step 1..5)
    moonClick(step) {
        if (!this._canPlaySfx() || !this._cooldown('moonClick', 70)) return;
        const scale = [587.33, 659.25, 739.99, 880, 1174.66];
        const idx = Math.max(0, Math.min(scale.length - 1, Math.floor((Number(step) || 1) - 1)));
        const f = scale[idx];
        this._tone({
            freq: f,
            type: 'sine',
            vol: 0.36,
            dur: 0.38,
            attack: 0.005,
        });
        this._tone({
            freq: Math.min(2350, f * 2),
            type: 'sine',
            vol: 0.16,
            dur: 0.22,
            delay: 0.012,
            attack: 0.008,
        });
    },

    // Sleek cyber digital cascade (warm filtered pluck ripple, zero harsh sawtooth)
    matrixRain() {
        if (!this._canPlaySfx() || !this._cooldown('matrixRain', 500)) return;
        const cascade = [987.77, 880, 739.99, 587.33, 493.88];
        for (let i = 0; i < cascade.length; i++) {
            this._tone({
                freq: cascade[i],
                type: 'triangle',
                lp: 2050,
                lpTo: 620,
                q: 1.6,
                vol: 0.28,
                dur: 0.24,
                delay: i * 0.052,
                attack: 0.005,
            });
        }
        this._tone({
            freq: 123.47,
            slideTo: 92.5,
            type: 'sine',
            vol: 0.34,
            dur: 0.62,
            delay: 0.03,
            attack: 0.028,
        });
    },

    // Playful cute stylized cat chirp/trill (warm formant-swept sine/triangle)
    caturday() {
        if (!this._canPlaySfx() || !this._cooldown('caturday', 300)) return;
        this._tone({
            freq: 520,
            slideTo: 940,
            type: 'sine',
            vol: 0.36,
            dur: 0.115,
            attack: 0.014,
        });
        this._tone({
            freq: 920,
            slideTo: 610,
            type: 'triangle',
            lp: 1800,
            lpTo: 1000,
            q: 1.4,
            vol: 0.3,
            dur: 0.17,
            delay: 0.095,
            attack: 0.012,
        });
        this._tone({
            freq: 293.66,
            slideTo: 375,
            type: 'sine',
            vol: 0.18,
            dur: 0.14,
            delay: 0.018,
            attack: 0.016,
        });
    },

    // Rolling thunder for each lightning bolt (delegates to Soundscape when active, warm fallback otherwise)
    thunder(intensity) {
        if (!this._sfxAudible()) return;
        if (typeof Soundscape !== 'undefined' && Soundscape.ctx && typeof Soundscape.thunder === 'function') {
            Soundscape.thunder(intensity);
            return;
        }
        if (!this._canPlaySfx() || !this._cooldown('thunder', 300)) return;
        const k = Math.max(0.35, Math.min(1.2, Number(intensity) || 1));
        this._tone({
            freq: 74,
            slideTo: 34,
            type: 'sine',
            vol: Math.min(0.8, 0.44 * k),
            dur: 0.85,
            attack: 0.03,
        });
        this._noise({
            color: 'brown',
            filterType: 'lowpass',
            freq: 240,
            freqTo: 92,
            q: 0.8,
            vol: Math.min(0.9, 0.68 * k),
            dur: 1.35,
            delay: 0.02,
            attack: 0.04,
            hold: 0.15,
        });
        this._noise({
            color: 'brown',
            filterType: 'lowpass',
            freq: 180,
            freqTo: 72,
            q: 0.7,
            vol: Math.min(0.8, 0.5 * k),
            dur: 1.48,
            delay: 0.24,
            attack: 0.12,
        });
    },

    // ─── Ambient Zone State Tracking (Legacy clashing setInterval loops removed) ────────────────
    // The continuous ambient bed lives in Soundscape (js/soundscape.js) through SND.ambientGain.
    setAmbient(bldId) {
        if (this.ambientInterval) {
            clearInterval(this.ambientInterval);
            this.ambientInterval = null;
        }
        this.currentAmbient = bldId || null;
    },

    stopAmbient() {
        if (this.ambientInterval) {
            clearInterval(this.ambientInterval);
            this.ambientInterval = null;
        }
        this.currentAmbient = null;
    },

    // Dev: what the audio layer is doing right now (see Soundscape.debugState / meter).
    debugState() {
        return {
            ctx: this.ctx ? this.ctx.state : 'none',
            sfx: this._sfxEnabled,
            music: this._musicEnabled,
            sfxVolume: this._sfxVolume,
            ambientVolume: this._ambientVolume,
            contextMute: this._sfxMutedByContext,
            activeVoices: this._activeVoices.length,
            ambient: this.currentAmbient,
            soundscape: typeof Soundscape !== 'undefined' && Soundscape.ctx ? Soundscape.debugState() : null,
        };
    },
};
