# Resume here

**Updated:** 2026-09-13 · FP kit GLBs shipping to production
**Status:** First Person kits, scale, harbour, trees, and blimps pushed for Netlify.

---

## This session (2026-09-13) — ship FP kits

Owner playtested locally. Commit includes only the GLBs `assets.js` loads
(~11 MB), Draco/GLTF loaders, and the FP wiring. The TJA key is gitignored.
Unused pack dumps (farm barns, cozy cottages, bedroom, etc.) stay untracked.

---

## Previous (2026-09-07) — ban rows / Astra

**Live `main` then:** `f38b1f2` — shipped (cachebust v554).

Tested the two items the morning session left pending. Both were still broken,
and each hid a bigger defect behind it.

## Where this stands

Tested the two items the morning session left pending. Both were still broken,
and each hid a bigger defect behind it.

**1. The ban rows — one purged, one came back.**
`news:deepseek:GLOBAL` is gone; the listicle guard worked. `news:chatgpt:CA`
survived, and the bot was not at fault — `last_seen` was `12:00:42Z`, so it ran
and *re-affirmed* the row. Google News had re-worded the headline:

| | |
|---|---|
| guard written against | "Canadian lawyer **faces** 6-month **suspension** for citing ChatGPT cases…" |
| served that afternoon | "Canadian lawyer who misled judge about ChatGPT use **is suspended**" |

Both guards need an active verb plus a punishment noun; passive "is suspended"
matches neither. `PERSON_PUNISHED_PASSIVE_RE` covers it, with bans/barred/blocked
still deliberately excluded. **Take the lesson wider than the regex: a headline
is not a stable key.** The bot re-reads the live feed every 6h, so a guard
written against one wording is only as good as that wording's shelf life.

The client had no actor guard at all — `jail.js:_deriveNewsRules` derives bans
browser-side from the same feed and had only the listicle and stats guards, so
it could re-derive `news:chatgpt:CA` however cleanly the bot purged it. Ported
as one literal, verified headline-by-headline against the server's three regexes
(identical verdicts on 18 cases). Selftest 43/43.

**2. GPT-6 Astra — the regex was never what stopped it.**
The v552 fix was fine: cap auto-raises to 6, both Astras pass the verifier,
GPT-8 still rejected. The row died one layer earlier, in `submit-data`:

```
{"ok":true,"written":0,"rejected":[{"index":0,"reason":"string field too long"}]}
```

`optStr(r.arch, 60)` validated `arch` as a **string**. It is a **jsonb** column,
every row holds an object, and all three discovery paths send
`{params,type,tokens,compute}`. A type mismatch reported itself as a length
error, and `_cloudSubmit` swallows a failed POST, so it surfaced nowhere.

**This was never an Astra bug.** The check landed in `692c03c` (v511 security
overhaul) on 2026-07-10; the newest row in `models` was 2026-07-08. **Client-side
model discovery had written nothing for two months.** `archMap` now mirrors the
`numericBenchmarks` validator beside it. GPT-6 Astra and GPT-6 Astra Pro are in
the table as OpenAI citizens (15:18 / 15:19 UTC), `arch` object intact.

**3. What fixing #2 exposed.** Re-enabling the write path made a dormant bug
live: the variant skip list (`:beta`, `:free`, `:nitro`, `:extended`,
`:thinking`) was missing **`:batch`**, and the feed carries **69** of them. The
duplicates had never appeared only because nothing could be written at all. Left
alone, "GPT-6 Astra (batch)" would have walked in beside "GPT-6 Astra", eight per
fetch every 25 min. Fixed in both filters (`api.js` and `fetchTrustedNames`):
430 → 343 kept, zero `:batch` survivors, both real Astras still pass.

**Verified live:** v554 serving; `_NEWS_PERSON_PUNISHED_RE` present in the
deployed `jail.js`; `_cloudSubmit` returns `true` against production.

