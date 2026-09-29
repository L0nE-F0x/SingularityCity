/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PIXEL ART — the lofi pixel skin for the 2D city.

   An art swap only. Environment.buildBuildings() still builds every container, hit area,
   tooltip, ticker, sign and reference exactly as before; for a building whose branch has a
   pixel painter, PixelArt.facade() returns the pixel facade and the classic facade Graphics
   is kept in the container but hidden. Everything else (floors from dynamicFl, occupancy,
   clicks, interiors, the simulation) is untouched.

   ?classic=1 turns the skin off and shows the original art. ?classicSigns=1 keeps the
   original lab name boards instead of the pixel rooftop signs.

   1 art pixel = 3 world pixels (PL.ART). Painters live in js/pixel/*.js (see pixel-lab/).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const PixelArt = {
    enabled: typeof location !== 'undefined' && !/[?&]classic=1\b/.test(location.search),
    pixelSigns: typeof location !== 'undefined' && !/[?&]classicSigns=1\b/.test(location.search),

    _cache: new Map(), // bake key → { B, tex: {base, emit, bloom, snow} }
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
    pixelize(g) {
        if (!g || g.destroyed || !(g instanceof PIXI.Graphics) || !G.app) return;
        const A = PL.ART;
        const clone = g.clone();
        const bnd = clone.getLocalBounds();
        if (!(bnd.width > 0 && bnd.height > 0)) return clone.destroy();
        const x0 = Math.floor(bnd.x / A) * A;
        const y0 = Math.floor(bnd.y / A) * A;
        const tw = Math.ceil((bnd.x + bnd.width - x0) / A) + 1;
        const th = Math.ceil((bnd.y + bnd.height - y0) / A) + 1;
        const rt = PIXI.RenderTexture.create({
            width: tw,
            height: th,
            scaleMode: PIXI.SCALE_MODES.NEAREST,
            resolution: 1,
        });
        const m = new PIXI.Matrix(1 / A, 0, 0, 1 / A, -x0 / A, -y0 / A);
        G.app.renderer.render(clone, { renderTexture: rt, transform: m, clear: true });
        clone.destroy();
        g.clear();
        const sp = new PIXI.Sprite(rt);
        sp.scale.set(A);
        sp.x = x0;
        sp.y = y0;
        g.addChild(sp);
        this._rts.push(rt);
    },
    _pixelizeFlag(b) {
        const f = b._flagGfx;
        if (!f || !f.parent) return;
        f.parent.children.forEach((c) => this.pixelize(c));
    },

    beginBuild() {
        this._entries = [];
        // Old containers are destroyed (textures kept) right after this in buildBuildings.
        this._rts.forEach((rt) => rt.destroy(true));
        this._rts = [];
    },

    _haloTex(r) {
        if (!this._halos) {
            this._halos = {};
            [3, 4, 6, 8, 10, 12, 16, 20, 26, 34].forEach((k) => {
                this._halos[k] = PL.tex(PL.halo(k, 0xffffff, 0.5, 2, 5));
            });
            this._halos.pool = PL.tex(PL.haloE(16, 3, 0xffffff, 0.55, 1.4, 4));
            this._halos.poolS = PL.tex(PL.haloE(9, 2, 0xffffff, 0.5, 1.4, 4));
        }
        if (typeof r === 'string') return this._halos[r];
        let best = 3;
        for (const k of [3, 4, 6, 8, 10, 12, 16, 20, 26, 34])
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
                s = new PIXI.Sprite(this._haloTex(l.r));
                s.y = fy(l.y);
                s.baseA = l.kind === 'spot' ? 0.55 : l.kind === 'neon' ? 0.7 : 0.8;
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
            const s = new PIXI.Sprite(this._haloTex(4));
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

    // Zone modules build their animated vector pieces lazily (when the camera first nears
    // the zone), so they are pixelised as they appear. Each piece is re-drawn once.
    _lazySources() {
        const out = [];
        if (typeof PowerEnv !== 'undefined') {
            (PowerEnv.turbineBlades || []).forEach((tb) => tb.cont && out.push(...tb.cont.children));
            out.push(...(PowerEnv.steamParts || []), ...(PowerEnv.smokeParts || []));
        }
        return out;
    },
    _sweepLazy() {
        for (const g of this._lazySources()) {
            if (!g || g.destroyed || g._pxDone || !(g instanceof PIXI.Graphics)) continue;
            g._pxDone = true;
            this.pixelizeKeep(g);
        }
    },
    // Like pixelize() but the texture belongs to a long-lived zone object, so it is not
    // freed on the next building rebuild.
    pixelizeKeep(g) {
        const before = this._rts.length;
        this.pixelize(g);
        if (this._rts.length > before) this._rts.pop();
    },

    // Live weather names → the palette's weather states.
    _wx() {
        const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
        if (w === 'rain' || w === 'drizzle') return 'rain';
        if (w === 'thunderstorm') return 'storm';
        if (w === 'snow') return 'snow';
        if (w === 'fog') return 'fog';
        return 'clear';
    },

    _apply(e, t) {
        const K = this._K || (this._K = PL.tod(G.getDayPhase(), this._wx()));
        const emitA = PL.clamp(K.night * 1.25 - 0.05, 0, 1);
        e.base.tint = K.amb;
        e.emit.alpha = emitA;
        if (e.bloom) e.bloom.alpha = emitA * 0.85;
        if (e.snow) {
            e.snow.visible = this._wx() === 'snow';
            e.snow.tint = PL.mix(K.amb, 0xffffff, 0.35);
        }
        for (const s of e.lights) s.alpha = s.baseA * emitA;
        for (const s of e.blinks) s.alpha = PL.frac(t / s.period + s.phase) < 0.45 ? 0.6 + emitA * 0.4 : 0;
    },

    // Called every frame from Environment.update().
    update(dp) {
        if (!this.enabled) return;
        if (typeof G !== 'undefined' && G.tick % 30 === 0) this._sweepLazy();
        if (!this._entries.length) return;
        this._K = PL.tod(dp, this._wx());
        const t = performance.now() / 1000;
        for (const e of this._entries) {
            if (e.root.destroyed) continue;
            const c = e.b._container;
            if (c && !c.visible) continue;
            this._apply(e, t);
        }
    },
};
