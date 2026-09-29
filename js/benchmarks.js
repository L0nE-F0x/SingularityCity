/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BENCHMARKS — catalog, live-score matching, observatory + citizen bench tab
   Task scores come from the ZeroEval canonical board. Arena Elo comes from the
   public daily snapshot of arena.ai (text + code). Nothing in here invents a
   number: a bench with no published score stays blank.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BENCH_CATALOG = [
    // Agents — the coding/computer-use numbers the field actually quotes
    { id: 'SWE_PRO', ze: 'swe_bench_pro_score', group: 'agents', hard: true, weight: 1.5, short: 'SWE-Pro', label: 'SWE-bench Pro', desc: 'Harder follow-up to SWE-bench Verified, once Verified started to saturate.', color: '#22d3ee', hi: 70, mid: 40, aliases: ['SWEPRO', 'SWEBENCHPRO', 'SWE_BENCH_PRO'] },
    { id: 'TB', ze: 'terminal_bench_score', group: 'agents', hard: true, weight: 1.5, short: 'Terminal', label: 'Terminal-Bench', desc: 'The model has to finish real work in a terminal, not complete a function.', color: '#67e8f9', hi: 45, mid: 22, aliases: ['TERMINAL', 'TERMINALBENCH', 'TERMINAL_BENCH'] },
    { id: 'SWE', ze: 'swe_bench_verified_score', group: 'agents', hard: true, weight: 1.2, short: 'SWE-V', label: 'SWE-bench Verified', desc: 'Real GitHub issues, human-checked. The coding number everyone still cites.', color: '#22d3ee', hi: 85, mid: 55, aliases: ['SWEBENCH', 'SWEBENCHVERIFIED', 'SWE_BENCH', 'SWE_BENCH_VERIFIED'] },
    { id: 'OSWORLD', ze: 'osworld_score', group: 'agents', hard: true, weight: 1.2, short: 'OSWorld', label: 'OSWorld', desc: 'Computer-use tasks on a real desktop.', color: '#38bdf8', hi: 60, mid: 30, aliases: ['OS_WORLD'] },
    { id: 'SCICODE', ze: 'scicode_score', group: 'agents', hard: true, weight: 1.1, short: 'SciCode', label: 'SciCode', desc: 'Research coding, not interview puzzles.', color: '#0ea5e9', hi: 55, mid: 30, aliases: ['SCI_CODE'] },
    { id: 'BROWSECOMP', ze: 'browsecomp_score', group: 'agents', hard: true, weight: 1.0, short: 'Browse', label: 'BrowseComp', desc: 'Questions that require browsing, not recalling the training set.', color: '#7dd3fc', hi: 75, mid: 40, aliases: ['BROWSE'] },
    { id: 'TAU', ze: 'tau_bench_retail_score', group: 'agents', hard: true, weight: 0.9, short: 'τ-bench', label: 'τ-bench retail', desc: 'Multi-turn tool use where the model has to follow a policy.', color: '#a5f3fc', hi: 80, mid: 50, aliases: ['TAUBENCH', 'TAU_BENCH', 'TAU_BENCH_RETAIL', 'TAUBENCHRETAIL'] },
    { id: 'TOOLATHLON', ze: 'toolathlon_score', group: 'agents', hard: true, weight: 0.9, short: 'Toolathlon', label: 'Toolathlon', desc: 'Long tool-use tasks.', color: '#06b6d4', hi: 70, mid: 40, aliases: ['TOOL'] },
    { id: 'MCP', ze: 'mcp_atlas_score', group: 'agents', hard: true, weight: 0.9, short: 'MCP', label: 'MCP Atlas', desc: 'Tool use across MCP servers.', color: '#0891b2', hi: 75, mid: 45, aliases: ['MCPATLAS', 'MCP_ATLAS'] },
    { id: 'APEX', ze: 'apex_agents_score', group: 'agents', hard: true, weight: 0.8, short: 'Apex', label: 'Apex agents', desc: 'Agent eval on the ZeroEval board.', color: '#155e75', hi: 60, mid: 30, aliases: ['APEXAGENTS', 'APEX_AGENTS'] },

    // Reasoning — the exams that replaced MMLU
    { id: 'HLE', ze: 'hle_score', group: 'reasoning', hard: true, weight: 1.5, short: 'HLE', label: "Humanity's Last Exam", desc: 'Expert questions built to stay hard after MMLU saturated.', color: '#f472b6', hi: 45, mid: 20, aliases: ['HUMANITYSLASTEXAM', 'LASTEXAM'] },
    { id: 'ARCAGI', ze: 'arc_agi_v2_score', group: 'reasoning', hard: true, weight: 1.4, short: 'ARC-AGI-2', label: 'ARC-AGI-2', desc: 'Novel visual puzzles. This is not the 2018 AI2 ARC exam.', color: '#a78bfa', hi: 80, mid: 35, aliases: ['ARCAGI2', 'ARC_AGI', 'ARC_AGI_2', 'ARC_AGI_V2', 'ARCAGIV2'] },
    { id: 'FRONTIERMATH', ze: 'frontiermath_score', group: 'reasoning', hard: true, weight: 1.4, short: 'FMath', label: 'FrontierMath', desc: "Epoch's research-math problems.", color: '#c4b5fd', hi: 50, mid: 18, aliases: ['FRONTIER_MATH', 'FMATH'] },
    { id: 'GPQA', ze: 'gpqa_score', group: 'reasoning', hard: true, weight: 1.0, short: 'GPQA', label: 'GPQA', desc: 'Graduate science questions written so search does not help. Current boards mean the Diamond set.', color: '#f472b6', hi: 90, mid: 70, aliases: ['GPQADIAMOND', 'GPQA_DIAMOND'] },
    { id: 'AIME', ze: 'aime_2025_score', group: 'reasoning', hard: true, weight: 0.7, short: 'AIME', label: 'AIME 2025', desc: 'American Invitational Mathematics Examination, 2025. The top end is saturating.', color: '#facc15', hi: 92, mid: 60, aliases: ['AIME2025', 'AIME_2025', 'AIME2026'] },

    // Knowledge and multimodal — real, but not the headline rank
    { id: 'MMMU_PRO', ze: 'mmmu_pro_score', group: 'knowledge', hard: false, weight: 0, short: 'MMMU-Pro', label: 'MMMU-Pro', desc: 'Harder multimodal exam.', color: '#fb923c', hi: 78, mid: 55, aliases: ['MMMUPRO', 'MMMU_PRO'] },
    { id: 'MMMU', ze: 'mmmu_score', group: 'knowledge', hard: false, weight: 0, short: 'MMMU', label: 'MMMU', desc: 'Multimodal exam across disciplines.', color: '#fdba74', hi: 80, mid: 55, aliases: [] },
    { id: 'SIMPLEQA', ze: 'simpleqa_score', group: 'knowledge', hard: false, weight: 0, short: 'SimpleQA', label: 'SimpleQA', desc: 'Short factual questions. A hallucination check.', color: '#f97316', hi: 70, mid: 35, aliases: ['SIMPLE_QA'] },
    { id: 'CHARXIV', ze: 'charxiv_r_score', group: 'knowledge', hard: false, weight: 0, short: 'CharXiv', label: 'CharXiv', desc: 'Reading charts.', color: '#ea580c', hi: 70, mid: 40, aliases: ['CHARXIVR'] },
    { id: 'MRCR', ze: 'mrcr_v2_score', group: 'knowledge', hard: false, weight: 0, short: 'MRCR', label: 'MRCR v2', desc: 'Long-context retrieval.', color: '#c2410c', hi: 70, mid: 35, aliases: ['MRCRV2', 'MRCR_V2'] },
    { id: 'MMMLU', ze: 'mmmlu_score', group: 'knowledge', hard: false, weight: 0, short: 'MMMLU', label: 'MMMLU', desc: 'MMLU translated. Not the original English MMLU.', color: '#4ade80', hi: 88, mid: 70, aliases: ['MM_MLU'] },
    { id: 'SCREENSPOT', ze: 'screenspot_pro_score', group: 'knowledge', hard: false, weight: 0, short: 'ScreenSpot', label: 'ScreenSpot Pro', desc: 'Can it click the right thing on a screen.', color: '#86efac', hi: 60, mid: 30, aliases: ['SCREENSPOTPRO', 'SCREENSPOT_PRO'] },

    // Arena — a different scale. Never averaged into the percent index.
    { id: 'ELO', ze: null, group: 'arena', hard: false, weight: 0, scale: 'elo', eloMin: 1200, eloMax: 1560, short: 'Arena', label: 'Arena text', desc: "Blind human preference on Arena's text board.", color: '#facc15', aliases: ['ARENA', 'ARENAELO', 'LMARENA', 'TEXTELO', 'TEXT_ELO'] },
    { id: 'ELO_CODE', ze: null, group: 'arena', hard: false, weight: 0, scale: 'elo', eloMin: 1300, eloMax: 1900, short: 'Code Elo', label: 'Arena code', desc: "Blind human preference on Arena's code board.", color: '#fde68a', aliases: ['CODEELO', 'ARENA_CODE', 'CODE_ELO', 'ELOCODE'] },

    // Archive — saturated 2023-24 suites. Kept so older citizens still have a file.
    // HumanEval is NOT an alias of SWE-bench. A previous ingest wrote SWE-bench
    // into the HumanEval slot; new ingests do not, and this row stays the old exam.
    { id: 'MMLU', ze: null, group: 'archive', hard: false, weight: 0, short: 'MMLU', label: 'MMLU', desc: 'The 57-subject multiple choice exam. Saturated for frontier models.', color: '#4ade80', hi: 88, mid: 70, aliases: [] },
    { id: 'HumanEval', ze: null, group: 'archive', hard: false, weight: 0, short: 'HumanEval', label: 'HumanEval', desc: 'Old function-completion set. Saturated, and easy to contaminate.', color: '#94a3b8', hi: 90, mid: 70, aliases: ['HUMANEVAL', 'HUMAN_EVAL'] },
    { id: 'MATH', ze: null, group: 'archive', hard: false, weight: 0, short: 'MATH', label: 'MATH', desc: 'The older Hendrycks math set. AIME replaced it at the frontier.', color: '#facc15', hi: 90, mid: 60, aliases: [] },
    { id: 'ARC', ze: null, group: 'archive', hard: false, weight: 0, short: 'ARC', label: 'ARC-Challenge', desc: 'The 2018 science-exam set. Not ARC-AGI.', color: '#a78bfa', hi: 95, mid: 70, aliases: ['ARCCHALLENGE', 'ARC_CHALLENGE'] },
    { id: 'MGSM', ze: null, group: 'archive', hard: false, weight: 0, short: 'MGSM', label: 'MGSM', desc: 'Grade-school math in several languages.', color: '#f97316', hi: 90, mid: 60, aliases: [] },
];