**One thing still on a timer:** `news:chatgpt:CA` was still active at the time of
writing. The bot runs `0 */6 * * *`, so the first run with the passive guard is
**18:00 UTC**, and `purgeMisclassified()` should drop it. Confirm with:
```
curl "$SUPABASE_URL/rest/v1/ai_bans?select=ban_key,active&ban_key=eq.news:chatgpt:CA" \
     -H "apikey: <publishable key from js/engine.js>"
```
Expect `[]`. Running the new classifier over the 7 live active rows purges
exactly that one and keeps all 6 real bans, so if it survives the function did
not run — check the Netlify logs before deleting by hand.

### A note for next time — this branch had diverged

The push was rejected first time: the **2026-09 monthly zone refresh** (PR #6,
`bae13e3` / `d862338` / `36c27a2`) had been merged to `main` while this work was
local. Rebased onto it. Zero source overlap — the refresh only touched
`js/*_zone.js`, `court.js`, `datacenter_data.js`, `embassy_row.js`, `vc_row.js`;
the only conflicts were `index.html` / `sw.js`, which are cachebust artifacts, so
they were resolved by taking upstream and re-running `tools/cachebust.mjs`. That
is also why the version is **v552** and not the v553 an earlier draft mentioned:
v553 was computed against a pre-refresh tree that never shipped.

**If `cachebust.mjs` reports a remote version ahead of local, that is the signal
to `git fetch` before doing anything else.** It said so twice this session before
the push failed.

### Questions I had to answer for you (no action needed, just so you know)

- **"xAI IPO'd"** — they didn't, quite. xAI was absorbed into SpaceX in the
  Feb-2026 all-stock merger as a wholly-owned subsidiary; SpaceX is what listed,
  on Nasdaq as **SPCX**, on 2026-06-12. So the xAI HQ ticker is the parent's
  listing. There is no standalone xAI symbol to use. First Person's old `TSLA`
  proxy is now obsolete and was changed to `SPCX`.
- **"GPT Astra"** — the model is called **GPT-6 Astra** (plus a Pro variant),
  both created on OpenRouter 2026-09-04. The `-6` is what was getting it killed.
- **"Indonesia hasn't banned DeepSeek"** — correct, it hasn't. You were seeing a
  bogus *worldwide* ban row, so it applied to every visitor regardless of country.
  The geo scoping itself was working fine.

### Nothing deferred

The `news:chatgpt:CA` row flagged here overnight was fixed on 2026-09-07 — see
"Follow-up" below. There is no outstanding known-bad data.

---

## Follow-up (2026-09-07) — actor disambiguation in the ban classifier

`news:chatgpt:CA` was active off:

> *Canadian lawyer faces 6-month suspension for citing ChatGPT cases in court hearing*

A lawyer disciplined for misusing the tool, read as Canada banning ChatGPT — so
every OpenAI model was detained for Canadian visitors. Same family as the
listicle bug: `classify()` matches a ban verb, a model and a country anywhere in
the headline and cannot tell **who the verb applies to**.

Two narrow guards now reject only the shapes where a human is unambiguously the
one punished: `PERSON_PUNISHED_RE` (`<person> … faces/handed/receives … a
suspension|ban|fine|sanction`) and `PERSON_DISCIPLINED_RE` (person-only verbs —
disbarred, struck off, expelled, convicted, sentenced).

The important part is what's **deliberately absent** from both verb lists: bare
"bans", "banned", "barred", "blocked". Officials do the banning, so matching
those after a person noun would suppress real bans — "German minister bans
DeepSeek on government devices" must still register. Four self-test cases cover
the misuse shape, four more assert that minister/officer/judge/regulator
headlines still produce rows (39/39).

Verified against production before committing: ran the new classifier over all
eight live active bot rows — it purges exactly `news:chatgpt:CA` and
`news:deepseek:GLOBAL`, keeps all six legitimate bans. Server-side only, so no
cachebust bump.

---

## Previous session (2026-09-06) — four defects, found from live data

Started from two reports (missing xAI ticker, missing GPT Astra) and picked up
two more from a screenshot mid-session.

### 1. GPT-6 Astra couldn't exist

