# Singularity City — First Person

The Three.js first-person city, served at **`/first-person/`**. Same deploy,
same origin, and same saved progress as the 2D Pixi city at the site root.

Public entry is still 2D. First Person is reachable **only** from the in-city
toolbar button (`🚶 FP`), injected by [`js/sc_integrated_bridge.js`](../js/sc_integrated_bridge.js).
There is deliberately no landing-page CTA.

---

## Run it locally

`serve.py` lives at the repo root and serves the whole site, so the 2D city and
First Person sit at the same relative paths they do in production — which is the
only way to exercise the round trip between them.

```bash
npm run serve
```

| | |
|---|---|
| 2D city (public entry) | `http://127.0.0.1:8931/` |
| First Person | `http://127.0.0.1:8931/first-person/` |
| Skip the start screen | `http://127.0.0.1:8931/first-person/?autostart=1` |

Hard-refresh after code changes: **Ctrl+Shift+R**.

Don't use `npx serve` for FP work: `python -m http.server` and friends are
single-threaded, so one browser keep-alive connection hangs every other request
and a second tab dies with `ERR_EMPTY_RESPONSE`. `serve.py` threads per
connection and adds the `/__shot` endpoint below.

### Boot params

`?autostart=1` · `?sim=<sec>` fast-forward · `?dp=<0..1>` freeze time of day ·
`?wx=<state>` force weather · `?inside=<buildingId>` boot into an interior ·
`?festival=<id>` · `?allregions=1` regional festivals · `?x= &z= &yaw=` teleport ·
`?debug=1` log draw calls · `?tutorial=1` force it.

### Screenshots without a browser pane

`serve.py` has a dev-only `POST /__shot?name=foo` that writes `.shots/foo.jpg`
(gitignored). From page JS:

```js
G.renderer.render(G.scene, G.camera);
const url = G.renderer.domElement.toDataURL('image/jpeg', 0.86);   // BEFORE any await
await fetch('/__shot?name=foo', { method: 'POST', body: url });
```

**Serialise the canvas before any `await`**, or you capture a cleared buffer. A
blank or all-black frame is almost always this, not a render bug.

---

## Tests — all eight must stay green

`test:fp:assets` also checks that every registered kit has a shipped file and
that every furnish layout only asks for registered kits.

```bash
npm run test:fp
```

Run them through npm, not `node first-person/tests/<file>.mjs` directly.
`test:fp:parity` and `test:fp:interiors` reach app modules that import the bare
specifier `'three'`, which only the browser importmap resolves; the npm scripts
add `--import ./first-person/tests/hooks/three_resolver.mjs` to map it the same
way. Without the hook both die with `ERR_MODULE_NOT_FOUND` — that is the harness
missing, not a real regression. Keep the hook's table in sync with the importmap
in [`index.html`](index.html) if another specifier is ever added (`GLTFLoader`
and `DRACOLoader` live there alongside `three` and `BufferGeometryUtils`).

---

---

## Touch / mobile

FP was unplayable on a phone until 2026-08-24, for one reason: the controller
was gated on **pointer lock**, which no mobile browser implements. The city
booted, rendered, and then stood still behind a pause menu.

`js/touch.js` supplies the other half. The contract:

- **`G.touchMode`** is decided once, at the top of `boot()`, from
  `detectTouch()` — coarse pointer *and* a real touchscreen. `?touch=1` /
  `?touch=0` force it, which is the only way to exercise the layer from a
  desktop browser (device emulation fakes touch events but not always the
  media queries).
- **`Player.inputActive`, not `Player.locked`,** is the gate on movement,
  jump and head-bob. `locked` is now only about the mouse.
- **The stick writes `Player.moveX/moveZ`** and the walk/jump/interact
  buttons dispatch real `KeyboardEvent`s. Camera modes do **not** go through
  fake key events: on several mobile WebKits `event.code` never sticks.
- **Movement input is clamped, not normalised.** Normalising forced every
  input to full speed, which is right for a key and wrong for a stick: a half
  push must be a half walk. Keyboard diagonals still cap at 1.
- **Free-fly has a HUD button** (🦅 in `#tcTop`, `data-act=fly`) that calls
  `G.flyModeSys.toggle()` directly. The other keyboard-only modes (orbit,
  tour, x-ray, holomap, terminal) plus a second Free-fly entry live in the
  pause grid via `Touch._injectPauseModes`, which also calls the mode APIs
  rather than synthesising keys.
