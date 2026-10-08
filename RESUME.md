# Resume here

**Updated:** 2026-10-08 (First Person overhaul wrap) · **Live `main`:** `85cce75` (this wrap sits on top)
**Status:** The First Person overhaul is live on cache **v561**. Netlify served
`singularity-city-v561` on the second poll; `first-person/js/neon.js` and `pedgraph.js`
return 200 with `max-age=0, must-revalidate`, and a headless run against production did
the full metro journey (hall → escalator → platform → board → ride → alight → lift) and
every mode key with no page errors. The 2D city was only cache-bumped.
**Next:** start from the owner's playtest notes. Known gaps are at the end of this
session's section.

Repo: https://github.com/L0nE-F0x/SingularityCity.git
Local playtest: `python3 serve.py 8931` → http://127.0.0.1:8931/
`serve.py` proxies `/api/zeroeval/` and `/api/arena/`. ZeroEval sends no CORS
headers, so the browser has to use that same-origin path or the board stays empty.

---

## This session (2026-10-08) — First Person overhaul

Owner brief: First Person felt far below the 2D city — bugs, cramped and overlapping
props, broken metro trains, badly spaced transport — "do a super deep pass and perfect
it", and bring its look closer to the 2D art. After the first before/after the owner said
keep the pixel look as the default, finish the open items, then push and bump. Thirteen
commits `edb10cf` → `85cce75`, pushed together. Before/after page (private, identical
cameras): https://claude.ai/artifact/N8v9NGj7J32CRYzbt5KrAK

### What shipped

| Area | What changed | Where |
|---|---|---|
| Metro | Rebuilt. Lines in `TRAM_LINES` are routed: each station a straight platform run on a street axis, joined by Béziers; Harbour Line (W–Central–E–Exchange) on level 0, Compute and Innovation lines a level deeper. Twin track, keep-right, terminus crossovers, block signalling (`roomAhead`). Three-car sets (one car model is exterior and saloon), accel/brake, sliding doors on the platform side. Everything underground is baked-lit MeshBasic. `newTrain`, `stepTrain(t, dt, routes, others)`, `etaTo` exported. | `js/metro.js`, `js/data.js` |
| Platforms | `Metro.enterPlatform(bid, routeIdx)` puts you on the real platform (city hidden, AABB colliders, `G.onPlatform`); `platformAction()` boards / lifts up / crosses over; alight lands beside your door. The ticket hall (single floor now) has one escalator hotspot per line, departures and a network map. Street "board from anywhere" removed. | `js/metro.js`, `js/interiors/metro.js`, `js/interact.js` |
| Streets | Inner district road 60 carriage / 26 pavement (was 44/16), `innerRoadHalf` 64, infill `CROSS` 110, quadrant pads 330 at ±221. Lamps down every district street. | `js/city.js`, `js/world.js` |
| Props | `World.lampSpots` stays the POLES; heads moved to `lampHeads` (the light pool overwrote it, so furniture dodged points over the road). Streetscape clearance from real kit footprints (`radius`), plaza satellites unforced, plazas need open ground (`_openGround`), trees spaced + trunk colliders (not forests), power poles only outskirts + solid, vendor carts solid, `Streetscape.evict` under the AI Index board, port rail siding has track + collider. Audit ~90 overlaps → only desert drifts. | `js/world.js`, `js/streetscape.js`, `js/vendors.js`, `js/kardashev.js` |
| Traffic | One sim in `Traffic.vehicles` for ambient cars, founders' cars, truck and vans; `_routeFromNodes` builds lane-correct loops (offset `R90(heading)`), rounded corners; red lights at every signalled junction (`_toStopLine`), don't-block-the-box, yield to cars in a junction, route-projected conflict check. Cars stop for the player. Car counts 10/20/30. | `js/traffic.js`, `js/state.js` |
| Pedestrians | `pedgraph.js`: every pavement line, nodes at corners, cached Dijkstra; citizens and VC partners route through it with a per-walker lane; door/patrol spots inside a block snap to the pavement. Inside-a-building time 5.3% → 0.13%. | `js/pedgraph.js`, `js/citizens.js`, `js/vc_dealflow.js` |
| Look | Weather uses the 2D `tod.js` palette (sky stops, amb, haze, rim, neon). `neon.js`: painted shop windows + awnings + trim on street-facing ground floors, vertical blade signs, pavement/road spill at night, rooftop parapet neon and signs on box roofs, beacons, corner neon on kit towers. Pixel look: final ShaderPass block-samples 2×2 (soft, default) / 3×3 (crisp) with Bayer dither and posterise, at FULL resolution (a low-res target doubles point sprites). `?pixel=`, Settings, and the start screen's Look select (`localStorage sc_fp_pixel`). | `js/weather.js`, `js/neon.js`, `js/main.js`, `js/ui.js`, `index.html` |
| Rooms | Dark palettes lifted by luminance (`liftDim`), beamed ceiling with framed panels, clerestory windows (`skylineTex`) for `WINDOW_CATS`, spawn just inside the door. Rebuilt: Model Arena, jail intake, worker foyer; agents table and gym mat toned down. | `js/interior.js`, `js/interiors/*.js` |
| Misc | Space Zone: one service tower per pad, rockets are `Traffic.pads[*].mesh` (a third stand; rollout for real launches; the one on the pad flies); mesas removed. Lamp halos 22, ambience particles capped, stars behind clouds, smaller envelopes/VIP tags, slimmer signals, graveyard railings, glass metro entrances. | various |
| Caching | `/first-person/js/*`, `/first-person/css/*`, `/shared/*` now `max-age=0, must-revalidate`: with 3600 a returning visitor right after a deploy got a mixed module set and could fail to link. | `netlify.toml` |

### What a new agent must not re-break

1. **Cars are modelled along +Z** in metro.js, and `rotation.y = atan2(hx, hz)`. The old car was along X and ran broadside.
2. **`World.lampSpots` is the poles** (`hx/hz` are the heads); the light pool uses `lampHeads`.
3. **On a platform `G.onPlatform` is set and `G.inside` is not.** Anything that shows surface objects each frame must treat it like `G.ridingMetro`; the sky/map modes refuse to start there.
4. **The metro station interior has one floor.** The platforms are not interior floors; don't re-add the toy train.
5. **Every road vehicle goes through `_addVehicle` / `_updateCars`.** Don't add a vehicle with its own path stepper: it will drive through the others.
6. **The pixel pass samples blocks at full resolution.** Don't "optimise" it into a low-res render target.
7. **Interior textures that rooms share carry `userData.shared`** (the skyline window) so the teardown doesn't dispose them.
8. Tests: `npm run test:fp` (parity asserts opposing sets never share a road; depth check asserts station halls stay underground).

### Verified

- `npm run test:fp` green throughout; footprint audit, 400 s traffic sim (no gridlock, ~10 near-miss frames among 44 vehicles), 400 s metro sim (no shared-track overlaps).
- Frame time, 7 street spots, headless RTX 4050: 14.4 ms before → 11.2 pixel / 13.2 smooth.
- Phone emulation 844×390 touch: start screen, street, night, platform, no errors (~16.7 ms).
- Production after push: v561, new modules 200, full journey + mode smoke test, no page errors.

### Not done / worth a look

- Kit towers' sculpted crowns are untouched (only beacons and lower-corner neon added).
- Touch devices still boot `medium` when the store already holds a quality (pre-existing).
- Most bespoke rooms beyond the three rebuilt kept their layouts (they got the shared fixes).
- A few sand drifts still touch rocks in the Space Zone (natural-looking).


## This session (2026-10-07) — the 2D art 10x pass, and a promo video

