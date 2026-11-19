/* ══════════════════════════════════════════════════════════════════════════
   AUDIO — warm procedural WebAudio SFX & weather beds plus the Singularity
   City theme track. Everything degrades silently before the first user
   gesture or when AudioContext is unavailable.
   ══════════════════════════════════════════════════════════════════════════ */
import { G } from './state.js';

const BED_BUFFER_SEC = 8;
const NOISE_RMS = 0.22;
const MAX_VOICES = 12;
const BED_MIN_INTERVAL = 0.1;
const BED_JUMP_THRESH = 0.08;

const RAIN_MAP = {
    drizzle: 0.38,
    rain: 0.84,
    thunderstorm: 1.0,
};

const WIND_MAP = {
    clear: 0.0,
    cloudy: 0.04,
    overcast: 0.14,
    fog: 0.0,
    cherry: 0.06,
    autumn: 0.22,
    drizzle: 0.18,
    rain: 0.36,
    snow: 0.46,
    thunderstorm: 0.85,
};

const SFX_COOLDOWN = {
    step: 0.065,
    step_run: 0.055,
    jump: 0.12,
    blip: 0.05,
    open: 0.11,
    close: 0.11,
    door_open: 0.12,
    door_close: 0.12,
    district: 0.15,
    achieve: 0.15,
    quest: 0.15,
    chime: 0.12,
    thunder: 0.35,
    rocket: 0.5,
    meow: 0.2,
    splash: 0.1,
};

function clamp01(v) {
    const n = Number(v);
    if (!Number.isFinite(n)) return 0;
    return n < 0 ? 0 : n > 1 ? 1 : n;
}

function makeRng(seed) {
    let s = seed >>> 0 || 1;
    return () => {
        s ^= s << 13;
        s ^= s >>> 17;
        s ^= s << 5;
        return ((s >>> 0) / 4294967296) * 2 - 1;
    };
}

/**
 * Fill one channel of a seamlessly equal-power loop-crossfaded Pink (-3 dB/oct)
 * or Brown (-6 dB/oct) noise buffer, normalized to NOISE_RMS.
 */
function fillNoiseChannel(dest, sr, kind, seed) {
    const n = dest.length;
    const fade = Math.min(Math.floor(sr * 0.5), Math.floor(n / 4));
    const total = n + fade;
    const raw = new Float32Array(total);
    const rand = makeRng(seed);

    const warmup = 4096;
    const dcR = Math.exp((-2 * Math.PI * 18) / sr);
    let dcX1 = 0;
    let dcY1 = 0;

    if (kind === 'brown') {
        const pole = Math.exp((-2 * Math.PI * 32) / sr);
        const drive = Math.sqrt(1 - pole * pole);
        let state = 0;
        for (let i = -warmup; i < total; i++) {
            state = pole * state + rand() * drive;
            const y = state - dcX1 + dcR * dcY1;
            dcX1 = state;
            dcY1 = y;
            if (i >= 0) raw[i] = y;
        }
    } else {
        // Paul Kellet refined 7-stage pinking filter (-3 dB/oct)
        let b0 = 0;
        let b1 = 0;
        let b2 = 0;
        let b3 = 0;
        let b4 = 0;
        let b5 = 0;
        let b6 = 0;
        for (let i = -warmup; i < total; i++) {
            const w = rand();
            b0 = 0.99886 * b0 + w * 0.0555179;
            b1 = 0.99332 * b1 + w * 0.0750759;
            b2 = 0.969 * b2 + w * 0.153852;
            b3 = 0.8665 * b3 + w * 0.3104856;
            b4 = 0.55 * b4 + w * 0.5329522;
            b5 = -0.7616 * b5 - w * 0.016898;
            const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362;
            b6 = w * 0.115926;
            const y = pink - dcX1 + dcR * dcY1;
            dcX1 = pink;
            dcY1 = y;
            if (i >= 0) raw[i] = y;
        }
    }

    // Seamless equal-power wrap crossfade: raw[n - 1] flows directly into raw[n] at index 0
    for (let i = 0; i < fade; i++) {
        const theta = (i / fade) * (Math.PI * 0.5);
        dest[i] = raw[i] * Math.sin(theta) + raw[n + i] * Math.cos(theta);
    }
    for (let i = fade; i < n; i++) {
        dest[i] = raw[i];
    }

    // Normalize RMS deterministically and soft-limit any stray outlier peak
    let sumSq = 0;
    for (let i = 0; i < n; i++) sumSq += dest[i] * dest[i];
    const rms = Math.sqrt(sumSq / n) || 1;
    const scale = NOISE_RMS / rms;
    for (let i = 0; i < n; i++) {
        const v = dest[i] * scale;
        dest[i] = v > 0.95 ? 0.95 : v < -0.95 ? -0.95 : v;
    }
}

function buildNoiseBuffer(ctx, seconds, kind, seedBase) {
    const sr = ctx.sampleRate || 44100;
    const len = Math.max(256, Math.round(sr * seconds));
    const buf = ctx.createBuffer(2, len, sr);
    fillNoiseChannel(buf.getChannelData(0), sr, kind, seedBase);
    fillNoiseChannel(buf.getChannelData(1), sr, kind, (seedBase ^ 0x9e3779b9) >>> 0);
    return buf;
}

