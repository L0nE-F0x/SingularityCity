/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   VC ROW ENVIRONMENT (v1.3.0)
   Money particles and market arrows. Tickers now handled by environment.js (same as HQ tickers).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const VCRowEnv = {
    _built: false,
    moneyParts: [],
    arrowGfx: null,
    _arrowTimer: 0,

    buildAnimations(charLayer) {
        if (this._built || typeof VCRow === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── MONEY PARTICLES (floating coins/bills during business hours) ───
        VCRow.BLDS.forEach(def => {
            const bld = G.bldById[def.id];
            if (!bld) return;
            const bldH = (bld.fl || 3) * 18 + 24;
            for (let p = 0; p < 3; p++) {
                const g = new PIXI.Graphics();
                const isGold = Math.random() > 0.5;
                g.beginFill(isGold ? 0xfbbf24 : 0x4ade80, 0.7);
                if (isGold) {
                    g.drawCircle(0, 0, 2);
                } else {
                    g.drawRect(-2, -1, 4, 2);
                }
                g.endFill();
                g.x = bld.x + 20 + Math.random() * (bld.w - 40);
                g.y = gy - bldH - 10;
                g._startY = g.y;
                g._driftX = (Math.random() - 0.5) * 0.3;
                g._speed = 0.2 + Math.random() * 0.3;
                g._phase = Math.random() * Math.PI * 2;
                g.alpha = 0;
                charLayer.addChild(g);
                this.moneyParts.push(g);
            }
        });

        // ─── GREEN/RED MARKET ARROWS on building facades ───
        this.arrowGfx = new PIXI.Graphics();
        this.arrowGfx.zIndex = 0;
        charLayer.addChild(this.arrowGfx);
    },

    update() {
        if (!this._built || typeof VCRow === 'undefined') return;
        const dp = G.getDayPhase();
        const isBusinessHours = dp >= 0.33 && dp < 0.75;

        // ─── MONEY PARTICLES (float upward, reset) ───
        this.moneyParts.forEach(p => {
            if (!p || p.destroyed) return;
            if (!isBusinessHours) { p.alpha = 0; return; }
            p.y -= p._speed;
            p.x += p._driftX + Math.sin(G.tick * 0.05 + p._phase) * 0.15;
            p.alpha = Math.min(0.7, p.alpha + 0.01);
            p.rotation += 0.02;
            if (p.y < p._startY - 80) {
                p.y = p._startY;
                p.alpha = 0;
                p._driftX = (Math.random() - 0.5) * 0.3;
            }
        });

        // ─── MARKET ARROWS (redraw every 120 frames) ───
        this._arrowTimer++;
        if (this._arrowTimer % 120 === 0 && this.arrowGfx && !this.arrowGfx.destroyed) {
            this.arrowGfx.clear();
            if (!isBusinessHours) return;
            const gy = G.groundY;

            VCRow.BLDS.forEach(def => {
                const bld = G.bldById[def.id];
                if (!bld) return;
                const bldH = (bld.fl || 3) * 18 + 24;
                const isUp = Math.random() > 0.35;
                const color = isUp ? 0x4ade80 : 0xef4444;
                const ax = bld.x + bld.w - 18;
                const ay = gy - bldH + 10;

                this.arrowGfx.beginFill(color, 0.6);
                if (isUp) {
                    this.arrowGfx.moveTo(ax, ay + 8);
                    this.arrowGfx.lineTo(ax + 5, ay);
                    this.arrowGfx.lineTo(ax + 10, ay + 8);
                } else {
                    this.arrowGfx.moveTo(ax, ay);
                    this.arrowGfx.lineTo(ax + 5, ay + 8);
                    this.arrowGfx.lineTo(ax + 10, ay);
                }
                this.arrowGfx.closePath();
                this.arrowGfx.endFill();

                this.arrowGfx.beginFill(color, 0.5);
                this.arrowGfx.drawRect(ax - 2, ay + (isUp ? 10 : -6), 14, 6);
                this.arrowGfx.endFill();
            });
        }
    }
};