`_knownFakePatterns` / `KNOWN_FAKE_PATTERNS` carried
`/gpt[\s-]*[6-9](?!\.\d)/` labelled "extra safety". It was a **frozen version
ceiling in regex clothing** — exactly the trap MAINTENANCE.md C5 warns about,
which is presumably how it survived review: it doesn't look like a numeric cap.

It fires at step 2.6, *before* the trusted-name fast path and before the
`trustedSrc` bypass, so `"gpt-6 astra"` was rejected from every source including
OpenRouter. And `isHighConfidence()` counts "Known fake pattern" as
delete-worthy, so `db-maintenance` was re-deleting it from the shared table
every 6h — it could never have stuck even if one scan had written it.

The version machinery was working perfectly the whole time: building the registry
off the live feed auto-raises `caps.gpt` to 6 on its own. The regex just fired
first. Running the real server verifier against the live 343-model OpenRouter
feed, before and after:

```
before:  Rejected 2 of 343 — GPT-6 Astra, GPT-6 Astra Pro   (both flagged DELETE)
after:   Rejected 0 of 343
```

Guard still holds: with no feed (floor 5.4) GPT-6.5/7/8/9 all reject; with the
feed (cap 6) GPT-8/9 reject and GPT-7 sits in the deliberate one-step forward
tolerance — the same posture GPT-6 had before this launch. `knownReal` also
picked up 5.5, the 5.6 Luna/Terra/Sol trio and the two Astras; those were only
getting through on tolerance.

### 2. xAI HQ ticker — half in code, half in the database

The sign in `js/environment.js` is gated on `LABS[lab].ticker`, and the 2D
`LABS` has **no code-level source at all** (`js/data.js` is `var LABS = {}`,
filled only from Supabase). The `labs` row for `xai` has `ticker: null`. Anon is
SELECT-only per `rls_all.sql`, and `submit-data.mjs` doesn't accept that table —
hence the SQL step above.

First Person *does* hardcode its own LABS map, and had xAI on `TSLA`. Fixed to
`SPCX`. Worth remembering that the two halves of the site can silently disagree
like this, and a grep for a lab field only finds the FP copy.

### 3. DeepSeek jailed for the entire planet

Row `news:deepseek:GLOBAL`, written by the news bot from:

> *DeepSeek Banned Countries 2026 [Worldwide List]*

A **listicle** — a roundup of who bans DeepSeek — has a ban verb, a model name
and the word "worldwide", so it classified as a global ban and detained every
DeepSeek citizen for every visitor on Earth. `STATS_RE` was meant to catch this
class but only matches superlative phrasing ("most frequently restricted").

`LISTICLE_RE` now catches list-shaped headlines ("<model> banned countries",
"which countries…", "full list of…", a bracketed "[… List]"). Checked against
every active row in the live table: it purges exactly the bad one and keeps all
six legitimate bans. Four self-test cases lock it (`--selftest`, 31/31),
including one asserting a genuine worldwide ban *still* registers. The
client-side `_deriveNewsRules` parser got the same guard plus the missing stats
guard, for parity.

No manual delete needed — `purgeMisclassified()` self-heals it on the next run.

### 4. Metro riders could be stranded forever

The screenshot's real puzzle: models marked Detained, standing on a platform for
ten minutes, while the Detention Center read empty.

`_metroLegs` held **x coordinates snapshotted at planning time**, and the train
lookup compared them against the live station x with `===`:

```js
if ((s1 === mResX && s2 === mHqX) || …) activeTrain = this.trainWest;
```

Any `recalculateZoning()` — which runs whenever a scan discovers a new lab HQ or
founder estate, re-laying out the whole strip — moves the stations. A shift of
*one pixel* breaks the equality, `activeTrain` goes null, and the rider waits on
the platform forever, because route planning is gated on `!refs._metroLegs` and
`waiting_train` had no timeout. Simulated it: a +12.5px station shift strands the
old code and boards fine on the new.

Now: routes are station **IDs** resolved to live coordinates every frame; trains
are matched on the ID pair (mirroring the `createTrainObj` pairs); and
`_abandonMetro()` gives up for an overland walk if no train serves the leg, if
one never arrives within ~1 round trip, or if a station ID stops resolving. The
`exiting` branch was reading the raw leg value too — it now uses the resolved x.

