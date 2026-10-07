/* Pixel lab v2 — paint kit. A Bake is one building's pixel canvases:
     base  — the facade in neutral daylight (sprite tint = ambient light)
     emit  — what glows after dark (lit windows, neon, lamps); alpha follows night
     bloom — a dithered halo grown from emit, drawn additively
   Painters use footprint coordinates: x 0..w across, y 0 at the roofline down to h at
   the pavement. Roof props may go above y 0 (into `head`) and signs may overhang (padX). */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, hash, bayer, mix, shade, dark, light, hex } = PL;

    const WARM = [0xffd98a, 0xffc873, 0xffe6b0, 0xffb85e, 0xffcf8a];
    const OFFICE = [0xf2e2b0, 0xe8d49a, 0xf6ead0, 0xd8e4ee, 0xecd8a8, 0xc8dcec];
    const CURTAIN = [0xb84a4a, 0x4a7a5a, 0x4a5a9a, 0x9a6a3a, 0x8a4a8a, 0xc88a3a, 0x3a8a8a];

    class Bake {
        constructor(w, h, opt) {
            opt = opt || {};
            this.w = Math.max(1, Math.round(w));
            this.h = Math.max(1, Math.round(h));
            this.padX = opt.padX === undefined ? 8 : opt.padX;
            this.head = opt.head === undefined ? 56 : opt.head;
            this.W = this.w + this.padX * 2;
            this.H = this.h + this.head;
            this.base = new Img(this.W, this.H);
            this.emit = new Img(this.W, this.H);
            // Signage: glows softly by day and fully after dark (PL.tod neon), unlike `emit`
            // (windows, lamps), which only lights up at night.
            this.neon = new Img(this.W, this.H);
            this.seed = opt.seed || 1;
            this.rnd = PL.rng(this.seed);
            this.lights = [];
            this.blinks = [];
            this.smoke = [];
            this.spin = [];
        }
        X(x) {
            return Math.round(x) + this.padX;
        }
        Y(y) {
            return Math.round(y) + this.head;
        }
        h01(a, b) {
            return hash(this.seed, a | 0, b | 0);
        }
        px(x, y, c, a) {
            this.base.set(this.X(x), this.Y(y), c, a);
        }
        get(x, y) {
            return this.base.get(this.X(x), this.Y(y));
        }
        rect(x, y, w, h, c) {
            this.base.rect(this.X(x), this.Y(y), w, h, c);
        }
        rectA(x, y, w, h, c, a) {
            this.base.rectA(this.X(x), this.Y(y), w, h, c, a);
        }
        epx(x, y, c, a) {
            this.emit.set(this.X(x), this.Y(y), c, a);
        }
        erect(x, y, w, h, c, a) {
            this.emit.rect(this.X(x), this.Y(y), w, h, c, a);
        }
        line(x0, y0, x1, y1, c) {
            this.base.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
        }
        eline(x0, y0, x1, y1, c) {
            this.emit.line(this.X(x0), this.Y(y0), this.X(x1), this.Y(y1), c);
        }
        ellipse(cx, cy, rx, ry, c) {
            this.base.ellipse(this.X(cx), this.Y(cy), rx, ry, c);
        }
        text(s, x, y, c, size, gap, shadow) {
            return PL.text(this.base, s, this.X(x), this.Y(y), c, size, gap, shadow);
        }
        etext(s, x, y, c, size, gap) {
            return PL.text(this.neon, s, this.X(x), this.Y(y), c, size, gap);
        }
        npx(x, y, c, a) {
            this.neon.set(this.X(x), this.Y(y), c, a);
        }
        nrect(x, y, w, h, c, a) {
            this.neon.rect(this.X(x), this.Y(y), w, h, c, a);
        }
        stamp(img, x, y, flip) {
            this.base.draw(img, this.X(x), this.Y(y), flip);
        }
        light(x, y, col, r, kind) {
            this.lights.push({
                x: Math.round(x),
                y: Math.round(y),
                col: col,
                r: r || 10,
                kind: kind || 'lamp',
            });
        }
        blink(x, y, col, period, phase) {
            this.blinks.push({
                x: Math.round(x),
                y: Math.round(y),
                col: col || 0xff4050,
                period: period || 1.6,
                phase: phase || 0,
            });
        }
        // Soft additive halo grown from every emissive pixel. This is what makes windows
        // and neon read as light rather than as yellow paint.
        finish() {
            // Snow caps: every upward-facing edge of the facade gets a white lip.
            const bs = this.base;
            const snow = new Img(bs.w, bs.h);
            let anySnow = false;
            for (let x = 0; x < bs.w; x++)
                for (let y = 1; y < bs.h; y++) {
                    if (bs.alpha(x, y) < 200 || bs.alpha(x, y - 1) > 0) continue;
                    anySnow = true;
                    snow.set(x, y - 1, 0xf4f8ff);
                    snow.set(x, y, PL.bayer(x, y) > 0.4 ? 0xe0e8f8 : 0xf4f8ff);
                    if (PL.bayer(x, y + 1) > 0.7) snow.set(x, y + 1, 0xd0dcf0);
                }
            this.snow = anySnow ? snow : null;
            this.bloom = Bake.bloomOf(this.emit);
            this.bloomN = Bake.bloomOf(this.neon);
            this.hasNeon = !!this.bloomN;
            this.refl = Bake.reflectionOf(this);
            return this;
        }
    }
    // Soft additive halo grown from every lit pixel of `e`: this is what makes windows and
    // neon read as light rather than as yellow paint. Null when nothing is lit.
    Bake.bloomOf = function (e) {
        const W = e.w;
        const H = e.h;
        const acc = new Float32Array(W * H * 3);
        const R = 3;
        const k = [];
        for (let dy = -R; dy <= R; dy++)
            for (let dx = -R; dx <= R; dx++) {
                const d = Math.hypot(dx, dy) / (R + 0.5);
                if (d < 1) k.push([dx, dy, (1 - d) * (1 - d)]);
            }
        let any = false;
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const v = e.u[y * W + x];
                const a = v >>> 24;
                if (a < 40) continue;
                any = true;
                const s = (a / 255) * 0.11;
                const r = (v & 255) * s;
                const g = ((v >> 8) & 255) * s;
                const b = ((v >> 16) & 255) * s;
                for (let i = 0; i < k.length; i++) {
                    const xx = x + k[i][0];
                    const yy = y + k[i][1];
                    if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue;
                    const o = (yy * W + xx) * 3;
                    const f = k[i][2];
                    acc[o] += r * f;
                    acc[o + 1] += g * f;
                    acc[o + 2] += b * f;
                }
            }
        if (!any) return null;
        const img = new Img(W, H);
        for (let y = 0; y < H; y++)
            for (let x = 0; x < W; x++) {
                const o = (y * W + x) * 3;
                const m = Math.max(acc[o], acc[o + 1], acc[o + 2]);
                if (m < 6) continue;
                // Halo around lights, not over them: lit pixels keep their own colour.
                if (e.u[y * W + x] >>> 24 > 40) continue;
                // Quantise brightness to 4 steps with ordered dither.
                const q = Math.min(1, Math.floor((m / 255) * 4 + bayer(x, y)) / 4);
                if (q <= 0) continue;
                const sc = (q * 255) / m;
                img.set(x, y, PL.rgb(acc[o] * sc, acc[o + 1] * sc, acc[o + 2] * sc), 255);
            }
        return img;
    };
    // Wet-street reflection under a facade: the lit street level (lobby glow, shop fronts,
    // low windows, neon) mirrored onto the pavement and road, squashed a little, each row
    // nudged sideways by a ripple, every few rows broken, fading with distance and stepped
    // with ordered dither. Drawn additively below the building; null when nothing low is lit.
    Bake.REFL_H = Math.round(56 / PL.ART); // pavement + road, in art px
    Bake.reflectionOf = function (B) {
        const W = B.W;
        const H = B.H;
        const RH = Bake.REFL_H;
        const out = new Img(W, RH);
        let any = false;
        for (let y = 0; y < RH; y++) {
            // Ripple lines: a broken row every 3rd–4th line further out.
            if (y > 2 && (y % 4 === 3 || (y > RH / 2 && y % 3 === 0))) continue;
            const srcY = H - 1 - Math.floor(y * 1.5);
            if (srcY < 0) break;
            const dx = Math.round(Math.sin(y * 1.3 + B.seed) * (y < 4 ? 0 : 1.2));
            const fade = 0.85 * Math.pow(1 - y / RH, 1.15);
            for (let x = 0; x < W; x++) {
                const sx = x + dx;
                if (sx < 0 || sx >= W) continue;
                const n = B.neon.u[srcY * W + sx];
                const e = B.emit.u[srcY * W + sx];
                const v = n >>> 24 > 60 ? n : e >>> 24 > 60 ? e : 0;
                if (!v) continue;
                const a = ((v >>> 24) / 255) * fade * (v === n ? 1.15 : 0.85);
                const q = Math.floor(a * 3 + bayer(x, y) * 0.95) / 3;
                if (q <= 0) continue;
                out.set(x, y, ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255), Math.min(1, q) * 255);
                any = true;
            }
        }
        return any ? out : null;
    };
    PL.Bake = Bake;

    const K = (PL.K = {});
    K.WARM = WARM;
    K.OFFICE = OFFICE;

    // ── Walls ───────────────────────────────────────────────────────────────
    // kind: brick | concrete | stone | stucco | panel | corrugated | wood | tile
    K.wall = function (B, x, y, w, h, col, kind, o) {
        o = o || {};
        const s = B.seed;
        const hi = light(col, 0.18);
        const lo = dark(col, 0.14);
        const mortar = o.mortar === undefined ? dark(col, 0.22) : o.mortar;
        for (let j = 0; j < h; j++) {
            for (let i = 0; i < w; i++) {
                const X = x + i;
                const Y = y + j;
                let c = col;
                const n = hash(s, X, Y);
                if (kind === 'brick') {
                    const course = Math.floor(Y / 3);
                    const row = Y % 3;
                    const jointX = (X + (course & 1) * 3) % 6 === 0;
                    const brick = hash(s, Math.floor((X + (course & 1) * 3) / 6), course);
                    if (row === 2 || jointX) c = mortar;
                    else {
                        c = shade(col, 0.9 + brick * 0.18);
                        if (row === 0 && bayer(X, Y) > 0.6) c = light(c, 0.08);
                    }
                } else if (kind === 'stone') {
                    const course = Math.floor(Y / 4);
                    const row = Y % 4;
                    const joint = (X + (course & 1) * 4) % 8 === 0;
                    if (row === 3) c = lo;
                    else if (joint && row > 0) c = shade(col, 0.9);
                    else if (row === 0) c = hi;
                    else if (n > 0.93) c = shade(col, 0.95);
                } else if (kind === 'concrete') {
                    if (n > 0.9) c = shade(col, 0.94);
                    else if (n < 0.06) c = shade(col, 1.05);
                    if ((X % 14 === 0 && o.seams !== false) || (o.seamY && Y % o.seamY === 0))
                        c = shade(col, 0.88);
                } else if (kind === 'panel') {
                    const p = o.pitch || 4;
                    if (X % p === 0) c = lo;
                    else if (X % p === 1) c = hi;
                    if (o.seamY && Y % o.seamY === 0) c = shade(col, 0.8);
                } else if (kind === 'corrugated') {
                    const p = X % 3;
                    c = p === 0 ? hi : p === 1 ? col : lo;
                    if (n > 0.97) c = shade(c, 0.9);
                } else if (kind === 'wood') {
                    c = Y % 3 === 2 ? lo : n > 0.8 ? shade(col, 0.95) : col;
                } else if (kind === 'tile') {
                    c = X % 3 === 0 || Y % 3 === 0 ? shade(col, 0.9) : col;
                } else {
                    // stucco
                    if (n > 0.92) c = shade(col, 0.96);
                    else if (n < 0.05) c = shade(col, 1.04);
                }
                B.px(X, Y, c);
            }
        }
        if (o.edges !== false) K.edges(B, x, y, w, h, col);
    };

    // Left rim light, right shadow — every block gets a little volume.
    K.edges = function (B, x, y, w, h, col) {
        for (let j = 0; j < h; j++) {
            const hi = B.get(x, y + j);
            if (hi >= 0) B.px(x, y + j, light(hi, 0.22));
            const lo = B.get(x + w - 1, y + j);
            if (lo >= 0) B.px(x + w - 1, y + j, dark(lo, 0.3));
            if (w > 8) {
                const lo2 = B.get(x + w - 2, y + j);
                if (lo2 >= 0) B.px(x + w - 2, y + j, dark(lo2, 0.12));
            }
        }
        void col;
    };

    // Roof cap: bright coping line and a shadow course beneath.
    K.cap = function (B, x, y, w, col, o) {
        o = o || {};
        const over = o.over === undefined ? 1 : o.over;
        B.rect(x - over, y, w + over * 2, 1, light(col, 0.3));
        B.rect(x - over, y + 1, w + over * 2, 1, col);
        if (o.thick) B.rect(x - over, y + 2, w + over * 2, 1, dark(col, 0.2));
        B.rect(x, y + (o.thick ? 3 : 2), w, 1, dark(col, 0.45));
    };

    // Horizontal string course / cornice.
    K.band = function (B, x, y, w, col) {
        B.rect(x, y, w, 1, light(col, 0.2));
        B.rect(x, y + 1, w, 1, dark(col, 0.3));
    };

    // ── Windows ─────────────────────────────────────────────────────────────
    function litColor(B, tone, i) {
        const h = B.h01(i, 991);
        if (tone === 'office') return OFFICE[Math.floor(h * OFFICE.length)];
        if (tone === 'neon') return [0xff7ad0, 0x7ae8ff, 0xffd27a, 0xc08aff][Math.floor(h * 4)];
        if (tone === 'mixed')
            return h > 0.55
                ? OFFICE[Math.floor(h * 97) % OFFICE.length]
                : WARM[Math.floor(h * 31) % WARM.length];
        return WARM[Math.floor(h * WARM.length)];
    }

    // Paint one window. (x, y) top-left of the glass.
    K.pane = function (B, x, y, w, h, o, id) {
        const gTop = o.glassTop === undefined ? 0x9fc2e0 : o.glassTop;
        const gBot = o.glassBot === undefined ? 0x5f86b0 : o.glassBot;
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                const t = h > 1 ? j / (h - 1) : 0;
                let c = PL.dpick([gTop, mix(gTop, gBot, 0.5), gBot], t, x + i, y + j);
                // Sky reflection streak running diagonally across the facade.
                if ((x + i + (y + j) * 0.6 + (B.seed % 29)) % 23 < 2.2) c = light(c, 0.35);
                B.px(x + i, y + j, c);
            }
        if (w >= 2 && h >= 2) B.px(x, y, light(gTop, 0.4));
        const lit = B.h01(id, 7) < (o.lit === undefined ? 0.55 : o.lit);
        if (!lit) return false;
        const f = B.h01(id, 13);
        const base = litColor(B, o.tone || 'home', id);
        const dim = B.h01(id, 17) < 0.22;
        const col = dim ? mix(base, 0x8a4a20, 0.45) : base;
        const top = light(col, 0.25);
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                let c = j === 0 ? top : col;
                if (o.blinds !== false && f < 0.28 && j % 2 === 1) c = shade(col, 0.82);
                B.epx(x + i, y + j, c);
            }
        if (w >= 3 && h >= 3) {
            if (f > 0.72 && f < 0.86 && o.curtains !== false) {
                const cc = CURTAIN[Math.floor(B.h01(id, 23) * CURTAIN.length)];
                for (let j = 0; j < h; j++) {
                    B.epx(x, y + j, cc);
                    if (w >= 4) B.epx(x + w - 1, y + j, shade(cc, 0.8));
                }
            } else if (f > 0.93) {
                // Someone at the window.
                B.epx(x + 1 + Math.floor(B.h01(id, 29) * (w - 2)), y + h - 2, 0x2a1c24);
                B.epx(x + 1 + Math.floor(B.h01(id, 29) * (w - 2)), y + h - 1, 0x2a1c24);
            } else if (f > 0.86 && f <= 0.93) {
                B.epx(x, y + h - 1, 0x3c7a3a);
                if (w > 2) B.epx(x + 1, y + h - 1, 0x4c9a48);
            }
        }
        if (B.h01(id, 31) < 0.05 && o.tone !== 'office') {
            // Blue TV glow.
            for (let j = 0; j < h; j++)
                for (let i = 0; i < w; i++) B.epx(x + i, y + j, j === 0 ? 0xcfe8ff : 0x8ab8ff);
        }
        return true;
    };

    // A grid of punched windows.
    // o: floorH, top, winW, winH, pitch, frame, sill, lintel, tone, lit, skip(f,c)
    K.windows = function (B, x, y, w, h, o) {
        o = o || {};
        const fh = o.floorH || PL.FLOOR;
        const ww = o.winW || 3;
        const wh = o.winH || Math.max(2, fh - 2);
        const top = o.top === undefined ? 1 : o.top;
        const pitch = o.pitch || ww + 2;
        const cols = Math.max(
            1,
            Math.floor((w - (o.inset === undefined ? 2 : o.inset) * 2 + (pitch - ww)) / pitch)
        );
        const span = cols * pitch - (pitch - ww);
        const x0 = x + Math.floor((w - span) / 2);
        const floors = Math.floor(h / fh);
        let id = o.id0 || 0;
        for (let f = 0; f < floors; f++) {
            const fy = y + f * fh + top;
            for (let c = 0; c < cols; c++) {
                id++;
                if (o.skip && o.skip(f, c, cols, floors)) continue;
                const wx = x0 + c * pitch;
                if (o.frame !== undefined && o.frame !== null) {
                    B.rect(wx - 1, fy - 1, ww + 2, wh + 2, o.frame);
                }
                K.pane(B, wx, fy, ww, wh, o, id + f * 131);
                if (o.sill !== undefined && o.sill !== null) B.rect(wx - 1, fy + wh, ww + 2, 1, o.sill);
                if (o.lintel !== undefined && o.lintel !== null) B.rect(wx - 1, fy - 1, ww + 2, 1, o.lintel);
                if (o.shutters) {
                    B.rect(wx - 1, fy, 1, wh, o.shutters);
                    B.rect(wx + ww, fy, 1, wh, o.shutters);
                }
            }
        }
        return { cols: cols, floors: floors, x0: x0, pitch: pitch };
    };

    // Full-height curtain wall: mullions every `pitch`, spandrel every floor.
    K.curtain = function (B, x, y, w, h, o) {
        o = o || {};
        const fh = o.floorH || PL.FLOOR;
        const pitch = o.pitch || 4;
        const mull = o.mullion === undefined ? 0x3a4658 : o.mullion;
        const span = o.spandrel === undefined ? dark(mull, 0.2) : o.spandrel;
        const gTop = o.glassTop === undefined ? 0x8fb4d8 : o.glassTop;
        const gBot = o.glassBot === undefined ? 0x4a6e98 : o.glassBot;
        const floors = Math.ceil(h / fh);
        for (let j = 0; j < h; j++) {
            const Y = y + j;
            const fr = j % fh;
            const t = j / Math.max(1, h - 1);
            for (let i = 0; i < w; i++) {
                const X = x + i;
                let c;
                if (fr === 0) c = span;
                else if (i % pitch === 0) c = mull;
                else {
                    // Sky reflection: brighter toward the top, streaked diagonally.
                    c = PL.dpick([gTop, mix(gTop, gBot, 0.5), gBot], 0.25 + t * 0.7 + (fr / fh) * 0.1, X, Y);
                    if ((X * 1.0 + Y * 0.55 + (B.seed % 37)) % 31 < 3.2) c = light(c, 0.3);
                }
                B.px(X, Y, c);
            }
        }
        // Night: lit bays.
        let id = o.id0 || 500;
        const cols = Math.floor(w / pitch);
        for (let f = 0; f < floors; f++) {
            const floorLit = B.h01(f, 3) < (o.floorLit === undefined ? 0.8 : o.floorLit);
            for (let c = 0; c < cols; c++) {
                id++;
                if (!floorLit) continue;
                if (B.h01(id, 5) > (o.lit === undefined ? 0.6 : o.lit)) continue;
                const col = litColor(B, o.tone || 'office', f * 7 + (c >> 2));
                const x0 = x + c * pitch + 1;
                const y0 = y + f * fh + 1;
                const ww = Math.min(pitch - 1, x + w - x0);
                const hh = Math.min(fh - 1, y + h - y0);
                if (ww <= 0 || hh <= 0) continue;
                for (let j = 0; j < hh; j++)
                    for (let i = 0; i < ww; i++) B.epx(x0 + i, y0 + j, j === 0 ? light(col, 0.2) : col);
            }
        }
        K.edges(B, x, y, w, h, mull);
    };

    // Ground-floor lobby: glazing, door, canopy. y is the top of the band.
    K.lobby = function (B, x, y, w, h, o) {
        o = o || {};
        const frame = o.frame === undefined ? 0x2a2e3a : o.frame;
        const acc = o.accent === undefined ? 0xd8c8a0 : o.accent;
        B.rect(x, y, w, h, frame);
        const gx = x + 1;
        const gw = w - 2;
        const gy = y + 2;
        const gh = h - 2;
        for (let j = 0; j < gh; j++)
            for (let i = 0; i < gw; i++) {
                const X = gx + i;
                const Y = gy + j;
                const mull = (i + 1) % (o.pitch || 5) === 0;
                B.px(X, Y, mull ? frame : PL.dpick([0x5a7896, 0x3a5470, 0x2a3c54], j / gh, X, Y));
                if (!mull) {
                    const inside = o.interior === undefined ? 0xf0c888 : o.interior;
                    let c =
                        j === 0
                            ? light(inside, 0.2)
                            : j >= gh - 1
                              ? shade(inside, 0.55)
                              : shade(inside, 0.82);
                    // Reception desk, plants and the odd person inside.
                    const r = hash(B.seed, X, 3131);
                    if (j === gh - 2 && r > 0.55) c = shade(inside, 0.5);
                    else if (j >= gh - 3 && r > 0.93) c = 0x2a1e24;
                    else if (j >= gh - 2 && r < 0.05) c = 0x3a6a3a;
                    B.epx(X, Y, c, 225);
                }
            }
        // Door with warm light and a canopy in the accent colour.
        const dw = Math.min(5, Math.max(3, Math.floor(w / 10)));
        const dx = x + Math.floor((w - dw) / 2);
        B.rect(dx, y + 2, dw, h - 2, 0x1a1c24);
        for (let j = 3; j < h; j++) for (let i = 1; i < dw - 1; i++) B.epx(dx + i, y + j, 0xfff0c8);
        B.rect(dx - 2, y + 1, dw + 4, 1, acc);
        B.rect(dx - 2, y + 2, dw + 4, 1, dark(acc, 0.4));
        B.rect(x, y, w, 1, light(frame, 0.2));
        // Planters.
        if (w > 20 && o.planters !== false) {
            [x + 3, x + w - 6].forEach((px) => {
                B.rect(px, y + h - 2, 3, 2, 0x5a4a3a);
                B.px(px, y + h - 3, 0x3e8a4a);
                B.px(px + 1, y + h - 4, 0x4ea85a);
                B.px(px + 2, y + h - 3, 0x2e6a3a);
            });
        }
        B.light(x + w / 2, y + h - 1, 0xffd9a0, 12, 'door');
    };

    // Shopfront with awning and sign. y is the top of the band (sign included).
    K.shop = function (B, x, y, w, h, o) {
        o = o || {};
        const acc = o.accent === undefined ? 0xc0392b : o.accent;
        const frame = o.frame === undefined ? 0x2c2226 : o.frame;
        const sign = o.sign;
        let top = y;
        if (sign) {
            const sw = Math.min(w - 2, PL.textW(sign, 3) + 4);
            const sx = x + Math.floor((w - sw) / 2);
            B.rect(sx, top, sw, 7, o.signBg === undefined ? 0x1c1a22 : o.signBg);
            B.rect(sx, top, sw, 1, light(o.signBg === undefined ? 0x1c1a22 : o.signBg, 0.3));
            B.text(sign, sx + 2, top + 1, o.signCol === undefined ? acc : o.signCol, 3);
            B.etext(sign, sx + 2, top + 1, light(o.signCol === undefined ? acc : o.signCol, 0.25), 3);
            top += 7;
        }
        // Awning: stripes, scalloped hem.
        const aw = w;
        const stripes = o.stripe === undefined ? 0xf2ead8 : o.stripe;
        for (let i = 0; i < aw; i++) {
            const c = Math.floor(i / 2) % 2 === 0 ? acc : stripes;
            B.px(x + i, top, light(c, 0.15));
            B.px(x + i, top + 1, c);
            B.px(x + i, top + 2, shade(c, 0.85));
            if (i % 2 === 0) B.px(x + i, top + 3, shade(c, 0.7));
        }
        top += 3;
        const gh = y + h - top;
        B.rect(x, top, w, gh, frame);
        const inside = o.interior === undefined ? 0xffcf88 : o.interior;
        for (let j = 1; j < gh; j++)
            for (let i = 1; i < w - 1; i++) {
                const X = x + i;
                const Y = top + j;
                if (i % 7 === 0) continue;
                B.px(X, Y, PL.dpick([0x4a5a6a, 0x34404e, 0x2a323e], j / gh, X, Y));
                let c = j === 1 ? light(inside, 0.25) : inside;
                // Shelves / counter / people inside.
                if (o.shelves && j > 1 && j % 3 === 0) c = shade(inside, 0.7);
                if (j === gh - 2 && o.counter !== false) c = shade(inside, 0.62);
                const r = hash(B.seed, X, 4411);
                if (o.goods && j > 1 && j < gh - 2 && r > 0.8)
                    c = [0xe85a5a, 0x5ac8e8, 0xf2d24a, 0x7ad87a][Math.floor(r * 40) % 4];
                B.epx(X, Y, c, 240);
            }
        const dx = x + (o.doorX === undefined ? w - 6 : o.doorX);
        B.rect(dx, top + 1, 4, gh - 1, 0x2a1e1a);
        for (let j = 2; j < gh; j++) (B.epx(dx + 1, top + j, 0xffe0a8), B.epx(dx + 2, top + j, 0xffe0a8));
        B.light(x + w / 2, y + h - 1, mix(inside, 0xffffff, 0.2), Math.max(10, w * 0.35), 'shop');
    };

    // ── Roof props ──────────────────────────────────────────────────────────
    // (x, y) is where the prop stands on the roof (y = roof line).
    K.tank = function (B, x, y) {
        const wood = 0x7a4e32;
        for (let j = 0; j < 7; j++)
            for (let i = 0; i < 6; i++) {
                let c = i === 0 ? light(wood, 0.2) : i === 5 ? dark(wood, 0.3) : wood;
                if (j === 2 || j === 5) c = 0x3a3a44;
                B.px(x + i, y - 11 + j, c);
            }
        B.rect(x - 1, y - 12, 8, 1, 0x5a3a28);
        B.rect(x, y - 13, 6, 1, 0x6a4430);
        B.rect(x + 2, y - 14, 2, 1, 0x6a4430);
        B.rect(x, y - 4, 1, 4, 0x2c2a30);
        B.rect(x + 5, y - 4, 1, 4, 0x2c2a30);
        B.line(x, y - 4, x + 5, y - 1, 0x3a3840);
    };
    K.ac = function (B, x, y, w) {
        w = w || 5;
        B.rect(x, y - 3, w, 3, 0x9aa0a8);
        B.rect(x, y - 3, w, 1, 0xc8ccd2);
        B.rect(x + w - 1, y - 3, 1, 3, 0x6a7078);
        B.px(x + 1, y - 2, 0x4a5058);
        if (w > 3) B.px(x + 2, y - 2, 0x5a6068);
    };
    K.antenna = function (B, x, y, h, beacon) {
        B.rect(x, y - h, 1, h, 0x4a4e58);
        B.px(x - 1, y - Math.floor(h * 0.6), 0x4a4e58);
        B.px(x + 1, y - Math.floor(h * 0.6), 0x4a4e58);
        if (beacon !== false) {
            B.px(x, y - h - 1, 0xff5060);
            B.blink(x, y - h - 1, 0xff4050, 1.4 + B.h01(x, h) * 0.8, B.h01(h, x));
        }
    };
    K.dish = function (B, x, y, r, col) {
        col = col === undefined ? 0xd8dce2 : col;
        r = r || 3;
        for (let j = -r; j <= 0; j++)
            for (let i = -r; i <= r; i++)
                if (i * i + j * j * 2.2 <= r * r) B.px(x + i, y - r + j + 1, j === 0 ? dark(col, 0.2) : col);
        B.px(x, y - r - 1, 0x5a5e68);
        B.rect(x, y - r + 1, 1, r, 0x5a5e68);
    };
    K.plants = function (B, x, y, w) {
        for (let i = 0; i < w; i++) {
            const hh = 1 + Math.floor(B.h01(i + x, 77) * 3);
            for (let j = 0; j < hh; j++) B.px(x + i, y - 1 - j, j === hh - 1 ? 0x5cb85a : 0x3a8a46);
        }
    };
    K.solar = function (B, x, y, w) {
        for (let i = 0; i < w; i += 5) {
            B.line(x + i, y - 1, x + i + 3, y - 3, 0x2a4a8a);
            B.line(x + i + 1, y - 1, x + i + 4, y - 3, 0x3a6ac0);
            B.px(x + i + 1, y, 0x5a5e68);
        }
    };
    K.chimney = function (B, x, y, h, col) {
        col = col === undefined ? 0x8a5a44 : col;
        K.wall(B, x, y - h, 3, h, col, 'brick', { edges: true });
        B.rect(x - 1, y - h - 1, 5, 1, dark(col, 0.2));
        B.smoke.push({ x: x + 1, y: y - h - 2, k: 0.6 });
    };
    K.helipad = function (B, x, y, w) {
        B.rect(x, y - 1, w, 1, 0x4a4e58);
        const cx = x + Math.floor(w / 2);
        B.rect(cx - 2, y - 2, 5, 1, 0x3a3e48);
        B.px(cx - 1, y - 2, 0xf2f2f2);
        B.px(cx + 1, y - 2, 0xf2f2f2);
        B.epx(x, y - 2, 0x7affb0);
        B.epx(x + w - 1, y - 2, 0x7affb0);
        B.blink(x, y - 2, 0x7affb0, 2.2, 0);
        B.blink(x + w - 1, y - 2, 0x7affb0, 2.2, 0.5);
    };

    // Rooftop billboard on legs with spotlights. Returns the board's top y.
    K.billboard = function (B, x, y, w, h, o) {
        o = o || {};
        const bg = o.bg === undefined ? 0x1a1a26 : o.bg;
        const fg = o.fg === undefined ? 0xf2d27a : o.fg;
        const legH = o.legH === undefined ? 3 : o.legH;
        const top = y - legH - h;
        (B.signRects = B.signRects || []).push({ x: x, y: top - 2, w: w, h: h + legH + 2 });
        // Legs and catwalk.
        B.rect(x + 2, y - legH, 1, legH, 0x2a2c34);
        B.rect(x + w - 3, y - legH, 1, legH, 0x2a2c34);
        if (legH > 2) B.line(x + 2, y - 1, x + w - 3, y - legH, 0x33363e);
        // Frame and face.
        B.rect(x, top, w, h, dark(bg, 0.3));
        B.rect(x + 1, top + 1, w - 2, h - 2, bg);
        B.rect(x, top, w, 1, light(bg, 0.35));
        if (o.paint) o.paint(x + 1, top + 1, w - 2, h - 2);
        if (o.text) {
            const lines = Array.isArray(o.text) ? o.text : [o.text];
            const size = o.size || 3;
            const fh = PL.FONTS[size].h;
            const total = lines.length * (fh + 1) - 1;
            let ty = top + Math.floor((h - total) / 2);
            lines.forEach((ln, i) => {
                const col = Array.isArray(fg) ? fg[i % fg.length] : fg;
                const s = PL.fit(ln, w - 4, size);
                const tx = x + Math.floor((w - PL.textW(s, size)) / 2);
                B.text(s, tx, ty, col, size, 1, dark(bg, 0.5));
                if (o.neon !== false) B.etext(s, tx, ty, light(col, 0.3), size);
                ty += fh + 1;
            });
        }
        // Spotlights over the top edge.
        if (o.spots !== false) {
            const n = Math.max(1, Math.floor(w / 12));
            for (let i = 0; i < n; i++) {
                const sx = x + Math.round(((i + 0.5) * w) / n);
                B.rect(sx - 1, top - 2, 2, 1, 0x2a2c34);
                B.px(sx, top - 1, 0x3a3c44);
                B.epx(sx - 1, top - 2, 0xfff4d0);
                B.light(sx, top + 1, 0xfff0c8, Math.max(6, Math.round(h * 0.9)), 'spot');
            }
        }
        return top;
    };

    // Vertical blade sign, letters stacked (Tokyo style).
    K.blade = function (B, x, y, text, col, o) {
        o = o || {};
        const s = String(text)
            .toUpperCase()
            .replace(/[^A-Z0-9]/g, '')
            .slice(0, o.max || 6);
        const h = s.length * 6 + 2;
        const bg = o.bg === undefined ? 0x18141e : o.bg;
        (B.signRects = B.signRects || []).push({ x: x - 1, y: y, w: 7, h: h });
        B.rect(x, y, 5, h, dark(bg, 0.3));
        B.rect(x + 1, y + 1, 3, h - 2, bg);
        B.rect(x - 1, y + 2, 1, 1, 0x3a3c44);
        B.rect(x - 1, y + h - 3, 1, 1, 0x3a3c44);
        for (let i = 0; i < s.length; i++) {
            PL.text(B.base, s[i], B.X(x + 1), B.Y(y + 1 + i * 6), col, 3);
            PL.text(B.neon, s[i], B.X(x + 1), B.Y(y + 1 + i * 6), light(col, 0.3), 3);
        }
        B.light(x + 2, y + h / 2, col, Math.max(8, h * 0.6), 'neon');
        return h;
    };

    // Neon outline around a rectangle (emit only, plus a thin daytime tube).
    K.neonBox = function (B, x, y, w, h, col) {
        for (let i = 0; i < w; i++) {
            B.px(x + i, y, shade(col, 0.7));
            B.px(x + i, y + h - 1, shade(col, 0.7));
            B.npx(x + i, y, col);
            B.npx(x + i, y + h - 1, col);
        }
        for (let j = 0; j < h; j++) {
            B.px(x, y + j, shade(col, 0.7));
            B.px(x + w - 1, y + j, shade(col, 0.7));
            B.npx(x, y + j, col);
            B.npx(x + w - 1, y + j, col);
        }
    };

    // Flag on a pole.
    K.flag = function (B, x, y, colors, h) {
        h = h || 12;
        B.rect(x, y - h, 1, h, 0xc8ccd2);
        B.px(x, y - h - 1, 0xf2d27a);
        const rows = colors.length;
        for (let j = 0; j < 5; j++)
            for (let i = 0; i < 8; i++) {
                const wave = Math.round(Math.sin(i * 0.9) * 0.6);
                const c = colors[Math.min(rows - 1, Math.floor((j / 5) * rows))];
                B.px(x + 1 + i, y - h + j + wave, i > 5 ? shade(c, 0.85) : c);
            }
    };

    // Lab emblem, 7×7. Abstract marks — enough to tell labs apart at a glance.
    K.emblem = function (B, lab, cx, cy, col, glow) {
        const P = (x, y, c) => {
            B.px(cx + x, cy + y, c);
            if (glow) B.npx(cx + x, cy + y, light(c, 0.3));
        };
        const W = 0xffffff;
        switch (lab) {
            case 'openai':
                [
                    [-1, -3],
                    [0, -3],
                    [1, -3],
                    [2, -2],
                    [3, -1],
                    [3, 0],
                    [3, 1],
                    [2, 2],
                    [1, 3],
                    [0, 3],
                    [-1, 3],
                    [-2, 2],
                    [-3, 1],
                    [-3, 0],
                    [-3, -1],
                    [-2, -2],
                    [0, -1],
                    [-1, 0],
                    [1, 0],
                    [0, 1],
                ].forEach((p) => P(p[0], p[1], W));
                break;
            case 'anthropic':
                [
                    [0, -3],
                    [0, -2],
                    [0, 2],
                    [0, 3],
                    [-3, 0],
                    [-2, 0],
                    [2, 0],
                    [3, 0],
                    [-2, -2],
                    [2, -2],
                    [-2, 2],
                    [2, 2],
                    [0, 0],
                    [-1, -1],
                    [1, 1],
                    [1, -1],
                    [-1, 1],
                ].forEach((p) => P(p[0], p[1], 0xf0d8c0));
                break;
            case 'google':
                (P(-2, -1, 0x4285f4), P(-1, -1, 0x4285f4), P(1, -1, 0xea4335), P(2, -1, 0xea4335));
                (P(-2, 1, 0xfbbc05), P(-1, 1, 0xfbbc05), P(1, 1, 0x34a853), P(2, 1, 0x34a853));
                break;
            case 'meta':
                [
                    [-3, 0],
                    [-2, -1],
                    [-1, 0],
                    [0, 1],
                    [1, 0],
                    [2, -1],
                    [3, 0],
                    [2, 1],
                    [1, 0],
                    [-1, 0],
                    [-2, 1],
                    [0, -1],
                ].forEach((p) => P(p[0], p[1], 0x7ad0ff));
                break;
            case 'xai':
                for (let i = -3; i <= 3; i++) (P(i, i, W), P(i, -i, W));
                break;
            case 'deepseek':
                [
                    [-3, 0],
                    [-2, -1],
                    [-1, -1],
                    [0, -1],
                    [1, -1],
                    [2, 0],
                    [3, -1],
                    [3, 1],
                    [-2, 1],
                    [-1, 1],
                    [0, 1],
                    [1, 1],
                    [-1, 0],
                ].forEach((p) => P(p[0], p[1], 0x6aa8ff));
                break;
            case 'mistral':
                for (let j = -3; j <= 3; j++)
                    for (let i = -3; i <= 3; i++)
                        if ((i + 3) % 3 !== 2 || j % 2 === 0)
                            P(i, j, [0xffd23a, 0xff9a2a, 0xff6a1a, 0xe8401a][Math.floor((j + 3) / 2)]);
                break;
            case 'nvidia':
                [
                    [-3, 0],
                    [-2, -1],
                    [-1, -2],
                    [0, -2],
                    [1, -2],
                    [2, -1],
                    [3, 0],
                    [2, 1],
                    [1, 2],
                    [0, 2],
                    [-1, 1],
                    [0, 0],
                ].forEach((p) => P(p[0], p[1], 0x9ae63a));
                break;
            default: {
                // Initial in a ring, in the lab colour.
                const ring = [
                    [-1, -3],
                    [0, -3],
                    [1, -3],
                    [2, -2],
                    [3, -1],
                    [3, 0],
                    [3, 1],
                    [2, 2],
                    [1, 3],
                    [0, 3],
                    [-1, 3],
                    [-2, 2],
                    [-3, 1],
                    [-3, 0],
                    [-3, -1],
                    [-2, -2],
                ];
                ring.forEach((p) => P(p[0], p[1], col));
                const ch =
                    String(lab || '?')
                        .replace(/[^a-z0-9]/gi, '')
                        .charAt(0)
                        .toUpperCase() || '?';
                const g = PL.FONTS[3].glyph(ch);
                if (g)
                    for (let j = 0; j < 5; j++) for (let i = 0; i < 3; i++) if (g(i, j)) P(i - 1, j - 2, W);
            }
        }
    };

    // ── Architecture helpers ───────────────────────────────────────────────
    K.tree = function (B, x, y, r, pal, o) {
        return PL.S.tree(B.base, B.X(x), B.Y(y), r, (B.seed + x * 7) >>> 0, pal, o);
    };
    K.pine = function (B, x, y, h, pal, snow) {
        PL.S.pine(B.base, B.X(x), B.Y(y), h, (B.seed + x * 11) >>> 0, pal, snow);
    };
    K.door = function (B, x, y, w, h, col, lit) {
        col = col === undefined ? 0x3a2a24 : col;
        B.rect(x - 1, y - 1, w + 2, h + 1, dark(col, 0.4));
        B.rect(x, y, w, h, col);
        B.px(x + w - 2, y + Math.floor(h / 2), 0xe8c060);
        if (lit !== false) {
            B.erect(x, y, w, 1, 0xffe0a0);
            B.light(x + w / 2, y + h, 0xffd9a0, 8, 'door');
        }
    };
    // Row of classical columns between y and y+h.
    K.columns = function (B, x, y, w, h, col, pitch) {
        pitch = pitch || 5;
        const n = Math.max(2, Math.floor((w + 2) / pitch));
        const gap = (w - 2) / (n - 1);
        for (let i = 0; i < n; i++) {
            const cx = Math.round(x + i * gap);
            B.rect(cx - 1, y, 3, 1, light(col, 0.2));
            for (let j = 1; j < h - 1; j++) {
                B.px(cx - 1, y + j, light(col, 0.25));
                B.px(cx, y + j, col);
                B.px(cx + 1, y + j, dark(col, 0.28));
            }
            B.rect(cx - 1, y + h - 1, 3, 1, dark(col, 0.1));
        }
    };
    K.pediment = function (B, x, y, w, col) {
        const h = Math.max(3, Math.round(w / 6));
        for (let j = 0; j < h; j++) {
            const inset = Math.round(((h - j) / h) * (w / 2));
            for (let i = inset; i < w - inset; i++)
                B.px(
                    x + i,
                    y - h + j,
                    j === 0 || i === inset ? light(col, 0.3) : j === h - 1 ? dark(col, 0.25) : col
                );
        }
        return y - h;
    };
    // Dome sitting on (cx, y), radius r.
    K.dome = function (B, cx, y, r, col, o) {
        o = o || {};
        const ry = o.ry || r;
        for (let j = 0; j <= ry; j++)
            for (let i = -r; i <= r; i++) {
                const d = (i * i) / (r * r) + (j * j) / (ry * ry);
                if (d > 1) continue;
                const lit = (-i / r) * 0.6 + (j / ry) * 0.4;
                let c = PL.dpick([dark(col, 0.35), col, light(col, 0.3)], 0.45 + lit * 0.55, cx + i, y - j);
                if (o.ribs && i % 3 === 0 && j < ry - 1) c = dark(c, 0.15);
                B.px(cx + i, y - j, c);
            }
        if (o.lantern !== false) {
            B.rect(cx - 1, y - ry - 2, 3, 2, light(col, 0.2));
            B.px(cx, y - ry - 3, 0xe8c060);
        }
        return y - ry;
    };
    K.pitched = function (B, x, y, w, col, o) {
        o = o || {};
        const h = o.h || Math.max(3, Math.round(w * 0.42));
        const over = o.over === undefined ? 1 : o.over;
        for (let j = 0; j < h; j++) {
            const t = j / h;
            const inset = Math.round((1 - t) * (w / 2 + over)) - over;
            for (let i = inset; i < w - inset; i++) {
                let c = (i + j * 2) % 4 === 0 ? dark(col, 0.18) : col;
                if (j % 2 === 1) c = shade(c, 0.94);
                if (i === inset) c = light(col, 0.3);
                if (i >= w - inset - 1) c = dark(col, 0.3);
                B.px(x + i, y - h + j, c);
            }
        }
        B.rect(x - over, y - 1, w + over * 2, 1, dark(col, 0.35));
        return y - h;
    };
    K.fence = function (B, x, y, w, col, kind) {
        col = col === undefined ? 0x2a2a30 : col;
        if (kind === 'picket') {
            for (let i = 0; i < w; i++) {
                if (i % 2 === 0) (B.rect(x + i, y - 3, 1, 3, col), B.px(x + i, y - 4, light(col, 0.1)));
                B.px(x + i, y - 2, col);
            }
            return;
        }
        B.rect(x, y - 4, w, 1, col);
        for (let i = 0; i < w; i += 2) B.rect(x + i, y - 4, 1, 4, col);
        for (let i = 0; i < w; i += 4) B.px(x + i, y - 5, col);
    };
    K.stack = function (B, x, y, h, col, stripe, smokeK) {
        col = col === undefined ? 0xb8b4ac : col;
        for (let j = 0; j < h; j++) {
            const c =
                stripe !== undefined && stripe !== null && Math.floor(j / 3) % 2 === 0 && j < 12
                    ? stripe
                    : col;
            B.px(x, y - h + j, light(c, 0.2));
            B.px(x + 1, y - h + j, c);
            B.px(x + 2, y - h + j, dark(c, 0.3));
        }
        B.rect(x - 1, y - h, 5, 1, dark(col, 0.3));
        B.blink(x + 1, y - h - 1, 0xff4050, 2.2, B.h01(x, h));
        B.smoke.push({ x: x + 1, y: y - h - 1, k: smokeK === undefined ? 1 : smokeK });
    };
    K.tankCyl = function (B, x, y, w, h, col) {
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                const t = i / (w - 1);
                const c = PL.dpick(
                    [light(col, 0.3), col, dark(col, 0.25), dark(col, 0.45)],
                    t * 0.95 + (j === 0 ? -0.3 : 0),
                    x + i,
                    y - h + j
                );
                B.px(x + i, y - h + j, c);
            }
        B.rect(x, y - h - 1, w, 1, light(col, 0.35));
        B.rect(x + 1, y - h - 2, w - 2, 1, light(col, 0.2));
        for (let j = 3; j < h; j += 4) B.rect(x, y - h + j, w, 1, dark(col, 0.12));
    };
    K.container = function (B, x, y, col) {
        B.rect(x, y - 5, 12, 5, col);
        B.rect(x, y - 5, 12, 1, light(col, 0.3));
        for (let i = 1; i < 12; i += 2) B.rect(x + i, y - 4, 1, 4, dark(col, 0.22));
        B.rect(x + 11, y - 5, 1, 5, dark(col, 0.4));
    };
    // Fire escape zig-zag across `floors` floors starting at y (top).
    K.fireEscape = function (B, x, y, w, floors, fh, col) {
        col = col === undefined ? 0x1e1c22 : col;
        for (let f = 0; f < floors; f++) {
            const py = y + (f + 1) * fh - 1;
            B.rect(x, py, w, 1, col);
            for (let i = 0; i < w; i += 2) B.px(x + i, py - 1, col);
            B.px(x, py - 2, col);
            B.px(x + w - 1, py - 2, col);
            const s0 = f % 2 === 0 ? x + 1 : x + w - 2;
            const s1 = f % 2 === 0 ? x + w - 2 : x + 1;
            if (f < floors - 1) B.line(s0, py, s1, py + fh - 1, col);
        }
    };
    // Warm bulbs on a sagging wire (emit), like the lofi string lights.
    K.stringLights = function (B, x0, y0, x1, y1, sag, cols) {
        sag = sag === undefined ? 3 : sag;
        cols = cols || [0xffd27a, 0xffe8b0, 0xffb85a];
        const n = Math.max(2, Math.round(Math.abs(x1 - x0)));
        for (let i = 0; i <= n; i++) {
            const t = i / n;
            const x = Math.round(x0 + (x1 - x0) * t);
            const y = Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag);
            B.px(x, y, 0x2a2a30);
            if (i % 3 === 1) {
                const c = cols[Math.floor(B.h01(i, x) * cols.length)];
                B.px(x, y + 1, shade(c, 0.8));
                B.epx(x, y + 1, c);
            }
        }
    };
    // Glowing screen with simple content.
    K.screen = function (B, x, y, w, h, kind, col) {
        col = col === undefined ? 0x4ad0ff : col;
        B.rect(x - 1, y - 1, w + 2, h + 2, 0x16161e);
        for (let j = 0; j < h; j++)
            for (let i = 0; i < w; i++) {
                let c = dark(col, 0.72);
                if (kind === 'chart') {
                    const v = Math.round(
                        h - 2 - (Math.sin(i * 0.35 + B.seed) * 0.3 + (i / w) * 0.6 + 0.1) * (h - 3)
                    );
                    if (j === v) c = col;
                    else if (j > v) c = dark(col, 0.55);
                    if (j === h - 1 || i === 0) c = dark(col, 0.35);
                } else if (kind === 'map') {
                    const land = Math.sin(i * 0.4) + Math.sin(j * 0.7 + i * 0.13) > 0.6;
                    c = land ? shade(col, 0.8) : dark(col, 0.7);
                    if (B.h01(i, j) > 0.96) c = 0xffe08a;
                } else if (kind === 'text') {
                    if (j % 2 === 0 && B.h01(i >> 1, j) > 0.3) c = shade(col, 0.9);
                } else if (kind === 'bars') {
                    const hh = Math.round((0.3 + B.h01(i >> 1, 5) * 0.7) * h);
                    if (h - j <= hh && i % 2 === 0) c = [col, 0xffb84a, 0x7aff9a][(i >> 1) % 3];
                }
                B.px(x + i, y + j, c);
                B.npx(x + i, y + j, c, 230);
            }
        B.light(x + w / 2, y + h / 2, col, PL.clamp(Math.round(w * 0.5), 8, 16), 'neon');
    };
    // Flat sign on a facade, text in 3×5.
    K.plaque = function (B, x, y, text, fg, bg, glow) {
        B.named = true;
        bg = bg === undefined ? 0x16141c : bg;
        const s = String(text).toUpperCase();
        const w = PL.textW(s, 3) + 4;
        (B.signRects = B.signRects || []).push({ x: x, y: y, w: w, h: 7 });
        B.rect(x, y, w, 7, bg);
        B.rect(x, y, w, 1, light(bg, 0.3));
        B.rect(x, y + 6, w, 1, dark(bg, 0.4));
        B.text(s, x + 2, y + 1, fg, 3);
        if (glow !== false) B.etext(s, x + 2, y + 1, light(fg, 0.25), 3);
        return w;
    };
    K.plaqueC = function (B, cx, y, text, fg, bg, glow, maxW) {
        const s = maxW ? PL.fit(text, maxW - 4, 3) : String(text);
        const w = PL.textW(s.toUpperCase(), 3) + 4;
        return K.plaque(B, Math.round(cx - w / 2), y, s, fg, bg, glow);
    };
    K.lamp = function (B, x, y, col) {
        col = col === undefined ? 0xffd88a : col;
        B.rect(x, y - 7, 1, 7, 0x2a2a30);
        B.rect(x - 1, y - 9, 3, 2, 0x1e1e24);
        B.erect(x - 1, y - 8, 3, 1, col);
        B.light(x, y - 8, col, 8, 'lamp');
    };

    // Lab colour → a facade palette that stays readable (very dark or neon brand colours
    // get pulled toward a paintable mid-tone).
    K.labPalette = function (colHex) {
        let c = typeof colHex === 'number' ? colHex : hex(colHex || '#64748b');
        const l = PL.lum(c);
        if (l < 0.12) c = 0x3a3c46;
        const accent = l < 0.12 ? 0xe8e8ee : PL.sat(light(c, 0.1), 1.1);
        const wall = PL.mix(PL.sat(c, 0.45), 0x3a3a48, 0.55);
        return { accent: accent, wall: wall, deep: dark(wall, 0.35), pale: PL.mix(c, 0xe8e0d0, 0.7) };
    };
})();
