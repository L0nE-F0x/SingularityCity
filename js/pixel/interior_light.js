/* Pixel art — interior light. Two things, both visual only:
   · Ceiling lamps for the floor-stacked interiors (InteriorCity: every lab HQ and the social
     strip): a small fixture under each ceiling with a stepped, dithered cone of warm light
     and a pool on the floor, drawn additively over the room so desks and robots catch it.
     Brighter at night, faint by day.
   · A lofi grade over the whole interior layer: lifted violet shadows, a touch of warmth,
     a little contrast, so night rooms feel lamp-lit instead of grey.
   Lamps sit in their own container at the top of the module's scene; nothing reads them. */
(function () {
    'use strict';
    const PL = window.PL;

    const GRADE_FRAG = `
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        uniform float uWarm;
        uniform float uLift;
        void main(void) {
            vec4 c = texture2D(uSampler, vTextureCoord);
            if (c.a < 0.004) { gl_FragColor = c; return; }
            vec3 rgb = c.rgb / c.a;
            float l = dot(rgb, vec3(0.299, 0.587, 0.114));
            rgb *= mix(vec3(1.0), vec3(1.07, 1.0, 0.9), uWarm);
            rgb += (1.0 - l) * (1.0 - l) * uLift * vec3(0.09, 0.05, 0.15);
            rgb = (rgb - 0.5) * 1.06 + 0.5;
            gl_FragColor = vec4(clamp(rgb, 0.0, 1.0) * c.a, c.a);
        }`;

    const L = (PL.InteriorLight = {
        lamps: [],
        _coneTex: null,
        _poolTex: null,
        _filter: null,

        _tex() {
            if (this._coneTex) return;
            const A = PL.ART;
            this._coneTex = PL.tex(PL.cone(Math.round(64 / A), Math.round(66 / A), 0xffb060, 0.42));
            this._poolTex = PL.tex(PL.haloE(Math.round(34 / A), Math.round(4 / A), 0xffc070, 0.45, 1.3, 4));
        },

        // floors: [{ y: top of the floor (scene px), h: floor height }], x0/x1: usable span.
        addLamps(scene, x0, x1, floors, opts) {
            if (typeof PixelArt === 'undefined' || !PixelArt.enabled || !scene) return;
            opts = opts || {};
            this._tex();
            const A = PL.ART;
            const cont = new PIXI.Container();
            cont.name = 'pixelLamps';
            cont.eventMode = 'none';
            cont.zIndex = 50;
            const step = opts.step || 150;
            floors.forEach((f, fi) => {
                const n = Math.max(1, Math.floor((x1 - x0) / step));
                const pad = (x1 - x0 - (n - 1) * step) / 2;
                for (let k = 0; k < n; k++) {
                    const x = Math.round((x0 + pad + k * step) / A) * A;
                    // Fixture: a dark shade and a bright bulb row.
                    const fx = new PIXI.Graphics();
                    fx.beginFill(0x1a1a24);
                    fx.drawRect(x - 3 * A, f.y + 2, 7 * A, A);
                    fx.endFill();
                    fx.beginFill(0xfff0c8);
                    fx.drawRect(x - 2 * A, f.y + 2 + A, 5 * A, A);
                    fx.endFill();
                    fx._pxLit = true;
                    const cone = new PIXI.Sprite(this._coneTex);
                    cone.scale.set(A);
                    cone.anchor.set(0.5, 0);
                    cone.x = x + A / 2;
                    cone.y = f.y + 2 + 2 * A;
                    cone.height = Math.max(8, f.h - 10);
                    cone.blendMode = PIXI.BLEND_MODES.ADD;
                    const pool = new PIXI.Sprite(this._poolTex);
                    pool.scale.set(A);
                    pool.anchor.set(0.5, 0.5);
                    pool.x = x + A / 2;
                    pool.y = f.y + f.h - 5;
                    pool.blendMode = PIXI.BLEND_MODES.ADD;
                    // A few lamps flicker or are switched off.
                    const r = PL.hash(fi, k, 77);
                    const entry = { cone: cone, pool: pool, off: r < 0.08, flicker: r > 0.94, ph: r * 50 };
                    cont.addChild(cone, pool, fx);
                    this.lamps.push(entry);
                }
            });
            scene.addChild(cont);
            this.cont = cont;
        },

        // Every frame while inside (from PixelArt.interiorFrame).
        update(K, t) {
            const layer = G.interiorLayer;
            if (!layer) return;
            if (!this._filter) {
                this._filter = new PIXI.Filter(undefined, GRADE_FRAG, { uWarm: 0.5, uLift: 0.5 });
                this._filter.resolution = 1;
            }
            const night = K ? PL.clamp(K.night * 1.2, 0, 1) : 0;
            this._filter.uniforms.uWarm = 0.3 + night * 0.5;
            this._filter.uniforms.uLift = 0.2 + night * 0.35;
            if (!layer.filters || layer.filters.indexOf(this._filter) < 0)
                layer.filters = (layer.filters || []).concat([this._filter]);
            this.lamps = this.lamps.filter((e) => !e.cone.destroyed);
            const a = 0.18 + night * 0.5;
            for (const e of this.lamps) {
                let k = e.off ? 0 : a;
                if (e.flicker && Math.sin(t * 23 + e.ph) + Math.sin(t * 7.3 + e.ph) > 1.2) k *= 0.25;
                e.cone.alpha = k;
                e.pool.alpha = k;
            }
        },

        end() {
            this.lamps = [];
            const layer = G.interiorLayer;
            if (layer && layer.filters && this._filter)
                layer.filters = layer.filters.filter((f) => f !== this._filter) || null;
            if (layer && layer.filters && !layer.filters.length) layer.filters = null;
        },
    });
    void L;
})();