Owner brief: make the 2D city "10x" better while keeping the pixel aesthetic, First
Person excluded. They were quizzed first and picked: lofi atmosphere + full-time neon
cyberpunk; hazy smog-gold days; **2px art pixels** (was 3px); citizens as **little robots**
in lab colours (founders/staff stay human); interiors keep their layout but open zoomed in
and scroll through the floors; a **light** UI restyle; no phone quality tier (owner said it
runs well on their phone). After reviewing style frames they asked for a touch less yellow
by day, a calmer backdrop, more neon by day and stronger night reflections. Two releases,
v559 (`4008a2c` → `7964b6d`) and v560 (`13c1460` → `36a4fc6`), each pushed on the owner's
word. Style-frame before/after page (private): https://claude.ai/artifact/9yx8qguTcYVTATkYCDgZtx

### What shipped

| Area | What changed | Where |
|---|---|---|
| Grid | `PL.ART = 2`; `PL.FLOOR = 18/ART`, `PL.LOBBY = 24/ART`, `PL.S3 = 3/ART` (converts sizes drawn for the old grid). Bake margins, head room, light halos scale with it. | `js/pixel/core.js`, `buildings.js`, `pixel_art.js` |
| Palette | Ten new time-of-day keys: navy/magenta nights, teal-violet dawn, smog-gold day, orange golden hour. New fields `neon` (signage glow level, never 0) and `smog`. | `js/pixel/tod.js` |
| Sky | 18-stop banded gradient with dithered edges only at band seams; smog halo round the sun; moon halo; fewer stars near the horizon. | `js/pixel/sky.js` |
| Backdrop | New screen-space parallax layer between sky and world, rendered at art resolution into an RT: far arcologies + orbital tether, mid/near skylines with lit windows and neon, smog streaks and haze bands, night searchlights, sky traffic; sea/desert/hills/industry cross-fade by zone. Does not scale with zoom. | `js/pixel/backdrop.js` |
| Neon layer | Bakes have a third canvas `neon` (signage). `B.etext`, `npx`, `nrect`, billboards, blades, plaques, emblems, screens write there; it glows at `max(night, K.neon)`, with its own bloom. | `js/pixel/kit.js`, `pixel_art.js` |
| Dressing | Post-painter pass: rooftop clutter on flat roof runs (AC, vents, tanks, dishes, masts, stair huts, rails, holo boxes), side blades with words, AC boxes, drainpipes, grime streaks, vending machines. Amount per building kind (lab tidy, apartment busy). Avoids `B.signRects`. | `js/pixel/dress.js` |
| Reflections | Each bake makes a mirrored, rippled reflection of its lit street level; drawn in `PixelArt._reflLayer()` (inserted above `G.shadowLayer`, because the ground draws over buildings). Alpha = wetness (`night × 0.8` or rain) × light. | `kit.js` `Bake.reflectionOf`, `pixel_art.js` |
| Night tint | The skin multiplies `S.amb` (ambient from the palette) into sprites under layers marked `{amb: true}` (char, car, train, reflection). Graphics flagged `_pxLit`, and ADD blends, are exempt. | `js/pixel/pixel_skin.js` |
| Robots | `PL.Robot.drawCitizen` writes a pixel template into the citizen's own head/body/legs Graphics (head drawn in `body`, `head` left empty): visor helmet, halo orb (open weights), slit dome (MoE), egg-drone babies, ghost-steel retired, violet rumoured. Eyes/core/halo on an unlit glow child. Also called from 5 interior avatar factories via `PL.Robot.restyle`. | `js/pixel/robots.js`, `entities_gfx.js`, `interior_city_ai.js`, `interior_res_ai.js`, `interior_black_market.js`, `interior_metro.js`, `interior_bar.js` |
| Humans | `HumanAvatar.draw` ends with `PL.Robot.human`: same skin, hair, suit/tie, glasses, beard, hats, two readable eyes. | `robots.js`, `js/human_avatar.js` |
| Interiors | `PL.InteriorZoom` scales the interior layer by a pixel-exact factor (1.5–3), keeps the street level put, owns drag/wheel panning, pins the module's own drag (`minY = maxY`). Eases to 1 while tracking. `InteriorRes._viewSpan` culls through the full transform. | `js/pixel/interior_zoom.js`, `interior_manager.js`, `interior_res_core.js` |
| Interior light | Ceiling lamps with warm dithered cones and floor pools for `InteriorCity` floors (lab HQs, social strip), brighter at night, a few dead/flickering; a gentle grade filter on the interior layer. | `js/pixel/interior_light.js`, `interior_city_core.js` |
| Underground | Tunnel Graphics (the >30000-px-wide child of `undergroundLayer`) hidden and replaced by a 16-bay painted TilingSprite; pixel metro trains via `EntitiesGfx.buildTrainSprite` → `PL.Under.train()` (cabin behind riders, shell with window cut-outs in front); same train in station interiors; data pulses along the fibre trunk; shaded water/sewer pipes in `_stylizeGround`. | `js/pixel/underground.js`, `entities_gfx.js`, `interior_metro.js`, `pixel_art.js` |
| Painter fix | Several painters converted art px back to world px with a hard-coded 3 (`h * 3`, `w/2 - 50/3`, ...): DC server strips and fab cleanroom bands never drew on the 2px grid. Now `PL.ART`. Kit default floor height is `PL.FLOOR`. Fabs got scrubber stacks. | `facades_*.js`, `kit.js` |
| UI | `css/pixel-ui.css`, scoped to `html.px-ui` (set by `pixel_art.js` when the skin is on): square pixel frames, hard shadows, neon hover/focus. Same layout. Headlight cones warmer and fainter under the skin. | `css/pixel-ui.css`, `entities_gfx.js` |

### What a new agent must not re-break

1. **Never hard-code the art scale.** World ↔ art goes through `PL.ART` (or `q()`); floor and lobby heights through `PL.FLOOR` / `PL.LOBBY`. Sizes designed for the old grid can use `PL.S3`.
2. **Don't name a Pixi container property `emit`** (Pixi's event emitter). The backdrop uses `lit`.
3. **Reflections live in `_reflLayer`**, not in the facade root: the ground Graphics draws after `bldLayer` and would hide them. `beginBuild` empties that layer.
4. **Signage goes to the neon canvas**, windows/lamps to `emit`. A painter's new sign should call `B.etext`/`npx` and push a `B.signRects` entry so the dresser keeps clear.
5. **Robots/humans draw into existing Graphics**; don't replace those objects (hit areas, animation and states point at them). The head Graphics stays empty under the skin; `refs.head.y` is still set.
6. **InteriorZoom pins `minY = maxY`** on modules after build. A module that needs its own drag back must opt out explicitly. Culling must use the full transform (see `_viewSpan`).
7. **`Environment.update` → `PixelArt.update(dp)` drives the look.** The promo capture patched `Environment.update` (not `G.getDayPhase`) so the look could follow a scripted clock while routines kept real time; overriding `G.getDayPhase` empties the city.
8. **Cache is `singularity-city-v560`.** `node tools/cachebust.mjs` regenerates `CORE_ASSETS` from `index.html` (new pixel files are picked up automatically). Leave `first-person/assets/models/*`, `landing_preview2.html`, `landing_preview3.html`, `pixel-lab/` untracked; `pixel-lab/` shares `js/pixel/*` (painters must still run without the game).

### Verified

- Node harness painting all 228 snapshot buildings: 0 failures, ~380 ms.
- Headless Chrome 1440×900, every district at noon / 18:00 / 23:00, 6+ interiors, the underground: no page errors.
- Panning the whole city: 59.6 fps pixel vs 59.7 classic, p95 frame 21.1 vs 19.7 ms.
- Production after each push: v559 and v560 served within two polls; the live site rendered the new art, interiors and tunnel.
- Lint: the only errors are 4 pre-existing `Bench` no-undef in `interior_res_ai.js` (from `d9ab16d`).

### Promo video (posted by the owner on X)

