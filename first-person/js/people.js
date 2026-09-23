/* ══════════════════════════════════════════════════════════════════════════
   PEOPLE — one body plan for everyone in the city.

   The street crowd and the people indoors were two different box figures:
   outside, a stack of cubes 1.75 m tall; inside, a 1.33 m figure (40 local
   units against a 51-unit eye height) that read as a child next to real
   furniture. Both are built here now, from the same parts:

     tapered legs and shoes · a pelvis · a torso that narrows to the waist ·
     rounded shoulders · capsule arms with hands · neck · a real head with a
     hair cap and eyes.

   Street figures (streetGeometry) keep citizens.js's attribute contract so
   its walk shader still animates them: aLimb (1/2 legs, 3/4 arms, 10–12
   stage props), aTint (0 fixed colour, 1 clothing = instance colour, 2 skin,
   3 hair), aPart (0 body, 1 head, 2 hair). Hips pivot at y 7.2 and shoulders
   at 14.0, as before.

   Interior figures (bakedPerson) are the same parts with the colours baked
   in, three times larger (interior-local units), standing or seated. All
   geometry is indexed so it merges with the rooms' own box buckets.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export const TROUSERS = [0x2f3644, 0x3b4a6b, 0x4a3f36, 0x26272c, 0x5b606b, 0x2e4057, 0x6b5b45];
export const SHOES = [0x14161b, 0x2a1f18, 0xe8e8e8, 0x3a3a40];
export const SKIN = [0xe8b98e, 0xd79a6a, 0xb87d52, 0x8d5a3b, 0xf0c9a4, 0x6b4430];
export const HAIR = [0x2a2118, 0x4a3524, 0x6b4a2f, 0x1a1a1e, 0x8a6a3a, 0xb0b0b0, 0x7a3a22];

/* The parts, in world units (1 = 10 cm), standing, facing +z.
   Each entry: [geometry, limb, tint, part, fixedColour]. */
function parts(pose = 'stand') {
    const P = [];
    const add = (g, limb, tint, part, col = 0xffffff) => P.push([g, limb, tint, part, col]);
    const sit = pose === 'sit';
    // seated: the pelvis drops onto a ~0.47 m seat and the thighs swing forward
    const drop = sit ? 2.5 : 0;

    for (const s of [-1, 1]) {
        const limb = s < 0 ? 1 : 2;
        const x = s * 1.32;
        if (!sit) {
            // one tapered leg, hip to ankle
            add(new THREE.CylinderGeometry(1.28, 1.0, 6.6, 6, 1, true).translate(x, 4.2, 0), limb, 0, 0, 0);
            add(new THREE.BoxGeometry(2.1, 1.05, 3.4).translate(x, 0.55, 0.5), limb, 0, 0, 1);
        } else {
            // thigh forward, shin down
            add(new THREE.CylinderGeometry(1.28, 1.12, 4.4, 6, 1, true).rotateX(Math.PI / 2).translate(x, 4.7, 2.0), limb, 0, 0, 0);
            add(new THREE.CylinderGeometry(1.08, 0.95, 4.2, 6, 1, true).translate(x, 2.4, 4.2), limb, 0, 0, 0);
            add(new THREE.BoxGeometry(2.1, 1.05, 3.4).translate(x, 0.55, 4.7), limb, 0, 0, 1);
        }
    }
    // pelvis / belt
    add(new THREE.CylinderGeometry(2.35, 2.25, 1.6, 7, 1, true).scale(1, 1, 0.72).translate(0, 7.7 - drop, 0), 0, 0, 0, 0);
    // torso: waist to chest, flattened front-to-back
    add(new THREE.CylinderGeometry(2.95, 2.3, 5.4, 7, 1, true).scale(1, 1, 0.66).translate(0, 11.1 - drop, 0), 0, 1, 0);
    // shoulders
    add(new THREE.SphereGeometry(1, 7, 3).scale(3.55, 1.45, 1.95).translate(0, 13.55 - drop, 0), 0, 1, 0);
    // arms (sleeves) + hands
    for (const s of [-1, 1]) {
        const limb = s < 0 ? 3 : 4;
        const x = s * 3.75;
        if (!sit) {
            add(new THREE.CapsuleGeometry(0.82, 4.6, 1, 5).translate(x, 11.0, 0), limb, 1, 0);
            add(new THREE.SphereGeometry(0.78, 5, 3).translate(x, 7.9, 0.15), limb, 2, 0);
        } else {
            // forearms forward, resting on the lap / a desk edge
            add(new THREE.CapsuleGeometry(0.82, 2.4, 1, 5).translate(x, 12.0 - drop, 0), limb, 1, 0);
            add(new THREE.CapsuleGeometry(0.75, 2.6, 1, 5).rotateX(Math.PI / 2).translate(x * 0.9, 10.2 - drop, 1.8), limb, 1, 0);
            add(new THREE.SphereGeometry(0.78, 5, 3).translate(x * 0.85, 10.2 - drop, 3.6), limb, 2, 0);
        }
    }
    // neck, head, hair
    add(new THREE.CylinderGeometry(0.85, 0.95, 1.4, 5, 1, true).translate(0, 14.75 - drop, 0.1), 0, 2, 1);
    add(new THREE.SphereGeometry(2.05, 8, 6).scale(1, 1.12, 1.02).translate(0, 16.95 - drop, 0.15), 0, 2, 1);
    add(new THREE.SphereGeometry(2.2, 8, 3, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1.0, 1.05, 1.06).translate(0, 17.25 - drop, -0.05), 0, 3, 2);
    // back hair
    add(new THREE.BoxGeometry(3.6, 2.2, 1.0).translate(0, 16.4 - drop, -1.75), 0, 3, 2);
    // eyes
    for (const s of [-1, 1]) {
        add(new THREE.BoxGeometry(0.42, 0.5, 0.2).translate(s * 0.75, 17.1 - drop, 2.2), 0, 0, 1, 2);
    }
    return P;
}

