/* Pixel art — the social strip (API Café, RLHF Gym, LMSYS Arena, Open Source Hub,
   Singularity City Times). Each is a pixel transliteration of the matching
   Environment._draw*Ext() facade: same composition at 1/3 scale (1 art px = 3 world px),
   same seeded lit-window pattern, same identity props. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});

    // The live city's deterministic noise (Environment._labHash / _labNoise), so the same
    // panes are lit here as in the classic facade.
    PL.labHash = function (id) {
        let hsh = 0;
        const s = String(id || 'lab');
        for (let i = 0; i < s.length; i++) hsh = ((hsh << 5) - hsh + s.charCodeAt(i)) | 0;
        return Math.abs(hsh);
    };
    PL.labNoise = function (seed) {
        const x = Math.sin(seed * 12.9898 + 78.233) * 43758.5453;
        return x - Math.floor(x);
    };
    const q = (v) => Math.round(v / PL.ART);
    const noiseFor = (b) => {
        const seed = PL.labHash(b.id);
        return (i) => PL.labNoise(seed + i);
    };

    // A lit pane: day glass in base, lamp colour in emit.
    function pane(B, x, y, w, h, lit, col, o) {
        o = o || {};
        const gTop = o.gTop === undefined ? 0x9cb8d0 : o.gTop;
        const gBot = o.gBot === undefined ? 0x4e6a88 : o.gBot;
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                if (o.arch && j === 0 && (i === 0 || i === w - 1)) continue;
                B.px(
                    x + i,
                    y + j,
                    PL.dpick([gTop, mix(gTop, gBot, 0.5), gBot], j / Math.max(1, h - 1), x + i, y + j)
                );
                if (lit) B.epx(x + i, y + j, j === 0 ? light(col, 0.25) : col);
            }
        if (w > 1) B.px(x + (o.arch ? 1 : 0), y, light(gTop, 0.4));
    }

    // ── API Café — warm brick coffee house ──────────────────────────────────
    D.cafe = function (B, b, w, h) {
        const n = noiseFor(b);
        const floors = PL.floorsOf(b);
        const AC = 0xf59e0b;
        const CREAM = 0xf5e6c8;
        K.wall(B, 0, 3, w, h - 3, 0x6e3a2a, 'brick');
        // Cream parapet + amber trim + shadow.
        B.rect(0, 0, w, 2, CREAM);
        B.rect(0, 0, w, 1, light(CREAM, 0.3));
        B.rect(0, 2, w, 1, AC);
        B.rect(0, 3, w, 1, dark(0x6e3a2a, 0.4));
        // Rooftop terrace: railing + two planters (the cafe_rooftop floor).
        B.rect(0, -3, w, 1, 0xa9825a);
        for (let x = 1; x < w - 1; x += 3) (B.px(x, -2, 0x8a6a4a), B.px(x, -1, 0x8a6a4a));
        [2, w - 8].forEach((px) => {
            B.rect(px, -2, 6, 2, 0x7c2d12);
            B.rect(px, -2, 6, 1, light(0x7c2d12, 0.25));
            PL.S.bush(B.base, B.X(px), B.Y(-3), 6, B.seed + px, PL.S.LEAF.green);
        });
        // Arched upper windows, warm-lit, some with flower boxes.
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 14 > h * PL.ART - 32) break;
            const cols = Math.max(2, Math.floor((b.w - 16) / 26));
            const gap = (b.w - cols * 16) / (cols + 1);
            for (let c = 0; c < cols; c++) {
                const wx = q(gap + c * (16 + gap));
                const y = q(wy);
                B.rect(wx - 1, y - 1, 7, 6, dark(0x6e3a2a, 0.45));
                pane(B, wx, y, 5, 4, n(f * 31 + c * 7) < 0.8, 0xffd9a0, { arch: true });
                B.rect(wx - 1, y + 4, 7, 1, AC);
                if (n(f * 17 + c * 5) < 0.4) {
                    B.rect(wx, y + 3, 5, 1, 0x2d6a4f);
                    B.px(wx + 1, y + 3, 0xef4444);
                    B.px(wx + 3, y + 3, 0xef4444);
                }
            }
        }
        // Scalloped awning over the shopfront.
        const awnY = h - 10;
        for (let x = 1, i = 0; x < w - 1; x += 4, i++) {
            const c = i % 2 ? CREAM : AC;
            const sw = Math.min(4, w - 1 - x);
            B.rect(x, awnY, sw, 2, c);
            B.rect(x, awnY, sw, 1, light(c, 0.2));
            if (sw > 2) B.rect(x + 1, awnY + 2, sw - 2, 1, dark(c, 0.12));
        }
        B.rect(1, awnY + 4, w - 2, 1, dark(0x6e3a2a, 0.5));
        // Shopfront glass: warm glow, pendant lamps, pastry-case silhouettes.
        const sy = h - 7;
        B.rect(1, sy, w - 2, 7, 0x1a1208);
        for (let gx = 8; gx < b.w - 26; gx += 24)
            pane(B, q(gx), sy + 1, 6, 5, true, 0xffcf88, { gTop: 0x5a4a3a, gBot: 0x3a2a1e });
        for (let gx = 10; gx < b.w - 24; gx += 48)
            (B.rect(q(gx), h - 3, 5, 2, 0x3a2a18), B.erect(q(gx), h - 3, 5, 1, 0xe8a060));
        for (let gx = 16; gx < b.w - 16; gx += 24)
            (B.epx(q(gx), sy + 2, 0xffe9a8), B.px(q(gx), sy + 1, 0x3a2a18));
        // Entrance.
        const dx = Math.round(w / 2) - 3;
        B.rect(dx, sy, 6, 6, 0x140d06);
        B.rect(dx, sy, 6, 1, AC);
        for (let j = 1; j < 6; j++) (B.epx(dx + 1, sy + j, 0xffe0a8), B.epx(dx + 4, sy + j, 0xffe0a8));
        B.px(dx + 4, sy + 3, 0xffe9a8);
        B.light(w / 2, h - 1, 0xffc878, 16, 'shop');
        // Projecting shingle sign: steaming coffee cup on a round board.
        B.rect(-5, h - 19, 5, 1, 0x5a3a22);
        B.px(-3, h - 18, 0x5a3a22);
        B.ellipse(-3, h - 15, 3.5, 3.5, 0x0e0a06);
        for (let a = 0; a < 16; a++) {
            const px = Math.round(-3 + Math.cos((a / 16) * PL.TAU) * 3.4);
            const py = Math.round(h - 15 + Math.sin((a / 16) * PL.TAU) * 3.4);
            B.px(px, py, AC);
            B.epx(px, py, 0xffc050, 200);
        }
        B.rect(-4, h - 15, 3, 2, CREAM);
        B.px(-1, h - 15, CREAM);
        (B.px(-4, h - 17, AC), B.px(-3, h - 18, AC));
        (B.epx(-4, h - 17, 0xffd27a), B.epx(-3, h - 18, 0xffd27a));
        B.light(-3, h - 15, 0xffb84a, 8, 'neon');
        // Sidewalk terrace: striped umbrellas + tables flanking the entrance.
        [6, q(b.w - 34)].forEach((tx) => {
            B.rect(tx + 2, h - 8, 1, 8, 0x8a6a4a);
            for (let i = -2; i <= 6; i++) {
                const lift = Math.abs(i - 2) > 2 ? 0 : 1;
                B.px(tx + i, h - 9 - lift, Math.floor((i + 2) / 2) % 2 ? CREAM : AC);
                if (lift) B.px(tx + i, h - 9, dark(i % 2 ? CREAM : AC, 0.2));
            }
            B.rect(tx + 1, h - 3, 3, 1, 0x3a2a18);
            B.px(tx + 2, h - 2, 0x3a2a18);
            (B.px(tx - 1, h - 2, 0x3a2a18), B.px(tx - 1, h - 1, 0x3a2a18));
            (B.px(tx + 5, h - 2, 0x3a2a18), B.px(tx + 5, h - 1, 0x3a2a18));
        });
    };

    // ── RLHF Gym — glass atrium with training silhouettes, rooftop lap pool ─
    D.gym = function (B, b, w, h) {
        const n = noiseFor(b);
        const floors = PL.floorsOf(b);
        const AC = 0x22d3ee;
        const body = 0x283444;
        K.wall(B, 0, 3, w, h - 3, body, 'panel', { pitch: 6 });
        // Cyan crown.
        B.rect(0, 0, w, 3, AC);
        B.rect(0, 0, w, 1, light(AC, 0.35));
        for (let i = 0; i < w; i++) B.epx(i, 1, AC, 120);
        B.rect(0, 3, w, 1, dark(body, 0.4));
        // Rooftop lap pool (left) with lane glints + ladder; HVAC on the right.
        const poolW = q(b.w * 0.26);
        B.rect(2, -2, poolW, 2, 0x0e7490);
        B.rect(2, -2, poolW, 1, 0x38bdf8);
        for (let px = 4; px < poolW - 1; px += 5) B.rect(px, -2, 2, 1, 0xd8f4ff);
        B.rect(2 + poolW - 1, -3, 1, 3, 0xe2e8f0);
        B.rect(2 + poolW, -3, 1, 3, 0xe2e8f0);
        K.ac(B, w - 12, 0, 4);
        // Full-height glass atrium (left) with a training silhouette per floor.
        const atX = 3;
        const atW = q(Math.max(52, b.w * 0.3));
        const atTop = 4;
        const atBot = h - 8;
        B.rect(atX, atTop, atW, atBot - atTop, 0x0a1220);
        for (let f = 0; f < floors - 1; f++) {
            const by = q(16 + f * 18);
            if (by + 4 > atBot) break;
            pane(B, atX + 1, by, atW - 2, 4, true, 0xd6f6ff, { gTop: 0xa8d8e8, gBot: 0x5a98b0 });
            for (let i = 0; i < atW - 2; i++) B.epx(atX + 1 + i, by, mix(0xd6f6ff, AC, 0.35));
            const cx = atX + Math.round(atW / 2);
            const S = 0x06121c;
            const kind = f % 4;
            const put = (x, y) => (B.px(cx + x, by + y, S), B.epx(cx + x, by + y, S));
            if (kind === 0)
                [
                    [-3, 3],
                    [-2, 3],
                    [-1, 3],
                    [0, 3],
                    [1, 3],
                    [2, 3],
                    [3, 3],
                    [0, 1],
                    [0, 2],
                    [0, 0],
                    [1, 2],
                ].forEach((p) => put(p[0], p[1]));
            else if (kind === 1)
                [
                    [-3, 2],
                    [-2, 2],
                    [-1, 2],
                    [0, 2],
                    [1, 2],
                    [2, 2],
                    [3, 2],
                    [-3, 1],
                    [3, 1],
                    [-3, 3],
                    [3, 3],
                    [0, 3],
                ].forEach((p) => put(p[0], p[1]));
            else if (kind === 2)
                [
                    [0, 0],
                    [0, 1],
                    [-1, 1],
                    [1, 1],
                    [0, 2],
                    [-1, 2],
                    [1, 2],
                    [0, 3],
                ].forEach((p) => put(p[0], p[1]));
            else
                [
                    [0, 1],
                    [-1, 2],
                    [0, 2],
                    [1, 2],
                    [-2, 3],
                    [-1, 3],
                    [0, 3],
                    [1, 3],
                    [2, 3],
                ].forEach((p) => put(p[0], p[1]));
        }
        B.rect(atX + Math.round(atW / 2), atTop, 1, atBot - atTop, 0x0a0e18);
        // Hanging banner with a dumbbell mark (right edge).
        const bnX = q(b.w - 24);
        B.rect(bnX, 4, 5, 15, 0x0c4a6e);
        B.rect(bnX, 4, 5, 1, AC);
        B.px(bnX + 2, 18, body);
        (B.px(bnX, 18, 0x0c4a6e), B.px(bnX + 4, 18, 0x0c4a6e));
        B.rect(bnX + 1, 10, 3, 1, 0xffffff);
        B.rect(bnX, 9, 1, 3, 0xffffff);
        B.rect(bnX + 4, 9, 1, 3, 0xffffff);
        B.erect(bnX, 9, 5, 3, 0xcff6ff, 160);
        // Window grid on the right wing.
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 12 > b.w * 0 + h * PL.ART - 24) break;
            for (let wx = 8 + atW * PL.ART + 10; wx + 15 < b.w - 24 - 4; wx += 22) {
                const x = q(wx);
                const y = q(wy);
                B.rect(x - 1, y - 1, 7, 5, dark(body, 0.4));
                pane(B, x, y, 5, 4, n(f * 43 + wx) < 0.62, 0xd6f6ff);
            }
        }
        // Reception floor: glass, turnstiles, cyan canopy.
        K.lobby(B, 1, h - 7, w - 2, 7, { accent: AC, frame: 0x0a141e, interior: 0xd6f6ff, planters: false });
        B.rect(Math.round(w / 2) - 5, h - 8, 10, 1, AC);
    };

    // ── LMSYS Arena — jumbotron bot match, floodlights, pennants, arch gate ──
    D.arena = function (B, b, w, h) {
        const n = noiseFor(b);
        const floors = PL.floorsOf(b);
        const AC = 0xef4444;
        const GOLD = 0xfbbf24;
        const body = 0x3a2230;
        K.wall(B, 0, 5, w, h - 5, body, 'concrete', { seams: false, seamY: 6 });
        B.rect(0, 5, w, 1, AC);
        // Raised centre bay behind the screen.
        const jbW = q(Math.min(b.w - 56, 150));
        const jbX = Math.round((w - jbW) / 2);
        B.rect(jbX - 2, 1, jbW + 4, 5, dark(body, 0.3));
        B.rect(jbX - 2, 0, jbW + 4, 1, AC);
        // Jumbotron: two fighter bots + a gold VS, ELO ticker pixels along the bottom.
        const scrY = q(16);
        const scrH = Math.max(6, q(Math.min(34, h * PL.ART - 60)));
        B.rect(jbX - 1, scrY - 1, jbW + 2, scrH + 2, 0x334155);
        for (let j = 0; j < scrH; j++)
            for (let i = 0; i < jbW; i++) {
                const c = j % 2 ? 0x07101a : 0x05070d;
                B.px(jbX + i, scrY + j, c);
                B.epx(jbX + i, scrY + j, 0x0a1a2a, 200);
            }
        const pcy = scrY + Math.round(scrH * 0.42);
        [
            [jbX + Math.round(jbW * 0.22), 0x3b82f6],
            [jbX + Math.round(jbW * 0.78), AC],
        ].forEach(([px, pc]) => {
            for (let j = -2; j <= 2; j++)
                for (let i = -4; i <= 4; i++) {
                    if ((i === -4 || i === 4) && (j === -2 || j === 2)) continue;
                    B.px(px + i, pcy + j, pc);
                    B.epx(px + i, pcy + j, pc);
                }
            [
                [-2, -1],
                [2, -1],
            ].forEach((e) => (B.px(px + e[0], pcy + e[1], 0xffffff), B.epx(px + e[0], pcy + e[1], 0xffffff)));
            for (let i = -1; i <= 1; i++) B.epx(px + i, pcy + 1, 0xffffff);
        });
        const vx = jbX + Math.round(jbW / 2);
        [
            [-3, -2],
            [-3, -1],
            [-2, 0],
            [-2, 1],
            [-1, -1],
            [-1, -2],
            [1, -2],
            [2, -2],
            [1, -1],
            [1, 0],
            [2, 0],
            [2, 1],
            [1, 1],
        ].forEach((p) => {
            B.px(vx + p[0], pcy + p[1], GOLD);
            B.epx(vx + p[0], pcy + p[1], 0xffe08a);
        });
        for (let tx = jbX + 1, i = 0; tx < jbX + jbW - 3; tx += 2, i++) {
            const c = [0x4ade80, 0xfbbf24, 0x38bdf8, 0xf87171][Math.floor(n(i) * 4)];
            B.epx(tx, scrY + scrH - 2, c);
            B.px(tx, scrY + scrH - 2, dark(c, 0.3));
        }
        B.light(vx, scrY + scrH / 2, 0x5ad0ff, 16, 'neon');
        // Championship pennants flanking the screen.
        [
            [jbX - 6, AC],
            [jbX + jbW + 2, 0x3b82f6],
        ].forEach(([px, pc]) => {
            if (px < 1 || px + 4 > w - 1) return;
            B.rect(px, 6, 4, 8, pc);
            (B.px(px, 14, pc), B.px(px + 3, 14, pc));
            (B.px(px + 1, 8, GOLD), B.px(px + 2, 8, GOLD));
            B.rect(px + 1, 11, 2, 1, GOLD);
        });
        // Floodlight masts at both roof edges.
        [4, w - 5].forEach((mx) => {
            B.rect(mx, -1, 1, 6, 0x64748b);
            B.rect(mx - 2, -3, 5, 2, 0x334155);
            B.erect(mx - 2, -3, 5, 1, 0xfef9c3);
            B.light(mx, -3, 0xfff8e0, 12, 'spot');
        });
        // Concourse windows below the screen.
        for (let f = 2; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (q(wy) < scrY + scrH + 1 || wy + 11 > h * PL.ART - 24) continue;
            for (let wx = 10; wx < b.w - 24; wx += 24) {
                const x = q(wx);
                B.rect(x - 1, q(wy) - 1, 7, 5, dark(body, 0.4));
                pane(B, x, q(wy), 5, 3, n(f * 57 + wx) < 0.55, 0xffd9c0);
            }
        }
        // Concourse floor: gold trim, grand arch gate, ticket booths.
        B.rect(1, h - 7, w - 2, 7, 0x1e1418);
        B.rect(1, h - 7, w - 2, 1, GOLD);
        const cx = Math.round(w / 2);
        for (let j = 0; j < 6; j++)
            for (let i = -4; i <= 4; i++) {
                if (j < 2 && Math.abs(i) > 2 + j) continue;
                B.px(cx + i, h - 6 + j, 0x05070d);
                B.epx(cx + i, h - 6 + j, 0x3a2410, 200);
            }
        for (let i = -4; i <= 4; i++)
            if (Math.abs(i) >= 3) B.px(cx + i, h - 6 + (Math.abs(i) === 4 ? 2 : 1), GOLD);
        B.epx(cx, h - 5, 0xffe9a8);
        [q(b.w * 0.22), q(b.w * 0.78 - 16)].forEach((bx) => {
            B.rect(bx, h - 6, 5, 6, 0x2a1e2a);
            B.rect(bx, h - 7, 6, 1, AC);
            B.erect(bx + 1, h - 5, 3, 2, 0xffe9a8);
        });
        B.light(cx, h - 2, 0xffc080, 18, 'shop');
    };

    // ── Open Source Hub — converted warehouse with a live code wall ─────────
    D.open_square = function (B, b, w, h) {
        const n = noiseFor(b);
        const floors = PL.floorsOf(b);
        const AC = 0xa855f7;
        const CODE = 0x4ade80;
        const pcols = [0x4ade80, 0xfbbf24, 0x38bdf8, 0xf87171, 0xa855f7];
        const body = 0x3a2a4a;
        K.wall(B, 0, 3, w, h - 3, body, 'brick', { mortar: dark(body, 0.3) });
        B.rect(0, 0, w, 3, AC);
        B.rect(0, 0, w, 1, light(AC, 0.3));
        B.rect(0, 3, w, 1, dark(body, 0.4));
        // Hackathon pennant string across the roof + a self-hosted dish.
        B.rect(1, -3, w - 2, 1, 0x94a3b8);
        for (let fx = 3, i = 0; fx < w - 3; fx += 4, i++) {
            B.px(fx, -2, pcols[i % 5]);
            B.px(fx + 1, -2, pcols[i % 5]);
            B.px(fx, -1, dark(pcols[i % 5], 0.2));
        }
        K.dish(B, 4, -3, 2);
        // Live code wall — giant terminal pane.
        const twX = 3;
        const twW = q(Math.max(64, b.w * 0.34));
        const twY = 5;
        const twH = Math.max(6, q(Math.min(42, h * PL.ART - 44)));
        B.rect(twX - 1, twY - 1, twW + 2, twH + 2, dark(CODE, 0.5));
        B.rect(twX, twY, twW, twH, 0x04070d);
        [
            [1, 0xf87171],
            [3, 0xfbbf24],
            [5, 0x4ade80],
        ].forEach(([dx, c]) => (B.px(twX + dx, twY + 1, c), B.epx(twX + dx, twY + 1, c)));
        const lines = Math.floor((twH - 3) / 1.2);
        for (let li = 0; li < lines && 3 + li < twH - 1; li++) {
            const y = twY + 3 + li;
            if (li % 2 === 1) continue;
            const indent = [0, 1, 3, 3, 1, 0, 1, 3, 1][li % 9];
            const lw = Math.max(2, Math.round(3 + n(li * 13) * (twW - 6 - indent)));
            const c = li % 4 === 3 ? AC : CODE;
            for (let i = 0; i < lw; i++) {
                B.px(twX + 1 + indent + i, y, dark(c, 0.3));
                B.epx(twX + 1 + indent + i, y, c, 230);
            }
        }
        B.light(twX + twW / 2, twY + twH / 2, CODE, Math.max(10, twW * 0.5), 'neon');
        // Git-branch emblem medallion.
        const gx = Math.round(twX + twW + (w - twX - twW) / 2);
        const gy = q(34);
        B.rect(gx - 5, gy - 5, 11, 11, 0x0a0714);
        K.neonBox(B, gx - 5, gy - 5, 11, 11, AC);
        B.rect(gx - 2, gy - 3, 1, 7, 0xe2e8f0);
        B.line(gx - 2, gy - 1, gx + 2, gy - 3, 0xe2e8f0);
        [
            [gx - 2, gy - 3, CODE],
            [gx - 2, gy + 3, AC],
            [gx + 2, gy - 3, 0xfbbf24],
        ].forEach(([x, y, c]) => (B.px(x, y, c), B.epx(x, y, c)));
        // Hackathon windows — nearly all lit, warm / cool / purple.
        for (let f = 0; f < floors - 1; f++) {
            const wy = 16 + f * 18;
            if (wy + 11 > h * PL.ART - 24) break;
            const startX = q(wy) < twY + twH + 1 ? twX + twW + 3 : 3;
            for (let x = startX; x < w - 8; x += 8) {
                const wx = x * 3;
                if (q(wy) < gy + 6 && q(wy) + 4 > gy - 5 && x + 5 > gx - 6 && x < gx + 6) continue;
                const rr = n(f * 71 + wx);
                B.rect(x - 1, q(wy) - 1, 7, 5, dark(body, 0.45));
                pane(B, x, q(wy), 5, 3, rr < 0.85, rr < 0.3 ? 0xd6ecff : rr < 0.6 ? 0xffe9c0 : 0xe9d5ff);
            }
        }
        // Street level: roll-up door, graffiti tags, poster wall, "</>".
        B.rect(1, h - 7, w - 2, 7, 0x1a1424);
        B.rect(1, h - 7, w - 2, 1, AC);
        [
            [0x22d3ee, q(b.w * 0.14), 3],
            [0xf472b6, q(b.w * 0.2), 2],
            [0x4ade80, q(b.w * 0.82), 2],
        ].forEach(([gc, x, r]) => {
            for (let i = -r; i <= r; i++)
                for (let j = -1; j <= 1; j++)
                    if (Math.abs(i) + Math.abs(j) * 2 <= r) B.px(x + i, h - 3 + j, mix(0x1a1424, gc, 0.55));
        });
        const tg = q(b.w * 0.16);
        [
            [-3, 0],
            [-2, -1],
            [-2, 1],
            [3, 0],
            [2, -1],
            [2, 1],
            [1, -1],
            [0, 0],
            [-1, 1],
        ].forEach((p) => B.px(tg + p[0], h - 4 + p[1], 0xf8fafc));
        for (let pi = 0; pi < 4; pi++) {
            const px = q(b.w * 0.62 + pi * 13);
            if (px + 3 > w - 2) break;
            B.rect(px, h - 6, 3, 4, [0x1e293b, 0x312e81, 0x3f1d38, 0x1a2e05][pi % 4]);
            B.rect(px, h - 6, 3, 1, pcols[pi % 5]);
            B.px(px + 1, h - 4, 0x94a3b8);
        }
        const dx = Math.round(w / 2) - 4;
        B.rect(dx, h - 6, 8, 6, 0x05070d);
        for (let y = h - 6; y < h; y += 1) if (y % 2 === 0) B.rect(dx, y, 8, 1, 0x1e293b);
        B.rect(dx, h - 6, 8, 1, CODE);
        B.erect(dx, h - 1, 8, 1, 0xd0b0ff, 200);
        B.light(dx + 4, h - 1, 0xb080ff, 12, 'door');
    };

    // ── Singularity City Times — stone newspaper office ─────────────────────
    D.times_hq = function (B, b, w, h) {
        const n = noiseFor(b);
        const floors = PL.floorsOf(b);
        B.named = true;
        const INK = 0x14141c;
        const CREAM = 0xd8d3c8;
        const RED = 0xb91c1c;
        const stone = 0x6a6070;
        K.wall(B, 0, 3, w, h - 3, stone, 'stone');
        for (let f = 1; f < floors; f++) B.rect(1, q(14 + f * 18) - 1, w - 2, 1, light(stone, 0.3));
        // Masthead band with the paper's name in pixel letters (replaces the serif Text).
        // The full name rarely fits one pixel line, so it wraps onto two above the facade.
        const words = String(b.name || 'The Times')
            .toUpperCase()
            .split(/\s+/);
        const lines = [];
        words.forEach((wd) => {
            const last = lines[lines.length - 1];
            if (last && PL.textW(last + ' ' + wd, 3) <= w - 4) lines[lines.length - 1] = last + ' ' + wd;
            else lines.push(wd);
        });
        const mh = lines.length * 6 + 1;
        const my = Math.min(0, 7 - mh);
        B.rect(0, my, w, mh, INK);
        B.rect(0, my, w, 1, CREAM);
        B.rect(0, my + mh - 1, w, 1, CREAM);
        lines.slice(0, 3).forEach((ln, i) => {
            const s = PL.fit(ln, w - 2, 3);
            const tx = Math.round((w - PL.textW(s, 3)) / 2);
            B.text(s, tx, my + 1 + i * 6, 0xf5f0e6, 3);
            B.etext(s, tx, my + 1 + i * 6, 0xfff8ec, 3);
        });
        // Street clock under the masthead.
        const ccx = Math.round(w / 2);
        const ccy = q(25) + 1;
        B.ellipse(ccx, ccy, 2.6, 2.6, CREAM);
        B.ellipse(ccx, ccy, 1.8, 1.8, 0x0d0d12);
        (B.px(ccx, ccy - 1, 0xf5f0e6), B.px(ccx + 1, ccy, 0xf5f0e6), B.px(ccx, ccy, 0xf5f0e6));
        (B.epx(ccx, ccy - 1, 0xfff4d0), B.epx(ccx + 1, ccy, 0xfff4d0));
        // Sash windows on the newsroom floors.
        for (let f = 0; f < floors - 1; f++) {
            const wy = 18 + f * 18;
            if (wy + 12 > h * PL.ART - 26) break;
            for (let wx = 10; wx < b.w - 20; wx += 24) {
                if (f === 0 && wx + 14 > ccx * 3 - 10 && wx < ccx * 3 + 10) continue;
                const x = q(wx);
                const y = q(wy) + 2;
                if (y + 4 > h - 9) continue;
                B.rect(x - 1, y - 1, 7, 6, dark(stone, 0.4));
                pane(B, x, y, 5, 4, n(f * 29 + wx) < 0.7, 0xf5eeda);
                B.rect(x, y + 2, 5, 1, dark(stone, 0.3));
            }
        }
        // Press hall: the printing press behind the ground-floor glass.
        const py = h - 8;
        B.rect(1, py, w - 2, 7, 0x1a1720);
        B.rect(1, py, w - 2, 1, CREAM);
        const prX = 3;
        const prW = q(Math.max(46, b.w * 0.34));
        for (let i = 0; i < prW; i++) {
            const t = i / prW;
            const y = Math.round(py + 3 + Math.sin(t * PL.TAU * 1.5) * 1.5);
            B.epx(prX + i, y, 0xe7e2d4, 220);
            B.px(prX + i, y, 0xa8a49a);
        }
        [0.25, 0.55, 0.85].forEach((t, i) => {
            const x = prX + Math.round(prW * t);
            const y = py + (i === 1 ? 5 : 2);
            B.ellipse(x, y, 1.4, 1.4, 0x3f3f46);
            B.px(x, y, 0x71717a);
        });
        B.rect(prX + 1, h - 3, prW - 2, 2, 0x27272e);
        B.rect(prX + 1, h - 3, prW - 2, 1, RED);
        B.erect(2, py + 1, prW + 2, 1, 0xfff0d0, 160);
        // Entrance + fresh paper bundle.
        const dx = Math.round(w / 2) - 3;
        B.rect(dx, h - 7, 6, 7, 0x0a0a10);
        B.rect(dx, h - 7, 6, 1, RED);
        for (let j = 1; j < 7; j++) (B.epx(dx + 2, h - 7 + j, 0xffe9a8), B.epx(dx + 3, h - 7 + j, 0xffe9a8));
        B.rect(dx + 7, h - 2, 3, 2, 0xe7e2d4);
        B.rect(dx + 7, h - 1, 3, 1, 0x9ca3af);
        B.light(w / 2, h - 1, 0xffe0a8, 12, 'door');
        // News kiosk with a red awning and racked papers.
        const kx = q(b.w - 34);
        B.rect(kx, h - 5, 7, 5, 0x1e3a2f);
        B.rect(kx - 1, h - 6, 9, 1, RED);
        B.rect(kx + 1, h - 4, 2, 2, 0xf5eeda);
        B.rect(kx + 4, h - 4, 2, 2, 0xf5eeda);
        B.erect(kx + 1, h - 4, 5, 2, 0xfff4e0, 140);
        // Rooftop wire-service mast with a beacon.
        B.rect(q(b.w - 22), -5, 1, 5, 0x64748b);
        B.rect(q(b.w - 26), -3, 3, 1, 0x64748b);
        B.px(q(b.w - 22), -6, RED);
        B.blink(q(b.w - 22), -6, 0xff4050, 1.8, 0.3);
    };
})();
