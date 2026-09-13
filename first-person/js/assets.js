/* ══════════════════════════════════════════════════════════════════════════
   KIT ASSETS — Draco GLBs from threejsassets, loaded once before World.build.

   Individual kit files are uncompressed vertex-colored meshes (1 material).
   Combined catalogs / prebuilds are Draco; GLTFLoader is wired with a local
   decoder so those still load if we ever point at them.

   Scale: files are 1 unit = 1 m, origin at the base. World space is 10 u = 1 m.
   Towers are uniformly scaled to match the OLD procedural box (height and
   footprint) so they keep their authored proportions — stretching each axis
   independently made 34 m supertalls read as toys. Night window glow is a
   vertex-color mask on emissiveIntensity; no bloom/SSAO/transmission.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';

const ROOT = new URL('../assets/models/', import.meta.url);

export const WORLD_PER_M = 10;

const M = '_packs/metropolis/glb/individual/';
const S = '_packs/suburban-neighborhood/glb/individual/';
const V = '_packs/vice-beach/glb/individual/';
const C = '_packs/city/glb/individual/';
const L = '_packs/living-room/glb/individual/';
const B = 'interiors/bunker-facility/glb/individual/';
const CV = '_packs/cozy-village/glb/individual/';
const RW = '_packs/railway/glb/individual/';
const FM = '_packs/farm/glb/individual/';
const DS = '_packs/desert-kingdom/glb/individual/';

/** Registry of kits we actually fetch. Keep this list small — draw-call budget
    is one InstancedMesh per kit, reused for landmarks AND infill. */
