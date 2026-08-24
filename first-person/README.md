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

## Tests — all seven must stay green

```bash
npm run test:fp
```

Run them through npm, not `node first-person/tests/<file>.mjs` directly.
`test:fp:parity` and `test:fp:interiors` reach app modules that import the bare
specifier `'three'`, which only the browser importmap resolves; the npm scripts
add `--import ./first-person/tests/hooks/three_resolver.mjs` to map it the same
way. Without the hook both die with `ERR_MODULE_NOT_FOUND` — that is the harness
missing, not a real regression. Keep the hook's table in sync with the importmap
in [`index.html`](index.html) if a third specifier is ever added.

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
