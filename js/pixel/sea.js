/* Pixel art — the harbour underwater, the first thing a new visitor sees (the camera opens
   on the port). The classic paints a flat navy box with corals along the bottom; on top of
   it this adds a lit water column, sun shafts and caustics by day, a kelp forest swaying
   in the swell, a seabed of rocks, shells and a half-buried GPU shipping container, the
   subsea fibre cable with light pulses running along it, bubbles from the vents, and at
   night glowing jellyfish and plankton. It sits above the ground and under the fish. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, hash, bayer, mix } = PL;

    const texCache = {};
    const tex = (key, fn) => texCache[key] || (texCache[key] = PL.tex(fn()));

    function shaftImg(w, h, slant) {
        const img = new Img(w + Math.ceil(h * slant) + 2, h);
        for (let y = 0; y < h; y++) {
            const t = y / h;
            const half = 1.5 + t * (w / 2);
            const cx = w / 2 + y * slant;
            for (let x = 0; x < img.w; x++) {
                const d = Math.abs(x - cx) / half;
                if (d > 1) continue;
                const a = Math.pow(1 - t, 1.4) * (1 - d) * 0.55;
                const q = Math.floor(a * 4 + bayer(x, y)) / 4;
                if (q > 0) img.set(x, y, 0xffffff, q * 255);
            }
        }
        return img;
    }
    function causticImg(w, h) {
        const img = new Img(w, h);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const v = Math.abs(
                    Math.sin((x / w) * Math.PI * 6 + Math.sin((y / h) * Math.PI * 2 + (x / w) * 9) * 1.6) *
                        Math.sin((y / h) * Math.PI * 3 + (x / w) * Math.PI * 4)
                );
                if (v > 0.86) img.set(x, y, 0xffffff, (1 - y / h) * 220);
            }
        return img;
    }
    function glowColumnImg(h) {
        const img = new Img(8, h);
        for (let y = 0; y < h; y++) {
            const a = Math.pow(1 - y / h, 1.6) * 0.6;
            for (let x = 0; x < 8; x++) {
                const q = Math.floor(a * 5 + bayer(x, y)) / 5;
                if (q > 0) img.set(x, y, 0xffffff, q * 255);
            }
        }
        return img;
    }
    // Kelp segment: a stem with a blade on one side.
    function kelpSeg(side, tone) {
        const img = new Img(5, 3);
        const stem = [0x2a5a32, 0x2e6a3a][tone];
        const leaf = [0x3a8a46, 0x4ea05a][tone];
        img.set(2, 0, stem);
        img.set(2, 1, stem);
        img.set(2, 2, stem);
        if (side > 0) {
            img.set(3, 0, leaf);
            img.set(4, 1, leaf);
            img.set(3, 1, mix(leaf, 0xa8e070, 0.2));
        } else {
            img.set(1, 1, leaf);
            img.set(0, 2, leaf);
            img.set(1, 2, mix(leaf, 0xa8e070, 0.2));
        }
        return img;
    }
    // The seabed strip: rocks, shells, a starfish or two and sand ripples.
    function seabedImg(w, seed) {
        const h = 14;
        const img = new Img(w, h);
        for (let x = 0; x < w; x++) {
            // Ripples.
            if ((x + Math.floor(hash(seed, x >> 3, 1) * 3)) % 7 === 0) img.set(x, h - 4, 0x5a4a34);
            if (hash(seed, x, 2) > 0.96) img.set(x, h - 2, 0x8a7a5a);
        }
        const R = PL.rng(seed);
        for (let i = 0; i < w / 18; i++) {
            const x = Math.floor(R() * w);
            const r = 2 + R() * 4;
            const col = R() > 0.5 ? 0x4a4a52 : 0x5a4a40;
            for (let y = -Math.ceil(r); y <= 0; y++)
                for (let dx = -Math.ceil(r * 1.4); dx <= Math.ceil(r * 1.4); dx++) {
                    if ((dx / (r * 1.4)) ** 2 + (y / r) ** 2 > 1) continue;
                    const lit = -dx / (r * 1.4) - y / r;
                    img.set(
                        x + dx,
                        h - 3 + y,
                        lit > 0.5 ? PL.light(col, 0.25) : lit < -0.3 ? PL.dark(col, 0.3) : col
                    );
                }
            if (R() > 0.6) {
                // Starfish or a shell beside the rock.
                const sx = x + Math.round(r * 1.6) + 2;
                const sc = R() > 0.5 ? 0xff7a5a : 0xf2d8b0;
                img.set(sx, h - 4, sc);
                img.set(sx - 1, h - 3, sc);
                img.set(sx + 1, h - 3, sc);
                img.set(sx, h - 3, PL.light(sc, 0.2));
            }
        }
        return img;
    }
    // A half-buried 40-ft container of GPUs, rusting.
    function containerImg() {
        const w = 26;
        const h = 9;
        const img = new Img(w, h);
        const rust = 0x8a4a2a;
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                let c = x % 2 ? rust : PL.dark(rust, 0.15);
                if (y === 0) c = PL.light(rust, 0.2);
                if (hash(5, x, y) > 0.86) c = 0x5a3a2a;
                if (hash(7, x >> 1, y) > 0.92) c = 0x3a6a4a; // weed
                img.set(x, y, c);
            }
        PL.text(img, 'H100', 4, 2, 0xd8c8a8, 3);
        img.rect(w - 3, 1, 1, h - 2, 0x4a2a1a); // doors
        img.rect(w - 6, 1, 1, h - 2, 0x4a2a1a);
        return img;
    }
    function jellyImg(open) {
        const img = new Img(7, 8);
        const bell = open ? ['.#####.', '#######', '#.#.#.#'] : ['..###..', '.#####.', '.#.#.#.'];
        bell.forEach((row, y) => {
            for (let x = 0; x < 7; x++) if (row[x] === '#') img.set(x, y, 0xffffff, y === 0 ? 255 : 200);
        });
        for (let y = 3; y < 8; y++)
            for (const x of [1, 3, 5]) if ((x + y) % 2 === 0 || y < 5) img.set(x, y, 0xffffff, 150 - y * 12);
        return img;
    }
    // Fish in greyscale (tinted by the school colour), facing right.
    const FISH = [
        ['w..ww.', 'wwwwwk', 'l..ll.'],
        ['..w..', '.www.', 'wwwwk', '.lll.', '..l..'],
        ['w...www.', 'wwwwwwwk', 'w...lll.'],
    ];
    function fishImg(k) {
        const rows = FISH[k];
        const img = new Img(rows[0].length, rows.length);
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                if (ch === 'w') img.set(x, y, 0xffffff);
                else if (ch === 'l') img.set(x, y, 0xc8d0d8);
                else if (ch === 'k') img.set(x, y, 0x1a1a24);
            }
        });
        return img;
    }

    const SEA = (PL.Sea = {
        cont: null,
        key: '',
        fishTex(k) {
            return tex('fish' + k, () => fishImg(k));
        },

        _bounds() {
            const port = (typeof BLDS !== 'undefined' ? BLDS : []).filter(
                (b) => b && b.id && b.id.startsWith('port_')
            );
            if (!port.length) return null;
            let x0 = Infinity;
            let x1 = 0;
            port.forEach((b) => {
                x0 = Math.min(x0, b.x);
                x1 = Math.max(x1, b.x + b.w);
            });
            return { x0: Math.max(0, x0 - 80), x1: x1 };
        },

        _build(bd) {
            if (this.cont && !this.cont.destroyed) this.cont.destroy({ children: true });
            const A = PL.ART;
            const gy = G.groundY;
            const W = bd.x1 - bd.x0;
            const c = (this.cont = new PIXI.Container());
            c.name = 'pixelSea';
            c.eventMode = 'none';
            c.x = bd.x0;
            this.items = { kelp: [], shafts: [], bubbles: [], jellies: [], pulses: [], plankton: [] };
            const I = this.items;
            // Daylight in the water column (additive, fades with depth).
            I.glow = new PIXI.TilingSprite(
                tex('seaGlow', () => glowColumnImg(60)),
                Math.ceil(W / A),
                60
            );
            I.glow.scale.set(A);
            I.glow.y = gy + 32;
            I.glow.blendMode = PIXI.BLEND_MODES.ADD;
            I.glow.tint = 0x1a6a88;
            c.addChild(I.glow);
            // Sun shafts.
            for (let i = 0; i < Math.max(3, Math.round(W / 220)); i++) {
                const s = new PIXI.Sprite(tex('shaft', () => shaftImg(12, 80, 0.22)));
                s.scale.set(A);
                s.blendMode = PIXI.BLEND_MODES.ADD;
                s.tint = 0xbff0ff;
                s.home = (i + 0.3 + hash(3, i, 1) * 0.5) * (W / Math.max(3, Math.round(W / 220)));
                s.y = gy + 32;
                s.ph = hash(3, i, 2) * 10;
                c.addChild(s);
                I.shafts.push(s);
            }
            // Caustic shimmer just under the surface.
            I.caustic = new PIXI.TilingSprite(
                tex('caustic', () => causticImg(64, 14)),
                Math.ceil(W / A),
                14
            );
            I.caustic.scale.set(A);
            I.caustic.y = gy + 34;
            I.caustic.blendMode = PIXI.BLEND_MODES.ADD;
            I.caustic.tint = 0x9adcf0;
            c.addChild(I.caustic);
            // Seabed details and the container.
            const bed = new PIXI.Sprite(tex('seabed' + Math.round(W), () => seabedImg(Math.ceil(W / A), 21)));
            bed.scale.set(A);
            bed.y = gy + 232 - 14 * A + 6;
            c.addChild(bed);
            I.bed = bed;
            const box = new PIXI.Sprite(tex('box', containerImg));
            box.scale.set(A);
            box.x = Math.round((W * 0.62) / A) * A;
            box.y = gy + 224 - 9 * A + 8;
            c.addChild(box);
            I.box = box;
            // The subsea fibre cable along the bottom, with light pulses.
            const cable = new PIXI.Sprite(PIXI.Texture.WHITE);
            cable.width = W;
            cable.height = A;
            cable.y = gy + 238;
            cable.tint = 0x1a1e26;
            c.addChild(cable);
            I.cable = cable;
            for (let i = 0; i < 4; i++) {
                const p = new PIXI.Sprite(PixelArt._haloTex(4 * PL.S3));
                p.anchor.set(0.5);
                p.scale.set(A);
                p.blendMode = PIXI.BLEND_MODES.ADD;
                p.tint = 0x4ff0ff;
                p.y = gy + 238 + A / 2;
                p.off = i / 4;
                c.addChild(p);
                I.pulses.push(p);
            }
            // Kelp forest.
            const R = PL.rng(77);
            const nK = Math.round(W / 44);
            for (let i = 0; i < nK; i++) {
                const k = new PIXI.Container();
                k.x = Math.round(((i + R() * 0.8) * (W / nK)) / A) * A;
                k.y = gy + 228;
                const segs = 7 + Math.floor(Math.pow(R(), 1.6) * 26);
                const tone = R() > 0.5 ? 1 : 0;
                k.segs = [];
                for (let s = 0; s < segs; s++) {
                    const sp = new PIXI.Sprite(
                        tex('kelp' + (s % 2) + tone, () => kelpSeg(s % 2 ? 1 : -1, tone))
                    );
                    sp.scale.set(A);
                    sp.y = -(s + 1) * 3 * A;
                    sp.x = -2 * A;
                    k.addChild(sp);
                    k.segs.push(sp);
                }
                k.ph = R() * 10;
                k.amp = 2 + R() * 4;
                c.addChild(k);
                I.kelp.push(k);
            }
            // Bubbles from three vents.
            const vents = [0.18, 0.47, 0.81].map((f) => W * f);
            for (let i = 0; i < 30; i++) {
                const b = new PIXI.Sprite(PixelArt._haloTex(3));
                b.anchor.set(0.5);
                b.scale.set(A * 0.6);
                b.tint = 0xd8f4ff;
                b.vent = vents[i % 3];
                b.t0 = Math.random() * 6;
                c.addChild(b);
                I.bubbles.push(b);
            }
            // Night: jellyfish and plankton.
            const jcols = [0xff7ad8, 0x7ae8ff, 0xb08aff, 0xffb07a];
            for (let i = 0; i < Math.max(3, Math.round(W / 260)); i++) {
                const j = new PIXI.Container();
                j.body = new PIXI.Sprite(tex('jelly0', () => jellyImg(false)));
                j.body.scale.set(A);
                j.body.blendMode = PIXI.BLEND_MODES.ADD;
                j.halo = new PIXI.Sprite(PixelArt._haloTex(10));
                j.halo.anchor.set(0.5);
                j.halo.scale.set(A);
                j.halo.blendMode = PIXI.BLEND_MODES.ADD;
                j.halo.x = 3.5 * A;
                j.halo.y = 2 * A;
                j.addChild(j.halo, j.body);
                const col = jcols[i % jcols.length];
                j.body.tint = col;
                j.halo.tint = col;
                j.hx = (0.15 + 0.7 * hash(9, i, 1)) * W;
                j.hy = gy + 90 + hash(9, i, 2) * 90;
                j.ph = hash(9, i, 3) * 10;
                c.addChild(j);
                I.jellies.push(j);
            }
            for (let i = 0; i < 40; i++) {
                const p = new PIXI.Sprite(PIXI.Texture.WHITE);
                p.width = A;
                p.height = A;
                p.blendMode = PIXI.BLEND_MODES.ADD;
                p.tint = i % 3 ? 0x6af0ff : 0x9affc8;
                p.x = Math.round((hash(11, i, 1) * W) / A) * A;
                p.y = Math.round((gy + 50 + hash(11, i, 2) * 170) / A) * A;
                p.ph = hash(11, i, 3) * 10;
                c.addChild(p);
                I.plankton.push(p);
            }
            this.W = W;
        },

        _place() {
            const g = PixelArt._ground;
            const under = G.trainLayer && G.trainLayer.parent === G.world ? G.trainLayer : null;
            if (!this.cont || !G.world) return;
            const want =
                g && !g.destroyed && g.parent === G.world
                    ? G.world.getChildIndex(g) + 1
                    : under
                      ? G.world.getChildIndex(under)
                      : -1;
            if (want < 0) return;
            const cur = this.cont.parent === G.world ? G.world.getChildIndex(this.cont) : -1;
            if (cur !== want && cur !== want - 1)
                G.world.addChildAt(this.cont, Math.min(want, G.world.children.length));
        },

        // Every frame from PixelArt.update.
        update(K, t) {
            if (!G.world || !G.groundY) return;
            if (G.tick % 60 === 0 || !this.cont) {
                const bd = this._bounds();
                if (!bd) return;
                const key = bd.x0 + '|' + bd.x1 + '|' + G.groundY;
                if (key !== this.key || !this.cont || this.cont.destroyed) {
                    this.key = key;
                    this._build(bd);
                }
                this._place();
            }
            const c = this.cont;
            if (!c) return;
            const z = G.world.scale.x || 1;
            const left = -G.world.x / z;
            const right = left + G.vpW / z;
            c.visible = right > c.x - 100 && left < c.x + this.W + 100;
            if (!c.visible) return;
            const I = this.items;
            const A = PL.ART;
            const day = PL.clamp(1 - K.night * 1.3, 0, 1);
            const dark = PL.clamp(K.night * 1.2 - 0.2, 0, 1);
            const amb = mix(K.amb, 0xffffff, 0.25);
            I.glow.alpha = 0.18 + day * 0.42;
            I.caustic.alpha = day * 0.32;
            I.caustic.tilePosition.x = Math.round(t * 3) % 64;
            I.shafts.forEach((s) => {
                s.x = Math.round((s.home + Math.sin(t * 0.13 + s.ph) * 8) / A) * A;
                s.alpha = day * (0.35 + 0.25 * Math.sin(t * 0.21 + s.ph));
            });
            I.bed.tint = amb;
            I.box.tint = amb;
            I.kelp.forEach((k) => {
                const n = k.segs.length;
                for (let s = 0; s < n; s++) {
                    const f = Math.pow((s + 1) / n, 1.5);
                    k.segs[s].x =
                        -2 * A + Math.round((Math.sin(t * 0.7 + k.ph + s * 0.22) * k.amp * f) / 1) * A;
                    k.segs[s].tint = amb;
                }
            });
            I.pulses.forEach((p) => {
                p.x = PL.frac(t * 0.05 + p.off) * this.W;
                p.alpha = 0.5 + 0.5 * dark;
            });
            const gy = G.groundY;
            I.bubbles.forEach((b) => {
                const age = (t + b.t0) % 6;
                b.x = Math.round((b.vent + Math.sin(age * 4 + b.t0) * 3) / A) * A;
                b.y = Math.round((gy + 226 - age * 32) / A) * A;
                b.alpha = age < 5.6 && b.y > gy + 40 ? 0.7 : 0;
            });
            I.jellies.forEach((j, i) => {
                j.visible = dark > 0.05;
                if (!j.visible) return;
                const pulse = PL.frac(t * 0.5 + j.ph) < 0.5;
                j.body.texture = tex('jelly' + (pulse ? 1 : 0), () => jellyImg(pulse));
                j.x = Math.round((j.hx + Math.sin(t * 0.08 + j.ph) * 30) / A) * A;
                j.y = Math.round((j.hy + Math.sin(t * 0.3 + j.ph) * 16 - (pulse ? 1 : 0)) / A) * A;
                j.body.alpha = dark * 0.9;
                j.halo.alpha = dark * 0.35;
                void i;
            });
            I.plankton.forEach((p) => {
                p.alpha = dark * (PL.frac(t * 0.7 + p.ph) < 0.3 ? 0.9 : 0.15);
            });
        },
    });
    void SEA;
})();
