# First Person ↔ 2D parity audit

**Date:** 2026-08-04 · **Against:** `main` @ `2de1529`

The goal is that First Person is the same city as the 2D app, walkable. This
audit compares the two trees system by system and records where they diverge.

---

## Headline

The divergence is **not** a list of small bugs. It has one structural cause:

> The 2D app derives its events from real, sourced, live data. First Person
> mostly **invents** its events with `Math.random()` on a timer.

Concretely — 2D pulls live data in ~20 modules (`api.js`, `space_data.js`,
`datacenter_data.js`, `jail.js`, `court.js`, `conference.js`, `kardashev.js`,
`port_zone.js`, `citizen_of_day.js`, `newspaper.js`, …). First Person issues
network requests from exactly **one** file, `js/store/live.js`, and only for RSS
headlines and a Supabase model/event list.

Everything else in FP that *looks* like a live event is fabricated locally. That
is why the city reads as "completely wrong" rather than merely unfinished: it is
not an incomplete replica, it is a parallel simulation that shares the building
list.

This splits into three categories, and they need different responses.

---

## Status

| | System | State |
|---|---|---|
| A1 | Rockets | **Fixed** — `shared/space_live.js`, commit `b129cb7` |
| A2 | Jail | **Fixed** — `shared/ai_bans.js`, commit `8307005` |
| A3 | Court | Open |
| A4 | Port / supply chain | Open |
| B | Stub interiors | Open |

The pattern for A3/A4 is now established: put the real data behind a module in
`shared/`, have FP import it, and delete the local `Math.random()` path. Keep
cache keys identical to the 2D app's so whichever view loads first warms the
other.

---

## Category A — Fabricated events (actively wrong, fix first)

These don't just lag the 2D city; they assert things that are **false**, with UI
copy that claims they're real.

### A1. Rockets launch at random — the reported symptom

`first-person/js/traffic.js:871-889`

```js
this.nextLaunch -= dt;
if (this.nextLaunch <= 0) {
    const pads = ['pad_spacex', 'pad_blue_origin', /* …7 hardcoded ids… */]
    const pad = pads[Math.floor(Math.random() * pads.length)];
    …
    this.nextLaunch = 60 + Math.random() * 120;
    G.ui?.addToast(`🚀 ${org.name} launch from ${pad.name}!`);
}
```

A rocket fires from a random pad every **60–180 seconds**, forever, and toasts
as though it were a real launch.

The 2D app (`js/space_entities.js:118`, `matchLaunchesToPads`) does the opposite:

- pulls real upcoming launches from `ll.thespacedevs.com` (`js/space_data.js:457`,
  15-minute localStorage cache),
- matches each launch to a pad **by provider org**,
- runs a real state machine per pad: `idle → preparation` (T-5m) `→ countdown`
  (T-1m) `→ ignition → liftoff → ascending → orbit → resetting`,
- toasts at T-5m and T-1m with the actual mission name,
- shows a live `T-…` countdown on the pad.

2D *does* have a `triggerRandomLaunch()` — explicitly commented "for visual
testing / demo". **It is defined and never called.** FP is effectively running
2D's demo function as its production behaviour.

Also: FP's hardcoded pad list has 7 entries; the city has **13** pads. Six pads
never launch anything.

### A2. Citizens are jailed at random

`first-person/js/jail.js:64-78` — the comment says it outright:

```js
// periodic random arrests of "play" act citizens (jailbreak flavor)
if (this._timer > 8) {
    const c = candidates[Math.floor(Math.random() * candidates.length)];
    if (tryArrest(this.state, c)) { /* teleport to jail */ }
}
```

Every **8 seconds** a random citizen is arrested and teleported to the detention
centre.

2D (`js/jail.js:1-23`) detains only models under **real, sourced government
action**, and the header is emphatic about it: bans are jurisdiction-scoped to
the viewer (Netlify geo + timezone fallback), `global` bans show for everyone,
country-scoped bans only for affected visitors, and every rule carries an `until`
date so detainees **walk back out** when a restriction lifts.

So in 2D the jail is a factual statement about AI regulation. In FP it is a
random-number generator. This is the single worst fidelity break in the app.

### A3. Court cases are randomly generated

`first-person/js/court.js:84-85` — random `CASE_TYPE` against a random citizen as
defendant.

2D (`js/court.js:162`) prefers "real regulation news headlines over hardcoded
themes", and carries sourced dockets (e.g. the *Bartz v. Anthropic* entry, kept
current with the actual judgment).