export const KITS = {
    glass_supertall:           { path: M + 'glass_supertall_01.glb',           kind: 'tower' },
    twisting_supertall:        { path: M + 'twisting_supertall_01.glb',        kind: 'tower' },
    twin_tower:                { path: M + 'twin_tower_01.glb',                kind: 'tower' },
    hotel_tower:               { path: M + 'hotel_tower_01.glb',               kind: 'tower' },
    crown_tower:               { path: M + 'crown_tower_01.glb',               kind: 'tower' },
    convention_megastructure:  { path: M + 'convention_megastructure_01.glb',  kind: 'tower' },
    corporate_hq:              { path: M + 'corporate_hq_01.glb',              kind: 'tower' },
    midrise_office:            { path: M + 'midrise_office_01.glb',            kind: 'tower' },
    mixeduse_tower:            { path: M + 'mixeduse_tower_01.glb',            kind: 'tower' },
    condo_midrise:             { path: M + 'condo_midrise_01.glb',             kind: 'tower' },
    boutique_hotel:            { path: M + 'boutique_hotel_01.glb',            kind: 'tower' },
    mall_block:                { path: M + 'mall_block_01.glb',                kind: 'tower' },
    residential_highrise:      { path: M + 'residential_highrise_01.glb',      kind: 'tower' },
    retail_infill:             { path: M + 'retail_infill_01.glb',             kind: 'tower' },
    metro_headhouse:           { path: M + 'metro_headhouse_01.glb',           kind: 'pad', fit: 'footprint' },
    downtown_glass:            { path: V + 'downtown_glass_tower.glb',         kind: 'tower' },
    nightclub:                 { path: V + 'nightclub_facade.glb',             kind: 'tower' },
    grand_deco_hotel:          { path: V + 'grand_deco_hotel.glb',             kind: 'tower' },
    waterfront_condo:          { path: V + 'waterfront_condo_tower.glb',       kind: 'tower' },
    deco_bank:                 { path: V + 'deco_bank_civic.glb',              kind: 'tower' },
    streamline_diner:          { path: V + 'streamline_diner.glb',             kind: 'tower' },
    city_diner:                { path: C + 'diner_01.glb',                     kind: 'tower' },
    dock_warehouse:            { path: V + 'dock_warehouse_unit.glb',          kind: 'pad', fit: 'footprint' },
    fuel_dock:                 { path: V + 'marina_fuel_dock_office.glb',      kind: 'pad', fit: 'footprint' },
    modern_house:              { path: S + 'modern_house.glb',                 kind: 'house', fit: 'uniform' },
    ranch_house:               { path: S + 'ranch_house.glb',                  kind: 'house', fit: 'uniform' },
    two_story_house:           { path: S + 'two_story_house.glb',              kind: 'house', fit: 'uniform' },
    townhouse_duplex:          { path: S + 'townhouse_duplex.glb',             kind: 'house', fit: 'uniform' },
    bungalow_house:            { path: S + 'bungalow_house.glb',               kind: 'house', fit: 'uniform' },
    split_level_house:         { path: S + 'split_level_house.glb',            kind: 'house', fit: 'uniform' },
    sedan:                     { path: M + 'sedan_01.glb',                     kind: 'vehicle' },
    metro_taxi:                { path: M + 'metropolis_taxi_01.glb',           kind: 'vehicle' },
    rideshare:                 { path: M + 'rideshare_compact_01.glb',         kind: 'vehicle' },
    suv:                       { path: M + 'suv_blackcar_01.glb',              kind: 'vehicle' },
    box_truck:                 { path: M + 'box_truck_01.glb',                 kind: 'vehicle' },
    police:                    { path: V + 'police_cruiser.glb',               kind: 'vehicle' },
    city_bus:                  { path: C + 'city_bus_01.glb',                  kind: 'vehicle' },
    delivery_van:              { path: C + 'delivery_van_01.glb',              kind: 'vehicle' },
    yacht:                     { path: V + 'motor_yacht_vessel.glb',           kind: 'boat' },
    speedboat:                 { path: V + 'cigarette_speedboat.glb',          kind: 'boat' },
    floatplane:                { path: V + 'moored_floatplane.glb',            kind: 'boat' },
    dock_module:               { path: V + 'marina_dock_module.glb',           kind: 'prop' },
    royal_palm:                { path: V + 'royal_palm.glb',                   kind: 'prop' },
    coconut_palm:              { path: V + 'coconut_palm.glb',                 kind: 'prop' },
    seawall:                   { path: V + 'canal_seawall_tile.glb',           kind: 'prop' },
    lobby_desk:                { path: V + 'lobby_reception_desk.glb',         kind: 'prop' },
    sofa:                      { path: L + 'sofa_3seat.glb',                   kind: 'prop' },
    armchair:                  { path: L + 'armchair.glb',                     kind: 'prop' },
    club_bar:                  { path: V + 'club_bar_counter.glb',             kind: 'prop' },
    dj_booth:                  { path: V + 'club_dj_booth.glb',                kind: 'prop' },
    neon_wall:                 { path: V + 'club_neon_wall_panel.glb',         kind: 'prop' },
    dancefloor:                { path: V + 'lit_dancefloor_module.glb',        kind: 'prop' },
    console:                   { path: B + 'control_console.glb',              kind: 'prop' },
    crt:                       { path: B + 'crt_terminal.glb',                 kind: 'prop' },
    radio_rack:                { path: B + 'radio_rack.glb',                   kind: 'prop' },
    street_tree_metro:         { path: M + 'metropolis_street_tree_01.glb',    kind: 'tree' },
    street_tree_col:           { path: M + 'columnar_street_tree_01.glb',      kind: 'tree' },
    street_tree_city:          { path: C + 'street_tree_01.glb',               kind: 'tree' },
    park_tree:                 { path: C + 'park_tree_01.glb',                 kind: 'tree' },
    plaza_ficus:               { path: M + 'plaza_ficus_01.glb',               kind: 'tree' },
    shade_tree:                { path: S + 'shade_tree.glb',                   kind: 'tree' },
    flowering_tree:            { path: S + 'flowering_tree.glb',               kind: 'tree' },
    oak:                       { path: CV + 'tree_oak_01.glb',                 kind: 'tree' },
    pine:                      { path: CV + 'tree_pine_01.glb',                kind: 'tree' },
    fruit_tree:                { path: CV + 'tree_fruit_01.glb',               kind: 'tree' },
    lineside_oak:              { path: RW + 'lineside_oak.glb',                kind: 'tree' },
    lineside_pine:             { path: RW + 'lineside_pine.glb',               kind: 'tree' },
    apple_tree:                { path: FM + 'apple_tree.glb',                  kind: 'tree' },
    date_palm:                 { path: DS + 'date_palm.glb',                   kind: 'tree' },
    doum_palm:                 { path: DS + 'doum_palm.glb',                   kind: 'tree' },
    diesel:                    { path: RW + 'diesel_locomotive.glb',           kind: 'vehicle' },
    container_wagon:           { path: RW + 'container_flat_wagon.glb',        kind: 'vehicle' }
};

