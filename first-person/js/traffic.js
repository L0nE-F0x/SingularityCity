/* ══════════════════════════════════════════════════════════════════════════
   TRAFFIC & AMBIENT LIFE — premium cars (open-cabin glass + occupants), VIP
   limos, Nvidia truck, vans, helicopters, ad blimps, rocket launches.
   Ambient fleet is individual meshes (≤16) so glass stays truly see-through.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G, CITY_W, CITY_D } from './state.js';
import { SPACE_ORGS, NEWS, FOUNDERS, LAB_HQ, LABS } from './data.js';
import {
    fetchLaunches, matchLaunchesToOrgs, getCountdown, LAUNCH_GRACE_MS
} from '../../shared/space_live.js';
import * as TEX from './textures.js';
import { City, LANE_W } from './city.js';

function paint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const arr = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
    return geo;
}

/** Shared glass — low opacity, no depthWrite so seats/CEOs read through. */
function glassMat(opacity = 0.16) {
    return new THREE.MeshStandardMaterial({
        color: 0xc5e4f8, metalness: 0.2, roughness: 0.04,
        transparent: true, opacity: Math.min(0.3, Math.max(0.1, opacity)),
        depthWrite: false, side: THREE.DoubleSide
    });
}

function skinMat(hex = 0xe8b98e) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.72, metalness: 0.02 });
}
function clothMat(hex = 0x1e293b) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.78, metalness: 0.05 });
}
function paintMat(hex) {
    return new THREE.MeshStandardMaterial({ color: hex, roughness: 0.28, metalness: 0.62 });
}
function chromeMat() {
    return new THREE.MeshStandardMaterial({ color: 0xc8d0d8, roughness: 0.22, metalness: 0.9 });
}
function tireMat() {
    return new THREE.MeshStandardMaterial({ color: 0x0e1014, roughness: 0.92, metalness: 0.08 });
}
function darkIntMat() {
    return new THREE.MeshStandardMaterial({ color: 0x12161e, roughness: 0.85, metalness: 0.12 });
}

/** Seated figure — head + torso + lapel; readable through cabin glass. */
function buildOccupant(opts = {}) {
    const g = new THREE.Group();
    const skin = skinMat(opts.skin || 0xe8b98e);
    const suit = clothMat(opts.suit || 0x1e293b);
    const hairC = opts.hair || 0x2a2118;

    const torso = new THREE.Mesh(new THREE.BoxGeometry(5.5, 7.5, 6.2), suit);
    torso.position.y = 5.5;
    const lap = new THREE.Mesh(new THREE.BoxGeometry(5.2, 3.5, 5.5), suit);
    lap.position.set(0, 1.6, 0.4);
    const head = new THREE.Mesh(new THREE.SphereGeometry(2.9, 12, 10), skin);
    head.position.y = 11.2;
    const hair = new THREE.Mesh(
        new THREE.SphereGeometry(3.05, 10, 8),
        new THREE.MeshStandardMaterial({ color: hairC, roughness: 0.92 })
    );
    hair.position.set(0, 12.4, -0.35);
    hair.scale.set(1, 0.52, 1.05);
    if (opts.accent != null) {
        const pin = new THREE.Mesh(
            new THREE.BoxGeometry(1.6, 2.4, 0.45),
            new THREE.MeshBasicMaterial({ color: opts.accent })
        );
        pin.position.set(2.9, 6.5, 1.5);
        g.add(pin);
    }
    // simple arms on lap
    for (const s of [-1, 1]) {
        const arm = new THREE.Mesh(new THREE.BoxGeometry(1.8, 2.2, 4.5), suit);
        arm.position.set(s * 3.4, 4.2, 1.2);
        g.add(arm);
    }
    g.add(torso, lap, head, hair);
    return mergeByMaterial(g);
}

function addWheels(g, positions, radius = 5.4, width = 4.2) {
    const tireM = tireMat();
    const hubM = chromeMat();
    const wheels = new THREE.Group();
    for (const [dx, dz] of positions) {
        const tire = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, width, 14), tireM);
        tire.rotation.x = Math.PI / 2;
        tire.position.set(dx, radius, dz);
        const hub = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.45, radius * 0.45, width + 0.3, 12), hubM);
        hub.rotation.x = Math.PI / 2;
        hub.position.set(dx, radius, dz);
        wheels.add(tire, hub);
    }
    g.add(wheels);
    return wheels;
}

function addHeadTailLamps(g, noseX, tailX, y = 9, zSpread = 6.2) {
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    const tailM = new THREE.MeshBasicMaterial({ color: 0xff2a2a });
    for (const s of [-1, 1]) {
        const h = new THREE.Mesh(new THREE.BoxGeometry(2.2, 3.2, 4.2), lampM);
        h.position.set(noseX, y, s * zSpread);
        const t = new THREE.Mesh(new THREE.BoxGeometry(2, 2.6, 3.6), tailM);
        t.position.set(tailX, y + 0.8, s * (zSpread + 0.3));
        g.add(h, t);
    }
    g.userData.headLampMat = lampM;
}

/** Premium sedan. Forward = +X. OPEN cabin (pillars + roof) + true glass + driver. */
/* Collapse a freshly-built vehicle into one mesh per material.
   The vehicle builders below are written as dozens of little boxes, which is
   the right way to author them and the wrong way to draw them: at 44 meshes a
   car, a fleet of 14 was 614 draw calls — more than the rest of the city put
   together. Nothing on these vehicles animates independently (the wheels are
   static geometry), so everything sharing a material can be baked into a
   single buffer at build time. Same silhouette, ~4 draw calls per vehicle. */
function mergeByMaterial(group) {
    group.updateMatrixWorld(true);
    // Bake transforms RELATIVE to the group, not in world space: some builders
    // return a group that the caller then positions, and baking world matrices
    // would apply that placement twice.
    const toLocal = new THREE.Matrix4().copy(group.matrixWorld).invert();
    const _m = new THREE.Matrix4();
    const buckets = new Map();
    const keep = [];        // non-mesh children — sprites, lights, points
    group.traverse(o => {
        if (o === group) return;
        if (!o.isMesh || o.isInstancedMesh) {
            // Anything that is not mergeable geometry has to be carried across
            // by hand. Dropping it is what made every VIP limo lose its floating
            // founder name plate.
            if (o.isSprite || o.isLight || o.isPoints || o.isLine) keep.push(o);
            return;
        }
        const m = Array.isArray(o.material) ? o.material[0] : o.material;
        if (!buckets.has(m)) buckets.set(m, []);
        const g = o.geometry.clone();
        g.applyMatrix4(_m.multiplyMatrices(toLocal, o.matrixWorld));
        // merge needs matching attribute sets; drop anything exotic
        for (const k of Object.keys(g.attributes)) {
            if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
        }
        buckets.get(m).push(g);
    });
    const out = new THREE.Group();
    out.name = group.name;
    for (const [mat, geos] of buckets) {
        const merged = geos.length === 1 ? geos[0] : mergeGeometries(geos, false);
        if (!merged) continue;                 // mismatched attributes — skip rather than crash
        out.add(new THREE.Mesh(merged, mat));
    }
    // Nothing merged (shouldn't happen) — keep the original rather than a blank
    if (!out.children.length) return group;

    // Re-attach the survivors at their position relative to the group.
    for (const o of keep) {
        _m.multiplyMatrices(toLocal, o.matrixWorld);
        _m.decompose(o.position, o.quaternion, o.scale);
        out.add(o);
    }
    // The geometry was baked with the group's OWN transform divided out, so the
    // caller's placement has to travel with the result. Without this a builder
    // that scales before merging (the limo's 1.55x stretch) silently came back
    // unstretched.
    out.position.copy(group.position);
    out.quaternion.copy(group.quaternion);
    out.scale.copy(group.scale);
    // Builders hang animation handles and material refs here; the merge used to
    // return a blank group and every one of those reads came back undefined.
    Object.assign(out.userData, group.userData);
    return out;
}

