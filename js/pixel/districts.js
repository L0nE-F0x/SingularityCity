/* Pixel lab v2 — district painters, part 1: port, space, forests, housing, industry,
   metro, university. Registered on PL.D by id, 'pre:<prefix>' or 'type:<type>'. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const LOBBY = PL.LOBBY;
    const FL = 6;

    const labCol = (b, fb) =>
        b.lab && PL.LABS[b.lab] ? hex(PL.LABS[b.lab].color) : fb === undefined ? 0x64748b : fb;
    const short = (b) => b.name.replace(/\s*\(.*\)\s*/g, '').replace(/\s+HQ$/i, '');

    // ── Port ────────────────────────────────────────────────────────────────
    D.port_authority = function (B, b, w, h) {
        const brick = 0x8a4a3a;
        const up = h - LOBBY;
        K.wall(B, 0, 4, w, up - 4, brick, 'brick');
        K.windows(B, 0, 6, w, up - 6, {
            floorH: 7,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            lintel: 0xd8c8a8,
            sill: 0xd8c8a8,
            tone: 'office',
            lit: 0.6,
        });
        K.cap(B, 0, 2, w, 0xd8c8a8, { thick: true });
        // Clock tower.
        const cx = Math.round(w / 2);
        K.wall(B, cx - 5, -14, 10, 17, 0xc8b89a, 'stone');
        B.ellipse(cx, -8, 3, 3, 0xf4ecd8);
        B.epx(cx, -8, 0xfff4d0);
        (B.px(cx, -9, 0x2a2a30), B.px(cx + 1, -8, 0x2a2a30));
        K.pitched(B, cx - 6, -14, 12, 0x3a5a4a, { h: 6 });
        K.flag(B, cx, -20, [0x2a4a8a, 0xe8e8ee, 0xc0392b], 8);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0x2a6ac0, frame: 0x3a2a24 });
        K.plaqueC(B, cx, up - 9, 'PORT AUTHORITY', 0xf2d27a, 0x1a2a3a, true, w);
    };
    D.port_customs = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 2, w, up - 2, 0xd8d4c8, 'stucco');
        K.windows(B, 0, 4, w, up - 4, {
            floorH: 7,
            winW: 4,
            winH: 4,
            pitch: 6,
            top: 1,
            frame: 0x3a4a5a,
            tone: 'office',
            lit: 0.7,
        });
        B.rect(0, 0, w, 3, 0x2a6ac0);
        B.rect(0, 0, w, 1, 0x4a8ae0);
        K.lobby(B, 0, up, w - 10, LOBBY, { accent: 0xe8b830 });
        // Barrier arm.
        B.rect(w - 8, up + 2, 2, 6, 0x3a3a44);
        for (let i = 0; i < 12; i++) B.px(w - 7 + i, up + 3, Math.floor(i / 2) % 2 ? 0xe8e8ee : 0xd8402a);
        K.flag(B, 3, 2, [0xe8e8ee, 0x2a4a8a], 10);
        K.plaqueC(B, w / 2, -5, 'EXPORT CONTROL', 0xe8e8ee, 0x1a2a4a, true, w + 10);
    };
    D.port_warehouse = function (B, b, w, h) {
        const up = h - LOBBY;
        const green = 0x76b900;
        K.wall(B, 0, 3, w, h - 3, 0x5a6a6e, 'corrugated');
        // Curved roof.
        for (let i = 0; i < w; i++) {
            const lift = Math.round(Math.sin((i / (w - 1)) * Math.PI) * 4);
            for (let j = 0; j <= lift; j++) B.px(i, 3 - j, j === lift ? 0x9aa8ac : 0x6a7a7e);
        }
        // Roller doors.
        for (let x = 4; x < w - 10; x += 14) {
            B.rect(x, h - 11, 10, 11, 0x3a4246);
            for (let j = 0; j < 11; j += 2) B.rect(x, h - 11 + j, 10, 1, 0x4a5256);
            B.rect(x, h - 12, 10, 1, 0xe8b830);
            B.erect(x + 1, h - 1, 8, 1, 0xffd88a);
            B.light(x + 5, h - 1, 0xffd88a, 8, 'door');
        }
        // GPU crates stacked outside.
        const cr = [
            [w - 9, h],
            [w - 5, h],
            [w - 7, h - 4],
        ];
        cr.forEach(([x, y]) => {
            B.rect(x, y - 4, 4, 4, 0x8a6a42);
            B.rect(x, y - 4, 4, 1, 0xa88a58);
            B.px(x + 1, y - 2, green);
        });
        K.plaqueC(B, w / 2, 4, 'GPU WAREHOUSE', green, 0x141a10, true, w);
        B.blink(2, 4, 0xffa040, 2.5, 0.3);
    };
    D.port_container = function (B, b, w, h) {
        const cols = [0xc0392b, 0x2a7ab0, 0xe0a030, 0x3a8a4a, 0x8a4ab0, 0x1a6a6a, 0xd86a2a];
        let k = 0;
        for (let row = 0; row < 4; row++) {
            const y = h - row * 5;
            for (let x = 1 + (row % 2) * 3; x + 12 <= w - row * 4; x += 13) {
                if (row > 0 && B.h01(x, row) > 0.8) continue;
                K.container(B, x, y, cols[k++ % cols.length]);
            }
        }
        // Straddle carrier gantry.
        B.rect(w - 6, h - 24, 1, 24, 0xe0b030);
        B.rect(w - 1, h - 24, 1, 24, 0xe0b030);
        B.rect(w - 7, h - 25, 8, 2, 0xe8c040);
        B.blink(w - 4, h - 26, 0xffa040, 1.6, 0);
        K.plaqueC(B, w / 2, -12, 'CONTAINER TERMINAL', 0xe8e8ee, 0x1a2a3a, true, w + 12);
    };
    D.port_fuel = function (B, b, w, h) {
        K.tankCyl(B, 2, h, 16, 14, 0xd8dce2);
        K.tankCyl(B, 20, h, 13, 11, 0xc8ccd2);
        // Hazard stripes and pipes.
        for (let i = 0; i < w; i++) B.px(i, h - 1, Math.floor(i / 2) % 2 ? 0x1a1a1e : 0xe8b830);
        B.rect(18, h - 6, 3, 1, 0x6a6a74);
        B.rect(33, h - 5, w - 33, 1, 0x6a6a74);
        B.rect(8, h - 10, 4, 3, 0xc0392b);
        K.plaqueC(B, w / 2, -6, 'FUEL & GAS', 0xffe08a, 0x2a1a14, true, w + 12);
        B.blink(9, -16 + h - 16, 0xff4050, 1.9, 0.1);
    };
    D.port_crane = function (B, b, w, h) {
        const y0 = h;
        const col = 0xe8a030;
        // Ship-to-shore crane: two legs, a high boom reaching over the water (left).
        const legH = 46;
        [4, w - 6].forEach((x) => {
            for (let j = 0; j < legH; j++) {
                B.px(x, y0 - j, light(col, 0.15));
                B.px(x + 1, y0 - j, dark(col, 0.25));
            }
        });
        B.line(5, y0 - 10, w - 5, y0 - legH + 6, dark(col, 0.2));
        B.line(5, y0 - legH + 6, w - 5, y0 - 10, dark(col, 0.2));
        const by = y0 - legH;
        B.rect(-26, by, w + 30, 2, col);
        B.rect(-26, by, w + 30, 1, light(col, 0.3));
        B.rect(w - 10, by - 10, 3, 10, col);
        B.line(w - 9, by - 10, -24, by, dark(col, 0.3));
        B.line(w - 9, by - 10, w + 3, by, dark(col, 0.3));
        // Cab and spreader.
        B.rect(-6, by + 2, 5, 4, 0xd8dce2);
        B.epx(-5, by + 3, 0xfff0c8);
        B.rect(-4, by + 6, 1, 14, 0x2a2a30);
        B.rect(-8, by + 20, 9, 2, 0x3a3a44);
        B.blink(-26, by - 1, 0xff4050, 1.3, 0);
        B.blink(w - 9, by - 11, 0xff4050, 1.3, 0.5);
        B.light(-4, by + 7, 0xfff0c8, 10, 'spot');
    };

    // ── Space zone ──────────────────────────────────────────────────────────
    D['type:mission_control'] = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 6, w, up - 6, 0xd8d8d4, 'panel', { pitch: 6 });
        B.rect(0, 12, w, 5, 0x1a2230);
        for (let x = 2; x < w - 2; x += 5)
            K.screen(B, x, 12, 4, 4, ['map', 'chart', 'text'][x % 3], [0x4ad0ff, 0x7aff9a, 0xffb84a][x % 3]);
        K.cap(B, 0, 6, w, 0xe8e8ee);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0x2a6ac0, interior: 0xc8e0f8 });
        // Big dish.
        const cx = Math.round(w * 0.7);
        B.rect(cx, -4, 2, 10, 0x8a8a96);
        for (let j = 0; j < 7; j++)
            for (let i = -9 + j; i <= 9 - j; i++)
                B.px(
                    cx + i + Math.round(j * 0.6),
                    -6 - j + Math.abs(i) * 0.12,
                    j === 0 ? 0xb8bcc4 : 0xe8eaee
                );
        B.px(cx + 4, -17, 0xff5060);
        B.blink(cx + 4, -17, 0xff4050, 1.4, 0);
        K.plaqueC(B, w * 0.3, -1, 'DEEP SPACE NETWORK', 0x9ad0ff, 0x101828, true, w * 0.6);
    };
    D['type:assembly'] = function (B, b, w, h) {
        K.wall(B, 0, 0, w, h, 0xd8d8d4, 'panel', { pitch: 3, seamY: 8 });
        // Giant doors.
        const dw = Math.round(w * 0.36);
        const dx = Math.round(w * 0.12);
        B.rect(dx, 4, dw, h - 4, 0x6a7078);
        for (let j = 4; j < h; j += 3) B.rect(dx, j, dw, 1, 0x5a6068);
        B.erect(dx + 2, h - 8, dw - 4, 8, 0xffe0b0, 90);
        // Flag and logo panels (VAB nod).
        const fx = Math.round(w * 0.58);
        for (let j = 0; j < 9; j++)
            for (let i = 0; i < 14; i++)
                B.px(
                    fx + i,
                    6 + j,
                    j < 5 && i < 6 ? ((i + j) % 2 ? 0x2a3a8a : 0xe8e8ee) : j % 2 ? 0xe8e8ee : 0xc0392b
                );
        B.ellipse(fx + 7, 22, 6, 5, 0x2a4ab0);
        B.text('SPACE', fx + 2, 20, 0xe8e8ee, 3);
        K.cap(B, 0, 0, w, 0xe8e8ee);
        B.blink(2, -1, 0xff4050, 1.6, 0);
        B.blink(w - 3, -1, 0xff4050, 1.6, 0.5);
    };
    D['type:tracking'] = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 4, 8, w - 8, up - 8, 0xc8c4bc, 'concrete');
        K.windows(B, 4, 10, w - 8, up - 10, {
            floorH: 6,
            winW: 3,
            winH: 3,
            pitch: 5,
            tone: 'office',
            lit: 0.7,
        });
        K.lobby(B, 4, up, w - 8, LOBBY, { accent: 0x2a6ac0 });
        K.dish(B, 12, 8, 6);
        K.dish(B, w - 12, 8, 4);
        B.rect(Math.round(w / 2), -10, 1, 18, 0x8a8a96);
        B.blink(Math.round(w / 2), -11, 0xff4050, 1.2, 0.2);
        K.plaqueC(B, w / 2, -2, 'ORBITAL TRACKING', 0x9ad0ff, 0x101828, true, w);
    };
    const ROCKETS = {
        pad_spacex: { body: 0xc8ccd4, band: 0x2a2a30, h: 64, w: 5, nose: 'ship' },
        pad_blue_origin: { body: 0xe8e8ee, band: 0x2a4ab0, h: 56, w: 5 },
        pad_nasa: { body: 0xe07a2a, band: 0xe8e8ee, h: 58, w: 5, boosters: true },
        pad_cnsa: { body: 0xe8e8ee, band: 0xc0392b, h: 48, w: 4, boosters: true },
        pad_esa: { body: 0xe8e8ee, band: 0x2a4ab0, h: 44, w: 4, boosters: true },
        pad_ula: { body: 0xe0a060, band: 0xe8e8ee, h: 46, w: 4 },
        pad_rocketlab: { body: 0x1e1e24, band: 0xe8e8ee, h: 26, w: 3 },
        pad_northrop_grumman: { body: 0xe8e8ee, band: 0x2a2a30, h: 34, w: 4 },
        pad_firefly: { body: 0x2a2a30, band: 0xe86a2a, h: 30, w: 3 },
        pad_landspace: { body: 0xe8e8ee, band: 0x3a6ab0, h: 38, w: 4 },
        pad_isro: { body: 0xe8e8ee, band: 0xe07a2a, h: 40, w: 4, boosters: true },
        pad_jaxa: { body: 0xe8e8ee, band: 0x3a6ab0, h: 42, w: 4, boosters: true },
        pad_roscosmos: { body: 0xb8c0a8, band: 0xc0392b, h: 36, w: 4, boosters: true },
    };
    D['type:launchpad'] = function (B, b, w, h) {
        const R = ROCKETS[b.id] || ROCKETS.pad_esa;
        const base = h;
        // Concrete pad and flame trench.
        B.rect(0, base - 4, w, 4, 0x8a8680);
        B.rect(0, base - 4, w, 1, 0xb0aca4);
        const cx = Math.round(w / 2);
        B.rect(cx - 5, base - 3, 10, 3, 0x2a2628);
        // Rocket.
        const rw = R.w;
        const rx = cx - Math.floor(rw / 2);
        const top = base - 4 - R.h;
        for (let j = 0; j < R.h; j++) {
            for (let i = 0; i < rw; i++) {
                let c = R.body;
                const t = j / R.h;
                if (t > 0.3 && t < 0.34) c = R.band;
                if (t > 0.86) c = dark(R.body, 0.2);
                if (i === 0) c = light(c, 0.25);
                if (i === rw - 1) c = dark(c, 0.3);
                B.px(rx + i, top + j, c);
            }
        }
        // Nose.
        for (let j = 1; j <= 4; j++)
            for (let i = 0; i < rw; i++)
                if (Math.abs(i - (rw - 1) / 2) < (rw / 2) * (1 - j / 5))
                    B.px(rx + i, top - j, j === 4 ? 0x8a8a96 : light(R.body, 0.1));
        if (R.nose === 'ship') {
            (B.px(rx - 1, top + 6, 0x8a8a96), B.px(rx + rw, top + 6, 0x8a8a96));
            (B.px(rx - 1, top + R.h - 4, 0x5a5a64), B.px(rx + rw, top + R.h - 4, 0x5a5a64));
        }
        if (R.boosters) {
            [rx - 2, rx + rw].forEach((bx) => {
                for (let j = 0; j < R.h * 0.42; j++)
                    B.px(bx, base - 4 - j, j > R.h * 0.4 - 2 ? 0x8a8a96 : light(R.body, 0.05));
                for (let j = 0; j < R.h * 0.42; j++) B.px(bx + 1, base - 4 - j, dark(R.body, 0.15));
            });
        }
        // Launch tower with swing arms and red beacons.
        const tx = rx + rw + 5;
        const th = R.h + 10;
        for (let j = 0; j < th; j++) {
            B.px(tx, base - 4 - j, 0x6a6e78);
            B.px(tx + 4, base - 4 - j, 0x4a4e58);
            if (j % 4 === 0) B.rect(tx, base - 4 - j, 5, 1, 0x5a5e68);
            if (j % 4 === 2) B.px(tx + 2, base - 4 - j, 0x5a5e68);
        }
        B.rect(rx + rw, top + 8, 5, 1, 0x5a5e68);
        B.rect(rx + rw, top + Math.round(R.h * 0.6), 5, 1, 0x5a5e68);
        B.rect(tx + 2, base - 4 - th - 6, 1, 6, 0x8a8a96);
        B.blink(tx + 2, base - 4 - th - 7, 0xff4050, 1.5, B.h01(1, 2));
        B.blink(tx, base - 4 - Math.round(th / 2), 0xff4050, 1.5, 0.5);
        // Floodlights on masts either side.
        [1, w - 2].forEach((mx) => {
            B.rect(mx, base - 26, 1, 22, 0x5a5e68);
            B.rect(mx - 1, base - 27, 3, 1, 0x3a3e48);
            B.epx(mx - 1, base - 27, 0xfff4d8);
            B.epx(mx + 1, base - 27, 0xfff4d8);
            B.light(mx, base - 26, 0xfff0d0, 12, 'spot');
        });
        B.light(cx, top + R.h * 0.5, 0xfff0d0, Math.round(R.h * 0.45), 'wash');
        K.plaqueC(B, cx, base - 11, b.name.split(' ')[0], 0xe8e8ee, 0x1a1a24, true, w);
    };

    // ── Forests & parks ─────────────────────────────────────────────────────
    function forest(B, b, w, h, o) {
        o = o || {};
        const floor = h;
        // Back row (darker, taller), then front row.
        for (let x = 2; x < w - 2; x += 5 + Math.floor(B.h01(x, 1) * 5)) {
            const th = 22 + Math.floor(B.h01(x, 2) * 22);
            K.pine(B, x, floor - 2, th, [0x10281e, 0x183a28, 0x204a30, 0x2e5e3a, 0x3e7040]);
        }
        for (let x = 4; x < w - 4; x += 7 + Math.floor(B.h01(x, 3) * 8)) {
            if (B.h01(x, 4) < (o.round || 0.3))
                K.tree(B, x, floor, 5 + Math.floor(B.h01(x, 5) * 4), PL.S.LEAF.deep);
            else K.pine(B, x, floor, 16 + Math.floor(B.h01(x, 6) * 14));
        }
        for (let x = 0; x < w; x += 6)
            PL.S.bush(
                B.base,
                B.X(x),
                B.Y(floor - 1),
                5 + Math.floor(B.h01(x, 7) * 4),
                B.seed + x,
                PL.S.LEAF.deep
            );
        if (o.sign) {
            // Wooden trail sign.
            const sx = Math.round(w * 0.5);
            B.rect(sx - 1, floor - 8, 1, 8, 0x5a3a24);
            B.rect(sx + 8, floor - 8, 1, 8, 0x5a3a24);
            B.rect(sx - 3, floor - 14, PL.textW(o.sign, 3) + 4, 7, 0x7a5236);
            B.text(o.sign, sx - 1, floor - 13, 0xf2e2c0, 3);
        }
        if (o.cabin) {
            const cx = Math.round(w * 0.72);
            K.wall(B, cx, floor - 9, 14, 9, 0x6a4a32, 'wood');
            K.pitched(B, cx, floor - 9, 14, 0x4a3a34, { h: 6 });
            K.pane(B, cx + 3, floor - 7, 3, 3, { lit: 1, tone: 'home' }, 1);
            K.chimney(B, cx + 10, floor - 12, 3);
        }
    }
    D['pre:forest'] = (B, b, w, h) =>
        forest(B, b, w, h, { sign: b.name.toUpperCase(), cabin: b.id === 'forest_1' });
    D.forest_space = (B, b, w, h) => forest(B, b, w, h, { sign: 'FRONTIER PINES', round: 0.1 });

    // ── Worker blocks: brick walk-ups with fire escapes ─────────────────────
    const BRICKS = [0x8a4232, 0x7a4a3a, 0x9a6a4a, 0x6a3a34, 0xa05a3a, 0x8a5a48];
    D['pre:npc_apt'] = function (B, b, w, h) {
        const brick = BRICKS[PL.seedOf(b.id) % BRICKS.length];
        const up = h - LOBBY;
        const trim = 0xd8c8a8;
        K.wall(B, 0, 0, w, up, brick, 'brick');
        const res = K.windows(B, 0, 3, w, up - 3, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            inset: 3,
            lintel: trim,
            sill: trim,
            tone: 'home',
            lit: 0.62,
        });
        // Fire escape over the right-hand windows.
        const fx = res.x0 + res.pitch * (res.cols - 2) - 2;
        K.fireEscape(B, fx, 3, res.pitch * 2 + 1, res.floors, FL);
        // Cornice.
        B.rect(-1, 0, w + 2, 1, light(trim, 0.2));
        B.rect(-1, 1, w + 2, 1, trim);
        for (let i = 0; i < w; i += 3) B.px(i, 2, dark(trim, 0.3));
        K.tank(B, 6, 0);
        K.ac(B, w - 10, 0);
        K.antenna(B, w - 3, 0, 8, false);
        // Ground floor: bodega or stoop.
        if (PL.seedOf(b.id) % 2) {
            K.shop(B, 0, up, w, LOBBY, {
                sign: ['BODEGA', 'DELI', 'LAUNDRY', 'PHO', 'BAGELS', 'PIZZA'][PL.seedOf(b.id) % 6],
                accent: [0x2a7a4a, 0xc0392b, 0x2a5aa0][PL.seedOf(b.id) % 3],
                goods: true,
            });
        } else {
            K.wall(B, 0, up, w, LOBBY, dark(brick, 0.1), 'brick');
            K.door(B, Math.round(w / 2) - 2, up + 2, 4, 6, 0x3a2a24);
            B.rect(Math.round(w / 2) - 4, h - 1, 8, 1, 0x8a8680);
            K.windows(B, 0, up, w, LOBBY, {
                floorH: 8,
                winW: 3,
                winH: 4,
                pitch: 6,
                top: 2,
                inset: 3,
                tone: 'home',
                lit: 0.5,
                skip: (f, c, cols) => Math.abs(c - (cols - 1) / 2) < 1,
            });
        }
        K.plaqueC(B, w / 2, -8, b.name, 0xf2d27a, 0x1c1a22, true, w + 10);
    };

    // ── Metro entrances ─────────────────────────────────────────────────────
    D['pre:metro'] = function (B, b, w, h) {
        const iron = 0x2a5a4a;
        const cx = Math.round(w / 2);
        const y = h;
        // Art-nouveau arch over the stairs.
        for (let i = -9; i <= 9; i++) {
            const top = y - 13 - Math.round(Math.cos((i / 9) * Math.PI * 0.5) * 3);
            B.px(cx + i, top, iron);
            if (Math.abs(i) === 9) B.rect(cx + i, top, 1, y - top, iron);
            if (Math.abs(i) === 9) B.px(cx + i + (i > 0 ? -1 : 1), top + 1, light(iron, 0.2));
        }
        // Glass canopy.
        for (let i = -8; i <= 8; i++)
            for (let j = 1; j < 3; j++)
                B.px(cx + i, y - 13 - Math.round(Math.cos((i / 9) * Math.PI * 0.5) * 3) + j, 0x6a9a8a);
        // Railings.
        K.fence(B, cx - 9, y, 5, iron);
        K.fence(B, cx + 5, y, 5, iron);
        // Sign: the station's own name on the green board.
        const sign = PL.fit(b.name.replace(/ Station$/i, ''), w + 14, 3);
        const sw = PL.textW(sign, 3) + 6;
        B.rect(cx - Math.round(sw / 2), y - 22, sw, 7, 0x1e4a3a);
        B.rect(cx - Math.round(sw / 2), y - 22, sw, 1, light(0x1e4a3a, 0.3));
        B.text(sign, cx - Math.round(sw / 2) + 3, y - 21, 0xf2d27a, 3);
        B.etext(sign, cx - Math.round(sw / 2) + 3, y - 21, 0xffe8a0, 3);
        B.light(cx, y - 19, 0xffe08a, 10, 'neon');
        // Globe lamps on the posts.
        [cx - 9, cx + 9].forEach((lx) => {
            B.rect(lx, y - 18, 1, 5, iron);
            B.rect(lx - 1, y - 20, 3, 2, 0xd8f0c0);
            B.erect(lx - 1, y - 20, 3, 2, 0xc8ffb0);
            B.light(lx, y - 19, 0x9aff8a, 8, 'lamp');
        });
        // Line roundel + station name.
        B.ellipse(cx - 17, y - 10, 3, 3, 0xd8402a);
        B.rect(cx - 19, y - 10, 5, 1, 0x2a4ab0);
    };

    // ── Compute district ────────────────────────────────────────────────────
    D['type:datacenter'] = function (B, b, w, h) {
        const lc = labCol(b);
        const acc = PL.lum(lc) < 0.1 ? 0xe8e8ee : lc;
        const up = h - LOBBY;
        const wall = mix(0x9ca4ae, acc, 0.06);
        K.wall(B, 0, 3, w, h - 3, wall, 'panel', { pitch: 3 });
        // Louvre bands and server-light slits.
        for (let y = 6; y < up - 1; y += 5) {
            B.rect(1, y, w - 2, 2, dark(wall, 0.35));
            B.rect(1, y, w - 2, 1, dark(wall, 0.5));
            for (let x = 3; x < w - 3; x += 2) {
                const on = B.h01(x, y) > 0.35;
                if (!on) continue;
                const c = B.h01(y, x) > 0.85 ? 0xffb84a : B.h01(x, y + 1) > 0.5 ? acc : 0x7aff9a;
                B.px(x, y + 1, dark(c, 0.3));
                B.epx(x, y + 1, c);
            }
        }
        // Company band along the top and parapet.
        B.rect(0, 3, w, 2, acc);
        B.rect(0, 3, w, 1, light(acc, 0.3));
        K.cap(B, 0, 1, w, 0xb8bec6);
        // Cooling units on the roof.
        for (let x = 3; x + 8 < w - 2; x += 11) {
            B.rect(x, -3, 8, 4, 0x8a929c);
            B.rect(x, -3, 8, 1, 0xb0b8c0);
            B.ellipse(x + 2, -1, 1.5, 1.2, 0x3a4048);
            B.ellipse(x + 6, -1, 1.5, 1.2, 0x3a4048);
            B.spin.push({ x: x + 2, y: -1, kind: 'fan' });
        }
        // Entrance and security fence.
        const dx = Math.round(w * 0.15);
        B.rect(dx, up, 10, LOBBY, 0x2a2e36);
        K.pane(
            B,
            dx + 1,
            up + 2,
            8,
            5,
            { lit: 1, tone: 'office', glassTop: 0x6a8aa8, glassBot: 0x3a5270 },
            5
        );
        K.fence(B, dx + 12, h, w - dx - 13, 0x5a6068);
        K.plaqueC(B, w * 0.62, up - 8, short(b), acc, 0x14161c, true, w * 0.7);
        B.blink(1, 0, 0xff4050, 2.4, B.h01(3, 3));
    };

    D['type:chipfab'] = function (B, b, w, h) {
        const lc = labCol(b);
        const up = h - LOBBY;
        const wall = 0xe4e6ea;
        K.wall(B, 0, 6, w, h - 6, wall, 'panel', { pitch: 6, seamY: 7 });
        // Blue cleanroom glazing band.
        B.rect(2, 12, w - 4, 4, 0x3a6aa0);
        for (let x = 2; x < w - 2; x++) {
            B.px(x, 12, 0x6a9ad0);
            if (x % 5 === 0) B.rect(x, 12, 1, 4, 0x2a3a4a);
            else (B.epx(x, 13, 0x9ac8ff, 200), B.epx(x, 14, 0x7ab0f0, 200), B.epx(x, 15, 0x5a90d8, 200));
        }
        // Sawtooth roof.
        for (let x = 0; x < w; x++) {
            const t = x % 8;
            const hh = Math.round(t * 0.75);
            for (let j = 0; j < hh; j++) B.px(x, 6 - j, j === hh - 1 ? 0xf2f2f4 : 0xc8ccd2);
            if (t === 7)
                for (let j = 0; j < 6; j++) (B.px(x, 6 - j, 0x8ab0d8), B.epx(x, 6 - j, 0xb8d8ff, 120));
        }
        // Exhaust stacks with steam.
        K.stack(B, w - 8, 0, 14, 0xd8dce2, null, 0.7);
        K.stack(B, w - 14, 0, 10, 0xd8dce2, null, 0.5);
        B.rect(0, 6, w, 1, lc);
        K.lobby(B, 0, up, Math.round(w * 0.4), LOBBY, { accent: lc, interior: 0xe8f0ff });
        K.plaqueC(B, w * 0.68, up - 1, short(b), lc, 0x14161c, true, w * 0.6);
    };

    // ── Housing towers ──────────────────────────────────────────────────────
    const SECTOR = {
        res_us: { wall: 0x9a5a48, trim: 0xe0d0b0, acc: 0x3a6ac0, rail: 0x2a2a30, label: 'US SECTOR' },
        res_cn: { wall: 0xd8d2c8, trim: 0xc0392b, acc: 0xe8b830, rail: 0x5a1a14, label: 'ASIA SECTOR' },
        res_eu: { wall: 0xd8c0a0, trim: 0x3a5a8a, acc: 0x2a4ab0, rail: 0x2a3a5a, label: 'GLOBAL SECTOR' },
    };
    D['pre:res'] = function (B, b, w, h) {
        const S = SECTOR[b.id] || SECTOR.res_us;
        const up = h - LOBBY;
        const coreW = 9;
        const coreX = Math.round((w - coreW) / 2);
        K.wall(B, 0, 0, w, up, S.wall, b.id === 'res_us' ? 'brick' : b.id === 'res_cn' ? 'tile' : 'stucco');
        // Wings: windows with balconies every floor.
        [
            [1, coreX - 1],
            [coreX + coreW, w - coreX - coreW - 1],
        ].forEach(([x, ww], side) => {
            K.windows(B, x, 2, ww, up - 2, {
                floorH: FL,
                winW: 3,
                winH: 4,
                pitch: 5,
                top: 1,
                inset: 1,
                tone: 'home',
                lit: 0.66,
                id0: side * 7000,
                glassTop: 0xa8c0d4,
                glassBot: 0x5a7490,
            });
            for (let y = FL + 1; y < up; y += FL) {
                for (let i = 0; i < ww; i++) {
                    B.px(x + i, y, S.rail);
                    if (i % 2 === 0) B.px(x + i, y - 1, dark(S.rail, 0.1));
                }
                const f = Math.floor(y / FL);
                // Balcony clutter: AC boxes, plants, laundry.
                for (let i = 2; i < ww - 3; i += 7) {
                    const r = B.h01(f * 31 + side, i);
                    if (r < 0.18) K.ac(B, x + i, y, 3);
                    else if (r < 0.3) (B.px(x + i, y - 1, 0x3e8a4a), B.px(x + i + 1, y - 2, 0x5aa850));
                    else if (r < 0.36)
                        for (let k = 0; k < 4; k++)
                            B.px(x + i + k, y - 4 + (k % 2), [0xe8e8ee, 0xd8402a, 0x5a8ad8, 0xe8c040][k]);
                }
            }
        });
        // Core: stairwell strip lit all night, mechanical floors every 12.
        B.rect(coreX, 0, coreW, up, dark(S.wall, 0.2));
        for (let y = 3; y < up - 2; y += FL) {
            B.rect(coreX + 3, y, 3, 3, 0x5a7490);
            B.erect(coreX + 3, y, 3, 3, 0xd8ecff, 230);
        }
        for (let f = 12; f * FL < up - FL; f += 12) {
            B.rect(0, f * FL, w, 3, S.trim);
            B.rect(0, f * FL, w, 1, light(S.trim, 0.3));
            for (let x = 2; x < w; x += 3) B.px(x, f * FL + 1, dark(S.trim, 0.35));
        }
        K.cap(B, 0, 0, w, S.trim, { thick: true });
        K.antenna(B, coreX + 4, 0, 16);
        K.lobby(B, 0, up, w, LOBBY, { accent: S.acc, interior: 0xf0cc90 });
        PL.roofSign(B, S.label + ' HOUSING', 0, w, -1, S.trim === 0xc0392b ? 0xe8b830 : 0xf2d27a, {
            small: true,
        });
    };

    // ── University ──────────────────────────────────────────────────────────
    D.uni_main = function (B, b, w, h) {
        const brick = 0x8a4a3a;
        const stone = 0xd8ccb4;
        const up = h - LOBBY;
        K.wall(B, 0, 2, w, h - 2, brick, 'brick');
        K.windows(B, 0, 5, w, up - 5, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 6,
            top: 1,
            inset: 3,
            lintel: stone,
            tone: 'home',
            lit: 0.55,
        });
        K.cap(B, 0, 2, w, stone, { thick: true });
        for (let i = 0; i < w; i += 4) B.rect(i, 0, 2, 2, stone);
        // Clock tower.
        const cx = Math.round(w / 2);
        K.wall(B, cx - 6, -20, 12, 24, stone, 'stone');
        B.ellipse(cx, -12, 4, 4, 0xf4ecd8);
        B.erect(cx - 2, -13, 5, 3, 0xfff4d0);
        (B.px(cx, -14, 0x2a2a30), B.px(cx, -13, 0x2a2a30), B.px(cx + 1, -12, 0x2a2a30));
        for (let j = 0; j < 10; j++)
            for (let i = -6 + Math.floor(j * 0.6); i <= 6 - Math.floor(j * 0.6); i++)
                B.px(cx + i, -21 - j, j === 0 ? light(0x3a5a4a, 0.2) : 0x3a5a4a);
        B.px(cx, -32, 0xe8c060);
        // Gothic door.
        B.rect(cx - 3, up - 1, 6, LOBBY + 1, stone);
        K.door(B, cx - 2, up + 1, 4, LOBBY - 1, 0x4a2a1a);
        K.windows(B, 0, up, w, LOBBY, {
            floorH: 8,
            winW: 3,
            winH: 5,
            pitch: 6,
            top: 2,
            inset: 3,
            tone: 'home',
            lit: 0.6,
            skip: (f, c, cols) => Math.abs(c - (cols - 1) / 2) < 1.2,
        });
        K.plaqueC(B, cx, up - 9, 'AI ACADEMY', 0xf2d27a, 0x3a1a14, true, w);
    };
    D.uni_library = function (B, b, w, h) {
        const stone = 0xe0d4bc;
        const up = h - LOBBY;
        K.wall(B, 0, 6, w, h - 6, stone, 'stone');
        const top = K.pediment(B, 2, 6, w - 4, stone);
        K.dome(B, Math.round(w / 2), top + 1, 8, 0x6a9a8a, { ribs: true });
        K.columns(B, 4, 8, w - 8, h - 10, light(stone, 0.1), 6);
        for (let x = 7; x < w - 7; x += 6) K.pane(B, x, 12, 3, 8, { tone: 'home', lit: 0.85 }, x);
        K.door(B, Math.round(w / 2) - 2, h - 7, 4, 7, 0x4a2a1a);
        B.rect(0, h - 2, w, 2, dark(stone, 0.1));
        K.plaqueC(B, w / 2, 1 + 6, 'DATA LIBRARY', 0x3a2a1a, 0xe8dcc4, false, w);
    };
    D.uni_dorm = function (B, b, w, h) {
        const brick = 0x9a5a44;
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, brick, 'brick');
        K.windows(B, 0, 2, w, up - 2, {
            floorH: FL,
            winW: 3,
            winH: 4,
            pitch: 5,
            top: 1,
            inset: 2,
            sill: 0xd8c8a8,
            tone: 'home',
            lit: 0.8,
        });
        // Ivy up the left side.
        for (let y = 4; y < h; y++)
            for (let x = 0; x < 6 - Math.floor(y / 12); x++)
                if (B.h01(x, y) > 0.45) B.px(x, y, B.h01(y, x) > 0.5 ? 0x3e7a3a : 0x2e5e30);
        K.cap(B, 0, 0, w, 0xd8c8a8);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0x8a2a2a, frame: 0x3a2420 });
        K.plaqueC(B, w / 2, -7, 'MODEL DORMITORY', 0xf2d27a, 0x3a1a14, true, w + 8);
    };
    D.uni_lab = function (B, b, w, h) {
        const up = h - LOBBY;
        K.wall(B, 0, 0, w, up, 0x9a5a44, 'brick');
        K.curtain(B, 4, 2, w - 8, up - 2, { pitch: 4, mullion: 0x2a3440, lit: 0.8, tone: 'office' });
        K.cap(B, 0, 0, w, 0xd8c8a8);
        K.dish(B, 8, 0, 3);
        K.ac(B, w - 12, 0, 6);
        K.lobby(B, 0, up, w, LOBBY, { accent: 0x4ad0ff, interior: 0xe0f0ff });
        K.plaqueC(B, w / 2, -8, 'RESEARCH LAB', 0x9ad0ff, 0x101828, true, w + 8);
    };
})();
