/**
 * Kit mapping — no GLB I/O. Run via npm (three_resolver maps the bare
 * 'three' specifier the same way the importmap does).
 */
import {
    kitIdForPlacement, kitIdForInfill, kitScale, LANDMARKS, KITS
} from '../js/assets.js';

const lines = [];
let failed = 0;
function assert(cond, msg) {
    if (!cond) { failed++; lines.push('FAIL: ' + msg); }
    else lines.push('ok: ' + msg);
}

assert(LANDMARKS.bld_o === 'downtown_glass', 'OpenAI → downtown glass tower');
assert(LANDMARKS.neon_bar === 'nightclub', 'Neon Bar → nightclub facade');
assert(kitIdForPlacement({ b: { id: 'port_warehouse', type: 'warehouse' } }) === null,
    'warehouses stay procedural (dock kit buried players)');
{
    const kit = { size: { x: 8.2, y: 33.7, z: 8.9 }, kind: 'tower' };
    const p = { w: 156, h: 691, d: 156 };
    const s = kitScale(kit, p);
    assert(s * kit.size.x <= p.w + 0.01, 'tower does not overflow lot width');
    assert(s * kit.size.y <= p.h + 0.01, 'tower does not overflow lot height');
    assert(s * kit.size.x > p.w * 0.7, 'tower still fills most of the lot');
    const squat = { size: { x: 13, y: 8.59, z: 10.9 }, kind: 'tower' };
    const nvidia = { w: 145, h: 696, d: 121 };
    const s2 = kitScale(squat, nvidia);
    assert(s2 * squat.size.x <= nvidia.w + 0.01, 'short-wide kit must not explode past the lot');
}
assert(LANDMARKS.vcrow_titan === 'glass_supertall', 'SoftBank → glass_supertall');
assert(LANDMARKS.vcrow_launchpad === 'boutique_hotel', 'YC stays low-rise');
assert(LANDMARKS.hq_nvidia === 'twisting_supertall', 'NVIDIA → tall kit, not the squat convention hall');
assert(kitIdForPlacement({ id: 'bld_g', b: { id: 'bld_g', type: 'hq' } }) === 'twisting_supertall',
    'DeepMind is the twisting tower');
assert(kitIdForPlacement({ b: { id: 'metro_central', type: 'metro' } }) === null,
    'metros stay procedural (kit is a 4 m kiosk)');
assert(kitIdForPlacement({ b: { id: 'res_cn', type: 'housing', fl: 7 }, floors: 18 }) === 'residential_highrise',
    'tall housing → highrise');
assert(kitIdForPlacement({ b: { id: 'suburb_1', type: 'villa' } }) === 'modern_house',
    'Suburbia house 1');
assert(kitIdForPlacement({ b: { id: 'gym', type: 'generic' } }) === null,
    'unnamed infill-adjacent buildings stay procedural');
assert(kitIdForInfill({ biome: 'park', fl: 2, seed: 0.2 }) === null, 'park infill stays empty');
assert(!!kitIdForInfill({ biome: 'suburban', fl: 2, seed: 0.1 }), 'suburban infill gets a house');
assert(!!kitIdForInfill({ biome: 'urban', fl: 12, seed: 0.4 }), 'tall urban infill gets a tower');
for (const id of Object.values(LANDMARKS)) {
    assert(!!KITS[id], 'landmark kit registered: ' + id);
}

const out = lines.join('\n');
console.log(out);
console.log(failed ? `FAILED ${failed}` : `ALL ${lines.length} OK`);
process.exit(failed ? 1 : 0);
