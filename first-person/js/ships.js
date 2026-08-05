/* ══════════════════════════════════════════════════════════════════════════
   HARBOUR — container ships that actually sail, dock and unload.

   What was here before: two groups of plain boxes (a slab hull, a cone bow, a
   white cube cabin, six loose container boxes) parked in open water off the
   AI Tech district — several hundred units north of the port, so they weren't
   even in the harbour they belonged to. They never moved; `World.animated`
   rocked them 0.02 radians and that was the whole simulation.

   What they do now, per ship, as one state machine:

     AWAY → INBOUND → BERTHING → UNLOADING → DEPARTING → AWAY

   Inbound they sail up the coast from the southern horizon to the berth
   alongside the pier. Berthing they warp sideways onto the quay and stop.
   Unloading, the quay's gantry crane lifts one container at a time off the
   deck stack and sets it down on the yard — the deck stack visibly empties
   and the yard stack visibly grows. When the last box lands, the manifest is
   handed to SupplyChain, which is what already feeds the GPU stock the
   datacentres burn. Then they sail back out.

   So the loop the supply chain describes — "ships dock → stock rises" — is
   for the first time something you can stand on the quay and watch.

   Cost: each ship is ~5 merged meshes (hull, deck fittings, glass, lights,
   containers) plus one instanced container mesh shared by every stack.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, SEA_X } from './state.js';
import { City } from './city.js';
import { SupplyChain } from './supply_chain.js';

/* Real operators on the Asia–US chip run, so the hulls read as specific ships
   rather than as generic freighters. Colours are the line liveries. */
const LINES = [
    { name: 'EVER ACUMEN',  hull: 0x1d7a52, house: 0x0f5c3c, stack: 0x1d7a52, port: 'KAOHSIUNG' },
    { name: 'HMM ROTTERDAM', hull: 0x1a5fa8, house: 0x123f70, stack: 0x1a5fa8, port: 'BUSAN' },
    { name: 'MAERSK EINDHOVEN', hull: 0x6fa8d8, house: 0x2c4d6e, stack: 0x8fd0f0, port: 'ROTTERDAM' },
    { name: 'ONE HELIOS',   hull: 0xc0397a, house: 0x8a2456, stack: 0xd44f8c, port: 'YOKOHAMA' }
];

const BOX_COLS = [0xc0392b, 0x2980b9, 0x27ae60, 0xd39c12, 0x7f8c8d, 0x8e44ad, 0xe07a2c];

// Deck stack shape. 4 bays × 3 rows × 2 tiers = 24 boxes to discharge.
const BAYS = 4, ROWS = 3, TIERS = 2;
const BOX = { l: 34, h: 14, w: 15 };
const BAY_PITCH = 40, ROW_PITCH = 18, TIER_PITCH = 15;

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

/* Hull profile. Forward is +X. The bow is a wedge rather than the old cone:
   a cone laid on its side reads as a pencil, and the flat sheer of a box hull
   is most of why the old ships looked like planks. */
function hullGeometries(line) {
    const g = [];
    const boot = 0x8a2020;          // boot-topping below the waterline
    const deck = 0x4a5560;

    // Parallel midbody, split at the waterline so the boot-top shows.
    g.push(paint(new THREE.BoxGeometry(300, 16, 62).translate(0, -2, 0), boot));
    g.push(paint(new THREE.BoxGeometry(300, 26, 66).translate(0, 19, 0), line.hull));
    // Sheer strake — a lighter band along the top edge breaks the slab.
    g.push(paint(new THREE.BoxGeometry(300, 4, 68).translate(0, 33, 0), deck));

    // Bow: three shrinking blocks, so the waterline tapers to a stem.
    for (let i = 0; i < 3; i++) {
        const t = i / 3, k = 1 - (i + 1) / 3.4;
        g.push(paint(new THREE.BoxGeometry(26, 16, 62 * k + 6).translate(150 + 13 + i * 26, -2, 0), boot));
        g.push(paint(new THREE.BoxGeometry(26, 26 - t * 4, 66 * k + 6).translate(150 + 13 + i * 26, 19, 0), line.hull));
    }
    // Bulbous bow, just under the surface — catches the wake nicely.
    const bulb = new THREE.SphereGeometry(11, 10, 8);
    bulb.scale(2.2, 0.8, 0.9);
    g.push(paint(bulb.translate(238, -6, 0), boot));

    // Transom stern — squared off, slightly narrower.
    g.push(paint(new THREE.BoxGeometry(34, 16, 54).translate(-167, -2, 0), boot));
    g.push(paint(new THREE.BoxGeometry(34, 26, 58).translate(-167, 19, 0), line.hull));

    // Hatch coamings the containers sit in
    for (let b = 0; b < BAYS; b++) {
        const bx = (b - (BAYS - 1) / 2) * BAY_PITCH + 30;
        g.push(paint(new THREE.BoxGeometry(BAY_PITCH - 6, 5, 58).translate(bx, 37, 0), deck));
    }
    return g;
}

