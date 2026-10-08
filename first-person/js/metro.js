/* ──────────────────────────────────────────────────────────────────────────
   METRO — the underground network, its rolling stock, and the ride.

   What it was: every line was a two-stop shuttle on ONE track, so the two
   trains of a line met head-on and drove through each other; the 56-unit car
   was modelled along X and then turned so its NOSE pointed along Z, so every
   train in the city ran broadside down its tunnel; and the ride put you in a
   separate 168×44 "cabin" that shared nothing with the 56×18 car the network
   drew, turned the same wrong way — you rode sideways, looking at a bench,
   while the other trains of the station clipped through the walls.

   What it is now:
     • Lines are routed, not drawn as straight chords: each station is a
       straight platform run on a street axis, and stations are joined by
       smooth curves (cubic Béziers whose ends match the platform axis), so a
       ride swings through real bends. Lines on different axes run on
       different levels, so the Compute Line passes under the Harbour Line at
       Central instead of through it.
     • Twin track. Each tunnel carries two roads; a train runs on the right-
       hand road for its direction and crosses over at the termini, so trains
       of one line pass each other on opposite roads — never through each
       other.
     • Three-car sets that accelerate, cruise and brake into the platform.
     • The ride is IN the car. One car model is both the exterior everyone
       sees and the saloon you stand in, so what you see out of the window
       (the other road, a passing set, the station walls) is the same world.
     • Everything down here is baked-lit MeshBasic: light pools under each
       tunnel lamp are painted into the vertex colours, so the lighting
       streams past the windows without a single real light, and nothing on
       the surface (sun, weather) can bleed into the tunnels.
   ────────────────────────────────────────────────────────────────────────── */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { TRAM_LINES } from './data.js';
import { City } from './city.js';

/* Track level of the upper network. The whole bore (and the station halls,
   which are taller) must stay below y=0 or the tunnels surface as black bands
   across the city from the air — tests/metro_depth_check.mjs asserts it. */
const TUNNEL_Y = -72;
const LEVEL_DROP = 92;        // the second level runs this much deeper
const HALL_H = 64;            // station hall: track bed → ceiling
const RAIL_TOP = 10;          // car floor (and platform top) above the track bed

/* Bore of a twin-track tunnel. Two roads at ±TRACK, each carrying a 34-wide
   car: 14 units between passing sets, 15 to each wall. */
const tw = 112, th = 54;
const TRACK = 24;
const PLAT_IN = 42, PLAT_OUT = 92;   // platform edge / back wall, from the centreline

// Rolling stock
const CAR_L = 150, CAR_W = 34, CAR_H = 34;
const CAR_GAP = 6, CARS = 3;
const PITCH = CAR_L + CAR_GAP;
const TRAIN_HALF = (CARS * CAR_L + (CARS - 1) * CAR_GAP) / 2;
const STATION_HALF = 270;            // platform run either side of the station centre
const END_STUB = 240;                // dead-end tunnel past each terminus

const VMAX = 210, ACC = 62, DECEL = 58;
const CROSS_LEN = 300;               // a terminus crossover, in travel distance
const DWELL_SHORT = 6.0;
const DWELL_LONG = 9.0;              // a set the player is on, or waiting for
const DWELL_NEAR = 7.0;

const CABIN_EYE = 17;                // = EYE_H, standing in the aisle
const DS = 4;                        // path resampling step
const LAMP_DS = 48;                  // tunnel lamp spacing

const RIDE_FOG = 0x0b1220;
const RIDE_BG = 0x04060b;

const STATION_TILES = [0xd9e1e8, 0xe8dcc8, 0xcfe3dc, 0xe6d3dc, 0xd6dbe9, 0xe9e2c9, 0xd2e4e9];

// ── geometry helpers ─────────────────────────────────────────────────────

const _c = new THREE.Color();
const _m4 = new THREE.Matrix4();

/** Baked face shading: tops lit, sides a little darker, undersides dark. */
function faceShade(nx, ny, nz) {
    if (ny > 0.5) return 1.0;
    if (ny < -0.5) return 0.5;
    return 0.76 + 0.08 * nx + 0.04 * nz;
}