- **`body.sc-touch`** turns on the whole CSS layer at the bottom of
  `css/styles.css`. The width/height media queries below it are NOT gated on
  it: a 700 px desktop window wants the same compact HUD a tablet does.

### Traps

- **`pointer-events` inherits.** `#hud` is `pointer-events: none` so the
  walking HUD never eats a click, and every child inherits that — including
  `#cotdBtn`, which was injected into `#hudRight` and had therefore never once
  been pressable, on any device. Anything interactive parented into `#hud`
  needs `pointer-events: auto` of its own.
- **`touch-action: none` is scoped to the body and the canvas, not to
  everything.** Panels, the pause menu, the terminal and the City Map all
  scroll, and they only scroll because they keep `touch-action: auto`.
- **Touch gestures bind to the CANVAS, not the window.** Every overlay in this
  app sits above it, so "the target is the canvas" is already the test for
  "not on a control". `touchmove`/`touchend` go on the window so a drag that
  slides over a button still tracks.
- **A panel opening mid-stride must release the stick.** Desktop gets this for
  free — opening a panel drops pointer lock — but touch has no lock to lose,
  so the player kept walking behind the card. `Touch.apply` clears it.
- **The ENTER button is in `index.html` and its handler is attached at the end
  of `boot()`.** On a phone on mobile data that is several seconds of tapping
  a dead button, so it now boots disabled and says so.
- **Default quality is `low` on touch** — but only when the player has never
  chosen one. `Progress.init()` restores a saved quality before the default is
  applied, and imposing `low` over it would reset a tablet deliberately set to
  `high` on every boot.

---

## Architecture decisions that are NOT obvious

Read these before touching the relevant file — each cost real debugging.

**`js/world.js` — `facadeTint` clamps in sRGB, deliberately.**
`Color.getHSL`/`setHSL` default to the *linear* working colour space. Clamping L
to `[0.46, 0.74]` there is really sRGB `[0.71, 0.88]`, which forced every façade
into a near-white band. Do not drop the `THREE.SRGBColorSpace` arguments.

**`js/interior.js` — `ROOM_SCALE = 1/3`.**
Interiors are authored at ~3x human scale. Interior-local units meet WORLD units
via `S()` / `Interior.liftZoneWorld(i)`. Prefer helpers over raw `_liftZones`.

**`js/world.js` — per-building instance handles.**
`b._inst` / `b._capInst` recolour ONE building; changing a shared material
recolours the whole city.

**`js/assets.js` — kit GLBs, not a baked city mesh.**
VC Row, lab HQs, named housing and (on medium/high) infill instance a
handful of threejsassets kits. `City.layout()`, colliders, canvas signs, day/night
and metros stay procedural. Helicopters and robots are unchanged.
Scale is still 10 world units = 1 metre; files are 1 unit = 1 m and get fitted
to the placement box.

**The kit pipeline — `js/kit_registry.js` + `tools/fp_kits.mjs`.**
Every GLB FP ships is one line in `kit_registry.js` (`src: '<pack>/<file>.glb'`,
a `kind`, and a `group`). `node tools/fp_kits.mjs` Draco-compresses each one
from the local pack dumps (`assets/models/_packs/<pack>/glb/individual/`,
untracked and licence-restricted) into `assets/kits/<KIT_VERSION>/<pack>/`,
which is tracked and deployed: 68 MB of pack GLBs ship as 5 MB. To add a kit:
download the pack (see RESUME for the API), add the registry line, run the
tool, commit the new file under `assets/kits/`. `test:fp:assets` fails if a
registered kit has no shipped file. Groups: none (boot), `street` (boot),
`interior` (streamed after boot), `seasonal` (fetched only while a festival
uses it). `origin: 'authored'` keeps the file's pivot (a lamp's pole) instead
of recentring; `heavy` kits are skipped on `low`.

**Night glazing comes from the packs' own palettes.** Each pack bakes its
day palette into vertex colours; its night palette says which windows glow.
`assets.js` reproduces the day values (`GLAZE_PALETTES`), matches every vertex
once at load and stores a code in `aGlaze`: 1–3 lit glass (warm / amber / cool),
4 dark glass, 5 curtain wall, 6 neon. Glazed codes are smooth and
semi-metallic by day (sky reflections); 1–3 and 6 glow at night, with a
per-building hash switching off about a quarter of the bays. Any vertex colour
brighter than 1.0 is a baked flame or bulb and also gets code 6. Houses
(`KIT_HOUSE`) light some of their `glassOff` panes, or suburbia is black.

