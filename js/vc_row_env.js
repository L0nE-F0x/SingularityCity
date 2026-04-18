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

        // ─── CRYPTEX: Giant neon ₿ logo on the facade (orange glow, pulses at night) ───
        const cryptex = G.bldById['vcrow_cryptex'];
        if (cryptex) {
            const bldH = (cryptex.fl || 8) * 18 + 24;
            const logo = new PIXI.Text('₿', {
                fontFamily: 'Arial, sans-serif', fontSize: 72, fontWeight: '900',
                fill: 0xf7931a, stroke: 0xffa940, strokeThickness: 2,
                dropShadow: true, dropShadowColor: 0xf7931a, dropShadowBlur: 18, dropShadowDistance: 0
            });
            logo.anchor.set(0.5, 0.5);
            logo.x = cryptex.x + cryptex.w / 2;
            logo.y = gy - bldH / 2 - 6;
            logo.blendMode = PIXI.BLEND_MODES.ADD;
            logo._basePulse = Math.random() * Math.PI * 2;
            charLayer.addChild(logo);
            this.cryptexLogo = logo;
        }
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

        // ─── CRYPTEX LOGO PULSE (brighter at night, gentle throb always) ───
        // Re-sync x/y every frame so the logo tracks the Cryptex building even if
        // the city re-zones later (new labs pushing VC Row rightward, etc.). Using
        // absolute world coords set at buildAnimations time caused the logo to land
        // on whatever building happened to occupy the stale x after re-zoning.
        if (this.cryptexLogo && !this.cryptexLogo.destroyed) {
            const cryptex = G.bldById['vcrow_cryptex'];
            if (cryptex) {
                const bldH = (cryptex.fl || 8) * 18 + 24;
                this.cryptexLogo.x = cryptex.x + cryptex.w / 2;
                this.cryptexLogo.y = G.groundY - bldH / 2 - 6;
            }
            const isNight = dp < 0.25 || dp > 0.83;
            const throb = 0.85 + Math.sin(G.tick * 0.05 + this.cryptexLogo._basePulse) * 0.15;
            this.cryptexLogo.alpha = (isNight ? 1.0 : 0.65) * throb;
        }

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
