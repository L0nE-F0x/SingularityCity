/* Pixel art — the city building itself. A lab HQ whose lab released a model in the last
   two weeks carries a tower crane on its roof (slewing slowly, the trolley running out
   along the jib, the hook and its load rising and falling, aviation lights at night); a
   release in the last five days also wraps the top floors in scaffolding and a net.
   A building that gains a floor during the session gets the same treatment for ten
   minutes. Everything is sprites on top of the cached facade, so bakes are untouched. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, dark, light } = PL;

    const YEL = 0xf2c230;
    const YEL_D = 0xb8901a;
    const texCache = {};

    // Mast (lattice) of height h with the slewing cab on top; origin bottom-left.
    function mastImg(h) {
        const img = new Img(5, h + 4);
        for (let y = 4; y < h + 4; y++) {
            img.set(1, y, YEL);
            img.set(3, y, YEL_D);
            if ((y - 4) % 4 === 0) img.set(2, y, YEL);
            else if ((y - 4) % 4 === 2) img.set(2, y, YEL_D);
        }
        // Cab with a window.
        img.rect(0, 1, 5, 3, 0x3a3a44);
        img.rect(1, 2, 2, 1, 0x9ac8e0);
        img.set(4, 1, 0x5a5a64);
        // A-frame apex.
        img.set(2, 0, YEL);
        return img;
    }
    // Jib to the right (length L) and counter-jib to the left (length C) with weights.
    function jibImg(L, C) {
        const img = new Img(L + C, 4);
        for (let x = 0; x < L + C; x++) {
            img.set(x, 1, YEL);
            img.set(x, 3, YEL_D);
            if (x % 3 === 0) img.set(x, 2, YEL);
        }
        // Counterweights on the short side.
        img.rect(1, 2, 4, 2, 0x8a8e96);
        img.rect(1, 2, 4, 1, 0xa8acb4);
        // Pendant lines from the apex to both tips.
        for (let x = 0; x < L + C; x++) {
            const d = Math.abs(x - C);
            if (d > 0 && d % 2 === 0 && x > 2 && x < L + C - 1) {
                const y = Math.round((d / (x < C ? C : L)) * 1);
                img.set(x, y, 0x6a6e76, 160);
            }
        }
        return img;
    }
    function trolleyImg() {
        const img = new Img(3, 2);
        img.rect(0, 0, 3, 1, 0x3a3a44);
        img.set(1, 1, 0x5a5a64);
        return img;
    }
    // Hook with a hanging load: a steel beam or a pallet of bricks.
    function loadImg(kind) {
        const img = new Img(7, 4);
        img.set(3, 0, 0xd8dce2);
        img.set(3, 1, 0xf2c230);
        if (kind === 0) {
            img.rect(0, 2, 7, 1, 0xb85a3a);
            img.rect(0, 3, 7, 1, 0x8a3a2a);
        } else {
            img.rect(1, 2, 5, 2, 0xa8604a);
            img.set(2, 2, 0xc87a5a);
            img.set(4, 3, 0xc87a5a);
        }
        return img;
    }
    function scaffoldImg(w, h, seed) {
        const img = new Img(w, h);
        for (let x = 0; x < w; x++)
            for (let y = 0; y < h; y++) {
                // Net: dithered green mesh over most of it.
                if (PL.hash(seed, x >> 3, y >> 2) > 0.25 && (x + y) % 2 === 0) img.set(x, y, 0x3a8a5a, 120);
            }
        for (let x = 0; x < w; x += 6) for (let y = 0; y < h; y++) img.set(x, y, 0x9aa0a8);
        for (let y = 0; y < h; y += 5)
            for (let x = 0; x < w; x++) img.set(x, y, y === 0 ? 0xd8b080 : 0xb08a5a);
        for (let x = 0; x + 6 <= w; x += 12)
            for (let i = 0; i < 6; i++) if (i < h) img.set(x + i, Math.min(h - 1, 1 + i), 0x8a9098);
        return img;
    }
    const tex = (key, fn) => texCache[key] || (texCache[key] = PL.tex(fn()));

    const C = (PL.Construction = {
        _recent: null,
        _recentAt: 0,
        _grownAt: new Map(),
        _lastFloors: new Map(),

        // Days since each lab's newest release (cached for five minutes).
        daysSince(lab) {
            const now = Date.now();
            if (!this._recent || now - this._recentAt > 300000) {
                this._recentAt = now;
                this._recent = {};
                const ms = typeof G !== 'undefined' && G.models ? G.models : [];
                for (const m of ms) {
                    if (!m || !m.lab || !m.rel) continue;
                    const t = Date.parse(m.rel);
                    if (isNaN(t) || t > now + 864e5) continue;
                    const d = (now - t) / 864e5;
                    if (this._recent[m.lab] === undefined || d < this._recent[m.lab]) this._recent[m.lab] = d;
                }
            }
            const d = this._recent[lab];
            return d === undefined ? Infinity : d;
        },
        // Called for every facade bake: notices a building that just gained floors.
        noteFloors(b, booted) {
            const fl = PL.floorsOf(b);
            const prev = this._lastFloors.get(b.id);
            this._lastFloors.set(b.id, fl);
            if (booted && prev !== undefined && fl > prev) this._grownAt.set(b.id, performance.now() / 1000);
        },
        _grew(b) {
            const t = this._grownAt.get(b.id);
            return t !== undefined && performance.now() / 1000 - t < 600;
        },

        // The building's own roof under footprint column x: rooftop signs and masts sit
        // above the roofline (y < 0), so the scan starts there and wants a solid run.
        _roofY(B, x, h) {
            for (let y = 0; y < h; y++) {
                let solid = 0;
                for (let dx = -2; dx <= 2; dx++) if (B.base.alpha(B.X(x + dx), B.Y(y)) > 200) solid++;
                if (solid >= 5) return y;
            }
            return 0;
        },
        // The highest row (from the roofline down) solid across most of the width.
        _roofRow(B, w, h) {
            for (let y = 0; y < h; y++) {
                let solid = 0;
                for (let x = 0; x < w; x++) if (B.base.alpha(B.X(x), B.Y(y)) > 200) solid++;
                if (solid >= w * 0.7) return y;
            }
            return 0;
        },

        // Adds the crane / scaffold sprites to a facade entry when the lab is busy.
        attach(e, B, b, ox, oy, h) {
            if (!b.lab) return;
            const days = this.daysSince(b.lab);
            const grew = this._grew(b);
            if (!grew && days > 14) return;
            const A = PL.ART;
            const w = B.w;
            const at = (x, y) => ({ x: ox + (x + B.padX) * A, y: oy + (y + B.head) * A });
            const side = PL.hash(PL.seedOf(b.id), 1, 2) > 0.5;
            if (grew || days <= 5) {
                const sh = Math.min(h - 4, Math.round(PL.FLOOR * 2));
                const roofY = this._roofRow(B, w, h);
                const s = new PIXI.Sprite(
                    tex('scaf' + w + '|' + sh, () => scaffoldImg(w + 2, sh, PL.seedOf(b.id)))
                );
                const p = at(-1, roofY);
                s.x = p.x;
                s.y = p.y;
                s.scale.set(A);
                e.root.addChild(s);
                e.scaffold = s;
            }
            const cx = Math.round(side ? w * 0.22 : w * 0.78);
            const roofY = this._roofY(B, cx, h);
            const mastH = Math.max(18, Math.min(34, Math.round(B.head * 1.1)));
            const L = Math.max(16, Math.min(34, Math.round(w * 0.45)));
            const Cl = 8;
            const crane = new PIXI.Container();
            const base = at(cx, roofY);
            crane.x = base.x;
            crane.y = base.y;
            const mast = new PIXI.Sprite(tex('mast' + mastH, () => mastImg(mastH)));
            mast.scale.set(A);
            mast.x = -2 * A;
            mast.y = -(mastH + 4) * A;
            const jib = new PIXI.Container();
            jib.y = -(mastH + 3) * A;
            const jibS = new PIXI.Sprite(tex('jib' + L, () => jibImg(L, Cl)));
            jibS.scale.set(A);
            jibS.x = -Cl * A;
            const trolley = new PIXI.Sprite(tex('trolley', trolleyImg));
            trolley.scale.set(A);
            trolley.y = 4 * A;
            const cable = new PIXI.Sprite(PIXI.Texture.WHITE);
            cable.tint = 0x2a2a30;
            cable.width = PL.ART;
            const load = new PIXI.Sprite(tex('load' + (L % 2), () => loadImg(L % 2)));
            load.scale.set(A);
            jib.addChild(jibS, trolley, cable, load);
            const lamp = new PIXI.Sprite(PixelArt._haloTex(4 * PL.S3));
            lamp.anchor.set(0.5);
            lamp.scale.set(A);
            lamp.tint = 0xff4050;
            lamp.blendMode = PIXI.BLEND_MODES.ADD;
            lamp.y = -(mastH + 4) * A;
            crane.addChild(mast, jib, lamp);
            e.root.addChild(crane);
            e.crane = { c: crane, jib: jib, trolley: trolley, cable: cable, load: load, lamp: lamp, L: L };
            e.crane.phase = PL.hash(PL.seedOf(b.id), 3, 4) * 100;
        },

        // Per frame, from PixelArt._apply.
        update(e, K, t, emitA) {
            const cr = e.crane;
            const A = PL.ART;
            if (e.scaffold) e.scaffold.tint = K.amb;
            if (!cr) return;
            const ph = cr.phase;
            // Slewing: the jib turns slowly, foreshortening as it swings toward or away.
            const slew = Math.cos(t * 0.045 + ph);
            cr.jib.scale.x = Math.abs(slew) < 0.18 ? (slew < 0 ? -0.18 : 0.18) : slew;
            const run = 0.25 + 0.65 * (0.5 + 0.5 * Math.sin(t * 0.11 + ph * 2));
            const drop = 5 + 13 * (0.5 + 0.5 * Math.sin(t * 0.17 + ph));
            cr.trolley.x = Math.round(run * cr.L) * A - A;
            cr.cable.x = cr.trolley.x + A;
            cr.cable.y = 6 * A;
            cr.cable.height = Math.round(drop) * A;
            cr.load.x = cr.trolley.x - 2 * A + Math.round(Math.sin(t * 0.9 + ph) * 0.6) * A;
            cr.load.y = cr.cable.y + cr.cable.height - A;
            cr.c.children.forEach((s) => {
                if (s !== cr.lamp) s.tint = K.amb;
            });
            cr.jib.children.forEach((s) => {
                if (s !== cr.cable) s.tint = K.amb;
            });
            cr.lamp.alpha = PL.frac(t / 1.3 + ph) < 0.4 ? 0.35 + emitA * 0.65 : 0;
        },
    });
    void C;
    void dark;
    void light;
})();