/** Colour a geometry in place (world-space after transforms). */
function bake(geo, hex, lightFn = null, flat = false) {
    const pos = geo.attributes.position, nor = geo.attributes.normal;
    const n = pos.count;
    const a = new Float32Array(n * 3);
    _c.set(hex);
    for (let i = 0; i < n; i++) {
        const f = flat ? 1 : faceShade(nor.getX(i), nor.getY(i), nor.getZ(i));
        const L = lightFn ? lightFn(pos.getX(i), pos.getY(i), pos.getZ(i)) : 1;
        a[i * 3] = Math.min(1, _c.r * f * L);
        a[i * 3 + 1] = Math.min(1, _c.g * f * L);
        a[i * 3 + 2] = Math.min(1, _c.b * f * L);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

/** A box in a local frame (u along, v across, y up), placed by `frame`. */
function frameBox(arr, frame, w, h, d, v, y, u, hex, lightFn, flat) {
    const g = new THREE.BoxGeometry(w, h, d);
    g.translate(v, y, u);
    if (frame) g.applyMatrix4(frame);
    arr.push(bake(g, hex, lightFn, flat));
}

/** Frame matrix: local +z → tangent (tx,tz), local +x → (tz,−tx), origin (x,y0,z). */
function frameAt(x, y, z, tx, tz) {
    const th = Math.atan2(tx, tz);
    return new THREE.Matrix4().makeRotationY(th).setPosition(x, y, z);
}

// ── routing ──────────────────────────────────────────────────────────────

function bezierPts(p0, p1, p2, p3, n) {
    const out = [];
    for (let i = 1; i <= n; i++) {
        const t = i / n, u = 1 - t;
        out.push({
            x: u * u * u * p0.x + 3 * u * u * t * p1.x + 3 * u * t * t * p2.x + t * t * t * p3.x,
            z: u * u * u * p0.z + 3 * u * u * t * p1.z + 3 * u * t * t * p2.z + t * t * t * p3.z
        });
    }
    return out;
}

/** Resample a polyline to a uniform DS step with tangents. */
function resample(pts) {
    const cum = [0];
    for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + Math.hypot(pts[i].x - pts[i - 1].x, pts[i].z - pts[i - 1].z));
    const L = cum[cum.length - 1];
    const n = Math.max(2, Math.floor(L / DS) + 1);
    const X = new Float32Array(n), Z = new Float32Array(n);
    let j = 0;
    for (let i = 0; i < n; i++) {
        const s = Math.min(L, i * DS);
        while (j < cum.length - 2 && cum[j + 1] < s) j++;
        const seg = cum[j + 1] - cum[j] || 1;
        const t = (s - cum[j]) / seg;
        X[i] = pts[j].x + (pts[j + 1].x - pts[j].x) * t;
        Z[i] = pts[j].z + (pts[j + 1].z - pts[j].z) * t;
    }
    const TX = new Float32Array(n), TZ = new Float32Array(n);
    for (let i = 0; i < n; i++) {
        const a = Math.max(0, i - 1), b = Math.min(n - 1, i + 1);
        const dx = X[b] - X[a], dz = Z[b] - Z[a];
        const l = Math.hypot(dx, dz) || 1;
        TX[i] = dx / l; TZ[i] = dz / l;
    }
    return { X, Z, TX, TZ, n, length: (n - 1) * DS };
}

/** Position / tangent on a route at arc length s (clamped). */
function sampleAt(path, s, out) {
    const f = Math.max(0, Math.min(path.n - 1.0001, s / DS));
    const i = Math.floor(f), t = f - i;
    out.x = path.X[i] + (path.X[i + 1] - path.X[i]) * t;
    out.z = path.Z[i] + (path.Z[i + 1] - path.Z[i]) * t;
    let tx = path.TX[i] + (path.TX[i + 1] - path.TX[i]) * t;
    let tz = path.TZ[i] + (path.TZ[i + 1] - path.TZ[i]) * t;
    const l = Math.hypot(tx, tz) || 1;
    out.tx = tx / l; out.tz = tz / l;
    return out;
}

/**
 * Lines → routed paths. A station is a straight platform run along its axis
 * (`axes[i]`, else the dominant axis toward its neighbours); consecutive
 * stations are joined by a Bézier that leaves and enters along those axes.
 */
export function buildMetroRoutes(bldAt, lines = TRAM_LINES) {
    return lines.map((line, li) => {
        const ids = line.stops.filter(id => bldAt(id));
        if (ids.length < 2) return null;
        const st = ids.map(id => bldAt(id));
        const tang = st.map((b, i) => {
            const prev = st[Math.max(0, i - 1)], next = st[Math.min(st.length - 1, i + 1)];
            const a = i === 0 ? b : prev, c = i === st.length - 1 ? b : next;
            const dx = c.worldX - a.worldX, dz = c.worldZ - a.worldZ;
            const want = line.axes?.[line.stops.indexOf(ids[i])];
            const ax = want || (Math.abs(dx) >= Math.abs(dz) ? 'x' : 'z');
            return ax === 'x' ? { x: Math.sign(dx) || 1, z: 0 } : { x: 0, z: Math.sign(dz) || 1 };
        });
        const pts = [];
        const s0 = st[0], t0 = tang[0];
        pts.push({ x: s0.worldX - t0.x * (STATION_HALF + END_STUB), z: s0.worldZ - t0.z * (STATION_HALF + END_STUB) });
        for (let i = 0; i < st.length; i++) {
            const b = st[i], t = tang[i];
            const a = { x: b.worldX - t.x * STATION_HALF, z: b.worldZ - t.z * STATION_HALF };
            const e = { x: b.worldX + t.x * STATION_HALF, z: b.worldZ + t.z * STATION_HALF };
            pts.push(a, { x: b.worldX, z: b.worldZ }, e);
            if (i < st.length - 1) {
                const nb = st[i + 1], nt = tang[i + 1];
                const na = { x: nb.worldX - nt.x * STATION_HALF, z: nb.worldZ - nt.z * STATION_HALF };
                const k = Math.hypot(na.x - e.x, na.z - e.z) * 0.42;
                pts.push(...bezierPts(e, { x: e.x + t.x * k, z: e.z + t.z * k },
                    { x: na.x - nt.x * k, z: na.z - nt.z * k }, na, 48));
            }
        }
        const sl = st[st.length - 1], tl = tang[tang.length - 1];
        pts.push({ x: sl.worldX + tl.x * (STATION_HALF + END_STUB), z: sl.worldZ + tl.z * (STATION_HALF + END_STUB) });
        // drop duplicates (the Bézier ends on the next platform start)
        const clean = pts.filter((p, i) => i === 0 || Math.hypot(p.x - pts[i - 1].x, p.z - pts[i - 1].z) > 0.5);
        const path = resample(clean);
        // arc length of each station centre
        const stopS = st.map(b => {
            let best = 0, bd = 1e18;
            for (let i = 0; i < path.n; i++) {
                const d = (path.X[i] - b.worldX) ** 2 + (path.Z[i] - b.worldZ) ** 2;
                if (d < bd) { bd = d; best = i; }
            }
            return best * DS;
        });
        return {
            id: line.id, name: line.name || line.id, color: line.color,
            level: line.level || 0, y0: TUNNEL_Y - (line.level || 0) * LEVEL_DROP,
            stops: ids, stopS, path, length: path.length,
            pts: st.map((b, i) => ({ x: b.worldX, z: b.worldZ, bid: ids[i] })),
            tang, index: li
        };
    }).filter(Boolean);
}

/**
 * Rough seconds until set `t` stands at stop `si` heading `sd` — including the
 * run out to a terminus and back for a set going the other way, or one that
 * has already passed.
 */
export function etaTo(t, r, si, sd) {
    if (t.atStop === r.stops[si] && t.dir === sd) return 0;
    const sT = r.stopS[si], c = t.c;
    const endFor = (dir) => dir > 0 ? r.stopS[r.stops.length - 1] : r.stopS[0];
    let dist, stops;
    const ahead = (sT - c) * t.dir;
    const span = r.stopS[r.stops.length - 1] - r.stopS[0];
    if (t.dir === sd && ahead >= 0) { dist = ahead; stops = 0; }
    else if (t.dir === -sd) { const e = endFor(t.dir); dist = Math.abs(e - c) + Math.abs(sT - e); stops = r.stops.length - 1; }
    else { const e = endFor(t.dir); dist = Math.abs(e - c) + span + Math.abs(sT - endFor(-t.dir)); stops = 2 * (r.stops.length - 1); }
    const legs = Math.max(1, Math.round(dist / 1400));
    return dist / (VMAX * 0.7) + Math.max(0, t.dwellT || 0) + stops * (DWELL_SHORT + 4) * 0.5 + legs * 3;
}

/** A set standing at stop `stopIdx`, about to leave in direction `dir`. */
export function newTrain(routes, routeIdx, stopIdx = 0, dir = 1, dwell = 0) {
    const r = routes[routeIdx];
    const t = {
        routeIdx, c: r.stopS[stopIdx], dir, v: 0, next: stopIdx,
        dwellT: dwell, atStop: dwell > 0 ? r.stops[stopIdx] : null,
        lat: dir * TRACK, x: 0, z: 0, dirX: 1, dirZ: 0, y: r.y0 + RAIL_TOP,
        laps: 0, color: r.color, _longDwell: false
    };
    if (dwell <= 0) t.next = Math.max(0, Math.min(r.stops.length - 1, stopIdx + dir));
    placeTrain(t, r);
    return t;
}

const _s = { x: 0, z: 0, tx: 1, tz: 0 };
function placeTrain(t, r) {
    sampleAt(r.path, t.c, _s);
    t.x = _s.x + _s.tz * t.lat;
    t.z = _s.z - _s.tx * t.lat;
    t.dirX = _s.tx * t.dir;
    t.dirZ = _s.tz * t.dir;
    t.y = r.y0 + RAIL_TOP;
}

/* Block signalling. A set brakes for anything occupying its road ahead: a
   set in front going the same way, or one standing at (or crossing over out
   of) the platform it is heading for. A set that is itself crossing over has
   right of way over an oncoming one, or the two would wait on each other. */
function roomAhead(t, others) {
    if (!others) return Infinity;
    const crossing = Math.abs(t.lat - t.dir * TRACK) > 1;
    let room = Infinity;
    for (const o of others) {
        if (o === t || o.routeIdx !== t.routeIdx) continue;
        if (Math.abs(o.lat - t.lat) > CAR_W + 4) continue;
        const ahead = (o.c - t.c) * t.dir;
        if (ahead <= 0) continue;
        if (o.dir !== t.dir && crossing) continue;
        room = Math.min(room, ahead - 2 * TRAIN_HALF - 70);
    }
    return room;
}

export function stepTrain(t, dt, routes, others = null) {
    const r = routes[t.routeIdx];
    if (!r) return;
    if (t.c === undefined) {
        // a bare {routeIdx} object: start it at the first stop, heading out
        Object.assign(t, newTrain(routes, t.routeIdx, 0, 1, t.dwellT || 0), { dwellT: t.dwellT || 0 });
    }
    if (t.dwellT > 0) {
        t.dwellT -= dt;
        t._sinceArr = (t._sinceArr || 0) + dt;
        // doors open a beat after the stop and close before the set moves
        const want = t._sinceArr > 0.8 && t.dwellT > 1.6 ? 1 : 0;
        t.doorK = (t.doorK || 0) + (want - (t.doorK || 0)) * Math.min(1, dt * 3.5);
        if (t.dwellT <= 0) {
            t.doorK = 0;
            t.dwellT = 0;
            t.atStop = null;
            let n = t.next + t.dir;
            if (n < 0 || n >= r.stops.length) {
                t.dir = -t.dir;
                n = t.next + t.dir;
                if (t.dir > 0) t.laps++;
            }
            t.next = Math.max(0, Math.min(r.stops.length - 1, n));
        }
    } else {
        const target = r.stopS[t.next];
        const dist = (target - t.c) * t.dir;
        const room = roomAhead(t, others);
        const vBrake = Math.sqrt(2 * DECEL * Math.max(0, dist)) + 4;
        const vBlock = room < Infinity ? (room > 0 ? Math.sqrt(2 * DECEL * room) : 0) : Infinity;
        t.v = Math.min(VMAX, t.v + ACC * dt, vBrake, vBlock);
        const step = t.v * dt;
        if (step >= dist) {
            t.c = target;
            t.v = 0;
            t.dwellT = t._longDwell ? DWELL_LONG : DWELL_SHORT;
            t.atStop = r.stops[t.next];
            t._sinceArr = 0;
        } else {
            t.c += t.dir * step;
        }
        // Keep right: drift onto this direction's road (the terminus crossover).
        const want = t.dir * TRACK;
        const d = want - t.lat;
        if (d) t.lat += Math.sign(d) * Math.min(Math.abs(d), step * (2 * TRACK) / CROSS_LEN);
    }
    placeTrain(t, r);
}

// ── rolling stock ────────────────────────────────────────────────────────

/**
 * One car, length along +z, floor at y = 0, bogies below. `cab` puts a driving
 * end at +z. Returns geometry lists for the four instanced meshes: body
 * (baked), glow (lamps, light strips), livery (white × instance colour), glass.
 */
function carParts(cab) {
    const body = [], glow = [], livery = [], glass = [];
    const L = 150, W = 34, H = 34;
    const hl = L / 2, hw = W / 2;
    const B = (w, h, d, x, y, z, hex) => frameBox(body, null, w, h, d, x, y, z, hex);
    const Gl = (w, h, d, x, y, z, hex) => frameBox(glow, null, w, h, d, x, y, z, hex, null, true);
    const Lv = (w, h, d, x, y, z) => frameBox(livery, null, w, h, d, x, y, z, 0xffffff, null, true);
    const pane = (w, h, x, y, z, ry) => {
        const p = new THREE.PlaneGeometry(w, h);
        if (ry) p.rotateY(ry);
        p.translate(x, y, z);
        glass.push(bake(p, 0xffffff, null, true));
    };

    // chassis
    B(W - 6, 7, L - 16, 0, -4.5, 0, 0x1b2230);
    for (const bz of [-50, 50]) {
        B(W - 8, 5, 30, 0, -7.5, bz, 0x101318);
        for (const wz of [-9, 9]) for (const wx of [-12, 12]) B(3, 8, 8, wx, -6, bz + wz, 0x2a2d33);
    }
    B(W, 2, L, 0, -1, 0, 0x2a3446);                 // floor pan
    B(W - 4, 0.4, L - 4, 0, 0.2, 0, 0x46505f);       // floor covering
    B(4, 0.45, L - 8, 0, 0.25, 0, 0x5a6575);         // aisle stripe
    B(W, 3, L, 0, H + 1.5, 0, 0xb9c2cc);             // roof
    B(W - 4, 0.6, L - 4, 0, H - 0.2, 0, 0xe6e9ed);   // ceiling lining
    B(W - 12, 4, 40, 0, H + 5, -20, 0x6b7684);        // roof plant
    B(10, 3, 22, 0, H + 4.5, 30, 0x7d8896);

    // side walls: sections between the doors (z ranges), each with a window
    const DOORS = [-38, 38], DW = 18;
    const sections = [[-hl, -38 - DW / 2], [-38 + DW / 2, 38 - DW / 2], [38 + DW / 2, hl]];
    const SILL = 11, HEAD = 26;
    for (const side of [-1, 1]) {
        const x = side * (hw - 1);
        for (const [z0, z1] of sections) {
            const len = z1 - z0, cz = (z0 + z1) / 2;
            B(2, SILL, len, x, SILL / 2, cz, 0xc8cfd7);                       // lower panel
            B(2, H - HEAD, len, x, HEAD + (H - HEAD) / 2, cz, 0xc8cfd7);      // upper panel
            Lv(0.5, 3, len, x + side * 1.05, 8, cz);                          // livery band
            // window band: one or two glazed openings with pillars
            const nWin = len > 40 ? 2 : 1;
            const pil = 3;
            const ww = (len - pil * (nWin + 1)) / nWin;
            for (let k = 0; k <= nWin; k++) {
                const pz = z0 + pil / 2 + k * (ww + pil);
                B(2, HEAD - SILL, pil, x, (SILL + HEAD) / 2, pz, 0xaeb7c1);
            }
            for (let k = 0; k < nWin; k++) {
                const wz = z0 + pil + ww / 2 + k * (ww + pil);
                pane(ww, HEAD - SILL, x, (SILL + HEAD) / 2, wz, side * Math.PI / 2);
            }
            // interior lining below the sill and above the window
            B(0.6, SILL - 1, len, x - side * 1.3, SILL / 2, cz, 0x8592a3);
            B(0.6, H - HEAD - 1, len, x - side * 1.3, HEAD + (H - HEAD) / 2, cz, 0xe2e6ea);
        }
        // doors: two leaves, a window in each, a dark seal down the middle
        for (const dz of DOORS) {
            // (the leaves themselves are the separate, sliding `doors` mesh)
            B(2.2, 2, DW, x, H - 1, dz, 0x7c8896);                             // door head
            B(2.4, 0.6, DW, x, 0.3, dz, 0x5a6575);                             // threshold
            Gl(0.4, 1.2, DW - 2, x - side * 1.1, H - 1.2, dz, 0xff9f43);        // door chime lamp
        }
        // route map strip above the windows, inside
        Lv(0.3, 2.2, 54, x - side * 1.7, 28.4, 0);
    }

    // ends
    const endWall = (zs) => {
        const z = zs * (hl - 1);
        B(10, H, 2, -12, H / 2, z, 0xc8cfd7);
        B(10, H, 2, 12, H / 2, z, 0xc8cfd7);
        B(14, 6, 2, 0, H - 3, z, 0xc8cfd7);
        // gangway door with a window
        B(14, 12, 1.6, 0, 6, z - zs * 0.6, 0x7c8896);
        B(14, 4, 1.6, 0, 26, z - zs * 0.6, 0x7c8896);
        B(2, 12, 1.6, -6, 18, z - zs * 0.6, 0x7c8896);
        B(2, 12, 1.6, 6, 18, z - zs * 0.6, 0x7c8896);
        pane(10, 12, 0, 18, z - zs * 0.6, 0);
        // bellows to the next car
        B(W - 6, H - 4, 3, 0, H / 2, zs * (hl + 1.5), 0x23272e);
    };
    endWall(-1);
    if (!cab) endWall(1);
    else {
        // driving end: cab bulkhead, a sloped nose with a big windscreen
        B(W, H, 2, 0, H / 2, hl - 14, 0x3a4350);
        B(W - 6, 14, 1.4, 0, 18, hl - 15.6, 0x283039);                         // cab back door
        B(W, 12, 14, 0, 6, hl - 7, 0xc8cfd7);
        B(W - 2, 6, 6, 0, 3, hl + 2, 0x2c333d);                                // anticlimber
        B(W, H - 27, 14, 0, 27 + (H - 27) / 2, hl - 7, 0xc8cfd7);
        for (const side of [-1, 1]) B(2, 15, 14, side * (hw - 1), 19.5, hl - 7, 0xc8cfd7);
        pane(W - 6, 15, 0, 19.5, hl, 0);
        Lv(W + 0.4, 3, 1, 0, 8, hl + 0.2);
        for (const side of [-1, 1]) {
            Gl(5, 2.6, 0.6, side * 11, 6, hl + 0.4, 0xfff6d8);       // headlight
            Gl(2.2, 1.6, 0.6, side * 14, 11, hl + 0.4, 0xff3b3b);    // marker
        }
        Gl(16, 2.4, 0.4, 0, 30.5, hl + 0.3, 0xffb020);                // destination blind
        B(8, 6, 6, -8, 16, hl - 10, 0x1f2630);                         // driver's desk
    }

    // saloon: longitudinal seats in each section, poles, grab rails, lights
    for (const side of [-1, 1]) {
        for (const [z0, z1] of sections) {
            const zA = z0 + 3, zB = Math.min(z1, cab ? hl - 16 : z1) - 3;
            const len = zB - zA, cz = (zA + zB) / 2;
            if (len < 8) continue;
            B(7, 2.5, len, side * (hw - 6), 6.2, cz, 0x3b5a7a);           // cushion
            B(6, 5, len, side * (hw - 6), 2.5, cz, 0x3a4554);              // plinth
            B(1.6, 5.5, len, side * (hw - 2.6), 10.2, cz, 0x34506d);       // back, below the sill
        }
        B(0.9, 0.9, L - 30, side * 8, H - 5, 0, 0xc0c8d0);                // grab rail
    }
    for (const pz of [-38, -12, 12, 38]) B(1.1, H, 1.1, 0, H / 2, pz, 0xc0c8d0);
    for (const sx of [-6, 6]) Gl(3.2, 0.5, L - 16, sx, H - 0.8, 0, 0xfff1d2);
    // a few fellow passengers (robots get a lit visor)
    const RIDERS = [[-4, -58, 1, 0x7c3aed, 0], [10, -26, 0, 0x475569, 1], [-10, 26, 1, 0x0e7490, 1],
        [5, 54, 0, 0xb45309, 0], [-10, 62, 1, 0xc2410c, 1]];
    for (const [rx, rz, bot, hex, seated] of RIDERS) {
        if (cab && rz > hl - 18) continue;
        const sx = seated ? Math.sign(rx) * (hw - 7) : rx;
        const baseY = seated ? 7.5 : 0;
        if (!seated) { B(2.2, 8, 2.2, sx - 1.4, 4, rz, 0x1f2937); B(2.2, 8, 2.2, sx + 1.4, 4, rz, 0x1f2937); }
        else B(5, 2.4, 6, sx - Math.sign(rx) * 2.5, 8.6, rz, 0x1f2937);
        B(5.6, 8.5, 3.6, sx, baseY + (seated ? 5.5 : 12.2), rz, hex);
        B(3.8, 3.8, 3.8, sx, baseY + (seated ? 11.8 : 18.5), rz, bot ? 0xaeb6c2 : 0xe2b48c);
        if (bot) Gl(3.9, 0.9, 3.9, sx, baseY + (seated ? 12.2 : 18.9), rz, 0x67e8f9);
        else B(4, 1.2, 4, sx, baseY + (seated ? 14 : 20.8), rz, 0x2a2118);
    }
    return { body, glow, livery, glass };
}

/* A door leaf, centred: half the doorway wide, with a window. Lives in its own
   instanced mesh so it can slide; DOOR_LEAVES places all eight on a car. */
const DOOR_DW = 18, DOOR_ZS = [-38, 38];
function leafGeo() {
    const arr = [];
    const w = DOOR_DW / 2 - 0.4;
    frameBox(arr, null, 1.4, 12, w, 0, 6, 0, 0x98a3b0);
    frameBox(arr, null, 1.4, CAR_H - 27, w, 0, 27 + (CAR_H - 27) / 2, 0, 0x98a3b0);
    frameBox(arr, null, 1.4, 15, 1.6, 0, 19.5, -w / 2 + 0.8, 0x98a3b0);
    frameBox(arr, null, 1.4, 15, 1.6, 0, 19.5, w / 2 - 0.8, 0x98a3b0);
    frameBox(arr, null, 0.6, 15, w - 3.2, 0, 19.5, 0, 0x3a5168);
    frameBox(arr, null, 1.6, 2.2, w, 0, 8, 0, 0x5d6876);
    return mergeGeometries(arr, false);
}

function stockMeshes(cab, count) {
    const parts = carParts(cab);
    const mats = {
        body: new THREE.MeshBasicMaterial({ vertexColors: true }),
        glow: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
        livery: new THREE.MeshBasicMaterial({ vertexColors: true }),
        glass: new THREE.MeshBasicMaterial({
            color: 0x7fb4d4, transparent: true, opacity: 0.22, depthWrite: false, side: THREE.DoubleSide
        })
    };
    const out = {};
    for (const k of ['body', 'glow', 'livery', 'glass']) {
        const geo = mergeGeometries(parts[k], false);
        const im = new THREE.InstancedMesh(geo, mats[k], Math.max(1, count));
        im.frustumCulled = false;
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        im.count = count;
        im.name = 'metro:' + (cab ? 'cab:' : 'mid:') + k;
        out[k] = im;
    }
    const dm = new THREE.InstancedMesh(leafGeo(), new THREE.MeshBasicMaterial({ vertexColors: true }), Math.max(1, count * 8));
    dm.frustumCulled = false;
    dm.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    dm.count = count * 8;
    dm.name = 'metro:' + (cab ? 'cab:' : 'mid:') + 'doors';
    out.doors = dm;
    return out;
}

// ── tunnels and stations ─────────────────────────────────────────────────

/** Light pool under every LAMP_DS tunnel lamp, as a function of arc length. */
function tunnelLight(s, yRel) {
    const d = ((s % LAMP_DS) + LAMP_DS) % LAMP_DS - LAMP_DS / 2;
    const pool = Math.exp(-(d * d) / (2 * 10 * 10));
    const high = Math.max(0, Math.min(1, (yRel - 4) / 40));
    return 0.38 + pool * (0.55 + 0.45 * high);
}

/** A strip between two cross-section points (v, y) swept along s0..s1. */
function ribbon(arr, r, s0, s1, a, b, hex, shade, lightFn = tunnelLight, step = 6) {
    const n = Math.max(1, Math.ceil((s1 - s0) / step));
    const pos = new Float32Array((n + 1) * 2 * 3);
    const col = new Float32Array((n + 1) * 2 * 3);
    const idx = [];
    _c.set(hex);
    for (let i = 0; i <= n; i++) {
        const s = s0 + (s1 - s0) * (i / n);
        sampleAt(r.path, s, _s);
        const nx = _s.tz, nz = -_s.tx;
        const pts = [a, b];
        for (let e = 0; e < 2; e++) {
            const p = pts[e];
            const k = (i * 2 + e) * 3;
            pos[k] = _s.x + nx * p.v;
            pos[k + 1] = r.y0 + p.y;
            pos[k + 2] = _s.z + nz * p.v;
            const L = lightFn ? lightFn(s, p.y) : 1;
            col[k] = Math.min(1, _c.r * shade * L);
            col[k + 1] = Math.min(1, _c.g * shade * L);
            col[k + 2] = Math.min(1, _c.b * shade * L);
        }
        if (i < n) {
            const q = i * 2;
            idx.push(q, q + 1, q + 2, q + 1, q + 3, q + 2);
        }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array((n + 1) * 2 * 2), 2));
    arr.push(g);
}

