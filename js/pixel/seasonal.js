/* Pixel art — seasonal props drawn as pixel sprites instead of vector blobs. Halloween:
   jack-o'-lanterns by the doors whose carved faces glow and flicker after dark, and bats
   circling the tallest towers at night. SeasonalEnv decides where props go (same rules as
   the classic overlay) and hands them over; this module draws and animates them. */
(function () {
    'use strict';
    const PL = window.PL;
    const { hash } = PL;

    // '#' rind, 'd' rind shade, 'h' rind highlight, 'r' rib, 's' stem, 'f' carved face.
    const PUMPKINS = {
        big: ['...ss..', '.dhhh#.', 'dhf#f##', 'd##r###', 'dfffff#', '.dd##d.'],
        small: ['..s..', '.hh#.', 'hf#f#', 'dfff#', '.dd#.'],
    };
    const PAL = { '#': 0xe8761a, d: 0xa84e0e, h: 0xffa548, r: 0xc8600e, s: 0x4a5a1a, f: 0x3a1606 };
    const texCache = {};
    function pumpkinTex(kind, glow) {
        const key = kind + (glow ? 'g' : '');
        if (texCache[key]) return texCache[key];
        const rows = PUMPKINS[kind];
        const img = new PL.Img(rows[0].length, rows.length);
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                if (ch === '.') continue;
                if (glow) {
                    if (ch === 'f') img.set(x, y, 0xffd45a);
                } else img.set(x, y, PAL[ch]);
            }
        });
        texCache[key] = PL.tex(img);
        return texCache[key];
    }

    const SEA = (PL.Seasonal = {
        cont: null,
        pumpkins: [],
        bats: [],
        halloween: false,

        _ensure() {
            if (!G.world) return null;
            if (!this.cont || this.cont.destroyed) {
                this.cont = new PIXI.Container();
                this.cont.name = 'pixelSeasonal';
                this.cont.eventMode = 'none';
            }
            // Just above the classic seasonal overlay (which sits on top of the ground).
            const ov = typeof SeasonalEnv !== 'undefined' ? SeasonalEnv._overlayGfx : null;
            if (ov && ov.parent === G.world) G.world.addChildAt(this.cont, G.world.getChildIndex(ov) + 1);
            else if (this.cont.parent !== G.world) G.world.addChild(this.cont);
            return this.cont;
        },

        clear() {
            if (this.cont && !this.cont.destroyed) this.cont.removeChildren().forEach((c) => c.destroy());
            this.pumpkins = [];
            this.bats = [];
            this.halloween = false;
        },

        // props: [{ kind: 'pumpkin', x, y, seed }]
        build(props, halloween) {
            this.clear();
            if (!props.length && !halloween) return;
            const cont = this._ensure();
            if (!cont) return;
            const A = PL.ART;
            this.halloween = !!halloween;
            props.forEach((p) => {
                if (p.kind !== 'pumpkin') return;
                const h = hash(p.seed, 3, 1);
                // A single big one, a small one, or a big one with a small one beside it.
                const set = h < 0.45 ? ['big'] : h < 0.7 ? ['small'] : ['big', 'small'];
                set.forEach((kind, k) => {
                    const g = new PIXI.Container();
                    const base = new PIXI.Sprite(pumpkinTex(kind, false));
                    const face = new PIXI.Sprite(pumpkinTex(kind, true));
                    face.blendMode = PIXI.BLEND_MODES.ADD;
                    const halo = new PIXI.Sprite(PixelArt._haloTex(6));
                    halo.anchor.set(0.5);
                    halo.tint = 0xffa030;
                    halo.blendMode = PIXI.BLEND_MODES.ADD;
                    [base, face].forEach((s) => s.scale.set(A));
                    halo.scale.set(A);
                    const w = PUMPKINS[kind][0].length;
                    const hh = PUMPKINS[kind].length;
                    halo.x = (w * A) / 2;
                    halo.y = (hh * A) / 2;
                    g.addChild(halo, base, face);
                    g.x = Math.round((p.x + k * 9) / A) * A;
                    g.y = Math.round((p.y - 2 - hh * A) / A) * A;
                    g.face = face;
                    g.halo = halo;
                    g.phase = hash(p.seed, k, 7) * 10;
                    cont.addChild(g);
                    this.pumpkins.push(g);
                });
            });
            if (halloween) this._makeBats(cont);
        },

        // Bats circle the tops of the tallest towers.
        _makeBats(cont) {
            if (typeof BLDS === 'undefined' || !PL.Fauna) return;
            const tall = BLDS.filter((b) => b && b.w && b.x)
                .map((b) => ({ b: b, fl: b.dynamicFl || b.fl || 1 }))
                .sort((a, z) => z.fl - a.fl)
                .slice(0, 8);
            tall.forEach((t, i) => {
                const n = 2 + (i % 2);
                for (let k = 0; k < n; k++) {
                    const s = PL.Fauna.sprite('batMid');
                    s.anchorB = t.b;
                    s.rx = 30 + hash(i, k, 11) * 70;
                    s.ry = 10 + hash(i, k, 12) * 22;
                    s.spd = (0.5 + hash(i, k, 13) * 0.6) * (hash(i, k, 14) > 0.5 ? 1 : -1);
                    s.ph = hash(i, k, 15) * PL.TAU;
                    s.flap = 0.35 + hash(i, k, 16) * 0.2;
                    cont.addChild(s);
                    this.bats.push(s);
                }
            });
        },

        // Every frame from PixelArt.update.
        update(K, t) {
            if (!this.pumpkins.length && !this.bats.length) return;
            const night = PL.clamp(K.night * 1.3 - 0.15, 0, 1);
            for (const g of this.pumpkins) {
                // Candle flicker, out by day.
                const fl = 0.78 + 0.22 * Math.sin(t * 9 + g.phase) * Math.sin(t * 5.3 + g.phase * 2);
                g.face.alpha = night * fl;
                g.halo.alpha = night * fl * 0.55;
            }
            if (!this.bats.length) return;
            const show = night > 0.35;
            const gy = G.groundY;
            for (const s of this.bats) {
                s.visible = show;
                if (!show) continue;
                const b = s.anchorB;
                const top = gy - 24 - (b.dynamicFl || b.fl || 1) * 18;
                const a = t * s.spd + s.ph;
                s.x = b.x + b.w / 2 + Math.cos(a) * s.rx;
                s.y = top - 26 - s.ry + Math.sin(a * 1.7) * s.ry;
                s.scale.x = Math.sin(a) * s.spd > 0 ? -1 : 1;
                s._px.texture = PL.Fauna.wing('bat', t * 18 * s.flap + s.ph);
            }
        },
    });
    void SEA;
})();
