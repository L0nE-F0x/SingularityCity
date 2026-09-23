/* ══════════════════════════════════════════════════════════════════════════
   STREETSCAPE — the furniture of a lived-in city, from the threejsassets kits.

   Until now the pavements carried lamps, trees and a handful of brown box
   benches, and the paved district pads were empty grey slabs between the
   buildings. This lays out, deterministically (same city every visit):

     • kerbside furniture down every road — benches with bins, hydrants,
       bike racks, planters, wayfinding, bus shelters with their stop flags —
       chosen per district character (downtown, industrial, campus,
       waterfront, suburb);
     • parked cars along the kerb lane of the main roads (ambient traffic only
       ever drives the inner lane, see traffic.js laneCentre(..., 0));
     • pocket plazas in the open paving: planters ringed by benches,
       reflecting pools, the odd fountain;
     • rooftop billboards and logo signs on low-rise blocks by the avenues;
     • district dressing: the Underground is a wasteland of wrecks and burning
       barrels, the Space Zone a desert of scrub and sandstone, the waterfront
       has deco lamps, payphones and palms.

   Draw cost. Every kit is ONE InstancedMesh, but a city's worth of benches is
   a lot of triangles for things you can only see from 100 m away. So each
   set keeps all of its matrices on the CPU and uploads only the instances
   within `range` of the camera, a few times a second (ProxSet.refresh). The
   GPU sees a handful of benches, the draw call count stays one per kit, and
   nothing far away costs a triangle.

   Collision. Anything you would walk into gets a small collider, so the
   player can't pass through a bus shelter — and it goes into G.colliders
   before Vendors and the rest place themselves, so they avoid it too.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G, CITY_W, CITY_D, CELL_W, CELL_D } from './state.js';
import { City, KERB_H } from './city.js';
import { Assets, WORLD_PER_M } from './assets.js';

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

const _dummy = new THREE.Object3D();
const _col = new THREE.Color();

/** All the instances of one kit, uploaded by proximity. */
class ProxSet {
    constructor(id, kit, range) {
        this.id = id;
        this.kit = kit;
        this.range = range;
        this.castShadow = Math.max(kit.size.x, kit.size.z) * 10 > 30 || kit.size.y * 10 > 30;
        this.items = [];
        this.mesh = null;
    }

    add(x, y, z, ry, s, tint) {
        this.items.push({ x, y, z, ry, s, tint });
    }

    build(scene) {
        const n = this.items.length;
        if (!n) return;
        this.mats = new Float32Array(n * 16);
        this.px = new Float32Array(n);
        this.pz = new Float32Array(n);
        const tinted = this.items.some(it => it.tint != null);
        if (tinted) this.cols = new Float32Array(n * 3);
        this.items.forEach((it, i) => {
            _dummy.position.set(it.x, it.y, it.z);
            _dummy.rotation.set(0, it.ry, 0);
            _dummy.scale.setScalar(it.s);
            _dummy.updateMatrix();
            _dummy.matrix.toArray(this.mats, i * 16);
            this.px[i] = it.x; this.pz[i] = it.z;
            if (tinted) {
                _col.set(it.tint ?? 0xffffff);
                this.cols[i * 3] = _col.r; this.cols[i * 3 + 1] = _col.g; this.cols[i * 3 + 2] = _col.b;
            }
        });
        const im = new THREE.InstancedMesh(this.kit.geometry, this.kit.material, n);
        im.name = 'street:' + this.id;
        /* Only things big enough to throw a shadow you'd notice cast one. The
           shadow pass draws every uploaded instance again, and a hydrant's
           shadow is a smudge nobody misses. */
        im.userData.noShadow = !this.castShadow;
        im.frustumCulled = false;       // only near-camera instances are uploaded
        im.count = 0;
        if (tinted) im.setColorAt(0, _col.set(0xffffff));
        im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        scene.add(im);
        this.mesh = im;
        this.items = null;
    }

