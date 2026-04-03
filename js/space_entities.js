/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE ENTITIES (v1.0.0 — Phase 2: Launch Animations & Real-Time Triggers)
   Handles animated rocket entities, launch sequences, smoke/flame particles, and countdown displays.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceEntities = {
    rockets: {},      // keyed by pad building id
    particles: [],    // smoke/flame particles
    particlePool: [], // recycled particle graphics
    countdownTexts: {},
    layer: null,      // PIXI container for all space entities
    
    init(carLayer) {
        this.layer = new PIXI.Container();
        carLayer.addChild(this.layer);
        
        // Create a rocket entity for each launch pad
        BLDS.forEach(b => {
            if (b.type === 'launchpad' && b.org) {
                this.createRocket(b);
            }
        });
        
        console.log('🚀 Space Entities: Created', Object.keys(this.rockets).length, 'rockets');
    },
    
    createRocket(padBld) {
        const org = SPACE_ORGS[padBld.org];
        if (!org) return;
        
        const colHex = parseInt(org.color.slice(1), 16);
        const cont = new PIXI.Container();
        cont.sortableChildren = true;
        
        // Rocket body
        const body = new PIXI.Graphics();
        // Fuselage
        body.beginFill(0xf1f5f9);
        body.drawRect(-4, -45, 8, 45);
        body.endFill();
        // Nose cone in org color
        body.beginFill(colHex);
        body.drawPolygon([-4, -45, 0, -58, 4, -45]);
        body.endFill();
        // Org color stripe
        body.beginFill(colHex);
        body.drawRect(-3, -30, 6, 12);
        body.endFill();
        // Window
        body.beginFill(0x38bdf8, 0.6);
        body.drawCircle(0, -38, 2);
        body.endFill();
        // Fins
        body.beginFill(0x94a3b8);
        body.drawPolygon([-4, -4, -10, 4, -4, 2]);
        body.drawPolygon([4, -4, 10, 4, 4, 2]);
        body.endFill();
        body.zIndex = 10;
        cont.addChild(body);
        
        // Flame container (visible during ignition/liftoff)
        const flame = new PIXI.Container();
        flame.visible = false;
        flame.zIndex = 5;
        cont.addChild(flame);
        
        // Countdown text
        const countdownTxt = new PIXI.Text('', {
            fontFamily: '"JetBrains Mono", monospace',
            fontSize: 8,
            fill: 0x22d3ee,
            fontWeight: 'bold',
            align: 'center'
        });
        countdownTxt.anchor.set(0.5, 0);
        countdownTxt.y = 10;
        countdownTxt.zIndex = 20;
        cont.addChild(countdownTxt);
        
        // Position on pad
        const towerX = padBld.w / 2 - 8;
        const rocketLocalX = towerX + 28;
        const padH = (padBld.dynamicFl || padBld.fl || 1) * 18 + 24;
        
        cont.x = padBld.x + rocketLocalX;
        cont.y = G.groundY - 24 - 8; // sits on pad surface
        
        this.layer.addChild(cont);
        
        const rocket = {
            padId: padBld.id,
            org: padBld.org,
            cont,
            body,
            flame,
            countdownTxt,
            state: 'idle',   // idle | countdown | ignition | liftoff | ascending | orbit | resetting
            timer: 0,
            launchData: null, // matched launch from API
            baseY: cont.y,
            baseX: cont.x,
            ascentSpeed: 0,
            shakeIntensity: 0,
            trailParticles: []
        };
        
        this.rockets[padBld.id] = rocket;
        this.countdownTexts[padBld.id] = countdownTxt;
    },
    
    // ─── Match real launches to pads ───
    matchLaunchesToPads() {
        if (typeof SpaceData === 'undefined' || !SpaceData.launches.length) return;
        
        const now = new Date();
        
        Object.values(this.rockets).forEach(r => {
            if (r.state !== 'idle') return; // don't reassign mid-sequence
            
            // Find the next upcoming launch for this org (or one that just happened within 5 min)
            const orgKey = r.org;
            const match = SpaceData.launches.find(l => {
                const provider = SpaceData.getOrgForProvider(l.provider);
                const diff = new Date(l.net) - now;
                return provider === orgKey && diff > -300000; // within 5 minutes past or any future
            });
            
            if (match) {
                r.launchData = match;
                const diff = new Date(match.net) - now;
                
                // Launch just passed (within 5 min) — trigger immediately
                if (diff <= 0 && diff > -300000 && !r._launchTriggered) {
                    r._launchTriggered = match.id;
                    this.triggerLaunch(r.padId);
                }
                // Launch within 2 minutes — start countdown
                else if (diff < 120000 && diff > 0) {
                    r.state = 'countdown';
                    r.timer = Math.floor(diff / 1000) * 60; // convert seconds to frames (60fps)
                }
            }
        });
    },
    
    // ─── Manual launch trigger (for demo / when API reports T-0) ───
    triggerLaunch(padId) {
        const r = this.rockets[padId];
        if (!r || (r.state !== 'idle' && r.state !== 'countdown')) return;
        
        r.state = 'ignition';
        r.timer = 180; // 3 seconds of ignition before liftoff
        r.shakeIntensity = 2;
        
        const org = SPACE_ORGS[r.org];
        if (typeof UI !== 'undefined') {
            const name = r.launchData ? r.launchData.name : `${org.name} Launch`;
            UI.addToast(`🚀 LAUNCH: ${name}`);
        }
    },
    
    // ─── Simulate a launch on a random pad (for visual testing / demo) ───
    triggerRandomLaunch() {
        const idle = Object.values(this.rockets).filter(r => r.state === 'idle');
        if (idle.length === 0) return;
        const pick = idle[Math.floor(Math.random() * idle.length)];
        this.triggerLaunch(pick.padId);
    },
    
    // ─── Spawn a particle ───
    spawnParticle(x, y, type, color) {
        let g;
        if (this.particlePool.length > 0) {
            g = this.particlePool.pop();
            g.clear();
            g.visible = true;
        } else {
            g = new PIXI.Graphics();
            this.layer.addChild(g);
        }
        
        const size = type === 'smoke' ? 3 + Math.random() * 6 : 2 + Math.random() * 4;
        const alpha = type === 'smoke' ? 0.3 + Math.random() * 0.3 : 0.7 + Math.random() * 0.3;
        
        g.beginFill(color, alpha);
        g.drawCircle(0, 0, size);
        g.endFill();
        if (type === 'flame') {
            g.blendMode = PIXI.BLEND_MODES.ADD;
        } else {
            g.blendMode = PIXI.BLEND_MODES.NORMAL;
        }
        
        g.x = x;
        g.y = y;
        g.zIndex = type === 'smoke' ? 1 : 3;
        
        const particle = {
            g,
            vx: (Math.random() - 0.5) * (type === 'smoke' ? 3 : 1.5),
            vy: type === 'smoke' ? 0.5 + Math.random() * 1.5 : -1 - Math.random() * 2,
            life: type === 'smoke' ? 60 + Math.random() * 60 : 20 + Math.random() * 30,
            maxLife: 0,
            type
        };
        particle.maxLife = particle.life;
        
        this.particles.push(particle);
    },
    
    // ─── Draw animated flame on rocket ───
    drawFlame(rocket, intensity) {
        const f = rocket.flame;
        f.visible = true;

        // Reuse a single Graphics object instead of creating new one every frame
        if (!rocket._flameGfx) {
            rocket._flameGfx = new PIXI.Graphics();
            rocket._flameGfx.blendMode = PIXI.BLEND_MODES.ADD;
            f.addChild(rocket._flameGfx);
        }
        const flameGfx = rocket._flameGfx;
        flameGfx.clear();
        const h = 10 + intensity * 15;

        // Outer flame (orange-red)
        flameGfx.beginFill(0xef4444, 0.8);
        flameGfx.drawPolygon([
            -6 - intensity * 2, 0,
            0, h + Math.sin(G.tick * 0.3) * 5,
            6 + intensity * 2, 0
        ]);
        flameGfx.endFill();

        // Inner flame (yellow-white)
        flameGfx.beginFill(0xfbbf24, 0.9);
        flameGfx.drawPolygon([
            -3 - intensity, 0,
            0, h * 0.6 + Math.sin(G.tick * 0.5) * 3,
            3 + intensity, 0
        ]);
        flameGfx.endFill();

        // Core (white hot)
        flameGfx.beginFill(0xffffff, 0.7);
        flameGfx.drawPolygon([
            -1, 0,
            0, h * 0.3 + Math.sin(G.tick * 0.7) * 2,
            1, 0
        ]);
        flameGfx.endFill();
    },
    
    // ─── Main update loop — called every frame ───
    update() {
        if (!this.layer) return;
        
        // Match launches every ~5 seconds
        if (G.tick % 300 === 0) {
            this.matchLaunchesToPads();
        }
        
        // Update each rocket
        Object.values(this.rockets).forEach(r => {
            switch (r.state) {
                case 'idle':
                    r.cont.x = r.baseX;
                    r.cont.y = r.baseY;
                    r.body.visible = true;
                    r.flame.visible = false;
                    
                    // Show countdown if launch data exists
                    if (r.launchData) {
                        const cd = SpaceData.getCountdown(r.launchData);
                        if (cd) {
                            r.countdownTxt.text = cd;
                            r.countdownTxt.style.fill = cd.startsWith('T-0') ? 0xef4444 : 0x22d3ee;
                        }
                    } else {
                        r.countdownTxt.text = 'STANDBY';
                        r.countdownTxt.style.fill = 0x475569;
                    }
                    break;
                    
                case 'countdown':
                    r.timer--;
                    const secs = Math.ceil(r.timer / 60);
                    r.countdownTxt.text = `T-${secs}s`;
                    r.countdownTxt.style.fill = secs < 10 ? 0xef4444 : 0xfbbf24;
                    
                    // Pad shaking increases as countdown nears zero
                    if (secs < 30) {
                        r.cont.x = r.baseX + (Math.random() - 0.5) * (30 - secs) * 0.05;
                    }
                    
                    if (r.timer <= 0) {
                        r.state = 'ignition';
                        r.timer = 180; // 3 seconds at 60fps
                        r.shakeIntensity = 2;
                    }
                    break;
                    
                case 'ignition':
                    r.timer--;
                    r.countdownTxt.text = 'IGNITION';
                    r.countdownTxt.style.fill = 0xef4444;
                    
                    // Shake the rocket
                    r.cont.x = r.baseX + (Math.random() - 0.5) * r.shakeIntensity;
                    r.shakeIntensity = Math.min(4, r.shakeIntensity + 0.02);
                    
                    // Draw growing flame
                    const ignitionProgress = 1 - (r.timer / 180);
                    this.drawFlame(r, ignitionProgress * 2);
                    
                    // Spawn smoke and flame particles
                    if (G.tick % 2 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random()-0.5)*8, r.baseY + 4, 'smoke', 0x94a3b8);
                        this.spawnParticle(r.cont.x + (Math.random()-0.5)*4, r.baseY, 'flame', 0xfbbf24);
                    }
                    
                    if (r.timer <= 0) {
                        r.state = 'liftoff';
                        r.timer = 0;
                        r.ascentSpeed = 0.3;
                        if (typeof G !== 'undefined') G.unlockAchieve('rocket_scientist');
                    }
                    break;
                    
                case 'liftoff':
                    r.timer++;
                    r.countdownTxt.text = `T+${Math.floor(r.timer/60)}s`;
                    r.countdownTxt.style.fill = 0x4ade80;
                    
                    // Accelerate upward
                    r.ascentSpeed = Math.min(4, r.ascentSpeed + 0.015);
                    r.cont.y -= r.ascentSpeed;
                    
                    // Reduce shake as it clears the tower
                    r.shakeIntensity = Math.max(0, r.shakeIntensity - 0.02);
                    r.cont.x = r.baseX + (Math.random() - 0.5) * r.shakeIntensity;
                    
                    // Full flame
                    this.drawFlame(r, 2 + Math.sin(G.tick * 0.2) * 0.5);
                    
                    // Heavy smoke at base
                    if (G.tick % 2 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random()-0.5)*12, r.baseY + 4, 'smoke', 0x94a3b8);
                        this.spawnParticle(r.cont.x + (Math.random()-0.5)*6, r.cont.y + 4, 'flame', 
                            Math.random() > 0.5 ? 0xfbbf24 : 0xef4444);
                    }
                    // Exhaust trail
                    if (G.tick % 4 === 0) {
                        this.spawnParticle(r.cont.x + (Math.random()-0.5)*3, r.cont.y + 2, 'smoke', 0xffffff);
                    }
                    
                    // Switch to ascending after clearing frame
                    if (r.cont.y < r.baseY - 120) {
                        r.state = 'ascending';
                    }
                    break;
                    
                case 'ascending':
                    r.timer++;
                    r.countdownTxt.text = `T+${Math.floor(r.timer/60)}s`;
                    
                    // Continue acceleration, start shrinking
                    r.ascentSpeed = Math.min(6, r.ascentSpeed + 0.01);
                    r.cont.y -= r.ascentSpeed;
                    
                    const ascentProgress = Math.min(1, (r.baseY - r.cont.y - 120) / 300);
                    r.cont.scale.set(1 - ascentProgress * 0.7);
                    r.cont.alpha = 1 - ascentProgress * 0.8;
                    
                    // Diminishing flame and trail
                    if (ascentProgress < 0.7) {
                        this.drawFlame(r, 1.5 * (1 - ascentProgress));
                        if (G.tick % 6 === 0) {
                            this.spawnParticle(r.cont.x, r.cont.y + 2, 'smoke', 0xffffff);
                        }
                    } else {
                        r.flame.visible = false;
                    }
                    
                    // Reached orbit
                    if (r.cont.y < r.baseY - 500 || r.cont.alpha < 0.1) {
                        r.state = 'orbit';
                        r.timer = 600; // 10 seconds before respawn
                        r.cont.visible = false;
                        r.flame.visible = false;
                        
                        const org = SPACE_ORGS[r.org];
                        if (typeof UI !== 'undefined') {
                            const name = r.launchData ? r.launchData.name : `${org.name} mission`;
                            UI.addToast(`🛰️ ${name} — Orbit achieved!`);
                        }
                    }
                    break;
                    
                case 'orbit':
                    r.timer--;
                    r.countdownTxt.text = '';
                    if (r.timer <= 0) {
                        r.state = 'resetting';
                        r.timer = 120; // 2 second fade-in
                    }
                    break;
                    
                case 'resetting':
                    r.timer--;
                    // Reset position, fade back in
                    r.cont.x = r.baseX;
                    r.cont.y = r.baseY;
                    r.cont.scale.set(1);
                    r.cont.visible = true;
                    r.cont.alpha = 1 - (r.timer / 120);
                    r.flame.visible = false;
                    r.countdownTxt.text = 'STANDBY';
                    r.countdownTxt.style.fill = 0x475569;
                    
                    if (r.timer <= 0) {
                        r.cont.alpha = 1;
                        r.state = 'idle';
                        r.launchData = null;
                        r.shakeIntensity = 0;
                    }
                    break;
            }
        });
        
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.g.x += p.vx;
            p.g.y += p.vy;
            p.life--;
            
            // Smoke drifts and expands
            if (p.type === 'smoke') {
                p.vx *= 0.98;
                p.vy *= 0.97;
                p.g.scale.set(1 + (1 - p.life / p.maxLife) * 1.5);
            }
            
            p.g.alpha = (p.life / p.maxLife) * 0.6;
            
            if (p.life <= 0) {
                p.g.visible = false;
                this.particlePool.push(p.g);
                this.particles.splice(i, 1);
            }
        }
    }
};