function buildSedan(bodyHex, opts = {}) {
    const g = new THREE.Group();
    const bodyM = paintMat(bodyHex);
    const chromeM = chromeMat();
    const darkM = darkIntMat();
    const gw = glassMat(opts.glassOpacity ?? 0.15);

    // lower body / sills
    const body = new THREE.Mesh(new THREE.BoxGeometry(50, 10, 20.5), bodyM);
    body.position.set(0, 9, 0);
    // hood / boot (not a solid cabin block)
    const hood = new THREE.Mesh(new THREE.BoxGeometry(15, 4.2, 18.5), bodyM);
    hood.position.set(15.5, 14.6, 0);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(13, 4.2, 18.5), bodyM);
    boot.position.set(-17, 14.6, 0);
    // beltline
    const belt = new THREE.Mesh(new THREE.BoxGeometry(26, 1.6, 21), bodyM);
    belt.position.set(-1.5, 14.3, 0);
    // roof slab only
    const roof = new THREE.Mesh(new THREE.BoxGeometry(23, 2.0, 17.2), bodyM);
    roof.position.set(-2, 24.2, 0);
    // A/B/C pillars — thin, leave glass bays open
    const pillars = [
        [10, 8.7], [10, -8.7], [-4, 8.7], [-4, -8.7], [-14, 8.7], [-14, -8.7]
    ];
    for (const [px, pz] of pillars) {
        const pillar = new THREE.Mesh(new THREE.BoxGeometry(2.0, 9.5, 1.5), bodyM);
        pillar.position.set(px, 19, pz);
        g.add(pillar);
    }

    // glass planes — true see-through
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 8.5), gw);
    wind.position.set(10.5, 19.2, 0); wind.rotation.y = Math.PI / 2;
    const rear = new THREE.Mesh(new THREE.PlaneGeometry(16.5, 8), gw);
    rear.position.set(-15, 19.2, 0); rear.rotation.y = -Math.PI / 2;
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), gw);
    sideL.position.set(-2, 19.2, 9.9);
    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(22, 8), gw);
    sideR.position.set(-2, 19.2, -9.9); sideR.rotation.y = Math.PI;

    // interior: floor, seats, dash
    const floor = new THREE.Mesh(new THREE.BoxGeometry(24, 1.2, 16), darkM);
    floor.position.set(-2, 11.2, 0);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 16), darkM);
    dash.position.set(8, 14.5, 0);
    const seatFront = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 15), darkM);
    seatFront.position.set(2, 13.5, 0);
    const seatBack = new THREE.Mesh(new THREE.BoxGeometry(8, 5.5, 15), darkM);
    seatBack.position.set(-10, 13.5, 0);
    const seatBackRest = new THREE.Mesh(new THREE.BoxGeometry(2.5, 8, 15), darkM);
    seatBackRest.position.set(-13.5, 17, 0);

    // driver (right-hand-ish of cabin from +X nose — left of car for LHD visual)
    if (opts.driver !== false) {
        const driver = buildOccupant({ suit: 0x243044, hair: 0x1a1410 });
        driver.scale.setScalar(0.85);
        driver.position.set(1, 11.5, 4);
        g.add(driver);
    }
    if (opts.passenger) {
        const pax = buildOccupant({ suit: opts.passengerSuit || 0x334155 });
        pax.scale.setScalar(0.82);
        pax.position.set(1, 11.5, -4);
        g.add(pax);
    }

    // mirrors + grille + chrome bumpers
    for (const s of [-1, 1]) {
        const mir = new THREE.Mesh(new THREE.BoxGeometry(1.2, 2.5, 3.2), chromeM);
        mir.position.set(12, 16.5, s * 11.2);
        g.add(mir);
    }
    const grille = new THREE.Mesh(new THREE.BoxGeometry(1.5, 5, 14), chromeM);
    grille.position.set(25.2, 10, 0);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 20), chromeM); fb.position.set(26.5, 6.5, 0);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 20), chromeM); rb.position.set(-26.5, 6.5, 0);

    addWheels(g, [[15, 9.8], [15, -9.8], [-15, 9.8], [-15, -9.8]]);
    addHeadTailLamps(g, 27, -26.5);

    g.add(body, hood, boot, belt, roof, wind, rear, sideL, sideR,
        floor, dash, seatFront, seatBack, seatBackRest, grille, fb, rb);
    g.userData.paintM = bodyM;
    g.userData.isDetailCar = true;
    return mergeByMaterial(g);
}

/** VIP limousine — stretched cabin, rear CEO figure, driver, floating name plate. */
function buildVipLimo(founder) {
    const labCol = new THREE.Color(founder.color || '#334155');
    const hex = labCol.getHex() === 0xffffff ? 0xd8dde6 : labCol.getHex();
    const g = buildSedan(hex, { glassOpacity: 0.14, driver: true, passenger: false });
    // Stretch into limo proportions by scaling the BODY GEOMETRY, not the group.
    // A group scale would also stretch the passengers, the door plate and the
    // billboarded name tag added below — and a non-uniform scale on a rotating
    // parent makes a Sprite child wobble as the car turns.
    for (const child of g.children) {
        if (child.isMesh) child.geometry.scale(1.55, 1.08, 1.1);
    }

    // rear CEO (extra large for street readability)
    const ceo = buildOccupant({
        suit: 0x0f172a,
        accent: hex,
        hair: founder.name && /elon/i.test(founder.name) ? 0xc4a882 : 0x2a2118
    });
    ceo.scale.set(0.95, 0.95, 0.95);
    // ×1.55 / ×1.08 to sit where it did in the sedan's stretched body
    ceo.position.set(-18.6, 12.1, 0);
    g.add(ceo);

    // gold door plate
    const plate = new THREE.Mesh(
        new THREE.BoxGeometry(8, 2.2, 0.4),
        new THREE.MeshStandardMaterial({ color: 0xfbbf24, metalness: 0.85, roughness: 0.25 })
    );
    plate.position.set(-9.3, 13, 11.4);
    g.add(plate);

    // floating name tag
    const canvas = document.createElement('canvas');
    canvas.width = 256; canvas.height = 64;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'rgba(15,23,42,0.92)';
    ctx.beginPath();
    if (ctx.roundRect) { ctx.roundRect(8, 8, 240, 48, 8); ctx.fill(); } else { ctx.fillRect(8, 8, 240, 48); }
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 28px system-ui,sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(founder.name || 'CEO', 128, 42);
    const tex = new THREE.CanvasTexture(canvas);
    const spr = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: true }));
    spr.scale.set(40, 10, 1);
    spr.position.set(0, 36, 0);
    g.add(spr);
    g.userData.nameSprite = spr;
    g.userData.founder = founder;
    return mergeByMaterial(g);
}

