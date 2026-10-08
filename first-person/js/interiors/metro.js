/* ══════════════════════════════════════════════════════════════════════════
   METRO STATION — the ticket hall.

   The platform is no longer a room. It used to be a second "floor" of this
   building with a scaled-up toy train of its own, driven off the network's
   dwell timer — a train you could board that was not the train you then rode,
   in a room 3× the scale of the car you rode in. The platforms are now the
   real ones under the street (metro.js platform mode): the escalators here
   take you down to them, one per line that calls at this station, and the
   lift at the end of each platform brings you back up to this hall.

   Staff rotate on the day/night shift like the 2D station does.
   ══════════════════════════════════════════════════════════════════════════ */
import { P, panelTex, canvas, tex, hex } from './kit.js';
import { G } from '../state.js';
import { etaTo } from '../metro.js';

const STAFF = {
    ticket: { name: 'Ticket Agent', role: 'Ticket Agent', color: 0x3b82f6 },
    guard: { name: 'Station Guard', role: 'Station Guard', color: 0xef4444 },
    info: { name: 'Info Desk', role: 'Passenger Info', color: 0x06b6d4 },
    nightGuard: { name: 'Night Guard', role: 'Night Guard', color: 0xef4444 },
    maint: { name: 'Maintenance Tech', role: 'Maintenance', color: 0x22c55e }
};

/** Schematic of the whole network, drawn from the live routes. */
function networkMapTex(hereId) {
    const W = 512, H = 300;
    const [c, x] = canvas(W, H);
    x.fillStyle = '#f4f1ea'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#10151f'; x.fillRect(0, 0, W, 34);
    x.fillStyle = '#f4f1ea'; x.font = 'bold 18px Silkscreen, monospace';
    x.textAlign = 'left'; x.textBaseline = 'middle';
    x.fillText('SINGULARITY METRO', 14, 18);
    const routes = G.metro?.routes || [];
    const ids = [...new Set(routes.flatMap(r => r.stops))];
    const bs = ids.map(id => G.bldById[id]).filter(Boolean);
    if (!bs.length) return tex(c);
    const minX = Math.min(...bs.map(b => b.worldX)), maxX = Math.max(...bs.map(b => b.worldX));
    const minZ = Math.min(...bs.map(b => b.worldZ)), maxZ = Math.max(...bs.map(b => b.worldZ));
    const mx = (v) => 40 + (v - minX) / Math.max(1, maxX - minX) * (W - 80);
    const mz = (v) => 64 + (v - minZ) / Math.max(1, maxZ - minZ) * (H - 104);
    for (const r of routes) {
        x.strokeStyle = hex(r.color); x.lineWidth = 9;
        x.beginPath();
        r.stops.forEach((id, i) => {
            const b = G.bldById[id];
            if (b) (i ? x.lineTo : x.moveTo).call(x, mx(b.worldX), mz(b.worldZ));
        });
        x.stroke();
    }
    x.font = '11px Silkscreen, monospace';
    for (const b of bs) {
        const px = mx(b.worldX), pz = mz(b.worldZ);
        const here = b.id === hereId;
        x.fillStyle = here ? '#ef4444' : '#10151f';
        x.fillRect(px - 7, pz - 7, 14, 14);
        x.fillStyle = '#ffffff';
        x.fillRect(px - 4, pz - 4, 8, 8);
        x.fillStyle = here ? '#b91c1c' : '#334155';
        x.textAlign = px > W - 120 ? 'right' : 'left';
        x.fillText((here ? '▶ ' : '') + b.name.replace(/\s*station$/i, '').toUpperCase(), px + (px > W - 120 ? -12 : 12), pz - 12);
    }
    // legend
    let ly = H - 22;
    x.textAlign = 'left';
    routes.forEach((r, i) => {
        const lx = 14 + i * 168;
        x.fillStyle = hex(r.color); x.fillRect(lx, ly - 5, 24, 10);
        x.fillStyle = '#10151f'; x.fillText(r.name.toUpperCase(), lx + 30, ly);
    });
    return tex(c);
}

