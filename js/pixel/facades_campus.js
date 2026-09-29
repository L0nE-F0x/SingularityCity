/* Pixel art — buildings drawn by their own modules in the classic city:
   UniversityEnv (Academy, Library, Dorm, Lab), CourtEnv (Senate, Hearing Chamber),
   JailEnv (AI Detention Center) and ConferenceEnv (pop-up convention centre). */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);
    const flOf = (b) => b.fl || 1;

    function pane(B, x, y, w, h, lit, col) {
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                B.px(x + i, y + j, PL.dpick([0x9ab0c4, 0x56708a], j / Math.max(1, h - 1), x + i, y + j));
                if (lit) B.epx(x + i, y + j, j === 0 ? light(col, 0.25) : col);
            }
    }

    // ── AI Academy: classical stone, five columns, pediment, working clock ──
    D.uni_main = function (B, b, w, h) {
        const W = b.w;
        const H = h * 3;
        K.wall(B, 0, 0, w, h, 0x9a8264, 'stone');
        for (let row = 0; row < flOf(b) - 1; row++)
            for (let wi = 0; wi < 4; wi++) {
                const x = q(20 + (wi * (W - 40)) / 3) - 2;
                const y = q(15 + row * 22);
                if (y + 5 > h - 9) continue;
                pane(B, x, y, 3, 5, true, 0xffeecc);
            }
        for (let ci = 0; ci < 5; ci++) {
            const cx = q(15 + (ci * (W - 30)) / 4);
            B.rect(cx - 2, 2, 4, 2, 0xc8b89a);
            for (let y = 4; y < h - 3; y++)
                (B.px(cx - 1, y, 0xc0ac8c), B.px(cx, y, 0xb09a7a), B.px(cx + 1, y, 0x8a7458));
        }
        // Pediment and clock tower.
        for (let j = 0; j < 6; j++) {
            const inset = Math.round(((6 - j) / 6) * (w / 2 - 2)) + 2;
            for (let x = inset; x < w - inset; x++)
                B.px(x, -6 + j, j === 0 || x === inset ? 0xb8a07a : 0xa89066);
        }
        const cx = Math.round(w / 2);
        K.wall(B, cx - 4, -13, 8, 8, 0x8a7458, 'stone');
        B.ellipse(cx, -9, 2.6, 2.6, 0xfff2e2);
        B.epx(cx, -9, 0xfff4d0);
        // Hands at the time the building was painted, as the classic draws them.
        const now = new Date();
        const ha = ((now.getHours() % 12) / 12) * PL.TAU - Math.PI / 2;
        const ma = (now.getMinutes() / 60) * PL.TAU - Math.PI / 2;
        B.px(cx, -9, 0x333333);
        B.px(cx + Math.round(Math.cos(ha) * 1.2), -9 + Math.round(Math.sin(ha) * 1.2), 0x333333);
        B.px(cx + Math.round(Math.cos(ma) * 2), -9 + Math.round(Math.sin(ma) * 2), 0x333333);
        // Arched entrance.
        for (let j = 0; j < 9; j++)
            for (let i = -4; i <= 4; i++)
                if (!(j < 2 && Math.abs(i) > 2 + j)) B.px(cx + i, h - 9 + j, 0x3a2a1a);
        for (let j = 3; j < 9; j++) B.epx(cx, h - 9 + j, 0xffd9a0, 160);
        B.light(cx, h, 0xffd9a0, 10, 'door');
        void H;
    };

    // ── Data Library: a facade of book spines ────────────────────────────
    D.uni_library = function (B, b, w, h) {
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0x7a6a58, 'wood');
        const books = [0xcc4444, 0x4488cc, 0x44aa44, 0xddaa33, 0x884488, 0xcc8844];
        for (let row = 0; row < flOf(b); row++)
            for (let bi = 0; bi < 10; bi++) {
                const x = q(8 + (bi * (W - 16)) / 10);
                const y = q(6 + row * 22);
                if (y + 5 > h) continue;
                const c = books[(bi + row) % books.length];
                for (let j = 0; j < 5; j++) (B.px(x, y + j, c), B.px(x + 1, y + j, dark(c, 0.2)));
                B.px(x, y + 1, light(c, 0.4));
                B.epx(x, y + 4, 0xffe0a0, 90);
            }
        const cx = Math.round(w / 2);
        B.rect(cx - 4, h - 7, 8, 7, 0x3a2a1a);
        B.erect(cx - 3, h - 6, 6, 1, 0xffe0a0);
        B.light(cx, h, 0xffd9a0, 10, 'door');
    };

    // ── Model Dormitory: brick grid of warm windows ────────────────────────
    D.uni_dorm = function (B, b, w, h) {
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0x8a7a68, 'brick');
        for (let row = 0; row < flOf(b); row++)
            for (let wi = 0; wi < 6; wi++) {
                const x = q(10 + (wi * (W - 20)) / 6);
                const y = q(8 + row * 22);
                if (y + 4 > h - 6) continue;
                pane(B, x, y, 3, 4, PL.labNoise(row * 31 + wi * 7 + (b.x | 0)) > 0.4, 0xffeeaa);
            }
        B.rect(Math.round(w / 2) - 3, h - 6, 7, 6, 0x444466);
        B.erect(Math.round(w / 2) - 2, h - 5, 5, 1, 0xd8e0ff);
    };

    // ── Research Lab: dark panels with glowing experiments ─────────────────
    D.uni_lab = function (B, b, w, h) {
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0x34465a, 'panel', { pitch: 6 });
        for (let row = 0; row < flOf(b); row++)
            for (let pi = 0; pi < 4; pi++) {
                const x = q(6 + (pi * (W - 12)) / 4);
                const y = q(4 + row * 22);
                const pw = q((W - 20) / 4);
                if (y + 6 > h - 6) continue;
                pane(B, x, y, pw, 6, true, 0x9ad0e8);
                if (PL.labNoise((b.x | 0) + row * 13 + pi * 5) > 0.5)
                    (B.px(x + 3, y + 3, 0x44ffaa), B.epx(x + 3, y + 3, 0x7affc0));
            }
        B.rect(Math.round(w / 2) - 4, h - 7, 8, 7, 0x226688);
        B.erect(Math.round(w / 2) - 3, h - 6, 6, 6, 0x9ae0ff, 170);
    };

    // ── AI Senate: neoclassical, six columns, gold medallion, dome ─────────
    D.court_senate = function (B, b, w, h) {
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0xd4cfc4, 'stone');
        B.rect(1, 1, w - 2, h - 2, 0xc4bfb4);
        for (let ci = 0; ci < 6; ci++) {
            const cx = q(18 + (ci * (W - 36)) / 5);
            B.rect(cx - 2, 4, 4, 2, 0xf0ece4);
            for (let y = 6; y < h - 5; y++)
                (B.px(cx - 1, y, 0xf4f0e8), B.px(cx, y, 0xe8e4da), B.px(cx + 1, y, 0xb8b4aa));
            B.rect(cx - 2, h - 5, 4, 1, 0xb8b4aa);
        }
        // Pediment with the gold medallion, dome and finial above.
        for (let j = 0; j < 11; j++) {
            const inset = Math.round(((11 - j) / 11) * (w / 2 - 3)) + 3;
            for (let x = inset; x < w - inset; x++)
                B.px(x, -7 + j, j === 0 || x === inset ? 0xece8dc : 0xddd8cc);
        }
        const cx = Math.round(w / 2);
        B.ellipse(cx, -3, 1.8, 1.8, 0xc8a850);
        K.dome(B, cx, -7, 10, 0xd0cdc4, { ry: 5, ribs: true, lantern: false });
        (B.px(cx, -13, 0xc8a850), B.px(cx, -12, 0xc8a850));
        // Grand arched entrance and steps.
        for (let j = 0; j < 9; j++)
            for (let i = -5; i <= 5; i++)
                if (!(j < 3 && Math.abs(i) > 2 + j)) B.px(cx + i, h - 9 + j, 0x3a3028);
        for (let j = 3; j < 9; j++)
            (B.epx(cx - 1, h - 9 + j, 0xffd9a0, 150), B.epx(cx + 1, h - 9 + j, 0xffd9a0, 150));
        B.light(cx, h, 0xffd9a0, 14, 'door');
    };

    // ── Hearing Chamber: four columns, pediment, gold seal ────────────────
    D.court_hearing = function (B, b, w, h) {
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0xc8c4b8, 'stone');
        for (let wi = 0; wi < 3; wi++) pane(B, q(15 + (wi * (W - 30)) / 3 + 5), q(20), 5, 6, true, 0xffeecc);
        for (let ci = 0; ci < 4; ci++) {
            const cx = q(15 + (ci * (W - 30)) / 3);
            for (let y = 3; y < h - 3; y++)
                (B.px(cx - 1, y, 0xece8dc), B.px(cx, y, 0xddd8cc), B.px(cx + 1, y, 0xb0aca0));
        }
        for (let j = 0; j < 7; j++) {
            const inset = Math.round(((7 - j) / 7) * (w / 2 - 2)) + 2;
            for (let x = inset; x < w - inset; x++)
                B.px(x, -5 + j, j === 0 || x === inset ? 0xe4e0d4 : 0xd4d0c4);
        }
        B.ellipse(Math.round(w / 2), -1, 1.4, 1.4, 0xc8a850);
        const cx = Math.round(w / 2);
        B.rect(cx - 4, h - 7, 8, 7, 0x3a3028);
        B.erect(cx - 3, h - 6, 6, 1, 0xffd9a0);
        B.light(cx, h, 0xffd9a0, 10, 'door');
    };

    // ── AI Detention Center: concrete, barred slits, razor wire, guard tower ─
    D.ai_jail = function (B, b, w, h) {
        const W = b.w;
        const H = h * 3;
        K.wall(B, 0, 0, w, h, 0x5b6270, 'concrete', { seams: false });
        B.rect(1, 1, w - 2, h - 2, 0x4b515d);
        for (let sx = 30; sx < W - 10; sx += 38) B.rect(q(sx), 2, 1, h - 4, 0x3c4049);
        for (let sy = 26; sy < H - 16; sy += 30) B.rect(1, q(sy), w - 2, 1, 0x3c4049);
        // Barred cell slits, a few with amber light.
        const rows = Math.max(2, Math.floor((H - 40) / 30));
        for (let r = 0; r < rows; r++) {
            const y = q(16 + r * 30);
            for (let cx = 16; cx < W - 22; cx += 40) {
                const x = q(cx);
                B.rect(x, y, 6, 5, 0x0b0d12);
                if ((r + cx) % 3 === 0) B.erect(x, y, 6, 5, 0xfca25a, 90);
                B.rect(x + 2, y, 1, 5, 0x8a93a3);
                B.rect(x + 4, y, 1, 5, 0x8a93a3);
            }
        }
        // Foundation, sally-port gate and its warning light.
        B.rect(0, h - 5, w, 5, 0x33373f);
        B.rect(0, h - 1, w, 1, 0x2a2d34);
        const dw = q(42);
        const dx = Math.round(w / 2 - dw / 2);
        B.rect(dx, h - 12, dw, 12, 0x121419);
        B.rect(dx - 1, h - 13, dw + 2, 2, 0x2a2d34);
        for (let x = dx + 2; x < dx + dw - 1; x += 2) B.rect(x, h - 11, 1, 11, 0x8a93a3);
        B.rect(dx + 1, h - 8, dw - 2, 1, 0x8a93a3);
        B.blink(Math.round(w / 2), h - 14, 0xef4444, 1.2, 0);
        // Stencil signage band (the classic has no text on it).
        const sgW = q(Math.min(120, W - 40));
        const sgX = Math.round(w / 2 - sgW / 2);
        B.rect(sgX, q(8), sgW, 4, 0x14161c);
        for (let x = sgX + 2; x < sgX + sgW - 2; x += 5)
            (B.rect(x, q(8) + 1, 3, 2, 0xb83a3a), B.erect(x, q(8) + 1, 3, 2, 0xef4444, 150));
        // Razor-wire coil along the roof.
        for (let x = 1; x < w - 2; x++) B.px(x, -1 - Math.abs(((x + 2) % 6) - 3) / 1.2, 0xd5dbe6);
        for (let cw = 12; cw < W - 10; cw += 22) B.ellipse(q(cw), -3, 1, 1, 0xeef2f8);
        // Guard tower on the right edge with its spotlight cone across the yard.
        const tx = q(W - 22);
        B.rect(tx, q(-44), 6, h + q(44), 0x3f4450);
        B.rect(tx, q(-44), 1, h + q(44), 0x2f333c);
        B.rect(tx - 2, q(-54), 10, 5, 0x4a5160);
        B.rect(tx - 1, q(-51), 8, 3, 0x10131a);
        B.erect(tx - 1, q(-50), 8, 1, 0x9fb4cf, 140);
        for (let i = -3; i <= 9; i++) B.px(tx + i, q(-54) - Math.max(0, 2 - Math.abs(i - 3) / 3), 0x23262e);
        B.px(tx - 1, q(-47), 0xfff2b0);
        B.epx(tx - 1, q(-47), 0xfff6cc);
        B.blink(tx + 3, q(-61), 0xef4444, 1.6, 0.4);
        const sx0 = tx - 1;
        const sy0 = q(-47);
        for (let y = sy0 + 1; y < h - 1; y++) {
            const t = (y - sy0) / (h - 1 - sy0);
            const l = Math.round(sx0 - t * q(68));
            const r = Math.round(sx0 - t * q(28));
            for (let x = l; x <= r; x++) if (PL.bayer(x, y) < 0.3 * (1 - t * 0.5)) B.epx(x, y, 0xfff6cc, 90);
        }
    };

    // ── Convention centre (appears during conferences, in the live colour) ─
    D.convention_center = function (B, b, w, h) {
        const conf = typeof ConferenceData !== 'undefined' ? ConferenceData._active : null;
        const col = conf && typeof conf.color === 'number' ? conf.color : 0x6366f1;
        K.wall(B, 0, 0, w, h, 0x2e2a44, 'panel', { pitch: 6 });
        B.rect(1, 1, w - 2, Math.round(h * 0.6), 0x3a3658);
        B.rect(3, Math.round(h * 0.3), w - 6, 5, col);
        for (let x = 3; x < w - 3; x++) B.epx(x, Math.round(h * 0.3) + 2, light(col, 0.3), 180);
        for (let row = 1; row >= 0; row--)
            for (let c = 0; c < 5; c++)
                pane(B, q(12 + (c * (b.w - 24)) / 5), Math.round(h * 0.65) + row * 5, 6, 3, true, 0xffcc66);
        const cx = Math.round(w / 2);
        B.rect(cx - 5, h - 7, 10, 7, 0x444466);
        B.erect(cx - 4, h - 6, 4, 5, light(col, 0.3), 180);
        B.erect(cx + 1, h - 6, 4, 5, light(col, 0.3), 180);
        K.dome(B, cx, 1, Math.round(w * 0.25), mix(0x2a2745, col, 0.3), { ry: 3, lantern: false });
        B.light(w * 0.3, h / 2, col, 14, 'spot');
        B.light(w * 0.7, h / 2, col, 14, 'spot');
    };

    PL.dataKeyCampus = function (b) {
        if (b.id === 'uni_main')
            return String(new Date().getHours()) + ':' + Math.floor(new Date().getMinutes() / 5);
        if (b.id === 'convention_center' && typeof ConferenceData !== 'undefined' && ConferenceData._active)
            return String(ConferenceData._active.color);
        return '';
    };
})();

