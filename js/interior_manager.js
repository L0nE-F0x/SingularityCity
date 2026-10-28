/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR MANAGER (v15.2.0 - Estate Router Update)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Interior = {
    isDragging: false,
    layer: null,
    activeModule: null,

    // ─── DIORAMA FRAME ───────────────────────────────────────────────────────────────
    // Every module lays its building out from G.vpW. Under the pixel skin's zoom that tiled
    // one room module across a 1900-px screen, so most interiors read as wallpaper. A framed
    // module is built (and updated) as if the screen were `frame.w` wide; the manager then
    // centres it on the real screen and stretches whatever it drew edge to edge (sky, street,
    // earth, the underground stack, the live trains) out to the real edges. The building
    // keeps its own walls, so it reads as a cutaway standing in the street.
    _frame: null, // { w, realW, offset, ext, ug, framed }
    // Phones and small windows keep the old full-width layout.
    FRAME_MIN_SCREEN: 1000,
    // Interiors that are an outdoor ground or a full-width scene keep the screen width.
    _unframed(bld) {
        const id = (bld && bld.id) || '';
        return id === 'forest_0' || id === 'forest_1' || id === 'forest_space' || id.startsWith('metro_');
    },
    // True while a module is being built (or updated) inside a diorama frame. Modules whose
    // building would otherwise span the whole screen inset it so it has walls to stand in.
    framed() {
        return !!(this._frame && this._frame.framed);
    },
    frameWidth(realW) {
        // Portrait screens keep the full-width layout (the zoom frames them at 1×).
        if (realW < this.FRAME_MIN_SCREEN || realW < G.vpH) return realW;
        // About 70% of the screen at the 1.5 pixel zoom the skin opens with.
        return Math.max(600, Math.min(1000, Math.round((realW * 0.7) / 1.5)));
    },

    // Run fn with the module's virtual screen width (and the edge stretch) in place. An
    // unframed build still has its underground stack noted (watch), so staff know the street.
    _inFrame(fn, watch) {
        const fr = this._frame;
        if (!fr || (!fr.framed && !watch)) return fn();
        const realW = G.vpW;
        G.vpW = fr.w;
        const undo = this._stretchEdges(fr);
        try {
            return fn();
        } finally {
            undo();
            G.vpW = realW;
        }
    },

    // While a framed module draws, the shared underground painters that are asked for a
    // full-frame band paint a full-screen one instead (with all their pillars, pipes and
    // veins), and the live-train slice widens to match. Everything else the module draws
    // edge to edge is stretched after the build (_stretchScene), once we know where each
    // Graphics actually sits. Unframed, nothing is stretched; the stack is only noted.
    _stretchEdges(fr) {
        const W = fr.w;
        const ext = fr.framed ? fr.ext : 0;
        const U = typeof Underground !== 'undefined' ? Underground : null;
        const saved = {};
        if (U) {
            // (g, x, topY, w, h, …) — a full-frame band becomes a full-screen band.
            [
                'drawBasementStack',
                'drawDeepEarth',
                'drawCableTray',
                'drawTunnelCavity',
                'drawInfrastructure',
                'drawOcean',
                'drawDesertGeology',
                'drawSiloBunker',
            ].forEach((k) => {
                if (typeof U[k] !== 'function') return;
                const orig = (saved[k] = U[k]);
                U[k] = function (g, x, topY, w, ...rest) {
                    if (Math.abs(x) < 0.51 && Math.abs(x + w - W) < 0.51) {
                        if (k === 'drawBasementStack' && !fr.ug)
                            fr.ug = { top: topY, h: rest[0], profile: rest[1], g: g };
                        return orig.call(this, g, x - ext, topY, w + ext * 2, ...rest);
                    }
                    return orig.call(this, g, x, topY, w, ...rest);
                };
            });
            // The live trains map a 1200-px world slice onto the tunnel band. Keep the scale and
            // widen the band, so trains run on through the stretched tunnel instead of popping.
            if (typeof U.attachLiveTrains === 'function' && ext) {
                const orig = (saved.attachLiveTrains = U.attachLiveTrains);
                U.attachLiveTrains = function (parent, wx, lx, ly, lw, slice) {
                    if (Math.abs(lx) < 0.51 && Math.abs(lx + lw - W) < 0.51) {
                        const s = slice || 1200;
                        const nw = lw + ext * 2;
                        return orig.call(this, parent, wx, lx - ext, ly, nw, (s * nw) / lw);
                    }
                    return orig.call(this, parent, wx, lx, ly, lw, slice);
                };
            }
        }
        return () => {
            if (U) Object.keys(saved).forEach((k) => (U[k] = saved[k]));
        };
    },

    // After a framed build: every rectangle that touches the frame's left or right edge, in
    // frame coordinates, runs on past the real screen edge. That is the sky, the street, the
    // earth beside the basement, foundation strips and the deep fill; framed buildings are
    // inset from the edges, and props drawn at their own origin sit somewhere inside, so
    // neither is touched.
    _stretchScene(root, fr) {
        const W = fr.w;
        const ext = fr.ext;
        const walk = (node, ox) => {
            if (!node || node.destroyed) return;
            const sx = node.scale ? node.scale.x : 1;
            const sy = node.scale ? node.scale.y : 1;
            if (
                sx !== 1 ||
                sy !== 1 ||
                node.rotation ||
                (node.pivot && node.pivot.x) ||
                (node.skew && node.skew.x)
            )
                return;
            const x = ox + (node.x || 0);
            if (node instanceof PIXI.Graphics && node.geometry && node.geometry.graphicsData) {
                let hit = false;
                for (const d of node.geometry.graphicsData) {
                    const r = d.shape;
                    if (!(r instanceof PIXI.Rectangle) || d.matrix || !(r.width > 0)) continue;
                    if (r.width > W + 200) continue; // already full-screen
                    // The 3000-px voids under a stack run far past the scroll limit; widened at
                    // full height they would only cost texture memory, so they are cut short.
                    const tall = r.height >= 2500;
                    const x0 = x + r.x;
                    const x1 = x0 + r.width;
                    const l = x0 > -41 && x0 < 0.51;
                    const rr = x1 > W - 0.51 && x1 < W + 41;
                    if (!l && !rr) continue;
                    if (tall) r.height = 700;
                    if (l) {
                        r.x -= ext;
                        r.width += ext;
                    }
                    if (rr) r.width += ext;
                    hit = true;
                }
                if (hit) node.geometry.invalidate();
            }
            if (node.children) for (const c of node.children) walk(c, x);
        };
        for (const c of root.children) walk(c, 0);
    },

    // After a framed build: centre the cutaway on the real screen, spread the stars back
    // over it, close the stack with a band of strata, and hand the zoom a frame to fit.
    _settleFrame(mod, layer) {
        const fr = this._frame;
        const realW = fr.realW;
        this._stretchScene(layer, fr);
        layer.children.forEach((c) => (c.x += fr.offset));
        // Layer hit areas were sized to the frame; the cutaway now sits mid-screen and the
        // whole screen should still take a drag.
        if (layer.hitArea && layer.hitArea instanceof PIXI.Rectangle)
            layer.hitArea = new PIXI.Rectangle(-realW * 4, -G.vpH * 8, realW * 9, G.vpH * 24);
        if (mod.starsLayer && !mod.starsLayer.destroyed) {
            mod.starsLayer.children.forEach((s) => (s.x = Math.random() * realW - fr.offset));
        }
        const scene = mod.scene;
        if (!scene || scene.destroyed) return;
        const hint = mod._frameHint || null;
        const lb = scene.getLocalBounds();
        let top = lb.y;
        let ground = null;
        let bottom = lb.y + lb.height;
        const ug = fr.ug;
        if (ug && ug.g && ug.g.parent === scene) {
            ground = ug.top - 86; // basement floor (80) + foundation (6) above the stack
            const p = Underground._profile(ug.profile);
            // Ocean, desert and silo stacks fill themselves; the rest end in a strata band.
            const strata = p.ocean || p.desert || p.silo ? 0 : 150;
            const end = ug.top + ug.h;
            if (strata) {
                const st = new PIXI.Graphics();
                st.eventMode = 'none';
                Underground.drawDeepEarth(st, -fr.ext, end, fr.w + fr.ext * 2, strata, p.earthZone, 4242);
                // A darker floor so the band ends on a rock bed, not a cut.
                st.beginFill(0x120a06, 0.55);
                st.drawRect(-fr.ext, end + strata - 24, fr.w + fr.ext * 2, 24);
                st.endFill();
                scene.addChildAt(st, Math.min(scene.children.length, scene.getChildIndex(ug.g) + 1));
            }
            bottom = end + strata;
        }
        if (hint) {
            if (typeof hint.top === 'number') top = hint.top;
            if (typeof hint.ground === 'number') ground = hint.ground;
            if (typeof hint.bottom === 'number') bottom = hint.bottom;
            // A module with its own underground (no shared stack) can still ask for the strata
            // band where its fill turns to void.
            if (typeof hint.strataAt === 'number') {
                const st = new PIXI.Graphics();
                st.eventMode = 'none';
                Underground.drawDeepEarth(st, -fr.ext, hint.strataAt, fr.w + fr.ext * 2, 150, 'tech', 4243);
                st.beginFill(0x120a06, 0.55);
                st.drawRect(-fr.ext, hint.strataAt + 126, fr.w + fr.ext * 2, 24);
                st.endFill();
                scene.addChild(st);
                if (typeof hint.bottom !== 'number') bottom = hint.strataAt + 150;
            }
        }
        // The frame in scene px (the scene may have had its own x before the shift).
        const s = scene.scale ? scene.scale.x : 1;
        mod.frame = {
            x0: (fr.offset - scene.x) / s,
            x1: (fr.offset + fr.w - scene.x) / s,
            top: top,
            ground: ground,
            bottom: bottom,
            focus: hint && hint.focus ? hint.focus : null,
        };
    },

    // ─── PIXEL DRESSING (skin only) ────────────────────────────────────────────────────────
    // Labels under 6 px were left in their smooth font and read as smudges. Each one becomes
    // an 8 px pixel label if that still fits its spot (with a little slack); the rest are
    // dropped, so a room shows fewer labels but every one of them reads.
    _crispLabels(scene) {
        if (typeof PixelArt === 'undefined' || !PixelArt.enabled || !PixelArt.pixelText) return;
        if (!document.fonts || !document.fonts.check('8px Tiny5')) return;
        const walk = (n) => {
            if (!n || n.destroyed) return;
            if (n instanceof PIXI.Text) {
                const st = n.style;
                const size = parseFloat(st.fontSize) || 8;
                if (size < 6 && /[A-Za-z0-9]/.test(n.text)) {
                    const was = PIXI.TextMetrics.measureText(n.text, st).width;
                    const probe = st.clone();
                    probe.fontFamily = 'Tiny5, monospace';
                    probe.fontSize = 8;
                    probe.fontWeight = 'normal';
                    const now = PIXI.TextMetrics.measureText(n.text, probe).width;
                    if (now <= was * 1.6 + 6) st.fontSize = 8;
                    else n.visible = false;
                }
                return;
            }
            if (n.children) for (const c of n.children) walk(c);
        };
        walk(scene);
    },

    // Ceiling lamps (js/pixel/interior_light.js) used to hang only in InteriorCity. The other
    // floor-stacked interiors share an 80 px floor; from street level up to the roof line we
    // know where each ceiling is. Rooms with their own light rigs keep them.
    _addLamps(mod, bld) {
        if (typeof PixelArt === 'undefined' || !PixelArt.enabled || typeof PL === 'undefined') return;
        if (!PL.InteriorLight || !mod || !mod.scene || mod === InteriorCity) return;
        const own = [
            typeof InteriorBar !== 'undefined' && InteriorBar,
            typeof InteriorBlackMarket !== 'undefined' && InteriorBlackMarket,
            typeof InteriorMetroStation !== 'undefined' && InteriorMetroStation,
            typeof InteriorAlignment !== 'undefined' && InteriorAlignment,
        ];
        if (own.includes(mod) || (bld.id || '').startsWith('house_')) return;
        const fr = this._frame;
        if (!fr || typeof fr.ground !== 'number') return;
        const top = mod.frame ? mod.frame.top : mod.scene.getLocalBounds().y;
        const n = Math.max(0, Math.min(12, Math.round((fr.ground - (top + 40)) / 80)));
        if (!n) return;
        const floors = [];
        for (let k = 0; k < n; k++) floors.push({ y: fr.ground - 80 * (k + 1), h: 80 });
        PL.InteriorLight.addLamps(mod.scene, 110, fr.w - 140, floors, { step: 170 });
    },

    // ─── STAFF ───────────────────────────────────────────────────────────────────────────
    // Citizens keep real schedules, so most rooms stood empty outside their hours. A few
    // people who work the building keep every interior lived in at any hour. They are not
    // citizens: no model and no panel, just a job in a tooltip. The night shift swaps roles.
    _staff: [],

    _isNight() {
        const dp = G.getDayPhase();
        return dp > 0.83 || dp < 0.25;
    },

    // Who works where. at/to are fractions of the building span (to = patrol end), floor 0 is
    // street level. Modules that already staff a room themselves are left alone.
    _staffPlan(bld, mod) {
        const id = bld.id || '';
        const t = bld.type || '';
        const night = this._isNight();
        const P = [];
        const guard = (at, torch) => ({
            role: 'Security',
            at,
            shirt: 0x1e293b,
            hat: 'cap',
            still: true,
            torch,
        });
        if (id === 'neon_bar') {
            P.push({ role: 'Bartender', at: 0.42, shirt: 0x18181b, accent: 0xff00ff, still: true });
            if (night) P.push({ role: 'Bouncer', at: 0.06, suit: true, shirt: 0x111111, still: true });
        } else if (id.startsWith('dc_')) {
            P.push({
                role: night ? 'Night NOC Tech' : 'NOC Tech',
                at: 0.22,
                to: 0.62,
                shirt: 0x0e7490,
                glasses: true,
            });
            P.push(guard(0.07, night));
        } else if (id.startsWith('fab_')) {
            P.push({ role: 'Fab Technician', at: 0.25, to: 0.66, shirt: 0xf1f5f9, hat: 'cap' });
            if (night)
                P.push({ role: 'Night Shift Lead', at: 0.78, shirt: 0x334155, glasses: true, still: true });
        } else if (id.startsWith('power_')) {
            P.push({ role: 'Plant Operator', at: 0.28, to: 0.64, shirt: 0xf59e0b, hat: 'cap' });
            if (night)
                P.push({
                    role: 'Safety Officer',
                    at: 0.1,
                    shirt: 0xfacc15,
                    hat: 'cap',
                    still: true,
                    torch: true,
                });
        } else if (t === 'university') {
            P.push(
                night
                    ? { role: 'Cleaner Bot', at: 0.2, to: 0.75, bot: true }
                    : { role: 'Librarian', at: 0.16, shirt: 0x7c2d12, glasses: true, still: true }
            );
        } else if (t === 'court') {
            P.push({ role: 'Bailiff', at: 0.1, shirt: 0x1e3a8a, hat: 'cap', still: true, torch: night });
        } else if (id === 'bld_1') {
            P.push(
                night
                    ? { role: 'Night Guard', at: 0.2, to: 0.75, shirt: 0x1e293b, hat: 'cap', torch: true }
                    : { role: 'Curator', at: 0.3, shirt: 0x7c3aed, glasses: true, still: true }
            );
        } else if (t === 'vcrow') {
            P.push({
                role: night ? 'Night Concierge' : 'Concierge',
                at: 0.12,
                suit: true,
                shirt: 0x14213d,
                still: true,
            });
        } else if (t === 'backbone' || t === 'agents') {
            if (night) P.push({ role: 'On-call SRE', at: 0.3, to: 0.62, shirt: 0x0f766e, glasses: true });
        } else if (id.startsWith('res_') || id.startsWith('npc_apt_')) {
            P.push({ role: 'Doorman', at: 0.12, suit: true, shirt: 0x7f1d1d, hat: 'cap', still: true });
            if (night) P.push({ role: 'Cleaner Bot', at: 0.3, to: 0.72, bot: true });
        } else if (id === 'cafe' || id === 'gym' || id === 'open_square') {
            // Their day staff are the module's; at night someone closes up.
            if (night) P.push({ role: 'Cleaner Bot', at: 0.25, to: 0.7, bot: true });
        } else if (id.startsWith('port_')) {
            P.push(
                night
                    ? guard(0.1, true)
                    : { role: 'Harbour Clerk', at: 0.3, to: 0.55, shirt: 0x0369a1, glasses: true }
            );
        } else if (id === 'ai_index' || id === 'park' || id === 'visitor_monument') {
            P.push(
                night
                    ? guard(0.12, true)
                    : {
                          role: id === 'ai_index' ? 'Index Analyst' : 'Guide',
                          at: 0.3,
                          to: 0.6,
                          shirt: 0x15803d,
                      }
            );
        } else if (mod === InteriorCity && bld.lab && night) {
            // A lab never fully sleeps: the cluster has an on-call engineer, the floors a cleaner.
            const fl = mod.floors || {};
            const keys = Object.keys(fl)
                .map(Number)
                .filter((f) => f > 0 && fl[f] && fl[f].theme !== 'basement');
            const train = keys.find((f) => fl[f].theme === 'training');
            if (train !== undefined && fl[train].cubicleSeats && fl[train].cubicleSeats.length)
                P.push({
                    role: 'On-call Engineer',
                    floor: train,
                    x: fl[train].cubicleSeats[0],
                    shirt: 0x0f766e,
                    glasses: true,
                    still: true,
                });
            const office = keys.filter((f) => fl[f].theme === 'general' || fl[f].theme === 'research');
            if (office.length)
                P.push({
                    role: 'Cleaner Bot',
                    floor: office[(bld.x % office.length) | 0],
                    at: 0.2,
                    to: 0.8,
                    bot: true,
                });
        }
        return P;
    },

    // Where the building's floors are: InteriorCity / InteriorRes keep them; the rest share
    // a template whose street floor sits just above the noted underground stack.
    _staffGeom(mod) {
        const fl = mod.floors;
        if (fl && fl[0] && typeof fl[0].y === 'number' && typeof mod.startX === 'number' && mod.usableW) {
            return {
                x0: mod.startX + 40,
                x1: mod.startX + mod.usableW - 30,
                y: (f) => (fl[f] && typeof fl[f].y === 'number' ? fl[f].y : null),
            };
        }
        const fr = this._frame;
        if (fr && typeof fr.ground === 'number')
            return { x0: 70, x1: fr.w - 100, y: (f) => (f === 0 ? fr.ground - 6 : null) };
        return null;
    },

    _placeStaff(bld, mod) {
        this._staff = [];
        const scene = mod && mod.scene;
        if (!scene || scene.destroyed || typeof HumanAvatar === 'undefined') return;
        const geo = this._staffGeom(mod);
        if (!geo) return;
        const plan = this._staffPlan(bld, mod);
        const span = geo.x1 - geo.x0;
        if (span < 120) return;
        plan.forEach((p, i) => {
            const y = geo.y(p.floor || 0);
            if (typeof y !== 'number') return;
            const x = typeof p.x === 'number' ? p.x : geo.x0 + span * p.at;
            const s = { x: x, y: y, still: !!p.still, t: Math.random() * 100, dir: 1, wait: 0 };
            if (typeof p.to === 'number') {
                s.a = Math.min(x, geo.x0 + span * p.to);
                s.b = Math.max(x, geo.x0 + span * p.to);
                s.speed = p.bot ? 0.35 : 0.45;
            }
            if (p.bot) {
                s.parts = this._drawCleanerBot(scene, x, y);
            } else {
                s.parts = HumanAvatar.draw(scene, {
                    x: x,
                    y: y,
                    name: null,
                    role: p.role,
                    shirt: p.shirt,
                    accent: p.accent,
                    suit: !!p.suit,
                    hat: p.hat || null,
                    glasses: !!p.glasses,
                    seed: bld.id + ':' + p.role + ':' + i,
                    showTag: false,
                    showDot: false,
                });
                s.hy = s.parts.head.y;
                s.by = s.parts.body.y;
                if (p.torch) s.torch = this._torch(s.parts.cont);
            }
            const c = s.parts.cont;
            c.zIndex = 120;
            c.eventMode = 'static';
            c._staffRole = p.role;
            if (typeof UI !== 'undefined' && UI.tip) UI.tip(c, p.role + ' · staff');
            this._staff.push(s);
        });
    },

    // A small mopping robot: dome, eye, wheels and a mop that trails behind it.
    _drawCleanerBot(parent, x, y) {
        const cont = new PIXI.Container();
        cont.x = x;
        cont.y = y;
        const body = new PIXI.Graphics();
        body.beginFill(0x000000, 0.25);
        body.drawEllipse(0, 1, 9, 2);
        body.endFill();
        body.beginFill(0x94a3b8);
        body.drawRoundedRect(-8, -12, 16, 10, 4);
        body.endFill();
        body.beginFill(0xe2e8f0);
        body.drawRect(-6, -14, 12, 3);
        body.endFill();
        body.beginFill(0x334155);
        body.drawCircle(-5, -2, 2);
        body.drawCircle(5, -2, 2);
        body.endFill();
        body.beginFill(0x22d3ee);
        body.drawRect(2, -10, 3, 2);
        body.endFill();
        const mop = new PIXI.Graphics();
        mop.beginFill(0x78350f);
        mop.drawRect(-14, -9, 7, 1);
        mop.endFill();
        mop.beginFill(0xf1f5f9);
        mop.drawRect(-17, -2, 6, 2);
        mop.endFill();
        mop.beginFill(0x7dd3fc, 0.35);
        mop.drawRect(-22, 0, 10, 1);
        mop.endFill();
        cont.addChild(mop, body);
        parent.addChild(cont);
        return { cont: cont, body: body, mop: mop, bot: true };
    },

    // A guard's torch: a soft additive cone ahead of them, only drawn after dark.
    _torch(cont) {
        const g = new PIXI.Graphics();
        g.beginFill(0xfff3c4, 0.16);
        g.drawPolygon([6, -18, 7, -15, 46, -2, 46, 4, 30, 4]);
        g.endFill();
        g.beginFill(0xfff3c4, 0.9);
        g.drawRect(5, -18, 3, 2);
        g.endFill();
        g.blendMode = PIXI.BLEND_MODES.ADD;
        g._pxLit = true;
        cont.addChild(g);
        return g;
    },

    _updateStaff() {
        if (!this._staff.length) return;
        for (const s of this._staff) {
            const p = s.parts;
            if (!p || !p.cont || p.cont.destroyed) continue;
            s.t += 1;
            let moving = false;
            if (!s.still && typeof s.a === 'number') {
                if (s.wait > 0) s.wait--;
                else {
                    s.x += s.dir * s.speed;
                    moving = true;
                    if (s.x >= s.b || s.x <= s.a) {
                        s.x = Math.max(s.a, Math.min(s.b, s.x));
                        s.dir = -s.dir;
                        s.wait = 90 + ((s.t * 7) % 150);
                    }
                }
                p.cont.x = s.x;
                p.cont.scale.x = s.dir;
            } else if (s.t % 400 === 0) {
                // Standing staff glance around now and then.
                p.cont.scale.x = -p.cont.scale.x || 1;
            }
            if (p.bot) {
                p.body.y = moving ? Math.round(Math.sin(s.t * 0.4)) * 0.5 : 0;
                p.mop.x = moving ? Math.sin(s.t * 0.3) * 2 : 0;
            } else {
                const k = moving ? Math.sin(s.t * 0.3) : 0;
                if (p.legL && p.legR) {
                    p.legL.y = k * 1.5;
                    p.legR.y = -k * 1.5;
                }
                const bob = moving ? Math.abs(k) * 1 : Math.sin(s.t * 0.05) * 0.5;
                p.body.y = s.by - bob;
                p.head.y = s.hy - bob;
            }
        }
    },

    build(bld, layer) {
        this.layer = layer;

        // Auto-tag interior furniture/items with hover tooltips (one-shot).
        if (typeof UI !== 'undefined' && UI.initInteriorTips) UI.initInteriorTips();

        // Route to the appropriate interior module
        if (bld.id.startsWith('res_') || bld.id.startsWith('house_')) {
            this.activeModule = InteriorRes;
        } else if (
            bld.type &&
            ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(bld.type) &&
            typeof SpaceInterior !== 'undefined'
        ) {
            this.activeModule = SpaceInterior;
        } else if (
            (bld.id.startsWith('dc_') || bld.id.startsWith('fab_')) &&
            typeof InteriorDC !== 'undefined'
        ) {
            this.activeModule = InteriorDC;
        } else if (bld.id === 'neon_bar' && typeof InteriorBar !== 'undefined') {
            this.activeModule = InteriorBar;
        } else if (bld.id === 'black_market' && typeof InteriorBlackMarket !== 'undefined') {
            this.activeModule = InteriorBlackMarket;
        } else if (bld.id.startsWith('power_') && typeof InteriorPower !== 'undefined') {
            this.activeModule = InteriorPower;
        } else if (bld.id === 'bld_1' && typeof InteriorLegacy !== 'undefined') {
            this.activeModule = InteriorLegacy;
        } else if (bld.id.startsWith('npc_apt_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.id.startsWith('suburb_') && typeof InteriorNPC !== 'undefined') {
            this.activeModule = InteriorNPC;
        } else if (bld.id.startsWith('diplomat_villa_') && typeof InteriorAmbassadorRes !== 'undefined') {
            this.activeModule = InteriorAmbassadorRes;
        } else if (bld.type === 'university' && typeof UniversityInterior !== 'undefined') {
            this.activeModule = UniversityInterior;
        } else if (bld.type === 'court' && typeof CourtInterior !== 'undefined') {
            this.activeModule = CourtInterior;
        } else if (bld.type === 'jail' && typeof JailInterior !== 'undefined') {
            this.activeModule = JailInterior;
        } else if (bld.id === 'convention_center' && typeof ConferenceInterior !== 'undefined') {
            this.activeModule = ConferenceInterior;
        } else if (bld.type === 'vcrow' && typeof InteriorVCRow !== 'undefined') {
            this.activeModule = InteriorVCRow;
        } else if (bld.type === 'backbone' && typeof InteriorBackbone !== 'undefined') {
            this.activeModule = InteriorBackbone;
        } else if (bld.type === 'robotics' && typeof InteriorRobotics !== 'undefined') {
            this.activeModule = InteriorRobotics;
        } else if (bld.type === 'longevity' && typeof InteriorLongevity !== 'undefined') {
            this.activeModule = InteriorLongevity;
        } else if (bld.type === 'agents' && typeof InteriorAgents !== 'undefined') {
            this.activeModule = InteriorAgents;
        } else if (bld.type === 'alignment' && typeof InteriorAlignment !== 'undefined') {
            this.activeModule = InteriorAlignment;
        } else if (bld.type === 'embassy' && typeof InteriorEmbassy !== 'undefined') {
            this.activeModule = InteriorEmbassy;
            // NB: trains are NOT a building interior — clicking one calls G.enterTrainFocus()
            // (a real-world camera cutaway), so there is no 'train' route here.
        } else if (bld.id && bld.id.startsWith('metro_') && typeof InteriorMetroStation !== 'undefined') {
            this.activeModule = InteriorMetroStation;
        } else if (bld.id === 'times_hq' && typeof InteriorNewspaper !== 'undefined') {
            this.activeModule = InteriorNewspaper;
        } else {
            this.activeModule = InteriorCity;
        }

        const mod = this.activeModule;
        const realW = G.vpW;
        // The frame is fitted to the skin's zoomed interiors; the classic look keeps its
        // full-width rooms at zoom 1.
        const pixel = typeof PixelArt !== 'undefined' && PixelArt.enabled;
        const fw = this._unframed(bld) || !pixel ? realW : this.frameWidth(realW);
        this._frame = {
            w: fw,
            realW: realW,
            offset: Math.round((realW - fw) / 2),
            ext: Math.ceil(realW * 1.25),
            ug: null,
            framed: fw < realW,
        };
        if (mod) {
            mod.frame = null;
            mod._frameHint = null;
        }
        if (mod && mod.build) {
            this._inFrame(() => mod.build(bld, layer), true);
            this.isDragging = mod.isDragging;
            // Street level in scene px, for the staff: the module's word, else just above the
            // shared underground stack it drew.
            const fr = this._frame;
            const h0 = mod._frameHint;
            fr.ground =
                h0 && typeof h0.ground === 'number'
                    ? h0.ground
                    : fr.ug && fr.ug.g && fr.ug.g.parent === mod.scene
                      ? fr.ug.top - 86
                      : null;
            if (this._frame.framed) this._settleFrame(mod, layer);
            else if (mod._frameHint && mod._frameHint.wide) {
                // Full-width scenes (the metro station) keep their width; the hint only says
                // what to open on vertically and how far to scroll.
                const h = mod._frameHint;
                mod.frame = {
                    wide: true,
                    top: h.top || 0,
                    ground: typeof h.ground === 'number' ? h.ground : null,
                    bottom: h.bottom,
                    focus: h.focus || null,
                };
            }
            this._placeStaff(bld, mod);
            this._addLamps(mod, bld);
            if (mod.scene) this._crispLabels(mod.scene);
        }
        // Pixel skin: open zoomed in, scrolling through the floors (js/pixel/interior_zoom.js).
        if (
            typeof PixelArt !== 'undefined' &&
            PixelArt.enabled &&
            typeof PL !== 'undefined' &&
            PL.InteriorZoom
        )
            PL.InteriorZoom.begin(this.activeModule, layer);
    },

    cleanup() {
        if (typeof PL !== 'undefined' && PL.InteriorZoom) PL.InteriorZoom.end();
        if (typeof PL !== 'undefined' && PL.InteriorLight) PL.InteriorLight.end();
        // Remove stale window event listeners when exiting any interior
        if (this.activeModule) {
            // Modules use either onMove/_onMove and onUp/_onUp patterns
            const moveFn = this.activeModule.onMove || this.activeModule._onMove;
            const upFn = this.activeModule.onUp || this.activeModule._onUp;
            if (moveFn) window.removeEventListener('pointermove', moveFn);
            if (upFn) window.removeEventListener('pointerup', upFn);
            this.activeModule.isDragging = false;
            this.activeModule.scene = null;
            this.activeModule.frame = null;
            if (this.activeModule.layer) {
                this.activeModule.layer.removeAllListeners();
                this.activeModule.layer = null;
            }
        }
        this.activeModule = null;
        this._frame = null;
        this._staff = [];
        this.isDragging = false;
    },

    update() {
        const mod = this.activeModule;
        if (mod && mod.update) {
            // A framed module keeps living in its own frame: avatar ranges, celestial arcs
            // and per-frame redraws all read the same width it was built with.
            this._inFrame(() => mod.update());
        }
        this._updateStaff();
        // After the module's own update has positioned avatars, pan the scene
        // to keep the tracked avatar centered. Runs once per frame so elevator
        // / walking motion is followed smoothly.
        this._updateInteriorCamera();
        if (typeof PL !== 'undefined' && PL.InteriorZoom) PL.InteriorZoom.update();
        // Viewport culling goes last, once the camera has moved the scene.
        if (this.activeModule && this.activeModule.cull) this.activeModule.cull();
    },

    // ─────────────────────────────────────────────────────────────
    //   INTERIOR CAMERA FOLLOW (used while G.tracking is active)
    // ─────────────────────────────────────────────────────────────
    _updateInteriorCamera() {
        if (typeof G === 'undefined') return;
        const m = this.activeModule;
        if (!m) return;
        const scene = m.scene;
        if (!scene || scene.destroyed) return;

        // Lazily remember the scene's resting transform so we can restore it
        // when tracking ends (or when the user starts dragging the interior).
        if (typeof scene._restX === 'undefined') {
            scene._restX = scene.x || 0;
            scene._restY = scene.y || 0;
            scene._restScale = scene.scale ? scene.scale.x : 1;
        }

        if (!G.tracking) {
            // Smoothly return scene to its resting transform.
            if (scene._cameraEngaged) {
                const lerp = 0.1;
                scene.x += (scene._restX - scene.x) * lerp;
                scene.y += (scene._restY - scene.y) * lerp;
                if (scene.scale) {
                    const ns = scene.scale.x + (scene._restScale - scene.scale.x) * lerp;
                    scene.scale.set(ns);
                }
                if (
                    Math.abs(scene.x - scene._restX) < 0.5 &&
                    Math.abs(scene.y - scene._restY) < 0.5 &&
                    (!scene.scale || Math.abs(scene.scale.x - scene._restScale) < 0.005)
                ) {
                    scene.x = scene._restX;
                    scene.y = scene._restY;
                    if (scene.scale) scene.scale.set(scene._restScale);
                    scene._cameraEngaged = false;
                }
            }
            return;
        }

        const av = this._findTrackedAvatar();
        if (!av || !av.cont || av.cont.destroyed) return;

        // Use the avatar's pre-scale local position; we apply scale ourselves
        // so the centering math stays correct as we zoom in.
        const targetScale = 1.45;
        const curScale = scene.scale ? scene.scale.x : 1;
        const newScale = curScale + (targetScale - curScale) * 0.05;
        if (scene.scale) scene.scale.set(newScale);

        const avX = av.cont.x;
        const avY = av.cont.y;
        // Sit the avatar in the lower-middle of the viewport so we can see
        // the floor they're walking on plus the ceiling above.
        const targetSceneX = G.vpW / 2 - avX * newScale;
        const targetSceneY = G.vpH * 0.55 - avY * newScale;

        const lerp = 0.08;
        scene.x += (targetSceneX - scene.x) * lerp;
        scene.y += (targetSceneY - scene.y) * lerp;
        scene._cameraEngaged = true;
    },

    _findTrackedAvatar() {
        if (typeof G === 'undefined' || !G.tracking) return null;
        const m = this.activeModule;
        if (!m) return null;
        const t = G.tracking;
        const tid = t.id;

        // Most modules expose `avatars` (an array of objects with .m and .cont).
        if (Array.isArray(m.avatars)) {
            for (const av of m.avatars) {
                if (!av || !av.m || !av.cont) continue;
                if (t.type === 'ceo' && av.m.isCeo && av.m.lab === t.lab) return av;
                if (av.m.id === tid) return av;
            }
        }
        // InteriorCityAI alt path uses `workers`.
        if (Array.isArray(m.workers)) {
            for (const w of m.workers) {
                if (!w || !w.m || !w.c) continue;
                if (w.m.id === tid) return { cont: w.c, m: w.m };
            }
        }
        // Metro stations / DC / a few others use a Map keyed by id.
        if (m.avatarPool && typeof m.avatarPool.get === 'function') {
            const direct = m.avatarPool.get(tid);
            if (direct && direct.cont && direct.cont.visible) return direct;
            const npc = m.avatarPool.get('npc_' + tid);
            if (npc && npc.cont && npc.cont.visible) return npc;
        }
        return null;
    },
};