function colourise(g, hex) {
    const c = new THREE.Color(hex);
    const n = g.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    g.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return g;
}

// fixedColour indices → the street figure's baked colours
const STREET_FIXED = [0x2f3644, 0x14161b, 0x0b0f16];

/** The street crowd's shared geometry (citizens.js InstancedMesh). */
export function streetGeometry() {
    const geos = [];
    const limbs = [], tints = [], partsId = [];
    const push = (g, limb, tint, part) => {
        const n = g.attributes.position.count;
        for (let i = 0; i < n; i++) { limbs.push(limb); tints.push(tint); partsId.push(part); }
        geos.push(g);
    };
    for (const [g, limb, tint, part, col] of parts('stand')) {
        const hex = tint === 0 ? STREET_FIXED[col] ?? 0x2f3644 : 0xffffff;
        // shoes and eyes are "fixed" colour but belong to their own part
        push(colourise(g, hex), limb, tint, part);
    }
    // stage props: aLimb 10 = pacifier (baby), 11 = backpack (kid), 12 = aura (rumoured)
    push(colourise(new THREE.BoxGeometry(1.2, 0.9, 1.0).translate(0, 15.6, 2.45), 0xff6bb5), 10, 0, 1);
    push(colourise(new THREE.BoxGeometry(3.4, 4.0, 1.9).translate(0, 11.0, -2.5), 0x2563eb), 11, 0, 0);
    push(colourise(new THREE.BoxGeometry(7.2, 7.2, 7.2).translate(0, 12.0, 0), 0xa78bfa), 12, 0, 0);
    for (const g of geos) {
        // uniform attribute set so the merge is legal
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    const geo = mergeGeometries(geos, false);
    geo.setAttribute('aLimb', new THREE.BufferAttribute(new Float32Array(limbs), 1));
    geo.setAttribute('aTint', new THREE.BufferAttribute(new Float32Array(tints), 1));
    geo.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(partsId), 1));
    return geo;
}

function hash(str) {
    let h = 2166136261;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return (h >>> 0);
}

/** A person with their colours baked in — for interiors, where each figure
    is its own small mesh (or merges into a room bucket). `scale` 3 puts them
    in interior-local units; `key` picks stable skin/hair/trousers. */
export function bakedPerson({ clothing = 0x64748b, skin, hair, trousers, key = '', pose = 'stand', scale = 3 } = {}) {
    const h = hash(key);
    const sk = skin ?? SKIN[h % SKIN.length];
    const hr = hair ?? HAIR[(h >>> 5) % HAIR.length];
    const tr = trousers ?? TROUSERS[(h >>> 9) % TROUSERS.length];
    const sh = SHOES[(h >>> 13) % SHOES.length];
    const geos = [];
    for (const [g, , tint, , col] of parts(pose)) {
        const hex = tint === 1 ? clothing : tint === 2 ? sk : tint === 3 ? hr
            : col === 1 ? sh : col === 2 ? 0x0b0f16 : tr;
        g.scale(scale, scale, scale);
        geos.push(colourise(g, hex));
    }
    for (const g of geos) {
        if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    }
    return mergeGeometries(geos, false);
}

/** Head-top height of a baked person, for nameplates. */
export function personHeight(pose = 'stand', scale = 3) {
    return (pose === 'sit' ? 16.9 : 19.4) * scale;
}
