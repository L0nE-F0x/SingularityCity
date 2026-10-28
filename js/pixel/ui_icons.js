/* Pixel art — UI icons. Under the pixel skin (html.px-ui) the toolbar and the reaction bar
   swap their emoji for a 12×12 pixel set in the pixel-ui.css palette: one dark outline, flat
   colour, drawn to a canvas once and used as data URLs (CSP allows data: images). The button
   markup, labels, tooltips and handlers stay as they are; only the leading emoji is replaced,
   and a MutationObserver re-applies the icon when code rewrites a label (🔊 ↔ 🔇, Holomap ↔
   Street View). Icons are shown at a whole number of device pixels per art pixel. Classic
   keeps its emoji. PL.Icons is also what photo mode's control strip draws with. */
(function () {
    'use strict';
    const PL = window.PL;
    if (!PL) return;

    const PAL = {
        k: '#07060f', // outline
        w: '#f5f0ff',
        l: '#c8c2e0',
        g: '#8a84aa',
        d: '#4a4470',
        c: '#4ff0ff',
        C: '#1aa6c4',
        b: '#5b8cff',
        B: '#2a4aa8',
        p: '#ff4fd8',
        P: '#a8268e',
        v: '#a78bfa',
        y: '#ffd84a',
        Y: '#c89a1a',
        o: '#ff9a3c',
        r: '#ff4a5e',
        R: '#a8203a',
        G: '#4ade80',
        D: '#1f8a4c',
        n: '#a0643a',
        N: '#6a3c20',
        s: '#f2c79a',
        e: '#f0d9a0',
        E: '#c8a060',
    };

    const N = 12;
    const CLOUD = ['...kkk.....', '..kwwwkkk..', '.kwwwwwwwk.', 'kwwwwwwwwwk', 'kwlllllllwk', '.kkkkkkkkk.'];
    const DARK_CLOUD = CLOUD.map((r) => r.replace(/w/g, 'g').replace(/l/g, 'd'));

    // 12 rows of 12. '.' is transparent.
    const ART = {
        scan: [
            '....k..k....',
            '.....kk.....',
            '.....kk.....',
            'kkkk.kk.kkkk',
            'kcck.kk.kcck',
            'kCCkkwwkkCCk',
            'kcckkllkkcck',
            'kCCk.kk.kCCk',
            'kkkk.kk.kkkk',
            '.....kk.....',
            '....kddk....',
            '............',
        ],
        holomap: [
            '....kkkk....',
            '..kkbbbbkk..',
            '.kbcGGbbbbk.',
            '.kcGGGGbbbk.',
            'kbbbGGbbbbbk',
            'kbbbbbbGGbbk',
            'kbbbbbGGGGbk',
            'kbbGbbbGGbbk',
            '.kbGGbbbbbk.',
            '.kbbGbbbbbk.',
            '..kkbbbbkk..',
            '....kkkk....',
        ],
        street: [
            '............',
            '....kkkk....',
            '....kgyk....',
            '....kggkkkk.',
            '....kygkggk.',
            'kkkkkggkygk.',
            'kgygkygkggk.',
            'kgggkggkgyk.',
            'kygykygkggk.',
            'kgggkggkygk.',
            'kgygkygkggk.',
            'kkkkkkkkkkk.',
        ],
        fp: [
            '....kkk.....',
            '...kssk.....',
            '...kssk.....',
            '....kk......',
            '...kbbk.....',
            '..kbbbbk....',
            '.ksbbbbsk...',
            '..kbbbbk....',
            '..kBBkBk....',
            '.kBk..kBk...',
            '.kBk...kBk..',
            'kkk.....kkk.',
        ],
        log: [
            '....kkkk....',
            '..kkkllkkk..',
            '.knkkkkkknk.',
            '.knwwwwwwnk.',
            '.knwddddwnk.',
            '.knwwwwwwnk.',
            '.knwddddwnk.',
            '.knwwwwwwnk.',
            '.knwdddwwnk.',
            '.knwwwwwwnk.',
            '.knnnnnnnnk.',
            '.kkkkkkkkkk.',
        ],
        bench: [
            '........kkkk',
            '........kcck',
            '........kcck',
            '....kkkkkcck',
            '....kppkkcck',
            '....kppkkcck',
            'kkkkkppkkcck',
            'kyykkppkkcck',
            'kyykkppkkcck',
            'kyykkppkkcck',
            'kyykkppkkcck',
            'kkkkkkkkkkkk',
        ],
        census: [
            '......kkk...',
            '..kkk.kllk..',
            '.kwwwkklllk.',
            '.kwwwk.kllk.',
            '.kwwwk.kkk..',
            '..kkk.kgggk.',
            '.kcccckgggk.',
            'kcccccckggk.',
            'kcccccckggk.',
            'kcccccckkkk.',
            'kcccccck....',
            'kkkkkkkk....',
        ],
        rocket: [
            '.....kk.....',
            '....kwwk....',
            '....kwwk....',
            '...kwwwwk...',
            '...kwccwk...',
            '...kwccwk...',
            '...kwwwwk...',
            '..krwwwwrk..',
            '.krrwwwwrrk.',
            '.kkrkkkkrkk.',
            '....kyok....',
            '.....oo.....',
        ],
        lineage: [
            '..kk....kk..',
            '..kpkllkck..',
            '...kpkkck...',
            '....kpck....',
            '....kcpk....',
            '...kckkpk...',
            '..kckllkpk..',
            '..kck..kpk..',
            '..kckllkpk..',
            '...kckkpk...',
            '....kcpk....',
            '.....kk.....',
        ],
        news: [
            '............',
            'kkkkkkkkkk..',
            'kwwwwwwwwkk.',
            'kwddddddwkwk',
            'kwwwwwwwwkwk',
            'kwddkwwwwkwk',
            'kwddkdddwkwk',
            'kwddkwwwwkwk',
            'kwwwwdddwkwk',
            'kwddddddwkwk',
            'kwwwwwwwwwwk',
            'kkkkkkkkkkkk',
        ],
        cal: [
            '...k....k...',
            '.kkkkkkkkkk.',
            '.krrrrrrrrk.',
            '.krrrrrrrrk.',
            '.kkkkkkkkkk.',
            '.kwwwwwwwwk.',
            '.kwdwdwdwwk.',
            '.kwwwwwwwwk.',
            '.kwdwdwpwwk.',
            '.kwwwwwwwwk.',
            '.kwdwdwdwwk.',
            '.kkkkkkkkkk.',
        ],
        hardware: [
            '...k.k.k.k..',
            '..kkkkkkkkk.',
            'kkkdddddddkk',
            '..kdGGGGGdk.',
            'kkkdGcccGdkk',
            '..kdGcwcGdk.',
            'kkkdGcccGdkk',
            '..kdGGGGGdk.',
            'kkkdddddddkk',
            '..kkkkkkkkk.',
            '...k.k.k.k..',
            '............',
        ],
        grid: [
            '......kkkkk.',
            '.....kyyyk..',
            '....kyyyk...',
            '...kyyyk....',
            '..kyyyykkkk.',
            '.kkkkyyyyyk.',
            '.....kyyyk..',
            '....kyyyk...',
            '...kyyk.....',
            '..kyyk......',
            '.kyk........',
            '.kk.........',
        ],
        costs: [
            '...kkkkkk...',
            '..kyyyyyyk..',
            '.kyyyYYyyyk.',
            'kyyyYYYYyyyk',
            'kyyYYyyyyyyk',
            'kyyyYYYyyyyk',
            'kyyyyyYYyyyk',
            'kyyyyyyYYyyk',
            'kyyYYYYYyyyk',
            '.kyyyYYyyyk.',
            '..kyyyyyyk..',
            '...kkkkkk...',
        ],
        analyst: [
            '.....kk.....',
            '....kppk....',
            '.....kk.....',
            '.kkkkkkkkkk.',
            '.kllllllllk.',
            'kkddddddddkk',
            'kkdccddccdkk',
            '.kllllllllk.',
            '.kllkkkkllk.',
            '.kllllllllk.',
            '.kkkkkkkkkk.',
            '...kkkkkk...',
        ],
        quests: [
            '.kkkkkkkkkk.',
            'kEeeeeeeeeEk',
            '.kkkkkkkkkk.',
            '..keeeeeek..',
            '..kennneek..',
            '..keeeeeek..',
            '..kenneeek..',
            '..keeeeeek..',
            '..kennnnek..',
            '.kkkkkkkkkk.',
            'kEeeeeeeeeEk',
            '.kkkkkkkkkk.',
        ],
        xray: [
            'kkkk....kkkk',
            'kGGk....kGGk',
            'kGk......kGk',
            'kk........kk',
            '............',
            'GGGGGGGGGGGG',
            '.....kG.....',
            '............',
            'kk........kk',
            'kGk......kGk',
            'kGGk....kGGk',
            'kkkk....kkkk',
        ],
        settings: [
            '....kkkk....',
            '.kk.kllk.kk.',
            'kllkkllkkllk',
            'kllllllllllk',
            '.kllkkkkllk.',
            'kkllk..kllkk',
            'kkllk..kllkk',
            '.kllkkkkllk.',
            'kllllllllllk',
            'kllkkllkkllk',
            '.kk.kllk.kk.',
            '....kkkk....',
        ],
        sound: [
            '............',
            '.....k......',
            '....kk...c..',
            '...kwk.c..c.',
            'kkkwwk..c.c.',
            'kwwwwk..c.c.',
            'kwwwwk..c.c.',
            'kkkwwk..c.c.',
            '...kwk.c..c.',
            '....kk...c..',
            '.....k......',
            '............',
        ],
        mute: [
            '............',
            '.....k......',
            '....kk......',
            '...kwk......',
            'kkkwwk.r..r.',
            'kwwwwk..rr..',
            'kwwwwk..rr..',
            'kkkwwk.r..r.',
            '...kwk......',
            '....kk......',
            '.....k......',
            '............',
        ],
        music: [
            '............',
            '...kkkkkkkkk',
            '...kpppppppk',
            '...kpkkkkkpk',
            '...kpk...kpk',
            '...kpk...kpk',
            '...kpk...kpk',
            '.kkkpk.kkkpk',
            'kppppkkppppk',
            'kppppkkppppk',
            '.kkkk..kkkk.',
            '............',
        ],
        photo: [
            '............',
            '..kkkkkk....',
            'kkkllllkkkkk',
            'kggggggggyyk',
            'kgggkkkkgggk',
            'kggkccbbkggk',
            'kggkcbBbkggk',
            'kggkbBBbkggk',
            'kgggkkkkgggk',
            'kggggggggggk',
            'kkkkkkkkkkkk',
            '............',
        ],
        fire: [
            '.....k......',
            '....kok.....',
            '....kook....',
            '...koook.k..',
            '...kooookok.',
            '..koooyoook.',
            '..kooyyyook.',
            '.kooyyyyyok.',
            '.koyyywyyok.',
            '.koyyyyyyok.',
            '..kooyyook..',
            '...kkkkkk...',
        ],
        eyes: [
            '............',
            '............',
            '.kkkk..kkkk.',
            'kwwwwkkwwwwk',
            'kwwwwkkwwwwk',
            'kwkkwkkwkkwk',
            'kwkkwkkwkkwk',
            'kwwwwkkwwwwk',
            'kwwwwkkwwwwk',
            '.kkkk..kkkk.',
            '............',
            '............',
        ],
        bag: [
            '....kkkk....',
            '.....kk.....',
            '....kyyk....',
            '...kyyyyk...',
            '..kyyYYyyk..',
            '.kyyYyyyyyk.',
            '.kyyyYYyyyk.',
            'kyyyyyyYyyyk',
            'kyyyYYYyyyyk',
            'kyyyyyyyyyyk',
            '.kyyyyyyyyk.',
            '..kkkkkkkk..',
        ],
        mind: [
            '...o.yy.o...',
            '..oyywwyyo..',
            '...oyyyyo...',
            '..kkkkkkkk..',
            '.kssssssssk.',
            '.kskksskksk.',
            '.kssssssssk.',
            '.ksssrrsssk.',
            '.ksssrrsssk.',
            '.kssssssssk.',
            '..kssssssk..',
            '...kkkkkk...',
        ],
        crown: [
            '............',
            '............',
            '.k...kk...k.',
            'kyk.kyyk.kyk',
            'kyykyyyykyyk',
            'kyyyyyyyyyyk',
            'kyyryyyycyyk',
            'kyyyyyyyyyyk',
            'kYYYYYYYYYYk',
            'kkkkkkkkkkkk',
            '............',
            '............',
        ],
        movie: [
            '............',
            '.kkk..kkk...',
            'klllkklllk..',
            'kldlkkldlk..',
            'klllkklllk..',
            '.kkk..kkk...',
            'kkkkkkkkkk.k',
            'kgggggggggkk',
            'kgrgggggggck',
            'kgggggggggkk',
            'kkkkkkkkkk.k',
            '............',
        ],
        wx_clear: [
            '.....yy.....',
            '.y...yy...y.',
            '..y......y..',
            '....kkkk....',
            '...kyyyyk...',
            'yy.kyyyyk.yy',
            'yy.kyyyyk.yy',
            '...kyyyyk...',
            '....kkkk....',
            '..y......y..',
            '.y...yy...y.',
            '.....yy.....',
        ],
        wx_fog: [
            '............',
            '..llllllll..',
            '............',
            'lllllll.lll.',
            '............',
            '.llll.lllll.',
            '............',
            'lllllllll...',
            '............',
            '..lll.llllll',
            '............',
            '............',
        ],
        wx_snow: [
            '.....w......',
            '...w.w.w....',
            '....www.....',
            '.w...w...w..',
            '..w..w..w...',
            'wwwwwcwwwww.',
            '..w..w..w...',
            '.w...w...w..',
            '....www.....',
            '...w.w.w....',
            '.....w......',
            '............',
        ],
        wx_cherry: [
            '....kkk.....',
            '...kpppk....',
            '.kkkpPpkkk..',
            'kpppkpkpppk.',
            'kppPkykPppk.',
            '.kkpyyypkk..',
            '..kpppppk...',
            '.kpppkpppk..',
            '.kppk.kppk..',
            '..kk...kk...',
            '............',
            '............',
        ],
        wx_leaves: [
            '.......kk...',
            '.....kkook..',
            '....kooook..',
            '...kooRook..',
            '..koooRok...',
            '.kooooRk....',
            '.kooRook....',
            'kooRook.....',
            'koRook......',
            'kRkk........',
            'k...........',
            '............',
        ],
        pm_live: [
            '...kkkkkk...',
            '..kwwwwwwk..',
            '.kwwwkwwwwk.',
            'kwwwwkwwwwwk',
            'kwwwwkwwwwwk',
            'kwwwwkkkkwwk',
            'kwwwwwwwwwwk',
            'kwwwwwwwwwwk',
            '.kwwwwwwwwk.',
            '..kwwwwwwk..',
            '...kkkkkk...',
            '............',
        ],
        pm_postcard: [
            'kkkkkkkkkkkk',
            'kppppppppppk',
            'kpbbbbbbyypk',
            'kpbbbbbbyypk',
            'kpbbbGbbbbpk',
            'kpbbGGGbbbpk',
            'kpbGGGGGbGpk',
            'kpGGGGGGGGpk',
            'kppppppppppk',
            'kpwwwwwwwwpk',
            'kppppppppppk',
            'kkkkkkkkkkkk',
        ],
        pm_grid: [
            'llllllllllll',
            'l...l..l...l',
            'l...l..l...l',
            'l...l..l...l',
            'llllllllllll',
            'l...l..l...l',
            'l...l..l...l',
            'llllllllllll',
            'l...l..l...l',
            'l...l..l...l',
            'l...l..l...l',
            'llllllllllll',
        ],
        pm_bubble: [
            '............',
            '............',
            '.kkkkkkkkkk.',
            'kwwwwwwwwwwk',
            'kwddwddwddwk',
            'kwwwwwwwwwwk',
            '.kkwkkkkkkk.',
            '..kwk.......',
            '..kk........',
            '............',
            '............',
            '............',
        ],
        pm_drift: [
            '............',
            '............',
            '............',
            '...k....k...',
            '..kk....kk..',
            '.kckkkkkkck.',
            'kcccccccccck',
            '.kckkkkkkck.',
            '..kk....kk..',
            '...k....k...',
            '............',
            '............',
        ],
        pm_timelapse: [
            '.kkkkkkkkkk.',
            '.kwwwwwwwwk.',
            '..kwyyyywk..',
            '...kyyyyk...',
            '....kyyk....',
            '.....kk.....',
            '.....kk.....',
            '....kwyk....',
            '...kwwyyk...',
            '..kwyyyyyk..',
            '.kyyyyyyyyk.',
            '.kkkkkkkkkk.',
        ],
        pm_rec: [
            '............',
            '....kkkk....',
            '..kkrrrrkk..',
            '.krrwwrrrrk.',
            '.krwrrrrrrk.',
            'krrrrrrrrrrk',
            'krrrrrrrrrrk',
            '.krrrrrrrRk.',
            '.krrrrrrRRk.',
            '..kkRRRRkk..',
            '....kkkk....',
            '............',
        ],
        pm_exit: [
            '............',
            '.kk......kk.',
            'kwwk....kwwk',
            '.kwwk..kwwk.',
            '..kwwkkwwk..',
            '...kwwwwk...',
            '...kwwwwk...',
            '..kwwkkwwk..',
            '.kwwk..kwwk.',
            'kwwk....kwwk',
            '.kk......kk.',
            '............',
        ],
    };
    ART.pm_snap = ART.photo;
    ART.pm_sound = ART.sound;

    // Composites: a cloud over a sun, clouds over rain, a dark cloud over a bolt.
    function blank() {
        return Array.from({ length: N }, () => '.'.repeat(N));
    }
    function stamp(grid, art, dx, dy) {
        const g = grid.map((r) => r.split(''));
        art.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const ch = row[x];
                const gx = x + dx;
                const gy = y + dy;
                if (ch === '.' || gx < 0 || gy < 0 || gx >= N || gy >= N) continue;
                g[gy][gx] = ch;
            }
        });
        return g.map((r) => r.join(''));
    }
    const SUN_S = ['..y...y.', '...kkk..', 'y.kyyyk.', '..kyyyk.', '..kyyyk.', '...kkk..'];
    ART.wx_partly_cloudy = stamp(stamp(blank(), SUN_S, 4, 0), CLOUD, 0, 5);
    ART.wx_overcast = stamp(stamp(blank(), DARK_CLOUD, 1, 1), CLOUD, 0, 5);
    ART.wx_drizzle = stamp(stamp(blank(), CLOUD, 0, 1), ['..c....c..', '..........', '.....c....'], 0, 8);
    ART.wx_rain = stamp(stamp(blank(), CLOUD, 0, 1), ['.c..c..c..', 'c..c..c...', '..c..c..c.'], 0, 8);
    ART.wx_thunderstorm = stamp(
        stamp(blank(), DARK_CLOUD, 0, 0),
        ['...kyk', '..kyk.', '.kyyyk', '...yk.', '..yk..', '..k...'],
        3,
        6
    );

    const urls = {};
    let warned = false;
    function draw(key) {
        const rows = ART[key];
        const c = document.createElement('canvas');
        c.width = N;
        c.height = N;
        const x = c.getContext('2d');
        rows.forEach((row, y) => {
            if (row.length !== N && !warned) {
                warned = true;
                console.warn('[PL.Icons] ' + key + ' row ' + y + ' is ' + row.length + ' wide');
            }
            for (let i = 0; i < row.length && i < N; i++) {
                const ch = row[i];
                if (ch === '.' || !PAL[ch]) continue;
                x.fillStyle = PAL[ch];
                x.fillRect(i, y, 1, 1);
            }
        });
        return c.toDataURL('image/png');
    }

    const Icons = (PL.Icons = {
        keys() {
            return Object.keys(ART);
        },
        has(k) {
            return !!ART[k];
        },
        url(k) {
            if (!ART[k]) return null;
            return urls[k] || (urls[k] = draw(k));
        },
        html(k, cls) {
            const u = this.url(k);
            return u ? `<img class="pxi ${cls || ''}" src="${u}" alt="" draggable="false">` : '';
        },
        el(k, cls) {
            const u = this.url(k);
            if (!u) return null;
            const img = document.createElement('img');
            img.className = 'pxi' + (cls ? ' ' + cls : '');
            img.src = u;
            img.alt = '';
            img.draggable = false;
            return img;
        },
    });

    /* ─── Toolbar and reaction bar ─── */
    const BAR = [
        ['🛰️', 'scan'],
        ['🌍', 'holomap'],
        ['🏙️', 'street'],
        ['🚶', 'fp'],
        ['📋', 'log'],
        ['📊', 'bench'],
        ['👥', 'census'],
        ['🚀', 'rocket'],
        ['🧬', 'lineage'],
        ['📰', 'news'],
        ['📅', 'cal'],
        ['🏭', 'hardware'],
        ['⚡', 'grid'],
        ['💰', 'costs'],
        ['🤖', 'analyst'],
        ['📜', 'quests'],
        ['🔬', 'xray'],
        ['⚙️', 'settings'],
        ['🔊', 'sound'],
        ['🔇', 'mute'],
        ['🎵', 'music'],
        ['📷', 'photo'],
    ];
    const REACT = [
        ['🔥', 'fire'],
        ['🚀', 'rocket'],
        ['👀', 'eyes'],
        ['💰', 'bag'],
        ['🤯', 'mind'],
        ['👑', 'crown'],
        ['🎥', 'movie'],
        ['📽', 'movie'], // the Daily Briefing button
    ];
    const NAMES = { sound: 'Sound', mute: 'Sound off', music: 'Music', settings: 'Settings' };
    const norm = (s) => String(s || '').replace(/️/g, '');

    function decorate(btn, map) {
        if (!btn || btn.nodeType !== 1) return;
        const text = btn.textContent;
        if (btn._pxiText === text && btn.querySelector('.pxi')) return;
        const t = norm(text).trim();
        for (const [emo, key] of map) {
            const e = norm(emo);
            if (!t.startsWith(e)) continue;
            const label = t.slice(e.length).trim();
            btn.textContent = '';
            btn.appendChild(Icons.el(key));
            if (label) btn.appendChild(document.createTextNode(label));
            else if (!btn.getAttribute('aria-label'))
                btn.setAttribute('aria-label', btn.title || NAMES[key] || key);
            btn.dataset.pxi = key;
            btn._pxiText = btn.textContent;
            return;
        }
    }

    function sweep() {
        size(); // the UI-size preference can change the toolbar's font size
        const bar = document.getElementById('ctrlBar');
        if (bar) bar.querySelectorAll('button').forEach((b) => decorate(b, BAR));
        const rx = document.getElementById('mpReactions');
        if (rx) rx.querySelectorAll('button').forEach((b) => decorate(b, REACT));
    }

    // One art pixel = a whole number of device pixels, close to the size the emoji had.
    function size() {
        const root = document.documentElement;
        const dpr = window.devicePixelRatio || 1;
        const fit = (target) => (Math.max(1, Math.round((target * dpr) / N)) * N) / dpr;
        const b = document.querySelector('#ctrlBar .btn');
        const fs = (b && parseFloat(getComputedStyle(b).fontSize)) || 10;
        const small = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
        root.style.setProperty('--pxi-tb', fit(fs * 1.25) + 'px');
        root.style.setProperty('--pxi-rx', fit(small ? 18 : 22) + 'px');
    }

    function start() {
        if (!document.documentElement.classList.contains('px-ui')) return; // classic keeps emoji
        sweep();
        let queued = false;
        const later = () => {
            if (queued) return;
            queued = true;
            requestAnimationFrame(() => {
                queued = false;
                sweep();
            });
        };
        const watch = (el, sub) => {
            if (!el || el._pxiWatched) return;
            el._pxiWatched = true;
            new MutationObserver(later).observe(el, { childList: true, subtree: sub, characterData: sub });
        };
        watch(document.getElementById('ctrlBar'), true);
        // The reaction bar is built when multiplayer starts; catch it arriving in #gameWrap.
        const wrap = document.getElementById('gameWrap');
        if (wrap)
            new MutationObserver(() => {
                const rx = document.getElementById('mpReactions');
                if (rx) {
                    watch(rx, true);
                    later();
                }
            }).observe(wrap, { childList: true });
        watch(document.getElementById('mpReactions'), true);
        window.addEventListener('resize', () => {
            size();
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
