# threejsassets kits for Singularity City FP

Downloaded 2026-09-12 from https://threejsassets.com (All-Access Lifetime).
Commercial use OK. Do **not** redistribute the raw pack files.

## Layout
- `_packs/` — full source bundles (GLB + React components + palettes + MANIFEST)
  - `metropolis-pack.zip` / extracted `metropolis/`
  - `city-pack.zip` / `city/`
  - `living-room-pack.zip` / `living-room/`
  - `kitchen-pack.zip` / `kitchen/`
  - `suburban-neighborhood-pack.zip` / `suburban-neighborhood/`
  - `vice-beach-pack.zip` / `vice-beach/` (neon night bonus)
  - `interiors/bunker-facility/` — already extracted earlier
- Convenience copies (subset): `buildings/`, `vehicles/`, `street/`, `interiors/`, `props/`
- Prefer loading from `_packs/*/glb/individual/*.glb` (complete sets)
- FP loads a small subset via `first-person/js/assets.js` (landmarks, metros,
  housing, infill kits, a few vehicles). Combined catalog GLBs are not used.

## Character / humans / AI pedestrians
Character Model Basic shows as owned on the downloads page but the export API
returns `not_entitled` for this account. Export from
https://studio.threejsassets.com (Character studio) if needed, or keep
procedural citizens in `citizens.js` for v1.

## Helicopters / robots
Not in the catalog. Keep procedural `traffic.js` helis and `interiors/robots.js`.

## Scale
10 world units = 1 m. Origin at base. Draco GLB. Three r160 + GLTFLoader.
