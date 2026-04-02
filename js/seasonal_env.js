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
        this._overlayGfx = new PIXI.Graphics();
        this._overlayGfx.zIndex = 9999;
        this.bldLayer.addChild(this._overlayGfx);
    },

    /* ─── BUILD OVERLAYS ON BUILDINGS ─── */
    buildOverlays() {
        if (typeof Seasonal === 'undefined') return;
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

            /* ── EASTER: Colored eggs near park/forest buildings ── */
            if (isEaster && (b.id === 'forest_0' || b.id === 'park' || b.id === 'cafe')) {
                const eggColors = [0xff6b9d, 0x7dd3fc, 0xa5f3c0, 0xfde68a, 0xc4b5fd];
                for (let ei = 0; ei < 4; ei++) {
                    const ex = bx + 10 + Math.random() * (bw - 20);
                    const ec = eggColors[Math.floor(Math.random() * eggColors.length)];
                    g.beginFill(ec);
                    g.drawEllipse(ex, gy - 3, 3, 4);
                    g.endFill();
                    // Stripe
                    g.beginFill(0xffffff, 0.4);
                    g.drawRect(ex - 2, gy - 4, 4, 1);
                    g.endFill();
                }
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
    },

    /* ─── PER-FRAME UPDATE ─── */
    update() {
        if (typeof Seasonal === 'undefined') return;
        const evts = Seasonal.getActiveEvents();
        if (evts.length === 0) return;

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
