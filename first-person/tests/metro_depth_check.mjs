/**
 * Metro depth test (Node — no renderer).
 *
 * The tunnels run between stations at TUNNEL_Y and are `th` tall measured
 * upward from it, so the ceiling sits at TUNNEL_Y + th. Nothing about that is
 * enforced anywhere in the geometry — widen the bore for a taller carriage,
 * as happened when the ride was rebuilt, and the ceiling crosses y=0. The
 * tunnels then surface and draw black bands across the whole city between every
 * pair of stations, plainly visible from the air.
 *
 * Reading the constants out of the source rather than importing metro.js: that
 * module pulls in three.js and the whole world, and this only needs two numbers.
 */
import assert from 'assert';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../js/metro.js', import.meta.url), 'utf8');

function num(re, label) {
    const m = src.match(re);
    assert.ok(m, `metro.js: could not find ${label} — did the declaration change?`);
    return parseFloat(m[1]);
}

const TUNNEL_Y = num(/const TUNNEL_Y = (-?[\d.]+)/, 'TUNNEL_Y');
const th = num(/const tw = [\d.]+, th = ([\d.]+)/, 'tunnel height (th)');
const tw = num(/const tw = ([\d.]+), th = [\d.]+/, 'tunnel width (tw)');

/* Walls are built `th + 4` tall centred on TUNNEL_Y + th/2, so they reach
   4/2 = 2 units above the ceiling. That is the true high point of the bore. */
const CEILING = TUNNEL_Y + th;
const HIGHEST = CEILING + 2;
const COVER = -HIGHEST;          // how much earth sits over the tunnel

console.log(`tunnel: y ${TUNNEL_Y} … ${HIGHEST} (bore ${tw}x${th}), cover ${COVER}`);

assert.ok(
    HIGHEST < 0,
    `metro tunnel breaches the surface: highest point y=${HIGHEST}. ` +
    `TUNNEL_Y (${TUNNEL_Y}) + th (${th}) + wall overshoot must stay below 0, ` +
    `or the tunnels draw black bands across the city from the air.`
);
console.log('ok: tunnel roof is below ground level');

assert.ok(
    COVER >= 5,
    `only ${COVER} units of cover over the tunnel — too thin to survive the ` +
    `next tweak to the bore. Deepen TUNNEL_Y rather than shrinking the bore.`
);
console.log('ok: at least 5 units of cover over the tunnel roof');

/* The ride cabin has to fit inside the bore it runs through. Its own height is
   declared in the same file. */
const cabinH = num(/const L = [\d.]+, W = [\d.]+, H = ([\d.]+);/, 'cabin height (H)');
assert.ok(
    cabinH < th,
    `ride cabin (${cabinH} tall) does not fit the ${th}-tall tunnel bore`
);
console.log(`ok: cabin ${cabinH} fits inside bore ${th}`);

console.log('metro_depth_check: OK');
