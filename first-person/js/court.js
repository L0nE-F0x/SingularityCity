/* ══════════════════════════════════════════════════════════════════════════
   COURT SYSTEM — the real 2026 AI legal docket, argued at court_hearing /
   court_senate. Cases cycle through queued → hearing → ruled.

   Cases come from shared/ai_docket.js and are real proceedings. This used to
   invent them ('alignment audit', 'compute export license') and try them
   against a random citizen, which meant the court reported litigation that
   does not exist. Which model is summoned is still chosen at random — that
   matches the 2D app — but it is now summoned to a case it is actually a
   party to, wherever the docket names one.
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import { DOCKET, pickCase, pickHearingTheme } from '../../shared/ai_docket.js';
import { CityStore } from './store/city_store.js';

export const COURT_BIDS = ['court_hearing', 'court_senate'];

export function createCourtState() {
    return {
        docket: [],
        rulings: 0,
        current: null,
        hearingT: 0
    };
}

/**
 * Queue a real proceeding. `entry` is a shared/ai_docket.js DOCKET row, so the
 * title, status note and colour all come from the real case rather than being
 * synthesised. `defendant` is the model summoned to answer for it.
 */
export function enqueueCase(state, entry, defendant = 'Unknown Model') {
    const row = typeof entry === 'string' ? { case: entry } : (entry || {});
    state.docket.push({
        id: 'case_' + (state.rulings + state.docket.length + 1),
        title: row.case || 'Hearing',
        caseStatus: row.status || null,     // the REAL status, e.g. "in discovery"
        note: row.note || null,
        color: row.color || null,
        defendant,
        status: 'queued'                    // sim lifecycle: queued → hearing → ruled
    });
    return state.docket[state.docket.length - 1];
}

export function stepCourt(state, dt) {
    if (!state.current) {
        const next = state.docket.find(c => c.status === 'queued');
        if (next) {
            next.status = 'hearing';
            state.current = next;
            state.hearingT = 6 + Math.random() * 4;
        }
        return null;
    }
    state.hearingT -= dt;
    if (state.hearingT <= 0) {
        state.current.status = 'ruled';
        state.rulings++;
        const done = state.current;
        state.current = null;
        // prune finished
        state.docket = state.docket.filter(c => c.status !== 'ruled').concat([done]);
        if (state.docket.length > 20) state.docket = state.docket.slice(-12);
        return done;
    }
    return null;
}

export const Court = {
    state: createCourtState(),
    gavel: null,
    _spawnT: 0,
    active: true,

    init(scene) {
        this.state = createCourtState();
        this._refreshTheme();
        // Seed with real proceedings, each answered by a party actually named in
        // it where the docket names one.
        for (let i = 0; i < 4; i++) {
            const entry = DOCKET[i % DOCKET.length];
            enqueueCase(this.state, entry, this._defendantFor(entry));
        }
        const b = G.bldById['court_hearing'] || G.bldById['court_senate'];
        if (b && scene) {
            const geo = new THREE.CylinderGeometry(8, 10, 6, 8);
            const mat = new THREE.MeshBasicMaterial({ color: 0xfbbf24 });
            this.gavel = new THREE.Mesh(geo, mat);
            this.gavel.position.set(b.worldX + 30, 30, b.worldZ + 30);
            scene.add(this.gavel);
        }
    },

    /* Prefer a live regulation headline as the subject under argument, exactly
       as the 2D chamber does; fall back to a real regulatory theme. */
    _refreshTheme() {
        const snap = CityStore.snapshot?.() || {};
        const picked = pickHearingTheme(snap.news);
        this.hearingTheme = picked.theme;
        this.hearingUrl = picked.url;
        this.hearingLive = picked.live;
    },

    /* Summon a model that is genuinely a party to the case. Falls back to any
       citizen only when the proceeding names no lab (a statute like SB 53). */
    _defendantFor(entry) {
        const list = G.citizens?.list || [];
        if (entry?.parties?.length && list.length) {
            const party = entry.parties[Math.floor(Math.random() * entry.parties.length)];
            const matches = list.filter(c => c.model?.lab === party);
            if (matches.length) {
                return matches[Math.floor(Math.random() * matches.length)].model.name;
            }
        }
        if (!list.length) return 'Unknown Model';
        return list[Math.floor(Math.random() * list.length)].model?.name || 'Citizen';
    },

    update(dt) {
        if (!this.active) return;
        this._spawnT += dt;
        if (this._spawnT > 14) {
            this._spawnT = 0;
            this._refreshTheme();
            const entry = pickCase(null);
            enqueueCase(this.state, entry, this._defendantFor(entry));
        }
        const ruled = stepCourt(this.state, dt);
        if (ruled && G.ui) {
            // soft toast only occasionally
            if (this.state.rulings % 3 === 0) {
                G.ui.banner?.('⚖️ Court Ruling', `${ruled.defendant}: ${ruled.title}`);
            }
        }
        if (this.gavel) {
            this.gavel.rotation.y += dt * 0.4;
            this.gavel.position.y = 28 + (this.state.current ? Math.sin(G.time * 6) * 3 : 0);
        }
    },

    snapshot() {
        const cur = this.state.current;
        return {
            docket: this.state.docket.length,
            rulings: this.state.rulings,
            current: cur ? cur.title : null,
            // The real status and sourced note, so the panel can show what is
            // actually happening in the case rather than just its name.
            currentStatus: cur ? cur.caseStatus : null,
            currentNote: cur ? cur.note : null,
            defendant: cur ? cur.defendant : null,
            hearingTheme: this.hearingTheme || null,
            hearingUrl: this.hearingUrl || null,
            hearingLive: !!this.hearingLive,
            venues: COURT_BIDS.filter(id => G.bldById?.[id])
        };
    }
};