80 s, 1080p30, `~/Videos/SingularityCity-promo-2026-10.mp4`, music = `SingularityCity.mp3` from 0:26 so the drop (56.0 s, ~154 BPM, bar 1.558 s) hits the 0:30 cut. Captured from production with virtual time: a shim replaces `requestAnimationFrame` and `performance.now`, a director sets camera/clock/weather/interiors/captions per frame, CDP screenshots every 1/30 s, ffmpeg muxes. The director and capture scripts lived in the session scratchpad (not in the repo); recreate from this description if a re-cut is wanted.

### Not done / worth a look

- Interior lamps only in `InteriorCity`; other interiors get the grade and robots only. Interior props were not redrawn.
- Interiors still pan while tracking a model (the module camera takes over, zoom eases to 1).
- `B.smoke` puffs are recorded by painters but never rendered in the game.
- Datacentre/fab classic tickers ("AWAITING TELEMETRY") overlap their rooftop boards at some widths (pre-existing).
- Phones untested by me; the owner reports it runs well on theirs.

---

## This session (2026-09-29) — benchmark observatory and live scores

Owner brief, with a screenshot of the old observatory: a new citizen's Bench
tab arrives empty, and the table was ranking saturated 2023–24 scores (MusicGen
at 11% in gold) while the callout cards already named a frontier model. Track
the benches people argue about in 2026, and stamp real scores at birth. One
commit, `d9ab16d`, on `main`. No invented numbers: a blank cell means that
board has not published the score.

### What shipped

