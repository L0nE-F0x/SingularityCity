/* Pixel lab v2 — time of day. dp is the live city's day phase: minutes since midnight / 1440. */
(function () {
    'use strict';
    const PL = window.PL;
    const H = PL.hex;

    // Sky ramps run top → horizon. amb multiplies every lit surface (sprite tint);
    // night drives window light, lamps and glows; far* colour the parallax skylines.
    const KEYS = [
        {
            dp: 0.0,
            sky: ['#070a1f', '#0d1233', '#171a4a', '#27225e', '#3d2a6c', '#5a3474'],
            amb: '#747cb8',
            night: 1,
            cloud: '#232653',
            rim: '#4a4f8e',
            far1: '#262a5a',
            far2: '#1b1d45',
            haze: '#3a2e6e',
            stars: 1,
            sun: 0,
        },
        {
            dp: 0.2,
            sky: ['#080b22', '#101438', '#1c1e52', '#2e2664', '#4a3072', '#6e3a78'],
            amb: '#747cb8',
            night: 1,
            cloud: '#252855',
            rim: '#4d5290',
            far1: '#282c5c',
            far2: '#1c1e46',
            haze: '#40306e',
            stars: 0.9,
            sun: 0,
        },
        {
            dp: 0.255,
            sky: ['#1d2254', '#3a3a78', '#6a4f8e', '#b06a8c', '#e8906e', '#ffc07a'],
            amb: '#a58fb4',
            night: 0.55,
            cloud: '#6a5a8a',
            rim: '#ffb48a',
            far1: '#6a5a8e',
            far2: '#4a3e72',
            haze: '#d88a8a',
            stars: 0.25,
            sun: 0.3,
        },
        {
            dp: 0.3,
            sky: ['#3d6db8', '#5c8ccc', '#86aedc', '#b8cfe0', '#ecd6bc', '#ffd9a8'],
            amb: '#efe4e0',
            night: 0.12,
            cloud: '#c9d2e6',
            rim: '#fff4e0',
            far1: '#8ea6c8',
            far2: '#7088b0',
            haze: '#f0d8c0',
            stars: 0,
            sun: 1,
        },
        {
            dp: 0.5,
            sky: ['#2f6fc4', '#4a88d4', '#6ea4de', '#93bfe6', '#b9d6ea', '#d8e6ec'],
            amb: '#ffffff',
            night: 0,
            cloud: '#e2e8f2',
            rim: '#ffffff',
            far1: '#9db6d4',
            far2: '#7f9cc0',
            haze: '#d6e4ee',
            stars: 0,
            sun: 1,
        },
        {
            dp: 0.68,
            sky: ['#3569b8', '#5486cc', '#7da4d8', '#a9c2dc', '#dccfbe', '#f4d2a4'],
            amb: '#fff6ea',
            night: 0,
            cloud: '#dde2ee',
            rim: '#fff8e8',
            far1: '#9fb2cc',
            far2: '#8096b8',
            haze: '#ecd8bc',
            stars: 0,
            sun: 1,
        },
        {
            dp: 0.75,
            sky: ['#2c4a92', '#4a5aa2', '#8a6aa8', '#d4829a', '#f8a070', '#ffc878'],
            amb: '#ffd2ae',
            night: 0.18,
            cloud: '#9a86b8',
            rim: '#ffd09a',
            far1: '#8a78a8',
            far2: '#6a5a8e',
            haze: '#f0a888',
            stars: 0,
            sun: 0.8,
        },
        {
            dp: 0.795,
            sky: ['#15183f', '#2a2560', '#5a3478', '#a4467e', '#e0646a', '#ff9a64'],
            amb: '#a88aac',
            night: 0.6,
            cloud: '#43386e',
            rim: '#f08a78',
            far1: '#4a3a70',
            far2: '#33285a',
            haze: '#c0587a',
            stars: 0.2,
            sun: 0.25,
        },
        {
            dp: 0.84,
            sky: ['#0a0d2a', '#141846', '#241f5c', '#3e2868', '#6a3374', '#944078'],
            amb: '#7a7cb6',
            night: 0.92,
            cloud: '#2a2a5c',
            rim: '#6a5a96',
            far1: '#2e2c62',
            far2: '#211f4c',
            haze: '#5e3276',
            stars: 0.8,
            sun: 0,
        },
        {
            dp: 0.9,
            sky: ['#070a1f', '#0d1233', '#171a4a', '#27225e', '#3d2a6c', '#5a3474'],
            amb: '#747cb8',
            night: 1,
            cloud: '#232653',
            rim: '#4a4f8e',
            far1: '#262a5a',
            far2: '#1b1d45',
            haze: '#3a2e6e',
            stars: 1,
            sun: 0,
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
        // Sun crosses the sky 06:00 → 18:00, moon 18:00 → 06:00 (screen-space arc, 0..1 across).
        k.sunT = PL.clamp((dp - 0.24) / 0.54, 0, 1);
        const md = dp < 0.5 ? dp + 1 : dp;
        k.moonT = PL.clamp((md - 0.78) / 0.52, 0, 1);
        k.moonA = PL.clamp(k.night * 1.2 - 0.1, 0, 1) * (1 - wet * 0.8);
        return k;
    };

    PL.clockLabel = function (dp) {
        const m = Math.round(PL.frac(dp) * 1440) % 1440;
        return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
    };
})();
