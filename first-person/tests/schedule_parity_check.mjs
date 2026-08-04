/**
 * Schedule parity — First Person must put a model in the same place, at the
 * same time, as the 2D city.
 *
 * The two apps each carried their own getAct and had drifted: different wake-up
 * thresholds, different lunch splits, a park with two different ids, campus
 * stages routed to different buildings, and founders sleeping in worker housing
 * instead of their own estates. Both now call shared/schedule.js.
 *
 * This pins the reference behaviour so the copies can't silently diverge again.
 * The expectations below are the 2D city's, read from js/data.js getAct.
 *
 * Run: node first-person/tests/schedule_parity_check.mjs
 */
import { getAct, getFounderAct } from '../../shared/schedule.js';

let fail = 0;
const log = [];
function assert(cond, msg) {
    log.push((cond ? 'ok:   ' : 'FAIL: ') + msg);
    if (!cond) fail++;
}

// A context mirroring the 2D city: every building exists, no aliases.
const CTX = {
    labs: { openai: { region: 'us' }, mistral: { region: 'eu' }, nolab: {} },
    labHQ: { openai: 'openai_hq', mistral: 'mistral_hq' },
    defaultRegion: 'eu',
    hasBld: () => true,
    bid: (id) => id,
    isSummoned: () => false,
    conferenceActive: () => false,
    goalOverride: () => null,
    personalityBias: () => null,
    hackathonLab: null,
    isWeekend: false,
    isUnderground: () => false
};

const M = (over = {}) => ({ id: 'm1', name: 'Test', lab: 'openai', os: false, ...over });

/* ── Region fallback ─────────────────────────────────────────────────────────
   The single most widespread divergence: FP defaulted to 'us', 2D to 'eu', so
   every model whose lab declares no region slept in a different district. */
assert(getAct('adult', 0.05, 0, M({ lab: 'nolab' }), CTX).bid === 'res_eu',
    'region-less lab falls back to EU residence (2D behaviour, not US)');
assert(getAct('adult', 0.05, 0, M({ lab: 'openai' }), CTX).bid === 'res_us',
    'US lab sleeps in the US residence');

/* ── Weekday timeline ───────────────────────────────────────────────────────
   Boundaries are 2D's. FP had moved deep-sleep to 0.25 and the leave window to
   0.26+, so the whole city woke up and commuted late relative to the 2D view. */
assert(getAct('adult', 0.19, 0, M(), CTX).act === 'sleep', 'deep sleep runs to dp 0.2');
// seed 0 → s = 0 → leaveTime = 0.22. Just before: still asleep. Just after: commuting.
assert(getAct('adult', 0.215, 0, M(), CTX).act === 'sleep', 'still asleep before the 0.22 leave time');
assert(getAct('adult', 0.23, 0, M(), CTX).act === 'commute', 'commuting once past the leave time');
assert(getAct('adult', 0.4, 0, M(), CTX).act === 'work', 'morning work block at dp 0.4');
assert(getAct('adult', 0.4, 0, M(), CTX).bid === null, 'morning work resolves to the HQ (bid null)');
assert(getAct('adult', 0.52, 0, M(), CTX).act === 'lunch', 'lunch window opens at 0.5');
assert(getAct('adult', 0.6, 0, M(), CTX).act === 'work', 'afternoon work block at dp 0.6');

/* Lunch split — 2D's thresholds are 45/60/70. FP had 44/62/74. */
assert(getAct('adult', 0.52, 0, M(), CTX).bid === 'cafe', 's<45 goes to the cafe');
// s = (seed*17)%100; seed 3 → 51 → park
assert(getAct('adult', 0.52, 3, M(), CTX).bid === 'park', 's 45..60 goes to the park');
// seed 4 → 68 → city_park
assert(getAct('adult', 0.52, 4, M(), CTX).bid === 'city_park', 's 60..70 goes to the city park');

/* ── The park id ────────────────────────────────────────────────────────────
   2D calls it city_park; FP declares it central_park. The schedule emits the
   2D vocabulary and each view aliases it, so this must stay canonical here. */
const aliased = getAct('adult', 0.52, 4, M(), { ...CTX, bid: (id) => (id === 'city_park' ? 'central_park' : id) });
assert(aliased.bid === 'central_park', 'a view can alias city_park onto its own id');

/* ── Campus stages ──────────────────────────────────────────────────────────
   FP had invented its own routing here: babies to nursery/uni_library, kids to
   the gym. 2D sends babies to uni_dorm and kids to uni_main. */
assert(getAct('baby', 0.5, 1, M(), CTX).bid === 'uni_dorm', 'babies work at the dorm, not a nursery');
assert(getAct('kid', 0.5, 1, M(), CTX).bid === 'uni_main', 'kids train at the academy, not the gym');
assert(getAct('kid', 0.5, 1, M(), CTX).act === 'train', 'kid activity is train');
assert(getAct('rumored', 0.5, 1, M(), CTX).bid === 'uni_lab', 'pre-release models work in the lab');
assert(getAct('retired', 0.5, 1, M(), CTX).bid === 'graveyard', 'retired models rest in the graveyard');

/* Campus stages fall back to the regional residence when there is no campus. */
const noUni = { ...CTX, hasBld: (id) => id !== 'uni_main' };
assert(getAct('baby', 0.9, 1, M(), noUni).bid === 'res_us', 'no campus → baby sleeps at home');

/* ── Overrides, in precedence order ─────────────────────────────────────────
   A detention outranks a subpoena outranks the ordinary day. FP honoured none
   of the middle tier before this. */
assert(getAct('adult', 0.4, 0, M({ _jailed: true }), CTX).bid === 'ai_jail',
    'a detained model is held regardless of the hour');