/* Aft superstructure: accommodation block, bridge wings, funnel, mast.
   Returned separately from the hull so the bridge window band can be its own
   emissive material without dragging the whole hull into a second draw. */
function houseGeometries(line) {
    const g = [];
    const white = 0xdfe3e6;
    const HX = -118;                       // house sits on the quarter
    for (let f = 0; f < 4; f++) {
        g.push(paint(new THREE.BoxGeometry(46 - f * 2, 15, 54 - f * 3).translate(HX, 46 + f * 15, 0), white));
    }
    // Bridge wings — the overhang that makes a ship read as a ship
    g.push(paint(new THREE.BoxGeometry(14, 4, 78).translate(HX, 99, 0), white));
    // Funnel with the line's house band
    g.push(paint(new THREE.BoxGeometry(24, 30, 30).translate(HX - 26, 118, 0), line.house));
    g.push(paint(new THREE.BoxGeometry(26, 8, 32).translate(HX - 26, 126, 0), line.stack));
    // Radar mast + yard
    g.push(paint(new THREE.CylinderGeometry(1.6, 2.2, 34, 6).translate(HX, 123, 0), white));
    g.push(paint(new THREE.BoxGeometry(3, 3, 26).translate(HX, 132, 0), white));
    // Foremast on the forecastle
    g.push(paint(new THREE.CylinderGeometry(1.4, 2, 40, 6).translate(126, 57, 0), white));
    // Deck rails down both sides (a thin line, but it reads at distance)
    for (const s of [-1, 1]) {
        g.push(paint(new THREE.BoxGeometry(300, 1.6, 1.6).translate(0, 44, s * 33), 0x9aa3ac));
        for (let i = 0; i < 12; i++) {
            g.push(paint(new THREE.BoxGeometry(1.6, 9, 1.6).translate(-140 + i * 26, 39, s * 33), 0x9aa3ac));
        }
    }
    return g;
}

function matVC() {
    if (!matVC._m) {
        matVC._m = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 22, specular: 0x232830 });
    }
    return matVC._m;
}

