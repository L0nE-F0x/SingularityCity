/* Pixel art — small animals as ready-made frames: birds (flying and perched), bats and
   street pigeons. Each frame is a tiny texture in art pixels; callers show it in a sprite
   scaled by PL.ART and pick the frame per tick, so nothing is redrawn as vector. */
(function () {
    'use strict';
    const PL = window.PL;

    // '#' = body, '+' = highlight / lighter feathers, 'o' = beak or feet, '.' = clear.
    const FRAMES = {
        birdUp: ['#.....#', '.#...#.', '..###..'],
        birdMid: ['.......', '##.#.##', '..###..'],
        birdDown: ['..###..', '.#.#.#.', '#.....#'],
        birdPerch: ['....##o', '.####+.', '##.....', '..o.o..'],
        batUp: ['#.......#', '##.....##', '.###.###.', '...###...'],
        batMid: ['.........', '###...###', '.#######.', '...#.#...'],
        batDown: ['...###...', '.#######.', '##.....##', '#.......#'],
        pigeonWalk: ['...##.', '..#+#o', '####..', '.##+..', '.o.o..'],
        pigeonStep: ['...##.', '..#+#o', '####..', '.##+..', '..oo..'],
        pigeonPeck: ['......', '......', '####..', '.##+#.', '.o.o#o'],
    };
    const COLS = {
        bird: { '#': 0x3a3430, '+': 0x6a625a, o: 0xd4a020 },
        bat: { '#': 0x1c1424, '+': 0x3a2a48, o: 0x8a6a9a },
        pigeon: { '#': 0x6a6e7a, '+': 0x9aa6b8, o: 0xd0703a },
    };
    const cache = {};

    function build(name, palette) {
        const rows = FRAMES[name];
        const img = new PL.Img(rows[0].length, rows.length);
        rows.forEach((row, y) => {
            for (let x = 0; x < row.length; x++) {
                const c = palette[row[x]];
                if (c !== undefined) img.set(x, y, c);
            }
        });
        return PL.tex(img);
    }

    PL.Fauna = {
        tex(name) {
            if (!cache[name]) {
                const kind = name.startsWith('bat') ? 'bat' : name.startsWith('pigeon') ? 'pigeon' : 'bird';
                cache[name] = build(name, COLS[kind]);
            }
            return cache[name];
        },
        // A flapping frame for a wing phase (radians).
        wing(prefix, phase) {
            const s = Math.sin(phase);
            return this.tex(prefix + (s > 0.35 ? 'Up' : s < -0.35 ? 'Down' : 'Mid'));
        },
        // A sprite container whose child is scaled to the art grid; the outer object can be
        // mirrored with scale.x = ±1 like the classic Graphics it replaces.
        sprite(name) {
            const outer = new PIXI.Container();
            const sp = new PIXI.Sprite(this.tex(name));
            sp.anchor.set(0.5, 0.5);
            sp.scale.set(PL.ART);
            outer.addChild(sp);
            outer._px = sp;
            return outer;
        },
    };
})();