/* The classic city's generic facade (the final `else` of buildBuildings): used for any
   non-lab building without a bespoke branch — Legacy Systems and the Robotics district. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);
    D.generic = function (B, b, w, h) {
        const col = b.color ? (typeof b.color === 'number' ? b.color : hex(b.color)) : 0x6b7280;
        const floors = PL.floorsOf(b);
        const body = mix(0x9aa8bc, col, 0.22);
        K.wall(B, 0, 0, w, h, body, 'panel', { pitch: 8, seamY: 6 });
        for (let y = 5; y < h; y++)
            for (let x = 0; x < Math.round(w / 3); x++)
                B.px(x, y, mix(B.get(x, y) >= 0 ? B.get(x, y) : body, col, 0.06));
        B.rect(0, 0, w, 5, mix(col, body, 0.15));
        B.rect(0, 0, w, 1, light(col, 0.3));
        B.rect(0, 4, w, 1, dark(col, 0.3));
        for (let i = 0; i < w; i++) B.epx(i, 1, col, 90);
        const cols = Math.floor(b.w / 24);
        const doorL = b.w / 2 - 8;
        const doorR = b.w / 2 + 8;
        for (let f = 0; f < floors; f++)
            for (let c = 0; c < cols; c++) {
                const wx = 10 + c * 24;
                const wy = 20 + f * 18;
                if (f === floors - 1 && wx + 12 > doorL && wx < doorR) continue;
                const x = q(wx);
                const y = q(wy);
                if (y + 3 > h - 1) continue;
                const lit = PL.labNoise((b.x | 0) + f * 131 + c * 17) > 0.35;
                B.rect(x - 1, y - 1, 6, 5, dark(body, 0.3));
                for (let j = 0; j < 3; j++)
                    for (let i = 0; i < 4; i++) {
                        B.px(x + i, y + j, PL.dpick([0x9ab0c4, 0x56708a], j / 2, x + i, y + j));
                        if (lit) B.epx(x + i, y + j, j === 0 ? 0xfffaf0 : mix(0xf6f0e0, col, 0.1));
                    }
            }
        const dx = Math.round(w / 2) - 2;
        B.rect(dx, h - 6, 4, 6, 0x0a0a18);
        B.rect(dx, h - 6, 4, 1, mix(0x0a0a18, col, 0.5));
        B.erect(dx + 1, h - 5, 2, 5, 0xffeaa7, 120);
        B.light(w / 2, h, 0xffeaa7, 8, 'door');
    };
    D.bld_1 = D.generic;
    ['robotics_assembly', 'robotics_testing', 'robotics_deploy', 'robotics_rd'].forEach(
        (id) => (D[id] = D.generic)
    );
})();
