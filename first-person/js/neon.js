/* ══════════════════════════════════════════════════════════════════════════
   NEON & SHOPFRONTS — the street level of the 2D city, in three dimensions.

   The 2D city is lofi cyberpunk: every block has lit shopfronts, awnings,
   vertical blade signs and neon that never switches fully off — it glows by
   day and burns at night, and the wet street carries its colour. First Person
   had glass towers that met the pavement as blank walls, so a street read as
   a corridor of blue boxes by day and a black canyon with yellow windows at
   night. This lays, deterministically, onto every street-facing ground floor:

     • a run of two or three lit shop windows with an awning over each;
     • on taller blocks, a vertical neon blade sign near one corner, words from
       the city's own vocabulary (GPU, RAMEN, TOKENS, 24H…);
     • at night, the light those throw onto the pavement in front of them.

   Brightness follows Weather.neon (the shared 2D palette's signage level) and
   the night ramp. Six draw calls for the whole city.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { G } from './state.js';
import { City } from './city.js';
import * as TEX from './textures.js';

const NEON = [0x5ff6ff, 0xff4fd8, 0xffb347, 0x7dffb2, 0xb18cff, 0xff6b6b, 0x4fa8ff];
const AWNING = [0x2f6f73, 0xa23b3b, 0x26324a, 0xc28f2c, 0x5a3d7a, 0x3d6b4a, 0xb4532a, 0x1f5f8b];
const WORDS = ['GPU', 'RAMEN', 'TOKENS', '24H', 'BAR', 'HOTEL', 'CAFE', 'API', 'LLM', 'NOODLE',
    'ARCADE', 'SUSHI', 'VRAM', 'KARAOKE', 'PHO', 'OPEN', 'TACO', 'MODEL', 'BYTE', 'NEON'];
const SKIP_IDS = /^(metro_|house_|diplomat_villa|suburb_|res_|forest|pine|align_|pad_|power_)/;
const SKIP_BIOMES = new Set(['suburban', 'forest', 'park', 'desert']);

function mulberry32(a) {
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function colorize(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

/* Shop interiors for the windows, painted lofi: back wall, shelves of
   goods, a counter, a lamp, a figure or two, the shop's name across the
   transom and a glass streak. Eight shops in a 4×2 atlas. */