function rampParam(param, target, now, tau, immediate) {
    if (!param) return;
    if (typeof param.cancelScheduledValues === 'function') {
        param.cancelScheduledValues(now);
    }
    if (immediate) {
        if (typeof param.setValueAtTime === 'function') {
            param.setValueAtTime(target, now);
        }
        param.value = target;
    } else if (typeof param.setTargetAtTime === 'function') {
        param.setTargetAtTime(target, now, Math.max(0.005, tau));
    } else {
        param.value = target;
    }
}

export const Audio = {
    ctx: null,
    music: null,
    master: null,
    limiter: null,
    sfxGain: null,
    ambientGain: null,
    rainNode: null,
    rainGain: null,
    windNode: null,
    windGain: null,

    _rainLP1: null,
    _rainLP2: null,
    _windLP1: null,
    _windLP2: null,
    _windBreathGain: null,
    _windLfo: null,
    _windLfoGain: null,
    _bedsStarted: false,
    _pinkBuf: null,
    _brownBuf: null,
    _bufCtx: null,
    _voices: [],
    _lastSfx: {},
    _stepSide: false,
    _lastBedAt: -Infinity,
    _lastRainAmt: -1,
    _lastWindAmt: -1,
    _lastSfxOn: null,
    _lastMuffled: null,
    _lastRainGain: -1,
    _lastRainCut: -1,
    _lastWindGain: -1,
    _lastWindCut: -1,
    _lastWindLfo: -1,
    _lastSfxBus: -1,
    _lastAmbBus: -1,

    init() {
        this._resetRuntimeState();
        try {
            const AC =
                (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) ||
                globalThis.AudioContext;
            if (!AC) {
                this.ctx = null;
            } else {
                this.ctx = new AC();
                this.master = this.ctx.createGain();
                const masterVol = clamp01(G.settings.volume ?? 0.7);
                this.master.gain.value = masterVol;
                this.master.connect(this.ctx.destination);

                if (typeof this.ctx.createDynamicsCompressor === 'function') {
                    const lim = this.ctx.createDynamicsCompressor();
                    lim.threshold.value = -6;
                    lim.knee.value = 6;
                    lim.ratio.value = 12;
                    lim.attack.value = 0.003;
                    lim.release.value = 0.15;
                    this.limiter = lim;
                    lim.connect(this.master);
                } else {
                    this.limiter = this.master;
                }

                this.sfxGain = this.ctx.createGain();
                this.ambientGain = this.ctx.createGain();
                const sfxOn = G.settings.sfx !== false;
                const sfxVol = sfxOn ? clamp01(G.settings.sfxVolume ?? 1.0) : 0;
                const ambVol = sfxOn ? clamp01(G.settings.ambientVolume ?? 1.0) : 0;
                this.sfxGain.gain.value = sfxVol;
                this.ambientGain.gain.value = ambVol;
                this._lastSfxOn = sfxOn;
                this._lastSfxBus = sfxVol;
                this._lastAmbBus = ambVol;

                this.sfxGain.connect(this.limiter);
                this.ambientGain.connect(this.limiter);

                if (typeof document !== 'undefined' && document.addEventListener) {
                    const onGesture = () => {
                        this.resume();
                        document.removeEventListener('pointerdown', onGesture);
                        document.removeEventListener('keydown', onGesture);
                    };
                    document.addEventListener('pointerdown', onGesture, { passive: true });
                    document.addEventListener('keydown', onGesture, { passive: true });
                }
            }
        } catch (_) {
            this.ctx = null;
        }

        if (G.settings.music) {
            const AudioCtor = (typeof window !== 'undefined' && window.Audio) || globalThis.Audio;
            if (AudioCtor) {
                this.music = new AudioCtor('/SingularityCity.mp3');
                this.music.loop = true;
                this.music.volume = 0.35 * clamp01(G.settings.volume ?? 0.7);
            }
        }
    },

    _resetRuntimeState() {
        this.master = null;
        this.limiter = null;
        this.sfxGain = null;
        this.ambientGain = null;
        this.rainNode = null;
        this.rainGain = null;
        this.windNode = null;
        this.windGain = null;
        this._rainLP1 = null;
        this._rainLP2 = null;
        this._windLP1 = null;
        this._windLP2 = null;
        this._windBreathGain = null;
        this._windLfo = null;
        this._windLfoGain = null;
        this._bedsStarted = false;
        this._voices = [];
        this._lastSfx = {};
        this._lastBedAt = -Infinity;
        this._lastRainAmt = -1;
        this._lastWindAmt = -1;
        this._lastSfxOn = null;
        this._lastMuffled = null;
        this._lastRainGain = -1;
        this._lastRainCut = -1;
        this._lastWindGain = -1;
        this._lastWindCut = -1;
        this._lastWindLfo = -1;
        this._lastSfxBus = -1;
        this._lastAmbBus = -1;
    },

    /** Resume AudioContext + beds/music after a user gesture. Safe to call often. */
    resume() {
        if (this.ctx && this.ctx.state === 'suspended') {
            const p = this.ctx.resume && this.ctx.resume();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        if (this.ctx && !this._bedsStarted) {
            try {
                this._syncBusGains(this.ctx.currentTime === 0);
                this._startBeds();
                this._bedsStarted = true;
            } catch (_) {
                /* ignore */
            }
        }
        if (G.settings.music && this.music) {
            const p = this.music.play && this.music.play();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
    },

    /** Alias for resume() to keep unlock contract intact. */
    unlock() {
        return this.resume();
    },

    setVolume(v) {
        const vol = clamp01(v);
        G.settings.volume = vol;
        if (this.master && this.ctx) {
            const now = this.ctx.currentTime || 0;
            const immediate = this.ctx.state !== 'running' || now === 0;
            rampParam(this.master.gain, vol, now, 0.015, immediate);
        } else if (this.master) {
            this.master.gain.value = vol;
        }
        if (this.music) this.music.volume = 0.35 * vol;
    },

    setSfxEnabled(on) {
        G.settings.sfx = !!on;
        this._syncBusGains(false);
        this._lastBedAt = -Infinity;
    },

    setSfxVolume(v) {
        G.settings.sfxVolume = clamp01(v);
        this._syncBusGains(false);
    },

    setAmbientVolume(v) {
        G.settings.ambientVolume = clamp01(v);
        this._syncBusGains(false);
    },

    _syncBusGains(immediate) {
        if (!this.ctx || !this.sfxGain || !this.ambientGain) return;
        const now = this.ctx.currentTime || 0;
        const sfxOn = G.settings.sfx !== false;
        const sfxTarget = sfxOn ? clamp01(G.settings.sfxVolume ?? 1.0) : 0;
        const ambTarget = sfxOn ? clamp01(G.settings.ambientVolume ?? 1.0) : 0;
        const snap = immediate || this.ctx.state !== 'running' || now === 0;
        const tau = sfxOn ? 0.02 : 0.012;

        if (Math.abs(sfxTarget - this._lastSfxBus) > 0.0005 || sfxOn !== this._lastSfxOn) {
            rampParam(this.sfxGain.gain, sfxTarget, now, tau, snap);
            this._lastSfxBus = sfxTarget;
        }
        if (Math.abs(ambTarget - this._lastAmbBus) > 0.0005 || sfxOn !== this._lastSfxOn) {
            rampParam(this.ambientGain.gain, ambTarget, now, tau, snap);
            this._lastAmbBus = ambTarget;
        }
        if (!sfxOn && this._bedsStarted) {
            if (this.rainGain && this._lastRainGain !== 0) {
                rampParam(this.rainGain.gain, 0, now, 0.012, snap);
                this._lastRainGain = 0;
            }
            if (this.windGain && this._lastWindGain !== 0) {
                rampParam(this.windGain.gain, 0, now, 0.012, snap);
                this._lastWindGain = 0;
            }
            if (this._windLfoGain && this._lastWindLfo !== 0) {
                rampParam(this._windLfoGain.gain, 0, now, 0.012, snap);
                this._lastWindLfo = 0;
            }
        }
        this._lastSfxOn = sfxOn;
    },

    toggleMusic(on) {
        G.settings.music = !!on;
        if (on && !this.music) {
            const AudioCtor = (typeof window !== 'undefined' && window.Audio) || globalThis.Audio;
            if (AudioCtor) {
                this.music = new AudioCtor('/SingularityCity.mp3');
                this.music.loop = true;
                this.music.volume = 0.35 * clamp01(G.settings.volume ?? 0.7);
            }
        }
        if (this.music) {
            if (on) {
                const p = this.music.play && this.music.play();
                if (p && typeof p.catch === 'function') p.catch(() => {});
            } else if (typeof this.music.pause === 'function') {
                this.music.pause();
            }
        }
    },

    _ensureBuffers() {
        if (!this.ctx) return false;
        if (this._bufCtx === this.ctx && this._pinkBuf && this._brownBuf) return true;
        this._pinkBuf = buildNoiseBuffer(this.ctx, BED_BUFFER_SEC, 'pink', 0x51a7c3d1);
        this._brownBuf = buildNoiseBuffer(this.ctx, BED_BUFFER_SEC, 'brown', 0x2b91e4a7);
        this._bufCtx = this.ctx;
        return true;
    },

    // Rain + wind ambient beds (stereo seamless Pink/Brown, dual-stage LP, routed to ambientGain)
    _startBeds() {
        if (!this._ensureBuffers() || !this.ambientGain) return;

        // Rain bed: stereo Pink noise -> HP(120 Hz) -> dual-stage LP (-24 dB/oct) -> rainGain
        this.rainNode = this.ctx.createBufferSource();
        this.rainNode.buffer = this._pinkBuf;
        this.rainNode.loop = true;

        const rainHP = this.ctx.createBiquadFilter();
        rainHP.type = 'highpass';
        rainHP.frequency.value = 120;
        rainHP.Q.value = 0.7;

        const rainLP1 = this.ctx.createBiquadFilter();
        rainLP1.type = 'lowpass';
        rainLP1.frequency.value = 1250;
        rainLP1.Q.value = 0.65;

        const rainLP2 = this.ctx.createBiquadFilter();
        rainLP2.type = 'lowpass';
        rainLP2.frequency.value = 1250;
        rainLP2.Q.value = 0.65;

        this.rainGain = this.ctx.createGain();
        this.rainGain.gain.value = 0;

        this.rainNode.connect(rainHP);
        rainHP.connect(rainLP1);
        rainLP1.connect(rainLP2);
        rainLP2.connect(this.rainGain);
        this.rainGain.connect(this.ambientGain);
        this.rainNode.start(0);

        this._rainLP1 = rainLP1;
        this._rainLP2 = rainLP2;
        this._lastRainGain = 0;
        this._lastRainCut = 1250;

        // Wind bed: stereo Brown noise -> HP(55 Hz) -> dual-stage LP -> breathGain (LFO) -> windGain
        this.windNode = this.ctx.createBufferSource();
        this.windNode.buffer = this._brownBuf;
        this.windNode.loop = true;

        const windHP = this.ctx.createBiquadFilter();
        windHP.type = 'highpass';
        windHP.frequency.value = 55;
        windHP.Q.value = 0.7;

        const windLP1 = this.ctx.createBiquadFilter();
        windLP1.type = 'lowpass';
        windLP1.frequency.value = 220;
        windLP1.Q.value = 0.65;

        const windLP2 = this.ctx.createBiquadFilter();
        windLP2.type = 'lowpass';
        windLP2.frequency.value = 220;
        windLP2.Q.value = 0.65;

        const windBreath = this.ctx.createGain();
        windBreath.gain.value = 1.0;

        this.windGain = this.ctx.createGain();
        this.windGain.gain.value = 0;

        this.windNode.connect(windHP);
        windHP.connect(windLP1);
        windLP1.connect(windLP2);
        windLP2.connect(windBreath);
        windBreath.connect(this.windGain);
        this.windGain.connect(this.ambientGain);
        this.windNode.start(0);

        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.type = 'sine';
        lfo.frequency.value = 0.11;
        lfoGain.gain.value = 0;
        lfo.connect(lfoGain);
        lfoGain.connect(windBreath.gain);
        lfo.start(0);

        this._windLP1 = windLP1;
        this._windLP2 = windLP2;
        this._windBreathGain = windBreath;
        this._windLfo = lfo;
        this._windLfoGain = lfoGain;
        this._lastWindGain = 0;
        this._lastWindCut = 220;
        this._lastWindLfo = 0;
    },

    /**
     * Update rain/wind beds smoothly. Supports both:
     *   setWeatherBeds(stateString, intensity, night) — called by main.js
     *   setWeatherBeds(rainAmt, windAmt)              — numeric 0..1 form
     * Rate-limited (>= 100ms) with cancelScheduledValues + setTargetAtTime (O(1) params).
     */
    setWeatherBeds(stateOrRain, intensityOrWind, night) {
        if (!this.ctx) return;
        if (this.ctx.state === 'suspended') return;
        if (!this._bedsStarted) {
            try {
                this._syncBusGains(this.ctx.currentTime === 0);
                this._startBeds();
                this._bedsStarted = true;
            } catch (_) {
                return;
            }
        }

        const now = this.ctx.currentTime || 0;
        const sfxOn = G.settings.sfx !== false;
        const muffled = Boolean(G.inside || G.ridingMetro);

        let rainAmt = 0;
        let windAmt = 0;
        if (typeof stateOrRain === 'number') {
            rainAmt = clamp01(stateOrRain);
            windAmt = clamp01(typeof intensityOrWind === 'number' ? intensityOrWind : 0);
        } else {
            const state = stateOrRain || 'clear';
            const intensity = clamp01(typeof intensityOrWind === 'number' ? intensityOrWind : 1);
            const nightVal = clamp01(typeof night === 'number' ? night : 0);
            rainAmt = (RAIN_MAP[state] || 0) * intensity;
            const baseWind = WIND_MAP[state] ?? 0;
            const nightBoost =
                state === 'thunderstorm' || state === 'snow' || state === 'rain' ? nightVal * 0.08 : 0;
            windAmt = baseWind > 0 ? clamp01(baseWind * (0.4 + 0.6 * intensity) + nightBoost) : 0;
        }

        const dt = now - this._lastBedAt;
        const muteChanged = sfxOn !== this._lastSfxOn;
        const muffleChanged = muffled !== this._lastMuffled;
        const busVolChanged =
            Math.abs((sfxOn ? clamp01(G.settings.ambientVolume ?? 1.0) : 0) - this._lastAmbBus) > 0.001 ||
            Math.abs((sfxOn ? clamp01(G.settings.sfxVolume ?? 1.0) : 0) - this._lastSfxBus) > 0.001;
        const bigJump =
            this._lastRainAmt < 0 ||
            Math.abs(rainAmt - this._lastRainAmt) > BED_JUMP_THRESH ||
            Math.abs(windAmt - this._lastWindAmt) > BED_JUMP_THRESH;

        if (
            dt >= 0 &&
            dt < BED_MIN_INTERVAL &&
            !muteChanged &&
            !muffleChanged &&
            !bigJump &&
            !busVolChanged
        ) {
            return;
        }

        this._lastBedAt = now;
        this._lastRainAmt = rainAmt;
        this._lastWindAmt = windAmt;
        this._lastMuffled = muffled;

        if (muteChanged || busVolChanged) {
            this._syncBusGains(false);
        }

        const muffleGain = muffled ? 0.28 : 1.0;

        // Rain: velvety dual-LP pink noise (-35 to -30 dBFS max outdoors; silent when rainAmt == 0)
        const rainTarget = sfxOn && rainAmt > 0.002 ? Math.pow(rainAmt, 0.85) * 0.24 * muffleGain : 0;
        const rainCut = muffled ? 450 : 1000 + rainAmt * 650;

        // Wind: deep warm dual-LP brown air (silent on calm clear days, gentle breath when windy outdoors)
        let windTarget = 0;
        if (sfxOn && windAmt > 0.06) {
            const w = (windAmt - 0.06) / 0.94;
            windTarget = Math.pow(w, 1.4) * 0.16 * muffleGain;
        }
        const windCut = muffled ? 180 : 140 + windAmt * 220;
        const windLfoTarget = sfxOn && !muffled && windAmt > 0.16 ? 0.22 * windAmt : 0;

        const gainTau = !sfxOn ? 0.012 : muffleChanged ? 0.1 : 0.25;
        const filtTau = muffleChanged ? 0.1 : 0.22;

        if (this.rainGain && Math.abs(rainTarget - this._lastRainGain) > 0.001) {
            rampParam(this.rainGain.gain, rainTarget, now, gainTau, false);
            this._lastRainGain = rainTarget;
        }
        if (this._rainLP1 && this._rainLP2 && Math.abs(rainCut - this._lastRainCut) > 4) {
            rampParam(this._rainLP1.frequency, rainCut, now, filtTau, false);
            rampParam(this._rainLP2.frequency, rainCut, now, filtTau, false);
            this._lastRainCut = rainCut;
        }
        if (this.windGain && Math.abs(windTarget - this._lastWindGain) > 0.001) {
            rampParam(this.windGain.gain, windTarget, now, gainTau, false);
            this._lastWindGain = windTarget;
        }
        if (this._windLP1 && this._windLP2 && Math.abs(windCut - this._lastWindCut) > 4) {
            rampParam(this._windLP1.frequency, windCut, now, filtTau, false);
            rampParam(this._windLP2.frequency, windCut, now, filtTau, false);
            this._lastWindCut = windCut;
        }
        if (this._windLfoGain && Math.abs(windLfoTarget - this._lastWindLfo) > 0.004) {
            rampParam(this._windLfoGain.gain, windLfoTarget, now, gainTau, false);
            this._lastWindLfo = windLfoTarget;
        }
    },

    _claimVoice(endTime) {
        const now = this.ctx ? this.ctx.currentTime : 0;
        let write = 0;
        for (let i = 0; i < this._voices.length; i++) {
            if (this._voices[i] > now) {
                this._voices[write++] = this._voices[i];
            }
        }
        this._voices.length = write;
        if (this._voices.length >= MAX_VOICES) return false;
        this._voices.push(endTime);
        return true;
    },

    _canTrigger(name, now) {
        const cd = SFX_COOLDOWN[name] ?? 0.06;
        const prev = this._lastSfx[name];
        if (prev != null && now >= prev && now - prev < cd) return false;
        this._lastSfx[name] = now;
        return true;
    },

    _applyEnvelope(gainParam, t0, dur, peak, attack, release, sustainRatio) {
        const atk = Math.max(0.003, Math.min(attack, dur * 0.45));
        const rel = Math.max(0.006, Math.min(release, dur * 0.35));
        const end = t0 + dur;
        const tailStart = Math.max(t0 + atk + 0.002, end - rel);

        gainParam.setValueAtTime(0, t0);
        gainParam.linearRampToValueAtTime(peak, t0 + atk);
        if (tailStart > t0 + atk + 0.002) {
            gainParam.exponentialRampToValueAtTime(Math.max(0.0002, peak * sustainRatio), tailStart);
        }
        gainParam.linearRampToValueAtTime(0, end);
        return end;
    },

    _tone({
        type = 'sine',
        f0,
        f1 = null,
        fMid = null,
        tMid = 0.32,
        t,
        dur,
        peak = 0.16,
        attack = 0.006,
        release = 0.02,
        sustain = 0.04,
        lp = 0,
        lpQ = 0.7,
        hp = 0,
    }) {
        if (!this.ctx || !this.sfxGain || G.settings.sfx === false) return;
        const safeDur = Math.max(0.02, dur);
        if (!this._claimVoice(t + safeDur + 0.01)) return;

        const osc = this.ctx.createOscillator();
        osc.type = type === 'triangle' ? 'triangle' : 'sine';
        osc.frequency.setValueAtTime(Math.max(20, f0), t);
        if (fMid !== null) {
            const midTime = t + safeDur * clamp01(tMid);
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, fMid), midTime);
            if (f1 !== null) {
                osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + safeDur);
            }
        } else if (f1 !== null) {
            osc.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + safeDur);
        }

        let head = osc;
        if (hp > 0) {
            const fHp = this.ctx.createBiquadFilter();
            fHp.type = 'highpass';
            fHp.frequency.value = hp;
            fHp.Q.value = 0.7;
            head.connect(fHp);
            head = fHp;
        }
        if (lp > 0) {
            const fLp = this.ctx.createBiquadFilter();
            fLp.type = 'lowpass';
            fLp.frequency.value = lp;
            fLp.Q.value = lpQ;
            head.connect(fLp);
            head = fLp;
        }

        const g = this.ctx.createGain();
        const end = this._applyEnvelope(g.gain, t, safeDur, peak, attack, release, sustain);
        head.connect(g);
        g.connect(this.sfxGain);

        osc.start(t);
        osc.stop(end + 0.005);
    },

    _noiseBurst({
        kind = 'pink',
        t,
        dur,
        peak = 0.18,
        attack = 0.008,
        release = 0.025,
        sustain = 0.05,
        lp0 = 800,
        lp1 = null,
        lpQ = 0.65,
        dualLp = false,
        hp = 0,
    }) {
        if (!this.ctx || !this.sfxGain || G.settings.sfx === false) return;
        if (!this._ensureBuffers()) return;
        const safeDur = Math.max(0.025, dur);
        if (!this._claimVoice(t + safeDur + 0.01)) return;

        const src = this.ctx.createBufferSource();
        const buf = kind === 'brown' ? this._brownBuf : this._pinkBuf;
        src.buffer = buf;
        src.loop = true;

        let head = src;
        if (hp > 0) {
            const fHp = this.ctx.createBiquadFilter();
            fHp.type = 'highpass';
            fHp.frequency.value = hp;
            fHp.Q.value = 0.7;
            head.connect(fHp);
            head = fHp;
        }

        const lpStages = dualLp ? 2 : 1;
        for (let i = 0; i < lpStages; i++) {
            const fLp = this.ctx.createBiquadFilter();
            fLp.type = 'lowpass';
            fLp.Q.value = lpQ;
            fLp.frequency.setValueAtTime(Math.max(40, lp0), t);
            if (lp1 !== null) {
                fLp.frequency.exponentialRampToValueAtTime(Math.max(40, lp1), t + safeDur);
            }
            head.connect(fLp);
            head = fLp;
        }

        const g = this.ctx.createGain();
        const end = this._applyEnvelope(g.gain, t, safeDur, peak, attack, release, sustain);
        head.connect(g);
        g.connect(this.sfxGain);

        const maxOffset = Math.max(0, BED_BUFFER_SEC - 0.5);
        const offset = Math.random() * maxOffset;
        src.start(t, offset);
        src.stop(end + 0.005);
    },

    sfx(name, opt) {
        if (!this.ctx || G.settings.sfx === false) return;
        if (clamp01(G.settings.sfxVolume ?? 1.0) <= 0) return;
        if (this.ctx.state === 'suspended') {
            const p = this.ctx.resume && this.ctx.resume();
            if (p && typeof p.catch === 'function') p.catch(() => {});
        }
        const t = this.ctx.currentTime || 0;
        if (!this._canTrigger(name, t)) return;

        switch (name) {
            case 'step':
            case 'step_run': {
                const run = name === 'step_run';
                this._stepSide = !this._stepSide;
                const jitter = 0.93 + Math.random() * 0.14;
                const sideMul = this._stepSide ? 1.04 : 0.96;
                const indoor = Boolean(G.inside);
                // Grounded heel thud
                this._tone({
                    type: 'sine',
                    f0: (run ? 132 : 114) * jitter * sideMul,
                    f1: (run ? 54 : 50) * jitter,
                    t,
                    dur: run ? 0.075 : 0.068,
                    peak: run ? 0.24 : 0.2,
                    attack: 0.005,
                    release: 0.02,
                    sustain: 0.04,
                });
                // Organic cached pink-noise shoe scuff (zero buffer allocation)
                this._noiseBurst({
                    kind: 'pink',
                    t: t + 0.004,
                    dur: run ? 0.07 : 0.058,
                    peak: run ? 0.36 : 0.28,
                    attack: 0.006,
                    release: 0.02,
                    sustain: 0.06,
                    hp: 150,
                    lp0: (indoor ? 540 : run ? 760 : 620) * jitter,
                    lp1: (indoor ? 320 : 380) * jitter,
                    dualLp: true,
                });
                break;
            }

            case 'jump': {
                // Soft muted push-off thump + tactile air/cloth whoosh
                this._tone({
                    type: 'sine',
                    f0: 96,
                    f1: 168,
                    t,
                    dur: 0.11,
                    peak: 0.2,
                    attack: 0.007,
                    release: 0.03,
                    sustain: 0.06,
                });
                this._noiseBurst({
                    kind: 'pink',
                    t: t + 0.005,
                    dur: 0.14,
                    peak: 0.32,
                    attack: 0.015,
                    release: 0.045,
                    sustain: 0.08,
                    hp: 160,
                    lp0: 320,
                    lp1: 780,
                    dualLp: true,
                });
                break;
            }

            case 'blip': {
                // Warm tactile glass/marimba ping
                this._tone({
                    type: 'sine',
                    f0: 659.25,
                    f1: 668,
                    t,
                    dur: 0.14,
                    peak: 0.2,
                    attack: 0.004,
                    release: 0.035,
                    sustain: 0.04,
                });
                this._tone({
                    type: 'triangle',
                    f0: 1318.5,
                    t,
                    dur: 0.07,
                    peak: 0.08,
                    attack: 0.004,
                    release: 0.02,
                    sustain: 0.03,
                    lp: 2100,
                });
                break;
            }

            case 'open': {
                // Clean soft UI panel open glide
                this._tone({
                    type: 'sine',
                    f0: 392,
                    f1: 440,
                    t,
                    dur: 0.11,
                    peak: 0.19,
                    attack: 0.006,
                    release: 0.03,
                    sustain: 0.06,
                });
                this._tone({
                    type: 'triangle',
                    f0: 523.25,
                    f1: 587.33,
                    t: t + 0.045,
                    dur: 0.14,
                    peak: 0.21,
                    attack: 0.007,
                    release: 0.04,
                    sustain: 0.05,
                    lp: 1700,
                });
                break;
            }

            case 'close': {
                // Clean soft UI panel close glide
                this._tone({
                    type: 'triangle',
                    f0: 523.25,
                    f1: 392,
                    t,
                    dur: 0.12,
                    peak: 0.18,
                    attack: 0.006,
                    release: 0.035,
                    sustain: 0.05,
                    lp: 1500,
                });
                this._tone({
                    type: 'sine',
                    f0: 261.63,
                    f1: 220,
                    t: t + 0.01,
                    dur: 0.11,
                    peak: 0.1,
                    attack: 0.008,
                    release: 0.03,
                    sustain: 0.05,
                });
                break;
            }

            case 'door_open': {
                // Warm tactile physical doorway open cue
                this._tone({
                    type: 'sine',
                    f0: 175,
                    f1: 88,
                    t,
                    dur: 0.08,
                    peak: 0.21,
                    attack: 0.005,
                    release: 0.025,
                    sustain: 0.05,
                });
                this._noiseBurst({
                    kind: 'pink',
                    t: t + 0.01,
                    dur: 0.18,
                    peak: 0.34,
                    attack: 0.02,
                    release: 0.05,
                    sustain: 0.08,
                    hp: 110,
                    lp0: 460,
                    lp1: 880,
                    dualLp: true,
                });
                this._tone({
                    type: 'sine',
                    f0: 440,
                    f1: 523.25,
                    t: t + 0.03,
                    dur: 0.14,
                    peak: 0.11,
                    attack: 0.008,
                    release: 0.04,
                    sustain: 0.05,
                });
                break;
            }

            case 'door_close': {
                // Warm tactile physical doorway close cue
                this._noiseBurst({
                    kind: 'pink',
                    t,
                    dur: 0.14,
                    peak: 0.28,
                    attack: 0.015,
                    release: 0.04,
                    sustain: 0.08,
                    hp: 100,
                    lp0: 720,
                    lp1: 300,
                    dualLp: true,
                });
                this._tone({
                    type: 'sine',
                    f0: 142,
                    f1: 64,
                    t: t + 0.05,
                    dur: 0.1,
                    peak: 0.24,
                    attack: 0.005,
                    release: 0.03,
                    sustain: 0.04,
                });
                break;
            }

            case 'district': {
                // Warm subtle harmonic chime on entering a new district
                const notes = [523.25, 659.25, 783.99];
                this._tone({
                    type: 'sine',
                    f0: 261.63,
                    t,
                    dur: 0.42,
                    peak: 0.1,
                    attack: 0.02,
                    release: 0.1,
                    sustain: 0.05,
                });
                for (let i = 0; i < notes.length; i++) {
                    this._tone({
                        type: 'triangle',
                        f0: notes[i],
                        t: t + i * 0.065,
                        dur: 0.34,
                        peak: 0.14,
                        attack: 0.01,
                        release: 0.08,
                        sustain: 0.04,
                        lp: 1850,
                    });
                }
                break;
            }

            case 'achieve': {
                // Warm crystalline melodic chime chord
                const notes = [523.25, 659.25, 783.99, 987.77, 1046.5];
                for (let i = 0; i < notes.length; i++) {
                    const last = i === notes.length - 1;
                    this._tone({
                        type: i % 2 === 0 ? 'sine' : 'triangle',
                        f0: notes[i],
                        t: t + i * 0.075,
                        dur: last ? 0.56 : 0.36,
                        peak: last ? 0.17 : 0.14,
                        attack: 0.008,
                        release: last ? 0.14 : 0.08,
                        sustain: 0.04,
                        lp: 2300,
                    });
                }
                break;
            }

            case 'quest': {
                // Warm crystalline quest completion fanfare
                const notes = [392.0, 523.25, 659.25, 783.99, 1046.5];
                for (let i = 0; i < notes.length; i++) {
                    const last = i === notes.length - 1;
                    this._tone({
                        type: 'triangle',
                        f0: notes[i],
                        t: t + i * 0.08,
                        dur: last ? 0.62 : 0.38,
                        peak: last ? 0.18 : 0.14,
                        attack: 0.009,
                        release: last ? 0.15 : 0.09,
                        sustain: 0.04,
                        lp: 2200,
                    });
                }
                this._tone({
                    type: 'sine',
                    f0: 523.25,
                    t: t + 0.32,
                    dur: 0.58,
                    peak: 0.11,
                    attack: 0.018,
                    release: 0.14,
                    sustain: 0.05,
                });
                break;
            }

            case 'chime': {
                // Warm festive sparkling firework chime shimmer (called by news_reactivity.js)
                const scale = typeof opt === 'number' ? 0.78 + 0.22 * clamp01(opt) : 1.0;
                const pool = [783.99, 880.0, 987.77, 1174.66, 1318.51];
                const baseIdx = Math.floor(Math.random() * 3);
                // Soft distant aerial pop
                this._noiseBurst({
                    kind: 'pink',
                    t,
                    dur: 0.15,
                    peak: 0.26 * scale,
                    attack: 0.006,
                    release: 0.045,
                    sustain: 0.06,
                    hp: 140,
                    lp0: 560,
                    lp1: 240,
                    dualLp: true,
                });
                // Sparkling warm bell triad
                for (let i = 0; i < 3; i++) {
                    const freq = pool[baseIdx + i];
                    this._tone({
                        type: i === 1 ? 'triangle' : 'sine',
                        f0: freq,
                        t: t + 0.015 + i * 0.048,
                        dur: 0.42 + i * 0.06,
                        peak: (0.165 - i * 0.015) * scale,
                        attack: 0.006,
                        release: 0.11,
                        sustain: 0.035,
                        lp: 2600,
                    });
                }
                break;
            }

            case 'thunder': {
                // Deep cinematic multi-stage brown/pink thunder roll + warm sub boom
                const delay =
                    typeof opt === 'number' && Number.isFinite(opt)
                        ? Math.max(0, Math.min(3, opt))
                        : 0.05;
                const t0 = t + delay;
                const muffle = G.inside || G.ridingMetro ? 0.45 : 1.0;

                // Sub boom
                this._tone({
                    type: 'sine',
                    f0: 66,
                    f1: 34,
                    t: t0,
                    dur: 1.0,
                    peak: 0.26 * muffle,
                    attack: 0.025,
                    release: 0.28,
                    sustain: 0.06,
                });
                // Main deep brown thunder body
                this._noiseBurst({
                    kind: 'brown',
                    t: t0,
                    dur: 1.85,
                    peak: 0.72 * muffle,
                    attack: 0.02,
                    release: 0.45,
                    sustain: 0.08,
                    hp: 32,
                    lp0: muffle < 1 ? 180 : 280,
                    lp1: 95,
                    dualLp: true,
                });
                // Rolling atmospheric tail
                this._noiseBurst({
                    kind: 'pink',
                    t: t0 + 0.18,
                    dur: 2.2,
                    peak: 0.48 * muffle,
                    attack: 0.14,
                    release: 0.55,
                    sustain: 0.08,
                    hp: 40,
                    lp0: muffle < 1 ? 160 : 240,
                    lp1: 85,
                    dualLp: true,
                });
                break;
            }

            case 'rocket': {
                // Distant warm deep ignition rumble (zero sawtooth)
                this._noiseBurst({
                    kind: 'brown',
                    t,
                    dur: 3.2,
                    peak: 0.68,
                    attack: 0.24,
                    release: 0.75,
                    sustain: 0.12,
                    hp: 35,
                    lp0: 290,
                    lp1: 120,
                    dualLp: true,
                });
                this._noiseBurst({
                    kind: 'pink',
                    t: t + 0.12,
                    dur: 2.8,
                    peak: 0.4,
                    attack: 0.3,
                    release: 0.65,
                    sustain: 0.1,
                    hp: 75,
                    lp0: 420,
                    lp1: 180,
                    dualLp: true,
                });
                this._tone({
                    type: 'sine',
                    f0: 58,
                    f1: 35,
                    t: t + 0.05,
                    dur: 2.7,
                    peak: 0.2,
                    attack: 0.28,
                    release: 0.6,
                    sustain: 0.08,
                });
                break;
            }

            case 'meow': {
                // Cute warm stylized cat chirp/trill (warm formant triangle + sine, zero sawtooth)
                this._tone({
                    type: 'sine',
                    f0: 530,
                    fMid: 810,
                    f1: 470,
                    tMid: 0.3,
                    t,
                    dur: 0.34,
                    peak: 0.19,
                    attack: 0.018,
                    release: 0.08,
                    sustain: 0.08,
                });
                this._tone({
                    type: 'triangle',
                    f0: 534,
                    fMid: 818,
                    f1: 474,
                    tMid: 0.32,
                    t: t + 0.008,
                    dur: 0.32,
                    peak: 0.15,
                    attack: 0.02,
                    release: 0.08,
                    sustain: 0.07,
                    lp: 1450,
                    lpQ: 2.2,
                });
                this._tone({
                    type: 'sine',
                    f0: 1060,
                    fMid: 1560,
                    f1: 940,
                    tMid: 0.28,
                    t: t + 0.012,
                    dur: 0.22,
                    peak: 0.055,
                    attack: 0.02,
                    release: 0.06,
                    sustain: 0.05,
                    lp: 2000,
                });
                break;
            }

            case 'splash': {
                // Warm low-pass filtered water splash + bubble plunge
                this._tone({
                    type: 'sine',
                    f0: 185,
                    f1: 420,
                    t,
                    dur: 0.11,
                    peak: 0.18,
                    attack: 0.008,
                    release: 0.03,
                    sustain: 0.05,
                });
                this._noiseBurst({
                    kind: 'pink',
                    t: t + 0.006,
                    dur: 0.38,
                    peak: 0.54,
                    attack: 0.012,
                    release: 0.1,
                    sustain: 0.07,
                    hp: 180,
                    lp0: 1300,
                    lp1: 520,
                    dualLp: true,
                });
                this._tone({
                    type: 'sine',
                    f0: 560,
                    f1: 740,
                    t: t + 0.07,
                    dur: 0.12,
                    peak: 0.09,
                    attack: 0.008,
                    release: 0.035,
                    sustain: 0.04,
                });
                break;
            }
        }
    },
};
