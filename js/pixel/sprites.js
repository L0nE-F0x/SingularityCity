/* Pixel lab v2 — small sprites: trees, walkers, vehicles, street furniture, clouds. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, hash, bayer, mix, dark, light } = PL;

    const S = (PL.S = {});

    // ── Trees ───────────────────────────────────────────────────────────────
    const LEAF = {
        green: [0x1e4a32, 0x2d6a3e, 0x3e8a48, 0x5aa850, 0x8ac860],
        deep: [0x163a2c, 0x21553a, 0x2e6e42, 0x44884a, 0x68a852],
        autumn: [0x6a2a1a, 0x9a4222, 0xc8642a, 0xe8943a, 0xf6c060],
        blossom: [0x8a3a6a, 0xb8508a, 0xe07aac, 0xf4a8c8, 0xffd8e8],
        olive: [0x2a3e2a, 0x3e5a36, 0x5a7a44, 0x7a9a58, 0xa8c078],
        palm: [0x1a4430, 0x2a6a3a, 0x3e8e44, 0x62b050, 0x9ad070],
    };
    S.LEAF = LEAF;

    // Leafy round tree. (x, y) = trunk base in the target Img. r = canopy radius.
    S.tree = function (img, x, y, r, seed, pal, o) {
        o = o || {};
        pal = pal || LEAF.green;
        const R = PL.rng(seed);
        const trunkH = o.trunk || Math.round(r * 0.9 + 2);
        const cx = x;
        const cy = y - trunkH - r * 0.55;
        const bark = o.bark || 0x4a3426;
        // Trunk and a couple of limbs.
        for (let j = 0; j < trunkH + r * 0.4; j++) {
            const yy = y - j;
            img.set(x, yy, bark);
            img.set(x + 1, yy, dark(bark, 0.35));
            if (j < 2) img.set(x - 1, yy, dark(bark, 0.2));
        }
        img.line(x, y - trunkH + 1, x - Math.round(r * 0.5), y - trunkH - Math.round(r * 0.35), bark);
        img.line(
            x + 1,
            y - trunkH,
            x + Math.round(r * 0.55),
            y - trunkH - Math.round(r * 0.45),
            dark(bark, 0.2)
        );
        // Canopy = union of blobs, lit from the upper left.
        const blobs = [[0, 0, r]];
        const n = 4 + Math.floor(R() * 4);
        for (let i = 0; i < n; i++) {
            const a = R() * PL.TAU;
            const d = r * (0.35 + R() * 0.45);
            blobs.push([Math.cos(a) * d, Math.sin(a) * d * 0.75, r * (0.45 + R() * 0.3)]);
        }
        const ext = Math.ceil(r * 1.8);
        for (let j = -ext; j <= ext; j++)
            for (let i = -ext; i <= ext; i++) {
                let best = -1;
                let lit = 0;
                for (const b of blobs) {
                    const dx = i - b[0];
                    const dy = j - b[1];
                    const d = Math.hypot(dx, dy) / b[2];
                    if (d < 1 && 1 - d > best) {
                        best = 1 - d;
                        lit = (-dx * 0.7 - dy * 0.9) / b[2];
                    }
                }
                if (best < 0) continue;
                // Ragged, leafy edge.
                if (best < 0.14 && bayer(cx + i, cy + j) > best * 5) continue;
                const global = (-i * 0.5 - j * 0.8) / r;
                let v = 0.45 + lit * 0.35 + global * 0.25 + (hash(seed, i, j) - 0.5) * 0.25;
                if (j > r * 0.35) v -= 0.18;
                img.set(cx + i, cy + j, PL.dpick(pal, PL.clamp(v, 0, 1), cx + i, cy + j));
            }
        if (o.blossomDots) {
            for (let k = 0; k < r * 3; k++) {
                const i = Math.round((R() - 0.5) * r * 2);
                const j = Math.round((R() - 0.6) * r * 1.6);
                if (img.alpha(cx + i, cy + j) > 0) img.set(cx + i, cy + j, o.blossomDots);
            }
        }
        return { top: cy - r, cx: cx, cy: cy };
    };

    // Conifer: stacked, lit left, dark right.
    S.pine = function (img, x, y, h, seed, pal, snow) {
        pal = pal || LEAF.deep;
        const tiers = Math.max(3, Math.round(h / 5));
        img.rect(x, y - 3, 1, 3, 0x3a2a20);
        img.rect(x + 1, y - 3, 1, 3, 0x2a1c16);
        for (let j = 0; j < h - 2; j++) {
            const t = j / (h - 2);
            const tier = (t * tiers) % 1;
            const half = Math.max(0.5, (t * 0.75 + tier * 0.35) * (h * 0.32));
            const yy = y - 3 - (h - 2 - j);
            for (let i = -Math.ceil(half); i <= Math.ceil(half); i++) {
                if (Math.abs(i) > half) continue;
                const edge = Math.abs(i) / Math.max(1, half);
                if (edge > 0.8 && bayer(x + i, yy) > 0.6) continue;
                let v = 0.6 - (i / Math.max(2, half)) * 0.4 - tier * 0.15 + (hash(seed, i, j) - 0.5) * 0.2;
                let c = PL.dpick(pal, PL.clamp(v, 0, 1), x + i, yy);
                if (snow && tier < 0.25 && i < half * 0.5) c = mix(0xe8eef8, c, 0.2);
                img.set(x + i, yy, c);
            }
        }
    };

    S.palm = function (img, x, y, h, seed) {
        const trunk = 0x8a6a48;
        let tx = x;
        for (let j = 0; j < h; j++) {
            const xx = Math.round(x + Math.sin((j / h) * 1.6) * 2);
            tx = xx;
            img.set(xx, y - j, j % 3 === 0 ? dark(trunk, 0.25) : trunk);
            img.set(xx + 1, y - j, dark(trunk, 0.35));
        }
        const top = y - h;
        const fr = [
            [-7, 2],
            [-5, -2],
            [0, -3],
            [5, -2],
            [7, 2],
            [-3, 3],
            [3, 3],
        ];
        fr.forEach((f, i) => {
            const steps = 8;
            for (let s = 0; s <= steps; s++) {
                const t = s / steps;
                const px = Math.round(tx + f[0] * t);
                const py = Math.round(top + f[1] * t + t * t * 4);
                const c = PL.dpick(LEAF.palm, 0.8 - t * 0.6 - (i % 2) * 0.1, px, py);
                img.set(px, py, c);
                img.set(px, py + 1, dark(c, 0.3));
            }
        });
        img.set(tx, top + 1, 0x5a3a20);
        img.set(tx + 1, top + 1, 0x6a4424);
        void seed;
    };

    // Bare / dead tree for the graveyard.
    S.deadTree = function (img, x, y, h, seed) {
        const R = PL.rng(seed);
        const c = 0x3a3036;
        const branch = (x0, y0, a, len, d) => {
            let px = x0;
            let py = y0;
            for (let i = 0; i < len; i++) {
                px += Math.cos(a);
                py -= Math.sin(a);
                img.set(Math.round(px), Math.round(py), d === 0 ? c : light(c, 0.1));
                if (d === 0) img.set(Math.round(px) + 1, Math.round(py), dark(c, 0.3));
            }
            if (d < 3)
                for (let k = 0; k < 2; k++)
                    branch(px, py, a + (R() - 0.5) * 1.6, len * (0.45 + R() * 0.2), d + 1);
        };
        branch(x, y, Math.PI / 2, h * 0.55, 0);
    };

    S.bush = function (img, x, y, w, seed, pal) {
        pal = pal || LEAF.green;
        for (let i = 0; i < w; i++) {
            const hh =
                2 + Math.round(Math.sin((i / (w - 1)) * Math.PI) * (w * 0.3)) + Math.round(hash(seed, i, 1));
            for (let j = 0; j < hh; j++) {
                const v = 0.3 + (j / hh) * 0.5 - (i / w) * 0.2 + (hash(seed, i, j) - 0.5) * 0.2;
                img.set(x + i, y - j, PL.dpick(pal, v, x + i, y - j));
            }
        }
    };

    // ── Walkers ─────────────────────────────────────────────────────────────
    // 5×12 side-view, facing right. h hair, f skin, e eye, s suit, S suit shade,
    // a hand, p near leg, P far leg, k shoe.
    const HEAD = {
        short: ['.hhh.', 'hhhhf', 'hhfef', '.fff.'],
        long: ['.hhh.', 'hhhhf', 'hhfef', 'hhff.'],
        bun: ['hh...', 'hhhhf', 'hhfef', '.fff.'],
        cap: ['.ccc.', 'ccccC', 'hhfef', '.fff.'],
        bald: ['.fff.', 'ffffF', 'ffFef', '.fff.'],
    };
    const TORSO = {
        a: ['.sss.', 'ssSss', 'ssSss', '.sas.'],
        b: ['.sss.', 'sSsss', 'sSsss', '.as..'],
        c: ['.sss.', 'sssSs', 'sssSs', '...a.'],
    };
    const LEGS = [
        ['.ppp.', '.P.p.', 'P...p', 'k...k'],
        ['.ppp.', '..pP.', '..pP.', '..kk.'],
        ['.ppp.', '.p.P.', 'p...P', 'k...k'],
        ['.ppp.', '..Pp.', '..Pp.', '..kk.'],
    ];
    const TORSO_FOR = ['b', 'a', 'c', 'a'];

    S.walker = function (look) {
        const map = {
            h: look.hair,
            f: look.skin,
            F: dark(look.skin, 0.2),
            e: 0x241820,
            s: look.suit,
            S: dark(look.suit, 0.3),
            a: look.skin,
            p: look.pants,
            P: dark(look.pants, 0.35),
            k: 0x1e1a22,
            c: look.cap || look.suit,
            C: dark(look.cap || look.suit, 0.3),
        };
        const head = HEAD[look.style] || HEAD.short;
        return LEGS.map((legs, i) => {
            const rows = head.concat(TORSO[TORSO_FOR[i]], legs);
            const img = new Img(5, rows.length);
            rows.forEach((row, y) => {
                for (let x = 0; x < 5; x++) {
                    const ch = row[x];
                    if (!ch || ch === '.') continue;
                    img.set(x, y, map[ch] === undefined ? 0xff00ff : map[ch]);
                }
            });
            if (look.bag) (img.set(4, 7, look.bag), img.set(4, 8, dark(look.bag, 0.3)));
            return img;
        });
    };
    // Small child: 4×8.
    S.kid = function (look) {
        const frames = [
            ['.hh.', 'hhfe', '.ff.', 'ssss', '.ss.', '.pp.', 'P..p', 'k..k'],
            ['.hh.', 'hhfe', '.ff.', 'ssss', '.ss.', '.pp.', '.pP.', '.kk.'],
        ];
        return frames.concat(frames).map((rows) => {
            const img = new Img(4, rows.length);
            const map = {
                h: look.hair,
                f: look.skin,
                e: 0x241820,
                s: look.suit,
                p: look.pants,
                P: dark(look.pants, 0.35),
                k: 0x1e1a22,
            };
            rows.forEach((row, y) => {
                for (let x = 0; x < 4; x++) if (row[x] !== '.') img.set(x, y, map[row[x]]);
            });
            return img;
        });
    };
    S.umbrella = function (col) {
        const img = new Img(9, 6);
        const rows = ['..ccccc..', '.cCcccCc.', 'cCcccccCc', 'd.d.d.d.d', '....h....', '....h....'];
        rows.forEach((row, y) => {
            for (let x = 0; x < 9; x++) {
                const ch = row[x];
                if (ch === 'c') img.set(x, y, col);
                else if (ch === 'C') img.set(x, y, light(col, 0.3));
                else if (ch === 'd') img.set(x, y, dark(col, 0.35));
                else if (ch === 'h') img.set(x, y, 0x2a2a30);
            }
        });
        return img;
    };

    // ── Vehicles (facing right) ─────────────────────────────────────────────
    S.car = function (kind, col, seed) {
        const R = PL.rng(seed || 1);
        const glass = 0x8ab4d4;
        const glassD = 0x4a6a8a;
        let img;
        const emit = [];
        const wheel = (im, x, y) => {
            im.rect(x, y, 3, 2, 0x16161c);
            im.set(x + 1, y, 0x6a6a72);
            im.set(x, y - 1, 0x1a1a20);
            im.set(x + 2, y - 1, 0x1a1a20);
        };
        if (kind === 'bus') {
            img = new Img(30, 10);
            img.rect(0, 1, 30, 7, col);
            img.rect(0, 1, 30, 1, light(col, 0.3));
            img.rect(0, 6, 30, 2, dark(col, 0.3));
            for (let i = 2; i < 27; i += 4) img.rect(i, 2, 3, 3, i % 8 === 2 ? glass : glassD);
            img.rect(28, 2, 2, 4, glass);
            wheel(img, 4, 8);
            wheel(img, 23, 8);
            emit.push([29, 6, 0xfff2c0], [0, 6, 0xff4a3a]);
            for (let i = 2; i < 27; i += 4)
                emit.push(
                    [i, 3, 0xffe6a0],
                    [i + 1, 3, 0xffe6a0],
                    [i + 2, 3, 0xffe6a0],
                    [i, 4, 0xffd88a],
                    [i + 1, 4, 0xffd88a],
                    [i + 2, 4, 0xffd88a]
                );
        } else if (kind === 'truck') {
            img = new Img(32, 11);
            // Container.
            const cc = [0xc0392b, 0x2a7ab0, 0xe0a030, 0x3a8a4a, 0x8a4ab0][Math.floor(R() * 5)];
            img.rect(0, 0, 22, 8, cc);
            for (let i = 1; i < 22; i += 2) img.rect(i, 1, 1, 6, dark(cc, 0.25));
            img.rect(0, 0, 22, 1, light(cc, 0.3));
            // Cab.
            img.rect(23, 2, 8, 6, col);
            img.rect(27, 3, 3, 2, glass);
            img.rect(23, 2, 8, 1, light(col, 0.3));
            img.rect(0, 8, 31, 1, 0x2a2a30);
            wheel(img, 3, 9);
            wheel(img, 8, 9);
            wheel(img, 26, 9);
            emit.push([31, 6, 0xfff2c0], [0, 7, 0xff4a3a]);
        } else if (kind === 'van') {
            img = new Img(20, 9);
            img.rect(1, 1, 18, 6, col);
            img.rect(1, 1, 18, 1, light(col, 0.3));
            img.rect(14, 2, 4, 2, glass);
            img.rect(10, 2, 3, 2, glassD);
            img.rect(1, 6, 19, 1, dark(col, 0.35));
            wheel(img, 3, 7);
            wheel(img, 14, 7);
            emit.push([19, 5, 0xfff2c0], [0, 5, 0xff4a3a]);
        } else {
            // Sedan / taxi / hatch.
            img = new Img(17, 8);
            const roof = kind === 'hatch' ? [4, 12] : [5, 11];
            img.rect(roof[0], 1, roof[1] - roof[0], 2, col);
            img.rect(roof[0] + 1, 0, roof[1] - roof[0] - 2, 1, light(col, 0.2));
            img.rect(roof[0] + 1, 1, 3, 2, glass);
            img.rect(roof[0] + 5, 1, roof[1] - roof[0] - 6, 2, glassD);
            img.rect(1, 3, 16, 3, col);
            img.rect(1, 3, 16, 1, light(col, 0.3));
            img.rect(1, 5, 16, 1, dark(col, 0.35));
            img.set(0, 4, col);
            wheel(img, 2, 6);
            wheel(img, 12, 6);
            if (kind === 'taxi') {
                img.rect(7, 0, 3, 1, 0xfff2a0);
                emit.push([7, 0, 0xfff2a0], [8, 0, 0xfff2a0], [9, 0, 0xfff2a0]);
            }
            emit.push([16, 4, 0xfff2c0], [0, 4, 0xff4a3a]);
        }
        const em = new Img(img.w, img.h);
        emit.forEach((e) => em.set(e[0], e[1], e[2]));
        return { img: img, emit: em, w: img.w, h: img.h };
    };

    // ── Street furniture ────────────────────────────────────────────────────
    // Lamp post: returns {img, emit, headX, headY} (head relative to img, base at bottom).
    S.lamp = function (kind) {
        const h = kind === 'old' ? 15 : 19;
        const img = new Img(7, h + 1);
        const emit = new Img(7, h + 1);
        const pole = kind === 'old' ? 0x2a3a34 : 0x33363e;
        img.rect(3, 2, 1, h - 1, pole);
        img.rect(2, h - 1, 3, 2, dark(pole, 0.2));
        if (kind === 'old') {
            // Victorian lantern.
            img.rect(2, 1, 3, 3, 0x1e2622);
            img.set(3, 0, 0x1e2622);
            emit.rect(2, 2, 3, 2, 0xffd88a);
            emit.set(3, 1, 0xffe8b0);
            return { img: img, emit: emit, hx: 3, hy: 3 };
        }
        img.rect(3, 1, 3, 1, pole);
        img.rect(4, 2, 3, 1, 0x22242a);
        emit.rect(4, 3, 3, 1, 0xfff0c8);
        emit.set(5, 2, 0xfff6dc);
        return { img: img, emit: emit, hx: 5, hy: 3 };
    };
    S.bench = function () {
        const img = new Img(9, 4);
        img.rect(0, 0, 9, 1, 0x7a5236);
        img.rect(0, 1, 9, 1, 0x5e3e28);
        img.rect(1, 2, 1, 2, 0x2a2a30);
        img.rect(7, 2, 1, 2, 0x2a2a30);
        return img;
    };
    S.hydrant = function () {
        const img = new Img(3, 4);
        img.rect(0, 1, 3, 3, 0xc0392b);
        img.set(1, 0, 0xd84a3a);
        img.set(0, 1, 0xe05a4a);
        img.set(2, 3, 0x8a2a20);
        return img;
    };
    S.bin = function () {
        const img = new Img(3, 4);
        img.rect(0, 0, 3, 4, 0x3a5a4a);
        img.rect(0, 0, 3, 1, 0x5a7a6a);
        img.set(2, 3, 0x22342a);
        return img;
    };

    // ── Clouds ──────────────────────────────────────────────────────────────
    // Two masks per cloud: body and top rim. Tinted at runtime by time of day.
    S.cloud = function (w, h, seed) {
        const R = PL.rng(seed);
        const blobs = [];
        const n = 4 + Math.floor(R() * 4);
        for (let i = 0; i < n; i++) {
            const t = (i + 0.5) / n;
            blobs.push([
                w * (0.12 + t * 0.76) + (R() - 0.5) * w * 0.08,
                h * (0.62 - Math.sin(t * Math.PI) * 0.22),
                w * (0.1 + R() * 0.09),
                h * (0.25 + R() * 0.25),
            ]);
        }
        const body = new Img(w, h);
        const rim = new Img(w, h);
        const inside = (x, y) => {
            for (const b of blobs) {
                const dx = (x - b[0]) / b[2];
                const dy = (y - b[1]) / b[3];
                if (dx * dx + dy * dy < 1 && y < h * 0.86) return true;
            }
            return false;
        };
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                if (!inside(x, y)) continue;
                // Flat, dithered underside.
                const under = y / h;
                if (under > 0.72 && bayer(x, y) < (under - 0.72) * 5) continue;
                const top = !inside(x, y - 1) || !inside(x, y - 2);
                if (top) rim.set(x, y, 0xffffff);
                else body.set(x, y, 0xffffff, under > 0.6 && bayer(x, y) > 0.5 ? 200 : 255);
            }
        return { body: body, rim: rim };
    };

    S.bird = function () {
        const a = new Img(5, 3);
        (a.set(0, 0, 0x1a1a22),
            a.set(1, 1, 0x1a1a22),
            a.set(2, 2, 0x1a1a22),
            a.set(3, 1, 0x1a1a22),
            a.set(4, 0, 0x1a1a22));
        const b = new Img(5, 3);
        (b.set(0, 1, 0x1a1a22),
            b.set(1, 1, 0x1a1a22),
            b.set(2, 2, 0x1a1a22),
            b.set(3, 1, 0x1a1a22),
            b.set(4, 1, 0x1a1a22));
        return [a, b];
    };

    // Suits: lab colour pulled toward a wearable tone.
    S.suitFor = function (labCol) {
        const l = PL.lum(labCol);
        if (l < 0.1) return 0x34343e;
        return PL.mix(PL.sat(labCol, 0.8), 0x2a2a3a, 0.15);
    };
    S.SKIN = [0xf6d2b0, 0xe8b48a, 0xc88a5e, 0x9a6440, 0x6e4630, 0xf0c8a0];
    S.HAIR = [0x1e1614, 0x3a2418, 0x5a3a22, 0x8a5a2a, 0xc8a060, 0x2a2a2e, 0x9a9aa2, 0x6a2a1a];
    S.PANTS = [0x2a2e44, 0x3a3a46, 0x4a3e34, 0x22242e, 0x5a5a6a, 0x3a4a6a];
})();
