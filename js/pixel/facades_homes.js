/* Pixel art — the Neon Bar, the suburban townhomes, the founders' estates' names, and
   the pine forests, following their buildBuildings() branches. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    // ── Neon Bar: dark brick, neon strips, coloured windows, a stage, a cocktail ─
    D.neon_bar = function (B, b, w, h) {
        const H = h * 3;
        K.wall(B, 0, 0, w, h, 0x2a1a3a, 'brick', { mortar: 0x1a1028 });
        const strip = (y, c) => {
            for (let x = 0; x < w; x++) (B.px(x, y, mix(0x2a1a3a, c, 0.45)), B.epx(x, y, c, 200));
        };
        strip(0, 0xff00ff);
        strip(q(H * 0.4), 0x00ffff);
        strip(q(H * 0.7), 0xff00ff);
        for (let y = q(10); y < h - q(10); y++) {
            (B.px(0, y, 0xa0306a), B.epx(0, y, 0xff69b4));
            (B.px(w - 1, y, 0x208080), B.epx(w - 1, y, 0x00ffff));
        }
        B.light(0, h / 2, 0xff69b4, 12, 'neon');
        B.light(w - 1, h / 2, 0x00ffff, 12, 'neon');
        // Windows glowing with the bar's colours.
        for (let wx = 15; wx < b.w - 20; wx += 28) {
            const x = q(wx);
            const y = q(H * 0.3);
            const c = [0xff00ff, 0x00ffff, 0xff6b9d, 0xa855f7][Math.floor(wx / 28) % 4];
            B.rect(x, y, 7, 7, 0x000000);
            for (let j = 1; j < 7; j++)
                for (let i = 1; i < 6; i++)
                    (B.px(x + i, y + j, mix(0x10081a, c, 0.35)),
                        B.epx(x + i, y + j, mix(c, 0xffffff, j === 1 ? 0.3 : 0), 200));
            (B.px(x + 2, y + 5, 0x1a0a20),
                B.px(x + 2, y + 6, 0x1a0a20),
                B.epx(x + 2, y + 5, 0x1a0a20),
                B.epx(x + 2, y + 6, 0x1a0a20));
        }
        // Stage with a microphone stand (ground floor, centre).
        const sx = Math.round(w / 2);
        B.rect(sx - 8, h - 9, 17, 9, 0x3a1450);
        for (let j = 1; j < 8; j++)
            for (let i = -7; i <= 7; i++) B.epx(sx + i, h - 9 + j, j < 2 ? 0xff9aff : 0xc040c0, 150);
        B.rect(sx, h - 7, 1, 5, 0x888888);
        B.px(sx, h - 8, 0xcccccc);
        B.light(sx, h - 4, 0xff40ff, 14, 'shop');
        // Door (left) with a magenta lintel.
        B.rect(q(10), h - 6, 5, 6, 0x1a0a28);
        B.rect(q(10), h - 6, 5, 1, 0xff00ff);
        (B.epx(q(10), h - 6, 0xff66ff), B.epx(q(10) + 4, h - 6, 0xff66ff));
        B.px(q(22), h - 3, 0xfbbf24);
        // Pixel cocktail glass where the classic draws 🍸.
        const cx = q(b.w - 20);
        const cy = q(H * 0.15);
        [
            [-3, -2],
            [-2, -2],
            [-1, -2],
            [0, -2],
            [1, -2],
            [2, -2],
            [3, -2],
            [-2, -1],
            [-1, -1],
            [0, -1],
            [1, -1],
            [2, -1],
            [-1, 0],
            [0, 0],
            [1, 0],
            [0, 1],
            [0, 2],
            [-1, 3],
            [0, 3],
            [1, 3],
        ].forEach((p) => {
            const c = p[1] < 0 ? 0x7ae8ff : 0xe8e8f0;
            B.px(cx + p[0], cy + p[1], c);
            B.epx(cx + p[0], cy + p[1], c, 220);
        });
        (B.px(cx + 1, cy - 2, 0x5ad05a), B.epx(cx + 1, cy - 2, 0x7aff7a));
        B.light(cx, cy, 0x7ae8ff, 8, 'neon');
    };

    // ── Suburban townhomes: five palettes, picket fence, attic window, porch ──
    const PALS = [
        { wall: 0xd4a574, trim: 0x8b5a2b, roof: 0x7c2d12, door: 0x5c3317 },
        { wall: 0xe2e8f0, trim: 0x64748b, roof: 0x334155, door: 0x1e3a5f },
        { wall: 0xb8917a, trim: 0x6b4423, roof: 0x4a2c17, door: 0x3d2914 },
        { wall: 0xfef3c7, trim: 0xa16207, roof: 0x78350f, door: 0x713f12 },
        { wall: 0xc5e1c5, trim: 0x4a7c59, roof: 0x2d5a3f, door: 0x2d3d2d },
    ];
    D['pre:suburb'] = function (B, b, w, h) {
        const idNum = parseInt(b.id.replace('suburb_', ''), 10) || 1;
        const p = PALS[(idNum - 1) % PALS.length];
        const W = b.w;
        const H = h * 3;
        // Lawn.
        for (let x = 0; x < w; x++)
            for (let y = h - 2; y < h; y++)
                B.px(x, y, PL.dpick([0x2d5a2d, 0x3a7a3a, 0x4a8a44], y === h - 2 ? 0.8 : 0.3, x, y));
        // House body with trim corners.
        const top = q(14);
        const bot = q(H - 14);
        K.wall(B, q(10), top, w - q(20), bot - top, p.wall, 'wood');
        B.rect(q(10), top, 1, bot - top, p.trim);
        B.rect(w - q(13), top, 1, bot - top, p.trim);
        // Gabled roof with a chimney and a round attic window.
        K.pitched(B, q(6), top + 1, w - q(12), p.roof, { h: top + 1, over: 0 });
        K.wall(B, w - q(36), 1, 3, top - 1, 0x8a4a3a, 'brick');
        B.rect(w - q(37), 1, 4, 1, 0x5a3a2a);
        B.smoke.push({ x: w - q(36) + 1, y: 0, k: 0.35 });
        const ax = Math.round(w / 2);
        B.ellipse(ax, top - 2, 1.6, 1.6, p.trim);
        B.px(ax, top - 2, 0xfff0c0);
        B.epx(ax, top - 2, 0xffe0a0);
        // Upper windows with shutters.
        [0.28, 0.72].forEach((f) => {
            const x = q(W * f) - 2;
            const y = top + 3;
            B.rect(x - 1, y - 1, 7, 6, p.trim);
            for (let j = 0; j < 4; j++)
                for (let i = 0; i < 5; i++) {
                    B.px(x + i, y + j, PL.dpick([0xa8c0d4, 0x6a88a8], j / 3, x + i, y + j));
                    if (PL.labNoise((b.x | 0) + x * 3 * 13) > 0.5) B.epx(x + i, y + j, 0xffe6a0);
                }
            B.rect(x + 2, y, 1, 4, p.trim);
            B.rect(x, y + 2, 5, 1, p.trim);
            B.rect(x - 2, y, 1, 4, dark(p.trim, 0.2));
            B.rect(x + 5, y, 1, 4, dark(p.trim, 0.2));
        });
        // Big front window (left) and the front door (centre-right).
        const gx = q(18);
        const gy = top + 10;
        if (gy + 5 < bot) {
            B.rect(gx - 1, gy - 1, 11, 7, p.trim);
            for (let j = 0; j < 5; j++)
                for (let i = 0; i < 9; i++) {
                    B.px(gx + i, gy + j, PL.dpick([0xa8c0d4, 0x6a88a8], j / 4, gx + i, gy + j));
                    if (PL.labNoise((b.x | 0) + 71) > 0.4) B.epx(gx + i, gy + j, 0xffd98a);
                }
            B.rect(gx + 4, gy, 1, 5, p.trim);
        }
        const dx = q(W - 38);
        B.rect(dx - 1, bot - 6, 6, 6, p.trim);
        B.rect(dx, bot - 5, 4, 5, p.door);
        B.px(dx + 3, bot - 2, 0xd4a830);
        B.px(dx + 2, bot - 8, 0xffe8a0);
        B.epx(dx + 2, bot - 8, 0xffe8a0);
        B.light(dx + 2, bot - 8, 0xffd08a, 8, 'lantern');
        B.rect(dx - 1, bot, 7, 1, 0x9a948a);
        // House number plate (the classic Text is hidden).
        const num = String(100 + idNum * 4);
        B.rect(dx - 3, bot - 11, PL.textW(num, 3) + 2, 7, 0x2a2a30);
        B.text(num, dx - 2, bot - 10, 0xf5f5f4, 3);
        // Picket fence, driveway, shrub and a lawn tree.
        for (let x = 1; x < w - 1; x += 3) (B.rect(x, h - 4, 1, 3, 0xf4f4f0), B.px(x, h - 5, 0xe8e8e4));
        B.rect(1, h - 3, w - 2, 1, 0xe8e8e4);
        B.rect(w - q(18), h - 3, 5, 3, 0x8a8680);
        PL.S.bush(B.base, B.X(dx - 3), B.Y(h - 2), 3, B.seed + 5, PL.S.LEAF.green);
        K.tree(B, q(20), h - 2, 3, idNum % 2 ? PL.S.LEAF.green : PL.S.LEAF.autumn, { trunk: 3 });
    };

    // ── Founders' estates: the lab-era style painters, named in full ────────
    const estate = D['pre:house'];
    D['pre:house'] = function (B, b, w, h) {
        PL.noEstatePlaque = true;
        estate(B, b, w, h);
        PL.noEstatePlaque = false;
        const lc = hex((PL.LABS && PL.LABS[b.lab] ? PL.LABS[b.lab].color : null) || '#64748b');
        PL.neonSign(B, b.name || '', PL.lum(lc) < 0.1 ? 0xe8e8ee : lc, w);
    };

    // ── Forests: layered pines on a dark strip, as the classic draws them ───
    function forest(B, b, w, h) {
        for (let x = 0; x < w; x++) {
            B.px(x, h - 2, 0x1b4332);
            B.px(x, h - 1, 0x163a2a);
            B.px(x, h - 3, 0x2d6a4f);
        }
        // Classic scatter: a tree every 15–35 world px, heights 40–120, widths 25–50.
        let seed = 42 + (b.x | 0);
        const sr = () => {
            seed = (seed * 16807) % 2147483647;
            return (seed - 1) / 2147483646;
        };
        for (let tx = 10; tx < b.w - 10; tx += 15 + sr() * 20) {
            const th = 40 + sr() * 80;
            sr();
            K.pine(
                B,
                q(tx),
                h - 2,
                Math.round(th / 3) + 4,
                [0x0c2a20, 0x064e3b, 0x065f46, 0x047857, 0x2a8a5a]
            );
        }
    }
    D['pre:forest'] = forest;
    D.forest_space = forest;
})();
