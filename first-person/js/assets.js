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
import { KITS, kitAssetPath, kitPack } from './kit_registry.js';

export { KITS };

const ROOT = new URL('../assets/', import.meta.url);

export const WORLD_PER_M = 10;

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

/* Kit façades — glazing from the packs' own palettes.

   Every threejsassets pack bakes its colours from a named palette
   (palettes.json, not shipped), and the night variant of that palette says
   exactly what the artists meant: `glass` becomes a warm lit window, `glassDark`
   amber, `glass2` a cool fluorescent office, while `glassOff` and the
   `curtain` wall stay dark. The GLBs only carry the DAY colours, though, so
   the old shader guessed — it lit "anything bright cyan or warm", which missed
   every window in a VC Row tower (they went pitch black at night) and, when a
   first attempt keyed on dark cool colours instead, lit `metalDark`: the
   frame, which turned whole towers into cream slabs.

   So the palette is reproduced below (day values only), each vertex is
   matched against it once at load, and the result rides along as `aGlaze`:
     0 structure · 1 lit warm · 2 lit amber · 3 lit cool · 4 dark glass ·
     5 curtain wall · 6 neon
   (`screen` is deliberately left out: its day colour, #4a5560, is within
   rounding of the mullion charcoal that makes up ~30% of a tower's area, and
   matching it lit every frame as a white wireframe.)
   By day every glazed code is smooth and semi-metallic so the towers reflect
   the sky PMREM. By night codes 1–3 glow in their palette colour, with a
   per-building hash switching off roughly a quarter of the floor bays so a
   city of identical kits doesn't light identically, and neon/screens burn. */
const GLAZE_PALETTES = {
    metropolis: { glass: '#9fc6d8', glassDark: '#5f8ba3', glass2: '#b8d4e0', glassOff: '#7c98a8', curtain: '#7fb0c8', curtainDark: '#4a7690', neon: '#d84a9a', neon2: '#3ab8c8' },
    'vice-beach': { glass: '#bcd7e0', glassBlock: '#cfe4e6', glassDark: '#7fa6b2', glassBlockD: '#a2bcc0', glass2: '#dceaf0', glassOff: '#4a6470', curtain: '#587a8e', curtainDark: '#3d5a6c', neon: '#3fe0d8', neonP: '#ff5aa8', neonB: '#7a7aff' },
    city: { glass: '#bcd7e0', glassDark: '#7fa6b2', glass2: '#dcecf3', glassOff: '#5c7888', curtain: '#587a8e', curtainDark: '#3a5464', neon: '#d84a9a', neon2: '#3ab8c8' },
    'suburban-neighborhood': { glass: '#c2d6e0', glassDark: '#82a4b4', glassOff: '#b4c8d4' }
};
const GLAZE_CODE = {
    glass: 1, glassBlock: 1, glassDark: 2, glassBlockD: 2, glass2: 3, glassOff: 4,
    curtain: 5, curtainDark: 5, neon: 6, neon2: 6, neonP: 6, neonB: 6
};
const _glazeTables = {};
function glazeTable(src) {
    const pack = String(src).split('/')[0];
    if (!GLAZE_PALETTES[pack]) return null;
    if (!pack) return null;
    if (_glazeTables[pack]) return _glazeTables[pack];
    const c = new THREE.Color();
    const rows = [];
    for (const [name, hex] of Object.entries(GLAZE_PALETTES[pack])) {
        c.set(hex);   // THREE.Color stores linear, which is what GLB COLOR_0 holds
        rows.push([c.r, c.g, c.b, GLAZE_CODE[name]]);
    }
    _glazeTables[pack] = rows;
    return rows;
}

/** Tag every vertex with its glazing code (see above). Exact-ish palette
    matching: a vertex within 0.02 (linear, per channel RMS) of a named colour
    takes its code; anything else is structure. */
function tagGlazing(geo, src) {
    const col = geo.getAttribute('color');
    const table = glazeTable(src);
    const n = geo.getAttribute('position').count;
    const codes = new Float32Array(n);
    if (col && table) {
        for (let i = 0; i < n; i++) {
            const r = col.getX(i), g = col.getY(i), b = col.getZ(i);
            let best = 0, bestD = 0.0012;
            for (const t of table) {
                const d = (t[0] - r) ** 2 + (t[1] - g) ** 2 + (t[2] - b) ** 2;
                if (d < bestD) { bestD = d; best = t[3]; }
            }
            codes[i] = best;
        }
    }
    geo.setAttribute('aGlaze', new THREE.BufferAttribute(codes, 1));
}

