# Resume here

**Updated:** 2026-08-05 · **Live:** `main` on singularitycity.net
**Last session:** FP polish pass — the owner's playtest list.

---

## What just shipped

The playtest notes, worked top to bottom. Each item was verified in the browser,
not just written.

### The landing page entered the city on its own

Reported as "as soon as I get into the main screen it doesn't wait for me to
click the buttons". Root cause: the view-handoff token (`sc_view_resume_v1`) is
**mirrored into localStorage** so a hard swap between the two apps can't lose
it — but only the sessionStorage copy was ever cleared. After one FP→2D round
trip the localStorage copy survived forever and replayed `enterCity()` on every
later visit.

Both sides now clear both copies, and ignore any token older than two minutes.
Verified in both directions: a 3-hour-old token leaves you on the landing page
and is purged; a fresh one still auto-enters.

> **If you add another cross-view key, clear it in BOTH stores.** This is the
> second bug of exactly this shape.

### Helicopter rotors — and a whole bug class behind them

`mergeByMaterial()` bakes every child transform into one buffer and returns a
**brand-new group**. The helicopter's rotor pivot and the `userData.rotor`
handle that drives it were both thrown away, so `userData.rotor.rotation.y +=`
read `undefined` every frame and the blades were welded on.

Merging the rotors separately fixes the blades. But the same fault was silently
eating other things:

- every VIP limo lost its floating founder name plate (a `Sprite` is not
  `isMesh`, so the merge never collected it)
- the limo's 1.55x stretch was being cancelled (the group's own transform was
  dropped)
- `userData.paintM` / `headLampMat` on the cars came back undefined

`mergeByMaterial` now carries userData, non-mesh children and the group
transform across. **New vehicle builders still go through it** — it is the
reason a car is 4 draw calls and not 44.

### Streets

Furniture laid out along one road ran straight through every crossing road,
where the pavement is deliberately cut away — so lamp posts and hydrants stood
in the middle of junctions with their light pools spilling over the asphalt.
The ring-road utility poles were worse: `City.ringX` is the road's
**centreline**, so they were planted down the middle of the carriageway for the
whole length of the city.

New guard: `City.clearOfCrossRoads(x, z, alongVertical, pad)`. Only roads
*perpendicular* to the run can cross it, so a lamp beside an avenue is tested
against the streets and never against its own avenue. Applied to lamps,
hydrants, benches and both pole runs. Verified: 0 of 208 lamp instances and 0 of
44 hydrants sit on tarmac. (Manhole covers still do, on purpose.)

Also: the glowing white orbs hanging over the road were **steam particles**.
`gl_PointSize` had no ceiling and the distance clamp bottomed out at 40, so one
vent puff rendered at ~800px, additively. Capped, and near-faded so you cannot
walk inside one.

### The Nvidia truck drove through buildings

Its route joined each stop's nearest intersection with a single straight
segment. Two intersections almost never share a row or a column, so that
segment cut diagonally across whole blocks. `Traffic._gridRoute()` now builds
Manhattan legs over the road grid, in lane, with eased corners and an
axis-aligned closing leg. Verified: 500 samples around the full loop, zero
inside any building collider, zero diagonal legs.

### The harbour

The two "ships" were box slabs parked in open water several hundred units north
of the port, animated only by a 0.02 rad rock. Replaced with `js/ships.js`:
real hulls (tapered bow, bulbous forefoot, boot-topping, accommodation block,
funnel, nav lights) and a state machine —

    AWAY -> INBOUND -> BERTHING -> UNLOADING -> DEPARTING -> AWAY

They sail up the coast, berth alongside, and discharge the deck stack one
container at a time through a ship-to-shore gantry onto the quay. The delivery
that lands is the one `SupplyChain` already feeds to the datacentres, so
"ships dock, stock rises" is finally something you can stand and watch.

> The coastal ring road runs 30 units inland of the waterline. The gantry legs
> and the container yard both had to go **east** of its far pavement or they
> stand in the road. `_berth()` documents the offsets.

### The metro

The big one. "Too boxed in and close, it really doesn't look like I'm riding a
train" had three separate causes:

1. **The cabin was a crate with the view above your head.** 78x30x34, window
   band 12.5-23.5, eye at 12 — you rode with your eyes on the sill. It is now a
   168x44x40 carriage with longitudinal benches, grab poles, ceiling rails with
   hanging straps, standing passengers, and an eye height matching `EYE_H`.
2. **Nothing lit any of it.** The renderer runs `useLegacyLights = false`, so
   point lights fall off as `intensity / distance²`. At the 0.65 the tunnel
   lights carried, a wall 40 units away received **0.0004**. The bore and the
   cabin were lit purely by ambient — which is why the window was a black
   rectangle with nothing to look out at.

   > **Every other point light in this app is still sized for the old model.**
   > If you add one and it does nothing, this is why. Think in hundreds.

3. **The platform had a track bed no train ever ran on.** There is now a train
   that runs in from the tunnel mouth, stops, slides its doors open on real
   door apertures, holds, shuts them and pulls out — driven by
   `Metro.trainAtStop`, the same fact that decides whether `E` can board, so
   the doors being open and the train being boardable can never disagree.

Alighting now puts you on the destination station's **platform**, not the
street outside it. Lift down, train in, ride, step off, lift up.

