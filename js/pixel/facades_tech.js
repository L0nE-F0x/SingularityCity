/* Pixel art — the tech districts, transliterated from their buildBuildings() branches:
   the Backbone (network infrastructure), the Agent district, the Longevity wing, and
   the Alignment Forest cabins. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    // Shared dark tower: tinted base, vertical panel lines, crown band, floor slabs and a
    // 22-world-px window grid whose glow colour comes from the classic's seeded noise.
    function darkTower(B, b, w, h, o) {
        const floors = PL.floorsOf(b);
        const base = o.base;
        const col = o.col;
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                let c = mix(base, col, 0.05);
                if (x % q(o.panel) === 0) c = light(c, 0.12);
                if (x === 0) c = light(c, 0.2);
                if (x >= w - 1) c = dark(c, 0.3);
                B.px(x, y, c);
            }
        B.rect(0, 0, w, 2, col);
        B.rect(0, 0, w, 1, light(col, 0.35));
        for (let i = 0; i < w; i++) B.epx(i, 1, col, 110);
        B.rect(0, 2, w, 1, mix(base, col, 0.3));
        for (let f = 1; f < floors; f++) B.rect(0, q(f * 18), w, 1, light(base, 0.18));
        for (let f = 0; f < floors; f++)
            for (let wx = 8; wx < b.w - 12; wx += 22) {
                const x = q(wx);
                const y = q(f * 18 + 6);
                if (y + 3 > h - 2) continue;
                const n1 = PL.labNoise((b.x | 0) + f * 131 + wx * 7);
                const n2 = PL.labNoise((b.x | 0) + f * 131 + wx * 7 + 1);
                const gc = o.glow[Math.floor(n1 * o.glow.length)];
                B.rect(x, y, 5, 3, dark(base, 0.3));
                for (let j = 0; j < 3; j++)
                    for (let i = 0; i < 5; i++) {
                        B.px(x + i, y + j, mix(dark(base, 0.2), gc, 0.12 + n2 * 0.2));
                        if (n2 > 0.3)
                            B.epx(
                                x + i,
                                y + j,
                                mix(gc, base, j === 0 ? 0.1 : 0.35),
                                Math.round(70 + n2 * 90)
                            );
                    }
            }
        B.rect(0, h - 1, w, 1, light(base, 0.1));
        B.rect(0, h - 2, w, 1, mix(base, col, 0.3));
    }

    // ── The Backbone ────────────────────────────────────────────────────────
    const BK = {
        backbone_landing: 0x0866ff,
        backbone_ixp: 0x76b900,
        backbone_ground: 0x22d3ee,
        backbone_cdn: 0xf6821f,
        backbone_noc: 0xef4444,
    };
    D['pre:backbone'] = function (B, b, w, h) {
        const col = BK[b.id] || 0x22d3ee;
        const floors = PL.floorsOf(b);
        darkTower(B, b, w, h, {
            base: 0x1a2438,
            col: col,
            panel: 30,
            glow: [0x22d3ee, 0x4ade80, 0x3b82f6, 0x8b5cf6],
        });
        if (b.id === 'backbone_landing') {
            for (let ci = 0; ci < 4; ci++) {
                const cx = q(20 + ci * 40);
                if (cx + 8 > w) break;
                B.rect(cx, h - 5, 8, 5, 0x1a2540);
                const c = [0x22d3ee, 0x4ade80, 0xfacc15, 0xf43f5e][ci];
                B.rect(cx + 1, h - 4, 6, 1, dark(c, 0.3));
                B.erect(cx + 1, h - 4, 6, 1, c);
            }
            B.rect(Math.round(w / 2) - 7, h - 3, 14, 3, 0x333850);
        } else if (b.id === 'backbone_ixp') {
            const cx = Math.round(w / 2);
            const cy = Math.round(h / 2);
            B.rect(cx - 10, cy - 5, 20, 10, mix(0x1a2438, col, 0.3));
            B.rect(cx - 13, cy - 2, 26, 3, mix(0x1a2438, col, 0.2));
            for (let i = -9; i <= 9; i += 3) B.epx(cx + i, cy, col, 200);
            [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6].forEach((c, si) => {
                if (si % 2) return;
                B.rect(0, h - 7 + si, w, 1, mix(0x1a2438, c, 0.4));
                for (let x = (si * 3) % 5; x < w; x += 5) B.epx(x, h - 7 + si, c, 200);
            });
        } else if (b.id === 'backbone_ground') {
            for (let di = 0; di < 3; di++) {
                const dx = q(30 + di * 55) + 4;
                if (dx + 5 > w) break;
                B.rect(dx, 2, 1, 5, 0x64748b);
                for (let i = -7; i <= 7; i++) {
                    const y = 2 - Math.round(Math.sqrt(Math.max(0, 1 - (i / 7) ** 2)) * 2.4);
                    B.px(dx + i, y, 0xcbd5e1);
                    B.px(dx + i, y + 1, 0x94a3b8);
                }
                B.px(dx, 0, 0xa855f7);
                B.epx(dx, 0, 0xd8a8ff);
            }
        } else if (b.id === 'backbone_cdn') {
            for (let ri = 0; ri < 5; ri++) {
                const ry = q(10 + (ri * (floors * 18)) / 5);
                if (ry + 3 > h - 3) break;
                B.rect(1, ry, w - 2, 3, mix(0x1a2438, 0xf97316, 0.18));
                const fill = 0.4 + PL.labNoise((b.x | 0) + ri * 47) * 0.6;
                const fw = Math.round((w - 4) * fill);
                B.rect(2, ry + 1, fw, 1, 0x2a6a3a);
                B.erect(2, ry + 1, fw, 1, 0x4ade80, 220);
            }
        } else if (b.id === 'backbone_noc') {
            for (let f = 1; f < floors - 1; f++) {
                const fy = q(f * 18 + 4);
                for (let sx = 10; sx < b.w - 20; sx += 35) {
                    const x = q(sx);
                    B.rect(x, fy, 9, 4, 0x0a0818);
                    for (let j = 0; j < 3; j++)
                        for (let i = 0; i < 8; i++) {
                            const land = Math.sin((x + i) * 0.6) + Math.sin((fy + j) * 1.3 + i * 0.3) > 0.7;
                            B.epx(x + i, fy + j, land ? mix(col, 0xffffff, 0.3) : dark(col, 0.5), 220);
                        }
                }
            }
            for (let ai = 0; ai < 3; ai++) {
                const ax = q(40 + ai * 65);
                if (ax + 3 > w) break;
                B.rect(ax, -3, 1, 4, 0x64748b);
                B.rect(ax - 2, -2, 5, 1, 0x94a3b8);
                B.blink(ax, -4, 0xef4444, 1.6, ai * 0.3);
            }
        }
    };

    // ── Agent district ──────────────────────────────────────────────────────
    const AG = {
        agents_orchestrator: 0x22d3ee,
        agents_toolshop: 0xa855f7,
        agents_sandbox: 0x4ade80,
        agents_deploy: 0xf97316,
        agents_memory: 0x8b5cf6,
    };
    function agentEmblem(B, id, cx, cy, ac) {
        const P = (x, y, c) => (
            B.px(cx + x, cy + y, c || ac),
            B.epx(cx + x, cy + y, light(c || ac, 0.2), 220)
        );
        if (id === 'agents_orchestrator') {
            [
                [0, -3],
                [0, -2],
                [0, 2],
                [0, 3],
                [-3, -1],
                [-2, -1],
                [2, 1],
                [3, 1],
                [-3, 1],
                [-2, 1],
                [2, -1],
                [3, -1],
            ].forEach((p) => P(p[0], p[1]));
            [
                [-1, -1],
                [0, -1],
                [1, -1],
                [-1, 0],
                [0, 0],
                [1, 0],
                [-1, 1],
                [0, 1],
                [1, 1],
            ].forEach((p) => P(p[0], p[1], light(ac, 0.2)));
        } else if (id === 'agents_toolshop') {
            [
                [-2, -2],
                [-1, -2],
                [1, -2],
                [2, -2],
                [-2, -1],
                [-1, -1],
                [0, -1],
                [1, -1],
                [2, -1],
                [-3, 0],
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
                [-2, 2],
                [-1, 2],
                [1, 2],
                [2, 2],
            ].forEach((p) => P(p[0], p[1]));
        } else if (id === 'agents_sandbox') {
            [
                [-2, 1],
                [-2, 2],
                [0, -1],
                [0, 0],
                [0, 1],
                [0, 2],
                [2, 0],
                [2, 1],
                [2, 2],
                [-3, 3],
                [-2, 3],
                [-1, 3],
                [0, 3],
                [1, 3],
                [2, 3],
                [3, 3],
            ].forEach((p) => P(p[0], p[1]));
        } else if (id === 'agents_deploy') {
            [
                [0, -3],
                [-1, -2],
                [0, -2],
                [1, -2],
                [-1, -1],
                [0, -1],
                [1, -1],
                [-1, 0],
                [0, 0],
                [1, 0],
                [-2, 1],
                [2, 1],
            ].forEach((p) => P(p[0], p[1]));
            P(0, 2, 0xfbbf24);
            P(0, 3, 0xef4444);
        } else {
            for (let a = 0; a < 12; a++)
                P(Math.round(Math.cos((a / 12) * PL.TAU) * 3), Math.round(Math.sin((a / 12) * PL.TAU) * 3));
            (P(0, 0), P(-1, 0), P(1, 0), P(0, -1));
        }
    }
    D['pre:agents'] = function (B, b, w, h) {
        const ac = AG[b.id] || 0xf43f5e;
        darkTower(B, b, w, h, {
            base: 0x1c182c,
            col: ac,
            panel: 28,
            glow: [0xf43f5e, 0xfbbf24, 0xa855f7, 0x4ade80, 0x22d3ee],
        });
        const glowLine = (x0, y0, x1, y1, c) => {
            B.line(x0, y0, x1, y1, mix(0x1c182c, c, 0.35));
            B.eline(x0, y0, x1, y1, c);
        };
        if (b.id === 'agents_orchestrator') {
            const cy = Math.round(h * 0.5);
            const nodes = [
                [Math.round(w * 0.25), cy],
                [Math.round(w * 0.5), cy - 2],
                [Math.round(w * 0.75), cy],
            ];
            glowLine(nodes[0][0], nodes[0][1], nodes[1][0], nodes[1][1], ac);
            glowLine(nodes[1][0], nodes[1][1], nodes[2][0], nodes[2][1], ac);
            nodes.forEach(
                ([x, y]) => (B.ellipse(x, y, 2, 2, mix(0x1c182c, ac, 0.5)), B.epx(x, y, light(ac, 0.3)))
            );
        } else if (b.id === 'agents_sandbox') {
            for (let bi = 0; bi < 5; bi++) {
                const bh = q(6 + PL.labNoise((b.x | 0) + bi * 29) * 12) + 1;
                const c = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xf43f5e, 0x8b5cf6][bi];
                const x = q(b.w * 0.2 + bi * 14);
                for (let j = 0; j < bh; j++)
                    (B.px(x, Math.round(h * 0.6) - j, mix(0x1c182c, c, 0.4)),
                        B.px(x + 1, Math.round(h * 0.6) - j, mix(0x1c182c, c, 0.4)),
                        B.epx(x, Math.round(h * 0.6) - j, c, 200));
            }
        } else if (b.id === 'agents_memory') {
            for (let ri = 0; ri < 3; ri++) {
                const r = q(10 + ri * 8) + 1;
                for (let a = 0; a < 32; a++) {
                    const x = Math.round(w / 2 + Math.cos((a / 32) * PL.TAU) * r);
                    const y = Math.round(h * 0.5 + Math.sin((a / 32) * PL.TAU) * r);
                    B.epx(x, y, 0xa855f7, 90 + ri * 50);
                }
            }
        } else if (b.id === 'agents_toolshop') {
            for (let ti = 0; ti < 4; ti++)
                B.rect(
                    q(b.w * 0.15),
                    Math.round(h * 0.3) + ti * 4,
                    q(b.w * 0.7),
                    1,
                    mix(0x1c182c, 0xfbbf24, 0.35)
                );
        }
        if (b.id === 'agents_orchestrator' || b.id === 'agents_sandbox')
            for (let ai = 0; ai < 3; ai++) {
                const ax = q(30 + ai * 60);
                if (ax + 1 > w) break;
                B.rect(ax, -3, 1, 4, 0x64748b);
                B.px(ax, -3, ac);
                B.blink(ax, -3, ac, 1.8, ai * 0.25);
            }
        agentEmblem(B, b.id, Math.round(w / 2), -5, ac);
        B.light(w / 2, -5, ac, 8, 'neon');
    };

    // ── Longevity wing ──────────────────────────────────────────────────────
    const LG = {
        longevity_protein: { body: 0x1a2a44, acc: 0x3b82f6 },
        longevity_discovery: { body: 0x1a3428, acc: 0x22c55e },
        longevity_trials: { body: 0x1e2e40, acc: 0xec4899 },
        longevity_genomics: { body: 0x2a1e40, acc: 0x8b5cf6 },
        longevity_cryo: { body: 0x1a3440, acc: 0x67e8f9 },
    };
    function longevityMotif(B, id, cx, cy, ac) {
        const P = (x, y, c) => (
            B.px(cx + x, cy + y, c || ac),
            B.epx(cx + x, cy + y, light(c || ac, 0.25), 230)
        );
        if (id === 'longevity_protein') {
            for (let i = 0; i < 7; i++) {
                const x = Math.round(Math.cos(i * 1.3) * 4);
                const y = -3 + i;
                P(x, y);
                if (i < 6) P(Math.round((x + Math.cos((i + 1) * 1.3) * 4) / 2), y);
            }
        } else if (id === 'longevity_discovery') {
            [
                [0, -3],
                [2, -2],
                [3, 0],
                [2, 2],
                [0, 3],
                [-2, 2],
                [-3, 0],
                [-2, -2],
            ].forEach((p) => P(p[0], p[1]));
            (P(0, -4, 0xeafff4), P(4, 1, 0xeafff4));
        } else if (id === 'longevity_trials') {
            [
                [0, -3],
                [0, -2],
                [0, -1],
                [0, 0],
                [0, 1],
                [-2, -1],
                [-1, -1],
                [1, -1],
                [2, -1],
            ].forEach((p) => P(p[0], p[1]));
            [
                [-4, 3],
                [-3, 3],
                [-2, 3],
                [-1, 2],
                [0, 4],
                [1, 3],
                [2, 3],
                [3, 3],
                [4, 3],
            ].forEach((p) => P(p[0], p[1], 0xeafff4));
        } else if (id === 'longevity_genomics') {
            for (let j = -4; j <= 4; j++) {
                const a = Math.round(Math.sin(j * 0.8) * 2);
                P(a, j);
                P(-a, j, 0xeafff4);
            }
        } else {
            [
                [0, -4],
                [0, -3],
                [0, -2],
                [0, 2],
                [0, 3],
                [0, 4],
                [-4, 0],
                [-3, 0],
                [-2, 0],
                [2, 0],
                [3, 0],
                [4, 0],
                [-2, -2],
                [2, 2],
                [-2, 2],
                [2, -2],
                [0, 0],
            ].forEach((p) => P(p[0], p[1]));
        }
    }
    D['pre:longevity'] = function (B, b, w, h) {
        const pal = LG[b.id] || { body: 0x1a2a30, acc: 0x22c55e };
        const ac = pal.acc;
        for (let y = 3; y < h; y++)
            for (let x = 0; x < w; x++)
                B.px(
                    x,
                    y,
                    x < 1 ? light(pal.body, 0.2) : x >= w - 2 ? dark(pal.body, 0.3) : mix(pal.body, ac, 0.05)
                );
        B.rect(0, 0, w, 3, ac);
        B.rect(0, 0, w, 1, light(ac, 0.3));
        for (let i = 0; i < w; i++) B.epx(i, 1, ac, 120);
        // Clean-room window grid from the classic's seeded sequence.
        let lseed = (b.x | 0) + b.w * 3;
        const lr = () => {
            lseed = (lseed * 16807) % 2147483647;
            return (lseed - 1) / 2147483646;
        };
        for (let wx = 8; wx < b.w - 14; wx += 20) {
            const x = q(wx);
            for (let wy = 16; wy < h * 3 - 20; wy += 15) {
                const lit = lr() > 0.35;
                const y = q(wy);
                for (let j = 0; j < 4; j++)
                    for (let i = 0; i < 4; i++) {
                        B.px(x + i, y + j, PL.dpick([0x8ab4c4, 0x4a6a78], j / 3, x + i, y + j));
                        if (lit) B.epx(x + i, y + j, j === 0 ? mix(0xeafff4, ac, 0.3) : 0xe0fff0, 225);
                    }
            }
            B.rect(x - 1, q(16), 1, q(h * 3 - 36), 0x05080c);
        }
        // Clean-room lobby with an airlock door.
        K.lobby(B, 2, h - 7, w - 4, 6, { accent: ac, frame: 0x0a1620, interior: 0xeafff4, planters: false });
        // Signature medallion at (w/2, 0.42h).
        const cx = Math.round(w / 2);
        const cy = Math.round(h * 0.42);
        B.rect(cx - 7, cy - 6, 15, 13, 0x060d14);
        K.neonBox(B, cx - 7, cy - 6, 15, 13, dark(ac, 0.2));
        longevityMotif(B, b.id, cx, cy, ac);
        B.light(cx, cy, ac, 10, 'neon');
    };

    // ── Alignment Forest: log-cabin research lodges among pines ─────────────
    D['pre:align'] = function (B, b, w, h) {
        B.named = true;
        const accent = typeof b.shield === 'number' ? b.shield : 0x6ab868;
        let seed = (1013904223 + (b.x | 0)) >>> 0;
        const sr = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0;
            return (seed & 0xffffff) / 0x1000000;
        };
        // Forest floor, extending beyond the footprint so neighbouring cabins join up.
        for (let x = -18; x < w + 18; x++)
            for (let y = h - 2; y < h; y++)
                B.px(x, y, PL.dpick([0x1a3321, 0x264a30, 0x335e3a], PL.hash(B.seed, x, y) * 0.9, x, y));
        // Background pines, three each side.
        const pine = (x, s) => K.pine(B, x, h - 1, Math.round(18 * s + 8));
        pine(-8 + Math.round(sr() * 2), 0.9 + sr() * 0.2);
        pine(-3 + Math.round(sr() * 2), 0.75 + sr() * 0.15);
        pine(-13 + Math.round(sr() * 2), 0.8 + sr() * 0.2);
        pine(w + 7 - Math.round(sr() * 2), 0.9 + sr() * 0.2);
        pine(w + 2 - Math.round(sr() * 2), 0.75 + sr() * 0.15);
        pine(w + 12 - Math.round(sr() * 2), 0.8 + sr() * 0.2);
        // Cabin body: stacked logs, two wood tones, notched corners.
        const bodyTop = q(Math.max(h * 3 * 0.3, 18));
        const x0 = 3;
        const x1 = w - 3;
        for (let y = bodyTop; y < h - 2; y++) {
            const row = y - bodyTop;
            const c = row % 2 ? 0x6a4428 : 0x7a5232;
            B.rect(x0, y, x1 - x0, 1, c);
            if (row % 2 === 0) (B.px(x0 - 1, y, 0x8a6240), B.px(x1, y, 0x5a3820));
        }
        // Porch step and door with glow spill.
        const dx = Math.round(w / 2) - 2;
        B.rect(dx - 2, h - 2, 8, 1, 0x5a4a3a);
        B.rect(dx, h - 9, 4, 7, 0x4a2e18);
        B.rect(dx + 1, h - 8, 2, 6, 0x6a4424);
        B.px(dx + 3, h - 5, 0xfbbf24);
        B.light(dx + 2, h - 1, 0xffc878, 10, 'door');
        // Accent lantern above the door, in the institute colour.
        B.px(dx + 2, h - 10, accent);
        B.epx(dx + 2, h - 10, light(accent, 0.3));
        B.light(dx + 2, h - 10, accent, 6, 'lantern');
        // Two warm windows with wooden lattice.
        [x0 + 3, x1 - 8].forEach((wx) => {
            const wy = bodyTop + 3;
            B.rect(wx - 1, wy - 1, 7, 6, 0x3a2414);
            for (let j = 0; j < 4; j++)
                for (let i = 0; i < 5; i++)
                    (B.px(wx + i, wy + j, 0x8a7a5a), B.epx(wx + i, wy + j, j === 0 ? 0xffe0a0 : 0xffc870));
            B.rect(wx + 2, wy, 1, 4, 0x3a2414);
            B.rect(wx, wy + 2, 5, 1, 0x3a2414);
            B.rect(wx - 1, wy + 4, 7, 1, 0x5a3a20);
        });
        // Pitched shingle roof overhanging by 2 art px, with a ridge cap.
        const roofH = Math.max(4, bodyTop - 1);
        for (let j = 0; j < roofH; j++) {
            const t = j / roofH;
            const half = Math.round(((x1 - x0) / 2 + 2) * t);
            const cx = Math.round((x0 + x1) / 2);
            for (let i = -half; i <= half; i++) {
                const c = j % 2 ? 0x4a3a34 : 0x5a463e;
                B.px(
                    cx + i,
                    bodyTop - roofH + j,
                    i === -half ? light(c, 0.2) : i === half ? dark(c, 0.3) : c
                );
            }
        }
        B.rect(Math.round((x0 + x1) / 2) - 1, bodyTop - roofH - 1, 3, 1, 0x6a5a50);
        // Stone chimney right of centre (smoke puffs at night come from the chimney).
        const chx = Math.round(w * 0.62);
        for (let y = bodyTop - roofH + 1; y < bodyTop - 1; y++)
            for (let i = 0; i < 3; i++)
                B.px(chx + i, y - 2, PL.hash(B.seed, i, y) > 0.5 ? 0x7a7a82 : 0x8a8a92);
        B.rect(chx - 1, bodyTop - roofH - 2, 5, 1, 0x5a5a62);
        B.smoke.push({ x: chx + 1, y: bodyTop - roofH - 3, k: 0.5 });
        // Carved name board on two posts above the ridge (the classic Text is hidden).
        const lines = PL.wrap(b.name || '', w - 4, 3, 2);
        const pw =
            Math.max.apply(
                null,
                lines.map((l) => PL.textW(l, 3))
            ) + 4;
        const ph = lines.length * 6 + 1;
        const ridge = bodyTop - roofH - 1;
        const py = ridge - 3 - ph;
        const px = Math.round(w / 2 - pw / 2);
        B.rect(Math.round(w / 2) - 5, py + ph, 1, 3, 0x3a2818);
        B.rect(Math.round(w / 2) + 4, py + ph, 1, 3, 0x3a2818);
        B.rect(px - 1, py - 1, pw + 2, ph + 2, 0x3a2818);
        B.rect(px, py, pw, ph, 0x7a5436);
        B.rect(px, py + ph - 1, pw, 1, 0x5a3a20);
        lines.forEach((ln, i) =>
            B.text(ln, Math.round(w / 2 - PL.textW(ln, 3) / 2), py + 1 + i * 6, 0x1a0f06, 3)
        );
        B.px(px + 1, py + 1, 0xfbbf24);
        B.px(px + pw - 2, py + 1, 0xfbbf24);
        // Foreground pines at the cabin corners, for depth.
        pine(1, 0.55);
        pine(w - 2, 0.6);
    };
    PL.padFor = function (b) {
        if (b.type === 'alignment' || (b.id && b.id.startsWith('align_'))) return Math.round(22 * PL.S3);
        return Math.round(10 * PL.S3);
    };
})();
