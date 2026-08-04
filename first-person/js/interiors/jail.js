/* ══════════════════════════════════════════════════════════════════════════
   AI DETENTION CENTER — ported from 2D js/jail.js (JailInterior).

   The worst parity gap in the audit: 110 lines against the 2D module's 1523,
   which is to say a generic room with four grey boxes and some bars. The 2D
   version is a five-level facility, and this is that facility.

     0 · INTAKE      booking desk, holding bench, property lockers, scanner
     1 · BLOCK A     cells down both sides of a landing, barred fronts
     2 · BLOCK B     the same, upper landing
     3 · CONTROL     wall of monitors, key cabinet, watch desk
     4 · SOLITARY    isolation cells, the level with no windows

   The cells show the REAL detainees. `G.jail.inmates` is a pure function of the
   ban rules in shared/ai_bans.js scoped to the viewer's jurisdiction, so a cell
   is occupied iff a government has actually restricted that model for this
   visitor — and empty when none has. Nothing here pads the roster out with
   invented prisoners to make the block look busy; an empty block IS the answer
   when your jurisdiction bans nothing.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex } from './kit.js';
import { G } from '../state.js';

const STAFF = {
    booking: { name: 'Booking Officer', role: 'Intake', color: 0xef4444 },
    warden: { name: 'Facility Warden', role: 'Warden', color: 0xfbbf24 },
    blockA: { name: 'Block A Officer', role: 'Corrections', color: 0xef4444 },
    blockB: { name: 'Block B Officer', role: 'Corrections', color: 0xef4444 },
    watch: { name: 'Watch Commander', role: 'Control Room', color: 0x38bdf8 },
    nightWatch: { name: 'Night Watch', role: 'Control Room', color: 0x38bdf8 },
    counsel: { name: 'Duty Counsel', role: 'Legal Aid', color: 0x22c55e },
    medic: { name: 'Facility Medic', role: 'Medical', color: 0x22c55e }
};

const STEEL = 0x9aa3b2;
const CONCRETE = 0x2a2e36;
const ALARM = 0xef4444;

/** Who is actually detained, in the order the jail holds them. */
function inmates() {
    const list = G.jail?.state?.inmates || G.jail?.inmates || [];
    return Array.isArray(list) ? list : [];
}

/** Cells for one block: `slice` picks which detainees land on this landing. */
function cellBlock(c, from, count, z, facing) {
    const held = inmates().slice(from, from + count);
    const W = 108;                       // cell pitch along the landing
    const startX = -((count - 1) / 2) * W;

    for (let i = 0; i < count; i++) {
        const cx = startX + i * W;
        const who = held[i];

        // cell box, open on the landing side
        c.box(W - 8, 78, 96, cx, 39, z + facing * 52, CONCRETE);
        c.solid(cx, z + facing * 52, W - 8, 96);
        // back wall slit window — the 2D exterior's prison slits, from inside
        c.lit(20, 8, 2, cx, 56, z + facing * 99, who ? 0x1e3a52 : 0x101820);

        // barred front: uprights plus a top and bottom rail
        for (let bar = 0; bar < 7; bar++) {
            c.box(3, 74, 3, cx - 42 + bar * 14, 37, z + facing * 5, STEEL);
        }
        c.box(W - 12, 4, 4, cx, 74, z + facing * 5, STEEL);
        c.box(W - 12, 4, 4, cx, 2, z + facing * 5, STEEL);

        // bunk, basin, stool — the same three fittings in every cell
        c.box(62, 8, 26, cx - 12, 16, z + facing * 78, 0x3a4048);
        c.box(58, 5, 22, cx - 12, 21, z + facing * 78, who ? 0x475569 : 0x2b3038);
        c.box(20, 22, 16, cx + 36, 11, z + facing * 86, 0x51596a);
        P.stool(c, cx + 34, z + facing * 58, 0x3a4048);

        /* Cell card. Occupied cells carry the real citation — the authority
           that issued the restriction and what it says — because a detention
           with no sourced reason is exactly the invented-event problem the
           jail was rewritten to remove. */
        if (who) {
            c.plate(panelTex({
                w: 256, h: 128, bg: '#160c0c', accent: '#ef4444',
                title: (who.name || 'DETAINEE').toUpperCase().slice(0, 16), titleSize: 20,
                lines: [
                    '!' + String(who.authority || 'ORDER').slice(0, 22),
                    '~' + String(who.reason || 'restriction in force').slice(0, 26),
                    '+held under ' + String(who.ruleId || 'rule').slice(0, 18)
                ], lineSize: 14
                // A plate faces +z unless turned; the far block's cells look
                // back down the landing, so its cards have to turn with them.
            }), 42, 21, cx + 44, 52, z + facing * 6, facing > 0 ? Math.PI : 0);
            // occupant, sat on the bunk behind the bars
            c.npc(c, cx - 12, z + facing * 74, {
                name: who.name || 'Detainee', role: who.label || 'Detained', color: 0xf87171
            }, -facing);
        } else {
            c.lit(30, 8, 1.5, cx, 52, z + facing * 6, 0x1f3a2a);   // green = vacant
        }
    }

    // landing rail and floor stripe
    c.box(count * W, 4, 4, 0, 34, z - facing * 46, STEEL);
    c.lit(count * W - 20, 1.2, 5, 0, 1.2, z - facing * 30, ALARM);
}

