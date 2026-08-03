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

## Tests — all five must stay green

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