("Detained · Released" in the tooltip was a red herring, by the way — that's the
activity followed by the lifecycle stage from `STAGES.adult.label`, not two ban
states. Being outdoors at 23:33 was also by design: detention outranks sleep in
`getAct`. Both stop happening once the bogus ban is gone.)

### Checks run

`npm run test:fp` (all green), `eslint js/**` clean, prettier clean on changed
2D files, `update-ai-bans.mjs --selftest` (31/31 at the time, 39/39 after the
follow-up), server verifier against the live OpenRouter feed. All re-run after
the rebase onto the zone refresh. Cachebust → **v552** (see the divergence note
at the top — an earlier draft said v553, computed against a tree that never
shipped).

---

## This session (2026-09-12) — modular Draco GLBs into FP

Goal: wire threejsassets kits into First Person **without** baking a city mesh.
`City.layout()`, colliders, canvas signs, metros, helis, robots, box-people stay.

### What landed (uncommitted)

Vendored Three r160 `GLTFLoader` + `DRACOLoader` + local Draco decoder.
Importmap + Node test resolver stay in sync.

`first-person/js/assets.js` — registry, load-before-`World.build()`, landmark
map, infill reuse, vehicles, harbour props, interior props.

`world.js` places kits as **one InstancedMesh per kit**. First scale pass
stretched each axis independently and the skyline read as toys. **Fixed:**
uniform `kitScale()` matches the old procedural box (height or footprint,
whichever is larger). OpenAI HQ comes out ~20.5× (old ~69 m tower), not 10×
true metres.

Also: Vice Beach neon/deco/port dressing, bigger launchpad stacks (catalog has
**no rockets**), lobby/bar/lab GLB furniture, police/bus/van in traffic,
Netlify cache for `/first-person/assets/*` + `worker-src blob:`.

`npm run test:fp` green (includes new `test:fp:assets`).

### How to look at it in the morning

```bash
npm run serve
```

Then hard-refresh **Ctrl+Shift+R**:

- http://127.0.0.1:8931/first-person/?autostart=1
- night: `?autostart=1&dp=0.85`
- 2D toolbar **FP** still goes to `/first-person/`

Walk VC Row + OpenAI, port quay, space pads, enter Neon Bar and an HQ lobby.

A playtest server may still be on **:8931** from tonight; if it is dead, the
command above is enough.

### Not pushed / do not commit blindly

- **Code:** `first-person/js/assets.js`, `world.js`, `main.js`, `traffic.js`,
  `interior.js`, `index.html`, `lib/GLTFLoader.js`, `lib/DRACOLoader.js`,
  `lib/draco/`, tests, `netlify.toml`, `package.json`, this file.
- **Assets:** `first-person/assets/` is untracked. Zips are gitignored. Prefer
  individual GLBs under `_packs/*/glb/individual/` (and bunker
  `interiors/bunker-facility/glb/`). Do **not** add `components/*.tsx`, pack
  zips, or the 58 MB City catalog if you can avoid it.
- Leave `landing_preview2.html` / `landing_preview3.html` alone.

### Morning leftover (in order)

1. **Owner eyeball** — scale, night windows, colliders, metro, fly, enter.
2. **Railway pack** — only city-adjacent pack not on disk. Download API needs
   the `TJA_` key (Chrome cookies are encrypted here). Drop the pack at
   `first-person/assets/models/_packs/railway/` then map station / diesel /
   gantry / container wagon.
3. Optional: Metropolis skybridges between VC Row; Character Studio humans
   (export still `not_entitled`); keep procedural helis/robots/box-people.
4. Then commit + push if the playtest is good.

---

## Previous (2026-08-24, evening) — mobile Free-fly HUD

**Live `main` then:** `3dceab9`. Touch controls shipped; Free-fly is a top-right
🦅 button on phones.

The morning mobile pass injected Free-fly into the **pause grid**, but there
was no on-screen way to enter it while walking. Pause is easy to miss on a
landscape phone, and the pause buttons synthesised `KeyboardEvent`s — on some
mobile WebKits `event.code` never sticks, so `C` would no-op.

