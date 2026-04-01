# 🏙️ Singularity City

**The entire AI industry — alive in your browser.**

A globally synced, real-time pixel-art simulation where every AI model is a citizen, every lab is a district, and every benchmark, launch, and price war happens in real time. Built with PixiJS 7, Three.js r128, and vanilla JS.

🌐 **[Play Live](https://singularitycity.netlify.app)**

---

## Features

### 🏢 Living City
- **808+ AI model citizens** with daily routines — commuting, working, socializing, sleeping
- **Dynamic zoning** — new labs auto-generate districts as models are discovered
- **5 real-time data pipelines** — HuggingFace, Google AI Studio, ZeroEval, Launch Library 2, TechCrunch/Ars Technica
- **Cloud sync via Supabase** — every player's discoveries expand the same city

### 🖥️ Compute District — Data Centers & Chip Fabs
- **17 real-world facilities** — Google Dalles, AWS Virginia, Meta Prineville, xAI Colossus, TSMC Arizona, Samsung Foundry, Intel Ohio, and more
- **3 facility states** — Operational (green LEDs, HVAC, blue glow), Under Construction (steel frame, crane, EST year), Chip Fabs (cleanroom white, lithography yellow)
- **Full interiors** — NOC with monitoring screens, server halls with rack rows, reception & security, power distribution basement (DCs) · Lithography bays with EUV machines, etch chambers, wafer handling & QC, chemical storage (fabs)
- **Interactive NPCs** — Clickable facility staff with info panels, walking animations, and proper avatar rendering
- **Supabase integration** — DC facilities sync to cloud, auto-complete when target year is reached

### 🌌 3D Holomap
- Full **Three.js r128** galaxy visualization overlaying the PixiJS viewport
- Central ASI black hole with orbiting barrier labels
- Lab nebulae at variable orbit radii based on proximity score
- **Lit star rendering** — MeshPhong materials with emissive lab-color cores, specular highlights, 3-point lighting, inner colored spheres for volumetric depth
- All 808+ models rendered as stars with raycasting hover/click and info panels

### 🚇 Metro System
- **4 stations** — Compute District, Residential, Central Line (Tech District), Eastern Hub
- **Dynamic multi-leg routing** — models find nearest station and ride through intermediate stops
- **4 train services** with animated tunnel transit and platform boarding

### 🏛️ CEO Estates — Billionaire's Row
- **7 architectural styles** — Brutalist (xAI), Glass Penthouse (OpenAI/Anthropic), Villa (Google/Meta), Colonial (MS/Amazon/Apple/Nvidia), Château (EU), Pagoda (Chinese), Modern (fallback)
- **Full interiors** with elevator, secure silo bunker, style-specific props
- **CEO helicopter flyovers** with ground shadows

### 🚀 Space Zone
- Desert biome with launch pads and mission control
- Real-time rocket launches from Launch Library 2 API
- Full launch sequence: countdown → ignition → liftoff → ascent → orbit
- **Frontier Pines** — AI models ride the metro to watch imminent launches

### 📊 Live Data Panels
- Benchmark Observatory, Price War Tracker, AI Analyst, Census, Launch Schedule
- DC/Fab facility specs panels, Space facility panels with next launch countdown

### 🔊 Audio · 💬 Chat · 📰 News · 🏆 21 Achievements

---

## Tech Stack

| Layer | Technology |
|---|---|
| Rendering | PixiJS 7 (2D city) + Three.js r128 (3D Holomap) |
| Audio | Web Audio API (procedural oscillator synthesis) |
| Data | 5 live API pipelines |
| Backend | Supabase (cross-player cloud sync) |
| Hosting | Netlify |
| Code | ~16.5K lines vanilla JS, 24 files, zero frameworks |

## Deploy

1. Download the latest zip from releases
2. Upload to [Netlify](https://app.netlify.com/drop) via drag-and-drop
3. Done — no build step required

## License

MIT