assert(getAct('adult', 0.05, 0, M({ _jailed: true }), CTX).act === 'jailed',
    'detention overrides sleep');
assert(getAct('adult', 0.05, 0, M(), { ...CTX, isSummoned: () => true }).bid === 'court_hearing',
    'a subpoena overrides sleep — no day-phase gate');
assert(getAct('adult', 0.4, 0, M({ _jailed: true }), { ...CTX, isSummoned: () => true }).bid === 'ai_jail',
    'detention outranks a subpoena');

/* Conference: 15% of adults, work hours only. seed 0 → (0*7)%100 = 0 < 15. */
assert(getAct('adult', 0.4, 0, M(), { ...CTX, conferenceActive: () => true }).bid === 'convention_center',
    'conference pulls a slice of adults during work hours');
assert(getAct('adult', 0.05, 0, M(), { ...CTX, conferenceActive: () => true }).act === 'sleep',
    'conference does not run outside work hours');

/* Lifestyle archetypes preempt the default day but not the event overrides. */
const goalCtx = { ...CTX, goalOverride: () => ({ act: 'sleep', bid: null }) };
assert(getAct('adult', 0.4, 0, M(), goalCtx).bid === 'res_us',
    'a goal override with no bid resolves to the home residence');
assert(getAct('adult', 0.4, 0, M(), { ...goalCtx, isSummoned: () => true }).bid === 'court_hearing',
    'a subpoena still preempts a lifestyle archetype');

/* Personality bias steers the venue without changing the act. */
const biasCtx = { ...CTX, personalityBias: (m, kind) => (kind === 'lunch' ? 'gym' : null) };
assert(getAct('adult', 0.52, 0, M(), biasCtx).bid === 'gym', 'trait bias picks the lunch venue');
assert(getAct('adult', 0.52, 0, M(), biasCtx).act === 'lunch', 'trait bias keeps the act');

/* ── Weekend ────────────────────────────────────────────────────────────────
   2D's thresholds are 15/30/45/60/75/88; FP had 14/28/42/58/72/86. */
const wk = { ...CTX, isWeekend: true };
assert(getAct('adult', 0.2, 0, M(), wk).act === 'sleep', 'weekend lie-in until 0.35');
assert(getAct('adult', 0.5, 0, M(), wk).act === 'play', 's<15 plays at home');
// Weekend bands differ from the weekday lunch split: 15/30/45/60/75/88.
// seed 1 → s = 17 (park), seed 2 → s = 34 (city_park).
assert(getAct('adult', 0.5, 1, M(), wk).bid === 'park', 's 15..30 goes to the park');
assert(getAct('adult', 0.5, 2, M(), wk).bid === 'city_park', 's 30..45 goes to the city park');
assert(getAct('adult', 0.5, 3, M(), wk).bid === 'cafe', 's 45..60 goes to the cafe');
assert(getAct('adult', 0.5, 4, M(), wk).bid === 'arena', 's 60..75 goes to the arena');
assert(getAct('adult', 0.5, 0, M(), wk).bid === 'res_us', 'weekend play happens at home');

/* Weekend open-source share only fires for os models. */
// seed 5 → s = 85 → in the 75..88 band
assert(getAct('adult', 0.5, 5, M({ os: true }), wk).act === 'share', 'os models share at the weekend');
assert(getAct('adult', 0.5, 5, M({ os: false }), wk).act === 'train', 'closed models hit the gym instead');

/* ── Underground ────────────────────────────────────────────────────────────
   Must NOT fire in the deep-night window — that produced ghost commuters. */
const ug = { ...CTX, isUnderground: () => true };
assert(getAct('adult', 0.75, 0, M(), ug).bid === 'black_market', 'underground models drift downstairs after dark');
assert(getAct('adult', 0.05, 0, M(), ug).act === 'sleep', 'underground models still sleep at 01:00');

/* ── Founders ───────────────────────────────────────────────────────────────
   The bug this test exists for: FP built all six Billionaire's Row estates and
   then sent every founder home to a generic regional block instead. */
const f = M({ lab: 'openai' });
assert(getFounderAct(0.05, 0, f, CTX).bid === 'house_openai',
    'a founder sleeps in their OWN estate, not worker housing');
assert(getFounderAct(0.92, 0, f, CTX).bid === 'house_openai',
    'a founder commutes home to their estate');
assert(getFounderAct(0.4, 0, f, CTX).bid === 'openai_hq', 'a founder works at their own HQ');
// A founder whose lab has no estate on the Row falls back to the region.
const noEstate = { ...CTX, hasBld: (id) => !id.startsWith('house_') };
assert(getFounderAct(0.05, 0, f, noEstate).bid === 'res_us',
    'no estate on the Row → founder falls back to the regional residence');

/* ── Determinism ────────────────────────────────────────────────────────────
   Same inputs must give the same answer, or the two views drift apart even
   while sharing this module. */
let stable = true;
for (let i = 0; i < 200; i++) {
    const dp = i / 200;
    const a = JSON.stringify(getAct('adult', dp, 7, M(), CTX));
    const b = JSON.stringify(getAct('adult', dp, 7, M(), CTX));
    if (a !== b) { stable = false; break; }
}
assert(stable, 'schedule is deterministic across a full-day sweep');

/* Every point in the day must yield a real act — no gaps between branches. */
let covered = true;
for (let i = 0; i <= 1000; i++) {
    const r = getAct('adult', i / 1000, i % 97, M(), CTX);
    if (!r || typeof r.act !== 'string' || !r.act) { covered = false; break; }
}
assert(covered, 'every dp in 0..1 resolves to an act');

console.log(log.join('\n'));
console.log(fail ? `\nFAILED ${fail}` : `\nschedule_parity_check: OK (${log.length} assertions)`);
process.exit(fail ? 1 : 0);
