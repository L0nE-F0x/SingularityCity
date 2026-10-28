/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUND & AUDIO LAYER (v17.0.0 - Procedural Ambiance & Soundtrack Engine)
   The ambient bed lives in js/soundscape.js; this file owns the context, the music, SFX and modes.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SND = {
    ctx: null,
    masterGain: null,
    ambientGain: null,
    sfxGain: null,
    musicEl: null,

    _sfxEnabled: true,
    _musicEnabled: true,
    _sfxMutedByContext: false, // Terminal mode mutes SFX/ambient without touching user pref

    currentAmbient: null,
    ambientInterval: null,

    _sfxAudible() {
        return this._sfxEnabled && !this._sfxMutedByContext;
    },

    // Getters/Setters to maintain compatibility with engine.js save states
    get enabled() {
        return this._sfxEnabled;
    },
    set enabled(v) {
        this._sfxEnabled = v;
        this._applySfxGain();
    },

    _applySfxGain() {
        if (!this.ctx) return;
        const audible = this._sfxAudible();
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(audible ? 0.6 : 0, this.ctx.currentTime, 0.1);
        }
        if (this.ambientGain) {
            this.ambientGain.gain.setTargetAtTime(audible ? 0.4 : 0, this.ctx.currentTime, 0.5);
        }
    },

    setContextMute(muted) {
        this._sfxMutedByContext = !!muted;
        this._applySfxGain();
    },

    get musicEnabled() {
        return this._musicEnabled;
    },
    set musicEnabled(v) {
        this._musicEnabled = v;
        if (this.musicEl) {
            if (v && this.ctx && this.ctx.state === 'running') {
                this.musicEl.play().catch(() => {});
            } else {
                this.musicEl.pause();
            }
        }
        localStorage.setItem('sc_music', v);
    },

    init() {
        if (this.ctx) return;

        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        this.ctx = new AudioContext();

        this.masterGain = this.ctx.createGain();
        this.masterGain.connect(this.ctx.destination);

        this.sfxGain = this.ctx.createGain();
        this.sfxGain.connect(this.masterGain);
        this.sfxGain.gain.value = this._sfxAudible() ? 0.6 : 0;

        this.ambientGain = this.ctx.createGain();
        this.ambientGain.connect(this.masterGain);
        this.ambientGain.gain.value = this._sfxAudible() ? 0.4 : 0;

        // Initialize Background Music
        this.musicEl = new Audio('SingularityCity.mp3?v=362');
        this.musicEl.loop = true;
        this.musicEl.volume = 0.35;

        const savedMusic = localStorage.getItem('sc_music');
        if (savedMusic !== null) this._musicEnabled = savedMusic === 'true';

        // Procedural ambient bed (js/soundscape.js) plays through ambientGain.
        if (typeof Soundscape !== 'undefined') Soundscape.init(this);

        // Browsers block autoplay. This unlocks audio context and plays music on the first
        // user gesture — a click, a tap, a drag or a key.
        const gestures = ['click', 'touchstart', 'pointerdown', 'keydown'];
        const unlock = () => {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            if (this._musicEnabled) this.musicEl.play().catch(() => {});
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
    },

    toggleMusic() {
        this.musicEnabled = !this.musicEnabled;
    },

    // Procedural Synthesizer
    playTone(freq, type = 'sine', duration = 0.1, vol = 0.1, slideFreq = null) {
        if (!this.ctx || !this._sfxEnabled || this.ctx.state !== 'running') return;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc.type = type;
        osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

        if (slideFreq) {
            osc.frequency.exponentialRampToValueAtTime(slideFreq, this.ctx.currentTime + duration);
        }

        gain.gain.setValueAtTime(0, this.ctx.currentTime);
        gain.gain.linearRampToValueAtTime(vol, this.ctx.currentTime + duration * 0.1);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);

        osc.connect(gain);
        gain.connect(this.sfxGain);

        osc.start();
        osc.stop(this.ctx.currentTime + duration);
    },

    // Dynamic Sound Effects
    uiClick() {
        this.playTone(800, 'sine', 0.05, 0.05);
        setTimeout(() => this.playTone(1200, 'sine', 0.05, 0.04), 40);
    },
    scan() {
        this.playTone(400, 'triangle', 0.2, 0.05, 800);
        setTimeout(() => this.playTone(600, 'sine', 0.4, 0.05, 200), 150);
    },
    birth() {
        this.playTone(440, 'sine', 0.1, 0.1, 880);
        setTimeout(() => this.playTone(554, 'sine', 0.1, 0.1, 1108), 100);
        setTimeout(() => this.playTone(659, 'sine', 0.4, 0.1, 1318), 200);
    },
    retire() {
        this.playTone(400, 'triangle', 0.4, 0.1, 100);
        setTimeout(() => this.playTone(300, 'square', 0.4, 0.05, 50), 200);
    },
    achieve() {
        [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.3, 0.05), i * 100);
        });
    },
    launch() {
        this.playTone(220, 'sawtooth', 1.0, 0.1, 880);
        setTimeout(() => this.playTone(277.18, 'square', 1.0, 0.1, 1108), 100);
    },

    // Rolling thunder for each lightning bolt (Environment calls this after the flash).
    thunder() {
        if (typeof Soundscape !== 'undefined' && Soundscape.ctx) {
            Soundscape.thunder();
            return;
        }
        this.playTone(90, 'sawtooth', 0.8, 0.06, 45);
        setTimeout(() => this.playTone(60, 'triangle', 1.1, 0.04, 30), 200);
    },

    // Ambient environments. The continuous bed — streets, weather, rooms, trains, Orbit, the
    // Holomap — comes from Soundscape (js/soundscape.js), which reads the camera and the game
    // state itself. Rooms keep their own small interval sounds on top of it.
    setAmbient(bldId) {
        if (!this.ctx) return;
        if (this.currentAmbient === bldId) return;
        this.currentAmbient = bldId;

        if (this.ambientInterval) {
            clearInterval(this.ambientInterval);
            this.ambientInterval = null;
        }

        let env = 'outside';
        if (bldId === 'holomap' || bldId === 'orbit' || bldId === 'train') env = bldId;
        else if (!bldId || bldId === 'outside' || bldId.startsWith('zone_')) env = 'outside';
        else if (bldId.startsWith('house_')) env = 'estate';
        else if (bldId.startsWith('res_')) env = 'ai_housing';
        else if (bldId.startsWith('metro_')) env = 'metro';
        // Bars, cafés and arenas get their murmur and music from Soundscape, not office typing.
        else if (/^(cafe|neon_bar|arena|gym|black_market|convention_center)$/.test(bldId)) env = 'venue';
        else env = 'hq';

        if (env === 'estate') {
            // Luxury lounge — slow gentle arpeggio (like a music box)
            let noteIdx = 0;
            const chordNotes = [261.6, 329.6, 392.0, 493.9, 523.3, 493.9, 392.0, 329.6];
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const freq = chordNotes[noteIdx % chordNotes.length];
                this.playTone(freq, 'sine', 0.25, 0.008);
                setTimeout(() => this.playTone(freq * 2, 'sine', 0.15, 0.004), 150);
                noteIdx++;
            }, 2800);
        } else if (env === 'ai_housing') {
            // Cozy apartment — gentle clock tick + occasional settling creak
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.4) {
                    this.playTone(2200, 'sine', 0.015, 0.004);
                } else if (Math.random() < 0.08) {
                    this.playTone(80 + Math.random() * 40, 'triangle', 0.2, 0.006);
                }
            }, 1200);
        } else if (env === 'hq') {
            // HQ — soft rhythmic typing + occasional notification ping
            let typeBeat = 0;
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                typeBeat++;
                if (typeBeat % 3 === 0 && Math.random() < 0.3) {
                    this.playTone(4000 + Math.random() * 2000, 'sine', 0.008, 0.003);
                }
                if (typeBeat % 12 === 0 && Math.random() < 0.2) {
                    this.playTone(880, 'sine', 0.08, 0.006);
                    setTimeout(() => this.playTone(1109, 'sine', 0.06, 0.005), 80);
                }
                if (typeBeat % 20 === 0 && Math.random() < 0.15) {
                    this.playTone(1200, 'sine', 0.06, 0.004, 800);
                }
            }, 400);
        } else if (env === 'metro') {
            // Underground station — periodic distant train + PA chime
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.1) {
                    this.playTone(80, 'sawtooth', 0.5, 0.008, 120);
                    setTimeout(() => this.playTone(120, 'sawtooth', 0.4, 0.006, 60), 300);
                } else if (Math.random() < 0.06) {
                    this.playTone(659, 'sine', 0.12, 0.008);
                    setTimeout(() => this.playTone(523, 'sine', 0.12, 0.008), 200);
                }
            }, 2500);
        } else if (env === 'holomap') {
            // Deep-space — cosmic pings over the Soundscape pad
            this.ambientInterval = setInterval(() => {
                if (this._sfxEnabled && Math.random() < 0.2) {
                    const cosmicNotes = [440, 523, 659, 784, 880, 1047, 1319];
                    var f = cosmicNotes[Math.floor(Math.random() * cosmicNotes.length)];
                    this.playTone(f, 'sine', 0.2, 0.006, f * 0.5);
                }
            }, 2000);
        }
    },

    // Dev: what the audio layer is doing right now (see Soundscape.debugState / meter).
    debugState() {
        return {
            ctx: this.ctx ? this.ctx.state : 'none',
            sfx: this._sfxEnabled,
            music: this._musicEnabled,
            contextMute: this._sfxMutedByContext,
            ambient: this.currentAmbient,
            soundscape: typeof Soundscape !== 'undefined' && Soundscape.ctx ? Soundscape.debugState() : null,
        };
    },
};