const KIT_VERT_PARS = /* glsl */`
    attribute float aGlaze;
    varying float vGlaze;
    varying vec3 vKitW;
    varying vec3 vKitN;
    varying vec3 vKitRaw;
    varying float vKitSeed;
`;
const KIT_VERT_BODY = /* glsl */`
    {
        vGlaze = aGlaze;
        vec4 kw = vec4( transformed, 1.0 );
        vec3 kn = objectNormal;
        #ifdef USE_INSTANCING
            kw = instanceMatrix * kw;
            kn = mat3( instanceMatrix ) * kn;
            vKitSeed = fract( sin( dot( instanceMatrix[3].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
        #else
            vKitSeed = fract( sin( dot( modelMatrix[3].xz, vec2( 12.9898, 78.233 ) ) ) * 43758.5453 );
        #endif
        kw = modelMatrix * kw;
        vKitW = kw.xyz;
        vKitN = normalize( mat3( modelMatrix ) * kn );
        #ifdef USE_COLOR
            vKitRaw = color.rgb;
        #else
            vKitRaw = vec3( 1.0 );
        #endif
    }
`;
const KIT_FRAG_PARS = /* glsl */`
    varying float vGlaze;
    varying vec3 vKitW;
    varying vec3 vKitN;
    varying vec3 vKitRaw;
    varying float vKitSeed;
    float kitHash( vec2 p ) { return fract( sin( dot( p, vec2( 127.1, 311.7 ) ) ) * 43758.5453 ); }
`;
// After color_fragment: classify the fragment once, reuse it below.
const KIT_FRAG_CLASSIFY = /* glsl */`
    float kitCode = floor( vGlaze + 0.5 );
    #ifdef KIT_HOUSE
        // The suburban palette designs most house panes as glassOff, which
        // left a street of homes pitch black after dark. Treat them as
        // windows that may be lit; the per-bay hash below keeps it to some.
        if ( kitCode > 3.5 && kitCode < 4.5 ) kitCode = 1.0;
    #endif
    float kitLitGlass = step( 0.5, kitCode ) * step( kitCode, 3.5 );
    float kitGlazed = step( 0.5, kitCode ) * step( kitCode, 5.5 );
`;
const KIT_FRAG_ROUGH = /* glsl */`
    #include <roughnessmap_fragment>
    roughnessFactor = mix( roughnessFactor, 0.12, kitGlazed );
`;
const KIT_FRAG_METAL = /* glsl */`
    #include <metalnessmap_fragment>
    metalnessFactor = mix( metalnessFactor, 0.55, kitGlazed );
`;
const KIT_FRAG_EMISSIVE = /* glsl */`
    #include <emissivemap_fragment>
    {
        // The emissive uniform is colour x intensity, and Weather's colours are
        // all ~1.0 in their brightest channel, so its max IS the night ramp
        // (incl. Wetness's rain boost). Half of its hue is kept so the crisis
        // flicker in news_reactivity still reddens the skyline.
        float kitNight = max( emissive.r, max( emissive.g, emissive.b ) );
        vec3 kitTint = mix( vec3( 1.0 ), emissive / max( kitNight, 1e-4 ), 0.5 );
        vec3 glow = vec3( 0.0 );
        if ( kitLitGlass > 0.5 ) {
            vec2 tng = normalize( vec2( -vKitN.z, vKitN.x ) + vec2( 1e-4 ) );
            vec2 bay = floor( vec2( dot( vKitW.xz, tng ) / 64.0, vKitW.y / 34.0 ) );
            float h = kitHash( bay + vKitSeed * 131.0 );
            #ifdef KIT_HOUSE
                float on = step( 0.45, h );
            #else
                float on = step( 0.24, h ) + ( 1.0 - step( 1.0, bay.y ) );   // lobbies always on
            #endif
            vec3 tint = kitCode < 1.5 ? vec3( 1.0, 0.72, 0.38 )          // #ffd98a
                      : kitCode < 2.5 ? vec3( 0.75, 0.36, 0.07 )          // #e0a24a
                      : vec3( 0.62, 0.8, 1.0 );                           // #cfe8ff
            glow = tint * min( on, 1.0 ) * ( 0.42 + 0.4 * kitHash( bay.yx + vKitSeed * 7.0 ) );
        } else if ( kitCode > 5.5 ) {
            glow = vKitRaw * 1.8;                                         // neon tube
        }
        totalEmissiveRadiance = glow * kitNight * kitTint;
    }
`;