/** Tunnel bore + both roads along [s0, s1] of a route. */
function buildTunnelRun(parts, glow, r, s0, s1) {
    if (s1 - s0 < 1) return;
    const R = (a, b, hex, shade) => ribbon(parts, r, s0, s1, a, b, hex, shade);
    const hw = tw / 2;
    R({ v: -hw, y: 0 }, { v: hw, y: 0 }, 0x2a2e35, 0.9);                        // invert
    for (const sd of [-1, 1]) {
        R({ v: sd * hw, y: 0 }, { v: sd * hw, y: 42 }, 0x56606e, 0.82);         // wall
        R({ v: sd * hw, y: 42 }, { v: sd * (hw - 16), y: th }, 0x4a5360, 0.7);  // haunch
        R({ v: sd * (hw - 0.4), y: 17 }, { v: sd * (hw - 0.4), y: 20 }, r.color, 0.85); // line band
        R({ v: sd * hw, y: 8 }, { v: sd * (hw - 8), y: 8 }, 0x3f4754, 0.95);   // walkway ledge
        R({ v: sd * (hw - 8), y: 8 }, { v: sd * (hw - 8), y: 0 }, 0x343b46, 0.75);
        R({ v: sd * (hw - 1), y: 33 }, { v: sd * (hw - 5), y: 33 }, 0x3a414c, 0.8); // cable tray
        R({ v: sd * (hw - 1), y: 29 }, { v: sd * (hw - 3), y: 29 }, 0x2c2f35, 0.8);
    }
    R({ v: -(hw - 16), y: th }, { v: hw - 16, y: th }, 0x343a44, 0.6);          // crown
    // the lamps the pools hang from, on both walls
    const first = Math.ceil((s0 - LAMP_DS / 2) / LAMP_DS) * LAMP_DS + LAMP_DS / 2;
    for (let s = first; s < s1; s += LAMP_DS) {
        sampleAt(r.path, s, _s);
        for (const sd of [-1, 1]) {
            const f = frameAt(_s.x, r.y0, _s.z, _s.tx, _s.tz);
            frameBox(glow, f, 1.4, 2.2, 9, sd * (hw - 2), 40, 0, 0xffe7b0, null, true);
        }
        // a pillar between the roads every lamp — the strobe of a passing set
        const f = frameAt(_s.x, r.y0, _s.z, _s.tx, _s.tz);
        frameBox(parts, f, 5, th, 5, 0, th / 2, 0, 0x4e5764, (x, y) => tunnelLight(s, y - r.y0));
        if (Math.round(s / LAMP_DS) % 5 === 0) {
            frameBox(glow, f, 0.6, 3, 7, (Math.round(s / LAMP_DS) % 2 ? 1 : -1) * (hw - 0.8), 24, 0, 0x22c55e, null, true);
        }
    }
}

