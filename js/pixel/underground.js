/* Pixel art — the underground: the metro tunnel, the trains, and data pulses along the
   fibre trunk. The classic tunnel is one huge Graphics in the underground layer (a black
   box with pillars and two rails); with the skin on it is hidden and a hand-painted tile
   strip runs in its place: tiled walls lit by caged lamps, cable trays, posters and tags,
   hazard-striped pillars with their red lamps where the classic had them, sleepers and rails.
   Trains get a pixel shell (EntitiesGfx.buildTrainSprite asks PL.Under.train): a lit cabin
   behind the riders and a body with window cut-outs in front of them, so riders still show
   through the windows. Nothing here changes timing, positions or clicks. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, hash, bayer, mix, dark, light, shade } = PL;

    const TILE = 1200; // art px: sixteen 150-world-px pillar bays
    const TH = 50; // tunnel height in art px (100 world px)
    const NEON = [0xff4fd8, 0x4ff0ff, 0xffb84a, 0x7aff8a, 0xb07aff];

    // ── Tunnel tile ─────────────────────────────────────────────────────────
    function tunnelTile() {
        const img = new Img(TILE, TH);
        const R = PL.rng(4242);
        const tileCol = 0x2c3540;
        const grout = 0x1c2229;
        // Pillar x positions inside the tile (classic pillars every 150 world px from x -1000;
        // the strip starts at world x -2000).
        const pillars = [];
        for (let x = 50; x < TILE; x += 75) pillars.push(x);
        // A few lamps are dead.
        const lamps = pillars.map((p) => (p + 37) % TILE).filter((lx, i) => hash(9, i, 1) > 0.15);
        // Back wall: subway tiles, darker toward the floor, lit around each lamp.
        for (let y = 0; y < TH; y++)
            for (let x = 0; x < TILE; x++) {
                let c;
                if (y < 3) c = y === 2 ? 0x3a424c : 0x161a20; // ceiling slab
                else if (y < 8) c = 0x101318; // cable-tray recess
                else if (y < 34) {
                    const row = y - 8;
                    const course = Math.floor(row / 3);
                    const off = (course & 1) * 3;
                    const isGrout = row % 3 === 2 || (x + off) % 6 === 0;
                    c = isGrout ? grout : shade(tileCol, 0.92 + hash(7, (x + off) / 6 | 0, course) * 0.16);
                    // Grime toward the floor.
                    if (y > 26 && bayer(x, y) < (y - 26) / 10) c = shade(c, 0.78);
                } else if (y < 40) {
                    c = y === 34 ? 0x4a525c : y === 35 ? 0x3a4048 : 0x1e2228; // ledge + walkway edge
                } else c = 0x14161a; // track bed
                // Lamp light pools on the wall.
                let lit = 0;
                for (const lx of lamps) {
                    const dx = Math.min(Math.abs(x - lx), TILE - Math.abs(x - lx));
                    const d = Math.hypot(dx / 1.4, y - 10) / 22;
                    if (d < 1) lit = Math.max(lit, 1 - d);
                }
                if (lit > 0 && y >= 3 && y < 40) {
                    const q = Math.floor(lit * 3 + bayer(x, y) * 0.9) / 3;
                    if (q > 0) c = mix(c, 0xffd9a0, q * 0.32);
                }
                img.set(x, y, c);
            }
        // Cable tray: brackets every 25 px with three sagging bundles.
        for (let x = 0; x < TILE; x += 25) img.rect(x, 3, 1, 5, 0x3a3e46);
        [
            [4, 0x5a1e24],
            [5, 0x1e2e5a],
            [6, 0x202024],
        ].forEach(([y0, col]) => {
            for (let x = 0; x < TILE; x++) {
                const t = (x % 25) / 25;
                const y = y0 + Math.round(Math.sin(t * Math.PI) * 1.2);
                img.set(x, y, col);
                if (bayer(x, y) > 0.8) img.set(x, y, light(col, 0.2));
            }
        });
        // A conduit pipe along the wall.
        for (let x = 0; x < TILE; x++) {
            img.set(x, 30, 0x5a606a);
            img.set(x, 31, 0x3a3e46);
            if (x % 30 === 0) img.rect(x, 29, 2, 4, 0x6a707a);
        }
        // Something different in every bay: ad panels, tags, vents, route maps, exit signs.
        pillars.forEach((p, i) => {
            const bx = (p + 14 + Math.floor(R() * 10)) % TILE;
            const kind = Math.floor(hash(17, i, 3) * 6);
            if (kind === 0 || kind === 4) {
                // Lit ad panel.
                const c1 = NEON[Math.floor(R() * NEON.length)];
                const c2 = NEON[Math.floor(R() * NEON.length)];
                const w = 14 + Math.floor(R() * 8);
                img.rect(bx - 1, 13, w + 2, 13, 0x0c0e12);
                for (let y = 0; y < 11; y++)
                    for (let x = 0; x < w; x++) {
                        let c = mix(c1, c2, y / 10);
                        if ((x + y * 3) % 7 === 0) c = light(c, 0.3);
                        if (y > 7 && x > 2 && x < w - 3) c = 0xf4f4f8;
                        img.set(bx + x, 14 + y, shade(c, 0.8));
                    }
            } else if (kind === 1) {
                // Spray tag.
                const col = NEON[Math.floor(R() * NEON.length)];
                let x = bx;
                let y = 20 + Math.floor(R() * 4);
                const n = 14 + Math.floor(R() * 14);
                for (let k = 0; k < n; k++) {
                    img.set(x, y, col);
                    if (k % 3 === 0) img.set(x, y + 1, dark(col, 0.3));
                    x += 1;
                    y += R() > 0.5 ? (y < 25 ? 1 : -1) : y > 18 ? -1 : 1;
                }
            } else if (kind === 2) {
                // Vent grille.
                img.rect(bx, 15, 12, 9, 0x1a1e24);
                for (let y = 16; y < 23; y += 2) img.rect(bx + 1, y, 10, 1, 0x3a424c);
            } else if (kind === 3) {
                // Route map: a line with station dots.
                img.rect(bx, 14, 24, 9, 0xe8e8ee);
                const lc = NEON[i % NEON.length];
                img.rect(bx + 2, 18, 20, 1, lc);
                for (let k = 0; k < 5; k++) img.rect(bx + 3 + k * 4, 17, 2, 3, 0x2a2e36);
            } else {
                // Green exit sign.
                img.rect(bx, 12, 10, 5, 0x0e3a1e);
                img.rect(bx + 1, 13, 8, 3, 0x3aff8a);
                img.rect(bx + 2, 14, 1, 1, 0x0e3a1e);
                img.rect(bx + 4, 14, 3, 1, 0x0e3a1e);
            }
        });
        // Pillars: concrete with rim light, hazard band, red lamp (classic: tunnelY - 30).
        pillars.forEach((p) => {
            for (let y = 0; y < 41; y++)
                for (let i = 0; i < 10; i++) {
                    let c = i === 0 ? 0x5a6068 : i >= 8 ? 0x1e2228 : 0x3a4048;
                    if (y >= 30 && y < 38) c = ((i + y) >> 1) % 2 === 0 ? 0xe8b830 : 0x1a1a1e;
                    if (y === 0) c = 0x2a2e34;
                    img.set(p + i, y, c);
                }
            img.rect(p + 4, 9, 2, 2, 0xff4050);
            img.set(p + 4, 9, 0xff9aa0);
        });
        // Lamps: caged bulbs.
        lamps.forEach((lx) => {
            img.rect(lx - 2, 8, 5, 1, 0x2a2e34);
            img.rect(lx - 1, 9, 3, 2, 0xfff0c8);
            img.set(lx - 2, 10, 0x2a2e34);
            img.set(lx + 2, 10, 0x2a2e34);
        });
        // Track: sleepers, ballast, two rails (classic rails at tunnelY + 35 and + 42).
        for (let x = 0; x < TILE; x++) {
            for (let y = 40; y < TH; y++)
                if (hash(31, x, y) > 0.6) img.set(x, y, hash(33, x, y) > 0.5 ? 0x22252a : 0x1a1c20);
            if (x % 5 < 2) img.rect(x, 43, 1, 4, 0x2e241c);
            img.set(x, 42, 0x8a929e);
            img.set(x, 43, 0x4a4e58);
            img.set(x, 46, 0x9aa2ae);
            img.set(x, 47, 0x4a4e58);
            if (bayer(x, 42) > 0.85) img.set(x, 42, 0xc8d0dc);
        }
        return img;
    }

    // ── Trains ──────────────────────────────────────────────────────────────
    // Texture frame: world x -184..184, y -44..40 (art 184 × 42, origin at 92, 22).
    const TW = 184;
    const THT = 42;
    const OX = 92;
    const OY = 22;
    const P = (x, y) => [x + OX, y + OY];
    // The classic shape in art px: x -90..90, y -17..15 (rounded 4 px corners).
    function inShell(x, y) {
        if (x < -90 || x >= 90 || y < -17 || y > 15) return false;
        const cx = x < -86 ? -86 - x : x > 85 ? x - 85 : 0;
        const cy = y < -13 ? -13 - y : 0;
        return cx * cx + cy * cy <= 16;
    }
    const DOORS = [-50, 0, 50];
    const isWindow = (x, y) =>
        y >= -10 && y < -2 && x > -86 && x < 85 && (x + 90) % 22 > 2 && !DOORS.some((d) => x >= d - 1 && x < d + 11);

    function trainBody() {
        const img = new Img(TW, THT);
        for (let y = -17; y <= 15; y++)
            for (let x = -90; x < 90; x++) {
                if (!inShell(x, y)) continue;
                // Lit cabin: warm ceiling light falling off downward, seat backs, handrails.
                let c = y < -10 ? 0xf8e8c8 : y < -6 ? 0xe8d0a0 : 0xc8a878;
                if (y === -13) c = 0xfff8e8;
                if (y === -12 && x % 6 === 0) c = 0x8a8478;
                if (y >= -6 && y < -3 && (x + 90) % 22 > 3 && (x + 90) % 22 < 19) c = 0x3a6ac0; // seat backs
                if (y < -13) c = 0x2a2e38;
                img.set(...P(x, y), c);
            }
        return img;
    }

    function trainFront(col) {
        const img = new Img(TW, THT);
        const shell = 0xa8b2c2;
        for (let y = -17; y <= 15; y++)
            for (let x = -90; x < 90; x++) {
                if (!inShell(x, y)) continue;
                if (isWindow(x, y)) {
                    // Glass: mostly clear, a dithered reflection streak.
                    if ((x * 1.0 + y * 0.8) % 37 < 3 && bayer(x, y) > 0.4) img.set(...P(x, y), 0xe8f6ff, 90);
                    continue;
                }
                let c = shell;
                if (y <= -15) c = 0xd4dae4; // roof highlight
                else if (y === -14) c = 0xbcc4d0;
                if (y === -11 || y === -2) c = 0x7a828e; // window frame lines
                if (y >= -1 && y <= 1) c = y === 0 ? col : light(col, 0.25); // livery
                if (y === 2) c = 0xff4fd8; // pinstripe
                if (y > 2) c = y < 7 ? 0x8a94a4 : y < 11 ? 0x748090 : 0x5e6878;
                if (x === -90 || x === 89) c = dark(c, 0.3);
                if (x === -89) c = light(c, 0.2);
                if (y > 2 && x % 30 === 0) c = dark(c, 0.15); // panel seams
                img.set(...P(x, y), c);
            }
        // Doors: frame, two leaves, small windows (the riders show through those too).
        DOORS.forEach((d) => {
            for (let y = -14; y <= 12; y++) {
                img.set(...P(d - 1, y), 0x4a525e);
                img.set(...P(d + 10, y), 0x4a525e);
                img.set(...P(d + 4, y), 0x6a727e);
            }
            for (let y = -10; y < -2; y++)
                for (let x = d + 1; x < d + 10; x++) {
                    if (x === d + 4) continue;
                    const [px, py] = P(x, y);
                    img.u[py * TW + px] = 0;
                }
            img.rect(...P(d, 13), 10, 1, 0x3a404a);
            img.set(...P(d + 2, 5), 0x2a2e36);
            img.set(...P(d + 7, 5), 0x2a2e36);
        });
        // Roof: AC pods and a pantograph.
        [-60, 20].forEach((x) => {
            img.rect(...P(x, -20), 22, 3, 0x9aa2ae);
            img.rect(...P(x, -20), 22, 1, 0xc8d0dc);
            for (let i = 2; i < 20; i += 3) img.set(...P(x + i, -19), 0x5a626e);
        });
        for (let i = 0; i < 6; i++) {
            img.set(...P(-10 + i, -18 - i), 0x3a3e46);
            img.set(...P(4 - i, -18 - i), 0x3a3e46);
        }
        img.rect(...P(-12, -22), 18, 1, 0x5a5e68);
        // Undercarriage: skirts and bogies with wheels.
        img.rect(...P(-86, 16), 172, 1, 0x1a1c22);
        [-66, 54].forEach((bx) => {
            img.rect(...P(bx, 16), 14, 2, 0x22252c);
            [bx + 2, bx + 9].forEach((wx) => {
                img.rect(...P(wx, 17), 3, 3, 0x30343c);
                img.set(...P(wx + 1, 18), 0x8a929e);
            });
        });
        return img;
    }

    const U = (PL.Under = {
        _tex: {},
        trainParts(lineCol) {
            const key = 'train' + (lineCol || 0);
            if (!this._tex[key])
                this._tex[key] = { body: PL.tex(trainBody()), front: PL.tex(trainFront(lineCol || 0x22d3ee)) };
            return this._tex[key];
        },
        // Same shape as EntitiesGfx.buildTrainSprite's result: { tBg, fGfx, lightL, lightR }.
        train(lineCol) {
            const A = PL.ART;
            const T = this.trainParts(lineCol);
            const mk = (tex) => {
                const s = new PIXI.Sprite(tex);
                s.scale.set(A);
                s.x = -OX * A;
                s.y = -OY * A;
                return s;
            };
            const lamp = (col, x) => {
                const g = new PIXI.Graphics();
                g.beginFill(col);
                g.drawRect(x - A, -A, A * 2, A * 2);
                g.endFill();
                return g;
            };
            return { tBg: mk(T.body), fGfx: mk(T.front), lightL: lamp(0xff4050, -178), lightR: lamp(0xfff4d8, 176) };
        },

        _tunnel: null,
        // Replace the classic tunnel Graphics (the widest child of the underground layer).
        adopt() {
            const L = G.undergroundLayer;
            if (!L || (this._tunnel && !this._tunnel.destroyed && this._tunnel.parent === L)) return;
            const g = L.children.find(
                (c) => c instanceof PIXI.Graphics && c.geometry && c.geometry.graphicsData.length > 100 && c.getLocalBounds().width > 30000
            );
            if (!g) return;
            const A = PL.ART;
            const b = g.getLocalBounds();
            const tex = PL.tex(tunnelTile());
            const ts = new PIXI.TilingSprite(tex, Math.ceil(b.width / A), TH);
            ts.scale.set(A);
            ts.x = b.x;
            ts.y = b.y;
            ts._pxNoSkin = true;
            g.visible = false;
            L.addChildAt(ts, L.getChildIndex(g) + 1);
            this._tunnel = ts;
        },

        // Data packets running along the fibre trunk (gy + 35 … + 62).
        _pulses: null,
        pulses(t) {
            const W = G.world;
            if (!W || !G.groundY) return;
            const A = PL.ART;
            if (!this._pulses || this._pulses.destroyed) {
                const img = new Img(240, 15);
                const cols = [0x4ff0ff, 0xff4fd8, 0x7aff8a, 0xffb84a];
                for (let r = 0; r < 10; r++) {
                    const y = Math.round((35 + r * 3 - 34) / A);
                    for (let k = 0; k < 3; k++) {
                        const x = Math.floor(hash(r, k, 5) * 230);
                        const c = cols[(r + k) % 4];
                        img.set(x, y, c);
                        img.set(x + 1, y, mix(c, 0x000000, 0.4), 160);
                    }
                }
                const s = new PIXI.TilingSprite(PL.tex(img), 8, 15);
                s.scale.set(A);
                s.blendMode = PIXI.BLEND_MODES.ADD;
                s._pxNoSkin = true;
                s.eventMode = 'none';
                const first = (id) => (G.bldById && G.bldById[id] ? G.bldById[id].x : null);
                const x0 = first('metro_dc') || first('metro_res') || 4000;
                const x1 = first('metro_longevity') || first('metro_east') || G.cityW;
                s.x = x0 - 300;
                s.width = Math.max(10, (x1 + 300 - s.x) / A);
                s.y = G.groundY + 34;
                // Above the ground Graphics (which paints the conduit band).
                const par = PixelArt._reflLayer && PixelArt._reflLayer();
                if (!par) return;
                par.addChild(s);
                this._pulses = s;
            }
            this._pulses.tilePosition.x = t * 22;
        },
    });
    void U;
})();