### A4. Supply chain / port shipments are random

`first-person/js/supply_chain.js:91-105` — random destination, random cargo kind,
random manifest, random duration.

2D drives the port from real commodity data (`js/port_zone.js` `COMMODITIES` +
fallback prices).

---

## Category B — Stub interiors

Most interiors were ported as thin dressings. Line counts, with FP's shared kit
(`interiors/kit.js` 509, `rooms.js` 61, `screens.js` 315, `robots.js` 245)
accounted for separately so this isn't a helper artifact:

| Interior | 2D | FP | FP as % of 2D |
|---|---:|---:|---:|
| jail | 1523 | 110 | **7%** |
| court | 1329 | 109 | **8%** |
| metro station | 1701 | 177 | **10%** |
| neon bar | 1471 | 181 | **12%** |
| alignment forest | 1480 | 185 | **12%** |
| press / newspaper | 1265 | 169 | **13%** |
| underground / black market | 1298 | 174 | **13%** |
| legacy museum | 1233 | 174 | **14%** |
| embassy | 1765 | 277 | **16%** |
| backbone / IXP | 909 | 257 | 28% |
| vc row | 1586 | 618 | 39% |
| robotics | 1284 | 760 | 59% |
| longevity | 1409 | 846 | 60% |
| agents | 1048 | 687 | 66% |
| supply chain | 315 | 244 | 77% |

**Totals: FP 7,532 lines vs 2D 34,786 — about 22%.**

Line count is a rough proxy (3D and 2D rendering aren't comparable line-for-line)
but a 7–16% band across nine interiors is too wide to be explained by that. The
metro station in particular — 177 lines against 1,701 — is worth noting given the
train complaints below.

---

## Category C — Ported faithfully (leave alone)

Worth recording so effort isn't wasted re-checking these:

- **Weather** (`first-person/js/weather.js:12`) — same 10 states, same Markov-ish
  transition table, same 5 climate profiles and `sc_climate` localStorage
  override as 2D. Explicitly "matching the production app".
- **Districts / buildings / zoning** — `first-person/js/data.js` mirrors the 2D
  rosters including all 13 launchpads, VC Row, embassy row, worker housing.
- **Day/night, AI index, progress/achievements** — shared through `CityStore`.

---

## The trains and lifts

I drove both systems directly against the running app and **could not reproduce a
JavaScript error** in any path I could reach:

| Path | Result |
|---|---|
| `G.metro.board(0)` → ride → `alight()` | clean; `floorY` −48 → 0, camera restored, 153 hidden objects restored |
| Board from **inside** an interior on floor 3 | clean; interior torn down correctly, no leak |
| `interior.rideElevator(3)` from the car spot | clean; `closing → moving → idle`, lands on floor 3, player re-enabled |

Zero entries in `window.onerror` / `unhandledrejection` across all of it.

What I *did* find:

1. **The metro cabin renders wrong.** Riding shows flat blue slabs and a dark
   void rather than a car interior. Camera placement is correct (eye 12 above
   track, inside the cabin) — so this is the cabin geometry/material, not the
   ride logic. Consistent with the station interior being a 10% port.
2. **`rideElevator` fails silently when you're not at the lift bank** — it
   toasts "Walk to the lift bank to ride" and returns. From a keypress that
   reads as "the lift is broken".
3. **HUD overlap** — the quest tracker overlaps the district/weather readout at
   top-left while riding.

**I need a repro for the errors you saw.** Specifically: were they visible in the
browser console, or did you mean "wrong behaviour"? If console errors, the exact
text or a screenshot of the console would pin them immediately — my API-level
driving may simply not hit the same path as real keyboard/pointer-lock input.

---

## Suggested order of work

1. **A1 rockets** — delete the random launcher; port `matchLaunchesToPads` and
   the per-pad state machine, driven by `SpaceData`. Covers all 13 pads.
2. **A2 jail** — delete random arrests; port the sourced ban rules, jurisdiction
   scoping and `until` expiry.
3. **A3 court**, **A4 port/supply chain** — same treatment.
4. **Metro cabin visuals** + the two lift UX papercuts above.
5. **Category B interiors**, worst ratio first (jail, court, metro, bar).

Steps 1–3 share a shape: FP needs to read the same live data 2D already fetches,
rather than re-deriving it. Worth building that bridge once — a shared data
module both apps read — instead of three times.

**Not started.** This document is the audit only; no fixes applied.
