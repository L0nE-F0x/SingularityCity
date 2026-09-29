/* Pixel lab v2 — district painters, part 2: civic core, HQ-row specials, VC Row,
   embassies, the Times, the Index, the Neon Bar and the Underground. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, shade, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const LOBBY = 8;
    const FL = 6;

    // ── Civic ───────────────────────────────────────────────────────────────
    D.court_senate = function (B, b, w, h) {
        const stone = 0xe8e0d0;
        K.wall(B, 0, 10, w, h - 10, stone, 'stone');
        K.windows(B, 0, 12, w, h - 22, {
            floorH: 7,
            winW: 3,
            winH: 5,
            pitch: 7,
            top: 1,
            inset: 4,
            tone: 'office',
            lit: 0.5,
        });
        K.columns(B, Math.round(w * 0.25), 14, Math.round(w * 0.5), h - 16, light(stone, 0.05), 5);
        const top = K.pediment(B, Math.round(w * 0.22), 14, Math.round(w * 0.56), stone);
        B.rect(0, 10, w, 2, light(stone, 0.2));
        const dy = K.dome(B, Math.round(w / 2), top + 1, 13, 0xd8d4c8, { ry: 11, ribs: true });
        K.flag(B, Math.round(w / 2), dy - 3, [0x2a4ab0, 0xe8e8ee, 0x2a4ab0], 7);
        // Steps.
        for (let s = 0; s < 3; s++)
            B.rect(
                Math.round(w * 0.2) - s * 2,
                h - 1 - s,
                Math.round(w * 0.6) + s * 4,
                1,
                s % 2 ? 0xd8d0c0 : 0xc8c0b0
            );
        K.door(B, Math.round(w / 2) - 2, h - 9, 4, 6, 0x3a2a1a);
        B.light(Math.round(w / 2), dy + 4, 0xfff0d0, 22, 'wash');
        K.plaqueC(B, w / 2, h - 16, 'AI SENATE', 0x3a2a1a, 0xe8dcc4, false, w);
    };
    D.court_hearing = function (B, b, w, h) {
        const stone = 0xd8d0c0;
        K.wall(B, 0, 8, w, h - 8, stone, 'stone');
        K.columns(B, 3, 12, w - 6, h - 13, light(stone, 0.08), 6);
        K.pediment(B, 1, 12, w - 2, stone);
        B.rect(0, 8, w, 4, light(stone, 0.1));
        K.plaqueC(B, w / 2, 9, 'HEARING', 0x3a2a1a, 0xe8dcc4, false, w);
        for (let x = 6; x < w - 6; x += 6) K.pane(B, x + 1, 15, 3, h - 20, { tone: 'home', lit: 0.8 }, x);
        // Scales of justice above the pediment.
        const cx = Math.round(w / 2);
        B.rect(cx, -2, 1, 7, 0xe8c060);
        B.rect(cx - 4, -2, 9, 1, 0xe8c060);
        (B.px(cx - 4, -1, 0xe8c060), B.px(cx + 4, -1, 0xe8c060));
        (B.rect(cx - 5, 0, 3, 1, 0xe8c060), B.rect(cx + 3, 0, 3, 1, 0xe8c060));
    };
    D.ai_jail = function (B, b, w, h) {
        const conc = 0x7a7a80;
        const up = h - LOBBY;
        K.wall(B, 0, 4, w - 14, h - 4, conc, 'concrete', { seamY: 8 });
        for (let f = 1; f * FL < up; f++)
            for (let x = 4; x < w - 18; x += 6) {
                B.rect(x, 4 + f * FL - 4, 3, 4, 0x1a1a20);
                if (B.h01(x, f) > 0.4) B.erect(x, 4 + f * FL - 4, 3, 4, 0xe8e0c0, 200);
                for (let i = 0; i < 3; i += 2) B.rect(x + i, 4 + f * FL - 4, 1, 4, 0x4a4a52);
            }
        // Razor wire.
        for (let i = 0; i < w - 14; i++) B.px(i, 3 - ((i >> 1) % 2), 0x9a9aa2);
        // Watchtower with a searchlight.
        const tx = w - 11;
        K.wall(B, tx, -10, 8, h + 10, 0x6a6a70, 'concrete');
        B.rect(tx - 2, -16, 12, 6, 0x5a5a62);
        B.rect(tx - 1, -15, 10, 3, 0x2a2a30);
        B.erect(tx, -14, 3, 1, 0xfff4d0);
        B.light(tx + 1, -14, 0xfff4d0, 10, 'spot');
        B.spin.push({ x: tx + 1, y: -14, kind: 'searchlight' });
        B.rect(tx - 2, -17, 12, 1, 0x8a8a92);
        K.door(B, 8, h - 7, 5, 7, 0x3a3a44);
        K.plaqueC(B, (w - 14) / 2, 6, 'AI DETENTION', 0xff6a5a, 0x1a1418, true, w - 16);
    };
    D.graveyard = function (B, b, w, h) {
        const ground = h;
        K.fence(B, 0, ground, w, 0x2a2a30);
        const R = PL.rng(B.seed);
        for (let x = 5; x < w - 4; x += 6 + Math.floor(R() * 4)) {
            const kind = R();
            const sh = 5 + Math.floor(R() * 4);
            const c = mix(0x8a8a92, 0x6a7a6a, R() * 0.5);
            if (kind < 0.5) {
                B.rect(x, ground - sh, 4, sh, c);
                B.rect(x + 1, ground - sh - 1, 2, 1, c);
                B.px(x, ground - sh, light(c, 0.3));
                B.rect(x + 1, ground - sh + 2, 2, 1, dark(c, 0.35));
            } else if (kind < 0.8) {
                B.rect(x + 1, ground - sh - 2, 1, sh + 2, c);
                B.rect(x, ground - sh, 3, 1, c);
            } else {
                B.rect(x, ground - 3, 5, 3, c);
                B.rect(x + 1, ground - 4, 3, 1, light(c, 0.2));
            }
            if (R() > 0.7)
                (B.epx(x + 1, ground - 1, 0xffb84a), B.light(x + 1, ground - 1, 0xffa040, 5, 'lantern'));
        }
        PL.S.deadTree(B.base, B.X(w - 12), B.Y(ground), 26, B.seed);
        PL.S.deadTree(B.base, B.X(10), B.Y(ground), 18, B.seed + 3);
        // Gate arch.
        const gx = Math.round(w * 0.45);
        B.rect(gx, ground - 14, 1, 14, 0x2a2a30);
        B.rect(gx + 12, ground - 14, 1, 14, 0x2a2a30);
        for (let i = 0; i <= 12; i++)
            B.px(gx + i, ground - 14 - Math.round(Math.sin((i / 12) * Math.PI) * 3), 0x2a2a30);
        B.text('DEPRECATED', gx - 13, ground - 22, 0xa8a8b0, 3, 1, 0x1a1a20);
    };
    D.bld_1 = function (B, b, w, h) {
        // Legacy Systems: a 70s mainframe block, beige with green terminal glow.
        const beige = 0xc8b48a;
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, beige, 'concrete', { seamY: 6 });
        for (let f = 0; f * FL < up - 3; f++) {
            B.rect(1, f * FL + 2, w - 2, 3, 0x2a3024);
            for (let x = 2; x < w - 2; x++)
                if (B.h01(x >> 1, f) > 0.35)
                    B.epx(x, f * FL + 3, B.h01(x, f) > 0.9 ? 0xffb84a : 0x5aff7a, 220);
            B.rect(0, f * FL + 5, w, 1, dark(beige, 0.2));
        }
        B.rect(0, 0, w, 2, 0x8a5a2a);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0xe8a030, frame: 0x3a2a1a, interior: 0xd8f0a0 });
        PL.roofSign(B, 'LEGACY SYSTEMS', 0, w, 0, 0x5aff7a, { small: true });
    };
    D.gym = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, 0x2a2e3a, 'panel', { pitch: 6 });
        for (let f = 0; f * 10 < up - 4; f++) {
            const y = 2 + f * 10;
            B.rect(2, y, w - 4, 7, 0x1a1e28);
            for (let x = 3; x < w - 3; x++) {
                const c = x % 12 === 0 ? 0x1a1e28 : 0xfff0d8;
                B.epx(x, y + 1, c, 200);
                B.epx(x, y + 2, shade(c, 0.9), 200);
            }
            // Treadmills and weights silhouetted.
            for (let x = 5; x < w - 6; x += 9) {
                (B.epx(x, y + 5, 0x2a2a34),
                    B.epx(x + 1, y + 5, 0x2a2a34),
                    B.epx(x + 2, y + 5, 0x2a2a34),
                    B.epx(x + 3, y + 4, 0x2a2a34));
                (B.epx(x + 2, y + 3, 0x3a2a24), B.epx(x + 2, y + 4, 0x3a2a24));
            }
        }
        K.lobby(B, 0, up, w, LOBBY, { accent: 0xff4a8a, interior: 0xfff0e0 });
        const s = 'RLHF GYM';
        B.rect(Math.round(w / 2 - 20), -9, 40, 8, 0x14101a);
        K.neonBox(B, Math.round(w / 2 - 20), -9, 40, 8, 0xff4a8a);
        B.etext(s, Math.round(w / 2 - PL.textW(s, 3) / 2), -7, 0xff8ac0, 3);
        B.text(s, Math.round(w / 2 - PL.textW(s, 3) / 2), -7, 0xff6aa8, 3);
        B.light(w / 2, -5, 0xff4a8a, 18, 'neon');
    };
    D.cafe = function (B, b, w, h) {
        const up = h - LOBBY - 6;
        const brick = 0x7a4a3a;
        K.wall(B, 0, 0, w, up, brick, 'brick');
        K.windows(B, 0, 2, w, up - 2, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            inset: 3,
            sill: 0xd8c8a8,
            tone: 'home',
            lit: 0.7,
            shutters: 0x3a5a3a,
        });
        K.cap(B, 0, 0, w, 0xd8c8a8, { thick: true });
        K.shop(B, 0, up, w, h - up, {
            sign: 'API CAFE',
            accent: 0xc8742a,
            stripe: 0xf2e6d0,
            interior: 0xffc878,
            counter: true,
            signBg: 0x2a1a14,
            signCol: 0xffd27a,
        });
        // Pavement tables and a string of bulbs.
        [4, w - 12].forEach((tx) => {
            B.rect(tx, h - 3, 5, 1, 0x3a2a24);
            B.rect(tx + 2, h - 2, 1, 2, 0x3a2a24);
        });
        K.stringLights(B, 0, up - 1, w - 1, up - 1, 2);
        K.plants(B, 2, 0, 8);
    };
    D.park = function (B, b, w, h) {
        // Leaderboard Monument: a plaza, an obelisk and a giant scoreboard.
        const cx = Math.round(w / 2);
        for (let x = 0; x < w; x += 22) K.tree(B, x + 6, h, 5, PL.S.LEAF.green);
        B.rect(cx - 16, h - 3, 32, 3, 0xb8b0a0);
        B.rect(cx - 12, h - 5, 24, 2, 0xc8c0b0);
        for (let j = 0; j < 38; j++) {
            const hw = Math.max(1, Math.round(3 - j * 0.05));
            for (let i = -hw; i <= hw; i++)
                B.px(
                    cx + i,
                    h - 5 - j,
                    i < 0 ? light(0xd8d0c0, 0.15) : i > 0 ? dark(0xd8d0c0, 0.2) : 0xd8d0c0
                );
        }
        B.px(cx, h - 44, 0xe8c060);
        B.blink(cx, h - 45, 0xff4050, 2, 0);
        // Scoreboard.
        const sx = cx + 8;
        B.rect(sx + 3, h - 12, 1, 12, 0x3a3a44);
        B.rect(sx + 22, h - 12, 1, 12, 0x3a3a44);
        B.rect(sx, h - 30, 26, 18, 0x14161c);
        const rows = ['CLAUDE', 'GPT', 'GEMINI'];
        rows.forEach((r, i) => {
            const col = [0xffd27a, 0xd8dce2, 0xd8905a][i];
            B.text(r, sx + 2, h - 28 + i * 6, col, 3);
            B.etext(r, sx + 2, h - 28 + i * 6, col, 3);
        });
        B.light(sx + 13, h - 21, 0x9ad0ff, 16, 'neon');
        K.lamp(B, cx - 14, h - 3, 0xffd88a);
        K.lamp(B, cx + 36, h, 0xffd88a);
    };
    D.open_square = function (B, b, w, h) {
        // Open Source Hub: a glass pavilion on a plaza, bulbs strung across.
        const cx = Math.round(w / 2);
        const pw = Math.round(w * 0.56);
        const px = cx - Math.round(pw / 2);
        const ph = Math.min(h - 4, 28);
        K.curtain(B, px, h - ph, pw, ph, {
            pitch: 5,
            floorH: 7,
            mullion: 0x2a3a2a,
            glassTop: 0x9ad0b0,
            glassBot: 0x4a7a5a,
            lit: 0.85,
            tone: 'home',
        });
        for (let i = -2; i < pw + 2; i++)
            (B.px(px + i, h - ph - 1, 0xe8e8ee), B.px(px + i, h - ph, 0xa8b0b8));
        K.tree(B, 6, h, 6, PL.S.LEAF.green);
        K.tree(B, w - 7, h, 6, PL.S.LEAF.green);
        K.stringLights(B, 2, h - 18, px, h - ph + 2, 3);
        K.stringLights(B, px + pw, h - ph + 2, w - 2, h - 18, 3);
        const s = 'OPEN SOURCE';
        B.text(s, cx - Math.round(PL.textW(s, 3) / 2), h - ph - 8, 0x7aff9a, 3, 1, 0x0a1a0e);
        B.etext(s, cx - Math.round(PL.textW(s, 3) / 2), h - ph - 8, 0xa8ffc0, 3);
        B.light(cx, h - ph - 6, 0x7aff9a, 16, 'neon');
        // Fountain.
        B.rect(cx - 6, h - 2, 12, 2, 0x8a8a92);
        B.rect(cx - 5, h - 3, 10, 1, 0x4a8ab0);
    };
    D.arena = function (B, b, w, h) {
        // LMSYS Arena: an oval bowl with a jumbotron and floodlight masts.
        const cx = Math.round(w / 2);
        const bowlH = Math.min(h, 26);
        for (let j = 0; j < bowlH; j++) {
            const t = j / bowlH;
            const half = Math.round((w / 2 - 2) * Math.sqrt(1 - Math.pow(1 - t, 2) * 0.35));
            for (let i = -half; i <= half; i++) {
                let c = j < 3 ? 0xe8e8ee : (i + j) % 6 === 0 ? 0x5a5e6a : 0x9aa0aa;
                if (j > 5 && j < 10 && i % 4 !== 0) c = 0x3a3e4a;
                B.px(cx + i, h - bowlH + j, c);
                if (j > 5 && j < 10 && i % 4 !== 0 && B.h01(i, j) > 0.3)
                    B.epx(cx + i, h - bowlH + j, [0xff6a5a, 0x5ad0ff, 0xffd27a][Math.abs(i) % 3], 200);
            }
        }
        K.screen(B, cx - 12, h - bowlH - 12, 24, 10, 'bars', 0x5ad0ff);
        B.rect(cx - 1, h - bowlH - 2, 3, 2, 0x3a3a44);
        [4, w - 5].forEach((mx) => {
            B.rect(mx, h - bowlH - 20, 1, 20, 0x5a5e68);
            B.rect(mx - 2, h - bowlH - 22, 5, 2, 0x3a3e48);
            for (let i = -2; i < 3; i++) B.epx(mx + i, h - bowlH - 21, 0xfff8e0);
            B.light(mx, h - bowlH - 21, 0xfff8e0, 16, 'spot');
        });
        K.plaqueC(B, cx, h - 7, 'LMSYS ARENA', 0xffd27a, 0x14161c, true, w);
    };
    D.city_park = function (B, b, w, h) {
        const R = PL.rng(B.seed);
        // Pond with a mirrored rim, a gazebo, blossom and oak trees, old lamps.
        const px = Math.round(w * 0.55);
        for (let x = 0; x < w; x += 9 + Math.floor(R() * 8)) {
            if (x > px - 6 && x < px + 36) continue;
            const blossom = R() > 0.72;
            K.tree(B, x + 3, h, 5 + Math.floor(R() * 5), blossom ? PL.S.LEAF.blossom : PL.S.LEAF.green);
        }
        B.rect(px, h - 2, 30, 2, 0x2a5a8a);
        B.rect(px, h - 2, 30, 1, 0x6a9ac8);
        B.rect(px - 1, h - 1, 32, 1, 0x6a6a72);
        // Gazebo.
        const gx = Math.round(w * 0.22);
        B.rect(gx, h - 12, 1, 12, 0xe8e8ee);
        B.rect(gx + 14, h - 12, 1, 12, 0xe8e8ee);
        for (let j = 0; j < 5; j++)
            B.rect(gx - 2 + j * 2, h - 13 - j, 19 - j * 4, 1, j === 0 ? 0xa84a3a : 0xc85a4a);
        B.rect(gx, h - 3, 15, 1, 0xd8d0c0);
        K.stringLights(B, gx, h - 12, gx + 14, h - 12, 2);
        for (let x = 30; x < w; x += 44) K.lamp(B, x, h, 0xffc878);
        // Benches.
        [Math.round(w * 0.4), Math.round(w * 0.85)].forEach((bx) => {
            B.rect(bx, h - 3, 7, 1, 0x7a5236);
            B.rect(bx, h - 2, 1, 2, 0x2a2a30);
            B.rect(bx + 6, h - 2, 1, 2, 0x2a2a30);
        });
        B.text('CENTRAL PARK', Math.round(w * 0.35), h - 30, 0xf2e2c0, 3, 1, 0x1a2a1a);
    };
    D.visitor_monument = function (B, b, w, h) {
        const cx = Math.round(w / 2);
        B.rect(cx - 8, h - 4, 16, 4, 0xb8b0a0);
        B.rect(cx - 6, h - 6, 12, 2, 0xc8c0b0);
        // A figure holding up a glowing chip.
        B.rect(cx - 1, h - 18, 3, 12, 0x8a9a8a);
        B.rect(cx - 2, h - 13, 5, 3, 0x7a8a7a);
        (B.px(cx, h - 20, 0x8a9a8a), B.px(cx, h - 19, 0x8a9a8a));
        B.rect(cx + 2, h - 24, 1, 8, 0x7a8a7a);
        B.rect(cx + 1, h - 27, 4, 3, 0x5aff9a);
        B.erect(cx + 1, h - 27, 4, 3, 0x9affc0);
        B.light(cx + 3, h - 26, 0x5aff9a, 10, 'neon');
        B.light(cx, h - 8, 0xfff0d0, 12, 'wash');
    };

    // ── VC Row ──────────────────────────────────────────────────────────────
    const VC = {
        vcrow_apex: { name: 'A16Z', col: 0xff6a3a, glass: 0x3a2e2a },
        vcrow_horizon: { name: 'SEQUOIA', col: 0x3aa85a, glass: 0x1e2e24 },
        vcrow_thrive: { name: 'THRIVE', col: 0x8a7aff, glass: 0x24223a },
        vcrow_foundersfund: { name: 'FOUNDERS FUND', col: 0xe8e8ee, glass: 0x22262e },
        vcrow_launchpad: { name: 'Y COMBINATOR', col: 0xff7a1a, glass: 0x2e2620 },
        vcrow_mgx: { name: 'MGX', col: 0xe8c060, glass: 0x2a2618 },
        vcrow_titan: { name: 'SOFTBANK', col: 0xe8e8ee, glass: 0x262a34 },
    };
    D['pre:vcrow'] = function (B, b, w, h) {
        const V = VC[b.id] || { name: b.name, col: 0xe8c060, glass: 0x26262e };
        const up = h - LOBBY;
        const gold = 0xd8b060;
        K.curtain(B, 2, 4, w - 4, up - 4, {
            pitch: 4,
            mullion: mix(0x3a3428, V.glass, 0.5),
            glassTop: mix(0x8aa4c0, gold, 0.25),
            glassBot: mix(0x3a4a60, V.glass, 0.4),
            lit: 0.5,
            tone: 'office',
        });
        // Gold spandrel bands and a double-height crown.
        for (let y = 4 + FL * 4; y < up - 2; y += FL * 4) B.rect(2, y, w - 4, 1, gold);
        B.rect(0, 0, w, 5, dark(gold, 0.5));
        B.rect(0, 0, w, 1, light(gold, 0.3));
        B.rect(0, 4, w, 1, gold);
        K.lobby(B, 0, up, w, LOBBY, { accent: gold, frame: 0x2a2418, interior: 0xffe0a0 });
        // Revolving name + a small stock ticker.
        PL.roofSign(B, V.name, 0, w, 0, V.col, { bg: 0x0e0e14 });
        const ty = up - 6;
        B.rect(2, ty, w - 4, 5, 0x0a0a10);
        const tick = ['+4.2%', '-1.1%', '+12%', '+0.8%', '-3.4%', '+7.7%'];
        let tx = 3;
        tick.forEach((t, i) => {
            const c = t[0] === '+' ? 0x5aff7a : 0xff5a5a;
            if (tx + PL.textW(t, 3) > w - 3) return;
            (B.text(t, tx, ty, c, 3), B.etext(t, tx, ty, c, 3));
            tx += PL.textW(t, 3) + 3;
            void i;
        });
    };
    // ── Embassy Quarter ─────────────────────────────────────────────────────
    const NATION = {
        us: { flag: [0xb22234, 0xe8e8ee, 0xb22234, 0x3c3b6e], wall: 0xe8e4dc, roof: 0x5a6a7a, acc: 0x3c3b6e },
        cn: { flag: [0xde2910, 0xde2910, 0xffde00], wall: 0xc8a888, roof: 0xb8342a, acc: 0xde2910 },
        eu: { flag: [0x003399, 0x003399, 0xffcc00], wall: 0xe0dcd4, roof: 0x3a4a6a, acc: 0x003399 },
        uk: { flag: [0x012169, 0xc8102e, 0xe8e8ee, 0x012169], wall: 0x8a4a3a, roof: 0x3a3a44, acc: 0xc8102e },
        in: { flag: [0xff9933, 0xe8e8ee, 0x138808], wall: 0xd8b888, roof: 0xc8904a, acc: 0xff9933 },
        ae: { flag: [0x00732f, 0xe8e8ee, 0x1a1a1a], wall: 0xf0ece0, roof: 0xc8b890, acc: 0x00732f },
    };
    D['pre:embassy'] = function (B, b, w, h) {
        const code = b.id.split('_')[1];
        const N = NATION[code] || NATION.us;
        const up = h - LOBBY;
        K.wall(B, 0, 4, w, h - 4, N.wall, code === 'uk' ? 'brick' : 'stone');
        K.windows(B, 0, 6, w, up - 6, {
            floorH: FL + 1,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            inset: 3,
            lintel: light(N.wall, 0.2),
            tone: 'office',
            lit: 0.55,
        });
        if (code === 'cn') {
            for (let i = -2; i < w + 2; i++) {
                const lift = i < 1 ? 1 - i : i > w - 2 ? i - (w - 2) : 0;
                (B.px(i, 3 - lift, light(N.roof, 0.2)), B.px(i, 4 - lift, N.roof));
            }
            [4, w - 5].forEach(
                (x) => (
                    B.rect(x - 1, up - 4, 3, 2, 0xde2910),
                    B.erect(x - 1, up - 4, 3, 2, 0xff6a4a),
                    B.light(x, up - 3, 0xff6a4a, 6, 'lantern')
                )
            );
        } else if (code === 'in' || code === 'ae') {
            K.dome(B, Math.round(w / 2), 4, 7, code === 'in' ? 0xe8d8b8 : 0xe8e4d8, { lantern: true });
            for (let x = 4; x < w - 4; x += 8)
                for (let i = 0; i < 5; i++)
                    B.px(x + i, up - 2 - Math.round(Math.sin((i / 4) * Math.PI) * 3), light(N.wall, 0.25));
        } else {
            K.pediment(B, Math.round(w * 0.2), 4, Math.round(w * 0.6), N.wall);
            B.rect(0, 3, w, 2, light(N.wall, 0.15));
        }
        K.columns(B, Math.round(w / 2) - 8, up - 3, 17, LOBBY + 3, light(N.wall, 0.1), 5);
        K.door(B, Math.round(w / 2) - 2, h - 6, 4, 6, 0x3a2a1a);
        K.flag(B, w - 4, 4, N.flag, 12);
        K.fence(B, 0, h, Math.round(w / 2) - 9, 0x2a2a30);
        K.fence(B, Math.round(w / 2) + 9, h, Math.round(w / 2) - 9, 0x2a2a30);
        K.plaqueC(B, w / 2, -10, b.name, 0xf2e2c0, 0x1a1a24, true, w + 12);
    };
    D['pre:diplomat_villa'] = function (B, b, w, h) {
        const code = b.id.split('_').pop();
        const N = NATION[code] || NATION.us;
        const bw = w - 12;
        const bx = 6;
        K.wall(B, bx, 8, bw, h - 8, mix(N.wall, 0xf0e8d8, 0.4), 'stucco');
        K.windows(B, bx, 10, bw, h - 12, {
            floorH: 8,
            winW: 3,
            winH: 5,
            pitch: 7,
            top: 1,
            inset: 3,
            shutters: dark(N.roof, 0.1),
            tone: 'home',
            lit: 0.6,
        });
        K.pitched(B, bx, 8, bw, N.roof, { h: 7, over: 2 });
        K.door(B, bx + Math.round(bw / 2) - 2, h - 7, 4, 7, 0x4a2a1a);
        K.tree(B, 2, h, 4, PL.S.LEAF.green);
        K.tree(B, w - 3, h, 5, PL.S.LEAF.olive);
        K.fence(B, 0, h, w, 0xe8e8ee, 'picket');
        K.flag(B, bx + bw - 3, 1, N.flag, 7);
    };

    // ── The Index, the Times, the bar and the market ────────────────────────
    D.ai_index = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, 0x1e2230, 'panel', { pitch: 4 });
        K.screen(B, 3, 6, w - 6, Math.min(22, up - 14), 'chart', 0x5aff9a);
        K.windows(B, 0, 30, w, up - 30, { floorH: FL, winW: 3, winH: 4, pitch: 5, tone: 'office', lit: 0.6 });
        K.cap(B, 0, 0, w, 0x5a6272);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0x5aff9a, interior: 0xd8f0e0 });
        PL.roofSign(B, 'AI INDEX', 0, w, 0, 0x5aff9a, { bg: 0x0a120e });
        K.antenna(B, 4, 0, 12);
    };
    D.times_hq = function (B, b, w, h) {
        const stone = 0xd0c4ac;
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, stone, 'stone');
        K.windows(B, 0, 10, w, up - 10, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 5,
            top: 1,
            inset: 2,
            tone: 'office',
            lit: 0.8,
        });
        // Blackletter-ish masthead and a moving news ticker band.
        B.rect(0, 1, w, 8, 0x14141a);
        B.text('THE TIMES', Math.round(w / 2 - PL.textW('THE TIMES', 3) / 2), 2, 0xe8e2d0, 3);
        B.etext('THE TIMES', Math.round(w / 2 - PL.textW('THE TIMES', 3) / 2), 2, 0xfff4e0, 3);
        B.rect(0, up - 7, w, 6, 0x0e0e12);
        B.text('AI NEWS', 2, up - 7, 0xffb84a, 3);
        B.etext('AI NEWS', 2, up - 7, 0xffc86a, 3);
        B.spin.push({ x: 0, y: up - 7, w: w, kind: 'ticker' });
        K.lobby(B, 0, up, w, LOBBY, { accent: 0xc0392b, frame: 0x2a2420 });
        K.cap(B, 0, 0, w, light(stone, 0.2));
    };
    D.neon_bar = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, 0x2a1e2e, 'wood');
        K.windows(B, 0, 2, w, up - 2, {
            floorH: 8,
            winW: 4,
            winH: 5,
            pitch: 7,
            top: 1,
            inset: 3,
            tone: 'neon',
            lit: 0.8,
            frame: 0x14101a,
        });
        K.blade(B, w - 4, 2, 'BAR', 0xff4a8a, { max: 3 });
        K.blade(B, -2, 4, 'SAKE', 0x5ad8ff, { max: 4 });
        // Noren curtain + lanterns.
        B.rect(0, up, w, LOBBY, 0x1a1016);
        for (let x = 3; x < w - 3; x++) {
            B.px(x, up + 1, 0x2a2a6a);
            B.px(x, up + 2, x % 4 === 0 ? 0x1a1016 : 0x3a3a8a);
            B.epx(x, up + 4, 0xff9a5a, 200);
            B.epx(x, up + 5, 0xffb07a, 200);
        }
        for (let x = 4; x < w - 3; x += 8) {
            B.rect(x, up - 3, 3, 3, 0xd8402a);
            B.erect(x, up - 3, 3, 3, 0xff7a4a);
            B.light(x + 1, up - 2, 0xff6a3a, 7, 'lantern');
        }
        PL.roofSign(B, 'NEON BAR', 0, w, 0, 0xff4a8a, { bg: 0x0e0a14, small: true });
        B.light(w / 2, h - 2, 0xff6a9a, 14, 'shop');
    };
    // The Underground sits below the street; at street level it is only a
    // hatch with a red lamp. The cavern is drawn by the ground painter.
    D.black_market = function (B, b, w, h) {
        const cx = Math.round(w * 0.3);
        B.rect(cx - 4, h - 2, 9, 2, 0x2a2a30);
        B.rect(cx - 3, h - 2, 7, 1, 0x3a3a44);
        B.rect(cx + 6, h - 10, 1, 10, 0x2a2a30);
        B.rect(cx + 5, h - 12, 3, 2, 0x5a1010);
        B.erect(cx + 5, h - 12, 3, 2, 0xff3a2a);
        B.light(cx + 6, h - 11, 0xff3a2a, 8, 'lantern');
        B.text('?', cx - 1, h - 9, 0x5a1a1a, 3);
    };
})();
