/* ══════════════════════════════════════════════════════════════════════════
   FURNISH — real furniture for the generic rooms, from the threejsassets
   interior packs (Home Office, Living Room, Kitchen, Bedroom, Library, and
   the Vice Beach lobby / club pieces).

   Until now every generic room — every lab HQ lobby, every office floor,
   every apartment, the university library — was dressed in coloured boxes: a
   70-wide brown slab with a navy square on it was a desk, a grey cube was a
   chair. The packs are authored in real metres, and the interior group runs
   at 30 local units to the metre (ROOM_SCALE = 1/3 of world's 10 u/m), so a
   kit drops in at x30 and simply fits: a 0.74 m desk is 22 units, a 3.2 m
   ceiling is 96.

   Coordinates are interior-LOCAL (see interior.js): the room spans
   x ±280, z ±230, the lift aisle is x < -190, the street door is at z +224
   with |x| < 45, and the name board hangs centre-back above y 65. Every kit
   faces +z as authored; `ry` turns it.

   Each kit becomes ONE InstancedMesh per room, however many chairs there are,
   and shares the loaded geometry and material — the interior teardown skips
   anything flagged `kitShared` rather than disposing the city-wide copy.

   Layouts return occupant spots for interior.js to seat the real citizens at:
   `pose: 'sit'` spots are chairs and sofas, `work` is a desk.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { Assets } from '../assets.js';

export const PER_M = 30;          // interior-local units per metre

const _d = new THREE.Object3D();

/* One shared canvas of book spines for every procedural bookcase: varied
   widths, heights and bindings, a gilt band or two, dark gaps. Tiles along
   u, so each shelf takes a different slice of it. */
let _spines = null;
export function spineTexture() {
    if (_spines) return _spines;
    const W = 1024, H = 128;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    x.fillStyle = '#140d08';
    x.fillRect(0, 0, W, H);
    const cols = ['#7a2f2a', '#2f4a7a', '#3d6b45', '#8a6a2a', '#5a3a6a', '#2a2f38', '#a0522d', '#1f5f5f', '#6b2f3f', '#c9b28a', '#3a3a5a', '#4a6a2a'];
    let px = 0, seed = 7;
    const r = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    while (px < W) {
        const w = 8 + Math.floor(r() * 18);
        const h = H * (0.62 + r() * 0.36);
        const col = cols[Math.floor(r() * cols.length)];
        x.fillStyle = col;
        x.fillRect(px, H - h, w - 1, h);
        // spine shading + gilt bands
        x.fillStyle = 'rgba(255,255,255,0.10)';
        x.fillRect(px + 1, H - h, 2, h);
        x.fillStyle = 'rgba(0,0,0,0.25)';
        x.fillRect(px + w - 3, H - h, 2, h);
        if (r() < 0.7) {
            x.fillStyle = 'rgba(230,200,120,0.75)';
            x.fillRect(px + 1, H - h + h * 0.18, w - 3, 2);
            x.fillRect(px + 1, H - h + h * 0.78, w - 3, 2);
        }
        px += w + (r() < 0.08 ? 10 : 0);
    }
    _spines = new THREE.CanvasTexture(c);
    _spines.colorSpace = THREE.SRGBColorSpace;
    _spines.wrapS = THREE.RepeatWrapping;
    _spines.userData.shared = true;
    return _spines;
}

export class Furnisher {
    constructor(group, solids) {
        this.group = group;
        this.solids = solids;
        this.batches = new Map();
        this.placed = 0;
    }

    /** Every kit a layout needs is loaded. */
    static ready(ids) {
        return ids.every(id => Assets.has(id));
    }

    size(id, s = 1) {
        const k = Assets.get(id);
        return k ? { w: k.size.x * PER_M * s, h: k.size.y * PER_M * s, d: k.size.z * PER_M * s } : null;
    }

    /** Place a kit. `o.y` lifts it (wall art, things on a desk), `o.s`
        scales it, `o.solid` registers its footprint as a collider. */
    put(id, x, z, ry = 0, o = {}) {
        const kit = Assets.get(id);
        if (!kit) return null;
        const s = (o.s ?? 1) * PER_M;
        _d.position.set(x, o.y ?? 0, z);
        _d.rotation.set(0, ry, 0);
        _d.scale.set(s * (o.sx ?? 1), s * (o.sy ?? 1), s * (o.sz ?? 1));
        _d.updateMatrix();
        if (!this.batches.has(id)) this.batches.set(id, []);
        const m = _d.matrix.clone();
        m.tint = o.tint ?? null;
        this.batches.get(id).push(m);
        const w = kit.size.x * s * (o.sx ?? 1), d = kit.size.z * s * (o.sz ?? 1);
        if (o.solid) {
            const q = Math.abs(Math.sin(ry)) > 0.7;
            const hw = (q ? d : w) / 2 + (o.pad ?? 2), hd = (q ? w : d) / 2 + (o.pad ?? 2);
            this.solids.push({ x0: x - hw, z0: z - hd, x1: x + hw, z1: z + hd });
        }
        this.placed++;
        return { w, d, h: kit.size.y * s * (o.sy ?? 1) };
    }

