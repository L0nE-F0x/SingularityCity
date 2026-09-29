/* Pixel art — ambassadors' residences (EmbassyQuarter.renderExterior): one pixel
   painter per national style — Georgian (US), Pagoda (CN), Haussmann (EU), Victorian
   (UK), Haveli (IN), Arabian (AE). The flagpole and waving flag stay the live objects
   EmbassyQuarter adds; PixelArt pixelises them in place. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});

    const STYLE_BY_ID = {
        us: 'georgian',
        cn: 'pagoda',
        eu: 'haussmann',
        uk: 'victorian',
        in: 'haveli',
        ae: 'arabian',
    };

    function win(B, x, y, w, h, o) {
        o = o || {};
        if (o.frame !== undefined) B.rect(x - 1, y - 1, w + 2, h + 2, o.frame);
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                if (o.arch && j === 0 && (i === 0 || i === w - 1)) continue;
                B.px(
                    x + i,
                    y + j,
                    PL.dpick([0x9cb4cc, 0x5a7090, 0x3a4a60], j / Math.max(1, h - 1), x + i, y + j)
                );
                B.epx(x + i, y + j, j === 0 ? 0xfff0c0 : 0xffd98a, 235);
            }
        if (o.cross) {
            B.rect(x + Math.floor(w / 2), y, 1, h, o.cross);
            B.rect(x, y + Math.floor(h / 2), w, 1, o.cross);
        }
        if (o.shutters !== undefined)
            (B.rect(x - 1, y, 1, h, o.shutters), B.rect(x + w, y, 1, h, o.shutters));
    }
    function crenel(B, x, y, w, col) {
        B.rect(x, y, w, 1, col);
        for (let i = 0; i < w; i += 2) B.px(x + i, y - 1, col);
    }
    function garden(B, w, h) {
        // _addGarden: grass either side of a centre walkway, just below the facade.
        B.rect(0, h - 1, Math.round(w / 2) - 3, 1, 0x2a5a2a);
        B.rect(Math.round(w / 2) + 3, h - 1, Math.round(w / 2) - 3, 1, 0x2a5a2a);
        B.rect(Math.round(w / 2) - 3, h - 1, 6, 1, 0xb8b09a);
    }

    const STYLES = {
        georgian(B, b, w, h) {
            const body = 0xf2ead8;
            K.wall(B, 2, 7, w - 4, h - 9, body, 'wood');
            B.rect(1, h - 2, w - 2, 2, 0x8a8478);
            K.pitched(B, 1, 7, w - 2, 0x2a3a5a, { h: 7, over: 2 });
            K.wall(B, w - 9, -2, 3, 6, 0x9a3a2a, 'brick');
            // Portico with two doric columns and a small pediment.
            const cx = Math.round(w / 2);
            K.pediment(B, cx - 6, h - 12, 12, 0xf8f4e8);
            B.rect(cx - 6, h - 12, 12, 1, 0xe8e0cc);
            [cx - 5, cx + 4].forEach(
                (x) => (B.rect(x, h - 11, 1, 9, 0xfffbf0), B.px(x + 1, h - 11, 0xd8d0bc))
            );
            K.door(B, cx - 1, h - 7, 3, 5, 0xa8342a);
            // Windows with black shutters, two per floor either side.
            [
                [5, 10],
                [w - 10, 10],
                [5, h - 9],
                [w - 10, h - 9],
            ].forEach(([x, y]) => win(B, x, y, 3, 4, { shutters: 0x1a1a20, cross: 0xe8e0cc }));
        },
        pagoda(B, b, w, h) {
            const body = 0x8a1f1a;
            K.wall(B, 4, 8, w - 8, h - 10, body, 'wood');
            B.rect(3, h - 2, w - 6, 2, 0x8a8478);
            for (let y = 13; y < h - 2; y += 6) B.rect(4, y, w - 8, 1, 0xd4a830);
            // Jade-green pagoda roof with an upturned overhang, a second tier and gold ridge.
            const tier = (y, x0, x1) => {
                for (let x = x0 - 2; x <= x1 + 2; x++) {
                    const lift = x < x0 ? x0 - x : x > x1 ? x - x1 : 0;
                    B.px(x, y - lift, light(0x2a6142, 0.2));
                    B.px(x, y + 1 - lift, 0x2a6142);
                    B.px(x, y + 2 - lift, dark(0x2a6142, 0.3));
                }
                (B.px(x0 - 3, y - 3, 0xfbbf24), B.px(x1 + 3, y - 3, 0xfbbf24));
            };
            tier(6, 3, w - 4);
            B.rect(9, 2, w - 18, 4, body);
            tier(0, 8, w - 9);
            B.rect(Math.round(w / 2) - 1, -3, 3, 1, 0xfbbf24);
            B.px(Math.round(w / 2), -4, 0xfbbf24);
            // Gold-trimmed door with red lanterns.
            const cx = Math.round(w / 2);
            B.rect(cx - 3, h - 8, 6, 6, 0xfbbf24);
            B.rect(cx - 2, h - 7, 4, 5, 0x5a1410);
            B.px(cx, h - 7, 0xfbbf24);
            [cx - 6, cx + 5].forEach(
                (x) => (
                    B.rect(x, h - 10, 2, 2, 0xdc2626),
                    B.erect(x, h - 10, 2, 2, 0xff7a4a),
                    B.light(x + 1, h - 9, 0xff6a3a, 6, 'lantern')
                )
            );
            // Moon-gate windows with lattice.
            [
                [8, 12],
                [w - 13, 12],
            ].forEach(([x, y]) => {
                B.ellipse(x + 2, y + 2, 2.6, 2.6, 0xfbbf24);
                for (let j = 0; j < 5; j++)
                    for (let i = 0; i < 5; i++) {
                        const d = Math.hypot(i - 2, j - 2);
                        if (d > 2.2) continue;
                        B.px(x + i, y + j, (i + j) % 2 ? 0x3a2a1e : 0x5a3a24);
                        if ((i + j) % 2 === 0) B.epx(x + i, y + j, 0xffc878, 220);
                    }
            });
        },
        haussmann(B, b, w, h) {
            const stone = 0xe6dcc6;
            K.wall(B, 2, 8, w - 4, h - 10, stone, 'stone');
            for (let y = 14; y < h - 2; y += 6) B.rect(2, y, w - 4, 1, light(stone, 0.15));
            B.rect(1, h - 2, w - 2, 2, 0xb8ae98);
            for (let y = 8; y < h - 2; y += 2) (B.px(2, y, 0xd4c8b0), B.px(w - 3, y, 0xd4c8b0));
            // Mansard: grey slate, a shallow flat top and two dormers.
            for (let j = 0; j < 7; j++) {
                const inset = Math.round((1 - j / 7) * 3);
                for (let x = 2 + inset; x < w - 2 - inset; x++)
                    B.px(x, 1 + j, j === 0 ? 0x6a7890 : (x + j) % 3 ? 0x4a5870 : 0x3e4a60);
            }
            [9, w - 13].forEach((x) => {
                B.rect(x, 2, 4, 4, stone);
                (B.px(x + 1, 1, stone), B.px(x + 2, 1, stone));
                win(B, x + 1, 3, 2, 2, {});
            });
            // Tall arched door and french windows with an iron balcony.
            const cx = Math.round(w / 2);
            B.rect(cx - 2, h - 9, 5, 7, 0xd4a830);
            B.rect(cx - 1, h - 8, 3, 6, 0x2a3a4a);
            (B.px(cx - 2, h - 9, stone), B.px(cx + 2, h - 9, stone));
            [5, 11, w - 14, w - 8].forEach((x) => win(B, x, 11, 3, 6, { arch: true }));
            B.rect(4, 17, w - 8, 1, 0x1e1e24);
            for (let x = 4; x < w - 4; x += 2) B.px(x, 16, 0x1e1e24);
        },
        victorian(B, b, w, h) {
            const brick = 0x9a3a2a;
            K.wall(B, 3, 8, w - 6, h - 10, brick, 'brick');
            B.rect(3, 16, w - 6, 1, 0xd8ccb4);
            B.rect(2, h - 2, w - 4, 2, 0x8a8478);
            K.pitched(B, 2, 8, w - 4, 0x3a3e4a, { h: 7, over: 2 });
            [7, w - 11].forEach((x) => {
                K.wall(B, x, -1, 3, 5, brick, 'brick');
                (B.px(x, -2, 0xc86a3a), B.px(x + 2, -2, 0xc86a3a));
            });
            // Projecting bay window with a small peak roof, black door beside it.
            const bx = 6;
            B.rect(bx - 1, h - 10, 12, 1, 0xd8ccb4);
            for (let x = bx; x < bx + 10; x++)
                B.px(x, h - 11 - Math.max(0, 2 - Math.abs(x - bx - 5)), 0x3a3e4a);
            [0, 4, 8].forEach((i) => win(B, bx + i, h - 9, 2, 5, {}));
            K.door(B, w - 12, h - 8, 3, 6, 0x14141a);
            B.px(w - 11, h - 6, 0xd4a830);
            // Upper sash windows.
            [6, 13, w - 17, w - 10].forEach((x) => win(B, x, 10, 3, 4, { frame: 0xe8e0cc, cross: 0xe8e0cc }));
        },
        haveli(B, b, w, h) {
            const sand = 0xd89a7a;
            K.wall(B, 2, 6, w - 4, h - 8, sand, 'stone');
            [12, 20].forEach((y) => B.rect(2, y, w - 4, 1, dark(sand, 0.15)));
            B.rect(1, h - 2, w - 2, 2, 0xb88a6a);
            crenel(B, 2, 6, w - 4, light(sand, 0.1));
            // Corner chhatris: pillars and small domes.
            [4, w - 8].forEach((x) => {
                B.rect(x, 1, 1, 4, light(sand, 0.2));
                B.rect(x + 3, 1, 1, 4, light(sand, 0.2));
                K.dome(B, x + 2, 1, 3, 0xf0d8b8, { ry: 3, lantern: false });
                B.px(x + 2, -3, 0xd4a830);
            });
            // Jharokha: a carved projecting balcony with jaali lattice.
            const cx = Math.round(w / 2);
            B.rect(cx - 7, 12, 14, 6, dark(sand, 0.2));
            for (let j = 0; j < 4; j++)
                for (let i = 0; i < 12; i++)
                    if ((i + j) % 2 === 0)
                        (B.px(cx - 6 + i, 13 + j, 0xf0d0b0), B.epx(cx - 6 + i, 13 + j, 0xffc878, 180));
            [cx - 6, cx - 2, cx + 2, cx + 5].forEach((x) => B.px(x, 18, dark(sand, 0.35)));
            // Arched saffron-trim door and small arched side windows.
            B.rect(cx - 3, h - 8, 6, 6, 0xff9933);
            B.rect(cx - 2, h - 7, 4, 5, 0x5a3014);
            (B.px(cx - 3, h - 8, sand), B.px(cx + 2, h - 8, sand));
            [5, w - 9].forEach((x) => win(B, x, h - 7, 3, 4, { arch: true }));
        },
        arabian(B, b, w, h) {
            const stucco = 0xf0e6d0;
            K.wall(B, 2, 6, w - 4, h - 8, stucco, 'stucco');
            B.rect(1, h - 2, w - 2, 2, 0xd8c8a0);
            crenel(B, 2, 6, w - 4, light(stucco, 0.1));
            [12, 20].forEach((y) => B.rect(2, y, w - 4, 1, 0xd4a830));
            // Central dome with a gold crescent finial.
            const cx = Math.round(w / 2);
            K.dome(B, cx, 6, 6, 0xe8e0cc, { ry: 5, lantern: false });
            (B.px(cx, -1, 0xd4a830), B.px(cx - 1, -2, 0xd4a830), B.px(cx + 1, -2, 0xd4a830));
            // Grand arched entry and mashrabiya windows.
            for (let j = 0; j < 8; j++)
                for (let i = -3; i <= 3; i++)
                    if (!(j < 2 && Math.abs(i) > 1 + j))
                        B.px(cx + i, h - 10 + j, j < 1 ? 0xd4a830 : 0x3a2a1e);
            for (let j = 2; j < 8; j++) B.epx(cx, h - 10 + j, 0xffd98a);
            [5, 12, w - 15, w - 8].forEach((x) => {
                B.rect(x - 1, 9, 5, 7, 0xd4a830);
                for (let j = 0; j < 6; j++)
                    for (let i = 0; i < 3; i++) {
                        if (j === 0 && i !== 1) continue;
                        B.px(x + i, 10 + j, (i + j) % 2 ? 0x2a1e14 : 0x4a3424);
                        if ((i + j) % 2 === 0) B.epx(x + i, 10 + j, 0xffc878, 220);
                    }
            });
            PL.S.palm(B.base, B.X(w - 2), B.Y(h), 12, B.seed);
        },
    };

    D['pre:diplomat_villa'] = function (B, b, w, h) {
        const style = b.style || STYLE_BY_ID[b.id.split('_').pop()] || 'georgian';
        (STYLES[style] || STYLES.georgian)(B, b, w, h);
        garden(B, w, h);
    };
})();
