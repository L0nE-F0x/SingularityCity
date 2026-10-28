/* Pixel art — the backdrop between the sky and the city: layered parallax skylines fading
   into smog by day and glowing with windows and neon by night, a far skyline of arcologies
   with an orbital tether, searchlights, sky traffic, and the terrain the zones need (sea
   behind the port, mesas behind the space zone, hills behind the suburbs, plant stacks
   behind the power zone).

   Everything is drawn into one render texture at one texel per art pixel and shown
   upscaled with nearest-neighbour, so rotated searchlights and moving craft stay on the
   pixel grid. The backdrop does not scale with zoom (it is far away); it only scrolls
   with parallax. It is purely visual: nothing reads from it. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, hash, bayer, mix } = PL;

    const TW = 1536; // strip width in art px; strips tile seamlessly

    // ── Generators (greyscale masks tinted at runtime + coloured emit) ──────
    const NEON = [0xff4fd8, 0x4ff0ff, 0xffb84a, 0x7aff8a, 0xb07aff, 0xff5a6a];
    const WIN = [0xffd48a, 0xffe6b8, 0xcfe4ff, 0xffc070, 0xa8d8ff];

    // Stamp a column-range on a wrapping strip.
    function wset(img, x, y, c, a) {
        img.set(((x % img.w) + img.w) % img.w, y, c, a);
    }

    // A dense skyline. o: { seed, minW, maxW, minH, maxH, gap, win, neon, holo, spires, cables }
    function genCity(H, o) {
        const base = new Img(TW, H);
        const emit = new Img(TW, H);
        const R = PL.rng(o.seed);
        let x = 0;
        const tops = [];
        while (x < TW) {
            const bw = o.minW + Math.floor(R() * (o.maxW - o.minW));
            const bh = Math.floor(o.minH + Math.pow(R(), 1.5) * (o.maxH - o.minH));
            const top = H - bh;
            const shape = R();
            for (let i = 0; i < bw; i++) {
                let tt = top;
                if (shape > 0.9)
                    tt = top + Math.round(Math.abs(i - bw / 2) * 1.2); // spire / pyramid
                else if (shape > 0.78 && (i < bw * 0.2 || i > bw * 0.8))
                    tt = top + Math.round(bh * 0.18); // setback
                else if (shape > 0.7 && i > bw * 0.35 && i < bw * 0.65) tt = top - Math.round(bh * 0.08); // crown
                for (let y = Math.max(0, tt); y < H; y++) {
                    let c = i === 0 ? 0xffffff : i >= bw - 2 ? 0xc0c0c0 : 0xdcdcdc;
                    if (y === tt) c = 0xf0f0f0;
                    wset(base, x + i, y, c);
                }
                // Windows: a grid of 1-px lights, whole floors on or off.
                if (o.win && i > 0 && i < bw - 1 && i % 2 === 1)
                    for (let y = tt + 3; y < H - 1; y += 3) {
                        // Unlit glass: a faint grid that gives the silhouettes texture by day.
                        wset(base, x + i, y, i >= bw - 2 ? 0xa8a8a8 : 0xbcbcbc);
                        const fl = hash(o.seed, x, y);
                        if (fl < 0.3) continue;
                        if (hash(o.seed + 7, x + i, y) > o.win) continue;
                        wset(emit, x + i, y, WIN[Math.floor(hash(o.seed + 3, x + i, y) * WIN.length)]);
                    }
            }
            tops.push({ x: x, w: bw, top: top });
            // Roof furniture: masts with an aviation light, tanks, dishes.
            const r = R();
            if (r > 0.55) {
                const ax = x + Math.floor(bw * (0.3 + R() * 0.4));
                const ah = 3 + Math.floor(R() * (o.spires ? 14 : 6));
                for (let j = 1; j <= ah; j++) wset(base, ax, top - j, 0xd0d0d0);
                wset(emit, ax, top - ah - 1, 0xff4050);
            } else if (r > 0.35 && bw > 6) {
                const tx = x + 1 + Math.floor(R() * (bw - 5));
                for (let j = 1; j <= 3; j++)
                    for (let i = 0; i < 3; i++) wset(base, tx + i, top - j, 0xd4d4d4);
            }
            // Neon: vertical blades and holo billboards.
            if (o.neon && R() < o.neon && bh > 14) {
                const col = NEON[Math.floor(R() * NEON.length)];
                if (R() > 0.45) {
                    const bx = x + (R() > 0.5 ? 0 : bw - 1);
                    const by = top + 3 + Math.floor(R() * Math.max(1, bh * 0.3));
                    const len = 5 + Math.floor(R() * 9);
                    for (let j = 0; j < len && by + j < H; j++)
                        if (j % 3 !== 2 || R() > 0.4) wset(emit, bx, by + j, col);
                } else if (bw > 8) {
                    const hw = Math.min(bw - 2, 6 + Math.floor(R() * 8));
                    const hh = 3 + Math.floor(R() * 3);
                    const hx = x + 1 + Math.floor((bw - 2 - hw) / 2);
                    const hy = top + 2 + Math.floor(R() * Math.max(1, bh * 0.25));
                    const c2 = NEON[Math.floor(R() * NEON.length)];
                    for (let j = 0; j < hh; j++)
                        for (let i = 0; i < hw; i++)
                            if (hy + j < H)
                                wset(
                                    emit,
                                    hx + i,
                                    hy + j,
                                    (i + j * 2) % 5 < 2 ? c2 : mix(col, 0x000000, 0.25)
                                );
                }
            }
            x += bw + (R() < o.gap ? 1 + Math.floor(R() * 4) : 0);
        }
        // Cables sagging between neighbouring roofs.
        if (o.cables)
            for (let k = 0; k + 1 < tops.length; k++) {
                if (hash(o.seed, k, 41) > o.cables) continue;
                const a = tops[k];
                const b = tops[k + 1];
                const x0 = a.x + a.w - 1;
                const x1 = b.x;
                const y0 = Math.max(a.top, b.top) + 2;
                for (let xx = x0; xx <= x1 + 6; xx++) {
                    const t = (xx - x0) / Math.max(1, x1 + 6 - x0);
                    wset(base, xx, Math.min(H - 1, y0 + Math.round(Math.sin(t * Math.PI) * 3)), 0xb8b8b8);
                }
            }
        return { base: base, emit: emit };
    }

    // Arcologies and needles on the far horizon, one orbital tether.
    function genFar(H, seed) {
        const base = new Img(TW, H);
        const emit = new Img(TW, H);
        const R = PL.rng(seed);
        // Low continuous skyline first.
        for (let x = 0; x < TW; x++) {
            const hh =
                10 + Math.round((Math.sin(x * 0.031 + seed) * 0.5 + 0.5) * 8 + hash(seed, x >> 3, 1) * 10);
            for (let y = H - hh; y < H; y++) base.set(x, y, 0xd8d8d8);
        }
        const megas = [
            { x: 120, kind: 'arcology', w: 120, h: 92 },
            { x: 420, kind: 'needle', w: 16, h: 150 },
            { x: 610, kind: 'twin', w: 70, h: 120 },
            { x: 930, kind: 'tether', w: 26, h: 70 },
            { x: 1180, kind: 'arcology', w: 90, h: 70 },
            { x: 1390, kind: 'needle', w: 12, h: 118 },
        ];
        megas.forEach((m) => {
            const cx = m.x + m.w / 2;
            for (let i = 0; i < m.w; i++) {
                const X = m.x + i;
                let top;
                if (m.kind === 'arcology') {
                    const steps = 6;
                    const d = Math.abs(i - m.w / 2) / (m.w / 2);
                    top = H - m.h + Math.floor(d * steps) * Math.round(m.h / (steps + 2));
                } else if (m.kind === 'needle') {
                    const d = Math.abs(i - m.w / 2) / (m.w / 2);
                    top = H - m.h + Math.round(d * d * m.h * 0.45);
                } else if (m.kind === 'twin') {
                    const inA = i < m.w * 0.38;
                    const inB = i > m.w * 0.62;
                    top = inA ? H - m.h : inB ? H - Math.round(m.h * 0.9) : H - Math.round(m.h * 0.35);
                    if (!inA && !inB && i % 4 !== 0) top = Math.min(top, H - Math.round(m.h * 0.55));
                } else {
                    // Tether anchor: a flared base station.
                    const d = Math.abs(i - m.w / 2) / (m.w / 2);
                    top = H - Math.round(m.h * (1 - d * 0.6));
                }
                for (let y = Math.max(0, top); y < H; y++) {
                    const c = i === 0 ? 0xffffff : i > m.w - 3 ? 0xc8c8c8 : 0xe2e2e2;
                    wset(base, X, y, c);
                    if ((y - top) % 4 === 2 && i > 1 && i < m.w - 2 && hash(seed, X, y) > 0.55)
                        wset(emit, X, y, WIN[Math.floor(hash(seed + 1, X, y) * WIN.length)]);
                }
            }
            // Aviation lights along the crown, and a ring of neon on the needles.
            wset(emit, Math.round(cx), H - m.h - 1, 0xff4050);
            if (m.kind === 'needle')
                for (let j = 20; j < m.h - 10; j += 24)
                    for (let i = -2; i <= 2; i++)
                        wset(emit, Math.round(cx) + i, H - m.h + j, NEON[((j / 24) % 6) | 0]);
            if (m.kind === 'tether') {
                // The cable rises out of frame; light pulses are added at runtime.
                for (let y = 0; y < H - m.h; y++) {
                    wset(base, Math.round(cx), y, 0xe8e8e8);
                    if (y % 9 === 0) wset(emit, Math.round(cx), y, 0x8ae8ff);
                }
                m.cx = Math.round(cx);
            }
            void R;
        });
        return { base: base, emit: emit, tetherX: 930 + 13 };
    }

    // Seamless terrain strips for the zones that are not city.
    const f = (n) => (n * PL.TAU) / TW;
    function genTerrain(kind, H, seed) {
        const base = new Img(TW, H);
        const emit = new Img(TW, H);
        for (let X = 0; X < TW; X++) {
            let hh;
            if (kind === 'desert') {
                const m = Math.sin(X * f(3) + seed) + Math.sin(X * f(7) + seed * 2) * 0.6;
                const plateau = PL.smooth(0.45, 0.8, m);
                hh =
                    H * (0.08 + Math.max(0, m + 0.6) * 0.12) +
                    plateau * H * 0.32 +
                    (hash(seed, X >> 3, 5) - 0.5) * 2;
            } else if (kind === 'sea') {
                hh =
                    H *
                    (0.04 + Math.max(0, Math.sin(X * f(4) + 1) * 0.6 + Math.sin(X * f(13)) * 0.25) * 0.16);
            } else {
                hh = H * (0.2 + (Math.sin(X * f(3) + seed) * 0.5 + 0.5) * 0.24 + Math.sin(X * f(11)) * 0.03);
            }
            const top = Math.round(H - hh);
            for (let y = Math.max(0, top); y < H; y++) {
                let c = y === top ? 0xffffff : 0xdcdcdc;
                if (kind === 'desert' && (y - top) % 7 === 6 && hash(seed, X >> 3, y) > 0.3) c = 0xcccccc;
                base.set(X, y, c);
            }
            if (kind === 'hills' && hash(seed, X, 9) > 0.8) {
                const th = 2 + Math.floor(hash(seed, X, 11) * 4);
                for (let j = 0; j < th; j++) base.set(X, top - j, 0xcacaca);
            }
            if (kind === 'hills' && hash(seed, X, 13) > 0.985) {
                base.rect(X, top - 5, 6, 5, 0xe8e8e8);
                emit.set(X + 1, top - 3, 0xffd48a);
                emit.set(X + 4, top - 3, 0xffd48a);
            }
        }
        if (kind === 'sea')
            [
                [140, 1],
                [700, 0],
                [1200, 1],
            ].forEach(([x, big]) => {
                const L = big ? 44 : 28;
                base.rect(x, H - 14, L, 5, 0xd0d0d0);
                base.rect(x + 3, H - 17, L - 14, 3, 0xe0e0e0);
                base.rect(x + L - 10, H - 24, 6, 10, 0xe0e0e0);
                for (let i = 4; i < L - 10; i += 3) emit.set(x + i, H - 15, WIN[i % 5]);
                emit.set(x + L - 7, H - 25, 0xff4a4a);
            });
        if (kind === 'industry')
            for (let X = 40; X < TW; X += 180) {
                const h = 40 + ((X / 180) % 3) * 12;
                base.rect(X, H - h, 4, h, 0xd0d0d0);
                base.rect(X - 1, H - h, 6, 2, 0xc0c0c0);
                emit.set(X + 1, H - h - 1, 0xff4050);
                for (let j = 0; j < 30; j++) {
                    const half = Math.round(9 + Math.pow(Math.abs(j / 30 - 0.62) * 1.6, 2) * 9);
                    for (let i = -half; i <= half; i++)
                        base.set(X + 60 + i, H - j, i < 0 ? 0xe0e0e0 : 0xc8c8c8);
                }
            }
        if (kind === 'desert')
            [220, 640, 1100].forEach((X, i) => {
                const h = 34 + i * 8;
                base.rect(X, H - h, 3, h, 0xd0d0d0);
                base.rect(X - 3, H - h - 4, 9, 4, 0xd0d0d0);
                emit.set(X + 1, H - h - 5, 0xff4a4a);
            });
        return { base: base, emit: emit };
    }

    // Vertical dithered alpha ramp (white), transparent at the top.
    function genHaze(h, pow) {
        const img = new Img(64, h);
        for (let y = 0; y < h; y++) {
            const a = Math.pow(y / (h - 1), pow);
            for (let x = 0; x < 64; x++) if (bayer(x, y) < a) img.set(x, y, 0xffffff);
        }
        return img;
    }
    // Long horizontal smog streaks (stratus), white mask.
    function genStreaks(H, seed) {
        const img = new Img(TW, H);
        const R = PL.rng(seed);
        for (let k = 0; k < 14; k++) {
            const y = Math.floor(R() * (H - 4));
            const x0 = Math.floor(R() * TW);
            const len = 60 + Math.floor(R() * 260);
            const th = 1 + Math.floor(R() * 3);
            for (let i = 0; i < len; i++) {
                const t = i / len;
                const env = Math.sin(t * Math.PI);
                const rows = Math.max(1, Math.round(th * env + 0.3));
                for (let j = 0; j < rows; j++) {
                    if (bayer(x0 + i, y + j) > env * 1.4) continue;
                    wset(img, x0 + i, y + j - Math.floor(rows / 2), j === 0 ? 0xffffff : 0xe0e0e0);
                }
            }
        }
        return img;
    }
    // A deck of cumulus on a wrapping strip: flat-bottomed heaps of puffs, shaded in four
    // dithered greys (lit from above, darker bellies) plus a separate rim mask along the
    // sunlit tops. Both are white masks the runtime tints with the time-of-day palette.
    function genCumulus(H, seed, count, minW, maxW) {
        const body = new Img(TW, H);
        const rim = new Img(TW, H);
        const R = PL.rng(seed);
        const TONES = [0xffffff, 0xe8eaf0, 0xd0d4de, 0xb6bac8];
        const mask = new Uint8Array(TW * H);
        const inside = (x, y) => y >= 0 && y < H && mask[y * TW + (((x % TW) + TW) % TW)] === 1;
        for (let k = 0; k < count; k++) {
            const cw = minW + Math.floor(R() * (maxW - minW));
            const cx = Math.floor(R() * TW);
            const base = H - 2 - Math.floor(R() * Math.max(1, H * 0.25));
            const puffs = 3 + Math.floor((cw / 14) * (0.7 + R() * 0.6));
            for (let p = 0; p < puffs; p++) {
                const t = (p + 0.5) / puffs;
                // Taller in the middle, smaller towards the ends.
                const r = Math.max(3, (cw / puffs) * (1.1 + Math.sin(t * Math.PI) * 1.3) * (0.7 + R() * 0.5));
                const px = cx + Math.round((t - 0.5) * cw);
                const py = base - r * (0.55 + Math.sin(t * Math.PI) * 0.35);
                for (let y = Math.floor(py - r); y <= base; y++)
                    for (let x = Math.floor(px - r); x <= Math.ceil(px + r); x++) {
                        if (y < 0 || y >= H) continue;
                        const dx = (x - px) / r;
                        const dy = (y - py) / r;
                        if (dx * dx + dy * dy <= 1 || (y >= py && Math.abs(dx) <= 0.92)) {
                            mask[y * TW + (((x % TW) + TW) % TW)] = 1;
                        }
                    }
            }
        }
        for (let y = 0; y < H; y++)
            for (let x = 0; x < TW; x++) {
                if (!inside(x, y)) continue;
                // Depth below the cloud's local top decides the shade.
                let d = 0;
                while (d < 12 && inside(x, y - d - 1)) d++;
                let below = 0;
                while (below < 4 && inside(x, y + below + 1)) below++;
                const v = PL.clamp(d / 11 + (below < 2 ? 0.35 : 0) + (hash(seed, x, y) - 0.5) * 0.12, 0, 1);
                const q = Math.min(3, Math.floor(v * 3 + bayer(x, y) * 0.9));
                body.set(x, y, TONES[q]);
                if (d === 0 || (d === 1 && bayer(x, y) > 0.4)) rim.set(x, y, 0xffffff);
            }
        return { body: body, rim: rim };
    }
    // High cirrus: long feathered wisps, a single white mask.
    function genCirrus(H, seed) {
        const img = new Img(TW, H);
        const R = PL.rng(seed);
        for (let k = 0; k < 18; k++) {
            const y0 = Math.floor(R() * (H - 6)) + 3;
            const x0 = Math.floor(R() * TW);
            const len = 40 + Math.floor(R() * 160);
            const slope = (R() - 0.5) * 0.08;
            const hook = R() > 0.5 ? 1 : -1;
            for (let i = 0; i < len; i++) {
                const t = i / len;
                const env = Math.pow(Math.sin(t * Math.PI), 0.7);
                const y = Math.round(y0 + i * slope + (t > 0.8 ? hook * (t - 0.8) * 18 : 0));
                const thick = env > 0.6 ? 2 : 1;
                for (let j = 0; j < thick; j++)
                    if (bayer(x0 + i, y + j) < env * 0.9) wset(img, x0 + i, y + j, 0xffffff);
                // Fibrous strands below the main streak.
                if (hash(seed, x0 + i, 7) > 0.82 && env > 0.3)
                    for (let j = 1; j < 3; j++)
                        if (bayer(x0 + i, y + j + 1) < env * 0.5)
                            wset(img, x0 + i - j, y + thick + j, 0xe8e8f0);
            }
        }
        return img;
    }
    // Searchlight beam pointing up from (w/2, h): dithered, brighter at the root.
    function genBeam(w, h) {
        const img = new Img(w, h);
        const cx = (w - 1) / 2;
        for (let y = 0; y < h; y++) {
            const t = 1 - y / h; // 0 at the root
            const half = 1 + t * (w / 2 - 1);
            for (let x = 0; x < w; x++) {
                const d = Math.abs(x - cx) / half;
                if (d > 1) continue;
                const v = (1 - d) * Math.pow(1 - t, 1.2);
                const q = Math.floor(v * 4 + bayer(x, y)) / 4;
                if (q > 0) img.set(x, y, 0xffffff, q * 255);
            }
        }
        return img;
    }

    // ── Sky craft ───────────────────────────────────────────────────────────
    // Drawn facing right in their real colours (the runtime tints them by light and haze
    // and mirrors them for the other direction). navs: 1-px lights, local art px.
    const CRAFT_KINDS = ['jet', 'taxi', 'drone', 'cargo', 'patrol'];
    function quad(img, bodyCol) {
        const BLUR = 0xb8c0c8;
        for (let i = 0; i < 3; i++) {
            img.set(i, 0, BLUR, 150);
            img.set(6 + i, 0, BLUR, 150);
        }
        img.rect(1, 1, 7, 1, 0x7a828c);
        img.set(1, 1, 0x5a626c);
        img.set(7, 1, 0x5a626c);
        img.rect(3, 2, 3, 1, bodyCol);
        img.set(3, 2, PL.light(bodyCol, 0.3));
        img.set(4, 3, 0x3a4048);
    }
    function craftArt(kind) {
        if (kind === 'jet') {
            const img = new Img(13, 4);
            const lit = new Img(13, 4);
            img.rect(0, 0, 2, 1, 0xd8dce2); // tail fin
            img.rect(0, 1, 12, 1, 0xeef0f3); // fuselage, lit top
            img.rect(0, 2, 11, 1, 0xc4c9d0); // belly
            img.set(12, 1, 0x9aa8b6); // nose
            img.set(11, 2, 0xb0b8c2);
            img.rect(4, 3, 4, 1, 0x9aa2ac); // wing
            img.set(5, 3, 0x7a828c); // engine
            for (let x = 3; x <= 9; x += 2) lit.set(x, 1, 0xffe2a0);
            return {
                img: img,
                lit: lit,
                navs: [
                    { x: 0, y: 0, c: 0xffffff, blink: 'strobe' },
                    { x: 7, y: 3, c: 0xff4050, blink: 'slow' },
                ],
            };
        }
        if (kind === 'taxi') {
            const img = new Img(15, 6);
            const lit = new Img(15, 6);
            const BLUR = 0xb8c0c8;
            for (let i = 0; i < 5; i++) {
                img.set(i, 0, BLUR, 140);
                img.set(10 + i, 0, BLUR, 140);
            }
            img.set(2, 1, 0x6a727c);
            img.set(12, 1, 0x6a727c);
            img.rect(1, 2, 13, 1, 0x8a929c); // wing bar
            img.rect(4, 3, 8, 1, 0xf0f2f5); // cabin
            img.rect(6, 3, 5, 1, 0x34404c); // window strip
            img.rect(4, 4, 8, 1, 0xd4d8de);
            img.rect(5, 4, 6, 1, 0x4fd8f0); // livery stripe
            img.set(4, 3, 0xdfe3e8);
            img.rect(12, 3, 2, 1, 0xd4d8de); // tail boom
            img.set(13, 2, 0xd4d8de); // fin
            img.set(5, 5, 0x5a626c);
            img.set(10, 5, 0x5a626c);
            img.rect(5, 5, 6, 1, 0x6a727c); // skids
            for (let x = 6; x <= 10; x++) lit.set(x, 3, x % 2 ? 0xffe2a0 : 0xffd080);
            return {
                img: img,
                lit: lit,
                navs: [
                    { x: 3, y: 4, c: 0xffffff, blink: 'strobe' },
                    { x: 13, y: 2, c: 0xff4050, blink: 'slow' },
                    { x: 1, y: 2, c: 0x60ff90 },
                ],
            };
        }
        if (kind === 'cargo') {
            const img = new Img(9, 7);
            quad(img, 0xe8b04a);
            img.set(4, 4, 0x5a626c); // tether
            img.rect(3, 5, 3, 2, 0xc8904a); // parcel
            img.rect(3, 5, 3, 1, 0xe0b070);
            img.set(4, 6, 0xe8d8a8); // tape
            return { img: img, lit: null, navs: [{ x: 4, y: 3, c: 0xffb84a, blink: 'slow' }] };
        }
        if (kind === 'patrol') {
            const img = new Img(9, 4);
            quad(img, 0x3a4a7a);
            return {
                img: img,
                lit: null,
                navs: [
                    { x: 3, y: 2, c: 0x3a7aff, blink: 'alt', phase: 0 },
                    { x: 5, y: 2, c: 0xff3a4a, blink: 'alt', phase: 0.5 },
                ],
            };
        }
        const img = new Img(9, 4);
        quad(img, 0xe0e4ea);
        return { img: img, lit: null, navs: [{ x: 4, y: 3, c: 0xff4050, blink: 'slow' }] };
    }
    // A contrail: a 1-px core that thins out with age, with a dithered spread behind.
    function contrailImg(len) {
        const img = new Img(len, 3);
        for (let i = 0; i < len; i++) {
            const age = 1 - i / (len - 1); // 0 at the jet (right end), 1 at the far end
            const core = Math.pow(1 - age, 0.8) * 0.95;
            if (Math.floor(core * 4 + bayer(i, 1)) / 4 > 0) img.set(i, 1, 0xffffff, core * 255);
            const spread = age > 0.25 ? Math.min(1, (age - 0.25) * 1.6) * (1 - age) * 0.9 : 0;
            [0, 2].forEach((y) => {
                const q = Math.floor(spread * 4 + bayer(i, y)) / 4;
                if (q > 0) img.set(i, y, 0xffffff, q * 160);
            });
        }
        return img;
    }

    // ── Runtime ─────────────────────────────────────────────────────────────
    // Layers back to front. p = parallax factor, y = how far below the horizon the strip's
    // bottom sits (art px), haze = haze mix of the tint, emitK = emit strength.
    const BD = (PL.Backdrop = {
        sprite: null,
        rt: null,
        scene: null,
        layers: null,
        craft: [],
        beams: [],
        zoneW: { city: 1, sea: 0, desert: 0, hills: 0, industry: 0 },

        _tiling(img, blend) {
            const t = new PIXI.TilingSprite(PL.tex(img), img.w, img.h);
            t.texture.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
            if (blend) t.blendMode = blend;
            return t;
        },
        _layer(gen, p, depth, kind) {
            const L = new PIXI.Container();
            L.base = this._tiling(gen.base);
            L.lit = this._tiling(gen.emit);
            L.addChild(L.base, L.lit);
            L.p = p;
            L.depth = depth;
            L.kind = kind;
            L.h = gen.base.h;
            this.scene.addChild(L);
            return L;
        },
        _hazeBand(h, pow) {
            const s = new PIXI.TilingSprite(PL.tex(genHaze(h, pow)), 64, h);
            this.scene.addChild(s);
            return s;
        },

        _build() {
            this.scene = new PIXI.Container();
            const L = (this.layers = {});
            L.streaks = this._tiling(genStreaks(120, 5));
            this.scene.addChild(L.streaks);
            // Sky effects behind the clouds (meteors), then three cloud decks, then sky effects
            // in front of them (rainbow, launch plumes) — all behind every skyline.
            this.fxBack = new PIXI.Container();
            this.scene.addChild(this.fxBack);
            L.cirrus = this._tiling(genCirrus(40, 23));
            this.scene.addChild(L.cirrus);
            L.clouds = [
                { gen: genCumulus(70, 29, 9, 60, 150), p: 0.03, rise: 168, drift: 0.9 },
                { gen: genCumulus(54, 31, 12, 34, 96), p: 0.045, rise: 112, drift: 1.6 },
                { gen: genCumulus(40, 37, 16, 18, 60), p: 0.06, rise: 66, drift: 2.4 },
            ].map((d) => {
                const c = new PIXI.Container();
                c.body = this._tiling(d.gen.body);
                c.rim = this._tiling(d.gen.rim);
                c.addChild(c.body, c.rim);
                c.p = d.p;
                c.rise = d.rise;
                c.drift = d.drift;
                c.h = d.gen.body.h;
                this.scene.addChild(c);
                return c;
            });
            this.fxFront = new PIXI.Container();
            this.scene.addChild(this.fxFront);
            if (PL.SkyFx) PL.SkyFx.init(this.fxBack, this.fxFront);
            // Far: arcologies + tether. Then each zone's terrain shares the far slot.
            const far = genFar(170, 3);
            this.tetherX = far.tetherX;
            L.far = this._layer(far, 0.05, 0, 'city');
            L.hazeFar = this._hazeBand(70, 1.4);
            L.sea = this._layer(genTerrain('sea', 60, 11), 0.08, 0, 'sea');
            L.desert = this._layer(genTerrain('desert', 110, 13), 0.08, 0, 'desert');
            L.hills = this._layer(genTerrain('hills', 90, 17), 0.08, 0, 'hills');
            L.industry = this._layer(genTerrain('industry', 90, 19), 0.08, 0, 'industry');
            // Searchlights live between the far and mid skylines.
            const beamTex = PL.tex(genBeam(26, 260));
            for (let i = 0; i < 3; i++) {
                const s = new PIXI.Sprite(beamTex);
                s.anchor.set(0.5, 1);
                s.blendMode = PIXI.BLEND_MODES.ADD;
                s.home = 260 + i * 470;
                s.phase = i * 2.1;
                this.scene.addChild(s);
                this.beams.push(s);
            }
            L.mid = this._layer(
                genCity(130, {
                    seed: 21,
                    minW: 7,
                    maxW: 22,
                    minH: 14,
                    maxH: 92,
                    gap: 0.3,
                    win: 0.34,
                    neon: 0.22,
                    spires: true,
                    cables: 0,
                }),
                0.14,
                1,
                'city'
            );
            L.hazeMid = this._hazeBand(50, 1.7);
            L.near = this._layer(
                genCity(150, {
                    seed: 33,
                    minW: 10,
                    maxW: 30,
                    minH: 16,
                    maxH: 100,
                    gap: 0.4,
                    win: 0.4,
                    neon: 0.3,
                    spires: false,
                    cables: 0.35,
                }),
                0.28,
                2,
                'city'
            );
            L.hazeNear = this._hazeBand(40, 2.2);
            // Sky traffic: readable little craft on lanes at three depths — airliners high up
            // with contrails, air taxis with lit cabins, quad drones, parcel drones and patrol
            // drones. Bodies are painted in their real colours and pushed into the haze by
            // depth, so by day they read as aircraft, not as dead pixels; nav lights at night.
            const lightTex = PL.tex(new Img(1, 1).rect(0, 0, 1, 1, 0xffffff));
            const kinds = CRAFT_KINDS.map((k) => {
                const art = craftArt(k);
                return { k: k, tex: PL.tex(art.img), lit: art.lit ? PL.tex(art.lit) : null, art: art };
            });
            const trailTex = PL.tex(contrailImg(150));
            // Lane plan: [kind, count, depth]. depth 0 = far/high, 2 = near/low.
            const plan = [
                ['jet', 2, 0],
                ['taxi', 3, 1],
                ['drone', 2, 2],
                ['cargo', 2, 2],
                ['patrol', 1, 1],
                ['taxi', 1, 2],
            ];
            let n = 0;
            plan.forEach(([kind, count, depth]) => {
                const K = kinds.find((q) => q.k === kind);
                for (let j = 0; j < count; j++, n++) {
                    const c = new PIXI.Container();
                    c.kind = kind;
                    c.depth = depth;
                    if (kind === 'jet') {
                        c.trail = new PIXI.Sprite(trailTex);
                        c.addChild(c.trail);
                    }
                    c.body = new PIXI.Sprite(K.tex);
                    c.addChild(c.body);
                    c.cabin = K.lit ? new PIXI.Sprite(K.lit) : null;
                    if (c.cabin) c.addChild(c.cabin);
                    c.navs = K.art.navs.map((nv) => {
                        const s = new PIXI.Sprite(lightTex);
                        s.nav = nv;
                        c.addChild(s);
                        return s;
                    });
                    c.dir = hash(7, n, 1) > 0.5 ? 1 : -1;
                    const base = { jet: 3.5, taxi: 9, drone: 13, cargo: 10, patrol: 15 }[kind];
                    c.speed = base * (0.75 + hash(7, n, 2) * 0.5);
                    c.lane =
                        kind === 'jet'
                            ? 150 + Math.floor(hash(7, n, 3) * 70)
                            : 34 + Math.floor(hash(7, n, 3) * 70) + (2 - depth) * 16;
                    c.x0 = hash(7, n, 4) * TW;
                    c.p = [0.06, 0.2, 0.34][depth];
                    c.w = K.art.img.w;
                    c.bobK = kind === 'jet' ? 0 : 0.6 + hash(7, n, 5);
                    this.scene.addChild(c);
                    this.craft.push(c);
                }
            });
            this.rt = PIXI.RenderTexture.create({ width: 8, height: 8, scaleMode: PIXI.SCALE_MODES.NEAREST });
            this.sprite = new PIXI.Sprite(this.rt);
            this.sprite.name = 'pixelBackdrop';
            const stage = G.app.stage;
            const skyIdx = PL.Sky && PL.Sky.sprite ? stage.getChildIndex(PL.Sky.sprite) : -1;
            stage.addChildAt(this.sprite, skyIdx + 1);
        },

        // Which backdrop each part of the city wants (live building ids).
        _zoneAt(wx) {
            const bx = (id) => (G.bldById && G.bldById[id] ? G.bldById[id].x : null);
            const space = bx('mission_control');
            const housing = bx('npc_apt_1') || bx('npc_apt_2');
            const suburb = bx('suburb_1') || bx('suburb_2');
            const power = bx('power_nuclear') || bx('power_smr');
            if (space !== null && wx < space - 40) return 'sea';
            if (housing !== null && wx < housing - 200) return 'desert';
            if (power !== null && wx > power - 300) return 'industry';
            if (suburb !== null && wx > suburb - 300) return 'hills';
            return 'city';
        },

        update(K, t, opts) {
            if (!G.app || !G.world) return;
            if (!this.scene) this._build();
            opts = opts || {};
            const A = PL.ART;
            const xray = typeof XRayMode !== 'undefined' && XRayMode.active;
            const vis = !opts.hidden && G.world.visible && !xray && !G.activeInterior;
            this.sprite.visible = vis;
            if (!vis) return;
            const w = Math.ceil(G.vpW / A) + 1;
            const h = Math.ceil(G.vpH / A) + 1;
            if (this.rt.width !== w || this.rt.height !== h) this.rt.resize(w, h);
            this.sprite.scale.set(A);
            const zoom = G.world.scale.x || 1;
            const horizon = (G.world.y + (G.groundY - 24) * zoom) / A;
            const camX = -G.world.x / A; // world scroll in screen-art px
            const centre = (G.vpW / 2 - G.world.x) / zoom;

            // Zone cross-fade: sample around the view centre.
            const want = { city: 0, sea: 0, desert: 0, hills: 0, industry: 0 };
            for (let i = -2; i <= 2; i++) want[this._zoneAt(centre + i * 260)] += 0.2;
            for (const k in this.zoneW) this.zoneW[k] += (want[k] - this.zoneW[k]) * 0.06;
            const Z = this.zoneW;

            const L = this.layers;
            const emitA = PL.clamp(K.night * 1.2, 0, 1);
            const neonA = K.neon;
            const place = (layer, sink, tint, emitK, alpha) => {
                const bottom = Math.round(horizon + sink);
                [layer.base, layer.lit].forEach((s) => {
                    s.width = w;
                    s.tilePosition.x = -Math.round(camX * layer.p);
                    s.y = bottom - layer.h;
                });
                layer.base.tint = tint;
                layer.lit.alpha = emitK;
                layer.alpha = alpha;
                layer.visible = alpha > 0.01;
            };
            // Each layer's colour: its own silhouette tone pushed into the haze.
            const tFar = mix(K.far2, K.haze, 0.55 + K.smog * 0.2);
            const day = 1 - PL.clamp(K.night * 1.4, 0, 1);
            const tMid = mix(K.far2, K.haze, 0.38 + K.smog * 0.15 + day * 0.24);
            const tNear = mix(K.far1, K.haze, 0.2 + K.smog * 0.1 + day * 0.22);
            const city = Z.city;

            // Cloud cover follows the weather: wisps on a clear day, heaps when partly
            // cloudy, a full grey deck before and during rain. [cirrus, high, mid, low]
            const COVER = {
                clear: [0.5, 0.42, 0.08, 0],
                partly_cloudy: [0.55, 0.85, 0.8, 0.65],
                overcast: [0.3, 1, 1, 1],
                drizzle: [0.15, 0.95, 1, 1],
                rain: [0.05, 1, 1, 1],
                thunderstorm: [0, 1, 1, 1],
                snow: [0.1, 0.95, 1, 1],
                fog: [0, 0.35, 0.45, 0.5],
            };
            const wxName = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            const cov = COVER[wxName] || COVER.clear;
            const wxK =
                typeof Environment !== 'undefined' ? PL.clamp(Environment.weatherIntensity || 0, 0, 1) : 0;
            const clearCov = COVER.clear;
            const cover = cov.map((v, i) => clearCov[i] + (v - clearCov[i]) * (wxName === 'clear' ? 1 : wxK));
            if (!this._cover) this._cover = cover.slice();
            for (let i = 0; i < 4; i++) this._cover[i] += (cover[i] - this._cover[i]) * 0.02;
            const stormy = /rain|drizzle|storm|snow/.test(wxName) ? wxK : 0;
            const cloudBody = mix(K.cloud, mix(K.far2, 0x30343e, 0.4), stormy * 0.55);
            L.cirrus.width = w;
            L.cirrus.tilePosition.x = -Math.round(camX * 0.015 + t * 0.35);
            L.cirrus.y = Math.round(horizon - 250);
            L.cirrus.tint = mix(K.cloud, K.rim, 0.35);
            L.cirrus.alpha = this._cover[0] * 0.55;
            L.clouds.forEach((c, i) => {
                const a = this._cover[i + 1];
                c.visible = a > 0.02;
                if (!c.visible) return;
                [c.body, c.rim].forEach((s) => {
                    s.width = w;
                    s.tilePosition.x = -Math.round(camX * c.p + t * c.drift);
                });
                c.y = Math.round(horizon - c.rise - c.h);
                c.body.tint = mix(cloudBody, K.haze, 0.12 + i * 0.1);
                c.rim.tint = K.rim;
                c.rim.alpha = (1 - stormy * 0.7) * (0.55 + K.sun * 0.35);
                c.alpha = a * (0.92 - i * 0.04);
            });
            if (PL.SkyFx) PL.SkyFx.update(K, t, { w: w, h: h, horizon: horizon, camX: camX, zoom: zoom });

            L.streaks.width = w;
            L.streaks.tilePosition.x = -Math.round(camX * 0.02 + t * 0.6);
            L.streaks.y = Math.round(horizon - 120 - 70);
            L.streaks.tint = mix(K.cloud, K.haze, 0.5);
            L.streaks.alpha = 0.25 + K.smog * 0.35;

            place(L.far, 8, tFar, Math.max(emitA * 0.7, neonA * 0.2), city);
            place(L.sea, 4, mix(K.far2, K.haze, 0.5), emitA * 0.8, Z.sea);
            place(L.desert, 6, mix(mix(K.far2, 0xc8906a, 0.35), K.haze, 0.45), emitA * 0.8, Z.desert);
            place(L.hills, 6, mix(mix(K.far2, 0x4a6a4a, 0.3), K.haze, 0.45), emitA * 0.8, Z.hills);
            place(L.industry, 6, mix(K.far2, K.haze, 0.45), emitA * 0.8, Z.industry);
            const hz = (s, hh, a) => {
                s.width = w;
                s.y = Math.round(horizon + 8 - hh);
                s.tint = K.haze;
                s.alpha = a;
            };
            hz(L.hazeFar, 70, 0.35 + K.smog * 0.35);
            place(L.mid, 10, tMid, Math.max(emitA * 0.65, neonA * 0.3), city);
            hz(L.hazeMid, 50, (0.25 + K.smog * 0.3) * Math.max(city, 0.3));
            place(L.near, 12, tNear, Math.max(emitA * 0.8, neonA * 0.4), city * 0.92);
            hz(L.hazeNear, 40, (0.18 + K.smog * 0.25) * Math.max(city, 0.3));

            // Searchlights after dark, swinging slowly.
            this.beams.forEach((s) => {
                const sx = s.home - camX * 0.14;
                s.x = Math.round((((sx % TW) + TW) % TW) - 60 + (w > TW ? 0 : 0));
                s.y = Math.round(horizon - 30);
                s.rotation = Math.sin(t * 0.21 + s.phase) * 0.55;
                s.tint = mix(K.haze, 0xffffff, 0.6);
                s.alpha = PL.clamp(K.night * 1.3 - 0.4, 0, 1) * 0.16 * city;
                s.visible = s.alpha > 0.005 && s.x > -200 && s.x < w + 200;
            });
            // Sky craft drift along their lanes. By day the body is lit by the ambient light and
            // pushed into the haze with distance; after dark it falls to a silhouette and the
            // nav lights, strobes and cabin windows take over.
            const dayK = 1 - PL.clamp(K.night * 1.3, 0, 1);
            const navA = PL.clamp(K.night * 1.4, 0.18, 1);
            this.craft.forEach((c) => {
                const span = w + 200;
                let x = c.x0 + c.dir * t * c.speed - camX * c.p;
                x = (((x % span) + span) % span) - 100;
                c.x = Math.round(x);
                const bob = c.bobK ? Math.round(Math.sin(t * c.bobK + c.x0) * 1.2) : 0;
                c.y = Math.round(horizon - c.lane - 40 + bob);
                c.scale.x = c.dir;
                // Mirroring flips around x = 0; keep the craft's footprint where it was.
                c.pivot.x = c.dir > 0 ? 0 : c.w;
                const haze = [0.62, 0.38, 0.2][c.depth];
                const lit = mix(K.amb, 0xffffff, 0.25);
                const dayCol = mix(lit, K.haze, haze);
                const nightCol = mix(K.far2, K.haze, haze * 0.5);
                c.body.tint = mix(nightCol, dayCol, dayK);
                if (c.cabin) c.cabin.alpha = PL.clamp(K.night * 1.5 - 0.1, 0, 1);
                c.navs.forEach((s) => {
                    const nv = s.nav;
                    s.x = nv.x;
                    s.y = nv.y;
                    s.tint = nv.c;
                    let on = 1;
                    if (nv.blink === 'strobe') on = PL.frac(t * 0.9 + c.x0 * 0.013) < 0.08 ? 1 : 0;
                    else if (nv.blink === 'slow') on = PL.frac(t * 0.6 + c.x0 * 0.01) < 0.5 ? 1 : 0.25;
                    else if (nv.blink === 'alt') on = PL.frac(t * 2 + nv.phase) < 0.5 ? 1 : 0;
                    s.alpha = navA * on;
                });
                if (c.trail) {
                    // A contrail by day: long, thin, spreading as it ages.
                    c.trail.x = -c.trail.width + 1;
                    c.trail.y = 1;
                    c.trail.tint = mix(0xffffff, K.haze, 0.35);
                    c.trail.alpha = 0.55 * dayK * (1 - K.smog * 0.25);
                    c.trail.visible = c.trail.alpha > 0.02;
                }
                c.alpha = city * (0.7 + c.depth * 0.15);
            });

            G.app.renderer.render(this.scene, { renderTexture: this.rt, clear: true });
        },
    });
    void BD;
})();
