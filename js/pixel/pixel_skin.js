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

    // Ordered-dither alpha on the GPU: alpha snaps to five levels through a 4×4 Bayer
    // pattern in render-target pixels (the mean is kept), colour is un-premultiplied and
    // re-premultiplied. Replaces a CPU read-back per translucent shape.
    const DITHER_FRAG = `
        varying vec2 vTextureCoord;
        uniform sampler2D uSampler;
        float b2(vec2 v) { return mod(2.0 * v.x + 3.0 * v.y, 4.0); }
        void main(void) {
            vec4 c = texture2D(uSampler, vTextureCoord);
            if (c.a < 0.004) { gl_FragColor = vec4(0.0); return; }
            vec2 p = mod(floor(gl_FragCoord.xy), 4.0);
            float b = (4.0 * b2(mod(p, 2.0)) + b2(floor(p / 2.0)) + 0.5) / 16.0;
            float q = min(4.0, floor(c.a * 4.0 + b)) / 4.0;
            gl_FragColor = vec4(c.rgb / c.a * q, q);
        }`;
    let ditherFilter = null;
    const dither = () => {
        if (!ditherFilter) {
            ditherFilter = new PIXI.Filter(undefined, DITHER_FRAG);
            ditherFilter.resolution = 1;
            ditherFilter.padding = 0;
        }
        return ditherFilter;
    };

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
            for (let p = g; p; p = p.parent) {
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

        // Faces: a head (rect) with two identical tiny dots side by side on one line — every
        // citizen, commuter, vendor and avatar draws its eyes like that. At art resolution the
        // two dots land on neighbouring pixels and smudge into one, so each eye gets its own
        // pixel with one pixel between them; on an even-width face the pair sits toward +x,
        // the way a walker faces (the container's scale.x flips it). Highlights, glasses
        // rings and the faint mouth line on a face are dropped at this size.
        // Returns Map(index → Rectangle to draw instead | null to skip).
        faces(list) {
            const out = new Map();
            const dot = (d) => d.shape.type === SH.CIRC && d.shape.radius < A * 0.75 && !d.matrix;
            const faceOf = (i, x0, x1, y) => {
                for (let j = i - 1; j >= 0; j--) {
                    const f = list[j].shape;
                    if (
                        (f.type === SH.RREC || f.type === SH.RECT) &&
                        list[j].fillStyle.visible &&
                        f.x <= x0 &&
                        f.x + f.width >= x1 &&
                        f.y <= y &&
                        f.y + f.height >= y
                    )
                        return f;
                }
                return null;
            };
            let face = null;
            for (let i = 0; i + 1 < list.length; i++) {
                const a = list[i];
                const b = list[i + 1];
                if (out.has(i) || !dot(a) || !dot(b)) continue;
                const sa = a.shape;
                const sb = b.shape;
                const dx = Math.abs(sa.x - sb.x);
                if (
                    Math.abs(sa.y - sb.y) > 0.01 ||
                    Math.abs(sa.radius - sb.radius) > 0.01 ||
                    dx < 0.5 ||
                    dx > A * 3
                )
                    continue;
                const f = faceOf(i, Math.min(sa.x, sb.x), Math.max(sa.x, sb.x), sa.y);
                if (!f) continue;
                face = f;
                const filled = a.fillStyle.visible && b.fillStyle.visible;
                if (!filled || a.fillStyle.alpha < 0.9) {
                    out.set(i, null);
                    out.set(i + 1, null);
                    i++;
                    continue;
                }
                const c0 = Math.ceil((f.x - A / 2) / A);
                const n = Math.floor((f.x + f.width - A / 2) / A) - c0 + 1;
                const row = Math.floor(sa.y / A);
                const px = (c) => new PIXI.Rectangle(c * A, row * A, A, A);
                const mid = c0 + Math.floor(n / 2);
                const [li, ri] = sa.x < sb.x ? [i, i + 1] : [i + 1, i];
                if (n >= 3) {
                    out.set(li, px(mid - 1));
                    out.set(ri, px(mid + 1));
                } else {
                    out.set(li, null);
                    out.set(ri, px(c0 + Math.max(0, n - 1)));
                }
                i++;
            }
            // Faint sub-pixel marks on a face (the mouth line) would sit against the eyes.
            if (face)
                list.forEach((d, i) => {
                    const sh = d.shape;
                    if (
                        !out.has(i) &&
                        sh.type === SH.RECT &&
                        sh.width < A &&
                        sh.height < A &&
                        d.fillStyle.visible &&
                        d.fillStyle.alpha < 0.6 &&
                        sh.x >= face.x &&
                        sh.x + sh.width <= face.x + face.width &&
                        sh.y >= face.y &&
                        sh.y <= face.y + face.height
                    )
                        out.set(i, null);
                });
            return out;
        },

        // A copy of g's geometry with sub-pixel shapes grown to one art pixel.
        source(g) {
            const src = new PIXI.Graphics();
            const geo = src.geometry;
            const half = A * 0.72;
            const list = g.geometry.graphicsData;
            const fix = this.faces(list);
            for (let i = 0; i < list.length; i++) {
                const d = list[i];
                if (fix.has(i)) {
                    const r = fix.get(i);
                    if (r) geo.drawShape(r, d.fillStyle, new PIXI.LineStyle(), null);
                    continue;
                }
                let s = d.shape;
                // Dots and strokes always keep at least one pixel; small rectangles only when
                // opaque enough to read (faint hatching would merge into a block).
                const solid = d.fillStyle.visible && d.fillStyle.alpha >= 0.35;
                if (d.fillStyle.visible) {
                    if (s.type === SH.CIRC && s.radius < half) s = new PIXI.Circle(s.x, s.y, half);
                    else if (s.type === SH.ELIP && (s.width < half || s.height < half))
                        s = new PIXI.Ellipse(s.x, s.y, Math.max(s.width, half), Math.max(s.height, half));
                    else if (
                        solid &&
                        (s.type === SH.RECT || s.type === SH.RREC) &&
                        (s.width < A || s.height < A)
                    ) {
                        const w = Math.max(s.width, A);
                        const h = Math.max(s.height, A);
                        s = new PIXI.Rectangle(s.x - (w - s.width) / 2, s.y - (h - s.height) / 2, w, h);
                    }
                }
                let line = d.lineStyle;
                if (line.visible && line.width > 0 && line.width < A) {
                    line = line.clone();
                    line.width = A;
                }
                geo.drawShape(s, d.fillStyle, line, d.matrix);
                d.holes.forEach((h) => geo.drawHole(h.shape, h.matrix));
            }
            return src;
        },

        // The visible part of g in its local space (a few pixels of overscan), or null
        // when g is no larger than the view (then it is rendered whole).
        viewClip(g, bnd) {
            const scr = G.app.renderer.screen;
            const wt = g.worldTransform;
            const pts = [
                [0, 0],
                [scr.width, 0],
                [0, scr.height],
                [scr.width, scr.height],
            ].map(([x, y]) => wt.applyInverse(new PIXI.Point(x, y)));
            const xs = pts.map((p) => p.x);
            const ys = pts.map((p) => p.y);
            const pad = A * 4;
            const v = new PIXI.Rectangle(
                Math.min(...xs) - pad,
                Math.min(...ys) - pad,
                Math.max(...xs) - Math.min(...xs) + pad * 2,
                Math.max(...ys) - Math.min(...ys) + pad * 2
            );
            if (bnd.width < v.width * 1.5 && bnd.height < v.height * 1.5) return null;
            const x = Math.max(bnd.x, v.x);
            const y = Math.max(bnd.y, v.y);
            const r = new PIXI.Rectangle(
                x,
                y,
                Math.min(bnd.x + bnd.width, v.x + v.width) - x,
                Math.min(bnd.y + bnd.height, v.y + v.height) - y
            );
            return r;
        },

        // Render g's geometry at art resolution. Returns [{ tex, x, y }] (strips if wide), [] if
        // empty, or null when a per-frame texture would be too wide.
        render(g, dithered, into) {
            const src = this.source(g);
            let bnd = src.getLocalBounds();
            // Every-frame Graphics larger than the view render only what is on screen.
            if (into && bnd.width > 0) {
                const clip = this.viewClip(g, bnd);
                if (clip) {
                    bnd = clip;
                    g._pxClipped = true;
                }
            }
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
                    src.filters = dithered ? [dither()] : null;
                    G.app.renderer.render(src, { renderTexture: rt, transform: m, clear: true });
                    parts.push({ tex: rt, x: x0 + cx * A, y: y0 });
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
            const moved = g._pxClipped && g._pxView !== this.viewKey;
            if (g._pxGeom === dirty && !moved) return;
            g._pxGeom = dirty;
            g._pxView = this.viewKey;
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

        // Runs every frame just before the renderer (its own ticker step, so it keeps going
        // inside interiors, where the game loop skips Environment.update).
        flush() {
            if (!this.on || !G.app) return;
            this.frame++;
            if (G.interiorLayer) this.mark(G.interiorLayer);
            if (G.activeInterior) PixelArt.interiorFrame();
            else if (PL.Sky && PL.Sky.sprite && G.world && !G.world.visible) PL.Sky.sprite.visible = false;
            const w = G.world;
            this.viewKey = w ? w.x.toFixed(1) + ',' + w.y.toFixed(1) + ',' + w.scale.x : '';
            // Every-frame redraws first (cheap), then new geometry within a time budget;
            // the rest waits for the next frames (drawn as vector meanwhile if never skinned).
            if (this.queue.size) {
                const t0 = performance.now();
                for (const g of this.queue)
                    if (g._pxDyn) {
                        this.queue.delete(g);
                        if (!g.destroyed) this.skin(g);
                    }
                // A fresh interior or district brings hundreds of shapes: convert faster.
                const budget = this.queue.size > 150 ? this.budgetMs * 3 : this.budgetMs;
                for (const g of this.queue) {
                    if (performance.now() - t0 > budget) break;
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

    // ── Text ────────────────────────────────────────────────────────────────
    // Tickers, labels and signs in the city and its interiors keep their objects, strings
    // and layout; only the face changes, to a pixel font at a size it renders pixel-exact.
    // Each text takes the first of these that fits its original width (within 8%): chunky
    // Silkscreen 16 (for text the classic set at 11 px and up), narrow Tiny5 16, Silkscreen
    // 8, then Tiny5 8 — so signs stay on their boards and labels don't collide. Sampling
    // is sharp and glows become hard shadows. Emoji fall through to the emoji fonts; pure
    // emoji icons and sub-6 px facade details are left alone. ?classicText=1 turns it off.
    const EMOJI_STACK =
        '"Twemoji Mozilla", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", monospace';
    const FACES = [
        ['Silkscreen', 16],
        ['Tiny5', 16],
        ['Silkscreen', 8],
        ['Tiny5', 8],
    ];
    S.textOn = PixelArt.enabled && PixelArt.pixelText;
    S.inCity = function (t) {
        if (t._pxOutP === t.parent) return t._pxOut;
        let r = false;
        for (let p = t.parent; p; p = p.parent) {
            if (p === G.macroLayer) break;
            if (p === G.world || p === G.interiorLayer) {
                r = true;
                break;
            }
        }
        t._pxOutP = t.parent;
        t._pxOut = r;
        return r;
    };
    const faceStyle = (st, face, size, bold) => {
        st.fontFamily = face + ', ' + EMOJI_STACK;
        st.fontSize = size;
        st.fontWeight = bold && face === 'Silkscreen' ? 'bold' : 'normal';
        st.fontStyle = 'normal';
        st.letterSpacing = Math.round(st.letterSpacing || 0);
    };
    S.pixelText = function (t) {
        const st = t._style;
        const size = parseFloat(st.fontSize) || 8;
        const letters = /[A-Za-z0-9]/.test(t.text);
        if (size < 6 || (!letters && /Emoji/.test(String(st.fontFamily)))) {
            t._pxText = st.styleID;
            return;
        }
        // Wait for real text and for both faces, so widths are measured right.
        if (
            !String(t.text).trim() ||
            !document.fonts.check('8px Silkscreen') ||
            !document.fonts.check('8px Tiny5')
        )
            return;
        const w = String(st.fontWeight);
        const bold = w === 'bold' || parseInt(w, 10) >= 600;
        const room = PIXI.TextMetrics.measureText(t.text, st).width * 1.08 + 1;
        let pick = FACES[FACES.length - 1];
        for (const f of FACES) {
            if (f[1] === 16 && size < 11) continue;
            const probe = st.clone();
            faceStyle(probe, f[0], f[1], bold);
            probe.strokeThickness = 0;
            probe.dropShadow = false;
            if (PIXI.TextMetrics.measureText(t.text, probe).width <= room) {
                pick = f;
                break;
            }
        }
        faceStyle(st, pick[0], pick[1], bold);
        // A 1 px font has no room for antialiased strokes or blurred glows: a stroke in the
        // fill colour (a fake bold) goes; a contrasting outline becomes a hard shadow; a
        // zero-distance glow goes; a real drop shadow keeps its offset, unblurred.
        const same = (a, b) => new PIXI.Color(a).toNumber() === new PIXI.Color(b).toNumber();
        let outline = null;
        if (st.strokeThickness) {
            if (!same(st.stroke, st.fill)) outline = st.stroke;
            st.strokeThickness = 0;
        }
        if (st.dropShadow && !(st.dropShadowDistance >= 1)) st.dropShadow = false;
        if (st.dropShadow) {
            st.dropShadowBlur = 0;
            st.dropShadowDistance = Math.max(1, Math.round(st.dropShadowDistance));
        } else if (outline !== null) {
            st.dropShadow = true;
            st.dropShadowColor = outline;
            st.dropShadowBlur = 0;
            st.dropShadowDistance = 1;
            st.dropShadowAngle = Math.PI / 2;
        }
        t.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        t._pxText = st.styleID;
    };
    if (S.textOn) {
        const origText = PIXI.Text.prototype.updateText;
        PIXI.Text.prototype.updateText = function (respectDirty) {
            if (this._style && this._pxText !== this._style.styleID && S.inCity(this)) S.pixelText(this);
            return origText.call(this, respectDirty);
        };
        // Chat bubbles use a font baked at boot (BitmapFonts): bake it in the pixel face.
        const origFrom = PIXI.BitmapFont.from;
        PIXI.BitmapFont.from = function (name, style, options) {
            const pixel = name === 'ChatBubble';
            if (pixel)
                style = Object.assign({}, style, {
                    fontFamily: 'Silkscreen, monospace',
                    fontWeight: 'normal',
                });
            const font = origFrom.call(this, name, style, options);
            if (pixel || name === 'Neon8')
                Object.values(font.pageTextures || {}).forEach(
                    (tex) => (tex.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST)
                );
            return font;
        };
    }

    const orig = PIXI.Graphics.prototype._render;
    PIXI.Graphics.prototype._render = function (renderer) {
        if (S.on && !S.ticking && G.app) {
            S.ticking = true;
            G.app.ticker.add(() => S.flush(), null, PIXI.UPDATE_PRIORITY.LOW + 1);
        }
        if (!S.on || this._pxVec || !S.skinOf(this)) return orig.call(this, renderer);
        if (this._pxGeom !== this.geometry.dirty || (this._pxClipped && this._pxView !== S.viewKey))
            S.queue.add(this);
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
