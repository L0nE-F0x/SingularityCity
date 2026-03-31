# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS.

🌐 **[Play Live](https://singularitycity.netlify.app)**

---

## Features

### 🏢 Living City
- **730+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
- **Dynamic zoning** — new labs auto-generate districts as models are discovered
- **5 real-time data pipelines** — HuggingFace, Google AI Studio, ZeroEval, Launch Library 2, TechCrunch/Ars Technica
- **Cloud sync via Supabase** — every player's discoveries expand the same city

### 🌌 3D Holomap
- Full **Three.js r128** galaxy visualization overlaying the PixiJS viewport
- Central ASI black hole with orbiting barrier labels
- Lab nebulae at variable orbit radii based on proximity score (model count + ELO + benchmarks)
- All 730+ models rendered as stars with raycasting hover/click and info panels
- Deep-space ambient audio with cosmic pings

### 🏛️ CEO Estates — Billionaire's Row
- **7 unique architectural styles** based on lab identity:
  - Brutalist Fortress (xAI), Glass Penthouse (OpenAI/Anthropic), California Villa (Google/Meta), Colonial Estate (Microsoft/Amazon/Apple/Nvidia/IBM), French Château (EU labs), Pagoda Mansion (Chinese labs), Minimalist Modern (fallback)
- **Full interiors** — living floor, bedroom/office floor, parking garage, and **secure silo bunker** (reachable via elevator)
- **Style-specific props** — wine racks, trophy cases, fireplaces, bonsai trees, scroll art, fighting rings, grand pianos
- **CEO helicopter scenic flyovers** — periodic daytime flights across the entire city with ground shadows

### 🚀 Space Zone
- Desert biome with launch pads and mission control
- Real-time rocket launches from Launch Library 2 API
- Full launch sequence: countdown → ignition → liftoff → ascent → orbit

### 📊 Live Data Panels
- **Benchmark Observatory** — ranked leaderboard with 🥇🥈🥉 medals, visual bars, lab colors, callout cards for #1 Overall / Arena King / Best Value Frontier
- **Price War Tracker** — lab-grouped pricing comparison with callouts for Cheapest Overall / Cheapest Frontier / Best Bang-for-Buck
- **AI Analyst** — per-model deep-dive with benchmark radar
- **Census** — full population breakdown by lab/region
- **Launch Schedule** — upcoming real-world rocket launches with countdown timers

### 💬 Chat Bubbles
- 120+ context-aware messages across 10 activity types
- Models flex their real benchmark scores, trash-talk rival labs in the arena, and introduce themselves by name

### 📰 News Ticker
- 70% real fetched headlines from TechCrunch/Ars Technica
- 30% dynamic city events — #1 ELO callouts, population milestones, lab rivalries, cheapest API spotlights, time-of-day flavor

### 🏆 21 Achievements & Easter Eggs
- Milestones: Population 10/50/100, Monopoly (7 labs), Night Owl (midnight–5am visit)
- Exploration: Galactic Tourist, Silo Breach, Interior Designer (10 buildings), Train Spotter (10 departures), Rocket Scientist
- Hidden: 🕹️ Konami Code (Matrix rain), 🐱 Moon click 5x (cat mode)

### 🔊 Ambient Soundscape
- 6 procedural audio environments using Web Audio API oscillators
- Musical intervals (pentatonic scales, major thirds, perfect fifths)
- Outside: wind chimes + distant horns · Estates: Cmaj7 music box arpeggio · HQ: typing + notification pings · Metro: train Doppler + PA chimes · Holomap: ethereal drone + cosmic pings

---

## Tech Stack

| Layer | Technology |
|---|---|
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

## Deploy

1. Download the latest zip from releases
2. Upload to [Netlify](https://app.netlify.com/drop) via drag-and-drop
3. Done — no build step required

## License

MIT
