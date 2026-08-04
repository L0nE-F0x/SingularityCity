/* ══════════════════════════════════════════════════════════════════════════
   AI COURT — ported from 2D js/court.js (CourtInterior).

   Second-worst gap in the audit at 109 lines against 1329. The 2D module is
   two distinct buildings sharing a shell — a Senate hearing room and a trial
   court — over four levels each, and this is that.

     0 · ROTUNDA     lobby, docket board, security, press pen
     1 · CHAMBER     the room itself: senate dais or judge's bench
     2 * GALLERY     public seating over the chamber, press desks
     3 · CHAMBERS    judges' / members' offices, law library

   Which chamber you get is the building, not a coin flip: court_senate is the
   hearing room with a curved member's dais, court_hearing is the trial court
   with a bench, jury box and counsel tables — the same split the 2D module
   makes with _drawSenateF / _drawHearingF.

   The docket board and the case in session read from G.court, which is fed by
   shared/ai_docket.js — real 2026 proceedings. It does not invent case names.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex } from './kit.js';
import { G } from '../state.js';

const OAK = 0x6b5136;
const OAK_LIGHT = 0x8a7048;
const MARBLE = 0xd8d0c0;
const BRASS = 0xc9a227;

const STAFF = {
    clerk: { name: 'Court Clerk', role: 'Clerk of the Court', color: 0x8b5cf6 },
    bailiff: { name: 'Bailiff', role: 'Court Security', color: 0x334155 },
    reporter: { name: 'Court Reporter', role: 'Stenographer', color: 0x06b6d4 },
    counselA: { name: 'Plaintiff Counsel', role: 'Counsel', color: 0x3b82f6 },
    counselB: { name: 'Defence Counsel', role: 'Counsel', color: 0xef4444 },
    judge: { name: 'Presiding Judge', role: 'Judiciary', color: 0x1e293b },
    chair: { name: 'Committee Chair', role: 'Chair', color: 0x1e293b },
    member: { name: 'Ranking Member', role: 'Committee', color: 0x475569 },
    press: { name: 'Wire Reporter', role: 'Press Gallery', color: 0xfbbf24 },
    librarian: { name: 'Law Librarian', role: 'Library', color: 0x22c55e },
    nightGuard: { name: 'Night Security', role: 'Court Security', color: 0x334155 }
};

const isSenate = (b) => (b?.id || '').includes('senate');

/** The live docket, newest first, from shared/ai_docket.js via Court. */
function docket() {
    const d = G.court?.state?.docket || [];
    return Array.isArray(d) ? [...d].reverse() : [];
}

function caseLines(n) {
    const rows = docket().slice(0, n);
    if (!rows.length) return ['~no matters listed today', '+court not in session'];
    return rows.map(cs => {
        const mark = cs.status === 'ruled' ? '+' : cs.status === 'hearing' ? '!' : '~';
        return mark + String(cs.title || cs.name || cs.id || 'matter').slice(0, 30);
    });
}

/** Bench / dais back wall shared by both chamber layouts. */
function chamberShell(c, accentCss) {
    // panelled walls and a coffered ceiling band — the room reads as a room
    for (let i = 0; i < 7; i++) {
        const px = -c.W / 2 + 50 + i * ((c.W - 100) / 6);
        c.box(10, c.H - 12, 12, px, (c.H - 12) / 2, -c.D / 2 + c.WALL + 6, OAK);
    }
    c.box(c.W - 40, 10, 14, 0, c.H - 16, -c.D / 2 + c.WALL + 6, OAK_LIGHT);
    c.lit(c.W - 80, 3, 6, 0, c.H - 10, 0, 0xfff0d0);
    // great seal over the bench
    c.plate(panelTex({
        w: 256, h: 256, bg: '#1c1408', accent: accentCss, align: 'center',
        title: 'AI COURT', titleSize: 26,
        lines: ['~SINGULARITY CITY', '+EST. 2026'], lineSize: 16, padTop: 40
    }), 60, 60, 0, c.H - 34, -c.D / 2 + c.WALL + 2);
}

