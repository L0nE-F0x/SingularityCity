/* Pixel art — core helpers (shared with the look-dev page in pixel-lab/).
   Everything here works in "art pixels": 1 art px = ART world px of the live city. */
(function () {
    'use strict';

    const PL = (window.PL = window.PL || {});

    // One art pixel covers this many live-city world pixels. A floor in the live city is
    // 18 world px (6 art px) and a building base sits 24 world px (8 art px) above the road.
    PL.ART = 2;
    // A live floor (18 world px) and the lobby band under the first floor (24 world px), in art px.
    PL.FLOOR = 18 / PL.ART;
    PL.LOBBY = 24 / PL.ART;
    // Painters and halos were first drawn on a 3 px grid; this converts a size from that grid.
    PL.S3 = 3 / PL.ART;

    PL.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
    PL.lerp = (a, b, t) => a + (b - a) * t;
    PL.smooth = (a, b, v) => {
        const x = PL.clamp((v - a) / (b - a), 0, 1);
        return x * x * (3 - 2 * x);
    };
    PL.frac = (v) => v - Math.floor(v);
    PL.TAU = Math.PI * 2;

    // ── Hashing ─────────────────────────────────────────────────────────────
    PL.hash = function (a, b, c) {
        let h = 2166136261 ^ Math.imul(a | 0, 374761393);
        h = Math.imul(h ^ (h >>> 13), 1274126177);
        h ^= Math.imul((b || 0) | 0, 668265263);
        h = Math.imul(h ^ (h >>> 15), 2246822519);
        h ^= Math.imul((c || 0) | 0, 3266489917);
        h = Math.imul(h ^ (h >>> 13), 3266489917);
        h ^= h >>> 16;
        return (h >>> 0) / 4294967296;
    };
    PL.seedOf = function (s) {
        let h = 2166136261;
        s = String(s);
        for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
        return h >>> 0;
    };
    PL.rng = function (seed) {
        let s = seed >>> 0;
        return () => {
            s = (s + 1831565813) >>> 0;
            let t = s;
            t = Math.imul(t ^ (t >>> 15), t | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    };

    // ── Ordered dither ──────────────────────────────────────────────────────
    const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
    PL.bayer = (x, y) => BAYER[((y & 3) << 2) | (x & 3)];
    // Pick from a ramp of colours with a dithered boundary between steps.
    PL.dpick = function (ramp, t, x, y) {
        const f = PL.clamp(t, 0, 1) * (ramp.length - 1);
        let k = Math.floor(f);
        if (f - k > PL.bayer(x, y)) k++;
        return ramp[Math.min(k, ramp.length - 1)];
    };

    // ── Colour (0xRRGGBB ints) ──────────────────────────────────────────────
    PL.hex = (s) => parseInt(String(s).replace('#', ''), 16);
    PL.r = (c) => (c >> 16) & 255;
    PL.g = (c) => (c >> 8) & 255;
    PL.b = (c) => c & 255;
    const cb = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
    PL.rgb = (r, g, b) => (cb(r) << 16) | (cb(g) << 8) | cb(b);
    PL.shade = (c, f) => PL.rgb(PL.r(c) * f, PL.g(c) * f, PL.b(c) * f);
    PL.mix = (a, b, t) =>
        PL.rgb(
            PL.r(a) + (PL.r(b) - PL.r(a)) * t,
            PL.g(a) + (PL.g(b) - PL.g(a)) * t,
            PL.b(a) + (PL.b(b) - PL.b(a)) * t
        );
    PL.add = (c, n) => PL.rgb(PL.r(c) + n, PL.g(c) + n, PL.b(c) + n);
    PL.lum = (c) => (PL.r(c) * 0.299 + PL.g(c) * 0.587 + PL.b(c) * 0.114) / 255;
    // Hue-shifted shading: shadows lean blue/purple, highlights lean warm — the
    // single biggest difference between flat vector colour and painted pixel art.
    PL.dark = (c, f) => PL.mix(PL.shade(c, 1 - f), 0x1a1640, f * 0.35);
    PL.light = (c, f) => PL.mix(c, PL.mix(0xfff2d8, c, 0.35), f);
    PL.sat = function (c, f) {
        const l = PL.lum(c) * 255;
        return PL.rgb(l + (PL.r(c) - l) * f, l + (PL.g(c) - l) * f, l + (PL.b(c) - l) * f);
    };

    // ── Pixel image (ImageData backed, 32-bit writes) ───────────────────────
    class Img {
        constructor(w, h) {
            this.w = Math.max(1, w | 0);
            this.h = Math.max(1, h | 0);
            this.c = document.createElement('canvas');
            this.c.width = this.w;
            this.c.height = this.h;
            this.ctx = this.c.getContext('2d', { willReadFrequently: true });
            this.data = this.ctx.createImageData(this.w, this.h);
            this.u = new Uint32Array(this.data.data.buffer);
        }
        clear() {
            this.u.fill(0);
            return this;
        }
        inside(x, y) {
            return x >= 0 && y >= 0 && x < this.w && y < this.h;
        }
        set(x, y, c, a) {
            x |= 0;
            y |= 0;
            if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
            const al = a === undefined ? 255 : a | 0;
            this.u[y * this.w + x] =
                ((al << 24) | ((c & 255) << 16) | (c & 0xff00) | ((c >> 16) & 255)) >>> 0;
        }
        // Alpha-composite c over what is there (a = 0..1).
        blend(x, y, c, a) {
            x |= 0;
            y |= 0;
            if (x < 0 || y < 0 || x >= this.w || y >= this.h || a <= 0) return;
            if (a >= 1) return this.set(x, y, c);
            const i = y * this.w + x;
            const v = this.u[i];
            const da = (v >>> 24) / 255;
            if (da === 0) return this.set(x, y, c, a * 255);
            const dr = v & 255;
            const dg = (v >> 8) & 255;
            const db = (v >> 16) & 255;
            const oa = a + da * (1 - a);
            const r = (PL.r(c) * a + dr * da * (1 - a)) / oa;
            const g = (PL.g(c) * a + dg * da * (1 - a)) / oa;
            const b = (PL.b(c) * a + db * da * (1 - a)) / oa;
            this.set(x, y, PL.rgb(r, g, b), oa * 255);
        }
        get(x, y) {
            x |= 0;
            y |= 0;
            if (x < 0 || y < 0 || x >= this.w || y >= this.h) return -1;
            const v = this.u[y * this.w + x];
            if (v >>> 24 === 0) return -1;
            return ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
        }
        alpha(x, y) {
            if (!this.inside(x, y)) return 0;
            return this.u[(y | 0) * this.w + (x | 0)] >>> 24;
        }
        rect(x, y, w, h, c, a) {
            x = Math.round(x);
            y = Math.round(y);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.set(x + i, y + j, c, a);
            return this;
        }
        rectA(x, y, w, h, c, a) {
            x = Math.round(x);
            y = Math.round(y);
            for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) this.blend(x + i, y + j, c, a);
            return this;
        }
        hline(x, y, w, c) {
            return this.rect(x, y, w, 1, c);
        }
        vline(x, y, h, c) {
            return this.rect(x, y, 1, h, c);
        }
        // Dithered fill: fn(x, y) → 0..1 picks from the ramp; return < 0 to skip.
        dfill(x0, y0, w, h, ramp, fn) {
            for (let y = 0; y < h; y++)
                for (let x = 0; x < w; x++) {
                    const v = fn(x, y);
                    if (v < 0) continue;
                    this.set(x0 + x, y0 + y, PL.dpick(ramp, v, x0 + x, y0 + y));
                }
            return this;
        }
        // Replace colour only where something is already drawn.
        tintOver(x0, y0, w, h, c, a) {
            for (let y = y0; y < y0 + h; y++)
                for (let x = x0; x < x0 + w; x++) if (this.alpha(x, y) > 0) this.blend(x, y, c, a);
            return this;
        }
        ellipse(cx, cy, rx, ry, c) {
            for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
                for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
                    const dx = (x + 0.5 - cx) / rx;
                    const dy = (y + 0.5 - cy) / ry;
                    if (dx * dx + dy * dy <= 1) this.set(x, y, c);
                }
            return this;
        }
        line(x0, y0, x1, y1, c) {
            x0 = Math.round(x0);
            y0 = Math.round(y0);
            x1 = Math.round(x1);
            y1 = Math.round(y1);
            const dx = Math.abs(x1 - x0);
            const dy = -Math.abs(y1 - y0);
            const sx = x0 < x1 ? 1 : -1;
            const sy = y0 < y1 ? 1 : -1;
            let err = dx + dy;
            for (;;) {
                this.set(x0, y0, c);
                if (x0 === x1 && y0 === y1) break;
                const e2 = 2 * err;
                if (e2 >= dy) {
                    err += dy;
                    x0 += sx;
                }
                if (e2 <= dx) {
                    err += dx;
                    y0 += sy;
                }
            }
            return this;
        }
        // Stamp another Img (alpha-aware, integer placement, optional mirror).
        draw(src, x, y, flip) {
            x = Math.round(x);
            y = Math.round(y);
            for (let j = 0; j < src.h; j++)
                for (let i = 0; i < src.w; i++) {
                    const v = src.u[j * src.w + (flip ? src.w - 1 - i : i)];
                    const a = v >>> 24;
                    if (!a) continue;
                    const c = ((v & 255) << 16) | (v & 0xff00) | ((v >> 16) & 255);
                    if (a === 255) this.set(x + i, y + j, c);
                    else this.blend(x + i, y + j, c, a / 255);
                }
            return this;
        }
        done() {
            this.ctx.putImageData(this.data, 0, 0);
            return this.c;
        }
    }
    PL.Img = Img;

    // Stepped, dithered light halo (additive sprite). Quantised to `levels` so it reads
    // as pixel art rather than a smooth airbrush.
    PL.halo = function (r, col, maxA, pow, levels) {
        pow = pow || 2;
        levels = levels || 5;
        const s = r * 2 + 1;
        const img = new Img(s, s);
        for (let y = 0; y < s; y++)
            for (let x = 0; x < s; x++) {
                const d = Math.hypot(x - r, y - r) / r;
                if (d >= 1) continue;
                const q = Math.floor(Math.pow(1 - d, pow) * levels + PL.bayer(x, y)) / levels;
                if (q <= 0) continue;
                img.set(x, y, col, Math.min(1, q) * maxA * 255);
            }
        return img;
    };
    // Elliptical halo (light pools on pavement, window spill).
    PL.haloE = function (rx, ry, col, maxA, pow, levels) {
        pow = pow || 1.6;
        levels = levels || 4;
        const w = rx * 2 + 1;
        const h = ry * 2 + 1;
        const img = new Img(w, h);
        for (let y = 0; y < h; y++)
            for (let x = 0; x < w; x++) {
                const d = Math.hypot((x - rx) / rx, (y - ry) / ry);
                if (d >= 1) continue;
                const q = Math.floor(Math.pow(1 - d, pow) * levels + PL.bayer(x, y)) / levels;
                if (q <= 0) continue;
                img.set(x, y, col, Math.min(1, q) * maxA * 255);
            }
        return img;
    };
    // Downward cone of light under a lamp head.
    PL.cone = function (w, h, col, maxA) {
        const img = new Img(w, h);
        const cx = (w - 1) / 2;
        for (let y = 0; y < h; y++) {
            const t = y / h;
            const half = 1 + t * (w / 2 - 1);
            for (let x = 0; x < w; x++) {
                const d = Math.abs(x - cx) / half;
                if (d > 1) continue;
                const v = (1 - d * d) * (1 - t * 0.55) * (0.35 + 0.65 * t);
                const q = Math.floor(v * 4 + PL.bayer(x, y)) / 4;
                if (q <= 0) continue;
                img.set(x, y, col, q * maxA * 255);
            }
        }
        return img;
    };

    // ── Pixel fonts ─────────────────────────────────────────────────────────
    // 3×5 for small signage, 5×7 for rooftop names. Drawn from scratch for this lab.
    const F3 = {
        A: '010101111101101',
        B: '110101110101110',
        C: '011100100100011',
        D: '110101101101110',
        E: '111100110100111',
        F: '111100110100100',
        G: '011100101101011',
        H: '101101111101101',
        I: '111010010010111',
        J: '001001001101010',
        K: '101101110101101',
        L: '100100100100111',
        M: '101111111101101',
        N: '110101101101101',
        O: '010101101101010',
        P: '110101110100100',
        Q: '010101101110011',
        R: '110101110101101',
        S: '011100010001110',
        T: '111010010010010',
        U: '101101101101111',
        V: '101101101101010',
        W: '101101111111101',
        X: '101101010101101',
        Y: '101101010010010',
        Z: '111001010100111',
        0: '111101101101111',
        1: '010110010010111',
        2: '111001111100111',
        3: '111001011001111',
        4: '101101111001001',
        5: '111100111001111',
        6: '111100111101111',
        7: '111001010010010',
        8: '111101111101111',
        9: '111101111001111',
        ' ': '000000000000000',
        '-': '000000111000000',
        '.': '000000000000010',
        ':': '000010000010000',
        '!': '010010010000010',
        "'": '010010000000000',
        '&': '010101010101011',
        '/': '001001010100100',
        '?': '111001010000010',
        '+': '000010111010000',
        $: '011110010011110',
        '%': '101001010100101',
        '(': '001010010010001',
        ')': '100010010010100',
        '#': '101111101111101',
        ',': '000000000010100',
        '>': '100010001010100',
        '<': '001010100010001',
        '*': '000101010101000',
        '=': '000111000111000',
    };
    const F5 = {
        A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
        B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
        C: ['01111', '10000', '10000', '10000', '10000', '10000', '01111'],
        D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
        E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
        F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
        G: ['01111', '10000', '10000', '10011', '10001', '10001', '01111'],
        H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
        I: ['11111', '00100', '00100', '00100', '00100', '00100', '11111'],
        J: ['00111', '00001', '00001', '00001', '10001', '10001', '01110'],
        K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
        L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
        M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
        N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
        O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
        P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
        Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
        R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
        S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
        T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
        U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
        V: ['10001', '10001', '10001', '10001', '01010', '01010', '00100'],
        W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
        X: ['10001', '01010', '00100', '00100', '00100', '01010', '10001'],
        Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
        Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
        0: ['01110', '10011', '10101', '10101', '10101', '11001', '01110'],
        1: ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
        2: ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
        3: ['11110', '00001', '00001', '01110', '00001', '00001', '11110'],
        4: ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
        5: ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
        6: ['01110', '10000', '10000', '11110', '10001', '10001', '01110'],
        7: ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
        8: ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
        9: ['01110', '10001', '10001', '01111', '00001', '00001', '01110'],
        ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
        '-': ['00000', '00000', '00000', '11111', '00000', '00000', '00000'],
        '.': ['00000', '00000', '00000', '00000', '00000', '00000', '00100'],
        '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
        "'": ['00100', '00100', '00000', '00000', '00000', '00000', '00000'],
        '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
        '+': ['00000', '00100', '00100', '11111', '00100', '00100', '00000'],
        $: ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
    };
    PL.FONTS = {
        3: { w: 3, h: 5, glyph: (ch) => (F3[ch] ? (x, y) => F3[ch][y * 3 + x] === '1' : null) },
        5: { w: 5, h: 7, glyph: (ch) => (F5[ch] ? (x, y) => F5[ch][y][x] === '1' : null) },
    };
    PL.textW = function (s, size, gap) {
        const f = PL.FONTS[size || 3];
        gap = gap === undefined ? 1 : gap;
        return s.length ? s.length * (f.w + gap) - gap : 0;
    };
    PL.text = function (img, s, x, y, col, size, gap, shadow) {
        const f = PL.FONTS[size || 3];
        gap = gap === undefined ? 1 : gap;
        s = String(s).toUpperCase();
        let cx = Math.round(x);
        for (const ch of s) {
            const g = f.glyph(ch) || f.glyph(' ');
            for (let j = 0; j < f.h; j++)
                for (let i = 0; i < f.w; i++)
                    if (g(i, j)) {
                        if (shadow !== undefined && shadow !== null) img.set(cx + i, y + j + 1, shadow);
                        img.set(cx + i, y + j, col);
                    }
            cx += f.w + gap;
        }
        return cx - x - gap;
    };
    // Shorten a label until it fits.
    PL.fit = function (s, maxW, size) {
        s = String(s).toUpperCase();
        if (PL.textW(s, size) <= maxW) return s;
        const words = s.split(/\s+/);
        if (words.length > 1 && PL.textW(words[0], size) <= maxW) {
            let out = words[0];
            for (let i = 1; i < words.length; i++) {
                const next = out + ' ' + words[i];
                if (PL.textW(next, size) > maxW) break;
                out = next;
            }
            return out;
        }
        while (s.length > 1 && PL.textW(s, size) > maxW) s = s.slice(0, -1);
        return s;
    };

    // Greedy word wrap into lines that fit maxW; a "Name (Place)" label splits at the
    // parenthesis first. Words longer than a line are cut with PL.fit.
    PL.wrap = function (s, maxW, size, maxLines) {
        s = String(s || '')
            .toUpperCase()
            .trim();
        const m = s.match(/^(.*?)\s*\((.*)\)\s*$/);
        const parts = m ? [m[1], m[2]] : [s];
        const lines = [];
        parts.forEach((part) => {
            part.split(/\s+/).forEach((wd) => {
                const last = lines.length ? lines[lines.length - 1] : null;
                if (last !== null && last.part === part && PL.textW(last.t + ' ' + wd, size) <= maxW)
                    last.t += ' ' + wd;
                else lines.push({ t: PL.fit(wd, maxW, size), part: part });
            });
        });
        return lines.slice(0, maxLines || 3).map((l) => l.t);
    };

    // Canvas → nearest-neighbour Pixi texture.
    PL.tex = function (canvasOrImg) {
        const c = canvasOrImg instanceof Img ? canvasOrImg.done() : canvasOrImg;
        const t = PIXI.Texture.from(c, {
            scaleMode: PIXI.SCALE_MODES.NEAREST,
            mipmap: PIXI.MIPMAP_MODES.OFF,
        });
        t.baseTexture.scaleMode = PIXI.SCALE_MODES.NEAREST;
        return t;
    };
})();