    finish() {
        for (const [id, mats] of this.batches) {
            const kit = Assets.get(id);
            const im = new THREE.InstancedMesh(kit.geometry, kit.material, mats.length);
            mats.forEach((m, i) => im.setMatrixAt(i, m));
            // per-instance tint (a bespoke room's chairs in its own palette)
            if (mats.some(m => m.tint != null)) {
                const c = new THREE.Color();
                mats.forEach((m, i) => im.setColorAt(i, m.tint != null ? c.set(m.tint) : c.set(0xffffff)));
                im.instanceColor.needsUpdate = true;
            }
            im.instanceMatrix.needsUpdate = true;
            im.name = 'furnish:' + id;
            im.userData.kitShared = true;
            im.frustumCulled = false;
            this.group.add(im);
        }
        this.batches.clear();
    }
}

// Which kits each layout can't do without. Missing any → procedural fallback.
export const NEEDS = {
    office: ['in_reception', 'in_sofa', 'in_lounge_chair', 'in_coffee_table', 'in_office_plant', 'in_area_rug'],
    openplan: ['in_l_desk', 'in_task_chair', 'in_monitor', 'in_partition', 'in_whiteboard'],
    boardroom: ['in_exec_chair', 'in_credenza', 'in_tv'],
    home: ['in_sofa', 'in_armchair', 'in_coffee_table', 'in_media_unit', 'in_tv', 'in_base_cab', 'in_fridge', 'in_island', 'in_bar_stool'],
    academic: ['in_reading_table', 'in_library_chair', 'in_banker_lamp', 'in_issue_desk'],
    cafe: ['in_cafe_set', 'in_coffee_machine', 'in_bar_stool', 'in_base_cab'],
    vc: ['in_chesterfield', 'in_reading_arm', 'in_bar_cart', 'in_exec_chair'],
    mission: ['in_console', 'in_task_chair', 'in_status_board', 'in_radar'],
    power: ['in_generator', 'in_transformer', 'in_breaker', 'in_console'],
    nursery: ['in_crib', 'in_play_rug', 'in_teepee', 'in_toy_box'],
    warehouse: ['in_shelf_rack', 'in_pallets', 'in_crate'],
    conference: ['in_accent_chair', 'in_speakers']
};

const LIFT_X = -190;             // keep x below this clear when there's a lift

/* ── shared bits ──────────────────────────────────────────────────────── */
function pendants(F, id, xs, z, H) {
    const sz = F.size(id);
    if (!sz) return;
    for (const x of xs) F.put(id, x, z, 0, { y: H - sz.h - 1 });
}
function plant(F, x, z, s = 1.5) {
    F.put('in_office_plant', x, z, (x * 0.37) % 6.28, { s, solid: true, pad: 0 });
}
/* A procedural bookcase: dark frame + a book-spine texture per shelf. Real
   book-row kits are 12–17k triangles apiece; a wall of them was millions. */
export function bookcase(ctx, x, z, w, h, ry, spines) {
    const { box } = ctx;
    const along = Math.abs(Math.sin(ry)) > 0.7;     // runs along z?
    const depth = 12;
    const bw = along ? depth : w, bd = along ? w : depth;
    box(bw, h, bd, x, h / 2, z, 0x3b2a1d);
    ctx.solid?.(x, z, bw, bd);
    const shelves = Math.max(3, Math.floor(h / 17));
    const fx = Math.sin(ry), fz = Math.cos(ry);       // front normal
    for (let i = 0; i < shelves; i++) {
        const y = 6 + i * (h - 8) / shelves + 6;
        const g = new THREE.PlaneGeometry(w - 4, (h - 8) / shelves - 3);
        const uv = g.attributes.uv;
        const u0 = ((x * 13 + z * 7 + i * 31) % 97) / 97;
        for (let k = 0; k < uv.count; k++) uv.setX(k, u0 + uv.getX(k) * (w / 90));
        g.rotateY(ry);
        g.translate(x + fx * (depth / 2 + 0.3), y, z + fz * (depth / 2 + 0.3));
        spines.push(g);
        // shelf board
        box(along ? depth + 1 : w, 1.6, along ? w : depth + 1, x, y - (h - 8) / shelves / 2 + 1, z, 0x2a1d14);
    }
}

