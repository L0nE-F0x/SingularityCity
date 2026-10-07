/* Pixel art — the port, transliterated from the port_ branch of buildBuildings().
   The crane's trolley, cable, hook and lifted container stay PortEnv's live drawing
   (it runs along the main beam at world y = 28 + floors·18 − 76); ships, ocean life
   and the harbour are separate systems. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    function win(B, x, y, w, h, lit, col) {
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                B.px(x + i, y + j, PL.dpick([0x7a98b4, 0x3e5670], j / Math.max(1, h - 1), x + i, y + j));
                if (lit) B.epx(x + i, y + j, j === 0 ? light(col, 0.25) : col);
            }
    }

    // ── Port Authority: maritime tower, orange harbour band, radar, flags ───
    D.port_authority = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        K.wall(B, 0, 0, w, h, 0x2e4058, 'concrete', { seams: false });
        B.rect(0, 0, q(8), h, 0x364e66);
        B.rect(w - q(8), 0, q(8), h, 0x2a3a50);
        B.rect(-1, -1, w + 2, 3, 0x3a5868);
        B.rect(-1, -1, w + 2, 1, 0x5a7888);
        B.rect(0, q(8), w, 1, 0xf97316);
        // Top-floor harbour-control glazing.
        for (let x = q(12); x < w - q(12); x++)
            (B.px(x, q(14), 0x3a8aa0),
                B.px(x, q(14) + 1, 0x2a6a80),
                B.px(x, q(14) + 2, 0x2a6a80),
                B.epx(x, q(14), 0x9af0ff, 200),
                B.epx(x, q(14) + 1, 0x5ad0e8, 180),
                B.epx(x, q(14) + 2, 0x5ad0e8, 180));
        // Office windows.
        for (let fy = 16 + 18; fy < H - 12; fy += 18)
            for (let fx = 16; fx < W - 16; fx += 20)
                win(B, q(fx), q(fy), 4, 3, PL.labNoise(fx * 7 + fy) < 0.7, 0xffd98a);
        // Door.
        B.rect(Math.round(w / 2) - 3, h - 5, 7, 5, 0x0a1628);
        B.rect(Math.round(w / 2) - 3, h - 5, 7, 1, 0x22d3ee);
        B.erect(Math.round(w / 2) - 2, h - 4, 5, 4, 0x9af0ff, 150);
        B.light(w / 2, h, 0x9af0ff, 10, 'door');
        // Radar mast with dish and beacon; signal-flag halyard.
        const cx = Math.round(w / 2);
        B.rect(cx, -7, 1, 6, 0x94a3b8);
        for (let i = -3; i <= 3; i++) B.px(cx + i, -6 - (3 - Math.abs(i)) / 2, 0xe2e8f0);
        B.px(cx, -9, 0xef4444);
        B.blink(cx, -9, 0xff4050, 1.5, 0.2);
        B.rect(w - q(18), -5, 1, 5, 0x64748b);
        B.rect(w - q(24), -5, 2, 2, 0xef4444);
        B.rect(w - q(24), -3, 2, 2, 0xfbbf24);
        // Quay bollards and a pixel anchor where the classic draws ⚓.
        B.rect(q(6), h - 2, 2, 2, 0x334155);
        B.rect(w - q(11), h - 2, 2, 2, 0x334155);
        const ay = q(-32);
        [
            [0, -3],
            [-1, -2],
            [1, -2],
            [0, -2],
            [0, -1],
            [0, 0],
            [0, 1],
            [-2, 1],
            [2, 1],
            [-2, 0],
            [2, 0],
            [-1, 2],
            [1, 2],
            [-2, -1],
            [2, -1],
        ].forEach((p) => B.px(cx + p[0], ay + p[1], 0xc8d8e8));
    };

    // ── Export Control Office: federal navy, portico, gold seal, barrier ────
    D.port_customs = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        const bw = w - q(26);
        K.wall(B, 0, 0, bw, h, 0x26385c, 'stone');
        B.rect(0, 0, q(6), h, 0x2e4468);
        B.rect(bw - q(6), 0, q(6), h, 0x2e4468);
        B.rect(-1, -1, bw + 2, 2, 0xe5e7eb);
        // Lit paperwork windows.
        for (let fy = 10; fy < H - 32; fy += 16)
            for (let fx = 14; fx < W - 42; fx += 18) win(B, q(fx), q(fy), 4, 3, true, 0xfef3c7);
        // Gold department seal.
        const sx = Math.round(bw / 2);
        const sy = Math.round(h * 0.42);
        B.ellipse(sx, sy, 2.6, 2.6, 0xca8a04);
        B.ellipse(sx, sy, 1.8, 1.8, 0x26385c);
        (B.px(sx, sy - 1, 0xfbbf24),
            B.px(sx - 1, sy + 1, 0xfbbf24),
            B.px(sx + 1, sy + 1, 0xfbbf24),
            B.px(sx, sy, 0xfbbf24));
        // Portico columns over the entrance.
        B.rect(q(8), h - q(28), bw - q(16), 1, 0xd1d5db);
        for (let cx = 12; cx < W - 38; cx += 18)
            (B.rect(q(cx), h - q(26), 1, q(26), 0xe5e7eb), B.px(q(cx) + 1, h - q(26), 0xb8bec6));
        B.erect(q(12) + 2, h - 5, bw - q(24), 4, 0xfff0c8, 110);
        // Inspection lane, booth post and the striped barrier arm.
        const lx = w - q(24);
        B.rect(lx, h - 2, q(24), 2, 0x374151);
        B.rect(w - q(22), h - 6, 2, 4, 0x4b5563);
        for (let i = 0; i < 6; i++) B.px(w - q(18) + i, h - 6, i % 2 ? 0xffffff : 0xef4444);
        B.px(w - q(19.5), h - 7, 0xef4444);
        B.blink(w - q(19.5), h - 7, 0xef4444, 1.2, 0);
    };

    // ── GPU Warehouse: corrugated hall, skylight, bay doors, guard booth ────
    D.port_warehouse = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        K.wall(B, 0, 2, w, h - 2, 0x34445c, 'corrugated');
        B.rect(0, 2, w, q(10), 0x3a4a60);
        for (let x = 0; x < w; x++)
            (B.px(x, 0, x % 3 ? 0x475569 : 0x5a6878), B.px(x, 1, x % 3 ? 0x3a4a5c : 0x475569));
        for (let x = q(20); x < q(W - 70); x++) (B.px(x, 1, 0x5aa8c8), B.epx(x, 1, 0x7ad8ff, 140));
        [W - 52, W - 30].forEach((x) => K.ac(B, q(x), 0, 5));
        // GPU crate stencil on the wall.
        const cx = Math.round(w / 2);
        B.rect(cx - q(26), q(16), q(52), q(14), mix(0x34445c, 0x76b900, 0.25));
        B.rect(cx - q(26), q(16), q(52), 1, 0x76b900);
        PL.text(B.base, 'GPU', B.X(cx - 5), B.Y(q(16) + 1), mix(0x34445c, 0x76b900, 0.7), 3);
        // Loading bay doors with status lights.
        let i = 0;
        for (let dx = 15; dx < W - 30; dx += 50, i++) {
            const x = q(dx);
            B.rect(x, h - q(30), q(35), q(30), 0x0e1a2e);
            for (let y = h - q(30) + 1; y < h; y += 3) B.rect(x, y, q(35), 1, mix(0x0e1a2e, 0xf59e0b, 0.25));
            const c = i % 2 === 0 ? 0x4ade80 : 0xf59e0b;
            B.px(x + q(32), h - q(32), c);
            B.epx(x + q(32), h - q(32), c);
            B.erect(x + 1, h - 1, q(35) - 2, 1, 0xffd88a, 180);
        }
        // Guard booth with a lit window, and a camera.
        B.rect(w - q(16), h - q(18), q(14), q(18), 0x334155);
        B.rect(w - q(13), h - q(15), 3, 2, 0xfef3c7);
        B.erect(w - q(13), h - q(15), 3, 2, 0xfff0c0);
        B.rect(0, 2, 2, 1, 0x94a3b8);
        B.px(1, 3, 0x1f2937);
        B.blink(1, 2, 0xef4444, 2.2, 0.4);
        B.rect(0, h - 1, w, 1, mix(0x34445c, 0x76b900, 0.5));
    };

    // ── Container Terminal: brand-colour stacks, reach stacker, floodlight ──
    D.port_container = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        B.rect(0, h - 3, w, 3, 0x2b3646);
        for (let x = 1; x < w; x += q(22)) B.rect(x, h - 2, 4, 1, mix(0x2b3646, 0xfbbf24, 0.4));
        const stacks = [
            [0x76b900, 0x3b82f6, 0xf59e0b],
            [0xef4444, 0x76b900, 0x22d3ee],
            [0xf59e0b, 0xa855f7, 0x76b900],
            [0x3b82f6, 0xef4444, 0xf59e0b],
        ];
        stacks.forEach((st, si) => {
            const sx = q(8 + si * 34);
            st.forEach((c, r) => {
                const y = q(H - 22 - r * 14);
                B.rect(sx, y, 10, 4, c);
                B.rect(sx, y, 10, 1, light(c, 0.25));
                for (let x = sx + 1; x < sx + 10; x += 2) B.rect(x, y + 1, 1, 3, dark(c, 0.2));
            });
        });
        // Reach stacker lifting a container.
        const rs = q(W - 20);
        B.rect(rs - 5, h - 6, 7, 3, 0xfbbf24);
        B.ellipse(rs - 3, h - 2, 1.3, 1.3, 0x1f2937);
        B.ellipse(rs + 1, h - 2, 1.3, 1.3, 0x1f2937);
        B.rect(rs - 4, h - 9, 2, 3, 0x475569);
        B.px(rs - 4, h - 8, 0xfef3c7);
        B.line(rs - 1, h - 5, rs + 5, h - 11, 0x94a3b8);
        B.rect(rs + 3, h - 11, 6, 3, 0x76b900);
        B.rect(rs + 3, h - 11, 6, 1, light(0x76b900, 0.2));
        // Floodlight mast with its light cone.
        B.rect(0, q(H - 52), 1, q(44), 0x64748b);
        B.rect(-1, q(H - 56), 4, 1, 0x64748b);
        B.erect(-1, q(H - 56) + 1, 4, 1, 0xfef3c7);
        B.light(1, q(H - 52), 0xfff0c8, 14, 'spot');
    };

    // ── Fuel & Gas Depot: cryogenic helium sphere, diesel tank, manifold ───
    D.port_fuel = function (B, b, w, h) {
        const H = h * PL.ART;
        B.rect(0, h - 3, w, 3, 0x2a3446);
        const spx = q(30);
        const spy = q(H - 34);
        B.rect(spx - 5, h - 5, 1, 3, 0x334155);
        B.rect(spx + 4, h - 5, 1, 3, 0x334155);
        for (let j = -7; j <= 7; j++)
            for (let i = -7; i <= 7; i++) {
                const d = Math.hypot(i, j);
                if (d > 7.3) continue;
                const lit = (-i - j) / 10;
                B.px(spx + i, spy + j, PL.dpick([0xc8d0da, 0xf1f5f9, 0xffffff], 0.5 + lit, spx + i, spy + j));
            }
        for (let i = -4; i <= 4; i++) B.px(spx + i, spy - 5, 0xdbeafe);
        B.rect(spx - 7, spy, 14, 1, 0x1d4ed8);
        B.px(spx - 8, spy - 6, 0xe8f0ff, 160);
        B.px(spx - 9, spy - 4, 0xe8f0ff, 120);
        // Horizontal diesel tank on saddles.
        const tx = q(62);
        const ty = q(H - 30);
        for (let j = 0; j < 7; j++)
            for (let i = 0; i < 17; i++) {
                if ((i === 0 || i === 16) && (j === 0 || j === 6)) continue;
                B.px(tx + i, ty + j, j < 2 ? 0x9ca3af : j > 4 ? 0x4b5563 : 0x6b7280);
            }
        B.rect(q(68), h - 4, 2, 1, 0x334155);
        B.rect(q(100), h - 4, 2, 1, 0x334155);
        const hd = q(87);
        [
            [0, -2],
            [-1, -1],
            [1, -1],
            [-2, 0],
            [2, 0],
            [-1, 1],
            [1, 1],
            [0, 2],
            [0, 0],
            [0, -1],
        ].forEach((p) => B.px(hd + p[0], q(H - 22) + p[1], p[0] === 0 && p[1] <= 0 ? 0xffffff : 0xef4444));
        // Manifold pipes, a valve, and hazard stripes.
        B.rect(spx + 7, h - 5, q(44), 1, 0x475569);
        B.rect(q(56), q(H - 19), 1, 3, 0x374151);
        B.px(q(58), q(H - 20), 0xef4444);
        for (let x = 0; x < w; x += q(12)) B.rect(x, h - 3, 2, 1, 0xfbbf24);
    };

    // ── Ship-to-shore gantry crane: legs, bracing, beam over the water, A-frame ─
    D.port_crane = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        const amber = 0xf59e0b;
        const Y = (v) => q(H - v);
        // Legs with cross-bracing.
        [10, W - 18].forEach((lx) => {
            for (let y = Y(78); y < Y(8); y++)
                (B.px(q(lx), y, light(amber, 0.1)),
                    B.px(q(lx) + 1, y, amber),
                    B.px(q(lx) + 2, y, dark(amber, 0.25)));
        });
        B.line(q(14), Y(14), q(W - 14), Y(44), 0xd97706);
        B.line(q(W - 14), Y(14), q(14), Y(44), 0xd97706);
        B.line(q(14), Y(44), q(W - 14), Y(72), 0xd97706);
        // Main beam, reaching over the water on the left (the trolley's track).
        B.rect(q(-26), Y(78), q(W + 26), 2, amber);
        B.rect(q(-26), Y(78), q(W + 26), 1, light(amber, 0.3));
        B.rect(q(-26), Y(71), q(W + 26), 1, 0xfbbf24);
        // A-frame apex and the tie bars that hold the boom.
        for (let y = Y(100); y < Y(78); y++) {
            const t = (y - Y(100)) / (Y(78) - Y(100));
            const half = Math.round(1 + t * 1.6);
            for (let i = -half; i <= half; i++)
                B.px(Math.round(w / 2) + i, y, i > 0 ? dark(amber, 0.2) : amber);
        }
        B.line(Math.round(w / 2), Y(98), q(-22), Y(76), 0xd97706);
        B.line(Math.round(w / 2), Y(98), q(W - 6), Y(76), 0xd97706);
        B.px(Math.round(w / 2), Y(102), 0xef4444);
        B.blink(Math.round(w / 2), Y(102), 0xff4050, 1.3, 0);
        B.blink(q(-26), Y(78) - 1, 0xff4050, 1.3, 0.5);
        // Machinery house and the operator cab.
        B.rect(q(W - 34), Y(92), q(22), q(12), 0x475569);
        B.rect(q(W - 34), Y(92), q(22), 1, 0x5a6a7a);
        B.rect(q(4), Y(70), 4, 3, 0x334155);
        B.rect(q(6), Y(68), 2, 2, 0x38bdf8);
        B.erect(q(6), Y(68), 2, 2, 0x9ae0ff);
        B.light(q(8), Y(70), 0xfff0c8, 12, 'spot');
    };
})();
