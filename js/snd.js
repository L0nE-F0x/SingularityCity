/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SOUND & AUDIO LAYER (v16.0.0 - Procedural Ambiance & Soundtrack Engine)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SND = {
    ctx: null,
    masterGain: null,
    ambientGain: null,
    sfxGain: null,
    musicEl: null,
    
    _sfxEnabled: true,
    _musicEnabled: true,
    
    currentAmbient: null,
    ambientNodes: [],
    ambientInterval: null,

    // Getters/Setters to maintain compatibility with engine.js save states
    get enabled() { return this._sfxEnabled; },
    set enabled(v) { 
        this._sfxEnabled = v; 
        if (this.sfxGain) {
            this.sfxGain.gain.setTargetAtTime(v ? 0.6 : 0, this.ctx.currentTime, 0.1);
        }
        if (this.ambientGain) {
            this.ambientGain.gain.setTargetAtTime(v ? 0.4 : 0, this.ctx.currentTime, 0.5);
        }
    },

    get musicEnabled() { return this._musicEnabled; },
    set musicEnabled(v) {
        this._musicEnabled = v;
        if (this.musicEl) {
            if (v && this.ctx && this.ctx.state === 'running') {
                this.musicEl.play().catch(()=>{});
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
        this.sfxGain.gain.value = this._sfxEnabled ? 0.6 : 0;
        
        this.ambientGain = this.ctx.createGain();
        this.ambientGain.connect(this.masterGain);
        this.ambientGain.gain.value = this._sfxEnabled ? 0.4 : 0;

        // Initialize Background Music
        this.musicEl = new Audio('SingularityCity.mp3');
        this.musicEl.loop = true;
        this.musicEl.volume = 0.35; 
        
        const savedMusic = localStorage.getItem('sc_music');
        if (savedMusic !== null) this._musicEnabled = savedMusic === 'true';

        // Browsers block autoplay. This unlocks audio context and plays music on the first user click.
        const unlock = () => {
            if (this.ctx.state === 'suspended') this.ctx.resume();
            if (this._musicEnabled) this.musicEl.play().catch(()=>{});
            document.removeEventListener('click', unlock);
            document.removeEventListener('touchstart', unlock);
        };
        document.addEventListener('click', unlock);
        document.addEventListener('touchstart', unlock);
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
        [523.25, 659.25, 783.99, 1046.50].forEach((f, i) => {
            setTimeout(() => this.playTone(f, 'square', 0.3, 0.05), i * 100);
        });
    },
    launch() {
        this.playTone(220, 'sawtooth', 1.0, 0.1, 880);
        setTimeout(() => this.playTone(277.18, 'square', 1.0, 0.1, 1108), 100);
    },

    // Procedural Ambient Environments
    setAmbient(bldId) {
        if (!this.ctx) return;
        if (this.currentAmbient === bldId) return;
        this.currentAmbient = bldId;

        const now = this.ctx.currentTime;
        
        // 1. Smoothly fade out old ambient environment
        this.ambientNodes.forEach(n => {
            n.gain.gain.cancelScheduledValues(now);
            n.gain.gain.linearRampToValueAtTime(0, now + 1.0);
            n.osc.stop(now + 1.0);
        });
        this.ambientNodes = [];
        if (this.ambientInterval) { 
            clearInterval(this.ambientInterval); 
            this.ambientInterval = null; 
        }

        // 2. Identify the new environment type
        let env = 'outside';
        if (bldId === 'holomap') env = 'holomap';
        else if (bldId && bldId.startsWith('house_')) env = 'estate';
        else if (bldId && bldId.startsWith('res_')) env = 'ai_housing';
        else if (bldId && bldId.startsWith('metro_')) env = 'metro';
        else if (bldId && bldId !== 'outside') env = 'hq';

        // Helper to spawn continuous ambient drones
        const createDrone = (freq, type, vol, lfoRate) => {
            const osc = this.ctx.createOscillator();
            const gain = this.ctx.createGain();
            const filter = this.ctx.createBiquadFilter();
            
            osc.type = type;
            osc.frequency.value = freq;
            
            filter.type = 'lowpass';
            filter.frequency.value = freq * 3; // Take the edge off

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(vol, now + 2.0); // 2 second crossfade
            
            if (lfoRate) {
                const lfo = this.ctx.createOscillator();
                const lfoGain = this.ctx.createGain();
                lfo.type = 'sine';
                lfo.frequency.value = lfoRate;
                lfoGain.gain.value = vol * 0.3; // 30% modulation depth
                lfo.connect(lfoGain);
                lfoGain.connect(gain.gain);
                lfo.start();
                this.ambientNodes.push({ osc: lfo, gain: lfoGain }); 
            }

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(this.ambientGain);
            osc.start();
            this.ambientNodes.push({ osc, gain });
        };

        // 3. Build the soundscape based on location
        if (env === 'outside') {
            // Warm city evening — soft low pad, occasional distant life
            createDrone(55, 'sine', 0.06, 0.05);        // gentle city hum
            createDrone(82.5, 'sine', 0.025, 0.03);     // fifth harmonic warmth
            
            // Occasional soft wind gust + distant chime
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const r = Math.random();
                if (r < 0.08) {
                    // Distant wind chime — pentatonic note
                    const notes = [523, 587, 659, 784, 880];
                    this.playTone(notes[Math.floor(Math.random()*5)], 'sine', 0.3, 0.006, null);
                } else if (r < 0.12) {
                    // Soft distant horn/hum
                    this.playTone(220 + Math.random()*40, 'triangle', 0.4, 0.004);
                }
            }, 3000);
        } 
        else if (env === 'estate') {
            // Luxury lounge — warm evolving pad, soft arpeggiated notes
            createDrone(65.41, 'sine', 0.04, 0.02);     // C2 — barely audible foundation
            createDrone(98.00, 'sine', 0.025, 0.015);    // G2 — perfect fifth warmth
            
            // Slow gentle arpeggio cycling through Cmaj7 (like a music box)
            let noteIdx = 0;
            const chordNotes = [261.6, 329.6, 392.0, 493.9, 523.3, 493.9, 392.0, 329.6]; // C4 E4 G4 B4 C5 (up and back)
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                const freq = chordNotes[noteIdx % chordNotes.length];
                this.playTone(freq, 'sine', 0.25, 0.008);
                // Soft octave echo
                setTimeout(() => this.playTone(freq * 2, 'sine', 0.15, 0.004), 150);
                noteIdx++;
            }, 2800);
        } 
        else if (env === 'ai_housing') {
            // Cozy apartment — quiet warmth, soft ticking presence
            createDrone(55, 'sine', 0.03, 0.02);         // room tone
            createDrone(110, 'triangle', 0.01, 0.01);     // subtle harmonic
            
            // Gentle clock tick + occasional settling creak
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.4) {
                    // Soft clock tick
                    this.playTone(2200, 'sine', 0.015, 0.004);
                } else if (Math.random() < 0.08) {
                    // House settle — low creak
                    this.playTone(80 + Math.random()*40, 'triangle', 0.2, 0.006);
                }
            }, 1200);
        } 
        else if (env === 'hq') {
            // Data center — clean low hum, rhythmic soft keypresses, gentle notification pings
            createDrone(60, 'sine', 0.04, 0);             // steady 60Hz hum
            createDrone(120, 'sine', 0.015, 0);            // second harmonic
            
            // Soft rhythmic typing + occasional pleasant ping
            let typeBeat = 0;
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                typeBeat++;
                if (typeBeat % 3 === 0 && Math.random() < 0.3) {
                    // Soft keyboard click (high-pass filtered tick)
                    this.playTone(4000 + Math.random()*2000, 'sine', 0.008, 0.003);
                }
                if (typeBeat % 12 === 0 && Math.random() < 0.2) {
                    // Pleasant notification — major third interval
                    this.playTone(880, 'sine', 0.08, 0.006);
                    setTimeout(() => this.playTone(1109, 'sine', 0.06, 0.005), 80);
                }
                if (typeBeat % 20 === 0 && Math.random() < 0.15) {
                    // Soft data chirp — descending
                    this.playTone(1200, 'sine', 0.06, 0.004, 800);
                }
            }, 400);
        } 
        else if (env === 'metro') {
            // Underground station — deep rumble, periodic distant train
            createDrone(40, 'sine', 0.08, 0.03);           // tunnel resonance
            createDrone(60, 'triangle', 0.03, 0.02);        // structural hum
            
            // Periodic distant train + PA chime
            this.ambientInterval = setInterval(() => {
                if (!this._sfxEnabled) return;
                if (Math.random() < 0.1) {
                    // Distant train pass — rising then falling
                    this.playTone(80, 'sawtooth', 0.5, 0.008, 120);
                    setTimeout(() => this.playTone(120, 'sawtooth', 0.4, 0.006, 60), 300);
                } else if (Math.random() < 0.06) {
                    // PA system chime — two-tone
                    this.playTone(659, 'sine', 0.12, 0.008);
                    setTimeout(() => this.playTone(523, 'sine', 0.12, 0.008), 200);
                }
            }, 2500);
        }
        else if (env === 'holomap') {
            // Deep-space ambient — ethereal drone + cosmic pings
            createDrone(45, 'sine', 0.08, 0.03);          // subspace rumble
            createDrone(90, 'triangle', 0.03, 0.05);       // harmonic shimmer
            createDrone(135, 'sine', 0.02, 0.02);          // distant chord

            // Cosmic pings — pentatonic, gentle
            this.ambientInterval = setInterval(() => {
                if (this._sfxEnabled && Math.random() < 0.2) {
                    const cosmicNotes = [440, 523, 659, 784, 880, 1047, 1319];
                    var f = cosmicNotes[Math.floor(Math.random() * cosmicNotes.length)];
                    this.playTone(f, 'sine', 0.2, 0.006, f * 0.5);
                }
            }, 2000);
        }
    }
};