/* ── lab HQ / office lobby ────────────────────────────────────────────── */
export function office(F, ctx) {
    const { H, lift } = ctx;
    const spots = [];
    // reception: the desk's front (+z) faces the door, staff stand behind it
    // (s 0.72 keeps its back panel under the name board's subtitle line)
    F.put('in_reception', 20, -176, 0, { s: 0.72, solid: true });
    pendants(F, 'in_office_pendant', [-40, 20, 80], -150, H);
    spots.push({ x: -16, z: -200, facing: 1, pose: 'work', stay: true });
    spots.push({ x: 56, z: -200, facing: 1, pose: 'work', stay: true });
    /* The lobby's centre: an island between the door and reception — a rug,
       a display case of the lab's work flanked by planters, and a ring of
       seats — so walking in you cross a room, not an empty tiled field. */
    F.put('in_office_rug', 20, -40, 0, { y: 0.4, s: 2.4 });
    if (Assets.has('in_display_case')) F.put('in_display_case', 20, -44, 0, { s: 1.05, solid: true });
    for (const dx of [-46, 86]) {
        F.put('in_office_plant', dx, -44, dx * 0.1, { s: 2.1, solid: true, pad: 0 });
    }
    F.put('in_loveseat', 20, 8, Math.PI, { s: 0.9, solid: true });
    spots.push({ x: 14, z: 6, facing: -1, pose: 'sit' });
    F.put('in_pendant', 20, -44, 0, { y: H - 26, s: 1.4 });
    // lounge, right of the entrance axis: rug, sofa facing the chairs
    F.put('in_area_rug', 180, 20, 0, { y: 0.4, s: 1.05 });
    F.put('in_sofa', 180, 64, Math.PI, { solid: true });
    F.put('in_coffee_table', 180, 22, 0, { solid: true });
    F.put('in_lounge_chair', 145, -22, 0.25, { s: 1.08, solid: true });
    F.put('in_lounge_chair', 215, -22, -0.25, { s: 1.08, solid: true });
    F.put('in_floor_lamp', 240, 72, 0);
    F.put('in_side_table', 125, 70, 0, { solid: true });
    spots.push({ x: 165, z: 60, facing: -1, pose: 'sit', stay: true });
    spots.push({ x: 197, z: 60, facing: -1, pose: 'sit', stay: true });
    spots.push({ x: 145, z: -18, facing: 1, pose: 'sit' });
    // waiting bench on the left, clear of the lift aisle
    const lx = lift ? -130 : -200;
    F.put('in_loveseat', lx, 40, Math.PI / 2, { solid: true });
    F.put('in_side_table', lx, 0, 0, { s: 0.8, solid: true });
    F.put('in_table_lamp', lx, 0, 0, { y: 13 });
    spots.push({ x: lx + 4, z: 50, facing: 1, pose: 'sit' });
    // greenery + art
    plant(F, 250, 196, 1.7); plant(F, 220, 200, 1.3);
    plant(F, -150, 196, 1.6); plant(F, 250, -196, 1.8);
    for (let i = 0; i < 3; i++) F.put('in_office_art', 272, -80 + i * 70, -Math.PI / 2, { y: 40, s: 2.2 });
    F.put('in_office_shelf', 150, -214, 0, { solid: true });
    F.put('in_office_shelf', 190, -214, 0, { solid: true });
    F.put('in_hanging_plant', 110, 140, 0, { y: H - 20 });
    F.put('in_hanging_plant', -60, 140, 0, { y: H - 20 });
    // walkers
    spots.push({ x: 20, z: 40, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: 90, z: 120, facing: -1, pose: 'stand', roam: true });
    spots.push({ x: -40, z: -60, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: 60, z: -100, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── open-plan office floor ───────────────────────────────────────────── */
export function openplan(F, ctx) {
    const { H, rnd, box, lit, accent } = ctx;
    const spots = [];
    const rows = [-150, -62, 26];
    const cols = [-130, -62, 6, 74, 142];
    const screens = ['in_monitor', 'in_ultrawide', 'in_dual_monitor', 'in_monitor', 'in_laptop'];
    for (let r = 0; r < rows.length; r++) {
        const z = rows[r];
        // one partition spine behind the row
        for (const x of cols) F.put('in_partition', x, z - 17, 0, { s: 1.1, sy: 1.05 });
        for (let c = 0; c < cols.length; c++) {
            const x = cols[c];
            const standing = rnd() < 0.3;
            F.put(standing ? 'in_standing_desk' : 'in_l_desk', x, z, 0, { solid: true, pad: 1 });
            const top = 22.3;
            const scr = screens[Math.floor(rnd() * screens.length)];
            F.put(scr, x, z - 6, 0, { y: top });
            if (scr !== 'in_laptop') F.put('in_keyboard', x, z + 5, 0, { y: top });
            const extra = rnd();
            if (extra < 0.25) F.put('in_desk_lamp', x + 16, z - 4, -0.4, { y: top });
            else if (extra < 0.5) F.put('in_desk_plant', x - 16, z - 6, 0, { y: top });
            else if (extra < 0.75) F.put('in_mug', x + 12, z + 4, 0, { y: top });
            // chairs on the +z side, turned to the desk
            F.put('in_task_chair', x + (rnd() - 0.5) * 4, z + 24, Math.PI + (rnd() - 0.5) * 0.5);
            spots.push({ x, z: z + 24, facing: -1, pose: 'work' });
        }
        pendants(F, 'in_office_pendant', [-96, 40, 108], z + 4, H);
    }
    // whiteboards and a project wall on the back
    F.put('in_whiteboard', -80, -222, 0, { y: 26, s: 2 });
    F.put('in_whiteboard', 20, -222, 0, { y: 26, s: 2 });
    F.put('in_corkboard', 110, -222, 0, { y: 30, s: 1.8 });
    // storage + kitchenette along the right wall
    for (let i = 0; i < 4; i++) F.put('in_filing', 262, -190 + i * 15, -Math.PI / 2, { solid: true, pad: 0 });
    F.put('in_storage_cubes', 262, -100, -Math.PI / 2, { solid: true });
    F.put('in_office_shelf', 266, -60, -Math.PI / 2, { solid: true });
    F.put('in_office_shelf', 266, -30, -Math.PI / 2, { solid: true });
    for (let i = 0; i < 4; i++) F.put('in_acoustic', 272, 10 + i * 30, -Math.PI / 2, { y: 34 + (i % 2) * 10 });
    // breakout: rug, lounge chairs, a little table
    F.put('in_office_rug', 150, 150, 0, { y: 0.4, s: 1.4 });
    F.put('in_lounge_chair', 120, 150, Math.PI / 2, { solid: true });
    F.put('in_lounge_chair', 182, 150, -Math.PI / 2, { solid: true });
    F.put('in_side_table_o', 150, 150, 0, { solid: true });
    spots.push({ x: 124, z: 150, facing: 1, pose: 'sit' });
    spots.push({ x: 178, z: 150, facing: -1, pose: 'sit' });
    plant(F, 250, 200, 1.6); plant(F, -150, 200, 1.5); plant(F, 60, 200, 1.3);
    F.put('in_hanging_plant', 30, 110, 0, { y: H - 20 });
    // a lab-coloured status wall by the whiteboards
    lit(40, 16, 1.5, 180, 44, -223, accent);
    box(44, 20, 2, 180, 44, -224, 0x111827);
    // walkers
    spots.push({ x: 40, z: 90, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: -120, z: 110, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── top-floor boardroom ──────────────────────────────────────────────── */
export function boardroom(F, ctx) {
    const { box, lit, solid, H } = ctx;
    const spots = [];
    // the table is procedural: a slab of dark walnut with a glass inlay
    const TW = 190, TD = 64, TX = 30, TZ = -40;
    box(TW, 3, TD, TX, 22.5, TZ, 0x2a1d14);
    lit(TW - 30, 0.6, TD - 26, TX, 24.2, TZ, 0x1e293b);
    for (const sx of [-1, 1]) box(10, 21, TD - 20, TX + sx * (TW / 2 - 24), 10.5, TZ, 0x1a120c);
    solid(TX, TZ, TW, TD);
    for (let i = 0; i < 5; i++) {
        const x = TX - 70 + i * 35;
        F.put('in_exec_chair', x, TZ - TD / 2 - 12, 0);
        F.put('in_exec_chair', x, TZ + TD / 2 + 12, Math.PI);
        spots.push({ x, z: TZ - TD / 2 - 12, facing: 1, pose: 'sit' });
        spots.push({ x, z: TZ + TD / 2 + 12, facing: -1, pose: 'sit' });
    }
    F.put('in_exec_chair', TX - TW / 2 - 16, TZ, Math.PI / 2);
    spots.unshift({ x: TX - TW / 2 - 16, z: TZ, facing: 1, pose: 'sit', stay: true });
    // screen wall + credenza
    // screen off to the right of the name board (which owns centre-back, y 65+)
    F.put('in_credenza', 180, -212, 0, { s: 1.4, solid: true });
    F.put('in_tv', 180, -214, 0, { y: 28, s: 1.7 });
    for (let i = 0; i < 3; i++) F.put('in_office_art', 272, -120 + i * 80, -Math.PI / 2, { y: 40, s: 2 });
    F.put('in_bookshelf', 266, 110, -Math.PI / 2, { solid: true });
    F.put('in_bookshelf', 266, 150, -Math.PI / 2, { solid: true });
    F.put('in_bar_cart', 230, 60, -0.4, { solid: true });
    pendants(F, 'in_pendant', [-20, 30, 80], TZ, H);
    plant(F, 250, 200, 1.7); plant(F, -150, 200, 1.6); plant(F, 250, -196, 1.7);
    F.put('in_area_rug', TX, TZ, 0, { y: 0.4, s: 1.35, sz: 1.2 });
    return spots;
}

/* ── apartment (housing towers, villas, mansions) ─────────────────────── */
export function home(F, ctx) {
    const { floor, rnd, box, H, lift } = ctx;
    const spots = [];
    // kitchen run along the back wall: fridge, larder, cabinets, sink, range
    // starts right of the name board (centre-back, |x| < 108, y 65+)
    const run = ['in_fridge', 'in_larder', 'in_base_drawers', 'in_sink', 'in_base_cab', 'in_range', 'in_base_drawers'];
    let x = 118;
    const zc = -211;
    for (const id of run) {
        const sz = F.size(id);
        if (!sz) continue;
        F.put(id, x + sz.w / 2, zc, 0, { solid: true, pad: 0 });
        if (id !== 'in_fridge' && id !== 'in_larder' && id !== 'in_range' && id !== 'in_sink') {
            F.put('in_counter', x + sz.w / 2, zc + 1, 0, { y: sz.h - 0.8 });
        }
        if (id === 'in_range') F.put('in_hood', x + sz.w / 2, zc + 2, 0, { y: 52 });
        else if (id !== 'in_fridge' && id !== 'in_larder') F.put('in_wall_cab', x + sz.w / 2, zc - 4, 0, { y: 50 });
        x += sz.w;
    }
    F.put('in_coffee_machine', 118 + 21 + 18 + 9, zc - 2, 0, { y: 27.5 });
    F.put('in_microwave', x - 20, zc - 2, 0, { y: 27.5 });
    F.put('in_herbs', x - 40, zc - 4, 0, { y: 27.5 });
    // island with stools
    F.put('in_island', 186, -138, 0, { solid: true });
    F.put('in_fruit_bowl', 186, -138, 0, { y: 27 });
    for (const dx of [-12, 12]) {
        F.put('in_bar_stool', 186 + dx, -112, 0);
    }
    pendants(F, 'in_kitchen_pendant', [170, 202], -138, H);
    spots.push({ x: 180, z: -185, facing: -1, pose: 'stand', stay: true });
    spots.push({ x: 174, z: -110, facing: -1, pose: 'sit' });
    // living room, facing a media wall
    F.put('in_area_rug', 150, 60, 0, { y: 0.4 });
    F.put('in_media_unit', 150, 6, 0, { solid: true });
    F.put('in_tv', 150, 6, 0, { y: 15 });
    const bigSofa = rnd() < 0.5 && Assets.has('in_sectional');
    F.put(bigSofa ? 'in_sectional' : 'in_sofa', 150, 110, Math.PI, { solid: true });
    F.put('in_coffee_table', 150, 62, 0, { solid: true });
    F.put('in_armchair', 92, 58, Math.PI / 2, { solid: true });
    F.put('in_floor_lamp', 232, 118, 0);
    F.put('in_side_table', 206, 112, 0, { s: 0.8, solid: true });
    F.put('in_bookshelf', 266, 40, -Math.PI / 2, { solid: true });
    F.put('in_bookshelf', 266, 72, -Math.PI / 2, { solid: true });
    F.put('in_wall_art', 272, 150, -Math.PI / 2, { y: 34, s: 1.6 });
    spots.push({ x: 138, z: 104, facing: -1, pose: 'sit' });
    spots.push({ x: 166, z: 104, facing: -1, pose: 'sit' });
    spots.push({ x: 96, z: 58, facing: 1, pose: 'sit' });
    // the left of the flat: bedroom on odd floors, dining on even
    const lx = lift ? -100 : -170;
    if (floor % 2 === 1 && Assets.has('in_queen_bed')) {
        F.put('in_bedroom_rug', lx, -150, 0, { y: 0.4, s: 0.9 });
        F.put('in_queen_bed', lx, -190, 0, { solid: true });
        F.put('in_nightstand', lx - 34, -212, 0, { solid: true });
        F.put('in_nightstand', lx + 34, -212, 0, { solid: true });
        F.put('in_bedside_lamp', lx - 34, -212, 0, { y: 15 });
        F.put('in_bedside_lamp', lx + 34, -212, 0, { y: 15 });
        F.put('in_wardrobe', lx + 80, -212, 0, { solid: true });
        F.put('in_dresser', lx, -40, Math.PI, { solid: true });
        spots.push({ x: lx, z: -150, facing: 1, pose: 'stand', roam: true });
    } else {
        // dining: procedural walnut table, accent chairs
        const tz = -40;
        box(64, 2.5, 34, lx, 22, tz, 0x5a3b24);
        box(56, 20, 4, lx, 10.5, tz, 0x3b2616);
        ctx.solid(lx, tz, 64, 34);
        for (const dx of [-18, 18]) {
            F.put('in_accent_chair', lx + dx, tz - 26, 0);
            F.put('in_accent_chair', lx + dx, tz + 26, Math.PI);
            spots.push({ x: lx + dx, z: tz + 26, facing: -1, pose: 'sit' });
        }
        pendants(F, 'in_pendant', [lx], tz, H);
        F.put('in_sideboard', lx, -212, 0, { solid: true });
        F.put('in_display_cab', lx + 60, -214, 0, { solid: true });
    }
    F.put('in_floor_plant', 250, 196, 0, { s: 1.2, solid: true });
    F.put('in_floor_plant', lx - 40 > LIFT_X ? lx - 40 : 30, 196, 0, { s: 1.1, solid: true });
    F.put('in_wall_clock', 30, -226, 0, { y: 70 });
    spots.push({ x: 40, z: 120, facing: 1, pose: 'stand', roam: true });
    return spots;
}

/* ── university: library hall / seminar floors ─────────────────────────── */
export function academic(F, ctx, spines) {
    const { lift, H } = ctx;
    const spots = [];
    // book walls: both side walls, and stacks on the left
    // back wall: full-height cases either side of the name board, a low
    // one beneath it — a full-height case hid the board completely
    bookcase(ctx, -180, -218, 150, 84, 0, spines);
    bookcase(ctx, 180, -218, 150, 84, 0, spines);
    bookcase(ctx, 0, -218, 200, 54, 0, spines);
    bookcase(ctx, 268, 30, 300, 84, -Math.PI / 2, spines);
    const sx0 = lift ? -150 : -230;
    for (let i = 0; i < 3; i++) bookcase(ctx, sx0 + i * 44, 110, 90, 70, Math.PI / 2, spines);
    // issue desk by the door
    F.put('in_issue_desk', 150, 150, Math.PI, { s: 0.85, solid: true });
    spots.push({ x: 150, z: 178, facing: -1, pose: 'work', stay: true });
    // two long reading tables with lamps and chairs
    for (const [tx, tz] of [[40, -140], [40, -40]]) {
        F.put('in_reading_table', tx, tz, 0, { solid: true });
        F.put('in_banker_lamp', tx - 20, tz, 0, { y: 24 });
        F.put('in_banker_lamp', tx + 20, tz, Math.PI, { y: 24 });
        for (const dx of [-24, 0, 24]) {
            F.put('in_library_chair', tx + dx, tz - 22, 0);
            F.put('in_library_chair', tx + dx, tz + 22, Math.PI);
            spots.push({ x: tx + dx, z: tz + 22, facing: -1, pose: 'sit' });
            spots.push({ x: tx + dx, z: tz - 22, facing: 1, pose: 'sit' });
        }
        pendants(F, 'in_lib_pendant', [tx - 24, tx + 24], tz, H);
    }
    // reading nook
    if (Assets.has('in_chesterfield')) {
        F.put('in_runner_rug', 180, -80, Math.PI / 2, { y: 0.4, s: 1.1 });
        F.put('in_chesterfield', 180, -40, Math.PI, { s: 0.9, solid: true });
        F.put('in_reading_arm', 150, -110, 0.3, { solid: true });
        F.put('in_reading_arm', 210, -110, -0.3, { solid: true });
        spots.push({ x: 180, z: -44, facing: -1, pose: 'sit' });
    }
    if (Assets.has('in_globe')) F.put('in_globe', 230, 180, 0.4, { solid: true });
    if (Assets.has('in_card_cat')) F.put('in_card_cat', 90, 210, Math.PI, { solid: true });
    if (Assets.has('in_newspaper_rack')) F.put('in_newspaper_rack', 40, 206, Math.PI, { solid: true });
    F.put('in_lib_plant', 250, -196, 0, { solid: true });
    F.put('in_lib_plant', -40, 200, 0, { solid: true });
    spots.push({ x: 100, z: 60, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: -20, z: 30, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── the café ─────────────────────────────────────────────────────────── */
export function cafe(F, ctx) {
    const { H } = ctx;
    const spots = [];
    // counter along the back-left
    for (let i = 0; i < 7; i++) {
        const x = -150 + i * 18;
        F.put(i % 2 ? 'in_base_drawers' : 'in_base_cab', x, -196, Math.PI, { solid: true, pad: 0 });
        F.put('in_counter', x, -197, 0, { y: 26.2 });
    }
    F.put('in_coffee_machine', -120, -196, Math.PI, { y: 27.5, s: 1.3 });
    F.put('in_coffee_machine', -84, -196, Math.PI, { y: 27.5, s: 1.3 });
    F.put('in_display_case', -20, -196, 0, { s: 0.8, solid: true });
    F.put('in_fridge', -200 > LIFT_X ? -200 : -180, -212, 0, { solid: true });
    for (let i = 0; i < 5; i++) F.put('in_bar_stool', -150 + i * 22, -170, 0);
    spots.push({ x: -130, z: -214, facing: 1, pose: 'work', stay: true });
    spots.push({ x: -80, z: -214, facing: 1, pose: 'work', stay: true });
    for (let i = 0; i < 5; i++) spots.push({ x: -150 + i * 22, z: -168, facing: -1, pose: 'sit' });
    pendants(F, 'in_kitchen_pendant', [-140, -100, -60], -196, H);
    // tables
    const tables = [[80, -120], [180, -120], [80, -30], [180, -30], [80, 60], [180, 60], [-60, 60], [-60, 140]];
    for (const [x, z] of tables) {
        F.put('in_cafe_set', x, z, 0, { s: 0.95, solid: true });
        // the set's two chairs sit either side along x, facing the table
        spots.push({ x: x - 19, z, facing: 1, ry: Math.PI / 2, pose: 'sit' });
        spots.push({ x: x + 19, z, facing: -1, ry: -Math.PI / 2, pose: 'sit' });
    }
    F.put('in_office_plant', 250, 196, 0, { s: 1.6, solid: true });
    F.put('in_office_plant', -130, 196, 0, { s: 1.4, solid: true });
    F.put('in_hanging_plant', 130, 20, 0, { y: H - 20 });
    F.put('in_hanging_plant', 130, -80, 0, { y: H - 20 });
    for (let i = 0; i < 3; i++) F.put('in_wall_art', 272, -120 + i * 90, -Math.PI / 2, { y: 36, s: 1.4 });
    return spots;
}

/* ── VC Row: a partners' lounge ───────────────────────────────────────── */
export function vc(F, ctx) {
    const { box, lit, solid, H } = ctx;
    const spots = [];
    // the pitch table (procedural black glass) with exec chairs
    const TX = 20, TZ = -60;
    box(170, 3, 58, TX, 22.5, TZ, 0x0b0f17);
    lit(150, 0.6, 40, TX, 24.2, TZ, 0x111827);
    box(12, 21, 40, TX - 60, 10.5, TZ, 0x0b0f17);
    box(12, 21, 40, TX + 60, 10.5, TZ, 0x0b0f17);
    solid(TX, TZ, 170, 58);
    for (let i = 0; i < 4; i++) {
        const x = TX - 54 + i * 36;
        F.put('in_exec_chair', x, TZ - 41, 0);
        F.put('in_exec_chair', x, TZ + 41, Math.PI);
        spots.push({ x, z: TZ - 41, facing: 1, pose: 'sit' });
        spots.push({ x, z: TZ + 41, facing: -1, pose: 'sit' });
    }
    // chesterfield lounge by the door
    F.put('in_area_rug', 170, 130, 0, { y: 0.4 });
    F.put('in_chesterfield', 170, 170, Math.PI, { s: 0.95, solid: true });
    F.put('in_reading_arm', 125, 110, 0.5, { solid: true });
    F.put('in_reading_arm', 215, 110, -0.5, { solid: true });
    F.put('in_coffee_table', 170, 134, 0, { solid: true });
    spots.push({ x: 160, z: 166, facing: -1, pose: 'sit' });
    spots.push({ x: 128, z: 112, facing: 1, pose: 'sit' });
    F.put('in_bar_cart', 250, 40, -Math.PI / 2, { solid: true });
    F.put('in_display_cab', 262, -40, -Math.PI / 2, { solid: true });
    F.put('in_display_cab', 262, -80, -Math.PI / 2, { solid: true });
    if (Assets.has('in_globe')) F.put('in_globe', 240, -190, 0.5, { solid: true });
    F.put('in_credenza', 20, -212, 0, { s: 1.5, solid: true });
    for (let i = 0; i < 2; i++) F.put('in_wall_art', 272, 80 + i * 70, -Math.PI / 2, { y: 36, s: 1.8 });
    pendants(F, 'in_pendant', [-20, 20, 60], TZ, H);
    F.put('in_office_plant', -140, 196, 0, { s: 1.7, solid: true });
    F.put('in_office_plant', 250, 200, 0, { s: 1.7, solid: true });
    spots.push({ x: 60, z: 60, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: -60, z: 100, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── mission control (launch pads, tracking, assembly) ────────────────── */
export function mission(F, ctx) {
    const { H, lift } = ctx;
    const spots = [];
    // three tiers of consoles facing the status wall
    const rows = [-120, -40, 40];
    const xs = lift ? [-100, -30, 40, 110, 180] : [-170, -100, -30, 40, 110, 180];
    rows.forEach((z, r) => {
        for (const x of xs) {
            F.put('in_console', x, z, 0, { s: 0.62, solid: true, pad: 1 });
            F.put('in_task_chair', x, z + 22, Math.PI);
            spots.push({ x, z: z + 22, facing: -1, pose: 'work' });
        }
        void r;
    });
    // status wall under the name board, radar scopes either side
    for (const x of [-80, 0, 80]) F.put('in_status_board', x, -222, 0, { y: 28, s: 1.2 });
    F.put('in_radar', 200, -200, 0, { solid: true });
    F.put('in_radar', 240, -150, -0.5, { solid: true });
    F.put('in_map_table', 70, 150, 0, { s: 0.9, solid: true });
    spots.push({ x: 70, z: 180, facing: -1, pose: 'stand', roam: true });
    spots.push({ x: 30, z: 120, facing: 1, pose: 'stand', roam: true });
    for (let i = 0; i < 4; i++) F.put('in_radio_rack', 262, -60 + i * 28, -Math.PI / 2, { s: 0.9, solid: true });
    F.put('in_switchboard', 262, 110, -Math.PI / 2, { solid: true });
    F.put('in_clock_b', 272, 40, -Math.PI / 2, { y: 64, s: 1.6 });
    F.put('in_beacon', 262, 180, 0, { y: 70 });
    return spots;
}

/* ── the power stations ───────────────────────────────────────────────── */
export function power(F, ctx) {
    const { lift } = ctx;
    const spots = [];
    // the generators flank the name board (centre-back, |x| < 108), never in front of it
    F.put('in_generator', lift ? -150 : -180, -172, 0, { s: 1.15, solid: true });
    F.put('in_generator', 172, -172, 0, { s: 1.15, solid: true });
    for (let i = 0; i < 5; i++) F.put('in_transformer', 262, -170 + i * 36, -Math.PI / 2, { solid: true });
    for (let i = 0; i < 4; i++) F.put('in_breaker', -130 + i * 50, -224, 0, { y: 30, s: 1.1 });
    F.put('in_console', 60, 20, 0, { s: 0.7, solid: true });
    F.put('in_console', 140, 20, 0, { s: 0.7, solid: true });
    F.put('in_task_chair', 60, 44, Math.PI);
    F.put('in_task_chair', 140, 44, Math.PI);
    spots.push({ x: 60, z: 44, facing: -1, pose: 'work' });
    spots.push({ x: 140, z: 44, facing: -1, pose: 'work' });
    F.put('in_switchboard', 200, 120, Math.PI, { solid: true });
    for (let i = 0; i < 3; i++) F.put('in_locker', 262, 90 + i * 32, -Math.PI / 2, { solid: true });
    F.put('in_barrels', 230, 200, 0, { solid: true });
    F.put('in_hazard_panel', -100, 190, 0, { s: 0.7 });
    for (const x of [-40, 60, 160]) F.put('in_cage_lamp', x, 0, 0, { y: 88 });
    spots.push({ x: 0, z: 100, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: 120, z: -90, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── the nursery ──────────────────────────────────────────────────────── */
export function nursery(F, ctx) {
    const { H } = ctx;
    const spots = [];
    F.put('in_play_rug', 60, 60, 0, { y: 0.4, s: 1.4 });
    for (let i = 0; i < 4; i++) {
        const x = -60 + i * 60;
        F.put('in_crib', x, -190, 0, { solid: true });
        F.put('in_mobile', x, -190, 0, { y: 48 });
    }
    F.put('in_bassinet', 210, -190, 0, { solid: true });
    F.put('in_changing', 262, -110, -Math.PI / 2, { solid: true });
    F.put('in_glider', 230, -40, -Math.PI / 2 - 0.4, { solid: true });
    spots.push({ x: 226, z: -40, facing: -1, ry: -Math.PI / 2 - 0.4, pose: 'sit', stay: true });
    F.put('in_teepee', 200, 130, 0.5, { solid: true });
    F.put('in_rocking_horse', 20, 120, 0.8, { solid: true });
    F.put('in_kids_table', 100, 40, 0, { solid: true });
    F.put('in_toy_box', -60, 180, 0, { solid: true });
    F.put('in_plush', 60, 90, 0.3, { y: 0.5 });
    for (let i = 0; i < 3; i++) F.put('in_cubby', 262, 20 + i * 30, -Math.PI / 2, { solid: true });
    F.put('in_floor_plant', 250, 200, 0, { s: 1.1, solid: true });
    pendants(F, 'in_pendant', [0, 120], 0, H);
    spots.push({ x: 60, z: 30, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: 140, z: 90, facing: -1, pose: 'stand', roam: true });
    spots.push({ x: -20, z: -150, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── port warehouse ───────────────────────────────────────────────────── */
export function warehouse(F, ctx) {
    const { lift } = ctx;
    const spots = [];
    // rack aisles down both sides; the middle stays open for the forklift and
    // for the name board, which a 2.6 m rack would hide
    const rows = lift ? [-145, 135, 212] : [-220, -145, 135, 212];
    const x0 = rows[0];
    for (const x of rows) {
        for (let i = 0; i < 5; i++) F.put('in_shelf_rack', x, -170 + i * 50, Math.PI / 2, { s: 1.25, solid: true, pad: 0 });
    }
    for (let i = 0; i < 6; i++) {
        F.put(i % 2 ? 'in_pallets' : 'in_crate', -50 + (i % 3) * 50, -150 + Math.floor(i / 3) * 60, i * 0.4, { s: i % 2 ? 1 : 1.3, solid: true });
    }
    F.put('in_barrels', 180, 180, 0, { solid: true });
    F.put('in_field_desk', 60, 190, Math.PI, { solid: true });
    F.put('in_crt', 60, 190, Math.PI, { y: 30, s: 0.8 });
    spots.push({ x: 60, z: 206, facing: -1, pose: 'work', stay: true });
    spots.push({ x: 0, z: 20, facing: 1, pose: 'stand', roam: true });
    spots.push({ x: x0 + 40, z: 80, facing: -1, pose: 'stand', roam: true });
    return spots;
}

/* ── the convention centre ────────────────────────────────────────────── */
export function conference(F, ctx) {
    const { box, lit, solid, accent, H } = ctx;
    const spots = [];
    // stage and screen at the back, under the name board
    box(300, 10, 70, 30, 5, -185, 0x1e1b4b); solid(30, -185, 300, 70);
    lit(304, 1.5, 2, 30, 10, -150, accent);
    lit(220, 30, 1.5, 30, 42, -223, 0x1e293b);
    F.put('in_speakers', -110, -196, 0.3, { y: 10, s: 2 });
    F.put('in_speakers', 170, -196, -0.3, { y: 10, s: 2 });
    F.put('in_side_table_o', 30, -178, 0, { y: 10 });
    // audience: five rows of chairs facing the stage
    for (let r = 0; r < 5; r++) {
        for (let c = 0; c < 8; c++) {
            const x = -90 + c * 34, z = -80 + r * 42;
            F.put('in_accent_chair', x, z, Math.PI);
            spots.push({ x, z, facing: -1, pose: 'sit' });
        }
    }
    spots.unshift({ x: 30, z: -180, facing: 1, pose: 'stand', stay: true });
    pendants(F, 'in_pendant', [-60, 30, 120], 0, H);
    F.put('in_office_plant', 250, 196, 0, { s: 1.7, solid: true });
    F.put('in_office_plant', -140, 196, 0, { s: 1.7, solid: true });
    return spots;
}

export const LAYOUTS = { office, openplan, boardroom, home, academic, cafe, vc, mission, power, nursery, warehouse, conference };