| Area | What changed | Where |
|---|---|---|
| Module | Catalog, name match, frontier index, citizen Bench tab, observatory HTML. Loaded immediately before `data.js`. `BM_M` and `function avgBM` live only here; `var BM` stays in `data.js`. | `js/benchmarks.js` |
| Birth | Hugging Face, OpenRouter, and ZeroEval call `Bench.attach` before save, then `attachAll` + `refreshOpen`. A scan sets `benchmarks` to null before verify, then attach-only. | `js/api.js` |
| Observatory | Seven boards. Default sort is the frontier index, best first, nulls last. Medals only on that sort. Phone uses the existing bottom sheet. | `js/ui.js`, `css/styles.css`, `bench-ov` in `index.html` |
| Arena | Text and code Elo from the public oolong daily snapshot (a top slice). Unmatched stored Elos render dim. Scan Elo returns early when `Bench.fed[id].ELO === 'arena'`. | `API.fetchArena` in `js/api.js`; timer 9s / 30min in `js/engine.js` |
| Verifier | Elo-scale keys accept 500–2500. Percent keys stay 0–100. Same split in the Netlify function. `submit-data` numeric map cap is 40. | `js/api.js`, `netlify/functions/_shared/model-verify.mjs`, `submit-data.mjs` |
| City score | Lab flagship, terminal, and the compute worker use `Bench.cityScore` (the index, else the mean of whatever hard benches exist, else 0). Elo stays out of that 0–100 number. The worker receives an `indexes` map. Building tip reads `FRONTIER`. | `js/engine.js`, `js/compute_worker.js`, `js/persistence.js`, `js/terminal.js` |
| Speech | Citizen quips, citizen of the day, and the AI-lab interior use `Bench.flexLine` when it has something to say. | `js/entities.js`, `js/citizen_of_day.js`, `js/interior_res_ai.js` |
| Proxy | `/api/arena/*` → `raw.githubusercontent.com` (ZeroEval's redirect was already there). CSP `connect-src` includes that host. Local `serve.py` proxies both prefixes. | `netlify.toml`, `serve.py` |
| Copy | How-it-works calls Bench a live frontier leaderboard. The university library names GPQA Diamond, SWE-bench Pro, Terminal-Bench, ARC-AGI-2, and Humanity's Last Exam. | `index.html`, `js/university.js` |

### The index

Weighted mean of **hard** benches only. Null unless at least two hard scores
exist, so one lucky number cannot sit at #1. `avgBM(id)` is `Math.round` of
that, or null. One decimal in the observatory.

Weights: SWE-Pro 1.5, Terminal-Bench 1.5, HLE 1.5, ARC-AGI-2 1.4, FrontierMath
1.4, SWE-bench Verified 1.2, OSWorld 1.2, SciCode 1.1, GPQA 1.0, BrowseComp 1.0,
τ-bench 0.9, Toolathlon 0.9, MCP Atlas 0.9, Apex 0.8, AIME 0.7. Knowledge
(MMMU, MMMLU, SimpleQA, CharXiv, MRCR, ScreenSpot) and the archive suite
(MMLU, HumanEval, MATH, AI2 ARC-Challenge, MGSM) have weight 0. Elo is a
separate scale and is not folded into the percent index.

Boards, and the column they open sorted by: Live (index), Agents (SWE-Pro),
Reasoning (HLE), Arena (text Elo), Knowledge (MMMLU), Archive (MMLU), No score
(newest release). Live columns are GPQA, SWE-V, SWE-Pro, HLE, ARC-AGI-2, AIME,
Terminal, Arena, plus the index and $/1M out. Models with exactly one hard
score appear as chips under the live table, top 18.

### Settled local city

Headless Chrome, after `API._zeroevalLoaded && API._arenaLoaded`. Do not treat
`Bench.status.zeModels` as "the board is ready": that flag flips at ingest,
before the per-model writes and `attachAll` finish, and an early open shows a
partial table (the first pass showed 7 live rows and a stored Elo of 1279).

- ZeroEval canonical board: 399 models. After attach: Live 178, Agents 156, Reasoning 755, Arena 33 (30 text plus stored leftovers), Knowledge 171, Archive 688, No score 130. About 900 models in `G`.
- **#1 GPT-6 Astra** (`gpt-6-astra`), index **94.3** on 3 hard benches, GPQA 96, ARC-AGI-2 95, arena text **1478**, code **1792**, output $50. Gold medal.
- Arena king: **Claude Opus 4.6 (Fast), Elo 1505**, live, snapshot date **2026-09-25**. Parentheticals are stripped, so "(Fast)" inherits the higher 4.6 variant. Accepted.
- Hardest-gap card: Terminal still separates, Claude Sonnet 4.5 at 50%, p90 47.1%. Best value inside the top 8: Grok-3 Mini, $0.30/1M in.
- Claude Opus 4.7 (`claude-opus-4-7`): index 74.2 on 6 hard, arena text 1502. Claude Fable 5: 78.8. Claude Mythos Preview: 81.9 on 5 (GPQA 94.6, SWE 93.9, SWE-Pro 77.8, HLE 64.7), no arena Elo. Kimi K3: 72.2, arena 1488 / code 1660. Gemini 3.1 Pro (`gemini-3.1-pro-preview`): index 67 on 9, arena 1487. It matches because the stored id contains `preview`.
- **Claude Opus 5.5** (`anthropic_claude_opus_5_5`): SWE-Pro **89.9** only, so the index is null. It leads Agents and shows as a one-score chip. Arena text 1509, code 1827.
- **Grok-3 is #2 at 88.2** from GPQA 84.6 + AIME 93.3, above Mythos Preview's five harder benches. AIME's weight is already 0.7. The specialist boards show the split. Leave the formula unless the owner asks.
- Scored Bench tab checked on Grok-3: frontier 88.2, rank 2 of 178, grouped bars, archive suite labeled as older, no history chart. Empty tab checked on Llama 3 Euryale 70B v2.1: names the feeds that were checked and stops.
- Phone 390×844: sheet about 371×717, title on screen, cards stacked, table scrolls sideways. Dismiss the Daily Briefing (SKIP TODAY) or it covers the bottom of the sheet. That modal predates this change.
- Headless Chrome needs WebGL: `--ignore-gpu-blocklist --enable-webgl --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader` and a fresh `--user-data-dir`. `--disable-gpu` makes Pixi throw "Unable to auto-detect a suitable renderer." Do not `pkill` a pattern that also appears in the node driver's command line.

### What a new agent must not re-break

1. **Never invent a score.** The fake Arena sparkline (current Elo minus 60 / 25 / 10, plus 5) stays deleted. `eloChart` is still destroyed at the start of `panelTab`.
2. **`benchmarks.js` is the only owner of `BM_M` and `avgBM`.** These are classic scripts in one global scope; redeclaring either throws. It must stay before `data.js` in `index.html` and in `sw.js` `CORE_ASSETS`.
3. **HumanEval is not SWE-bench. Archive `ARC` is the 2018 AI2 ARC-Challenge, not ARC-AGI-2 (`ARCAGI`).** MMMLU stays distinct from MMLU. GPQA Diamond aliases to GPQA. AIME 2025/2026 alias to AIME.
4. **One hard score does not rank on Live.** Opus 5.5 stays a chip and the Agents leader until ZeroEval publishes a second hard score.
5. **No model-version ceiling.** A `/gpt[6-9]/` pattern once blocked the real GPT-6 Astra, and db-maintenance deleted it again. GPT-6 Astra, Claude Opus 5.x, Fable 5, Gemini 3.x, Grok 4.x, and Kimi K3 are real as of 2026-09-29.
6. **The arena-Elo guard is in the caller**, `elo_updates`: return when `Bench.fed[id].ELO === 'arena'`. `writeScores(..., { overwrite: true })` will replace the number. Do not "simplify" the guard away.
7. **`fetchZeroEval` always uses** `/api/zeroeval/leaderboard/models/full?justCanonicals=true`. Direct `api.zeroeval.com` returns 200 with no `Access-Control-Allow-Origin`. Arena on localhost still fetches `raw.githubusercontent.com` (GitHub sends CORS); a deployed host uses `/api/arena/oolong-tea-2026/arena-ai-leaderboards/main/data/`. Snapshot path must match `^[\w.-]+$`. The agent board has no `score` key; skip it. The code file is `code.json` (`webdev.json` 404s).
8. **Elo 500–2500 is checked before the trusted-source return**, in both verifiers. A code Elo near 1800 used to fail `v > 100` and delete the whole citizen. Cloud saves strip `_src`, so the next load hit that check. `submit-data` selftest covers ELO_CODE 1750 accepted, GPQA 140 rejected, ELO 80 rejected (18 pass, 0 fail).
9. **`cityScore` is the only 0–100 lab number.** Do not fold raw Elo back in with `(ELO-1000)/4.5`. Kardashev and the AI Index already average `avgBM` against a ceiling of 100; they were left alone. The holomap's per-lab "frontier star" still adds Elo + `avgBM`. Left on purpose.
10. **Name match.** Parentheticals are deleted. Digit-hyphen-digit becomes a dot first, so Arena `claude-opus-4-7-high` matches `Claude Opus 4.7`, while canon keeps the dot so `4.7` does not equal `47`. A trailing effort token (`high`, `xhigh`, `max`, `low`, `medium`, `med`, `minimal`, `thinking`, `nothinking`, `adaptive`) strips only when it is last. `fast` is not an effort token. Do not strip `preview`, `instruct`, `mini`, `flash`, or `turbo`. `gpt-4o` must not match `gpt-4o-mini`.
11. **Do not write every refresh back to Supabase.** Leaderboard values overwrite the same key and do not wipe keys the feed lacks. The first HF fetch can save births before ZeroEval has loaded; later `attachAll` fills memory only.
12. **No new columns without a feed.** LiveCodeBench, MMLU-Pro, and ARC-AGI-3 are not in the catalog.
13. **NPC gate is unchanged.** No arch, no benchmarks, no phase, and no `_src` still opens the NPC panel, which has no Bench tab. Real births have one of those; `selectModel` then calls `Bench.attach`. The caller must switch to the Bench tab itself: `selectModel` ends on the info tab.
14. **Cache is `singularity-city-v558`.** Bump with `node tools/cachebust.mjs` only after a later edit that clients must pick up. Do not run `tools/build.mjs` locally. Leave `first-person/assets/models/*`, `landing_preview2.html`, `landing_preview3.html`, and `pixel-lab/` untracked. `pixel-lab/` shares `js/pixel/*` with the skin; see the pixel session below.

### Verified

- `node --check` on the touched scripts, `python3 -m py_compile serve.py`, submit-data selftest 18 pass / 0 fail.
- Local headless Chrome, desktop 1440×900 and phone 390×844, after both feeds finished: live count 178, Astra first with GPQA and ARC-AGI-2, Agents chip selected, search kept focus, scored Bench tab, empty Bench tab, source footnote. No leftover console errors after the favicon filter.
- Production at wrap time: `https://singularitycity.net/sw.js` is `singularity-city-v558` and lists `/js/benchmarks.js`; the live `index.html` references `js/benchmarks.js?v=558` and the "live frontier leaderboard" line. The click-through above was local, before the push. The playtest server on 8931 was stopped after the push.

### Not done / worth a look

- First Person still uses its older static roster.
- Arena is a top slice of the oolong snapshot, not the full Arena site. Unmatched stored Elos can win the king card only when no live match exists.
- Grok-3 at #2 from two scores is intentional until the owner says otherwise.
- Holomap lab "frontier star" still adds Elo to `avgBM`. The interior bench quip calls `flexLine` twice; harmless.
- On a specialist board, the first click of the column you landed on sets the sort rather than flipping it, if `_benchSort` is still `index`.
- The Daily Briefing modal can cover the bottom of the phone bench sheet.

---

## Previous (2026-09-29) — the 2D city in lofi pixel art

Owner brief: redraw the 2D city in the style of https://loficities.com/, starting
from a Grok prototype in `pixel-lab/`. **An art swap only**: "every freaking
detail" of placement, dynamic tower heights, routines, the underground and the
interiors had to stay exactly as it was. One art pixel = **3 world px**. Owner
calls along the way: default zoom 1.0 (every art pixel exactly 3 screen px), keep
the pixel name signs, move tickers and labels to the pixel font too, sun and moon
keep moving with the real clock, citizens get two readable eyes. 21 commits,
`9569faa` → `4032acd`, fast-forwarded onto `main` and pushed together.
Before/after page (private to the owner, classic vs pixel from identical cameras,
districts day/night, close-ups, weather, underground, all 29 interiors):
https://claude.ai/artifact/DqzjoapjyFgx9BV6rtfmz1

### What shipped

| Area | What changed | Where |
|---|---|---|
| Foundation | `PixelArt` bakes a pixel facade per building (base, emissive, bloom, snow layers) keyed on id, height and the live data it shows, lit per frame from a time-of-day palette. The classic facade `Graphics` stays in the container, hidden; overlays, tickers and hit areas are untouched. | `js/pixel/pixel_art.js`, `core.js`, `kit.js`, `tod.js`, hooks in `environment.js` / `space_environment.js` |
| Buildings | A painter for every building branch: lab HQs (monolith, campus podium, setback tiers, pagoda, euro, brutalist, following the classic insets), social strip, civic, housing, datacentres, fabs, VC Row, embassies, villas, backbone, agents, longevity, alignment cabins, suburbs, estates, forests, power, port, campus, court, jail, space. Names on pixel signs (never truncated: they wrap). | `js/pixel/buildings.js`, `districts*.js`, `facades_*.js` |
| Ground and sky | The ground `Graphics` renders at art resolution into strips with a paving/asphalt texture pass. A screen-space dithered sky with stars, a sun and a moon at its real phase on the classic's hours (sun 06:00–19:55, moon 19:55–06:00), the classic's weather skies, pixel clouds. | `pixel_art.js` (`pixelizeGround`), `js/pixel/sky.js` |
| Everything else | `js/pixel/pixel_skin.js` patches `PIXI.Graphics._render`: any vector `Graphics` under the entity layers, weather, shadows, seasonal overlay and **interiors** is drawn from a cached pixel texture of its own geometry. Citizens, cars, trains, ships, robots, furniture, lamp glows (GPU-dithered), rain, snow build-up, fog, lightning. | `js/pixel/pixel_skin.js` |
| Text | `PIXI.Text` outdoors and indoors switches to Silkscreen or Tiny5, whichever fits its original width, at 8 or 16 px (the only pixel-exact sizes); glows become hard shadows. Chat bubbles' bitmap font is baked in Silkscreen. | `pixel_skin.js`, Tiny5 added to the fonts link in `index.html` |
| Camera | `Camera.defaultZoom` replaces three hard-coded `0.8` restore fallbacks; pixel mode sets zoom, target and default to 1. | `js/camera.js`, `js/engine.js` |
| Switches | `?classic=1` (original art, zoom 0.8), `?classicSigns=1` (original name boards), `?classicText=1` (original fonts). | `pixel_art.js` |

### What a new agent must not re-break

1. **It is a skin.** No game logic may depend on it, and the classic `Graphics`
   must stay in each building container (hidden), because overlays, hit areas and
   references point into it. `?classic=1` must always give the untouched original.
2. **`PIXI.Graphics.prototype._render` is patched.** Under a skinned layer
   (`_pxSkin`: char, car, train, reflection, underground, shadow, interior layers,
   `fxGfx`, fog/flash/snow gfx, seasonal overlay) a `Graphics` never draws its vector;
   it draws `_pxAuto` sprite children rendered from its geometry, which stays
   intact for bounds and hit-testing. So: new vector art there is pixelised for
   free; masks are skipped (`isMask`); **don't `cacheAsBitmap` a container inside a
   skinned layer** (the first capture would be blank); `Graphics` redrawn every
   frame get a private texture (`_pxDyn`), clipped to the view when larger than it.
3. **The skin runs on its own ticker step** (`UPDATE_PRIORITY.LOW + 1`, just before
   render). The game loop skips `Environment.update` inside buildings, so nothing
   the skin needs per frame may live only there.
4. **Pixi 7.3.2's `extract.pixels()` corrupts translucent pixels** (it
   un-premultiplies into a `Uint8Array` without clamping: 50% red reads back as
   r = 1). Read back with `PixelArt._readPixels` (raw, premultiplied). Dithering is
   a shader (`DITHER_FRAG`), not a read-back.
