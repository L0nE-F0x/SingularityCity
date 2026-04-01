/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENVIRONMENT LAYER (v16.2.1 - Remastered Classic Estates)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Environment = {
    weather: 'clear', 
    desertWeather: 'clear',
    nextWeatherTick: 800, 
    nextDesertWeatherTick: 1200,
    season: 'spring',
    rainDrops: [], snowFlakes: [], petals: [], sandParticles: [],
    
    starsLayer: null, celestialGfx: null, cloudLayer: null, 
    bldLayer: null, groundGfx: null, reflectionLayer: null, refMask: null,
    staticLightsGfx: null, lightLayer: null, fxGfx: null,

    getSeason() { 
        const m = new Date().getMonth();
        return m >= 2 && m <= 4 ? 'spring' : m >= 5 && m <= 7 ? 'summer' : m >= 8 && m <= 10 ? 'autumn' : 'winter'; 
    },

    init(layers) {
        this.season = this.getSeason();
        this.starsLayer = layers.starsLayer; this.celestialGfx = layers.celestialGfx; this.cloudLayer = layers.cloudLayer;
        this.bldLayer = layers.bldLayer; this.groundGfx = layers.groundGfx; this.reflectionLayer = layers.reflectionLayer;
        this.staticLightsGfx = layers.staticLightsGfx; this.lightLayer = layers.lightLayer; this.fxGfx = layers.fxGfx;
        this.buildStars(); this.buildGround(); this.buildClouds(); this.buildBuildings();
    },

    buildStars() {
      this.starsLayer.removeChildren();
      for (let i = 0; i < 100; i++) { 
        const s = new PIXI.Graphics();
        const sz = .5 + Math.random() * 1.5; 
        s.beginFill(0xffffff); s.drawCircle(0, 0, sz); s.endFill(); 
        s.x = Math.random() * G.cityW;
        s.y = Math.random() * G.vpH * .5; 
        s.alpha = .15 + Math.random() * .5;
        s._phase = Math.random() * Math.PI * 2; 
        this.starsLayer.addChild(s); 
      }
    },

    buildGround() {
      const g = this.groundGfx;
      g.clear(); const gy = G.groundY;
      this.staticLightsGfx.clear(); 
      
      if (!this.refMask) {
          this.refMask = new PIXI.Graphics();
          this.reflectionLayer.addChild(this.refMask);
          this.reflectionLayer.mask = this.refMask;
      }
      this.refMask.clear();
      this.refMask.beginFill(0xffffff);
      this.refMask.drawRect(-2000, gy, G.cityW + 4000, 32); 
      this.refMask.endFill();

      // ─── Determine space zone X range ───
      let spaceStartX = Infinity, spaceEndX = 0;
      if (typeof SPACE_BLDS !== 'undefined') {
          BLDS.forEach(b => {
              if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
                  if (b.x < spaceStartX) spaceStartX = b.x;
                  if (b.x + b.w > spaceEndX) spaceEndX = b.x + b.w;
              }
          });
          // Extend desert to cover gaps between pads
          if (spaceStartX < Infinity) {
              spaceStartX = Math.max(0, spaceStartX - 60);
              spaceEndX += 60;
          }
      }
      const hasSpaceZone = spaceStartX < Infinity && spaceEndX > 0;

      // ─── CITY TERRAIN (skip space zone range) ───
      const drawCityTerrain = (startX, endX) => {
          if (startX >= endX) return;
          const w = endX - startX;
          g.beginFill(0x2a2a42); g.drawRect(startX, gy - 24, w, 24); g.endFill();
          g.beginFill(0x33334a); g.drawRect(startX, gy - 24, w, 12); g.endFill();
          g.beginFill(0x44445a); g.drawRect(startX, gy - 24, w, 2); g.endFill();
          for (let x = startX; x < endX; x += 30) { 
              g.beginFill(0x3a3a50, 0.3); g.drawRect(x, gy - 22, 1, 20); g.endFill(); 
          }
          g.beginFill(0x1e1e32); g.drawRect(startX, gy, w, 32); g.endFill();
          g.beginFill(0x22223a); g.drawRect(startX, gy, w, 16); g.endFill();
          g.beginFill(0x2a2a3e); g.drawRect(startX, gy, w, 2); g.endFill();
          for (let x = startX; x < endX; x += 40) { 
              g.beginFill(0x50506a); g.drawRect(x, gy + 14, 20, 3); g.endFill(); 
          }
          g.beginFill(0x50506a, 0.3); g.drawRect(startX, gy + 2, w, 1); g.endFill();
          g.beginFill(0x50506a, 0.3); g.drawRect(startX, gy + 29, w, 1); g.endFill();
      };

      if (hasSpaceZone) {
          // Desert terrain for space zone
          if (typeof SpaceEnvironment !== 'undefined') {
              SpaceEnvironment.buildDesertTerrain(g, gy, spaceStartX, spaceEndX);
              SpaceEnvironment.buildDesertScenery(g, gy, spaceStartX, spaceEndX);
          }
          // City terrain before and after the space zone
          drawCityTerrain(0, spaceStartX);
          drawCityTerrain(spaceEndX, G.cityW);
      } else {
          drawCityTerrain(0, G.cityW);
      }

      // Underground base (skip desert zone — SpaceEnvironment draws its own desert strata)
      if (hasSpaceZone) {
          g.beginFill(0x0a0a0f); g.drawRect(-2000, gy + 32, spaceStartX + 2000, 38); g.endFill();
          g.beginFill(0x0a0a0f); g.drawRect(spaceEndX, gy + 32, G.cityW + 4000 - spaceEndX, 38); g.endFill();
      } else {
          g.beginFill(0x0a0a0f); g.drawRect(-2000, gy + 32, G.cityW + 4000, 38); g.endFill();
      }

      // Helper: draw a horizontal element only in city zones (skip desert)
      const cityLeft = hasSpaceZone ? spaceEndX : 0;
      const drawCityH = (y, h, col, alpha) => {
          if (hasSpaceZone) {
              g.beginFill(col, alpha != null ? alpha : 1); g.drawRect(-2000, y, spaceStartX + 2000, h); g.endFill();
              g.beginFill(col, alpha != null ? alpha : 1); g.drawRect(spaceEndX, y, G.cityW + 4000 - spaceEndX, h); g.endFill();
          } else {
              g.beginFill(col, alpha != null ? alpha : 1); g.drawRect(-2000, y, G.cityW + 4000, h); g.endFill();
          }
      };
      // Helper: is X in the desert zone?
      const inDesert = (x) => hasSpaceZone && x >= spaceStartX && x <= spaceEndX;

      const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
      for (let i = 0; i < 25; i++) {
          const cy = gy + 35 + Math.random() * 30; 
          const thickness = 1 + Math.random() * 2;
          const col = cableCols[Math.floor(Math.random() * cableCols.length)];
          const alpha = 0.3 + Math.random() * 0.5;
          
          g.lineStyle(thickness, col, alpha);
          // Start from city zone (after desert)
          const startCableX = hasSpaceZone ? spaceEndX : -2000;
          g.moveTo(startCableX, cy);
          
          let currentY = cy;
          for(let cx = startCableX; cx < G.cityW + 2000; cx += 150) {
              currentY += (Math.random() * 12 - 6);
              if (currentY < gy + 35) currentY = gy + 35;
              if (currentY > gy + 65) currentY = gy + 65; 
              g.lineTo(cx, currentY);
          }
          g.lineStyle(0);
      }

      for(let i = 0; i < 200; i++) {
          const nx = (hasSpaceZone ? spaceEndX : -1000) + Math.random() * (G.cityW + 2000 - (hasSpaceZone ? spaceEndX : 0));
          const ny = gy + 35 + Math.random() * 30;
          g.beginFill(cableCols[Math.floor(Math.random() * cableCols.length)], 0.5);
          g.drawCircle(nx, ny, 1 + Math.random() * 1.5);
          g.endFill();
      }

      // gy+70 to gy+170 = tunnel cavity — left TRANSPARENT so undergroundLayer shows through
      // gy+170 downward = infrastructure depth — filled solid
      drawCityH(gy + 170, 100, 0x0a0a0f);
      
      let mEast = window.BLDS ? window.BLDS.find(b => b.id === 'metro_east') : null;
      let tunnelEndX = mEast ? mEast.x + (mEast.w / 2) + 160 : G.cityW;

      // Rock/earth fill AFTER the tunnel ends — covers gy+70 to gy+270 (entire depth past the terminus)
      g.beginFill(0x2d1a11); 
      g.drawRect(tunnelEndX, gy + 70, G.cityW + 4000 - tunnelEndX, 200); 
      g.endFill();

      let rockSeed = 99;
      const rRand = () => { rockSeed = (rockSeed * 16807) % 2147483647; return (rockSeed - 1) / 2147483646; };
      for (let rx = tunnelEndX; rx < G.cityW + 1000; rx += 12) {
          for (let ry = gy + 70; ry < gy + 270; ry += 12) {
              if (rRand() > 0.4) {
                  g.beginFill(rRand() > 0.5 ? 0x3d261a : 0x1f100a, 0.8);
                  g.drawRect(rx + rRand() * 8, ry + rRand() * 8, 2 + rRand() * 4, 2 + rRand() * 3);
                  g.endFill();
              }
              if (rRand() > 0.96) {
                  g.beginFill(rRand() > 0.5 ? 0xb45309 : 0xfacc15, 0.6);
                  g.drawRect(rx + rRand() * 10, ry + rRand() * 10, 1 + rRand() * 2, 1);
                  g.endFill();
              }
          }
      }

      // Metro tunnel, water, sewer — city zones only
      drawCityH(gy + 180, 30, 0x1a202c);
      drawCityH(gy + 185, 20, 0x0f172a);
      drawCityH(gy + 220, 8, 0x0369a1);
      drawCityH(gy + 222, 4, 0x0284c7);
      drawCityH(gy + 235, 12, 0xb45309);
      drawCityH(gy + 237, 8, 0xd97706);

      // Junction boxes — skip desert
      for(let px = -500; px < G.cityW + 500; px += 200) {
          if (inDesert(px)) continue;
          g.beginFill(0x334155); g.drawRect(px, gy + 175, 15, 40); g.endFill(); 
          g.beginFill(0x0ea5e9); g.drawRect(px + 50, gy + 218, 10, 12); g.endFill(); 
          g.beginFill(0xf59e0b); g.drawRect(px + 100, gy + 233, 10, 16); g.endFill(); 
      }
  
      let wildStart = 1500;
      let wildEnd = 3400;

      if (window.BLDS) {
          let maxResX = 0;
          window.BLDS.forEach(b => {
              if (b.id.startsWith('res_') || b.id === 'metro_res') {
                  if (b.x + b.w > maxResX) maxResX = b.x + b.w;
              }
          });

          let minTechX = Infinity;
          window.BLDS.forEach(b => {
              const isSpace = b.id.startsWith('pad_') || b.id === 'mission_control' || b.id === 'space_assembly' || b.id === 'tracking_station' || b.id === 'forest_space';
              if (!b.id.startsWith('res_') && b.id !== 'metro_res' && b.id !== 'forest_0' && b.id !== 'forest_1' && !b.id.startsWith('house_') && b.id !== 'metro_east' && !isSpace) {
                  if (b.x < minTechX) minTechX = b.x;
              }
          });

          if (maxResX > 0) wildStart = maxResX;
          if (minTechX !== Infinity) wildEnd = minTechX;
      }

      const blocked = [];
      if (window.BLDS) {
          window.BLDS.forEach(b => { blocked.push({ l: b.x + 5, r: b.x + b.w - 5 }); });
      }
      const isClear = (x) => !blocked.some(z => x > z.l && x < z.r);
      let seed = 42;
      const sr = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
      
      for (let tx = 20; tx < G.cityW; tx += 45) {
        seed = tx * 7 + 13;
        if (!isClear(tx)) { tx += 20; continue; }
        if (inDesert(tx)) continue; // Skip desert zone — SpaceEnvironment draws its own scenery
        
        const isWilderness = tx > wildStart && tx < wildEnd;
        const sz = isWilderness ? (8 + sr() * 10) : (5 + sr() * 4);
        
        g.beginFill(0x000000, 0.06);
        g.drawEllipse(tx, gy - 18, sz + 4, 3); g.endFill();
        
        if (isWilderness && sr() > 0.2) {
            g.beginFill(0x4a2e1a); g.drawRect(tx - 2, gy - 24 - sz * 1.5, 4, sz * 1.5 + 6); g.endFill();
            const cy = gy - 24 - sz * 1.5;
            g.beginFill(0x1b4332);
            g.drawPolygon([tx, cy - sz*2.5, tx - sz*1.2, cy + sz, tx + sz*1.2, cy + sz]);
            g.beginFill(0x2d6a4f);
            g.drawPolygon([tx, cy - sz*3.5, tx - sz*1.0, cy, tx + sz*1.0, cy]);
            g.beginFill(0x4ade80, 0.1);
            g.drawPolygon([tx, cy - sz*3.5, tx, cy + sz, tx + sz*1.2, cy + sz]);
            g.endFill();
        } else if (tx < wildStart && !isWilderness) {
            const cy = gy - 24 - sz * 1.5;
            if (tx < 450) { 
                g.beginFill(0x1b4332);
                g.drawPolygon([tx, cy - sz*2.5, tx - sz*1.2, cy + sz, tx + sz*1.2, cy + sz]);
                g.beginFill(0x2d6a4f);
                g.drawPolygon([tx, cy - sz*3.5, tx - sz*1.0, cy, tx + sz*1.0, cy]);
                g.endFill();
            } else if (tx >= 450 && tx < 800) {
                g.beginFill(0x3d2914); g.drawRect(tx-2, cy, 4, sz*1.5); g.endFill(); 
                g.beginFill(0xffb7c5); g.drawCircle(tx, cy - sz, sz*1.2); 
                g.drawCircle(tx - sz*0.8, cy - sz*0.5, sz); g.drawCircle(tx + sz*0.8, cy - sz*0.5, sz);
                g.endFill();
                g.beginFill(0xff99a8, 0.5); g.drawCircle(tx, cy - sz, sz*0.8); g.endFill();
            } else {
                g.beginFill(0x3d2914); g.drawRect(tx-2, cy, 4, sz*1.5); g.endFill(); 
                g.beginFill(0x2d6a4f); g.drawCircle(tx, cy - sz, sz*1.3); g.endFill();
                g.beginFill(0x1b4332); g.drawCircle(tx - sz*0.5, cy - sz*0.2, sz*0.8); g.endFill();
            }
        } else {
            g.beginFill(0x4a2e1a); g.drawRect(tx - 2, gy - 24 - sz * 1.5, 4, sz * 1.5 + 6); g.endFill();
            const cy = gy - 26 - sz * 1.8;
            g.beginFill(0x1b4332); g.drawEllipse(tx - 3, cy + 2, sz + 1, sz - 1); g.endFill();
            g.beginFill(0x2d6a4f); g.drawEllipse(tx + 2, cy - 1, sz, sz + 1); g.endFill();
            g.beginFill(0x3d8a5f); g.drawEllipse(tx - 1, cy - 2, sz - 1, sz - 2); g.endFill();
            g.beginFill(0x4ade80, 0.12); g.drawCircle(tx - 2, cy - 3, 1.5); g.drawCircle(tx + 3, cy - 1, 1); g.endFill();
        }
      }
      
      for (let lx = 45; lx < G.cityW; lx += 95) {
        seed = lx * 3 + 7;
        if (!isClear(lx)) { lx += 35; continue; }
        
        if (lx > wildStart && lx < wildEnd) continue; 

        const isRight = (lx % 2 === 0);
        g.beginFill(0x444444); g.drawRect(lx - 3, gy - 24, 6, 3); g.endFill();
        g.beginFill(0x444444); g.drawRect(lx - 1.5, gy - 58, 3, 34); g.endFill();
        g.beginFill(0x505050); g.drawRect(lx - 1, gy - 58, 2, 34); g.endFill();
        if (isRight) {
            g.beginFill(0x555555);
            g.drawRect(lx - 1, gy - 60, 8, 2); g.endFill();
            g.beginFill(0x606060); g.drawRect(lx + 4, gy - 62, 6, 4); g.endFill();
            g.beginFill(0xffeaa7, 0.9); g.drawRect(lx + 5, gy - 59, 4, 3); g.endFill();
        } else {
            g.beginFill(0x555555);
            g.drawRect(lx - 7, gy - 60, 8, 2); g.endFill();
            g.beginFill(0x606060); g.drawRect(lx - 10, gy - 62, 6, 4); g.endFill();
            g.beginFill(0xffeaa7, 0.9); g.drawRect(lx - 9, gy - 59, 4, 3); g.endFill();
        }
      }
    },

    buildClouds() {
      this.cloudLayer.removeChildren();
      const numClouds = Math.ceil(G.cityW / 150) + 5;
      for (let i = 0; i < numClouds; i++) {
        const c = new PIXI.Graphics();
        const w = 40 + (i % 7) * 12;
        const h = 8 + (i % 4) * 3;
        c.beginFill(0xffffff);
        c.drawEllipse(0, 0, w / 2, h);
        c.drawEllipse(-w / 3, -h * 0.4, w / 3, h * 0.7);
        c.drawEllipse(w / 3, -h * 0.3, w / 3.5, h * 0.6);
        if (w > 55) c.drawEllipse(w / 6, -h * 0.5, w / 4, h * 0.5);
        c.endFill();
        c._bx = i * 150 + Math.random() * 100 - 50;
        // Spread clouds between just above buildings and mid-sky (visible range)
        c.y = G.groundY - 100 - (i % 6) * 22 - Math.random() * 50;
        c.alpha = 0.10 + Math.random() * 0.06;
        c._i = i;
        c._drift = 0.002 + Math.random() * 0.003;
        this.cloudLayer.addChild(c);
      }
    },

    buildBuildings() {
      // Clear building references before destroying PIXI objects
      if (window.BLDS) {
          BLDS.forEach(b => {
              b._container = null;
              b._beacon = null;
              b._stockTicker = null;
              b._tickerW = null;
              b._winFaces = null;
              b._winTexts = null;
              b._sign = null;
          });
      }
      // Destroy old building PIXI objects to free GPU memory
      while (this.bldLayer.children.length > 0) {
          const child = this.bldLayer.children[0];
          this.bldLayer.removeChild(child);
          child.destroy({ children: true, texture: false, baseTexture: false });
      }
      // reflectionLayer: just removeChildren — DO NOT destroy!
      // CEO and car reflections live here and must survive rebuilds.
      this.reflectionLayer.removeChildren();
      
      const ghostLights = [];
      this.lightLayer.children.forEach(c => { if (c !== this.staticLightsGfx) ghostLights.push(c); });
      ghostLights.forEach(c => { this.lightLayer.removeChild(c); c.destroy(); });
      
      if (this.refMask) this.reflectionLayer.addChild(this.refMask);

      const emojiFontStack = '"Twemoji Mozilla", "Apple Color Emoji", "Noto Color Emoji", "Segoe UI Emoji", sans-serif';

      BLDS.forEach(b => {
        const lab = b.lab ? LABS[b.lab] : null;
        const colHex = lab ? parseInt(lab.color.slice(1), 16) : parseInt((b.color || '#6b7280').slice(1), 16);
        const floors = b.dynamicFl || b.fl; 
        const h = floors * 18 + 24; 
        
        const bx = b.x; const by = G.groundY - 24;
        const container = new PIXI.Container(); container.x = bx; container.y = by - h;
        const gfx = new PIXI.Graphics();
        
        // ─── SPACE ZONE BUILDINGS: delegate to SpaceEnvironment ───
        if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
            if (typeof SpaceEnvironment !== 'undefined') {
                SpaceEnvironment.buildSpaceBuildings(this.bldLayer, b, G.groundY);
            }
            return; // skip normal rendering
        }
  
        if (b.id.startsWith('forest_') || b.id === 'forest_space') {
            gfx.beginFill(0x1b4332); gfx.drawRect(0, h-6, b.w, 6); gfx.endFill();
            gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h-8, b.w, 2); gfx.endFill();

            let treeSeed = 42 + b.x;
            const sr = () => { treeSeed = (treeSeed * 16807) % 2147483647; return (treeSeed - 1) / 2147483646; };
            
            for (let tx = 10; tx < b.w - 10; tx += 15 + sr() * 20) {
                const th = 40 + sr() * 80; 
                const tw = 25 + sr() * 25; 
                
                gfx.beginFill(0x000000, 0.2); gfx.drawEllipse(tx, h - 2, tw*0.6, 4); gfx.endFill();
                gfx.beginFill(0x3d2914); gfx.drawRect(tx - 3, h - 10 - th*0.3, 6, th*0.3 + 10); gfx.endFill();
                
                gfx.beginFill(0x064e3b); 
                gfx.drawPolygon([tx - tw*0.6, h - th*0.2, tx, h - th*0.8, tx + tw*0.6, h - th*0.2]);
                gfx.beginFill(0x065f46); 
                gfx.drawPolygon([tx - tw*0.5, h - th*0.4, tx, h - th*0.9, tx + tw*0.5, h - th*0.4]);
                gfx.beginFill(0x047857); 
                gfx.drawPolygon([tx - tw*0.4, h - th*0.6, tx, h - th, tx + tw*0.4, h - th*0.6]);
                gfx.endFill();
            }
        } 
        else if (b.id.startsWith('house_')) {
            // ─── CEO ESTATES: 7 Architectural Styles by Lab Identity ───
            const labRegion = (LABS[b.lab] && LABS[b.lab].region) ? LABS[b.lab].region : 'eu';
            let estateStyle = 'modern';
            if (b.lab === 'xai') estateStyle = 'brutalist';
            else if (b.lab === 'openai' || b.lab === 'anthropic') estateStyle = 'penthouse';
            else if (b.lab === 'google' || b.lab === 'meta') estateStyle = 'villa';
            else if (b.lab === 'microsoft' || b.lab === 'amazon' || b.lab === 'apple' || b.lab === 'nvidia' || b.lab === 'ibm') estateStyle = 'colonial';
            else if (labRegion === 'eu') estateStyle = 'chateau';
            else if (labRegion === 'cn') estateStyle = 'pagoda';

            // Lawn
            gfx.beginFill(0x1b4332); gfx.drawRect(0, h - 6, b.w, 6); gfx.endFill();
            gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 4, b.w, 2); gfx.endFill();

            if (estateStyle === 'brutalist') {
                // ── xAI: Brutalist Fortress — raw concrete, laser slits, radar dish ──
                gfx.beginFill(0x475569); gfx.drawRect(30, h-80, b.w-60, 80); gfx.endFill();
                gfx.beginFill(0x334155); gfx.drawRect(10, h-55, 50, 55); gfx.endFill();
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-20, h-80, 40, 80); gfx.endFill();
                // Cantilevered overhang
                gfx.beginFill(0x3f4f63); gfx.drawRect(5, h-58, b.w-10, 4); gfx.endFill();
                // Radar dish
                gfx.beginFill(0x0f172a); gfx.drawEllipse(35, h-86, 22, 5); gfx.endFill();
                gfx.lineStyle(2, colHex); gfx.drawCircle(35, h-86, 8); gfx.lineStyle(0);
                // Accent stripe
                gfx.beginFill(colHex); gfx.drawRect(30, h-80, b.w-60, 2); gfx.endFill();
                // Laser slit windows
                for(var sy=h-70; sy<h-10; sy+=14) {
                    gfx.beginFill(0xf87171, 0.3); gfx.drawRect(40, sy, b.w-80, 5); gfx.endFill();
                    gfx.beginFill(0xfca5a5, 0.7); gfx.drawRect(42, sy+1, b.w-84, 2); gfx.endFill();
                }
                // Security bollards
                gfx.beginFill(0x334155);
                for(var boll=0; boll<b.w; boll+=20) { gfx.drawRect(boll, h-8, 4, 8); }
                gfx.endFill();

            } else if (estateStyle === 'penthouse') {
                // ── OpenAI/Anthropic: Glass Penthouse Tower — vertical, premium, illuminated ──
                var pw = b.w - 30;
                gfx.beginFill(0x0f172a); gfx.drawRect(15, h-90, pw, 90); gfx.endFill();
                // Glass curtain wall
                gfx.beginFill(0x1e293b); gfx.drawRect(18, h-86, pw-6, 82); gfx.endFill();
                // Floor-to-ceiling windows (3 floors)
                for(var pf=0; pf<3; pf++) {
                    var wy = h - 82 + pf * 28;
                    gfx.beginFill(0x38bdf8, 0.25); gfx.drawRect(22, wy, pw-14, 22); gfx.endFill();
                    gfx.beginFill(0x7dd3fc, 0.15); gfx.drawRect(22, wy, pw-14, 8); gfx.endFill();
                    // Floor dividers
                    gfx.beginFill(0x334155); gfx.drawRect(18, wy+24, pw-6, 3); gfx.endFill();
                }
                // Rooftop terrace railing
                gfx.beginFill(0xcbd5e1); gfx.drawRect(10, h-92, pw+10, 2); gfx.endFill();
                gfx.lineStyle(1, 0x94a3b8, 0.5);
                for(var rx=14; rx<pw+20; rx+=8) { gfx.moveTo(rx, h-92); gfx.lineTo(rx, h-98); }
                gfx.lineStyle(0);
                // Accent crown
                gfx.beginFill(colHex); gfx.drawRect(15, h-90, pw, 2); gfx.endFill();
                // Rooftop glow
                gfx.beginFill(colHex, 0.15); gfx.drawRect(10, h-98, pw+10, 6); gfx.endFill();
                // Entrance portico
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-20, h-10, 40, 10); gfx.endFill();
                gfx.beginFill(0x38bdf8, 0.3); gfx.drawRect(b.w/2-15, h-8, 30, 6); gfx.endFill();

            } else if (estateStyle === 'villa') {
                // ── Google/Meta: California Villa — warm, open, terracotta, pool accent ──
                // Main body
                gfx.beginFill(0xfef3c7); gfx.drawRect(15, h-55, b.w-30, 55); gfx.endFill();
                gfx.beginFill(0xfde68a); gfx.drawRect(15, h-55, b.w-30, 3); gfx.endFill();
                // Terracotta roof
                gfx.beginFill(0x92400e); gfx.drawRect(10, h-60, b.w-20, 8); gfx.endFill();
                gfx.beginFill(0x78350f); gfx.drawRect(10, h-60, b.w-20, 2); gfx.endFill();
                // Side wing
                gfx.beginFill(0xfef3c7); gfx.drawRect(b.w-45, h-45, 40, 45); gfx.endFill();
                gfx.beginFill(0x92400e); gfx.drawRect(b.w-50, h-50, 48, 7); gfx.endFill();
                // Arched windows
                gfx.beginFill(0x7dd3fc, 0.4);
                for(var vx=28; vx<b.w-50; vx+=24) {
                    gfx.drawRect(vx, h-42, 14, 18);
                    gfx.drawCircle(vx+7, h-42, 7);
                }
                gfx.endFill();
                // Pool accent (small blue rectangle in yard)
                gfx.beginFill(0x22d3ee, 0.4); gfx.drawRoundedRect(5, h-12, 30, 8, 2); gfx.endFill();
                gfx.beginFill(0x67e8f9, 0.3); gfx.drawRect(7, h-11, 26, 3); gfx.endFill();
                // Palm tree silhouette
                gfx.beginFill(0x5c4033); gfx.drawRect(b.w-15, h-30, 3, 24); gfx.endFill();
                gfx.beginFill(0x166534); gfx.drawEllipse(b.w-13, h-32, 12, 6); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(10, h-60, b.w-20, 2); gfx.endFill();

            } else if (estateStyle === 'colonial') {
                // ── Microsoft/Amazon/Apple/Nvidia: Colonial Estate — symmetrical, columned, dignified ──
                // Foundation
                gfx.beginFill(0x94a3b8); gfx.drawRect(10, h-8, b.w-20, 8); gfx.endFill();
                // Main body
                gfx.beginFill(0xf1f5f9); gfx.drawRect(15, h-58, b.w-30, 50); gfx.endFill();
                // Shadow depth
                gfx.beginFill(0xcbd5e1); gfx.drawRect(15, h-58, 3, 50); gfx.endFill();
                // Triangular pediment
                gfx.beginFill(0xe2e8f0);
                gfx.drawPolygon([12, h-58, b.w/2, h-78, b.w-12, h-58]);
                gfx.endFill();
                gfx.beginFill(0x94a3b8);
                gfx.drawPolygon([16, h-58, b.w/2, h-74, b.w-16, h-58]);
                gfx.endFill();
                gfx.beginFill(0xe2e8f0);
                gfx.drawPolygon([20, h-58, b.w/2, h-72, b.w-20, h-58]);
                gfx.endFill();
                // Columns
                gfx.beginFill(0xffffff, 0.7);
                for(var cx=25; cx<b.w-20; cx+=Math.floor((b.w-50)/4)) {
                    gfx.drawRect(cx, h-56, 5, 48);
                    gfx.drawRect(cx-2, h-56, 9, 3);
                    gfx.drawRect(cx-2, h-10, 9, 3);
                }
                gfx.endFill();
                // Symmetrical windows
                gfx.beginFill(0x1e293b, 0.7);
                for(var wx2=35; wx2<b.w-30; wx2+=Math.floor((b.w-70)/3)) {
                    gfx.drawRect(wx2, h-46, 12, 16);
                    gfx.drawRect(wx2, h-26, 12, 12);
                }
                gfx.endFill();
                gfx.beginFill(0xfde68a, 0.4);
                for(var wx3=35; wx3<b.w-30; wx3+=Math.floor((b.w-70)/3)) {
                    gfx.drawRect(wx3+1, h-44, 10, 12);
                }
                gfx.endFill();
                // Grand door
                gfx.beginFill(0x78350f); gfx.drawRect(b.w/2-8, h-22, 16, 14); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawCircle(b.w/2+4, h-15, 1.5); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(12, h-58, b.w-24, 2); gfx.endFill();

            } else if (estateStyle === 'chateau') {
                // ── EU Labs: French Château — mansard roof, dormer windows, stone pillars ──
                // Stone base
                gfx.beginFill(0xe2e8f0); gfx.drawRect(10, h-52, b.w-20, 52); gfx.endFill();
                gfx.beginFill(0xcbd5e1); gfx.drawRect(10, h-52, b.w-20, 3); gfx.drawRect(10, h-52, 3, 52); gfx.endFill();
                // Mansard roof
                gfx.beginFill(0x1e293b);
                gfx.drawPolygon([5, h-52, b.w/2, h-82, b.w-5, h-52]);
                gfx.endFill();
                // Roof shingle texture
                gfx.lineStyle(1, 0x334155, 0.4);
                for(var ry=h-52; ry>h-80; ry-=5) {
                    var xOff = (h-52-ry) * 0.6;
                    gfx.moveTo(7+xOff, ry); gfx.lineTo(b.w-7-xOff, ry);
                }
                gfx.lineStyle(0);
                // Dormer windows (small gabled projections)
                var dw = 16;
                for(var dx=b.w*0.25; dx<b.w*0.8; dx+=b.w*0.25) {
                    gfx.beginFill(0x334155);
                    gfx.drawPolygon([dx-dw/2, h-60, dx, h-70, dx+dw/2, h-60]);
                    gfx.endFill();
                    gfx.beginFill(0xfde68a, 0.6); gfx.drawRect(dx-4, h-60, 8, 8); gfx.endFill();
                }
                // Stone pillars
                gfx.beginFill(0xffffff, 0.3);
                for(var px2=18; px2<b.w-15; px2+=28) { gfx.drawRect(px2, h-52, 5, 52); }
                gfx.endFill();
                // Arched windows with warm glow
                gfx.beginFill(0xfde047, 0.5);
                for(var ax=28; ax<b.w-20; ax+=28) {
                    gfx.drawRect(ax, h-38, 10, 18);
                    gfx.drawCircle(ax+5, h-38, 5);
                }
                gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(5, h-52, b.w-10, 2); gfx.endFill();
                // Topiary hedges
                gfx.beginFill(0x166534);
                gfx.drawCircle(8, h-10, 8); gfx.drawCircle(b.w-8, h-10, 8);
                gfx.endFill();
                gfx.beginFill(0x1b4332);
                gfx.drawCircle(8, h-10, 6); gfx.drawCircle(b.w-8, h-10, 6);
                gfx.endFill();

            } else if (estateStyle === 'pagoda') {
                // ── Chinese Labs: Pagoda Mansion — tiered roofs, red/gold, lanterns ──
                // Main body (dark wood)
                gfx.beginFill(0x44403c); gfx.drawRect(15, h-55, b.w-30, 55); gfx.endFill();
                // Inner wall (warm)
                gfx.beginFill(0x7c2d12, 0.6); gfx.drawRect(18, h-52, b.w-36, 48); gfx.endFill();
                // Solid roof body (dark fill behind all tiers so no sky bleeds through)
                gfx.beginFill(0x1c1917);
                gfx.drawPolygon([10, h-55, b.w/2, h-55-42, b.w-10, h-55]);
                gfx.endFill();
                // Tiered roof layers
                for(var tier=0; tier<3; tier++) {
                    var ty = h - 55 - tier * 14;
                    var tw = (b.w - 10) - tier * 20;
                    var tx = (b.w - tw) / 2;
                    // Curved eaves
                    gfx.beginFill(0x292524);
                    gfx.drawRect(tx, ty, tw, 6);
                    gfx.endFill();
                    // Upturned tips
                    gfx.beginFill(0x292524);
                    gfx.drawPolygon([tx-4, ty+6, tx+6, ty, tx+6, ty+6]);
                    gfx.drawPolygon([tx+tw+4, ty+6, tx+tw-6, ty, tx+tw-6, ty+6]);
                    gfx.endFill();
                    // Gold trim
                    gfx.beginFill(0xfbbf24, 0.7); gfx.drawRect(tx+2, ty+5, tw-4, 1); gfx.endFill();
                }
                // Lattice windows
                gfx.beginFill(0xfde68a, 0.4);
                for(var lx=25; lx<b.w-25; lx+=22) { gfx.drawRect(lx, h-40, 14, 20); }
                gfx.endFill();
                // Window lattice cross-hatching
                gfx.lineStyle(1, 0x44403c, 0.6);
                for(var lx2=25; lx2<b.w-25; lx2+=22) {
                    gfx.moveTo(lx2+7, h-40); gfx.lineTo(lx2+7, h-20);
                    gfx.moveTo(lx2, h-30); gfx.lineTo(lx2+14, h-30);
                }
                gfx.lineStyle(0);
                // Red lanterns
                gfx.beginFill(0xdc2626);
                gfx.drawCircle(20, h-58, 4); gfx.drawCircle(b.w-20, h-58, 4);
                gfx.endFill();
                gfx.beginFill(0xfbbf24, 0.8);
                gfx.drawCircle(20, h-58, 2); gfx.drawCircle(b.w-20, h-58, 2);
                gfx.endFill();
                // Grand red door
                gfx.beginFill(0xb91c1c); gfx.drawRect(b.w/2-10, h-18, 20, 12); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawCircle(b.w/2, h-12, 2); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(15, h-55, b.w-30, 2); gfx.endFill();

            } else {
                // ── Fallback: Minimalist Modern — clean lines, flat roof, subtle glass ──
                gfx.beginFill(0xf8fafc); gfx.drawRect(20, h-55, b.w-40, 55); gfx.endFill();
                gfx.beginFill(0xe2e8f0); gfx.drawRect(20, h-55, b.w-40, 3); gfx.drawRect(20, h-55, 3, 55); gfx.endFill();
                // Flat roof with parapet
                gfx.beginFill(0x0f172a); gfx.drawRect(15, h-58, b.w-30, 5); gfx.endFill();
                // Feature wall (darker accent block)
                gfx.beginFill(0x334155); gfx.drawRect(b.w-50, h-48, 30, 42); gfx.endFill();
                // Panoramic window
                gfx.beginFill(0x38bdf8, 0.35); gfx.drawRect(28, h-44, b.w-80, 22); gfx.endFill();
                gfx.beginFill(0x7dd3fc, 0.15); gfx.drawRect(28, h-44, b.w-80, 8); gfx.endFill();
                // Window mullion
                gfx.beginFill(0xcbd5e1); gfx.drawRect(b.w/2-1, h-44, 2, 22); gfx.endFill();
                // Entrance
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-12, h-14, 24, 8); gfx.endFill();
                gfx.beginFill(0x38bdf8, 0.2); gfx.drawRect(b.w/2-10, h-13, 20, 6); gfx.endFill();
                // Hedges
                gfx.beginFill(0x166534); gfx.drawRoundedRect(2, h-10, 24, 8, 3); gfx.drawRoundedRect(b.w-26, h-12, 24, 10, 3); gfx.endFill();
                // Accent
                gfx.beginFill(colHex); gfx.drawRect(15, h-58, b.w-30, 2); gfx.endFill();
            }
            
            gfx.lineStyle(0); // Safety reset before sign
            const signBg = new PIXI.Graphics();
            signBg.beginFill(0x0a0a1a, 0.8); signBg.lineStyle(1, colHex, 0.5);
            signBg.drawRoundedRect(b.w/2 - 40, h - 10, 80, 8, 2); signBg.endFill();
            container.addChild(signBg);
            
            const signTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 6, fill: colHex, fontWeight: 'bold' });
            signTxt.anchor.set(0.5, 0.5); signTxt.x = b.w/2; signTxt.y = h - 6;
            container.addChild(signTxt);
        }
        // ─── DATA CENTER BUILDINGS ───
        else if (b.id.startsWith('dc_')) {
            const dc = b.dcData || {};
            const isConstruction = dc.status === 'construction';
            const opCol = colHex || 0x64748b;
            
            if (isConstruction) {
                // ── CONSTRUCTION SITE ──
                // Dirt/foundation
                gfx.beginFill(0x78582e); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
                gfx.beginFill(0x92703a); gfx.drawRect(0, h-6, b.w, 2); gfx.endFill();
                // Partial structure (steel frame)
                gfx.beginFill(0x475569, 0.6); gfx.drawRect(10, h-50, b.w-20, 42); gfx.endFill();
                // Steel beams
                gfx.beginFill(0x64748b);
                for (var cx2=15; cx2<b.w-15; cx2+=25) { gfx.drawRect(cx2, h-50, 4, 42); }
                for (var cy=h-48; cy<h-10; cy+=14) { gfx.drawRect(10, cy, b.w-20, 2); }
                gfx.endFill();
                // Crane
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.7, h-95, 4, 87); gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.5, h-95, b.w*0.3, 3); gfx.endFill();
                // Crane cable
                gfx.lineStyle(1, 0x94a3b8); gfx.moveTo(b.w*0.55, h-92); gfx.lineTo(b.w*0.55, h-60); gfx.lineStyle(0);
                // Dangling steel beam
                gfx.beginFill(0x64748b); gfx.drawRect(b.w*0.52, h-62, 8, 3); gfx.endFill();
                // Safety barriers
                gfx.beginFill(0xef4444);
                for (var bx2=0; bx2<b.w; bx2+=20) { gfx.drawRect(bx2, h-10, 8, 2); }
                gfx.endFill();
                // Completion label
                if (dc.completion) {
                    gfx.beginFill(0x000000, 0.7); gfx.drawRect(b.w/2-30, h-30, 60, 12); gfx.endFill();
                }
                // Accent
                gfx.beginFill(opCol); gfx.drawRect(10, h-50, b.w-20, 2); gfx.endFill();
            } else {
                // ── OPERATIONAL DATA CENTER ──
                // Main structure — industrial, heavy
                gfx.beginFill(0x334155); gfx.drawRect(5, h-65, b.w-10, 65); gfx.endFill();
                gfx.beginFill(0x1e293b); gfx.drawRect(8, h-62, b.w-16, 56); gfx.endFill();
                // Roof equipment
                gfx.beginFill(0x475569); gfx.drawRect(5, h-68, b.w-10, 5); gfx.endFill();
                // HVAC units on roof
                gfx.beginFill(0x64748b);
                for (var hvx=15; hvx<b.w-30; hvx+=30) { gfx.drawRect(hvx, h-75, 16, 8); gfx.drawRect(hvx+4, h-78, 8, 4); }
                gfx.endFill();
                // Server room windows (blue glow strips)
                for (var wy2=h-58; wy2<h-12; wy2+=14) {
                    gfx.beginFill(0x06b6d4, 0.3); gfx.drawRect(12, wy2, b.w-24, 8); gfx.endFill();
                    gfx.beginFill(0x22d3ee, 0.15); gfx.drawRect(12, wy2, b.w-24, 3); gfx.endFill();
                }
                // Loading dock
                gfx.beginFill(0x1e293b); gfx.drawRect(b.w/2-15, h-12, 30, 6); gfx.endFill();
                gfx.beginFill(0x475569); gfx.drawRect(b.w/2-12, h-11, 24, 4); gfx.endFill();
                // Security fence posts
                gfx.beginFill(0x475569);
                gfx.drawRect(0, h-8, 3, 8); gfx.drawRect(b.w-3, h-8, 3, 8);
                gfx.endFill();
                // Accent stripe
                gfx.beginFill(opCol); gfx.drawRect(5, h-65, b.w-10, 2); gfx.endFill();
                // Power indicator LEDs
                gfx.beginFill(0x4ade80);
                for (var ledx=20; ledx<b.w-20; ledx+=18) { gfx.drawCircle(ledx, h-64, 1.5); }
                gfx.endFill();
            }
            
            // Name sign
            // Name sign — positioned just above roof vents
            var dcSignW = Math.min(b.w - 10, 100);
            var dcSign = new PIXI.Graphics();
            dcSign.beginFill(0x0a0a1a, 0.85); dcSign.lineStyle(1, opCol, 0.5);
            dcSign.drawRoundedRect(b.w/2 - dcSignW/2, -6, dcSignW, 10, 2); dcSign.endFill();
            container.addChild(dcSign);
            var dcTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 6, fill: opCol, fontWeight: 'bold' });
            dcTxt.anchor.set(0.5, 0.5); dcTxt.x = b.w/2; dcTxt.y = -1;
            container.addChild(dcTxt);
            if (isConstruction && dc.completion) {
                var compTxt = new PIXI.Text(`EST. ${dc.completion}`, { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xfbbf24 });
                compTxt.anchor.set(0.5, 0.5); compTxt.x = b.w/2; compTxt.y = h-24;
                container.addChild(compTxt);
            }
        }
        // ─── CHIP FAB BUILDINGS ───
        else if (b.id.startsWith('fab_')) {
            const dc = b.dcData || {};
            const isConstruction = dc.status === 'construction';
            const opCol = colHex || 0x64748b;
            
            if (isConstruction) {
                // Construction site (same as DC construction)
                gfx.beginFill(0x78582e); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
                gfx.beginFill(0x475569, 0.6); gfx.drawRect(10, h-50, b.w-20, 42); gfx.endFill();
                gfx.beginFill(0x64748b);
                for (var fx=15; fx<b.w-15; fx+=25) { gfx.drawRect(fx, h-50, 4, 42); }
                gfx.endFill();
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w*0.6, h-85, 4, 77); gfx.drawRect(b.w*0.4, h-85, b.w*0.3, 3); gfx.endFill();
                gfx.beginFill(opCol); gfx.drawRect(10, h-50, b.w-20, 2); gfx.endFill();
            } else {
                // ── OPERATIONAL CHIP FAB — cleanroom white, precise, sterile ──
                gfx.beginFill(0xe2e8f0); gfx.drawRect(5, h-60, b.w-10, 60); gfx.endFill();
                gfx.beginFill(0xf8fafc); gfx.drawRect(8, h-57, b.w-16, 51); gfx.endFill();
                // Cleanroom yellow lighting strips
                for (var fy2=h-52; fy2<h-10; fy2+=12) {
                    gfx.beginFill(0xfbbf24, 0.2); gfx.drawRect(12, fy2, b.w-24, 6); gfx.endFill();
                    gfx.beginFill(0xfbbf24, 0.1); gfx.drawRect(12, fy2, b.w-24, 2); gfx.endFill();
                }
                // Filtered air intakes on roof
                gfx.beginFill(0xcbd5e1); gfx.drawRect(5, h-63, b.w-10, 5); gfx.endFill();
                gfx.beginFill(0x94a3b8);
                for (var ax=12; ax<b.w-20; ax+=20) { gfx.drawRect(ax, h-68, 12, 6); }
                gfx.endFill();
                // Hazmat markings
                gfx.beginFill(0xfbbf24); gfx.drawRect(b.w/2-15, h-8, 30, 2); gfx.endFill();
                // Accent
                gfx.beginFill(opCol); gfx.drawRect(5, h-60, b.w-10, 2); gfx.endFill();
            }
            
            // Name sign
            // Name sign
            var fabSignW = Math.min(b.w - 10, 100);
            var fabSign = new PIXI.Graphics();
            fabSign.beginFill(0x0a0a1a, 0.85); fabSign.lineStyle(1, opCol, 0.5);
            fabSign.drawRoundedRect(b.w/2 - fabSignW/2, -6, fabSignW, 10, 2); fabSign.endFill();
            container.addChild(fabSign);
            var fabTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 6, fill: opCol, fontWeight: 'bold' });
            fabTxt.anchor.set(0.5, 0.5); fabTxt.x = b.w/2; fabTxt.y = -1;
            container.addChild(fabTxt);
            if (isConstruction && dc.completion) {
                var fabCompTxt = new PIXI.Text(`EST. ${dc.completion}`, { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xfbbf24 });
                fabCompTxt.anchor.set(0.5, 0.5); fabCompTxt.x = b.w/2; fabCompTxt.y = h-24;
                container.addChild(fabCompTxt);
            }
        }
        else if (b.id === 'park') {
          gfx.beginFill(0x2d6a4f); gfx.drawRect(0, h - 12, b.w, 12); gfx.endFill();
          gfx.beginFill(0x3d7a5f); gfx.drawRect(0, h - 12, b.w, 4); gfx.endFill();
          gfx.lineStyle(2, 0x666666); gfx.moveTo(14, h - 12); gfx.lineTo(22, h - 42); gfx.lineTo(30, h - 12); gfx.moveTo(18, h - 40); gfx.lineTo(26, h - 40); gfx.lineStyle(1, 0x888888); gfx.moveTo(21, h - 39); gfx.lineTo(19, h - 22); gfx.moveTo(23, h - 39); gfx.lineTo(25, h - 22); gfx.lineStyle(0);
          gfx.beginFill(0x8b5cf6); gfx.drawRect(17, h - 22, 10, 3);
          gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 55, h - 12, 4, 30); gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 45, h - 12, 4, 30);
          gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 20, 12, 2); gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 28, 12, 2);
          gfx.endFill();
          gfx.beginFill(0x666666); gfx.drawRect(b.w - 54, h - 36, 12, 2); gfx.endFill();
          gfx.beginFill(0x555555); gfx.drawRect(b.w - 54, h - 42, 14, 4);
          gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.8); gfx.moveTo(b.w - 42, h - 40); gfx.lineTo(b.w - 20, h - 14);
          gfx.lineTo(b.w - 16, h - 14); gfx.lineTo(b.w - 40, h - 40); gfx.closePath(); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.5);
          gfx.drawRect(b.w - 20, h - 16, 6, 4); gfx.endFill();
          
          const monW = 60; const monH = 80;
          gfx.beginFill(0x1a1a30);
          gfx.drawRect(b.w / 2 - monW/2, h - monH, monW, monH); gfx.endFill();
          gfx.beginFill(0x2a2a42);
          gfx.drawRect(b.w / 2 - monW/2 + 4, h - monH + 4, monW - 8, monH - 8); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.8); gfx.drawRect(b.w / 2 - 2, h - monH + 10, 4, monH - 20); gfx.endFill();
          gfx.beginFill(0xfacc15, 0.8);
          gfx.drawRect(b.w / 2 - monW/2 - 4, h - 14, monW + 8, 4); gfx.endFill();
          
          gfx.lineStyle(2, 0xfacc15, 0.5);
          gfx.drawEllipse(b.w / 2, h - monH - 10, 30, 8); 
          gfx.lineStyle(2, 0x22d3ee, 0.5);
          gfx.drawEllipse(b.w / 2, h - monH - 20, 20, 5); gfx.lineStyle(0);
          const monIcon = new PIXI.Text('🏆', { fontFamily: emojiFontStack, fontSize: 28, fill: 0xfacc15, dropShadow: true, dropShadowColor: 0xfacc15, dropShadowBlur: 10, dropShadowDistance: 0 });
          monIcon.anchor.set(0.5, 0.5); monIcon.x = b.w / 2; monIcon.y = h - monH - 25; 
          container.addChild(monIcon); b._monIcon = monIcon;
          b.tip = "Benchmark Monument: Awaiting Scores...";
          
        } else if (b.id === 'graveyard') {
          gfx.beginFill(0x1a1a2a);
          gfx.drawRect(0, h - 12, b.w, 12); gfx.endFill(); gfx.beginFill(0x222233); gfx.drawRect(0, h - 12, b.w, 4); gfx.endFill();
          for (let i = 0; i < 6; i++) {
              const tx = 15 + i * 25, th = 18 + (i % 3) * 8;
              gfx.beginFill(0x3a3a4a); gfx.drawRoundedRect(tx, h - 12 - th, 16, th, 4); gfx.endFill();
              gfx.beginFill(0x4a4a5a);
              gfx.drawRoundedRect(tx + 2, h - 12 - th + 2, 12, th - 4, 2); gfx.endFill();
              gfx.beginFill(0x8888aa, 0.4);
              gfx.drawRect(tx + 5, h - 12 - th + 6, 6, 2);
              gfx.drawRect(tx + 4, h - 12 - th + 10, 8, 2); gfx.endFill();
          }
          gfx.beginFill(0x444466, 0.1);
          gfx.drawEllipse(b.w / 2, h - 10, b.w / 2, 12); gfx.endFill();
          
        } else if (b.id.startsWith('res_')) {
          gfx.beginFill(0x1e1e2f); gfx.drawRect(0, 0, b.w, h); gfx.endFill(); 
          
          gfx.beginFill(0x2a2a40); 
          gfx.drawRect(0, 0, b.w, 14);
          gfx.drawRect(0, 0, 8, h);
          gfx.drawRect(b.w - 8, 0, 8, h); 
          gfx.endFill(); 
          
          const cols = Math.floor((b.w - 16) / 24);
          const rows = floors;
          for (let f = 0; f < rows; f++) {
              for (let c = 0; c < cols; c++) {
                  if (f === rows - 1 && (c === Math.floor(cols/2) || c === Math.floor(cols/2)-1)) continue;
                  const wx = 16 + c * 24, wy = 20 + f * 18;
                  const lit = Math.random() > 0.4;
                  
                  gfx.beginFill(0x05050a, 0.8); gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
                  gfx.beginFill(lit ? 0xeab308 : 0x111122, lit ? 0.7 : 1);
                  gfx.drawRect(wx, wy, 12, 10); gfx.endFill();
                  
                  if (lit) {
                      gfx.beginFill(0xeab308, 0.15); gfx.drawRect(wx - 2, wy - 2, 16, 14); gfx.endFill();
                  }
              }
          }
          
          gfx.beginFill(0x0f172a);
          gfx.drawRect(b.w/2 - 24, h - 30, 48, 30); gfx.endFill();
          gfx.beginFill(0x38bdf8, 0.2);
          gfx.drawRect(b.w/2 - 20, h - 25, 18, 25);
          gfx.drawRect(b.w/2 + 2, h - 25, 18, 25); gfx.endFill();
          gfx.beginFill(0xffffff, 0.5); 
          gfx.drawRect(b.w/2 - 4, h - 15, 2, 8);
          gfx.drawRect(b.w/2 + 2, h - 15, 2, 8);
          gfx.endFill();
    
          gfx.beginFill(0x11111a); gfx.drawRect(10, -10, 40, 10); gfx.drawRect(b.w - 50, -10, 40, 10); gfx.endFill();
          
          if (b.id === 'res_cn') {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 3, 10); gfx.drawRect(b.w - 31, -20, 3, 10); gfx.endFill();
              gfx.beginFill(0xffb7c5); 
              gfx.drawCircle(29, -25, 14); gfx.drawCircle(19, -18, 10); gfx.drawCircle(39, -18, 10);
              gfx.drawCircle(b.w - 29, -25, 14); gfx.drawCircle(b.w - 19, -18, 10); gfx.drawCircle(b.w - 39, -18, 10);
              gfx.endFill();
          } else if (b.id === 'res_us') {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 4, 10); gfx.drawRect(b.w - 32, -20, 4, 10); gfx.endFill();
              gfx.beginFill(0x2d6a4f); 
              gfx.drawPolygon([30, -50, 10, -10, 50, -10]); 
              gfx.drawPolygon([b.w - 30, -50, b.w - 50, -10, b.w - 10, -10]); 
              gfx.endFill();
          } else {
              gfx.beginFill(0x3d2914); gfx.drawRect(28, -20, 4, 10); gfx.drawRect(b.w - 32, -20, 4, 10); gfx.endFill();
              gfx.beginFill(0x3d8a5f); 
              gfx.drawCircle(30, -30, 14); gfx.drawCircle(18, -20, 12); gfx.drawCircle(42, -20, 12);
              gfx.drawCircle(b.w - 30, -30, 14); gfx.drawCircle(b.w - 18, -20, 12); gfx.drawCircle(b.w - 42, -20, 12);
              gfx.endFill();
          }
          
        } else if (b.id.startsWith('metro_')) {
          gfx.beginFill(0x1a1a24); gfx.drawRect(0, h - 40, b.w, 40); gfx.endFill(); 
          gfx.beginFill(0x2a2a3e); gfx.drawRect(0, h - 45, b.w, 5); gfx.endFill(); 
          
          gfx.beginFill(0x22d3ee, 0.15);
          gfx.drawPolygon([0, h-45, b.w, h-45, b.w-20, h-70, 20, h-70]);
          gfx.endFill();
          gfx.lineStyle(2, 0x22d3ee, 0.4);
          gfx.moveTo(0, h-45); gfx.lineTo(20, h-70); gfx.lineTo(b.w-20, h-70); gfx.lineTo(b.w, h-45);
          gfx.lineStyle(0);
          
          gfx.beginFill(0x050508); gfx.drawRect(b.w/2 - 30, h - 30, 60, 30); gfx.endFill();
          gfx.beginFill(0x222233);
          for(let sy=0; sy<30; sy+=4) { gfx.drawRect(b.w/2 - 30, h - 30 + sy, 60, 2); }
          gfx.endFill();
          
          const mSign = new PIXI.Text('🚇 METRO', { fontFamily: emojiFontStack, fontSize: 12, fill: 0x4ade80, dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 8, dropShadowDistance: 0 });
          mSign.anchor.set(0.5, 0.5); mSign.x = b.w / 2; mSign.y = h - 85;
          container.addChild(mSign);
          b.tip = b.desc;

        } else {
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, 4, 6, h - 4);
          gfx.endFill();
          gfx.beginFill(colHex, 0.85); gfx.drawRect(0, 0, b.w, 14); gfx.endFill();
          gfx.beginFill(colHex, 1); gfx.drawRect(0, 0, b.w, 3); gfx.endFill();
          gfx.beginFill(0x000000, 0.15);
          gfx.drawRect(0, 11, b.w, 3); gfx.endFill();
          gfx.beginFill(colHex, 0.12); gfx.drawRect(0, 14, b.w, h - 14); gfx.endFill();
          gfx.beginFill(colHex, 0.06);
          gfx.drawRect(0, 14, b.w / 3, h - 14); gfx.endFill();
          gfx.beginFill(0xffffff, 0.02);
          gfx.drawRect(b.w * 2 / 3, 14, b.w / 3, h - 14); gfx.endFill();
          gfx.lineStyle(2, colHex, 0.3);
          gfx.drawRect(0, 14, b.w, h - 14); gfx.lineStyle(0);
          
          gfx.lineStyle(1, 0x000000, 0.2);
          for(let ty = 14; ty < h; ty += 18) { gfx.moveTo(0, ty); gfx.lineTo(b.w, ty);
          }
          for(let tx = 24; tx < b.w; tx += 24) { gfx.moveTo(tx, 14);
          gfx.lineTo(tx, h); }
          gfx.lineStyle(0);

          const cols = Math.floor(b.w / 24);
          const doorL = b.w / 2 - 8, doorR = b.w / 2 + 8;
          b._wins = [];
          b._winTexts = [];

          for (let f = 0; f < floors; f++) for (let c = 0; c < cols; c++) {
            const lit = Math.random() > .35;
            const wx = 10 + c * 24, wy = 20 + f * 18;
            if (f === floors - 1 && wx + 12 > doorL && wx < doorR) continue;
            
            gfx.beginFill(0x000000, 0.15);
            gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
            if (lit) { gfx.beginFill(0xffffff, 0.9); } else { gfx.beginFill(0x0a0a18);
            }
            gfx.drawRect(wx, wy, 12, 10); gfx.endFill();
            gfx.lineStyle(1, colHex, 0.15);
            gfx.drawRect(wx, wy, 12, 10); gfx.lineStyle(0);
            gfx.beginFill(colHex, 0.12); gfx.drawRect(wx, wy + 4, 12, 1); gfx.endFill();
            gfx.beginFill(colHex, 0.12);
            gfx.drawRect(wx + 5, wy, 1, 10); gfx.endFill();
            b._wins.push({ wx, wy, lit });
          }

          gfx.beginFill(0x0a0a18);
          gfx.drawRect(b.w / 2 - 6, h - 18, 12, 18); gfx.endFill();
          gfx.beginFill(colHex, 0.3);
          gfx.drawRect(b.w / 2 - 6, h - 18, 12, 2); gfx.endFill();
          gfx.beginFill(0xffeaa7, 0.4);
          gfx.drawCircle(b.w / 2 + 3, h - 9, 1); gfx.endFill();
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          if (b.isCheapest) {
            const neon = new PIXI.Text('SALE', { fontFamily: emojiFontStack, fontSize: 8, fill: 0x4ade80, fontStyle: 'italic', fontWeight: 'bold', dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 5, dropShadowDistance: 0, padding: 8 });
            neon.x = b.w + 2; neon.y = 40; neon.rotation = Math.PI / 2;
            container.addChild(neon); b._neonSign = neon;
          }
        }
        
        container.addChild(gfx);
        
        // ─── ROOFTOP HELIPAD for HQ buildings with founders ───
        if (!b.id.startsWith('house_') && !b.id.startsWith('res_') && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && b.id !== 'park' && b.id !== 'graveyard') {
            const hasFounder = G.ceoRefs && G.ceoRefs[b.lab];
            if (hasFounder) {
                const hpGfx = new PIXI.Graphics();
                const hpX = b.w - 35;
                const hpY = 2; // Just above the roof line
                // Pad surface
                hpGfx.beginFill(0x334155, 0.8); hpGfx.drawEllipse(hpX, hpY, 16, 5); hpGfx.endFill();
                // H marking
                hpGfx.beginFill(0xffffff, 0.5);
                hpGfx.drawRect(hpX - 5, hpY - 3, 2, 6);
                hpGfx.drawRect(hpX + 3, hpY - 3, 2, 6);
                hpGfx.drawRect(hpX - 5, hpY - 0.5, 10, 1);
                hpGfx.endFill();
                // Corner lights
                hpGfx.beginFill(0xfbbf24, 0.7);
                hpGfx.drawCircle(hpX - 14, hpY, 1.5);
                hpGfx.drawCircle(hpX + 14, hpY, 1.5);
                hpGfx.endFill();
                container.addChild(hpGfx);
            }
        }
        
        if (b.isTopLab && !b.id.startsWith('house_') && !b.id.startsWith('forest_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_')) {
            const beaconCont = new PIXI.Container();
            beaconCont.y = -22; 
            const beam = new PIXI.Graphics();
            beam.beginFill(0x22d3ee, 0.15); beam.drawRect(b.w/2 - 15, -2000, 30, 2000); beam.endFill();
            beam.beginFill(0xffffff, 0.2);
            beam.drawRect(b.w/2 - 5, -2000, 10, 2000); beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD; beaconCont.addChild(beam);
            const crown = new PIXI.Text('👑', { fontFamily: emojiFontStack, fontSize: 32, fill: 0xfacc15, dropShadow: true, dropShadowColor: 0xfacc15, dropShadowBlur: 15, dropShadowDistance: 0, padding: 20 });
            crown.anchor.set(0.5, 0.5); crown.x = b.w / 2; crown.y = -120;
            beaconCont.addChild(crown);
            
            const emitter = new PIXI.Graphics();
            emitter.beginFill(0x22d3ee, 0.8);
            emitter.drawEllipse(b.w/2, 0, 24, 6); emitter.endFill();
            beaconCont.addChild(emitter);
            container.addChild(beaconCont); b._beacon = { beam, emitter, crown };
        }

        if (lab && lab.ticker && !b.id.startsWith('house_') && !b.id.startsWith('forest_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_')) {
            const tickCont = new PIXI.Container();
            tickCont.y = 0; 
            const tickBg = new PIXI.Graphics();
            tickBg.beginFill(0x000000, 0.85); tickBg.drawRect(0, 0, b.w, 14); tickBg.endFill();
            tickCont.addChild(tickBg);
            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff); mask.drawRect(0, -5, b.w, 24); mask.endFill();
            tickCont.addChild(mask); tickCont.mask = mask;
            const tickTxt = new PIXI.Text(`${lab.ticker} AWAITING TELEMETRY`, { 
                fontFamily: 'monospace', fontSize: 10, fontWeight: '900', strokeThickness: 1, 
                fill: 0x888888, stroke: 0x888888, dropShadow: true, dropShadowColor: 0x888888, dropShadowBlur: 10, dropShadowDistance: 0, padding: 10
            });
            tickTxt.y = 1; tickTxt.x = b.w; tickTxt.blendMode = PIXI.BLEND_MODES.ADD;
            tickCont.addChild(tickTxt); b._stockTicker = tickTxt; b._tickerW = b.w; b._tickerSym = lab.ticker;
            container.addChild(tickCont);
        }

        const winFaces = new PIXI.Graphics();
        container.addChild(winFaces); b._winFaces = winFaces; b._winTexts = [];
        if (b._wins) { b._wins.forEach(win => { const t = new PIXI.Text('', { fontSize: 8, fill: 0xffffff }); t.anchor.set(0.5, 0.5); t.x = win.wx + 6; t.y = win.wy + 5; t.visible = false; container.addChild(t); b._winTexts.push(t); });
        }
  
        if (b.id !== 'park' && b.id !== 'graveyard' && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('house_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_')) {
            const sign = new PIXI.Text(b.name, { fontFamily: 'Silkscreen', fontSize: 7, fill: 0x9898c0, align: 'center' });
            sign.anchor.set(0.5, 0); sign.x = b.w / 2; sign.y = h + 4;
            if (sign.width > b.w - 4) sign.scale.set((b.w - 4) / sign.width);
            container.addChild(sign); b._sign = sign;
            if (lab) {
                const boardW = b.w * 0.8;
                const boardH = 24; const boardX = b.w / 2 - boardW / 2; const boardY = -boardH - 10;
                gfx.beginFill(0x111111); gfx.lineStyle(2, colHex, 0.8); 
                gfx.drawRect(boardX, boardY, boardW, boardH); gfx.endFill(); gfx.lineStyle(0);
                gfx.beginFill(0x333333); gfx.drawRect(boardX + 10, boardY + boardH, 4, 10);
                gfx.drawRect(boardX + boardW - 14, boardY + boardH, 4, 10); gfx.endFill();
                const logoTxt = new PIXI.Text(lab.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 10, fontWeight: 'bold', fill: 0xffffff, letterSpacing: 1, dropShadow: true, dropShadowColor: colHex, dropShadowBlur: 8, dropShadowDistance: 0 });
                logoTxt.anchor.set(0.5, 0.5); logoTxt.x = b.w / 2; logoTxt.y = boardY + boardH / 2;
                if (logoTxt.width > boardW - 8) logoTxt.scale.set((boardW - 8) / logoTxt.width);
                container.addChild(logoTxt);
            } else {
                const logoBg = new PIXI.Graphics();
                logoBg.beginFill(0x0e0e22); logoBg.lineStyle(2, 0x222248); logoBg.drawRoundedRect(-18, -18, 36, 36, 6); logoBg.endFill(); logoBg.x = b.w / 2; logoBg.y = -22; container.addChild(logoBg);
                const colStr = '#9898c0'; 
                const logoTxt = new PIXI.Text(b.emoji || '🏢', { fontFamily: emojiFontStack, fontSize: 18, fill: colStr, align: 'center' });
                logoTxt.anchor.set(0.5, 0.5); logoTxt.x = b.w / 2; logoTxt.y = -22; container.addChild(logoTxt);
            }
        }
  
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.hitArea = new PIXI.Rectangle(0, 0, b.w, h + 10);
        container.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.selectBld(b);
        });
        container.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, b.name, b.tip || b.desc); });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
  
        this.bldLayer.addChild(container); b._container = container;
      });
    },

    updateWeather() {
      if (G.tick <= this.nextWeatherTick) return;
      this.season = this.getSeason();
      let weathers;
      if (this.season === 'winter') weathers = ['clear', 'clear', 'clear', 'snow', 'snow', 'rain'];
      else if (this.season === 'spring') weathers = ['clear', 'clear', 'clear', 'rain', 'cherry'];
      else if (this.season === 'autumn') weathers = ['clear', 'clear', 'clear', 'rain']; else weathers = ['clear', 'clear', 'clear', 'clear', 'rain'];
      const nw = weathers[Math.floor(Math.random() * weathers.length)];
      
      if (nw !== this.weather) {
        this.weather = nw;
        this.rainDrops = []; this.snowFlakes = []; this.petals = [];
        if (typeof UI !== 'undefined') {
            if (nw === 'rain') { UI.addToast('🌧️ A rainstorm has started!');
            G.unlockAchieve('rain_seen'); } 
            else if (nw === 'snow') { UI.addToast('❄️ Snow is falling!'); G.unlockAchieve('snow_seen'); } 
            else if (nw === 'cherry') UI.addToast('🌸 Cherry blossoms drifting!'); 
            else if (G.tick > 1500) UI.addToast('☀️ Weather cleared up.');
        }
      }
      this.nextWeatherTick = G.tick + 2000 + Math.floor(Math.random() * 3000);
    },

    updateDesertWeather() {
      if (G.tick <= this.nextDesertWeatherTick) return;
      // Desert: mostly clear with occasional sandstorms
      const desertOptions = ['clear', 'clear', 'clear', 'clear', 'clear', 'sandstorm'];
      const nw = desertOptions[Math.floor(Math.random() * desertOptions.length)];
      
      if (nw !== this.desertWeather) {
        this.desertWeather = nw;
        this.sandParticles = [];
        if (typeof UI !== 'undefined') {
            if (nw === 'sandstorm') UI.addToast('🏜️ A sandstorm is sweeping the launch zone!');
            else if (this.desertWeather === 'sandstorm') UI.addToast('☀️ The sandstorm has passed.');
        }
      }
      this.nextDesertWeatherTick = G.tick + 3000 + Math.floor(Math.random() * 4000);
    },

    // Get desert zone X range for particle culling
    _getDesertRange() {
      let sX = Infinity, eX = 0;
      if (typeof SPACE_BLDS !== 'undefined' && window.BLDS) {
          BLDS.forEach(b => {
              if (b.type && ['launchpad', 'mission_control', 'assembly', 'tracking'].includes(b.type)) {
                  if (b.x < sX) sX = b.x;
                  if (b.x + b.w > eX) eX = b.x + b.w;
              }
          });
          if (sX < Infinity) { sX = Math.max(0, sX - 60); eX += 60; }
      }
      return sX < Infinity ? { start: sX, end: eX } : null;
    },

    drawWeather() {
      const g = this.fxGfx; g.clear(); const vw = G.vpW, vh = G.vpH, wx = -G.world.x;
      const wy = -(G.world.y || 0); // vertical camera offset in world coords
      const desert = this._getDesertRange();
      
      // ─── CITY WEATHER (skip desert zone) ───
      if (this.weather === 'rain') {
        while (this.rainDrops.length < 250) this.rainDrops.push({ x: wx + Math.random() * vw, y: Math.random() * vh, s: 4 + Math.random() * 4 });
        g.lineStyle(1, 0x88bbdd, 0.3); 
        this.rainDrops.forEach(d => { 
            d.y += d.s; d.x -= 0.8; 
            if (d.y > vh) { d.y = -10; d.x = wx + Math.random() * vw; }
            // Skip particles that fall in the desert zone
            if (desert && d.x >= desert.start && d.x <= desert.end) return;
            g.moveTo(d.x, d.y); g.lineTo(d.x - 1.5, d.y + 14); 
        });
      } else if (this.weather === 'snow') {
        while (this.snowFlakes.length < 120) this.snowFlakes.push({ x: wx + Math.random() * vw, y: Math.random() * vh, s: 0.5 + Math.random() * 1.2, r: 1 + Math.random() * 2, dx: Math.random() * 0.5 - 0.25 });
        this.snowFlakes.forEach(d => { 
            d.y += d.s; d.x += d.dx + Math.sin(G.tick * 0.02 + d.r) * 0.3; 
            if (d.y > vh) { d.y = -5; d.x = wx + Math.random() * vw; } 
            if (desert && d.x >= desert.start && d.x <= desert.end) return;
            g.beginFill(0xffffff, 0.5); g.drawCircle(d.x, d.y, d.r); g.endFill(); 
        });
      } else if (this.weather === 'cherry') {
        while (this.petals.length < 60) this.petals.push({ x: wx + Math.random() * vw, y: Math.random() * vh, s: 0.3 + Math.random() * 0.8, r: Math.random() * Math.PI, rot: Math.random() * 0.02 });
        this.petals.forEach(d => { 
            d.y += d.s; d.x += Math.sin(d.r += d.rot) * 0.5; 
            if (d.y > vh) { d.y = -8; d.x = wx + Math.random() * vw; } 
            if (desert && d.x >= desert.start && d.x <= desert.end) return;
            g.beginFill(0xffb7c5, 0.5); g.drawEllipse(d.x, d.y, 3, 1.5); g.endFill(); 
        });
      }
      
      // ─── DESERT WEATHER (sandstorm — only in desert zone) ───
      if (this.desertWeather === 'sandstorm' && desert) {
        while (this.sandParticles.length < 200) {
            this.sandParticles.push({ 
                x: desert.start + Math.random() * (desert.end - desert.start), 
                y: wy + Math.random() * vh, 
                s: 3 + Math.random() * 5,
                vy: (Math.random() - 0.3) * 2,
                size: 1 + Math.random() * 3,
                alpha: 0.1 + Math.random() * 0.4
            });
        }
        this.sandParticles.forEach(d => { 
            d.x += d.s; 
            d.y += d.vy + Math.sin(G.tick * 0.03 + d.x * 0.01) * 0.5;
            // Wrap within desert zone
            if (d.x > desert.end) { d.x = desert.start; d.y = wy + Math.random() * vh; }
            if (d.y > wy + vh) d.y = wy - 5;
            if (d.y < wy - 10) d.y = wy + vh;
            g.beginFill(0xd4a574, d.alpha); 
            g.drawEllipse(d.x, d.y, d.size * 2, d.size * 0.6); 
            g.endFill(); 
        });
        
        // Sandstorm haze overlay (darkens the desert) — covers full visible area
        g.beginFill(0xc2956a, 0.06 + Math.sin(G.tick * 0.01) * 0.02);
        g.drawRect(desert.start, wy - 200, desert.end - desert.start, vh + 400);
        g.endFill();
      }
    },

    update(dp, night, occ) {
        const vp = document.getElementById('viewport');
        let sky;
        if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        else if (dp < .30) { const t = (dp - .22) / .08;
        sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`;
        }
        else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        else if (dp < .84) { const t = (dp - .72) / .12;
        sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`;
        }
        else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        if (this.weather === 'rain' && !night && dp > .3 && dp < .72) sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
        if (this.weather === 'snow') sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        vp.style.background = sky;
    
        this.starsLayer.visible = night;
        if (night) this.starsLayer.children.forEach(s => { s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; });
        const cel = this.celestialGfx; cel.clear();
        if (night) { 
          let np = dp > 0.83 ?
          (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42;
          cel.beginFill(0xe8e8d0);
          cel.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); cel.endFill();
        } else { 
          let dayP = (dp - 0.25) / (0.83 - 0.25);
          cel.beginFill(0xffe066);
          cel.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15); cel.endFill();
        }
        
        this.cloudLayer.children.forEach(c => { c.x = c._bx + Math.sin(G.tick * (c._drift || .003) + c._i) * 40; c.alpha = (this.weather === 'rain' || this.weather === 'snow') ? .30 : .10 + Math.sin(G.tick * 0.001 + c._i) * 0.03; });
        if (G.viewMode === 'micro') { this.updateWeather(); this.updateDesertWeather(); } this.drawWeather(); let targetRefAlpha = 0;
        if (night) { if (this.weather === 'rain') targetRefAlpha = 0.95; else if (this.weather === 'snow') targetRefAlpha = 0.5;
        else targetRefAlpha = 0.35; } else { if (this.weather === 'rain') targetRefAlpha = 0.4;
        else if (this.weather === 'snow') targetRefAlpha = 0.2; } this.reflectionLayer.alpha += (targetRefAlpha - this.reflectionLayer.alpha) * 0.05;
        const targetLightAlpha = night ? 1 : 0; if(this.lightLayer) { this.lightLayer.alpha += (targetLightAlpha - this.lightLayer.alpha) * 0.05;
        } 
        
        if (G.tick % 60 === 0) { 
            BLDS.forEach(b => { 
                const list = occ[b.id] || []; const ct = list.length; 
                if (b._sign && b._sign.text !== undefined) { 
                    if (ct > 0) b._sign.text = `${b.name} [${ct}]`; else b._sign.text = b.name; b._sign.scale.set(1); 
                    if (b._sign.width > b.w - 4) b._sign.scale.set((b.w - 4) / b._sign.width); 
                } 
                if (b._winFaces && b._wins) { 
                    b._winFaces.clear(); b._wins.forEach((win, wi) => { 
                        if (wi < ct) { 
                            b._winFaces.beginFill(0xffffff, 0.9); b._winFaces.drawRect(win.wx, win.wy, 12, 10); b._winFaces.endFill(); b._winFaces.beginFill(0xffeaa7, 0.15); b._winFaces.drawRect(win.wx - 1, win.wy - 1, 14, 12); b._winFaces.endFill(); 
                        } 
                    }); 
                    if (b._winTexts) { 
                        b._winTexts.forEach((t, wi) => { 
                            if (wi < ct) { 
                                const occ_item = list[wi]; const ai = ACTS[occ_item?.act]; t.text = ai ? ai.icon : '💻'; t.visible = true; 
                            } else { 
                                t.visible = false; 
                            } 
                        }); 
                    } 
                } 
            });
            if (G.bloomFilter) { 
                const targetBloom = night ? 1.8 : 0.8; G.bloomFilter.bloomScale += (targetBloom - G.bloomFilter.bloomScale) * 0.05;
            } 
        } 
        
        BLDS.forEach(b => { 
            if (b._beacon) { 
                b._beacon.beam.alpha = 0.7 + Math.sin(G.tick * 0.1) * 0.3; 
                if (b._beacon.crown) { 
                    b._beacon.crown.scale.set(1 + Math.sin(G.tick * 0.05) * 0.1); b._beacon.crown.y = -120 + Math.sin(G.tick * 0.08) * 5; 
                } 
            } 
            if (b._stockTicker && b._tickerW) { 
                b._stockTicker.x -= 0.6; 
                if (b._stockTicker.x + b._stockTicker.width < 0) { 
                    b._stockTicker.x = b._tickerW; 
                } 
                if (G.tick % 60 === 0 && typeof API !== 'undefined' && API.stockPrices && API.stockPrices[b._tickerSym]) { 
                    const sd = API.stockPrices[b._tickerSym]; b._stockTicker.text = `${b._tickerSym} $${sd.price} [${sd.change}]`; b._stockTicker.style.fill = sd.color; b._stockTicker.style.stroke = sd.color; b._stockTicker.style.dropShadow = true; b._stockTicker.style.dropShadowColor = sd.color; b._stockTicker.style.dropShadowBlur = 10; 
                } 
            } 
        });
        
        if (G.tick % 120 === 0) { 
            const park = G.bldById['park'];
            if (park && park._monIcon) { 
                const sorted = [...G.models].filter(m => !m.ret || new Date(m.ret) > new Date()).map(m => { const elo = BM[m.id]?.ELO || 0; const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0; return { m, score: elo ? ((elo - 1000) / 4.5) : avg }; }).sort((a, b) => b.score - a.score);
                const top = sorted[0]; 
                if (top) { 
                    const lab = LABS[top.m.lab] || LABS.other; const display = BM[top.m.id]?.ELO ?
                    BM[top.m.id].ELO + ' Elo' : ((typeof avgBM === 'function' ? avgBM(top.m.id) : '??') + '%'); park._monIcon.text = lab.icon || '★';
                    park._monIcon.style.fill = lab.color; park._monIcon.style.fontSize = 24; park.tip = `Current #1 Leader:\n${top.m.name} (${display})`; 
                } 
            } 
        } 
    } 
};
