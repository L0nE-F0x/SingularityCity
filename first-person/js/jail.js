/* ══════════════════════════════════════════════════════════════════════════
   JAIL SYSTEM — the AI Detention Center holds models that real governments
   have actually restricted, scoped to the viewer's jurisdiction. Rules live in
   shared/ai_bans.js and are shared with the 2D city.

   This used to arrest a random citizen every 8 seconds. It does not any more:
   detention is now a pure function of the ban rules, so a model is detained iff
   a rule applies to it for this viewer, and is released the moment that stops
   being true (expiry, a lifted remote ban, or a change of jurisdiction).
   ══════════════════════════════════════════════════════════════════════════ */
import * as THREE from 'three';
import { G } from './state.js';
import {
    BANS, countryFromLocale, fetchViewerCountry,
    normaliseRemoteBans, selectDetained
} from '../../shared/ai_bans.js';
import { INTEGRATION } from './store/config.js';

// The AI Detention Center is a real building now; the jail no longer has to
// borrow the Black Market as a holding area.
export const JAIL_BID = 'ai_jail';

export function createJailState() {
    return {
        // { citizenIdx, name, ruleId, label, authority, reason, source }
        inmates: [],
        processed: 0,
        // No capacity cap. The detainee list is whatever the rules say it is —
        // truncating it would silently misreport real restrictions.
        capacity: Infinity
    };
}

/**
 * Detain a citizen under a specific, sourced rule.
 * Returns true only when this is a NEW detention (so the caller knows to move
 * them to the facility). If the citizen is already held but the rule that
 * justifies it has changed — a jurisdiction upgrade, or a remote rule
 * superseding a seed one — the citation is refreshed in place. Leaving it stale
 * would have the panel attribute a UK order to a Turkish court.
 */
export function detain(state, citizen, rule) {
    if (!citizen || !rule) return false;
    const held = state.inmates.find(i => i.citizenIdx === citizen.idx);
    if (held) {
        if (held.ruleId !== rule.id) {
            held.ruleId = rule.id;
            held.label = rule.label;
            held.authority = rule.authority;
            held.reason = rule.reason;
            held.source = rule.source || null;
        }
        return false;
    }
    state.inmates.push({
        citizenIdx: citizen.idx,
        name: citizen.model?.name || 'unknown',
        ruleId: rule.id,
        label: rule.label,
        authority: rule.authority,
        reason: rule.reason,
        source: rule.source || null
    });
    return true;
}

/**
 * Reconcile the inmate list against the set of citizens that should be detained.
 * Returns the ones released this pass, so the caller can walk them home.
 *
 * Release is driven entirely by a rule no longer applying — there is no sentence
 * timer. That is what makes a lifted ban free the model on the next scan.
 */
export function reconcileJail(state, detainedIdx) {
    const released = [];
    const kept = [];
    for (const inn of state.inmates) {
        if (detainedIdx.has(inn.citizenIdx)) kept.push(inn);
        else { released.push(inn); state.processed++; }
    }
    state.inmates = kept;
    return released;
}

export const Jail = {
    state: createJailState(),
    marker: null,
    _timer: 0,
    _remoteTimer: 0,
    _remoteBans: [],
    _remoteInflight: false,
    viewerCountry: null,
    active: true,

    init(scene) {
        this.state = createJailState();
        this._detectViewer();
        this._fetchRemoteBans();
        this._rescan();
        const b = G.bldById[JAIL_BID];
        if (b && scene) {
            const geo = new THREE.BoxGeometry(14, 50, 14);
            const mat = new THREE.MeshBasicMaterial({ color: 0xf472b6 });
            this.marker = new THREE.Mesh(geo, mat);
            this.marker.position.set(b.worldX - 40, 25, b.worldZ - 40);
            scene.add(this.marker);
        }
    },

    /** Locale guess immediately, then upgrade via /api/geo when it answers. */
    _detectViewer() {
        this.viewerCountry = countryFromLocale();
        fetchViewerCountry().then(c => {
            if (c && c !== this.viewerCountry) {
                this.viewerCountry = c;
                this._rescan();          // jurisdiction changed — re-evaluate now
            }
        });
    },

    /** Supabase `ai_bans`. Silently inert if the table or keys are absent. */
    async _fetchRemoteBans() {
        if (this._remoteInflight) return;
        this._remoteInflight = true;
        try {
            const { supabaseUrl, supabaseKey } = INTEGRATION;
            if (!supabaseUrl || !supabaseKey) return;
            const r = await fetch(`${supabaseUrl}/rest/v1/ai_bans?select=*`, {
                headers: { apikey: supabaseKey, Authorization: 'Bearer ' + supabaseKey },
                signal: AbortSignal.timeout(6000)
            });
            if (!r.ok) return;                       // missing table / RLS → ignore, retry later
            const rows = await r.json();
            this._remoteBans = normaliseRemoteBans(rows);
            this._rescan();                          // includes shrinking to empty = releases
        } catch (_) {
            /* offline → keep the seed rules */
        } finally {
            this._remoteInflight = false;
        }
    },

    /** Recompute the detainee set from the rules. This is the whole system. */
    _rescan() {
        const list = G.citizens?.list || [];
        if (!list.length) return;
        const jail = G.bldById[JAIL_BID];

        const rules = BANS.concat(this._remoteBans || []);
        const detainedModels = selectDetained(
            list.map(c => c.model).filter(Boolean), rules, this.viewerCountry
        );

        const detainedIdx = new Set();
        for (const c of list) {
            const rule = c.model && detainedModels.get(c.model.id);
            if (!rule) continue;
            detainedIdx.add(c.idx);
            if (detain(this.state, c, rule) && jail) {
                // Newly detained — send them to the facility.
                c.x = jail.worldX + (c.idx % 7 - 3) * 6;
                c.z = jail.worldZ + (c.idx % 5 - 2) * 6;
                c.path = [];
                c.act = 'sleep';
                c.targetBid = JAIL_BID;
            }
        }

        for (const inn of reconcileJail(this.state, detainedIdx)) {
            const c = list[inn.citizenIdx];
            if (c) { c.targetBid = c.homeBid; c.act = 'commute'; c.path = []; }
        }
    },

    update(dt) {
        if (!this.active) return;

        // Re-evaluate periodically: `until` dates expire and remote rows change
        // while a session is open, and sessions stay open for days.
        this._timer += dt;
        if (this._timer > 30) {
            this._timer = 0;
            this._rescan();
        }
        this._remoteTimer += dt;
        if (this._remoteTimer > 600) {               // ~10 min, matching 2D
            this._remoteTimer = 0;
            this._fetchRemoteBans();
        }

        if (this.marker) {
            this.marker.scale.y = 1 + Math.sin(G.time * 2) * 0.08;
        }
    },

    snapshot() {
        return {
            inmates: this.state.inmates.length,
            processed: this.state.processed,
            capacity: this.state.capacity,
            jailBid: JAIL_BID,
            viewerCountry: this.viewerCountry,
            names: this.state.inmates.map(i => i.name),
            // Why each model is held — the panel should cite the authority, not
            // just the count.
            detentions: this.state.inmates.map(i => ({
                name: i.name, label: i.label, authority: i.authority,
                reason: i.reason, source: i.source
            }))
        };
    }
};