/** Rails, sleepers and conductor rails along the whole route. */
function buildTrack(parts, glow, r) {
    const s0 = 0, s1 = r.length;
    for (const tv of [-TRACK, TRACK]) {
        ribbon(parts, r, s0, s1, { v: tv - 13, y: 0.4 }, { v: tv + 13, y: 0.4 }, 0x34363b, 0.95, tunnelLight, 12);
        for (const rv of [-7, 7]) {
            ribbon(parts, r, s0, s1, { v: tv + rv - 0.8, y: 2.2 }, { v: tv + rv + 0.8, y: 2.2 }, 0xb6bec8, 1, tunnelLight, 12);
            ribbon(parts, r, s0, s1, { v: tv + rv - 0.8, y: 2.2 }, { v: tv + rv - 0.8, y: 0.5 }, 0x6b625a, 0.8, tunnelLight, 12);
        }
        const cv = tv + Math.sign(tv) * 13;
        ribbon(parts, r, s0, s1, { v: cv - 0.9, y: 2.6 }, { v: cv + 0.9, y: 2.6 }, 0x9a7a3c, 0.9, tunnelLight, 12);
    }
    for (let s = 6; s < s1; s += 11) {
        sampleAt(r.path, s, _s);
        const f = frameAt(_s.x, r.y0, _s.z, _s.tx, _s.tz);
        for (const tv of [-TRACK, TRACK]) frameBox(parts, f, 19, 1, 3, tv, 0.9, 0, 0x4a3a2e, () => tunnelLight(s, 0));
    }
    // buffer stops closing each end
    for (const [s, sg] of [[2, 1], [r.length - 2, -1]]) {
        sampleAt(r.path, s, _s);
        const f = frameAt(_s.x, r.y0, _s.z, _s.tx, _s.tz);
        frameBox(parts, f, tw, th + 2, 3, 0, th / 2, -sg * 1.5, 0x3b4250, () => 0.7);
        for (const tv of [-TRACK, TRACK]) {
            frameBox(parts, f, 20, 8, 5, tv, 6, sg * 3, 0xd94a3a, () => 1);
            frameBox(glow, f, 3, 3, 0.6, tv, 12, sg * 5.8, 0xff3030, null, true);
        }
    }
}

