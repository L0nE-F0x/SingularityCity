/* Pixel lab v2 — district painters, part 3: backbone, robotics, longevity, agents,
   alignment, suburbs, founders' estates, power. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const LOBBY = 8;
    const FL = 6;

    // A tidy modern block used by the tech districts; o.acc tints trims and signage.
    function techBlock(B, b, w, h, o) {
        const up = h - LOBBY;
        const wall = o.wall === undefined ? 0xc8ccd2 : o.wall;
        K.wall(B, 0, 0, w, up, wall, o.kind || 'panel', { pitch: 5, seamY: FL * 2 });
        if (o.curtain)
            K.curtain(B, 3, 3, w - 6, up - 3, {
                pitch: 4,
                mullion: dark(wall, 0.5),
                lit: 0.6,
                tone: 'office',
                glassTop: mix(0x9ab8d0, o.acc, 0.12),
                glassBot: mix(0x3a5270, o.acc, 0.1),
            });
        else
            K.windows(B, 0, 3, w, up - 3, {
                floorH: FL,
                winW: 4,
                winH: 3,
                pitch: 6,
                top: 2,
                tone: 'office',
                lit: 0.6,
                frame: dark(wall, 0.35),
            });
        B.rect(0, 0, w, 2, o.acc);
        B.rect(0, 0, w, 1, light(o.acc, 0.3));
        for (let i = 0; i < w; i++) B.epx(i, 1, o.acc, 150);
        K.lobby(B, 0, up, w, LOBBY, {
            accent: o.acc,
            interior: o.interior === undefined ? 0xe8f0ff : o.interior,
        });
        if (o.sign) PL.roofSign(B, o.sign, 0, w, 0, o.acc, { small: true, bg: 0x0e1016 });
        return up;
    }

    // ── Robotics ────────────────────────────────────────────────────────────
    D.robotics_assembly = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 6, w, h - 6, 0xd8a040, 'corrugated');
        for (let x = 0; x < w; x++) {
            const t = x % 10;
            const hh = Math.round(t * 0.6);
            for (let j = 0; j < hh; j++) B.px(x, 6 - j, j === hh - 1 ? 0xe8e8ee : 0xa8acb4);
            if (t === 9) for (let j = 0; j < 6; j++) B.epx(x, 6 - j, 0xfff0c0, 150);
        }
        B.rect(2, 12, w - 4, 8, 0x2a2e36);
        for (let x = 4; x < w - 6; x += 12) {
            // Robot arms at work behind the glass.
            (B.epx(x, 18, 0xffb84a),
                B.epx(x + 1, 17, 0xffb84a),
                B.epx(x + 2, 16, 0xffb84a),
                B.epx(x + 3, 16, 0xffe0a0),
                B.epx(x + 4, 17, 0xff5a3a));
        }
        for (let x = 2; x < w - 2; x++) B.epx(x, 13, 0xfff0c8, 170);
        K.lobby(B, 0, up, Math.round(w * 0.35), LOBBY, { accent: 0xe8a030 });
        for (let x = Math.round(w * 0.4); x < w - 12; x += 14)
            (B.rect(x, up + 1, 11, LOBBY - 1, 0x3a3e48), B.rect(x, up + 1, 11, 1, 0xe8b830));
        PL.roofSign(B, 'ASSEMBLY LINE', 0, w, -2, 0xffb84a, { small: true });
        K.stack(B, w - 6, 3, 10, 0xb8b4ac, 0xd8402a, 0.5);
    };
    D.robotics_testing = function (B, b, w, h) {
        // Fenced test yard with a robot, cones and a gantry.
        K.fence(B, 0, h, w, 0x5a6068);
        B.rect(0, h - 1, w, 1, 0x5a5e58);
        for (let x = 8; x < w - 8; x += 10) (B.rect(x, h - 3, 2, 3, 0xff7a2a), B.px(x, h - 2, 0xe8e8ee));
        const rx = Math.round(w * 0.45);
        B.rect(rx, h - 10, 5, 6, 0xd8dce2);
        B.rect(rx + 1, h - 13, 3, 3, 0xd8dce2);
        B.epx(rx + 2, h - 12, 0x3ad8ff);
        (B.rect(rx, h - 4, 2, 4, 0x5a5e68), B.rect(rx + 3, h - 4, 2, 4, 0x5a5e68));
        (B.rect(2, h - 22, 1, 22, 0xe8b830),
            B.rect(w - 3, h - 22, 1, 22, 0xe8b830),
            B.rect(2, h - 23, w - 4, 2, 0xe8b830));
        B.light(rx + 2, h - 8, 0xfff0d0, 14, 'wash');
        K.plaqueC(B, w / 2, h - 32, 'TESTING GROUND', 0xffb84a, 0x14161c, true, w);
    };
    D.robotics_deploy = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, {
            acc: 0xe8b830,
            sign: 'DEPLOYMENT DOCK',
            wall: 0x8a929c,
            kind: 'corrugated',
        });
        for (let x = 4; x < w - 10; x += 13)
            (B.rect(x, up - 6, 10, 14, 0x3a3e48),
                B.rect(x, up - 7, 10, 1, 0xe8b830),
                B.erect(x + 1, up + 6, 8, 2, 0xffd88a));
    };
    D.robotics_rd = (B, b, w, h) =>
        techBlock(B, b, w, h, { acc: 0x3ad8ff, sign: b.name, wall: 0xe0e2e6, curtain: true });

    // ── Suburbs ─────────────────────────────────────────────────────────────
    const HOUSE = [0xe8d8b8, 0xb8d0d8, 0xd8b8a8, 0xc8d8b0, 0xf0e8d8, 0xd0c0e0];
    const ROOF = [0x5a3a34, 0x3a4a5a, 0x4a3a3a, 0x3a3a44, 0x6a4a3a];
    D['pre:suburb'] = function (B, b, w, h) {
        const s = PL.seedOf(b.id);
        const col = HOUSE[s % HOUSE.length];
        const roof = ROOF[s % ROOF.length];
        const hw = Math.round(w * 0.62);
        const hx = 4;
        const top = h - 16;
        K.wall(B, hx, top, hw, 16, col, 'wood');
        K.pitched(B, hx, top, hw, roof, { h: 9, over: 2 });
        K.windows(B, hx, top + 1, hw, 14, {
            floorH: 7,
            winW: 3,
            winH: 3,
            pitch: 6,
            top: 2,
            inset: 3,
            shutters: dark(roof, 0.1),
            tone: 'home',
            lit: 0.75,
        });
        K.door(B, hx + Math.round(hw / 2) - 1, h - 6, 3, 6, [0xc0392b, 0x2a5aa0, 0x2a7a4a][s % 3]);
        // Porch light, garage, chimney, tree, mailbox, fence.
        B.light(hx + Math.round(hw / 2), h - 7, 0xffd08a, 8, 'lantern');
        const gx = hx + hw + 1;
        K.wall(B, gx, h - 9, w - gx - 2, 9, dark(col, 0.08), 'wood');
        B.rect(gx + 1, h - 7, w - gx - 4, 7, 0xd8d8d4);
        for (let j = 0; j < 7; j += 2) B.rect(gx + 1, h - 7 + j, w - gx - 4, 1, 0xb8b8b4);
        B.rect(gx - 1, h - 10, w - gx, 1, roof);
        K.chimney(B, hx + hw - 6, top - 5, 4, 0x8a5a44);
        K.tree(B, 1, h, 4, s % 2 ? PL.S.LEAF.green : PL.S.LEAF.autumn);
        K.fence(B, 0, h, w, 0xf0f0ec, 'picket');
        (B.rect(w - 3, h - 5, 2, 2, 0x3a5a8a), B.rect(w - 2, h - 3, 1, 3, 0x5a4a3a));
    };

    // ── Founders' estates (styles as Environment picks them) ────────────────
    function estateStyle(b) {
        const lab = PL.LABS[b.lab] || {};
        if (b.lab === 'xai') return 'brutalist';
        if (b.lab === 'openai' || b.lab === 'anthropic') return 'penthouse';
        if (b.lab === 'google' || b.lab === 'meta') return 'villa';
        if (['microsoft', 'amazon', 'apple', 'nvidia', 'ibm'].includes(b.lab)) return 'colonial';
        if ((lab.region || 'eu') === 'eu') return 'chateau';
        if (lab.region === 'cn') return 'pagoda';
        return 'modern';
    }
    D['pre:house'] = function (B, b, w, h) {
        const st = estateStyle(b);
        const lc = hex((PL.LABS[b.lab] || {}).color || '#64748b');
        const acc = PL.lum(lc) < 0.1 ? 0xe8e8ee : lc;
        const bw = Math.round(w * 0.7);
        const bx = Math.round((w - bw) / 2);
        // Lawn, hedge, gate.
        for (let x = 0; x < w; x += 5) PL.S.bush(B.base, B.X(x), B.Y(h - 1), 4, B.seed + x, PL.S.LEAF.deep);
        if (st === 'penthouse' || st === 'modern') {
            K.wall(B, bx, h - 18, bw, 10, 0xe8e8e4, 'stucco');
            K.curtain(B, bx + 4, h - 17, bw - 14, 8, {
                floorH: 9,
                pitch: 5,
                mullion: 0x2a2a30,
                glassTop: 0x9ab8d0,
                glassBot: 0x4a6a8a,
                lit: 0.9,
                tone: 'home',
            });
            K.wall(B, bx - 4, h - 8, bw + 8, 8, 0xd8d8d4, 'stucco');
            K.curtain(B, bx, h - 7, bw, 7, {
                floorH: 8,
                pitch: 6,
                mullion: 0x2a2a30,
                lit: 0.9,
                tone: 'home',
            });
            B.rect(bx - 6, h - 19, bw + 12, 1, 0xf2f2f2);
            B.rect(bx - 6, h - 9, bw + 12, 1, 0xf2f2f2);
            // Pool glow.
            B.rect(bx + bw + 1, h - 2, 10, 2, 0x3a9ad8);
            B.erect(bx + bw + 1, h - 2, 10, 1, 0x7ae0ff);
            B.light(bx + bw + 6, h - 2, 0x5ad0ff, 10, 'wash');
        } else if (st === 'brutalist') {
            K.wall(B, bx + 8, h - 26, bw - 16, 26, 0x6a6c72, 'concrete');
            K.wall(B, bx, h - 18, 16, 18, 0x5a5c62, 'concrete');
            B.rect(bx - 2, h - 19, bw + 4, 2, 0x7a7c82);
            for (let y = h - 22; y < h - 2; y += 5)
                (B.rect(bx + 12, y, bw - 24, 1, 0x1a1a20), B.erect(bx + 12, y, bw - 24, 1, 0xff4a3a, 200));
            K.dish(B, bx + bw - 10, h - 26, 4);
        } else if (st === 'villa') {
            K.wall(B, bx, h - 16, bw, 16, 0xf0dcc0, 'stucco');
            K.windows(B, bx, h - 16, bw, 16, {
                floorH: 8,
                winW: 3,
                winH: 5,
                pitch: 7,
                top: 2,
                inset: 3,
                shutters: 0x3a6a4a,
                tone: 'home',
                lit: 0.8,
            });
            for (let i = -2; i < bw + 2; i++)
                (B.px(bx + i, h - 17, 0xc8643a), B.px(bx + i, h - 18 + (i % 3 === 0 ? 0 : 1), 0xd8744a));
            K.pitched(B, bx, h - 17, bw, 0xc8643a, { h: 5, over: 2 });
            PL.S.palm(B.base, B.X(bx - 3), B.Y(h), 20, B.seed);
            PL.S.palm(B.base, B.X(bx + bw + 3), B.Y(h), 16, B.seed + 1);
        } else if (st === 'colonial') {
            K.wall(B, bx, h - 18, bw, 18, 0xf2f0e8, 'wood');
            K.windows(B, bx, h - 18, bw, 18, {
                floorH: 9,
                winW: 3,
                winH: 5,
                pitch: 7,
                top: 2,
                inset: 3,
                shutters: 0x2a2a34,
                tone: 'home',
                lit: 0.8,
            });
            K.columns(B, bx + Math.round(bw / 2) - 8, h - 16, 17, 16, 0xf8f8f4, 5);
            K.pediment(B, bx + Math.round(bw / 2) - 10, h - 17, 21, 0xf2f0e8);
            K.pitched(B, bx, h - 18, bw, 0x3a3a44, { h: 6, over: 1 });
            K.chimney(B, bx + 3, h - 22, 5, 0x8a4a3a);
            K.chimney(B, bx + bw - 6, h - 22, 5, 0x8a4a3a);
        } else if (st === 'chateau') {
            K.wall(B, bx, h - 18, bw, 18, 0xe0d4bc, 'stone');
            K.windows(B, bx, h - 18, bw, 18, {
                floorH: 9,
                winW: 3,
                winH: 6,
                pitch: 7,
                top: 2,
                inset: 3,
                tone: 'home',
                lit: 0.8,
            });
            for (let y = 0; y < 8; y++)
                for (let x = Math.round(y / 2); x < bw - Math.round(y / 2); x++)
                    B.px(bx + x, h - 19 - (7 - y), y === 7 ? 0x6a7a90 : 0x4a5870);
            [bx - 2, bx + bw - 3].forEach((tx) => {
                K.wall(B, tx, h - 24, 5, 24, 0xe0d4bc, 'stone');
                for (let j = 0; j < 7; j++)
                    B.rect(tx + Math.round(j / 3), h - 25 - j, 5 - Math.round(j / 3) * 2, 1, 0x4a5870);
            });
        } else {
            // Pagoda estate.
            K.wall(B, bx + 4, h - 16, bw - 8, 16, 0xe8dcc4, 'stucco');
            for (let t = 0; t < 2; t++) {
                const y = h - 8 - t * 9;
                for (let i = -3 + t * 4; i < bw + 3 - t * 4; i++) {
                    const lift = i < t * 4 ? 1 : i > bw - 1 - t * 4 ? 1 : 0;
                    (B.px(bx + i, y - lift, 0x2e3a4a), B.px(bx + i, y - 1 - lift, 0x3e4a5a));
                }
            }
            K.windows(B, bx + 4, h - 16, bw - 8, 16, {
                floorH: 9,
                winW: 3,
                winH: 4,
                pitch: 6,
                top: 2,
                inset: 2,
                frame: 0xa8342a,
                tone: 'home',
                lit: 0.8,
            });
            [bx + 2, bx + bw - 3].forEach(
                (lx) => (
                    B.rect(lx, h - 7, 2, 2, 0xd8402a),
                    B.erect(lx, h - 7, 2, 2, 0xff7a4a),
                    B.light(lx, h - 6, 0xff7a4a, 6, 'lantern')
                )
            );
        }
        // Gate posts with the lab colour.
        [1, w - 3].forEach(
            (gx) => (B.rect(gx, h - 7, 2, 7, 0xb8b0a0), B.px(gx, h - 8, acc), B.epx(gx, h - 8, acc))
        );
        K.plaqueC(
            B,
            w / 2,
            h - 30 - (st === 'brutalist' ? 4 : 0),
            b.name.replace(/'s Estate$| Estate$| Residence$| Compound$/, ''),
            0xf2e2c0,
            0x1a1a24,
            true,
            w + 8
        );
    };

    // ── Power ───────────────────────────────────────────────────────────────
    D.power_solar = function (B, b, w, h) {
        for (let row = 0; row < 3; row++) {
            const y = h - row * 5;
            for (let x = 2 + row * 3; x < w - 16; x += 7) {
                B.line(x, y - 1, x + 5, y - 4, 0x2a4a8a);
                B.line(x + 1, y - 1, x + 6, y - 4, 0x3a6ac0);
                B.line(x + 1, y - 2, x + 5, y - 4, 0x5a8ad8);
                B.px(x + 3, y, 0x5a5e68);
            }
        }
        // Battery containers.
        for (let k = 0; k < 2; k++) {
            const x = w - 14;
            const y = h - k * 6;
            B.rect(x, y - 5, 12, 5, 0xe8e8ee);
            B.rect(x, y - 5, 12, 1, 0xffffff);
            B.epx(x + 2, y - 3, 0x5aff7a);
            B.epx(x + 4, y - 3, 0x5aff7a);
        }
        K.plaqueC(B, w / 2, h - 26, 'SOLAR + STORAGE', 0xffd27a, 0x14161c, true, w);
    };
    D.power_wind = function (B, b, w, h) {
        [
            [Math.round(w * 0.25), 44],
            [Math.round(w * 0.7), 58],
        ].forEach(([x, th]) => {
            for (let j = 0; j < th; j++) {
                const hw = j < th * 0.5 ? 1 : 0;
                B.px(x, h - j, 0xf0f0f2);
                if (hw) B.px(x + 1, h - j, 0xc8ccd2);
            }
            B.rect(x - 1, h - th - 2, 4, 3, 0xe0e0e4);
            B.blink(x + 1, h - th - 3, 0xff4050, 1.8, x / 50);
            B.spin.push({ x: x + 1, y: h - th - 1, kind: 'turbine', r: Math.round(th * 0.42) });
        });
        K.plaqueC(B, w / 2, h - 8, 'SUNZIA WIND', 0xe8e8ee, 0x14161c, true, w);
    };
    D.power_nuclear = function (B, b, w, h) {
        // Hyperboloid cooling tower with steam, plus the reactor dome.
        const tx = Math.round(w * 0.36);
        const th = Math.min(46, h + 8);
        for (let j = 0; j < th; j++) {
            const t = j / th;
            const half = Math.round(9 + Math.pow(Math.abs(t - 0.62) * 1.6, 2) * 10);
            for (let i = -half; i <= half; i++) {
                const lit = -i / half;
                let c = PL.dpick([0x8a8e98, 0xb8bcc4, 0xd8dce2], 0.5 + lit * 0.5, tx + i, h - j);
                if (j === th - 1) c = 0xe8eaee;
                B.px(tx + i, h - j, c);
            }
        }
        B.rect(tx - 10, h - 6, 20, 1, 0xd84a3a);
        B.smoke.push({ x: tx, y: h - th - 1, k: 2.2, big: true });
        const dx = Math.round(w * 0.78);
        K.wall(B, dx - 8, h - 12, 16, 12, 0xc8ccd2, 'concrete');
        K.dome(B, dx, h - 12, 8, 0xd8dce2, { ry: 7, lantern: false });
        B.rect(dx - 8, h - 5, 16, 1, 0x3a7ad8);
        for (let i = -7; i <= 7; i++) B.epx(dx + i, h - 5, 0x7ab0ff, 200);
        K.plaqueC(B, w / 2, h - th - 10, 'CRANE CLEAN ENERGY', 0x7ab0ff, 0x10141c, true, w + 20);
    };
    D.power_coal = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 10, w - 10, h - 10, 0x6a6a72, 'corrugated');
        K.windows(B, 0, 12, w - 10, up - 12, {
            floorH: 7,
            winW: 5,
            winH: 3,
            pitch: 8,
            top: 2,
            tone: 'office',
            lit: 0.7,
        });
        K.stack(B, w - 8, h, 44, 0xb8b4ac, 0xd8402a, 1.4);
        K.stack(B, w - 20, 10, 20, 0xb8b4ac, 0xd8402a, 0.9);
        for (let x = 2; x < w - 12; x += 8) B.rect(x, 7, 5, 3, 0x8a8a92);
        K.plaqueC(B, (w - 10) / 2, 12 + 2, 'GAS TURBINES', 0xffb84a, 0x14161c, true, w - 12);
    };
    D.power_hydro = function (B, b, w, h) {
        // Dam face with spillway water.
        for (let j = 0; j < h; j++) {
            const inset = Math.round((j / h) * -4 + 4);
            for (let i = inset; i < w - inset; i++) {
                let c = PL.dpick([0x9a9690, 0xb8b4ac, 0xc8c4bc], 0.4 + (i / w) * 0.3, i, j);
                if (j % 8 === 0) c = 0x8a8680;
                B.px(i, j, c);
            }
        }
        const sx = Math.round(w * 0.4);
        for (let j = 2; j < h; j++)
            for (let i = 0; i < 12; i++)
                B.px(
                    sx + i,
                    j,
                    PL.dpick([0x4a8ac8, 0x8ac0e8, 0xe0f0ff], ((j * 3 + i * 7) % 11) / 11, sx + i, j)
                );
        B.spin.push({ x: sx, y: 2, w: 12, h: h - 2, kind: 'water' });
        B.rect(0, 0, w, 2, 0xd8d4cc);
        for (let x = 4; x < w; x += 10)
            (B.rect(x, -4, 3, 4, 0x8a8680),
                B.epx(x + 1, -4, 0xfff0c0),
                B.light(x + 1, -3, 0xfff0c0, 6, 'lamp'));
        K.plaqueC(B, w / 2, -12, 'COLUMBIA HYDRO', 0x9ad0ff, 0x10141c, true, w);
    };
    D.power_smr = function (B, b, w, h) {
        K.wall(B, 4, h - 14, w - 8, 14, 0xd8dce2, 'panel', { pitch: 5 });
        K.dome(B, Math.round(w / 2), h - 14, 10, 0xe8eaee, { ry: 8, lantern: false });
        B.rect(4, h - 5, w - 8, 1, 0x5aff9a);
        for (let x = 4; x < w - 4; x++) B.epx(x, h - 5, 0x8affb8, 200);
        K.plaqueC(B, w / 2, h - 32, 'HERMES SMR', 0x8affb8, 0x10141c, true, w);
    };
    D.power_fusion = function (B, b, w, h) {
        K.wall(B, 2, h - 18, w - 4, 18, 0x2a2838, 'panel', { pitch: 6 });
        // Tokamak ring glowing through a slot.
        const cx = Math.round(w / 2);
        const cy = h - 10;
        for (let j = -6; j <= 6; j++)
            for (let i = -16; i <= 16; i++) {
                const d = Math.hypot(i / 16, j / 6);
                if (d > 1 || d < 0.55) continue;
                const c = PL.dpick(
                    [0x6a2aff, 0xc05aff, 0xffb0ff],
                    1 - Math.abs(d - 0.78) * 4,
                    cx + i,
                    cy + j
                );
                B.px(cx + i, cy + j, dark(c, 0.3));
                B.epx(cx + i, cy + j, c);
            }
        B.light(cx, cy, 0xc05aff, 22, 'neon');
        K.plaqueC(B, cx, h - 28, 'POLARIS FUSION', 0xe0a0ff, 0x100a18, true, w);
    };
})();
