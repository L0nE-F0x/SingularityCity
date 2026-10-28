/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   STREET LIFE (pixel skin only)
   The service layer of the city: everything that keeps moving between rush hours and is NOT a
   model citizen. Sidewalk delivery bots trundling from door to door, a city bus working its way
   along the far curb and stopping at the metro stations, street sweepers at night, parcel drones
   dropping deliveries by day, a patrol drone sweeping its searchlight after dark, and pigeons
   that peck about the pavement and burst into the air when something rolls past.

   Agents only exist in a window around the camera: one that leaves the window is recycled at
   the far edge, so every district has life without simulating 56,000 px of street. Nothing
   here is clickable and nothing reads from it — the simulation is untouched.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const StreetLife = {
    enabled: false,
    bots: [],
    drones: [],
    pigeons: [],
    bus: null,
    sweeper: null,
    patrol: null,
    _tex: null,
    _stops: null,
    _stopsW: 0,

    // ── Art (art pixels; drawn facing right) ─────────────────────────────────────────────────
    // Legend per sprite; '.' is clear. Lit parts are split into a second texture shown with
    // an additive blend so the night tint never dims them.
    ART: {
        bot: {
            rows: ['.....f.', '.....a.', '.hhhhh.', 'wwwwwww', 'wweewww', '.o.o.o.'],
            pal: { f: 0xff6a2a, a: 0x8a929c, h: 0xf4f4f0, w: 0xd2d6dc, e: 0x2a4a5a, o: 0x2a2e36 },
            lit: { e: 0x4ff0ff, f: 0xff8a4a },
        },
        botOpen: {
            rows: ['.....f.', 'h....a.', '.h.....', 'wbbbbbw', 'wweewww', '.o.o.o.'],
            pal: {
                f: 0xff6a2a,
                a: 0x8a929c,
                h: 0xf4f4f0,
                w: 0xd2d6dc,
                b: 0xc8904a,
                e: 0x2a4a5a,
                o: 0x2a2e36,
            },
            lit: { e: 0x7affa0, f: 0xff8a4a },
        },
        bus: {
            rows: [
                '..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..',
                '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbRRRRRRb.',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                'bssssssssssssssssssssssssssssssssssssssssssb',
                'bbbbbbDDbbbbbbbbbbbbbbbbbbbbbbDDbbbbbbbbbbbL',
                'bbbbbbDDbbbbbbbbbbbbbbbbbbbbbbDDbbbbbbbbbbbb',
                'ddddddddddddddddddddddddddddddddddddddddddd.',
                '....oOo...........................oOo.......',
            ],
            pal: {
                r: 0xdfe6ee,
                b: 0x2f7fd8,
                w: 0x24323f,
                W: 0x3a4a5a,
                s: 0xffc23a,
                D: 0x1a2632,
                L: 0xfff2c0,
                d: 0x1c2430,
                o: 0x1a1a20,
                O: 0x8a8f99,
                R: 0x3a2a10,
            },
            lit: { w: 0xffd890, W: 0xc8e8ff, L: 0xfff4d0, R: 0xffa82a },
        },
        busOpen: {
            rows: [
                '..rrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr..',
                '.bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbRRRRRRb.',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwwwbwwwbWWW',
                'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
                'bssssssssssssssssssssssssssssssssssssssssssb',
                'bbbbbbllbbbbbbbbbbbbbbbbbbbbbbllbbbbbbbbbbbL',
                'bbbbbbllbbbbbbbbbbbbbbbbbbbbbbllbbbbbbbbbbbb',
                'ddddddddddddddddddddddddddddddddddddddddddd.',
                '....oOo...........................oOo.......',
            ],
            pal: {
                r: 0xdfe6ee,
                b: 0x2f7fd8,
                w: 0x24323f,
                W: 0x3a4a5a,
                s: 0xffc23a,
                l: 0xf0e2b8,
                L: 0xfff2c0,
                d: 0x1c2430,
                o: 0x1a1a20,
                O: 0x8a8f99,
                R: 0x3a2a10,
            },
            lit: { w: 0xffd890, W: 0xc8e8ff, L: 0xfff4d0, l: 0xffe8b0, R: 0xffa82a },
        },
        sweeper: {
            rows: [
                '.....yy.......',
                '..hhhhhhhh....',
                '.hggggggggh...',
                'bbbbbbbbbbbbb.',
                'bbsssbbbbbbbbb',
                'bbtttbbbbbbbbb',
                '.oO.....oO..BB',
                '............BB',
            ],
            pal: {
                y: 0xffb020,
                h: 0xf0f2f4,
                g: 0x2a3a48,
                b: 0xe0e4e8,
                s: 0x3aa86a,
                t: 0x9aa2ac,
                o: 0x1a1a20,
                O: 0x8a8f99,
                B: 0x6a5a3a,
            },
            lit: { y: 0xffc040, g: 0xbfe8ff },
        },
        drone: {
            rows: [
                'rrr.....rrr',
                '.a.aaaaa.a.',
                '...hhhhh...',
                '...wwewww..',
                '.....t.....',
                '....ppp....',
                '....ppp....',
            ],
            pal: {
                r: 0xc0c8d0,
                a: 0x6a727c,
                h: 0xf0f2f5,
                w: 0xd2d6dc,
                e: 0x3a4a5a,
                t: 0x5a626c,
                p: 0xc8904a,
            },
            lit: { e: 0xff4050 },
        },
        droneEmpty: {
            rows: ['rrr.....rrr', '.a.aaaaa.a.', '...hhhhh...', '...wwewww..'],
            pal: { r: 0xc0c8d0, a: 0x6a727c, h: 0xf0f2f5, w: 0xd2d6dc, e: 0x3a4a5a },
            lit: { e: 0xff4050 },
        },
        patrol: {
            rows: ['rrr.......rrr', '.a.aaaaaaa.a.', '...kkkkkkk...', '..kkBkkkRkk..', '.....kkk.....'],
            pal: { r: 0xb0b8c0, a: 0x4a525c, k: 0x2a3450, B: 0x2a4aa0, R: 0xa02a3a },
            lit: { B: 0x4a8aff, R: 0xff4a5a },
        },
        parcel: {
            rows: ['ppp', 'PtP'],
            pal: { p: 0xd8a060, P: 0xc8904a, t: 0xe8d8a8 },
            lit: {},
        },
    },

    _build(name) {
        const def = this.ART[name];
        const rows = def.rows;
        const w = rows[0].length;
        const img = new PL.Img(w, rows.length);
        const lit = new PL.Img(w, rows.length);
        let hasLit = false;
        rows.forEach((row, y) => {
            for (let x = 0; x < w; x++) {
                const ch = row[x];
                if (def.pal[ch] !== undefined) img.set(x, y, def.pal[ch]);
                if (def.lit[ch] !== undefined) {
                    lit.set(x, y, def.lit[ch]);
                    hasLit = true;
                }
            }
        });
        return { base: PL.tex(img), lit: hasLit ? PL.tex(lit) : null, w: w, h: rows.length };
    },
    tex(name) {
        if (!this._tex) this._tex = {};
        if (!this._tex[name]) this._tex[name] = this._build(name);
        return this._tex[name];
    },

    // A sprite pair (body + additive lights) in a container whose origin is the bottom
    // centre of the art, mirrored with scale.x like the rest of the city's walkers.
    _make(name, layer) {
        const T = this.tex(name);
        const A = PL.ART;
        const c = new PIXI.Container();
        c.eventMode = 'none';
        c.body = new PIXI.Sprite(T.base);
        c.lit = new PIXI.Sprite(T.lit || PIXI.Texture.EMPTY);
        c.lit.blendMode = PIXI.BLEND_MODES.ADD;
        [c.body, c.lit].forEach((s) => {
            s.scale.set(A);
            s.x = -Math.round(T.w / 2) * A;
            s.y = -T.h * A;
            c.addChild(s);
        });
        c.art = name;
        layer.addChild(c);
        return c;
    },
    _setArt(c, name) {
        if (c.art === name) return;
        const T = this.tex(name);
        c.body.texture = T.base;
        c.lit.texture = T.lit || PIXI.Texture.EMPTY;
        c.art = name;
    },

    init() {
        this.enabled =
            typeof PixelArt !== 'undefined' && PixelArt.enabled && typeof PL !== 'undefined' && !!PL.Img;
        if (!this.enabled || !G.charLayer || !G.carLayer) return;
        this.ready = true;
    },

    // ── Helpers ──────────────────────────────────────────────────────────────────────────────
    _view() {
        const z = G.world.scale.x || 1;
        const left = -G.world.x / z;
        return { left: left, right: left + G.vpW / z, z: z };
    },
    _hour() {
        return G.getDayPhase() * 24;
    },
    _night() {
        const K = PixelArt._K;
        return K ? PL.clamp(K.night, 0, 1) : 0;
    },
    // Open street: not over the harbour water.
    _street(x) {
        const pa = G.bldById && G.bldById.port_authority;
        const pc = G.bldById && G.bldById.port_crane;
        if (pa && pc && x > pa.x - 120 && x < pc.x + pc.w + 60) return false;
        return x > 40 && x < G.cityW - 40;
    },
    _busStops() {
        if (this._stops && this._stopsW === G.cityW) return this._stops;
        this._stopsW = G.cityW;
        this._stops = (typeof BLDS !== 'undefined' ? BLDS : [])
            .filter(
                (b) =>
                    b &&
                    b.id &&
                    (b.id.startsWith('metro_') ||
                        /^(cafe|arena|uni_main|neon_bar|times_hq|city_park)$/.test(b.id))
            )
            .map((b) => b.x + b.w / 2)
            .sort((a, b) => a - b);
        return this._stops;
    },
    _doors() {
        if (this._doorList && this._doorW === G.cityW) return this._doorList;
        this._doorW = G.cityW;
        this._doorList = (typeof BLDS !== 'undefined' ? BLDS : [])
            .filter((b) => b && b.w && b.fl && !/^(forest_|port_|pad_)/.test(b.id) && b.type !== 'launchpad')
            .map((b) => b.x + b.w * (0.3 + PL.hash(PL.seedOf(b.id), 5, 1) * 0.4));
        return this._doorList;
    },
    _nearestDoor(x, dir) {
        const doors = this._doors();
        let best = null;
        for (const d of doors) {
            const dd = (d - x) * dir;
            if (dd > 40 && dd < 900 && (!best || dd < (best - x) * dir)) best = d;
        }
        return best;
    },

    // ── Spawning ─────────────────────────────────────────────────────────────────────────────
    _spawnBot(v, edge) {
        const c = this._make('bot', G.charLayer);
        const span = v.right - v.left;
        c.wx = edge ? (Math.random() < 0.5 ? v.left - 200 : v.right + 200) : v.left + Math.random() * span;
        c.dir = Math.random() < 0.5 ? 1 : -1;
        if (edge) c.dir = c.wx < v.left ? 1 : -1;
        c.lane = Math.floor(Math.random() * 16);
        c.speed = 0.28 + Math.random() * 0.12;
        c.state = 'roll';
        c.wait = 0;
        c.target = this._nearestDoor(c.wx, c.dir) || c.wx + c.dir * 600;
        this.bots.push(c);
        return c;
    },
    _spawnDrone(v) {
        const c = this._make('drone', G.charLayer);
        c.zIndex = 4000;
        c.dir = Math.random() < 0.5 ? 1 : -1;
        c.wx = c.dir > 0 ? v.left - 150 : v.right + 150;
        c.cruise = G.groundY - 120 - Math.random() * 60;
        c.wy = c.cruise;
        c.state = 'fly';
        c.target = this._nearestDoor(c.wx + c.dir * (200 + Math.random() * 600), c.dir) || c.wx + c.dir * 700;
        c.t = Math.random() * 10;
        this.drones.push(c);
    },
    _spawnPigeons(v) {
        const doors = this._doors().filter((d) => d > v.left + 40 && d < v.right - 40);
        if (!doors.length) return;
        const cx = doors[Math.floor(Math.random() * doors.length)] + (Math.random() - 0.5) * 60;
        const n = 3 + Math.floor(Math.random() * 4);
        for (let i = 0; i < n; i++) {
            const p = PL.Fauna.sprite('pigeonWalk');
            p.eventMode = 'none';
            p.wx = cx + (Math.random() - 0.5) * 50;
            p.wy = G.groundY - 4 - Math.floor(Math.random() * 6);
            p.home = cx;
            p.state = 'peck';
            p.t = Math.random() * 5;
            p.dir = Math.random() < 0.5 ? 1 : -1;
            p.vx = 0;
            p.vy = 0;
            G.charLayer.addChild(p);
            this.pigeons.push(p);
        }
    },

    // ── Per-frame ────────────────────────────────────────────────────────────────────────────
    update() {
        if (!this.ready || !G.world || !G.world.visible || G.activeInterior) return;
        const v = this._view();
        const margin = 700;
        const h = this._hour();
        const night = this._night();
        const gy = G.groundY;
        const A = PL.ART;
        const tNow = performance.now() / 1000;
        const span = v.right - v.left;

        // How busy the pavement is: lunch and the evening are busiest, the small hours empty.
        const busy =
            h < 6 ? 0.15 : h < 8 ? 0.5 : h < 11 ? 0.8 : h < 14 ? 1 : h < 19 ? 0.85 : h < 23 ? 0.55 : 0.25;
        const wantBots = Math.round((span / 900) * 3 * busy);
        while (this.bots.length < wantBots) this._spawnBot(v, this.bots.length > 0);

        for (let i = this.bots.length - 1; i >= 0; i--) {
            const c = this.bots[i];
            const off = c.wx < v.left - margin || c.wx > v.right + margin;
            if (off || this.bots.length > wantBots + 2) {
                if (off || Math.random() < 0.002) {
                    c.destroy({ children: true });
                    this.bots.splice(i, 1);
                    continue;
                }
            }
            if (c.state === 'roll') {
                const dx = c.target - c.wx;
                if (Math.abs(dx) < 2) {
                    c.state = 'drop';
                    c.wait = 150 + Math.random() * 200;
                } else c.wx += Math.sign(dx) * c.speed;
                c.dir = Math.sign(dx) || c.dir;
                this._setArt(c, 'bot');
            } else {
                // At a door: lid open, parcel out.
                c.wait--;
                this._setArt(c, c.wait > 40 ? 'botOpen' : 'bot');
                if (c.wait <= 0) {
                    c.state = 'roll';
                    if (Math.random() < 0.3) c.dir = -c.dir;
                    c.target = this._nearestDoor(c.wx, c.dir) || c.wx + c.dir * (300 + Math.random() * 500);
                }
            }
            if (!this._street(c.wx)) c.target = c.wx - c.dir * 400;
            const bob = c.state === 'roll' && Math.sin(tNow * 18 + i) > 0.6 ? -A / 2 : 0;
            c.x = Math.round(c.wx / A) * A;
            c.y = gy - 20 + c.lane + bob;
            c.zIndex = Math.round(c.y);
            c.scale.x = c.dir;
            c.lit.alpha = 0.35 + night * 0.65;
            c.visible = c.wx > v.left - 60 && c.wx < v.right + 60;
        }

        // City bus along the far curb, stopping at the metro stations and big civic stops.
        const busOn = h >= 5 || h < 1;
        if (busOn && !this.bus) {
            const c = this._make('bus', G.carLayer);
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.wx = c.dir > 0 ? v.left - 500 : v.right + 500;
            c.state = 'drive';
            c.speed = 1.1;
            c.wait = 0;
            this.bus = c;
        }
        if (this.bus) {
            const c = this.bus;
            const stops = this._busStops();
            if (c.state === 'drive') {
                c.wx += c.dir * c.speed;
                // The next stop ahead within one step: pull in and open the doors.
                for (const s of stops) {
                    const d = (s - c.wx) * c.dir;
                    if (d >= 0 && d < c.speed && c.lastStop !== s && this._street(s)) {
                        c.state = 'stop';
                        c.wait = 240;
                        c.lastStop = s;
                        break;
                    }
                }
                this._setArt(c, 'bus');
            } else {
                c.wait--;
                this._setArt(c, c.wait > 40 && c.wait < 220 ? 'busOpen' : 'bus');
                if (c.wait <= 0) c.state = 'drive';
            }
            if (c.wx < v.left - 1200 || c.wx > v.right + 1200 || !busOn) {
                c.destroy({ children: true });
                this.bus = null;
            } else {
                c.x = Math.round(c.wx / A) * A;
                c.y = gy + 8;
                c.zIndex = Math.round(c.y);
                c.scale.x = c.dir;
                c.lit.alpha = Math.max(0.35, PL.clamp(night * 1.2, 0, 1));
                c.visible = this._street(c.wx);
            }
        }

        // Street sweeper in the small hours.
        const sweepOn = h >= 23 || h < 6;
        if (sweepOn && !this.sweeper) {
            const c = this._make('sweeper', G.carLayer);
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.wx = c.dir > 0 ? v.left - 300 : v.right + 300;
            this.sweeper = c;
        }
        if (this.sweeper) {
            const c = this.sweeper;
            c.wx += c.dir * 0.35;
            if (c.wx < v.left - 900 || c.wx > v.right + 900 || !sweepOn) {
                c.destroy({ children: true });
                this.sweeper = null;
            } else {
                c.x = Math.round(c.wx / A) * A;
                c.y = gy + 7;
                c.zIndex = Math.round(c.y);
                c.scale.x = c.dir;
                // Rotating beacon.
                c.lit.alpha = PL.frac(tNow * 1.4) < 0.5 ? 0.9 : 0.25;
                c.visible = this._street(c.wx);
            }
        }

        // Parcel drones by day: cruise in, drop to a door, leave the parcel, climb out.
        const droneOn = h >= 8 && h < 21;
        const wantDrones = droneOn ? Math.max(1, Math.round(span / 1400)) : 0;
        if (this.drones.length < wantDrones && Math.random() < 0.01) this._spawnDrone(v);
        for (let i = this.drones.length - 1; i >= 0; i--) {
            const c = this.drones[i];
            c.t += 0.016;
            if (c.state === 'fly') {
                c.wx += c.dir * 1.3;
                c.wy += (c.cruise - c.wy) * 0.05;
                if ((c.target - c.wx) * c.dir <= 0) c.state = 'down';
            } else if (c.state === 'down') {
                c.wy += 0.6;
                if (c.wy >= gy - 30) {
                    c.state = 'drop';
                    c.wait = 80;
                }
            } else if (c.state === 'drop') {
                c.wait--;
                if (c.wait === 40) {
                    this._setArt(c, 'droneEmpty');
                    const p = this._make('parcel', G.charLayer);
                    p.x = Math.round(c.wx / A) * A;
                    p.y = gy - 8;
                    p.zIndex = Math.round(p.y);
                    p.life = 900;
                    (this._parcels = this._parcels || []).push(p);
                }
                if (c.wait <= 0) c.state = 'up';
            } else {
                c.wy -= 0.8;
                c.wx += c.dir * 0.6;
                if (c.wy < c.cruise - 80) c.state = 'gone';
            }
            if (c.state === 'gone' || c.wx < v.left - 900 || c.wx > v.right + 900) {
                c.destroy({ children: true });
                this.drones.splice(i, 1);
                continue;
            }
            c.x = Math.round(c.wx / A) * A;
            c.y = Math.round((c.wy + Math.sin(c.t * 3) * 1.5) / A) * A;
            c.scale.x = c.dir;
            c.lit.alpha = PL.frac(c.t * 0.8) < 0.5 ? 0.9 : 0.2;
        }
        if (this._parcels)
            for (let i = this._parcels.length - 1; i >= 0; i--) {
                const p = this._parcels[i];
                p.life--;
                p.alpha = Math.min(1, p.life / 60);
                if (p.life <= 0) {
                    p.destroy({ children: true });
                    this._parcels.splice(i, 1);
                }
            }

        // Patrol drone after dark, searchlight sweeping the pavement.
        const patrolOn = h >= 20 || h < 6;
        if (patrolOn && !this.patrol) {
            const c = this._make('patrol', G.charLayer);
            c.zIndex = 4100;
            c.dir = Math.random() < 0.5 ? 1 : -1;
            c.wx = c.dir > 0 ? v.left - 200 : v.right + 200;
            c.beam = new PIXI.Sprite(PL.tex(PL.cone(19, 34, 0xd8ecff, 0.4)));
            c.beam.anchor.set(0.5, 0);
            c.beam.scale.set(A);
            c.beam.blendMode = PIXI.BLEND_MODES.ADD;
            c.beam.eventMode = 'none';
            G.charLayer.addChild(c.beam);
            c.t = 0;
            this.patrol = c;
        }
        if (this.patrol) {
            const c = this.patrol;
            c.t += 0.016;
            c.wx += c.dir * 0.9;
            if (c.wx < v.left - 900 || c.wx > v.right + 900 || !patrolOn) {
                c.beam.destroy();
                c.destroy({ children: true });
                this.patrol = null;
            } else {
                c.x = Math.round(c.wx / A) * A;
                c.y = Math.round((gy - 92 + Math.sin(c.t * 1.3) * 4) / A) * A;
                c.scale.x = c.dir;
                c.lit.alpha = 1;
                c.lit.tint = PL.frac(c.t * 2) < 0.5 ? 0xffffff : 0x8888ff;
                c.beam.x = c.x;
                c.beam.y = c.y - 2;
                c.beam.rotation = Math.sin(c.t * 0.9) * 0.35;
                c.beam.alpha = 0.55 * night;
                c.beam.zIndex = 4090;
            }
        }

        // Pigeons by day around doorways; they burst up when a bot rolls through.
        const pigeonOn = h >= 6.5 && h < 19.5;
        if (pigeonOn && this.pigeons.length < Math.round(span / 500) && Math.random() < 0.004)
            this._spawnPigeons(v);
        for (let i = this.pigeons.length - 1; i >= 0; i--) {
            const p = this.pigeons[i];
            p.t += 0.016;
            if (!pigeonOn && p.state !== 'fly') p.state = 'fly';
            if (p.state === 'peck' || p.state === 'walk') {
                const scare = this.bots.some((b) => Math.abs(b.wx - p.wx) < 26 && b.state === 'roll');
                if (scare) {
                    p.state = 'fly';
                    p.vx = (p.wx > p.home ? 1 : -1) * (1 + Math.random());
                    p.vy = -1.4 - Math.random();
                } else if (Math.floor(p.t * 2) % 7 === 0 && Math.random() < 0.02) {
                    p.state = p.state === 'peck' ? 'walk' : 'peck';
                    p.dir = Math.random() < 0.5 ? 1 : -1;
                }
                if (p.state === 'walk') {
                    p.wx += p.dir * 0.12;
                    if (Math.abs(p.wx - p.home) > 40) p.dir = Math.sign(p.home - p.wx);
                    p._px.texture = PL.Fauna.tex(PL.frac(p.t * 3) < 0.5 ? 'pigeonWalk' : 'pigeonStep');
                } else
                    p._px.texture = PL.Fauna.tex(
                        PL.frac(p.t * 1.7 + i * 0.3) < 0.3 ? 'pigeonPeck' : 'pigeonWalk'
                    );
            } else {
                // Flap up and away; land again a little further on if it is still daytime.
                p.wx += p.vx;
                p.wy += p.vy;
                p.vy += 0.03;
                p.dir = Math.sign(p.vx) || p.dir;
                p._px.texture = PL.Fauna.wing('pigeon', p.t * 22);
                if (p.vy > 0 && p.wy >= gy - 6 && pigeonOn) {
                    p.wy = gy - 4 - Math.floor(Math.random() * 6);
                    p.state = 'peck';
                    p.home = p.wx;
                }
            }
            if (p.wy < gy - 400 || p.wx < v.left - margin || p.wx > v.right + margin) {
                p.destroy({ children: true });
                this.pigeons.splice(i, 1);
                continue;
            }
            p.x = Math.round(p.wx / A) * A;
            p.y = Math.round(p.wy / A) * A;
            p.zIndex = Math.round(p.y);
            p.scale.x = p.dir;
        }
    },
};