let _nameCache = new Map();
function stationNameTex(name, hex, sub) {
    const key = name + '|' + hex;
    if (_nameCache.has(key)) return _nameCache.get(key);
    const c = document.createElement('canvas');
    c.width = 512; c.height = 112;
    const x = c.getContext('2d');
    x.fillStyle = '#10151f'; x.fillRect(0, 0, 512, 112);
    x.fillStyle = '#' + hex.toString(16).padStart(6, '0');
    x.fillRect(0, 0, 512, 10); x.fillRect(0, 102, 512, 10);
    x.beginPath(); x.arc(58, 56, 30, 0, Math.PI * 2); x.fill();
    x.fillStyle = '#10151f'; x.font = 'bold 34px Silkscreen, monospace';
    x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText('M', 58, 58);
    x.fillStyle = '#f1f5f9'; x.textAlign = 'left';
    let fs = 38;
    x.font = `bold ${fs}px Silkscreen, monospace`;
    const label = name.toUpperCase();
    while (x.measureText(label).width > 400 && fs > 16) { fs -= 2; x.font = `bold ${fs}px Silkscreen, monospace`; }
    x.fillText(label, 104, sub ? 46 : 58);
    if (sub) {
        x.fillStyle = '#94a3b8'; x.font = '16px Silkscreen, monospace';
        x.fillText(sub.toUpperCase(), 106, 82);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    _nameCache.set(key, tex);
    return tex;
}

/** The hall around a station's platform run. */
function buildStation(parts, glow, group, r, si) {
    const b = G.bldById[r.stops[si]];
    const sC = r.stopS[si];
    sampleAt(r.path, sC, _s);
    const f = frameAt(_s.x, r.y0, _s.z, _s.tx, _s.tz);
    const HL = STATION_HALF;
    const tile = STATION_TILES[(b?.name?.length || si) % STATION_TILES.length];
    const lit = (x, y) => 0.92 + 0.08 * Math.min(1, (y - r.y0) / HALL_H);
    const Bx = (w, h, d, v, y, u, hex, lf = lit) => frameBox(parts, f, w, h, d, v, y, u, hex, lf);
    const Gx = (w, h, d, v, y, u, hex) => frameBox(glow, f, w, h, d, v, y, u, hex, null, true);
    const L = HL * 2;

    Bx(tw, 1, L, 0, -0.5, 0, 0x24282e);                                   // track bed
    for (const sd of [-1, 1]) {
        const pv = sd * (PLAT_IN + PLAT_OUT) / 2, pw = PLAT_OUT - PLAT_IN;
        Bx(pw, RAIL_TOP, L, pv, RAIL_TOP / 2, 0, 0x9aa3ae);                // platform
        Bx(pw - 6, 0.3, L - 10, pv + sd * 3, RAIL_TOP + 0.15, 0, 0xb7bec7); // terrazzo
        Bx(3.5, 0.4, L, sd * (PLAT_IN + 1.75), RAIL_TOP + 0.2, 0, 0xf2c230); // edge strip
        Bx(2, HALL_H, L, sd * (PLAT_OUT + 1), HALL_H / 2, 0, tile);         // tiled wall
        Bx(0.6, 4, L, sd * (PLAT_OUT - 0.1), 34, 0, r.color, () => 1);      // line band
        Bx(0.6, 1.2, L, sd * (PLAT_OUT - 0.1), 31, 0, 0x2b3240, () => 1);
        Bx(0.6, 1.2, L, sd * (PLAT_OUT - 0.1), 37, 0, 0x2b3240, () => 1);
        // columns along the platform, and benches between them
        for (let u = -HL + 60; u <= HL - 60; u += 96) {
            Bx(5, HALL_H - RAIL_TOP, 5, sd * 58, RAIL_TOP + (HALL_H - RAIL_TOP) / 2, u, 0x606b79);
            Gx(5.4, 2, 5.4, sd * 58, 46, u, r.color);
            if (u + 48 < HL - 40) {
                Bx(6, 1.6, 26, sd * 84, RAIL_TOP + 5, u + 48, 0x7a5a3a);
                Bx(1.4, 5, 26, sd * 87, RAIL_TOP + 8, u + 48, 0x7a5a3a);
                for (const lu of [-10, 10]) Bx(5, 4.5, 1.4, sd * 84, RAIL_TOP + 2.2, u + 48 + lu, 0x2b313b);
            }
        }
        // the way out: a lift at the west end, the overbridge stairs at the east
        Bx(0.8, 30, 22, sd * (PLAT_OUT - 0.3), RAIL_TOP + 15, -HL + 24, 0x8e99a6, () => 1);
        Bx(1.2, 28, 1, sd * (PLAT_OUT - 0.6), RAIL_TOP + 14, -HL + 24, 0x3b4452, () => 1);
        Gx(0.5, 1.2, 24, sd * (PLAT_OUT - 0.9), RAIL_TOP + 31, -HL + 24, 0xfde68a);
        Gx(0.5, 4, 16, sd * (PLAT_OUT - 0.9), RAIL_TOP + 36, -HL + 24, 0x22c55e);
        Bx(14, 2, 30, sd * (PLAT_OUT - 9), RAIL_TOP + 1, HL - 30, 0x5b6573);
        for (let k = 0; k < 6; k++) Bx(14, 2.4, 4, sd * (PLAT_OUT - 9), RAIL_TOP + 3 + k * 4.6, HL - 42 + k * 5, 0x7b8694);
        Bx(1, 30, 30, sd * (PLAT_OUT - 16.5), RAIL_TOP + 15, HL - 30, 0x8e99a6);
        Gx(0.5, 4, 16, sd * (PLAT_OUT - 0.9), RAIL_TOP + 36, HL - 30, 0x38bdf8);
        // bins, a timetable and exit signs
        Bx(4, 7, 4, sd * 88, RAIL_TOP + 3.5, -HL + 30, 0x3a4554);
        Gx(0.5, 6, 12, sd * (PLAT_OUT - 0.4), 22, -HL + 70, 0xe2e8f0);
        Gx(0.5, 3.2, 18, sd * (PLAT_OUT - 0.4), 52, HL - 90, 0x22c55e);
        // ad panels
        for (const u of [-180, 0, 180]) {
            Bx(0.8, 16, 30, sd * (PLAT_OUT - 0.2), 21, u + 50, 0x1e2530, () => 1);
            Gx(0.4, 13, 26, sd * (PLAT_OUT - 0.7), 21, u + 50,
                [0x67e8f9, 0xf472b6, 0xfbbf24, 0xa78bfa][(si + u / 180 + 2) & 3]);
        }
    }
    // ceiling and its light coves
    Bx(PLAT_OUT * 2 + 4, 2, L, 0, HALL_H + 1, 0, 0x55606f, () => 1);
    for (let u = -HL + 30; u < HL; u += 60) Bx(PLAT_OUT * 2, 3, 3, 0, HALL_H - 1.5, u, 0x3d4756, () => 1);   // ceiling ribs
    for (const v of [-70, 0, 70]) Gx(8, 0.6, L - 40, v, HALL_H - 0.4, 0, 0xfff4dc);
    // end walls, with the tunnel mouths left open
    for (const sg of [-1, 1]) {
        const u = sg * (HL + 1.5);
        for (const sd of [-1, 1]) {
            const w = PLAT_OUT + 2 - tw / 2;
            Bx(w, HALL_H + 2, 3, sd * (tw / 2 + w / 2), HALL_H / 2, u, 0x3b4250);
        }
        Bx(tw, HALL_H - th + 2, 3, 0, th + (HALL_H - th) / 2, u, 0x3b4250);
        Gx(tw - 8, 1.2, 1, 0, th + 3, u - sg * 1.6, 0xfbbf24);
    }
    // people waiting on the platforms
    const rnd = (k) => Math.abs(Math.sin((si + 1) * 91.7 + k * 13.1)) % 1;
    for (let k = 0; k < 8; k++) {
        const sd = k % 2 ? 1 : -1;
        // clear of the lift end, where you arrive
        const u = -HL + 140 + rnd(k) * (L - 200);
        const v = sd * (66 + rnd(k + 9) * 16);
        const bot = rnd(k + 3) > 0.45;
        const hex = [0x7c3aed, 0x0ea5e9, 0xf97316, 0x334155, 0x16a34a, 0xbe185d][k % 6];
        Bx(2.2, 8, 2.2, v - 1.4, RAIL_TOP + 4, u, 0x1f2937);
        Bx(2.2, 8, 2.2, v + 1.4, RAIL_TOP + 4, u, 0x1f2937);
        Bx(5.6, 8.5, 3.6, v, RAIL_TOP + 12.2, u, hex);
        Bx(3.8, 3.8, 3.8, v, RAIL_TOP + 18.5, u, bot ? 0xaeb6c2 : 0xe2b48c);
        if (bot) Gx(3.9, 0.9, 3.9, v, RAIL_TOP + 18.9, u, 0x67e8f9);
    }
    // the station's name, repeated down both walls
    const name = (b?.name || r.stops[si]).replace(/\s*station$/i, '') + ' Station';
    const tex = stationNameTex(name, r.color, r.name);
    const signMat = new THREE.MeshBasicMaterial({ map: tex });
    const signs = [];
    for (const sd of [-1, 1]) {
        for (const u of [-200, -20, 160]) {
            const p = new THREE.PlaneGeometry(64, 14);
            p.rotateY(-sd * Math.PI / 2);
            p.translate(sd * (PLAT_OUT - 0.8), 46, u);
            p.applyMatrix4(f);
            signs.push(p);
        }
        // and on the column faces facing the train, small
        for (let u = -HL + 60; u <= HL - 60; u += 192) {
            const p = new THREE.PlaneGeometry(26, 5.6);
            p.rotateY(sd * Math.PI / 2);
            p.translate(sd * 55.4, 30, u);
            p.applyMatrix4(f);
            signs.push(p);
        }
    }
    const sm = new THREE.Mesh(mergeGeometries(signs, false), signMat);
    sm.name = 'metro:station:' + r.stops[si];
    group.add(sm);
}

function buildUnderground(routes) {
    const group = new THREE.Group();
    group.name = 'metroUnderground';
    const parts = [], glow = [];
    for (const r of routes) {
        // tunnel everywhere except the station halls
        const halls = r.stopS.map(s => [s - STATION_HALF, s + STATION_HALF]).sort((a, b) => a[0] - b[0]);
        let cur = 0;
        for (const [a, b] of halls) { buildTunnelRun(parts, glow, r, cur, a); cur = b; }
        buildTunnelRun(parts, glow, r, cur, r.length);
        buildTrack(parts, glow, r);
        for (let i = 0; i < r.stops.length; i++) buildStation(parts, glow, group, r, i);
    }
    // ribbons are non-indexed-compatible only with themselves; merge by kind
    const merge = (list, mat, name) => {
        const indexed = list.filter(g => g.index);
        if (!indexed.length) return;
        const m = new THREE.Mesh(mergeGeometries(indexed.map(g => {
            if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
            return g;
        }), false), mat);
        m.name = name;
        m.frustumCulled = false;
        m.matrixAutoUpdate = false;
        group.add(m);
    };
    merge(parts, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide }), 'metro:bore');
    merge(glow, new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }), 'metro:lamps');
    return group;
}