const SHOPS = [
    { name: 'RAMEN', wall: '#5a2a24', lamp: '#ffcf7a', goods: ['#f2d6a2', '#d0563e', '#fff1c8'], counter: '#3b1d18', sign: '#ff6b6b' },
    { name: '24/7 MART', wall: '#e8eef0', lamp: '#ffffff', goods: ['#4fa8ff', '#ff4fd8', '#ffd34f', '#7dffb2'], counter: '#9aa6b2', sign: '#5ff6ff' },
    { name: 'CAFE', wall: '#7a5238', lamp: '#ffd9a0', goods: ['#e8c9a0', '#a0704a', '#fff4e0'], counter: '#4a3020', sign: '#ffb347' },
    { name: 'GPU SHOP', wall: '#141a2a', lamp: '#7dffb2', goods: ['#39ff88', '#5ff6ff', '#2a3348'], counter: '#0c1018', sign: '#7dffb2' },
    { name: 'BOOKS', wall: '#3f5a46', lamp: '#ffe6b0', goods: ['#c0392b', '#2e86c1', '#f1c40f', '#8e44ad', '#16a085'], counter: '#2c3a30', sign: '#ffe6b0' },
    { name: 'BAR', wall: '#2a1638', lamp: '#ff4fd8', goods: ['#b18cff', '#ff4fd8', '#5ff6ff'], counter: '#1a0d24', sign: '#ff4fd8' },
    { name: 'PHONES', wall: '#dfe6ee', lamp: '#ffffff', goods: ['#1f2933', '#3b4a5a', '#5ff6ff'], counter: '#b8c2cc', sign: '#4fa8ff' },
    { name: 'FLOWERS', wall: '#f3e6d8', lamp: '#fff1d6', goods: ['#ff6b9a', '#ffd34f', '#7dffb2', '#ff9f43'], counter: '#7a5a3a', sign: '#ff9fd0' }
];
function shopAtlas() {
    const CW = 256, CH = 128, COLS = 4, ROWS = 2;
    const c = document.createElement('canvas');
    c.width = CW * COLS; c.height = CH * ROWS;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    const px = 4;                                     // art pixel
    const R = (ox, oy, X, Y, W, H, col) => { x.fillStyle = col; x.fillRect(ox + X * px, oy + Y * px, W * px, H * px); };
    SHOPS.forEach((sh, i) => {
        const ox = (i % COLS) * CW, oy = Math.floor(i / COLS) * CH;
        const GW = CW / px, GH = CH / px;             // 64 × 32 art pixels
        R(ox, oy, 0, 0, GW, GH, sh.wall);
        // transom with the shop's name
        R(ox, oy, 0, 0, GW, 6, '#0d0f16');
        x.fillStyle = sh.sign; x.font = 'bold 18px Silkscreen, monospace';
        x.textAlign = 'center'; x.textBaseline = 'middle';
        x.fillText(sh.name, ox + CW / 2, oy + 13);
        // lamps
        for (let k = 0; k < 3; k++) { R(ox, oy, 10 + k * 20, 6, 4, 1, '#20222a'); R(ox, oy, 9 + k * 20, 7, 6, 2, sh.lamp); }
        // shelves of goods on the back wall
        for (let row = 0; row < 3; row++) {
            const y = 11 + row * 5;
            R(ox, oy, 4, y + 3, GW - 8, 1, '#00000055');
            for (let gx = 5; gx < GW - 6; gx += 3) {
                const col = sh.goods[(gx * 7 + row * 3 + i) % sh.goods.length];
                R(ox, oy, gx, y, 2, 3, col);
            }
        }
        // counter and a figure behind it
        R(ox, oy, 30, 22, 26, 6, sh.counter);
        R(ox, oy, 30, 22, 26, 1, '#ffffff33');
        R(ox, oy, 40, 15, 4, 4, '#e2b48c'); R(ox, oy, 39, 19, 6, 3, sh.goods[0]);
        // a customer silhouette in front
        R(ox, oy, 12, 18, 4, 4, '#1a1c24'); R(ox, oy, 11, 22, 6, 9, '#1a1c24');
        R(ox, oy, 0, GH - 2, GW, 2, '#00000066');
        // glass streak and mullions
        x.fillStyle = 'rgba(255,255,255,0.13)';
        x.beginPath(); x.moveTo(ox + 40, oy + CH); x.lineTo(ox + 90, oy + 24); x.lineTo(ox + 110, oy + 24); x.lineTo(ox + 60, oy + CH); x.fill();
        R(ox, oy, 0, 6, 1, GH, '#0d0f16'); R(ox, oy, GW - 1, 6, 1, GH, '#0d0f16'); R(ox, oy, 31, 6, 1, GH - 6, '#0d0f1688');
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.magFilter = THREE.NearestFilter;
    t.anisotropy = 4;
    return { tex: t, cols: COLS, rows: ROWS, n: SHOPS.length };
}

/** Vertical neon words, one per atlas column. */
function bladeAtlas() {
    const COLS = WORDS.length, CW = 64, CH = 256;
    const c = document.createElement('canvas');
    c.width = COLS * CW; c.height = CH;
    const x = c.getContext('2d');
    x.fillStyle = '#07070f'; x.fillRect(0, 0, c.width, CH);
    x.textAlign = 'center'; x.textBaseline = 'middle';
    WORDS.forEach((w, i) => {
        const cx = i * CW + CW / 2;
        const col = '#' + NEON[i % NEON.length].toString(16).padStart(6, '0');
        x.strokeStyle = col; x.lineWidth = 4;
        x.strokeRect(i * CW + 5, 5, CW - 10, CH - 10);
        const letters = w.split('');
        const step = Math.min(44, (CH - 30) / letters.length);
        x.font = `bold ${Math.min(40, step)}px Silkscreen, monospace`;
        x.shadowColor = col; x.shadowBlur = 10;
        x.fillStyle = '#ffffff';
        letters.forEach((ch, k) => x.fillText(ch, cx, CH / 2 + (k - (letters.length - 1) / 2) * step));
        x.shadowBlur = 0;
    });
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return { tex: t, cols: COLS };
}

export const Neon = {
    built: false,

    init(scene) {
        const rnd = mulberry32(8080);
        const glow = [], awn = [], blades = [], backs = [], spill = [], windows = [], roadSpill = [];
        const atlas = bladeAtlas();
        const shops = shopAtlas();
        const bldIds = new Set(G.placements.map(p => p.id));
        let faces = 0;

        for (const c of G.colliders) {
            const named = bldIds.has(c.id);
            if (!(named || c.id === 'infill')) continue;
            if (named && SKIP_IDS.test(c.id)) continue;
            const b = named ? G.bldById[c.id] : null;
            if (b && /park|launchpad|monument|graveyard|arena|jail|villa|cabin|solar|wind|dam|nuclear|coal|fusion|crane|dish|billboard/.test(b.type || '')) continue;
            const w = c.x1 - c.x0, d = c.z1 - c.z0;
            if (w < 34 || d < 34) continue;
            const cx = (c.x0 + c.x1) / 2, cz = (c.z0 + c.z1) / 2;
            const dist = G.districtAt?.(cx, cz);
            if (dist && SKIP_BIOMES.has(dist.biome)) continue;
            const h = named ? (b.worldH || 60) : (City.infill.find(l => Math.abs(l.x - cx) < 1 && Math.abs(l.z - cz) < 1)?.h || 48);
            const industrial = dist?.biome === 'industry';

            const sides = [
                { nx: 1, nz: 0, px: c.x1, pz: cz, span: d },
                { nx: -1, nz: 0, px: c.x0, pz: cz, span: d },
                { nx: 0, nz: 1, px: cx, pz: c.z1, span: w },
                { nx: 0, nz: -1, px: cx, pz: c.z0, span: w }
            ];
            for (const f of sides) {
                // only the faces you walk past: pavement or road just outside
                let street = false;
                for (const o of [8, 18, 30, 44, 60, 78]) {
                    const qx = f.px + f.nx * o, qz = f.pz + f.nz * o;
                    if (City.onSidewalk(qx, qz) || City.onCarriageway(qx, qz)) { street = true; break; }
                    // another building in the way: this face looks onto a yard
                    if (o > 8 && G.colliders.some(k => k !== c && (k.id === 'infill' || bldIds.has(k.id)) &&
                        qx > k.x0 && qx < k.x1 && qz > k.z0 && qz < k.z1)) break;
                }
                if (!street) continue;
                if (industrial && rnd() < 0.6) continue;
                faces++;
                const ang = Math.atan2(f.nx, f.nz);          // local +z → face normal
                const tx = -f.nz, tz = f.nx;                   // along the face
                const units = f.span > 110 ? 3 : f.span > 60 ? 2 : 1;
                const usable = f.span * 0.84;
                const uw = usable / units;
                for (let u = 0; u < units; u++) {
                    if (rnd() < 0.12) continue;                // the odd dark unit
                    const along = -usable / 2 + uw * (u + 0.5);
                    const bx = f.px + tx * along, bz = f.pz + tz * along;
                    const sw = uw - 6;
                    // shop window
                    const g = new THREE.PlaneGeometry(sw, 17);
                    const si = Math.floor(rnd() * shops.n);
                    const uv = g.attributes.uv;
                    for (let q = 0; q < uv.count; q++) {
                        uv.setXY(q, ((si % shops.cols) + uv.getX(q)) / shops.cols,
                            (shops.rows - 1 - Math.floor(si / shops.cols) + uv.getY(q)) / shops.rows);
                    }
                    g.rotateY(ang); g.translate(bx + f.nx * 0.7, 11.5, bz + f.nz * 0.7);
                    windows.push(g);
                    // a dark frame round it
                    const fr0 = new THREE.BoxGeometry(sw + 1.6, 18.6, 0.8);
                    fr0.rotateY(ang); fr0.translate(bx + f.nx * 0.2, 11.5, bz + f.nz * 0.2);
                    awn.push(colorize(fr0, 0x1b1e26));
                    // a neon trim strip over it
                    const tcol = NEON[Math.floor(rnd() * NEON.length)];
                    const tr = new THREE.BoxGeometry(sw, 0.9, 0.6);
                    tr.rotateY(ang); tr.translate(bx + f.nx * 1.2, 21.2, bz + f.nz * 1.2);
                    glow.push(colorize(tr, tcol));
                    // awning
                    const ac = AWNING[Math.floor(rnd() * AWNING.length)];
                    const a = new THREE.BoxGeometry(sw + 2, 1.4, 9);
                    a.rotateX(-0.22); a.rotateY(ang);
                    a.translate(bx + f.nx * 4.8, 24.4, bz + f.nz * 4.8);
                    awn.push(colorize(a, ac));
                    const fr = new THREE.BoxGeometry(sw + 2, 2.4, 0.5);
                    fr.rotateY(ang); fr.translate(bx + f.nx * 9.2, 22.6, bz + f.nz * 9.2);
                    awn.push(colorize(fr, ac));
                    // light thrown on the pavement
                    const sp = new THREE.PlaneGeometry(sw + 10, 34);
                    sp.rotateX(-Math.PI / 2); sp.rotateY(ang);
                    sp.translate(bx + f.nx * 15, 2.3, bz + f.nz * 15);
                    spill.push(colorize(sp, tcol));
                    // and the long smear a wet road carries out from the kerb
                    for (const o of [44, 70, 96]) {
                        const qx = bx + f.nx * o, qz = bz + f.nz * o;
                        if (!City.onCarriageway(qx, qz)) continue;
                        const rs = new THREE.PlaneGeometry(sw * 0.55, 46);
                        rs.rotateX(-Math.PI / 2); rs.rotateY(ang);
                        rs.translate(qx, 0.9, qz);
                        roadSpill.push(colorize(rs, tcol));
                        break;
                    }
                }
                // a blade sign near one corner of the taller blocks
                if (h > 50 && f.span > 50 && rnd() < 0.42) {
                    const wi = Math.floor(rnd() * atlas.cols);
                    const end = (rnd() < 0.5 ? -1 : 1) * (f.span / 2 - 10);
                    const bx = f.px + tx * end + f.nx * 7.5, bz = f.pz + tz * end + f.nz * 7.5;
                    const by = 34 + Math.min(40, h * 0.28);
                    const pl = new THREE.PlaneGeometry(10, 38);
                    const uv = pl.attributes.uv;
                    for (let k = 0; k < uv.count; k++) uv.setX(k, (wi + uv.getX(k)) / atlas.cols);
                    // the blade stands out from the wall: its faces look along the street
                    const both = pl.clone();
                    pl.rotateY(ang + Math.PI / 2); both.rotateY(ang - Math.PI / 2);
                    for (const q of [pl, both]) {
                        q.translate(bx + tx * 0.8 * (q === pl ? 1 : -1), by, bz + tz * 0.8 * (q === pl ? 1 : -1));
                        blades.push(q);
                    }
                    const bk = new THREE.BoxGeometry(1.4, 40, 11);
                    bk.rotateY(ang); bk.translate(bx, by, bz);
                    backs.push(colorize(bk, 0x14161d));
                    const arm = new THREE.BoxGeometry(1, 1, 8);
                    arm.rotateY(ang);
                    for (const dy of [-14, 14]) {
                        const am = arm.clone(); am.translate(f.px + tx * end + f.nx * 3.5, by + dy, f.pz + tz * end + f.nz * 3.5);
                        backs.push(colorize(am, 0x2a2e36));
                    }
                }
            }
        }
        this.faces = faces;
        if (!glow.length) return;

        this.winMat = new THREE.MeshBasicMaterial({ map: shops.tex, toneMapped: false });
        const wm = new THREE.Mesh(mergeGeometries(windows, false), this.winMat);
        wm.name = 'neon:windows';
        wm.matrixAutoUpdate = false;
        wm.userData.noShadow = true;
        scene.add(wm);

        this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, side: THREE.DoubleSide });
        const gm = new THREE.Mesh(mergeGeometries(glow, false), this.glowMat);
        gm.name = 'neon:shops';
        gm.matrixAutoUpdate = false;
        gm.userData.noShadow = true;
        scene.add(gm);

        const am = new THREE.Mesh(mergeGeometries(awn, false),
            new THREE.MeshLambertMaterial({ vertexColors: true, map: TEX.detail?.() || null }));
        am.name = 'neon:awnings';
        am.matrixAutoUpdate = false;
        scene.add(am);

        if (blades.length) {
            this.bladeMat = new THREE.MeshBasicMaterial({ map: atlas.tex, toneMapped: false });
            const bm = new THREE.Mesh(mergeGeometries(blades, false), this.bladeMat);
            bm.name = 'neon:blades';
            bm.matrixAutoUpdate = false;
            bm.userData.noShadow = true;
            scene.add(bm);
            const km = new THREE.Mesh(mergeGeometries(backs, false), new THREE.MeshLambertMaterial({ vertexColors: true }));
            km.name = 'neon:bladeBacks';
            km.matrixAutoUpdate = false;
            scene.add(km);
        }

        this.spillMat = new THREE.MeshBasicMaterial({
            vertexColors: true, map: TEX.glowSprite('rgba(255,255,255,1)'),
            transparent: true, opacity: 0, depthWrite: false,
            blending: THREE.AdditiveBlending, toneMapped: false
        });
        const sm = new THREE.Mesh(mergeGeometries(spill, false), this.spillMat);
        sm.name = 'neon:spill';
        sm.renderOrder = 3;
        sm.matrixAutoUpdate = false;
        sm.userData.noShadow = true;
        scene.add(sm);
        this.spillMesh = sm;
        if (roadSpill.length) {
            this.roadSpillMat = this.spillMat.clone();
            const rm = new THREE.Mesh(mergeGeometries(roadSpill, false), this.roadSpillMat);
            rm.name = 'neon:wetroad';
            rm.renderOrder = 3;
            rm.matrixAutoUpdate = false;
            rm.userData.noShadow = true;
            scene.add(rm);
            this.roadSpillMesh = rm;
        }
        this.built = true;
    },

    update() {
        if (!this.built) return;
        const W = G.weatherSys;
        const night = W?.night ?? 0;
        const neon = W?.neon ?? 0.8;
        const blackout = G.seasonal?.blackout ? 0.15 : 1;
        const flicker = 0.97 + Math.sin((G.time || 0) * 31) * 0.015;
        // never fully off; by day a shopfront reads as lit glass, by night it burns
        const k = (0.5 + 0.5 * night) * (0.75 + 0.25 * neon) * blackout;
        this.glowMat.color.setScalar(Math.min(1, k) * flicker);
        this.winMat.color.setScalar(Math.min(1, 0.72 + 0.28 * night) * blackout);
        if (this.bladeMat) this.bladeMat.color.setScalar(Math.min(1, (0.55 + 0.45 * night) * neon * blackout));
        const wet = G.weatherIntensity || 0;
        const out = !G.inside && !G.ridingMetro && !G.onPlatform;
        this.spillMat.opacity = Math.min(0.85, night * (0.5 + wet * 0.3)) * blackout;
        this.spillMesh.visible = this.spillMat.opacity > 0.01 && out;
        if (this.roadSpillMat) {
            // the road always carries a little (lofi nights read wet), rain a lot
            this.roadSpillMat.opacity = Math.min(0.8, night * (0.22 + wet * 0.55)) * blackout;
            this.roadSpillMesh.visible = this.roadSpillMat.opacity > 0.01 && out;
        }
    }
};
