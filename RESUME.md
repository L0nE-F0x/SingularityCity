# Resume here

**Updated:** 2026-08-14 · **Live `main`:** shipping the playtest fixes below
**Status:** Gauntlet Loop was rolled back (never committed). Owner playtest bugs from production are in this commit.

---

## This session (2026-08-14) — Gauntlet reverted, then production playtest

Matt Shumer’s Gauntlet Loop on `/first-person/` was tried and **rejected** (performance, citizens, vehicles). Rolled back; none of that landed.

Then owner sent production screenshots. Shipped:

1. Mountains stay off the Space Zone (cars were driving through the hillside).
2. Inner roads meet the avenues; sidewalks cut at every carriageway.
3. One harbour gantry: frame rolls the quay, trolley stays on the boom, box is parented to the spreader.
4. Ship funnels sit on the house; hull plating; waved ocean instead of tiled blue squares.
5. Interior door is sealed (E to leave, not walk-into-white-void). HQ lobby opened up. **F** rides the lift from anywhere.
6. Metro ticket hall: no stairs-into-ceiling, no second fake lift, one departure board.

Left alone (not gauntlet): untracked `landing_preview2.html`, `landing_preview3.html`. `.shots/` still has the w0–w3 frames and critic notes (gitignored). Poseidon clone at `Desktop/ApexForge/poseidon` was never wired in.

Do not restart the gauntlet unless asked.

Open-source Three.js (Owen / TokenGremlin) — decided, not built, still stands if we ever do trees/water:
- **Dryad** + **Gaia**: bake and instance. WebGL.
- **Poseidon**: WebGPU-only. Do not drop into FP.
- **Tiamat / Demiurge**: no.

---

## Previous (2026-08-05)

**Live then:** `main` @ `84b4bca`, cache **v547**
Owner playtested that build. The through-line of those fourteen commits: First Person had been a parallel simulation with invented data.

---

## What this session did

Fourteen commits, all on `main`. The through-line: **First Person had been
running as a parallel simulation with invented data**, and most of what looked
like a rendering bug turned out to be that.

### The two that mattered most

**FP invented 599 of its 700 citizens.** `Citizens.init` took 50 real models,
6 founders and 45 workers, then filled the rest of the population target with
procedurally generated names — `Anthropic-plus-91`, `OpenAI-mini-23`. Those were
the nameplates you read walking the city. The 2D app has always pulled the real
list; FP's live store only ever fetched a model *count* for the HUD.
`js/store/roster.js` now reads the same Supabase tables. **1,198 real models,
all 20 founders, zero invented citizens**, and the cohorts finally populated —
42 retired in the graveyard (was 2), 44 rumoured (was 1).

**The shared schedule's percentage buckets were all wrong in FP.**
`shared/schedule.js` buckets with `(seed * 17) % 100 < N`, which only spreads
over 0–99 for an **integer** seed. 2D passes `G.models.indexOf(m)`; FP passed
`c.seed`, a float in `[0,1)`. So `s` never left `[0,17)` and every threshold
above 17 fired for every model: 645 of 700 at the Neon Bar at 19:12 and nobody
at the park, cafe, arena, gym, library or open square. It also silently defeated
the shared module's whole purpose — the two views were placing the same model in
different buildings.

### Everything else

| Area | What changed |
|---|---|
| Landing page | Stopped auto-entering the city (handoff token was only half-cleared) |
| Helicopters | Rotors spin — `mergeByMaterial` was eating the pivot AND the handle |
| Streets | Lamps, hydrants, benches, utility poles no longer stand in junctions |
| Nvidia truck | Manhattan routing; no longer cuts diagonally through blocks |
| Harbour | Real ships that sail in, berth, and discharge through a gantry |
| Metro | A train arrives, doors open, you ride a real carriage, you alight on the next platform |
| Interiors | Jail + courthouse rebuilt; every interior now shows its **real** occupants, and they move |
| Districts | 6th column: Hyperscaler Row, Eastern Exchange, Open Weights Quarter, Hub Commons |
| Mansions | Billionaire's Row was rendering as office blocks. Now 7 mansion styles, and all 20 founders have one |
| City Map | Rebuilt as a real plan; the in-game M panel now shares it and lets you click to travel |

