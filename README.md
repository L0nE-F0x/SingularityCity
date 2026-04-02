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

## License

MIT