const BENCH_BY_ID = {};
const BENCH_ALIAS = {};
BENCH_CATALOG.forEach((spec) => {
    spec.scale = spec.scale || 'pct';
    BENCH_BY_ID[spec.id] = spec;
    BENCH_ALIAS[spec.id.toUpperCase().replace(/[^A-Z0-9]/g, '')] = spec.id;
    (spec.aliases || []).forEach((a) => {
        BENCH_ALIAS[String(a).toUpperCase().replace(/[^A-Z0-9]/g, '')] = spec.id;
    });
});

const BENCH_GROUPS = {
    agents: 'Agents & coding',
    reasoning: 'Reasoning',
    knowledge: 'Knowledge & multimodal',
    arena: 'Arena',
    archive: 'Older suites',
};

const BENCH_BOARDS = {
    live: {
        id: 'live',
        label: 'Live',
        blurb: 'Needs two published scores on the benches people are still arguing about. One lucky number cannot sit at #1.',
        cols: ['GPQA', 'SWE', 'SWE_PRO', 'HLE', 'ARCAGI', 'AIME', 'TB', 'ELO'],
        defaultSort: 'index',
    },
    agents: {
        id: 'agents',
        label: 'Agents',
        blurb: 'Coding and computer-use. Sorted by SWE-bench Pro when you land here.',
        cols: ['SWE_PRO', 'SWE', 'TB', 'OSWORLD', 'BROWSECOMP', 'TAU', 'TOOLATHLON', 'MCP'],
        defaultSort: 'SWE_PRO',
    },
    reasoning: {
        id: 'reasoning',
        label: 'Reasoning',
        blurb: 'The exams that replaced MMLU.',
        cols: ['HLE', 'ARCAGI', 'FRONTIERMATH', 'GPQA', 'AIME', 'SCICODE'],
        defaultSort: 'HLE',
    },
    arena: {
        id: 'arena',
        label: 'Arena',
        blurb: "Blind votes. A dim number was stored earlier and did not match today's snapshot.",
        cols: ['ELO', 'ELO_CODE'],
        defaultSort: 'ELO',
    },
    knowledge: {
        id: 'knowledge',
        label: 'Knowledge',
        blurb: 'Multimodal, factuality, long context.',
        cols: ['MMMLU', 'MMMU_PRO', 'MMMU', 'SIMPLEQA', 'CHARXIV', 'MRCR'],
        defaultSort: 'MMMLU',
    },
    archive: {
        id: 'archive',
        label: 'Archive',
        blurb: 'Saturated 2023–24 suites. Kept so older citizens still have a file.',
        cols: ['MMLU', 'HumanEval', 'MATH', 'ARC', 'MGSM'],
        defaultSort: 'MMLU',
    },
    unscored: {
        id: 'unscored',
        label: 'No score',
        blurb: 'In the city, but neither ZeroEval nor Arena has published a current score under this name. The bench tab stays empty on purpose — the city does not guess.',
        cols: [],
        defaultSort: 'rel',
    },
};