/** Unique meshes for VC Row + major HQs. Sharing a kit across two labs is
    intentional: brand tint is per-instance, and it keeps draw calls down. */
export const LANDMARKS = {
    // Tech District HQs
    bld_o: 'downtown_glass',
    bld_a: 'mixeduse_tower',
    bld_g: 'twisting_supertall',
    bld_m: 'twin_tower',
    bld_mi: 'midrise_office',
    bld_ds: 'hotel_tower',
    bld_x: 'crown_tower',
    // Hyperscaler Row
    hq_microsoft: 'downtown_glass',
    hq_nvidia: 'twisting_supertall',
    hq_amazon: 'glass_supertall',
    hq_ibm: 'mixeduse_tower',
    hq_apple: 'crown_tower',
    // Eastern Exchange
    hq_alibaba: 'glass_supertall',
    hq_baidu: 'hotel_tower',
    hq_zhipu: 'midrise_office',
    // Open Weights + Hub
    hq_stability: 'mixeduse_tower',
    hq_cohere: 'corporate_hq',
    hq_ai21: 'midrise_office',
    hq_tii: 'crown_tower',
    hq_bigcode: 'midrise_office',
    hub_commons: 'mixeduse_tower',
    // VC Row
    vcrow_apex: 'glass_supertall',
    vcrow_horizon: 'twisting_supertall',
    vcrow_thrive: 'mixeduse_tower',
    vcrow_foundersfund: 'corporate_hq',
    vcrow_launchpad: 'boutique_hotel',
    vcrow_mgx: 'crown_tower',
    vcrow_titan: 'glass_supertall',
    vcrow_exchange: 'mixeduse_tower',
    vcrow_cryptex: 'hotel_tower',
    neon_bar: 'nightclub',
    times_hq: 'midrise_office',
    cafe: 'streamline_diner'
};

const HOUSES = [
    'modern_house', 'two_story_house', 'townhouse_duplex',
    'ranch_house', 'bungalow_house', 'split_level_house'
];
// Banded by native height so fit-inside scale can fill the lot. A 8.6 m
// convention hall scaled to a 70 m HQ was 100 m wide — bigger than a cell.
const INFILL_LOW = ['streamline_diner', 'dock_warehouse', 'nightclub'];
const INFILL_MID = ['midrise_office', 'condo_midrise', 'mixeduse_tower', 'hotel_tower', 'boutique_hotel', 'corporate_hq'];
const INFILL_HIGH = ['glass_supertall', 'twin_tower', 'crown_tower', 'residential_highrise', 'downtown_glass', 'twisting_supertall'];
const VEHICLE_IDS = ['sedan', 'metro_taxi', 'rideshare', 'suv', 'box_truck', 'police', 'city_bus', 'delivery_van'];
const HARBOUR_IDS = ['yacht', 'speedboat', 'floatplane', 'dock_module', 'royal_palm', 'coconut_palm', 'seawall'];
const INTERIOR_IDS = ['lobby_desk', 'sofa', 'armchair', 'club_bar', 'dj_booth', 'neon_wall', 'dancefloor', 'console', 'crt', 'radio_rack'];
const TREE_IDS = ['street_tree_metro', 'street_tree_col', 'street_tree_city', 'park_tree', 'plaza_ficus', 'shade_tree', 'flowering_tree', 'oak', 'pine', 'fruit_tree', 'lineside_oak', 'lineside_pine', 'apple_tree', 'date_palm', 'doum_palm', 'royal_palm'];
const STREET_TREES = ['street_tree_metro', 'street_tree_col', 'street_tree_city'];
const PARK_TREES = ['park_tree', 'shade_tree', 'flowering_tree', 'oak', 'fruit_tree', 'apple_tree'];
const FOREST_TREES = ['oak', 'pine', 'lineside_oak', 'lineside_pine', 'shade_tree'];

