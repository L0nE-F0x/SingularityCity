/* ══════════════════════════════════════════════════════════════════════════
   REAL ROSTER — the actual AI models and founders, from the same Supabase the
   2D city reads.

   Until now First Person invented most of its population. `Citizens.init` took
   50 real models (SEED + ROSTER), 6 founders and 45 workers, then filled the
   remaining ~600 slots of the population target with procedurally generated
   names — `Anthropic-plus-91`, `OpenAI-mini-23`. The 2D city has always pulled
   the real list (934 rows and climbing) into `G.models`.

   That was not a cosmetic gap. It meant:
     · you walked past, and read nameplates off, models that do not exist
     · the graveyard was empty — FP had 2 retired models against 934's 39
     · the rumour mill was empty — 1 against 36
     · only 6 of the 20 real founders existed, and by first name only

   Everything here is read-only and best-effort. If the fetch fails, the caller
   keeps the old generated roster, because a city that boots with invented
   citizens is still better than one that does not boot.

   Why a raw REST call rather than the supabase-js client the 2D app uses: FP
   ships no vendored client, and this is two GETs against tables that are
   anon-readable by policy. store/live.js already talks to the same endpoint
   the same way.
   ══════════════════════════════════════════════════════════════════════════ */
import { INTEGRATION } from './config.js';

const CACHE_KEY = 'sc_fp_roster_v1';
const CACHE_TTL = 6 * 60 * 60 * 1000;      // six hours; the roster moves slowly
const TIMEOUT_MS = 9000;

function headers() {
    const k = INTEGRATION.supabaseKey;
    return { apikey: k, Authorization: 'Bearer ' + k, Accept: 'application/json' };
}

async function getJSON(path, extraHeaders) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
        const res = await fetch(INTEGRATION.supabaseUrl + path, {
            headers: { ...headers(), ...(extraHeaders || {}) }, signal: ctl.signal
        });
        if (!res.ok) return null;
        const rows = await res.json();
        return Array.isArray(rows) ? rows : null;
    } catch (e) {
        return null;                        // offline, CSP, timeout — all the same here
    } finally {
        clearTimeout(timer);
    }
}

/* PostgREST caps a response at 1000 rows regardless of what you ask for, and
   the models table is past that (1198 at time of writing) — a single GET
   silently returns the first 1000 and looks like it worked. Page with Range
   until a short page comes back. */
const PAGE = 1000;
async function getAllRows(path) {
    const out = [];
    for (let from = 0; from < 20000; from += PAGE) {
        const page = await getJSON(path, { Range: `${from}-${from + PAGE - 1}` });
        if (!page) return out.length ? out : null;      // partial beats nothing
        out.push(...page);
        if (page.length < PAGE) break;
    }
    return out;
}

function readCache() {
    try {
        const raw = localStorage.getItem(CACHE_KEY);
        if (!raw) return null;
        const c = JSON.parse(raw);
        if (!c || !Array.isArray(c.models) || !c.models.length) return null;
        if (Date.now() - (c.at || 0) > CACHE_TTL) return null;
        return c;
    } catch (e) { return null; }
}

function writeCache(models, founders) {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({ at: Date.now(), models, founders }));
    } catch (e) { /* quota — the roster still works this session */ }
}

/* Only the columns the citizen sim actually reads. `select=*` pulls benchmarks,
   descriptions and arch blobs for ~930 rows, which is megabytes FP has no use
   for and would rather not spend on a cold boot. */
const MODEL_COLS = 'id,name,lab,rel,ret,phase,os';

export const Roster = {
    models: null,
    founders: null,
    source: 'none',

    /** Best-effort. Never throws, never blocks longer than TIMEOUT_MS. */
    async load() {
        const cached = readCache();
        if (cached) {
            this.models = cached.models;
            this.founders = cached.founders || null;
            this.source = 'cache';
            // Refresh in the background so the next boot is current, but do not
            // make this boot wait on the network when we already have a roster.
            this._refresh();
            return this;
        }
        const [models, founders] = await Promise.all([
            getAllRows(`/rest/v1/models?select=${MODEL_COLS}`),
            getJSON('/rest/v1/founders?select=id,lab_id,name,role,fact,color')
        ]);
        if (models && models.length) {
            this.models = models;
            this.founders = founders && founders.length ? founders : null;
            this.source = 'live';
            writeCache(this.models, this.founders);
        }
        return this;
    },

    async _refresh() {
        const [models, founders] = await Promise.all([
            getAllRows(`/rest/v1/models?select=${MODEL_COLS}`),
            getJSON('/rest/v1/founders?select=id,lab_id,name,role,fact,color')
        ]);
        if (models && models.length) writeCache(models, founders && founders.length ? founders : null);
    },

    /* The population target is a quality setting (380 / 700 / 1100), and the
       roster is ~934, so on low and medium somebody has to be left out.

       Taking the first N would be wrong: the interesting cohorts are tiny —
       39 retired, 36 rumoured, 2 babies, 3 kids against 854 adults — and a
       naive slice can drop all of them, which is exactly how FP ended up with
       an empty graveyard. So every non-adult is kept, and adults fill whatever
       room is left. `stageOf` is passed in to avoid importing data.js here. */
    pick(limit, stageOf) {
        if (!this.models) return null;
        const special = [], adults = [];
        for (const m of this.models) {
            const stg = stageOf(m.rel, m.ret, m.phase);
            (stg === 'adult' ? adults : special).push(m);
        }
        // Deterministic order, so the same models are present across reloads.
        const byId = (a, b) => String(a.id).localeCompare(String(b.id));
        special.sort(byId);
        adults.sort(byId);
        const room = Math.max(0, limit - special.length);
        if (room >= adults.length) return special.concat(adults);

        /* Stride, don't slice. Ids sort alphabetically and lab prefixes cluster
           inside that order, so `adults.slice(0, room)` takes an alphabetical
           prefix and silently drops whole labs off the end — Alibaba's 109 Qwen
           models sort under `q` and all but one of them vanished, leaving the
           largest lab in the roster with an empty headquarters.

           Walking the sorted list at a fixed stride keeps the same models on
           every reload and samples every lab in proportion to its size. */
        const kept = [];
        const step = adults.length / room;
        for (let i = 0; kept.length < room && i < adults.length; i++) {
            if (Math.floor(kept.length * step) === i) kept.push(adults[i]);
        }
        return special.concat(kept);
    }
};
