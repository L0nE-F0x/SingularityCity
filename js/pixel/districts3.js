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

    // ── Backbone ────────────────────────────────────────────────────────────
    D.backbone_landing = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, {
            acc: 0x3ad8ff,
            sign: 'CABLE LANDING',
            kind: 'concrete',
            wall: 0x9aa0a8,
        });
        // Fat subsea cables diving into the ground.
        for (let k = 0; k < 3; k++) {
            const x = 6 + k * 5;
            B.rect(x, up - 10, 3, 18, [0xe8b830, 0x2a2a30, 0x3a7ad8][k]);
            B.epx(x + 1, up - 6, 0x7ae8ff);
        }
    };
    D.backbone_ixp = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, { acc: 0x7aff9a, sign: 'IXP', wall: 0x2a2e36 });
        // Fibre light strips racing across the facade.
        for (let y = 5; y < up - 2; y += 4)
            for (let x = 1; x < w - 1; x++)
                if ((x * 7 + y * 3) % 11 < 4) B.epx(x, y, [0x7aff9a, 0x3ad8ff, 0xff7ad0][(y >> 2) % 3], 220);
    };
    D.backbone_ground = function (B, b, w, h) {
        techBlock(B, b, w, h, { acc: 0x9ad0ff, sign: 'GROUND STATION', wall: 0xd8d8d4 });
        K.dish(B, 10, 0, 6);
        K.dish(B, w - 12, 0, 5);
        K.dish(B, Math.round(w / 2), 0, 3);
    };
    D.backbone_cdn = function (B, b, w, h) {
        techBlock(B, b, w, h, { acc: 0xffb84a, sign: 'CDN EDGE', wall: 0x3a3e48, curtain: true });
        // Lattice mast.
        const mx = Math.round(w / 2);
        for (let j = 0; j < 30; j++) {
            const half = Math.max(1, Math.round((30 - j) / 8));
            B.px(mx - half, -j, 0x8a8e98);
            B.px(mx + half, -j, 0x6a6e78);
            if (j % 3 === 0) for (let i = -half; i <= half; i++) B.px(mx + i, -j, 0x7a7e88);
        }
        B.blink(mx, -31, 0xff4050, 1.2, 0);
        B.blink(mx, -16, 0xff4050, 1.2, 0.5);
    };
    D.backbone_noc = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, { acc: 0x3ad8ff, sign: 'NETWORK OPS', wall: 0x2a2e36 });
        K.screen(B, 4, 6, w - 8, Math.min(16, up - 12), 'map', 0x3ad8ff);
    };

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
        techBlock(B, b, w, h, { acc: 0x3ad8ff, sign: 'ROBOTICS R&D', wall: 0xe0e2e6, curtain: true });

    // ── Longevity ───────────────────────────────────────────────────────────
    function helix(B, x, y, hh, c1, c2) {
        for (let j = 0; j < hh; j++) {
            const s = Math.sin(j * 0.55);
            const a = Math.round(s * 2);
            (B.px(x + a, y + j, c1), B.epx(x + a, y + j, c1));
            (B.px(x - a, y + j, c2), B.epx(x - a, y + j, c2));
            if (j % 3 === 0)
                for (let i = -Math.abs(a) + 1; i < Math.abs(a); i++) B.epx(x + i, y + j, 0xe8e8ee, 150);
        }
        B.light(x, y + hh / 2, c1, Math.max(8, hh * 0.6), 'neon');
    }
    D.longevity_protein = function (B, b, w, h) {
        techBlock(B, b, w, h, { acc: 0x5affc0, sign: 'PROTEIN FOUNDRY', wall: 0xe8ece8 });
        helix(B, w - 5, 4, h - 14, 0x5affc0, 0x5ab0ff);
    };
    D.longevity_discovery = (B, b, w, h) =>
        techBlock(B, b, w, h, { acc: 0x7ae8ff, sign: 'DRUG DISCOVERY', wall: 0xdce4ec, curtain: true });
    D.longevity_trials = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, { acc: 0x5affc0, sign: 'CLINICAL TRIALS', wall: 0xf0f0ec });
        const cx = Math.round(w / 2);
        (B.rect(cx - 1, 4, 3, 9, 0x2ab86a), B.rect(cx - 4, 7, 9, 3, 0x2ab86a));
        (B.erect(cx - 1, 4, 3, 9, 0x5affa0), B.erect(cx - 4, 7, 9, 3, 0x5affa0));
        B.light(cx, 8, 0x5affa0, 12, 'neon');
        void up;
    };
    D.longevity_genomics = function (B, b, w, h) {
        techBlock(B, b, w, h, { acc: 0xb07aff, sign: 'GENOMICS', wall: 0x2a2838, curtain: true });
        helix(B, 4, 4, h - 14, 0xb07aff, 0xff7ad0);
    };
    D.longevity_cryo = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 4, w, h - 4, 0xb8c8d8, 'concrete');
        for (let x = 0; x < w; x++) (B.px(x, 4, 0xf0f8ff), B.px(x, 5 + (x % 3 === 0 ? 1 : 0), 0xe0f0ff));
        // Round vault door with blue frost glow.
        const cx = Math.round(w / 2);
        B.ellipse(cx, up - 1, 7, 7, 0x6a7a8a);
        B.ellipse(cx, up - 1, 5, 5, 0x8a9aaa);
        B.rect(cx - 4, up - 1, 9, 1, 0x4a5a6a);
        for (let i = -6; i <= 6; i++) B.epx(cx + i, up - 9, 0x9ae8ff);
        B.light(cx, up - 1, 0x7ad8ff, 16, 'neon');
        K.plaqueC(B, cx, 7, 'CRYONICS', 0x7ad8ff, 0x101a24, true, w);
    };

    // ── Agents ──────────────────────────────────────────────────────────────
    D.agents_orchestrator = function (B, b, w, h) {
        techBlock(B, b, w, h, { acc: 0xff9a3a, sign: 'ORCHESTRATION HUB', wall: 0x22242e, curtain: true });
        // Node network on the crown.
        const pts = [];
        for (let i = 0; i < 6; i++)
            pts.push([4 + Math.round(B.h01(i, 1) * (w - 8)), -12 + Math.round(B.h01(i, 2) * 9)]);
        pts.forEach((p, i) => pts.slice(i + 1).forEach((q) => B.eline(p[0], p[1], q[0], q[1], 0x7a4a2a)));
        pts.forEach((p) => (B.px(p[0], p[1], 0xffb84a), B.epx(p[0], p[1], 0xffe0a0)));
    };
    D.agents_toolshop = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, 0x5a4a6a, 'brick');
        K.windows(B, 0, 2, w, up - 2, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            tone: 'home',
            lit: 0.6,
        });
        K.cap(B, 0, 0, w, 0xd8c8e8);
        K.shop(B, 0, up - 6, w, LOBBY + 6, {
            sign: 'TOOL REGISTRY',
            accent: 0xb07aff,
            stripe: 0xe8e0f0,
            goods: true,
            signCol: 0xe0c8ff,
        });
    };
    D.agents_sandbox = function (B, b, w, h) {
        // Geodesic dome arena.
        const cx = Math.round(w / 2);
        const r = Math.min(Math.round(w / 2) - 2, h - 2);
        for (let j = 0; j <= r; j++)
            for (let i = -r; i <= r; i++) {
                const d = Math.hypot(i, j) / r;
                if (d > 1) continue;
                const edge = (i + j) % 4 === 0 || (i - j) % 4 === 0;
                B.px(
                    cx + i,
                    h - j,
                    edge ? 0x6a7a8a : PL.dpick([0x2a3a4a, 0x3a5a6a], (-i / r) * 0.5 + 0.5, cx + i, h - j)
                );
                if (!edge && B.h01(i, j) > 0.6) B.epx(cx + i, h - j, 0x5affd0, 90);
            }
        B.light(cx, h - r / 2, 0x5affd0, r, 'wash');
        K.plaqueC(B, cx, h - r - 9, 'SANDBOX ARENA', 0x5affd0, 0x0e1618, true, w);
    };
    D.agents_deploy = function (B, b, w, h) {
        // A glowing portal gate.
        const cx = Math.round(w / 2);
        const gh = Math.min(h - 2, 30);
        K.wall(B, 0, h - gh - 4, w, gh + 4, 0x2a2c36, 'panel', { pitch: 6 });
        for (let j = 0; j < gh; j++)
            for (let i = -8; i <= 8; i++) {
                const inside = Math.abs(i) < 7 && j > 2;
                if (!inside) continue;
                const c = PL.dpick(
                    [0x3a1a6a, 0x7a3aff, 0xc08aff],
                    1 - j / gh + Math.sin(i * 0.8) * 0.1,
                    cx + i,
                    h - j
                );
                B.px(cx + i, h - j, c);
                B.epx(cx + i, h - j, c, 230);
            }
        B.light(cx, h - gh / 2, 0xa06aff, 22, 'neon');
        PL.roofSign(B, 'DEPLOY GATEWAY', 0, w, h - gh - 4, 0xc08aff, { small: true, bg: 0x100a18 });
    };
    D.agents_memory = function (B, b, w, h) {
        const up = techBlock(B, b, w, h, {
            acc: 0x5ad8ff,
            sign: 'MEMORY VAULT',
            wall: 0x3a3e4a,
            kind: 'concrete',
        });
        for (let y = 6; y < up - 3; y += 3)
            for (let x = 3; x < w - 3; x += 3) if (B.h01(x, y) > 0.5) B.epx(x, y, 0x5ad8ff, 150);
    };

    // ── Alignment: small institutes in brick with ivy ───────────────────────
    const ALIGN = {
        align_miri: 'MIRI',
        align_metr: 'METR',
        align_apollo: 'APOLLO',
        align_redwood: 'REDWOOD',
        align_far: 'FAR AI',
    };
    D['pre:align'] = function (B, b, w, h) {
        const brick = [0x7a4a3a, 0x8a5a42, 0x6a3e34][PL.seedOf(b.id) % 3];
        const bw = w - 10;
        K.wall(B, 0, 6, bw, h - 6, brick, 'brick');
        K.windows(B, 0, 8, bw, h - 8, {
            floorH: 7,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            inset: 3,
            sill: 0xd8c8a8,
            tone: 'home',
            lit: 0.8,
        });
        K.pitched(B, 0, 6, bw, 0x3a3a44, { h: 6, over: 1 });
        for (let y = 8; y < h; y++)
            for (let x = bw - 7; x < bw; x++)
                if (B.h01(x, y) > 0.5) B.px(x, y, B.h01(y, x) > 0.5 ? 0x3e7a3a : 0x2e5e30);
        K.door(B, Math.round(bw / 2) - 2, h - 6, 4, 6, 0x2a3a2a);
        if (b.id === 'align_redwood')
            PL.S.pine(
                B.base,
                B.X(w - 4),
                B.Y(h),
                34,
                B.seed,
                [0x2a1a14, 0x5a2a1a, 0x2e5e30, 0x3e7a3a, 0x5aa050]
            );
        else K.tree(B, w - 4, h, 5, PL.S.LEAF.green);
        K.plaqueC(B, bw / 2, -8, ALIGN[b.id] || b.name, 0xf2e2c0, 0x1a1a24, true, bw + 8);
        K.lamp(B, bw + 1, h, 0xffc878);
    };

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