const cache = new Map();
export const windowMaterials = [];

function pick(list, u) {
    const t = Number.isFinite(u) ? u : 0.5;
    return list[Math.abs(Math.floor((t % 1) * list.length)) % list.length];
}

/** Pure mapping — safe to call before load() (missing kits fall back to boxes). */
export function kitIdForPlacement(p) {
    const id = p.id || p.b?.id;
    if (id && LANDMARKS[id]) return LANDMARKS[id];
    const type = p.b?.type || p.type;
    // Metro / warehouses stay procedural: the headhouse kit is a 4 m kiosk on a
    // 16 m lot (giant floating sign + invisible walls), and the dock shed
    // buried players in the Merge Yard floor.
    if (type === 'metro' || type === 'warehouse') return null;
    if (type === 'housing') {
        const dist = p.district;
        if (dist === 'heights' || dist === 'estates' || dist === 'suburbia') {
            const n = (id || '').split('').reduce((h, c) => h + c.charCodeAt(0), 0);
            return HOUSES[Math.abs(n) % HOUSES.length];
        }
        const fl = p.floors || p.b?.fl || 4;
        return fl >= 6 ? 'residential_highrise' : 'condo_midrise';
    }
    if (id && id.startsWith('suburb_')) {
        const n = parseInt(id.split('_')[1], 10) || 1;
        return HOUSES[(n - 1) % HOUSES.length];
    }
    return null;
}

export function kitIdForInfill(lot) {
    const u = lot.seed ?? 0.5;
    const biome = lot.biome;
    if (biome === 'park' || biome === 'forest' || biome === 'desert') return null;
    if (biome === 'suburban') return pick(HOUSES, u);
    const h = lot.h || (lot.fl || 1) * 24;
    if (biome === 'coastal') {
        if (h < 80) return pick(['dock_warehouse', 'streamline_diner', 'boutique_hotel'], u);
        return pick(['waterfront_condo', 'boutique_hotel', 'hotel_tower'], u);
    }
    if (h < 80) return pick(INFILL_LOW, u);
    if (h < 220) return pick(INFILL_MID, u);
    return pick(INFILL_HIGH, u);
}

/** Fill the lot in plan so you can walk up to the walls. Cap height so a
    4 m diner cannot become a 70 m HQ. Colliders are shrunk to this footprint
    in world.js — leaving the old lot box was the invisible-wall bug. */
export function kitScale(kit, p) {
    const sx = p.w / kit.size.x;
    const sy = p.h / kit.size.y;
    const sz = p.d / kit.size.z;
    let s = Math.min(sx, sz);
    const maxH = (kit.kind === 'house' || kit.fit === 'uniform') ? 2.4 : 1.35;
    if (s * kit.size.y > p.h * maxH) s = (p.h * maxH) / kit.size.y;
    if (kit.kind === 'house' || kit.fit === 'uniform') s *= 0.94;
    return s;
}

export function get(id) {
    return cache.get(id) || null;
}

export function has(id) {
    return !!cache.get(id);
}

function windowMaterial(src) {
    const mat = src && src.isMaterial ? src.clone() : new THREE.MeshStandardMaterial();
    mat.vertexColors = true;
    mat.flatShading = true;
    mat.metalness = 0.08;
    mat.roughness = 0.72;
    mat.envMapIntensity = 0.9;
    mat.emissive = new THREE.Color(0xffe0a8);
    mat.emissiveIntensity = 0;
    mat.transparent = false;
    mat.opacity = 1;
    if ('transmission' in mat) mat.transmission = 0;
    mat.onBeforeCompile = (shader) => {
        shader.fragmentShader = shader.fragmentShader.replace(
            '#include <emissivemap_fragment>',
            `#include <emissivemap_fragment>
             #ifdef USE_COLOR
             {
                vec3 vc = vColor;
                float lum = dot(vc, vec3(0.299, 0.587, 0.114));
                float cyan = clamp(vc.b - vc.r * 0.55, 0.0, 1.0);
                float warm = clamp(vc.r * 1.15 - vc.b * 0.60, 0.0, 1.0);
                float neon = clamp(max(vc.r, vc.b) - vc.g * 0.80, 0.0, 1.0);
                float win = smoothstep(0.26, 0.58, lum) * max(cyan, max(warm, neon * 0.9));
                totalEmissiveRadiance *= win;
             }
             #endif`
        );
    };
    mat.customProgramCacheKey = () => 'sc-kit-night-windows';
    return mat;
}

