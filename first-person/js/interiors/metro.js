/* ══════════════════════════════════════════════════════════════════════════
   METRO STATION — ported from 2D js/interior_metro.js.

   Two levels only, and deliberately so: interact.js boards trains when
   `Interior.floor === Interior.maxFloor` and the building type is metro, so
   the platform must stay the top floor. Floor 0 is the ticket hall, floor 1
   the platform; the glass lift shaft is drawn on both so the descent reads.

   Staff rotate on the day/night shift like the 2D station does — eight named
   workers total, never all present at once.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { P, panelTex, vistaTex } from './kit.js';
import { G } from '../state.js';

/* ── The train that pulls into the platform ────────────────────────────────
   Built at interior scale (the room is 560 × 460 × 96) and driven by
   ctx.animate. Everything else on this floor is baked into the static merge,
   so before this the "platform" was a track bed nothing ever ran on: you took
   the lift down, and then a train teleported you underground with no arrival
   to watch. The cycle is APPROACH → DOORS OPEN → DWELL → DOORS SHUT → LEAVE,
   and Metro.trainAtStop is what decides whether E boards, so the doors being
   open and a train being boardable stay the same fact. */
/* Interiors are authored at ~3x human scale: the room is 560 x 460 x 96 local
   units and a standing eye is at 51 of them. So the car is dimensioned against
   that eye, not against the exterior rolling stock — y = 0 is the car floor,
   level with the platform, and the window band straddles 51 so you look
   straight into it from the platform and out of it from a seat. */
const CAR_L = 440, CAR_H = 76, CAR_W = 80;
const WIN_Y = 47, WIN_H = 24;
const DOOR_W_T = 46;

function tint(geo, hex) {
    const c = new THREE.Color(hex);
    const n = geo.attributes.position.count;
    const a = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
}