// ── the system ───────────────────────────────────────────────────────────

const _d = new THREE.Object3D();
const _col = new THREE.Color();
const _p = { x: 0, z: 0, tx: 1, tz: 0 };

export const Metro = {
    routes: [],
    trains: [],
    stock: null,          // { cab: {body,glow,livery,glass}, mid: {...} }
    group: null,          // everything under the city
    underground: null,
    cabin: null,          // the car you are riding in: { train, car } while riding
    active: true,
    riding: null,
    _rideSaved: null,
    _fogSave: null,
    _bgSave: null,
    _rideBgColor: null,

    init(scene) {
        this.routes = buildMetroRoutes(id => G.bldById[id]);
        this.trains = [];
        /* Two sets a line, one at each end, so they meet mid-line on opposite
           roads. The long trunk gets a third, starting from the middle. */
        this.routes.forEach((r, i) => {
            const last = r.stops.length - 1;
            this.trains.push(newTrain(this.routes, i, 0, 1, 2 + i * 1.7));
            this.trains.push(newTrain(this.routes, i, last, -1, 3.5 + i * 1.3));
            if (r.stops.length >= 4) this.trains.push(newTrain(this.routes, i, 1, -1, 0.5));
        });

        this.group = new THREE.Group();
        this.group.name = 'metro';
        const nT = this.trains.length;
        this.stock = { cab: stockMeshes(true, nT * 2), mid: stockMeshes(false, nT * (CARS - 2)) };
        for (const set of [this.stock.cab, this.stock.mid]) {
            for (const k of ['body', 'glow', 'glass', 'livery', 'doors']) this.group.add(set[k]);
        }
        this.underground = buildUnderground(this.routes);
        this.group.add(this.underground);
        this.group.visible = false;      // only ever seen from a moving train
        scene.add(this.group);

        // the ride's own lighting is baked; this only lifts anything Standard
        this._rideBgColor = new THREE.Color(RIDE_BG);
        this._write();
    },

    /** Every station on the network, from the routes themselves. */
    stationIds() {
        const ids = new Set();
        for (const r of (this.routes || [])) for (const id of r.stops) ids.add(id);
        return ids;
    },

    linesAt(bid) {
        return (this.routes || []).filter(r => r.stops.includes(bid));
    },

    nearestStation(x, z, maxDist = 220) {
        let best = null, bd = maxDist;
        for (const id of this.stationIds()) {
            const b = G.bldById[id];
            if (!b) continue;
            const d = Math.hypot(b.worldX - x, b.worldZ - z);
            if (d < bd) { bd = d; best = b; }
        }
        return best;
    },

    trainAtStop(bid) {
        if (!bid) return null;
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            if (t.atStop === bid && t.dwellT > 0.15) return { train: t, index: i };
        }
        return null;
    },

    /** Seconds until the next set reaches `bid` (rough: distance / cruise). */
    nextArrival(bid) {
        let best = null;
        for (const t of this.trains) {
            const r = this.routes[t.routeIdx];
            const si = r.stops.indexOf(bid);
            if (si < 0) continue;
            if (t.atStop === bid) return { train: t, eta: 0, route: r };
            const ahead = (r.stopS[si] - t.c) * t.dir;
            let d = ahead >= 0 ? ahead : (t.dir > 0 ? (r.length - t.c) + (r.length - r.stopS[si]) : t.c + r.stopS[si]);
            const eta = d / (VMAX * 0.7) + DWELL_SHORT * Math.max(0, Math.abs(si - t.next));
            if (!best || eta < best.eta) best = { train: t, eta, route: r };
        }
        return best;
    },

    canBoardNear(x, z) {
        if (this.riding != null) return null;
        const st = this.nearestStation(x, z, 180);
        if (!st) return null;
        const hit = this.trainAtStop(st.id);
        if (!hit) return null;
        return { station: st, ...hit };
    },

    _isRideKeep(o) {
        return o === this.group;
    },

    /** Subway presentation, re-applied every ride frame (weather rewrites fog). */
    _lockRideAtmosphere() {
        if (!this._rideBgColor) this._rideBgColor = new THREE.Color(RIDE_BG);
        G.scene.background = this._rideBgColor;
        if (G.scene.fog) {
            G.scene.fog.color.setHex(RIDE_FOG);
            G.scene.fog.near = 90;
            G.scene.fog.far = 1300;
        }
        for (const o of G.scene.children) {
            if (!o || o.isLight) continue;
            if (this._isRideKeep(o)) { o.visible = true; continue; }
            if (o.visible) {
                o.visible = false;
                if (this._cityHidden && !this._cityHidden.includes(o)) this._cityHidden.push(o);
            }
        }
        this.group.visible = true;
    },

    board(index) {
        const t = this.trains[index];
        if (!t || this.riding != null) return false;
        try { if (G.flyMode) G.flyModeSys?.exit?.(); } catch (_) { /* ignore */ }
        this.riding = index;
        t._longDwell = true;
        if (t.atStop && t.dwellT < 3.5) t.dwellT = 3.5;
        if (G.inside && G.interior) {
            try { G.interior.exit(true); } catch (_) { /* */ }
        }
        const fromPlatform = !!this.platform;
        if (fromPlatform) {
            // already underground: keep the hidden-city bookkeeping, drop the platform walls
            this.platform = null;
            G.onPlatform = null;
            if (this._streetColliders) G.colliders = this._streetColliders;
            this._streetColliders = null;
        }
        this._rideSaved = {
            pos: G.camera.position.clone(), yaw: G.player.yaw, pitch: G.player.pitch, floorY: G.floorY
        };
        G.floorY = t.y;
        G.ridingMetro = true;
        this._justBoarded = true;
        G.player.vel.set(0, 0, 0);
        if (!fromPlatform) {
            this._fogSave = G.scene.fog ? { color: G.scene.fog.color.clone(), near: G.scene.fog.near, far: G.scene.fog.far } : null;
            this._bgSave = G.scene.background;
            this._cityHidden = [];
        }
        this.cabin = { train: t, car: 1 };
        this._lockRideAtmosphere();
        this._attachCamera(t, 0);
        const r = this.routes[t.routeIdx];
        G.ui?.banner?.('🚇 ' + (r?.name || 'Metro'), 'E at a stop to alight · look around with the mouse');
        G.ui?.addToast?.('Boarded the ' + (r?.name || 'metro'), 'info');
        G.audio?.sfx?.('open');
        G.progress?.unlock?.('train_spotter');
        return true;
    },

    alight() {
        if (this.riding == null) return false;
        const t = this.trains[this.riding];
        const stopId = t?.atStop;
        const stop = stopId && G.bldById[stopId];
        if (t && (!t.atStop || t.dwellT <= 0)) {
            G.ui?.addToast?.('Wait for the next stop', 'info');
            return false;
        }
        this.riding = null;
        this.cabin = null;
        G.ridingMetro = false;
        if (t) t._longDwell = false;
        if (stop) {
            /* Step off onto the platform beside the doors you rode behind,
               facing along it. The ticket-hall lift is at the west end. */
            const r = this.routes[t.routeIdx];
            const pose = this.carPose(t, 1, {});
            sampleAt(r.path, r.stopS[r.stops.indexOf(stopId)], _p);
            const u = (pose.x - _p.x) * _p.tx + (pose.z - _p.z) * _p.tz;
            this.platform = null;
            this.enterPlatform(stopId, t.routeIdx, { side: Math.sign(t.lat) || 1, u, v: PLAT_IN + 12, along: true, quiet: true, keep: true });
            G.ui?.banner?.((stop.emoji || '🚇') + ' ' + stop.name, 'lift up to the street at the end of the platform');
        } else {
            this._restoreSurface();
            if (this._rideSaved) G.player.teleport(this._rideSaved.pos.x, this._rideSaved.pos.z, this._rideSaved.yaw);
        }
        this._rideSaved = null;
        G.audio?.sfx?.('close');
        G.ui?.addToast?.('Alighted from metro', 'info');
        return true;
    },

    // ── standing on a real platform ─────────────────────────────────────

    /** World point of station-local (u along the platform, v across). */
    _stationPt(r, si, u, v) {
        sampleAt(r.path, r.stopS[si], _p);
        return { x: _p.x + _p.tx * u + _p.tz * v, z: _p.z + _p.tz * u - _p.tx * v, tx: _p.tx, tz: _p.tz };
    },

    /** Walls, platform edge, columns and benches as AABBs (stations are axis-aligned). */
    _platformColliders(r, si) {
        const HL = STATION_HALF, out = [];
        const rect = (u0, u1, v0, v1) => {
            const a = this._stationPt(r, si, u0, v0), b = this._stationPt(r, si, u1, v1);
            out.push({ x0: Math.min(a.x, b.x), x1: Math.max(a.x, b.x), z0: Math.min(a.z, b.z), z1: Math.max(a.z, b.z), id: 'platform' });
        };
        for (const sd of [-1, 1]) {
            const v = (a, b) => sd > 0 ? [a, b] : [-b, -a];
            rect(-HL - 8, HL + 8, ...v(PLAT_OUT - 1, PLAT_OUT + 8));        // back wall
            rect(-HL - 8, HL + 8, ...v(PLAT_IN - 10, PLAT_IN - 1));         // platform edge
            rect(HL - 2, HL + 8, ...v(PLAT_IN - 10, PLAT_OUT + 8));          // ends
            rect(-HL - 8, -HL + 2, ...v(PLAT_IN - 10, PLAT_OUT + 8));
            for (let u = -HL + 60; u <= HL - 60; u += 96) {
                rect(u - 3, u + 3, ...v(55, 61));
                if (u + 48 < HL - 40) rect(u + 35, u + 61, ...v(80, 89));
            }
            rect(HL - 46, HL - 15, ...v(PLAT_OUT - 17, PLAT_OUT));          // stair
        }
        return out;
    },

    /** Put the player on line `routeIdx`'s platform at station `bid`. */
    enterPlatform(bid, routeIdx = null, opts = {}) {
        const lines = this.linesAt(bid);
        const r = routeIdx != null ? this.routes[routeIdx] : lines[0];
        if (!r) return false;
        const si = r.stops.indexOf(bid);
        if (si < 0) return false;
        if (G.inside && G.interior) { try { G.interior.exit(true); } catch (_) { /* */ } }
        try { if (G.flyMode) G.flyModeSys?.exit?.(); } catch (_) { /* ignore */ }
        if (!this.platform && !opts.keep) {
            // arriving from the surface (a ride already holds these)
            this._fogSave = G.scene.fog ? { color: G.scene.fog.color.clone(), near: G.scene.fog.near, far: G.scene.fog.far } : null;
            this._bgSave = G.scene.background;
            this._cityHidden = [];
        }
        if (!this._streetColliders) this._streetColliders = G.colliders;
        const sd = opts.side || 1;
        this.platform = { bid, routeIdx: r.index, si, side: sd };
        G.onPlatform = this.platform;
        G.colliders = this._platformColliders(r, si);
        G.floorY = r.y0 + RAIL_TOP;
        this._lockRideAtmosphere();
        const u = opts.u ?? (-STATION_HALF + 84);
        const vv = sd * (opts.v ?? (PLAT_IN + 22));
        const p = this._stationPt(r, si, u, vv);
        // face the track, or along the platform when stepping off a train
        const fx = opts.along ? p.tx : -sd * p.tz, fz = opts.along ? p.tz : sd * p.tx;
        G.player.teleport(p.x, p.z, Math.atan2(-fx, -fz));
        G.player.pitch = 0;
        const st = G.bldById[bid];
        if (!opts.quiet) G.ui?.banner?.('🚇 ' + r.name, (st?.name || bid) + ' · platform ' + (sd > 0 ? 1 : 2));
        return true;
    },

    /** Leave the underground: back to the street (and the ticket hall). */
    leavePlatform(toHall = true) {
        if (!this.platform) return;
        const bid = this.platform.bid;
        this._restoreSurface();
        const b = G.bldById[bid];
        if (b) {
            const side = City.offRoad ? City.offRoad(b.worldX + 70, b.worldZ + 70) : { x: b.worldX + 70, z: b.worldZ + 70 };
            G.player.teleport(side.x, side.z, Math.atan2(b.worldX - side.x, b.worldZ - side.z));
            if (toHall && G.interior?.enter) { try { G.interior.enter(b, 0); } catch (_) { /* */ } }
        }
    },

    _restoreSurface() {
        this.platform = null;
        G.onPlatform = null;
        this.group.visible = false;
        if (this._streetColliders) G.colliders = this._streetColliders;
        this._streetColliders = null;
        G.floorY = 0;
        for (const o of this._cityHidden || []) o.visible = true;
        this._cityHidden = [];
        if (this._fogSave && G.scene.fog) {
            G.scene.fog.color.copy(this._fogSave.color);
            G.scene.fog.near = this._fogSave.near;
            G.scene.fog.far = this._fogSave.far;
        }
        if (this._bgSave !== undefined) G.scene.background = this._bgSave;
        this._fogSave = null;
        this._bgSave = null;
    },

    /** What E does / what the prompt says, on a platform. */
    _platformState() {
        const pf = this.platform;
        if (!pf) return null;
        const r = this.routes[pf.routeIdx];
        const cam = G.camera.position;
        // which side of the tracks you are on
        sampleAt(r.path, r.stopS[pf.si], _p);
        const v = (cam.x - _p.x) * _p.tz - (cam.z - _p.z) * _p.tx;
        const u = (cam.x - _p.x) * _p.tx + (cam.z - _p.z) * _p.tz;
        const sd = v >= 0 ? 1 : -1;
        pf.side = sd;
        if (u < -STATION_HALF + 50 && Math.abs(v) > PLAT_OUT - 30) return { kind: 'lift', label: '<b>E</b> — lift up to the ticket hall' };
        if (u > STATION_HALF - 62 && Math.abs(v) > PLAT_OUT - 34) return { kind: 'cross', label: '<b>E</b> — stairs to platform ' + (sd > 0 ? 2 : 1) };
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            if (t.routeIdx !== pf.routeIdx || t.atStop !== pf.bid) continue;
            if (Math.sign(t.lat) !== sd || (t.doorK || 0) < 0.55) continue;
            const nb = G.bldById[r.stops[Math.max(0, Math.min(r.stops.length - 1, t.next + t.dir))]];
            const end = (t.next + t.dir < 0 || t.next + t.dir >= r.stops.length);
            const dest = end ? G.bldById[r.stops[t.dir > 0 ? 0 : r.stops.length - 1]] : G.bldById[r.stops[t.dir > 0 ? r.stops.length - 1 : 0]];
            return { kind: 'board', index: i, label: `<b>E</b> — board · ${r.name} to ${dest?.name || nb?.name || 'the next stop'}` };
        }
        // the next train on this side
        let eta = null;
        for (const t of this.trains) {
            if (t.routeIdx !== pf.routeIdx) continue;
            const e = etaTo(t, r, pf.si, sd);
            if (eta == null || e < eta) eta = e;
        }
        const dir = r.stops[sd > 0 ? r.stops.length - 1 : 0];
        const toward = G.bldById[dir]?.name || '';
        const terminus = (sd > 0 && pf.si === r.stops.length - 1) || (sd < 0 && pf.si === 0);
        const due = terminus ? 'terminus — trains leave from the other platform' : eta == null ? '—' : eta < 6 ? 'arriving' : eta < 60 ? Math.ceil(eta / 5) * 5 + ' s' : Math.round(eta / 60) + ' min';
        return { kind: 'wait', label: `${r.name} → ${toward} · ${due}` };
    },

    platformAction() {
        const st = this._platformState();
        if (!st) return false;
        if (st.kind === 'board') return this.board(st.index);
        if (st.kind === 'lift') { this.leavePlatform(true); return true; }
        if (st.kind === 'cross') {
            const pf = this.platform;
            this.enterPlatform(pf.bid, pf.routeIdx, { side: -pf.side, u: STATION_HALF - 70, v: PLAT_OUT - 24, quiet: true });
            G.ui?.addToast?.('Over the bridge to platform ' + (pf.side > 0 ? 1 : 2), 'info');
            return true;
        }
        G.ui?.addToast?.('Wait for the train — the doors open when it stops', 'info');
        return false;
    },

    platformPrompt() {
        const st = this._platformState();
        if (!st) return;
        const pf = this.platform;
        G.ui?.lookLabel?.((G.bldById[pf.bid]?.name || '') + ' · platform ' + (pf.side > 0 ? 1 : 2));
        G.ui?.prompt?.(st.label);
    },

    /** Centre of car `k` (0 = leading) of a set, with its heading. */
    carPose(t, k, out = {}) {
        const r = this.routes[t.routeIdx];
        const s = t.c + t.dir * (TRAIN_HALF - CAR_L / 2 - k * PITCH);
        sampleAt(r.path, s, _p);
        out.x = _p.x + _p.tz * t.lat;
        out.z = _p.z - _p.tx * t.lat;
        out.hx = _p.tx * t.dir;
        out.hz = _p.tz * t.dir;
        out.y = r.y0 + RAIL_TOP;
        return out;
    },

    _attachCamera(t, dt) {
        /* Sway and bob follow the speed, so a set standing at a platform is
           dead still and a set at full tilt rocks a little. */
        const k = Math.min(1, t.v / VMAX);
        this._sway = (this._sway ?? 0) + (k - (this._sway ?? 0)) * Math.min(1, dt * 3);
        const s = this._sway;
        const now = G.time || 0;
        const bob = Math.sin(now * 7.3) * 0.35 * s + Math.sin(now * 2.1) * 0.15 * s;
        const lat = Math.sin(now * 2.9) * 0.6 * s;
        const pose = this.carPose(t, 1, this._pose || (this._pose = {}));
        // stand in the aisle, a little back from the middle doors
        const back = -8;
        const px = pose.x + pose.hx * back - pose.hz * lat;
        const pz = pose.z + pose.hz * back + pose.hx * lat;
        G.camera.position.set(px, pose.y + CABIN_EYE + bob, pz);
        if (this._justBoarded) {
            // start looking down the car, the way it is going
            G.player.yaw = Math.atan2(-pose.hx, -pose.hz);
            G.player.pitch = 0;
            this._justBoarded = false;
            this._lastHead = null;
        }
        // the set's heading change carries the view round the curves with it
        const head = Math.atan2(pose.hx, pose.hz);
        if (this._lastHead != null) {
            let dh = head - this._lastHead;
            if (dh > Math.PI) dh -= Math.PI * 2;
            if (dh < -Math.PI) dh += Math.PI * 2;
            G.player.yaw += dh;    // a reversal at a terminus turns you with the set
        }
        this._lastHead = head;
        G.camera.rotation.order = 'YXZ';
        G.camera.rotation.y = G.player.yaw;
        G.camera.rotation.x = G.player.pitch;
        G.camera.rotation.z = Math.sin(now * 2.9) * 0.004 * s;
    },

    update(dt) {
        if (!this.active || !this.stock) return;
        if (this.riding != null) {
            const t = this.trains[this.riding];
            if (t) t._longDwell = true;
        }
        const px = G.camera?.position?.x, pz = G.camera?.position?.z;
        for (const t of this.trains) {
            if (t.dwellT > 0 && t.atStop && px != null && !G.ridingMetro) {
                const st = G.bldById[t.atStop];
                if (st && Math.hypot(st.worldX - px, st.worldZ - pz) < 220) {
                    t._longDwell = true;
                    if (t.dwellT < DWELL_NEAR) t.dwellT = DWELL_NEAR;
                }
            }
            stepTrain(t, dt, this.routes, this.trains);
            if (t.dwellT <= 0 && this.riding !== this.trains.indexOf(t)) t._longDwell = false;
        }
        if (this.group.visible || this.riding != null) this._write();
        if (this.platform) this._lockRideAtmosphere();

        if (this.riding != null) {
            this._lockRideAtmosphere();
            const t = this.trains[this.riding];
            if (t) this._attachCamera(t, dt);
            this._annTimer = (this._annTimer || 0) - dt;
            if (this._annTimer <= 0 && t) {
                this._annTimer = 0.6;
                const r = this.routes[t.routeIdx];
                if (t.atStop && t.dwellT > 0.2) {
                    const st = G.bldById[t.atStop];
                    G.ui?.prompt?.(`<b>E</b> — alight at ${st?.name || t.atStop}`);
                    G.ui?.lookLabel?.(`${r.name} · doors open`);
                } else {
                    const nb = G.bldById[r.stops[t.next]];
                    G.ui?.lookLabel?.(nb ? `${r.name} · next: ${nb.name}` : r.name);
                    G.ui?.prompt?.(t.v > VMAX * 0.5 ? `🚇 ${Math.round(t.v * 0.36)} km/h` : '🚇 riding the metro');
                }
            }
        }
    },

    _write() {
        const cab = this.stock.cab, mid = this.stock.mid;
        let ic = 0, im = 0;
        const pose = this._wpose || (this._wpose = {});
        for (let i = 0; i < this.trains.length; i++) {
            const t = this.trains[i];
            _col.set(t.color);
            for (let k = 0; k < CARS; k++) {
                this.carPose(t, k, pose);
                _d.position.set(pose.x, pose.y, pose.z);
                let ry = Math.atan2(pose.hx, pose.hz);
                const isCab = k === 0 || k === CARS - 1;
                if (k === CARS - 1) ry += Math.PI;      // the tail cab faces back
                _d.rotation.set(0, ry, 0);
                _d.updateMatrix();
                const set = isCab ? cab : mid;
                const idx = isCab ? ic++ : im++;
                for (const key of ['body', 'glow', 'glass', 'livery']) set[key].setMatrixAt(idx, _d.matrix);
                set.livery.setColorAt(idx, _col);
                // doors: open on the platform side only (local x flips on the tail cab)
                const openSide = Math.sign(t.lat || 1) * t.dir * (k === CARS - 1 ? -1 : 1);
                let li = idx * 8;
                for (const sd of [-1, 1]) {
                    const open = sd === openSide ? (t.doorK || 0) : 0;
                    for (const dz of DOOR_ZS) {
                        for (const h of [-1, 1]) {
                            const z = dz + h * (DOOR_DW / 4 + open * (DOOR_DW / 2 - 1.5));
                            _m4.makeTranslation(sd * (CAR_W / 2 + 0.3), 0, z).premultiply(_d.matrix);
                            set.doors.setMatrixAt(li, _m4);
                            li++;
                        }
                    }
                }
            }
        }
        for (const set of [cab, mid]) {
            for (const key of ['body', 'glow', 'glass', 'livery', 'doors']) set[key].instanceMatrix.needsUpdate = true;
            if (set.livery.instanceColor) set.livery.instanceColor.needsUpdate = true;
        }
    },

    snapshot() {
        return {
            lines: this.routes.length,
            trains: this.trains.length,
            stops: [...new Set(this.routes.flatMap(r => r.stops))],
            laps: this.trains.reduce((s, t) => s + t.laps, 0),
            riding: this.riding,
            hasTunnels: !!this.underground,
            hasCabin: !!this.stock,
            positions: this.trains.map(t => ({ x: t.x, z: t.z, at: t.atStop, dwell: t.dwellT, v: t.v, lat: t.lat }))
        };
    }
};
