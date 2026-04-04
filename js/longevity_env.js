/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH ENVIRONMENT (v1.0.0 — DNA Helixes, Molecule Bubbles, Cryo Vapor)
   Visual effects and ambient animations for the Longevity Research Wing.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const LongevityEnv = {
    _built: false,
    dnaParticles: [],     // Double-helix DNA strand particles
    molecules: [],        // Floating molecule bubbles near discovery lab
    heartbeats: [],       // Pulse indicators on clinical trials building
    cryoVapor: [],        // Cold vapor drifting from cryonics vault
    sequencerLEDs: [],    // Sequencing status lights on genomics building

    buildAnimations(charLayer) {
        if (this._built || typeof LongevityZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        const discovery = BLDS.find(b => b.id === 'longevity_discovery');
        const trials = BLDS.find(b => b.id === 'longevity_trials');
        const genomics = BLDS.find(b => b.id === 'longevity_genomics');
        const cryo = BLDS.find(b => b.id === 'longevity_cryo');

        // ─── DNA DOUBLE HELIX between Discovery Lab and Trials ───
        if (discovery && trials) {
            const helixCenterX = discovery.x + discovery.w + (trials.x - discovery.x - discovery.w) / 2;
            for (let i = 0; i < 24; i++) {
                const p = new PIXI.Graphics();
                const strand = i % 2; // 0 = left strand, 1 = right strand
                const col = strand === 0 ? 0x22c55e : 0x06b6d4;
                p.beginFill(col, 0.8);
                p.drawCircle(0, 0, 1.2 + Math.random() * 0.8);
                p.endFill();
                p._phase = (i / 24) * Math.PI * 4;
                p._strand = strand;
                p._centerX = helixCenterX;
                p._baseY = gy - 80 + (i / 24) * 60;
                p._amplitude = 12;
                p.x = helixCenterX;
                p.y = p._baseY;
                charLayer.addChild(p);
                this.dnaParticles.push(p);
            }
        }

        // ─── MOLECULE BUBBLES floating up from Discovery Lab ───
        if (discovery) {
            for (let i = 0; i < 10; i++) {
                const m = new PIXI.Graphics();
                const col = [0x22c55e, 0x3b82f6, 0x8b5cf6, 0xec4899][Math.floor(Math.random() * 4)];
                m.lineStyle(1, col, 0.6);
                const rad = 2 + Math.random() * 3;
                m.drawCircle(0, 0, rad);
                // Hexagonal bond hint
                if (Math.random() > 0.5) {
                    m.moveTo(-rad * 0.5, -rad * 0.3);
                    m.lineTo(rad * 0.5, -rad * 0.3);
                }
                m.x = discovery.x + 20 + Math.random() * (discovery.w - 40);
                m.y = gy - 10 - Math.random() * 60;
                m._vy = -0.15 - Math.random() * 0.25;
                m._vx = (Math.random() - 0.5) * 0.3;
                m._life = 100 + Math.random() * 80;
                m._maxLife = m._life;
                m._originX = m.x;
                m._originY = gy - 10 - Math.random() * 20;
                charLayer.addChild(m);
                this.molecules.push(m);
            }
        }

        // ─── HEARTBEAT PULSES on Clinical Trials building ───
        if (trials) {
            const bldH = trials.fl * 18 + 24;
            for (let i = 0; i < 6; i++) {
                const pulse = new PIXI.Graphics();
                pulse.beginFill(0xef4444, 0.7);
                pulse.drawCircle(0, 0, 1.5);
                pulse.endFill();
                pulse.x = trials.x + 15 + i * ((trials.w - 30) / 5);
                pulse.y = gy - bldH + 20 + Math.random() * (bldH - 40);
                pulse._phase = Math.random() * 120;
                pulse._beatRate = 60 + Math.random() * 30; // heartbeat rhythm
                charLayer.addChild(pulse);
                this.heartbeats.push(pulse);
            }
        }

        // ─── SEQUENCER LEDs on Genomics building (A/T/C/G colors) ───
        if (genomics) {
            const bldH = genomics.fl * 18 + 24;
            const baseColors = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444]; // A=green T=blue C=yellow G=red
            for (let i = 0; i < 16; i++) {
                const led = new PIXI.Graphics();
                const col = baseColors[i % 4];
                led.beginFill(col, 0.8);
                led.drawRect(0, 0, 2, 3);
                led.endFill();
                led.x = genomics.x + 10 + (i % 8) * ((genomics.w - 20) / 8);
                led.y = gy - bldH + 15 + Math.floor(i / 8) * 20;
                led._phase = i * 15;
                led._rate = 8 + Math.random() * 12; // rapid sequencer tick
                charLayer.addChild(led);
                this.sequencerLEDs.push(led);
            }
        }

        // ─── CRYO VAPOR from Cryonics Vault ───
        if (cryo) {
            for (let i = 0; i < 8; i++) {
                const v = new PIXI.Graphics();
                v.beginFill(0x93c5fd, 0.25);
                v.drawCircle(0, 0, 2 + Math.random() * 4);
                v.endFill();
                v.x = cryo.x + 10 + Math.random() * (cryo.w - 20);
                v.y = gy - 3 - Math.random() * 10;
                v._vy = -0.08 - Math.random() * 0.15;
                v._vx = (Math.random() - 0.5) * 0.4;
                v._life = 120 + Math.random() * 80;
                v._maxLife = v._life;
                v._originX = v.x;
                v._originY = v.y;
                v._sway = Math.random() * Math.PI * 2;
                charLayer.addChild(v);
                this.cryoVapor.push(v);
            }
        }
    },

    update() {
        if (!this._built) return;
        const fc = G.tick;

        // ─── DNA HELIX: rotate in 3D-projected double helix ───
        this.dnaParticles.forEach(p => {
            if (!p || p.destroyed) return;
            p._phase += 0.03;
            const offset = p._strand === 0 ? 0 : Math.PI;
            p.x = p._centerX + Math.sin(p._phase + offset) * p._amplitude;
            // Depth simulation: scale and alpha based on cos
            const depth = Math.cos(p._phase + offset);
            p.alpha = 0.4 + depth * 0.4;
            p.scale.set(0.6 + depth * 0.4);
        });

        // ─── MOLECULES: float up, fade, respawn ───
        this.molecules.forEach(m => {
            if (!m || m.destroyed) return;
            m.x += m._vx;
            m.y += m._vy;
            m._life--;
            m.alpha = Math.max(0, (m._life / m._maxLife) * 0.6);
            if (m._life <= 0) {
                m.x = m._originX + (Math.random() - 0.5) * 30;
                m.y = m._originY;
                m._life = m._maxLife;
                m._vx = (Math.random() - 0.5) * 0.3;
                m._vy = -0.15 - Math.random() * 0.25;
                m.alpha = 0.6;
            }
        });

        // ─── HEARTBEATS: rhythmic pulse (expand + fade) ───
        this.heartbeats.forEach(pulse => {
            if (!pulse || pulse.destroyed) return;
            const beat = (fc + pulse._phase) % pulse._beatRate;
            const t = beat / pulse._beatRate;
            // Double-beat pattern: two spikes per cycle
            const spike1 = t < 0.1 ? Math.sin(t / 0.1 * Math.PI) : 0;
            const spike2 = (t > 0.15 && t < 0.25) ? Math.sin((t - 0.15) / 0.1 * Math.PI) * 0.6 : 0;
            const intensity = Math.max(spike1, spike2);
            pulse.scale.set(1 + intensity * 1.5);
            pulse.alpha = 0.3 + intensity * 0.7;
        });

        // ─── SEQUENCER LEDs: rapid cascade pattern ───
        this.sequencerLEDs.forEach(led => {
            if (!led || led.destroyed) return;
            led.visible = ((fc + led._phase) % led._rate) < led._rate * 0.5;
        });

        // ─── CRYO VAPOR: slow rise with sway, fade, respawn ───
        this.cryoVapor.forEach(v => {
            if (!v || v.destroyed) return;
            v._sway += 0.02;
            v.x += v._vx + Math.sin(v._sway) * 0.15;
            v.y += v._vy;
            v._life--;
            v.alpha = Math.max(0, (v._life / v._maxLife) * 0.25);
            if (v._life <= 0) {
                v.x = v._originX + (Math.random() - 0.5) * 15;
                v.y = v._originY;
                v._life = v._maxLife;
                v._sway = Math.random() * Math.PI * 2;
                v.alpha = 0.25;
            }
        });
    }
};
