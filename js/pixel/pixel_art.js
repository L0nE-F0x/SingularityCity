/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PIXEL ART — the lofi pixel skin for the 2D city.

   An art swap only. Environment.buildBuildings() still builds every container, hit area,
   tooltip, ticker, sign and reference exactly as before; for a building whose branch has a
   pixel painter, PixelArt.facade() returns the pixel facade and the classic facade Graphics
   is kept in the container but hidden. Everything else (floors from dynamicFl, occupancy,
   clicks, interiors, the simulation) is untouched.

   ?classic=1 turns the skin off and shows the original art. ?classicSigns=1 keeps the
   original lab name boards instead of the pixel rooftop signs; ?classicText=1 keeps the
   original fonts on tickers, labels and chat bubbles.

   1 art pixel = 2 world pixels (PL.ART). Painters live in js/pixel/*.js (see pixel-lab/).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const PixelArt = {
    enabled: typeof location !== 'undefined' && !/[?&]classic=1\b/.test(location.search),
    pixelSigns: typeof location !== 'undefined' && !/[?&]classicSigns=1\b/.test(location.search),
    pixelText: typeof location !== 'undefined' && !/[?&]classicText=1\b/.test(location.search),

    _cache: new Map(), // bake key → { B, tex: {base, emit, bloom, neon, bloomN, refl, snow} }
    _wet: 0,
    _entries: [], // live facades for per-frame lighting
    _halos: null,
    _K: null,

    // Branches ported so far. A building not listed here keeps its classic facade.
    PORTED_IDS: new Set([
        'cafe',
        'gym',
        'arena',
        'open_square',
        'times_hq',
        'visitor_monument',
        'park',
        'ai_index',
        'city_park',
        'graveyard',
        'bld_1',
        'neon_bar',
        'uni_main',
        'uni_library',
        'uni_dorm',
        'uni_lab',
        'court_senate',
        'court_hearing',
        'ai_jail',
        'convention_center',
    ]),
    PORTED_PREFIXES: [
        'npc_apt_',
        'metro_',
        'res_',
        'robotics_',
        'dc_',
        'fab_',
        'vcrow_',
        'embassy_',
        'diplomat_villa_',
        'backbone_',
        'agents_',
        'longevity_',
        'align_',
        'suburb_',
        'house_',
        'forest_',
        'power_',
        'port_',
    ],
    isPorted(b) {
        if (!this.enabled || !b || !b.id || typeof PL === 'undefined' || !PL.paintBuilding) return false;
        // Lab HQ towers (the `else if (lab)` branch of buildBuildings).
        if (b.id.startsWith('bld_') && b.lab) return true;
        if (this.PORTED_IDS.has(b.id)) return true;
        if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) return true;
        return this.PORTED_PREFIXES.some((p) => b.id.startsWith(p));
    },

    // Classic overlays that only repeat what the pixel facade now paints (a static name in a
    // vector font). They stay in the container, alive and referenced, just hidden.
    _hideDuplicates(b, container) {
        if (!this.pixelSigns) return;
        const hideText = (txt) =>
            container.children.forEach((c) => {
                if (c instanceof PIXI.Text && c.text === txt) c.visible = false;
            });
        const hide = (o) => o && (o.visible = false);
        if (b.id === 'times_hq') hideText(b.name || 'Singularity City Times');
        if (b.id.startsWith('npc_apt_')) hideText('🏬');
        if (b.id.startsWith('metro_')) hide(b._metroSign);
        if (b.id === 'visitor_monument') hideText('🌐');
        if (b.id === 'park') hide(b._monIcon);
        if (b.type === 'alignment') hideText((b.name || '').toUpperCase());
        if (b.id === 'neon_bar') hideText('🍸');
        if (b.id === 'port_authority') hideText('⚓');
        if (b.id.startsWith('suburb_'))
            hideText(String(100 + (parseInt(b.id.replace('suburb_', ''), 10) || 1) * 4));
        // Estate name sign: the board Graphics right before b._stationSign, and the Text.
        if (b.id.startsWith('house_') && b._stationSign) {
            const i = container.children.indexOf(b._stationSign);
            if (i > 0 && container.children[i - 1] instanceof PIXI.Graphics) hide(container.children[i - 1]);
            hide(b._stationSign);
        }
        // Datacentre / fab name board: the Graphics added right before the name Text.
        if ((b.id.startsWith('dc_') || b.id.startsWith('fab_')) && b._dcSign) {
            const i = container.children.indexOf(b._dcSign);
            if (i > 0 && container.children[i - 1] instanceof PIXI.Graphics) hide(container.children[i - 1]);
            hide(b._dcSign);
        }
        // Embassy name plaque: its Graphics plus the Text right after it.
        if (b.type === 'embassy') {
            const txt = container.children.find(
                (c) => c instanceof PIXI.Text && c.text === (b.name || '').toUpperCase()
            );
            if (txt) {
                const i = container.children.indexOf(txt);
                if (i > 0 && container.children[i - 1] instanceof PIXI.Graphics)
                    hide(container.children[i - 1]);
                hide(txt);
            }
        }
    },

    // Re-draw a live vector overlay (a flag, a pole) as pixels, in place: its geometry is
    // rendered once at one texel per art pixel and shown as a child sprite, so whatever
    // animates the object (position, skew, alpha) keeps working unchanged.
    _rts: [],
    // opts.dither: quantise alpha to ordered-dither steps (for glows and pools).
    pixelize(g, opts) {
        if (!g || g.destroyed || !(g instanceof PIXI.Graphics) || !G.app) return;
        opts = opts || {};
        const A = PL.ART;
        const clone = g.clone();
        const bnd = clone.getLocalBounds();
        // Previous pixel sprites (the object was redrawn since).
        g.children
            .filter((c) => c._pxSprite)
            .forEach((c) => {
                const i = this._rts.indexOf(c.texture);
                if (i >= 0) this._rts.splice(i, 1);
                c.destroy({ texture: true, baseTexture: true });
            });
        if (!(bnd.width > 0 && bnd.height > 0)) {
            clone.destroy();
            g.clear();
            return;
        }
        const x0 = Math.floor(bnd.x / A) * A;
        const y0 = Math.floor(bnd.y / A) * A;
        const totalW = Math.ceil((bnd.x + bnd.width - x0) / A) + 1;
        const th = Math.ceil((bnd.y + bnd.height - y0) / A) + 1;
        const CH = 4096;
        for (let cx = 0; cx < totalW; cx += CH) {
            const tw = Math.min(CH, totalW - cx);
            const rt = PIXI.RenderTexture.create({
                width: tw,
                height: th,
                scaleMode: PIXI.SCALE_MODES.NEAREST,
                resolution: 1,
            });
            const m = new PIXI.Matrix(1 / A, 0, 0, 1 / A, -x0 / A - cx, -y0 / A);
            G.app.renderer.render(clone, { renderTexture: rt, transform: m, clear: true });
            const tex = opts.dither ? this._ditherAlpha(rt) : rt;
            const sp = new PIXI.Sprite(tex);
            sp._pxSprite = true;
            sp.blendMode = g.blendMode;
            sp.scale.set(A);
            sp.x = x0 + cx * A;
            sp.y = y0;
            g.addChild(sp);
            this._rts.push(tex);
        }
        clone.destroy();
        g.clear();
    },
    // Premultiplied RGBA of a render texture. Pixi 7.3's extract.pixels() un-premultiplies
    // in place without clamping (a 50% red reads back as r = 1), so the raw read is used.
    _readPixels(rt) {
        const ex = G.app.renderer.extract;
        try {
            if (ex._rawPixels) return ex._rawPixels(rt).pixels;
            return ex.pixels(rt);
        } catch (e) {
            return null;
        }
    },
    _ditherAlpha(rt) {
        const px = this._readPixels(rt);
        if (!px) return rt;
        const W = rt.width;
        const H = rt.height;
        const out = new PL.Img(W, H);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                const a = px[o + 3] / 255;
                if (a <= 0.01) continue;
                // Ordered dither between the two nearest of five levels (keeps the mean).
                const q = Math.min(4, Math.floor(a * 4 + PL.bayer(x, y))) / 4;
                if (q <= 0) continue;
                const k = 1 / a;
                out.set(x, y, PL.rgb(px[o] * k, px[o + 1] * k, px[o + 2] * k), q * 255);
            }
        rt.destroy(true);
        return PL.tex(out);
    },
    // A Graphics that holds fresh vector content (drawn, or redrawn after a rebuild).
    _hasVector(g) {
        return g instanceof PIXI.Graphics && !g.destroyed && g.geometry && g.geometry.graphicsData.length > 0;
    },
    // The ground (Environment.buildGround's one big Graphics: terrain per zone, basements,
    // cable trays, bunkers, power poles) is rendered once at one texel per art pixel into
    // strips and shown instead of the vector original, which stays in place, hidden.
    _ground: null,
    pixelizeGround(g) {
        if (!g || g.destroyed || !G.app) return;
        if (this._ground && !this._ground.destroyed)
            this._ground.destroy({ children: true, texture: true, baseTexture: true });
        const A = PL.ART;
        const gy = G.groundY;
        const y0 = Math.floor((gy - 102) / A) * A;
        const y1 = gy + 702;
        const bnd = g.getLocalBounds();
        if (!(bnd.width > 0)) return;
        const x0 = Math.floor(bnd.x / A) * A;
        const x1 = bnd.x + bnd.width;
        const clone = g.clone();
        const cont = new PIXI.Container();
        cont.name = 'pixelGround';
        const CH = 4096 * A;
        for (let cx = x0; cx < x1; cx += CH) {
            const tw = Math.ceil(Math.min(CH, x1 - cx) / A);
            const th = Math.ceil((y1 - y0) / A);
            const rt = PIXI.RenderTexture.create({
                width: tw,
                height: th,
                scaleMode: PIXI.SCALE_MODES.NEAREST,
                resolution: 1,
            });
            const m = new PIXI.Matrix(1 / A, 0, 0, 1 / A, -cx / A, -y0 / A);
            G.app.renderer.render(clone, { renderTexture: rt, transform: m, clear: true });
            const sp = new PIXI.Sprite(this._stylizeGround(rt, cx, y0));
            sp.scale.set(A);
            sp.x = cx;
            sp.y = y0;
            cont.addChild(sp);
        }
        // Everything deeper than the band is the classic's plain bedrock fill.
        const deep = new PIXI.Graphics();
        deep.beginFill(0x0a0a0f);
        deep.drawRect(x0, y1, x1 - x0, 3000);
        deep.endFill();
        cont.addChild(deep);
        clone.destroy();
        g.visible = false;
        const par = g.parent;
        if (par) par.addChildAt(cont, par.getChildIndex(g) + 1);
        this._ground = cont;
    },

    // Texture pass over the pixelised ground, keyed on the classic colours so zone
    // terrain keeps its own look: paving slabs on the city pavement, grain on the road,
    // and a faint two-level dither on other flat areas. Returns a new texture (the
    // render texture is freed).
    _stylizeGround(rt, wx0, wy0) {
        const A = PL.ART;
        const W = rt.width;
        const H = rt.height;
        const px = this._readPixels(rt);
        if (!px) return rt;
        const gy = G.groundY;
        const rowOf = (worldY) => Math.round((worldY - wy0) / A);
        const paveTop = rowOf(gy - 24);
        const roadTop = rowOf(gy);
        const roadEnd = rowOf(gy + 32);
        const duskyGrey = (r, g, b) => b >= r + 6 && b >= g + 6 && Math.abs(r - g) < 14 && r < 110;
        const out = new PL.Img(W, H);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 4;
                const a = px[o + 3];
                if (!a) continue;
                let r = px[o];
                let g = px[o + 1];
                let b = px[o + 2];
                if (a < 255) {
                    r = Math.min(255, (r * 255) / a);
                    g = Math.min(255, (g * 255) / a);
                    b = Math.min(255, (b * 255) / a);
                }
                let c = PL.rgb(r, g, b);
                const X = Math.round(wx0 / A) + x;
                const n = PL.hash(97, X, y);
                if (y >= paveTop && y < roadTop && duskyGrey(r, g, b)) {
                    // Paving slabs: seams, a lit top row, speckle.
                    const row = y - paveTop;
                    if (row > 0 && X % 9 === 0) c = PL.shade(c, 0.82);
                    else if (row === 4) c = PL.shade(c, 0.9);
                    else if (row === 0) c = PL.light(c, 0.12);
                    if (n > 0.93) c = PL.shade(c, 0.9);
                    else if (n < 0.05) c = PL.light(c, 0.06);
                } else if (y >= roadTop && y < roadEnd && duskyGrey(r, g, b)) {
                    // Asphalt grain and tyre tracks.
                    if (n > 0.9) c = PL.shade(c, 0.86);
                    else if (n < 0.06) c = PL.light(c, 0.08);
                    if ((y - roadTop === 3 || y - roadTop === 8) && PL.hash(31, X >> 1, y) > 0.6)
                        c = PL.shade(c, 0.9);
                } else if (n > 0.965) c = PL.shade(c, 0.93);
                else if (n < 0.03) c = PL.light(c, 0.05);
                out.set(x, y, c, a);
            }
        rt.destroy(true);
        return PL.tex(out);
    },

    _pixelizeFlag(b) {
        const f = b._flagGfx;
        if (!f || !f.parent) return;
        f.parent.children.forEach((c) => this.pixelize(c));
    },

    _reflLayer() {
        if (this._refl && !this._refl.destroyed) return this._refl;
        if (!G.world || !G.shadowLayer || !G.shadowLayer.parent) return null;
        this._refl = new PIXI.Container();
        this._refl.name = 'pixelReflections';
        this._refl.eventMode = 'none';
        G.world.addChildAt(this._refl, G.world.getChildIndex(G.shadowLayer) + 1);
        return this._refl;
    },

    beginBuild() {
        this._entries = [];
        if (this._refl && !this._refl.destroyed) this._refl.removeChildren().forEach((c) => c.destroy());
        // Old containers are destroyed (textures kept) right after this in buildBuildings.
        this._rts.forEach((rt) => rt.destroy(true));
        this._rts = [];
    },

    _haloTex(r) {
        if (!this._halos) {
            this._halos = {};
            [3, 4, 6, 8, 10, 12, 16, 20, 26, 34, 42, 52].forEach((k) => {
                this._halos[k] = PL.tex(PL.halo(k, 0xffffff, 0.5, 2, 5));
            });
            this._halos.pool = PL.tex(PL.haloE(Math.round(16 * PL.S3), Math.round(3 * PL.S3), 0xffffff, 0.55, 1.4, 4));
            this._halos.poolS = PL.tex(PL.haloE(Math.round(9 * PL.S3), Math.round(2 * PL.S3), 0xffffff, 0.5, 1.4, 4));
        }
        if (typeof r === 'string') return this._halos[r];
        let best = 3;
        for (const k of [3, 4, 6, 8, 10, 12, 16, 20, 26, 34, 42, 52])
            if (Math.abs(k - r) < Math.abs(best - r)) best = k;
        return this._halos[best];
    },

    _bake(b, h) {
        if (typeof LABS !== 'undefined') PL.LABS = LABS;
        const lab = b.lab && PL.LABS ? PL.LABS[b.lab] : null;
        PL.noRoofSigns = !this.pixelSigns;
        const key = [
            b.id,
            h,
            b.w,
            b.lab || '',
            lab ? lab.color : '',
            b.name,
            PL.dataKey ? PL.dataKey(b) : '',
            PL.dataKeyRow ? PL.dataKeyRow(b) : '',
            PL.dataKeyPower ? PL.dataKeyPower(b) : '',
            PL.dataKeyCampus ? PL.dataKeyCampus(b) : '',
        ].join('|');
        let hit = this._cache.get(key);
        if (hit) return hit;
        const B = PL.paintBuilding(b, h);
        hit = {
            B: B,
            tex: {
                base: PL.tex(B.base),
                emit: PL.tex(B.emit),
                bloom: B.bloom ? PL.tex(B.bloom) : null,
                neon: B.hasNeon ? PL.tex(B.neon) : null,
                bloomN: B.bloomN ? PL.tex(B.bloomN) : null,
                refl: B.refl ? PL.tex(B.refl) : null,
                snow: B.snow ? PL.tex(B.snow) : null,
            },
        };
        // Drop any older bake of this building (height changed) so textures don't pile up.
        for (const [k, v] of this._cache) {
            if (k !== key && k.startsWith(b.id + '|')) {
                Object.values(v.tex).forEach((t) => t && t.destroy(true));
                this._cache.delete(k);
            }
        }
        this._cache.set(key, hit);
        return hit;
    },

    // Returns a PIXI.Container holding the pixel facade in the building container's
    // coordinates (origin = top-left of the footprint, h = building height), or null.
    facade(b, h) {
        if (!this.isPorted(b)) return null;
        let bake;
        try {
            bake = this._bake(b, h);
        } catch (e) {
            console.warn('[PixelArt] painter failed for', b.id, e);
            return null;
        }
        const A = PL.ART;
        const B = bake.B;
        const root = new PIXI.Container();
        root.name = 'pixelFacade';
        // Centre the art footprint on the live footprint (they differ by < 1 art px).
        const ox = Math.round(-B.padX * A + (b.w - B.fw * A) / 2);
        const oy = -B.head * A + (h - B.fh * A);
        const mk = (tex, blend) => {
            const s = new PIXI.Sprite(tex);
            s.scale.set(A);
            s.x = ox;
            s.y = oy;
            if (blend) s.blendMode = blend;
            root.addChild(s);
            return s;
        };
        const e = { b: b, root: root, lights: [], blinks: [] };
        e.base = mk(bake.tex.base);
        e.snow = bake.tex.snow ? mk(bake.tex.snow) : null;
        if (e.snow) e.snow.visible = false;
        e.emit = mk(bake.tex.emit);
        e.bloom = bake.tex.bloom ? mk(bake.tex.bloom, PIXI.BLEND_MODES.ADD) : null;
        e.neon = bake.tex.neon ? mk(bake.tex.neon) : null;
        e.bloomN = bake.tex.bloomN ? mk(bake.tex.bloomN, PIXI.BLEND_MODES.ADD) : null;
        // Wet-street reflection: starts at the pavement line under the facade. It lives in
        // its own layer above the ground (which is drawn over the buildings) and follows the
        // building container every frame.
        e.refl = null;
        const RL = this._reflLayer();
        if (bake.tex.refl && RL) {
            const s = new PIXI.Sprite(bake.tex.refl);
            s.scale.set(A);
            s.blendMode = PIXI.BLEND_MODES.ADD;
            s.eventMode = 'none';
            s.dx = ox;
            s.dy = h;
            RL.addChild(s);
            e.refl = s;
        }
        // Light halos, door and shop pools on the pavement, blinking beacons.
        const fx = (x) => ox + (x + B.padX) * A + A / 2;
        const fy = (y) => oy + (y + B.head) * A + A / 2;
        B.lights.forEach((l) => {
            let s;
            if (l.kind === 'door' || l.kind === 'shop') {
                s = new PIXI.Sprite(this._haloTex(l.r > 14 ? 'pool' : 'poolS'));
                s.y = h + 3 * A;
                s.baseA = 0.8;
            } else {
                s = new PIXI.Sprite(this._haloTex(l.r * PL.S3));
                s.y = fy(l.y);
                s.baseA = l.kind === 'spot' ? 0.55 : l.kind === 'neon' ? 0.7 : 0.8;
                s.isNeon = l.kind === 'neon';
            }
            s.anchor.set(0.5);
            s.scale.set(A);
            s.x = fx(l.x);
            s.tint = l.col;
            s.blendMode = PIXI.BLEND_MODES.ADD;
            root.addChild(s);
            e.lights.push(s);
        });
        B.blinks.forEach((bl) => {
            const s = new PIXI.Sprite(this._haloTex(4 * PL.S3));
            s.anchor.set(0.5);
            s.scale.set(A);
            s.x = fx(bl.x);
            s.y = fy(bl.y);
            s.tint = bl.col;
            s.blendMode = PIXI.BLEND_MODES.ADD;
            s.period = bl.period;
            s.phase = bl.phase;
            root.addChild(s);
            e.blinks.push(s);
        });
        this._entries.push(e);
        this._apply(e, performance.now() / 1000);
        return root;
    },

    // Called by buildBuildings once the building's container holds every classic child.
    adopt(b, container) {
        if (!this.isPorted(b)) return;
        this._hideDuplicates(b, container);
        if (b.type === 'embassy' || b.type === 'diplomat_villa') this._pixelizeFlag(b);
        // Space zone: the pad's SpaceRockets vehicle and the tracking station's scan dish.
        if (b.type === 'launchpad')
            container.children.forEach((c) => {
                if (c instanceof PIXI.Graphics && c.visible) this.pixelize(c);
            });
        if (b._scanDish) b._scanDish.children.forEach((c) => this.pixelize(c));
        // Polaris plasma halo (PowerEnv pulses its alpha and scale).
        if (b.id === 'power_fusion')
            container.children.forEach((c) => {
                if (c instanceof PIXI.Graphics && c.blendMode === PIXI.BLEND_MODES.ADD) this.pixelize(c);
            });
    },

    // Objects rebuilt with the buildings that live outside the building containers.
    _sweepLazy() {
        if (
            typeof BlackMarket !== 'undefined' &&
            BlackMarket._dumpsterSprite &&
            !BlackMarket._dumpsterSprite.destroyed
        )
            BlackMarket._dumpsterSprite.children.forEach((g) => this._hasVector(g) && this.pixelize(g));
    },

    // Entity layers drawn through PixelArt.Skin (js/pixel/pixel_skin.js).
    _markLayers() {
        const S = this.Skin;
        if (!S) return;
        // Street-level layers take the time-of-day light; the underground keeps its own.
        [G.charLayer, G.carLayer, G.trainLayer, G.reflectionLayer].forEach((l) => S.mark(l, { amb: true }));
        [G.undergroundLayer, G.shadowLayer].forEach((l) => S.mark(l));
        if (typeof CityAmbience !== 'undefined' && CityAmbience.glowLayer)
            S.mark(CityAmbience.glowLayer, { dither: true });
        if (typeof SeasonalEnv !== 'undefined') S.mark(SeasonalEnv._overlayGfx);
        // Weather, fog, lightning and snow cover are redrawn every frame or two.
        [G.fxGfx, Environment._fogGfx, Environment._flashGfx, Environment._snowGfx].forEach((g) => {
            if (g && !g._pxSkin) {
                g._pxDyn = true;
                S.mark(g);
            }
        });
    },

    // The live weather state (PL.tod reads the classic names; the look-dev page uses its own).
    _wx() {
        return typeof Environment !== 'undefined' && Environment.weather ? Environment.weather : 'clear';
    },

    _apply(e, t) {
        const K = this._K || (this._K = PL.tod(G.getDayPhase(), this._wx()));
        const emitA = PL.clamp(K.night * 1.25 - 0.05, 0, 1);
        e.base.tint = K.amb;
        e.emit.alpha = emitA;
        if (e.bloom) e.bloom.alpha = emitA * 0.85;
        if (e.snow) {
            // Follows the classic snow build-up and melt (Environment._drawSnowAccum).
            const acc = typeof Environment !== 'undefined' ? Environment._snowAccum || 0 : 0;
            e.snow.visible = acc > 0.02;
            e.snow.alpha = Math.min(1, acc * 1.7);
            e.snow.tint = PL.mix(K.amb, 0xffffff, 0.35);
        }
        // Signage never switches off; it just glows harder after dark.
        const neonA = Math.max(emitA, K.neon === undefined ? 0 : K.neon);
        if (e.neon) e.neon.alpha = neonA;
        if (e.refl) {
            const c = e.root.parent;
            const show = !!c && c.visible && c.worldVisible !== false && this._wet > 0.02;
            e.refl.visible = show;
            if (show) {
                e.refl.x = c.x + e.refl.dx;
                e.refl.y = c.y + e.refl.dy;
                e.refl.alpha = this._wet * Math.max(emitA * 0.9, neonA * 0.5);
            }
        }
        if (e.bloomN) e.bloomN.alpha = neonA * 0.85;
        for (const s of e.lights) s.alpha = s.baseA * (s.isNeon ? Math.max(emitA, neonA * 0.45) : emitA);
        for (const s of e.blinks) s.alpha = PL.frac(t / s.period + s.phase) < 0.45 ? 0.6 + emitA * 0.4 : 0;
    },

    // Every frame while inside a building (the game loop skips Environment.update there).
    // An interior that shows the sky keeps its sun and moon in module.celestialGfx (and its
    // stars in starsLayer), whether it paints the sky itself or through
    // InteriorCity._applyDynamicSky. For those the pixel sky stands in, horizon at the bottom
    // of the screen, and their own sun, moon and stars are hidden. Interiors with their own
    // backdrop (the Black Market) are left alone.
    interiorFrame() {
        if (!PL.Sky || !PL.Sky.sprite) return;
        const m = typeof Interior !== 'undefined' ? Interior.activeModule : null;
        const sky = !!(m && m.celestialGfx && !m.celestialGfx.destroyed);
        if (sky) {
            m.celestialGfx.visible = false;
            if (m.starsLayer && !m.starsLayer.destroyed) m.starsLayer.visible = false;
        }
        this._K = PL.tod(G.getDayPhase(), this._wx());
        PL.Sky.update(this._K, performance.now() / 1000, { zoom: 1, horizonY: G.vpH, visible: sky });
        if (PL.Backdrop && PL.Backdrop.sprite) PL.Backdrop.sprite.visible = false;
    },

    // Called every frame from Environment.update().
    update(dp) {
        if (!this.enabled) return;
        if (typeof G !== 'undefined' && G.tick % 30 === 0) {
            this._sweepLazy();
            this._markLayers();
        }
        this._K = PL.tod(dp, this._wx());
        // How wet the street looks: always a sheen after dark (the neon city), soaked in rain.
        const wx = this._wx();
        const rain = /rain|drizzle|storm/.test(wx)
            ? (typeof Environment !== 'undefined' ? Environment.weatherIntensity || 0.6 : 0.6)
            : 0;
        this._wet = PL.clamp(Math.max(this._K.night * 0.55, rain * 1.1), 0, 1);
        // Entities a little brighter than the facades, so the crowd reads at night.
        if (this.Skin) this.Skin.setAmbient(PL.mix(this._K.amb, 0xffffff, 0.18));
        if (PL.Sky) PL.Sky.update(this._K, performance.now() / 1000);
        if (PL.Backdrop) PL.Backdrop.update(this._K, performance.now() / 1000);
        // The classic ground palette is already dusky, so it takes a gentler ambient tint.
        if (this._ground && !this._ground.destroyed) {
            const tint = PL.mix(this._K.amb, 0xffffff, 0.45);
            this._ground.children.forEach((c) => (c.tint = tint));
        }
        if (!this._entries.length) return;
        const t = performance.now() / 1000;
        for (const e of this._entries) {
            if (e.root.destroyed) continue;
            const c = e.b._container;
            if (c && !c.visible) {
                if (e.refl) e.refl.visible = false;
                continue;
            }
            this._apply(e, t);
        }
    },
};

// Default zoom 1 with the skin, so one art pixel is exactly PL.ART screen pixels (0.8 gave
// 2.4, drawing some pixel columns 2 wide and some 3). Camera.init frames from it.
if (PixelArt.enabled && typeof Camera !== 'undefined')
    Camera.zoom = Camera.targetZoom = Camera.defaultZoom = 1;