/** Delivery van — tall cargo box, open cab glass, visible driver. */
function buildDeliveryVan(bodyHex) {
    const g = new THREE.Group();
    const bodyM = paintMat(bodyHex);
    const darkM = darkIntMat();
    const chromeM = chromeMat();
    const gw = glassMat(0.16);

    // chassis
    const chassis = new THREE.Mesh(new THREE.BoxGeometry(48, 8, 22), bodyM);
    chassis.position.set(0, 8, 0);
    // cargo box (rear) — solid, not a brown mush: paneled look
    const cargo = new THREE.Mesh(new THREE.BoxGeometry(30, 22, 21), bodyM);
    cargo.position.set(-8, 20, 0);
    const cargoRoof = new THREE.Mesh(new THREE.BoxGeometry(30.5, 1.5, 21.5), bodyM);
    cargoRoof.position.set(-8, 31.5, 0);
    // cab nose
    const cab = new THREE.Mesh(new THREE.BoxGeometry(16, 10, 20), bodyM);
    cab.position.set(18, 14, 0);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(14, 1.8, 18), bodyM);
    cabRoof.position.set(17, 26, 0);
    // pillars only around cab
    for (const [px, pz] of [[22, 9.2], [22, -9.2], [12, 9.2], [12, -9.2]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(1.8, 10, 1.4), bodyM);
        p.position.set(px, 20, pz);
        g.add(p);
    }
    // glass
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(18, 10), gw);
    wind.position.set(26.2, 20, 0); wind.rotation.y = Math.PI / 2;
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), gw);
    sideL.position.set(17, 20, 10.2);
    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(12, 9), gw);
    sideR.position.set(17, 20, -10.2); sideR.rotation.y = Math.PI;

    // interior seat + driver
    const seat = new THREE.Mesh(new THREE.BoxGeometry(8, 6, 16), darkM);
    seat.position.set(16, 13, 0);
    const driver = buildOccupant({ suit: 0x1e3a5f });
    driver.scale.setScalar(0.9);
    driver.position.set(16, 12, 3.5);
    g.add(driver);

    // brand stripe on cargo
    const stripe = new THREE.Mesh(
        new THREE.BoxGeometry(24, 5, 0.4),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    stripe.position.set(-8, 22, 10.7);
    const stripe2 = stripe.clone(); stripe2.position.z = -10.7;

    addWheels(g, [[18, 10.5], [18, -10.5], [-14, 10.5], [-14, -10.5]], 5.6, 4.5);
    addHeadTailLamps(g, 27, -24, 10, 7);

    const fb = new THREE.Mesh(new THREE.BoxGeometry(3, 4, 20), chromeM); fb.position.set(27, 6, 0);
    g.add(chassis, cargo, cargoRoof, cab, cabRoof, wind, sideL, sideR, seat, stripe, stripe2, fb);
    g.userData.paintM = bodyM;
    return mergeByMaterial(g);
}

/** Nvidia-style supply truck — open cab glass, driver, green GPU container. */
function buildSupplyTruck() {
    const g = new THREE.Group();
    const green = paintMat(0x2f7a3e);
    const dark = darkIntMat();
    const chromeM = chromeMat();
    const gw = glassMat(0.18);
    const nvidia = 0x76b900;

    // chassis rail
    const rail = new THREE.Mesh(new THREE.BoxGeometry(88, 4, 18), dark);
    rail.position.set(0, 6, 0);

    // cab — open pillars, not a solid brown box
    const cabBase = new THREE.Mesh(new THREE.BoxGeometry(24, 10, 22), green);
    cabBase.position.set(30, 12, 0);
    const cabRoof = new THREE.Mesh(new THREE.BoxGeometry(20, 2, 20), green);
    cabRoof.position.set(29, 28, 0);
    for (const [px, pz] of [[38, 10], [38, -10], [22, 10], [22, -10]]) {
        const p = new THREE.Mesh(new THREE.BoxGeometry(2.2, 12, 1.8), green);
        p.position.set(px, 20, pz);
        g.add(p);
    }
    // glass cabin
    const wind = new THREE.Mesh(new THREE.PlaneGeometry(20, 12), gw);
    wind.position.set(42.2, 20, 0); wind.rotation.y = Math.PI / 2;
    const rearCab = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), gw);
    rearCab.position.set(18.5, 20, 0); rearCab.rotation.y = -Math.PI / 2;
    const sideL = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), gw);
    sideL.position.set(30, 20, 11.2);
    const sideR = new THREE.Mesh(new THREE.PlaneGeometry(18, 11), gw);
    sideR.position.set(30, 20, -11.2); sideR.rotation.y = Math.PI;

    // cab interior + driver
    const seat = new THREE.Mesh(new THREE.BoxGeometry(10, 7, 16), dark);
    seat.position.set(30, 13, 0);
    const dash = new THREE.Mesh(new THREE.BoxGeometry(4, 5, 18), dark);
    dash.position.set(38, 15, 0);
    const driver = buildOccupant({ suit: 0x111827, accent: nvidia });
    driver.scale.setScalar(0.95);
    driver.position.set(30, 12.5, 3.5);
    g.add(driver);

    // cargo container
    const box = new THREE.Mesh(new THREE.BoxGeometry(58, 28, 24), green);
    box.position.set(-14, 20, 0);
    // NVIDIA-green brand marks
    for (const z of [12.2, -12.2]) {
        const stripe = new THREE.Mesh(
            new THREE.BoxGeometry(48, 7, 0.5),
            new THREE.MeshBasicMaterial({ color: nvidia })
        );
        stripe.position.set(-14, 22, z);
        g.add(stripe);
    }
    // "GPU" light strip on top
    const topBar = new THREE.Mesh(
        new THREE.BoxGeometry(40, 1.5, 4),
        new THREE.MeshBasicMaterial({ color: nvidia })
    );
    topBar.position.set(-14, 34.5, 0);

    // fuel tanks / detail under frame
    for (const s of [-1, 1]) {
        const tank = new THREE.Mesh(
            new THREE.CylinderGeometry(3, 3, 16, 10),
            chromeM
        );
        tank.rotation.z = Math.PI / 2;
        tank.position.set(8, 8, s * 10);
        g.add(tank);
    }

    addWheels(g, [[34, 11.5], [34, -11.5], [2, 11.5], [2, -11.5], [-28, 11.5], [-28, -11.5]], 6, 5);
    addHeadTailLamps(g, 43, -44, 11, 7.5);
    const fb = new THREE.Mesh(new THREE.BoxGeometry(3.5, 5, 22), chromeM); fb.position.set(43, 7, 0);
    const rb = new THREE.Mesh(new THREE.BoxGeometry(3, 5, 22), chromeM); rb.position.set(-44, 8, 0);

    g.add(rail, cabBase, cabRoof, wind, rearCab, sideL, sideR, seat, dash, box, topBar, fb, rb);
    return mergeByMaterial(g);
}

