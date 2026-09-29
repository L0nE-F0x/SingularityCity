/* Pixel lab v2 — building painters. One painter per archetype; the dispatcher picks by
   id/type the same way js/environment.js does, so every live building gets a facade.
   Geometry is the live city's: width b.w, height (floors × 18 + 24) world px, where
   floors = dynamicFl || fl. In art px that is w/3 wide and floors × 6 + 8 tall. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;

    const P = (PL.P = {});
    const LOBBY = 8;
    const FLOOR = 6;

    PL.floorsOf = (b) => b.dynamicFl || b.dfl || b.fl || 1;
    PL.artW = (b) => Math.max(4, Math.round(b.w / PL.ART));
    PL.artH = (b) => PL.floorsOf(b) * FLOOR + LOBBY;

    function labOf(b) {
        return (b.lab && PL.LABS && PL.LABS[b.lab]) || null;
    }
    function labColor(b) {
        const lab = labOf(b);
        return hex((lab && lab.color) || b.color || '#64748b');
    }
    function labName(b) {
        const lab = labOf(b);
        return (lab && lab.name) || b.name.replace(/\s+HQ$/i, '');
    }
    PL.labColor = labColor;

    // Same style assignment as Environment._labStyleFor in the live city.
    const FIXED = {
        openai: 'monolith',
        anthropic: 'campus',
        google: 'campus',
        meta: 'monolith',
        xai: 'brutalist',
        microsoft: 'setback',
        deepseek: 'pagoda',
        mistral: 'euro',
        nvidia: 'monolith',
        amazon: 'setback',
        ibm: 'setback',
        apple: 'monolith',
    };
    function labHash(id) {
        let h = 0;
        const s = String(id || 'lab');
        for (let i = 0; i < s.length; i++) h = ((h << 5) - h + s.charCodeAt(i)) | 0;
        return Math.abs(h);
    }
    function styleFor(labId) {
        if (FIXED[labId]) return FIXED[labId];
        const h = labHash(labId);
        const lab = PL.LABS && PL.LABS[labId];
        const region = (lab && lab.region) || 'us';
        if (region === 'cn') return ['pagoda', 'monolith', 'setback'][h % 3];
        if (region === 'eu' || region === 'uk' || region === 'fr')
            return ['euro', 'setback', 'monolith'][h % 3];
        return ['monolith', 'setback', 'campus', 'brutalist'][h % 4];
    }
    PL.styleFor = styleFor;

    // Rooftop name sign — 5×7 letters when they fit, else 3×5.
    function roofSign(B, text, x, w, y, col, o) {
        o = o || {};
        B.named = true;
        // ?classicSigns=1: the game keeps its original name boards instead.
        if (PL.noRoofSigns) return y;
        const s5 = PL.fit(text, w - 4, 5);
        const big = !o.small && s5 === String(text).toUpperCase() && PL.textW(s5, 5) <= w - 4;
        const size = big ? 5 : 3;
        const s = big ? s5 : PL.fit(text, Math.max(12, w + 6), 3);
        const tw = PL.textW(s, size);
        const bw = tw + 4;
        const bh = PL.FONTS[size].h + 4;
        const bx = x + Math.round((w - bw) / 2);
        return K.billboard(B, bx, y, bw, bh, {
            text: s,
            size: size,
            fg: col,
            bg: o.bg === undefined ? 0x14121c : o.bg,
            legH: o.legH === undefined ? 3 : o.legH,
            spots: o.spots,
        });
    }
    PL.roofSign = roofSign;

    // Environment.buildBuildings' neon sign rules: the social strip's fixed signs, then an
    // auto sign (name in muted blue) for every non-lab building not on the exclusion list.
    const NEON = {
        cafe: ['API CAFE', 0xf59e0b],
        gym: ['RLHF GYM', 0x22d3ee],
        arena: ['LMSYS ARENA', 0xef4444],
        open_square: ['OPEN SOURCE HUB', 0xa855f7],
        neon_bar: ['NEON BAR', 0xff00ff],
        uni_dorm: ['DORMITORY', 0x60a5fa],
    };
    const NO_NEON_PRE = [
        'metro_',
        'forest_',
        'house_',
        'dc_',
        'fab_',
        'npc_apt_',
        'suburb_',
        'res_',
        'embassy_',
        'align_',
    ];
    const NO_NEON_ID = {
        graveyard: 1,
        visitor_monument: 1,
        park: 1,
        city_park: 1,
        ai_index: 1,
        black_market: 1,
        times_hq: 1,
    };
    PL.classicNeon = function (b) {
        if (NEON[b.id]) return { text: NEON[b.id][0], col: NEON[b.id][1] };
        if (labOf(b)) return null;
        if (NO_NEON_ID[b.id] || NO_NEON_PRE.some((p) => b.id.startsWith(p))) return null;
        if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) return null;
        const text = String(b.name || '')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toUpperCase();
        return { text: text, col: 0x6688aa };
    };
    // Neon sign board centred on the roofline (the classic sits at y = -6 world px).
    PL.neonSign = function (B, text, col, w) {
        const lines = PL.wrap(text, Math.max(12, w - 2), 3, 3);
        const bw =
            Math.max.apply(
                null,
                lines.map((l) => PL.textW(l, 3))
            ) + 4;
        const bh = lines.length * 6 + 1;
        const x = Math.round(w / 2 - bw / 2);
        const y = -2 - bh;
        const tube = light(col, col === 0x6688aa ? 0.35 : 0.15);
        B.rect(x, y, bw, bh, 0x0a0a14);
        B.rect(x, y, bw, 1, dark(col, 0.3));
        B.rect(x, y + bh - 1, bw, 1, dark(col, 0.45));
        lines.forEach((ln, i) => {
            const tx = Math.round(w / 2 - PL.textW(ln, 3) / 2);
            B.text(ln, tx, y + 1 + i * 6, dark(tube, 0.1), 3);
            B.etext(ln, tx, y + 1 + i * 6, tube, 3);
        });
        B.light(w / 2, y + bh / 2, col, Math.max(8, Math.min(20, bw * 0.45)), 'neon');
        B.named = true;
    };

    // ── HQ towers ───────────────────────────────────────────────────────────
    P.monolith = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const inset = 0;
        // Tower shaft: dark glass with lab-tinted reflection.
        const gTop = mix(0x9cc0e0, pal.accent, 0.12);
        const gBot = mix(0x3a5578, pal.deep, 0.35);
        const crown = Math.min(10, Math.max(4, Math.round(up * 0.06)));
        K.curtain(B, inset, crown, w - inset * 2, up - crown, {
            pitch: w > 40 ? 4 : 3,
            mullion: mix(0x2c3444, pal.deep, 0.3),
            glassTop: gTop,
            glassBot: gBot,
            lit: 0.42,
            floorLit: 0.72,
            tone: 'mixed',
        });
        // Crown: solid band with the emblem.
        K.wall(B, inset, 0, w - inset * 2, crown, mix(0x2a303c, pal.deep, 0.4), 'panel', { pitch: 5 });
        K.cap(B, inset, 0, w - inset * 2, mix(0x5a6272, pal.accent, 0.2));
        if (crown >= 7) K.emblem(B, b.lab, Math.round(w / 2), Math.round(crown / 2) + 1, pal.accent, true);
        // Accent fins down both edges.
        for (let y = crown; y < up; y++) {
            B.px(inset, y, light(pal.accent, 0.05));
            B.epx(inset, y, pal.accent, 150);
            B.px(w - inset - 1, y, dark(pal.accent, 0.3));
        }
        K.lobby(B, 0, up, w, LOBBY, { accent: pal.accent, interior: 0xf4d8a8 });
        const top = roofSign(B, labName(b), 0, w, 0, pal.accent);
        if (w > 24) K.antenna(B, w - 4, 0, 4);
        if (w > 36) K.ac(B, 3, 0);
        void top;
    };

    // Classic floor row f (0 = top) starts at 14 + f × 18 world px; in art px:
    const rowY = (f) => Math.round((14 + f * 18) / PL.ART);
    // Lab name on a vertical blade when the whole name fits, else the rooftop sign.
    function bladeOrRoof(B, b, x, y, maxLetters, col, bladeOpts, roof) {
        const name = String(labName(b))
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '');
        if (name.length && name.length <= maxLetters)
            return K.blade(B, x, y, labName(b), col, Object.assign({ max: maxLetters }, bladeOpts));
        return roofSign(B, labName(b), roof.x, roof.w, roof.y, col, roof.o);
    }

    // Campus: a slimmer tower (inset 12 world px) on a podium the width of the lot — the
    // classic's bottom two floor rows — with a terrace railing and a tree on each shoulder.
    P.campus = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const floors = Math.max(1, Math.round(up / FLOOR));
        const anthropic = b.lab === 'anthropic';
        const wall = anthropic ? 0xc9b49a : b.lab === 'google' ? 0xd8dce2 : mix(0xcdbfa8, pal.pale, 0.4);
        const kind = anthropic ? 'stone' : 'stucco';
        const accent = anthropic ? 0xd97757 : pal.accent;
        const ins = floors > 2 ? Math.round(12 / PL.ART) : 0;
        const podTop = floors > 2 ? Math.min(up - 3, rowY(floors - 2)) : 0;
        const win = {
            floorH: FLOOR,
            winW: 4,
            winH: 4,
            pitch: 5,
            top: 1,
            inset: 2,
            tone: anthropic ? 'home' : 'mixed',
            lit: 0.6,
            frame: anthropic ? 0x6a4a36 : 0x4a5262,
            glassTop: 0xb8d0e0,
            glassBot: 0x6a8aa8,
        };
        const tw = w - ins * 2;
        // Tower.
        if (podTop > 0) {
            K.wall(B, ins, 0, tw, podTop, wall, kind);
            if (podTop > 5) K.windows(B, ins + 1, 3, tw - 2, podTop - 3, win);
            const every = podTop > 90 ? 5 : 3;
            for (let f = every; f * FLOOR < podTop - 2; f += every) K.band(B, ins, f * FLOOR + 3, tw, accent);
        }
        // Podium.
        K.wall(B, 0, podTop, w, up - podTop, wall, kind);
        K.windows(B, 1, podTop + (podTop ? 1 : 3), w - 2, up - podTop - (podTop ? 1 : 3), win);
        if (podTop > 0) {
            K.cap(B, 0, podTop, ins, light(wall, 0.12));
            K.cap(B, w - ins, podTop, ins, light(wall, 0.12));
            if (floors >= 4 && ins >= 3) {
                [0, w - ins].forEach((x0) => {
                    for (let x = x0; x < x0 + ins; x += 2) B.px(x, podTop - 1, 0x94a3b8);
                    const tx = x0 + Math.floor(ins / 2);
                    B.px(tx, podTop - 1, 0x5a3a24);
                    B.rect(tx - 1, podTop - 3, 3, 2, 0x2d6a4f);
                    B.px(tx, podTop - 4, 0x3a8a60);
                });
            }
        }
        // Roof garden on the tower.
        K.cap(B, ins, 0, tw, anthropic ? 0xe8d8c0 : 0xe8eaee);
        K.plants(B, ins + 2, 0, Math.max(4, tw - 4));
        if (b.lab === 'google') {
            const cols = [0x4285f4, 0xea4335, 0xfbbc05, 0x34a853];
            for (let i = 0; i < w - 2; i++) B.px(1 + i, up - 1, cols[Math.floor(i / 4) % 4]);
        }
        K.lobby(B, 0, up, w, LOBBY, { accent: accent, frame: 0x3a3230, interior: 0xffe0b0 });
        roofSign(B, labName(b), ins, tw, -2, anthropic ? 0xf0a07a : pal.accent);
        if (podTop > 30) K.emblem(B, b.lab, w - ins - 6, 8, pal.accent, true);
    };

    P.brutalist = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const conc = b.lab === 'xai' ? 0x6a6c72 : 0x8a8680;
        K.wall(B, 0, 0, w, up, conc, 'concrete', { seamY: 12 });
        // Deep slit windows in pairs.
        for (let f = 1; f * FLOOR < up - 4; f++) {
            const y = f * FLOOR;
            for (let x = 3; x < w - 3; x += 6) {
                B.rect(x - 1, y - 1, 4, 5, dark(conc, 0.45));
                K.pane(
                    B,
                    x,
                    y,
                    2,
                    4,
                    { tone: 'office', lit: 0.5, glassTop: 0x5a6a7a, glassBot: 0x2a323c, curtains: false },
                    f * 97 + x
                );
            }
        }
        // Heavy cantilevered top.
        B.rect(-2, 0, w + 4, 6, dark(conc, 0.15));
        B.rect(-2, 0, w + 4, 1, light(conc, 0.2));
        B.rect(-2, 5, w + 4, 1, dark(conc, 0.5));
        const stripe = b.lab === 'xai' ? 0xe8e8ee : pal.accent;
        B.rect(-2, 3, w + 4, 1, stripe);
        for (let i = -2; i < w + 2; i++) B.epx(i, 3, stripe, 190);
        if (b.lab === 'xai' && up > 40) {
            // Huge X down the face.
            const sz = Math.min(w - 8, 24);
            const cx = Math.round(w / 2 - sz / 2);
            for (let i = 0; i < sz; i++) {
                (B.px(cx + i, 12 + i, 0xe8e8ee), B.px(cx + i + 1, 12 + i, 0xe8e8ee));
                (B.px(cx + sz - 1 - i, 12 + i, 0xe8e8ee), B.px(cx + sz - i, 12 + i, 0xe8e8ee));
                (B.epx(cx + i, 12 + i, 0xffffff, 200), B.epx(cx + sz - 1 - i, 12 + i, 0xffffff, 200));
            }
        }
        K.lobby(B, 0, up, w, LOBBY, { accent: stripe, frame: 0x24262c, interior: 0xd8e0f0, planters: false });
        roofSign(B, labName(b), 0, w, 0, stripe, { bg: 0x0c0c10 });
        K.dish(B, 6, 0, 3);
    };

    // Setback (art deco): the classic's tiers — top third inset 14 world px, middle third 7,
    // base full width — each tier capped, with a deco crown band on the top tier.
    P.setback = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const floors = Math.max(1, Math.round(up / FLOOR));
        const stone = mix(0xb8aa94, pal.pale, 0.25);
        const insetFor = (f) =>
            f < floors / 3 ? Math.round(14 / PL.ART) : f < (floors * 2) / 3 ? Math.round(7 / PL.ART) : 0;
        const tiers = [];
        for (let f = 0; f < floors; f++) {
            const ins = insetFor(f);
            if (!tiers.length || tiers[tiers.length - 1].ins !== ins)
                tiers.push({ ins: ins, y0: f === 0 ? 0 : Math.min(up - 1, rowY(f)) });
        }
        tiers.forEach((t, i) => (t.y1 = i + 1 < tiers.length ? tiers[i + 1].y0 : up));
        tiers.forEach((t, i) => {
            const tx = t.ins;
            const tw = w - t.ins * 2;
            const th = t.y1 - t.y0;
            if (th <= 0) return;
            K.wall(B, tx, t.y0, tw, th, stone, 'stone');
            const wy = t.y0 + (i === 0 ? 5 : 2);
            if (t.y1 - wy > 4)
                K.windows(B, tx + 1, wy, tw - 2, t.y1 - wy, {
                    floorH: FLOOR,
                    winW: 2,
                    winH: 4,
                    pitch: 4,
                    top: 1,
                    inset: 1,
                    tone: 'mixed',
                    lit: 0.55,
                    glassTop: 0x98b8d4,
                    glassBot: 0x4a6480,
                });
            // Piers.
            for (let x = tx + 3; x < tx + tw - 2; x += 8)
                for (let yy = t.y0 + 2; yy < t.y1; yy++) {
                    B.px(x, yy, light(stone, 0.15));
                    B.px(x + 1, yy, dark(stone, 0.1));
                }
            // Tier cap: the lab-tinted ledge where the tier above steps in.
            K.cap(B, tx, t.y0, tw, i === 0 ? light(stone, 0.1) : mix(light(stone, 0.1), pal.accent, 0.5), {
                thick: true,
            });
        });
        // Crown band on the top tier: stepped deco courses with sunburst lights.
        const ti = tiers[0].ins;
        const cw = w - ti * 2;
        for (let s2 = 0; s2 < 2; s2++) {
            B.rect(ti + 1 + s2, 2 + s2, cw - 2 - s2 * 2, 1, s2 % 2 ? light(stone, 0.35) : 0xd8dce2);
            for (let i = 2 + s2; i < cw - 2 - s2; i += 2) B.epx(ti + i, 2 + s2, 0xfff0c0);
        }
        B.blink(Math.round(w / 2), -1, 0xff4050, 1.8, 0.2);
        B.px(Math.round(w / 2), -1, 0xd8dce2);
        K.lobby(B, 0, up, w, LOBBY, { accent: pal.accent, frame: 0x3a342c, interior: 0xffe6b8 });
        // Name: a blade on the full-width base when the whole name fits, else on the roof.
        const base = tiers[tiers.length - 1];
        bladeOrRoof(
            B,
            b,
            w - 3,
            base.y0 + 2,
            Math.min(9, Math.floor((up - base.y0 - 6) / 6)),
            pal.accent,
            {},
            {
                x: ti,
                w: cw,
                y: -2,
            }
        );
        K.emblem(B, b.lab, Math.round(w / 2), up - 5, pal.accent, true);
    };

    // Pagoda: full-width body, upturned eaves on every third classic floor line (they
    // overhang one pixel like the classic's cornices), a tiled crown on the roof rows.
    P.pagoda = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const floors = Math.max(1, Math.round(up / FLOOR));
        const wall = mix(0xd8cdb8, pal.pale, 0.2);
        const roof = 0x2e3a4a;
        const red = 0xb8342a;
        const gold = 0xe8b848;
        const eaves = [];
        for (let f = 3; f < floors; f += 3) eaves.push(rowY(f));
        K.wall(B, 0, 0, w, up, wall, 'stucco');
        K.windows(B, 1, 6, w - 2, up - 6, {
            floorH: FLOOR,
            winW: 3,
            winH: 4,
            pitch: 5,
            top: 1,
            inset: 2,
            tone: 'home',
            lit: 0.6,
            frame: dark(red, 0.2),
            glassTop: 0xa8c4d8,
            glassBot: 0x587490,
        });
        // Red corner columns.
        for (let y = 0; y < up; y++) {
            B.px(0, y, red);
            B.px(1, y, dark(red, 0.25));
            B.px(w - 1, y, dark(red, 0.35));
            B.px(w - 2, y, red);
        }
        eaves.forEach((y) => {
            for (let i = -1; i <= w; i++) {
                const lift = i < 1 ? 1 - i : i > w - 2 ? i - (w - 2) : 0;
                B.px(i, y - 1 - lift, light(roof, 0.2));
                B.px(i, y - lift, roof);
            }
            B.rect(0, y + 1, w, 1, gold);
            [3, w - 4].forEach((lx) => {
                B.px(lx, y + 2, 0x3a2a20);
                B.rect(lx - 1, y + 3, 3, 2, 0xd8402a);
                B.erect(lx - 1, y + 3, 3, 2, 0xff7a4a);
                B.light(lx, y + 4, 0xff8a4a, 6, 'lantern');
            });
        });
        // Tiled crown on the top rows, ridge ornament just above.
        for (let s2 = 0; s2 < 4; s2++) {
            const rw = w + 2 - s2 * Math.max(2, Math.round(w / 8));
            if (rw < 3) break;
            const rx = Math.round((w - rw) / 2);
            B.rect(rx, 4 - s2, rw, 1, s2 === 0 ? light(roof, 0.25) : roof);
        }
        B.rect(0, 5, w, 1, gold);
        B.px(Math.round(w / 2), 0, gold);
        B.px(Math.round(w / 2), -1, gold);
        K.lobby(B, 0, up, w, LOBBY, { accent: red, frame: 0x3a1c1a, interior: 0xffd8a0 });
        bladeOrRoof(
            B,
            b,
            -1,
            10,
            Math.min(9, Math.floor((up - 20) / 6)),
            gold,
            { bg: 0x5a1410 },
            {
                x: 0,
                w: w,
                y: -3,
                o: { bg: 0x5a1410 },
            }
        );
    };

    P.euro = function (B, b, w, h) {
        const lc = labColor(b);
        const pal = K.labPalette(lc);
        const up = h - LOBBY;
        const stone = 0xe0d2b8;
        const slate = 0x4a5870;
        const mans = Math.min(14, Math.max(8, Math.round(up * 0.12)));
        K.wall(B, 0, mans, w, up - mans, stone, 'stone');
        // Tall French windows with iron balconies every other floor band.
        const fh = FLOOR * 2;
        const floors = Math.floor((up - mans) / fh);
        let id = 0;
        for (let f = 0; f < floors; f++) {
            const fy = mans + f * fh + 2;
            for (let x = 3; x < w - 4; x += 6) {
                id++;
                B.rect(x - 1, fy - 1, 5, fh - 2, dark(stone, 0.18));
                K.pane(
                    B,
                    x,
                    fy,
                    3,
                    fh - 4,
                    { tone: 'home', lit: 0.62, glassTop: 0xa8bcd0, glassBot: 0x56708c },
                    id + f * 71
                );
                B.rect(x - 1, fy - 2, 5, 1, light(stone, 0.2));
                if (f % 2 === 0 || f === floors - 1) {
                    B.rect(x - 1, fy + fh - 4, 5, 1, 0x2a2a30);
                    B.px(x - 1, fy + fh - 5, 0x2a2a30);
                    B.px(x + 1, fy + fh - 5, 0x2a2a30);
                    B.px(x + 3, fy + fh - 5, 0x2a2a30);
                }
            }
        }
        // Mansard roof with dormers and chimney pots.
        for (let y = 0; y < mans; y++) {
            const inset = Math.round((1 - y / mans) * 3);
            for (let x = inset; x < w - inset; x++) {
                let c = (x + y) % 4 === 0 ? dark(slate, 0.1) : slate;
                if (y === 0) c = light(slate, 0.3);
                B.px(x, y, c);
            }
        }
        for (let x = 5; x < w - 6; x += 9) {
            B.rect(x - 1, 3, 5, mans - 4, 0xd8ccb4);
            B.px(x + 1, 2, 0xd8ccb4);
            K.pane(B, x, 4, 3, mans - 6, { tone: 'home', lit: 0.5 }, 9000 + x);
        }
        K.chimney(B, 3, 0, 4, 0xc8a88a);
        K.chimney(B, w - 6, 0, 5, 0xc8a88a);
        K.band(B, 0, mans, w, light(stone, 0.1));
        K.lobby(B, 0, up, w, LOBBY, { accent: pal.accent, frame: 0x2a2a34, interior: 0xffe2b0 });
        roofSign(B, labName(b), 0, w, -5, pal.accent, { small: w < 60 });
    };

    // ── Generic labs & offices ──────────────────────────────────────────────
    P.hq = function (B, b, w, h) {
        const style = styleFor(b.lab);
        (P[style] || P.monolith)(B, b, w, h);
    };

    P.office = function (B, b, w, h, o) {
        o = o || {};
        const up = h - LOBBY;
        const wall = o.wall === undefined ? 0x8a8a96 : o.wall;
        K.wall(B, 0, 0, w, up, wall, o.kind || 'concrete');
        K.windows(B, 0, 2, w, up - 2, {
            floorH: FLOOR,
            winW: 3,
            winH: 4,
            pitch: 5,
            top: 1,
            tone: o.tone || 'office',
            lit: 0.5,
            frame: o.frame,
            glassTop: 0x9ab8d0,
            glassBot: 0x50688a,
        });
        K.cap(B, 0, 0, w, light(wall, 0.15));
        K.lobby(B, 0, up, w, LOBBY, { accent: o.accent === undefined ? 0xd8c8a0 : o.accent });
        if (o.sign)
            roofSign(B, o.sign, 0, w, 0, o.signCol === undefined ? 0xf2d27a : o.signCol, { small: true });
    };

    // ── Dispatcher ──────────────────────────────────────────────────────────
    // hWorld: the live building height in world px (floors × 18 + 24) when the
    // caller already has it; otherwise it is derived from the floor count.
    PL.paintBuilding = function (b, hWorld) {
        const w = PL.artW(b);
        const h = hWorld ? Math.max(1, Math.round(hWorld / PL.ART)) : PL.artH(b);
        const B = new PL.Bake(w, h, {
            seed: PL.seedOf(b.id),
            head: PL.headFor(b, h),
            padX: PL.padFor ? PL.padFor(b) : 10,
        });
        const fn = PL.pick(b);
        fn(B, b, w, h);
        // The classic city puts an automatic neon name sign on most non-lab buildings; the
        // pixel facade carries the same sign unless the painter already shows the name.
        if (!B.named && PL.classicNeon) {
            const nc = PL.classicNeon(b);
            if (nc) PL.neonSign(B, nc.text, nc.col, w);
        }
        B.finish();
        B.bld = b;
        B.fw = w;
        B.fh = h;
        return B;
    };
    PL.headFor = function (b, h) {
        if (b.type === 'launchpad') return 110;
        if (/^(power_wind|power_nuclear|port_crane|space_assembly)/.test(b.id)) return 80;
        return h > 200 ? 40 : 56;
    };
    PL.pick = function (b) {
        const id = b.id;
        const D = PL.D || {};
        const find = (k) => D[k] || P[k];
        if (D[id]) return D[id];
        if (b.type && D['type:' + b.type]) return D['type:' + b.type];
        const pre = id.replace(/_[^_]*$/, '');
        if (D['pre:' + pre]) return D['pre:' + pre];
        const pre1 = id.split('_')[0];
        if (D['pre:' + pre1]) return D['pre:' + pre1];
        if (id.startsWith('bld_') && b.lab) return P.hq;
        return find('fallback') || ((B, bb, w, h) => P.office(B, bb, w, h, { sign: bb.name }));
    };
})();
