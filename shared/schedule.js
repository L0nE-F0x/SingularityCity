/* ════════════════════════════════════════════════════════════════════════════
   SHARED — the daily schedule. Where every model and founder is, at any time.

   THIS IS THE SOURCE OF TRUTH for both views. It exists because the two apps
   had each drifted their own copy of getAct, so the same model at the same
   moment stood in different places depending on which view you opened. Every
   threshold had moved a little, the parks had different ids, and each app had
   grown overrides the other lacked.

   The 2D city is the reference. Where the two disagreed, 2D's behaviour wins —
   First Person is meant to be that city, walkable.

   ── Dependency injection ──────────────────────────────────────────────────
   The 2D app is classic scripts reading globals (G, LABS, CourtData, Goals,
   Personality…); First Person is ESM with its own module state. Rather than
   pick one and break the other, both pass a `ctx`:

     labs             { [lab]: { region } }
     labHQ            { [lab]: buildingId }
     defaultRegion    region when a lab declares none        ('eu' — 2D's value)
     hasBld(id)       does this building exist in this view
     bid(id)          resolve a canonical id to this view's id (park aliases)
     isSummoned(id)   model is under subpoena → Hearing Chamber, any hour
     conferenceActive()
     goalOverride(model, dp, stg)      lifestyle archetypes (~20% of adults)
     personalityBias(model, kind, dp)  trait-driven venue pick
     hackathonLab     lab pulling an all-nighter today, or null
     isWeekend
     isUnderground(model)

   Anything a view can't supply may be omitted — the defaults below no-op, which
   degrades to the plain schedule rather than throwing.

   ── Day phase ─────────────────────────────────────────────────────────────
   dp is 0..1 across the day. 0.5 = noon. The comments give clock times.
   ════════════════════════════════════════════════════════════════════════════ */

const NO_CTX = {
    labs: {},
    labHQ: {},
    defaultRegion: 'eu',
    hasBld: () => true,
    bid: (id) => id,
    isSummoned: () => false,
    conferenceActive: () => false,
    goalOverride: () => null,
    personalityBias: () => null,
    hackathonLab: null,
    isWeekend: false,
    isUnderground: (m) => !!(m && m._underground)
};

function withDefaults(ctx) {
    return ctx ? { ...NO_CTX, ...ctx } : NO_CTX;
}

/**
 * Where is this model, and what is it doing?
 * @returns {{act:string, bid:string|null, _commuting?:boolean}}
 */
