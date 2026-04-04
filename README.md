# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS.

🌐 **[Play Live](https://singularitycity.netlify.app)**

---

## Features

### 🏢 Living City
- **880+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
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

### 🛰️ Orbit Mode
- **Pull camera past the sky** to enter Low Earth Orbit view
- **Real satellite data** from CelesTrak — Starlink, OneWeb, ISS, GPS, Galileo constellations
- **Earth curvature** with atmosphere glow, landmasses, city lights on the dark side
- **Smooth transitions** with full camera state save/restore on exit

### 🤖 Robotics Factory Zone
- **4 buildings** — Assembly Line, Testing Ground, Deployment Dock, R&D Lab
- **8 NPCs** — engineers, testers, welders, calibrators, researchers
- **Animated** — walking robot prototypes, welding sparks, conveyor belts, status LEDs, smoke puffs
- **Full interiors** — Chassis Fabrication, AI Brain Upload, Obstacle Course, Morphology Lab
- **Companies** — Tesla Optimus, Figure, Boston Dynamics, Unitree, Agility, 1X, Apptronik, Sanctuary

### 🧬 Longevity Research Wing
- **4 buildings** — Drug Discovery Lab, Clinical Trials Center, Genomics Sequencing, Cryonics Vault
- **8 NPCs** — chemists, ML engineers, trial managers, biostatisticians, cryonics techs
- **Animated** — DNA double helix, molecule bubbles, heartbeat pulses, sequencer LEDs, cryo vapor
- **Full interiors** — Molecular Screening, Phase I-III trials, Bioinformatics Pipeline, Vitrification Chamber
- **Companies** — Calico, Altos Labs, Insilico Medicine, Recursion, Isomorphic Labs, Retro Biosciences

### 🔬 X-Ray Mode
- **Diagnostic overlay** toggled via toolbar button
- **Building wireframes** with lab-colored outlines and corner brackets
- **Data flow packets** traveling along connection arcs between same-lab buildings
- **Stat labels** — building IDs, floor counts, types, and data center status
- **Visual effects** — coordinate grid, pulse rings, sweeping scan line
- **Terminal aesthetic** — city dims to 8-15% opacity for dark hacker feel

### 🌌 3D Holomap · 🚇 Metro (4 lines) · 🏠 NPC Housing (40 NPCs) · 🍸 Neon Bar · 🏛️ Billionaire's Row · 🚀 Space Zone · 👻 AI Graveyard · 📊 12 Data Panels · 🔊 Audio · 🏆 21 Achievements · 🌐 The Backbone · 💰 VC Row

---

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | PixiJS 7 (2D city) + Three.js r128 (3D Holomap) |
| Audio | Web Audio API (procedural oscillator synthesis) |
| Data | 5 live API pipelines (HuggingFace, Google AI, ZeroEval, Launch Library 2, news RSS) + CelesTrak satellite API |
| Backend | Supabase (cross-player cloud sync) |
| Hosting | Netlify (static deploy via zip upload) |
| Code | ~22K lines vanilla JavaScript, 40 files, zero frameworks |

## Deploy

1. Upload zip to [Netlify](https://app.netlify.com/drop)
2. Set env vars: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `FINNHUB_KEY`
3. Done — no build step

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
  camera.js             — Viewport, zoom, tracking, orbit pull detection
  ui.js                 — All UI panels, benchmarks, costs, census, ticker
  api.js                — Model discovery, HuggingFace/Google/ZeroEval pipelines
  data.js               — Static data: achievements, chat messages, news fallbacks
  snd.js                — Procedural audio engine
  interior_manager.js   — Routes building types to interior modules
  interior_city_core.js — HQ building interior system
  interior_city_props.js— HQ interior furniture
  interior_city_ai.js   — Interior character AI behaviors
  interior_res_core.js  — Residential/estate interior system
  interior_res_props.js — Interior furniture, elevator, luxury props
  interior_res_ai.js    — Interior character AI behaviors
  interior_avatar_states.js — Avatar sleeping/sitting/working states
  interior_dc.js        — Data center interiors
  interior_bar.js       — Neon bar interior
  interior_npc.js       — NPC housing interiors
  interior_legacy.js    — Legacy building interiors
  interior_backbone.js  — Backbone network interiors
  interior_vcrow.js     — VC Row interiors
  interior_robotics.js  — Robotics factory interiors
  interior_longevity.js — Longevity research interiors
  orbit_mode.js         — LEO orbit view with real satellite data
  xray_mode.js          — Diagnostic wireframe overlay
  robotics_zone.js      — Robotics factory zone data & NPCs
  robotics_env.js       — Robotics factory animations
  longevity_zone.js     — Longevity research zone data & NPCs
  longevity_env.js      — Longevity research animations
  backbone_zone.js      — Backbone network zone data & NPCs
  backbone_env.js       — Backbone network animations
  power_zone.js         — Power grid zone data
  power_env.js          — Power grid animations
  power_zone_interior.js— Power plant interiors
  port_zone.js          — Port district zone data
  port_env.js           — Port district animations (ships, ocean)
  vc_row.js             — VC Row zone data & cars
  vc_row_env.js         — VC Row animations
  space_data.js         — Launch Library 2 API integration
  space_environment.js  — Desert biome rendering
  space_entities.js     — Rocket launch system
  space_interior.js     — Mission control interior
  holomap.js            — Three.js 3D galaxy visualization
  macro_view.js         — Minimap & zone navigation
  npc_housing.js        — NPC registry & commuter system
  street_vendors.js     — Food cart NPCs
  multiplayer.js        — Ghost cursor multiplayer
  burn_tracker.js       — Global API cost burn rate
  datacenter_data.js    — DC facility data
  seasonal.js           — Seasonal events (snow, fireworks, etc.)
  seasonal_env.js       — Seasonal environment effects
  aurora.js             — Aurora borealis & comet effects
  conference.js         — Conference center system
  university.js         — University campus system
  court.js              — AI Court system
  personality.js        — Model personality traits
  easter_eggs.js        — Hidden features & Konami code
  persistence.js        — LocalStorage save/load
  compute_worker.js     — Web worker for heavy computations
  city_elevator.js      — Building elevator system
```

## License

MIT