    refresh(cx, cz) {
        const im = this.mesh;
        if (!im) return;
        const r2 = this.range * this.range;
        const dst = im.instanceMatrix.array;
        const cdst = this.cols ? im.instanceColor.array : null;
        let k = 0;
        for (let i = 0; i < this.px.length; i++) {
            const dx = this.px[i] - cx, dz = this.pz[i] - cz;
            if (dx * dx + dz * dz > r2) continue;
            dst.set(this.mats.subarray(i * 16, i * 16 + 16), k * 16);
            if (cdst) cdst.set(this.cols.subarray(i * 3, i * 3 + 3), k * 3);
            k++;
        }
        im.count = k;
        im.visible = k > 0;
        if (k) {
            im.instanceMatrix.needsUpdate = true;
            if (cdst) im.instanceColor.needsUpdate = true;
        }
    }
}

/* Coarse occupancy: every placed thing is a circle; new ones must clear it. */
class Occupancy {
    constructor(cell = 40) { this.cell = cell; this.map = new Map(); }
    _k(ix, iz) { return ix * 73856093 ^ iz * 19349663; }
    add(x, z, r) {
        const c = this.cell;
        const ix = Math.floor(x / c), iz = Math.floor(z / c);
        const k = this._k(ix, iz);
        if (!this.map.has(k)) this.map.set(k, []);
        this.map.get(k).push(x, z, r);
    }
    free(x, z, r) {
        const c = this.cell;
        const ix = Math.floor(x / c), iz = Math.floor(z / c);
        const reach = Math.ceil((r + 40) / c);
        for (let dx = -reach; dx <= reach; dx++) {
            for (let dz = -reach; dz <= reach; dz++) {
                const a = this.map.get(this._k(ix + dx, iz + dz));
                if (!a) continue;
                for (let i = 0; i < a.length; i += 3) {
                    const ex = a[i] - x, ez = a[i + 1] - z, rr = a[i + 2] + r;
                    if (ex * ex + ez * ez < rr * rr) return false;
                }
            }
        }
        return true;
    }
}

// Character of a district's kerbs. Weights are per candidate slot.
const PROGRAMS = {
    urban:     { bench: 0.16, hydrant: 0.07, bike: 0.05, planter: 0.08, wayfind: 0.025, cabinet: 0.02, busStop: true, parked: 0.42, plazas: 5 },
    academic:  { bench: 0.2, hydrant: 0.05, bike: 0.12, planter: 0.1, wayfind: 0.04, cabinet: 0.01, busStop: true, parked: 0.25, plazas: 7 },
    plaza:     { bench: 0.2, hydrant: 0.05, bike: 0.05, planter: 0.12, wayfind: 0.04, cabinet: 0.0, busStop: true, parked: 0.2, plazas: 8 },
    coastal:   { bench: 0.14, hydrant: 0.05, bike: 0.03, planter: 0.0, palmPot: 0.1, payphone: 0.03, wayfind: 0.0, cabinet: 0.02, busStop: false, parked: 0.3, plazas: 2, deco: true },
    industry:  { bench: 0.03, hydrant: 0.09, bike: 0.0, planter: 0.0, wayfind: 0.0, cabinet: 0.12, dumpster: 0.06, busStop: false, parked: 0.22, plazas: 0 },
    suburban:  { bench: 0.04, hydrant: 0.06, bike: 0.0, planter: 0.0, mailbox: 0.14, bins: 0.12, wayfind: 0.0, cabinet: 0.0, busStop: false, parked: 0.18, plazas: 0, suburb: true },
    park:      { bench: 0.3, hydrant: 0.02, bike: 0.04, planter: 0.06, wayfind: 0.03, cabinet: 0.0, busStop: true, parked: 0.0, plazas: 0 },
    forest:    { bench: 0.06, hydrant: 0.0, bike: 0.0, planter: 0.0, wayfind: 0.02, cabinet: 0.0, busStop: false, parked: 0.0, plazas: 0 },
    desert:    { bench: 0.0, hydrant: 0.0, bike: 0.0, planter: 0.0, wayfind: 0.02, cabinet: 0.03, busStop: false, parked: 0.0, plazas: 0 },
    wasteland: { bench: 0.0, hydrant: 0.04, bike: 0.0, planter: 0.0, wayfind: 0.0, cabinet: 0.04, dumpster: 0.05, wreckKerb: 0.08, busStop: false, parked: 0.0, plazas: 0 }
};