export function getAct(stg, dp, seed, model, ctx) {
    const c = withDefaults(ctx);
    const B = c.bid;

    const region = (c.labs[model.lab] && c.labs[model.lab].region) || c.defaultRegion;
    const resId = 'res_' + region;

    if (stg === 'retired') return { act: 'sleep', bid: B('graveyard') };

    // Detention outranks everything — school, work, a subpoena. A ban does not
    // keep office hours. Driven by the real ban rules in shared/ai_bans.js.
    if (model._jailed && c.hasBld('ai_jail')) return { act: 'jailed', bid: B('ai_jail') };

    // ── Pre-release cohort lives on campus ────────────────────────────────
    // A slice takes a midday field trip to the Legacy Systems museum so the
    // cohort isn't permanently pinned to one lecture hall.
    const hasUni = c.hasBld('uni_main');
    const hasMuseum = c.hasBld('bld_1');
    const trip = (seed * 13) % 100;

    if (stg === 'rumored') {
        if (dp > 0.2 && dp < 0.8) {
            if (hasMuseum && dp > 0.4 && dp < 0.6 && trip < 12) return { act: 'socialize', bid: B('bld_1') };
            return { act: 'work', bid: hasUni ? B('uni_lab') : null };
        }
        return { act: 'sleep', bid: hasUni ? B('uni_dorm') : B(resId) };
    }
    if (stg === 'baby') {
        if (dp > 0.35 && dp < 0.8) {
            if (hasMuseum && dp > 0.45 && dp < 0.65 && trip < 12) return { act: 'socialize', bid: B('bld_1') };
            return { act: 'work', bid: B('uni_dorm') };
        }
        return { act: 'sleep', bid: hasUni ? B('uni_dorm') : B(resId) };
    }
    if (stg === 'kid') {
        if (dp > 0.35 && dp < 0.9) {
            if (hasMuseum && dp > 0.45 && dp < 0.6 && trip < 10) return { act: 'socialize', bid: B('bld_1') };
            return { act: 'train', bid: B('uni_main') };
        }
        return { act: 'sleep', bid: hasUni ? B('uni_dorm') : B(resId) };
    }

    // ── Subpoena: no day-phase gate, a summons overrides sleep and lunch ──
    if (c.isSummoned(model.id)) return { act: 'work', bid: B('court_hearing') };

    // ── Conference: 15% of adults attend during work hours ────────────────
    if (c.conferenceActive() && dp > 0.35 && dp < 0.75 && (seed * 7) % 100 < 15) {
        return { act: 'work', bid: B('convention_center') };
    }

    const s = (seed * 17) % 100;

    // ── Hackathon: today's lab works the graveyard shift ──────────────────
    if (c.hackathonLab && model.lab === c.hackathonLab && (dp < 0.2 || dp >= 0.95)) {
        if (s < 30) return { act: 'lunch', bid: B('cafe') };
        return { act: 'work', bid: null };
    }

    // ── Underground models drift to the Black Market after dark ───────────
    // No early-morning branch: even jailbroken weights sleep in the deep-night
    // window. Keeping 40% of them out until 03:36 piled ghost commuters around
    // the park on the way home (2D v338).
    if (c.isUnderground(model) && c.hasBld('black_market')) {
        if (dp >= 0.72 && dp < 0.8 && s < 20) return { act: 'nightlife', bid: B('black_market') };
        if (dp >= 0.8 && dp < 0.94 && s < 40) return { act: 'nightlife', bid: B('black_market') };
    }

    // ── Lifestyle archetypes (~20% of adults) ─────────────────────────────
    // After the event overrides above so a subpoena still preempts a routine,
    // before the default schedule so archetypes ignore per-phase randomisation.
    const goal = c.goalOverride(model, dp, stg);
    if (goal) {
        if ((goal.act === 'sleep' || goal.act === 'commute') && !goal.bid) goal.bid = B(resId);
        return goal;
    }

    // ── Weekend: no commute, no HQ — the city goes outside ────────────────
    if (c.isWeekend) {
        if (dp < 0.35 || dp > 0.9) return { act: 'sleep', bid: B(resId) };
        if (s < 15) return { act: 'play', bid: B(resId) };
        if (s < 30) return { act: 'socialize', bid: B('park') };
        if (s < 45) return { act: 'socialize', bid: B('city_park') };
        if (s < 60) return { act: 'lunch', bid: B('cafe') };
        if (s < 75) return { act: 'arena', bid: B('arena') };
        if (s < 88 && model.os) return { act: 'share', bid: B('open_square') };
        return { act: 'train', bid: B('gym') };
    }

    // ═══ WEEKDAY ═══

    // 00:00–04:48 deep sleep
    if (dp < 0.2) return { act: 'sleep', bid: B(resId) };

    // 04:48–08:24 staggered wake → commute (a wave, not a teleport)
    if (dp < 0.35) {
        const leaveTime = 0.22 + (s / 100) * 0.1;
        if (dp < leaveTime) return { act: 'sleep', bid: B(resId) };
        return { act: 'commute', bid: null, _commuting: true };
    }

    // 08:24–12:00 morning work
    if (dp < 0.5) return { act: 'work', bid: null };

    // 12:00–13:30 lunch — personality biased
    if (dp < 0.5625) {
        const traitBid = c.personalityBias(model, 'lunch', dp);
        if (traitBid) return { act: 'lunch', bid: B(traitBid) };
        if (s < 45) return { act: 'lunch', bid: B('cafe') };
        if (s < 60) return { act: 'socialize', bid: B('park') };
        if (s < 70) return { act: 'socialize', bid: B('city_park') };
        return { act: 'work', bid: null };
    }

    // 13:30–15:36 afternoon work
    if (dp < 0.65) return { act: 'work', bid: null };

    // 15:36–17:17 open-source devs share, some step out
    if (dp < 0.72) {
        if (model.os && s < 30) return { act: 'share', bid: B('open_square') };
        if (s < 15) return { act: 'socialize', bid: B(s % 2 === 0 ? 'park' : 'city_park') };
        return { act: 'work', bid: null };
    }

    // 17:17–19:12 evening wind-down, staggered early leavers
    if (dp < 0.8) {
        const traitBid = c.personalityBias(model, 'play', dp);
        if (traitBid) return { act: s < 50 ? 'arena' : 'socialize', bid: B(traitBid) };
        if (s < 18) return { act: 'arena', bid: B('arena') };
        if (s < 32) return { act: 'socialize', bid: B('park') };
        if (s < 44) return { act: 'socialize', bid: B('city_park') };
        if (s < 55) return { act: 'nightlife', bid: B('neon_bar') };
        const earlyLeave = 0.72 + (s / 100) * 0.08;
        if (dp >= earlyLeave) return { act: 'commute', bid: B(resId) };
        return { act: 'work', bid: null };
    }

    // 19:12–22:48 staggered departure; ~20% hit the bar first
    if (dp < 0.95) {
        const goHomeTime = 0.8 + (s / 100) * 0.08;
        if (dp < goHomeTime) return { act: 'work', bid: null };
        if (s < 20) return { act: 'nightlife', bid: B('neon_bar') };
        return { act: 'commute', bid: B(resId) };
    }

    // 22:48–00:00 stragglers still out
    if (s < 10) return { act: 'nightlife', bid: B('neon_bar') };
    return { act: 'sleep', bid: B(resId) };
}

