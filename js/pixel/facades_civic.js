/* Pixel art — civic landmarks whose classic art carries live data or anchors other
   systems: Visitor Monument (live counters), Leaderboard Monument, Global AI Index
   billboard (live scores), Central Park (fountain spray, lamp glows, bird perches) and
   the Memorial Park graveyard (one headstone per retired model, click zones).
   Positions come from the values the classic branch stores on the building (b._lamps,
   b._treePositions, b._headstones, b._screenX…) so every live overlay lands on its
   pixel counterpart. Fallbacks reproduce the same maths for the look-dev page. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    // ── Visitor Monument — digital obelisk; the live counters sit on its screen ──
    D.visitor_monument = function (B, b, w, h) {
        const W = b.w;
        const H = h * 3;
        const stone = 0x2a2a48;
        // Base platform.
        B.rect(q(5), h - 3, q(W - 10), 3, 0x3a3a5a);
        B.rect(q(8), h - 4, q(W - 16), 1, light(0x3a3a5a, 0.2));
        // Tapering obelisk body from ground to y = -30 (world).
        const top = q(-30);
        for (let y = top; y < h - 3; y++) {
            const t = (y - top) / (h - 3 - top);
            const l = q(20 + (15 - 20) * t);
            const r = q(W - 20 + (20 - 15) * t);
            for (let x = l; x < r; x++) {
                let c = x === l ? light(stone, 0.25) : x >= r - 1 ? dark(stone, 0.35) : stone;
                if (PL.hash(B.seed, x, y) > 0.92) c = dark(c, 0.1);
                B.px(x, y, c);
            }
        }
        // Capstone: glowing cyan pyramid.
        const cx = Math.round(w / 2);
        for (let j = 0; j < q(19); j++) {
            const half = Math.round((q(W - 44) / 2) * (j / q(19)));
            for (let i = -half; i <= half; i++) {
                const c = i < 0 ? 0x5ae8ff : 0x22b8d8;
                B.px(cx + i, q(-45) + j, c);
                B.epx(cx + i, q(-45) + j, c);
            }
        }
        B.light(cx, q(-35), 0x22d3ee, 10, 'neon');
        // Pixel globe where the classic draws the 🌐 emoji.
        const gy = q(-18);
        B.ellipse(cx, gy, 2.4, 2.4, 0x2a6ac0);
        [
            [-1, -1],
            [0, -1],
            [1, 0],
            [-1, 1],
            [0, 0],
        ].forEach((p) => B.px(cx + p[0], gy + p[1], 0x3ab87a));
        // Digital screen at the classic rect (20, -10, w-40, 40) — counters draw over it.
        const sx = q(20);
        const sy = q(-10);
        const sw = q(W - 40);
        const sh = q(40);
        B.rect(sx, sy, sw, sh, 0x050510);
        B.rect(sx + 1, sy + 1, sw - 2, sh - 2, 0x0a0a20);
        K.neonBox(B, sx, sy, sw, sh, 0x22d3ee);
        for (let y = sy + 2; y < sy + sh - 1; y += 2)
            for (let x = sx + 1; x < sx + sw - 1; x++) B.epx(x, y, 0x0a1428, 200);
        // Light rings down the obelisk.
        [
            [35, 22, 0.55],
            [55, 20, 0.4],
            [H - 25, 18, 0.3],
        ].forEach(([y, inset, a]) => {
            for (let x = q(inset); x < q(W - inset); x++) {
                B.px(x, q(y), mix(stone, 0x22d3ee, a));
                B.epx(x, q(y), 0x22d3ee, Math.round(a * 255));
            }
        });
    };

    // ── Leaderboard Monument (id 'park') — lawn, lookout frame, slide, monolith ──
    D.park = function (B, b, w, h) {
        const W = b.w;
        // Lawn.
        for (let x = 0; x < w; x++)
            for (let y = h - 4; y < h; y++)
                B.px(
                    x,
                    y,
                    PL.dpick([0x2d6a4f, 0x3d7a5f, 0x4a8a64], y === h - 4 ? 0.9 : PL.hash(B.seed, x, y), x, y)
                );
        // A-frame lookout (left).
        B.line(q(14), h - 4, q(22), q(h * 3 - 42), 0x6a6a74);
        B.line(q(30), h - 4, q(22), q(h * 3 - 42), 0x6a6a74);
        B.rect(q(18), q(h * 3 - 40), 3, 1, 0x7a7a84);
        B.rect(q(17), q(h * 3 - 22), 4, 1, 0x8b5cf6);
        // Playground: ladder tower + cyan slide (right).
        const lx = q(W - 55);
        B.rect(lx, h - 14, 1, 10, 0x55555f);
        B.rect(lx + 3, h - 14, 1, 10, 0x55555f);
        for (let y = h - 12; y < h - 4; y += 3) B.rect(lx, y, 4, 1, 0x6a6a74);
        B.rect(lx, h - 15, 5, 1, 0x55555f);
        B.line(lx + 4, h - 14, q(W - 18), h - 5, 0x22d3ee);
        B.line(lx + 4, h - 13, q(W - 18), h - 4, 0x0ea5c8);
        B.rect(q(W - 20), h - 5, 2, 1, 0x22d3ee);
        // Central monolith (60 × 80 world) with cyan light strip and gold base band.
        const mw = q(60);
        const mh = q(80);
        const mx = Math.round(w / 2 - mw / 2);
        K.wall(B, mx, h - mh, mw, mh, 0x2a2a44, 'stone');
        B.rect(mx + 1, h - mh + 1, mw - 2, mh - 2, 0x34344e);
        for (let y = h - mh + 3; y < h - 3; y++)
            (B.px(Math.round(w / 2), y, 0x22d3ee), B.epx(Math.round(w / 2), y, 0x5ae8ff));
        B.rect(mx - 1, h - 5, mw + 2, 1, 0xfacc15);
        B.erect(mx - 1, h - 5, mw + 2, 1, 0xffe07a, 180);
        // Floating rings + a pixel trophy (the classic 🏆).
        const ry = h - mh;
        for (let i = -10; i <= 10; i++) {
            const y1 = Math.round(ry - 3 + Math.sin((i / 10) * Math.PI * 0.5 + Math.PI / 2) * -1.4);
            (B.px(Math.round(w / 2) + i, y1, 0xfacc15), B.epx(Math.round(w / 2) + i, y1, 0xffe07a, 170));
        }
        for (let i = -6; i <= 6; i++)
            (B.px(Math.round(w / 2) + i, ry - 7, 0x22d3ee),
                B.epx(Math.round(w / 2) + i, ry - 7, 0x5ae8ff, 170));
        const tx = Math.round(w / 2);
        const ty = ry - 13;
        [
            [-2, 0],
            [-1, 0],
            [0, 0],
            [1, 0],
            [2, 0],
            [-2, 1],
            [-1, 1],
            [0, 1],
            [1, 1],
            [2, 1],
            [-1, 2],
            [0, 2],
            [1, 2],
            [0, 3],
            [-1, 4],
            [0, 4],
            [1, 4],
            [-3, 0],
            [3, 0],
            [-3, 1],
            [3, 1],
        ].forEach((p) => {
            const c = p[0] < 0 ? 0xffe07a : 0xe0a820;
            B.px(tx + p[0], ty + p[1], c);
            B.epx(tx + p[0], ty + p[1], c, 200);
        });
        B.light(tx, ty + 2, 0xfacc15, 12, 'neon');
    };

    // ── Global AI Index — billboard on a steel mast; live scores draw on the screen ──
    D.ai_index = function (B, b, w, h) {
        const W = b.w;
        const cx = Math.round(w / 2);
        B.rect(cx - 1, h - 5, 3, 5, 0x3a3a4a);
        B.rect(cx - 2, h - 6, 5, 1, 0x4a4a5a);
        B.rect(q(W / 2 - 20), h - 7, q(40), 1, 0x333344);
        B.rect(cx - 1, q(h * 3 - 80), 2, q(66), 0x333344);
        // Screen at the classic rect (b._screenX…) — AIIndex.updateBillboard draws over it.
        const X = b._screenX !== undefined ? b._screenX : 10;
        const Y = b._screenY !== undefined ? b._screenY : h * 3 - 82;
        const SW = b._screenW !== undefined ? b._screenW : W - 20;
        const SH = b._screenH !== undefined ? b._screenH : 65;
        const sx = q(X);
        const sy = q(Y);
        const sw = q(SW);
        const sh = q(SH);
        B.rect(sx - 1, sy - 1, sw + 2, sh + 2, 0x1a1a2e);
        B.rect(sx - 1, sy - 1, sw + 2, 1, 0x3a3a5a);
        for (let y = sy; y < sy + sh; y++)
            for (let x = sx; x < sx + sw; x++) {
                const c = (y - sy) % 3 === 2 ? 0x0e0e1c : 0x0a0a18;
                B.px(x, y, c);
                B.epx(x, y, (y - sy) % 3 === 2 ? 0x0c1024 : 0x0a0e1e, 220);
            }
        // Spotlights over the board.
        for (let i = 0; i < 3; i++) {
            const lx = sx + Math.round(((i + 0.5) * sw) / 3);
            B.rect(lx - 1, sy - 3, 2, 1, 0x2a2c34);
            B.epx(lx - 1, sy - 3, 0xfff4d0);
            B.light(lx, sy, 0xfff0c8, 10, 'spot');
        }
        B.rect(0, h - 1, w, 1, 0x2a2a3a);
    };

    // ── Central Park — trees, fountain, pond, benches, lamps at the classic spots ──
    D.city_park = function (B, b, w, h) {
        const W = b.w;
        const H = h * 3;
        // Grass with a lighter stripe and texture.
        for (let x = 0; x < w; x++)
            for (let y = h - 5; y < h; y++) {
                let c = PL.dpick(
                    [0x2d6a4f, 0x357a56, 0x408a63],
                    PL.hash(B.seed, x, y) * 0.8 + (y === h - 5 ? 0.3 : 0),
                    x,
                    y
                );
                B.px(x, y, c);
            }
        // Cobblestone path + two diagonal jogging paths.
        const pathY = q(H - 8);
        for (let x = q(20); x < q(W - 20); x++)
            (B.px(x, pathY, x % 2 ? 0x9a9588 : 0x8b8678), B.px(x, pathY + 1, 0x7a7668));
        for (let s = 0; s < 12; s++) B.rect(q(30 + s * 8), q(H - 30 + s * 1.5), 2, 1, 0x7a7668);
        for (let s = 0; s < 12; s++) B.rect(q(W / 2 + 20 + s * 8), q(H - 22 + s * 1.2), 2, 1, 0x7a7668);
        // Flower beds.
        const fc = [0xff6b8a, 0xffaa44, 0xff55cc, 0xffdd44, 0xaa88ff];
        for (let fi = 0; fi < 18; fi++) {
            const fx = 40 + fi * 25 + ((fi * 17) % 8);
            if (Math.abs(fx - W / 2) < 38 || fx > W - 10) continue;
            const fy = H - 12 - ((fi * 13) % 6);
            B.px(q(fx), q(fy), fc[fi % 5]);
            B.px(q(fx), q(fy) + 1, 0x2d8a4f);
        }
        // Trees at the classic positions (oak / maple) — birds perch on these.
        const trees = [
            { x: 25, type: 'oak' },
            { x: 70, type: 'maple' },
            { x: 135, type: 'oak' },
            { x: W - 130, type: 'maple' },
            { x: W - 70, type: 'oak' },
            { x: W - 25, type: 'maple' },
        ];
        trees.forEach((t, i) => {
            const pal = t.type === 'oak' ? PL.S.LEAF.green : PL.S.LEAF.deep;
            K.tree(B, q(t.x), h - 4, t.type === 'oak' ? 7 : 6, i === 1 || i === 3 ? PL.S.LEAF.blossom : pal, {
                trunk: t.type === 'oak' ? 7 : 8,
            });
        });
        // Central fountain (basin, pedestal, bowl) — the live spray sits on the bowl.
        const fx = Math.round(w / 2);
        const fy = q(H - 16);
        B.ellipse(fx, fy, 10.5, 2.6, 0x2a4a6a);
        B.ellipse(fx, fy, 9, 2, 0x3a6a8a);
        B.rect(fx - 4, fy - 1, 4, 1, 0x60a0c8);
        B.rect(fx - 1, fy - 7, 3, 5, 0x6a6a7a);
        B.rect(fx - 2, fy - 8, 5, 1, 0x7a7a8a);
        B.rect(fx - 3, fy - 8, 7, 1, 0x8a8a9a);
        // Small pond with cattails (right).
        const px = q(W - 55);
        const py = q(H - 12);
        B.ellipse(px, py, 7.2, 2, 0x1a3a5a);
        B.rect(px - 3, py - 1, 4, 1, 0x3a6a8a);
        B.rect(px + 5, py - 5, 1, 4, 0x4a5a3a);
        B.px(px + 5, py - 6, 0x6a5a3a);
        B.rect(px + 6, py - 4, 1, 3, 0x4a5a3a);
        B.px(px + 6, py - 5, 0x6a5a3a);
        // Benches.
        [100, W / 2 - 60, W / 2 + 50, W - 100].forEach((bx) => {
            const x = q(bx) - 3;
            B.rect(x, q(H - 20), 6, 1, 0x7a5c3d);
            B.rect(x, q(H - 16), 7, 1, 0x8b6b4a);
            (B.px(x, q(H - 15), 0x5c4033), B.px(x + 6, q(H - 15), 0x5c4033));
        });
        // Lamp posts at b._lamps (CityPark's night glows hang on these).
        const lamps = b._lamps || [55, W / 2 - 80, W / 2 + 80, W - 55].map((x) => ({ x: x, y: H - 42 }));
        lamps.forEach((l) => {
            const x = q(l.x);
            B.rect(x, q(H - 38), 1, 9, 0x3a3a4a);
            B.rect(x - 1, q(H - 40), 3, 1, 0x4a4a5a);
            B.erect(x - 1, q(H - 40) + 1, 3, 1, 0xffd88a);
            B.light(x, q(H - 40) + 1, 0xffd88a, 8, 'lamp');
        });
        // Picket fences at both entrances.
        for (let x = 0; x < q(18); x += 2) B.rect(x, h - 5, 1, 2, 0xd4c9a8);
        B.rect(0, h - 5, q(18), 1, 0xc4b998);
        for (let x = q(W - 18); x < w; x += 2) B.rect(x, h - 5, 1, 2, 0xd4c9a8);
        B.rect(q(W - 18), h - 5, q(18), 1, 0xc4b998);
    };

    // ── Memorial Park — one headstone per retired model, at b._headstones ──────
    D.graveyard = function (B, b, w, h) {
        const W = b.w;
        const H = h * 3;
        // Dark earth + stone path.
        for (let x = 0; x < w; x++)
            for (let y = h - 5; y < h; y++)
                B.px(
                    x,
                    y,
                    PL.dpick(
                        [0x14141c, 0x1c1c28, 0x24243a],
                        y === h - 5 ? 0.9 : PL.hash(B.seed, x, y) * 0.6,
                        x,
                        y
                    )
                );
        for (let x = q(10); x < q(W - 10); x++) B.px(x, q(H - 8), x % 3 ? 0x333344 : 0x2a2a3a);
        // Wrought iron fence: end posts, posts every 20 world px, two rails.
        B.rect(0, q(H - 30), 1, 7, 0x3a3a4a);
        B.rect(w - 1, q(H - 30), 1, 7, 0x3a3a4a);
        for (let fx = 20; fx < W; fx += 20)
            (B.rect(q(fx), q(H - 28), 1, 6, 0x3a3a4a), B.px(q(fx), q(H - 28) - 1, 0x4a4a5a));
        B.rect(0, q(H - 26), w, 1, 0x2e2e3e);
        B.rect(0, q(H - 18), w, 1, 0x2e2e3e);
        // Willow trees (left and right).
        [14, W - 14].forEach((wx) => {
            const x = q(wx);
            B.rect(x, q(H - 55), 1, q(43), 0x2a2218);
            B.px(x + 1, q(H - 50), 0x2a2218);
            for (let j = 0; j < 4; j++)
                for (let i = -6; i <= 6; i++) {
                    if (Math.abs(i) > 6 - j) continue;
                    B.px(
                        x + i,
                        q(H - 55) - 1 + j,
                        PL.dpick([0x14331f, 0x1b4332, 0x2a5a3a], 0.6 - j * 0.1, x + i, j)
                    );
                }
            for (let br = -3; br <= 3; br++) {
                const bx = x + br * 2;
                const len = 5 + Math.abs(br) + (br & 1);
                for (let j = 0; j < len; j++)
                    if (PL.bayer(bx, j) < 0.85) B.px(bx, q(H - 52) + j, j > len - 2 ? 0x2a6a3a : 0x1b4332);
            }
        });
        // Eternal flame pedestal (the animated flame itself is the live b._flame).
        const cx = Math.round(w / 2);
        B.rect(cx - 2, q(H - 22), 4, 3, 0x33334a);
        B.rect(cx - 3, q(H - 24), 6, 1, 0x4a4a5e);
        // Headstones — one per retired model, lab-coloured accent.
        const stones =
            b._headstones ||
            Array.from({ length: Math.min(6, Math.floor((W - 60) / 22)) }, (_, si) => ({
                x: 30 + si * 22,
                y: 0,
                w: 16,
                h: 16 + (si % 3) * 6,
                model: null,
            }));
        stones.forEach((st) => {
            const x = q(st.x);
            const sh = q(st.h);
            const top = q(H - 14) - sh;
            const lc =
                st.model && typeof LABS !== 'undefined' && LABS[st.model.lab]
                    ? PL.hex(LABS[st.model.lab].color)
                    : 0x666688;
            for (let j = 0; j < sh; j++)
                for (let i = 0; i < 5; i++) {
                    if (j === 0 && (i === 0 || i === 4)) continue;
                    let c = i === 0 ? 0x6a6a7e : i === 4 ? 0x3a3a4a : 0x55556a;
                    if (PL.hash(B.seed, x + i, j) > 0.88) c = mix(c, 0x4a6a4a, 0.35);
                    B.px(x + i, top + j, c);
                }
            B.px(x + 2, top + 1, lc);
            B.px(x + 2, top + 2, lc);
            B.px(x + 1, top + 2, dark(lc, 0.2));
            B.px(x + 3, top + 2, dark(lc, 0.2));
            if (sh > 5) B.rect(x + 1, top + 4, 3, 1, 0x8888aa);
            if (sh > 7) B.rect(x + 1, top + 6, 2, 1, 0x7a7a98);
        });
        // Low ground mist.
        for (let x = 0; x < w; x++)
            if (PL.bayer(x, 1) < 0.35) B.px(x, h - 6 + (x % 3 === 0 ? -1 : 0), 0x5a5a78, 90);
    };
    // The bake cache must see the headstone set, or a newly retired model would not appear.
    PL.dataKey = function (b) {
        if (b.id === 'graveyard' && b._headstones)
            return b._headstones.map((s) => (s.model ? s.model.lab : '') + s.h).join(',');
        return '';
    };

    // ── Housing towers: add the classic sector rooftop gardens ──────────────
    const resBase = D['pre:res'];
    D['pre:res'] = function (B, b, w, h) {
        resBase(B, b, w, h);
        const W = b.w;
        [
            [10, 50],
            [W - 50, W - 10],
        ].forEach(([x0, x1]) => {
            const x = q(x0);
            const xw = q(x1 - x0);
            B.rect(x, -3, xw, 3, 0x2a2a34);
            B.rect(x, -3, xw, 1, 0x4a4a54);
            const cx = x + Math.round(xw / 2);
            if (b.id === 'res_cn') K.tree(B, cx, -3, 5, PL.S.LEAF.blossom, { trunk: 3 });
            else if (b.id === 'res_us') K.pine(B, cx, -3, 14);
            else K.tree(B, cx, -3, 5, PL.S.LEAF.green, { trunk: 3 });
        });
    };
})();