function vehicleMaterial(src) {
    const mat = src && src.isMaterial ? src.clone() : new THREE.MeshStandardMaterial();
    mat.vertexColors = true;
    mat.flatShading = true;
    mat.metalness = 0.18;
    mat.roughness = 0.48;
    mat.envMapIntensity = 0.9;
    mat.transparent = false;
    if ('transmission' in mat) mat.transmission = 0;
    return mat;
}

function prepare(gltf, def) {
    const root = gltf.scene;
    root.updateMatrixWorld(true);
    let src = null;
    root.traverse((o) => { if (o.isMesh && !src) src = o; });
    if (!src) return null;
    const geo = src.geometry.clone();
    geo.applyMatrix4(src.matrixWorld);
    geo.computeBoundingBox();
    const bb = geo.boundingBox;
    const cx = (bb.min.x + bb.max.x) * 0.5;
    const cz = (bb.min.z + bb.max.z) * 0.5;
    geo.translate(-cx, -bb.min.y, -cz);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    if (size.x < 1e-4 || size.y < 1e-4 || size.z < 1e-4) return null;
    const windows = def.kind === 'tower' || def.kind === 'house' || def.kind === 'pad';
    const material = windows ? windowMaterial(src.material) : vehicleMaterial(src.material);
    return {
        geometry: geo,
        material,
        size,
        kind: def.kind,
        fit: def.fit || (def.kind === 'house' ? 'uniform' : 'box')
    };
}

let _loader = null;
async function getLoader() {
    if (_loader) return _loader;
    const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
    const { DRACOLoader } = await import('three/addons/loaders/DRACOLoader.js');
    const draco = new DRACOLoader();
    draco.setDecoderPath(new URL('../lib/draco/', import.meta.url).href);
    const loader = new GLTFLoader();
    loader.setDRACOLoader(draco);
    _loader = loader;
    return loader;
}

async function loadOne(loader, id) {
    if (cache.has(id)) return cache.get(id);
    const def = KITS[id];
    if (!def) return null;
    const url = new URL(def.path, ROOT).href;
    try {
        const gltf = await loader.loadAsync(url);
        const kit = prepare(gltf, def);
        if (!kit) {
            cache.set(id, null);
            return null;
        }
        kit.id = id;
        cache.set(id, kit);
        if (def.kind === 'tower' || def.kind === 'house' || def.kind === 'pad') {
            windowMaterials.push(kit.material);
        }
        return kit;
    } catch (e) {
        console.warn('[assets] failed to load', id, e);
        cache.set(id, null);
        return null;
    }
}

function idsToLoad(opts) {
    const need = new Set(Object.values(LANDMARKS));
    need.add('metro_headhouse');
    for (const id of HOUSES) need.add(id);
    need.add('condo_midrise');
    need.add('residential_highrise');
    if (opts.infill !== false) {
        for (const id of INFILL_LOW) need.add(id);
        for (const id of INFILL_MID) need.add(id);
        for (const id of INFILL_HIGH) need.add(id);
    }
    if (opts.vehicles !== false) {
        for (const id of VEHICLE_IDS) need.add(id);
    }
    if (opts.harbour !== false) {
        for (const id of HARBOUR_IDS) need.add(id);
        need.add('dock_warehouse');
        need.add('fuel_dock');
        need.add('waterfront_condo');
        need.add('streamline_diner');
        need.add('downtown_glass');
        need.add('nightclub');
        need.add('grand_deco_hotel');
        need.add('deco_bank');
    }
    if (opts.interiors !== false) {
        for (const id of INTERIOR_IDS) need.add(id);
    }
    if (opts.trees !== false) {
        for (const id of TREE_IDS) need.add(id);
        need.add('diesel');
        need.add('container_wagon');
    }
    return [...need].filter((id) => KITS[id]);
}

