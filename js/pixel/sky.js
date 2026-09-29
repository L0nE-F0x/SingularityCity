/* Pixel art — the sky. A screen-space dithered gradient (the lofi palette from
   PL.tod), pinned to the horizon, with pixel stars, the sun, and the moon drawn at
   its real phase (CityAmbience.getMoonPhase). It sits behind G.world on the stage and
   replaces the DOM sky gradient, the classic star field and the sun/moon Graphics,
   which are hidden while the skin is on. Clouds keep their classic objects (position,
   drift, weather-driven alpha) with pixel clouds drawn inside them. */
(function () {
    'use strict';
    const PL = window.PL;
    const { hash, mix, shade } = PL;

    const SKY = (PL.Sky = {
        sprite: null,
        img: null,
        tex: null,
        key: '',
        topPad: 0,
        cloudTex: {},

        _ensure(w, h) {
            if (this.img && this.img.w === w && this.img.h === h) return;
            if (this.tex) this.tex.destroy(true);
            this.img = new PL.Img(w, h);
            this.tex = PL.tex(this.img.c);
            if (!this.sprite) {
                this.sprite = new PIXI.Sprite(this.tex);
                this.sprite.name = 'pixelSky';
                G.app.stage.addChildAt(this.sprite, 0);
            } else this.sprite.texture = this.tex;
        },

        // Moon disc with the terminator for phase p (0 new → 0.5 full → 1 new).
        _moon(img, cx, cy, r, p, a) {
            const k = Math.cos(PL.TAU * p);
            const waxing = p < 0.5;
            for (let y = -r; y <= r; y++)
                for (let x = -r; x <= r; x++) {
                    const d = Math.hypot(x, y) / r;
                    if (d > 1) continue;
                    const edge = Math.sqrt(Math.max(0, 1 - (y / r) ** 2)) * r;
                    const sx = waxing ? x : -x;
                    const lit = sx > k * edge;
                    let c = lit
                        ? PL.dpick([0xc8c4b0, 0xe8e2cc, 0xfaf4de], 0.55 + (-x - y) / (3 * r), cx + x, cy + y)
                        : 0x3a4356;
                    if (lit && hash(77, x, y) > 0.84 && d < 0.8) c = shade(c, 0.88);
                    img.blend(cx + x, cy + y, c, a * (lit ? 1 : 0.55));
                }
        },
        _sun(img, cx, cy, r, K) {
            for (let y = -r - 5; y <= r + 5; y++)
                for (let x = -r - 5; x <= r + 5; x++) {
                    const d = Math.hypot(x, y) / r;
                    if (d <= 1)
                        img.blend(
                            cx + x,
                            cy + y,
                            d > 0.78 && PL.bayer(x, y) > 0.45 ? 0xffe8b0 : 0xfff6dc,
                            K.sun
                        );
                    else if (d < 1.6 && PL.bayer(cx + x, cy + y) < (1.6 - d) * 0.6)
                        img.blend(cx + x, cy + y, 0xfff0c8, K.sun * 0.5);
                }
        },

        paint(K, horizonY, t) {
            const img = this.img;
            const top = horizonY - 260;
            const ramp = K.sky;
            const u = img.u;
            const w = img.w;
            const cols = ramp.map(
                (c) => (0xff000000 | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0
            );
            for (let y = 0; y < img.h; y++) {
                const tt = PL.clamp((y - top) / (horizonY - top), 0, 1);
                const v = Math.pow(tt, 1.35) * (ramp.length - 1);
                const k0 = Math.floor(v);
                const f = v - k0;
                const row = y * w;
                for (let x = 0; x < w; x++)
                    u[row + x] = cols[f > PL.bayer(x, y) ? Math.min(k0 + 1, ramp.length - 1) : k0];
            }
            if (K.stars > 0.02)
                for (let y = 0; y < Math.min(img.h, horizonY - 30); y++)
                    for (let x = 0; x < w; x++) {
                        const hh = hash(911, x, y);
                        if (hh < 1 - 0.0022 * K.stars) continue;
                        const tw = 0.5 + 0.5 * Math.sin(t * (1 + hash(3, x, y) * 3) + hh * 99);
                        img.set(
                            x,
                            y,
                            hh > 0.99975 ? 0xfff6e0 : mix(ramp[1], 0xe8e8f8, 0.35 + tw * 0.5 * K.stars)
                        );
                    }
            // Peak of the arc stays below the top toolbar (topPad sky pixels).
            const arcH = PL.clamp(horizonY - 20 - this.topPad, 0, 170);
            if (K.sun > 0.02 && K.sunT > 0 && K.sunT < 1)
                this._sun(
                    img,
                    Math.round(w * (0.08 + K.sunT * 0.84)),
                    Math.round(horizonY - 18 - Math.sin(K.sunT * Math.PI) * arcH),
                    6,
                    K
                );
            if (K.moonA > 0.02 && K.moonT > 0 && K.moonT < 1) {
                const p =
                    typeof CityAmbience !== 'undefined' && CityAmbience.getMoonPhase
                        ? CityAmbience.getMoonPhase()
                        : 0.5;
                this._moon(
                    img,
                    Math.round(w * (0.08 + K.moonT * 0.84)),
                    Math.round(horizonY - 18 - Math.sin(K.moonT * Math.PI) * arcH * 0.9),
                    7,
                    p,
                    K.moonA
                );
            }
            img.done();
            this.tex.baseTexture.update();
        },

        // Called every frame from PixelArt.update.
        update(K, t) {
            if (!G.app || !G.world) return;
            const A = PL.ART;
            const zoom = G.world.scale.x || 1;
            const s = A * zoom;
            const w = Math.ceil(G.vpW / s) + 1;
            const h = Math.ceil(G.vpH / s) + 1;
            this._ensure(w, h);
            const xray = typeof XRayMode !== 'undefined' && XRayMode.active;
            this.sprite.visible = G.world.visible && !xray;
            this.sprite.scale.set(s);
            // Horizon: the pavement line (groundY − 24) on screen, in sky pixels.
            const horizon = Math.round((G.world.y + (G.groundY - 24) * zoom) / s);
            this.topPad = Math.ceil(100 / s) + 8;
            const key = [w, h, horizon, Math.round(K.dp * 1440), Environment.weather, Math.floor(t * 2)].join(
                '|'
            );
            if (key !== this.key) {
                this.key = key;
                this.paint(K, horizon, t);
            }
            if (Environment.starsLayer) Environment.starsLayer.visible = false;
            if (Environment.celestialGfx) Environment.celestialGfx.visible = false;
            this._clouds(K);
        },

        _cloudTexFor(wArt) {
            const bucket = Math.max(10, Math.round(wArt / 4) * 4);
            if (!this.cloudTex[bucket]) {
                const h = Math.max(5, Math.round(bucket * 0.3));
                const cl = PL.S.cloud(bucket, h, 101 + bucket);
                this.cloudTex[bucket] = { body: PL.tex(cl.body), rim: PL.tex(cl.rim), w: bucket, h: h };
            }
            return this.cloudTex[bucket];
        },
        // Classic clouds keep their objects; each gets a pixel cloud (body + lit rim).
        _clouds(K) {
            const layer = Environment.cloudLayer;
            if (!layer) return;
            const A = PL.ART;
            layer.children.forEach((c) => {
                if (!c._pxCloud) {
                    if (!(c instanceof PIXI.Graphics)) return;
                    const T = this._cloudTexFor(((c._w || 60) * 1.6) / A);
                    c.clear();
                    const body = new PIXI.Sprite(T.body);
                    const rim = new PIXI.Sprite(T.rim);
                    [body, rim].forEach((sp) => {
                        sp.scale.set(A);
                        sp.x = Math.round((-T.w * A) / 2);
                        sp.y = Math.round(-T.h * A * 0.7);
                        c.addChild(sp);
                    });
                    c._pxCloud = { body: body, rim: rim };
                }
                c._pxCloud.body.tint = K.cloud;
                c._pxCloud.rim.tint = K.rim;
            });
        },
    });
    void SKY;
})();