/** Header board every level carries: current count and capacity.
    `rotY` because a plate faces +z by default, so one mounted on the far wall
    is right and one on the near wall shows you its back. */
function statusBoard(c, x, y, z, title, rotY = 0) {
    const n = inmates().length;
    c.plate(panelTex({
        w: 512, h: 160, bg: '#120808', accent: '#ef4444', align: 'center',
        title, titleSize: 30,
        lines: [
            n ? `!IN CUSTODY  ${n}` : '+IN CUSTODY  0',
            n ? '~all holds sourced to a published order'
                : '~no restriction applies in your jurisdiction'
        ], lineSize: 20, padTop: 34
    }), 210, 66, x, y, z, rotY);
}

export const JAIL = {
    id: 'jail',
    theme(b, f, th) {
        th.cat = 'jail';
        th.wall = f === 4 ? 0x1c2026 : CONCRETE;
        th.ceil = 0x14181e;
        th.floor = f === 3 ? 0x232a34 : 0x3a4048;
        th.lamp = f === 3 ? 0x38bdf8 : 0xff6a6a;
        th.accent = f === 3 ? '#38bdf8' : '#ef4444';
        th.dim = true;
    },
    floors: [
        // ── 0 · INTAKE ──────────────────────────────────────────────────────
        {
            key: 'intake', label: 'INTAKE & BOOKING',
            build(c) {
                const night = c.night;
                // sally port: the heavy barred gate you come through
                for (let bar = 0; bar < 9; bar++) {
                    c.box(4, 74, 4, -56 + bar * 14, 37, c.D / 2 - c.WALL - 14, STEEL);
                }
                c.lit(140, 3, 3, 0, 76, c.D / 2 - c.WALL - 14, ALARM);

                // booking counter with the officer behind it
                P.counter(c, 0, -120, 220, 46, 0x232a34, 0x3a4048, 0xef4444);
                c.box(60, 10, 34, -60, 50, -120, 0x0f172a);           // terminal
                c.lit(50, 22, 1, -60, 50, -100, 0x38bdf8);
                c.box(34, 6, 26, 70, 48, -120, 0x1e293b);             // fingerprint scanner
                c.lit(26, 1.5, 18, 70, 51.5, -120, 0x22d3ee);

                // holding bench, bolted down, with the cuff rail above it
                for (const bx of [-190, 190]) {
                    c.box(120, 10, 30, bx, 20, 120, 0x51596a);
                    c.solid(bx, 120, 120, 30);
                    for (const s of [-1, 1]) c.box(10, 20, 26, bx + s * 52, 10, 120, 0x3a4048);
                    c.box(120, 4, 4, bx, 46, 138, STEEL);
                }

                // property lockers down the left wall
                for (let i = 0; i < 6; i++) {
                    P.cabinet(c, -c.W / 2 + 40, -60 + i * 46, 34, 54, 24, 0x475569, 3);
                }

                // body scanner arch you are walked through
                for (const s of [-1, 1]) c.box(12, 82, 34, s * 46, 41, 20, 0x51596a);
                c.box(104, 12, 34, 0, 82, 20, 0x51596a);
                c.lit(88, 3, 26, 0, 74, 20, 0x22d3ee);

                statusBoard(c, 0, 78, -c.D / 2 + c.WALL / 2 + 3, 'AI DETENTION CENTER');

                // rights notice — the wall of text every booking hall has
                c.plate(panelTex({
                    w: 512, h: 256, bg: '#0d1117', accent: '#fbbf24',
                    title: 'NOTICE TO DETAINEES', titleSize: 24, grid: true,
                    lines: [
                        '~1 · You are held under a published order',
                        '~2 · The issuing authority is named on your cell card',
                        '~3 · Release is automatic when the order lapses',
                        '+4 · Duty counsel is available on this level'
                    ], lineSize: 17
                }), 190, 96, c.W / 2 - c.WALL / 2 - 4, 60, 40, -Math.PI / 2);

                P.plant(c, -c.W / 2 + 50, 180, 34);
                if (night) {
                    c.npc(c, 0, -96, STAFF.nightWatch, 1);
                } else {
                    c.npc(c, -20, -96, STAFF.booking, 1);
                    c.npc(c, 170, 96, STAFF.counsel, -1);
                }
            }
        },
        // ── 1 · BLOCK A ─────────────────────────────────────────────────────
        {
            key: 'blockA', label: 'CELL BLOCK A',
            build(c) {
                cellBlock(c, 0, 4, -60, -1);
                cellBlock(c, 4, 4, 90, 1);
                statusBoard(c, 0, 78, -c.D / 2 + c.WALL / 2 + 3, 'BLOCK A');
                // officers' station on the landing
                P.desk(c, c.W / 2 - 80, 0, 0x3a4048, 0x38bdf8);
                c.box(40, 60, 30, c.W / 2 - 80, 30, 40, 0x475569);
                c.solid(c.W / 2 - 80, 40, 40, 30);
                c.lit(c.W - 80, 2, 5, 0, c.H - 6, 0, ALARM);
                c.npc(c, c.W / 2 - 120, 20, c.night ? STAFF.nightWatch : STAFF.blockA, -1);
            }
        },
        // ── 2 · BLOCK B ─────────────────────────────────────────────────────
        {
            key: 'blockB', label: 'CELL BLOCK B',
            build(c) {
                cellBlock(c, 8, 4, -60, -1);
                cellBlock(c, 12, 4, 90, 1);
                statusBoard(c, 0, 78, -c.D / 2 + c.WALL / 2 + 3, 'BLOCK B');
                // exercise cage at the end of the landing
                for (let bar = 0; bar < 10; bar++) {
                    c.box(3, 76, 3, -c.W / 2 + 40, -80 + bar * 18, 38, STEEL);
                }
                c.box(70, 76, 3, -c.W / 2 + 40 + 35, 38, 80, STEEL);
                c.lit(60, 1.2, 60, -c.W / 2 + 70, 1.2, 0, 0x1f3a2a);
                c.npc(c, c.W / 2 - 120, 20, STAFF.blockB, -1);
                if (!c.night) c.npc(c, -c.W / 2 + 90, 0, STAFF.medic, 1);
            }
        },
        // ── 3 · CONTROL ROOM ────────────────────────────────────────────────
        {
            key: 'control', label: 'CONTROL ROOM',
            build(c) {
                // monitor wall — one screen per block, plus the perimeter feeds
                for (let r = 0; r < 2; r++) {
                    for (let i = 0; i < 6; i++) {
                        const mx = -180 + i * 72;
                        c.box(64, 40, 5, mx, 44 + r * 46, -c.D / 2 + c.WALL + 8, 0x0f172a);
                        c.lit(56, 32, 1.5, mx, 44 + r * 46, -c.D / 2 + c.WALL + 5,
                            [0x1e3a52, 0x14342a, 0x1e3a52, 0x3a1e1e, 0x14342a, 0x1e3a52][i]);
                    }
                }
                // watch desk facing the wall
                P.counter(c, 0, -20, 260, 50, 0x1c222c, 0x2b3340, 0x38bdf8);
                for (const dx of [-80, 0, 80]) {
                    c.box(52, 34, 6, dx, 54, -30, 0x0f172a);
                    c.lit(44, 26, 1.5, dx, 54, -34, 0x38bdf8);
                }
                // key cabinet and the alarm panel
                P.cabinet(c, c.W / 2 - 60, -60, 46, 70, 24, 0x475569, 5);
                c.box(50, 60, 10, c.W / 2 - 40, 60, 60, 0x1c222c);
                c.lit(38, 12, 2, c.W / 2 - 45, 78, 60, ALARM);
                c.lit(38, 12, 2, c.W / 2 - 45, 60, 60, 0xfbbf24);
                c.lit(38, 12, 2, c.W / 2 - 45, 42, 60, 0x22c55e);

                statusBoard(c, 0, 78, c.D / 2 - c.WALL / 2 - 4, 'FACILITY STATUS', Math.PI);
                for (const cx of [-140, 140]) P.chair(c, cx, 60, 0x334155, 1);
                c.npc(c, -40, 50, c.night ? STAFF.nightWatch : STAFF.watch, 1);
                if (!c.night) c.npc(c, 120, 90, STAFF.warden, -1);
            }
        },
        // ── 4 · SOLITARY ────────────────────────────────────────────────────
        {
            key: 'solitary', label: 'SOLITARY',
            build(c) {
                // no windows down here — the only light is the corridor strip
                c.lit(c.W - 80, 2, 6, 0, c.H - 8, 0, 0xff6a6a);
                cellBlock(c, 16, 3, -70, -1);
                // observation slit doors on the far side, all shut
                for (let i = 0; i < 3; i++) {
                    const cx = -120 + i * 120;
                    c.box(96, 82, 12, cx, 41, 120, 0x1c2026);
                    c.solid(cx, 120, 96, 12);
                    c.lit(22, 5, 2, cx, 54, 113, 0x2a1616);
                    c.box(14, 10, 4, cx + 34, 34, 112, STEEL);      // handle
                }
                c.plate(panelTex({
                    w: 512, h: 160, bg: '#100808', accent: '#ef4444', align: 'center',
                    title: 'SOLITARY — LEVEL B1', titleSize: 26,
                    lines: ['!continuous observation', '~held pending review'], lineSize: 18, padTop: 34
                }), 200, 62, 0, 74, -c.D / 2 + c.WALL / 2 + 3);
                c.npc(c, c.W / 2 - 110, 40, STAFF.nightWatch, -1);
            }
        }
    ]
};
