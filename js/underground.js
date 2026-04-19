/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   UNDERGROUND — shared "below-ground" rendering module (v1.0.0)
   Single source of truth for cables, metro tunnel, deep-earth strata, water/sewer pipes.
   The exterior view is the blueprint; interiors call this module to paint a slice of the same world,
   so the basement of every building visually matches what's underground in the city outside.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Underground = {
    /* ─── Color palette — mirrors environment.js + entities_gfx.js exterior values ─── */
    CABLE_COLS: [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6],
    CABLE_TRAY_BG: 0x060a14,

    EARTH_DEEP: 0x2d1a11,
    EARTH_DETAIL_DARK: 0x1f100a,
    EARTH_DETAIL_LIGHT: 0x3d261a,
    EARTH_VEIN_GOLD: 0xfacc15,
    EARTH_VEIN_RUST: 0xb45309,

    TUNNEL_CAVITY: 0x050508,
    TUNNEL_FLOOR: 0x1a1a24,
    TUNNEL_RAIL: 0x4a4a5a,
    TUNNEL_TIE: 0xd97706,
    TUNNEL_PILLAR: 0x111115,
    TUNNEL_LIGHT: 0xef4444,

    WATER_PIPE: 0x0369a1,
    WATER_PIPE_INNER: 0x0284c7,
    SEWER_PIPE: 0xb45309,
    SEWER_PIPE_INNER: 0xd97706,
    JBOX_BODY: 0x334155,
    JBOX_WATER: 0x0ea5e9,
    JBOX_SEWER: 0xf59e0b,

    /* ─── Layer thicknesses (depths from topY) ─── */
    H_CABLE_TRAY: 38,
    H_TUNNEL: 100,
    H_INFRA: 100,   // dark-navy infrastructure depth (mirrors exterior gy+170…+270)
    /* Total depth of the full mirrored stack (cable + tunnel + infrastructure). */
    FULL_STACK_DEPTH: 238,

    /* ─── Infrastructure backdrop colors (mirror environment.js) ─── */
    INFRA_DEEP: 0x0a0a0f,
    INFRA_PLAT_1: 0x1a202c,
    INFRA_PLAT_2: 0x0f172a,

    /* Map a zone tag to earth tint variants. */
    _zoneEarth(zone) {
        switch (zone) {
            case 'forest':
                return { base: 0x2a2014, a: 0x3a2818, b: 0x1a140a };
            case 'port':
                return { base: 0x1a1a28, a: 0x0a1a30, b: 0x2a3040 };
            case 'space':
                return { base: 0x111119, a: 0x222238, b: 0x080812 };
            case 'residential':
                return { base: 0x2a2218, a: 0x3a2818, b: 0x1f1408 };
            case 'tech':
            case 'court':
            case 'agents':
            default:
                return { base: this.EARTH_DEEP, a: this.EARTH_DETAIL_LIGHT, b: this.EARTH_DETAIL_DARK };
        }
    },

    /* Deterministic PRNG — same x always seeds same texture, so adjacent draws line up. */
    _seedRng(seed) {
        let s = (seed | 0) || 1;
        return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    },

    /**
     * Paint the full underground stack into one Graphics object.
     * Layout (top to bottom — matches exterior environment.js gy+32…+270):
     *   topY .................. cable tray (38px)
     *   topY + 38 ............. tunnel cavity (100px) — live trains overlay sits here
     *   topY + 138 ............ infrastructure depth (100px) — dark navy + pipes + junction boxes
     *   topY + 238 ............ deep earth + rock veins (h - 238)
     *
     * @param {PIXI.Graphics} g
     * @param {number} x left in container coords
     * @param {number} topY top in container coords (where the underground starts, just below floor)
     * @param {number} w width
     * @param {number} h total depth (≥ 240 for full stack)
     * @param {string} zone 'tech' | 'residential' | 'forest' | 'port' | 'space' | 'court' | 'agents'
     * @param {number} worldSeed optional seed (use building's world-X so adjacent buildings align)
     */
    drawBasementStack(g, x, topY, w, h, zone, worldSeed) {
        const seed = worldSeed != null ? worldSeed : (x | 0);
        this.drawCableTray(g, x, topY, w, seed);
        this.drawTunnelCavity(g, x, topY + this.H_CABLE_TRAY, w, seed);
        this.drawInfrastructure(g, x, topY + this.H_CABLE_TRAY + this.H_TUNNEL, w, seed);
        const earthTop = topY + this.H_CABLE_TRAY + this.H_TUNNEL + this.H_INFRA;
        const earthH = Math.max(0, h - this.H_CABLE_TRAY - this.H_TUNNEL - this.H_INFRA);
        if (earthH > 0) this.drawDeepEarth(g, x, earthTop, w, earthH, zone, seed);
    },

    /* ─── 1. Cable tray (10 horizontal fibers + junction dots) ─── */
    drawCableTray(g, x, topY, w, seed) {
        g.beginFill(this.CABLE_TRAY_BG); g.drawRect(x, topY, w, this.H_CABLE_TRAY); g.endFill();
        for (let fi = 0; fi < 10; fi++) {
            const fy = topY + 3 + fi * 3;
            const col = this.CABLE_COLS[fi % this.CABLE_COLS.length];
            g.beginFill(col, 0.55); g.drawRect(x + 5, fy, w - 10, 2); g.endFill();
        }
        const r = this._seedRng(seed + 7919);
        const dotCount = Math.max(6, Math.floor(w / 18));
        for (let i = 0; i < dotCount; i++) {
            const nx = x + 5 + r() * (w - 10);
            const ny = topY + 3 + r() * (this.H_CABLE_TRAY - 6);
            g.beginFill(this.CABLE_COLS[Math.floor(r() * this.CABLE_COLS.length)], 0.6);
            g.drawCircle(nx, ny, 1 + r() * 1.5);
            g.endFill();
        }
    },

    /* ─── 2. Tunnel cavity (dark void + tracks + ties + pillars) ─── */
    drawTunnelCavity(g, x, topY, w, seed) {
        g.beginFill(this.TUNNEL_CAVITY); g.drawRect(x, topY, w, this.H_TUNNEL); g.endFill();
        // Track bed
        g.beginFill(this.TUNNEL_FLOOR); g.drawRect(x, topY + 80, w, 20); g.endFill();
        // Twin rails
        g.beginFill(this.TUNNEL_RAIL);
        g.drawRect(x, topY + 85, w, 2);
        g.drawRect(x, topY + 92, w, 2);
        g.endFill();
        // Wood ties
        g.beginFill(this.TUNNEL_TIE);
        for (let tx = x; tx < x + w; tx += 16) g.drawRect(tx, topY + 88, 8, 4);
        g.endFill();
        // Yellow safety stripe at platform edge
        g.beginFill(0xfacc15, 0.6); g.drawRect(x, topY + 78, w, 1); g.endFill();
        // Support pillars with red status lights
        const r = this._seedRng(seed + 1337);
        let px = x + 30 + r() * 40;
        while (px < x + w - 14) {
            g.beginFill(this.TUNNEL_PILLAR); g.drawRect(px, topY, 14, this.H_TUNNEL); g.endFill();
            g.beginFill(this.TUNNEL_LIGHT); g.drawCircle(px + 7, topY + 18, 1.5); g.endFill();
            px += 130 + r() * 30;
        }
    },

    /* ─── 3. Deep earth (zone-tinted base + scattered rock + mineral veins) ─── */
    drawDeepEarth(g, x, topY, w, h, zone, seed) {
        const e = this._zoneEarth(zone);
        g.beginFill(e.base); g.drawRect(x, topY, w, h); g.endFill();
        const r = this._seedRng(seed + 31337);
        for (let rx = x; rx < x + w; rx += 12) {
            for (let ry = topY; ry < topY + h; ry += 12) {
                if (r() > 0.4) {
                    g.beginFill(r() > 0.5 ? e.a : e.b, 0.8);
                    g.drawRect(rx + r() * 8, ry + r() * 8, 2 + r() * 4, 2 + r() * 3);
                    g.endFill();
                }
                if (r() > 0.96) {
                    g.beginFill(r() > 0.5 ? this.EARTH_VEIN_RUST : this.EARTH_VEIN_GOLD, 0.6);
                    g.drawRect(rx + r() * 10, ry + r() * 10, 1 + r() * 2, 1);
                    g.endFill();
                }
            }
        }
    },

    /* ─── 4. Infrastructure depth — dark navy backdrop + platform overlays + pipes + junction boxes
       This mirrors the exterior layout exactly. In environment.js the city zone has:
         gy+170 (h=100) → 0x0a0a0f infrastructure deep
         gy+180 (h=30)  → 0x1a202c platform overlay 1
         gy+185 (h=20)  → 0x0f172a platform overlay 2
         gy+220 (h=8)   → 0x0369a1 water (inner gy+222 h=4 0x0284c7)
         gy+235 (h=12)  → 0xb45309 sewer (inner gy+237 h=8 0xd97706)
         every 200px    → cable junction (15x40) at gy+175, water box (10x12) at +50,+218,
                           sewer box (10x16) at +100,+233
       Translated to local coords with topY = infra start (= exterior gy+170).         ─── */
    drawInfrastructure(g, x, topY, w, seed) {
        // Dark navy backdrop
        g.beginFill(this.INFRA_DEEP); g.drawRect(x, topY, w, this.H_INFRA); g.endFill();
        // Platform overlays
        g.beginFill(this.INFRA_PLAT_1); g.drawRect(x, topY + 10, w, 30); g.endFill();
        g.beginFill(this.INFRA_PLAT_2); g.drawRect(x, topY + 15, w, 20); g.endFill();
        // Water pipe (gy+220 → topY+50)
        g.beginFill(this.WATER_PIPE); g.drawRect(x, topY + 50, w, 8); g.endFill();
        g.beginFill(this.WATER_PIPE_INNER); g.drawRect(x, topY + 52, w, 4); g.endFill();
        // Sewer pipe (gy+235 → topY+65)
        g.beginFill(this.SEWER_PIPE); g.drawRect(x, topY + 65, w, 12); g.endFill();
        g.beginFill(this.SEWER_PIPE_INNER); g.drawRect(x, topY + 67, w, 8); g.endFill();

        // Junction boxes — staggered horizontally every 200px
        const r = this._seedRng(seed + 4242);
        const phase = Math.floor(r() * 200);
        for (let bx = x - 200 + phase; bx < x + w + 50; bx += 200) {
            // Cable junction body 15x40 at gy+175 → topY+5
            if (bx + 15 > x && bx < x + w) {
                g.beginFill(this.JBOX_BODY); g.drawRect(bx, topY + 5, 15, 40); g.endFill();
            }
            // Water mini-box 10x12 at +50 right, gy+218 → topY+48
            const wx = bx + 50;
            if (wx + 10 > x && wx < x + w) {
                g.beginFill(this.JBOX_WATER); g.drawRect(wx, topY + 48, 10, 12); g.endFill();
            }
            // Sewer mini-box 10x16 at +100 right, gy+233 → topY+63
            const sx = bx + 100;
            if (sx + 10 > x && sx < x + w) {
                g.beginFill(this.JBOX_SEWER); g.drawRect(sx, topY + 63, 10, 16); g.endFill();
            }
        }
    },

    /**
     * Mount a LIVE train overlay that mirrors G.train* state in real time.
     * The interior basement shows a SLICE of the world centered on `buildingWorldX`,
     * so a train passing the building from the outside view passes through the basement view too.
     *
     * Caller must invoke the returned `update()` once per frame inside their interior update loop.
     *
     * @param {PIXI.Container} parent — interior scene container
     * @param {number} buildingWorldX — building's world-X (center)
     * @param {number} localTunnelX — left x of the tunnel band in container coords
     * @param {number} localTunnelY — top y of the tunnel band in container coords
     * @param {number} localTunnelW — width in container coords
     * @param {number} viewSliceWorld — how many world-px to fit into localTunnelW (e.g. 1200)
     * @returns {{ container: PIXI.Container, update: Function, destroy: Function }}
     */
    attachLiveTrains(parent, buildingWorldX, localTunnelX, localTunnelY, localTunnelW, viewSliceWorld = 1200) {
        const container = new PIXI.Container();
        container.sortableChildren = true;
        parent.addChild(container);

        const trainKeys = ['trainWest', 'trainEast', 'trainMid', 'trainDC', 'trainLongevity'];
        // Native train is 360w x 75h. Tunnel is 100h. Cap scale so train fits with 8px padding.
        const TRAIN_NATIVE_H = 75;
        const xRatio = localTunnelW / viewSliceWorld;
        const spriteScale = Math.min(xRatio, (this.H_TUNNEL - 8) / TRAIN_NATIVE_H);

        const sprites = trainKeys.map(key => {
            const s = new PIXI.Container();
            let passengerGfx = null;
            // Use the SAME sprite builder as the exterior train so visuals never drift.
            if (typeof EntitiesGfx !== 'undefined' && typeof EntitiesGfx.buildTrainSprite === 'function') {
                const { tBg, fGfx, lightL, lightR } = EntitiesGfx.buildTrainSprite();
                // Passenger silhouettes render BETWEEN body and front overlay (mirrors exterior riderCont layering).
                passengerGfx = new PIXI.Graphics();
                s.addChild(tBg, passengerGfx, fGfx, lightL, lightR);
            }
            s.scale.set(spriteScale);
            s.visible = false;
            container.addChild(s);
            return { s, key, passengerGfx };
        });

        const sliceLeft = buildingWorldX - viewSliceWorld / 2;
        // Train body extends y=-35 to y=+40 (with sleeper). Bottom (+40) rests near tunnel floor.
        const tunnelCenterY = localTunnelY + this.H_TUNNEL - 40 * spriteScale - 4;
        // Window centers (matches createTrainObj windows at cx-100/0/+100, w=20, h=50 starting at cy-28).
        const winX = [-90, 10, 110];
        const skinTones = [0xfcd5b4, 0xe0a899, 0xc69076, 0x8d5524];

        return {
            container,
            update() {
                if (typeof Entities === 'undefined') return;
                sprites.forEach(({ s, key, passengerGfx }) => {
                    const t = Entities[key];
                    if (!t || typeof t.x !== 'number') { s.visible = false; return; }
                    const dx = t.x - sliceLeft;
                    if (dx < -200 || dx > viewSliceWorld + 200) { s.visible = false; return; }
                    s.visible = true;
                    s.x = localTunnelX + (dx / viewSliceWorld) * localTunnelW;
                    s.y = tunnelCenterY;
                    const dir = (t.dir != null ? t.dir : 1) >= 0 ? 1 : -1;
                    s.scale.x = spriteScale * dir;

                    // Passenger silhouettes — up to 12 heads (4 per window × 3 windows).
                    if (passengerGfx) {
                        passengerGfx.clear();
                        const npax = Math.min(12, Math.floor(t.passengers || 0));
                        for (let i = 0; i < npax; i++) {
                            const winIdx = i % 3;
                            const seatIdx = Math.floor(i / 3); // 0..3 seats per window
                            const col = seatIdx % 2;
                            const row = Math.floor(seatIdx / 2);
                            const px = winX[winIdx] + (col === 0 ? -4 : 4);
                            const py = -16 + row * 10;
                            const skin = skinTones[(i + (key.charCodeAt(5) | 0)) % skinTones.length];
                            passengerGfx.beginFill(skin);
                            passengerGfx.drawCircle(px, py, 2.8);
                            passengerGfx.endFill();
                        }
                    }
                });
            },
            destroy() {
                sprites.forEach(({ s }) => { if (s && !s.destroyed) s.destroy(); });
                if (container && !container.destroyed) container.destroy();
            }
        };
    }
};