**`js/streetscape.js` — street furniture, parked cars, plazas, district dressing.**
Deterministic placement from the kits (benches, bins, hydrants, bus shelters,
planters, kiosks, parked cars in the kerb lane, pocket plazas in the paving,
rooftop billboards, suburban yards, the wasteland Underground, the desert
Space Zone, the beach). One `InstancedMesh` per kit whose instances live on the
CPU and are uploaded only within `range` of the camera (`ProxSet.refresh`,
every ~50 units of movement). Solid items push small colliders into
`G.colliders` *before* Vendors and the rest place themselves. Street lamps are
the Metropolis LED kit at the kerb, arm over the road; `World.lampSpots` holds
the pole (`x, z`) and the lamp head (`hx, hz`).

**Real lamp light — `World._buildLampLights`.** A fixed pool of SpotLights
(0 on low, 5 medium, 8 high) is re-seated on the nearest lamp heads four times
a second; a light moved to a new lamp fades in. The pool never changes size,
because changing the number of lights recompiles every lit material.

**`js/interiors/furnish.js` — kit furniture for the generic rooms.**
HQ lobbies, open-plan floors, boardrooms, apartments, the library, the café,
VC Row, mission control, power plants, the nursery, the warehouse and the
convention centre. The interior group runs at 30 local units per metre, so a
true-metre kit drops in at x30. One InstancedMesh per kit per room, sharing
the loaded geometry and material (flagged `kitShared`, which the room teardown
skips). A layout returns occupant spots; `pose: 'sit' | 'work'` seats the
citizen, `ry` turns them to face a table. A room built before the `interior`
group lands uses its box furniture and is rebuilt in place when it arrives.

**`js/people.js` — one body plan for the street crowd and everyone indoors.**
Street figures keep citizens.js's attribute contract (`aLimb`, `aTint`,
`aPart`; hips pivot at y 7.2, shoulders at 14.0). Indoor figures are the same
parts with colours baked in, three times larger, standing or seated; an
occupant who gets up swaps to the standing mesh while they walk.

**Rendering posture.** Medium and low: no post-processing, as before. High (or
`?bloom=1`): EffectComposer + half-res UnrealBloom + OutputPass; tone mapping
and sRGB move into OutputPass. Kit towers and trees are one InstancedMesh per
~1 km chunk so the camera and the sun can cull them. The sun's shadow map is
redrawn every other frame (every frame when the camera moves fast).

**Attract mode.** Once ENTER is live (and without `?autostart=1`) the start
panel turns to glass and `G.attract` flies the camera round the skyline;
`startGame` hands it back via `Player.placeAtSpawn()`.

**`js/textures.js` — `signAtlas()` is the live path.**
One atlas + merged quads. Do not revive per-building `makeSignPlate` for street signs.

**`js/traffic.js` — `mergeByMaterial()` on every vehicle builder.**
Keep new vehicles going through it.

**`js/fly_mode.js` — free-fly (C key).**
Mutually exclusive with orbit / tour / interiors / metro. Player still owns mouse
look while `G.flyMode`; position is owned by `FlyMode.update`. Landing clamps XZ
to the walkable city pad and restores eye height.

**`js/tour.js` — idle screensaver.**
`G.settings.autoTour` (default true) + `G.settings.idleTourMin` (default 5). Idle
loop restarts forever; manual `T` tour ends after one circuit + achievement. KeyT
is owned by UI.toggle — the tour input listener must not also treat T as "stop".

**`'pixi'` is a wire value, not a path.**
`js/store/nav.js`, `js/store/city_store.js` and the bridge share `view: 'pixi'` /
`from: 'pixi'` in the resume token. It named a directory once; it doesn't now.
Renaming it to match the URL breaks the round trip in both directions.

## Traps that have already caught someone

- **`js/traffic.js` — `mergeByMaterial()` returns a NEW group.** It bakes child
  transforms into one buffer per material, and in doing so drops `userData`,
  non-mesh children (Sprites, lights) and the group's own transform. Anything a
  builder hangs off the group is yours to carry across.