// (no delivery van: at 8.6k triangles it cost more than the rest of a block's parking)
const PARKED_CITY = ['sedan', 'rideshare', 'suv', 'metro_taxi', 'sedan', 'rideshare'];
const PARKED_SUBURB = ['sb_sedan', 'sb_minivan', 'sb_pickup', 'sedan'];
const PARKED_COAST = ['vb_pastel_car', 'vb_convertible', 'sedan', 'rideshare'];
const CAR_TINTS = [0xffffff, 0xf2f2f2, 0xe6ecf5, 0xfff4e6, 0xdfe6df, 0xf5e6e6];

export const Streetscape = {
    sets: new Map(),
    stats: {},
    _t: 0,
    _last: { x: 1e9, z: 1e9 },

    _set(id, range) {
        if (!Assets.has(id)) return null;
        let s = this.sets.get(id);
        if (!s) {
            s = new ProxSet(id, Assets.get(id), range);
            this.sets.set(id, s);
        }
        return s;
    },

    /** Place one kit. Returns true if it went down. `r` is its clearance
        radius; `solid` adds a player collider of that half-size. */
    _put(id, x, z, ry, opts = {}) {
        const range = (opts.range ?? 850) * this.rangeMul;
        const s = this._set(id, range);
        if (!s) return false;
        const r = opts.r ?? 8;
        if (!opts.force && !this._ok(x, z, r, opts)) return false;
        const scale = (opts.scale ?? 1) * WORLD_PER_M;
        s.add(x, opts.y ?? (opts.onKerb ? KERB_H : 0), z, ry, scale, opts.tint);
        this.occ.add(x, z, r);
        if (opts.solid) {
            const hx = opts.hx ?? r * 0.7, hz = opts.hz ?? r * 0.7;
            // colliders are axis-aligned; a quarter-turned box swaps its halves
            const q = Math.abs(Math.sin(ry)) > 0.7;
            const ax = q ? hz : hx, az = q ? hx : hz;
            G.colliders.push({ x0: x - ax, z0: z - az, x1: x + ax, z1: z + az, id: 'furniture' });
        }
        this.stats[id] = (this.stats[id] || 0) + 1;
        return true;
    },

    _ok(x, z, r, opts) {
        if (!opts.allowRoad && City.onCarriageway(x, z)) return false;
        if (!this.occ.free(x, z, r)) return false;
        const m = opts.margin ?? 4;
        for (const c of G.colliders) {
            if (x + r + m > c.x0 && x - r - m < c.x1 && z + r + m > c.z0 && z - r - m < c.z1) return false;
        }
        return true;
    },

    build(scene, ctx = {}) {
        this.occ = new Occupancy(40);
        this.rangeMul = G.quality === 'high' ? 1.35 : G.quality === 'low' ? 0.7 : 1;
        // what's already standing on the pavements
        for (const l of ctx.lampSpots || []) this.occ.add(l.x, l.z, 7);
        for (const t of ctx.treeSpots || []) this.occ.add(t.x, t.z, 9);
        for (const c of G.colliders) {
            // signals / small posts are colliders already; nothing to add
            if (c.id === 'signal') this.occ.add((c.x0 + c.x1) / 2, (c.z0 + c.z1) / 2, 6);
        }
        const heavy = G.quality !== 'low';
        this.heavy = heavy;

        this._roads();
        this._plazas();
        this._rooftops(ctx.boxLots || []);
        this._suburbs();
        this._waterfront();
        if (heavy) this._underground();
        this._desert();
        this._parks();

        for (const s of this.sets.values()) s.build(scene);
        this.refresh(true);
    },

    _district(x, z) {
        return G.districtAt ? G.districtAt(x, z) : null;
    },

    // ── kerbside, road by road ─────────────────────────────────────────────
    _roads() {
        let roadIdx = 0;
        for (const road of City.roads) {
            roadIdx++;
            const vertical = road.vertical;
            const coord = vertical ? road.x : road.z;
            const len = vertical ? road.d : road.w;
            const along0 = vertical ? road.z : road.x;
            const half = road.carriage / 2;
            const sw = road.sidewalk;
            const inner = !!road.inner;
            const main = !inner && sw >= 30;
            for (const side of [-1, 1]) {
                const rnd = mulberry32(9001 + roadIdx * 31 + (side > 0 ? 7 : 0));
                const P = (a, off) => vertical ? { x: coord + side * off, z: a } : { x: a, z: coord + side * off };
                // +z of a kit turned to face the road
                const faceRoad = vertical ? -side * Math.PI / 2 : (side > 0 ? Math.PI : 0);
                const alongRot = vertical ? 0 : Math.PI / 2;
                const kerbOff = half + (inner ? 4 : 6);
                const bldOff = half + sw - (inner ? 4 : 6);
                let lastBus = -1e9;
                const STEP = inner ? 58 : 46;
                for (let a = along0 - len / 2 + 40; a < along0 + len / 2 - 40; a += STEP) {
                    // district character from a point just inside the cell
                    const probe = P(a, half + sw + 60);
                    const d = this._district(probe.x, probe.z);
                    const prog = PROGRAMS[d?.biome] || PROGRAMS.urban;
                    const k = P(a, kerbOff), b = P(a, bldOff);
                    if (!City.clearOfCrossRoads(k.x, k.z, vertical, 40)) continue;
                    const r = rnd();
                    // bus stop: shelter on the building side, flag at the kerb
                    if (main && prog.busStop && a - lastBus > 760 && r < 0.2) {
                        const sh = P(a, half + sw - 10);
                        if (this._put('st_shelter', sh.x, sh.z, faceRoad, { r: 24, solid: true, hx: 22, hz: 7, onKerb: true, range: 1300 })) {
                            const f = P(a + 34, kerbOff);
                            this._put('st_bus_flag', f.x, f.z, faceRoad, { r: 4, onKerb: true, range: 900, solid: true, hx: 2, hz: 2 });
                            lastBus = a;
                            continue;
                        }
                    }
                    let t = r;
                    if ((t -= prog.bench) < 0) {
                        const benchId = prog.deco ? 'vb_bench' : 'st_bench';
                        // terrazzo bench's backrest is on +z; the plaza bench's on -z
                        const ry = prog.deco ? faceRoad + Math.PI : faceRoad;
                        if (this._put(benchId, b.x, b.z, ry, { r: 9, onKerb: true, solid: true, hx: 8, hz: 3 })) {
                            const bin = P(a + 16, bldOff);
                            this._put(prog.deco ? 'vb_bin' : 'st_recycle', bin.x, bin.z, faceRoad, { r: 5, onKerb: true, solid: true, hx: 4, hz: 3 });
                        }
                        continue;
                    }
                    if ((t -= prog.hydrant) < 0) {
                        this._put(prog.suburb ? 'sb_hydrant' : 'st_hydrant', k.x, k.z, faceRoad, { r: 4, onKerb: true, solid: true, hx: 2, hz: 2, range: 650 });
                        continue;
                    }
                    if ((t -= prog.bike || 0) < 0) {
                        this._put('st_bike_rack', b.x, b.z, alongRot, { r: 12, onKerb: true, range: 800 });
                        continue;
                    }
                    if ((t -= prog.planter || 0) < 0) {
                        this._put(rnd() < 0.5 ? 'st_planter' : 'st_shrub_bed', b.x, b.z, alongRot, { r: 9, onKerb: true, solid: true, hx: 7, hz: 4 });
                        continue;
                    }
                    if ((t -= prog.palmPot || 0) < 0) {
                        this._put('vb_palm_pot', b.x, b.z, 0, { r: 6, onKerb: true, solid: true, hx: 4, hz: 4 });
                        continue;
                    }
                    if ((t -= prog.payphone || 0) < 0) {
                        this._put('vb_payphone', b.x, b.z, faceRoad, { r: 7, onKerb: true, solid: true, hx: 5, hz: 5 });
                        continue;
                    }
                    if ((t -= prog.mailbox || 0) < 0) {
                        this._put('sb_mailbox', k.x, k.z, faceRoad + Math.PI, { r: 4, onKerb: true, range: 900 });
                        continue;
                    }
                    if ((t -= prog.bins || 0) < 0) {
                        this._put('sb_bins', k.x, k.z, faceRoad + Math.PI, { r: 7, onKerb: true, range: 900 });
                        continue;
                    }
                    if ((t -= prog.wayfind) < 0) {
                        this._put(rnd() < 0.5 ? 'st_wayfinding' : 'st_kiosk', b.x, b.z, faceRoad, { r: 10, onKerb: true, solid: true, hx: 7, hz: 5, range: 1100 });
                        continue;
                    }
                    if ((t -= prog.cabinet) < 0) {
                        this._put(rnd() < 0.6 ? 'st_vent_cab' : 'st_transformer', b.x, b.z, faceRoad, { r: 11, onKerb: true, solid: true, hx: 9, hz: 6 });
                        continue;
                    }
                    if ((t -= prog.dumpster || 0) < 0) {
                        this._put('st_dumpster', b.x, b.z, faceRoad, { r: 12, onKerb: true, solid: true, hx: 10, hz: 7 });
                        continue;
                    }
                    if ((t -= prog.wreckKerb || 0) < 0 && this.heavy) {
                        this._put(rnd() < 0.5 ? 'wl_cart' : 'wl_chunk', b.x, b.z, rnd() * 6.28, { r: 9, onKerb: true, range: 1200 });
                        continue;
                    }
                }
                // parked cars in the kerb lane of the main roads
                if (main) this._parkRun(road, side, vertical, coord, len, along0, half, rnd);
            }
        }
    },

    _parkRun(road, side, vertical, coord, len, along0, half, rnd) {
        const laneOff = half - 15;                       // centre of the kerb lane
        const P = (a) => vertical ? { x: coord + side * laneOff, z: a } : { x: a, z: coord + side * laneOff };
        // traffic on this side of the road runs this way (traffic.js)
        const ry = vertical ? (side > 0 ? 0 : Math.PI) : -side * Math.PI / 2;
        for (let a = along0 - len / 2 + 80; a < along0 + len / 2 - 80; a += 64) {
            const p = P(a);
            if (!City.clearOfCrossRoads(p.x, p.z, vertical, 90)) continue;
            const probe = vertical ? { x: coord + side * (half + 100), z: a } : { x: a, z: coord + side * (half + 100) };
            const d = this._district(probe.x, probe.z);
            const prog = PROGRAMS[d?.biome] || PROGRAMS.urban;
            if (rnd() > prog.parked) continue;
            const pool = prog.suburb ? PARKED_SUBURB : prog.deco ? PARKED_COAST : PARKED_CITY;
            let id = pool[Math.floor(rnd() * pool.length)];
            if (!Assets.has(id)) id = 'sedan';
            const kit = Assets.get(id);
            if (!kit) continue;
            const s = 52 / Math.max(kit.size.x, kit.size.z) / WORLD_PER_M;
            const tint = id === 'metro_taxi' || id.startsWith('vb_') ? null : CAR_TINTS[Math.floor(rnd() * CAR_TINTS.length)];
            this._put(id, p.x, p.z, ry, { r: 16, allowRoad: true, scale: s, solid: true, hx: 11, hz: 27, range: 1400, tint });
        }
    },

    // ── pocket plazas in the open paving ────────────────────────────────────
    _plazas() {
        const rnd = mulberry32(4242);
        for (const d of City.districts) {
            const prog = PROGRAMS[d.biome] || PROGRAMS.urban;
            let want = prog.plazas || 0;
            if (!want) continue;
            const spots = [];
            for (const [ox, oz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
                const px = d.cx + ox * 210, pz = d.cz + oz * 210;
                for (let gx = -150; gx <= 150; gx += 30) {
                    for (let gz = -150; gz <= 150; gz += 30) {
                        spots.push({ x: px + gx, z: pz + gz, u: rnd() });
                    }
                }
            }
            spots.sort((a, b) => a.u - b.u);
            const taken = [];
            for (const s of spots) {
                if (want <= 0) break;
                if (taken.some(t => Math.hypot(t.x - s.x, t.z - s.z) < 150)) continue;
                if (!this._ok(s.x, s.z, 34, { margin: 12 })) continue;
                if (City.onSidewalk(s.x, s.z)) continue;
                const big = this._ok(s.x, s.z, 50, { margin: 14 });
                this._plaza(s.x, s.z, rnd, big);
                taken.push(s);
                want--;
            }
        }
    },

    _plaza(x, z, rnd, big) {
        const kind = rnd();
        const benchRing = (cx, cz, rad, n) => {
            for (let i = 0; i < n; i++) {
                const a = (i / n) * Math.PI * 2 + Math.PI / 4;
                const bx = cx + Math.sin(a) * rad, bz = cz + Math.cos(a) * rad;
                // seat faces outward: +z along the ring's radius
                this._put('st_bench', bx, bz, a, { r: 8, solid: true, hx: 7, hz: 3, force: true, y: 0.3 });
            }
        };
        if (big && kind < 0.22 && this.heavy && Assets.has('ct_fountain')) {
            this._put('ct_fountain', x, z, 0, { r: 36, solid: true, hx: 28, hz: 28, force: true, range: 2400, scale: 0.9 });
            benchRing(x, z, 50, 4);
        } else if (big && kind < 0.4) {
            this._put('st_centerpiece', x, z, rnd() * 6.28, { r: 30, solid: true, hx: 22, hz: 22, force: true, range: 2600 });
            for (const [dx, dz] of [[-40, 0], [40, 0], [0, -40], [0, 40]]) {
                this._put('st_planter', x + dx, z + dz, Math.atan2(dx, dz), { r: 8, solid: true, hx: 6, hz: 4, force: true });
            }
        } else if (kind < 0.62) {
            this._put('st_pool', x, z, 0, { r: 26, force: true, range: 1800, y: 0.2 });
            this._put('st_bench', x, z - 32, 0, { r: 8, solid: true, hx: 7, hz: 3, force: true });
            this._put('st_bench', x, z + 32, Math.PI, { r: 8, solid: true, hx: 7, hz: 3, force: true });
            this._put('st_topiary', x - 32, z, Math.PI / 2, { r: 8, solid: true, hx: 5, hz: 10, force: true });
            this._put('st_topiary', x + 32, z, Math.PI / 2, { r: 8, solid: true, hx: 5, hz: 10, force: true });
        } else if (kind < 0.85) {
            this._put('st_planter', x, z, 0, { r: 10, solid: true, hx: 7, hz: 4, force: true });
            benchRing(x, z, 22, 3);
            this._put('st_recycle', x + 26, z + 20, 0, { r: 5, solid: true, hx: 4, hz: 3, force: true });
        } else {
            this._put('st_shrub_bed', x - 14, z, 0, { r: 12, solid: true, hx: 13, hz: 4, force: true });
            this._put('st_shrub_bed', x + 14, z + 18, 0, { r: 12, solid: true, hx: 13, hz: 4, force: true });
            this._put('st_kiosk', x, z - 22, 0, { r: 10, solid: true, hx: 10, hz: 7, force: true, range: 1500 });
            this._put('st_bike_rack', x + 20, z - 20, 0, { r: 12, force: true });
        }
    },

    // ── rooftop billboards and signs on low-rise blocks ─────────────────────
    _rooftops(lots) {
        const rnd = mulberry32(777);
        for (const l of lots) {
            if (l.biome !== 'urban' && l.biome !== 'coastal' && l.biome !== 'academic') continue;
            if (l.h < 40 || l.h > 170) continue;
            const r = rnd();
            if (r > 0.3) continue;
            // face the nearer road axis
            const nearX = City.avenueXs.reduce((m, ax) => Math.min(m, Math.abs(ax - l.x)), 1e9);
            const nearZ = City.streetZs.reduce((m, sz) => Math.min(m, Math.abs(sz - l.z)), 1e9);
            let ry;
            if (nearX < nearZ) {
                const ax = City.avenueXs.reduce((b, v) => Math.abs(v - l.x) < Math.abs(b - l.x) ? v : b, City.avenueXs[0]);
                ry = ax > l.x ? Math.PI / 2 : -Math.PI / 2;
            } else {
                const sz = City.streetZs.reduce((b, v) => Math.abs(v - l.z) < Math.abs(b - l.z) ? v : b, City.streetZs[0]);
                ry = sz > l.z ? 0 : Math.PI;
            }
            const id = r < 0.13 ? 'st_billboard' : r < 0.2 ? 'st_logo_sign' : 'st_green_roof';
            const scale = id === 'st_green_roof' ? Math.min(l.w, l.d) / 90 : id === 'st_billboard' ? 0.9 : 1;
            this._put(id, l.x, l.z, id === 'st_green_roof' ? 0 : ry, { force: true, y: l.h + 1.2, scale, range: 3200 });
        }
    },

    // ── suburbia: yards between the houses ─────────────────────────────────
    _suburbs() {
        const rnd = mulberry32(31337);
        for (const d of City.districts) {
            if (d.biome !== 'suburban') continue;
            for (let i = 0; i < 26; i++) {
                const x = d.cx + (rnd() - 0.5) * (CELL_W - 90);
                const z = d.cz + (rnd() - 0.5) * (CELL_D - 90);
                const pick = rnd();
                if (pick < 0.25) this._put('sb_hoop', x, z, rnd() * 6.28, { r: 10, solid: true, hx: 3, hz: 3 });
                else if (pick < 0.45) this._put('sb_swing', x, z, rnd() * 6.28, { r: 16, solid: true, hx: 12, hz: 6 });
                else if (pick < 0.65) this._put('sb_bbq', x, z, rnd() * 6.28, { r: 6, solid: true, hx: 4, hz: 4 });
                else if (pick < 0.85) this._put('sb_flowers', x, z, rnd() * 6.28, { r: 9 });
                else this._put('sb_forsale', x, z, rnd() * 6.28, { r: 4 });
            }
        }
    },

    // ── the waterfront promenade ────────────────────────────────────────────
    _waterfront() {
        const port = City.districts.find(d => d.id === 'port');
        if (!port) return;
        const rnd = mulberry32(1985);
        // a line of deco lamps and palms along the district's sea-side edge
        const x0 = port.cx - CELL_W / 2 + 24;
        for (let z = port.cz - CELL_D / 2 + 40; z < port.cz + CELL_D / 2 - 40; z += 70) {
            this._put('vb_deco_lamp', x0, z, 0, { r: 5, solid: true, hx: 2, hz: 2, range: 2000 });
            if (rnd() < 0.5) this._put('vb_palm_pot', x0 + 16, z + 35, 0, { r: 6, solid: true, hx: 4, hz: 4 });
        }
        // a strip of beach life on the sand west of the city
        const beachX = port.cx - CELL_W / 2 - 160;
        for (let i = 0; i < 16; i++) {
            const z = port.cz - 360 + i * 48 + (rnd() - 0.5) * 18;
            const x = beachX + (rnd() - 0.5) * 50;
            this._put('vb_umbrella', x, z, rnd() * 6.28, { r: 8, allowRoad: true, range: 1600 });
            if (rnd() < 0.7) this._put('vb_lounger', x + 12, z + 4, Math.PI / 2, { r: 6, allowRoad: true, range: 1200 });
        }
        this._put('vb_lifeguard', beachX - 30, port.cz - 60, Math.PI / 2, { r: 14, allowRoad: true, solid: true, hx: 10, hz: 10, range: 2600 });
    },

    // ── the Underground: a wasteland you shop for contraband in ────────────
    _underground() {
        const d = City.districts.find(x => x.id === 'underground');
        if (!d) return;
        const rnd = mulberry32(666);
        const table = [
            ['wl_wreck', 0.13, 26, 18, 10], ['wl_barrel', 0.12, 6, 4, 4], ['wl_rubble', 0.1, 16, 10, 10],
            ['wl_dead_tree', 0.1, 10, 3, 3], ['wl_weeds', 0.1, 10, 0, 0], ['wl_crate', 0.08, 8, 6, 6],
            ['wl_sandbags', 0.07, 12, 10, 4], ['wl_pickup', 0.05, 26, 11, 26], ['wl_generator', 0.05, 12, 9, 7],
            ['wl_motorbike', 0.05, 12, 0, 0], ['wl_emergency', 0.04, 5, 3, 3], ['wl_hazard', 0.04, 10, 0, 0],
            ['wl_campfire', 0.03, 10, 0, 0], ['wl_bus', 0.04, 50, 14, 45]
        ];
        const total = table.reduce((s, t) => s + t[1], 0);
        let placed = 0;
        for (let i = 0; i < 260 && placed < 34; i++) {
            const x = d.cx + (rnd() - 0.5) * (CELL_W - 60);
            const z = d.cz + (rnd() - 0.5) * (CELL_D - 60);
            if (City.onSidewalk(x, z)) continue;
            let t = rnd() * total, row = table[0];
            for (const r of table) { if ((t -= r[1]) < 0) { row = r; break; } }
            const [id, , rad, hx, hz] = row;
            if (this._put(id, x, z, rnd() * 6.28, { r: rad, solid: hx > 0, hx, hz, range: 1000, margin: 8 })) placed++;
        }
    },

    // ── the Space Zone's desert floor ───────────────────────────────────────
    _desert() {
        const d = City.districts.find(x => x.biome === 'desert');
        if (!d) return;
        const rnd = mulberry32(1969);
        let placed = 0;
        for (let i = 0; i < 400 && placed < 90; i++) {
            const x = d.cx + (rnd() - 0.5) * (CELL_W - 40);
            const z = d.cz + (rnd() - 0.5) * (CELL_D - 40);
            if (City.onSidewalk(x, z)) continue;
            const p = rnd();
            const id = p < 0.45 ? 'ds_scrub' : p < 0.7 ? 'ds_boulder' : p < 0.9 ? 'ds_drift' : 'ds_arch';
            const big = id === 'ds_arch';
            if (this._put(id, x, z, rnd() * 6.28, {
                r: big ? 30 : id === 'ds_boulder' ? 10 : 8, solid: big || id === 'ds_boulder',
                hx: big ? 20 : 6, hz: big ? 8 : 6, range: big ? 2600 : 1400, scale: big ? 1.4 : 1 + rnd() * 0.6
            })) placed++;
        }
        // mesas out beyond the zone's outer edges, where nobody walks
        for (let i = 0; i < 7; i++) {
            const t = i / 6;
            const x = d.cx - CELL_W / 2 - 260 - rnd() * 200;
            const z = d.cz - CELL_D / 2 + t * CELL_D;
            this._put('ds_mesa', x, z, rnd() * 6.28, { force: true, scale: 5 + rnd() * 4, range: 6000 });
            this._put('ds_mesa', d.cx - CELL_W / 2 + t * CELL_W, d.cz - CELL_D / 2 - 280 - rnd() * 200, rnd() * 6.28, { force: true, scale: 5 + rnd() * 4, range: 6000 });
        }
    },

    // ── parks: real benches replace the brown boxes ─────────────────────────
    _parks() {
        const rnd = mulberry32(2024);
        for (const d of City.districts) {
            if (d.biome !== 'park' && d.biome !== 'forest') continue;
            const n = d.biome === 'park' ? 18 : 6;
            let placed = 0;
            for (let i = 0; i < n * 8 && placed < n; i++) {
                const x = d.cx + (rnd() - 0.5) * (CELL_W * 0.8);
                const z = d.cz + (rnd() - 0.5) * (CELL_D * 0.8);
                if (City.onSidewalk(x, z)) continue;
                const ry = rnd() * 6.28;
                if (this._put('st_bench', x, z, ry, { r: 10, solid: true, hx: 7, hz: 3 })) {
                    placed++;
                    this._put('st_recycle', x + Math.cos(ry) * 14, z - Math.sin(ry) * 14, ry, { r: 5, solid: true, hx: 4, hz: 3 });
                }
            }
            if (d.biome === 'forest') {
                for (let i = 0; i < 14; i++) {
                    const x = d.cx + (rnd() - 0.5) * (CELL_W - 80);
                    const z = d.cz + (rnd() - 0.5) * (CELL_D - 80);
                    this._put('st_boulder', x, z, rnd() * 6.28, { r: 10, solid: true, hx: 7, hz: 7, scale: 1 + rnd() });
                }
            }
        }
    },

    /** Re-upload the near instances when the camera has moved far enough. */
    refresh(force = false) {
        const cam = G.camera?.position;
        if (!cam) return;
        const dx = cam.x - this._last.x, dz = cam.z - this._last.z;
        if (!force && dx * dx + dz * dz < 50 * 50) return;
        this._last.x = cam.x; this._last.z = cam.z;
        for (const s of this.sets.values()) s.refresh(cam.x, cam.z);
    },

    update(dt) {
        if (G.inside || G.ridingMetro) return;
        this._t -= dt;
        if (this._t > 0) return;
        this._t = 0.2;
        this.refresh(false);
    }
};