export const COURT = {
    id: 'court',
    theme(b, f, th) {
        th.cat = 'court';
        th.wall = f === 3 ? 0xcfc6b2 : 0xe8e0d0;
        th.ceil = MARBLE;
        th.floor = f === 0 ? 0xb9ae96 : 0x8a7048;
        th.lamp = 0xfff0d0;
        th.accent = isSenate(b) ? '#8b5cf6' : '#fbbf24';
    },
    floors: [
        // ── 0 · ROTUNDA ─────────────────────────────────────────────────────
        {
            key: 'rotunda', label: 'ROTUNDA',
            build(c) {
                const acc = c.accentCss;
                // colonnade
                for (const px of [-190, -70, 70, 190]) {
                    P.column(c, px, -110, c.H - 6, MARBLE, 26);
                    P.column(c, px, 120, c.H - 6, MARBLE, 26);
                }
                // security screening at the door
                for (const s of [-1, 1]) {
                    c.box(14, 84, 34, s * 52, 42, c.D / 2 - c.WALL - 40, 0x51596a);
                }
                c.box(118, 12, 34, 0, 84, c.D / 2 - c.WALL - 40, 0x51596a);
                c.lit(100, 3, 26, 0, 76, c.D / 2 - c.WALL - 40, 0x22d3ee);
                P.counter(c, 150, 130, 110, 40, 0x3a2f22, OAK_LIGHT, BRASS);

                // THE DOCKET BOARD — the reason anybody stops in a courthouse lobby
                c.plate(panelTex({
                    w: 512, h: 320, bg: '#0f0b06', accent: acc,
                    title: "TODAY'S LIST", titleSize: 30, grid: true,
                    lines: caseLines(6), lineSize: 18
                }), 240, 150, 0, 74, -c.D / 2 + c.WALL / 2 + 3);

                // press pen, roped off, facing the chamber stairs
                P.rope(c, -170, 60, 80, BRASS, 0x8b1a1a);
                P.rope(c, -170, 140, 80, BRASS, 0x8b1a1a);
                for (const px of [-210, -150]) P.chair(c, px, 100, 0x4a3828, 1);

                // notice boards and a bust on a plinth
                for (let i = 0; i < 3; i++) {
                    P.frame(c, -c.W / 2 + c.WALL + 6, 56, -80 + i * 90, 60, 44, OAK, 0x2a3a52, 1);
                }
                c.box(40, 46, 40, c.W / 2 - 90, 23, -60, MARBLE);
                c.solid(c.W / 2 - 90, -60, 40, 40);
                c.box(26, 30, 26, c.W / 2 - 90, 60, -60, 0xbfb49c);
                c.box(28, 8, 28, c.W / 2 - 90, 78, -60, 0x9c907a);

                P.plant(c, -c.W / 2 + 60, 190, 44);
                P.plant(c, c.W / 2 - 60, 190, 44);
                if (c.night) {
                    c.npc(c, 0, 150, STAFF.nightGuard, -1);
                } else {
                    c.npc(c, 130, 100, STAFF.clerk, -1);
                    c.npc(c, 30, 170, STAFF.bailiff, -1);
                    c.npc(c, -190, 90, STAFF.press, 1);
                }
            }
        },
        // ── 1 · CHAMBER ─────────────────────────────────────────────────────
        {
            key: 'chamber', label: 'CHAMBER',
            build(c) {
                const senate = isSenate(c.b);
                const acc = c.accentCss;
                chamberShell(c, acc);

                if (senate) {
                    /* Senate hearing: a curved members' dais facing one witness
                       table, which is the whole visual grammar of a hearing. */
                    for (let i = 0; i < 9; i++) {
                        const t = (i - 4) / 4;
                        const dx = t * 200;
                        const dz = -150 + Math.abs(t) * 34;      // gentle curve
                        c.box(48, 40, 34, dx, 20, dz, OAK);
                        c.solid(dx, dz, 48, 34);
                        c.box(52, 6, 38, dx, 42, dz, OAK_LIGHT);
                        c.lit(16, 3, 3, dx, 46, dz + 16, i === 4 ? 0xef4444 : 0x22c55e);  // mic
                        c.box(3, 14, 3, dx, 52, dz + 16, 0x51596a);
                        if (i % 2 === 0) {
                            c.npc(c, dx, dz + 26, i === 4 ? STAFF.chair : STAFF.member, 1);
                        }
                    }
                    // nameplate rail
                    c.box(430, 4, 8, 0, 45, -128, BRASS);
                    // witness table, alone in the well
                    P.table(c, 0, 30, 130, 50, OAK, 28);
                    for (const wx of [-34, 34]) P.chair(c, wx, 62, 0x4a3828, 1);
                    c.box(30, 6, 20, 0, 32, 20, 0x1e293b);
                    c.lit(22, 3, 3, 0, 36, 26, 0xef4444);
                    // committee counsel benches down the sides
                    for (const s of [-1, 1]) {
                        P.table(c, s * 210, 40, 90, 40, OAK, 26);
                        P.chair(c, s * 210, 74, 0x4a3828, 1);
                    }
                } else {
                    /* Trial court: bench, clerk and stenographer below it,
                       jury box to one side, two counsel tables in the well. */
                    c.box(240, 54, 54, 0, 27, -160, OAK);
                    c.solid(0, -160, 240, 54);
                    c.box(256, 8, 60, 0, 56, -160, OAK_LIGHT);
                    c.box(40, 34, 34, 0, 17, -122, OAK);           // stenographer well
                    c.npc(c, 0, -128, STAFF.judge, 1);
                    c.npc(c, -70, -110, STAFF.reporter, 1);
                    // witness box, raised, to the judge's left
                    c.box(64, 46, 46, -150, 23, -110, OAK);
                    c.solid(-150, -110, 64, 46);
                    c.box(68, 6, 50, -150, 48, -110, OAK_LIGHT);
                    for (let bar = 0; bar < 5; bar++) {
                        c.box(3, 22, 3, -178 + bar * 14, 58, -88, BRASS);
                    }
                    // jury box: two rows of six, boxed off
                    for (let r = 0; r < 2; r++) {
                        for (let i = 0; i < 6; i++) {
                            P.chair(c, 150 + r * 44, -140 + i * 40, 0x4a3828, 1);
                        }
                    }
                    c.box(8, 34, 250, 118, 17, -40, OAK);
                    c.box(100, 34, 8, 168, 17, 84, OAK);
                    c.lit(6, 3, 230, 118, 36, -40, BRASS);
                    // counsel tables in the well
                    for (const [s, who] of [[-1, STAFF.counselA], [1, STAFF.counselB]]) {
                        P.table(c, s * 90, 20, 120, 52, OAK, 28);
                        for (const cx of [-30, 30]) P.chair(c, s * 90 + cx, 58, 0x4a3828, 1);
                        c.npc(c, s * 90, 54, who, 1);
                    }
                    c.npc(c, 60, -60, STAFF.bailiff, 1);
                }

                // the bar: rail separating the well from the public gallery
                for (let i = 0; i < 11; i++) c.box(4, 34, 4, -230 + i * 46, 17, 130, BRASS);
                c.box(470, 5, 8, 0, 36, 130, BRASS);

                // case in session
                c.plate(panelTex({
                    w: 512, h: 200, bg: '#0f0b06', accent: acc, align: 'center',
                    title: senate ? 'HEARING IN SESSION' : 'NOW BEFORE THE COURT', titleSize: 24,
                    lines: caseLines(2), lineSize: 18, padTop: 34
                }), 220, 86, 0, 76, c.D / 2 - c.WALL / 2 - 4, Math.PI);
            }
        },
        // ── 2 · PUBLIC GALLERY ──────────────────────────────────────────────
        {
            key: 'gallery', label: 'PUBLIC GALLERY',
            build(c) {
                // raked public benches looking down into the well
                for (let r = 0; r < 5; r++) {
                    const rz = -60 + r * 46;
                    const rise = r * 7;
                    c.box(420, 12 + rise, 40, 0, (12 + rise) / 2, rz, 0x5a4634);
                    c.solid(0, rz, 420, 40);
                    c.box(420, 26, 6, 0, 20 + rise, rz + 18, OAK);
                }
                // the well below, seen over the front rail
                for (let i = 0; i < 11; i++) c.box(4, 30, 4, -230 + i * 46, 15, -100, BRASS);
                c.box(470, 5, 8, 0, 32, -100, BRASS);

                // press desks along the back, one per wire
                for (let i = 0; i < 4; i++) {
                    const px = -180 + i * 120;
                    P.desk(c, px, 170, 0x4a3828, 0x38bdf8);
                    c.lit(30, 2, 20, px, 30, 170, 0x38bdf8);
                }
                c.plate(panelTex({
                    w: 512, h: 224, bg: '#0f0b06', accent: c.accentCss,
                    title: 'GALLERY RULES', titleSize: 24, grid: true,
                    lines: ['~silence in the gallery', '~no recording devices',
                        '!stand when the court rises', '+press desks at the rear'], lineSize: 17
                }), 200, 88, -c.W / 2 + c.WALL / 2 + 4, 62, 20, Math.PI / 2);
                if (c.night) {
                    c.npc(c, 200, 180, STAFF.nightGuard, -1);
                } else {
                    c.npc(c, -180, 150, STAFF.press, -1);
                    c.npc(c, 60, 150, STAFF.press, -1);
                    c.npc(c, -60, 10, STAFF.bailiff, 1);
                }
            }
        },
        // ── 3 · CHAMBERS & LAW LIBRARY ──────────────────────────────────────
        {
            key: 'chambers', label: 'CHAMBERS',
            build(c) {
                const senate = isSenate(c.b);
                // law library down one wall — the stacks are the whole point
                for (let i = 0; i < 5; i++) {
                    P.bookshelf(c, -c.W / 2 + 70, -160 + i * 84, 100, 84, 28, 0);
                }
                for (let i = 0; i < 3; i++) {
                    P.bookshelf(c, -60 + i * 110, -c.D / 2 + 70, 100, 84, 28, Math.PI / 2);
                }
                // reading table with lamps
                P.table(c, 40, 60, 190, 80, OAK, 28);
                for (const cx of [-60, 0, 60]) {
                    P.chair(c, 40 + cx, 110, 0x4a3828, 1);
                    c.box(12, 20, 12, 40 + cx, 38, 40, 0x1e293b);
                    c.lit(16, 5, 16, 40 + cx, 48, 40, 0xfff0d0);
                }
                // the judge's / chair's private office, glassed off
                c.box(10, c.H - 10, 200, c.W / 2 - 150, (c.H - 10) / 2, -60, OAK);
                c.lit(2, c.H - 30, 180, c.W / 2 - 145, (c.H - 10) / 2, -60, 0x2a3a52);
                P.desk(c, c.W / 2 - 80, -60, 0x4a3828, 0x38bdf8);
                P.chair(c, c.W / 2 - 80, -20, 0x2a1c14, 1);
                P.frame(c, c.W / 2 - c.WALL - 6, 60, -120, 70, 50, OAK, 0x2a3a52, -1);
                P.plant(c, c.W / 2 - 60, 130, 40);

                c.plate(panelTex({
                    w: 512, h: 224, bg: '#0f0b06', accent: c.accentCss,
                    title: senate ? 'COMMITTEE STAFF' : 'JUDICIAL CHAMBERS', titleSize: 24,
                    lines: ['~case files and precedent', '~clerks draft here, not in the well',
                        '+law library open to counsel'], lineSize: 17
                }), 200, 88, 0, 68, c.D / 2 - c.WALL / 2 - 4, Math.PI);

                if (c.night) {
                    c.npc(c, 40, 120, STAFF.nightGuard, -1);
                } else {
                    c.npc(c, c.W / 2 - 80, -30, senate ? STAFF.chair : STAFF.judge, 1);
                    c.npc(c, -c.W / 2 + 120, 40, STAFF.librarian, -1);
                    c.npc(c, 40, 110, STAFF.clerk, -1);
                }
            }
        }
    ]
};