- **Point lights are physically correct.** The renderer runs
  `useLegacyLights = false`, so contribution is `intensity / distance²`. Nearly
  every point light in this app is written at 0.3–1.4, which delivers ~0.0004 at
  40 units — i.e. nothing. New lights need intensities in the **hundreds**.
- **`shared/schedule.js` takes an INTEGER seed.** `(seed * 17) % 100` only
  spreads over 0–99 for integers. Pass `c.idx`, never `c.seed` (a 0–1 float).
- **PostgREST caps responses at 1000 rows.** `store/roster.js` pages with
  `Range`; a plain GET silently truncates and looks successful.
- **A building type missing from `world.js`'s specialty switch renders as a
  generic box, silently.** `villa` had no case for months, which is why the
  founder mansions looked like offices.
- **A district `biome` with no `BIOMES` row used to kill the boot** on
  `biomeDef.ground`. `city.js`'s `INFILL` table has keys `BIOMES` lacks.
- **Free-fly owns the camera** and `Player.update` returns early while
  `G.flyMode` is set. Entering an interior or boarding a train mid-flight leaves
  the two fighting; `Metro.board` and `Interior.enter` land you first.
- **`Interior.group` already carries `FLOOR_Y` and `ROOM_SCALE`.** Props added
  to it use interior-LOCAL coordinates and no scale of their own.
- **`_setFloor` short-circuits when you are already on that floor**, so
  `setFloorInstant(n)` will not rebuild a room. Bounce via another floor.
- **The loading-screen version badge is derived** from the first versioned
  `js/` script tag (`shared_boot.js`). A stale badge means `tools/cachebust.mjs`
  missed a tag, not that the deploy failed.

- **`G.player.eyeY` is ABSOLUTE** (`G.floorY + EYE_H`), not an offset.
- **`THREE.Raycaster` ignores `object.visible`.** Filter up the parent chain.
- **`PointsMaterial.size` is WORLD-space** and ignores ancestor scale.
- **Merged-shell meshes report `material.color` as `#ffffff`** (vertexColors).
- Opening a hole in a wall = collider **and** geometry.
- `netlify.toml` must stay **UTF-8 without BOM**.
- **Kits are cached as immutable for a year** (`/first-person/assets/*`). Never
  re-encode a kit in place; bump `KIT_VERSION` in `kit_registry.js` and re-run
  `tools/fp_kits.mjs`, or returning visitors keep the old bytes.
- **`npm install` prunes `puppeteer-core`**, which lives in `node_modules`
  without a `package.json` entry. Restore it with
  `npm install --no-save puppeteer-core@25.7.0`.
- **Don't add `screen` to the glazing table.** Its day colour (#4a5560) is the
  mullion charcoal, about 30% of a tower; matching it lit every frame as a white
  wireframe at night.
- **The sky shader ends in `tonemapping_fragment` + `colorspace_fragment`.**
  Without them it drew darker and more saturated than the fog it meets, which
  was the pale band along the horizon.
- **`renderer.shadowMap.autoUpdate` is false.** The main loop sets
  `needsUpdate`. Anything new that renders the main scene outside that loop
  has to ask for a shadow update itself.
- **Nothing tall at centre-back in a generic room.** The name board hangs at
  |x| < 108, y 65–92 on the back wall; a kitchen run, a bookcase or a generator
  there hides it.

---

## How this fits the deploy

- `tools/build.mjs` minifies the root `js/` and `css/` only — its `readdir` is
  not recursive, so nothing here is minified. FP ships as readable source today.
- `tools/cachebust.mjs` versions the root `index.html` and `sw.js` only. FP has
  no `?v=` query strings; `netlify.toml` gives `/first-person/*` shorter
  cache lifetimes instead, so builds actually reach returning visitors.
- FP is deliberately **not** in `sw.js` `CORE_ASSETS`. Precaching ~3 MB of
  Three.js city on every 2D visitor who may never open it isn't worth it.
- `npm run lint` and `format:check` are scoped to the root `js/` glob, so this
  tree is not linted. It follows the same 4-space style.

## Relationship to the sandbox repo

`SingularityCityFirstPerson` remains as a sandbox for experiments and holds the
pre-merge history. **This tree is the source of truth** — FP changes land here,
in the production repo, alongside the 2D app they share state with. Copying
work back and forth is what created the drift this merge removed; don't restart
it.
