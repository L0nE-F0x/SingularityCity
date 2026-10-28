/* Pixel art — events in the sky, drawn inside the backdrop render texture (art pixels).
   - Meteors: a sporadic trickle on any clear night, plus the real annual showers on their
     real dates (Quadrantids … Geminids), rate scaled by distance from each shower's peak.
   - Rainbow: when rain clears while the sun is up, an arc opposite the sun for a while.
   - Launch plumes: when a pad in the Space Zone lifts off for a real Launch Library launch
     (SpaceEntities state → ignition/liftoff), the whole city sees the rocket climb out of
     the western horizon and its exhaust trail drift and spread. */
(function () {
    'use strict';
    const PL = window.PL;
    const { Img, bayer, mix } = PL;

    // Annual meteor showers (IMO calendar): peak month/day, half-width of activity in days,
    // zenithal hourly rate at peak, and the screen direction meteors travel (dx, dy).
    const SHOWERS = [
        { name: 'Quadrantids', m: 1, d: 3, w: 2, zhr: 110, dir: [-0.55, 0.84] },
        { name: 'Lyrids', m: 4, d: 22, w: 3, zhr: 18, dir: [0.5, 0.86] },
        { name: 'Eta Aquariids', m: 5, d: 6, w: 9, zhr: 50, dir: [-0.7, 0.71] },
        { name: 'Delta Aquariids', m: 7, d: 30, w: 10, zhr: 25, dir: [0.65, 0.76] },
        { name: 'Perseids', m: 8, d: 12, w: 6, zhr: 100, dir: [-0.6, 0.8] },
        { name: 'Draconids', m: 10, d: 8, w: 1.5, zhr: 10, dir: [0.4, 0.92] },
        { name: 'Orionids', m: 10, d: 21, w: 7, zhr: 20, dir: [-0.72, 0.69] },
        { name: 'Taurids', m: 11, d: 5, w: 14, zhr: 6, dir: [-0.85, 0.53] },
        { name: 'Leonids', m: 11, d: 17, w: 4, zhr: 15, dir: [-0.5, 0.87] },
        { name: 'Geminids', m: 12, d: 14, w: 4, zhr: 150, dir: [0.55, 0.84] },
        { name: 'Ursids', m: 12, d: 22, w: 2, zhr: 10, dir: [0.3, 0.95] },
    ];
    const DAY = 86400000;
    function showerNow(date) {
        let best = null;
        let sum = 0;
        const y = date.getFullYear();
        SHOWERS.forEach((s) => {
            // Nearest occurrence of the peak (handles the Quadrantids around New Year).
            let dd = Infinity;
            for (const yy of [y - 1, y, y + 1]) {
                const peak = new Date(yy, s.m - 1, s.d, 4);
                dd = Math.min(dd, Math.abs(date - peak) / DAY);
            }
            const act = s.zhr * Math.exp(-((dd / s.w) ** 2));
            sum += act;
            if (!best || act > best.act) best = { s: s, act: act };
        });
        return { act: sum, top: best && best.act > 1 ? best.s : null };
    }

    // A streak texture: bright head at the right end, tail fading to the left; rotated at
    // build time on the pixel grid (cached per 10° and length bucket).
    const streakCache = {};
    function streakTex(angle, len, fire) {
        const ab = Math.round(angle / 0.1745);
        const key = ab + '|' + len + '|' + (fire ? 1 : 0);
        if (streakCache[key]) return streakCache[key];
        const a = ab * 0.1745;
        const dx = Math.cos(a);
        const dy = Math.sin(a);
        const pad = 3;
        const W = Math.ceil(Math.abs(dx) * len) + pad * 2 + 1;
        const H = Math.ceil(Math.abs(dy) * len) + pad * 2 + 1;
        const img = new Img(W, H);
        // Head sits at the end of the direction vector.
        const hx = dx >= 0 ? W - 1 - pad : pad;
        const hy = dy >= 0 ? H - 1 - pad : pad;
        const head = fire ? 0xd8ffd0 : 0xffffff;
        const tail = fire ? 0x7aff9a : 0xc8d8ff;
        for (let i = 0; i <= len; i++) {
            const t = i / len; // 0 at the head
            const x = Math.round(hx - dx * i);
            const y = Math.round(hy - dy * i);
            const al = Math.pow(1 - t, 1.6);
            if (Math.floor(al * 4 + bayer(x, y)) / 4 <= 0) continue;
            img.set(x, y, mix(tail, head, 1 - t), Math.min(1, al * 1.1) * 255);
        }
        img.set(hx, hy, 0xffffff);
        if (fire) {
            [
                [1, 0],
                [-1, 0],
                [0, 1],
                [0, -1],
            ].forEach(([ox, oy]) => img.set(hx + ox, hy + oy, 0xc8ffc0, 200));
        }
        streakCache[key] = { tex: PL.tex(img), hx: hx, hy: hy };
        return streakCache[key];
    }

    // The upper half of a rainbow arc of radius R (art px): seven dithered bands.
    function rainbowImg(R) {
        const BANDS = [0xff4a5a, 0xff9a3a, 0xffe25a, 0x6ad86a, 0x4ab0ff, 0x6a6aff, 0xb46aff];
        const bw = 2;
        const img = new Img(R * 2 + 1, R + 1);
        for (let y = 0; y <= R; y++)
            for (let x = 0; x <= R * 2; x++) {
                const dx = x - R;
                const dy = R - y;
                const d = Math.hypot(dx, dy);
                const k = Math.floor((R - d) / bw);
                if (k < 0 || k >= BANDS.length) continue;
                // Fade towards the ends of the arc and a soft inner edge.
                const ang = Math.atan2(dy, Math.abs(dx)); // 0 at the horizon, PI/2 at the top
                const ends = PL.clamp(ang / 0.5, 0, 1);
                const a = 0.55 * ends * (k === BANDS.length - 1 ? 0.6 : 1);
                if (Math.floor(a * 4 + bayer(x, y)) / 4 <= 0) continue;
                img.set(x, y, BANDS[k], a * 255);
            }
        return img;
    }

    const FX = (PL.SkyFx = {
        back: null,
        front: null,
        meteors: [],
        rain: { prevWet: false, until: 0, a: 0 },
        rainbow: null,
        plumes: [],
        _rocketState: {},
        _next: 0,

        init(back, front) {
            this.back = back;
            this.front = front;
            this.plumeGfx = new PIXI.Graphics();
            this.plumeLit = new PIXI.Graphics();
            this.plumeLit.blendMode = PIXI.BLEND_MODES.ADD;
            front.addChild(this.plumeGfx, this.plumeLit);
        },

        // Starts a plume (also the hook for testing: PL.SkyFx.launch('Falcon 9')).
        launch(name, padX) {
            this.plumes.push({ t0: performance.now() / 1000, name: name || 'launch', padX: padX });
        },

        _watchLaunches() {
            if (typeof SpaceEntities === 'undefined' || !SpaceEntities.rockets) return;
            for (const id in SpaceEntities.rockets) {
                const r = SpaceEntities.rockets[id];
                const prev = this._rocketState[id];
                const st = r && r.state;
                this._rocketState[id] = st;
                if (prev && prev !== st && (st === 'ignition' || st === 'liftoff') && prev !== 'ignition') {
                    const b = G.bldById && G.bldById[id];
                    this.launch(r.launchData && r.launchData.name, b ? b.x + b.w / 2 : 0);
                }
            }
        },

        _spawnMeteor(v, dir, fire) {
            const ang = Math.atan2(dir[1], dir[0]) + (Math.random() - 0.5) * 0.35;
            const len = fire ? 26 + Math.floor(Math.random() * 14) : 9 + Math.floor(Math.random() * 14);
            const S = streakTex(ang, len, fire);
            const sp = new PIXI.Sprite(S.tex);
            sp.blendMode = PIXI.BLEND_MODES.ADD;
            const top = 8;
            const bottom = Math.max(top + 20, v.horizon - 60);
            sp.mx = 20 + Math.random() * (v.w - 40);
            sp.my = top + Math.random() * (bottom - top) * 0.75;
            sp.vx = Math.cos(ang) * (fire ? 90 : 160 + Math.random() * 120);
            sp.vy = Math.sin(ang) * (fire ? 90 : 160 + Math.random() * 120);
            sp.life = fire ? 1.6 : 0.35 + Math.random() * 0.45;
            sp.age = 0;
            sp.hx = S.hx;
            sp.hy = S.hy;
            this.back.addChild(sp);
            this.meteors.push(sp);
        },

        update(K, t, v) {
            if (!this.back) return;
            this._lastV = v;
            const now = performance.now() / 1000;
            const dt = Math.min(0.1, this._last ? now - this._last : 0.016);
            this._last = now;
            const wx = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            const wxK = typeof Environment !== 'undefined' ? Environment.weatherIntensity || 0 : 0;

            // ── Meteors ──
            const clearSky = wx === 'clear' || (wx === 'partly_cloudy' && wxK < 0.7);
            const dark = PL.clamp((K.night - 0.6) / 0.4, 0, 1) * K.stars;
            if (clearSky && dark > 0.2) {
                if (!this._shower || now - this._showerAt > 600) {
                    this._shower = showerNow(new Date());
                    this._showerAt = now;
                }
                // Sporadics ~1 a minute; a shower adds ZHR/12 a minute (Geminids at peak:
                // one every few seconds). One in thirty is a green fireball.
                const perMin = (1 + this._shower.act / 12) * dark;
                if (!this._next) this._next = now + 60 / perMin;
                if (now >= this._next) {
                    const sh = this._shower.top && Math.random() < 0.8 ? this._shower.top : null;
                    const dir = sh ? sh.dir : [Math.random() < 0.5 ? -0.6 : 0.6, 0.8];
                    this._spawnMeteor(v, dir, Math.random() < 0.033);
                    this._next = now + (60 / perMin) * (0.3 + Math.random() * 1.4);
                }
            } else this._next = 0;
            for (let i = this.meteors.length - 1; i >= 0; i--) {
                const m = this.meteors[i];
                m.age += dt;
                const p = m.age / m.life;
                if (p >= 1) {
                    m.destroy();
                    this.meteors.splice(i, 1);
                    continue;
                }
                m.mx += m.vx * dt;
                m.my += m.vy * dt;
                m.x = Math.round(m.mx - m.hx);
                m.y = Math.round(m.my - m.hy);
                m.alpha = (p < 0.15 ? p / 0.15 : 1 - Math.pow((p - 0.15) / 0.85, 2)) * dark;
            }

            // ── Rainbow after rain on a sunny day ──
            const wet = /rain|drizzle|storm/.test(wx) && wxK > 0.15;
            const R = this.rain;
            if (R.prevWet && !wet && K.sun > 0.4 && K.night < 0.3) R.until = now + 150;
            R.prevWet = wet;
            const want = now < R.until && K.sun > 0.3 ? 1 : 0;
            R.a += (want - R.a) * 0.01;
            if (R.a > 0.01) {
                if (!this.rainbow) {
                    this.rainbow = new PIXI.Sprite(PL.tex(rainbowImg(230)));
                    this.front.addChildAt(this.rainbow, 0);
                }
                const sunX = v.w * (0.08 + PL.clamp(K.sunT, 0, 1) * 0.84);
                const cx = v.w - sunX;
                this.rainbow.visible = true;
                this.rainbow.x = Math.round(cx - 230);
                this.rainbow.y = Math.round(v.horizon - 230 + 60);
                this.rainbow.alpha = R.a * (1 - K.night);
            } else if (this.rainbow) this.rainbow.visible = false;

            // ── Launch plumes ──
            if (G.tick % 15 === 0) this._watchLaunches();
            this._drawPlumes(K, now, v);
        },

        _drawPlumes(K, now, v) {
            const g = this.plumeGfx;
            const lit = this.plumeLit;
            g.clear();
            lit.clear();
            if (!this.plumes.length) return;
            const A = PL.ART;
            const zoom = v.zoom || 1;
            const DUR = 240;
            const twilight = PL.clamp(1 - Math.abs(K.night - 0.6) / 0.35, 0, 1);
            const night = K.night;
            for (let i = this.plumes.length - 1; i >= 0; i--) {
                const P = this.plumes[i];
                const T = now - P.t0;
                if (T > DUR) {
                    this.plumes.splice(i, 1);
                    continue;
                }
                // Pad on screen: the world rocket is visible itself — keep only the high trail.
                const padSX = P.padX ? (P.padX * zoom + G.world.x) / A : -1;
                const onScreen = padSX > 0 && padSX < v.w;
                const baseX = onScreen
                    ? padSX
                    : padSX <= 0
                      ? Math.min(90, v.w * 0.12)
                      : v.w - Math.min(90, v.w * 0.12);
                const climb = Math.min(T, 170);
                const pos = (s) => {
                    const u = s / 170;
                    return {
                        x: baseX + Math.pow(u, 2.2) * 150,
                        y: v.horizon - 6 - Math.pow(u, 0.85) * Math.max(80, v.horizon - 40),
                    };
                };
                // Exhaust puffs laid every second along the path; they age, swell and fade.
                for (let s = 0; s <= climb; s += 1) {
                    const age = T - s;
                    const p = pos(s);
                    if (onScreen && p.y > v.horizon - 120) continue;
                    const fade = PL.clamp(1 - age / (DUR - 20), 0, 1);
                    if (fade <= 0) continue;
                    const r = 2 + age * 0.07 + (s / 170) * 3;
                    const highUp = s / 170;
                    // Day: white smoke. Dusk/dawn: the high plume catches the sun and glows.
                    const base = mix(0xf2f2f6, mix(K.cloud, K.haze, 0.4), PL.clamp(night * 1.2, 0, 0.85));
                    const glowCol = mix(0x9ad8ff, 0xff9ad8, highUp);
                    // Upper-level wind shears the old trail into a lazy S.
                    const drift = age * (0.12 + highUp * 0.25) + Math.sin(s * 0.08) * age * 0.04;
                    g.beginFill(base, 0.62 * fade * (1 - night * 0.45));
                    g.drawCircle(Math.round(p.x + drift), Math.round(p.y), Math.round(r));
                    g.endFill();
                    if (twilight > 0.05 && highUp > 0.3) {
                        lit.beginFill(glowCol, 0.3 * fade * twilight * highUp);
                        lit.drawCircle(Math.round(p.x + drift), Math.round(p.y), Math.round(r + 1));
                        lit.endFill();
                    }
                }
                // The rocket and its flame while it is still climbing.
                if (T < 170) {
                    const p = pos(T);
                    const fl = 0.7 + 0.3 * Math.sin(now * 40);
                    lit.beginFill(0xffb050, 0.55 * fl);
                    lit.drawCircle(Math.round(p.x), Math.round(p.y + 2), 3);
                    lit.endFill();
                    lit.beginFill(0xfff4d0, 0.95);
                    lit.drawRect(Math.round(p.x), Math.round(p.y), 1, 3);
                    lit.endFill();
                    g.beginFill(0xe8eaf0, 1);
                    g.drawRect(Math.round(p.x), Math.round(p.y - 2), 1, 2);
                    g.endFill();
                }
            }
        },

        // Debug/testing: PL.SkyFx.test('rainbow' | 'meteors' | 'launch')
        test(kind) {
            const now = performance.now() / 1000;
            if (kind === 'rainbow') this.rain.until = now + 150;
            if (kind === 'meteors') {
                this._shower = { act: 600, top: SHOWERS[9] };
                this._showerAt = now;
                this._next = now;
                if (this._lastV)
                    for (let i = 0; i < 3; i++) this._spawnMeteor(this._lastV, SHOWERS[9].dir, i === 0);
            }
            if (kind === 'launch') {
                const b = G.bldById && G.bldById.pad_spacex;
                this.launch('test', b ? b.x + b.w / 2 : 0);
            }
        },
        showerNow: showerNow,
    });
    void FX;
})();