/** Proper helicopter: fuselage, boom, skids, spinning rotors. Nose = +X. */
function buildHelicopter(colHex, opts = {}) {
    const g = new THREE.Group();
    const col = new THREE.Color(colHex);
    const bodyM = new THREE.MeshStandardMaterial({ color: col, roughness: 0.32, metalness: 0.58 });
    const darkM = new THREE.MeshStandardMaterial({ color: 0x1e293b, roughness: 0.5, metalness: 0.4 });
    const glassM = glassMat(0.22);

    // fuselage shell — open cabin bay under canopy
    const body = new THREE.Mesh(new THREE.BoxGeometry(26, 10, 13), bodyM);
    body.position.set(0, 10, 0);
    const belly = new THREE.Mesh(new THREE.BoxGeometry(22, 3.5, 11), bodyM);
    belly.position.set(0, 4.2, 0);
    const nose = new THREE.Mesh(new THREE.SphereGeometry(6, 14, 12), bodyM);
    nose.position.set(14, 10, 0);
    nose.scale.set(1.2, 0.85, 0.9);
    // rear taper
    const rear = new THREE.Mesh(new THREE.BoxGeometry(10, 8, 10), bodyM);
    rear.position.set(-14, 11, 0);

    // OPEN canopy frame + true glass bubble (not a solid block)
    for (const [px, pz] of [[8, 5.5], [8, -5.5], [2, 5.5], [2, -5.5]]) {
        const frame = new THREE.Mesh(new THREE.BoxGeometry(1.4, 8, 1.2), bodyM);
        frame.position.set(px, 14, pz);
        g.add(frame);
    }
    const canopy = new THREE.Mesh(new THREE.SphereGeometry(7.5, 16, 12), glassM);
    canopy.position.set(8, 13.5, 0);
    canopy.scale.set(1.35, 0.95, 1.05);
    // cut bottom of bubble visually by adding floor under it
    const cabinFloor = new THREE.Mesh(new THREE.BoxGeometry(16, 1, 11), darkM);
    cabinFloor.position.set(6, 8.5, 0);

    // seats + pilot (+ optional passenger)
    const seat = new THREE.Mesh(new THREE.BoxGeometry(6, 5, 10), darkM);
    seat.position.set(6, 10.5, 0);
    const pilot = buildOccupant({ suit: 0x111827, hair: 0x1a1410 });
    pilot.scale.setScalar(0.55);
    pilot.position.set(9, 9.5, 2.2);
    g.add(pilot);
    if (opts.ceo) {
        const ceo = buildOccupant({ suit: 0x0f172a, accent: col.getHex() });
        ceo.scale.setScalar(0.55);
        ceo.position.set(5, 9.5, -2.2);
        g.add(ceo);
    }

    const boom = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 2.4, 32, 8), bodyM);
    boom.rotation.z = Math.PI / 2;
    boom.position.set(-26, 13, 0);
    const fin = new THREE.Mesh(new THREE.BoxGeometry(4, 14, 1.5), bodyM);
    fin.position.set(-40, 18, 0);
    const stab = new THREE.Mesh(new THREE.BoxGeometry(8, 1.5, 12), bodyM);
    stab.position.set(-38, 13, 0);

    // Tail rotor spins about X (it faces sideways), so its blades live in the
    // YZ plane. Built at the origin and positioned after the merge below —
    // mergeByMaterial bakes child transforms, so anything that has to keep
    // turning must stay out of the static bake.
    const tailRotor = new THREE.Group();
    for (let i = 0; i < 2; i++) {
        const b = new THREE.Mesh(new THREE.BoxGeometry(1, 12, 2.2), darkM);
        b.rotation.x = i * Math.PI / 2;
        tailRotor.add(b);
    }
    const tailDisc = new THREE.Mesh(
        new THREE.CircleGeometry(6.2, 24),
        new THREE.MeshBasicMaterial({
            color: 0xcbd5e1, transparent: true, opacity: 0.14,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    tailDisc.rotation.y = Math.PI / 2;
    tailRotor.add(tailDisc);
    for (const s of [-1, 1]) {
        const skid = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 1.2), darkM);
        skid.position.set(2, 1.2, s * 7.5);
        const leg1 = new THREE.Mesh(new THREE.BoxGeometry(1.2, 7, 1.2), darkM);
        leg1.position.set(10, 4.5, s * 7.5);
        const leg2 = leg1.clone(); leg2.position.x = -8;
        g.add(skid, leg1, leg2);
    }

    const rotor = new THREE.Group();
    rotor.add(new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.8, 4, 12), darkM));
    for (let i = 0; i < 4; i++) {
        const blade = new THREE.Mesh(
            new THREE.BoxGeometry(58, 0.5, 3.2),
            new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.32, metalness: 0.7 })
        );
        blade.rotation.y = (i * Math.PI) / 2;
        blade.position.y = 2;
        blade.rotation.z = 0.04;
        rotor.add(blade);
    }
    const disc = new THREE.Mesh(
        new THREE.CircleGeometry(29, 40),
        new THREE.MeshBasicMaterial({
            color: 0xcbd5e1, transparent: true, opacity: 0.16,
            side: THREE.DoubleSide, depthWrite: false
        })
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 2.1;
    rotor.add(disc);
    // The disc is the thing that actually reads as "spinning" at distance; the
    // blades alias into a stationary cross once they turn faster than the frame
    // rate can sample. Both are kept: blades for the near view, disc for far.

    // landing lights
    const lampM = new THREE.MeshBasicMaterial({ color: 0xfff2cc });
    for (const s of [-1, 1]) {
        const L = new THREE.Mesh(new THREE.BoxGeometry(2, 1.5, 2), lampM);
        L.position.set(14, 6, s * 4);
        g.add(L);
    }

    g.add(body, belly, nose, rear, canopy, cabinFloor, seat, boom, fin, stab);

    // Merge the airframe, then hang the two rotors off the result as live
    // nodes. Merging them WITH the airframe is what made the blades static:
    // mergeByMaterial bakes every child transform into one buffer and returns a
    // brand-new group, so both the pivot and the userData handle were lost and
    // `h.obj.userData.rotor` silently read undefined every frame.
    const out = mergeByMaterial(g);

    const rotorNode = mergeByMaterial(rotor);
    rotorNode.position.set(0, 19, 0);
    const tailNode = mergeByMaterial(tailRotor);
    tailNode.position.set(-41, 18, 3.5);
    out.add(rotorNode, tailNode);

    out.userData.rotor = rotorNode;
    out.userData.tailRotor = tailNode;
    return out;
}