---

## Pick up here

1. **Owner playtest feedback.** Everything below is lower priority.
2. **Category B interiors — six left.** Bar, alignment, press, underground,
   legacy, embassy are still thin on props. Jail, court and metro are done.
   Copy `js/interiors/jail.js` for the pattern.
3. **Switch 2D onto the other four shared modules** (`space_live`, `ai_bans`,
   `ai_docket`, `port_prices`). They agree today; the docket will drift.
4. **Founder movement** — 2D drives CEOs through `G.ceoRefs`, not `getAct`.
5. **Known gaps, deliberately left:**
   - ~446 models are HuggingFace org handles with no company; they live in the
     Hub Commons as Independents. A district per handle would be inventing a firm.
   - `rideElevator` still fails silently when you're not at the lift bank.

---

## Traps — read before touching the relevant file

Every one of these cost real debugging **this session**.

- **`mergeByMaterial` returns a NEW group.** It drops `userData`, non-mesh
  children (Sprites!) and the group's own transform. This killed the helicopter
  rotors, every VIP limo's name plate, and the limo's stretch.
- **Point lights are physically correct** (`useLegacyLights = false`). A light
  falls off as `intensity / distance²`, so the 0.3–1.4 values used everywhere
  deliver ~nothing. Think in the **hundreds**.
- **`shared/schedule.js` needs an INTEGER seed.** See above.
- **PostgREST caps any response at 1000 rows.** The models table is at 1198; a
  single GET returns the first 1000 and looks like it worked. Page with `Range`.
- **`Roster.pick` strides, it does not slice.** Ids cluster by lab, so slicing to
  the population cap drops whole labs — Alibaba's Qwen models sort under `q` and
  all but one vanished.
- **A district whose `biome` has no `BIOMES` row used to kill the whole boot.**
  `city.js`'s `INFILL` table carries keys `BIOMES` lacks (`plaza`). Now warns
  and falls back.
- **Any building type missing from `world.js`'s specialty switch silently
  renders as a generic box.** That is why the founder mansions looked like
  offices for months.
- **Free-fly owns the camera** and `Player.update` returns early while
  `G.flyMode` is set. Entering a building or boarding a train while flying left
  you inside a room you could fly out of through the walls. Both now land you
  first.
- **The version badge is derived**, not written — it reads the first versioned
  `js/` tag, which is `shared_boot.js`. A stale badge means `cachebust` missed a
  tag, not that the deploy failed.
- **`tools/build.mjs` minifies IN PLACE.** Commit before running any build.
- **`git checkout -- <dir>` to undo a build also reverts uncommitted edits.**
- **Netlify's `/*.js` header glob does NOT match `.mjs`.** Shared modules are
  named `.js` deliberately.
- Keep the `<script type="module">` `shared_boot.js` tag ABOVE the `js/*.js`
  block in index.html — that ordering is the only reason `SC_SHARED` exists
  before `data.js` runs.
- **`G.player.eyeY` is ABSOLUTE** (`G.floorY + EYE_H`), not an offset.
- **Interior props are children of `Interior.group`**, which already carries
  `FLOOR_Y` and `ROOM_SCALE`. Applying either again buries them 4000 units down
  at a ninth scale.

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

**Seven** suites now — `metro_depth_check` was added this session to stop the
tunnels resurfacing. All must stay green. `format:check` is **pre-existing red**
across ~101 files and predates this work.

`serve.py` has a dev-only `POST /__shot?name=foo` that writes `.shots/foo.jpg`.
Serialise the canvas **before any `await`** or you capture a cleared buffer.

Key docs: [`first-person/README.md`](first-person/README.md) and
[`first-person/PARITY-AUDIT.md`](first-person/PARITY-AUDIT.md).
