/* Pixel art — citizens as little robots. Every AI model in the city is drawn as a robot in its
   lab's colours: a metal chassis with lab-coloured shell and shoulders, a glowing chest core
   and a two-eyed visor. Open-weight models get a round "halo orb" head, mixture-of-experts
   models a slit-visor dome, everyone else a visor helmet. Babies are hovering egg-drones,
   kids are short and big-headed, retired models fade to ghostly steel, rumoured ones are
   violet prototypes.

   The robot is a small pixel template (one cell = one art pixel) written into the
   citizen's existing Graphics as grid-aligned rectangles, so the skin pixelises it exactly
   and everything that moves, hides, hit-tests or recolours those Graphics keeps working:
   the head and torso go into `body` (the head Graphics is left empty), the legs into
   legL / legR. Only used with the pixel skin; ?classic=1 keeps the original figures. */
(function () {
    'use strict';
    const PL = window.PL;
    const { mix, dark, light } = PL;

    const METAL = { hi: 0xe2e6ee, mid: 0xb4bac6, lo: 0x7c8494, deep: 0x4a5060 };
    const VISOR = 0x0e1220;
    const EYE = 0x8af4ff;

    // A tiny canvas of colour cells; null = empty.
    function Grid(w, h) {
        const g = { w: w, h: h, c: new Array(w * h).fill(null) };
        g.set = (x, y, col) => {
            if (x >= 0 && y >= 0 && x < w && y < h && col !== undefined) g.c[y * w + x] = col;
        };
        g.rect = (x, y, rw, rh, col) => {
            for (let j = 0; j < rh; j++) for (let i = 0; i < rw; i++) g.set(x + i, y + j, col);
        };
        return g;
    }
    // Write a grid into a Graphics: (ox, oy) is where cell (0, 0) goes, in art px.
    function emit(gfx, g, ox, oy, alpha) {
        const A = PL.ART;
        for (let y = 0; y < g.h; y++) {
            let x = 0;
            while (x < g.w) {
                const col = g.c[y * g.w + x];
                if (col === null) {
                    x++;
                    continue;
                }
                let e = x + 1;
                while (e < g.w && g.c[y * g.w + e] === col) e++;
                gfx.beginFill(col, alpha === undefined ? 1 : alpha);
                gfx.drawRect((ox + x) * A, (oy + y) * A, (e - x) * A, A);
                gfx.endFill();
                x = e;
            }
        }
    }

    function palette(colHex, isR, isRm) {
        let shell = colHex;
        if (PL.lum(shell) < 0.14) shell = mix(shell, 0x8a90a0, 0.45);
        if (isR) shell = mix(PL.sat(shell, 0.2), 0x9ab0d0, 0.6);
        if (isRm) shell = 0x8b5cf6;
        return {
            shell: shell,
            shellHi: light(shell, 0.28),
            shellLo: dark(shell, 0.32),
            core: isR ? 0xc8dcff : isRm ? 0xe0c8ff : mix(light(shell, 0.5), 0xffffff, 0.35),
            eye: isR ? 0xc8dcff : isRm ? 0xe8d8ff : PL.lum(shell) > 0.6 ? 0x2af0ff : EYE,
            metal: isR
                ? { hi: 0xd0d8e8, mid: 0xa0aabc, lo: 0x6a7488, deep: 0x40485a }
                : isRm
                  ? { hi: 0xd8ccf0, mid: 0xa898d0, lo: 0x7062a0, deep: 0x463a70 }
                  : METAL,
        };
    }

    // Head + torso, facing right (the container mirrors it for walking left).
    // W = width in cells (even), HA = head rows, BA = torso rows.
    function upper(W, HA, BA, kind, P, stg) {
        const M = P.metal;
        const g = Grid(W + 2, HA + BA + 4);
        const ox = 1; // one spare column each side for shoulder pads
        const top = 3; // rows above the head for a halo / antenna stub
        const R = W - 1; // rightmost body column
        const hx0 = ox + (stg === 'baby' ? 0 : 1);
        const hx1 = ox + R - (stg === 'baby' ? 0 : 1);
        const hw = hx1 - hx0 + 1;
        // ── Head ──
        if (kind === 'orb' || stg === 'baby') {
            // Round orb: corners cut, light metal with a lab band; halo for open weights.
            for (let j = 0; j < HA; j++) {
                const cut = j === 0 || j === HA - 1 ? 1 : 0;
                for (let i = cut; i < hw - cut; i++) {
                    let c = stg === 'baby' ? P.shell : M.hi;
                    if (i === cut || j === 0) c = stg === 'baby' ? P.shellHi : 0xf4f6fa;
                    if (i === hw - cut - 1 || j === HA - 1) c = stg === 'baby' ? P.shellLo : M.mid;
                    g.set(hx0 + i, top + j, c);
                }
            }
            if (stg !== 'baby') g.rect(hx0, top + Math.floor(HA / 2) - 1, hw, 1, P.shell);
            // Face screen with two eyes, toward the front.
            const fy = top + Math.max(1, Math.floor(HA * 0.35));
            const fh = Math.max(2, Math.round(HA * 0.4));
            const fx = hx0 + Math.max(1, Math.floor(hw * 0.3));
            g.rect(fx, fy, hx1 - fx, fh, VISOR);
            if (stg === 'baby') {
                // One big eye.
                const ex = fx + Math.floor((hx1 - fx) / 2) - 1;
                g.rect(ex, fy + Math.floor((fh - 2) / 2), 2, 2, P.eye);
            } else {
                g.set(hx1 - 3, fy + Math.floor(fh / 2), P.eye);
                g.set(hx1 - 1, fy + Math.floor(fh / 2), P.eye);
            }
            if (kind === 'orb' && stg !== 'baby') {
                // Halo ring hovering over the head.
                for (let i = 1; i < hw - 1; i++) g.set(hx0 + i, top - 2, 0xffe08a);
                g.set(hx0, top - 1, 0xffd060);
                g.set(hx1, top - 1, 0xffd060);
            }
        } else {
            // Helmet (visor) or dome (slit): lab-coloured shell, darker jaw.
            for (let j = 0; j < HA; j++)
                for (let i = 0; i < hw; i++) {
                    if (kind === 'dome' && j === 0 && (i === 0 || i === hw - 1)) continue;
                    let c = P.shell;
                    if (j === 0 || i === 0) c = P.shellHi;
                    if (i === hw - 1) c = P.shellLo;
                    if (j === HA - 1) c = P.shellLo;
                    g.set(hx0 + i, top + j, c);
                }
            if (kind === 'dome') {
                // Thin glowing slit across the front.
                const sy = top + Math.floor(HA * 0.45);
                g.rect(hx0 + 1, sy, hw - 1, 1, VISOR);
                for (let i = Math.floor(hw / 2); i < hw; i++) g.set(hx0 + i, sy, P.eye);
            } else {
                const vy = top + Math.max(1, Math.floor(HA * 0.3));
                const vh = Math.max(2, Math.round(HA * 0.38));
                g.rect(hx0 + 1, vy, hw - 1, vh, VISOR);
                g.set(hx0 + 1, vy, mix(VISOR, 0xffffff, 0.25));
                const ey = vy + Math.floor((vh - 1) / 2);
                g.set(hx1 - 3, ey, P.eye);
                g.set(hx1 - 1, ey, P.eye);
            }
            // Ear bolt at the back.
            g.set(hx0, top + Math.floor(HA / 2), M.lo);
            // Antenna stub (the status dot floats just above as its bulb).
            g.set(hx0 + 1, top - 1, M.lo);
            g.set(hx0 + 1, top - 2, M.mid);
        }
        // ── Neck ──
        const ny = top + HA;
        g.rect(ox + Math.floor(W / 2) - 1, ny, 2, 1, M.lo);
        // ── Torso ──
        const ty = ny + 1;
        const tb = BA - 1;
        if (tb < 2) return { g: g, ox: ox, top: top };
        for (let j = 0; j < tb; j++)
            for (let i = 0; i < W; i++) {
                let c = M.mid;
                if (i === 0) c = M.lo; // back arm
                else if (i === R) c = M.hi; // front arm, lit
                else if (j === 0) c = P.shell; // shoulders
                else if (i === 1) c = M.hi;
                else if (i === R - 1) c = M.lo;
                g.set(ox + i, ty + j, c);
            }
        // Shoulder pads stick out a pixel.
        g.set(ox - 1, ty, P.shellLo);
        g.set(ox + W, ty, P.shellHi);
        // Chest plate in lab colour with the core light.
        if (W >= 6 && tb >= 4) {
            const px = ox + 2;
            const pw = W - 4;
            g.rect(px, ty + 1, pw, Math.max(1, tb - 3), P.shell);
            g.rect(px, ty + 1, pw, 1, P.shellHi);
            g.set(px + pw - 1 - Math.floor((pw - 1) / 2), ty + 1 + Math.floor((tb - 3) / 2), P.core);
        }
        // Belt and hands.
        g.rect(ox + 1, ty + tb - 1, W - 2, 1, M.deep);
        g.set(ox, ty + tb, M.lo);
        g.set(ox + R, ty + tb, M.hi);
        return { g: g, ox: ox, top: top };
    }

    function leg(LH, P, stg) {
        const M = P.metal;
        const g = Grid(3, LH);
        if (stg === 'baby') {
            // Egg-drone: a thruster glow instead of legs.
            g.set(0, 0, M.lo);
            g.set(1, 0, M.mid);
            if (LH > 1) g.set(0, 1, 0x8af4ff);
            return g;
        }
        for (let j = 0; j < LH - 1; j++) {
            g.set(0, j, M.mid);
            g.set(1, j, M.lo);
        }
        // Foot points forward.
        g.set(0, LH - 1, M.deep);
        g.set(1, LH - 1, M.deep);
        g.set(2, LH - 1, M.lo);
        return g;
    }

    const R = (PL.Robot = {
        kindOf(m, refs) {
            if (refs && refs.isMoE) return 'dome';
            if (m && m.os) return 'orb';
            return 'helmet';
        },

        // Replaces the head/body/legs drawing in EntitiesGfx.updateCharStateVisuals.
        drawCitizen(m, refs, stg, isR, isRm, finalSc, sd, colHex) {
            const A = PL.ART;
            const P = palette(colHex, isR, isRm);
            const kind = this.kindOf(m, refs);
            // The engine positions head and body from these world sizes.
            const h = Math.round(32 * finalSc);
            const headH = Math.round(h * sd.headR);
            // In art cells.
            let W = 2 * Math.max(2, Math.round(4 * finalSc));
            if (stg === 'baby') W = Math.max(6, W);
            const HA = Math.max(stg === 'baby' ? 5 : 4, Math.round(headH / A));
            const LH = Math.max(2, Math.round((4 * finalSc) / A) + 1);
            // Torso rows: neck + plate + hands end at the hip line (y 0), where the legs hang.
            const BA = Math.max(stg === 'baby' ? 1 : 3, Math.round((h - headH) / A) - (stg === 'baby' ? 3 : 1));
            const U = upper(W, HA, BA, kind, P, stg);
            // body.y = -h + headH: the head sits above that line, the torso below it.
            refs.head.clear();
            refs.body.clear();
            const alpha = isR ? 0.5 : isRm ? 0.6 : 1;
            emit(refs.body, U.g, -U.ox - W / 2, -U.top - HA, alpha);
            const L = leg(LH, P, stg);
            [refs.legL, refs.legR].forEach((g, k) => {
                g.clear();
                emit(g, L, -1, 0, k === 0 ? alpha * 0.92 : alpha);
            });
            const lx = Math.max(1, Math.round(W / 4));
            refs.legL.x = -lx * A;
            refs.legR.x = (lx - 1) * A;
            if (refs.isMoE) {
                [refs.ghostL, refs.ghostR].forEach((g) => {
                    g.clear();
                    emit(g, U.g, -U.ox - W / 2, -U.top - HA, 0.5);
                    g.blendMode = PIXI.BLEND_MODES.ADD;
                });
            }
            return { h: h, bw: W * A };
        },
    });
    void R;
})();
