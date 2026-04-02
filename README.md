# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS.

🌐 **[Play Live](https://singularitycity.netlify.app)**

---

## Features

### 🏢 Living City
- **848+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
- **Dynamic zoning** — new labs auto-generate districts as models are discovered
- **5 real-time data pipelines** — HuggingFace, Google AI Studio, ZeroEval, Launch Library 2, TechCrunch/Ars Technica
- **Cloud sync via Supabase** — every player's discoveries expand the same city
- **Neon signs** on all buildings — static during day, flickering glow at night
- **City-wide power lines** — wooden utility poles with sagging wires connecting buildings across the map

### 🖥️ Compute District — Data Centers & Chip Fabs
- **17 real-world facilities** — Google Dalles, AWS Virginia, Meta Prineville, xAI Colossus, TSMC Arizona, Samsung Foundry, Intel Ohio, and more
- **Full interiors** — NOC, server halls, reception, power distribution (DCs) · Lithography bays, etch chambers, wafer handling (fabs)

### 🚢 Port / Trade District
- **Ocean biome** with coral reef, animated fish schools, swaying algae, air bubbles, light rays
- **3 cargo ships** with staggered arrivals, animated cargo crane unloading, direction-aware wake
- **12 tracked commodities** with live pricing via Finnhub API (daily Netlify scheduled function)
- **Coastline transition** — sandy gradient with palm trees between ocean and desert

### ⚡ Power Grid Zone
- **5 power sources** — Solar (200MW variable), Wind (150MW weather-dependent), Nuclear (1,100MW), Coal (600MW), Hydro (400MW)
- **Live supply/demand** from DC facility power_mw fields + city baseline
- **Animated** — nuclear steam, coal smoke, spinning turbine blades, solar sun-tracking
- **Underground** — power/water trunk lines with vertical risers to each source
- **Full interiors** — Nuclear (4 floors), Coal (4 floors), Hydro/Solar/Wind (2 floors each)

### 🌌 3D Holomap · 🚇 Metro (4 lines) · 🏠 NPC Housing (24 NPCs) · 🍸 Neon Bar · 🏛️ Billionaire's Row · 🚀 Space Zone · 👻 AI Graveyard · 📊 12 Data Panels · 🔊 Audio · 🏆 21 Achievements

---

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | PixiJS 7 (2D) + Three.js r128 (3D Holomap) |
| Data | 5 API pipelines + Finnhub commodity pricing |
| Backend | Supabase + Netlify Functions |
| Code | ~19,300 lines vanilla JS, 32 files, zero frameworks |

## Deploy

1. Upload zip to [Netlify](https://app.netlify.com/drop)
2. Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FINNHUB_KEY`
3. Done — no build step

| Rendering | PixiJS 7 (2D city) + Three.js r128 (3D Holomap) |
| Audio | Web Audio API (procedural oscillator synthesis) |
| Data | 5 live API pipelines (HuggingFace, Google AI, ZeroEval, Launch Library 2, news RSS) |
| Backend | Supabase (cross-player cloud sync) |
| Hosting | Netlify (static deploy via zip upload) |
| Code | ~17K lines vanilla JavaScript, 27 files, zero frameworks |

## File Structure

```
index.html              — Landing page + game shell + all overlay panels
sw.js                   — Service worker (offline caching)
css/styles.css          — All styles including holomap + responsive breakpoints
js/
  engine.js             — Game loop, init, camera, easter eggs, achievements
  environment.js        — Building rendering, weather, day/night, skybox
  entities.js           — Character AI, trains, cars, helicopters, chat bubbles
  entities_gfx.js       — Metro tunnels, stations, bunkers, car/helicopter sprites
  interior_res_core.js  — Residential/estate interior system + silo
  interior_res_props.js — Interior furniture, elevator, new luxury props
  interior_res_ai.js    — Interior character AI behaviors
  interior_city_core.js — HQ building interior system
  interior_city_props.js— HQ interior furniture
  holomap.js            — Three.js 3D galaxy visualization
  space_entities.js     — Rocket launch system
  space_environment.js  — Desert biome rendering
  space_interior.js     — Mission control interior
  space_data.js         — Launch Library 2 API integration
  camera.js             — Viewport, zoom, tracking system
  ui.js                 — All UI panels, benchmarks, costs, census, ticker
  api.js                — Model discovery, HuggingFace/Google/ZeroEval pipelines
  data.js               — Static data: achievements, chat messages, news fallbacks
  snd.js                — Procedural audio engine
  burn_tracker.js       — Global API cost burn rate calculator
  minimap.js            — Minimap widget
  notify.js             — Browser notification system
```
## License

MIT