function buildPlatformTrain(lineHex) {
    const g = new THREE.Group();
    const body = [], glow = [];
    const box = (arr, w, h, d, x, y, z, hex) => {
        arr.push(tint(new THREE.BoxGeometry(w, h, d).translate(x, y, z), hex));
    };

    /* Underframe, roof, and side walls built as SEGMENTS between the door bays.
       A single full-length box meant the doors slid across solid bodywork —
       they moved, and nothing opened. The gaps left here are the doorways, and
       the lit interior below is what shows through them. */
    const DOOR_XS = [-150, -50, 50, 150];
    const DOOR_H = 60;
    box(body, CAR_L, 10, CAR_W - 8, 0, -5, 0, 0x1e293b);          // underframe
    box(body, CAR_L, 8, CAR_W - 5, 0, CAR_H - 4, 0, 0x94a3b8);    // roof
    box(body, CAR_L, CAR_H - 8 - DOOR_H, CAR_W, 0,
        DOOR_H + (CAR_H - 8 - DOOR_H) / 2, 0, 0xc5ced8);          // header above the doors

    // Wall panels between (and outboard of) the doorways
    const edges = [-CAR_L / 2];
    for (const dx of DOOR_XS) edges.push(dx - DOOR_W_T / 2, dx + DOOR_W_T / 2);
    edges.push(CAR_L / 2);
    for (let i = 0; i < edges.length; i += 2) {
        const w = edges[i + 1] - edges[i];
        if (w <= 0.5) continue;
        const cx = (edges[i] + edges[i + 1]) / 2;
        box(body, w, DOOR_H, CAR_W, cx, DOOR_H / 2, 0, 0xc5ced8);
        box(body, w + 1, 10, CAR_W + 1.5, cx, 26, 0, lineHex);     // livery band
    }

    /* Interior seen through the open doors: a dark saloon with a lit ceiling
       and a floor level with the platform. Inset so it never z-fights the
       bodywork. */
    box(body, CAR_L - 6, 1.5, CAR_W - 10, 0, 0.75, 0, 0x2b3646);
    box(glow, CAR_L - 10, 1.6, 14, 0, CAR_H - 10, 0, 0xfde68a);
    for (const s of [-1, 1]) {
        box(body, CAR_L - 20, 5, 14, 0, 22, s * (CAR_W / 2 - 12), 0x1e3a5f);   // bench
        box(body, CAR_L - 20, 22, 4, 0, 34, s * (CAR_W / 2 - 6), 0x1e3a5f);    // back
    }
    for (const px of [-190, -110, -10, 90, 190]) {
        box(body, 3, CAR_H - 18, 3, px, (CAR_H - 18) / 2, 0, 0xa8b2bd);        // grab pole
    }
    // Cab ends, running on past the room walls
    for (const s of [-1, 1]) {
        box(body, 24, CAR_H - 20, CAR_W - 14, s * (CAR_L / 2 + 11), (CAR_H - 20) / 2 + 4, 0, 0xb0bac6);
        box(glow, 4, 18, 46, s * (CAR_L / 2 + 22), 50, 0, 0x0c4a6e);   // cab window
        for (const dz of [22, -22]) {
            box(glow, 4, 7, 10, s * (CAR_L / 2 + 23), 14, dz, s > 0 ? 0xfff2cc : 0xff3344);
        }
    }
    // Roof kit
    box(body, 70, 10, 34, -70, CAR_H + 4, 0, 0x64748b);
    box(body, 6, 16, 6, -70, CAR_H + 15, 0, 0x94a3b8);
    // Bogies, dropped into the track bed
    for (const bx of [-140, 140]) {
        box(body, 70, 12, 46, bx, -14, 0, 0x0f172a);
        for (const w of [-24, 24]) box(body, 18, 16, 52, bx + w, -12, 0, 0x1a1a1a);
    }
    // Lit window band both sides, one window centred in each wall panel
    for (let i = 0; i < edges.length; i += 2) {
        const w = edges[i + 1] - edges[i];
        if (w < 30) continue;
        const cx = (edges[i] + edges[i + 1]) / 2;
        const ww = Math.min(w - 14, 70);
        for (const s of [-1, 1]) {
            box(body, ww + 6, WIN_H + 6, 2.5, cx, WIN_Y, s * (CAR_W / 2 - 0.4), 0x475569);
            box(glow, ww, WIN_H, 3, cx, WIN_Y, s * (CAR_W / 2 + 0.2), 0x9fd8f0);
        }
    }
    g.add(new THREE.Mesh(mergeGeometries(body, false),
        new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, metalness: 0.35 })));
    g.add(new THREE.Mesh(mergeGeometries(glow, false),
        new THREE.MeshBasicMaterial({ vertexColors: true })));

    /* Sliding doors — four pairs, and the ONLY moving parts. Each leaf slides
       outward along x by DOOR_W_T/2, so `open` 0→1 is the whole animation. */
    const leaves = [];
    const doorMat = new THREE.MeshStandardMaterial({
        color: 0x334155, roughness: 0.4, metalness: 0.4
    });
    const glassMat = new THREE.MeshStandardMaterial({
        color: 0x7dd3fc, transparent: true, opacity: 0.3, roughness: 0.08,
        metalness: 0.1, depthWrite: false
    });
    for (const dx of DOOR_XS) {
        for (const half of [-1, 1]) {
            const leaf = new THREE.Group();
            const panel = new THREE.Mesh(
                new THREE.BoxGeometry(DOOR_W_T / 2 - 1, DOOR_H, 3), doorMat);
            panel.position.y = DOOR_H / 2;
            const pane = new THREE.Mesh(
                new THREE.PlaneGeometry(DOOR_W_T / 2 - 8, WIN_H), glassMat);
            pane.position.set(0, WIN_Y, 2);
            leaf.add(panel, pane);
            leaf.position.set(dx + half * DOOR_W_T / 4, 0, CAR_W / 2 + 1);
            leaf.userData.shut = leaf.position.x;
            leaf.userData.slide = half * (DOOR_W_T / 2);
            g.add(leaf);
            leaves.push(leaf);
        }
    }
    g.userData.leaves = leaves;
    return g;
}

function setDoors(train, open) {
    for (const l of train.userData.leaves) {
        l.position.x = l.userData.shut + l.userData.slide * open;
    }
}

const STAFF = {
    ticket: { name: 'Ticket Agent', role: 'Ticket Agent', color: 0x3b82f6 },
    guard: { name: 'Station Guard', role: 'Station Guard', color: 0xef4444 },
    info: { name: 'Info Desk', role: 'Passenger Info', color: 0x06b6d4 },
    attendant: { name: 'Platform Attendant', role: 'Platform Attendant', color: 0xfbbf24 },
    dispatch: { name: 'Train Dispatcher', role: 'Dispatcher', color: 0x22c55e },
    nightGuard: { name: 'Night Guard', role: 'Night Guard', color: 0xef4444 },
    maint: { name: 'Maintenance Tech', role: 'Maintenance', color: 0x22c55e },
    signal: { name: 'Signal Operator', role: 'Signal Ops', color: 0x06b6d4 }
};

