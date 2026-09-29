/* Pixel art — the space zone (SpaceEnvironment.buildSpaceBuildings). Launch pads draw
   the pad, the gantry sized to the org's flagship and its arms; the rocket itself is
   the live SpaceRockets silhouette, pixelised in place. The tracking station's centre
   dish stays the object SpaceEntities sweeps, pixelised too. The Silkscreen name signs
   under each building are kept as they are. */
(function () {
    'use strict';
    const PL = window.PL;
    const K = PL.K;
    const { mix, dark, light, hex } = PL;
    const D = (PL.D = PL.D || {});
    const q = (v) => Math.round(v / PL.ART);

    const orgColor = (b) => {
        const o = b.org && typeof SPACE_ORGS !== 'undefined' ? SPACE_ORGS[b.org] : null;
        return o ? hex(o.color) : 0x64748b;
    };

    D['type:launchpad'] = function (B, b, w, h) {
        B.named = true;
        const W = b.w;
        const H = h * 3;
        // Concrete pad.
        B.rect(q(20), h - 3, w - q(40), 3, 0x94a3b8);
        B.rect(q(20), h - 3, w - q(40), 1, 0xb8c2ce);
        B.rect(q(30), h - 2, w - q(60), 1, 0x64748b);
        // Gantry, as tall as the flagship vehicle.
        const towerX = q(W / 2 - 8);
        const vehH = typeof SpaceRockets !== 'undefined' && b.org ? SpaceRockets.height(b.org) : 58;
        const towerTop = q(H - 8 - vehH - 8);
        for (let y = towerTop; y < h - 3; y++) {
            B.rect(towerX, y, 2, 1, y & 1 ? 0x475569 : 0x526174);
            B.rect(towerX + 3, y, 2, 1, y & 1 ? 0x3e4a5c : 0x475569);
        }
        for (let y = towerTop + 2; y < h - 4; y += q(12)) B.rect(towerX, y, 5, 1, 0x64748b);
        B.blink(towerX + 2, towerTop - 1, 0xff4050, 1.5, PL.hash(B.seed, 1, 1));
        if (b.org === 'spacex') {
            // Mechazilla chopsticks.
            B.rect(towerX + 5, towerTop + q(14), 6, 1, 0x1f2937);
            B.rect(towerX + 5, towerTop + q(22), 6, 1, 0x1f2937);
            B.rect(towerX + 5, towerTop + q(12), 1, q(16), 0x374151);
        } else {
            B.rect(towerX + 5, towerTop + q(20), 7, 1, 0xef4444);
        }
        // Without the live rocket (look-dev page), a stand-in so the pad is not empty.
        if (typeof SpaceRockets === 'undefined') {
            const rx = towerX + q(28);
            for (let y = h - 3 - q(45); y < h - 3; y++) B.rect(rx - 1, y, 3, 1, 0xf1f5f9);
            B.px(rx, h - 3 - q(45) - 1, orgColor(b));
        }
        // Flame pit and safety lights.
        const rx = towerX + q(28);
        B.rect(rx - 4, h - 1, 8, 1, 0x1e293b);
        [q(25), w - q(25)].forEach((x) => (B.px(x, h - 2, 0xef4444), B.epx(x, h - 2, 0xff6a5a)));
        // Floodlights washing the vehicle at night.
        B.light(rx, h - q(vehH / 2) - 3, 0xfff0d0, Math.max(10, q(vehH) * 0.45), 'wash');
    };

    D['type:mission_control'] = function (B, b, w, h) {
        B.named = true;
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0x2a3a50, 'panel', { pitch: 6 });
        B.rect(0, 0, w, q(16), 0x3a4a62);
        B.rect(0, 0, w, 1, 0x5a6a82);
        // Roof dish.
        const cx = Math.round(w / 2);
        for (let j = 0; j < 6; j++)
            for (let i = -j; i <= j; i++) B.px(cx + i, -7 + j, j === 5 ? 0xcbd5e1 : 0xf1f5f9);
        B.rect(cx, -2, 1, 3, 0x94a3b8);
        // Two rows of screen-lit windows.
        for (let wx = 15; wx < W - 15; wx += 28) {
            [
                [20, 0x0ea5e9],
                [40, 0x22d3ee],
            ].forEach(([wy, c]) => {
                const x = q(wx);
                const y = q(wy);
                for (let j = 0; j < 5; j++)
                    for (let i = 0; i < 7; i++) {
                        B.px(x + i, y + j, mix(0x10202e, c, 0.45));
                        B.epx(x + i, y + j, (i + j * 3) % 5 === 0 ? 0xffffff : c, 210);
                    }
            });
        }
        B.rect(cx - 3, h - 7, 7, 7, 0x475569);
        B.erect(cx - 2, h - 6, 5, 6, 0xbfe8ff, 140);
        B.light(cx, h, 0x9ad8ff, 10, 'door');
    };

    D['type:assembly'] = function (B, b, w, h) {
        B.named = true;
        const W = b.w;
        K.wall(B, 0, 0, w, h, 0x94a3b8, 'panel', { pitch: 3, seamY: 8 });
        B.rect(0, 0, w, 3, 0xcbd5e1);
        // Flag panel (VAB homage): blue field, red stripes, white canton.
        const fx = Math.round(w / 2) - q(30);
        B.rect(fx, q(12), q(60), q(40), 0x1e40af);
        for (let sy = 20; sy < 50; sy += 8) B.rect(fx + 1, q(sy), q(56), 1, 0xef4444);
        B.rect(fx + 1, q(14), q(20), q(16), 0xffffff);
        // The massive door.
        const cx = Math.round(w / 2);
        B.rect(cx - q(25), h - q(50), q(50), q(50), 0x475569);
        for (let y = h - q(50); y < h; y += 2) B.rect(cx - q(25), y, q(50), 1, 0x52627a);
        B.rect(cx, h - q(50), 1, q(50), 0x334155);
        B.erect(cx - q(25) + 1, h - 2, q(50) - 2, 2, 0xffe0b0, 140);
        B.blink(1, -1, 0xff4050, 1.6, 0);
        B.blink(w - 2, -1, 0xff4050, 1.6, 0.5);
    };

    D['type:tracking'] = function (B, b, w, h) {
        B.named = true;
        const W = b.w;
        K.wall(B, 0, q(14), w, h - q(14), 0x2a3a50, 'panel', { pitch: 5 });
        // Flanking static dishes with faint signal arcs.
        [-30, 30].forEach((off) => {
            const dx = Math.round(w / 2 + off / 3);
            for (let j = 0; j < 5; j++)
                for (let i = -j; i <= j; i++) B.px(dx + i, j, j === 4 ? 0xcbd5e1 : 0xf1f5f9);
            B.rect(dx, 1, 1, 5, 0x94a3b8);
            for (let a = 0; a < 12; a++) {
                const ang = Math.PI + (a / 11) * Math.PI;
                B.epx(dx + Math.round(Math.cos(ang) * 3), -1 + Math.round(Math.sin(ang) * 3), 0x22d3ee, 90);
            }
        });
        // Centre mast (the dish bowl on top is SpaceEntities' live scan dish).
        B.rect(Math.round(w / 2), 0, 1, q(14), 0x64748b);
        B.px(Math.round(w / 2), 0, 0x475569);
        // Windows and status lights.
        for (let x = 4; x < w - 4; x += 6) {
            B.rect(x, q(24), 3, 3, 0x1e3a4a);
            B.erect(x, q(24), 3, 3, 0x7ae8ff, 170);
        }
        [q(15), w - q(15)].forEach((x) => (B.px(x, h - 3, 0x2a8a4a), B.epx(x, h - 3, 0x4ade80)));
        void W;
    };
})();