function windowMaterial(src, kind) {
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
    if (kind === 'house') mat.defines = { ...(mat.defines || {}), KIT_HOUSE: '' };
    mat.onBeforeCompile = (shader) => {
        shader.vertexShader = KIT_VERT_PARS + shader.vertexShader.replace(
            '#include <project_vertex>',
            '#include <project_vertex>\n' + KIT_VERT_BODY
        );
        shader.fragmentShader = KIT_FRAG_PARS + shader.fragmentShader
            .replace('#include <color_fragment>', '#include <color_fragment>\n' + KIT_FRAG_CLASSIFY)
            .replace('#include <roughnessmap_fragment>', KIT_FRAG_ROUGH)
            .replace('#include <metalnessmap_fragment>', KIT_FRAG_METAL)
            .replace('#include <emissivemap_fragment>', KIT_FRAG_EMISSIVE);
    };
    mat.customProgramCacheKey = () => (kind === 'house' ? 'sc-kit-glaze-v3-house' : 'sc-kit-glaze-v3');
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

/* Furniture: matte, barely metallic, smooth-shaded where the kit has
   normals. The vehicle material's sheen made every sofa look lacquered. */
function furnitureMaterial(src) {
    const mat = src && src.isMaterial ? src.clone() : new THREE.MeshStandardMaterial();
    mat.vertexColors = true;
    mat.flatShading = true;
    mat.metalness = 0.04;
    mat.roughness = 0.78;
    mat.envMapIntensity = 0.55;
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
    // A lamp's pole or a blade sign's wall bracket IS the placement point;
    // recentring on the bounding box would plant the lamp by its arm.
    const authored = def.origin === 'authored';
    const cx = authored ? 0 : (bb.min.x + bb.max.x) * 0.5;
    const cz = authored ? 0 : (bb.min.z + bb.max.z) * 0.5;
    geo.translate(-cx, -bb.min.y, -cz);
    geo.computeBoundingBox();
    geo.computeBoundingSphere();
    const size = new THREE.Vector3();
    geo.boundingBox.getSize(size);
    if (size.x < 1e-4 || size.y < 1e-4 || size.z < 1e-4) return null;
    const windows = def.kind === 'tower' || def.kind === 'house' || def.kind === 'pad' || def.kind === 'street';
    if (windows) tagGlazing(geo, def.src);
    const material = windows ? windowMaterial(src.material, def.kind)
        : def.kind === 'interior' ? furnitureMaterial(src.material)
            : vehicleMaterial(src.material);
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
    const url = new URL(kitAssetPath(id), ROOT).href;
    try {
        const gltf = await loader.loadAsync(url);
        const kit = prepare(gltf, def);
        if (!kit) {
            cache.set(id, null);
            return null;
        }
        kit.id = id;
        cache.set(id, kit);
        if (def.kind === 'tower' || def.kind === 'house' || def.kind === 'pad' || def.kind === 'street') {
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
    if (opts._onlyGroups) {
        return Object.entries(KITS).filter(([, k]) => opts.groups.includes(k.group)).map(([id]) => id);
    }
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
    if (opts.groups) {
        for (const [id, k] of Object.entries(KITS)) {
            if (opts.groups.includes(k.group)) need.add(id);
        }
    }
    if (opts.street !== false) {
        for (const [id, k] of Object.entries(KITS)) {
            if (k.group !== 'street') continue;
            if (k.heavy && opts.heavy === false) continue;
            need.add(id);
        }
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

/* Groups fetched after boot (interior furniture). Listeners run once the
   group is in, so a room that was built without its furniture can rebuild. */
const _groupState = {};
export function loadGroup(group, opts = {}) {
    if (_groupState[group]?.promise) return _groupState[group].promise;
    const st = _groupState[group] || { done: false, listeners: [] };
    st.promise = load({ ...opts, street: false, infill: false, vehicles: false, harbour: false,
        interiors: false, trees: false, groups: [group], _onlyGroups: true })
        .then((r) => {
            st.done = true;
            for (const fn of st.listeners) { try { fn(r); } catch (e) { console.warn(e); } }
            st.listeners.length = 0;
            return r;
        });
    _groupState[group] = st;
    return st.promise;
}
export function groupReady(group) { return !!_groupState[group]?.done; }
export function onGroup(group, fn) {
    const st = _groupState[group] || (_groupState[group] = { done: false, listeners: [] });
    if (st.done) fn();
    else st.listeners.push(fn);
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
    load, loadGroup, groupReady, onGroup, get, has, kitIdForPlacement, kitIdForInfill, kitScale, treeIdForBiome,
    instantiateVehicle, instantiateWorld, instantiateInterior, VEHICLE_CYCLE
};
