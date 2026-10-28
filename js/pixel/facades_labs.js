/* Pixel art — the long tail of lab HQs. About fifty labs east of the famous towers used to
   share one look (a three-floor glass box). Each now gets a building that says what it is:
     bigtech    — a corporate pavilion on a plaza: logo totem, flags, cantilevered roof
     academic   — a stone institute: colonnade, pediment, dome or clock, banners, ivy, bikes
     collective — an open-source hackerspace: brick shed, sawtooth roof, open roll-up door
                  onto a lit workshop, a mural, string lights
     indie      — one person's lab: a garage studio beside a small house, or a walk-up studio
                  above a ramen shop / laundromat with the handle glowing in the window
     loft       — a startup in a converted brick loft with a glass penthouse and roof terrace
   The tier comes from a curated table, then the lab's stock ticker (listed → corporate),
   its name (university/institute → academic) and its id (a handle with digits → indie).
   A lab that grows past five floors keeps its tower style: success gets a skyscraper.
   Painters only use footprint coordinates and run without the game (pixel-lab/). */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const P = PL.P;
    const { mix, dark, light, hash } = PL;
    const LOBBY = PL.LOBBY;
    const FLOOR = PL.FLOOR;

    const TIER = {
        bigtech: [
            'alibaba',
            'baidu',
            'tencent',
            'bytedance',
            'xiaomi',
            'meituan',
            'apple',
            'ibm',
            'salesforce_research',
            'snowflake',
            'databricks',
            'lg',
            'naver',
            'cerebras_systems',
            'samsung',
            'huawei',
            'intel',
            'qualcomm',
            'sony',
            'oracle',
            'adobe',
            'kakao',
        ],
        academic: [
            'epfl',
            'allen_ai',
            'shanghai_ai_lab',
            'tii',
            'technology_innovation_institute',
            'lmms-lab',
            'stanford',
            'berkeley',
            'tsinghua',
            'mit',
            'cmu',
            'kaist',
            'baai',
        ],
        collective: ['eleutherai', 'bigcode', 'bigscience', 'nous', 'nous_research', 'huggingface', 'laion'],
        indie: ['paul_gauthier', 'haotian_liu', 'alfredpros', 'sao10k', 'yuxinlu1', 'teknium', 'thebloke'],
    };
    const BY_ID = {};
    for (const t in TIER) TIER[t].forEach((id) => (BY_ID[id] = t));

    const labInfo = (b) => (PL.LABS && PL.LABS[b.lab]) || null;
    const shortName = (b) => {
        const l = labInfo(b);
        return (l && l.name) || String(b.name || '').replace(/\s+HQ$/i, '');
    };

    PL.labTier = function (b) {
        if (!b || !b.lab || !String(b.id || '').startsWith('bld_')) return null;
        if (PL.FIXED_STYLE && PL.FIXED_STYLE[b.lab]) return null;
        if (PL.floorsOf(b) > 5) return null;
        const id = b.lab;
        if (BY_ID[id]) return BY_ID[id];
        const l = labInfo(b);
        const name = String((l && l.name) || b.name || '');
        if (l && l.ticker && /^[A-Z.]{1,6}$/.test(String(l.ticker))) return 'bigtech';
        if (
            /universit|institut|college|school|academ|epfl|tsinghua|stanford|berkeley|\bmit\b|kaist/i.test(
                name
            )
        )
            return 'academic';
        if (/[a-z]\d+$/i.test(id)) return 'indie';
        return PL.seedOf(id) % 4 === 0 ? 'loft' : null;
    };

    // ── Small shared pieces ─────────────────────────────────────────────────
    // A vertical slab carrying the name letter by letter, lit from inside at night.
    function totem(B, x, base, th, name, pal) {
        const W = 5;
        const y0 = base - th;
        B.rect(x, y0, W, th, 0x23262e);
        B.rect(x, y0, W, 1, 0x4a4e58);
        B.rect(x + W - 1, y0 + 1, 1, th - 1, 0x15171c);
        B.rect(x, base - 1, W, 1, 0x3a3e48);
        const s = String(name)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, Math.max(1, Math.floor((th - 4) / 6)));
        for (let i = 0; i < s.length; i++) {
            B.text(s[i], x + 1, y0 + 2 + i * 6, light(pal.accent, 0.2), 3);
            B.etext(s[i], x + 1, y0 + 2 + i * 6, light(pal.accent, 0.4), 3);
        }
        (B.signRects = B.signRects || []).push({ x: x - 1, y: y0 - 1, w: W + 2, h: th + 1 });
    }
    // A robot at a desk with a glowing monitor (for workshop and studio interiors).
    function coder(B, x, y, glow) {
        B.rect(x, y - 3, 2, 3, 0x4a5a6a); // body
        B.rect(x, y - 5, 2, 2, 0xc8d0d8); // head
        B.epx(x + 1, y - 4, 0x4ff0ff);
        B.rect(x + 3, y - 2, 5, 1, 0x5a4a3a); // desk
        B.rect(x + 4, y - 5, 3, 3, 0x1a1e26); // monitor
        B.erect(x + 4, y - 5, 3, 2, glow || 0x9ae8ff);
        B.light(x + 5, y - 4, glow || 0x9ae8ff, 6, 'spot');
    }
    function grass(B, x, y, w) {
        for (let i = 0; i < w; i++) {
            B.px(x + i, y, (x + i) % 3 === 0 ? 0x3a7a3a : 0x4a8e44);
            if (B.h01(x + i, 41) > 0.7) B.px(x + i, y - 1, 0x5aa04e);
        }
    }
    function bike(B, x, y, col) {
        B.px(x, y - 1, 0x2a2a30);
        B.px(x + 3, y - 1, 0x2a2a30);
        B.rect(x, y - 2, 4, 1, col);
        B.px(x + 3, y - 3, 0x2a2a30);
    }
    function mailbox(B, x, y) {
        B.rect(x, y - 3, 1, 3, 0x4a4e58);
        B.rect(x - 1, y - 5, 3, 2, 0x3a5a9a);
        B.px(x + 1, y - 6, 0xd84a4a);
    }

    // ── bigtech: a pavilion on a plaza ──────────────────────────────────────
    P.tier_bigtech = function (B, b, w, h) {
        const pal = K.labPalette(PL.labColor(b));
        const up = h - LOBBY;
        const plazaW = Math.max(16, Math.round(w * 0.26));
        const right = B.h01(3, 5) > 0.5;
        const px0 = right ? w - plazaW : 0;
        const bx = right ? 0 : plazaW;
        const bw = w - plazaW;
        const top = 5;
        K.curtain(B, bx, top, bw, up - top, {
            pitch: 4,
            mullion: 0xd8dde2,
            glassTop: mix(0xb0d4ee, pal.accent, 0.1),
            glassBot: mix(0x4a6a8a, pal.deep, 0.3),
            lit: 0.5,
            floorLit: 0.72,
            tone: 'office',
        });
        for (let y = top; y < up; y += FLOOR) B.rect(bx, y, bw, 1, 0xeef0f2);
        B.rect(bx, top, 1, up - top, light(pal.accent, 0.15));
        B.rect(bx + bw - 1, top, 1, up - top, dark(pal.accent, 0.25));
        // Cantilevered roof slab with a strip of light underneath.
        B.rect(bx - 3, top - 3, bw + 6, 2, 0xf6f7f9);
        B.rect(bx - 3, top - 1, bw + 6, 1, 0xa8aeb6);
        B.erect(bx - 2, top - 1, bw + 4, 1, light(pal.accent, 0.45), 170);
        K.lobby(B, bx, up, bw, LOBBY, { accent: pal.accent, interior: 0xf8ecd8, pitch: 6 });
        // Plaza: pale paving, a tree, a flag and the logo totem by the entrance.
        for (let x = px0; x < px0 + plazaW; x++) {
            B.px(x, h - 1, x % 4 === 0 ? 0xa8a49c : 0xc4c0b6);
            B.px(x, h - 2, 0xd8d4ca);
        }
        const tx = right ? px0 + 3 : px0 + plazaW - 8;
        totem(B, tx, h - 2, Math.min(up - 2, 26), shortName(b), pal);
        const treeX = right ? px0 + plazaW - 5 : px0 + 4;
        K.tree(B, treeX, h - 2, 4, PL.S.LEAF.green);
        B.rect(treeX - 2, h - 3, 5, 1, 0x7a7a72);
        K.flag(B, right ? px0 + plazaW - 10 : px0 + 10, h - 2, [pal.accent, 0xf4f4f4], 18);
        K.lamp(B, Math.round(px0 + plazaW / 2), h - 2);
        // Roof: solar rows and the name.
        if (bw > 40) K.solar(B, bx + 3, top - 3, Math.min(20, bw - 32));
        PL.roofSign(B, shortName(b), bx, bw, top - 3, pal.accent, { small: bw < 50 });
    };

    // ── academic: a stone institute ─────────────────────────────────────────
    P.tier_academic = function (B, b, w, h) {
        const pal = K.labPalette(PL.labColor(b));
        const stone = B.h01(2, 9) > 0.5 ? 0xd8ccb4 : 0xc8b8a0;
        const up = h - LOBBY;
        const top = 7;
        const pw = Math.min(28, Math.max(16, Math.round(w * 0.3)));
        const px = Math.round((w - pw) / 2);
        K.wall(B, 0, top, w, h - top, stone, 'stone');
        K.cap(B, 0, top, w, light(stone, 0.18), { thick: true });
        // Tall windows, the middle bay left to the portico.
        K.windows(B, 1, top + 4, w - 2, up - top - 2, {
            floorH: FLOOR,
            winW: 3,
            winH: 6,
            pitch: 6,
            top: 1,
            inset: 3,
            tone: 'home',
            lit: 0.55,
            frame: dark(stone, 0.4),
            lintel: light(stone, 0.25),
            sill: dark(stone, 0.2),
            skip: (f, c, cols, floors) => {
                const wx = Math.floor((w - (cols * 6 - 3)) / 2) + c * 6;
                return wx + 4 > px - 2 && wx < px + pw + 2;
            },
        });
        // Portico: columns under a pediment, steps, the door.
        K.columns(B, px, top + 5, pw, h - top - 7, light(stone, 0.12), 5);
        K.pediment(B, px - 2, top + 5, pw + 4, light(stone, 0.14));
        B.rect(px - 3, h - 2, pw + 6, 1, light(stone, 0.25));
        B.rect(px - 5, h - 1, pw + 10, 1, dark(stone, 0.08));
        K.door(B, Math.round(w / 2) - 2, h - 9, 4, 7, 0x4a3426);
        // Name engraved on the frieze.
        K.plaqueC(B, Math.round(w / 2), top + 1, shortName(b), 0x3a2e22, light(stone, 0.28), false, w - 6);
        // Dome or clock turret on the roof.
        if (B.h01(9, 9) > 0.45) {
            const dc = mix(0x6a8a7a, pal.accent, 0.18);
            B.rect(Math.round(w / 2) - 6, top - 2, 13, 2, light(stone, 0.1));
            K.dome(B, Math.round(w / 2), top - 2, 6, dc, { ribs: true });
        } else {
            const cx = Math.round(w / 2) - 3;
            K.wall(B, cx, top - 12, 7, 12, light(stone, 0.05), 'stone');
            K.pitched(B, cx - 1, top - 12, 9, 0x5a4a5a, { h: 4 });
            B.ellipse(cx + 3, top - 7, 2, 2, 0xf4ecd8);
            B.px(cx + 3, top - 8, 0x2a2a30);
            B.px(cx + 4, top - 7, 0x2a2a30);
            B.epx(cx + 3, top - 7, 0xfff0c8);
        }
        // Banners in the lab colour on both flanks.
        [px - 7, px + pw + 4].forEach((bx) => {
            if (bx < 2 || bx > w - 5) return;
            B.rect(bx, top + 4, 3, 11, pal.accent);
            B.rect(bx, top + 4, 3, 1, light(pal.accent, 0.3));
            B.px(bx + 1, top + 15, pal.accent);
            B.px(bx + 1, top + 7, 0xf4f4f0);
            B.px(bx + 1, top + 9, 0xf4f4f0);
        });
        // Ivy climbing one corner.
        const ivyX = B.h01(5, 5) > 0.5 ? 0 : w - 6;
        for (let y = top + 3; y < h - 1; y++)
            for (let i = 0; i < 6; i++)
                if (B.h01(ivyX + i, y) < 0.42 - (h - y) * 0.004)
                    B.px(ivyX + i, y, B.h01(y, ivyX + i) > 0.5 ? 0x3a6a3a : 0x4e8a46);
        // Bikes at the steps.
        bike(B, px - 12, h, 0xd84a4a);
        bike(B, px - 7, h, 0x4a7ad8);
        if (w > 70) bike(B, px + pw + 6, h, 0x5ab85a);
    };

    // ── collective: an open-source hackerspace ──────────────────────────────
    const MURAL = [0xffd23a, 0xff5a8a, 0x4ad8ff, 0x7aff7a, 0xb07aff, 0xff9a3a];
    P.tier_collective = function (B, b, w, h) {
        const pal = K.labPalette(PL.labColor(b));
        const brick = 0x9a5a44;
        const top = 9;
        K.wall(B, 0, top, w, h - top, brick, 'brick');
        // Sawtooth roof with north-light glazing.
        const tooth = 10;
        for (let x = 0; x < w; x += tooth)
            for (let i = 0; i < tooth && x + i < w; i++) {
                const hh = Math.round(((i + 1) / tooth) * 6);
                B.rect(x + i, top - hh, 1, hh, i % 3 === 0 ? 0x5e6470 : 0x6a707c);
                if (i === tooth - 1) {
                    B.rect(x + i, top - 6, 1, 6, 0x9ac8e0);
                    B.erect(x + i, top - 6, 1, 6, 0xffe0a0, 200);
                }
            }
        B.rect(0, top, w, 1, dark(brick, 0.35));
        // Open roll-up door onto the lit workshop.
        const dw = Math.min(30, Math.max(18, Math.round(w * 0.36)));
        const dx = Math.round(w * 0.1);
        const dh = 17;
        const dy = h - dh;
        B.rect(dx - 1, dy - 1, dw + 2, dh + 1, 0x2a2a30);
        B.rect(dx, dy, dw, dh, 0x3a3440);
        for (let j = 0; j < dh; j++)
            for (let i = 0; i < dw; i++)
                B.epx(dx + i, dy + j, j < 3 ? 0x8a7a68 : mix(0xffd8a0, 0xffb870, j / dh), 205);
        for (let i = 0; i < dw; i++) {
            B.px(dx + i, dy, 0x8a8e96);
            B.px(dx + i, dy + 1, i % 2 ? 0x6a6e76 : 0x9a9ea6);
            B.px(dx + i, dy + 2, 0x5a5e66);
        }
        coder(B, dx + 3, h - 1, 0x9ae8ff);
        if (dw > 22) coder(B, dx + dw - 11, h - 1, 0xb0ffb0);
        B.rect(dx + Math.round(dw / 2) - 1, dy + 5, 3, dh - 6, 0x2a2e38); // server rack
        for (let j = dy + 6; j < h - 2; j += 2)
            B.epx(dx + Math.round(dw / 2), j, B.h01(j, 7) > 0.5 ? 0x7aff9a : 0xffb84a);
        B.light(dx + dw / 2, h - 1, 0xffd9a0, 14, 'shop');
        // Hand-painted name over the door.
        const s = PL.fit(shortName(b), w - 6, 3);
        const sw = PL.textW(s, 3) + 4;
        const sx = Math.max(1, Math.min(w - sw - 1, dx + Math.round((dw - sw) / 2)));
        B.rect(sx, dy - 9, sw, 7, 0xf0e6cc);
        B.rect(sx, dy - 9, sw, 1, 0xffffff);
        B.text(s, sx + 2, dy - 8, dark(pal.accent, 0.2), 3);
        B.etext(s, sx + 2, dy - 8, light(pal.accent, 0.2), 3);
        (B.signRects = B.signRects || []).push({ x: sx, y: dy - 9, w: sw, h: 7 });
        // A mural across the rest of the wall: big shapes in the open-source colours.
        const mx = dx + dw + 4;
        const mw = w - mx - 3;
        if (mw > 10) {
            const my = top + 4;
            const mh = h - top - 9;
            for (let j = 0; j < mh; j++)
                for (let i = 0; i < mw; i++) {
                    const X = mx + i;
                    const Y = my + j;
                    const k = Math.floor(
                        ((i + j * 0.6) / 9 + hash(B.seed, Math.floor(i / 9), 3) * 2) % MURAL.length
                    );
                    const c = MURAL[(k + Math.floor(j / 7)) % MURAL.length];
                    const blob = Math.hypot(((i % 12) - 6) / 6, ((j % 10) - 5) / 5) < 0.85;
                    if (blob || (i + j) % 7 === 0) B.px(X, Y, mix(c, brick, 0.18));
                }
            // A big smiley in the middle (open-source joy).
            const cx = mx + Math.round(mw / 2);
            const cy = my + Math.round(mh / 2);
            B.ellipse(cx, cy, 4.5, 4.5, 0xffd23a);
            B.px(cx - 2, cy - 1, 0x2a2a30);
            B.px(cx + 2, cy - 1, 0x2a2a30);
            B.rect(cx - 2, cy + 2, 5, 1, 0x2a2a30);
        }
        K.stringLights(B, 1, top + 2, w - 2, top + 2, 3);
        K.tank(B, w - 10, top - 6);
        // Bench and a community board outside.
        B.rect(dx + dw + 3, h - 3, 7, 1, 0x7a5a3a);
        B.px(dx + dw + 3, h - 2, 0x4a3a2a);
        B.px(dx + dw + 9, h - 2, 0x4a3a2a);
        bike(B, dx - 6 < 0 ? dx + dw + 12 : dx - 6, h, 0xffb84a);
    };

    // ── indie: one person's lab ─────────────────────────────────────────────
    const SHOPS = [
        ['RAMEN', 0xd84a3a],
        ['LAUNDRY', 0x4a8ad8],
        ['GPU REPAIR', 0x3ac88a],
        ['COFFEE', 0xc8843a],
        ['VINYL', 0xb05ad8],
    ];
    P.tier_indie = function (B, b, w, h) {
        const pal = K.labPalette(PL.labColor(b));
        const name = shortName(b);
        if (B.h01(4, 4) > 0.5) {
            // Garage studio beside a little house.
            const siding = [0xc8d8e0, 0xe4d4b4, 0xbcd0b0, 0xe0c4c4][Math.floor(B.h01(8, 1) * 4)];
            const hw = Math.min(34, Math.round(w * 0.42));
            const gw = Math.min(26, Math.round(w * 0.3));
            const hx = B.h01(6, 6) > 0.5 ? 2 : w - hw - gw - 2;
            const gx = hx + hw;
            const hy = h - 2 * FLOOR - 2;
            K.wall(B, hx, hy, hw, h - hy, siding, 'wood');
            K.pitched(B, hx - 1, hy, hw + 2, 0x6a4a4a, { h: Math.round(hw * 0.32) });
            K.windows(B, hx + 1, hy + 2, hw - 2, 2 * FLOOR - 2, {
                floorH: FLOOR,
                winW: 4,
                winH: 4,
                pitch: 8,
                top: 1,
                inset: 3,
                tone: 'home',
                lit: 0.6,
                frame: 0xf4f4f0,
                shutters: dark(siding, 0.35),
            });
            K.door(B, hx + Math.round(hw / 2) - 2, h - 7, 4, 7, 0x5a3a2a);
            K.chimney(B, hx + hw - 7, hy - Math.round(hw * 0.2), 5, 0x8a5a44);
            // The garage: door rolled up, desk, monitors, rack, the dev.
            const gy = h - FLOOR - 4;
            K.wall(B, gx, gy, gw, h - gy, light(siding, 0.05), 'wood');
            B.rect(gx - 1, gy - 1, gw + 2, 1, 0x4a4a52);
            const dw = gw - 4;
            const dx = gx + 2;
            const dy = gy + 3;
            B.rect(dx, dy, dw, h - dy, 0x2a2630);
            for (let j = 0; j < h - dy; j++)
                for (let i = 0; i < dw; i++)
                    B.epx(dx + i, dy + j, j < 2 ? 0x7a6a5a : 0xffd8a8, j < 2 ? 160 : 190);
            for (let i = 0; i < dw; i++) B.px(dx + i, dy, i % 2 ? 0x8a8e96 : 0xa8acb4);
            coder(B, dx + 2, h - 1, 0x9ae8ff);
            B.rect(dx + dw - 4, dy + 3, 3, h - dy - 3, 0x23262e);
            for (let j = dy + 4; j < h - 1; j += 2) B.epx(dx + dw - 3, j, 0x7aff9a);
            B.light(dx + dw / 2, h - 1, 0xffd9a0, 10, 'shop');
            // Hand-painted plank with the handle.
            const s = PL.fit(name, Math.max(16, gw + 10), 3);
            const sw = PL.textW(s, 3) + 4;
            const sx = gx + Math.round((gw - sw) / 2);
            B.rect(sx, gy - 9, sw, 7, 0x8a5a3a);
            B.rect(sx, gy - 9, sw, 1, 0xb07a52);
            B.text(s, sx + 2, gy - 8, 0xf4e8c8, 3);
            B.etext(s, sx + 2, gy - 8, light(pal.accent, 0.35), 3);
            (B.signRects = B.signRects || []).push({ x: sx, y: gy - 9, w: sw, h: 8 });
            // Yard: grass, a tree, a mailbox and a picket fence on the free side.
            const yx = hx > 2 ? 0 : gx + gw;
            const yw = hx > 2 ? hx : w - yx;
            if (yw > 6) {
                grass(B, yx, h - 1, yw);
                if (yw > 12)
                    K.tree(
                        B,
                        yx + Math.round(yw / 2),
                        h - 1,
                        Math.min(5, Math.round(yw / 4)),
                        PL.S.LEAF.green
                    );
                K.fence(B, yx, h - 1, Math.min(yw, 12), 0xf0f0ea, 'picket');
                mailbox(B, hx > 2 ? hx - 3 : gx + gw + 2, h - 1);
            }
            return;
        }
        // Walk-up studio above a shop, with an alley beside it.
        const brick = [0xa8604a, 0x8a5a5a, 0xb0784a][Math.floor(B.h01(8, 2) * 3)];
        const bw = Math.min(w - 10, Math.max(30, Math.round(w * 0.58)));
        const bx = B.h01(6, 7) > 0.5 ? 0 : w - bw;
        const top = Math.max(2, h - 3 * FLOOR - LOBBY + 2);
        K.wall(B, bx, top, bw, h - top, brick, 'brick');
        K.cap(B, bx, top, bw, dark(brick, 0.25));
        const shop = SHOPS[Math.floor(B.h01(3, 3) * SHOPS.length)];
        K.shop(B, bx + 1, h - LOBBY, bw - 2, LOBBY, {
            accent: shop[1],
            sign: shop[0],
            signCol: light(shop[1], 0.3),
        });
        K.windows(B, bx + 1, top + 3, bw - 2, h - LOBBY - top - 4, {
            floorH: FLOOR,
            winW: 4,
            winH: 5,
            pitch: 7,
            top: 1,
            inset: 2,
            tone: 'home',
            lit: 0.5,
            frame: dark(brick, 0.45),
            sill: 0xc8c0b0,
        });
        // The studio: the top-floor window is one big lit pane with the dev at work and the
        // handle in neon.
        const sx0 = bx + 3;
        const sw = bw - 6;
        const sy = top + 2;
        B.rect(sx0 - 1, sy - 1, sw + 2, FLOOR, 0x1e1c24);
        for (let j = 0; j < FLOOR - 2; j++)
            for (let i = 0; i < sw; i++) B.epx(sx0 + i, sy + j, mix(0xffd8a8, 0x9ac8ff, i / sw), 200);
        B.rect(sx0, sy, sw, FLOOR - 2, 0x3a3a48);
        coder(B, sx0 + 2, sy + FLOOR - 2, 0x9ae8ff);
        const s = PL.fit(name, sw - 12, 3);
        const tw = PL.textW(s, 3);
        B.text(s, sx0 + sw - tw - 2, sy + 1, dark(pal.accent, 0.1), 3);
        B.etext(s, sx0 + sw - tw - 2, sy + 1, light(pal.accent, 0.35), 3);
        (B.signRects = B.signRects || []).push({ x: sx0, y: sy - 1, w: sw, h: FLOOR });
        K.fireEscape(B, bx + bw - 9, top + 2, 8, 3, FLOOR, 0x1e1c22);
        K.ac(B, bx + 2, top + FLOOR + 6, 4);
        // Laundry line on the roof.
        const ly = top - 5;
        B.rect(bx + 3, ly, 1, 5, 0x5a5a62);
        B.rect(bx + bw - 4, ly, 1, 5, 0x5a5a62);
        for (let i = bx + 4; i < bx + bw - 4; i++) B.px(i, ly + 1, 0x8a8a92);
        [0xe8e8f0, 0xd84a4a, 0x4a8ad8, 0xf2d27a].forEach((c, i) => {
            const x = bx + 6 + i * 6;
            if (x + 3 < bx + bw - 4) B.rect(x, ly + 2, 3, 3, c);
        });
        // The alley: a dumpster and a cat.
        const ax = bx === 0 ? bw + 1 : 1;
        const aw = w - bw - 2;
        if (aw > 6) {
            B.rect(ax, h - 5, Math.min(8, aw - 1), 5, 0x2e5a3e);
            B.rect(ax, h - 5, Math.min(8, aw - 1), 1, 0x3e7a52);
            B.px(ax + 1, h - 6, 0x2a2a30);
            B.px(ax + 2, h - 7, 0x2a2a30);
            B.px(ax + 3, h - 6, 0x2a2a30);
            B.epx(ax + 2, h - 7, 0xd8ff5a, 120);
        }
    };

    // ── loft: a startup in a converted brick factory ────────────────────────
    P.tier_loft = function (B, b, w, h) {
        const pal = K.labPalette(PL.labColor(b));
        const brick = [0x9a5040, 0x8a4a3a, 0xa0603a][Math.floor(B.h01(1, 7) * 3)];
        const up = h - LOBBY;
        const top = 10;
        K.wall(B, 0, top, w, h - top, brick, 'brick');
        K.cap(B, 0, top, w, dark(brick, 0.3), { thick: true });
        // Big industrial windows: many small panes in steel frames.
        const fl = Math.max(1, Math.floor((up - top - 2) / FLOOR));
        for (let f = 0; f < fl; f++) {
            const wy = top + 3 + f * FLOOR;
            for (let x = 3; x + 9 <= w - 3; x += 12) {
                B.rect(x - 1, wy - 1, 11, FLOOR - 1, 0x2a2a30);
                const lit = B.h01(x, wy) < 0.55;
                for (let j = 0; j < FLOOR - 3; j++)
                    for (let i = 0; i < 9; i++) {
                        const mull = i % 3 === 2 || j % 3 === 2;
                        B.px(
                            x + i,
                            wy + j,
                            mull ? 0x3a3a44 : PL.dpick([0x9ab8cc, 0x6a8aa6], j / FLOOR, x + i, wy + j)
                        );
                        if (!mull && lit) B.epx(x + i, wy + j, j % 3 === 0 ? 0xffe2b0 : 0xffd090, 210);
                    }
            }
        }
        // Ghost sign painted on the brick.
        const s = PL.fit(shortName(b), w - 8, 3);
        const gw = PL.textW(s, 3);
        B.text(s, Math.round((w - gw) / 2), top + 1, light(brick, 0.45), 3);
        // Ground floor: a café with an awning and tables outside.
        const front = ['CAFE', 'BAKERY', 'BIKES', 'GALLERY', 'DELI', 'BOOKS', 'NOODLES'][
            Math.floor(B.h01(7, 3) * 7)
        ];
        K.shop(B, 1, up, w - 2, LOBBY, { accent: pal.accent, sign: front, signCol: light(pal.accent, 0.3) });
        // Glass penthouse on the roof with a terrace.
        const pw = Math.round(w * 0.46);
        const px = B.h01(2, 4) > 0.5 ? 3 : w - pw - 3;
        K.curtain(B, px, top - 8, pw, 8, {
            pitch: 4,
            mullion: 0x2a3038,
            glassTop: mix(0xb0d4ee, pal.accent, 0.12),
            glassBot: 0x5a7a9a,
            lit: 0.7,
            floorLit: 0.9,
            tone: 'office',
        });
        B.rect(px - 1, top - 9, pw + 2, 1, 0xd8dce2);
        const tx0 = px === 3 ? px + pw + 2 : 3;
        const tx1 = px === 3 ? w - 3 : px - 2;
        for (let x = tx0; x < tx1; x += 2) B.px(x, top - 2, 0x94a3b8);
        B.rect(tx0, top - 1, tx1 - tx0, 1, 0x94a3b8);
        if (tx1 - tx0 > 10) {
            const ux = tx0 + Math.round((tx1 - tx0) / 2);
            B.rect(ux - 3, top - 7, 7, 1, pal.accent);
            B.rect(ux - 2, top - 8, 5, 1, light(pal.accent, 0.3));
            B.rect(ux, top - 6, 1, 5, 0x5a5a62);
            K.plants(B, tx0 + 1, top - 1, 3);
            K.plants(B, tx1 - 4, top - 1, 3);
            K.stringLights(B, tx0, top - 9, tx1, top - 9, 2);
        }
        PL.roofSign(B, shortName(b), px, pw, top - 9, pal.accent, { small: true });
    };
})();
