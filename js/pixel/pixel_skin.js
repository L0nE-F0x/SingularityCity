/* Pixel art — entities and street life. Every vector Graphics under a skinned layer (the
   citizen, car, train and underground layers) is drawn as pixels: its geometry is rendered
   once at one texel per art pixel and shown as a sprite child, while the Graphics itself
   keeps its geometry (bounds, hit-testing, whatever animates it) and simply skips drawing
   the vector. When the game redraws a Graphics, the new geometry is pixelised before the
   next frame. Identical geometry shares one texture (every citizen of a lab and size, every
   truck). Graphics redrawn nearly every frame get a private texture re-rendered in place.

   Shapes under one art pixel are grown to one pixel (eyes, thin rails), and translucent or
   additive Graphics (glows, pools, shadows, steam) get alpha in ordered-dither steps. */
(function () {
    'use strict';
    if (typeof PIXI === 'undefined' || typeof PixelArt === 'undefined' || typeof PL === 'undefined') return;
    const A = PL.ART;
    const SH = PIXI.SHAPES;
    const MAX_W = 4096;

    const S = (PixelArt.Skin = {
        on: PixelArt.enabled,
        queue: new Set(),
        cache: new Map(), // signature → { parts: [{ tex, x, y }], refs, zero }
        frame: 0,
        version: 1,
        stats: { made: 0, hits: 0, dyn: 0 },
        budgetMs: 4,

        // Nearest skin marker above g: { dither } or null.
        skinOf(g) {
            if (g.isMask) return null;
            if (g._pxSkinP === g.parent && g._pxSkinV === this.version) return g._pxSkinR;
            let r = null;
            for (let p = g.parent; p; p = p.parent) {
                if (p._pxNoSkin) break;
                if (p._pxSkin) {
                    r = p._pxSkin;
                    break;
                }
            }
            g._pxSkinP = g.parent;
            g._pxSkinV = this.version;
            g._pxSkinR = r;
            return r;
        },
        mark(layer, opts) {
            if (!layer || layer._pxSkin) return;
            layer._pxSkin = opts || {};
            this.version++;
        },

        signature(g, dither) {
            const out = [dither ? 'd' : 'n'];
            for (const d of g.geometry.graphicsData) {
                const s = d.shape;
                const f = d.fillStyle;
                const l = d.lineStyle;
                out.push(
                    s.type,
                    s.x,
                    s.y,
                    s.width,
                    s.height,
                    s.radius,
                    s.points ? s.points.join(',') : '',
                    f.visible
                        ? f.color +
                              ':' +
                              f.alpha +
                              (f.texture && f.texture !== PIXI.Texture.WHITE
                                  ? ':t' + f.texture.baseTexture.uid
                                  : '')
                        : '-',
                    l.visible && l.width ? l.width + ':' + l.color + ':' + l.alpha + ':' + l.alignment : '-',
                    d.matrix
                        ? [d.matrix.a, d.matrix.b, d.matrix.c, d.matrix.d, d.matrix.tx, d.matrix.ty].join(',')
                        : '',
                    d.holes.length
                        ? d.holes.map((h) => (h.shape.points || [h.shape.x, h.shape.y]).join(',')).join(';')
                        : ''
                );
            }
            return out.join('|');
        },

        // Translucent or additive → dithered alpha.
        wantsDither(g, skin) {
            if (skin.dither || g.blendMode === PIXI.BLEND_MODES.ADD) return true;
            for (const d of g.geometry.graphicsData) {
                if (d.fillStyle.visible && d.fillStyle.alpha > 0.5) return false;
                if (d.lineStyle.visible && d.lineStyle.width && d.lineStyle.alpha > 0.5) return false;
            }
            return true;
        },

        // A copy of g's geometry with sub-pixel shapes grown to one art pixel.
        source(g) {
            const src = new PIXI.Graphics();
            const geo = src.geometry;
            const half = A * 0.72;
            for (const d of g.geometry.graphicsData) {
                let s = d.shape;
                const solid =
                    (d.fillStyle.visible && d.fillStyle.alpha >= 0.35) ||
                    (d.lineStyle.visible && d.lineStyle.alpha >= 0.35);
                if (solid && d.fillStyle.visible) {
                    if (s.type === SH.CIRC && s.radius < half) s = new PIXI.Circle(s.x, s.y, half);
                    else if (s.type === SH.ELIP && (s.width < half || s.height < half))
                        s = new PIXI.Ellipse(s.x, s.y, Math.max(s.width, half), Math.max(s.height, half));
                    else if ((s.type === SH.RECT || s.type === SH.RREC) && (s.width < A || s.height < A)) {
                        const w = Math.max(s.width, A);
                        const h = Math.max(s.height, A);
                        s = new PIXI.Rectangle(s.x - (w - s.width) / 2, s.y - (h - s.height) / 2, w, h);
                    }
                }
                let line = d.lineStyle;
                if (solid && line.visible && line.width > 0 && line.width < A) {
                    line = line.clone();
                    line.width = A;
                }
                geo.drawShape(s, d.fillStyle, line, d.matrix);
                d.holes.forEach((h) => geo.drawHole(h.shape, h.matrix));
            }
            return src;
        },

        // Render g's geometry at art resolution. Returns [{ tex, x, y }] (strips if wide), [] if empty.
        render(g, dither, into) {
            const src = this.source(g);
            const bnd = src.getLocalBounds();
            const parts = [];
            if (bnd.width > 0 && bnd.height > 0) {
                const x0 = Math.floor(bnd.x / A) * A;
                const y0 = Math.floor(bnd.y / A) * A;
                const totalW = Math.ceil((bnd.x + bnd.width - x0) / A) + 1;
                const th = Math.ceil((bnd.y + bnd.height - y0) / A) + 1;
                if (into && totalW > MAX_W) {
                    src.destroy();
                    return null;
                }
                for (let cx = 0; cx < totalW; cx += MAX_W) {
                    const tw = Math.min(MAX_W, totalW - cx);
                    let rt = into;
                    if (rt) {
                        if (rt.width !== tw || rt.height !== th) rt.resize(tw, th, true);
                    } else
                        rt = PIXI.RenderTexture.create({
                            width: tw,
                            height: th,
                            scaleMode: PIXI.SCALE_MODES.NEAREST,
                            resolution: 1,
                        });
                    const m = new PIXI.Matrix(1 / A, 0, 0, 1 / A, -x0 / A - cx, -y0 / A);
                    G.app.renderer.render(src, { renderTexture: rt, transform: m, clear: true });
                    parts.push({ tex: dither ? PixelArt._ditherAlpha(rt) : rt, x: x0 + cx * A, y: y0 });
                }
            }
            src.destroy();
            return parts;
        },

        release(g) {
            const kids = g._pxKids;
            if (kids) {
                for (const sp of kids) {
                    const e = sp._pxEntry;
                    if (e && --e.refs <= 0) e.zero = this.frame;
                    if (!sp.destroyed) sp.destroy();
                }
                g._pxKids = null;
            }
            if (g.destroyed && g._pxRT) {
                g._pxRT.destroy(true);
                g._pxRT = null;
            }
        },

        attach(g, parts, entry) {
            const kids = [];
            parts.forEach((p, i) => {
                const sp = new PIXI.Sprite(p.tex);
                sp._pxAuto = true;
                sp._pxEntry = entry;
                sp.eventMode = 'none';
                sp.scale.set(A);
                sp.x = p.x;
                sp.y = p.y;
                sp.tint = g.tint;
                sp.blendMode = g.blendMode;
                g.addChildAt(sp, Math.min(i, g.children.length));
                kids.push(sp);
            });
            if (entry) entry.refs++;
            g._pxKids = kids;
        },

        skin(g) {
            const dirty = g.geometry.dirty;
            if (g._pxGeom === dirty) return;
            g._pxGeom = dirty;
            if (!g._pxHooked) {
                g._pxHooked = true;
                g.once('destroyed', () => this.release(g));
            }
            // Redrawn six times within two seconds → animated every frame: own texture.
            const f = this.frame;
            if (!g._pxT0 || f - g._pxT0 > 120) {
                g._pxT0 = f;
                g._pxN = 0;
            }
            if (++g._pxN >= 6 && !g._pxDyn) {
                g._pxDyn = true;
                this.stats.dyn++;
            }
            const skin = this.skinOf(g) || {};
            if (!g.geometry.graphicsData.length) return this.release(g);
            if (g._pxDyn) {
                if (!g._pxRT)
                    g._pxRT = PIXI.RenderTexture.create({
                        width: 1,
                        height: 1,
                        scaleMode: PIXI.SCALE_MODES.NEAREST,
                        resolution: 1,
                    });
                const parts = this.render(g, false, g._pxRT);
                if (!parts) {
                    // Too wide to redraw every frame: stays vector.
                    this.release(g);
                    g._pxVec = true;
                    return;
                }
                const sp =
                    g._pxKids && g._pxKids.length === 1 && !g._pxKids[0]._pxEntry ? g._pxKids[0] : null;
                if (sp && parts.length) {
                    sp.x = parts[0].x;
                    sp.y = parts[0].y;
                    sp.texture.updateUvs();
                    return;
                }
                this.release(g);
                if (parts.length) this.attach(g, parts, null);
                return;
            }
            const dither = this.wantsDither(g, skin);
            const key = this.signature(g, dither);
            let e = this.cache.get(key);
            if (e) this.stats.hits++;
            else {
                e = { parts: this.render(g, dither), refs: 0, zero: f };
                this.cache.set(key, e);
                this.stats.made++;
            }
            const old = g._pxKids;
            if (old && old.length === e.parts.length && old.every((sp, i) => sp.texture === e.parts[i].tex))
                return;
            this.release(g);
            if (e.parts.length) this.attach(g, e.parts, e);
        },

        flush() {
            if (!this.on || !G.app) return;
            this.frame++;
            // Every-frame redraws first (cheap), then new geometry within a time budget;
            // the rest waits for the next frames (drawn as vector meanwhile if never skinned).
            if (this.queue.size) {
                const t0 = performance.now();
                for (const g of this.queue)
                    if (g._pxDyn) {
                        this.queue.delete(g);
                        if (!g.destroyed) this.skin(g);
                    }
                for (const g of this.queue) {
                    if (performance.now() - t0 > this.budgetMs) break;
                    this.queue.delete(g);
                    if (!g.destroyed) this.skin(g);
                }
            }
            // Free textures nobody has used for ten seconds.
            if (this.frame % 600 === 0)
                for (const [k, e] of this.cache)
                    if (e.refs <= 0 && this.frame - e.zero > 600) {
                        e.parts.forEach((p) => p.tex.destroy(true));
                        this.cache.delete(k);
                    }
        },
    });

    const orig = PIXI.Graphics.prototype._render;
    PIXI.Graphics.prototype._render = function (renderer) {
        if (!S.on || this._pxVec || !S.skinOf(this)) return orig.call(this, renderer);
        if (this._pxGeom !== this.geometry.dirty) S.queue.add(this);
        const kids = this._pxKids;
        if (!kids && this._pxGeom !== this.geometry.dirty) return orig.call(this, renderer);
        if (kids) {
            const t = this.tint;
            const bm = this.blendMode;
            for (let i = 0; i < kids.length; i++) {
                const k = kids[i];
                if (k.tint !== t) k.tint = t;
                if (k.blendMode !== bm) k.blendMode = bm;
            }
        }
    };
})();