Shipped on `main` as `3dceab9` (Netlify auto-deploy):

- 🦅 button in `#tcTop` (menu · map · **free-fly** · fullscreen). Tap to take
  off, tap again to land. Gold/latched while flying; aria-label flips to Land.
- Pad still rebinds: E → descend, ▲ → climb, » → boost.
- Pause-grid mode buttons now call `G.flyModeSys.toggle()` (and the other
  mode APIs) instead of faking a key.
- Start screen, hint bar, settings copy, tip toast, tutorial `bodyTouch`
  all mention the button. `#hudRight` gutter is 218 px for the fourth mini.

Verified headless Chrome at 845×390 with `?touch=1&autostart=1`: button
present, enter/exit toggles `G.flyMode`, pad labels swap, pause path works.

Left alone: untracked `landing_preview2.html`, `landing_preview3.html`.

**Tomorrow:** owner playtest on a real phone (landscape, Free-fly takeoff and
land). After that, pick up from the list below.

---

## Earlier today (2026-08-24) — First Person on mobile, plus a polish pass

### The mobile fix

FP had never worked on a phone, and it was **one cause**: the whole controller
was gated on **pointer lock**. `Player.locked` guarded movement, jump, head-bob
and mouse-look, and losing the lock opened the pause menu. No mobile browser
implements pointer lock — so a phone booted the city, rendered it beautifully,
and then stood perfectly still behind a pause menu. Nothing was wrong with the
renderer.

New `js/touch.js`:

- dynamic-origin analog thumb stick (left), drag-anywhere-else look (geared
  separately from mouse sensitivity), E / jump / sprint pad, and a
  menu · minimap · fullscreen row
- tap-to-interact, but only when the crosshair already has a target — otherwise
  every look-adjust opened a building card
- the keyboard-only modes (free-fly, orbit, tour, x-ray, holomap, terminal) are
  injected into the pause grid, which is the only way a device with no keys can
  reach them
- free-fly flies from the same stick, with E/▲ rebound to descend/climb

Everything routes through the paths the keyboard already used — buttons
dispatch real `KeyboardEvent`s, the stick writes `Player.moveX/moveZ` — so no
other module learned about touch.

Around it: `Player.inputActive` replaced `locked` at every gate; movement input
is now clamped rather than normalised so a half-pushed stick is a half walk;
`low` preset and no MSAA on touch (but never over a quality the player chose);
resize coalesces into a rAF and re-runs after an orientation change; adaptive
resolution drops the pixel ratio if the frame rate can't hold 26; ENTER boots
disabled until its handler exists; and a CSS layer for safe areas, a HUD that
keeps clear of the controls, a pause grid that fits 21 buttons on a landscape
phone, and a City Map that fits at 380 px tall.

### The polish pass — five real bugs

1. **The indoor prompt chain tested the wrong thing first.** `maxFloor > 0` is
   a property of the *building*, so it matched everywhere, and it sat above the
   two checks that depend on where you are *standing*. Every multi-floor
   building — nearly all of them — answered "F ride lift" while you stood at
   the door, so **"E — step outside" was unreachable**, and a **metro platform
   never once offered to board the train in front of you**.
2. **`GENERIC` was painted on 41 lobby walls.** The name board's subtitle was
   `b.type` uppercased, and `generic` is the most common type in `data.js` by a
   distance.
3. **Both lobby name boards hung through the ceiling** — 320x80 at y 74 tops
   out at 114 against a soffit at 94. And the office lobby's three coloured
   panels sat five units in front of the board, straight across its subtitle.
4. **The Citizen of the Day crown had never been pressable, on any device.**
   It is injected into `#hudRight`, and `#hud` is `pointer-events: none` so the
   HUD never eats a click — and `pointer-events` inherits.
5. **Interior hotspots carry a label that was never rendered**, so the one
   interactive prop in the city (the Times printing press) only worked if you
   happened to press E while standing on it.

Also: gitignored the throwaway Chrome profile `find_nan_geo.mjs` leaves behind
(587 files, and `git add -A first-person` swallows the lot).

