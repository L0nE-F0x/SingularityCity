/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SEASONAL ENVIRONMENT (v1.0.0)
   Visual overlays for seasonal events — snow on roofs, fairy lights, jack-o-lanterns, fireworks, etc.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SeasonalEnv = {

    fxLayer: null,
    bldLayer: null,
    _overlayGfx: null,       // persistent Graphics for building overlays
    _fireworks: [],           // active firework particles
    _fairyLights: [],         // fairy light positions for twinkle
    _lastEvent: null,         // cache to avoid rebuilding every frame
    _builtForTick: -9999,

    init(layers) {
        this.bldLayer = layers.bldLayer;
        this.fxLayer = layers.fxGfx;
        this._ensureGfx();
    },

    /* ─── Ensure overlay Graphics exists (it gets destroyed by buildBuildings) ─── */
    _ensureGfx() {
        if (!this._overlayGfx || this._overlayGfx.destroyed) {
            this._overlayGfx = new PIXI.Graphics();
            this._overlayGfx.zIndex = 9999;
        }
        // Parent the overlay to the top-level world container, placed AFTER groundGfx
        // so Easter eggs and the bunny render on top of the ground and building trees
        // (the bldLayer is drawn BEFORE groundGfx, so overlays there get covered).
        const world = (typeof G !== 'undefined') ? G.world : null;
        if (world && this._overlayGfx.parent !== world) {
            world.addChild(this._overlayGfx);
        } else if (world) {
            // Re-add to move to top of child list
            world.addChild(this._overlayGfx);
        } else if (this.bldLayer && !this._overlayGfx.parent) {
            this.bldLayer.addChild(this._overlayGfx);
        }
    },

    /* ─── BUILD OVERLAYS ON BUILDINGS ─── */
    buildOverlays() {
        if (typeof Seasonal === 'undefined') return;
        this._ensureGfx();
        const evts = Seasonal.getActiveEvents();
        const evtIds = evts.map(e => e.id).join(',');
        if (evtIds === this._lastEvent) return; // don't rebuild if same events
        this._lastEvent = evtIds;

        this._overlayGfx.clear();
        this._fairyLights = [];
        if (evts.length === 0) return;
        if (!window.BLDS) return;

        const gy = G.groundY;
        const isWinter = evts.some(e => e.id === 'winter_holiday');
        const isHalloween = evts.some(e => e.id === 'halloween');
        const isEaster = evts.some(e => e.id === 'easter');
        const isLunar = evts.some(e => e.id === 'lunar_new_year');
        const g = this._overlayGfx;

        BLDS.forEach(b => {
            if (!b.x || !b.w || !b.fl) return;
            if (b.id === 'forest_0' || b.id === 'forest_1' || b.id === 'forest_space') return;
            if (b.id.startsWith('port_') || b.type === 'launchpad') return;

            const bx = b.x, bw = b.w, flH = b.fl * 22;
            const roofY = gy - flH - 10;

            /* ── WINTER: Snow caps + fairy lights ── */
            if (isWinter) {
                // Snow on rooftops
                g.beginFill(0xffffff, 0.85);
                g.drawRoundedRect(bx - 2, roofY - 4, bw + 4, 6, 3);
                g.endFill();
                // Icicles
                for (let ix = bx + 8; ix < bx + bw - 5; ix += 12 + Math.floor(Math.random() * 8)) {
                    const iH = 4 + Math.floor(Math.random() * 6);
                    g.beginFill(0xd4eeff, 0.7);
                    g.moveTo(ix, roofY + 2); g.lineTo(ix + 2, roofY + 2); g.lineTo(ix + 1, roofY + 2 + iH); g.closePath();
                    g.endFill();
                }
                // Fairy lights along roofline
                for (let lx = bx + 5; lx < bx + bw - 5; lx += 10) {
                    const colors = [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff];
                    const col = colors[Math.floor(Math.random() * colors.length)];
                    this._fairyLights.push({ x: lx, y: roofY + 1, color: col, phase: Math.random() * Math.PI * 2 });
                }
            }

            /* ── HALLOWEEN: Jack-o-lanterns beside doors ── */
            if (isHalloween) {
                // Pumpkin at building base
                const px = bx + bw * 0.15 + Math.random() * bw * 0.2;
                g.beginFill(0xff8c00);
                g.drawEllipse(px, gy - 5, 5, 4);
                g.endFill();
                g.beginFill(0x2d5016);
                g.drawRect(px - 1, gy - 10, 2, 3); // stem
                g.endFill();
                // Carved face (triangle eyes + mouth)
                g.beginFill(0xffcc00, 0.9);
                g.drawRect(px - 3, gy - 7, 2, 2);
                g.drawRect(px + 1, gy - 7, 2, 2);
                g.drawRect(px - 2, gy - 4, 4, 1);
                g.endFill();
            }

            /* ── LUNAR NEW YEAR: Red lanterns ── */
            if (isLunar) {
                // Red lantern hanging from roofline
                const lnx = bx + bw * 0.5;
                g.lineStyle(1, 0x888888, 0.5);
                g.moveTo(lnx, roofY); g.lineTo(lnx, roofY + 10);
                g.lineStyle(0);
                g.beginFill(0xee2222, 0.9);
                g.drawEllipse(lnx, roofY + 15, 5, 6);
                g.endFill();
                g.beginFill(0xffcc00, 0.8);
                g.drawRect(lnx - 3, roofY + 10, 6, 2); // top cap
                g.drawRect(lnx - 3, roofY + 19, 6, 2); // bottom cap
                g.endFill();
                // Tassel
                g.lineStyle(1, 0xffcc00, 0.6);
                g.moveTo(lnx, roofY + 21); g.lineTo(lnx, roofY + 26);
                g.lineStyle(0);
            }
        });

        /* ─── EASTER: scatter eggs, bunnies, and pastel bunting across social spots ─── */
        // Runs AFTER the main loop so it can target forest_0 (Pine Reserve), which
        // is excluded from the main-loop decorations (no roof to decorate).
        if (isEaster) this._buildEasterOverlays(g, gy);
    },

    _buildEasterOverlays(g, gy) {
        const eggColors = [0xff6b9d, 0x7dd3fc, 0xa5f3c0, 0xfde68a, 0xc4b5fd, 0xfb923c];
        // Curated list of Easter-eligible social/park spots
        const socialIds = ['forest_0', 'cafe', 'open_square', 'gym', 'arena', 'convention_center', 'bld_1'];
        const spots = socialIds
            .map(id => (G.bldById && G.bldById[id]) || BLDS.find(x => x.id === id))
            .filter(b => b && b.x && b.w);
        if (spots.length === 0) return;

        spots.forEach(b => {
            // Scatter 10-14 eggs on the ground in front of the building
            const eggCount = 10 + Math.floor(Math.random() * 5);
            for (let ei = 0; ei < eggCount; ei++) {
                const ex = b.x + 6 + (ei / eggCount) * (b.w - 12) + (Math.random() - 0.5) * 8;
                const ey = gy - 3 - Math.floor(Math.random() * 4);
                const col = eggColors[Math.floor(Math.random() * eggColors.length)];
                // Shadow
                g.beginFill(0x000000, 0.25);
                g.drawEllipse(ex, ey + 4, 4, 1.2);
                g.endFill();
                // Egg body
                g.beginFill(col);
                g.drawEllipse(ex, ey, 4, 5);
                g.endFill();
                // Highlight
                g.beginFill(0xffffff, 0.5);
                g.drawEllipse(ex - 1, ey - 2, 1.2, 1.8);
                g.endFill();
                // Zigzag / stripe pattern
                const pattern = ei % 3;
                if (pattern === 0) {
                    g.beginFill(0xffffff, 0.7);
                    g.drawRect(ex - 3, ey - 1, 6, 1);
                    g.drawRect(ex - 3, ey + 1, 6, 1);
                    g.endFill();
                } else if (pattern === 1) {
                    g.beginFill(0xffffff, 0.6);
                    g.drawCircle(ex - 1, ey, 0.8);
                    g.drawCircle(ex + 1, ey + 1, 0.8);
                    g.endFill();
                }
            }
        });

        // ─── Easter Bunny on Pine Reserve (forest_0) ───
        const forest = (G.bldById && G.bldById['forest_0']) || BLDS.find(x => x.id === 'forest_0');
        if (forest && forest.x) {
            const bx = forest.x + forest.w * 0.35;
            const by = gy - 5;
            // Body (white fluff)
            g.beginFill(0xfafafa);
            g.drawEllipse(bx, by, 7, 5);
            g.endFill();
            // Head
            g.beginFill(0xfafafa);
            g.drawCircle(bx + 6, by - 3, 3.5);
            g.endFill();
            // Ears (tall)
            g.beginFill(0xfafafa);
            g.drawRoundedRect(bx + 3, by - 13, 1.8, 8, 0.8);
            g.drawRoundedRect(bx + 6, by - 13, 1.8, 8, 0.8);
            g.endFill();
            // Inner ear (pink)
            g.beginFill(0xff9ab5);
            g.drawRect(bx + 3.5, by - 11, 0.8, 5);
            g.drawRect(bx + 6.5, by - 11, 0.8, 5);
            g.endFill();
            // Eye
            g.beginFill(0x2c1810);
            g.drawCircle(bx + 7, by - 3, 0.7);
            g.endFill();
            // Pink nose
            g.beginFill(0xff6b9d);
            g.drawCircle(bx + 8.5, by - 2, 0.8);
            g.endFill();
            // Cotton tail
            g.beginFill(0xffffff);
            g.drawCircle(bx - 6, by - 1, 1.8);
            g.endFill();
            // Basket beside bunny with eggs peeking out
            const kx = bx + 14, ky = by;
            g.beginFill(0x8b4513);
            g.drawRoundedRect(kx - 4, ky - 2, 8, 5, 1);
            g.endFill();
            g.lineStyle(0.5, 0x5c2d0c);
            g.moveTo(kx - 4, ky - 2); g.lineTo(kx + 4, ky - 2);
            g.lineStyle(0);
            // Basket handle
            g.lineStyle(1, 0x8b4513);
            g.moveTo(kx - 3, ky - 2); g.bezierCurveTo(kx - 3, ky - 8, kx + 3, ky - 8, kx + 3, ky - 2);
            g.lineStyle(0);
            // Eggs in basket
            g.beginFill(0xff6b9d); g.drawEllipse(kx - 2, ky - 2, 1.3, 1.8); g.endFill();
            g.beginFill(0x7dd3fc); g.drawEllipse(kx,     ky - 3, 1.3, 1.8); g.endFill();
            g.beginFill(0xfde68a); g.drawEllipse(kx + 2, ky - 2, 1.3, 1.8); g.endFill();
        }

        // ─── Pastel egg bunting strung between adjacent social spots ───
        const sortedByX = spots.slice().sort((a, b) => a.x - b.x);
        for (let i = 0; i < sortedByX.length - 1; i++) {
            const a = sortedByX[i], c = sortedByX[i + 1];
            const gap = c.x - (a.x + a.w);
            if (gap < 20 || gap > 500) continue; // skip if too close or too far
            const startX = a.x + a.w;
            const endX = c.x;
            const anchorY = gy - Math.max((a.fl || 1), (c.fl || 1)) * 22 - 28;
            const flagCount = Math.floor((endX - startX) / 18);
            // Droop curve between the two anchor points
            for (let fi = 0; fi < flagCount; fi++) {
                const t = fi / Math.max(1, flagCount - 1);
                const fx = startX + t * (endX - startX);
                // Parabolic droop
                const droop = Math.sin(t * Math.PI) * 12;
                const fy = anchorY + droop;
                const col = eggColors[fi % eggColors.length];
                // Egg
                g.beginFill(col, 0.95);
                g.drawEllipse(fx, fy, 3, 4);
                g.endFill();
                // Highlight
                g.beginFill(0xffffff, 0.5);
                g.drawCircle(fx - 0.8, fy - 1.2, 0.8);
                g.endFill();
                // String to next flag
                if (fi < flagCount - 1) {
                    const nt = (fi + 1) / Math.max(1, flagCount - 1);
                    const nfx = startX + nt * (endX - startX);
                    const nfy = anchorY + Math.sin(nt * Math.PI) * 12;
                    g.lineStyle(0.8, 0xa0a0a0, 0.6);
                    g.moveTo(fx, fy - 4); g.lineTo(nfx, nfy - 4);
                    g.lineStyle(0);
                }
            }
        }
    },

    /* ─── PER-FRAME UPDATE ─── */
    update() {
        if (typeof Seasonal === 'undefined') return;
        const evts = Seasonal.getActiveEvents();
        if (evts.length === 0) return;

        // Recreate overlay if destroyed by buildBuildings(), and rebuild content
        if (!this._overlayGfx || this._overlayGfx.destroyed) {
            this._lastEvent = null;  // force rebuild
            this.buildOverlays();
        }

        // Rebuild overlays periodically (in case buildings moved or events changed)
        if (G.tick % 300 === 0) this.buildOverlays();

        // Twinkle fairy lights
        this._fairyLights.forEach(fl => {
            const alpha = 0.3 + Math.abs(Math.sin(G.tick * 0.08 + fl.phase)) * 0.7;
            // Draw into fxGfx each frame for twinkling
            this.fxLayer.beginFill(fl.color, alpha);
            this.fxLayer.drawCircle(fl.x, fl.y, 1.5);
            this.fxLayer.endFill();
        });

        // Fireworks
        if (Seasonal.hasFireworks()) {
            this._updateFireworks();
        }
    },

    /* ─── FIREWORKS SYSTEM ─── */
    _updateFireworks() {
        // Spawn new fireworks
        if (G.tick % 40 === 0 && this._fireworks.length < 80) {
            const cx = Math.random() * G.cityW;
            const cy = 20 + Math.random() * (G.vpH * 0.3);
            const burstColors = [0xff4444, 0x44ff44, 0x4488ff, 0xffdd44, 0xff44ff, 0x44ffff, 0xffffff];
            const col = burstColors[Math.floor(Math.random() * burstColors.length)];
            // Create burst of 12-18 particles
            const count = 12 + Math.floor(Math.random() * 7);
            for (let i = 0; i < count; i++) {
                const angle = (Math.PI * 2 / count) * i + Math.random() * 0.3;
                const speed = 1.5 + Math.random() * 2;
                this._fireworks.push({
                    x: cx, y: cy,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    life: 60 + Math.floor(Math.random() * 40),
                    maxLife: 100,
                    color: col,
                    size: 1.5 + Math.random()
                });
            }
        }

        // Update & draw particles
        for (let i = this._fireworks.length - 1; i >= 0; i--) {
            const p = this._fireworks[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.03; // gravity
            p.vx *= 0.98; // drag
            p.life--;
            const alpha = Math.max(0, p.life / p.maxLife);

            if (p.life <= 0) {
                this._fireworks.splice(i, 1);
            } else {
                this.fxLayer.beginFill(p.color, alpha);
                this.fxLayer.drawCircle(p.x, p.y, p.size * alpha);
                this.fxLayer.endFill();
            }
        }
    }
};