5. **Bake cache keys carry the data a facade shows** (`PL.dataKey`, `dataKeyRow`,
   `dataKeyPower`, `dataKeyCampus`). A painter that starts reading new live data must
   add it to its key, or the facade won't refresh when the data changes.
6. **Text must fit.** `S.pixelText` measures the original width and picks the
   first of Silkscreen 16 / Tiny5 16 / Silkscreen 8 / Tiny5 8 within 8% of it. Keep
   `Tiny5` in the Google Fonts link. Pixel faces are only crisp at 8 and 16 px.
7. **The pixel sky mirrors the classic.** `WX_SKY` in `tod.js` copies
   `Environment.update`'s weather gradients, and the sun/moon use its 0.25 → 0.83
   schedule. Change one, change both. Interiors that show sky are the ones whose
   module has a `celestialGfx`; the skin hides that and their `starsLayer` every frame.
8. **Faces are recognised, not special-cased**: two identical tiny dots on one
   line inside a head rect become two pixels with one between them
   (`S.faces`). A new character drawn that way gets the same treatment.
9. **`js/pixel/*` is shared with `pixel-lab/`** (untracked look-dev page that
   loads `../js/pixel/`). Painters must run without the game (they guard
   `typeof SpaceRockets` etc.).

### Verified

- Headless Chrome (`--use-angle=gl`, Intel iGPU, 1440×900), pixel vs `?classic=1`:
  every district day and night, dusk, rain, storm, snow, fog, the underground,
  29 interiors; no page errors.
- Full-city pan: 59.4 fps pixel vs 59.3 classic, worst frame 28.7 vs 33.3 ms.
  Interiors 60 fps in both; a fresh interior is fully pixel in 0.06–0.11 s. Building
  rebuild 56 ms vs 84 ms (bakes are cached); ground rebuild 179 ms vs 11 ms (only on
  rezoning).
- **Production**, after the push: `sw.js` served `singularity-city-v557` on the
  first poll, `js/pixel/pixel_skin.js?v=557` returned 200, and the live site booted
  in pixel mode (227 facades, zoom 1, pixel text, 60 fps) with no page errors.

### Not done / worth a look

- **Real-device performance** is unmeasured (headless iGPU only). Watch the
  skin's texture cache (300–500 small textures in a busy view) on phones first.
- **Convention centre interior** was never seen (it exists only during conference
  weeks). It goes through the same generic skin.
- **Fine interior detail** (the tiny charts on HQ monitors, dense props) turns into
  colour blocks at 3 px; candidates for hand-drawn pixel touches if the owner asks.
