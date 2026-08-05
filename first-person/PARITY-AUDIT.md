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
| A3 | Court | **Fixed** — `shared/ai_docket.js`, commit `c45dca1` |
| A4 | Port / supply chain | **Fixed** — `shared/port_prices.js`, commit `c45dca1` |
| A5 | Schedule / entity placement | **Fixed** — `shared/schedule.js`, commits `6464b2d`, `72829ce` |
| B | Stub interiors | Open — see below |
| — | 2D reads the shared **schedule** | **Done** — `72829ce` |
| — | 2D reads the other four shared modules | Open — see below |

**Category A is closed.** No First Person system now fabricates an event that
claims to be real. The four `shared/` modules are the source of truth and FP
reads them; cache keys are identical to the 2D app's, so whichever view a
visitor opens first warms the other.

### The remaining structural debt

The **schedule** is now read by both views — that was the one with real parity
impact, since it decides where every model and founder stands at every moment.
`js/shared_boot.js` is the bridge, and the pattern is established.

The other four modules (`space_live`, `ai_bans`, `ai_docket`, `port_prices`) are
loaded into `window.SC_SHARED` and read by First Person, but the 2D app still
runs its own copies of those systems. They will drift — the docket moves
whenever a case does. Each is the same small change `getAct` took:

```js
const shared = window.SC_SHARED && window.SC_SHARED.aiDocket;
if (shared) return shared.something(...);
// existing body stays as the fallback
```

Lower urgency than the schedule was: those systems agree on data today, they
just derive it twice.

**When switching one over, prove it changed nothing** the way `72829ce` did —
sweep the delegated function against the retained local copy across seeds and
inputs and assert zero differences. Neutralise anything internally random first
(`Personality.getBuildingBias` has a 22% gate) or the comparison is noise.

### On "total parity" for Category B

Category B is not a bug class, it is missing content: roughly 27,000 lines of
2D interior work that has no First Person equivalent, and it cannot be resolved
by pointing FP at shared data. Each interior is bespoke 3D modelling and
scripting. Treat it as a content programme measured in sessions per interior,
worst ratio first (jail 7%, court 8%, metro 10%, bar 12%), not as a fix.

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
| jail | 1523 | ~~110~~ 279 | ~~7%~~ **18%** — rebuilt |
| court | 1329 | ~~109~~ 301 | ~~8%~~ **23%** — rebuilt |
| metro station | 1701 | ~~177~~ 353 | ~~10%~~ **21%** — rebuilt |
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

**Totals: FP 8,069 lines vs 2D 34,786 — about 23%.**

Line count is a rough proxy (3D and 2D rendering aren't comparable line-for-line)
but a 7–16% band across nine interiors is too wide to be explained by that.

**Jail, court and the metro station are done.** All three were falling through
to the generic themed room; all three are now bespoke multi-floor specs under
`js/interiors/`, matching the level structure of the 2D module they came from
(jail: intake / block A / block B / control / solitary; court: rotunda /
chamber / gallery / chambers, branching between the Senate hearing room and the
trial court; metro: ticket hall / platform, with a train that arrives). Each
reads the same live data the 2D city does — real detainees under real ban
orders, the real docket — rather than inventing occupants.

### The real gap was not props — it was people

Every FP interior was **staff-only**. `citizens.js` has always tracked who went
where (`c.targetBid`); nothing read it. You walked into a lab HQ at 11am and
found one receptionist while 80 models were logged as working in it, and the 2D
module you were comparing against has always drawn its real visitors.

`ctx.occupants(spots)` closes that for EVERY interior, not just the rebuilt
ones: a room supplies the places a person can be (a bar stool, a reporter's
desk, a gallery bench, a cell) and the citizens actually in the building fill
them, founders first. Past the end of the spot list nothing is drawn — a room
never invents a body it has nowhere to put. Rooms with no plan of their own get
a collision-aware scatter.

Occupancy is "arrived at this venue", **not** `c.indoors`. That flag is a street
rendering optimisation, and `INDOOR_ACTS` deliberately excludes `socialize` —
so filtering on it meant the Neon Bar could never show a patron.

### …and a schedule bug that emptied the whole city

Wiring the above up immediately showed 645 of 700 models in one bar and nobody
anywhere else. `shared/schedule.js` buckets with `(seed * 17) % 100 < N`, which
only spreads over 0–99 for an INTEGER seed — 2D passes `G.models.indexOf(m)`,
the parity test passes 0,1,2,3. FP passed `c.seed`, a float in [0,1), so `s`
never left [0,17) and every threshold above 17 fired for every model.

It also silently defeated the shared module's whole purpose: the two views were
placing the same model in different buildings. Fixed. The city now spreads —
lunch: cafe 246 / central park 76 / park 66 / gym 37 / library 32; 15:36: open
square 129; evening: arena 95 / park 81 / bar 79.

Bar, newsroom, underground, museum, alignment cabins and embassy all place
their occupants at spots that mean something. What remains for those six is
prop density, not structure — and line count is a poor proxy for it, since most
of the 2D bulk is Pixi drawing boilerplate with no 3D equivalent.

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

1. ~~**The metro cabin renders wrong.**~~ **FIXED.** Three causes, all closed:
   the cabin was a 78×30×34 crate with its window band ABOVE the eye (windows
   12.5–23.5, eye 12) so you rode looking at wall; nothing lit it or the tunnel,
   because the renderer runs `useLegacyLights = false` and every point light in
   the app is sized for the old model (a light of intensity 0.65 delivers 0.0004
   at 40 units); and the platform had a track bed no train ever ran on. The
   cabin is now a full carriage with seats, poles and straps, the bore is lit
   and 78 wide, and a train pulls in, opens its doors and leaves.
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
4. ~~**Metro cabin visuals**~~ — done. The two lift UX papercuts above stand.
5. **Category B interiors**, worst ratio first — jail, court and metro are
   done; bar, alignment, press, underground, legacy and embassy remain.

Steps 1–3 share a shape: FP needs to read the same live data 2D already fetches,
rather than re-deriving it. Worth building that bridge once — a shared data
module both apps read — instead of three times.

**Category A closed. Category B partly closed** — jail, court and the metro
station are rebuilt; bar, alignment, press, underground, legacy and embassy
remain thin on props.

**The bigger parity gaps found since this audit was written were not about
props at all**, and are now closed:

- FP invented ~600 of its 700 citizens; it now reads the real 1,198-model
  roster and all 20 founders from the same Supabase the 2D city uses.
- FP passed a float where `shared/schedule.js` wanted an integer seed, so
  every percentage bucket misfired and the whole city went to one venue.
- FP modelled 7 of the 20 curated labs; the other 13 now have districts.
- Interiors showed only staff; they now show the real occupants, moving.
