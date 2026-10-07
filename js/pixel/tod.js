/* Pixel art — time of day. dp is the live city's day phase: minutes since midnight / 1440. */
(function () {
    'use strict';
    const PL = window.PL;
    const H = PL.hex;

    // Sky ramps run top → horizon. amb multiplies every lit surface (sprite tint);
    // night drives window light, lamps and glows; far* colour the parallax skylines.
    // Lofi smog-gold days, neon nights. Eight sky stops run top → horizon. `neon` is how
    // strongly signage glows (it never switches fully off: the city is always on); `smog`
    // thickens the horizon haze and the sun's halo.
    const KEYS = [
        {
            dp: 0.0,
            sky: ['#04050f', '#070918', '#0b0d24', '#120f30', '#1c123d', '#2b1648', '#401a52', '#5c1f5a'],
            amb: '#6a6ea8',
            night: 1,
            cloud: '#1a1838',
            rim: '#6a3a80',
            far1: '#1c1736',
            far2: '#120f28',
            haze: '#4a1d58',
            stars: 0.8,
            sun: 0,
            neon: 1,
            smog: 0.55,
        },
        {
            dp: 0.2,
            sky: ['#05060f', '#080a1a', '#0d0e28', '#151134', '#201440', '#30174a', '#461b54', '#62215c'],
            amb: '#6a6ea8',
            night: 1,
            cloud: '#1c1a3a',
            rim: '#6a3a80',
            far1: '#1e1838',
            far2: '#13102a',
            haze: '#4e1e5a',
            stars: 0.75,
            sun: 0,
            neon: 1,
            smog: 0.55,
        },
        {
            dp: 0.255,
            sky: ['#141a3a', '#232650', '#3a3062', '#5a3c70', '#8a4e78', '#c06a78', '#e8906e', '#f8b070'],
            amb: '#a08aa8',
            night: 0.55,
            cloud: '#5a4a7a',
            rim: '#ffa070',
            far1: '#5a4a72',
            far2: '#3c3260',
            haze: '#c07a80',
            stars: 0.2,
            sun: 0.4,
            neon: 0.9,
            smog: 0.7,
        },
        {
            dp: 0.3,
            sky: ['#53708a', '#688494', '#82969a', '#9ea698', '#b8b092', '#d0b88c', '#e0c08c', '#e8c894'],
            amb: '#f2e6d2',
            night: 0.1,
            cloud: '#e0d6c0',
            rim: '#fff0d0',
            far1: '#9a9286',
            far2: '#7e7a78',
            haze: '#dcc8a0',
            stars: 0,
            sun: 1,
            neon: 0.75,
            smog: 0.9,
        },
        {
            dp: 0.5,
            sky: ['#4c7490', '#608698', '#7a989e', '#94a89e', '#aeb29a', '#c6ba96', '#d6c296', '#e0c99c'],
            amb: '#fdf4e6',
            night: 0,
            cloud: '#e8e0cc',
            rim: '#fffaf0',
            far1: '#a09a8c',
            far2: '#88867e',
            haze: '#d6caa8',
            stars: 0,
            sun: 1,
            neon: 0.7,
            smog: 0.8,
        },
        {
            dp: 0.68,
            sky: ['#486c8c', '#5c7c92', '#788e94', '#969a90', '#b4a48a', '#ceac80', '#e0b47a', '#eabc7c'],
            amb: '#fbead2',
            night: 0,
            cloud: '#e8d4b0',
            rim: '#fff4dc',
            far1: '#a0948a',
            far2: '#86807c',
            haze: '#dec090',
            stars: 0,
            sun: 1,
            neon: 0.72,
            smog: 0.9,
        },
        {
            dp: 0.75,
            sky: ['#2e3a64', '#46467a', '#6a527e', '#965e7a', '#c26e6e', '#e48660', '#f6a058', '#ffbc62'],
            amb: '#ffc49a',
            night: 0.2,
            cloud: '#a07a8a',
            rim: '#ffc080',
            far1: '#7a5a78',
            far2: '#5a4466',
            haze: '#f0986a',
            stars: 0,
            sun: 0.85,
            neon: 0.88,
            smog: 1,
        },
        {
            dp: 0.795,
            sky: ['#0e0f2e', '#1a1642', '#2c1a52', '#46205e', '#6a2866', '#963468', '#c44a66', '#e8705e'],
            amb: '#9a7aa4',
            night: 0.65,
            cloud: '#3a2a5a',
            rim: '#f07070',
            far1: '#3a2a5a',
            far2: '#2a1e48',
            haze: '#b03a6e',
            stars: 0.15,
            sun: 0.25,
            neon: 1,
            smog: 0.85,
        },
        {
            dp: 0.84,
            sky: ['#050616', '#0a0a22', '#110f30', '#1a123c', '#281646', '#3c1a50', '#561e58', '#74245e'],
            amb: '#7072ac',
            night: 0.92,
            cloud: '#201c42',
            rim: '#6a3a7e',
            far1: '#221a40',
            far2: '#16122e',
            haze: '#5c2060',
            stars: 0.7,
            sun: 0,
            neon: 1,
            smog: 0.6,
        },
        {
            dp: 0.9,
            sky: ['#04050f', '#070918', '#0b0d24', '#120f30', '#1c123d', '#2b1648', '#401a52', '#5c1f5a'],
            amb: '#6a6ea8',
            night: 1,
            cloud: '#1a1838',
            rim: '#6a3a80',
            far1: '#1c1736',
            far2: '#120f28',
            haze: '#4a1d58',
            stars: 0.8,
            sun: 0,
            neon: 1,
            smog: 0.55,
        },
    ].map((k) => ({
        dp: k.dp,
        sky: k.sky.map(H),
        amb: H(k.amb),
        night: k.night,
        cloud: H(k.cloud),
        rim: H(k.rim),
        far1: H(k.far1),
        far2: H(k.far2),
        haze: H(k.haze),
        stars: k.stars,
        sun: k.sun,
        neon: k.neon,
        smog: k.smog,
    }));

    function lerpKey(a, b, t) {
        return {
            sky: a.sky.map((c, i) => PL.mix(c, b.sky[i], t)),
            amb: PL.mix(a.amb, b.amb, t),
            night: PL.lerp(a.night, b.night, t),
            cloud: PL.mix(a.cloud, b.cloud, t),
            rim: PL.mix(a.rim, b.rim, t),
            far1: PL.mix(a.far1, b.far1, t),
            far2: PL.mix(a.far2, b.far2, t),
            haze: PL.mix(a.haze, b.haze, t),
            stars: PL.lerp(a.stars, b.stars, t),
            sun: PL.lerp(a.sun, b.sun, t),
            neon: PL.lerp(a.neon, b.neon, t),
            smog: PL.lerp(a.smog, b.smog, t),
        };
    }

    // Weather greys the palette and dims the ambient light.
    function overcast(k, amount) {
        if (amount <= 0) return k;
        const grey = (c, f) => PL.mix(c, PL.sat(PL.shade(c, 0.86), 0.25), f);
        return Object.assign({}, k, {
            sky: k.sky.map((c) => grey(c, amount * 0.8)),
            amb: PL.mix(k.amb, PL.shade(PL.sat(k.amb, 0.5), 0.82), amount),
            cloud: grey(k.cloud, amount * 0.5),
            far1: grey(k.far1, amount * 0.6),
            far2: grey(k.far2, amount * 0.6),
            haze: grey(k.haze, amount),
            stars: k.stars * (1 - amount),
            sun: k.sun * (1 - PL.clamp(amount * 1.6, 0, 1)),
            night: Math.min(1, k.night + amount * 0.25 * (1 - k.night)),
        });
    }

    // The classic sky under weather (Environment.update): daytime gradients for each state,
    // snow at any hour. Resampled onto the ramp and blended in by daylight.
    const WX_SKY = {
        drizzle: [0x2f3640, 0x475569, 0x64748b],
        rain: [0x2f3640, 0x475569, 0x64748b],
        thunderstorm: [0x1a1f2a, 0x2d3340, 0x444a55],
        overcast: [0x4a5568, 0x64748b, 0x94a3b8],
        fog: [0x8a9099, 0xa8b1bb, 0xc0c8d0],
        partly_cloudy: [0x355088, 0x6a9abf, 0x93b9d8],
        snow: [0x1a1a2e, 0x2d3748, 0x4a5568],
    };
    // How much each state greys and dims the rest of the palette.
    const WX_GREY = {
        drizzle: 0.35,
        rain: 0.55,
        thunderstorm: 0.85,
        overcast: 0.4,
        fog: 0.6,
        partly_cloudy: 0.08,
        snow: 0.45,
    };
    const WX_ALIAS = { storm: 'thunderstorm' };
    function weatherSky(k, w, dp) {
        const stops = WX_SKY[w];
        if (!stops) return k;
        const day = w === 'snow' ? 1 : Math.min(PL.smooth(0.27, 0.3, dp), 1 - PL.smooth(0.72, 0.75, dp));
        if (day <= 0) return k;
        const n = k.sky.length;
        const sky = k.sky.map((c, i) => {
            const t = n > 1 ? i / (n - 1) : 0;
            const wc =
                t < 0.5 ? PL.mix(stops[0], stops[1], t * 2) : PL.mix(stops[1], stops[2], (t - 0.5) * 2);
            return PL.mix(c, wc, day);
        });
        return Object.assign({}, k, { sky: sky, haze: PL.mix(k.haze, stops[2], day) });
    }

    PL.tod = function (dp, weather) {
        dp = PL.frac(dp);
        let a = KEYS[KEYS.length - 1];
        let b = KEYS[0];
        let t = 0;
        for (let i = 0; i < KEYS.length; i++) {
            const k0 = KEYS[i];
            const k1 = KEYS[(i + 1) % KEYS.length];
            const d1 = k1.dp <= k0.dp ? k1.dp + 1 : k1.dp;
            if (dp >= k0.dp && dp < d1) {
                a = k0;
                b = k1;
                t = (dp - k0.dp) / (d1 - k0.dp);
                break;
            }
        }
        let k = lerpKey(a, b, PL.smooth(0, 1, t));
        const w = WX_ALIAS[weather] || weather;
        const wet = WX_GREY[w] || 0;
        k = overcast(k, wet);
        k = weatherSky(k, w, dp);
        k.dp = dp;
        // The classic schedule (Environment.update): the sun crosses the screen left to
        // right from 06:00 to 19:55 (dp 0.25 → 0.83), the moon from 19:55 to 06:00.
        // Outside 0..1 the body is below the horizon.
        k.sunT = (dp - 0.25) / (0.83 - 0.25);
        k.moonT = (dp > 0.83 ? dp - 0.83 : dp + 0.17) / 0.42;
        k.moonA = PL.clamp(k.night * 1.2 - 0.1, 0, 1) * (1 - wet * 0.8);
        return k;
    };

    PL.clockLabel = function (dp) {
        const m = Math.round(PL.frac(dp) * 1440) % 1440;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    };
})();