### Checked and found NOT broken

- All 170 enterable buildings enter, change floor and exit with no errors.
- No NaN geometry anywhere in the scene; 683 draw calls / ~500k tris at `low`.
- Metro board → ride → alight, and the lift ride, are clean.
- The schedule spreads 400 citizens over 48 destinations and they arrive.
- The near-black lab HQ façades are **not** a bug: forcing the instance colour
  to white leaves the windows dark, so it is the façade texture's glazing, as
  authored. Verified by reading back pixels, not by eye.

Left alone: untracked `landing_preview2.html`, `landing_preview3.html`.

---

## Previous (2026-08-14) — Gauntlet reverted, then production playtest

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

1. **Owner playtest of mobile Free-fly** (🦅 top-right, then land). Then any
   other phone feedback. Everything below is lower priority.
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
- **`_cloudSubmit` swallows every failure.** The POST to
  `/.netlify/functions/submit-data` is wrapped in `catch (e) { /* silent */ }`,
  and the endpoint answers `200` with `{"ok":true,"written":0,"rejected":[…]}`
  when it drops a row. A write can fail forever and look exactly like a write
  that had nothing to do — that is how two months of dead model discovery went
  unnoticed. **To test a discovery path, POST the row by hand and read
  `rejected`.** Do not infer success from a model appearing in `G.models`; that
  happens before the submit.
- **The rejection reason can lie about the cause.** `optStr()` doubles as a type
  check, so a wrong *type* is reported as `'string field too long'`. Read the
  check that produced the message, not the message.
- **`G` and `API` are `const`, so they are NOT on `window`.** `window.G` and
  `window.API` are `undefined` while `G` and `API` resolve fine — top-level
  `const`/`let` create script-scope bindings, unlike `var LABS`. Probing a live
  page with `window.G` gives a false negative and makes a booting city look
  dead. Use the bare identifier.
- **Escaping regexes through a generator script is its own bug class.** A
  `\\b` that should have been `\b` shipped a guard that silently matched
  nothing — it parsed, linted and looked right in the diff. Any ported regex
  needs a test that asserts it *fires*, not just that the file loads.
- **`tools/build.mjs` minifies IN PLACE.** Commit before running any build.
- **`git checkout -- <dir>` to undo a build also reverts uncommitted edits.**
- **Netlify's `/*.js` header glob does NOT match `.mjs`.** Shared modules are
  named `.js` deliberately.
- Keep the `<script type="module">` `shared_boot.js` tag ABOVE the `js/*.js`
  block in index.html — that ordering is the only reason `SC_SHARED` exists
  before `data.js` runs.
- **`pointer-events` INHERITS, and `#hud` sets it to `none`.** Anything
  interactive parented into the HUD needs `pointer-events: auto` of its own —
  the Citizen of the Day crown didn't, and had never been pressable.
- **`Player.locked` is now only about the mouse.** The gate on movement, jump
  and head-bob is `Player.inputActive`, which is also true on touch. Anything
  new that asks "can the player move?" must ask that.
- **Do not synthesise `KeyboardEvent`s to drive modes on touch.** On several
  mobile WebKits `new KeyboardEvent({ code: 'KeyC' })` leaves `event.code`
  empty, so the desktop keydown handler never fires. Call the mode API
  (`G.flyModeSys.toggle()`, etc.). Free-fly also has its own HUD button.
- **`git add -A first-person` swallows a Chrome profile.** `find_nan_geo.mjs`
  leaves a 587-file user-data-dir behind; it is gitignored now, but check
  `git show --stat` before pushing a broad add.
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

**Seven** suites. `metro_depth_check` stops the tunnels resurfacing. All must stay green. `format:check` is **pre-existing red**
across ~101 files and predates this work.

`serve.py` has a dev-only `POST /__shot?name=foo` that writes `.shots/foo.jpg`.
Serialise the canvas **before any `await`** or you capture a cleared buffer.

Key docs: [`first-person/README.md`](first-person/README.md) and
[`first-person/PARITY-AUDIT.md`](first-person/PARITY-AUDIT.md).