/** Next trains from this station, both ways on every line. */
function departures(bid) {
    const rows = [];
    for (const r of G.metro?.routes || []) {
        const si = r.stops.indexOf(bid);
        if (si < 0) continue;
        for (const dir of [1, -1]) {
            const endIdx = dir > 0 ? r.stops.length - 1 : 0;
            if (si === endIdx) continue;
            const toward = G.bldById[r.stops[endIdx]]?.name || r.stops[endIdx];
            let eta = null;
            for (const t of G.metro.trains) {
                if (t.routeIdx !== r.index) continue;
                const e = etaTo(t, r, si, dir);
                if (eta == null || e < eta) eta = e;
            }
            rows.push({ r, toward, eta });
        }
    }
    return rows;
}

export const METRO = {
    id: 'metro',
    theme(b, f, th) {
        th.cat = 'metro';
        th.wall = 0xd5dbe1; th.ceil = 0x2c3542; th.floor = 0x8f99a5;
        th.lamp = 0xfff1d6; th.accent = '#22d3ee'; th.dim = false;
    },
    floors: [
        {
            key: 'hall', label: 'TICKET HALL',
            build(c) {
                const night = c.night;
                const bid = c.b?.id;
                const lines = (G.metro?.linesAt?.(bid)) || [];

                // terrazzo floor bands and a tiled dado round the walls
                c.box(c.W - 40, 0.6, 120, 0, 0.3, 120, 0xa7b0bb);
                c.box(c.W - 40, 0.6, 6, 0, 0.4, 56, 0x5f6b79);
                for (const sx of [-1, 1]) c.box(4, 30, c.D - 40, sx * (c.W / 2 - c.WALL / 2 - 2), 15, 0, 0x5f6b79);
                c.box(c.W - 40, 30, 4, 0, 15, -c.D / 2 + c.WALL / 2 + 2, 0x5f6b79);

                // ── the gate line: four gates across the hall, a wide aisle each side
                for (const gx of [-90, -30, 30, 90]) P.turnstile(c, gx, 30, gx < 0 ? 0x4ade80 : 0xef4444);
                for (const sx of [-1, 1]) {
                    c.box(110, 30, 6, sx * 185, 15, 30, 0x64748b);
                    c.solid(sx * 185, 30, 110, 6);
                    c.lit(104, 2, 1, sx * 185, 30.5, 33.2, 0x22d3ee);
                }
                // ticket machines on the left wall, the staffed window on the right
                for (let i = 0; i < 3; i++) {
                    const mz = 110 + i * 46;
                    c.box(24, 56, 36, -c.W / 2 + c.WALL + 14, 28, mz, 0x1e293b);
                    c.solid(-c.W / 2 + c.WALL + 14, mz, 24, 36);
                    c.lit(1, 22, 26, -c.W / 2 + c.WALL + 26.6, 38, mz, 0x22d3ee);
                    c.lit(1, 4, 12, -c.W / 2 + c.WALL + 26.6, 20, mz, 0x4ade80);
                }
                P.counter(c, c.W / 2 - c.WALL - 30, 140, 40, 120, 0x243447, 0x3d5570, 0x22d3ee);
                c.box(8, 34, 124, c.W / 2 - c.WALL - 4, 60, 140, 0x0f172a);
                c.lit(1, 22, 100, c.W / 2 - c.WALL - 8.6, 60, 140, 0x0e3a52);

                // ── the escalators: one per line, down beyond the gates
                const n = Math.max(1, lines.length);
                const span = Math.min(420, n * 170);
                lines.forEach((r, i) => {
                    const ex = -span / 2 + span / n * (i + 0.5);
                    const ez = -110;
                    const col = r.color;
                    // the well: a dark opening with the steps falling away
                    c.box(96, 0.8, 150, ex, 0.5, ez, 0x0b0f16);
                    for (let k = 0; k < 12; k++) {
                        c.box(76, 0.6, 3, ex, 0.95, ez + 62 - k * 11, k < 2 ? 0xf2c230 : 0x2a313b);
                    }
                    // balustrades with a lit handrail, glass panels between
                    for (const sx of [-1, 1]) {
                        c.box(6, 26, 150, ex + sx * 47, 13, ez, 0xc3cad2);
                        c.solid(ex + sx * 47, ez, 6, 150);
                        c.lit(7, 2, 150, ex + sx * 47, 27, ez, col);
                    }
                    c.box(96, 26, 6, ex, 13, ez - 76, 0xc3cad2);
                    c.solid(ex, ez - 76, 96, 6);
                    // the line's sign hanging over the head of the escalator
                    c.box(120, 4, 4, ex, c.H - 14, ez + 70, 0x1e293b);
                    for (const sx of [-1, 1]) c.box(2, 12, 2, ex + sx * 54, c.H - 8, ez + 70, 0x1e293b);
                    c.plate(panelTex({
                        w: 512, h: 128, bg: '#10151f', accent: hex(col), align: 'center',
                        title: '⬇ ' + r.name.toUpperCase(), titleSize: 34, padTop: 40,
                        lines: ['~platforms · trains both ways'], lineSize: 20
                    }), 110, 28, ex, c.H - 34, ez + 72);
                    c.hotspot(ex, ez + 66, 52, '⬇ escalator down to the ' + r.name + ' platforms', () => {
                        G.metro?.enterPlatform?.(bid, r.index);
                    });
                });
                if (!lines.length) {
                    c.plate(panelTex({ w: 512, h: 128, bg: '#10151f', accent: '#f87171', align: 'center',
                        title: 'NO SERVICE', titleSize: 34, padTop: 46, lines: ['!platforms closed'] }), 110, 28, 0, 60, -120);
                }

                // ── information: departures and the network map on the back wall
                const rows = departures(bid);
                const fmt = (e) => e == null ? '—' : e < 8 ? 'DUE' : e < 60 ? Math.ceil(e / 5) * 5 + ' s' : Math.round(e / 60) + ' min';
                c.plate(panelTex({
                    w: 512, h: 256, bg: '#050a14', accent: '#fbbf24',
                    title: 'DEPARTURES', titleSize: 28, grid: true,
                    lines: rows.length
                        ? rows.slice(0, 5).map(rw => `+${rw.toward.replace(/\s*station$/i, '').slice(0, 16).padEnd(17)} ${fmt(rw.eta)}`)
                            .concat(night ? ['!REDUCED NIGHT SERVICE'] : ['~GOOD SERVICE ON ALL LINES'])
                        : ['!NO SERVICE'],
                    lineSize: 19
                }), 150, 75, 150, 66, -c.D / 2 + c.WALL / 2 + 3);
                c.plate(networkMapTex(bid), 150, 88, -150, 62, -c.D / 2 + c.WALL / 2 + 3);
                for (const sx of [-150, 150]) c.box(160, 4, 4, sx, 22, -c.D / 2 + c.WALL / 2 + 4, 0x1e293b);

                // a bench pair and planters by the door
                for (const sx of [-1, 1]) {
                    c.box(70, 12, 20, sx * 160, 12, 190, 0x7a5a3a); c.solid(sx * 160, 190, 70, 20);
                    c.box(70, 18, 4, sx * 160, 24, 199, 0x7a5a3a);
                    P.plant(c, sx * 235, 200, 34);
                }

                if (night) {
                    c.npc(c, 200, 90, STAFF.nightGuard, -1);
                    c.npc(c, -160, -40, STAFF.maint, 1);
                } else {
                    c.npc(c, c.W / 2 - c.WALL - 60, 140, STAFF.ticket, -1);
                    c.npc(c, 150, 80, STAFF.guard, -1);
                    c.npc(c, -150, 80, STAFF.info, 1);
                }
            }
        }
    ]
};