const EFFORT_TOKENS = new Set([
    'high',
    'xhigh',
    'max',
    'low',
    'medium',
    'med',
    'minimal',
    'thinking',
    'nothinking',
    'adaptive',
]);

const Bench = {
    CATALOG: BENCH_CATALOG,
    BOARDS: BENCH_BOARDS,
    GROUPS: BENCH_GROUPS,
    fed: {},
    status: { zeModels: 0, zeAt: 0, arenaText: 0, arenaCode: 0, arenaUpdated: '', arenaFetched: 0 },
    _ze: new Map(),
    _arena: new Map(),
    _code: new Map(),
    _rankCache: null,

    spec(id) {
        return BENCH_BY_ID[id] || null;
    },

    alias(key) {
        if (key == null) return null;
        const norm = String(key).toUpperCase().replace(/[^A-Z0-9]/g, '');
        return BENCH_ALIAS[norm] || null;
    },

    tokens(s) {
        let t = String(s || '').toLowerCase();
        t = t.replace(/\([^)]*\)/g, ' ');
        // Arena writes 4-7 where ZeroEval writes 4.7. A bare 47 stays one token,
        // so Opus 4.7 does not collide with a model that is actually version 47.
        t = t.replace(/(\d)-(?=\d)/g, '$1.');
        t = t.replace(/[^a-z0-9.]+/g, ' ').trim();
        if (!t) return [];
        t = t
            .split(/\s+/)
            .map((part) =>
                part.replace(/\./g, (dot, i, str) => {
                    const prev = str[i - 1];
                    const next = str[i + 1];
                    if (prev >= '0' && prev <= '9' && next >= '0' && next <= '9') return '.';
                    return '';
                })
            )
            .filter(Boolean)
            .join(' ');
        if (!t) return [];
        let parts = t.split(/\s+/).filter((p) => p && !/^\d{6,}$/.test(p));
        if (parts.length && EFFORT_TOKENS.has(parts[parts.length - 1])) parts = parts.slice(0, -1);
        return parts;
    },

    canon(s) {
        return this.tokens(s).join('');
    },

    tokenKey(s) {
        return this.tokens(s).slice().sort().join('|');
    },

    _addKeys(set, s) {
        if (!s) return;
        const c = this.canon(s);
        const tk = this.tokenKey(s);
        if (c) set.add('c:' + c);
        if (tk) set.add('t:' + tk);
    },

    _keysForZe(row) {
        const set = new Set();
        this._addKeys(set, row && row.name);
        this._addKeys(set, row && row.model_id);
        this._addKeys(set, row && row.canonical_model_id);
        const id = String((row && row.model_id) || '');
        const slash = id.indexOf('/');
        if (slash > 0) this._addKeys(set, id.slice(slash + 1));
        return set;
    },

    _keysForModel(model) {
        const set = new Set();
        if (!model) return set;
        this._addKeys(set, model.name);
        this._addKeys(set, model.id);
        const id = String(model.id || '');
        const lab = String(model.lab || '');
        if (lab) {
            const lower = id.toLowerCase();
            const pfx = lab.toLowerCase();
            ['_', '/', '-'].forEach((sep) => {
                const p = pfx + sep;
                if (lower.startsWith(p)) this._addKeys(set, id.slice(p.length));
            });
        }
        const us = id.indexOf('_');
        if (us > 0) this._addKeys(set, id.slice(us + 1));
        const sl = id.indexOf('/');
        if (sl > 0) this._addKeys(set, id.slice(sl + 1));
        return set;
    },

    normalize(raw) {
        const out = {};
        if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
        Object.keys(raw).forEach((k) => {
            const v = raw[k];
            if (typeof v !== 'number' || !isFinite(v)) return;
            const id = this.alias(k);
            if (!id) return;
            const spec = BENCH_BY_ID[id];
            if (spec.scale === 'elo') {
                if (v < 500 || v > 2500) return;
                out[id] = Math.round(v);
            } else if (v >= 0 && v <= 100) {
                out[id] = Math.round(v * 10) / 10;
            }
        });
        return out;
    },

    fromZeroEval(row) {
        const out = {};
        if (!row) return out;
        BENCH_CATALOG.forEach((spec) => {
            if (!spec.ze) return;
            const raw = row[spec.ze];
            if (typeof raw !== 'number' || !isFinite(raw)) return;
            const pct = raw >= 0 && raw <= 1 ? raw * 100 : raw;
            if (pct < 0 || pct > 100) return;
            out[spec.id] = Math.round(pct * 10) / 10;
        });
        return out;
    },

    ingestZeroEval(rows) {
        this._ze = new Map();
        this._rankCache = null;
        this.status.zeAt = Date.now();
        this.status.zeModels = Array.isArray(rows) ? rows.length : 0;
        if (!Array.isArray(rows)) return 0;
        let kept = 0;
        rows.forEach((row) => {
            const scores = this.fromZeroEval(row);
            if (!Object.keys(scores).length) return;
            kept++;
            const rec = { scores: scores, name: row.name || '' };
            this._keysForZe(row).forEach((key) => {
                const prev = this._ze.get(key);
                if (!prev || Object.keys(scores).length > Object.keys(prev.scores).length) this._ze.set(key, rec);
            });
        });
        return kept;
    },

    ingestArena(kind, payload) {
        const map = new Map();
        const models = payload && Array.isArray(payload.models) ? payload.models : [];
        models.forEach((row) => {
            const score = row && typeof row.score === 'number' ? row.score : null;
            if (score == null || score < 500 || score > 2500) return;
            const rec = { score: Math.round(score), name: row.model || '', votes: row.votes || 0 };
            const keys = new Set();
            this._addKeys(keys, row.model);
            keys.forEach((key) => {
                const prev = map.get(key);
                if (!prev || rec.score > prev.score) map.set(key, rec);
            });
        });
        if (kind === 'code') {
            this._code = map;
            this.status.arenaCode = models.length;
        } else {
            this._arena = map;
            this.status.arenaText = models.length;
            const meta = (payload && payload.meta) || {};
            this.status.arenaUpdated = meta.last_updated || meta.fetched_at || '';
        }
        this.status.arenaFetched = Date.now();
        this._rankCache = null;
        return map.size;
    },

    lookup(model) {
        const keys = this._keysForModel(model);
        let ze = null,
            elo = null,
            code = null;
        keys.forEach((k) => {
            if (!ze && this._ze.has(k)) ze = this._ze.get(k);
            if (!elo && this._arena.has(k)) elo = this._arena.get(k);
            if (!code && this._code.has(k)) code = this._code.get(k);
        });
        if (!ze && !elo && !code) return null;
        return { ze: ze, elo: elo, code: code };
    },

    writeScores(model, scores, opts) {
        if (!model || !model.id || !scores) return 0;
        const overwrite = !!(opts && opts.overwrite);
        const source = (opts && opts.source) || '';
        if (typeof window !== 'undefined') {
            if (!window.BM) window.BM = {};
        }
        const bucket = typeof BM !== 'undefined' ? BM : null;
        if (!bucket) return 0;
        if (!bucket[model.id] || typeof bucket[model.id] !== 'object') bucket[model.id] = {};
        if (!model.benchmarks || typeof model.benchmarks !== 'object' || Array.isArray(model.benchmarks)) {
            model.benchmarks = {};
        }
        if (!this.fed[model.id]) this.fed[model.id] = {};
        let n = 0;
        Object.keys(scores).forEach((k) => {
            const spec = BENCH_BY_ID[k];
            const v = scores[k];
            if (!spec || typeof v !== 'number' || !isFinite(v)) return;
            const cur = bucket[model.id][k];
            if (overwrite || cur == null) {
                if (cur !== v) n++;
                bucket[model.id][k] = v;
                model.benchmarks[k] = v;
                if (source) this.fed[model.id][k] = source;
            } else if (model.benchmarks[k] == null) {
                model.benchmarks[k] = cur;
            }
        });
        this._rankCache = null;
        return n;
    },

    attach(model) {
        const hit = this.lookup(model);
        if (!hit) return 0;
        let n = 0;
        if (hit.ze) n += this.writeScores(model, hit.ze.scores, { overwrite: true, source: 'zeroeval' });
        if (hit.elo) n += this.writeScores(model, { ELO: hit.elo.score }, { overwrite: true, source: 'arena' });
        if (hit.code) n += this.writeScores(model, { ELO_CODE: hit.code.score }, { overwrite: true, source: 'arena' });
        return n;
    },

    attachAll(models) {
        const list = models || (typeof G !== 'undefined' && G.models) || [];
        let n = 0;
        list.forEach((m) => {
            if (this.attach(m)) n++;
        });
        return n;
    },

    adoptStored(model) {
        if (!model || !model.benchmarks) return;
        const norm = this.normalize(model.benchmarks);
        model.benchmarks = norm;
        this.writeScores(model, norm, { overwrite: false, source: 'archive' });
    },

    scoresFor(modelOrId) {
        const id = typeof modelOrId === 'string' ? modelOrId : modelOrId && modelOrId.id;
        let model = modelOrId && typeof modelOrId === 'object' ? modelOrId : null;
        if (!model && id && typeof G !== 'undefined' && Array.isArray(G.models)) {
            model = G.models.find((m) => m.id === id) || null;
        }
        const raw = {};
        if (model && model.benchmarks && typeof model.benchmarks === 'object') Object.assign(raw, model.benchmarks);
        if (id && typeof BM !== 'undefined' && BM[id] && typeof BM[id] === 'object') Object.assign(raw, BM[id]);
        return this.normalize(raw);
    },

    hardList(scores) {
        const out = [];
        BENCH_CATALOG.forEach((spec) => {
            if (spec.hard && typeof scores[spec.id] === 'number') out.push(spec);
        });
        return out;
    },

    indexOf(scores) {
        if (!scores) return null;
        let wsum = 0,
            vsum = 0,
            n = 0;
        BENCH_CATALOG.forEach((spec) => {
            if (!spec.hard || !spec.weight) return;
            const v = scores[spec.id];
            if (typeof v !== 'number') return;
            wsum += spec.weight;
            vsum += spec.weight * v;
            n++;
        });
        // One published number is not an index. It still shows on its own board.
        if (n < 2 || !wsum) return null;
        return { score: Math.round((vsum / wsum) * 10) / 10, n: n };
    },

    // 0–100 number for lab flagships. The index when two hard benches exist,
    // otherwise the mean of the hard benches that do. Elo never enters this.
    cityScore(modelOrId) {
        const scores = this.scoresFor(modelOrId);
        const idx = this.indexOf(scores);
        if (idx) return idx.score;
        const hard = this.hardList(scores);
        if (!hard.length) return 0;
        return hard.reduce((sum, spec) => sum + scores[spec.id], 0) / hard.length;
    },

    present(scores) {
        const order = { agents: 0, reasoning: 1, knowledge: 2, arena: 3, archive: 4 };
        return BENCH_CATALOG.filter((s) => typeof scores[s.id] === 'number').sort(
            (a, b) => (order[a.group] - order[b.group]) || (b.weight || 0) - (a.weight || 0)
        );
    },

    fmt(spec, v) {
        if (typeof v !== 'number' || !isFinite(v)) return '—';
        if (spec && spec.scale === 'elo') return String(Math.round(v));
        const n = Math.round(v * 10) / 10;
        return (n % 1 === 0 ? n.toFixed(0) : n.toFixed(1)) + '%';
    },

    barPct(spec, v) {
        if (typeof v !== 'number') return 0;
        if (spec && spec.scale === 'elo') {
            const min = spec.eloMin || 1000;
            const max = spec.eloMax || 1600;
            return Math.max(0, Math.min(100, ((v - min) / (max - min)) * 100));
        }
        return Math.max(0, Math.min(100, v));
    },

    tone(spec, v) {
        if (typeof v !== 'number') return 'var(--t3)';
        if (spec && spec.scale === 'elo') {
            const t = this.barPct(spec, v);
            return t > 75 ? '#4ade80' : t > 45 ? '#facc15' : '#f87171';
        }
        const hi = spec && spec.hi != null ? spec.hi : 80;
        const mid = spec && spec.mid != null ? spec.mid : 50;
        return v >= hi ? '#4ade80' : v >= mid ? '#facc15' : '#f87171';
    },

    flexLine(scores) {
        const pref = ['SWE_PRO', 'HLE', 'ARCAGI', 'TB', 'SWE', 'GPQA', 'ELO', 'AIME'];
        for (let i = 0; i < pref.length; i++) {
            const spec = BENCH_BY_ID[pref[i]];
            if (spec && typeof scores[spec.id] === 'number') return spec.label + ': ' + this.fmt(spec, scores[spec.id]);
        }
        const any = this.present(scores)[0];
        return any ? any.label + ': ' + this.fmt(any, scores[any.id]) : '';
    },

    _esc(s) {
        if (typeof escapeHTML === 'function') return escapeHTML(s);
        return String(s ?? '').replace(/[&<>'"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[c]);
    },

    _color(c) {
        if (typeof safeColor === 'function') return safeColor(c);
        return typeof c === 'string' && /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#64748b';
    },

    _js(s) {
        return String(s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
    },

    _when(ts) {
        if (!ts) return '';
        try {
            return new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        } catch (e) {
            return '';
        }
    },

    sourceLine() {
        const ze = this.status.zeModels
            ? `ZeroEval canonical board, ${this.status.zeModels} models${this.status.zeAt ? ', fetched ' + this._when(this.status.zeAt) : ''}`
            : 'ZeroEval has not answered yet this session';
        const arena = this.status.arenaText
            ? `Arena text (${this.status.arenaText}) and code (${this.status.arenaCode})${this.status.arenaUpdated ? ', snapshot ' + this.status.arenaUpdated : ''}`
            : 'Arena snapshot has not loaded yet';
        return ze + ' · ' + arena + '. A blank cell has not been published. The city does not fill it in.';
    },

    _ranks() {
        const n = typeof G !== 'undefined' && G.models ? G.models.length : 0;
        if (this._rankCache && this._rankCache.n === n && Date.now() - this._rankCache.at < 4000) return this._rankCache;
        const by = {};
        const indexRows = [];
        const models = typeof G !== 'undefined' && Array.isArray(G.models) ? G.models : [];
        models.forEach((m) => {
            const scores = this.scoresFor(m);
            const idx = this.indexOf(scores);
            if (idx) indexRows.push({ id: m.id, v: idx.score });
            BENCH_CATALOG.forEach((spec) => {
                const v = scores[spec.id];
                if (typeof v !== 'number') return;
                if (!by[spec.id]) by[spec.id] = [];
                by[spec.id].push({ id: m.id, v: v });
            });
        });
        Object.keys(by).forEach((k) => by[k].sort((a, b) => b.v - a.v));
        indexRows.sort((a, b) => b.v - a.v);
        this._rankCache = { by: by, indexRows: indexRows, n: n, at: Date.now() };
        return this._rankCache;
    },

    _place(list, id) {
        if (!list) return '';
        const i = list.findIndex((r) => r.id === id);
        if (i < 0) return '';
        return i + 1 + ' of ' + list.length;
    },

    isLive(model, key) {
        const fed = model && this.fed[model.id];
        if (!fed) return false;
        if (key === 'ELO' || key === 'ELO_CODE') return fed[key] === 'arena';
        return fed[key] === 'zeroeval';
    },

    rows() {
        const models = typeof G !== 'undefined' && Array.isArray(G.models) ? G.models : [];
        return models.map((m) => {
            const scores = this.scoresFor(m);
            const idx = this.indexOf(scores);
            const cost = typeof COSTS !== 'undefined' ? COSTS[m.id] : null;
            const rel = m.rel || m.released || '';
            return {
                m: m,
                scores: scores,
                index: idx ? idx.score : null,
                n: idx ? idx.n : 0,
                hardN: this.hardList(scores).length,
                costIn: cost && typeof cost.input === 'number' ? cost.input : null,
                costOut: cost && typeof cost.output === 'number' ? cost.output : null,
                ctx: typeof CTX !== 'undefined' ? CTX[m.id] : null,
                rel: rel,
                relMs: rel ? Date.parse(rel) || 0 : 0,
            };
        });
    },

    _matches(row, q) {
        if (!q) return true;
        const lab = (typeof LABS !== 'undefined' && LABS[row.m.lab]) || {};
        const hay = [row.m.name, row.m.id, row.m.lab, lab.name, row.m._src].filter(Boolean).join(' ').toLowerCase();
        return hay.includes(q);
    },

    _sortVal(row, key) {
        if (key === 'index') return row.index;
        if (key === 'cost') return row.costOut;
        if (key === 'ctx') return row.ctx;
        if (key === 'rel') return row.relMs || null;
        const v = row.scores[key];
        return typeof v === 'number' ? v : null;
    },

    _cell(row, key) {
        const spec = BENCH_BY_ID[key];
        const v = row.scores[key];
        if (!spec || typeof v !== 'number') return '<td style="color:var(--t3)">—</td>';
        const live = key === 'ELO' || key === 'ELO_CODE' ? this.isLive(row.m, key) : true;
        const title = live ? spec.label : spec.label + ' — older stored figure, not on today\'s Arena snapshot';
        const cls = live ? '' : ' class="bench-dim"';
        return `<td${cls} title="${this._esc(title)}" style="color:${this.tone(spec, v)};font-weight:700">${this.fmt(spec, v)}</td>`;
    },

    panelHTML(model) {
        if (!model) return '';
        this.attach(model);
        const scores = this.scoresFor(model);
        const present = this.present(scores);
        const idx = this.indexOf(scores);
        const ranks = this._ranks();
        const esc = (s) => this._esc(s);

        if (!present.length) {
            const waiting = !this.status.zeAt && !this.status.arenaFetched;
            return `<div class="bench-empty"><div class="bench-empty-h">${waiting ? 'Leaderboards are still loading' : 'No public score yet'}</div><p>${waiting ? 'ZeroEval and the Arena snapshot land a few seconds after the city boots. Open this tab again and the numbers fill in if the boards know this model.' : esc(model.name) + ' is in the city. This session checked the ZeroEval canonical board' + (this.status.zeModels ? ' (' + this.status.zeModels + ' models)' : '') + ' and the Arena text and code snapshots' + (this.status.arenaUpdated ? ' (' + esc(this.status.arenaUpdated) + ')' : '') + '. Neither has published a score under this name.'}</p><p>The tab stays here so it fills in when a board does. The city will not invent a number.</p><div class="bench-note">${esc(this.sourceLine())}</div></div>`;
        }

        let hero = '';
        if (idx) {
            const place = this._place(ranks.indexRows, model.id);
            hero = `<div class="bench-index"><div><div class="bench-kicker">Frontier index</div><div class="bench-index-num">${idx.score}</div><div class="bench-index-sub">${idx.n} hard benches${place ? ' · ' + place : ''}</div></div></div>`;
        } else {
            const one = this.hardList(scores)[0] || present[0];
            const place = this._place(ranks.by[one.id], model.id);
            hero = `<div class="bench-index"><div><div class="bench-kicker">${esc(one.label)}</div><div class="bench-index-num">${this.fmt(one, scores[one.id])}</div><div class="bench-index-sub">${this.hardList(scores).length < 2 ? 'Only one current score published so far' : esc(one.desc)}${place ? ' · ' + place : ''}</div></div></div>`;
        }

        const groups = [];
        present.forEach((spec) => {
            let g = groups.find((x) => x.id === spec.group);
            if (!g) {
                g = { id: spec.group, specs: [] };
                groups.push(g);
            }
            g.specs.push(spec);
        });

        let body = groups
            .map((g) => {
                const rows = g.specs
                    .map((spec) => {
                        const v = scores[spec.id];
                        const place = this._place(ranks.by[spec.id], model.id);
                        const fw = this.barPct(spec, v);
                        const stale =
                            (spec.id === 'ELO' || spec.id === 'ELO_CODE') && !this.isLive(model, spec.id)
                                ? ' · older stored figure'
                                : '';
                        return `<div class="bench-row"><div class="bench-hdr"><span class="bench-name">${esc(spec.label)}</span><span class="bench-score" style="color:${this.tone(spec, v)}">${this.fmt(spec, v)}</span></div><div class="bench-bg"><div class="bench-fill" style="width:${fw}%;background:linear-gradient(90deg,${spec.color}88,${spec.color})"></div></div><div class="bench-desc">${esc(spec.desc)}${place ? ' · ' + place : ''}${stale}</div></div>`;
                    })
                    .join('');
                return `<div class="bench-group"><div class="bench-group-h">${esc(BENCH_GROUPS[g.id] || g.id)}</div>${rows}</div>`;
            })
            .join('');

        return hero + body + `<div class="bench-note">${esc(this.sourceLine())}</div>`;
    },

    compareRowsHTML(models) {
        const scored = (models || []).map((m) => ({ m: m, scores: this.scoresFor(m) }));
        const specs = BENCH_CATALOG.filter((spec) => scored.some((r) => typeof r.scores[spec.id] === 'number'));
        if (!specs.length) {
            return '<div class="bench-empty"><div class="bench-empty-h">Nothing published to compare</div><p>None of the selected citizens has a score on the current boards.</p></div>';
        }
        return specs
            .map((spec) => {
                const bars = scored
                    .map((r) => {
                        const v = r.scores[spec.id];
                        const lab = (typeof LABS !== 'undefined' && LABS[r.m.lab]) || {};
                        const fw = typeof v === 'number' ? this.barPct(spec, v) : 0;
                        const name = this._esc(String(r.m.name || '').split(' ').slice(-2).join(' '));
                        return `<div class="bench-cmp"><span>${name}</span><div class="bench-bg"><div class="bench-fill" style="width:${fw}%;background:${this._color(lab.color)}"></div></div><b style="color:${this.tone(spec, v)}">${this.fmt(spec, v)}</b></div>`;
                    })
                    .join('');
                return `<div class="bench-group"><div class="bench-group-h">${this._esc(spec.label)}</div>${bars}</div>`;
            })
            .join('');
    },

    observatoryHTML(opts) {
        const o = opts || {};
        const board = BENCH_BOARDS[o.board] || BENCH_BOARDS.live;
        const q = String(o.q || '').trim().toLowerCase();
        const dir = o.dir === 1 ? 1 : -1;
        const all = this.rows();
        const allowed = new Set(board.cols.concat(['cost', 'ctx']));
        if (board.id === 'live') allowed.add('index');
        if (board.id === 'unscored') allowed.add('rel');
        let sort = o.sort;
        if (!sort || !allowed.has(sort)) sort = board.defaultSort;

        const onBoard = (row) => {
            if (board.id === 'live') return row.index != null;
            if (board.id === 'unscored') return row.hardN === 0 && row.scores.ELO == null && row.scores.ELO_CODE == null;
            return board.cols.some((k) => typeof row.scores[k] === 'number');
        };

        const rows = all.filter((r) => onBoard(r) && this._matches(r, q));
        rows.sort((a, b) => {
            const av = this._sortVal(a, sort);
            const bv = this._sortVal(b, sort);
            if (av == null && bv == null) return String(a.m.name).localeCompare(String(b.m.name));
            if (av == null) return 1;
            if (bv == null) return -1;
            const mult = sort === 'cost' ? -dir : dir;
            return mult * (av - bv);
        });

        const counts = {};
        Object.keys(BENCH_BOARDS).forEach((id) => {
            const b = BENCH_BOARDS[id];
            counts[id] = all.filter((r) => {
                if (id === 'live') return r.index != null;
                if (id === 'unscored') return r.hardN === 0 && r.scores.ELO == null && r.scores.ELO_CODE == null;
                return b.cols.some((k) => typeof r.scores[k] === 'number');
            }).length;
        });

        const liveRows = all.filter((r) => r.index != null);
        const cards = this._cards(liveRows.length ? liveRows : all);
        const arrow = dir === -1 ? '▼' : '▲';
        const sortLabel =
            sort === 'index' ? 'frontier index' : sort === 'cost' ? 'output price' : sort === 'rel' ? 'release date' : (BENCH_BY_ID[sort] && BENCH_BY_ID[sort].label) || sort;

        const filters = Object.keys(BENCH_BOARDS)
            .map((id) => {
                const b = BENCH_BOARDS[id];
                const on = id === board.id ? ' on' : '';
                return `<button type="button" class="bench-board${on}" onclick="UI.showBenchmarks('board:${id}')">${this._esc(b.label)} <span>${counts[id]}</span></button>`;
            })
            .join('');

        const th = (key, label, title) => {
            const on = sort === key;
            return `<th style="cursor:pointer;${on ? 'color:#4ade80' : ''}" title="${this._esc(title || label)}" onclick="UI.showBenchmarks('${key}')">${this._esc(label)}${on ? ' ' + arrow : ''}</th>`;
        };

        let head = '<th style="text-align:left;position:sticky;left:0;background:var(--sf);z-index:2">Model</th>';
        if (board.id === 'unscored') {
            head += th('rel', 'Released', 'Release date') + '<th>Filed under</th><th>Archive on file</th>';
        } else {
            if (board.id === 'live') head += th('index', 'Index', 'Weighted mean of the hard benches this model has actually published. Needs at least two.');
            board.cols.forEach((k) => {
                const spec = BENCH_BY_ID[k];
                head += th(k, spec.short, spec.label + ' — ' + spec.desc);
            });
            head += th('cost', '$/1M', 'Output price per million tokens');
        }

        const body = rows
            .map((row, rank) => {
                const lab = (typeof LABS !== 'undefined' && LABS[row.m.lab]) || { name: row.m.lab || '', color: '#64748b' };
                const medal = dir === -1 && sort !== 'cost' ? (rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `<span class="bench-rank">${rank + 1}</span>`) : `<span class="bench-rank">${rank + 1}</span>`;
                const edge = rank < 3 && dir === -1 ? `border-left:2px solid ${this._color(lab.color)}` : '';
                let cells = '';
                if (board.id === 'unscored') {
                    const year = row.rel ? this._esc(String(row.rel).slice(0, 10)) : '—';
                    const src = this._esc(row.m._src || 'cloud');
                    const arch = this.present(row.scores).find((s) => s.group === 'archive');
                    const archTxt = arch ? this.fmt(arch, row.scores[arch.id]) + ' ' + arch.short : '—';
                    cells = `<td style="color:var(--t2)">${year}</td><td style="color:var(--t3)">${src}</td><td style="color:var(--t3)">${this._esc(archTxt)}</td>`;
                } else {
                    if (board.id === 'live') {
                        const col = this.tone({ hi: 75, mid: 55 }, row.index);
                        cells += `<td style="color:${col};font-weight:700">${row.index}<div class="bench-cov">${row.n} benches</div></td>`;
                    }
                    board.cols.forEach((k) => {
                        cells += this._cell(row, k);
                    });
                    const price = row.costOut == null ? '—' : '$' + (Math.round(row.costOut * 100) / 100);
                    cells += `<td style="color:#facc15">${price}</td>`;
                }
                return `<tr onclick="UI._openBenchModel('${this._js(row.m.id)}')" style="cursor:pointer;${edge}"><td style="position:sticky;left:0;background:var(--cd);z-index:1"><div class="bench-model">${medal}<div><b>${this._esc(row.m.name)}</b><span style="color:${this._color(lab.color)}">${this._esc(lab.name || row.m.lab || '')}</span></div></div></td>${cells}</tr>`;
            })
            .join('');

        const partial =
            board.id === 'live'
                ? all.filter((r) => r.index == null && r.hardN === 1 && this._matches(r, q))
                : [];
        const chips = partial
            .slice()
            .sort((a, b) => {
                const as = a.scores[this.hardList(a.scores)[0].id];
                const bs = b.scores[this.hardList(b.scores)[0].id];
                return bs - as;
            })
            .slice(0, 18)
            .map((r) => {
                const spec = this.hardList(r.scores)[0];
                return `<button type="button" class="bench-chip" onclick="UI._openBenchModel('${this._js(r.m.id)}')"><b>${this._esc(r.m.name)}</b><span>${this._esc(spec.short)} ${this.fmt(spec, r.scores[spec.id])}</span></button>`;
            })
            .join('');

        const searchVal = this._esc(o.q || '');
        return `<button class="ipanel-x" onclick="document.getElementById('benchOv').classList.remove('open')">✕</button>
<div class="ov-title">📊 BENCHMARK OBSERVATORY</div>
<div class="bench-sub">${rows.length} on this board · sorted by ${this._esc(sortLabel)} ${arrow} · click a column to re-sort</div>
<div class="bench-filters">${filters}</div>
<div class="bench-blurb">${this._esc(board.blurb)}</div>
${cards}
<div class="bench-search-wrap"><input id="benchSearch" class="bench-search" type="text" placeholder="Search name or lab" value="${searchVal}" oninput="UI._benchQuery=this.value;UI._benchFocus=true;UI.showBenchmarks()"></div>
<div class="bench-scroll"><table class="bench-table"><thead><tr>${head}</tr></thead><tbody>${body || '<tr><td colspan="12" style="color:var(--t3);padding:28px">Nothing on this board matches.</td></tr>'}</tbody></table></div>
${chips ? `<div class="bench-side"><div class="bench-side-h">One published score — not enough for the index</div><div class="bench-chips">${chips}${partial.length > 18 ? `<span class="bench-more">+${partial.length - 18} more on the specialist boards</span>` : ''}</div></div>` : ''}
<div class="bench-note">${this._esc(this.sourceLine())}</div>`;
    },

    _cards(rows) {
        if (!rows.length) return '';
        const byIndex = rows.filter((r) => r.index != null).slice().sort((a, b) => b.index - a.index);
        const cards = [];
        if (byIndex.length) {
            const top = byIndex[0];
            const lab = (typeof LABS !== 'undefined' && LABS[top.m.lab]) || { name: top.m.lab };
            cards.push(this._card('👑', '#4ade80', 'Frontier index', top.m.name, (lab.name || top.m.lab) + ' · ' + top.index + ' across ' + top.n + ' benches'));
        }
        const arena = rows
            .filter((r) => typeof r.scores.ELO === 'number' && this.isLive(r.m, 'ELO'))
            .sort((a, b) => b.scores.ELO - a.scores.ELO);
        const arenaFallback = arena.length
            ? arena
            : rows.filter((r) => typeof r.scores.ELO === 'number').sort((a, b) => b.scores.ELO - a.scores.ELO);
        if (arenaFallback.length) {
            const k = arenaFallback[0];
            const lab = (typeof LABS !== 'undefined' && LABS[k.m.lab]) || { name: k.m.lab };
            const tag = arena.length ? 'Arena text' : 'Arena text (stored)';
            cards.push(this._card('⚔️', '#facc15', tag, k.m.name, (lab.name || k.m.lab) + ' · Elo ' + Math.round(k.scores.ELO)));
        }
        const gap = this._separator(rows);
        if (gap) {
            const lab = (typeof LABS !== 'undefined' && LABS[gap.leader.m.lab]) || { name: gap.leader.m.lab };
            cards.push(this._card('🧪', '#f472b6', gap.spec.short + ' still separates', gap.leader.m.name, (lab.name || gap.leader.m.lab) + ' · ' + this.fmt(gap.spec, gap.leader.scores[gap.spec.id]) + ' · p90 ' + this.fmt(gap.spec, gap.p90)));
        }
        const priced = byIndex.slice(0, 8).filter((r) => r.costIn > 0);
        priced.sort((a, b) => a.costIn - b.costIn);
        if (priced.length) {
            const c = priced[0];
            const lab = (typeof LABS !== 'undefined' && LABS[c.m.lab]) || { name: c.m.lab };
            cards.push(this._card('💰', '#22d3ee', 'Best value in the top 8', c.m.name, (lab.name || c.m.lab) + ' · $' + c.costIn + '/1M in'));
        }
        if (!cards.length) return '';
        return `<div class="bench-cards">${cards.join('')}</div>`;
    },

    _card(icon, color, kicker, name, sub) {
        return `<div class="bench-card" style="border-color:${color}33;background:${color}10"><div class="bench-kicker" style="color:${color}">${icon} ${this._esc(kicker)}</div><div class="bench-card-name">${this._esc(name)}</div><div class="bench-card-sub">${this._esc(sub)}</div></div>`;
    },

    _separator(rows) {
        let best = null;
        BENCH_CATALOG.forEach((spec) => {
            if (!spec.hard || spec.scale === 'elo') return;
            const vals = rows.map((r) => r.scores[spec.id]).filter((v) => typeof v === 'number').sort((a, b) => a - b);
            if (vals.length < 8) return;
            const p90 = vals[Math.min(vals.length - 1, Math.floor(vals.length * 0.9))];
            if (!best || p90 < best.p90 - 0.05) {
                const leader = rows.filter((r) => typeof r.scores[spec.id] === 'number').sort((a, b) => b.scores[spec.id] - a.scores[spec.id])[0];
                best = { spec: spec, p90: p90, leader: leader };
            }
        });
        return best && best.leader ? best : null;
    },

    refreshOpen() {
        try {
            const ov = document.getElementById('benchOv');
            if (ov && ov.classList.contains('open') && typeof UI !== 'undefined' && UI.showBenchmarks) UI.showBenchmarks();
            const ip = document.getElementById('infoPanel');
            if (ip && ip.classList.contains('open') && typeof UI !== 'undefined' && UI.selModel) {
                const tab = document.querySelector('.ipanel-tab.active');
                if (tab && /bench/i.test(tab.textContent) && UI.panelTab) UI.panelTab('bench', tab);
            }
        } catch (e) {
            /* panel not on this page */
        }
    },
};

// Kept under the old names so census badges, the AI index, and Kardashev
// read the frontier index instead of a flat mean of saturated 2023 exams.
const BM_M = {};
BENCH_CATALOG.forEach((spec) => {
    BM_M[spec.id] = { l: spec.short, d: spec.desc, c: spec.color };
});

function avgBM(id) {
    const idx = Bench.indexOf(Bench.scoresFor(id));
    return idx ? Math.round(idx.score) : null;
}