export const Ships = {
    fleet: [],
    boxGeo: null,
    _crane: null,
    _yard: null,          // instanced mesh for containers landed on the quay
    _yardCount: 0,

    /* Where the harbour is. Everything below is expressed relative to this.

       The coast runs north-south at SEA_X with water to the west, so the berth
       is a quay-side one: the ship lies parallel to the shore (long axis along
       z) close enough in that the gantry on the bank can reach across it, and
       the yard it discharges into is on LAND — far enough east to be inside
       the port district rather than out on the water. */
    _berth() {
        const port = City.districts.find(d => d.id === 'port');
        const cz = port ? port.cz : -800;
        return {
            x: SEA_X - 100,           // ship centreline: ~67u of water off the bank
            z: cz + 40,
            /* The coastal ring road runs at City.ringX[0], only 30 units inland
               of the waterline — so "just ashore" is ON the carriageway. Both
               the gantry legs and the yard sit east of its far pavement. */
            railX: SEA_X + 140,       // gantry legs, clear of the ring road
            yardX: SEA_X + 210,       // container yard, ashore behind the crane
            yardZ: cz + 130
        };
    },

    build(scene) {
        const berth = this._berth();
        /* Put the yard on ground nothing else has claimed.

           `_berth` picks the yard from fixed offsets, and moving it clear of
           the coastal ring road put it straight inside the GPU Warehouse's
           footprint — every discharged container spawned inside the building
           and z-fought its way out through the walls. Search along the quay for
           a clear rectangle instead of trusting a hardcoded offset. */
        const YW = 200, YD = 110;
        const clear = (x, z) => !(G.colliders || []).some(c =>
            x + YW / 2 > c.x0 - 12 && x - YW / 2 < c.x1 + 12 &&
            z + YD / 2 > c.z0 - 12 && z - YD / 2 < c.z1 + 12);
        let placed = false;
        for (const dz of [0, 190, -190, 320, -320, 450, -450]) {
            for (const dx of [0, 90, 180, 270]) {
                if (clear(berth.yardX + dx, berth.yardZ + dz)) {
                    berth.yardX += dx; berth.yardZ += dz; placed = true; break;
                }
            }
            if (placed) break;
        }
        if (!placed) console.warn('[Ships] no clear ground for the container yard');
        this.berth = berth;

        // One geometry shared by every container everywhere.
        this.boxGeo = new THREE.BoxGeometry(BOX.l, BOX.h, BOX.w);

        // Quay-side yard stack — grows as ships discharge.
        this._yard = new THREE.InstancedMesh(
            this.boxGeo, new THREE.MeshLambertMaterial(), 96);
        this._yard.count = 0;
        this._yard.frustumCulled = false;
        scene.add(this._yard);
        this._yardCount = 0;
        this._dummy = new THREE.Object3D();
        this._col = new THREE.Color();

        // Ship-to-shore gantry that does the lifting. Separate from the
        // `crane` building type in world.js — that one is decorative and sits
        // in the yard; this one straddles the berth.
        this._buildGantry(scene, berth);

        for (let i = 0; i < 3; i++) {
            const line = LINES[i % LINES.length];
            const ship = this._buildShip(line);
            scene.add(ship.obj);
            // Stagger them so one is always alongside and the others are at sea.
            // AWAY parks itself each frame; INBOUND does not, so the first ship
            // has to be put on the water here or it starts at the origin —
            // in the middle of the city, on land.
            ship.state = i === 0 ? 'INBOUND' : 'AWAY';
            ship.wait = i * 55;
            ship.obj.position.set(berth.x - 520, 0, berth.z + 900);
            ship.obj.rotation.y = -Math.PI / 2;
            this.fleet.push(ship);
        }
    },

    _buildShip(line) {
        const obj = new THREE.Group();
        obj.name = 'ship_' + line.name;

        obj.add(new THREE.Mesh(mergeGeometries(hullGeometries(line), false), matVC()));
        obj.add(new THREE.Mesh(mergeGeometries(houseGeometries(line), false), matVC()));

        // Bridge window band — one emissive strip, lit day and night.
        const glass = new THREE.Mesh(
            new THREE.BoxGeometry(3, 8, 50),
            new THREE.MeshBasicMaterial({ color: 0x9fd8f0 })
        );
        glass.position.set(-95, 92, 0);
        obj.add(glass);

        // Navigation lights: red to port, green to starboard, white masthead.
        const navLights = [];
        const lamp = (hex, x, y, z) => {
            const m = new THREE.Mesh(new THREE.SphereGeometry(2.6, 6, 5),
                new THREE.MeshBasicMaterial({ color: hex, toneMapped: false }));
            m.position.set(x, y, z);
            navLights.push(m);
            obj.add(m);
        };
        lamp(0xff3b30, -118, 99, 39);
        lamp(0x30d158, -118, 99, -39);
        lamp(0xffffff, 126, 79, 0);
        lamp(0xffffff, -118, 158, 0);

        // Deck cargo, one instance per slot so boxes can be removed one by one.
        const deck = new THREE.InstancedMesh(this.boxGeo, new THREE.MeshLambertMaterial(),
            BAYS * ROWS * TIERS);
        deck.frustumCulled = false;
        obj.add(deck);

        const slots = [];
        for (let b = 0; b < BAYS; b++) {
            for (let r = 0; r < ROWS; r++) {
                for (let t = 0; t < TIERS; t++) {
                    slots.push({
                        x: (b - (BAYS - 1) / 2) * BAY_PITCH + 30,
                        y: 46 + t * TIER_PITCH,
                        z: (r - (ROWS - 1) / 2) * ROW_PITCH,
                        // discharge order: top tier first, then outboard in
                        order: (TIERS - 1 - t) * 100 + b * 10 + r
                    });
                }
            }
        }
        slots.sort((a, b) => a.order - b.order);

        const ship = {
            obj, line, deck, slots,
            navLights,
            loaded: slots.length,
            state: 'AWAY', wait: 0, t: 0,
            speed: 0, heading: 0,
            manifest: null
        };
        this._refreshDeck(ship);
        return ship;
    },

    /** Redraw the deck stack for however many boxes are still aboard. */
    _refreshDeck(ship) {
        const d = this._dummy, c = this._col;
        for (let i = 0; i < ship.loaded; i++) {
            const s = ship.slots[ship.slots.length - 1 - i];   // keep the bottom rows longest
            d.position.set(s.x, s.y, s.z);
            d.rotation.set(0, 0, 0);
            d.scale.setScalar(1);
            d.updateMatrix();
            ship.deck.setMatrixAt(i, d.matrix);
            ship.deck.setColorAt(i, c.set(BOX_COLS[(i * 3) % BOX_COLS.length]));
        }
        ship.deck.count = ship.loaded;
        ship.deck.instanceMatrix.needsUpdate = true;
        if (ship.deck.instanceColor) ship.deck.instanceColor.needsUpdate = true;
    },

    /* Ship-to-shore gantry: legs either side of the berth, a boom out over the
       water and a trolley that runs along it with a spreader on wires. */
    _buildGantry(scene, berth) {
        /* Ship-to-shore gantry. The legs stand on the bank at berth.railX; the
           boom runs WEST out over the berthed ship and EAST back over the yard,
           so one trolley travel covers the whole discharge. Two leg pairs
           spaced along the quay (z), the way a real STS crane straddles its
           rail beams. */
        const H = 150;
        const g = [];
        const steel = 0xd8a02c, dark = 0x6a5218;
        const RX = berth.railX;
        for (const oz of [-58, 58]) {
            for (const ox of [-34, 34]) {
                g.push(paint(new THREE.BoxGeometry(10, H, 10).translate(RX + ox, H / 2, berth.z + oz), steel));
            }
            // portal beam tying each leg pair together
            g.push(paint(new THREE.BoxGeometry(88, 12, 12).translate(RX, H, berth.z + oz), steel));
        }
        // Boom: spans from clear of the ship's outboard side (west) to past the
        // far end of the yard (east), so one trolley travel covers a whole lift.
        const boomMin = berth.x - 90, boomMax = berth.yardX + 130;
        const boomLen = boomMax - boomMin, boomCx = (boomMin + boomMax) / 2;
        for (const oz of [-14, 14]) {
            g.push(paint(new THREE.BoxGeometry(boomLen, 12, 12)
                .translate(boomCx, H + 12, berth.z + oz), steel));
        }
        // Diagonal-ish bracing, faked with a shallow box so the boom isn't bare
        g.push(paint(new THREE.BoxGeometry(boomLen * 0.7, 5, 30)
            .translate(boomCx, H + 26, berth.z), steel));
        // Counterweight + machinery house on the landward end
        g.push(paint(new THREE.BoxGeometry(34, 26, 76).translate(boomMax - 30, H + 24, berth.z), dark));
        g.push(paint(new THREE.BoxGeometry(44, 26, 64).translate(RX + 60, H - 18, berth.z), dark));
        // Operator cab, hung under the boom over the water side
        g.push(paint(new THREE.BoxGeometry(16, 14, 16).translate(RX - 60, H - 4, berth.z + 22), 0x30363d));
        const mesh = new THREE.Mesh(mergeGeometries(g, false), matVC());
        scene.add(mesh);

        // Trolley + spreader — the moving half.
        const trolley = new THREE.Group();
        const tBody = new THREE.Mesh(paint(new THREE.BoxGeometry(30, 12, 34), 0x4a4a4a), matVC());
        trolley.add(tBody);
        const wires = new THREE.Mesh(paint(new THREE.BoxGeometry(1.8, 1, 1.8), 0x1a1a1a), matVC());
        const spreader = new THREE.Mesh(paint(new THREE.BoxGeometry(40, 5, 20), 0xcc5533), matVC());
        trolley.add(wires, spreader);
        trolley.position.set(RX, H + 4, berth.z);
        scene.add(trolley);

        // The box currently in the spreader's grip.
        const carried = new THREE.Mesh(this.boxGeo, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
        carried.visible = false;
        scene.add(carried);

        this._crane = { mesh, trolley, wires, spreader, carried, H, berth, hoist: 0, atX: RX };
    },

    /** Drop a discharged container onto the quay stack. */
    _landBox(x, y, z, hex) {
        if (this._yardCount >= this._yard.instanceMatrix.count) this._yardCount = 0;  // recycle the yard
        const d = this._dummy;
        d.position.set(x, y, z);
        d.rotation.set(0, 0, 0);
        d.scale.setScalar(1);
        d.updateMatrix();
        this._yard.setMatrixAt(this._yardCount, d.matrix);
        this._yard.setColorAt(this._yardCount, this._col.set(hex));
        this._yardCount++;
        this._yard.count = this._yardCount;
        this._yard.instanceMatrix.needsUpdate = true;
        if (this._yard.instanceColor) this._yard.instanceColor.needsUpdate = true;
    },

    /** Where the next discharged box goes in the yard. */
    _yardSlot() {
        const b = this.berth;
        const i = this._yardCount;
        const COLS = 4, ROWS_Y = 4;
        const col = i % COLS, row = Math.floor(i / COLS) % ROWS_Y, tier = Math.floor(i / (COLS * ROWS_Y));
        return {
            x: b.yardX + (col - (COLS - 1) / 2) * 42,
            y: BOX.h / 2 + tier * BOX.h,
            z: b.yardZ + (row - (ROWS_Y - 1) / 2) * 20
        };
    },

    update(dt, t) {
        if (!this.fleet.length) return;
        const b = this.berth;
        // Only one ship can be alongside; the rest hold off the coast.
        const berthTaken = this.fleet.some(s => s.state === 'BERTHING' || s.state === 'UNLOADING');

        for (const s of this.fleet) {
            switch (s.state) {
                case 'AWAY': {
                    // Hold at sea, well south, drifting slowly north.
                    s.wait -= dt;
                    s.obj.position.set(b.x - 520, 0, b.z + 1500 + s.wait * 3);
                    s.obj.rotation.y = 0;
                    s.speed = 0;
                    if (s.wait <= 0 && !berthTaken) {
                        s.state = 'INBOUND';
                        s.obj.position.set(b.x - 520, 0, b.z + 1500);
                    }
                    break;
                }
                case 'INBOUND': {
                    // Run up the coast, then swing in toward the berth.
                    s.speed = Math.min(58, s.speed + dt * 14);
                    const p = s.obj.position;
                    const dx = b.x - p.x, dz = b.z - p.z;
                    const dist = Math.hypot(dx, dz);
                    if (dist < 30) { s.state = 'BERTHING'; s.t = 0; break; }
                    const ux = dx / dist, uz = dz / dist;
                    p.x += ux * s.speed * dt;
                    p.z += uz * s.speed * dt;
                    // Bow = +X, so yaw so +X points along travel.
                    const want = Math.atan2(ux, uz) - Math.PI / 2;
                    s.obj.rotation.y = this._easeAngle(s.obj.rotation.y, want, dt * 0.7);
                    break;
                }
                case 'BERTHING': {
                    // Warp parallel to the quay and stop.
                    s.t += dt;
                    s.speed = Math.max(0, s.speed - dt * 26);
                    const p = s.obj.position;
                    p.x += (b.x - p.x) * Math.min(1, dt * 0.9);
                    p.z += (b.z - p.z) * Math.min(1, dt * 0.9);
                    // Alongside heading: bow north, i.e. -z.
                    s.obj.rotation.y = this._easeAngle(s.obj.rotation.y, Math.PI / 2, dt * 1.1);
                    if (s.t > 4) { s.state = 'UNLOADING'; s.t = 0; s.lift = null; }
                    break;
                }
                case 'UNLOADING': {
                    this._stepDischarge(s, dt);
                    break;
                }
                case 'DEPARTING': {
                    s.speed = Math.min(64, s.speed + dt * 10);
                    const p = s.obj.position;
                    p.z += s.speed * dt;                       // back out to the south
                    p.x -= s.speed * 0.35 * dt;                // and offshore
                    s.obj.rotation.y = this._easeAngle(s.obj.rotation.y, -Math.PI / 2, dt * 0.5);
                    if (p.z > b.z + 1500) {
                        s.state = 'AWAY';
                        s.wait = 70 + Math.random() * 60;
                        s.loaded = s.slots.length;             // reloaded overseas
                        s.line = LINES[(LINES.indexOf(s.line) + 1) % LINES.length];
                        this._refreshDeck(s);
                    }
                    break;
                }
            }

            // Seakeeping: roll and pitch scale with speed, so a moored ship is
            // still and a ship under way works in the swell.
            const w = 0.004 + s.speed * 0.00018;
            s.obj.rotation.z = Math.sin(t * 0.6 + s.obj.position.z * 0.002) * w * 4;
            s.obj.position.y = Math.sin(t * 0.8 + s.obj.position.z * 0.003) * (0.5 + s.speed * 0.02);

            // Nav lights only read at night.
            const night = G.weatherSys?.night ?? 0;
            for (const l of s.navLights) l.visible = night > 0.25;
        }

        this._updateCrane(dt);
    },

    /* One container per lift: trolley tracks out over the ship, spreader
       lowers, grabs, hoists, tracks back over the yard, lowers, releases. */
    _stepDischarge(ship, dt) {
        const cr = this._crane;
        if (!cr) { this._finishDischarge(ship); return; }

        if (!ship.lift) {
            if (ship.loaded <= 0) { this._finishDischarge(ship); return; }
            // Take the next box off the top of the stack.
            const idx = ship.loaded - 1;
            const slot = ship.slots[ship.slots.length - 1 - idx];
            ship.lift = {
                phase: 'reach', p: 0,
                fromX: ship.obj.position.x + slot.z,   // ship lies bow-north: local z runs along world x
                fromZ: ship.obj.position.z - slot.x,
                fromY: slot.y,
                hex: BOX_COLS[(idx * 3) % BOX_COLS.length],
                to: this._yardSlot()
            };
            ship.loaded--;
            this._refreshDeck(ship);
            cr.carried.material.color.set(ship.lift.hex);
        }

        const L = ship.lift;
        L.p += dt * 0.75;
        const clamp01 = v => Math.max(0, Math.min(1, v));

        if (L.phase === 'reach') {
            // Trolley runs out over the box and the spreader comes down.
            const k = clamp01(L.p);
            cr.trolley.position.x = this._lerp(cr.atX, L.fromX, k);
            cr.trolley.position.z = this._lerp(cr.berth.z, L.fromZ, k);
            cr.hoist = this._lerp(20, cr.H - L.fromY, k);
            cr.carried.visible = false;
            if (k >= 1) { L.phase = 'hoist'; L.p = 0; }
        } else if (L.phase === 'hoist') {
            const k = clamp01(L.p);
            cr.hoist = this._lerp(cr.H - L.fromY, 20, k);
            cr.carried.visible = true;
            cr.carried.position.set(cr.trolley.position.x, cr.H + 2 - cr.hoist - BOX.h, cr.trolley.position.z);
            if (k >= 1) { L.phase = 'track'; L.p = 0; }
        } else if (L.phase === 'track') {
            const k = clamp01(L.p);
            cr.trolley.position.x = this._lerp(L.fromX, L.to.x, k);
            cr.trolley.position.z = this._lerp(L.fromZ, L.to.z, k);
            cr.carried.position.set(cr.trolley.position.x, cr.H + 2 - cr.hoist - BOX.h, cr.trolley.position.z);
            if (k >= 1) { L.phase = 'land'; L.p = 0; }
        } else {
            const k = clamp01(L.p);
            cr.hoist = this._lerp(20, cr.H - L.to.y - BOX.h, k);
            cr.carried.position.set(cr.trolley.position.x, cr.H + 2 - cr.hoist - BOX.h, cr.trolley.position.z);
            if (k >= 1) {
                this._landBox(L.to.x, L.to.y, L.to.z, L.hex);
                cr.carried.visible = false;
                ship.lift = null;
            }
        }
    },

    _finishDischarge(ship) {
        ship.state = 'DEPARTING';
        ship.lift = null;
        if (this._crane) this._crane.carried.visible = false;
        try {
            // Tell the supply chain to stop guessing on a timer — from here on
            // the stock rises only when a ship you can see finishes unloading.
            SupplyChain.harbourLive = true;
            SupplyChain.deliver?.();
            G.ui?.addToast?.(`⚓ ${ship.line.name} discharged — ex ${ship.line.port}`, 'info');
        } catch (e) { /* the harbour must not take the frame down */ }
    },

    _updateCrane(dt) {
        const cr = this._crane;
        if (!cr) return;
        // Idle: park the trolley over the yard with the spreader up.
        const anyLifting = this.fleet.some(s => s.state === 'UNLOADING' && s.lift);
        if (!anyLifting) {
            cr.trolley.position.x += (cr.atX - cr.trolley.position.x) * Math.min(1, dt);
            cr.trolley.position.z += (cr.berth.z - cr.trolley.position.z) * Math.min(1, dt);
            cr.hoist += (16 - cr.hoist) * Math.min(1, dt);
        }
        // Wires stretch to the spreader; the spreader hangs at the hoist depth.
        cr.wires.scale.y = Math.max(1, cr.hoist);
        cr.wires.position.y = -cr.hoist / 2;
        cr.spreader.position.y = -cr.hoist;
    },

    _lerp(a, b, k) { return a + (b - a) * k; },

    _easeAngle(cur, want, k) {
        let d = want - cur;
        while (d > Math.PI) d -= Math.PI * 2;
        while (d < -Math.PI) d += Math.PI * 2;
        return cur + d * Math.min(1, k);
    }
};