/**
 * Founders keep their own hours and, crucially, go home to their OWN house on
 * Billionaire's Row — not to a generic regional block. First Person had built
 * all six estates and then never routed anyone to them, so the Row sat empty
 * while its residents slept in worker housing.
 */
export function getFounderAct(dp, seed, model, ctx) {
    const c = withDefaults(ctx);
    const B = c.bid;

    const estateId = 'house_' + model.lab;
    const region = (c.labs[model.lab] && c.labs[model.lab].region) || c.defaultRegion;
    // Their estate if the Row has one for this lab; otherwise the regional block.
    const homeId = c.hasBld(estateId) ? estateId : 'res_' + region;
    const hq = c.labHQ[model.lab] || 'open_square';
    const s = (seed * 31) % 100;

    if (dp < 0.22) return { act: 'sleep', bid: B(homeId) };
    if (dp < 0.30) return { act: 'commute', bid: B(hq) };
    if (dp < 0.46) return { act: 'work', bid: B(hq) };
    if (dp < 0.56) {
        if (s < 45) return { act: 'lunch', bid: B('cafe') };
        if (s < 75) return { act: 'socialize', bid: B('park') };
        return { act: 'work', bid: B(hq) };
    }
    if (dp < 0.68) return { act: 'work', bid: B(hq) };
    if (dp < 0.78) {
        if (s < 30) return { act: 'socialize', bid: B('open_square') };
        if (s < 50) return { act: 'arena', bid: B('arena') };
        return { act: 'work', bid: B(hq) };
    }
    if (dp < 0.88) {
        if (s < 40) return { act: 'socialize', bid: B('neon_bar') };
        if (s < 60) return { act: 'socialize', bid: B('park') };
        return { act: 'work', bid: B(hq) };
    }
    if (dp < 0.94) return { act: 'commute', bid: B(homeId) };
    return { act: 'sleep', bid: B(homeId) };
}
