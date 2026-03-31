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
            // Low, distant city rumble
            createDrone(55, 'sine', 0.15, 0.1);
        } 
        else if (env === 'estate') {
            // Warm, rich, acoustic chords (Billionaire luxury)
            createDrone(130.81, 'triangle', 0.10, 0.05); // C3
            createDrone(164.81, 'sine', 0.08, 0.03);     // E3
            createDrone(196.00, 'sine', 0.08, 0.04);     // G3
        } 
        else if (env === 'ai_housing') {
            // Sterile, highly precise digital tones
            createDrone(120, 'square', 0.015, 0.5);
            createDrone(240, 'sine', 0.03, 0.2);
        } 
        else if (env === 'hq') {
            // Commercial Server farm hum
            createDrone(60, 'sawtooth', 0.03, 0); 
            createDrone(120, 'sine', 0.06, 0);
            
            // Inject random background server "chirps"
            this.ambientInterval = setInterval(() => {
                if (this._sfxEnabled && Math.random() < 0.3) {
                    this.playTone(1500 + Math.random()*1500, 'square', 0.05, 0.005);
                }
            }, 800);
        } 
        else if (env === 'metro') {
            // Deep, oppressive subterranean rumble
            createDrone(40, 'sine', 0.25, 2.0);
            createDrone(80, 'triangle', 0.08, 0.5);
        }
        else if (env === 'holomap') {
            // Deep-space ambient: low ethereal drone + slow shimmer
            createDrone(45, 'sine', 0.12, 0.03);       // subspace rumble
            createDrone(90, 'triangle', 0.04, 0.07);    // harmonic shimmer
            createDrone(135, 'sine', 0.025, 0.02);      // distant chord

            // Random cosmic pings (like distant pulsars)
            this.ambientInterval = setInterval(() => {
                if (this._sfxEnabled && Math.random() < 0.2) {
                    var f = 800 + Math.random() * 2000;
                    this.playTone(f, 'sine', 0.15, 0.008, f * 0.5);
                }
            }, 1500);
        }
    }
};
