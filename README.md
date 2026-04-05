# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS — zero bundler, ~60 JS files, ~32K lines.

🌐 **[Play Live](https://singularitycity.net)** · 📰 **[Read the Paper](https://singularitycity.net)** · 🖼️ **[Embed it](https://singularitycity.net/embed.html)**

---

## Embed it anywhere

Drop a live view of Singularity City into any page with an iframe. The embed auto-boots into a hands-free auto-tour that cycles through 9 city landmarks, perfect for blog posts, tweets, Notion pages, and kiosks.

```html
<iframe src="https://singularitycity.net/embed.html"
        width="100%" height="600"
        frameborder="0" allowfullscreen></iframe>
```

---

## Features

### 🏢 Living City
- **960+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
- **Goal-driven archetypes** — ~20% of citizens have lifestyle routines (gym rats, foodies, bar regulars, bookworms, park joggers, coffee addicts, night owls)
- **Dynamic zoning** — new labs auto-generate districts as models are discovered
- **5 real-time data pipelines** — HuggingFace, Google AI Studio, ZeroEval, Launch Library 2, TechCrunch/Ars Technica
- **Cloud sync via Supabase** — every player's discoveries expand the same city
- **Neon signs** on all buildings — static during day, flickering glow at night
- **City-wide power lines** — wooden utility poles with sagging wires connecting buildings across the map

### 📰 The Singularity City Times
- **Weekly newspaper building** (📰 emoji) near the Visitor Monument
- **Live-generated front page** — top story, recent launches, retired models with successors, lab standings, benchmark leader, classifieds
- **Volume/Issue** computed from weeks since 2025-01-01
- **One-click PDF export** via browser print — perfect for archiving or sharing

### 🎬 Auto-Tour / Screensaver Mode
- **9 landmark stops** — Space Port, Compute District, AI Academy, AI Court, Legacy Systems, Leaderboard Park, LMSYS Arena, Visitor Monument, Longevity Wing
- **Triggers on 60s idle** or press **`T`** to toggle manually
- **Smooth camera glides** via the existing lerp — no jumps
- **Kiosk-safe** — embed mode makes the tour sticky so it never stops on input

### 🔬 Debug / Perf Overlay
- **Press `` ` ``** (backtick/tilde) to toggle the overlay
- **FPS, frame time, draw calls, visible sprites, texture count, entity counts**
- **60-frame rolling frame-time graph** with red/yellow/green bands
- Built in from v226 forward — makes perf regressions impossible to miss

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
- **Top-down pixel art Earth** with ocean, grid lines, day/night terminator, and city light clusters
- **Real satellite data** from CelesTrak — Starlink, OneWeb, ISS, GPS, Galileo constellations
- **Timezone-filtered** — shows satellites currently above your location with "YOU ARE HERE" marker
- **Pixel art satellites** — detailed ISS with solar panels, GPS with antenna, Starlink/OneWeb dots
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

### 🌌 3D Holomap · 🚇 Metro (4 lines) · 🏠 NPC Housing (44 NPCs) · 🍸 Neon Bar · 🏛️ Billionaire's Row · 🚀 Space Zone · 👻 AI Graveyard · 📊 12 Data Panels · 🔊 Audio · 🏆 21 Achievements · 🌐 The Backbone · 💰 VC Row

---

## Performance

Session 15 (v225-v233) shipped a full perf pass:

- **BitmapText chat bubbles** — no per-frame texture churn from `new PIXI.Text(...)`
- **Off-screen culling** — NPCs/cars/vendors/particles set `.renderable = false` when outside the camera box (with 200px margin). State machines keep ticking; only rendering is skipped.
- **Lazy zone boot** — 6 edge zones (Port, Power, VC Row, Backbone, Robotics, Longevity) defer construction until the camera approaches within ~3 screens.
- **Debug overlay** — press `` ` `` to measure FPS/draw calls/sprites live

## Controls

| Key / Action | What it does |
|---|---|
| Drag / Swipe | Pan camera |
| Scroll / Pinch | Zoom |
| Click building | Enter interior |
| Click model/CEO + 📡 Track | Follow entity through their day |
| `T` | Toggle auto-tour |
| `` ` `` (backtick/tilde) | Toggle debug/perf overlay |
| `?embed=1` URL param | Embed mode (chrome stripped, sticky auto-tour) |

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | PixiJS 7.3.2 (2D city) + Three.js r128 (3D Holomap) |
| Fonts | PIXI BitmapText for high-frequency text (chat bubbles, HUD) |
| Audio | Web Audio API (procedural oscillator synthesis) |
| Data | 5 live API pipelines (HuggingFace, Google AI, ZeroEval, Launch Library 2, news RSS) + CelesTrak satellite API + Finnhub commodities |
| Backend | Supabase (cross-player cloud sync) |
| Hosting | Netlify (auto-deploy on push to main) |
| Tooling | ESLint flat config + Prettier + editorconfig |
| Code | ~32K lines vanilla JavaScript, ~60 files, zero bundler |

## Development

```bash
# Clone + serve locally (any static server)
git clone https://github.com/L0nE-F0x/SingularityCity.git
cd SingularityCity
npx http-server -p 5500   # or: python -m http.server 5500

# Bump cache versions after code changes
node tools/cachebust.mjs 234        # rewrites ?v= on local script tags
# Then manually bump CACHE_NAME in sw.js to match

# Lint
npx eslint js/
```

## File Structure

```
index.html              — Landing page + game shell + all overlay panels + embed mode detection
embed.html              — Thin wrapper: /embed.html → /index.html?embed=1
sw.js                   — Service worker (offline caching, cache-bump-per-deploy)
eslint.config.js        — Flat ESLint config with ~90 writable project globals
.prettierrc             — Prettier config (4-space, single quotes)
tools/
  cachebust.mjs         — Dev-only: rewrite ?v=N on local script tags
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
  personality.js        — Model personality traits
  persistence.js        — LocalStorage save/load
  multiplayer.js        — Ghost cursor multiplayer
  holomap.js            — Three.js 3D galaxy visualization
  macro_view.js         — Minimap & zone navigation
  easter_eggs.js        — Hidden features & Konami code
  city_elevator.js      — Building elevator system
  compute_worker.js     — Web worker for heavy computations
  npc_housing.js        — NPC registry & commuter system
  street_vendors.js     — Food cart NPCs

  # Interiors
  interior_manager.js       — Routes building types to interior modules
  interior_city_core.js     — HQ building interior system
  interior_city_props.js    — HQ interior furniture
  interior_city_ai.js       — Interior character AI behaviors
  interior_res_core.js      — Residential/estate interior system
  interior_res_props.js     — Furniture, elevator, luxury props
  interior_res_ai.js        — Interior character AI behaviors
  interior_avatar_states.js — Avatar sleeping/sitting/working states
  interior_dc.js            — Data center interiors
  interior_bar.js           — Neon bar interior
  interior_npc.js           — NPC housing interiors
  interior_legacy.js        — Legacy building interiors
  interior_backbone.js      — Backbone network interiors
  interior_vcrow.js         — VC Row interiors
  interior_robotics.js      — Robotics factory interiors
  interior_longevity.js     — Longevity research interiors

  # Zones (logic / env pairs)
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
  power_zone_interior.js — Power plant interiors
  port_zone.js          — Port district zone data
  port_env.js           — Port district animations (ships, ocean)
  vc_row.js             — VC Row zone data & cars
  vc_row_env.js         — VC Row animations
  space_data.js         — Launch Library 2 API integration
  space_environment.js  — Desert biome rendering
  space_entities.js     — Rocket launch system
  space_interior.js     — Mission control interior
  datacenter_data.js    — DC facility data

  # Events & effects
  seasonal.js           — Seasonal events (snow, fireworks, etc.)
  seasonal_env.js       — Seasonal environment effects
  aurora.js             — Aurora borealis & comet effects
  conference.js         — Conference center system
  university.js         — University campus system
  court.js              — AI Court system

  # Session 15 — the 10-phase roadmap (v225-v233)
  debug_overlay.js      — Debug module: FPS/drawCalls/sprites overlay (~ hotkey)
  bitmap_fonts.js       — BitmapFonts module: lazy PIXI.BitmapFont.from() wrapper
  goals.js              — Goals module: archetype NPC routines (~20% opt-in)
  auto_tour.js          — AutoTour module: 9-landmark idle screensaver (+ embedSticky)
  newspaper.js          — Newspaper module: weekly Singularity City Times + PDF
```

## License

MIT
