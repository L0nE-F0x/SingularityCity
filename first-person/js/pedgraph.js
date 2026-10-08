/* ══════════════════════════════════════════════════════════════════════════
   PEDESTRIAN NETWORK — every pavement in the city as one walkable graph.

   Walkers used to take a fixed four-point dog-leg: straight from wherever they
   stood to the nearest main street, along it, up an avenue, and straight in to
   the door. The first and last legs went cross-country, through whatever
   blocks were in the way, and every walker in the city walked the exact
   centreline of the same pavement, so they passed through one another in
   files.

   Here each pavement (both sides of every road, the inner district streets
   included) is a line; wherever two lines cross is a node — a street corner,
   with the crossing between them — and the graph between them is searched
   with Dijkstra (results cached per start node). A route joins the network at
   the pavement nearest its start, follows it, and leaves at the pavement
   nearest its end. A walker's `lane` offsets it within the pavement so a
   crowd spreads across it.
   ══════════════════════════════════════════════════════════════════════════ */
import { City } from './city.js';

let G_ = null;             // { nodes: [{x,z,adj:[[j,w]...]}], lines: [...] }
const cache = new Map();   // start node → { dist, prev }
const CACHE_MAX = 320;

function build() {
    if (!City.roads?.length) return null;
    const lines = [];
    for (const r of City.roads) {
        if (!r.sidewalk) continue;
        const off = r.carriage / 2 + r.sidewalk / 2;
        const len = r.vertical ? r.d : r.w;
        const a = r.vertical ? r.z : r.x;
        for (const s of [-1, 1]) {
            lines.push({ v: r.vertical, c: (r.vertical ? r.x : r.z) + s * off, a0: a - len / 2, a1: a + len / 2, half: r.sidewalk / 2, nodes: [] });
        }
    }
    const nodes = [];
    const key = new Map();
    const V = lines.filter(l => l.v), H = lines.filter(l => !l.v);
    for (const vl of V) {
        for (const hl of H) {
            if (vl.c < hl.a0 || vl.c > hl.a1 || hl.c < vl.a0 || hl.c > vl.a1) continue;
            const k = Math.round(vl.c) + ',' + Math.round(hl.c);
            let id = key.get(k);
            if (id == null) {
                id = nodes.length;
                nodes.push({ x: vl.c, z: hl.c, adj: [] });
                key.set(k, id);
            }
            vl.nodes.push(id); hl.nodes.push(id);
        }
    }
    for (const l of lines) {
        const along = (id) => l.v ? nodes[id].z : nodes[id].x;
        l.nodes = [...new Set(l.nodes)].sort((p, q) => along(p) - along(q));
        for (let i = 0; i < l.nodes.length - 1; i++) {
            const p = l.nodes[i], q = l.nodes[i + 1];
            const w = Math.abs(along(q) - along(p));
            nodes[p].adj.push([q, w]);
            nodes[q].adj.push([p, w]);
        }
    }
    return { nodes, lines };
}

function dijkstra(start) {
    let hit = cache.get(start);
    if (hit) return hit;
    const N = G_.nodes.length;
    const dist = new Float32Array(N).fill(Infinity);
    const prev = new Int32Array(N).fill(-1);
    const done = new Uint8Array(N);
    dist[start] = 0;
    // binary heap of [d, id]
    const heap = [[0, start]];
    const push = (e) => {
        heap.push(e);
        let i = heap.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (heap[p][0] <= heap[i][0]) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === i) break;
                [heap[m], heap[i]] = [heap[i], heap[m]]; i = m;
            }
        }
        return top;
    };
    while (heap.length) {
        const [d, u] = pop();
        if (done[u]) continue;
        done[u] = 1;
        for (const [v, w] of G_.nodes[u].adj) {
            const nd = d + w;
            if (nd < dist[v]) { dist[v] = nd; prev[v] = u; push([nd, v]); }
        }
    }
    hit = { dist, prev };
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(start, hit);
    return hit;
}

/** Nearest pavement to a point: the line, the foot of the perpendicular,
    and the two network nodes either side of it on that line. */
function attach(x, z) {
    let best = null;
    for (const l of G_.lines) {
        const along = l.v ? z : x, across = l.v ? x : z;
        if (along < l.a0 - 4 || along > l.a1 + 4 || l.nodes.length < 1) continue;
        const d = Math.abs(across - l.c);
        if (best && d >= best.d) continue;
        const a = Math.max(l.a0, Math.min(l.a1, along));
        // the bracketing nodes
        let lo = -1, hi = -1;
        for (const id of l.nodes) {
            const p = l.v ? G_.nodes[id].z : G_.nodes[id].x;
            if (p <= a) lo = id;
            if (p >= a && hi < 0) hi = id;
        }
        if (lo < 0 && hi < 0) continue;
        best = { d, l, q: l.v ? { x: l.c, z: a } : { x: a, z: l.c }, ends: [lo, hi].filter(n => n >= 0) };
    }
    return best;
}

export const PedGraph = {
    get ready() {
        if (!G_) G_ = build();
        return !!G_;
    },

    /** Walkable route from (fx,fz) to (tx,tz); `lane` (±) spreads walkers. */
    route(fx, fz, tx, tz, lane = 0) {
        if (!this.ready) return null;
        const A = attach(fx, fz), B = attach(tx, tz);
        if (!A || !B) return null;
        const out = [{ x: fx, z: fz }];
        const on = (p, l) => l.v ? { x: p.x + lane, z: p.z } : { x: p.x, z: p.z + lane };
        out.push(on(A.q, A.l));
        if (A.l === B.l) {
            out.push(on(B.q, B.l));
        } else {
            let bestCost = Infinity, bestPath = null;
            for (const s of A.ends) {
                const { dist, prev } = dijkstra(s);
                const ns = G_.nodes[s];
                const c0 = Math.hypot(ns.x - A.q.x, ns.z - A.q.z);
                for (const e of B.ends) {
                    const ne = G_.nodes[e];
                    const cost = c0 + dist[e] + Math.hypot(ne.x - B.q.x, ne.z - B.q.z);
                    if (cost < bestCost) {
                        bestCost = cost;
                        const ids = [];
                        for (let u = e; u >= 0; u = prev[u]) { ids.push(u); if (u === s) break; }
                        bestPath = ids.reverse();
                    }
                }
            }
            if (!bestPath || bestCost === Infinity) return null;
            for (const id of bestPath) {
                const n = G_.nodes[id];
                out.push({ x: n.x + lane, z: n.z + lane });
            }
            out.push(on(B.q, B.l));
        }
        out.push({ x: tx, z: tz });
        // drop zero-length steps
        return out.filter((p, i) => i === 0 || Math.hypot(p.x - out[i - 1].x, p.z - out[i - 1].z) > 2);
    },

    /** The nearest point on a pavement (for spots that landed inside a block). */
    snap(x, z) {
        if (!this.ready) return { x, z };
        const a = attach(x, z);
        return a ? { x: a.q.x, z: a.q.z } : { x, z };
    },

    stats() {
        if (!this.ready) return null;
        return { nodes: G_.nodes.length, lines: G_.lines.length, cached: cache.size };
    }
};