export const METRO = {
    id: 'metro',
    theme(b, f, th) {
        if (f >= 1) {
            th.cat = 'platform';
            th.wall = 0x0f172a; th.ceil = 0x020617; th.floor = 0x1e293b;
            th.lamp = 0xfbbf24; th.accent = '#fbbf24'; th.dim = true;
        } else {
            th.cat = 'metro';
            th.wall = 0x1e293b; th.ceil = 0x0f172a; th.floor = 0x334155;
            th.lamp = 0x22d3ee; th.accent = '#22d3ee'; th.dim = true;
        }
    },
    floors: [
        // ── 0 · TICKET HALL ─────────────────────────────────────────────────
        {
            key: 'hall', label: 'TICKET HALL',
            build(c) {
                const night = c.night;
                // Fare gates in one line, with a walkable aisle on the right
                // toward the real lift bank (left wall is owned by Interior).
                for (const gx of [-90, -30, 30]) P.turnstile(c, gx, -10, gx < 0 ? 0x4ade80 : 0xef4444);
                c.lit(220, 1.2, 6, -30, 1.2, 40, 0x22d3ee);

                // Ticket machines — back wall, left
                for (let i = 0; i < 3; i++) {
                    const mx = -180 + i * 58;
                    c.box(44, 52, 24, mx, 26, -180, 0x1e293b); c.solid(mx, -180, 44, 24);
                    c.lit(32, 20, 1, mx, 36, -167, 0x22d3ee);
                    c.lit(16, 4, 1, mx, 18, -167, 0x4ade80);
                }
                // Staffed window — back wall, right
                P.counter(c, 140, -180, 110, 36, 0x243447, 0x3d5570, 0x22d3ee);
                c.box(110, 28, 5, 140, 52, -196, 0x0f172a);
                c.lit(90, 18, 1, 140, 52, -192, 0x0e3a52);

                // One departure board, on the back wall, not floating in the room
                c.plate(panelTex({
                    w: 512, h: 200, bg: '#050a14', accent: '#22d3ee',
                    title: 'DEPARTURES', titleSize: 30, grid: true,
                    lines: ['+WEST LINE         2 min', '+EAST LINE         4 min',
                        '~INNOVATION        7 min', (night ? '!REDUCED SERVICE' : '+GOOD SERVICE')],
                    lineSize: 20
                }), 200, 72, 0, 68, -c.D / 2 + c.WALL / 2 + 3);

                // Escalator well that goes DOWN (the old stairs climbed into
                // the ceiling). Visual only — the working lift is on the left.
                c.box(88, 6, 110, 130, 3, 70, 0x0f172a); c.solid(130, 70, 88, 110);
                for (let i = 0; i < 8; i++) {
                    c.box(64, 3, 12, 130, -1 - i * 5, 110 - i * 12, 0x475569);
                }
                for (const sx of [-1, 1]) c.box(4, 28, 4, 130 + sx * 38, 14, 30, 0xfbbf24);
                c.plate(panelTex({
                    w: 256, h: 64, bg: '#071018', accent: '#fbbf24', align: 'center',
                    title: 'PLATFORM  →  LIFT', titleSize: 22, lines: ['~left wall'], lineSize: 16
                }), 70, 16, 130, 36, 12);

                P.plant(c, -240, 170, 32);
                c.box(18, 20, 18, -180, 10, 170, 0x475569);

                if (night) {
                    c.npc(c, 200, 130, STAFF.nightGuard, -1);
                } else {
                    c.npc(c, 140, -150, STAFF.ticket, 1);
                    c.npc(c, 80, 150, STAFF.guard, -1);
                }
            }
        },
        // ── 1 · PLATFORM ────────────────────────────────────────────────────
        {
            key: 'platform', label: 'PLATFORM',
            build(c) {
                const night = c.night;
                const trackZ = -170;
                // platform edge: tactile strip then a drop to the ballast
                c.box(c.W - 20, 3, 30, 0, 1.5, trackZ + 62, 0xfbbf24);
                c.lit(c.W - 60, 1.6, 8, 0, 3, trackZ + 60, 0xfde68a);
                c.box(c.W - 20, 22, 92, 0, -9, trackZ, 0x020617);
                for (const rail of [-16, 16]) c.box(c.W - 30, 3, 4, 0, 1, trackZ + rail, 0x8b95a3);
                for (let i = 0; i < 14; i++) c.box(44, 2.5, 9, -260 + i * 40, -0.5, trackZ, 0x3f3f46);
                // conductor rail, kept off to one side like the real thing
                c.box(c.W - 30, 3, 4, 0, 2, trackZ + 34, 0x64748b);
                c.lit(c.W - 60, 1, 1.5, 0, 4, trackZ + 34, 0xf59e0b);

                // tunnel mouths at both ends of the track bed
                for (const s of [-1, 1]) {
                    c.box(150, 62, 16, s * 200, 31, trackZ - 44, 0x0b1220);
                    c.plate(vistaTex('tunnel', '#fbbf24'), 116, 82, s * 200, 34, trackZ - 34);
                }

                // canopy columns down the platform spine
                for (const px of [-200, -70, 70, 200]) {
                    P.column(c, px, -20, c.H - 6, 0x475569, 18);
                    c.lit(22, 4, 22, px, c.H - 14, -20, 0xfbbf24);
                }
                // benches and waiting furniture behind the columns
                for (const bx of [-185, -80, 120, 230]) {
                    c.box(64, 12, 20, bx, 12, 60, 0x334155); c.solid(bx, 60, 64, 20);
                    for (const s of [-1, 1]) c.box(6, 12, 16, bx + s * 26, 6, 60, 0x475569);
                    c.box(64, 22, 5, bx, 24, 70, 0x475569);
                }
                // next-train indicator hanging over the platform
                c.plate(panelTex({
                    w: 512, h: 128, bg: '#050a14', accent: '#fbbf24', align: 'center',
                    title: night ? 'LAST TRAINS' : 'NEXT TRAIN', titleSize: 30,
                    lines: ['~CENTRAL · ALL STOPS', '+ARRIVING — STAND BACK'], lineSize: 22, padTop: 36
                }), 210, 52, 0, 78, 20);
                c.box(216, 6, 6, 0, c.H - 10, 20, 0x1e293b);

                // ad panels on the far wall, and a vending machine
                for (let i = 0; i < 4; i++) {
                    c.box(58, 44, 3, -180 + i * 120, 50, c.D / 2 - c.WALL / 2 - 6, 0x0f172a);
                    c.lit(50, 36, 1.2, -180 + i * 120, 50, c.D / 2 - c.WALL / 2 - 8,
                        [0x22d3ee, 0xf472b6, 0xfbbf24, 0x4ade80][i]);
                }
                c.box(40, 58, 28, 250, 29, 130, 0x1e293b); c.solid(250, 130, 40, 28);
                c.lit(28, 34, 1, 250, 36, 145, 0xf472b6);

                /* The train itself. Its cycle is slaved to the network sim, not
                   run locally: Metro.trainAtStop(building) is what interact.js
                   asks before letting E board, so if the doors were opened on a
                   timer of their own you would get open doors and no train to
                   board, or the reverse. `dwellT` counting down IS the dwell. */
                const train = buildPlatformTrain(c.th?.lamp || 0xfbbf24);
                // y = 0 IS the car floor, so it lands level with the platform
                // and the bogies drop into the track bed on their own.
                train.position.set(0, 0, trackZ);
                c.animate(train, (obj, dt) => {
                    const hit = c.b && G.metro?.trainAtStop?.(c.b.id);
                    const st = obj.userData;
                    st.open = st.open || 0;
                    if (hit) {
                        // Berthed: run in over the first moment of the dwell,
                        // then hold at the platform with the doors open.
                        const dwell = hit.train.dwellT;
                        st.arriveK = Math.min(1, (st.arriveK ?? 0) + dt * 1.6);
                        obj.position.x = (1 - st.arriveK) * -820;
                        // Doors only once stopped, and shut again before it goes.
                        const wantOpen = st.arriveK >= 1 && dwell > 1.2 ? 1 : 0;
                        st.open += (wantOpen - st.open) * Math.min(1, dt * 3.2);
                        obj.visible = true;
                    } else {
                        // Gone: accelerate out of the far end and wait offstage.
                        st.open += (0 - st.open) * Math.min(1, dt * 4);
                        if (st.arriveK != null) {
                            st.leaveK = Math.min(1, (st.leaveK ?? 0) + dt * 0.9);
                            obj.position.x = st.leaveK * 820;
                            if (st.leaveK >= 1) { st.arriveK = null; st.leaveK = null; }
                        }
                        obj.visible = st.arriveK != null;
                    }
                    setDoors(obj, st.open);
                });

                if (night) {
                    c.npc(c, -60, 30, STAFF.maint, 1);
                    c.npc(c, 230, 40, STAFF.signal, -1);
                } else {
                    c.npc(c, -120, 20, STAFF.attendant, 1);
                    c.npc(c, 60, 20, STAFF.dispatch, 1);
                }
            }
        }
    ]
};
