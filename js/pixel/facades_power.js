/* Pixel art — the Power zone, transliterated from the power_ branch of buildBuildings().
   Live parts stay classic objects and are pixelised in place by PixelArt: the turbine
   blades PowerEnv spins, the Polaris plasma halo it pulses, steam and exhaust plumes. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    function pad(B, w, h, col, top) {
        for (let x = 0; x < w; x++)
            for (let y = h - top; y < h; y++)
                B.px(
                    x,
                    y,
                    PL.dpick(
                        [dark(col, 0.2), col, light(col, 0.12)],
                        y === h - top ? 0.9 : PL.hash(B.seed, x, y) * 0.7,
                        x,
                        y
                    )
                );
    }
    // Filled polygon in art px (convex or simple), used for dams and cooling towers.
    function poly(B, pts, colFn) {
        let y0 = Infinity;
        let y1 = -Infinity;
        pts.forEach((p) => ((y0 = Math.min(y0, p[1])), (y1 = Math.max(y1, p[1]))));
        for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
            const xs = [];
            for (let i = 0; i < pts.length; i++) {
                const a = pts[i];
                const b = pts[(i + 1) % pts.length];
                if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y))
                    xs.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
            }
            xs.sort((m, n) => m - n);
            for (let k = 0; k + 1 < xs.length; k += 2)
                for (let x = Math.round(xs[k]); x < Math.round(xs[k + 1]); x++)
                    B.px(x, y, colFn(x, y, xs[k], xs[k + 1]));
        }
    }

    // ── Solar + Storage: sun-tracking panel rows, Megapacks, inverter shed ──
    D.power_solar = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        pad(B, w, h, 0x3a3a2c, q(10));
        for (let x = 1; x < w; x += q(16)) B.rect(x, h - 5, 1, 2, 0x6b7280);
        B.rect(0, h - 5, w, 1, 0x5a6270);
        // Two battery containers with vents and a charge LED.
        for (let bi = 0; bi < 2; bi++) {
            const x = q(W - 78 + bi * 30);
            B.rect(x, h - 11, 9, 8, 0xe5e7eb);
            B.rect(x, h - 11, 9, 1, 0xf4f6f8);
            B.rect(x + 8, h - 11, 1, 8, 0xb8bec6);
            for (let y = h - 9; y < h - 4; y += 2) B.rect(x + 1, y, 6, 1, 0xaab2bc);
            B.px(x + 7, h - 10, 0x2a8a4a);
            B.epx(x + 7, h - 10, 0x4ade80);
        }
        // Inverter shed with a cyan status window.
        const sx = q(W - 40);
        B.rect(sx, h - 17, 11, 6, 0x475569);
        B.rect(sx, h - 18, 11, 1, 0x334155);
        B.rect(sx + 2, h - 16, 3, 2, 0x22d3ee);
        B.erect(sx + 2, h - 16, 3, 2, 0x7ae8ff);
        // Panel rows, tilted toward the sun as the classic does at build time.
        const dp = typeof G !== 'undefined' && G.getDayPhase ? G.getDayPhase() : 0.5;
        const tilt = dp < 0.25 || dp > 0.83 ? 0 : Math.sin(((dp - 0.25) / 0.58) * Math.PI) * 0.4;
        for (let px = 8; px < W - 90; px += 32) {
            const x = q(px);
            B.rect(x + 4, q(H - 38), 1, q(28), 0x64748b);
            B.rect(x + 1, q(H - 38), 7, 1, 0x64748b);
            const py = q(H - 44 - tilt * 8);
            B.rect(x, py, 9, 3, 0x1e3a8a);
            B.rect(x, py, 9, 1, 0x3b82f6);
            for (let i = 0; i < 9; i++) if (i !== 4) B.px(x + i, py + 1, 0x2563eb);
            B.px(x + 1 + Math.round(tilt * 10), py + 1, 0xbfdcff);
        }
    };

    // ── SunZia Wind: ridge, control cabin, three towers ─────────────────────
    // PowerEnv spins its blades at groundY − 72; the nacelle sits there so blades and
    // tower meet (the classic drew the nacelle 24 world px higher than the blades turn).
    PL.WIND_HUB_Y = (h) => h - q(48);
    D.power_wind = function (B, b, w, h) {
        pad(B, w, h, 0x2a2a20, q(10));
        for (let x = 0; x < w; x++)
            B.px(x, h - 4, PL.dpick([0x2d4a2d, 0x3a5c3a], PL.hash(B.seed, x, 1), x, 1));
        for (let x = 2; x < w; x += q(14)) B.px(x, h - 5, 0x3a5c3a);
        // Control cabin.
        B.rect(q(5), h - 9, 8, 5, 0x475569);
        B.rect(q(5), h - 10, 8, 1, 0x334155);
        B.rect(q(10), h - 8, 3, 2, 0x22d3ee);
        B.erect(q(10), h - 8, 3, 2, 0x7ae8ff);
        const hub = PL.WIND_HUB_Y(h);
        for (let ti = 0; ti < 3; ti++) {
            const tx = q(40 + ti * 45);
            B.rect(tx - 2, h - 4, 5, 1, 0x94a3b8);
            for (let y = hub; y < h - 3; y++) {
                const t = (y - hub) / (h - 3 - hub);
                const half = t > 0.55 ? 1 : 0;
                B.px(tx, y, 0xf1f5f9);
                if (half) (B.px(tx - 1, y, 0xf8fafc), B.px(tx + 1, y, 0xcbd5e1));
                else B.px(tx + 1, y, 0xcbd5e1);
            }
            B.rect(tx, h - 6, 1, 2, 0x475569);
            // Nacelle, hub cap and the red aviation beacon.
            B.rect(tx - 2, hub - 1, 5, 2, 0xe2e8f0);
            B.rect(tx - 2, hub, 5, 1, 0xb6c2ce);
            B.px(tx, hub, 0x94a3b8);
            B.px(tx, hub - 2, 0xef4444);
            B.blink(tx, hub - 2, 0xff4050, 1.8, ti * 0.3);
        }
    };

    // ── Crane Clean Energy Center: twin cooling towers, dome, turbine hall ──
    D.power_nuclear = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        pad(B, w, h, 0x6b7280, q(8));
        [26, 78].forEach((cx) => {
            const X = (v) => q(cx + v);
            const Y = (v) => q(H - v);
            poly(
                B,
                [
                    [X(-22), Y(8)],
                    [X(-12), Y(62)],
                    [X(-15), Y(108)],
                    [X(15), Y(108)],
                    [X(12), Y(62)],
                    [X(22), Y(8)],
                ],
                (x, y, l, r) => {
                    const t = (x - l) / Math.max(1, r - l);
                    let c = PL.dpick([0xeef0f2, 0xd6d9dd, 0xb9bfc6, 0xaab2bb], t * 1.1, x, y);
                    if (y === Y(30) || y === Y(62) || y === Y(88)) c = dark(c, 0.08);
                    return c;
                }
            );
            B.rect(X(-15), Y(110), X(15) - X(-15), 1, 0x8d949c);
            B.rect(X(-12), Y(108), X(12) - X(-12), 1, 0x565e66);
        });
        // Containment dome over its block.
        const dcx = q(W - 42);
        B.rect(q(W - 66), q(H - 44), q(48), q(36), 0x565e66);
        K.dome(B, dcx, q(H - 44), 8, 0xc7ccd1, { ry: 8, lantern: false });
        // Turbine hall with cyan windows and the Microsoft accent line.
        B.rect(q(W - 78), q(H - 36), q(70), q(28), 0x334155);
        B.rect(q(W - 78), q(H - 38), q(70), 1, 0x475569);
        B.rect(q(W - 78), q(H - 40), q(70), 1, 0x0ea5e9);
        for (let wx = W - 72; wx < W - 14; wx += 15) {
            B.rect(q(wx), q(H - 30), 3, 3, 0x1e4a5a);
            B.erect(q(wx), q(H - 30), 3, 3, 0x7ae8ff, 200);
        }
        // Switchyard: transformer with three bushings, and the radiation placard.
        B.rect(q(104), h - 9, 6, 6, 0x374151);
        [106, 112, 118].forEach((x) => (B.rect(q(x), h - 11, 1, 2, 0x6b7280), B.px(q(x), h - 12, 0xe5e7eb)));
        B.rect(q(126), q(H - 22), 3, 3, 0xfbbf24);
        B.px(q(126) + 1, q(H - 22) + 1, 0x1f2937);
    };

    // ── Gas turbine array: four gensets with exhaust stacks, a substation ──
    D.power_coal = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        pad(B, w, h, 0x4b5563, q(8));
        for (let gi = 0; gi < 4; gi++) {
            const gx = 6 + gi * 30;
            B.rect(q(gx), q(H - 34), 3, q(26), 0x9ca3af);
            for (let y = q(H - 31); y < q(H - 12); y += 2) B.px(q(gx) + 1, y, 0x6b7280);
            B.rect(q(gx + 10), q(H - 26), 5, 6, 0xe5e7eb);
            B.rect(q(gx + 10), q(H - 26), 5, 1, 0xf3f4f6);
            B.rect(q(gx + 17), q(H - 58), 2, q(32), 0xb0b7bf);
            B.px(q(gx + 17) + 1, q(H - 58), 0x8a929b);
            for (let y = q(H - 58); y < q(H - 26); y++) B.px(q(gx + 17) + 1, y, 0x8a929b);
            B.rect(q(gx + 16), q(H - 62), 3, 2, 0x4b5563);
            B.blink(q(gx + 20.5), q(H - 63.5), 0xef4444, 2.2, gi * 0.2);
        }
        B.rect(q(W - 34), q(H - 30), 7, 7, 0x374151);
        B.rect(q(W - 34), q(H - 30), 7, 1, 0xfbbf24);
        [31, 24, 17].forEach((d) => B.rect(q(W - d), q(H - 36), 1, 2, 0x6b7280));
        for (let x = 0; x < w; x += q(14)) B.rect(x, h - 4, 2, 1, mix(0x4b5563, 0xfbbf24, 0.4));
    };

    // ── Columbia Hydro: stepped gravity dam with three spillways ────────────
    D.power_hydro = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        B.rect(0, q(H - 78), w, 2, 0x155e75);
        poly(
            B,
            [
                [q(5), q(H - 74)],
                [q(14), q(H - 52)],
                [q(20), q(H - 30)],
                [q(25), q(H - 8)],
                [q(W - 25), q(H - 8)],
                [q(W - 20), q(H - 30)],
                [q(W - 14), q(H - 52)],
                [q(W - 5), q(H - 74)],
            ],
            (x, y) => {
                let c = x > q(W * 0.64) ? 0x7d8896 : 0x9aa5b1;
                if ((x * PL.ART - 40) % 24 < 3 && x > q(40) && x < q(W - 40)) c = 0x6e7987;
                if ((y - q(H - 74)) % 5 === 4) c = dark(c, 0.08);
                return c;
            }
        );
        // Crest road with a railing, and the gantry crane.
        B.rect(1, q(H - 78), w - 2, 2, 0x64748b);
        for (let x = 2; x < w - 2; x += q(10)) B.px(x, q(H - 82), 0x94a3b8);
        B.rect(q(W * 0.3), q(H - 92), 1, q(14), 0xfbbf24);
        B.rect(q(W * 0.3) - 2, q(H - 92), 5, 1, 0xfbbf24);
        // Spillway gates, falling water and stilling-basin foam.
        [W * 0.32, W * 0.5, W * 0.68].forEach((sx) => {
            const x = q(sx);
            B.rect(x - 2, q(H - 68), 5, 3, 0x334155);
            for (let y = q(H - 60); y < q(H - 10); y++)
                for (let i = -2; i <= 2; i++)
                    B.px(
                        x + i,
                        y,
                        PL.dpick([0x4a90c8, 0x7dd3fc, 0xe0f2fe], ((y * 3 + i * 7) % 11) / 11, x + i, y)
                    );
            B.ellipse(x, q(H - 9), 3, 1.2, 0xf0f8ff);
        });
        // Powerhouse at the toe with lit windows.
        const px = Math.round(w / 2) - q(22);
        B.rect(px, q(H - 26), q(44), q(18), 0x475569);
        B.rect(px, q(H - 28), q(44), 1, 0x334155);
        [-16, -4, 8].forEach(
            (d) => (
                B.rect(Math.round(w / 2 + d / PL.ART), q(H - 21), 3, 2, 0x5a4a20),
                B.erect(Math.round(w / 2 + d / PL.ART), q(H - 21), 3, 2, 0xffd27a)
            )
        );
    };

    // ── Hermes 2 SMR: reactor hall, one domed module, one in scaffolding ───
    D.power_smr = function (B, b, w, h) {
        const H = h * PL.ART;
        pad(B, w, h, 0x8b7355, q(8));
        B.rect(1, h - 4, w - 2, 1, 0x6b7280);
        B.rect(q(10), q(H - 48), q(66), q(40), 0x334155);
        B.rect(q(10), q(H - 50), q(66), 1, 0x2dd4bf);
        for (let wx = 16; wx < 68; wx += 16)
            (B.rect(q(wx), q(H - 42), 3, 3, 0x1a4a48), B.erect(q(wx), q(H - 42), 3, 3, 0x7af0e0, 200));
        [
            [0x4285f4, 22],
            [0xea4335, 32],
            [0xfbbc05, 42],
            [0x34a853, 52],
        ].forEach(([c, x]) => B.px(q(x), q(H - 20), c));
        B.rect(q(86), q(H - 40), 6, q(32), 0xd1d5db);
        B.rect(q(99), q(H - 40), 1, q(32), 0x9ca3af);
        K.dome(B, q(95), q(H - 40), 3, 0xd1d5db, { ry: 3, lantern: false });
        // Scaffolding lattice for the second module.
        const sx = q(112);
        const sy = q(H - 38);
        const sw = 6;
        const sh = q(30);
        for (let i = 0; i < sw; i++)
            (B.px(sx + i, sy, 0xf59e0b),
                B.px(sx + i, sy + sh, 0xf59e0b),
                B.px(sx + i, sy + Math.round(sh / 2), 0xf59e0b));
        B.rect(sx, sy, 1, sh, 0xf59e0b);
        B.rect(sx + sw - 1, sy, 1, sh, 0xf59e0b);
        B.line(sx, sy, sx + sw - 1, sy + sh, 0xc07a10);
        B.line(sx + sw - 1, sy, sx, sy + sh, 0xc07a10);
        // Tower crane over the site.
        B.rect(q(120), q(H - 74), 1, q(66), 0xf59e0b);
        B.rect(q(96), q(H - 74), q(52), 1, 0xf59e0b);
        B.rect(q(142), q(H - 71), 1, 3, 0xd08a10);
        B.rect(q(103), q(H - 71), 1, q(16), 0x94a3b8);
        B.rect(q(100), q(H - 55), 3, 1, 0x6b7280);
        B.blink(q(121.5), q(H - 76), 0xef4444, 1.6, 0.4);
    };

    // ── Polaris Fusion: dark machine hall, capacitor banks, plasma porthole ─
    D.power_fusion = function (B, b, w, h) {
        const W = b.w;
        const H = h * PL.ART;
        pad(B, w, h, 0x1f2430, q(8));
        K.wall(B, q(8), q(H - 54), w - 2 * q(8), q(46), 0x2a3040, 'panel', { pitch: 8 });
        B.rect(q(8), q(H - 54), w - 2 * q(8), 1, 0x3a4458);
        B.rect(q(8), q(H - 56), w - 2 * q(8), 1, 0x8a5aa8);
        for (let x = q(8); x < w - q(8); x++) B.epx(x, q(H - 56), 0xc084fc);
        [q(16), q(W - 44)].forEach((cx) => {
            const cy = q(H - 34);
            B.rect(cx, cy, q(28), q(26), 0x374151);
            B.rect(cx, cy, q(28), 1, 0x4b5563);
            for (let y = cy + 2; y < cy + 8; y += 2)
                (B.rect(cx + 1, y, q(22), 1, 0x5a3a78), B.erect(cx + 1, y, q(22), 1, 0xc084fc, 170));
            B.px(cx + q(24), cy + 1, 0xfbbf24);
            B.epx(cx + q(24), cy + 1, 0xffd060);
        });
        // Porthole ring where PowerEnv's pulsing plasma halo sits.
        const pcx = Math.round(w / 2);
        const pcy = q(H - 32);
        B.ellipse(pcx, pcy, 5.2, 5.2, 0x475569);
        B.ellipse(pcx, pcy, 4.4, 4.4, 0x0b0e16);
        for (let j = -3; j <= 3; j++)
            for (let i = -3; i <= 3; i++) {
                const d = Math.hypot(i, j);
                if (d > 3.6) continue;
                const c = d < 1 ? 0xffffff : d < 2.4 ? 0x7ae8ff : 0xf0abfc;
                B.px(pcx + i, pcy + j, dark(c, 0.4));
                B.epx(pcx + i, pcy + j, c, 150);
            }
    };

    PL.dataKeyPower = function (b) {
        if (b.id !== 'power_solar' || typeof G === 'undefined' || !G.getDayPhase) return '';
        const dp = G.getDayPhase();
        return String(dp < 0.25 || dp > 0.83 ? 0 : Math.round(Math.sin(((dp - 0.25) / 0.58) * Math.PI) * 4));
    };
})();
