/* Pixel art — datacentres and chip fabs (operational and construction states), VC Row
   glass towers with per-firm rooftop emblems, and the classical embassies. Pixel
   transliterations of the matching buildBuildings() branches. Live overlays (tickers,
   "EST." completion labels, animated flags) stay classic objects on top. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    const labColor = (b, fb) => {
        const lab = b.lab && PL.LABS ? PL.LABS[b.lab] : null;
        if (lab && lab.color) return hex(lab.color);
        if (b.color) return typeof b.color === 'number' ? b.color : hex(b.color);
        return fb === undefined ? 0x64748b : fb;
    };

    // Rooftop name board on two legs, where the classic draws its name sign (-30..-12).
    // "Google (The Dalles)" reads GOOGLE / THE DALLES so two sites of one firm stay distinct.
    function roofBoard(B, b, w, col) {
        const maxW = Math.min(w - 2, q(150)) - 4;
        const lines = PL.wrap(b.name, maxW, 3, 2);
        const bw =
            Math.max.apply(
                null,
                lines.map((l) => PL.textW(l, 3))
            ) + 4;
        const bh = lines.length * 6 + 1;
        const x = Math.round(w / 2 - bw / 2);
        const y = -4 - bh;
        B.rect(Math.round(w / 2) - 4, -4, 1, 4, 0x333338);
        B.rect(Math.round(w / 2) + 3, -4, 1, 4, 0x333338);
        B.rect(x, y, bw, bh, 0x0a0a1a);
        K.neonBox(B, x, y, bw, bh, dark(col, 0.1));
        lines.forEach((ln, i) => {
            const tx = Math.round(w / 2 - PL.textW(ln, 3) / 2);
            B.text(ln, tx, y + 1 + i * 6, i ? dark(col, 0.1) : col, 3);
            B.etext(ln, tx, y + 1 + i * 6, light(col, i ? 0.1 : 0.25), 3);
        });
        B.light(w / 2, y + bh / 2, col, Math.max(8, bw * 0.5), 'neon');
    }

    // Steel frame, tower crane, barriers — shared by DC and fab construction sites.
    function construction(B, b, w, h, col, craneX, craneTop) {
        for (let x = 0; x < w; x++)
            for (let y = h - 3; y < h; y++)
                B.px(
                    x,
                    y,
                    PL.dpick(
                        [0x6a4a26, 0x78582e, 0x92703a],
                        PL.hash(B.seed, x, y) * 0.8 + (y === h - 2 ? 0.3 : 0),
                        x,
                        y
                    )
                );
        const top = h - q(50);
        for (let y = top; y < h - 3; y++)
            for (let x = q(10); x < w - q(10); x++) if (PL.bayer(x, y) < 0.35) B.px(x, y, 0x475569, 150);
        for (let x = q(15); x < w - q(15); x += q(25)) B.rect(x, top, 1, h - 3 - top, 0x64748b);
        for (let y = top + 1; y < h - 3; y += q(14)) B.rect(q(10), y, w - q(20), 1, 0x64748b);
        B.rect(q(10), top, w - q(20), 1, col);
        // Crane mast, jib, cable and a dangling beam.
        const cx = q(b.w * craneX);
        const ct = h - q(craneTop);
        for (let y = ct; y < h - 3; y++)
            (B.px(cx, y, y % 2 ? 0xe0a820 : 0xfbbf24), B.px(cx + 1, y, 0xc88a10));
        B.rect(q(b.w * (craneX - 0.2)), ct, q(b.w * 0.3), 1, 0xfbbf24);
        B.rect(cx - 1, ct - 1, 3, 1, 0xe0a820);
        B.rect(q(b.w * (craneX - 0.15)), ct + 1, 1, q(32), 0x94a3b8);
        B.rect(q(b.w * (craneX - 0.18)), ct + 1 + q(32), 3, 1, 0x64748b);
        B.blink(cx, ct - 1, 0xff4050, 1.6, 0.2);
        for (let x = 0; x < w; x += q(20)) B.rect(x, h - 4, 3, 1, 0xef4444);
        // Dark label box where the live "EST." completion text is drawn.
        if (b.dcData && b.dcData.completion) B.rect(Math.round(w / 2) - 10, h - 10, 20, 4, 0x0a0a10);
    }

    // ── Datacentres ─────────────────────────────────────────────────────────
    D['type:datacenter'] = function (B, b, w, h) {
        const col = labColor(b);
        const acc = PL.lum(col) < 0.1 ? 0xe8e8ee : col;
        roofBoard(B, b, w, acc);
        if (b.dcData && b.dcData.status === 'construction') return construction(B, b, w, h, acc, 0.7, 95);
        const top = h - q(65);
        const wall = mix(0x5a6878, acc, 0.06);
        K.wall(B, 2, top, w - 4, h - top, wall, 'panel', { pitch: 3 });
        // Roof equipment band and HVAC units every 30 world px.
        B.rect(2, top - 1, w - 4, 1, 0x6a7a8a);
        for (let x = 15; x < b.w - 30; x += 30) {
            const X = q(x);
            B.rect(X, top - 4, 5, 3, 0x7a8898);
            B.rect(X, top - 4, 5, 1, 0x9aa8b8);
            B.rect(X + 1, top - 5, 3, 1, 0x7a8898);
            B.ellipse(X + 2, top - 3, 1.2, 1, 0x3a4048);
        }
        // Server-room glow strips every 14 world px, with rack LEDs.
        for (let y = q(h * 3 - 58); y < h - 4; y += q(14)) {
            B.rect(4, y, w - 8, 3, 0x0e2a38);
            for (let x = 4; x < w - 4; x++) {
                B.epx(x, y, mix(0x22d3ee, 0x06b6d4, 0.5), 150);
                const r = PL.hash(B.seed, x, y);
                if (x % 2 === 0 && r > 0.3) {
                    const c = r > 0.9 ? 0xffb84a : r > 0.6 ? acc : 0x7aff9a;
                    B.px(x, y + 1, dark(c, 0.3));
                    B.epx(x, y + 1, c);
                }
            }
        }
        // Accent stripe and green power LEDs along the top.
        B.rect(2, top, w - 4, 1, acc);
        for (let x = 20; x < b.w - 20; x += 18)
            (B.px(q(x), top + 1, 0x2a8a4a), B.epx(q(x), top + 1, 0x7aff9a));
        // Loading dock and security fence posts.
        B.rect(Math.round(w / 2) - 5, h - 4, 10, 2, 0x1e293b);
        B.rect(Math.round(w / 2) - 4, h - 4, 8, 1, 0x475569);
        B.erect(Math.round(w / 2) - 4, h - 3, 8, 1, 0xffd88a, 200);
        B.light(w / 2, h - 1, 0xffd88a, 10, 'door');
        B.rect(0, h - 3, 1, 3, 0x475569);
        B.rect(w - 1, h - 3, 1, 3, 0x475569);
    };

    // ── Chip fabs: cleanroom white with yellow lithography light ────────────
    D['type:chipfab'] = function (B, b, w, h) {
        const col = labColor(b);
        roofBoard(B, b, w, col);
        if (b.dcData && b.dcData.status === 'construction') return construction(B, b, w, h, col, 0.6, 85);
        const top = h - q(60);
        K.wall(B, 2, top, w - 4, h - top, 0xe2e8f0, 'panel', { pitch: 6, seamY: 7 });
        // Cleanroom yellow lighting strips every 12 world px.
        for (let y = q(h * 3 - 52); y < h - 3; y += q(12)) {
            B.rect(4, y, w - 8, 2, 0xd8c890);
            for (let x = 4; x < w - 4; x++) {
                B.px(x, y, x % 5 === 0 ? 0xb8a870 : 0xe8d8a0);
                B.epx(x, y, 0xffe07a, 170);
                B.epx(x, y + 1, 0xffd060, 120);
            }
        }
        // Filtered air intakes on the roof.
        B.rect(2, top - 1, w - 4, 1, 0xcbd5e1);
        for (let x = 12; x < b.w - 20; x += 20) {
            B.rect(q(x), top - 3, 4, 2, 0x94a3b8);
            B.rect(q(x), top - 3, 4, 1, 0xb4c0cc);
        }
        B.rect(2, top, w - 4, 1, col);
        // Hazmat markings and the entry.
        for (let i = 0; i < 10; i++) B.px(Math.round(w / 2) - 5 + i, h - 3, i % 2 ? 0x1a1a1e : 0xfbbf24);
        K.lobby(B, 3, h - 7, Math.max(8, Math.round(w * 0.3)), 4, {
            accent: col,
            interior: 0xfff4d0,
            planters: false,
        });
    };

    // ── VC Row: brand-coloured glass towers with per-firm emblems ───────────
    const VC_FALLBACK = {
        vcrow_apex: '#e07a5f',
        vcrow_horizon: '#b23b34',
        vcrow_thrive: '#6366f1',
        vcrow_foundersfund: '#38bdf8',
        vcrow_launchpad: '#ff6a00',
        vcrow_mgx: '#c9a227',
        vcrow_titan: '#9aa0a6',
        vcrow_exchange: '#ef4444',
        vcrow_cryptex: '#f7931a',
    };
    function vcEmblem(B, id, cx, cy, bc) {
        const P = (x, y, c) => (B.px(cx + x, cy + y, c), B.epx(cx + x, cy + y, light(c, 0.2), 220));
        switch (id) {
            case 'vcrow_horizon':
                (P(0, 3, 0x5a3a22), P(0, 2, 0x5a3a22));
                [
                    [0, -4],
                    [-1, -3],
                    [0, -3],
                    [1, -3],
                    [-1, -2],
                    [0, -2],
                    [1, -2],
                    [-2, -1],
                    [-1, -1],
                    [0, -1],
                    [1, -1],
                    [2, -1],
                    [-2, 0],
                    [-1, 0],
                    [0, 0],
                    [1, 0],
                    [2, 0],
                    [-3, 1],
                    [-2, 1],
                    [-1, 1],
                    [0, 1],
                    [1, 1],
                    [2, 1],
                    [3, 1],
                ].forEach((p) => P(p[0], p[1], bc));
                break;
            case 'vcrow_titan':
                for (let i = -4; i <= 4; i++) (P(i, -1, i === -4 ? light(bc, 0.3) : bc), P(i, 1, bc));
                break;
            case 'vcrow_mgx':
                for (let j = -3; j <= 3; j++)
                    for (let i = -(3 - Math.abs(j)); i <= 3 - Math.abs(j); i++)
                        P(i, j, i >= 0 && j <= 0 ? light(bc, 0.35) : bc);
                break;
            case 'vcrow_thrive':
                [
                    [-3, 2],
                    [-2, 1],
                    [-1, 0],
                    [0, 1],
                    [1, 0],
                    [2, -1],
                    [3, -2],
                    [2, -2],
                    [3, -1],
                    [1, -2],
                ].forEach((p) => P(p[0], p[1], bc));
                break;
            case 'vcrow_foundersfund':
                [
                    [0, -3],
                    [0, -2],
                    [-1, -1],
                    [0, -1],
                    [1, -1],
                    [-1, 0],
                    [0, 0],
                    [1, 0],
                    [-2, 1],
                    [2, 1],
                ].forEach((p) => P(p[0], p[1], bc));
                (P(0, 2, 0xef4444), P(0, 3, 0xf59e0b));
                break;
            case 'vcrow_launchpad':
                for (let j = -3; j <= 3; j++)
                    for (let i = -3; i <= 3; i++)
                        if (!((i === -3 || i === 3) && (j === -3 || j === 3))) P(i, j, bc);
                [
                    [-1, -1],
                    [1, -1],
                    [0, 0],
                    [0, 1],
                ].forEach((p) => P(p[0], p[1], 0xffffff));
                break;
            case 'vcrow_apex':
                for (let j = -2; j <= 2; j++) for (let i = -4; i <= 4; i++) P(i, j, bc);
                [
                    [-3, 0],
                    [-3, 1],
                    [0, 0],
                    [0, 1],
                    [3, 0],
                    [3, 1],
                ].forEach((p) => P(p[0], p[1], 0x0c1420));
                break;
            default:
                [
                    [0, -1],
                    [-1, 0],
                    [0, 0],
                    [1, 0],
                    [0, 1],
                ].forEach((p) => P(p[0], p[1], bc));
                P(-1, -1, light(bc, 0.5));
        }
    }
    D['pre:vcrow'] = function (B, b, w, h) {
        const bc = b.color
            ? typeof b.color === 'number'
                ? b.color
                : hex(b.color)
            : hex(VC_FALLBACK[b.id] || '#c9a227');
        const glass = 0x16202e;
        // Dark glass body with pilasters, and the brand crown band.
        for (let y = 3; y < h; y++)
            for (let x = 0; x < w; x++)
                B.px(x, y, x < 1 ? light(glass, 0.3) : x >= w - 2 ? dark(glass, 0.3) : mix(glass, bc, 0.06));
        B.rect(0, 0, w, 3, bc);
        B.rect(0, 0, w, 1, light(bc, 0.35));
        B.rect(0, 3, w, 1, dark(glass, 0.3));
        for (let i = 0; i < w; i++) B.epx(i, 1, bc, 110);
        // Curtain wall, lit panes from the classic's seeded sequence.
        const glassTop = 16;
        const glassBot = h * 3 - 22;
        const colW = 20;
        const nCols = Math.max(2, Math.floor((b.w - 12) / colW));
        const gutter = (b.w - 12 - nCols * (colW - 4)) / (nCols + 1);
        let gseed = (b.x | 0) + b.w;
        const rnd = () => {
            gseed = (gseed * 16807) % 2147483647;
            return (gseed - 1) / 2147483646;
        };
        for (let ci = 0; ci < nCols; ci++) {
            const wx = q(6 + gutter + ci * (colW - 4 + gutter));
            const pw = Math.max(2, q(colW - 6));
            for (let wy = glassTop; wy < glassBot; wy += 15) {
                const lit = rnd() > 0.42;
                const y = q(wy);
                for (let j = 0; j < 4; j++)
                    for (let i = 0; i < pw; i++) {
                        let c = PL.dpick([0x8aa4c4, 0x5a7494, 0x34485e], j / 3, wx + i, y + j);
                        if ((wx + i + (y + j) * 0.6 + (B.seed % 23)) % 19 < 1.6) c = light(c, 0.3);
                        B.px(wx + i, y + j, c);
                        if (lit)
                            B.epx(
                                wx + i,
                                y + j,
                                j === 0 ? mix(0xf6e2b0, bc, 0.3) : j === 3 ? 0xd8b880 : 0xeed49a
                            );
                    }
            }
            B.rect(wx - 1, q(glassTop), 1, q(glassBot - glassTop), 0x0a1018);
        }
        for (let sy = glassTop - 2; sy < glassBot; sy += 15) B.rect(2, q(sy), w - 4, 1, mix(glass, bc, 0.25));
        // Two-storey lobby with brand portal, revolving door and canopy.
        K.lobby(B, 2, h - 7, w - 4, 7, { accent: bc, frame: 0x0a1622, interior: 0xffe9a8, planters: false });
        const name = PL.fit(b.name, w - 8, 3);
        const pw = PL.textW(name, 3) + 4;
        B.rect(Math.round(w / 2 - pw / 2), h - 15, pw, 7, 0x0a0e16);
        K.neonBox(B, Math.round(w / 2 - pw / 2), h - 15, pw, 7, bc);
        B.text(name, Math.round(w / 2 - pw / 2) + 2, h - 14, light(bc, 0.2), 3);
        B.etext(name, Math.round(w / 2 - pw / 2) + 2, h - 14, light(bc, 0.35), 3);
        B.light(w / 2, h - 11, bc, Math.max(10, pw * 0.5), 'neon');
        // Rooftop penthouse and the firm's emblem above it.
        B.rect(Math.round(w / 2) - 8, -3, 16, 3, 0x0a1018);
        B.rect(Math.round(w / 2) - 8, -3, 16, 1, mix(0x0a1018, bc, 0.4));
        vcEmblem(B, b.id, Math.round(w / 2), -8, bc);
        B.light(w / 2, -8, bc, 8, 'neon');
    };

    // ── Embassies: classical marble with a flag-colour architrave ───────────
    // Name carved into the frieze, a shaded portico behind five doric columns.
    D['pre:embassy'] = function (B, b, w, h) {
        const flagCols = b.flagColors ||
            {
                us: [0xb22234, 0xffffff, 0x3c3b6e],
                cn: [0xde2910, 0xffde00],
                eu: [0x003399, 0xffcc00],
                uk: [0x012169, 0xffffff, 0xc8102e],
                in: [0xff9933, 0xffffff, 0x138808],
                ae: [0x00732f, 0xffffff, 0x000000],
            }[b.id.split('_')[1]] || [0xcccccc];
        const accent = typeof b.accent === 'number' ? b.accent : flagCols[0];
        const marble = 0xeee8d6;
        const shadow = 0xb8b098;
        // Pediment with an accent-filled tympanum.
        const ph = q(16);
        for (let j = 0; j < ph; j++) {
            const inset = Math.round(((ph - j) / ph) * (w / 2));
            for (let x = inset; x < w - inset; x++)
                B.px(x, -ph + j, j === 0 || x === inset || x === w - inset - 1 ? 0xa8a288 : 0xd3cdb4);
            const inner = Math.round(((ph - j) / ph) * (w / 2 - 3)) + 3;
            if (j > 1) for (let x = inner; x < w - inner; x++) B.px(x, -ph + j, mix(0xd3cdb4, accent, 0.55));
        }
        // Flag-colour stripe, then the frieze with the carved name.
        const sw = w / flagCols.length;
        flagCols.forEach((c, i) => B.rect(Math.round(i * sw), 0, Math.ceil(sw), 1, c));
        const lines = PL.wrap(b.name || '', w - 4, 3, 2);
        const fh = lines.length * 6 + 1;
        K.wall(B, 0, 1, w, fh, 0xe2dcc8, 'stone', { edges: false });
        lines.forEach((ln, i) => {
            const tx = Math.round(w / 2 - PL.textW(ln, 3) / 2);
            B.text(ln, tx, 2 + i * 6, 0x6a6048, 3);
        });
        const top = 1 + fh;
        B.rect(-1, top, w + 2, 1, 0xd6d0b6);
        B.rect(0, top + 1, w, 1, shadow);
        // Portico: a shaded back wall behind the colonnade.
        for (let y = top + 2; y < h - 3; y++)
            for (let x = 0; x < w; x++)
                B.px(x, y, PL.dpick([0xc8c0a8, 0xb0a890], (y - top) / (h - top), x, y));
        // Windows either side of the door.
        const dw = q(22);
        const dh = Math.min(q(26), h - top - 5);
        const dx = Math.round(w / 2 - dw / 2);
        const dy = h - 3 - dh;
        [Math.round(w / 2 - 50 / 3), Math.round(w / 2 + 30 / 3)].forEach((wx) => {
            if (wx < 5 || wx + 7 > w - 5) return;
            const wy = top + 3;
            const wh = Math.max(3, h - 5 - wy);
            B.rect(wx, wy, 7, wh, 0x1a1a28);
            for (let j = 1; j < wh - 1; j++)
                for (let i = 1; i < 6; i++) {
                    B.px(wx + i, wy + j, PL.dpick([0x9ab0c8, 0x5a7090], j / wh, wx + i, wy + j));
                    B.epx(wx + i, wy + j, 0xffe0a0, 210);
                }
            B.rect(wx + 3, wy + 1, 1, wh - 2, 0x2a2a38);
            B.rect(wx + 1, wy + Math.round(wh / 2), 5, 1, 0x2a2a38);
        });
        // Grand double door with brass knobs and an accent lintel.
        B.rect(dx - 1, dy, dw + 2, dh, 0x2e2014);
        B.rect(dx, dy + 1, dw, dh - 1, 0x4a3422);
        B.rect(dx + Math.floor(dw / 2), dy + 1, 1, dh - 1, 0x1a1008);
        B.px(dx + Math.floor(dw / 2) - 1, dy + Math.floor(dh / 2), 0xfbbf24);
        B.px(dx + Math.floor(dw / 2) + 1, dy + Math.floor(dh / 2), 0xfbbf24);
        B.rect(dx - 1, dy - 1, dw + 2, 1, accent);
        for (let j = 1; j < dh; j++)
            (B.epx(dx + 1, dy + j, 0xffd9a0, 150), B.epx(dx + dw - 2, dy + j, 0xffd9a0, 150));
        B.light(w / 2, h, 0xffd9a0, 12, 'door');
        // Five doric columns in front of the portico.
        const nCols = 5;
        const inset = q(14);
        const sp = (w - inset * 2) / (nCols - 1);
        for (let i = 0; i < nCols; i++) {
            const cx = Math.round(inset + i * sp) - 1;
            if (i === 2) continue; // the door opens in the middle bay
            B.rect(cx - 1, top + 2, 5, 1, 0xd6d0b6);
            for (let y = top + 3; y < h - 4; y++) {
                B.px(cx, y, 0xfffdf4);
                B.px(cx + 1, y, marble);
                B.px(cx + 2, y, 0xa8a088);
            }
            B.rect(cx - 1, h - 4, 5, 1, 0xd6d0b6);
        }
        // Lanterns flanking the door.
        [dx - 2, dx + dw + 1].forEach((lx) => {
            B.px(lx, dy + 1, 0x333333);
            B.px(lx, dy + 2, 0xfbbf24);
            B.epx(lx, dy + 2, 0xffe8a0);
            B.light(lx, dy + 2, 0xffd08a, 6, 'lantern');
        });
        // Steps.
        B.rect(-1, h - 3, w + 2, 2, 0xccc5ac);
        B.rect(0, h - 1, w, 1, 0xbab396);
    };

    PL.dataKeyRow = function (b) {
        if ((b.id.startsWith('dc_') || b.id.startsWith('fab_')) && b.dcData)
            return (b.dcData.status || '') + (b.dcData.completion || '');
        if (b.type === 'vcrow' && b.color) return String(b.color);
        if (b.type === 'embassy' && b.flagColors) return b.flagColors.join('-') + (b.accent || '');
        return '';
    };
})();