- **Emoji icons** (🌮, ⚓, 👑…) stay smooth emoji.
- **Ground rebuild** is 179 ms on rezoning; could be chunked if it ever shows.
- **Not reviewed under the skin**: orbit mode, macro view, holomap overlays.
- Deliberate differences, already accepted by the owner: pixel signs are bigger
  than the classic boards; the pixel sun arcs up from the horizon (the classic's
  arc was upside down); the wind-turbine hub sits on the spinning blades (the
  classic's nacelle floated 24 px above them); the classic's parallax skylines stay
  removed (v516 note).

### Working on the pixel city headless (the tooling isn't in the repo)

- puppeteer-core with `executablePath: '/usr/bin/google-chrome-stable'` and
  `--use-angle=gl --enable-gpu`; load, wait ~4 s, `enterCity()`, wait ~12 s.
- The city clock follows the viewer's timezone, so set the hour with
  `page.emulateTimezone()`: pick a zone whose local time is the hour you want
  (at about 08:00 UTC, Asia/Karachi gave midday, America/Los_Angeles after
  midnight, Pacific/Noumea dusk). Pin weather with
  `setInterval(() => { Environment.weather = 'thunderstorm'; Environment.weatherIntensity = Environment.weatherTargetIntensity = 1; Environment.weatherPending = null; }, 50)`
  (it changes on its own otherwise); `Environment._snowAccum = 1` for snow cover.
- Camera on a building: `Camera.x = -x + G.vpW / (2 * z)`,
  `Camera.y = G.vpH * 0.72 / z - (G.groundY - 24)` with `Camera.zoom = Camera.targetZoom = z`.
- Interiors: `G.enterInterior(G.bldById[id])`, wait ~3 s, `G.exitInterior()`.
  Hide `#sc-briefing-prompt, #sc-briefing-share` for clean shots.
- `PixelArt.Skin.stats` / `.queue.size` show conversion progress; lossless WebP
  keeps pixel screenshots tiny (~30 KB a frame).

---

## Previous (2026-09-23, evening) — First Person overhaul

Owner brief: overhaul FP with as many threejsassets packs as fit, "blow me away,
fix everything". Follow-up: make the AI models look robotic, keep founders /
workers / staff human, then push. Nine commits, `5b424e3` → `0dfd8cf`, pushed
together. Before/after page (private to the owner):
https://claude.ai/artifact/KLLC52JRX1z9rshYLpzbUx

### What shipped

| Area | What changed | Where |
|---|---|---|
| Asset pipeline | Kit registry as plain data; `tools/fp_kits.mjs` Draco-compresses every registered kit from the local pack dumps into `first-person/assets/kits/k1/`. 254 kits, 68 MB raw → 5 MB shipped. The raw pack GLBs left the git index (still on disk). | `js/kit_registry.js`, `tools/fp_kits.mjs` |
| New packs | Downloaded Home Office, Library, Wasteland, Bathroom, Halloween, Dungeon, Swamp & Bayou, Haunted Parlour, Viking Fjord into `_packs/` (untracked). City and Metropolis were already current. Characters are **not** available through the API. | `assets/models/_packs/` |
| Night | Kit towers light their windows from the packs' own palettes (`aGlaze` codes) instead of going pitch black; glazing reflects the sky by day; houses light some panes; anything with an over-bright vertex colour (baked flames, bulbs) glows. Moonlit fill. A pool of real SpotLights follows the player onto the nearest lamp heads. | `js/assets.js` (glazing shader), `js/world.js` (`_buildLampLights`), `js/weather.js` |
| Sky | Sky shader now ends in tonemapping + colorspace chunks: no pale horizon band, no navy noon, deep-navy night with a thin light-pollution band. | `js/weather.js` |
| Streets | `streetscape.js`: kerb furniture per district character, bus stops, parked cars in the kerb lane, pocket plazas, rooftop billboards, suburban yards, the Underground as a wasteland, desert Space Zone, the beach. LED street-light kit at the kerb. | `js/streetscape.js`, `js/world.js` |
| Interiors | `furnish.js` kit layouts for lobby / open plan / boardroom / home / academic / café / VC / mission / power / nursery / warehouse / conference; bespoke rooms get kit desks, chairs, stools, plants via the shared `P` helpers. Exposure eases down indoors. | `js/interiors/furnish.js`, `js/interiors/kit.js`, `js/interior.js` |
| People | `people.js`: one human body plan (founders, workers in hi-vis, staff) and **robots for every AI model** — lab-coloured shell and shoulders, metal chassis, glowing core/visor, three heads (visor helmet, halo orb = open weights, slit-visor dome). Indoor figures are adult height and sit at desks and tables. | `js/people.js`, `js/citizens.js` |
| Seasons | Galungan penjor rebuilt (they drew as dashed lines into the sky); Halloween fetches the Halloween pack on demand (graveyard, jack-o'-lanterns, suburbia). | `js/seasonal.js` |
| Presentation | Attract mode: start panel turns to glass over a live skyline flyover. Bloom on High (or `?bloom=1`) via vendored r160 postprocessing. Desktop toasts stack under the clock. | `js/main.js`, `lib/postprocessing/`, `css/styles.css` |
| Fixes | Rain/storm "white orbs" (splash + precip points now clamp their pixel size). VC Row coin glows faint by day. | `js/wetness.js`, `js/weather.js`, `js/ambience.js` |
| Performance | Kit towers and trees are one InstancedMesh per ~1 km chunk (culled by camera and sun); sun shadow map redraws every other frame. Steady frame on the test iGPU went 22–23 ms → the 16.7 ms vsync cap. | `js/world.js`, `js/main.js` |

### What a new agent must not re-break

1. **Kits are immutable-cached for a year** (`/first-person/assets/*`). Never
   re-encode a kit in place: bump `KIT_VERSION` in `kit_registry.js` and re-run
   `node tools/fp_kits.mjs`. Adding a kit = registry line + run the tool +
   commit the new file; `test:fp:assets` fails on a missing shipped file.
2. **Never add `screen` to the glazing table.** Its day colour is the mullion
   charcoal (~30% of a tower); it lit every frame as a white wireframe.
3. **The sky shader must keep `tonemapping_fragment` + `colorspace_fragment`**
   or the horizon band and navy noon come back.
4. **`renderer.shadowMap.autoUpdate` is false.** The main loop sets
   `needsUpdate`; anything new that renders the scene outside it must too.
5. **The lamp light pool never changes size** (changing the light count
   recompiles every material). `World.lampSpots` has the pole (`x,z`) and the
   head (`hx,hz`); halos, pools and spot lights hang from the head.
6. **Furniture shares the kit geometry/material** (`userData.kitShared`); the
   room teardown skips those. Don't dispose them.
7. **Nothing tall at centre-back in a generic room**: the name board is at
   |x| < 108, y 65–92 on the back wall.
8. **The crowd is four InstancedMeshes** (human + three robot heads). A citizen
   carries `c.grp` / `c.mi`; recolour through `Citizens.setAllColor` (the
   Caturday egg does). Robots' glow is tint 4 in the walk shader.
9. **Who is a robot**: `bodyOf(c)` in citizens.js — founders and workers are
   human, every model is a robot. Indoors, `PROP.npc(..., { robot: true })`
   draws a robot; staff defs without it stay human.
10. **`npm install` prunes `puppeteer-core`** (it lives in node_modules without a
    package.json entry). Restore: `npm install --no-save puppeteer-core@25.7.0`.

### Verified

- `npm run test:fp` green (asset check now also asserts every kit is shipped and
  every furnish layout's kits are registered).
- Headless Chrome (`--use-angle=gl`, Intel iGPU, 1440×900) screenshots of day,
  dusk, night, rain, storm, snow; every furnished room type; free-fly, orbit,
  x-ray, holomap, tour, metro and terminal smoke-tested with no page errors;
  touch layout at 844×390.
- **Production**, after the push: `people.js` served with the robot code, kits
  returned 200, and `?autostart=1&bloom=1&inside=cafe` booted with 264 kits,
  a furnished café, bloom on, 58 street prop sets and all four body groups; no
  page errors besides the usual dev-only `/api/geo` 404.

### Not done / worth a look

- **Real-device performance** is unmeasured (headless iGPU only). Citizens cost
  ~446 (human) / ~700 (robot) triangles each; streetscape and furniture are
  proximity-uploaded. If a phone struggles, look at citizen counts on `low`
  first.
- **Remaining box-built rooms**: gym, arena, datacenter racks, embassy and
  other bespoke floors only get the shared-helper upgrades.
- **Occupants appear only once citizens arrive**, so a building entered at boot
  can look empty for a minute (pre-existing).
- **Packs downloaded but unused**: Bathroom, Dungeon, Swamp & Bayou, Haunted
  Parlour, Viking Fjord (and most of Wasteland / Library).
- The yellow VC deal-flow "packets" were never investigated beyond the coins.
- Returning FP visitors hold `/first-person/js/*` for up to an hour
  (`max-age=3600`), so a mixed old/new module set is possible for that window
  right after a deploy. Pre-existing posture.

### Working on FP headless (the tooling isn't in the repo)

- Screenshots/benchmarks were puppeteer-core scripts with `executablePath:
  '/usr/bin/google-chrome-stable'` and `--use-angle=gl --enable-gpu`. Boot with
  `?autostart=1&dp=<phase>&sim=<s>&inside=<id>&festival=<id>&wx=<state>&bloom=1`.
- `.shots/kitview.html` (gitignored) renders a grid of pack GLBs:
  `/.shots/kitview.html?pack=<pack>&cols=6&n=<file,file,...>`.
- GPU vs CPU: time per-module `update()` and `renderer.render` inside the real
  rAF loop; `gl.finish()` timing was unreliable under ANGLE.
- The owner's clock is Asia/Makassar, so FP shows **Indonesian festivals**
  (Galungan today, Nyepi, etc.). Force others with `?festival=`.

---

## Previous (2026-09-23, night) — housing towers crawled at night

**Shipped in `598fa17`.** Owner report: the 2D city "crawls to unusable" inside
the housing buildings, worst at night when every model is asleep in them.

Measured in headless Chrome (Intel iGPU, 1440×900), 02:30 city time, 898 models,
same residents in bed for both builds:

| Tower | Asleep | Before | After |
|---|---|---|---|
| `res_us` (101 floors) | 362 | 19 fps · render 43 ms · update 7.8 ms | 60 fps · 1.6 ms · 0.4 ms |
| `res_eu` (75 floors) | 272 | 33 fps · 24 ms · 4.4 ms | 60 fps · 1.6 ms · 0.35 ms |
| `res_cn` (46 floors) | 135 | 56 fps · 12 ms · 1.6 ms | 60 fps · 1.5 ms · 0.2 ms |

A tower gets one floor per four residents, so it grows with the model count. What
was wrong, worst first:

1. **Lift floor lights were floors².** Every door had one `Graphics` per floor,
   all cleared and redrawn every frame: 10,404 of them in `res_us`, for dots a third
   of a pixel apart. Now `LiftIndicators` (`js/city_elevator.js`) draws one strip,
   shares its geometry across every door, and moves a single green dot when the
   car changes floor. The lab-HQ `CityElevator` had the same code. `bld_alibaba`
   (49 floors) went from 50 to 59 fps, with render time 16 → 7.3 ms.
2. **No culling.** All 100 floors were drawn, transformed and hover-hit-tested every
   frame (every prop is `eventMode: 'static'` for tooltips), with about 10 on screen.
3. **Three `PIXI.Text` per sleeper** for the "z z Z": 1,087 private canvases and GPU
   textures, which also outlived the interior (the exit path destroys with
   `texture: false`). Now three shared white glyph textures, tinted per lab.
4. **`getAct` + `G.models.indexOf` for every resident, every frame.** That's
   362×60 schedule lookups a second, each allocating dates and a context object;
   GC was 17% of the frame. The schedule is now asked twice a second per resident,
   staggered, with the model index cached.
5. `InteriorRes.build` only *detached* the old scene. Following a model rebuilds
   in place on an activity change, so every rebuild leaked the whole tower. It now
   destroys the old one.

### What a new agent must not re-break

1. **Floors are culled** (`InteriorRes.cull()`, called by `Interior.update` *after*
   the tracking camera). Each floor's pieces live in `InteriorRes._bands`:
   `roomGfx`, `floorLine`, the basement door, both lift doors and the indicator strip
   as `items`, and the floor's `floorCont`. **Anything new drawn per floor must join
   its band** (or go in `floorCont`), or it will still be drawn on every floor.
2. **Avatars stay parented to their own floor's `floorCont`**, even while crossing
   the lobby or riding the lift. `cull()` keeps a floor's container visible while
   one of its residents is on screen somewhere else. If you ever reparent avatars,
   update `cull()`.
3. **Two margins:** residents within **480px** of the viewport animate (`update`),
   floors within **80px** are shown (`cull`). Keep the first wider, or a floor can
   appear before its sleepers are posed.
4. **`working` residents:** `_sleeping` is the cached schedule answer; `_posed` is the
   pose actually applied. Getting into or out of bed is applied on every floor;
   only the z-bob and the awake idle are skipped off screen.
5. **The z sprites share `InteriorRes._zTex`.** Never destroy the interior tree with
   `texture: true`, and don't `clear()` or draw into a `LiftIndicators` strip: its
   geometry is shared by every door.

### Verified

- Pixel A/B against a pristine `git archive HEAD` copy, with the ticker stopped and
  `Math.random`, `G.tick` and day phase pinned. `res_us` / `res_eu` at night are
  **pixel-identical** at bottom, middle, top and after a far jump. The only
  differences were speech bubbles (random) and `res_cn` lobby visitors, and a HEAD vs
  HEAD control run differs by the same amount.
- Scroll/jump fuzz, 235 frames: nothing on screen culled. Tracking Grok 4.7
  from the street to floor 99 at 1.45× zoom, 4,718 frames: none. A floor-96 resident
  riding down and walking out across the lobby: shown for all 475 frames, and its
  floor re-culled after. Founder estate: CEO goes to bed with sprite z's. Lab-HQ lift
  dot matches the car on 38 floor crossings. Eight enter/exit cycles: geometries flat.
- `npm run lint` clean, `npm run test:fp` green, touched files Prettier-clean.
- **Live, after the push:** same probe against `singularitycity.net` at 02:40 city
  time. `res_us` (103 floors, 364 asleep): 58 fps (at the cap), render 1.5 ms,
  update 0.39 ms. `res_eu` (255) and `res_cn` (182): 60 fps. Mid-tower matches.

### Not done

- **Lab HQs (`InteriorCity`) have no floor culling.** Fine at 49 floors after the
  lift fix; give them bands too if they grow.
- **The lift is one car, first-come first-served.** 300 residents leaving at once
  take minutes to reach the lobby. This predates the fix; the exterior's 30 s
  stuck-teleport hides it outside.
- The roof-sign `PIXI.Text` is still one texture per visit until PIXI's texture GC
  reclaims it (~1 min). Harmless.
- **Noticed, not investigated:** on production,
  `api.rss2json.com/v1/api.json?rss_url=…venturebeat.com/category/business/feed/`
  answers **HTTP 422**. That proxy feeds the VC Row deal ticker (MAINTENANCE.md Part A,
  `API.vcDeals`), so the ticker may be on its fallback lines. Unrelated to this fix.

### Measuring the 2D city headless

Headless Chrome only gets the real GPU with `--use-angle=gl` (Vulkan gave no WebGL
here). Day phase is the wall clock, so pin night with a timezone override. If you
wrap a ticker-driven function, **return its value**: `Entities.update` returns the
occupancy map. A wrapper that throws stops PIXI's ticker for good, while
`requestAnimationFrame` keeps running, so the page looks alive.

### Next session — First Person Mode

The owner plans to work on First Person Mode later today in a fresh session. The
goal wasn't set, and nothing in FP was reported or changed this session; this fix is
2D-only.

Useful if it turns to performance:

- FP pins the clock itself: `/first-person/?autostart=1&dp=0.1&debug=1`
  (`dp` sets `G.fixedPhase`, `first-person/js/main.js:364`). No timezone override
  needed. The same `--use-angle=gl` flag applies, and Three.js reports draw calls
  in `renderer.info`.
- From a read of the code (**not measured**): FP interiors draw **one floor at a
  time**. Occupants come from `_occupantsFor(b)` (`first-person/js/interior.js`
  ~1113), are spread across floors by `_floorShare`, and are capped by the room's
  `spots` (the default scatter has at most 12). So FP shouldn't have the 2D tower's
  "every floor, every resident" growth. Each occupant is still its own merged mesh,
  `MeshStandardMaterial` and 256×72 name-plate canvas texture (`nameTex`,
  `first-person/js/interiors/kit.js:185`), all built on entry.
- What made the 2D towers slow, worth checking first in any view: work per floor
  that is floors², off-screen content that is still drawn, a private texture per
  person, and schedule lookups every frame.

---

## Previous (2026-09-23) — phone minimap

**Shipped in `a473c3a`.** Owner sent a landscape screenshot: the MAP panel's zone
list was a cramped two-column mush. Pushed for the Netlify deploy.

The city on a phone is landscape (portrait is the rotate overlay). A landscape
phone is often **wider than 768px**, so the old `@media (max-width: 768px) { #minimap { display: none } }`
never applied, and `.is-mobile` only added a max-height. Players got the desktop
map: **290px wide, 7px labels, `white-space: nowrap`**. iOS text inflation plus
grid `min-width: auto` made the columns collide and clip. That is the screenshot.

### What a new agent must not re-break

1. **Who gets the phone map.** `body.map-phone` comes from `_syncMapLayout()` in
   `index.html` (runs before the minimap is parsed, and again on resize /
   orientation). It is on for a real phone (`_isMobile`), a viewport **≤768px**,
   or a **short landscape** window (`width ≤ 1200` and `height ≤ 560`). Do not
   go back to hiding `#minimap` under 768px. Do not key this only off
   `max-width: 768px` — that misses the phones that were broken.
2. **The list only scrolls if the panel has a definite height.** `max-height`
   alone does not shrink a flex child. Expanded phone map sets
   `height: calc(100dvh - 112px)` (vh first, dvh second so dvh wins when
   supported). Portrait (`orientation: portrait`) uses `top: 116px; height: auto`
   with the existing `bottom`, so the stretched box is still definite and the
   panel clears the wrapped toolbar. `body.map-phone .mm-zones` is
   `overflow-y: auto; min-height: 0; flex: 1 1 auto`.
3. **`touch-action`.** `html, body` is `manipulation`, not `none`. Effective
   touch-action is the **intersection up to the root**, so `none` on `body`
   disables `pan-y` on the zone list no matter what the list says. `.vp` stays
   `touch-action: none` (city pan/pinch). `.ctrls-scroll` is `pan-x`.
   `.mm-zones` is `pan-y`.
4. **Labels.** Phone zones are 12px (11px under `max-height: 390px`),
   `white-space: normal`, `min-height` 38px / 32px, color `#d5d7e4`. Grid is
   `repeat(2, minmax(0, 1fr))` and `.mm-zone` has `min-width: 0` on desktop too,
   so nowrap text cannot blow the columns out. Desktop type stays **7px / 290px**.
   Do not put the phone font size on the base `.mm-zone` rule.
5. **Canvas buffer is 640×96**, CSS height 40px desktop / 56px phone (40px on
   short landscape). Floor height is `floors * (cH / 20)`, band pad is 20% of
   `cH`, ground margin is 10%. At `cH = 40` that matches the old 2px-per-floor /
   8px pad / 4px ground. Do not hardcode those pixel constants again.
6. **Zoom pill** (`js/camera.js`) measures the minimap rect. It used to assume
   80px collapsed / 290px open, which overlaps a 440px phone map. It hides when
   `rect.left < 72` so a wide map cannot shove it off the left edge. The pill
   is still only created when `innerWidth >= 769`.

### Where to look

| Piece | File |
|---|---|
| `map-phone` class | `index.html` `_syncMapLayout()` |
| Phone panel, zones, touch-action | `css/styles.css` (`body.map-phone #minimap` and `html, body`) |
| Strip drawing | `js/macro_view.js` `updateMinimap()` |
| Zoom pill position | `js/camera.js` `_updateZoomPill()` |
| Canvas element size | `index.html` `#mmCanvas` (640×96) |
| Cache | `sw.js` `CACHE_NAME` `singularity-city-v555` |

### Verified locally (not against production)

Playwright + system Chrome, iPhone UA, city booted, orientation overlay hidden,
map forced open:

| Viewport | Result |
|---|---|
| 844×390 and 667×375 landscape | `map-phone`, no clipped labels, panel between toolbar and ticker, touch-drag scrolled the list |
| 390×844 portrait | Map starts at y=116, below the wrapped toolbar. In real play the rotate overlay covers this. |
| 1440×900 desktop | `map-phone` off, map stays 290px / 7px |

Clicking Embassy Row moved `Camera.targetX` from `0` to about `-35000`.

### Not done

- Live Netlify was **not** checked after the push. Confirm v555 and a readable
  map on a phone. Hard-refresh; the service worker matches with `ignoreSearch`,
  so an old `singularity-city-v554` cache serves stale CSS until the new worker
  activates.
- First Person's own `#minimap` (`first-person/`) was not part of this. The
  screenshot was the 2D city MAP panel.
- Untracked kit dumps are still on disk. Do **not** `git add -A`. See the
  kits section below.

---

## Previous (2026-09-12 → 13) — modular kits into First Person

**Shipped in `aa93abc`.** Owner playtested locally, then pushed.

Goal: wire threejsassets kits into FP **without** baking a city mesh.
`City.layout()`, colliders, canvas signs, metros, helis, robots, box-people stay.

### What a new agent must not re-break

These failed in playtest and were fixed. Do not "improve" them back:

1. **Scale.** Files are 1 u = 1 m; world is **10 u = 1 m**. Never stretch each
   axis independently (toys). Never `max(sy, min(sx,sz))` on a short-wide kit
   (NVIDIA's 8.6 m convention hall became a 105 m slab, bigger than a cell).
   Current rule in `kitScale()`: fill the lot in **plan**, cap height, then
   **shrink the collider to the mesh** (`World._fitCollider`). Invisible walls
   were the lot box around a tiny hut.
2. **Metros and warehouses stay procedural.** The metro headhouse kit is a 4 m
   kiosk (giant T-sign + floating roof). The dock-warehouse kit has a pit under
   y=0 (Merge Yard floor trap).
3. **Harbour.** Beach plane is 320 wide centred at `SEA_X+20`, so sand covers
   **out to `SEA_X-140`**. Boats must sit west of that. Do not stack canal
   tiles / dock modules / palms on the timber pier. Ships berth at
   `SEA_X - 220`, not `-100` (hull was on the sand).
4. **Ocean shader.** Three r160 uses `vMapUv`, not `vUv`. A custom Phong
   compile-fail made the water vanish and fly-mode showed the **meadow**.
   Water is stock Phong now. Countryside west edge is clipped at `SEA_X`.
5. **Do not dump kits.** Mall-block stairs fused infill. Interior GLBs at
   true-metre scale sat as toys on 3×-authored furniture. `_dressKitProps`
   scatter was removed. Bespoke interiors (bar, embassy, jail) must not get
   extra DJ booths / consoles.
6. **Draw calls.** One `InstancedMesh` per kit. Unique GLBs for VC Row + HQs;
   infill reuses those kits. No bloom / SSAO / transmission.

### Architecture (where to look)

| Piece | File |
|---|---|
| Registry, `kitScale`, landmark map, trees | `first-person/js/assets.js` |
| Place kits, colliders, harbour, rail siding, ocean, villas | `first-person/js/world.js` |
| Load kits before `World.build()` | `first-person/js/main.js` |
| Cars, VIP SUVs, **procedural blimps** | `first-person/js/traffic.js` |
| Home living-room layout | `first-person/js/interior.js` |
| AI Index monument | `first-person/js/kardashev.js` |
| Ship berth X | `first-person/js/ships.js` `_berth()` |
| Importmap | `first-person/index.html` + `tests/hooks/three_resolver.mjs` |
| Draco decoder | `first-person/lib/draco/` (worker-src includes `blob:` in `netlify.toml`) |

Kits load from `_packs/<pack>/glb/individual/*.glb`. 10 world units = 1 metre.

### What shipped visually

- Landmarks (VC Row, lab HQs) + medium/high infill as kit towers
- Suburbia / Founders' Heights: house kits; villas scaled up (~2-storey, not 3 m dolls)
- Kit cars + founder SUVs; procedural **airship** blimps (lathe, fins, gondola, props)
- Sidewalk + park trees (metro street / columnar / park / oak / pine / palms by biome)
- Yacht / speedboat / floatplane in water; diesel + two flats on **land** at the port
- Ocean: deep blue Phong + normals + foam; not a green field

### Tests

`npm run test:fp` (includes new `test:fp:assets`). Keep it green.

### Local leftovers (do NOT `git add -A first-person/assets`)

On disk but **untracked**: full pack dumps (bedroom, bunker, city catalog, farm
barns, cozy cottages, railway extras, vice-beach extras, `components/*.tsx`,
duplicate `buildings/` `street/` `vehicles/` copies). Production only has the
~11 MB of GLBs `assets.js` lists. Zips are gitignored.

**TJA key:** `first-person/assets/models/.tja_key` is gitignored. Never print it,
never commit it. Next download:

```bash
python3 -c "print('key file', __import__('pathlib').Path('first-person/assets/models/.tja_key').exists())"
```

Then POST `https://threejsassets.com/api/download` with `licenseKey` + `packSlug`
or `assetSlug`. 307 → GET the Location (do not POST to the CDN).

### Reasonable next work (not started)

1. Confirm live Netlify actually serves kits (hard-refresh; landmarks at night;
   colliders; metro enter; fly). If boxes, cachebust `index.html`.
2. Interior audit beyond generic homes (embassy villas, labs, worker housing).
   Scale kit furniture to **interior-local** widths, not metres.
3. Optional kits still on disk: hedges, plaza planters, more Vice Beach neon,
   railway station (do **not** replace procedural metros).
4. Character Studio humans still `not_entitled` — keep box-people / robots / helis.
5. Delete `.tja_key` if downloads are done.

### A note for next time — this branch had diverged

The kits push rebased over `586b7ff` (news bans / Astra). `RESUME.md` conflicted;
keep both stories. Do not force-push `main`.

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