Supporting: `Interior` gained `ctx.animate()` — the first way for anything in a
room to move, since every other prop is baked into a static merge — and
`Interior.enter()` takes a floor.

### Interiors: jail and court

The two worst entries in the parity audit (7% and 8%) were falling through to
the generic themed room. Both are now bespoke multi-floor specs matching the
level structure of their 2D modules:

- **AI Detention Center** — intake, blocks A and B, control room, solitary.
  Cells show the **real** detainees from `shared/ai_bans.js`, each with the
  issuing authority and order on its card. An empty block is the correct answer
  when your jurisdiction bans nothing; nothing pads the roster.
- **AI Court** — rotunda with the live docket board, chamber, public gallery,
  chambers with the law library. `court_senate` gets a curved members' dais,
  `court_hearing` gets a bench, jury box and counsel tables — the same split
  the 2D module makes.

---

## Pick up here

### 1. Owner playtest again
Everything below is lower priority than notes from a real playthrough.

### 2. Category B interiors — six left
Jail, court and the metro station are done. Still in the 12–16% band, worst
first: **bar, alignment forest, press, underground, legacy museum, embassy**.
Each is a session. See [`first-person/PARITY-AUDIT.md`](first-person/PARITY-AUDIT.md).

The pattern is now established — copy `js/interiors/jail.js`: a spec with
per-floor `build(ctx)`, staff that rotate on `ctx.night`, and **live data read
from the same shared module the 2D city uses**, never invented.

### 3. Switch 2D onto the other four shared modules
`space_live`, `ai_bans`, `ai_docket`, `port_prices` are loaded into `SC_SHARED`
and read by FP, but 2D still runs its own copies. They agree on data today, they
just derive it twice — the docket will drift as cases move. Same small change as
`getAct` took. **Prove it changed nothing** the way `72829ce` did.

### 4. Founder movement
Homes match, but 2D drives CEOs through a separate entity system (`G.ceoRefs`,
helicopters, cars) rather than `getAct`. Minute-by-minute founder parity needs
that logic ported.

### 5. Known cosmetic, still open
- `rideElevator` fails **silently** when you're not at the lift bank; from a
  keypress that reads as "the lift is broken".
- Quest tracker overlaps the HUD while riding.
- The court's marble palette blows out a little at midday.

---

## How the shared modules work

`shared/*.js` are ESM. First Person imports them natively. The 2D app is ~99
classic scripts and cannot import, so **`js/shared_boot.js`** is one module
script that loads them onto `window.SC_SHARED`.

**Keep that `<script type="module">` tag ABOVE the `js/*.js` block in
index.html.** Deferred classic scripts and module scripts execute in document
order, and a module's imports resolve before its body — that ordering is the
only reason `SC_SHARED` exists before `data.js` runs.

Consumers delegate with their old code retained as a fallback:

```js
const shared = window.SC_SHARED && window.SC_SHARED.schedule;
if (shared) return shared.getAct(stg, dp, seed, model, SCHED_CTX());
return _getActLocal(stg, dp, seed, model);   // do NOT edit to change behaviour
```

The fallback exists so a CSP block or offline load degrades instead of
white-screening. Editing it to change behaviour silently reintroduces the drift.

`shared/schedule.js` takes a **ctx** because the two apps can't share globals.
`museumTrips` is the live example of a flag that **must be set the same in both
ctxs** or the views diverge again.

---

## Traps that have already caught someone

- **`mergeByMaterial` returns a NEW group.** Anything you hang off the group you
  passed in — userData, a Sprite, a scale — is yours to carry across. See above.
- **Point lights are physically correct** (`useLegacyLights = false`). Intensity
  scales with distance². See above.
- **`tools/build.mjs` minifies IN PLACE.** It overwrote sources mid-session once;
  `git checkout` only recovers *tracked* files. It now refuses to run without
  `NETLIFY=1` or `--force`. Don't remove that guard.
- **`git checkout -- <dir>` to undo a build also reverts uncommitted edits.**
  Commit before running any build.
- **`Personality.getBuildingBias` has an internal 22% random gate.** Any
  shared-vs-local comparison must neutralise it first or the diff is noise.
- **Netlify's `/*.js` header glob does NOT match `.mjs`.** Shared modules are
  named `.js` deliberately.
- **`/shared/*` and `/first-person/*` need scoped cache headers** — they have no
  `?v=` busting, so the site-wide `immutable` rule would freeze them for a year.

---

## Working on this

```bash
npm run serve
```

| | |
|---|---|
| 2D city | `http://127.0.0.1:8931/` |
| First Person | `http://127.0.0.1:8931/first-person/` |

```bash
npm run test:fp
```

Six suites, all must stay green. `format:check` is **pre-existing red** across
~101 files and predates this work — the repo is 4-space, not Prettier-formatted.

`serve.py` has a dev-only `POST /__shot?name=foo` that writes `.shots/foo.jpg`
(gitignored). Serialise the canvas **before any `await`** or you capture a
cleared buffer — a blank frame is almost always that, not a render bug.

Key docs: [`first-person/README.md`](first-person/README.md) (how to work on FP,
plus the non-obvious architecture decisions) and
[`first-person/PARITY-AUDIT.md`](first-person/PARITY-AUDIT.md) (what still
differs from the 2D city).
