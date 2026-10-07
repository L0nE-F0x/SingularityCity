/* Pixel art — dressing. Runs on every bake after its painter: rooftop clutter on the flat
   parts of the roofline, blade signs, AC boxes and drainpipes hanging off the sides,
   weathering streaks under ledges, and odd bits of street furniture by the door. It reads
   the painted facade (where the roof is, what is already drawn) and only paints into empty
   pixels above the roof and into the side margins, so a painter's design is never covered.
   The amount depends on what the building is: a lab tower stays tidy, an apartment block
   is a jumble. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { hash, mix, dark, light, shade } = PL;

    const NEON = [0xff4fd8, 0x4ff0ff, 0xffb84a, 0x7aff8a, 0xb07aff, 0xff5a6a, 0xfff07a];
    const WORDS = ['AI', 'GPU', 'LLM', 'API', '24H', 'BAR', 'RAMEN', 'TOKEN', 'DATA', 'HOTEL', 'CLINIC', 'PARTS',
        'NOODLE', 'VR', 'BYTE', 'ROBO', 'MECH', 'SUSHI', 'KARAOKE', 'REPAIR', 'CHIPS', 'OPEN', 'TEA', 'PHO'];

    // How much dressing each kind of building takes.
    const KIND = {
        lab: { roof: 0.7, blades: 0, side: 0.25, grime: 0.5, street: 0.3 },
        apartment: { roof: 1, blades: 0.75, side: 0.9, grime: 1, street: 0.6 },
        shop: { roof: 0.8, blades: 0.4, side: 0.5, grime: 0.6, street: 0.7 },
        office: { roof: 0.8, blades: 0.25, side: 0.5, grime: 0.6, street: 0.4 },
        industrial: { roof: 1, blades: 0, side: 0.6, grime: 0.8, street: 0 },
        civic: { roof: 0.4, blades: 0, side: 0.15, grime: 0.4, street: 0.2 },
    };
    function kindOf(b) {
        const id = b.id || '';
        if (id.startsWith('bld_') && b.lab) return 'lab';
        if (/^(npc_apt_|res_)/.test(id)) return 'apartment';
        if (/^(cafe|gym|arena|open_square|neon_bar|bld_1)$/.test(id)) return 'shop';
        if (/^(vcrow_|robotics_|agents_|longevity_|backbone_)/.test(id)) return 'office';
        if (/^(dc_|fab_)/.test(id)) return 'industrial';
        if (/^(times_hq|uni_|court_|ai_jail|convention_center|ai_index)/.test(id)) return 'civic';
        return null;
    }
    PL.dressKind = kindOf;

    const opaque = (B, x, y) => B.base.alpha(B.X(x), B.Y(y)) > 0;
    function inSign(B, x, y) {
        const r = B.signRects;
        if (!r) return false;
        for (let i = 0; i < r.length; i++)
            if (x >= r[i].x - 1 && x < r[i].x + r[i].w + 1 && y >= r[i].y - 1 && y < r[i].y + r[i].h + 3) return true;
        return false;
    }
    // Is the box (x..x+w-1, y-h..y-1) above the roof free to paint?
    function free(B, x, y, w, h) {
        for (let j = 1; j <= h + 1; j++)
            for (let i = -1; i <= w; i++) {
                const X = x + i;
                const Y = y - j;
                if (Y < -B.head + 1) return false;
                if (opaque(B, X, Y) || inSign(B, X, Y)) return false;
            }
        return true;
    }

    // Top opaque row per column (ignoring signs and anything floating above a gap).
    function roofline(B, w) {
        const top = new Array(w).fill(null);
        for (let x = 0; x < w; x++)
            for (let y = -B.head; y < B.h; y++) {
                if (!opaque(B, x, y) || inSign(B, x, y)) continue;
                // Must be solid for a few rows: a thin mast is not a roof.
                if (opaque(B, x, y + 1) && opaque(B, x, y + 2) && opaque(B, x, y + 3)) {
                    top[x] = y;
                    break;
                }
            }
        return top;
    }
    // Runs of columns sharing the same roof height, at least `min` wide.
    function flats(top, min) {
        const out = [];
        let s = 0;
        for (let x = 1; x <= top.length; x++) {
            if (x < top.length && top[x] === top[s]) continue;
            if (top[s] !== null && x - s >= min) out.push({ x: s, w: x - s, y: top[s] });
            s = x;
        }
        return out;
    }

    // ── Roof props (stand on y, grow upward) ────────────────────────────────
    const METAL = 0x8e949e;
    const P = {
        ac(B, x, y) {
            const w = 6;
            B.rect(x, y - 4, w, 4, METAL);
            B.rect(x, y - 4, w, 1, light(METAL, 0.3));
            B.rect(x + w - 1, y - 4, 1, 4, dark(METAL, 0.35));
            // Fan grille.
            B.px(x + 1, y - 3, 0x3a3e46);
            B.px(x + 2, y - 3, 0x50545c);
            B.px(x + 1, y - 2, 0x50545c);
            B.px(x + 2, y - 2, 0x3a3e46);
            B.rect(x + 4, y - 3, 1, 2, dark(METAL, 0.2));
            return w;
        },
        vent(B, x, y) {
            B.rect(x, y - 6, 2, 6, 0x6a6e78);
            B.px(x, y - 6, 0x9aa0aa);
            B.rect(x - 1, y - 7, 4, 1, 0x4a4e58);
            B.smoke.push({ x: x + 1, y: y - 8, k: 0.35 });
            return 2;
        },
        tank(B, x, y) {
            K.tank(B, x, y);
            return 7;
        },
        dish(B, x, y) {
            K.dish(B, x + 3, y, 3);
            return 7;
        },
        mast(B, x, y, seed) {
            const h = 8 + Math.floor(hash(seed, x, 3) * 12);
            K.antenna(B, x, y, h);
            return 2;
        },
        hut(B, x, y) {
            // Stair housing with a lit door.
            const w = 8;
            K.wall(B, x, y - 7, w, 7, 0x7a7670, 'concrete', { seams: false });
            B.rect(x - 1, y - 8, w + 2, 1, 0x5a5650);
            B.rect(x + 2, y - 5, 3, 5, 0x2a2628);
            B.epx(x + 3, y - 4, 0xffe0a0);
            return w;
        },
        rail(B, x, y, w) {
            for (let i = 0; i < w; i++) {
                if (opaque(B, x + i, y - 2)) continue;
                B.px(x + i, y - 3, 0x5a5e68);
                if (i % 3 === 0) (B.px(x + i, y - 2, 0x5a5e68), B.px(x + i, y - 1, 0x5a5e68));
            }
        },
        holo(B, x, y, seed) {
            // Small rooftop ad box on a pole: two-colour neon panel.
            const w = 10;
            const h = 6;
            const c1 = NEON[Math.floor(hash(seed, x, 9) * NEON.length)];
            const c2 = NEON[Math.floor(hash(seed, x, 11) * NEON.length)];
            B.rect(x + 4, y - 5, 1, 5, 0x3a3c44);
            B.rect(x, y - 5 - h, w, h, 0x14121c);
            for (let j = 1; j < h - 1; j++)
                for (let i = 1; i < w - 1; i++) {
                    const c = (i + j * 2) % 6 < 3 ? c1 : mix(c2, 0x000000, 0.2);
                    B.px(x + i, y - 5 - h + j, dark(c, 0.35));
                    B.npx(x + i, y - 5 - h + j, c);
                }
            B.light(x + w / 2, y - 5 - h / 2, c1, 10, 'neon');
            return w;
        },
    };

    function dressRoof(B, b, w, amount) {
        if (amount <= 0) return;
        const top = roofline(B, w);
        const runs = flats(top, 8);
        const seed = B.seed;
        runs.forEach((r, ri) => {
            // Leave room at the edges; parapet rail along the run on taller buildings.
            if (r.w >= 14 && hash(seed, ri, 1) < 0.55 * amount) P.rail(B, r.x + 1, r.y, r.w - 2);
            let x = r.x + 2;
            let n = 0;
            while (x < r.x + r.w - 3) {
                const roll = hash(seed, x, ri * 13 + 5);
                if (roll > amount * 0.75) {
                    x += 4;
                    continue;
                }
                const pick = hash(seed, x, ri * 7 + 3);
                const kind =
                    pick < 0.3 ? 'ac' : pick < 0.45 ? 'vent' : pick < 0.58 ? 'tank' : pick < 0.68 ? 'dish'
                        : pick < 0.8 ? 'mast' : pick < 0.9 ? 'hut' : 'holo';
                const need = { ac: [6, 5], vent: [2, 8], tank: [7, 15], dish: [7, 8], mast: [2, 22], hut: [8, 9], holo: [10, 12] }[kind];
                if (x + need[0] > r.x + r.w - 2 || !free(B, x, r.y, need[0], need[1])) {
                    x += 3;
                    continue;
                }
                const used = P[kind](B, x, r.y, seed);
                x += used + 2 + Math.floor(hash(seed, x, 77) * 4);
                if (++n > 8) break;
            }
        });
    }

    // Things hanging off the left/right edges, in the bake's side margin.
    function dressSides(B, b, w, h, k) {
        const seed = B.seed;
        const up = h - PL.LOBBY;
        if (up < 14) return;
        const top = roofline(B, w);
        [0, 1].forEach((side) => {
            const ex = side ? w : -1; // first column outside the facade
            const dir = side ? 1 : -1;
            const roofY = top[side ? w - 1 : 0];
            if (roofY === null) return;
            // Drainpipe down the corner.
            if (hash(seed, side, 1) < k.side * 0.6) {
                for (let y = roofY + 2; y < up + PL.LOBBY - 1; y++) {
                    B.px(ex, y, y % 9 === 0 ? 0x5a5e68 : 0x3a3e46);
                }
            }
            // AC boxes on brackets, some dripping.
            for (let y = roofY + 8; y < up - 6; y += PL.FLOOR) {
                if (hash(seed, side * 31, y) > k.side * 0.35) continue;
                const x0 = side ? ex + 1 : ex - 4;
                B.rect(x0, y, 4, 3, 0x9aa0a8);
                B.rect(x0, y, 4, 1, 0xc8ccd2);
                B.px(side ? x0 : x0 + 3, y + 1, 0x4a5058);
                B.px(x0 + 1, y + 3, 0x3a3e46);
                B.px(x0 + 2, y + 3, 0x3a3e46);
            }
            // Vertical blade sign.
            if (k.blades && hash(seed, side, 5) < k.blades) {
                const word = WORDS[Math.floor(hash(seed, side, 6) * WORDS.length)];
                const col = NEON[Math.floor(hash(seed, side, 7) * NEON.length)];
                const len = word.length * 6 + 2;
                const by = roofY + 6 + Math.floor(hash(seed, side, 8) * Math.max(1, up - len - roofY - 14));
                if (by + len < up - 2) {
                    const bx = side ? ex + 2 : ex - 6;
                    // Bracket arms back to the wall.
                    B.rect(side ? ex : bx + 5, by + 2, 2, 1, 0x3a3c44);
                    B.rect(side ? ex : bx + 5, by + len - 3, 2, 1, 0x3a3c44);
                    K.blade(B, bx, by, word, col, { max: 7, bg: 0x120e18 });
                }
            }
            void dir;
        });
    }

    // Dark streaks dripping from ledges (a ledge = a row noticeably lighter than the next).
    function grime(B, w, h, amount) {
        if (amount <= 0) return;
        const seed = B.seed;
        const lum = (c) => (c < 0 ? -1 : PL.lum(c));
        for (let x = 1; x < w - 1; x++) {
            if (hash(seed, x, 404) > 0.42 * amount) continue;
            for (let y = 0; y < h - PL.LOBBY - 2; y++) {
                const c = B.get(x, y);
                const below = B.get(x, y + 1);
                if (c < 0 || below < 0 || lum(c) - lum(below) < 0.12) continue;
                const len = 3 + Math.floor(hash(seed, x, y) * 7);
                for (let k = 1; k <= len; k++) {
                    const p = B.get(x, y + k);
                    if (p < 0) break;
                    const f = 1 - (1 - k / (len + 1)) * 0.16;
                    if (PL.bayer(x, y + k) < (1 - k / (len + 1)) * 0.9) B.px(x, y + k, PL.mix(shade(p, f), 0x2a2030, 0.06));
                }
                y += len;
            }
        }
    }

    // A vending machine or a neon OPEN sign by the door.
    function street(B, w, h, amount) {
        const seed = B.seed;
        if (hash(seed, 9, 9) > amount || w < 26) return;
        const side = hash(seed, 9, 10) > 0.5;
        const x = side ? w - 6 : 2;
        const y = h; // pavement line
        const col = [0xe8403a, 0x2a7ae8, 0xf2f2f2, 0x3ab86a][Math.floor(hash(seed, 9, 11) * 4)];
        B.rect(x, y - 9, 4, 9, col);
        B.rect(x, y - 9, 4, 1, light(col, 0.3));
        B.rect(x + 3, y - 9, 1, 9, dark(col, 0.35));
        B.rect(x + 1, y - 7, 2, 4, 0xcfe8ff);
        B.npx(x + 1, y - 7, 0xe8f6ff);
        B.npx(x + 2, y - 7, 0xe8f6ff);
        B.npx(x + 1, y - 6, 0xcfe8ff);
        B.npx(x + 2, y - 5, 0xcfe8ff);
        B.light(x + 2, y - 6, 0xcfe8ff, 6, 'neon');
    }

    PL.dress = function (B, b, w, h) {
        const kind = kindOf(b);
        if (!kind || PL.noDress) return;
        const k = KIND[kind];
        grime(B, w, h, k.grime);
        dressRoof(B, b, w, k.roof);
        dressSides(B, b, w, h, k);
        street(B, w, h, k.street);
    };
})();
