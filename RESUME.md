# Resume here

**Updated:** 2026-08-04 · **Live:** `main` @ `91e3b62` on singularitycity.net
**Owner status:** session limit reached; will playtest live and resume later today.

---

## What just shipped

First Person is merged into this repo at `/first-person/` and deployed. The 2D
city is unchanged at the site root; FP is reachable only from the in-city
`🚶 FP` toolbar button.

The bulk of this work fixed one root cause:

> First Person wasn't an incomplete replica of the 2D city — it was a **parallel
> simulation** that happened to share the building list. It fabricated events
> with `Math.random()` and asserted they were real.

That is now closed. Five modules under `shared/` are the single source of truth
and **both views read them**.

| System | Was | Now |
|---|---|---|
| Rockets | Random pad every 60–180s, toasted as real | Real launches, 13 pads, T-5m/T-1m states |
| Jail | Random citizen arrested every 8s | Real government bans, jurisdiction-scoped, auto-release |
| Court | Invented case types | Real 2026 docket + live regulation headlines |
| Port | No price feed | Live Supabase prices over fallbacks |
| **Schedule** | Two drifted copies | One implementation, both views |

Verified on the live domain after deploy: 13 pads idle with none scheduled, jail
correctly empty for an ID viewer, all six founders in their own estates,
region-less labs → `res_eu`, `city_park` → `central_park`, zero console errors.

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

### Adding to the schedule

`shared/schedule.js` takes a **ctx** because the two apps can't share globals.
Both views must supply equivalent values. `museumTrips` is the live example of a
flag that **must be set the same in both ctxs** or the views diverge again.

---

## Traps this session actually hit

- **`tools/build.mjs` minifies IN PLACE.** It overwrote sources mid-session.
  `git checkout` only recovers *tracked* files — an untracked new file was
  simply gone. It now refuses to run without `NETLIFY=1` or `--force`. Don't
  remove that guard.
- **`git checkout -- <dir>` to undo a build also reverts your uncommitted
  edits.** Cost three files of work. Commit before running any build.
- **`Personality.getBuildingBias` has an internal 22% random gate.** Any
  shared-vs-local comparison must neutralise it first or the diff is noise.
- **Netlify's `/*.js` header glob does NOT match `.mjs`.** Shared modules are
  named `.js` deliberately.
- **`/shared/*` and `/first-person/*` need scoped cache headers** — they have no
  `?v=` busting, so the site-wide `immutable` rule would freeze them for a year.

---

## Pick up here

### 1. Owner playtest (blocking)
Walk the live city and report. Everything below is lower priority than notes
from a real playthrough.

### 2. Switch 2D onto the other four shared modules
`space_live`, `ai_bans`, `ai_docket`, `port_prices` are loaded into `SC_SHARED`
and read by FP, but 2D still runs its own copies. They agree on data today, they
just derive it twice — the docket will drift as cases move.

Same small change as `getAct` took. **Prove it changed nothing** the way
`72829ce` did: sweep the delegated function against the retained local copy
across seeds and inputs, assert zero differences.

### 3. Founder movement
Homes now match, but 2D drives CEOs through a separate entity system
(`G.ceoRefs`, helicopters, cars) rather than `getAct`. Minute-by-minute founder
parity needs that logic ported.

### 4. Category B — stub interiors
**Not a bug class: ~27,000 lines of missing content.** Nine interiors sit at
7–16% of their 2D versions (jail 7%, court 8%, metro 10%, bar 12%). Each is
bespoke 3D modelling. A programme measured in sessions per interior, worst
ratio first. See `first-person/PARITY-AUDIT.md`.

### 5. Known cosmetic
- The metro cabin renders as flat slabs rather than a car interior (camera
  placement is correct — it's the geometry, consistent with the 10% port).
- `rideElevator` fails **silently** when you're not at the lift bank; from a
  keypress that reads as "the lift is broken".
- Quest tracker overlaps the HUD while riding.

---

## Working on this

```bash
npm run serve        # whole site: 2D at /, FP at /first-person/
npm run test:fp      # 6 suites, all must stay green
npm run lint
```

`format:check` is **pre-existing red** across ~101 files and predates this work.
The repo is 4-space, not Prettier-formatted.

**The old `SingularityCityFirstPerson` sandbox is retired.** Every code file has
a counterpart here; its working docs are archived at
`first-person/docs/archive/`. Safe to delete.

Key docs: [`first-person/README.md`](first-person/README.md) (how to work on FP,
plus the non-obvious architecture decisions) and
[`first-person/PARITY-AUDIT.md`](first-person/PARITY-AUDIT.md) (what still
differs from the 2D city).