const CAR_GAP = 62;          // bumper-to-bumper minimum in a queue
const STOP_LINE = 26;        // how far back from the junction a red light holds you
const SIGNAL_PERIOD = 26;    // seconds for a full two-phase signal cycle

export const Traffic = {
    cars: null, carDetail: null, carLamps: null, lampMat: null, carData: [], truck: null,
    carGroup: null,
    trams: [],
    blimps: [],
    heli: null,
    // Real launches only — see shared/space_live.mjs. `pads` is keyed by pad
    // building id and holds one state machine per pad, mirroring the 2D city's
    // SpaceEntities.rockets. There is deliberately no random launch timer.
    pads: null, launchesByOrg: {}, _launchPoll: 0, _notified: null,
    onBlimpClick: null,

    init(scene) {
        this._initCars(scene);
        this._initVipCars(scene);
        this._initTruck(scene);
        this._initTrams(scene);
        this._initBlimps(scene);
        this._initHeli(scene);
        this._initFounderHelis(scene);
    },

    // ── SUPPLY-CHAIN TRUCK ────────────────────────────────────────────────────
    _initTruck(scene) {
        const port = G.placements.find(p => p.district === 'port')
            || G.placements[0];
        const fab = G.placements.find(p => /nvidia|fab|chipfab|datacenter/i.test(p.b?.name + p.b?.type + p.b?.id))
            || G.placements.find(p => p.district === 'compute')
            || G.placements[Math.min(3, G.placements.length - 1)];
        const hq = G.placements.find(p => p.b?.lab === 'nvidia' || p.b?.id === 'bld_o')
            || G.placements.find(p => p.district === 'tech')
            || G.placements[Math.min(5, G.placements.length - 1)];
        const stops = [port, fab, hq].filter(Boolean);
        const path = this._gridRoute(stops.length >= 2 ? stops : null);
        if (path) this._registerTruck(scene, path);
    },

    /* Manhattan route over the road grid, closed into a loop.

       The route used to join each stop's nearest intersection to the NEXT
       stop's with a single straight segment. Two intersections almost never
       share a row or a column, so that segment cut diagonally across whole
       blocks and the Nvidia truck drove through buildings. Every leg produced
       here runs along exactly one avenue (constant x) or one street (constant
       z), and sits in a lane rather than on the centreline. */
    _gridRoute(stops) {
        const xs = City.avenueXs?.length ? City.avenueXs : [0, 400];
        const zs = City.streetZs?.length ? City.streetZs : [0, 400];
        // No usable stops — fall back to a lap of the outermost avenues/streets.
        const nodes = stops
            ? stops.map(s => City.nearestIntersection(s.x ?? s.worldX ?? 0, s.z ?? s.worldZ ?? 0))
            : [
                { x: xs[0], z: zs[0] }, { x: xs[xs.length - 1], z: zs[0] },
                { x: xs[xs.length - 1], z: zs[zs.length - 1] }, { x: xs[0], z: zs[zs.length - 1] }
            ];
        // Two facilities can snap to the same corner — a zero-length leg has no
        // heading, and _stepPathVehicle would divide by it.
        const uniq = nodes.filter((n, i) => i === 0 ||
            Math.abs(n.x - nodes[i - 1].x) > 2 || Math.abs(n.z - nodes[i - 1].z) > 2);
        if (uniq.length < 2) return null;
        uniq.push({ ...uniq[0] });   // close the loop

        const pts = [];
        const push = (x, z) => {
            const last = pts[pts.length - 1];
            if (last && Math.abs(last.x - x) < 2 && Math.abs(last.z - z) < 2) return;
            pts.push({ x, z });
        };
        for (let i = 0; i < uniq.length - 1; i++) {
            const a = uniq[i], b = uniq[i + 1];
            const zDir = Math.sign(b.z - a.z) || 1;      // heading of the avenue leg
            const xDir = Math.sign(b.x - a.x) || 1;      // heading of the street leg
            const avX = City.laneCentre(a.x, true, zDir, 0);
            const stZ = City.laneCentre(b.z, false, -xDir, 0);
            // Turn onto the avenue at whatever z the previous leg finished on.
            const fromZ = pts.length ? pts[pts.length - 1].z : City.laneCentre(a.z, false, -xDir, 0);
            push(avX, fromZ);       // corner
            push(avX, stZ);         // …up/down the avenue
            push(City.laneCentre(b.x, true, zDir, 0), stZ);   // …along the street
        }
        // Close the loop with a corner, not a straight line back to the start.
        // The lane offsets mean the last point and the first rarely share an
        // axis, and joining them directly re-introduces exactly the diagonal
        // this routine exists to avoid — a short one, but a diagonal.
        const last = pts[pts.length - 1], first = pts[0];
        if (Math.abs(last.x - first.x) > 2 && Math.abs(last.z - first.z) > 2) {
            push(last.x, first.z);
        }
        push(first.x, first.z);
        return pts;
    },

    _registerTruck(scene, path) {
        const segs = [];
        let total = 0;
        for (let i = 0; i < path.length - 1; i++) {
            const len = Math.hypot(path[i + 1].x - path[i].x, path[i + 1].z - path[i].z) || 1;
            segs.push(len); total += len;
        }
        const mesh = buildSupplyTruck();
        scene.add(mesh);
        this.truck = { obj: mesh, path, segs, total: total || 1, dist: 0, speed: 115 };
        // delivery vans on same logistics loop
        this.vans = [];
        const vanCols = [0x2563eb, 0xdc2626, 0xf59e0b];
        for (let v = 0; v < 3; v++) {
            const van = buildDeliveryVan(vanCols[v]);
            scene.add(van);
            this.vans.push({
                obj: van, path, segs, total: total || 1,
                dist: (v + 1) * (total || 1) / 4,
                speed: 95 + v * 8
            });
        }
    },

    _stepPathVehicle(v, dt) {
        if (!v || !v.total) return;
        v.dist = (v.dist + v.speed * dt) % v.total;
        let rem = v.dist;
        for (let i = 0; i < v.segs.length; i++) {
            if (rem <= v.segs[i] || i === v.segs.length - 1) {
                const t = v.segs[i] ? rem / v.segs[i] : 0;
                const a = v.path[i], b = v.path[i + 1];
                if (!a || !b) break;
                v.obj.position.set(a.x + (b.x - a.x) * t, 0, a.z + (b.z - a.z) * t);
                // Forward = +X on all builders → yaw so +X points along travel
                const want = Math.atan2(b.x - a.x, b.z - a.z) - Math.PI / 2;
                if (v.yaw == null) v.yaw = want;
                // Ease into the new heading instead of snapping 90° at a corner.
                let d = want - v.yaw;
                while (d > Math.PI) d -= Math.PI * 2;
                while (d < -Math.PI) d += Math.PI * 2;
                v.yaw += d * Math.min(1, dt * 6);
                v.obj.rotation.y = v.yaw;
                break;
            }
            rem -= v.segs[i];
        }
    },

    _updateTruck(dt) {
        this._stepPathVehicle(this.truck, dt);
        if (this.vans) for (const v of this.vans) this._stepPathVehicle(v, dt);
    },

    // ── CARS (detailed open-cabin meshes — fleet is small, glass stays real) ──
    _initCars(scene) {
        const N = G.preset.cars;
        this.carGroup = new THREE.Group();
        this.carGroup.name = 'ambientCars';
        scene.add(this.carGroup);
        // keep null instanced hooks so older debug probes don't explode
        this.cars = null;
        this.carDetail = null;
        this.carLamps = null;
        this.lampMat = null;
        this.carData = [];

        const cols = [0xb3352a, 0x27618f, 0xa9b0b8, 0x232833, 0xc08a1e, 0x158a72, 0x6f3f9e, 0xdfe3e6, 0x30414f];
        const xs = [...City.avenueXs, ...City.ringX].sort((a, b) => a - b);
        const zs = [...City.streetZs, ...City.ringZ].sort((a, b) => a - b);
        const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

        for (let i = 0; i < N; i++) {
            let x0 = pick(xs), x1 = pick(xs), z0 = pick(zs), z1 = pick(zs);
            if (x0 === x1) x1 = xs[(xs.indexOf(x0) + 1) % xs.length];
            if (z0 === z1) z1 = zs[(zs.indexOf(z0) + 1) % zs.length];
            if (x0 > x1) [x0, x1] = [x1, x0];
            if (z0 > z1) [z0, z1] = [z1, z0];

            const dir = Math.random() < 0.5 ? 1 : -1;
            const lane = Math.random() < 0.62 ? 0 : 1;
            const off = (lane * LANE_W + LANE_W / 2) * dir;
            const rect = [
                { x: x0 + off, z: z0 + off }, { x: x1 - off, z: z0 + off },
                { x: x1 - off, z: z1 - off }, { x: x0 + off, z: z1 - off }
            ];
            if (dir < 0) rect.reverse();
            const perimeter = rect.reduce((s, p, j) => {
                const q = rect[(j + 1) % 4];
                return s + Math.hypot(q.x - p.x, q.z - p.z);
            }, 0);

            const mesh = buildSedan(cols[i % cols.length], {
                glassOpacity: 0.15,
                driver: true,
                passenger: Math.random() < 0.45
            });
            this.carGroup.add(mesh);

            this.carData.push({
                rect, perimeter,
                dist: Math.random() * perimeter,
                speed: (lane ? 132 : 104) + Math.random() * 26,
                obj: mesh
            });
        }
        this._dummy = new THREE.Object3D();
    },

    _carPose(c) {
        let rem = c.dist, seg = 0;
        while (seg < 4) {
            const p = c.rect[seg], q = c.rect[(seg + 1) % 4];
            const len = Math.hypot(q.x - p.x, q.z - p.z);
            if (rem <= len || seg === 3) {
                const t = len ? Math.min(1, rem / len) : 0;
                const alongX = Math.abs(q.x - p.x) > Math.abs(q.z - p.z);
                return {
                    x: p.x + (q.x - p.x) * t, z: p.z + (q.z - p.z) * t,
                    dx: q.x - p.x, dz: q.z - p.z,
                    toCorner: len - rem, alongX
                };
            }
            rem -= len; seg++;
        }
        return null;
    },

    _updateCars(dt) {
        if (!this.carData?.length) return;
        const N = this.carData.length;

        const pose = new Array(N);
        const lanes = new Map();
        for (let i = 0; i < N; i++) {
            const c = this.carData[i];
            const p = this._carPose(c);
            pose[i] = p;
            if (!p) continue;
            const perp = p.alongX ? Math.round(p.z / 6) : Math.round(p.x / 6);
            const fwd = p.alongX ? Math.sign(p.dx) : Math.sign(p.dz);
            const key = `${p.alongX ? 'x' : 'z'}:${perp}:${fwd}`;
            const along = (p.alongX ? p.x : p.z) * fwd;
            let q = lanes.get(key);
            if (!q) { q = []; lanes.set(key, q); }
            q.push({ i, along });
        }
        const gapAllowed = new Float32Array(N).fill(Infinity);
        for (const q of lanes.values()) {
            q.sort((a, b) => a.along - b.along);
            for (let k = 0; k < q.length - 1; k++) {
                gapAllowed[q[k].i] = Math.max(0, q[k + 1].along - q[k].along - CAR_GAP);
            }
        }

        const cycle = (G.time % SIGNAL_PERIOD) / SIGNAL_PERIOD;
        const greenAlongX = cycle < 0.5;
        const amber = Math.abs(cycle % 0.5 - 0.5) < 0.06;
        this.signalGreenX = greenAlongX;

        const h = G.dayPhase * 24;
        const dark = (h < 6.5 || h > 18.5) ? 1 : (h < 7.5 ? 7.5 - h : h > 17.5 ? h - 17.5 : 0);
        const lampOn = Math.min(1, Math.max(0, dark)) > 0.15;

        for (let i = 0; i < N; i++) {
            const c = this.carData[i];
            const p = pose[i];
            if (!p || !c.obj) continue;

            let advance = c.speed * dt;
            const green = p.alongX ? greenAlongX : !greenAlongX;
            if ((!green || amber) && p.toCorner < 150) {
                advance = Math.min(advance, Math.max(0, p.toCorner - STOP_LINE));
            }
            advance = Math.min(advance, gapAllowed[i]);

            c.dist = (c.dist + advance) % c.perimeter;
            const np = this._carPose(c) || p;
            c.obj.position.set(np.x, 0, np.z);
            c.obj.rotation.y = Math.atan2(np.dx, np.dz) - Math.PI / 2;
            // headlight glow
            const lm = c.obj.userData.headLampMat;
            if (lm) lm.color.setHex(lampOn ? 0xfff6d5 : 0xb0a890);
        }
    },

    // ── METRO ROLLING STOCK (owned by metro.js) ──────────────────────────────
    _initTrams(scene) {
        this.trams = [];
    },

    _updateTrams(dt) {
        // metro.js owns train motion
    },

    // ── BLIMPS with news panels ──────────────────────────────────────────────
    _initBlimps(scene) {
        const headlines = NEWS.slice(0, 3);
        headlines.forEach((h, i) => {
            const blimp = new THREE.Group();
            const envelope = new THREE.Mesh(
                new THREE.SphereGeometry(40, 14, 10),
                new THREE.MeshLambertMaterial({ color: [0xd8b23a, 0x9a4ae0, 0x3aa0d8][i] })
            );
            envelope.scale.set(1.9, 0.62, 0.62);
            blimp.add(envelope);
            const gondola = new THREE.Mesh(
                new THREE.BoxGeometry(30, 10, 10),
                new THREE.MeshLambertMaterial({ color: 0x2a2e36 })
            );
            gondola.position.y = -30;
            blimp.add(gondola);
            const panelTex = TEX.blimpPanel(h.headline);
            const panel = new THREE.Mesh(
                new THREE.PlaneGeometry(90, 22),
                new THREE.MeshBasicMaterial({ map: panelTex, side: THREE.DoubleSide })
            );
            panel.position.y = -2;
            blimp.add(panel);
            blimp.userData.headline = h;
            blimp.position.set((i - 1) * 1500, 420 + i * 60, -800 + i * 700);
            scene.add(blimp);
            this.blimps.push({ obj: blimp, speed: 14 + i * 4, phase: i * 2.4 });
        });
    },

    _updateBlimps(dt, t) {
        for (const b of this.blimps) {
            b.obj.position.x += b.speed * dt;
            b.obj.position.y += Math.sin(t * 0.4 + b.phase) * dt * 6;
            if (b.obj.position.x > CITY_W / 2 + 800) b.obj.position.x = -CITY_W / 2 - 800;
        }
    },

    // ── NEWS HELICOPTER ──────────────────────────────────────────────────────
    _initHeli(scene) {
        const heli = buildHelicopter(0xc0392b);
        heli.scale.setScalar(1.5);
        scene.add(heli);
        this.heli = { obj: heli, angle: 0 };
    },

    _updateHeli(dt, t) {
        if (!this.heli) return;
        const h = this.heli;
        h.angle += dt * 0.09;
        const r = 1400;
        const x = Math.cos(h.angle) * r - 500;
        const z = Math.sin(h.angle) * r;
        h.obj.position.set(x, 380 + Math.sin(t * 0.5) * 20, z);
        // travel tangent for increasing angle: (-sin θ, cos θ); nose = +X
        const vx = -Math.sin(h.angle), vz = Math.cos(h.angle);
        h.obj.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;
        h.obj.rotation.z = -0.1;
        // Not a round multiple of the 4-blade symmetry at 60fps — at dt*32 the
        // blades land ~90° apart every 3 frames and read as a stationary cross.
        if (h.obj.userData.rotor) h.obj.userData.rotor.rotation.y += dt * 21;
        if (h.obj.userData.tailRotor) h.obj.userData.tailRotor.rotation.x += dt * 48;
    },

    // ── ROCKET LAUNCHES ──────────────────────────────────────────────────────
    _buildRocket(orgColor) {
        const g = new THREE.Group();
        const parts = [];
        const body = new THREE.CylinderGeometry(6, 6, 60, 10); body.translate(0, 30, 0); paint(body, 0xf2f2f0);
        const nose = new THREE.ConeGeometry(6, 14, 10); nose.translate(0, 67, 0); paint(nose, orgColor);
        const stripe = new THREE.CylinderGeometry(6.3, 6.3, 8, 10); stripe.translate(0, 6, 0); paint(stripe, orgColor);
        parts.push(body, nose, stripe);
        g.add(new THREE.Mesh(mergeGeometries(parts, false), new THREE.MeshLambertMaterial({ vertexColors: true })));
        const flame = new THREE.Mesh(
            new THREE.ConeGeometry(5, 34, 8),
            new THREE.MeshBasicMaterial({ color: 0xffaa44, transparent: true, opacity: 0.9, depthWrite: false })
        );
        flame.rotation.x = Math.PI;
        flame.position.y = -12;
        g.add(flame);
        g.userData.flame = flame;
        return g;
    },

    /* One state machine per pad, driven entirely by real upcoming launches.

       idle → preparation (T-5m) → countdown (T-1m) → flight → idle

       A pad only ever leaves `idle` because a real launch for that pad's org is
       due. If the API is unreachable and the cache is cold, every pad stays idle
       and nothing launches — which is correct. Inventing a launch to fill the
       silence is the bug this replaced. */
    _initRocketPads() {
        this.pads = {};
        for (const b of Object.values(G.bldById)) {
            if (b && b.type === 'launchpad' && b.org) {
                this.pads[b.id] = {
                    bld: b, org: b.org, state: 'idle',
                    launch: null, firedFor: null, mesh: null, flightT: 0
                };
            }
        }
        this._notified = {};
    },

    async _pollLaunches() {
        const launches = await fetchLaunches();
        this.launchesByOrg = matchLaunchesToOrgs(launches);
    },

    _notifyOnce(launch, label) {
        const key = launch.id + '|' + label;
        if (this._notified[key]) return;
        this._notified[key] = true;
        G.ui?.addToast?.(`🚀 T-${label} · ${launch.name} · head to the Space Zone`);
    },

    _beginFlight(p) {
        const org = SPACE_ORGS[p.org] || { color: 0xffffff, name: 'Space' };
        p.mesh = this._buildRocket(org.color);
        p.mesh.position.set(p.bld.worldX, 90, p.bld.worldZ);
        p.flightT = 0;
        p.state = 'flight';
        G.scene.add(p.mesh);
        const name = p.launch ? p.launch.name : `${org.name} launch`;
        G.ui?.addToast?.(`🚀 LAUNCH: ${name}`);
        G.ui?.event('rocket_launch', { x: p.bld.worldX, z: p.bld.worldZ });
        G.audio?.sfx('rocket');
    },

    _updateRockets(dt, t) {
        if (!this.pads) this._initRocketPads();

        // Refresh from the shared cache/API. fetchLaunches is itself cached for
        // 15 min and shared with the 2D city, so this is cheap.
        this._launchPoll -= dt;
        if (this._launchPoll <= 0) {
            this._launchPoll = 60;
            this._pollLaunches();
        }

        const now = Date.now();

        for (const p of Object.values(this.pads)) {
            // ── in flight: nothing reassigns a pad mid-ascent ──
            if (p.state === 'flight') {
                p.flightT += dt;
                const prog = p.flightT / 14;
                if (prog >= 1) {
                    G.scene.remove(p.mesh);
                    p.mesh = null;
                    p.state = 'idle';
                    continue;
                }
                p.mesh.position.y = 90 + 2600 * prog * prog;
                const fl = p.mesh.userData.flame;
                fl.scale.set(
                    1 + Math.sin(t * 40) * 0.15,
                    0.8 + Math.random() * 0.4,        // flame flicker only
                    1 + Math.cos(t * 37) * 0.15
                );
                continue;
            }

            const launch = this.launchesByOrg[p.org] || null;
            p.launch = launch;

            if (!launch) { p.state = 'idle'; continue; }

            const diff = Date.parse(launch.net) - now;

            // NET has passed (within the grace window) and we haven't flown THIS
            // launch id yet — go.
            if (diff <= 0 && diff > -LAUNCH_GRACE_MS && p.firedFor !== launch.id) {
                p.firedFor = launch.id;
                this._beginFlight(p);
                continue;
            }
            if (diff > 0 && diff <= 60000) {
                if (p.state !== 'countdown') {
                    p.state = 'countdown';
                    this._notifyOnce(launch, '1 minute');
                }
                continue;
            }
            if (diff > 60000 && diff <= 300000) {
                if (p.state !== 'preparation' && p.state !== 'countdown') {
                    p.state = 'preparation';
                    this._notifyOnce(launch, '5 minutes');
                }
                continue;
            }
            p.state = 'idle';
        }
    },

    /** Next real launch bound to a pad, for HUD / terminal readouts. */
    nextLaunchInfo() {
        let best = null;
        for (const p of Object.values(this.pads || {})) {
            const l = this.launchesByOrg[p.org];
            if (!l) continue;
            if (!best || Date.parse(l.net) < Date.parse(best.launch.net)) {
                best = { launch: l, pad: p.bld, countdown: getCountdown(l) };
            }
        }
        return best;
    },

    // ── VIP / FOUNDER CARS ──────────────────────────────────────────────────
    _initVipCars(scene) {
        this.vipCars = [];
        this.vipGroup = new THREE.Group();
        scene.add(this.vipGroup);
        const founders = FOUNDERS || [];
        founders.forEach((f, i) => {
            const hq = G.bldById[LAB_HQ[f.lab]];
            const home = G.bldById['res_' + ((LABS[f.lab] && LABS[f.lab].region) || 'us')] || G.bldById['res_us'];
            if (!hq || !home) return;
            const limo = buildVipLimo(f);
            this.vipGroup.add(limo);

            const hx = hq.worldX, hz = hq.worldZ;
            const i1 = City.nearestIntersection(hx, hz);
            const i2 = City.nearestIntersection(home.worldX, home.worldZ);
            const lane1 = City.laneCentre(i1.x, true, 1, 0);
            const lane2 = City.laneCentre(i2.x, true, 1, 0);
            const path = [
                { x: lane1, z: i1.z },
                { x: lane2, z: i1.z },
                { x: lane2, z: i2.z },
                { x: lane1, z: i2.z },
                { x: lane1, z: i1.z }
            ];
            const segs = [];
            let total = 0;
            for (let k = 0; k < path.length - 1; k++) {
                const len = Math.hypot(path[k + 1].x - path[k].x, path[k + 1].z - path[k].z) || 1;
                segs.push(len); total += len;
            }
            this.vipCars.push({
                obj: limo, founder: f, path, segs, total: total || 1,
                dist: (i / Math.max(1, founders.length)) * total,
                speed: 100 + i * 5
            });
        });
    },

    _vipActive() {
        const dp = G.dayPhase;
        return dp >= 0.28 && dp < 0.92;
    },

    _updateVipCars(dt) {
        if (!this.vipCars?.length) return;
        const on = this._vipActive();
        for (const v of this.vipCars) {
            v.obj.visible = on;
            if (!on) continue;
            this._stepPathVehicle(v, dt);
            // Sprites billboard themselves — nothing to orient here. The tag
            // just hides when the car is parked out of the day window above.
        }
    },

    // ── FOUNDER HELICOPTERS ─────────────────────────────────────────────────
    _initFounderHelis(scene) {
        this.founderHelis = [];
        const founders = FOUNDERS || [];
        founders.forEach((f, i) => {
            const hq = G.bldById[LAB_HQ[f.lab]];
            if (!hq) return;
            const col = f.color && f.color !== '#ffffff' ? f.color : (LABS[f.lab]?.color || '#c0392b');
            const heli = buildHelicopter(col, { ceo: true });
            heli.scale.setScalar(1.35);
            scene.add(heli);
            this.founderHelis.push({
                obj: heli,
                founder: f,
                hq,
                angle: (i / founders.length) * Math.PI * 2,
                phase: i * 1.7,
                radius: 280 + i * 55,
                alt: 320 + i * 35
            });
        });
    },

    _updateFounderHelis(dt, t) {
        if (!this.founderHelis?.length) return;
        const dp = G.dayPhase;
        const flying = dp > 0.28 && dp < 0.9;
        const woods = G.bldById['align_miri'] || G.bldById['pine_reserve'];
        const day = new Date().getDate();
        const weekendTrip = (day % 2 === 0) && dp > 0.42 && dp < 0.62;
        for (const h of this.founderHelis) {
            h.obj.visible = flying;
            if (!flying) continue;
            const da = dt * (0.14 + (h.phase % 1) * 0.05);
            h.angle += da;
            let cx = h.hq.worldX, cz = h.hq.worldZ;
            if (weekendTrip && woods) {
                const u = Math.sin((dp - 0.42) / 0.2 * Math.PI);
                cx = h.hq.worldX + (woods.worldX - h.hq.worldX) * Math.max(0, u);
                cz = h.hq.worldZ + (woods.worldZ - h.hq.worldZ) * Math.max(0, u);
            }
            const x = cx + Math.cos(h.angle) * h.radius;
            const z = cz + Math.sin(h.angle) * h.radius;
            h.obj.position.set(x, h.alt + Math.sin(t * 0.7 + h.phase) * 14, z);
            // Travel dir for increasing angle: (-sin, cos) — nose is +X
            const vx = -Math.sin(h.angle), vz = Math.cos(h.angle);
            h.obj.rotation.y = Math.atan2(vx, vz) - Math.PI / 2;
            h.obj.rotation.z = -0.12;
            h.obj.rotation.x = 0.04;
            if (h.obj.userData.rotor) h.obj.userData.rotor.rotation.y += dt * 21;
            if (h.obj.userData.tailRotor) h.obj.userData.tailRotor.rotation.x += dt * 48;
        }
    },

    update(dt, t) {
        this._updateCars(dt);
        this._updateVipCars(dt);
        this._updateTruck(dt);
        this._updateTrams(dt);
        this._updateBlimps(dt, t);
        this._updateHeli(dt, t);
        this._updateFounderHelis(dt, t);
        this._updateRockets(dt, t);
    }
};
