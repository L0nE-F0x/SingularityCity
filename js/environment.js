/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENVIRONMENT LAYER (v16.3.1 - Visibility Culling, Dirty-Flag, CacheAsBitmap)
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
      // Absolute bottom fill — below tunnel cavity (gy+70 to gy+170 must stay transparent for undergroundLayer)
      g.beginFill(0x0a0a0f); g.drawRect(-4000, gy + 170, G.cityW + 8000, 3000); g.endFill();
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

      // ─── Determine port zone X range ───
      let portStartX = Infinity, portEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('port_')) {
              if (b.x < portStartX) portStartX = b.x;
              if (b.x + b.w > portEndX) portEndX = b.x + b.w;
          }
      });
      const hasPortZone = portStartX < Infinity && portEndX > 0;
      if (hasPortZone) { portStartX = Math.max(0, portStartX - 80); portEndX += 40; }

      // ─── Determine power zone X range ───
      let powerStartX = Infinity, powerEndX = 0;
      BLDS.forEach(b => {
          if (b.id.startsWith('power_')) {
              if (b.x < powerStartX) powerStartX = b.x;
              if (b.x + b.w > powerEndX) powerEndX = b.x + b.w;
          }
      });
      const hasPowerZone = powerStartX < Infinity && powerEndX > 0;
      if (hasPowerZone) { powerStartX -= 120; powerEndX += 40; }

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

      // ─── PORT ZONE OCEAN TERRAIN ───
      if (hasPortZone) {
          const pw = portEndX - portStartX + 40;
          const psx = 0;
          // Deep ocean surface
          g.beginFill(0x0a1628); g.drawRect(psx, gy - 24, pw, 24); g.endFill();
          g.beginFill(0x0c1e3a); g.drawRect(psx, gy - 18, pw, 18); g.endFill();
          g.beginFill(0x1a5a8a, 0.25); g.drawRect(psx, gy - 6, pw, 4); g.endFill();
          // Wooden dock planks
          g.beginFill(0x5a4a3a); g.drawRect(portStartX, gy - 3, portEndX - portStartX, 5); g.endFill();
          for (let dx = portStartX; dx < portEndX; dx += 12) { g.beginFill(0x4a3a2a); g.drawRect(dx, gy - 3, 1, 5); g.endFill(); }
          // Dock posts + bollards
          for (let pp = portStartX + 30; pp < portEndX; pp += 60) { g.beginFill(0x3a2a1a); g.drawRect(pp, gy + 2, 5, 14); g.endFill(); }
          for (let bb = portStartX + 50; bb < portEndX - 40; bb += 80) { g.beginFill(0xfbbf24); g.drawCircle(bb, gy - 5, 3); g.endFill(); }
          // Water SOLID FILL covering ALL underground
          g.beginFill(0x061220); g.drawRect(psx, gy, pw, 600); g.endFill();
          g.beginFill(0x0e2240, 0.5); g.drawRect(psx, gy, pw, 8); g.endFill();
          for (let wx = psx; wx < psx + pw; wx += 18) { g.beginFill(0x2a7aaa, 0.12); g.drawRect(wx, gy + 2, 10, 1); g.endFill(); }
          // ─── COASTLINE (port → desert) ───
          const coastX = portEndX - 10;
          g.beginFill(0x8a7a5a); g.drawRect(coastX, gy - 6, 20, 22); g.endFill();
          g.beginFill(0xa8956a); g.drawRect(coastX + 20, gy - 4, 25, 20); g.endFill();
          g.beginFill(0xc4a872); g.drawRect(coastX + 45, gy - 3, 30, 18); g.endFill();
          g.beginFill(0xd4b882, 0.5); g.drawRect(coastX + 75, gy - 2, 25, 16); g.endFill();
          g.beginFill(0xffffff, 0.12); g.drawRect(coastX - 2, gy - 2, 5, 1); g.endFill();
          // Palm trees (proper polygon fronds)
          for (let ptx = coastX + 18; ptx < coastX + 65; ptx += 25) {
              g.beginFill(0x6b4226); g.moveTo(ptx+4,gy-4); g.lineTo(ptx+1,gy-28); g.lineTo(ptx-2,gy-50); g.lineTo(ptx+2,gy-50); g.lineTo(ptx+5,gy-28); g.lineTo(ptx+8,gy-4); g.closePath(); g.endFill();
              g.beginFill(0x7a5030, 0.4); for(let ty=gy-46;ty<gy-8;ty+=6){g.drawRect(ptx-1,ty,6,2);} g.endFill();
              g.beginFill(0x2d8a4e, 0.8);
              g.drawPolygon([ptx,gy-50, ptx-18,gy-38, ptx-14,gy-42, ptx-1,gy-48]);
              g.drawPolygon([ptx+4,gy-50, ptx+22,gy-38, ptx+18,gy-42, ptx+5,gy-48]);
              g.endFill();
              g.beginFill(0x38a85e, 0.7);
              g.drawPolygon([ptx+1,gy-52, ptx-10,gy-46, ptx-6,gy-50, ptx,gy-50]);
              g.drawPolygon([ptx+3,gy-52, ptx+14,gy-46, ptx+10,gy-50, ptx+4,gy-50]);
              g.drawPolygon([ptx+2,gy-50, ptx-5,gy-34, ptx-1,gy-38, ptx+1,gy-48]);
              g.drawPolygon([ptx+2,gy-50, ptx+9,gy-34, ptx+5,gy-38, ptx+3,gy-48]);
              g.endFill();
              g.beginFill(0x5a3a1a); g.drawCircle(ptx+1,gy-47,2); g.drawCircle(ptx+4,gy-46,2); g.endFill();
          }
      }

      // ─── POWER ZONE INDUSTRIAL TERRAIN ───
      if (hasPowerZone) {
          const pw = G.cityW + 200 - powerStartX; // Extend to map edge
          // Road + sidewalk (matches city terrain)
          g.beginFill(0x2a2a42); g.drawRect(powerStartX, gy - 24, pw, 24); g.endFill();
          g.beginFill(0x33334a); g.drawRect(powerStartX, gy - 24, pw, 12); g.endFill();
          g.beginFill(0x44445a); g.drawRect(powerStartX, gy - 24, pw, 2); g.endFill();
          // Sidewalk cracks
          for (let x = powerStartX; x < powerStartX + pw; x += 30) { g.beginFill(0x3a3a50, 0.3); g.drawRect(x, gy - 22, 1, 20); g.endFill(); }
          // Road
          g.beginFill(0x1e1e32); g.drawRect(powerStartX, gy, pw, 32); g.endFill();
          g.beginFill(0x22223a); g.drawRect(powerStartX, gy, pw, 16); g.endFill();
          g.beginFill(0x2a2a3e); g.drawRect(powerStartX, gy, pw, 2); g.endFill();
          // Road dashes
          for (let x = powerStartX; x < powerStartX + pw; x += 40) { g.beginFill(0x50506a); g.drawRect(x, gy + 14, 20, 3); g.endFill(); }
          g.beginFill(0x50506a, 0.3); g.drawRect(powerStartX, gy + 2, pw, 1); g.endFill();
          g.beginFill(0x50506a, 0.3); g.drawRect(powerStartX, gy + 29, pw, 1); g.endFill();
          // (Underground fill drawn AFTER all city infrastructure — see power zone overpaint below)
          // (Power line poles handled by city-wide pole system below)
          // Dead grass / scrub between buildings
          const powerBlds = BLDS.filter(b => b.id.startsWith('power_'));
          for (let sx = powerStartX + 110; sx < powerEndX + 100; sx += 25 + Math.random() * 20) {
              if (!powerBlds.some(b => sx > b.x - 5 && sx < b.x + b.w + 5)) {
                  g.beginFill(0x5a5530, 0.4); g.drawRect(sx, gy - 8, 1, 4 + Math.random() * 4); g.drawRect(sx + 3, gy - 6, 1, 3 + Math.random() * 3); g.endFill();
              }
          }
          // Chain link fence at zone entrance
          g.beginFill(0x6b7280, 0.3); g.drawRect(powerStartX + 100, gy - 22, 2, 18); g.drawRect(powerStartX + 100, gy - 20, 20, 1); g.endFill();
      }

      if (hasSpaceZone) {
          // Desert terrain for space zone
          if (typeof SpaceEnvironment !== 'undefined') {
              SpaceEnvironment.buildDesertTerrain(g, gy, spaceStartX, spaceEndX);
              SpaceEnvironment.buildDesertScenery(g, gy, spaceStartX, spaceEndX);
          }
          // City terrain: skip port zone, space zone, and power zone
          if (hasPortZone) {
              // ocean covers from 0 to portStartX
              drawCityTerrain(portEndX, spaceStartX);
          } else {
              drawCityTerrain(0, spaceStartX);
          }
          drawCityTerrain(spaceEndX, hasPowerZone ? powerStartX : G.cityW);
      } else {
          if (hasPortZone) {
              // ocean covers from 0 to portStartX
              drawCityTerrain(portEndX, hasPowerZone ? powerStartX : G.cityW);
          } else {
              drawCityTerrain(0, hasPowerZone ? powerStartX : G.cityW);
          }
      }

      // Underground base (skip special zones)
      if (hasSpaceZone || hasPortZone) {
          const segments = [];
          let cursor = -2000;
          if (hasPortZone) { segments.push([cursor, portStartX]); cursor = portEndX; }
          if (hasSpaceZone) { segments.push([cursor, spaceStartX]); cursor = spaceEndX; }
          segments.push([cursor, G.cityW + 4000]);
          segments.forEach(([s, e]) => { if (e > s) { g.beginFill(0x0a0a0f); g.drawRect(s, gy + 32, e - s, 38); g.endFill(); } });
      } else {
          g.beginFill(0x0a0a0f); g.drawRect(-2000, gy + 32, G.cityW + 4000, 38); g.endFill();
      }

      // Helper: draw a horizontal element only in city zones (skip desert)
      const cityLeft = hasSpaceZone ? spaceEndX : 0;
      const drawCityH = (y, h, col, alpha) => {
          const a = alpha != null ? alpha : 1;
          // Draw in segments, skipping port and space zones
          const zones = [];
          if (hasPortZone) zones.push([portStartX, portEndX]);
          if (hasSpaceZone) zones.push([spaceStartX, spaceEndX]);
          zones.sort((a, b) => a[0] - b[0]);
          let cursor = -2000;
          zones.forEach(([zs, ze]) => { if (cursor < zs) { g.beginFill(col, a); g.drawRect(cursor, y, zs - cursor, h); g.endFill(); } cursor = ze; });
          g.beginFill(col, a); g.drawRect(cursor, y, G.cityW + 4000 - cursor, h); g.endFill();
      };
      // Helper: is X in a non-city zone?
      const inSpecialZone = (x) => (hasSpaceZone && x >= spaceStartX && x <= spaceEndX) || (hasPortZone && x >= portStartX && x <= portEndX) || (hasPowerZone && x >= powerStartX && x <= powerEndX);

      const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
      const cableEndX = hasPowerZone ? powerStartX : G.cityW + 2000;
      for (let i = 0; i < 25; i++) {
          const cy = gy + 35 + Math.random() * 30; 
          const thickness = 1 + Math.random() * 2;
          const col = cableCols[Math.floor(Math.random() * cableCols.length)];
          const alpha = 0.3 + Math.random() * 0.5;
          
          g.lineStyle(thickness, col, alpha);
          let startCableX = -2000;
          if (hasPortZone) startCableX = Math.max(startCableX, portEndX);
          if (hasSpaceZone) startCableX = Math.max(startCableX, spaceEndX);
          g.moveTo(startCableX, cy);
          
          let currentY = cy;
          for(let cx = startCableX; cx < cableEndX; cx += 150) {
              currentY += (Math.random() * 12 - 6);
              if (currentY < gy + 35) currentY = gy + 35;
              if (currentY > gy + 65) currentY = gy + 65; 
              g.lineTo(cx, currentY);
          }
          g.lineStyle(0);
      }

      for(let i = 0; i < 200; i++) {
          let cableMinX = -1000;
          if (hasPortZone) cableMinX = Math.max(cableMinX, portEndX);
          if (hasSpaceZone) cableMinX = Math.max(cableMinX, spaceEndX);
          const nx = cableMinX + Math.random() * (cableEndX - cableMinX);
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

      // Rock/earth fill AFTER the tunnel ends — covers gy+70 to gy+270 (stop before power zone)
      const rockEndX = G.cityW + 4000;
      g.beginFill(0x2d1a11); 
      g.drawRect(tunnelEndX, gy + 70, rockEndX - tunnelEndX, 200); 
      g.endFill();

      let rockSeed = 99;
      const rRand = () => { rockSeed = (rockSeed * 16807) % 2147483647; return (rockSeed - 1) / 2147483646; };
      for (let rx = tunnelEndX; rx < rockEndX; rx += 12) {
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
          if (inSpecialZone(px)) continue;
          g.beginFill(0x334155); g.drawRect(px, gy + 175, 15, 40); g.endFill(); 
          g.beginFill(0x0ea5e9); g.drawRect(px + 50, gy + 218, 10, 12); g.endFill(); 
          g.beginFill(0xf59e0b); g.drawRect(px + 100, gy + 233, 10, 16); g.endFill(); 
      }
      
      // ─── PORT ZONE: Deep ocean cover (drawn AFTER all underground to cover any leftover textures) ───
      if (hasPortZone) {
          const pw = portEndX - portStartX;
          // Solid deep ocean covers entire underground area
          g.beginFill(0x061220); g.drawRect(portStartX - 20, gy + 32, pw + 40, 250); g.endFill();
          // Water gradient layers
          g.beginFill(0x081830, 0.8); g.drawRect(portStartX - 20, gy + 32, pw + 40, 40); g.endFill();
          g.beginFill(0x0a2040, 0.5); g.drawRect(portStartX - 20, gy + 70, pw + 40, 30); g.endFill();
          // Sandy ocean floor
          g.beginFill(0x2a2218); g.drawRect(portStartX - 20, gy + 230, pw + 40, 20); g.endFill();
          g.beginFill(0x3a3228, 0.5); g.drawRect(portStartX - 20, gy + 225, pw + 40, 8); g.endFill();
          // Coral reef patches
          let coralSeed = 77;
          const cr = () => { coralSeed = (coralSeed * 16807) % 2147483647; return (coralSeed - 1) / 2147483646; };
          const coralCols = [0xff6b6b, 0xff9a76, 0xffd166, 0xa8e6cf, 0xf4845f, 0xf78ca0, 0x7ec8e3, 0xc5a3ff];
          for (let cx = portStartX + 20; cx < portEndX - 20; cx += 30 + cr() * 40) {
              const cc = coralCols[Math.floor(cr() * coralCols.length)];
              const ch = 8 + cr() * 18;
              const cw = 6 + cr() * 12;
              const cy = gy + 210 - ch;
              // Coral branches
              g.beginFill(cc, 0.5 + cr() * 0.3);
              if (cr() > 0.5) {
                  // Fan coral
                  g.drawEllipse(cx, cy + ch/2, cw, ch/2);
              } else {
                  // Branch coral
                  g.drawRect(cx, cy, cw * 0.3, ch);
                  g.drawRect(cx - cw * 0.3, cy + ch * 0.3, cw * 0.7, ch * 0.15);
                  g.drawRect(cx + cw * 0.2, cy + ch * 0.5, cw * 0.6, ch * 0.12);
              }
              g.endFill();
          }
          // (Fish schools and algae are animated in port_env.js)
          // Air bubbles
          for (let bi = 0; bi < 12; bi++) {
              const bx = portStartX + 30 + cr() * (pw - 60);
              const by = gy + 50 + cr() * 150;
              g.beginFill(0x88ccff, 0.15 + cr() * 0.15);
              g.drawCircle(bx, by, 1 + cr() * 3);
              g.endFill();
          }
          // Light rays from surface
          for (let ri = 0; ri < 4; ri++) {
              const rx = portStartX + 60 + ri * (pw / 4);
              g.beginFill(0x4488cc, 0.03);
              g.moveTo(rx, gy + 32); g.lineTo(rx - 20, gy + 200); g.lineTo(rx + 20, gy + 200);
              g.closePath(); g.endFill();
          }
      }

      // ─── POWER ZONE: Underground overpaint (drawn AFTER all city infrastructure) ───
      if (hasPowerZone) {
          const ppw = G.cityW + 200 - powerStartX;
          // Solid fill covers metro tunnel, data cables, everything
          g.beginFill(0x0a0a0f); g.drawRect(powerStartX, gy + 32, ppw, 38); g.endFill();
          g.beginFill(0x2d1a11); g.drawRect(powerStartX, gy + 70, ppw, 200); g.endFill();
          // Rock texture
          let prs = 77;
          const prr = () => { prs = (prs * 16807) % 2147483647; return (prs - 1) / 2147483646; };
          for (let rx = powerStartX; rx < powerStartX + ppw; rx += 14) {
              for (let ry = gy + 70; ry < gy + 270; ry += 14) {
                  if (prr() > 0.5) { g.beginFill(prr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7); g.drawRect(rx+prr()*8, ry+prr()*8, 2+prr()*3, 2+prr()*2); g.endFill(); }
              }
          }
          // Water trunk (blue at gy+220 — matches city)
          g.beginFill(0x0369a1); g.drawRect(powerStartX, gy + 220, ppw, 8); g.endFill();
          g.beginFill(0x0284c7); g.drawRect(powerStartX, gy + 222, ppw, 4); g.endFill();
          // Power trunk (orange at gy+235 — matches city)
          g.beginFill(0xb45309); g.drawRect(powerStartX, gy + 235, ppw, 12); g.endFill();
          g.beginFill(0xd97706); g.drawRect(powerStartX, gy + 237, ppw, 8); g.endFill();
          // Vertical risers
          const pwrBlds = BLDS.filter(b => b.id.startsWith('power_'));
          pwrBlds.forEach(pb => {
              const cx = pb.x + pb.w / 2;
              // Water riser (blue, from gy+32 down to water trunk at gy+220)
              g.beginFill(0x0284c7, 0.4); g.drawRect(cx - 2, gy + 32, 3, 188); g.endFill();
              g.beginFill(0x0369a1, 0.6); g.drawRect(cx - 4, gy + 218, 7, 5); g.endFill();
              // Power riser (orange, from gy+32 down to power trunk at gy+235)
              g.beginFill(0xd97706, 0.5); g.drawRect(cx + 10, gy + 32, 4, 203); g.endFill();
              g.beginFill(0xb45309, 0.7); g.drawRect(cx + 8, gy + 233, 8, 6); g.endFill();
              g.beginFill(0xfbbf24, 0.5); g.drawCircle(cx + 12, gy + 236, 3); g.endFill();
          });
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
        if (inSpecialZone(tx)) continue; // Skip desert zone — SpaceEnvironment draws its own scenery
        
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

      // ─── CITY-WIDE POWER LINE POLES ───
      const poleBlocked = [];
      if (window.BLDS) BLDS.forEach(b => { poleBlocked.push({ l: b.x - 35, r: b.x + b.w + 35 }); });
      const forestBlds = BLDS ? BLDS.filter(b => b.id === 'forest_0' || b.id === 'forest_1' || b.id === 'forest_space') : [];
      forestBlds.forEach(f => { poleBlocked.push({ l: f.x - 40, r: f.x + f.w + 40 }); });
      if (hasPortZone) poleBlocked.push({ l: portStartX - 20, r: portEndX + 20 });
      if (hasSpaceZone) poleBlocked.push({ l: spaceStartX - 20, r: spaceEndX + 20 });
      const poleClear = (x) => !poleBlocked.some(z => x > z.l && x < z.r);
      const polePositions = [];
      const poleStart = hasSpaceZone ? spaceEndX + 100 : (hasPortZone ? portEndX + 100 : 200);
      const poleEnd = hasPowerZone ? powerEndX : G.cityW;
      for (let px = poleStart; px < poleEnd; px += 120) {
          if (!poleClear(px)) continue;
          polePositions.push(px);
          g.beginFill(0x5a4a3a); g.drawRect(px - 2, gy - 58, 4, 34); g.endFill();
          g.beginFill(0x6a5a4a); g.drawRect(px - 1, gy - 58, 2, 34); g.endFill();
          g.beginFill(0x5a4a3a); g.drawRect(px - 10, gy - 56, 20, 2); g.endFill();
          g.beginFill(0xd1d5db); g.drawRect(px - 9, gy - 58, 2, 3); g.drawRect(px + 7, gy - 58, 2, 3); g.endFill();
          g.beginFill(0x5a4a3a); g.drawRect(px - 7, gy - 48, 14, 2); g.endFill();
          g.beginFill(0xd1d5db); g.drawRect(px - 6, gy - 50, 2, 3); g.drawRect(px + 4, gy - 50, 2, 3); g.endFill();
      }
      for (let i = 0; i < polePositions.length - 1; i++) {
          const x1 = polePositions[i], x2 = polePositions[i + 1];
          if (x2 - x1 > 400) continue;
          g.lineStyle(1, 0x4b5563, 0.35);
          const sagT = Math.min(6, (x2 - x1) * 0.02);
          g.moveTo(x1 + 8, gy - 55); g.quadraticCurveTo((x1+x2)/2, gy - 55 + sagT, x2 - 8, gy - 55);
          g.moveTo(x1 - 8, gy - 55); g.quadraticCurveTo((x1+x2)/2, gy - 54 + sagT, x2 + 8, gy - 55);
          const sagB = Math.min(5, (x2 - x1) * 0.018);
          g.moveTo(x1 + 5, gy - 47); g.quadraticCurveTo((x1+x2)/2, gy - 47 + sagB, x2 - 5, gy - 47);
          g.moveTo(x1 - 5, gy - 47); g.quadraticCurveTo((x1+x2)/2, gy - 46 + sagB, x2 + 5, gy - 47);
          g.lineStyle(0);
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

    /* Compute a visual fingerprint for the current building state.
       If nothing visual changed, buildBuildings() can skip the full rebuild. */
    _buildFingerprint() {
        if (!window.BLDS) return '';
        let fp = BLDS.length + ':' + (G.models ? G.models.length : 0) + ':';
        for (let i = 0; i < BLDS.length; i++) {
            const b = BLDS[i];
            fp += (b.dynamicFl || b.fl || 0);
            if (b.isTopLab) fp += 'T';
            if (b.isCheapest) fp += 'C';
            if (b.dcData) fp += (b.dcData.status || '').charAt(0);
            fp += ',';
        }
        return fp;
    },

    buildBuildings() {
      // ─── DIRTY CHECK: skip entire rebuild if no visual state changed ───
      if (window.BLDS && this.bldLayer.children.length > 0) {
          const fp = this._buildFingerprint();
          if (fp && this._lastBuildFP === fp) return;
          this._lastBuildFP = fp;
      }

      // Clear building references before destroying PIXI objects
      if (window.BLDS) {
          BLDS.forEach(b => {
              b._container = null;
              b._beacon = null;
              b._stockTicker = null;
              b._tickerW = null;
              b._vcTicker = null;
              b._vcTickerW = null;
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
            
            const signTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 6, fill: colHex, fontWeight: 'bold', dropShadow: true, dropShadowColor: colHex, dropShadowBlur: 0, dropShadowDistance: 0 });
            signTxt.anchor.set(0.5, 0.5); signTxt.x = b.w/2; signTxt.y = h - 6;
            container.addChild(signTxt); b._stationSign = signTxt; b._stationCol = colHex;
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
            
            // Name sign — positioned well above roof vents
            var dcSignW = Math.min(b.w - 4, 150);
            var dcSign = new PIXI.Graphics();
            dcSign.beginFill(0x0a0a1a, 0.9); dcSign.lineStyle(1, opCol, 0.6);
            dcSign.drawRoundedRect(b.w/2 - dcSignW/2, -30, dcSignW, 18, 3); dcSign.endFill();
            dcSign.beginFill(0x333333); dcSign.lineStyle(0); dcSign.drawRect(b.w/2 - 10, -12, 4, 12); dcSign.drawRect(b.w/2 + 6, -12, 4, 12); dcSign.endFill();
            container.addChild(dcSign);
            var dcTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 9, fill: opCol, fontWeight: 'bold', letterSpacing: 1, dropShadow: true, dropShadowColor: opCol, dropShadowBlur: 0, dropShadowDistance: 0 });
            dcTxt.anchor.set(0.5, 0.5); dcTxt.x = b.w/2; dcTxt.y = -21;
            if (dcTxt.width > dcSignW - 8) dcTxt.scale.set((dcSignW - 8) / dcTxt.width);
            container.addChild(dcTxt);
            b._dcSign = dcTxt; b._dcCol = opCol;
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
            var fabSignW = Math.min(b.w - 4, 150);
            var fabSign = new PIXI.Graphics();
            fabSign.beginFill(0x0a0a1a, 0.9); fabSign.lineStyle(1, opCol, 0.6);
            fabSign.drawRoundedRect(b.w/2 - fabSignW/2, -30, fabSignW, 18, 3); fabSign.endFill();
            fabSign.beginFill(0x333333); fabSign.lineStyle(0); fabSign.drawRect(b.w/2 - 10, -12, 4, 12); fabSign.drawRect(b.w/2 + 6, -12, 4, 12); fabSign.endFill();
            container.addChild(fabSign);
            var fabTxt = new PIXI.Text(b.name.toUpperCase(), { fontFamily: 'JetBrains Mono', fontSize: 9, fill: opCol, fontWeight: 'bold', letterSpacing: 1, dropShadow: true, dropShadowColor: opCol, dropShadowBlur: 0, dropShadowDistance: 0 });
            fabTxt.anchor.set(0.5, 0.5); fabTxt.x = b.w/2; fabTxt.y = -21;
            if (fabTxt.width > fabSignW - 8) fabTxt.scale.set((fabSignW - 8) / fabTxt.width);
            container.addChild(fabTxt);
            b._dcSign = fabTxt; b._dcCol = opCol;
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
          // ── MEMORIAL PARK — Redesigned graveyard with per-model headstones ──
          // Dark earth ground
          gfx.beginFill(0x111118); gfx.drawRect(0, h - 12, b.w, 12); gfx.endFill();
          gfx.beginFill(0x1a1a28); gfx.drawRect(0, h - 14, b.w, 4); gfx.endFill();
          // Stone path
          gfx.beginFill(0x2a2a3a); gfx.drawRect(10, h - 8, b.w - 20, 4); gfx.endFill();
          for (let px = 12; px < b.w - 20; px += 8) {
              gfx.beginFill(0x333344); gfx.drawRect(px, h - 7, 6, 2); gfx.endFill();
          }
          // Wrought iron fence posts
          gfx.beginFill(0x333344);
          gfx.drawRect(0, h - 30, 3, 20); gfx.drawRect(b.w - 3, h - 30, 3, 20);
          for (let fx = 20; fx < b.w; fx += 20) { gfx.drawRect(fx, h - 28, 2, 16); }
          gfx.endFill();
          // Fence rails
          gfx.beginFill(0x2a2a3a); gfx.drawRect(0, h - 26, b.w, 1); gfx.drawRect(0, h - 18, b.w, 1); gfx.endFill();
          // Fog overlay
          gfx.beginFill(0x444466, 0.06); gfx.drawEllipse(b.w / 2, h - 10, b.w / 2, 14); gfx.endFill();
          
          // Eternal flame (center)
          const flameX = b.w / 2;
          gfx.beginFill(0x333344); gfx.drawRect(flameX - 6, h - 22, 12, 10); gfx.endFill(); // pedestal
          gfx.beginFill(0x444455); gfx.drawRect(flameX - 8, h - 24, 16, 4); gfx.endFill(); // rim
          const flame = new PIXI.Graphics();
          flame.beginFill(0xff6600, 0.7); flame.drawPolygon([flameX - 3, h - 24, flameX, h - 34, flameX + 3, h - 24]); flame.endFill();
          flame.beginFill(0xffaa00, 0.5); flame.drawPolygon([flameX - 2, h - 24, flameX, h - 30, flameX + 2, h - 24]); flame.endFill();
          container.addChild(flame); b._flame = flame;
          
          // Willow trees (left and right)
          for (const wx of [14, b.w - 14]) {
              gfx.beginFill(0x2a2218); gfx.drawRect(wx - 2, h - 55, 4, 43); gfx.endFill();
              // Drooping branches
              gfx.beginFill(0x1b4332, 0.6);
              for (let br = 0; br < 7; br++) {
                  const bx = wx + (br - 3) * 5;
                  const by = h - 55 + br * 1.5;
                  gfx.drawRect(bx - 1, by, 2, 20 + br * 3);
              }
              gfx.endFill();
              gfx.beginFill(0x166534, 0.4);
              gfx.drawEllipse(wx, h - 52, 18, 8); gfx.endFill();
          }
          
          // Per-model headstones
          const retired = G.models ? G.models.filter(m => {
              const stg = getStage(m.rel, m.ret, m.phase);
              return stg === 'retired';
          }) : [];
          const maxStones = Math.min(retired.length, Math.floor((b.w - 60) / 22));
          const stoneStartX = 30;
          b._headstones = [];
          for (let si = 0; si < maxStones; si++) {
              const rm = retired[si];
              const sx = stoneStartX + si * 22;
              const sh = 16 + (si % 3) * 6;
              const labCol = (LABS[rm.lab] && LABS[rm.lab].color) ? parseInt(LABS[rm.lab].color.replace('#',''), 16) : 0x666688;
              // Stone
              gfx.beginFill(0x3a3a4a); gfx.drawRoundedRect(sx, h - 14 - sh, 16, sh, 3); gfx.endFill();
              gfx.beginFill(0x4a4a5a); gfx.drawRoundedRect(sx + 1, h - 13 - sh, 14, sh - 2, 2); gfx.endFill();
              // Cross or lab accent
              gfx.beginFill(labCol, 0.5); gfx.drawRect(sx + 6, h - 12 - sh, 4, 2); gfx.endFill();
              gfx.beginFill(labCol, 0.3); gfx.drawRect(sx + 7, h - 14 - sh + 3, 2, 6); gfx.endFill();
              // Name lines (tiny)
              gfx.beginFill(0x8888aa, 0.3);
              gfx.drawRect(sx + 3, h - 6 - sh + 10, 10, 1);
              gfx.drawRect(sx + 4, h - 6 - sh + 13, 8, 1);
              gfx.endFill();
              b._headstones.push({ x: sx, y: h - 14 - sh, w: 16, h: sh, model: rm });
          }
          
          // Headstone click zones
          const hsHit = new PIXI.Graphics(); hsHit.eventMode = 'static'; hsHit.cursor = 'pointer';
          hsHit.beginFill(0xffffff, 0.001); hsHit.drawRect(stoneStartX, h - 40, maxStones * 22, 30); hsHit.endFill();
          hsHit.on('pointertap', (e) => {
              const lx = e.data.getLocalPosition(container).x;
              const idx = Math.floor((lx - stoneStartX) / 22);
              if (idx >= 0 && idx < maxStones && b._headstones[idx]) {
                  const rm = b._headstones[idx].model;
                  if (typeof UI !== 'undefined') UI.selectModel(rm);
              }
          });
          hsHit.on('pointerover', (e) => {
              const lx = e.data.getLocalPosition(container).x;
              const idx = Math.floor((lx - stoneStartX) / 22);
              if (idx >= 0 && idx < maxStones && b._headstones[idx]) {
                  const rm = b._headstones[idx].model;
                  const elo = BM[rm.id] && BM[rm.id].ELO ? BM[rm.id].ELO : null;
                  const retDate = rm.ret ? new Date(rm.ret).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : '?';
                  if (typeof UI !== 'undefined') UI.showTooltip(e, `👻 ${rm.name}`, `Retired ${retDate}${elo ? ' · ELO ' + elo : ''}`);
              }
          });
          hsHit.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
          container.addChild(hsHit);
          
          // Count label
          const countTxt = new PIXI.Text(`${retired.length} retired`, { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x6666aa });
          countTxt.anchor.set(0.5, 0); countTxt.x = b.w / 2; countTxt.y = h - 60;
          container.addChild(countTxt); b._graveTxt = countTxt;
          
        } else if (b.id.startsWith('power_')) {
          // ── POWER GRID ZONE BUILDINGS ──          
          if (b.id === 'power_solar') {
            // Ground pad
            gfx.beginFill(0x2a2a20); gfx.drawRect(0, h-10, b.w, 10); gfx.endFill();
            gfx.beginFill(0x333328); gfx.drawRect(0, h-10, b.w, 3); gfx.endFill();
            // Control shed
            gfx.beginFill(0x475569); gfx.drawRect(b.w-40, h-28, 35, 18); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(b.w-40, h-30, 35, 3); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.4); gfx.drawRect(b.w-32, h-24, 10, 8); gfx.endFill();
            // Solar panel rows on frames
            const dp = G.getDayPhase();
            const tilt = dp < 0.25 || dp > 0.83 ? 0 : Math.sin(((dp - 0.25) / 0.58) * Math.PI) * 0.4;
            for (let px = 8; px < b.w - 50; px += 32) {
                gfx.beginFill(0x64748b); gfx.drawRect(px + 13, h - 38, 3, 28); gfx.endFill();
                gfx.beginFill(0x64748b); gfx.drawRect(px + 4, h - 38, 22, 2); gfx.endFill();
                const py = h - 44 - tilt * 8;
                gfx.beginFill(0x1e3a8a); gfx.drawRect(px, py, 28, 10); gfx.endFill();
                gfx.beginFill(0x2563eb, 0.5); gfx.drawRect(px + 1, py + 1, 12, 8); gfx.drawRect(px + 15, py + 1, 12, 8); gfx.endFill();
                gfx.beginFill(0x3b82f6, 0.3); gfx.drawRect(px, py, 28, 2); gfx.endFill();
            }
          } else if (b.id === 'power_wind') {
            gfx.beginFill(0x2a2a20); gfx.drawRect(0, h-10, b.w, 10); gfx.endFill();
            gfx.beginFill(0x333328); gfx.drawRect(0, h-10, b.w, 3); gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(5, h-26, 25, 16); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(5, h-28, 25, 3); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(10, h-22, 8, 6); gfx.endFill();
            for (let ti = 0; ti < 3; ti++) {
                const tx = 40 + ti * 45;
                gfx.beginFill(0x94a3b8); gfx.drawRect(tx - 6, h - 12, 12, 4); gfx.endFill();
                gfx.beginFill(0xf1f5f9, 0.85);
                gfx.moveTo(tx - 4, h - 10); gfx.lineTo(tx - 2, h - 72); gfx.lineTo(tx + 2, h - 72); gfx.lineTo(tx + 4, h - 10);
                gfx.closePath(); gfx.endFill();
                gfx.beginFill(0xe2e8f0); gfx.drawRect(tx - 5, h - 74, 10, 5); gfx.endFill();
                gfx.beginFill(0x94a3b8); gfx.drawCircle(tx, h - 72, 4); gfx.endFill();
            }
          } else if (b.id === 'power_nuclear') {
            // Concrete pad fills entire base
            gfx.beginFill(0x6b7280); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            // Solid reactor building fills the base
            gfx.beginFill(0x334155); gfx.drawRect(0, h-50, b.w, 42); gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(0, h-52, b.w, 4); gfx.endFill();
            for (let wx = 8; wx < b.w-8; wx += 22) { gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(wx, h-44, 14, 10); gfx.endFill(); }
            // Cooling tower on top
            gfx.beginFill(0xd1d5db);
            gfx.moveTo(b.w/2 - 35, h - 50); gfx.lineTo(b.w/2 - 22, h - 75); gfx.lineTo(b.w/2 - 28, h - 100);
            gfx.lineTo(b.w/2 + 28, h - 100); gfx.lineTo(b.w/2 + 22, h - 75); gfx.lineTo(b.w/2 + 35, h - 50);
            gfx.closePath(); gfx.endFill();
            gfx.beginFill(0x9ca3af); gfx.drawRect(b.w/2 - 26, h - 100, 52, 4); gfx.endFill();
            gfx.beginFill(0xfbbf24, 0.5); gfx.drawRect(b.w - 30, h - 44, 10, 10); gfx.endFill();
            for (let sx2 = 0; sx2 < b.w; sx2 += 14) { gfx.beginFill(0xfbbf24, 0.15); gfx.drawRect(sx2, h - 10, 7, 3); gfx.endFill(); }
          } else if (b.id === 'power_coal') {
            // Concrete pad fills entire base
            gfx.beginFill(0x4b5563); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            gfx.beginFill(0x334155); gfx.drawRect(0, h - 55, 100, 47); gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(0, h - 57, 100, 4); gfx.endFill();
            for (let wy = h-50; wy < h-12; wy += 16) { for (let wx = 6; wx < 94; wx += 20) { gfx.beginFill(0xfbbf24, 0.35); gfx.drawRect(wx, wy, 12, 10); gfx.endFill(); } }
            gfx.beginFill(0x6b7280); gfx.drawRect(105, h - 80, 16, 72); gfx.endFill();
            gfx.beginFill(0xef4444, 0.5); gfx.drawRect(105, h - 80, 16, 4); gfx.endFill();
            gfx.beginFill(0x1f2937); gfx.moveTo(125, h-8); gfx.lineTo(135, h-22); gfx.lineTo(155, h-8); gfx.closePath(); gfx.endFill();
          } else if (b.id === 'power_hydro') {
            // Dam wall (solid, no gaps)
            gfx.beginFill(0x94a3b8);
            gfx.moveTo(5, h - 75); gfx.lineTo(25, h - 8); gfx.lineTo(b.w - 25, h - 8); gfx.lineTo(b.w - 5, h - 75);
            gfx.closePath(); gfx.endFill();
            gfx.beginFill(0x7a8494, 0.4); for (let dy = h-70; dy < h-12; dy += 10) { gfx.drawRect(28, dy, b.w - 56, 2); } gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(b.w/2 - 15, h - 30, 30, 22); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.4); gfx.drawRect(b.w/2 - 25, h - 14, 20, 8); gfx.drawRect(b.w/2 + 5, h - 14, 20, 8); gfx.endFill();
          }
          gfx.beginFill(0x000000, 0.1); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          
        } else if (b.id.startsWith('port_')) {
          // ── PORT / TRADE ZONE BUILDINGS ──
          // ── PORT / TRADE ZONE BUILDINGS ──
          if (b.id === 'port_authority') {
            // Port Authority — official building with maritime colors
            gfx.beginFill(0x1a2838); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
            gfx.beginFill(0x223848); gfx.drawRect(0, 0, 8, h); gfx.drawRect(b.w-8, 0, 8, h); gfx.endFill();
            gfx.beginFill(0x2a4858); gfx.drawRect(-2, -4, b.w+4, 8); gfx.endFill();
            for (let fy = 14; fy < h-10; fy += 18) for (let fx = 16; fx < b.w-16; fx += 20) { gfx.beginFill(0xfbbf24, 0.5); gfx.drawRect(fx, fy, 12, 10); gfx.endFill(); }
            gfx.beginFill(0x0a1628); gfx.drawRect(b.w/2-10, h-16, 20, 16); gfx.endFill();
            gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(b.w/2-8, h-14, 16, 2); gfx.endFill();
            const anch = new PIXI.Text('⚓', { fontFamily: emojiFontStack, fontSize: 14 }); anch.anchor.set(0.5,0.5); anch.x=b.w/2; anch.y=-14; container.addChild(anch);
          } else if (b.id === 'port_warehouse') {
            // GPU Warehouse — large corrugated steel warehouse
            gfx.beginFill(0x1e293b); gfx.drawRect(0, 6, b.w, h-6); gfx.endFill();
            // Corrugated roof
            gfx.beginFill(0x334155); for (let rx = 0; rx < b.w; rx += 8) { gfx.drawRect(rx, 0, 4, 8); } gfx.endFill();
            gfx.beginFill(0x475569); gfx.drawRect(0, 0, b.w, 4); gfx.endFill();
            // Loading bay doors
            for (let dx = 15; dx < b.w-30; dx += 50) { gfx.beginFill(0x0a1628); gfx.drawRect(dx, h-30, 35, 30); gfx.endFill(); gfx.beginFill(0xf59e0b, 0.2); gfx.drawRect(dx+2, h-28, 31, 2); gfx.drawRect(dx+2, h-20, 31, 2); gfx.drawRect(dx+2, h-12, 31, 2); gfx.endFill(); }
            // NVIDIA green accent
            gfx.beginFill(0x76b900, 0.3); gfx.drawRect(0, h-2, b.w, 4); gfx.endFill();
          } else if (b.id === 'port_fuel') {
            // Fuel Depot — cylindrical tanks
            gfx.beginFill(0x1e293b); gfx.drawRect(0, h-8, b.w, 8); gfx.endFill();
            // Two tanks
            for (let tx = 15; tx < b.w-20; tx += 50) {
              gfx.beginFill(0xf1f5f9); gfx.drawEllipse(tx+20, h-35, 20, 30); gfx.endFill();
              gfx.beginFill(0x94a3b8); gfx.drawEllipse(tx+20, h-60, 18, 6); gfx.endFill();
              gfx.beginFill(0x22d3ee, 0.3); gfx.drawRect(tx+8, h-45, 24, 3); gfx.endFill();
            }
            // Hazard stripes
            gfx.beginFill(0xfbbf24); for (let sx = 0; sx < b.w; sx += 12) { gfx.drawRect(sx, h-10, 6, 3); } gfx.endFill();
          } else if (b.id === 'port_crane') {
            // Cargo Crane — tall gantry structure
            gfx.beginFill(0xf59e0b); gfx.drawRect(10, h-8, 8, -70); gfx.drawRect(b.w-18, h-8, 8, -70); gfx.endFill();
            gfx.beginFill(0xfbbf24); gfx.drawRect(0, h-78, b.w, 8); gfx.endFill();
            // Trolley
            gfx.beginFill(0xef4444); gfx.drawRect(b.w/2-8, h-76, 16, 6); gfx.endFill();
            // Cable + hook
            gfx.beginFill(0x666666); gfx.drawRect(b.w/2-1, h-70, 2, 40); gfx.endFill();
            gfx.beginFill(0x888888); gfx.drawRect(b.w/2-4, h-32, 8, 4); gfx.endFill();
            // Container being lifted
            gfx.beginFill(0x3b82f6); gfx.drawRect(b.w/2-10, h-28, 20, 14); gfx.endFill();
            gfx.beginFill(0x2563eb); gfx.drawRect(b.w/2-8, h-26, 16, 2); gfx.endFill();
          }
          gfx.beginFill(0x000000, 0.15); gfx.drawRect(0, h-2, b.w, 4); gfx.endFill();
          
        } else if (b.id.startsWith('npc_apt_')) {
          // ── NPC WORKER APARTMENTS — Simple residential blocks ──
          // Main structure
          gfx.beginFill(0x1a2030); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          // Side walls
          gfx.beginFill(0x222a38); gfx.drawRect(0, 0, 6, h); gfx.drawRect(b.w - 6, 0, 6, h); gfx.endFill();
          // Roof parapet
          gfx.beginFill(0x334155); gfx.drawRect(-2, -4, b.w + 4, 8); gfx.endFill();
          gfx.beginFill(0x475569); gfx.drawRect(-2, -4, b.w + 4, 3); gfx.endFill();
          // Floor lines
          for (let fy = 16; fy < h; fy += 18) {
              gfx.beginFill(0x222a38); gfx.drawRect(6, fy, b.w - 12, 2); gfx.endFill();
          }
          // Windows with warm glow
          const cols = Math.floor((b.w - 20) / 20);
          b._wins = [];
          for (let f = 0; f < floors; f++) {
              for (let c2 = 0; c2 < cols; c2++) {
                  const wx = 12 + c2 * 20, wy = 6 + f * 18;
                  const lit = Math.random() > 0.4;
                  gfx.beginFill(0x000000, 0.15); gfx.drawRect(wx - 1, wy - 1, 14, 12); gfx.endFill();
                  if (lit) { gfx.beginFill(0xfbbf24, 0.5); } else { gfx.beginFill(0x0a0a18); }
                  gfx.drawRect(wx, wy, 12, 10); gfx.endFill();
                  gfx.lineStyle(1, 0x334155, 0.3); gfx.drawRect(wx, wy, 12, 10); gfx.lineStyle(0);
                  b._wins.push({ wx, wy, lit });
              }
          }
          // Door
          gfx.beginFill(0x0a0a18); gfx.drawRect(b.w / 2 - 8, h - 16, 16, 16); gfx.endFill();
          gfx.beginFill(0x334155); gfx.drawRect(b.w / 2 - 8, h - 16, 16, 2); gfx.endFill();
          gfx.beginFill(0xfbbf24, 0.4); gfx.drawCircle(b.w / 2 + 4, h - 8, 1); gfx.endFill();
          // Awning over door
          gfx.beginFill(0x475569); gfx.drawRect(b.w / 2 - 14, h - 20, 28, 3); gfx.endFill();
          // Worker icon badge
          const badge = new PIXI.Text('🏬', { fontFamily: emojiFontStack, fontSize: 14, fill: 0xffffff });
          badge.anchor.set(0.5, 0.5); badge.x = b.w / 2; badge.y = -14;
          container.addChild(badge);
          // Shadow
          gfx.beginFill(0x000000, 0.12); gfx.drawRect(b.w, 4, 5, h - 4); gfx.endFill();
          gfx.beginFill(0x000000, 0.15); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          
        } else if (b.type === 'university' && typeof UniversityEnv !== 'undefined') {
          // University buildings rendered by dedicated module (uses local coords: 0=top, h=ground)
          UniversityEnv.buildBuilding(gfx, b, h);

        } else if (b.type === 'court' && typeof CourtEnv !== 'undefined') {
          // Court buildings rendered by dedicated module
          CourtEnv.buildBuilding(gfx, b, h);

        } else if (b.id === 'convention_center' && typeof ConferenceEnv !== 'undefined') {
          // Conference center rendered by dedicated module
          ConferenceEnv.buildBuilding(gfx, b, h);

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
          container.addChild(mSign); b._metroSign = mSign;
          b.tip = b.desc;

        } else if (b.id === 'visitor_monument') {
          // ── VISITOR MONUMENT — Digital obelisk with live counter ──
          const monH = h + 30;
          // Base platform
          gfx.beginFill(0x1a1a2e); gfx.drawRect(5, h - 8, b.w - 10, 8); gfx.endFill();
          gfx.beginFill(0x222240); gfx.drawRect(8, h - 10, b.w - 16, 4); gfx.endFill();
          // Obelisk body (dark stone, tapers slightly)
          gfx.beginFill(0x111128);
          gfx.drawPolygon([15, h - 10, 20, -30, b.w - 20, -30, b.w - 15, h - 10]);
          gfx.endFill();
          // Inner face (slightly lighter)
          gfx.beginFill(0x1a1a38);
          gfx.drawPolygon([18, h - 12, 22, -26, b.w - 22, -26, b.w - 18, h - 12]);
          gfx.endFill();
          // Capstone (glowing pyramid tip)
          gfx.beginFill(0x22d3ee);
          gfx.drawPolygon([22, -26, b.w / 2, -45, b.w - 22, -26]);
          gfx.endFill();
          gfx.beginFill(0x06b6d4, 0.5);
          gfx.drawPolygon([24, -24, b.w / 2, -40, b.w - 24, -24]);
          gfx.endFill();
          // Digital screen area (where counter shows)
          gfx.beginFill(0x050510); gfx.drawRect(20, -10, b.w - 40, 40); gfx.endFill();
          gfx.beginFill(0x0a0a20); gfx.drawRect(22, -8, b.w - 44, 36); gfx.endFill();
          // Screen border glow
          gfx.lineStyle(1, 0x22d3ee, 0.4); gfx.drawRect(20, -10, b.w - 40, 40); gfx.lineStyle(0);
          // Globe icon at top
          const globe = new PIXI.Text('🌐', { fontFamily: emojiFontStack, fontSize: 14, fill: 0xffffff });
          globe.anchor.set(0.5, 0.5); globe.x = b.w / 2; globe.y = -18;
          container.addChild(globe);
          // Counter text (big number)
          const counterTxt = new PIXI.Text('0', {
              fontFamily: 'JetBrains Mono', fontSize: 16, fontWeight: 'bold', fill: '#22d3ee',
              dropShadow: true, dropShadowColor: '#22d3ee', dropShadowBlur: 6, dropShadowDistance: 0
          });
          counterTxt.anchor.set(0.5, 0.5); counterTxt.x = b.w / 2; counterTxt.y = 8;
          container.addChild(counterTxt);
          b._counterTxt = counterTxt;
          // Label
          const labelTxt = new PIXI.Text('UNIQUE VISITORS', {
              fontFamily: 'JetBrains Mono', fontSize: 5, fill: '#94a3b8', letterSpacing: 1
          });
          labelTxt.anchor.set(0.5, 0.5); labelTxt.x = b.w / 2; labelTxt.y = 20;
          container.addChild(labelTxt);
          // Visits sub-counter
          const visitsTxt = new PIXI.Text('0 visits', {
              fontFamily: 'JetBrains Mono', fontSize: 5, fill: '#64748b'
          });
          visitsTxt.anchor.set(0.5, 0.5); visitsTxt.x = b.w / 2; visitsTxt.y = 28;
          container.addChild(visitsTxt);
          b._visitsTxt = visitsTxt;
          // Decorative light rings on obelisk
          gfx.beginFill(0x22d3ee, 0.15); gfx.drawRect(22, 35, b.w - 44, 2); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.10); gfx.drawRect(20, 55, b.w - 40, 2); gfx.endFill();
          gfx.beginFill(0x22d3ee, 0.08); gfx.drawRect(18, h - 25, b.w - 36, 2); gfx.endFill();
          // Shadow
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();
          // Capstone glow (additive)
          const capGlow = new PIXI.Graphics();
          capGlow.beginFill(0x22d3ee, 0.08); capGlow.drawEllipse(b.w / 2, -35, 20, 12); capGlow.endFill();
          capGlow.blendMode = PIXI.BLEND_MODES.ADD;
          container.addChild(capGlow);
          b._capGlow = capGlow;
          
          // Trigger initial count display
          if (typeof VisitorTracker !== 'undefined') VisitorTracker._updateMonument();

        } else if (b.id === 'neon_bar') {
          // ── NEON BAR — Dark facade, neon strips, cocktail sign, stage ──
          // Dark brick facade
          gfx.beginFill(0x0f0a18); gfx.drawRect(0, 0, b.w, h); gfx.endFill();
          gfx.beginFill(0x1a1028); gfx.drawRect(4, 4, b.w - 8, h - 4); gfx.endFill();
          // Brick texture
          for (let by = 8; by < h - 4; by += 6) {
              const off = (by % 12 === 0) ? 0 : 8;
              for (let bx = off + 4; bx < b.w - 8; bx += 16) {
                  gfx.beginFill(0x1e1430, 0.5); gfx.drawRect(bx, by, 14, 5); gfx.endFill();
              }
          }
          // Neon accent strips on facade
          gfx.beginFill(0xff00ff, 0.15); gfx.drawRect(0, 0, b.w, 3); gfx.endFill();
          gfx.beginFill(0x00ffff, 0.12); gfx.drawRect(0, h * 0.4, b.w, 2); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.10); gfx.drawRect(0, h * 0.7, b.w, 2); gfx.endFill();
          // Side neon tubes (vertical)
          gfx.beginFill(0xff69b4, 0.3); gfx.drawRect(2, 10, 2, h - 20); gfx.endFill();
          gfx.beginFill(0x00ffff, 0.3); gfx.drawRect(b.w - 4, 10, 2, h - 20); gfx.endFill();
          // Windows with colored glow (bar interior visible)
          for (let wx = 15; wx < b.w - 20; wx += 28) {
              gfx.beginFill(0x000000); gfx.drawRect(wx, h * 0.3, 20, 22); gfx.endFill();
              const wCol = [0xff00ff, 0x00ffff, 0xff6b9d, 0xa855f7][Math.floor(wx / 28) % 4];
              gfx.beginFill(wCol, 0.25); gfx.drawRect(wx + 1, h * 0.3 + 1, 18, 20); gfx.endFill();
          }
          // Stage area (ground floor)
          gfx.beginFill(0x2a1040); gfx.drawRect(b.w / 2 - 25, h - 28, 50, 28); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.2); gfx.drawRect(b.w / 2 - 22, h - 25, 44, 22); gfx.endFill();
          // Microphone stand
          gfx.beginFill(0x888888); gfx.drawRect(b.w / 2 - 1, h - 22, 2, 14); gfx.endFill();
          gfx.beginFill(0xcccccc); gfx.drawCircle(b.w / 2, h - 23, 3); gfx.endFill();
          // Door
          gfx.beginFill(0x1a0a28); gfx.drawRect(10, h - 18, 16, 18); gfx.endFill();
          gfx.beginFill(0xff00ff, 0.4); gfx.drawRect(10, h - 18, 16, 2); gfx.endFill();
          gfx.beginFill(0xfbbf24); gfx.drawCircle(22, h - 9, 1.5); gfx.endFill();
          // Cocktail emoji sign
          const cSign = new PIXI.Text('🍸', { fontFamily: emojiFontStack, fontSize: 20, fill: 0xffffff });
          cSign.anchor.set(0.5, 0.5); cSign.x = b.w - 20; cSign.y = h * 0.15;
          container.addChild(cSign);
          // Shadow
          gfx.beginFill(0x000000, 0.18); gfx.drawRect(0, h - 2, b.w, 4); gfx.endFill();

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
        // Cache building body as bitmap — converts all Graphics draw calls into a single batched sprite
        gfx.cacheAsBitmap = true;

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

        // ─── VC ROW: Deal ticker on rooftop (same pattern as HQ stock tickers above) ───
        if (b.type === 'vcrow' && typeof VCRow !== 'undefined') {
            const vTickCont = new PIXI.Container();
            vTickCont.y = 0;
            const vTickBg = new PIXI.Graphics();
            vTickBg.beginFill(0x000000, 0.9); vTickBg.drawRect(0, 0, b.w, 14); vTickBg.endFill();
            vTickCont.addChild(vTickBg);
            const vMask = new PIXI.Graphics();
            vMask.beginFill(0xffffff); vMask.drawRect(0, -5, b.w, 24); vMask.endFill();
            vTickCont.addChild(vMask); vTickCont.mask = vMask;
            const vTickTxt = new PIXI.Text(VCRow.getNextTickerItem(), {
                fontFamily: 'monospace', fontSize: 10, fontWeight: '900', strokeThickness: 1,
                fill: 0x4ade80, stroke: 0x4ade80, dropShadow: true, dropShadowColor: 0x4ade80, dropShadowBlur: 10, dropShadowDistance: 0, padding: 10
            });
            vTickTxt.y = 1; vTickTxt.x = b.w; vTickTxt.blendMode = PIXI.BLEND_MODES.ADD;
            vTickCont.addChild(vTickTxt); b._vcTicker = vTickTxt; b._vcTickerW = b.w;
            container.addChild(vTickCont);
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
                b._boardTxt = logoTxt; b._boardCol = colHex;
            } else {
                // All non-lab buildings get neon signs (no more old emoji badges)
            }
        }
        
        // ─── NEON SIGNS for social buildings (visible at night only) ───
        const neonConfig = {
            'cafe': { text: '☕ CAFÉ', col: 0xf59e0b, speed: 0.08, flicker: 0.3 },
            'gym': { text: '🏋️ GYM', col: 0x22d3ee, speed: 0.12, flicker: 0.4 },
            'arena': { text: '⚔️ ARENA', col: 0xef4444, speed: 0.06, flicker: 0.25 },
            'open_square': { text: '🏛 SQUARE', col: 0xa855f7, speed: 0.10, flicker: 0.35 },
            'neon_bar': { text: '🍸 NEON BAR', col: 0xff00ff, speed: 0.15, flicker: 0.45 },
            'uni_dorm': { text: '🎓 DORMITORY', col: 0x60a5fa, speed: 0.07, flicker: 0.2 }
        };
        // Auto-generate neon sign for any non-lab, non-special building
        let nc = neonConfig[b.id];
        if (!nc && !lab && !b.id.startsWith('metro_') && !b.id.startsWith('forest_') && !b.id.startsWith('house_') && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && !b.id.startsWith('npc_apt_') && !b.id.startsWith('res_') && b.id !== 'graveyard' && b.id !== 'visitor_monument' && b.id !== 'park') {
            nc = { text: (b.emoji || '🏢') + ' ' + (b.name || '').toUpperCase(), col: 0x6688aa, speed: 0.06, flicker: 0.2 };
        }
        if (nc) {
            const neonCont = new PIXI.Container();
            // Neon text (create first to measure width)
            const colHexStr = '#' + nc.col.toString(16).padStart(6, '0');
            const neonTxt = new PIXI.Text(nc.text, {
                fontFamily: 'JetBrains Mono', fontSize: 9, fontWeight: 'bold',
                fill: colHexStr, letterSpacing: 1,
                dropShadow: true, dropShadowColor: colHexStr, dropShadowBlur: 10, dropShadowDistance: 0, padding: 4
            });
            neonTxt.anchor.set(0.5, 0.5);
            // Scale down if text is wider than building
            const maxW = b.w - 10;
            if (neonTxt.width > maxW) neonTxt.scale.set(maxW / neonTxt.width);
            // Sign backing board sized to text
            const brdW = Math.min(maxW + 8, Math.max(neonTxt.width + 16, 60));
            const board = new PIXI.Graphics();
            board.beginFill(0x0a0a14, 0.85);
            board.drawRoundedRect(-brdW/2, -10, brdW, 18, 3);
            board.endFill();
            board.lineStyle(1, nc.col, 0.4);
            board.drawRoundedRect(-brdW/2, -10, brdW, 18, 3);
            board.lineStyle(0);
            neonCont.addChild(board);
            neonCont.addChild(neonTxt);
            // Glow halo behind sign
            const glow = new PIXI.Graphics();
            glow.beginFill(nc.col, 0.06);
            glow.drawEllipse(0, 0, brdW/2 + 8, 16);
            glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            neonCont.addChildAt(glow, 0);
            // Position on building facade
            neonCont.x = b.w / 2;
            neonCont.y = -6;
            neonCont.visible = true;
            container.addChild(neonCont);
            b._neonCont = neonCont;
            b._neonGlow = glow;
            b._neonTxt = neonTxt;
            b._neonSpeed = nc.speed;
            b._neonFlicker = nc.flicker;
            b._neonCol = nc.col;
        }
        container.eventMode = 'static';
        container.cursor = 'pointer';
        container.hitArea = new PIXI.Rectangle(0, 0, b.w, h + 10);
        container.on('pointertap', () => {
            if (b.id.startsWith('port_') && typeof PortEnv !== 'undefined') {
                PortEnv.showManifest();
            } else if (typeof UI !== 'undefined') {
                UI.selectBld(b);
            }
        });
        container.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, b.name, b.tip || b.desc); });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
  
        this.bldLayer.addChild(container); b._container = container;
      });

      // Store fingerprint after build so subsequent calls can compare
      this._lastBuildFP = this._buildFingerprint();
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
      // Throttle weather particle drawing to every other frame
      if (G.tick % 2 !== 0) return;
      const g = this.fxGfx; g.clear(); const vw = G.vpW, vh = G.vpH, wx = -G.world.x;
      const wy = -(G.world.y || 0); // vertical camera offset in world coords
      const desert = this._getDesertRange();
      
      // ─── CITY WEATHER (skip desert zone) ───
      if (this.weather === 'rain') {
        while (this.rainDrops.length < 150) this.rainDrops.push({ x: wx + Math.random() * vw, y: Math.random() * vh, s: 4 + Math.random() * 4 });
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
        while (this.sandParticles.length < 100) {
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
        if (!this._vpEl) this._vpEl = document.getElementById('viewport');
        const vp = this._vpEl;
        let sky;
        if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        else if (dp < .30) { const t = (dp - .22) / .08;
        sky = `linear-gradient(180deg,rgb(${8 + t * 50 | 0},${10 + t * 20 | 0},${30 + t * 50 | 0}),rgb(${15 + t * 130 | 0},${15 + t * 50 | 0},${40 + t * 30 | 0}) 50%,rgb(${30 + t * 160 | 0},${25 + t * 80 | 0},${35 - t * 10 | 0}))`;
        }
        else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        else if (dp < .84) { const t = (dp - .72) / .12;
        sky = `linear-gradient(180deg,rgb(${35 + t * 45 | 0},${25 + t * 10 | 0},${90 - t * 50 | 0}),rgb(${120 + t * 110 | 0},${80 - t * 30 | 0},${60 - t * 30 | 0}) 50%,rgb(${180 + t * 60 | 0},${100 - t * 40 | 0},${30 | 0}))`;
        }
        else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        if (this.weather === 'rain' && !night && dp > .3 && dp < .72) sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
        if (this.weather === 'snow') sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        if (sky !== this._lastSky) { this._lastSky = sky; vp.style.background = sky; }
    
        this.starsLayer.visible = night;
        if (night && G.tick % 4 === 0) this.starsLayer.children.forEach(s => { s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; });
        const cel = this.celestialGfx;
        const isGoldenHour = (dp >= 0.72 && dp < 0.84) || (dp >= 0.22 && dp < 0.30);
        // Throttle celestial redraws to every 3rd frame (sun moves slowly)
        if (G.tick % 3 !== 0 && !this._celDirty) { /* skip redraw */ }
        else {
        this._celDirty = false;
        cel.clear();
        if (night) {
          let np = dp > 0.83 ?
          (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42;
          cel.beginFill(0xe8e8d0);
          cel.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); cel.endFill();
        } else {
          let dayP = (dp - 0.25) / (0.83 - 0.25);
          const sunX = G.vpW * dayP;
          const sunY = 40 + Math.sin(dayP * Math.PI) * 120;

          // Golden hour glow + god rays
          if (isGoldenHour) {
              let ghI = dp >= 0.72 ? 1 - Math.abs((dp - 0.78) / 0.06) : 1 - Math.abs((dp - 0.26) / 0.04);
              ghI = Math.max(0, Math.min(1, ghI));

              // Layered aura
              cel.beginFill(0xff6622, 0.02 * ghI); cel.drawCircle(sunX, sunY, 140); cel.endFill();
              cel.beginFill(0xff8833, 0.04 * ghI); cel.drawCircle(sunX, sunY, 80); cel.endFill();
              cel.beginFill(0xffaa44, 0.08 * ghI); cel.drawCircle(sunX, sunY, 40); cel.endFill();

              // God rays — fan downward from sun
              for (let r = 0; r < 7; r++) {
                  const angle = Math.PI * 0.2 + (r / 6) * Math.PI * 0.6 + Math.sin(G.tick * 0.003 + r * 1.7) * 0.04;
                  const rayLen = 120 + (r % 3) * 60;
                  const rayW = 6 + (r % 4) * 3;
                  const shimmer = 0.5 + 0.5 * Math.sin(G.tick * 0.01 + r * 2.1);
                  const ex = sunX + Math.cos(angle) * rayLen;
                  const ey = sunY + Math.sin(angle) * rayLen;
                  cel.beginFill(0xffbb55, 0.012 * ghI * shimmer);
                  cel.moveTo(sunX + Math.cos(angle + 0.03) * 18, sunY + Math.sin(angle + 0.03) * 18);
                  cel.lineTo(ex + Math.cos(angle + Math.PI / 2) * rayW, ey + Math.sin(angle + Math.PI / 2) * rayW);
                  cel.lineTo(ex - Math.cos(angle + Math.PI / 2) * rayW, ey - Math.sin(angle + Math.PI / 2) * rayW);
                  cel.closePath();
                  cel.endFill();
              }
          }

          // Main sun disc
          cel.beginFill(isGoldenHour ? 0xff9944 : 0xffe066);
          cel.drawCircle(sunX, sunY, isGoldenHour ? 18 : 15); cel.endFill();
        }
        } // end celestial throttle

        if (G.tick % 2 === 0) this.cloudLayer.children.forEach(c => { c.x = c._bx + Math.sin(G.tick * (c._drift || .003) + c._i) * 40; const ca = (this.weather === 'rain' || this.weather === 'snow') ? .30 : .10 + Math.sin(G.tick * 0.001 + c._i) * 0.03; c.alpha = isGoldenHour ? ca + 0.08 : ca; c.tint = isGoldenHour ? 0xffcc88 : 0xffffff; });
        if (G.viewMode === 'micro') { this.updateWeather(); this.updateDesertWeather(); } this.drawWeather(); let targetRefAlpha = 0;
        if (night) { if (this.weather === 'rain') targetRefAlpha = 0.95; else if (this.weather === 'snow') targetRefAlpha = 0.5;
        else targetRefAlpha = 0.35; } else { if (this.weather === 'rain') targetRefAlpha = 0.4;
        else if (this.weather === 'snow') targetRefAlpha = 0.2;
        else if (isGoldenHour) targetRefAlpha = 0.25; } this.reflectionLayer.alpha += (targetRefAlpha - this.reflectionLayer.alpha) * 0.05;
        const targetLightAlpha = night ? 1 : 0; if(this.lightLayer) { this.lightLayer.alpha += (targetLightAlpha - this.lightLayer.alpha) * 0.05;
        } 
        
        // ─── SIGN ANIMATIONS ───
        // Track day/night transition to update styles only ONCE (style changes are expensive)
        const wasNight = this._wasNight || false;
        if (night !== wasNight) {
            this._wasNight = night;
            BLDS.forEach(b => {
                // Lab HQ boards — set glow once on transition
                if (b._boardTxt) {
                    b._boardTxt.style.dropShadowBlur = night ? 18 : 8;
                }
                // Metro above-ground signs
                if (b._metroSign) {
                    b._metroSign.style.dropShadowBlur = night ? 16 : 8;
                }
                // Underground station signs
                if (b._stationSign) {
                    b._stationSign.style.dropShadowBlur = night ? 10 : 0;
                }
                // Building name signs
                if (b._sign) {
                    if (night) {
                        const sc = b._boardCol || 0x6688ff;
                        b._sign.style.fill = sc;
                        b._sign.style.dropShadow = true;
                        b._sign.style.dropShadowColor = sc;
                        b._sign.style.dropShadowBlur = 8;
                        b._sign.style.dropShadowDistance = 0;
                    } else {
                        b._sign.style.fill = 0x9898c0;
                        b._sign.style.dropShadow = false;
                    }
                }
                // DC/Fab signs
                if (b._dcSign) {
                    b._dcSign.style.dropShadowBlur = night ? 10 : 0;
                }
            });
        }
        // Per-frame: only cheap alpha animations (visibility-culled)
        const camL = typeof Camera !== 'undefined' ? (-Camera.x / (Camera.zoom || 1)) - 200 : 0;
        const camR = camL + G.vpW / (Camera.zoom || 1) + 400;

        // ─── CONTAINER VISIBILITY CULLING — tell PixiJS to skip rendering off-screen buildings ───
        BLDS.forEach(b => {
            if (!b._container) return;
            const vis = !(b.x + b.w < camL || b.x > camR);
            if (b._container.visible !== vis) b._container.visible = vis;
        });

        BLDS.forEach(b => {
            // Skip buildings that are off-screen
            if (b.x + b.w < camL || b.x > camR) return;
            // Neon signs: always visible, flicker at night only
            if (b._neonCont) {
                b._neonCont.visible = true;
                if (night) {
                    const t = G.tick * b._neonSpeed;
                    const base = 0.7 + Math.sin(t) * 0.2;
                    const buzz = Math.random() < b._neonFlicker ? (Math.random() * 0.4 - 0.2) : 0;
                    const flick = Math.max(0.3, Math.min(1.0, base + buzz));
                    const blink = (Math.random() < 0.003) ? 0.1 : 1.0;
                    b._neonTxt.alpha = flick * blink;
                    b._neonGlow.alpha = flick * blink * 0.15;
                } else {
                    b._neonTxt.alpha = 0.8;
                    b._neonGlow.alpha = 0;
                }
            }
            // Lab board alpha pulse (cheap)
            if (b._boardTxt && night) {
                b._boardTxt.alpha = 0.85 + Math.sin(G.tick * 0.04) * 0.15;
            }
            // Metro sign alpha pulse
            if (b._metroSign && night) {
                b._metroSign.alpha = 0.85 + Math.sin(G.tick * 0.05) * 0.15;
            }
            // Station sign alpha pulse
            if (b._stationSign && night) {
                b._stationSign.alpha = 0.8 + Math.sin(G.tick * 0.05) * 0.2;
            }
            // DC/Fab sign alpha pulse
            if (b._dcSign && night) {
                b._dcSign.alpha = 0.85 + Math.sin(G.tick * 0.04) * 0.15;
            }
            // Visitor monument capstone pulse
            if (b._capGlow) {
                b._capGlow.alpha = 0.06 + Math.sin(G.tick * 0.03) * 0.04;
            }
            // Graveyard eternal flame flicker
            if (b._flame) {
                b._flame.alpha = 0.6 + Math.sin(G.tick * 0.1) * 0.2 + Math.random() * 0.15;
                b._flame.scale.set(0.9 + Math.sin(G.tick * 0.15) * 0.15, 0.85 + Math.sin(G.tick * 0.12) * 0.2);
            }
        });
        
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
            if (b.x + b.w < camL || b.x > camR) return;
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
            if (b._vcTicker && b._vcTickerW) {
                b._vcTicker.x -= 0.6;
                if (b._vcTicker.x + b._vcTicker.width < 0) {
                    b._vcTicker.text = (typeof VCRow !== 'undefined') ? VCRow.getNextTickerItem() : '';
                    b._vcTicker.x = b._vcTickerW;
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