/** Parks get broad canopies; sidewalks get columnar / street trees. */
export function treeIdForBiome(biome, u) {
    if (biome === 'coastal') return pick(['royal_palm', 'date_palm', 'doum_palm'], u);
    if (biome === 'forest') return pick(FOREST_TREES, u);
    if (biome === 'park') return pick(PARK_TREES, u);
    if (biome === 'suburban') return pick(['shade_tree', 'flowering_tree', 'fruit_tree', 'oak', 'apple_tree'], u);
    if (biome === 'plaza' || biome === 'academic') return pick(['plaza_ficus', 'street_tree_metro', 'flowering_tree'], u);
    if (biome === 'desert') return pick(['date_palm', 'doum_palm'], u);
    if (biome === 'wasteland') return pick(['lineside_pine', 'pine'], u);
    return pick(STREET_TREES, u);
}

/** Fetch every kit we intend to instance. Partial failure is fine — World
    falls back to the procedural boxes for anything missing. */
export async function load(opts = {}) {
    if (typeof window === 'undefined') return { loaded: 0, failed: 0 };
    const loader = await getLoader();
    const ids = idsToLoad(opts);
    const results = await Promise.allSettled(ids.map((id) => loadOne(loader, id)));
    let loaded = 0, failed = 0;
    for (const r of results) {
        if (r.status === 'fulfilled' && r.value) loaded++;
        else failed++;
    }
    return { loaded, failed, total: ids.length };
}

/** Ambient-fleet helper. File forward is +Z, pivot at the rear axle.
    Scaled to ~5.2 m so they sit next to the procedural sedan, not as toys. */
export function instantiateVehicle(id) {
    const kit = get(id);
    if (!kit) return null;
    const len = Math.max(kit.size.x, kit.size.z);
    const s = 52 / len;
    const mesh = new THREE.Mesh(kit.geometry, kit.material);
    mesh.scale.setScalar(s);
    mesh.userData.fwd = 'z';
    mesh.userData.kitShared = true;
    mesh.name = 'kitveh:' + id;
    return mesh;
}

/** Loose world prop (boats, palms, docks). `metres` is a visual multiplier
    on top of 10 u = 1 m — ships in this city are themselves stylised-large. */
export function instantiateWorld(id, metres = 1) {
    const kit = get(id);
    if (!kit) return null;
    const mesh = new THREE.Mesh(kit.geometry, kit.material);
    mesh.scale.setScalar(WORLD_PER_M * metres);
    mesh.userData.kitShared = true;
    mesh.name = 'kitprop:' + id;
    return mesh;
}

/** Interior-local units. Pass `targetW` (the width the room already uses for
    a sofa/desk) so a 2 m kit matches the 3×-authored furniture, not a doll. */
export function instantiateInterior(id, targetW = 72) {
    const kit = get(id);
    if (!kit) return null;
    const mesh = new THREE.Mesh(kit.geometry.clone(), kit.material.clone());
    const native = Math.max(kit.size.x, 0.2);
    mesh.scale.setScalar(targetW / native);
    mesh.userData.kitW = targetW;
    mesh.userData.kitD = kit.size.z * (targetW / native);
    mesh.userData.kitH = kit.size.y * (targetW / native);
    mesh.name = 'kitint:' + id;
    return mesh;
}

export const VEHICLE_CYCLE = VEHICLE_IDS;

export const Assets = {
    KITS, LANDMARKS, windowMaterials, WORLD_PER_M,
    load, get, has, kitIdForPlacement, kitIdForInfill, kitScale, treeIdForBiome,
    instantiateVehicle, instantiateWorld, instantiateInterior, VEHICLE_CYCLE
};
