# Grok Build brief — Singularity City FP GLB upgrade

Paste this whole brief into Grok Build.

## Goal
Wire modular Draco GLBs from threejsassets.com into Singularity City first-person mode, replacing or augmenting procedural InstancedMesh buildings for landmarks / skyline / vehicles / interiors — without baking a full city mesh. Keep `City.layout()`, colliders, day/night, signs, metros, and systems working.

## Repo
- Path: `/home/lonefox/Projects/ApexForge/SingularityCity`
- Remote: `https://github.com/L0nE-F0x/SingularityCity.git` (`main`)
- Live: https://singularitycity.net → toolbar **FP** → `/first-person/`
- Stack: Three.js r160, zero-bundler, importmap in `first-person/index.html`

## Assets ready (already on disk)
`first-person/assets/models/`

| Pack | Path | Role |
|------|------|------|
| Modular Metropolis | `_packs/metropolis/glb/` (~95 GLBs) | Downtown skyline, avenues, skybridges, metro headhouse, media facade |
| City | `_packs/city/glb/` (~73 GLBs) | Mid/low-rise, night neon, vehicles, sky night dome |
| Suburban Neighborhood | `_packs/suburban-neighborhood/glb/` | Housing districts |
| Living Room | `_packs/living-room/glb/` | Lobby / housing furniture |
| Kitchen | `_packs/kitchen/glb/` | Bar / cafe / villa kitchens |
| Bunker Facility | `interiors/bunker-facility/glb/` | Tech consoles, CRT, lab-adjacent props |
| Vice Beach | `_packs/vice-beach/glb/` | Neon / deco night accents (bonus) |

Convenience subsets also exist under `buildings/`, `vehicles/`, `street/`, `interiors/`, `props/`. Prefer the full `_packs/*/glb/individual/` trees.

See also `README.md` and `SELECTION.md` in this folder.

## Not available / keep procedural
- **Character Model Basic** — owned in UI but export API returns `not_entitled`; use Studio or keep `citizens.js` box people for v1
- **Helicopters / blimps / rockets** — keep `traffic.js`
- **Robot humanoids** — keep `interiors/robots.js`
- Named VC/lab **sign plates** — keep canvas atlas in `textures.js`

## Scale + style contract
- 10 world units = 1 meter; `FLOOR_H` = 24 u; eye ≈ 17 u
- Building origin at base centre, Y-up; metres in file → ×10 on load (or author 10:1)
- Dark tech-noir / neon night; warm window emissives required or night looks dead
- Brand tint clamp L 0.24–0.62, S ≤ 0.58
- Target &lt;150 draw calls; reuse 3–8 kit pieces via InstancedMesh for infill
- Landmark unique GLBs ballpark ≤5–15k tris; no bloom/SSAO/transmission

## Landmarks that deserve unique meshes
From `first-person/js/data.js`: VC Row (a16z, Sequoia, Thrive, Founders Fund, YC, MGX, SoftBank, AI Exchange, Cryptex); Tech HQs (OpenAI, Anthropic, DeepMind, Meta, Mistral, DeepSeek, xAI); hyperscalers / Eastern Exchange as present. Infill can stay procedural.

## Suggested implementation order
1. Vendor `GLTFLoader` into `first-person/lib/`; add to importmap.
2. Asset registry/loader; load before `World.build()` from `main.js`.
3. `world.js`: map landmark ids / height tiers to Metropolis+City GLBs; keep `b._inst`, colliders, signs.
4. Optional: City vehicles into `traffic.js` beside procedural cars.
5. Optional later: interior props; citizen meshes if Character export becomes available.
6. Netlify cache headers for `/first-person/assets/*`.
7. Keep `npm run test:fp` green.

## Key files
`first-person/js/world.js`, `city.js`, `main.js`, `state.js`, `data.js`, `textures.js`, `traffic.js`, `citizens.js`, `weather.js`, `index.html`, `lib/`, `netlify.toml`, `README.md`

## Success criteria
- FP boots from 2D toolbar FP button
- Landmarks read as distinct low-poly towers with night windows
- Draw-call budget OK on mid preset
- Colliders / enter-building / metro / free-fly still work
- `npm run test:fp` passes

## Out of scope for first PR
Rewriting 2D Pixi city; full interior conversion; holomap rewrite; photoreal packs.
