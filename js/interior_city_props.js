/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY PROPS (v16.4.4 - Avatar Signature Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCityProps = {
    lifts: {},

    _parseCol(col) {
        if (typeof col === 'number') return col;
        if (typeof col === 'string') return parseInt(col.replace('#', ''), 16);
        if (col && typeof col === 'object' && col.color) return parseInt(col.color.replace('#', ''), 16);
        return 0x64748b; 
    },

    initLift(layer, bldId, numFloors, floorHeight, shaftX) {
        if (this.lifts[bldId]) {
            this.lifts[bldId].destroy();
        }
        const lift = new CityElevator(layer, numFloors, floorHeight, shaftX);
        this.lifts[bldId] = lift;
        return lift;
    },

    updateLifts() {
        Object.values(this.lifts).forEach(lift => lift.update());
    },
    
    getLift(bldId) {
        return this.lifts[bldId];
    },

    drawRoof(roofH, startX, usableW, colHex, lab, bld) {
        const cHex = this._parseCol(colHex);
        const roofCont = new PIXI.Container();
        const boardW = 220; 
        const boardH = 34; 
        const boardX = startX + usableW / 2 - boardW / 2; 
        const boardY = roofH - boardH - 10;
        
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0x111111); 
        gfx.lineStyle(2, cHex, 0.8); 
        gfx.drawRect(boardX, boardY, boardW, boardH); 
        gfx.endFill(); 
        gfx.lineStyle(0);
        
        gfx.beginFill(0x333333); 
        gfx.drawRect(boardX + 15, boardY + boardH, 6, 10); 
        gfx.drawRect(boardX + boardW - 21, boardY + boardH, 6, 10); 
        gfx.endFill();
        roofCont.addChild(gfx);
        
        const safeLabName = lab ? (lab.name || bld.name) : (bld.name || 'HQ');
        const textToDisplay = bld.lab ? safeLabName.toUpperCase() : `${bld.emoji || ''} ${(bld.name || 'HQ').toUpperCase()}`.trim();
        
        const logoTxt = new PIXI.Text(textToDisplay, { 
            fontFamily: 'JetBrains Mono', 
            fontSize: 14, 
            fontWeight: 'bold', 
            fill: 0xffffff, 
            letterSpacing: 2, 
            dropShadow: true, 
            dropShadowColor: cHex, 
            dropShadowBlur: 8, 
            dropShadowDistance: 0 
        });
        logoTxt.anchor.set(0.5, 0.5); 
        logoTxt.x = startX + usableW / 2; 
        logoTxt.y = boardY + boardH / 2; 
        roofCont.addChild(logoTxt);
        
        if (bld.lab && lab.ticker) {
            this.bldTickerSym = lab.ticker;
            
            const tickBg = new PIXI.Graphics();
            tickBg.beginFill(0x000000, 0.9); 
            tickBg.drawRect(this.startX, roofH - 12, this.bldW, 12); 
            tickBg.endFill();
            roofCont.addChild(tickBg);

            const mask = new PIXI.Graphics();
            mask.beginFill(0xffffff); 
            mask.drawRect(this.startX, roofH - 12, this.bldW, 12); 
            mask.endFill();
            roofCont.addChild(mask); 
            
            const tickCont = new PIXI.Container();
            tickCont.mask = mask;
            
            this.tickerTxt = new PIXI.Text(`     ${lab.ticker} AWAITING DATA     `, { 
                fontFamily: 'monospace', 
                fontSize: 9, 
                fontWeight: 'bold', 
                fill: 0x888888 
            });
            this.tickerTxt.y = roofH - 11; 
            this.tickerTxt.x = this.startX + this.bldW; 
            tickCont.addChild(this.tickerTxt);
            roofCont.addChild(tickCont);
        }
        
        this.scene.addChild(roofCont);
    },

    drawNegativeSpaceWall(gfx, wallColor, x, y, w, h, isCeo, windowX, windowW) {
        gfx.beginFill(wallColor);
        if (isCeo) {
            gfx.drawRect(x, y, w, 15); 
            gfx.drawRect(x, y + 60, w, h - 60); 
            gfx.drawRect(x, y + 15, windowX - x, 45); 
            gfx.drawRect(windowX + windowW, y + 15, x + w - (windowX + windowW), 45); 
        } else {
            gfx.drawRect(x, y, w, 25); 
            gfx.drawRect(x, y + 55, w, h - 55); 
            gfx.drawRect(x, y + 25, windowX - x, 30); 
            let currX = windowX;
            while (currX + 40 <= windowX + windowW) {
                currX += 40; 
                let pillarW = Math.min(20, windowX + windowW - currX);
                if (pillarW > 0) gfx.drawRect(currX, y + 25, pillarW, 30);
                currX += 20; 
            }
            if (currX < windowX + windowW) gfx.drawRect(currX, y + 25, (windowX + windowW) - currX, 30);
            gfx.drawRect(windowX + windowW, y + 25, x + w - (windowX + windowW), 30);
        }
        gfx.endFill();
    },

    drawRoomInterior(gfx, x, y, w, h, colHex, isCeo, windowX, windowW, theme = 'general') {
        const cHex = this._parseCol(colHex);
        
        if (theme === 'campsite') {
            gfx.beginFill(0x080a1e); 
            gfx.drawRect(x, y, w, h);
            gfx.endFill();
            
            for(let s=0; s<40; s++) {
                gfx.beginFill(0xffffff, 0.2 + Math.random()*0.8);
                gfx.drawCircle(x + Math.random()*w, y + Math.random()*(h-20), Math.random()*1.5);
                gfx.endFill();
            }
            
            gfx.beginFill(0x0a1a10); 
            gfx.drawRect(x, y + h - 8, w, 8); 
            gfx.endFill(); 
            return;
        }

        let wallCol = 0x1a1a2e;
        let floorCol = 0x11111a;
        let lightCol = 0xffffff;
        let beamAlpha = 0.15;
        let ceilingLightA = 0.8;
        
        if (theme === 'server_core') { 
            wallCol = 0x050510; floorCol = 0x0a0a15; lightCol = 0x00ffff; beamAlpha = 0.05; ceilingLightA = 0.3; 
        } else if (theme === 'zen_garden') { 
            wallCol = 0x2a2a3e; floorCol = 0x1a1a2e; lightCol = 0xffeebb; beamAlpha = 0.25; 
        } else if (theme === 'gym_cardio' || theme === 'gym_weights' || theme === 'gym_combat') { 
            wallCol = 0x151b22; floorCol = 0x0f172a; 
        } else if (theme === 'arena_main' || theme === 'arena_training' || theme === 'arena_lobby') { 
            wallCol = 0x111115; floorCol = 0x0a0a0f; 
        } else if (theme === 'cafe') { 
            wallCol = 0x271e1a; floorCol = 0x17120f; 
        }
        
        this.drawNegativeSpaceWall(gfx, wallCol, x, y, w, h, isCeo, windowX, windowW);
        
        gfx.beginFill(floorCol); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill(); 
        
        gfx.lineStyle(1, 0x000000, 0.15);
        for(let i = x; i < x + w; i += 20) { 
            if (i > windowX && i < windowX + windowW) {
                if (isCeo) continue; 
                let offset = i - windowX;
                if (offset % 60 < 40) continue; 
            }
            gfx.moveTo(i, y); 
            gfx.lineTo(i, y + h - 8); 
        }
        gfx.lineStyle(0);
        
        let trimCol = theme === 'server_core' ? 0x111122 : 0x222233;
        gfx.beginFill(trimCol); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill(); 
        
        if (theme === 'server_core') { lightCol = 0x38bdf8; beamAlpha = 0.1; }
        else if (theme.startsWith('arena')) { lightCol = 0xef4444; beamAlpha = 0.25; }
        else if (theme === 'zen_garden') { lightCol = 0x86efac; beamAlpha = 0.1; }
        else if (isCeo) { lightCol = 0xfde047; beamAlpha = 0.25; }
        
        const lightZones = 3; 
        const spacing = w / (lightZones + 1);
        for(let i = 1; i <= lightZones; i++) {
            const lx = x + (i * spacing);
            gfx.beginFill(lightCol, ceilingLightA); 
            gfx.drawRect(lx - 12, y, 24, 2); 
            gfx.endFill();
            
            const beam = new PIXI.Graphics();
            beam.beginFill(lightCol, beamAlpha);
            beam.moveTo(lx - 12, y + 2); 
            beam.lineTo(lx + 12, y + 2); 
            beam.lineTo(lx + 50, y + h - 8); 
            beam.lineTo(lx - 50, y + h - 8); 
            beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD;
            gfx.addChild(beam);
            
            if (!this.indoorLights) this.indoorLights = [];
            this.indoorLights.push({ g: beam, maxA: beamAlpha, type: 'ceiling' });
        }
    },

    drawLake(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0f172a); g.drawEllipse(x, y-5, 90, 18); g.endFill();
        g.beginFill(0x0284c7, 0.6); g.drawEllipse(x, y-4, 85, 14); g.endFill();
        g.beginFill(0xffffff, 0.1); 
        g.drawRect(x-20, y-10, 40, 2); 
        g.drawRect(x-10, y-6, 20, 2); 
        g.endFill();
        c.addChild(g);
    },

    drawTent(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex); g.drawPolygon([x, y-40, x-30, y-5, x+30, y-5]); g.endFill();
        g.beginFill(0x11111a); g.drawPolygon([x, y-30, x-10, y-5, x+10, y-5]); g.endFill(); 
        g.lineStyle(2, 0xffffff, 0.5); g.moveTo(x-30, y-5); g.lineTo(x-35, y); g.moveTo(x+30, y-5); g.lineTo(x+35, y); g.lineStyle(0);
        c.addChild(g);
    },

    drawCampfire(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x4a2e1a); 
        g.drawPolygon([x-12, y-5, x+12, y-5, x+8, y-2, x-8, y-2]);
        g.drawPolygon([x-6, y-8, x+6, y-8, x+12, y-2, x-12, y-2]);
        g.endFill();
        g.beginFill(0xf97316); g.drawPolygon([x-8, y-5, x, y-18, x+8, y-5]); g.endFill(); 
        g.beginFill(0xfacc15); g.drawPolygon([x-4, y-5, x, y-12, x+4, y-5]); g.endFill(); 
        c.addChild(g);
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xf97316, 0.3); glow.drawCircle(x, y-10, 35); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'fire' });
    },

    drawPunchingBag(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-15, y-80, 30, 6); g.endFill(); 
        g.beginFill(0x888888); g.drawRect(x-1, y-74, 2, 20); g.endFill(); 
        g.beginFill(0xef4444); g.drawRoundedRect(x-12, y-54, 24, 45, 6); g.endFill(); 
        g.beginFill(0x991b1b); g.drawRect(x-12, y-40, 24, 15); g.endFill(); 
        c.addChild(g);
    },

    drawWeightBench(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); g.drawRoundedRect(x-20, y-15, 40, 6, 2); g.endFill();
        g.beginFill(0x444444); g.drawRect(x-15, y-9, 4, 9); g.drawRect(x+11, y-9, 4, 9); g.endFill();
        g.beginFill(0x555555); g.drawRect(x-25, y-30, 4, 30); g.drawRect(x+21, y-30, 4, 30); g.endFill();
        g.beginFill(0xcccccc); g.drawRect(x-30, y-30, 60, 3); g.endFill();
        g.beginFill(0x222222); g.drawRect(x-30, y-38, 6, 19); g.drawRect(x+24, y-38, 6, 19); g.endFill();
        c.addChild(g);
    },

    drawTreadmill(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawPolygon([x-25, y, x+20, y, x+25, y-8, x-20, y-8]); g.endFill();
        g.beginFill(0x111111); g.drawPolygon([x-23, y-1, x+18, y-1, x+23, y-7, x-18, y-7]); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x+15, y-35, 6, 30); g.endFill();
        g.beginFill(0x111111); g.drawRect(x+10, y-45, 12, 12); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.8); glow.drawRect(x+12, y-43, 8, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawServerWeights(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xaaaaaa); g.drawRect(x-25, y-10, 50, 2); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-20, y-20, 10, 20); g.drawRect(x+10, y-20, 10, 20); g.endFill();
        g.beginFill(0x4ade80); g.drawCircle(x-18, y-15, 1); g.drawCircle(x+12, y-15, 1); g.endFill(); 
        c.addChild(g);
    },

    drawRing(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-60, y-10, 120, 10); g.endFill(); 
        g.beginFill(0x0ea5e9, 0.4); g.drawRect(x-60, y-10, 120, 2); g.endFill(); 
        g.beginFill(0x33334a); g.drawRect(x-60, y-40, 4, 30); g.drawRect(x+56, y-40, 4, 30); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-60, y-35, 120, 2); g.endFill(); 
        g.beginFill(0xffffff); g.drawRect(x-60, y-25, 120, 2); g.endFill(); 
        g.beginFill(0x3b82f6); g.drawRect(x-60, y-15, 120, 2); g.endFill(); 
        c.addChild(g);
    },

    drawServerRack(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawRect(x-10, y-30, 20, 30); g.endFill(); 
        g.beginFill(0x222233); 
        for(let sy=y-26; sy<y-4; sy+=6) g.drawRect(x-8, sy, 16, 4); 
        g.beginFill(cHex); 
        for(let sy=y-25; sy<y-4; sy+=6) { g.drawCircle(x-5, sy+1, 1); g.drawCircle(x-1, sy+1, 1); } 
        g.endFill(); c.addChild(g); 
        const glow = new PIXI.Graphics(); glow.beginFill(cHex, 0.8);
        for(let sy=y-25; sy<y-4; sy+=6) { glow.drawCircle(x-5, sy+1, 1.5); glow.drawCircle(x-1, sy+1, 1.5); }
        glow.endFill(); glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 1.0, type: 'server' });
    },

    drawPlant(c, x, y) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0x8b5cf6); g.drawRect(x-6,y-10,12,10); g.endFill(); 
        g.beginFill(0x4ade80); g.drawCircle(x,y-16,6); g.drawCircle(x-5,y-12,5); g.drawCircle(x+5,y-12,5); g.endFill(); 
        c.addChild(g); 
    },

    // ─── FIX: Flexible Signature for drawAvatar to prevent crashes ───
    drawAvatar(arg1, arg2, arg3, arg4) {
        let container, x, y, col;
        
        if (arg1 && typeof arg1.addChild === 'function') {
            container = arg1; 
            x = arg2; 
            y = arg3; 
            col = arg4;
        } else {
            container = this.scene || (typeof InteriorCityCore !== 'undefined' ? InteriorCityCore.scene : null);
            x = arg1; 
            y = arg2; 
            col = arg3;
        }

        if (!container) return; 

        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex); g.drawRoundedRect(x - 6, y - 12, 12, 12, 2); g.endFill();
        g.beginFill(0xfdd8b5); g.drawCircle(x, y - 16, 5); g.endFill();
        container.addChild(g);
    },

    drawLiquidCooledServer(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawRect(x-15, y-40, 30, 40); g.endFill();
        g.beginFill(0x222233); g.drawRect(x-12, y-38, 24, 36); g.endFill();
        g.beginFill(0x06b6d4); g.drawRect(x-8, y-36, 4, 32); g.drawRect(x+4, y-36, 4, 32); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x06b6d4, 0.4); glow.drawRect(x-8, y-36, 4, 32); glow.drawRect(x+4, y-36, 4, 32); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'server' });
    },

    drawReceptionDesk(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x2a2a3e); g.drawRect(x-15, y-22, 50, 22); g.endFill(); 
        g.beginFill(cHex, 0.8); g.drawRect(x-17, y-22, 54, 4); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x+5, y-32, 6, 10); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x+4, y-31, 2, 8); g.endFill(); 
        c.addChild(g); 
    },
    
    drawCouches(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.5); g.drawRect(x-20, y-10, 40, 10); 
        g.beginFill(cHex, 0.3); g.drawRect(x-24, y-16, 6, 16); g.drawRect(x+18, y-16, 6, 16); g.drawRect(x-20, y-20, 40, 10); 
        g.endFill(); c.addChild(g); 
    },

    drawWaterCooler(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xdddddd); g.drawRect(x-5, y-18, 10, 18); g.endFill(); 
        g.beginFill(0x3b82f6, 0.6); g.drawRoundedRect(x-4, y-32, 8, 14, 2); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-3, y-14, 6, 4); g.endFill(); 
        g.beginFill(0xff3333); g.drawRect(x-3, y-17, 2, 2); 
        g.beginFill(0x3b82f6); g.drawRect(x+1, y-17, 2, 2); g.endFill(); 
        c.addChild(g); 
    },

    drawChair(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,4,12); g.drawRect(x-5,y-8,12,3); 
        g.beginFill(0x33334a); g.drawRect(x+1,y-5,2,3); g.drawRect(x-3,y-2,10,2); g.endFill(); 
        c.addChild(g); 
    },

    drawBeanbagAndHandheld(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0xf472b6); g.drawEllipse(x, y-5, 12, 5); g.drawCircle(x, y-8, 7); g.endFill();
        g.beginFill(0x11111a); g.drawRect(x-12, y-15, 6, 10); g.endFill();
        g.beginFill(0x22d3ee); g.drawRect(x-11, y-14, 4, 6); g.endFill();
        c.addChild(g);
    },

    drawPingPongTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-15, y-15, 4, 15); g.drawRect(x+11, y-15, 4, 15); g.endFill();
        g.beginFill(0x10b981); g.drawRect(x-20, y-17, 40, 4); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x-1, y-22, 2, 5); g.endFill();
        c.addChild(g);
    },

    drawIndoorPool(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-30, y-4, 60, 4); g.endFill();
        g.beginFill(0x0284c7, 0.6); g.drawRect(x-28, y-3, 56, 3); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.3); glow.drawRect(x-28, y-15, 56, 12); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'pool' });
    },

    drawGeckoTerrarium(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-12, y-8, 24, 8); g.endFill(); 
        g.beginFill(0x111111, 0.5); g.drawRect(x-10, y-20, 20, 12); g.endFill(); 
        g.lineStyle(1, 0xffffff, 0.2); g.drawRect(x-10, y-20, 20, 12); g.lineStyle(0);
        g.beginFill(0x22c55e); g.drawCircle(x-5, y-12, 3); g.drawCircle(x+4, y-14, 2); g.endFill(); 
        g.beginFill(0xfacc15); g.drawRect(x-1, y-10, 2, 1); g.endFill(); 
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.2); glow.drawRect(x-10, y-20, 20, 12); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
    },

    drawBiophilicDivider(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-8, y-10, 16, 10); g.endFill();
        g.beginFill(0x166534); g.drawCircle(x-4, y-15, 8); g.drawCircle(x+4, y-12, 6); g.drawCircle(x, y-20, 7); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x-2, y-16, 4); g.drawCircle(x+2, y-14, 3); g.endFill();
        c.addChild(g);
    },

    drawCanteen(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-25, y-15, 4, 15); g.drawRect(x+21, y-15, 4, 15); g.endFill();
        g.beginFill(0xf1f5f9); g.drawRect(x-30, y-18, 60, 4); g.endFill();
        g.beginFill(0xd97706); g.drawRect(x-20, y-8, 8, 3); g.drawRect(x, y-8, 8, 3); g.drawRect(x+12, y-8, 8, 3); g.endFill();
        c.addChild(g);
    },

    drawDeskAndPC(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-10, y-15, 2, 15); g.drawRect(x+8, y-15, 2, 15); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x-12, y-18, 24, 4); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-6, y-28, 12, 10); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(cHex, 0.4); glow.drawRect(x-5, y-27, 10, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'screen' });
    },

    drawCollaborationPod(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawEllipse(x, y-15, 20, 15); g.endFill();
        g.beginFill(cHex, 0.3); g.drawEllipse(x, y-15, 18, 13); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-10, y-18, 20, 6); g.endFill();
        g.beginFill(cHex); g.drawRect(x-8, y-17, 16, 4); g.endFill();
        c.addChild(g);
    },

    drawLoungeNook(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.4); g.drawRect(x-20, y-10, 20, 10); g.drawRect(x-20, y-20, 10, 20); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x-5, y-12, 15, 12); g.endFill();
        g.beginFill(0x22c55e); g.drawCircle(x+2, y-16, 6); g.endFill();
        c.addChild(g);
    },

    drawTrophy(c, x, y, isGold) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        const col = isGold ? 0xfacc15 : 0x94a3b8;
        g.beginFill(0x111111); g.drawRect(x-8, y-10, 16, 10); g.endFill();
        g.beginFill(col); g.drawPolygon([x-10, y-30, x+10, y-30, x+4, y-10, x-4, y-10]); g.endFill();
        g.beginFill(col); g.drawCircle(x-12, y-25, 4); g.drawCircle(x+12, y-25, 4); g.endFill();
        g.beginFill(0x000000); g.drawCircle(x-12, y-25, 2); g.drawCircle(x+12, y-25, 2); g.endFill();
        c.addChild(g);
    },

    drawExecutiveLounge(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(cHex, 0.2); g.drawEllipse(x, y-2, 30, 4); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(x-25, y-12, 15, 12); g.drawRect(x+10, y-12, 15, 12); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-8, y-8, 16, 8); g.endFill();
        g.beginFill(0xffffff, 0.8); g.drawRect(x-5, y-10, 4, 2); g.drawRect(x+1, y-10, 4, 2); g.endFill();
        c.addChild(g);
    },

    drawCommandCenter(c, x, y, col) {
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-20, y-15, 40, 15); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-18, y-35, 10, 10); g.drawRect(x-4, y-38, 12, 12); g.drawRect(x+10, y-35, 10, 10); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(cHex, 0.5); glow.drawRect(x-17, y-34, 8, 8); glow.drawRect(x-3, y-37, 10, 10); glow.drawRect(x+11, y-34, 8, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawPrivateOasis(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-15, y-8, 30, 8); g.endFill();
        g.beginFill(0x0284c7); g.drawRect(x-12, y-6, 24, 4); g.endFill();
        g.beginFill(0x166534); g.drawCircle(x-15, y-15, 10); g.drawCircle(x+15, y-12, 8); g.endFill();
        c.addChild(g);
    },

    drawBossDesk(c, x, y, col) { 
        const cHex = this._parseCol(col);
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-25,y-18,50,18); g.endFill(); 
        g.beginFill(cHex); g.drawRect(x-28,y-18,56,5); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x-5,y-30,6,12); g.drawRect(x+5,y-30,6,12); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x-4,y-29,2,10); g.drawRect(x+4,y-29,2,10); g.endFill(); 
        c.addChild(g); 
    },

    drawDataVat(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x11111a); g.drawEllipse(x, y, 40, 10); g.endFill();
        g.beginFill(0x222233); g.drawRect(x - 40, y - 10, 80, 10); g.endFill();
        g.beginFill(0x22d3ee, 0.15); g.lineStyle(2, 0x22d3ee, 0.4);
        g.drawRect(x - 35, y - 80, 70, 70); g.endFill(); g.lineStyle(0);
        g.beginFill(0x0ea5e9, 0.4); g.drawRect(x - 30, y - 75, 60, 65); g.endFill();
        g.beginFill(0x222233); g.drawRect(x - 40, y - 90, 80, 10); g.endFill();
        g.beginFill(0x11111a); g.drawEllipse(x, y - 90, 40, 10); g.endFill();
        c.addChild(g);
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.3); glow.drawCircle(x, y - 45, 50); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'server' });
    },
    
    drawBrokenServer(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x222233); g.drawRect(x-12, y-28, 24, 28); g.endFill();
        g.beginFill(0x11111a); g.drawRect(x-10, y-26, 20, 24); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x-5, y-20, 1); g.endFill();
        g.beginFill(0x555566); g.drawRect(x-8, y-10, 16, 2); g.rotation = 0.1; g.endFill(); 
        c.addChild(g);
        const glow = new PIXI.Graphics();
        glow.beginFill(0xef4444, 0.8); glow.drawCircle(x-5, y-20, 2); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.9, type: 'error' });
    },
    
    drawTombstone(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x555566); g.drawRoundedRect(x-12, y-25, 24, 25, 10); g.endFill();
        g.beginFill(0x33334a); g.drawRect(x-14, y-4, 28, 4); g.endFill();
        g.beginFill(0x222233); g.drawRect(x-1, y-18, 2, 8); g.drawRect(x-3, y-16, 6, 2); g.endFill(); 
        c.addChild(g);
    },

    drawCafeTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x33334a); g.drawRect(x-2, y-15, 4, 15); g.endFill();
        g.beginFill(0xf1f5f9); g.drawEllipse(x, y-15, 20, 4); g.endFill();
        g.beginFill(0xd97706); g.drawRect(x-18, y-8, 6, 8); g.drawRect(x+12, y-8, 6, 8); g.endFill();
        c.addChild(g);
    },

    drawBaristaCounter(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1e293b); g.drawRect(x-30, y-25, 60, 25); g.endFill();
        g.beginFill(0xb45309); g.drawRect(x-32, y-25, 64, 4); g.endFill();
        g.beginFill(0x94a3b8); g.drawRect(x-20, y-40, 15, 15); g.endFill();
        g.beginFill(0x0f172a); g.drawRect(x-18, y-35, 11, 10); g.endFill();
        g.beginFill(0xcbd5e1); g.drawRect(x-15, y-30, 2, 4); g.drawRect(x-10, y-30, 2, 4); g.endFill();
        g.beginFill(0x334155); g.drawPolygon([x+10, y-25, x+25, y-25, x+22, y-35, x+13, y-35]); g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0x4ade80, 0.8); glow.drawRect(x+14, y-33, 7, 5); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawPicnicTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x78350f); 
        g.drawRect(x-25, y-15, 50, 4);
        g.drawRect(x-30, y-8, 12, 3);
        g.drawRect(x+18, y-8, 12, 3);
        g.drawPolygon([x-15, y, x-10, y, x, y-15, x-5, y-15]);
        g.drawPolygon([x+15, y, x+10, y, x, y-15, x+5, y-15]);
        g.endFill();
        c.addChild(g);
    },

    drawTree(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x4a2e1a); g.drawRect(x-3, y-30, 6, 30); g.endFill();
        g.beginFill(0x1b4332); g.drawCircle(x, y-35, 15); g.drawCircle(x-10, y-25, 12); g.drawCircle(x+10, y-25, 12); g.endFill();
        g.beginFill(0x2d6a4f); g.drawCircle(x, y-40, 12); g.drawCircle(x-8, y-32, 10); g.drawCircle(x+8, y-32, 10); g.endFill();
        c.addChild(g);
    },

    drawArcadeCabinet(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); g.drawPolygon([x-10,y, x-10,y-30, x-8,y-35, x+8,y-35, x+10,y-30, x+10,y]); g.endFill();
        g.beginFill(0x222222); g.drawRect(x-8, y-32, 16, 12); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-12, y-20, 24, 4); g.endFill(); 
        const glow = new PIXI.Graphics();
        glow.beginFill(0x00ffff, 0.6); glow.drawRect(x-6, y-30, 12, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.8, type: 'screen' });
    },

    drawCar(c, x, y, col) {
        const cHex = this._parseCol(col);
        const gfx = new PIXI.Graphics();
        gfx.beginFill(cHex); gfx.drawRoundedRect(-22, -18, 44, 18, 4); gfx.endFill();
        gfx.beginFill(cHex, 0.8); gfx.drawRoundedRect(-12, -28, 24, 12, 4); gfx.endFill();
        gfx.beginFill(0x333333); gfx.drawCircle(-12, -1, 4); gfx.drawCircle(12, -1, 4); gfx.endFill();
        gfx.beginFill(0xffffff, 1.0); gfx.drawRect(20, -8, 4, 6); gfx.endFill();
        gfx.beginFill(0xff3333, 1.0); gfx.drawRect(-26, -10, 4, 4); gfx.endFill();
        gfx.x = x; gfx.y = y;
        c.addChild(gfx);
        return gfx;
    },

    // ════════════════════════════════════════════════════════
    //   SILICON WOODS — Billionaire CEO Retreat Props
    // ════════════════════════════════════════════════════════

    drawGlampingDome(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Geodesic dome shell — translucent hexagonal pod
        g.beginFill(0x1e293b, 0.6);
        g.lineStyle(1, 0x38bdf8, 0.4);
        g.drawCircle(x, y - 20, 22);
        g.endFill();
        // Internal geodesic lines
        g.lineStyle(1, 0x38bdf8, 0.2);
        g.moveTo(x - 18, y - 10); g.lineTo(x, y - 40); g.lineTo(x + 18, y - 10);
        g.moveTo(x - 20, y - 20); g.lineTo(x + 20, y - 20);
        g.moveTo(x - 12, y - 35); g.lineTo(x + 12, y - 35);
        g.lineStyle(0);
        // Warm interior glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfbbf24, 0.15); glow.drawCircle(x, y - 18, 16); glow.endFill();
        glow.beginFill(0xfbbf24, 0.3); glow.drawCircle(x, y - 16, 8); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Base platform
        g.beginFill(0x334155); g.drawRect(x - 24, y - 2, 48, 4); g.endFill();
        // Door slit
        g.beginFill(0xfbbf24, 0.4); g.drawRect(x - 3, y - 12, 6, 12); g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'dome' });
    },

    drawFirePitLounge(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Sunken stone pit ring
        g.beginFill(0x1e293b); g.drawEllipse(x, y - 4, 35, 8); g.endFill();
        g.beginFill(0x334155); g.drawEllipse(x, y - 5, 30, 6); g.endFill();
        g.beginFill(0x0f172a); g.drawEllipse(x, y - 5, 22, 4); g.endFill();
        // Ember bed
        g.beginFill(0xef4444, 0.8); g.drawEllipse(x, y - 5, 12, 3); g.endFill();
        g.beginFill(0xfbbf24, 0.6); g.drawEllipse(x, y - 6, 8, 2); g.endFill();
        // Flame particles
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfbbf24, 0.3); glow.drawEllipse(x, y - 12, 14, 10); glow.endFill();
        glow.beginFill(0xef4444, 0.15); glow.drawEllipse(x, y - 16, 20, 14); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Designer Adirondack chairs (4 around the pit)
        const chairCol = 0x78350f;
        [-30, -20, 20, 30].forEach(ox => {
            g.beginFill(chairCol); g.drawRect(x + ox - 4, y - 10, 8, 8); g.endFill();
            g.beginFill(0x92400e); g.drawRect(x + ox - 3, y - 14, 6, 4); g.endFill();
        });
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.5, type: 'firepit' });
    },

    drawWhiskeyBar(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Dark wood bar counter
        g.beginFill(0x3d2914); g.drawRect(x - 30, y - 20, 60, 20); g.endFill();
        g.beginFill(0x4a3520); g.drawRect(x - 32, y - 22, 64, 4); g.endFill();
        // Bar surface shine
        g.beginFill(0xfbbf24, 0.08); g.drawRect(x - 28, y - 20, 56, 2); g.endFill();
        // Backlit bottle shelves
        g.beginFill(0x1a1a2e); g.drawRect(x - 28, y - 40, 56, 18); g.endFill();
        const backlight = new PIXI.Graphics();
        backlight.beginFill(0xfbbf24, 0.2); backlight.drawRect(x - 26, y - 38, 52, 14); backlight.endFill();
        backlight.blendMode = PIXI.BLEND_MODES.ADD;
        // Bottles
        const bottleCols = [0x92400e, 0xfbbf24, 0x7c2d12, 0xd97706, 0x451a03];
        for (let i = 0; i < 5; i++) {
            const bx = x - 20 + i * 10;
            g.beginFill(bottleCols[i]); g.drawRect(bx, y - 38, 4, 12); g.endFill();
            g.beginFill(bottleCols[i], 0.7); g.drawRect(bx + 1, y - 42, 2, 4); g.endFill();
        }
        // Bar stools
        [-20, -8, 8, 20].forEach(ox => {
            g.beginFill(0x111111); g.drawRect(x + ox - 2, y - 4, 4, 4); g.endFill();
            g.beginFill(0x1e293b); g.drawCircle(x + ox, y - 6, 4); g.endFill();
        });
        c.addChild(g, backlight);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: backlight, maxA: 0.3, type: 'bar' });
    },

    drawInfinityHotTub(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Stone surround
        g.beginFill(0x334155); g.drawEllipse(x, y - 6, 32, 10); g.endFill();
        g.beginFill(0x1e293b); g.drawEllipse(x, y - 7, 28, 8); g.endFill();
        // Water
        g.beginFill(0x0ea5e9, 0.6); g.drawEllipse(x, y - 7, 24, 6); g.endFill();
        g.beginFill(0x38bdf8, 0.3); g.drawEllipse(x, y - 8, 18, 4); g.endFill();
        // Steam glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.12); glow.drawEllipse(x, y - 18, 28, 16); glow.endFill();
        glow.beginFill(0xffffff, 0.06); glow.drawEllipse(x - 8, y - 22, 10, 8); glow.drawEllipse(x + 6, y - 20, 8, 6); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Rim lights
        g.beginFill(0x0ea5e9, 0.8);
        g.drawCircle(x - 26, y - 6, 2); g.drawCircle(x + 26, y - 6, 2);
        g.drawCircle(x, y - 14, 1.5);
        g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'pool' });
    },

    drawPuttingGreen(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Manicured green
        g.beginFill(0x166534); g.drawEllipse(x, y - 4, 40, 8); g.endFill();
        g.beginFill(0x15803d); g.drawEllipse(x, y - 5, 36, 6); g.endFill();
        // Putting hole
        g.beginFill(0x0f172a); g.drawCircle(x + 15, y - 5, 3); g.endFill();
        // Flag pin
        g.beginFill(0x94a3b8); g.drawRect(x + 15, y - 28, 2, 23); g.endFill();
        g.beginFill(0xef4444); g.drawPolygon([x + 17, y - 28, x + 27, y - 24, x + 17, y - 20]); g.endFill();
        // Golf ball
        g.beginFill(0xffffff); g.drawCircle(x - 10, y - 4, 2); g.endFill();
        // Sand trap
        g.beginFill(0xfbbf24, 0.3); g.drawEllipse(x - 25, y - 3, 10, 4); g.endFill();
        c.addChild(g);
    },

    drawHelipad(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Concrete pad
        g.beginFill(0x334155); g.drawRect(x - 30, y - 6, 60, 6); g.endFill();
        g.beginFill(0x475569); g.drawRect(x - 28, y - 5, 56, 4); g.endFill();
        // Circle marking
        g.lineStyle(2, 0xfacc15, 0.8); g.drawCircle(x, y - 3, 18); g.lineStyle(0);
        // H marking
        const hTxt = new PIXI.Text('H', { fontFamily: 'Arial', fontSize: 14, fill: 0xfacc15, fontWeight: 'bold' });
        hTxt.anchor.set(0.5, 0.5); hTxt.x = x; hTxt.y = y - 3;
        // Landing lights (corners)
        g.beginFill(0xfacc15, 0.9);
        g.drawCircle(x - 26, y - 1, 2); g.drawCircle(x + 26, y - 1, 2);
        g.drawCircle(x - 26, y - 5, 2); g.drawCircle(x + 26, y - 5, 2);
        g.endFill();
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.1); glow.drawRect(x - 30, y - 10, 60, 14); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow, hTxt);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.15, type: 'helipad' });
    },

    drawStarlinkDish(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tripod base
        g.beginFill(0x64748b); g.drawRect(x - 1, y - 18, 2, 18); g.endFill();
        g.beginFill(0x475569); g.drawRect(x - 6, y - 2, 12, 2); g.endFill();
        // Dish
        g.beginFill(0xf1f5f9);
        g.drawPolygon([x - 12, y - 22, x, y - 30, x + 12, y - 22]);
        g.endFill();
        g.beginFill(0xe2e8f0); g.drawEllipse(x, y - 22, 12, 4); g.endFill();
        // Antenna pip
        g.beginFill(0x22d3ee); g.drawCircle(x, y - 28, 2); g.endFill();
        // Signal glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.3); glow.drawCircle(x, y - 28, 4); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Blinking LEDs on base
        g.beginFill(0x4ade80); g.drawCircle(x - 4, y - 16, 1); g.endFill();
        g.beginFill(0xef4444); g.drawCircle(x + 4, y - 16, 1); g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.4, type: 'signal' });
    },

    drawZenGardenProp(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Raked sand base
        g.beginFill(0xd6d3d1, 0.3); g.drawEllipse(x, y - 3, 35, 8); g.endFill();
        // Rake lines
        g.lineStyle(1, 0xa8a29e, 0.3);
        for (let i = -3; i <= 3; i++) {
            g.drawEllipse(x, y - 3, 15 + i * 3, 3 + Math.abs(i));
        }
        g.lineStyle(0);
        // Stones
        g.beginFill(0x44403c); g.drawEllipse(x - 12, y - 4, 6, 4); g.endFill();
        g.beginFill(0x57534e); g.drawEllipse(x + 14, y - 3, 5, 3); g.endFill();
        g.beginFill(0x78716c); g.drawCircle(x + 4, y - 5, 3); g.endFill();
        // Bonsai tree
        g.beginFill(0x4a2e1a); g.drawRect(x + 20, y - 16, 3, 12); g.endFill();
        g.beginFill(0x166534); g.drawEllipse(x + 21, y - 20, 8, 6); g.endFill();
        g.beginFill(0x15803d); g.drawEllipse(x + 18, y - 16, 5, 4); g.drawEllipse(x + 25, y - 17, 5, 3); g.endFill();
        // Ceramic pot
        g.beginFill(0x78350f); g.drawRect(x + 17, y - 6, 8, 6); g.endFill();
        g.beginFill(0x92400e); g.drawRect(x + 16, y - 6, 10, 2); g.endFill();
        c.addChild(g);
    },

    drawLuxuryRedwood(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Massive trunk
        g.beginFill(0x4a2e1a); g.drawRect(x - 5, y - 50, 10, 50); g.endFill();
        g.beginFill(0x3d2514); g.drawRect(x - 4, y - 50, 3, 50); g.endFill();
        // Deep canopy layers
        g.beginFill(0x064e3b); g.drawEllipse(x, y - 55, 22, 14); g.endFill();
        g.beginFill(0x065f46); g.drawEllipse(x - 5, y - 60, 16, 10); g.drawEllipse(x + 8, y - 58, 14, 9); g.endFill();
        g.beginFill(0x047857); g.drawEllipse(x, y - 65, 12, 8); g.endFill();
        // Fairy lights strung in canopy
        const lights = new PIXI.Graphics();
        lights.beginFill(0xfbbf24, 0.8);
        [-14, -8, -2, 4, 10, 16].forEach(ox => {
            lights.drawCircle(x + ox, y - 52 + Math.sin(ox) * 3, 1);
        });
        lights.endFill();
        lights.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, lights);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: lights, maxA: 0.9, type: 'fairy' });
    },

    // ════════════════════════════════════════════════════════
    //   FRONTIER PINES — Launch Viewing Area Props
    // ════════════════════════════════════════════════════════

    drawTelescope(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Tripod legs
        g.beginFill(0x475569);
        g.drawPolygon([x - 2, y - 20, x - 12, y, x - 8, y]);
        g.drawPolygon([x + 2, y - 20, x + 12, y, x + 8, y]);
        g.drawRect(x - 1, y - 22, 2, 6);
        g.endFill();
        // Telescope tube
        g.beginFill(0x1e293b);
        g.drawRoundedRect(x - 14, y - 30, 28, 8, 4);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRoundedRect(x - 12, y - 29, 24, 6, 3);
        g.endFill();
        // Lens
        g.beginFill(0x38bdf8, 0.6);
        g.drawCircle(x + 14, y - 26, 4);
        g.endFill();
        // Lens glow
        const glow = new PIXI.Graphics();
        glow.beginFill(0x38bdf8, 0.15);
        glow.drawCircle(x + 14, y - 26, 7);
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        // Eyepiece
        g.beginFill(0x111118);
        g.drawRect(x - 16, y - 28, 4, 4);
        g.endFill();
        c.addChild(g, glow);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.2, type: 'signal' });
    },

    drawViewingPlatform(c, x, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Elevated wooden platform
        g.beginFill(0x78350f);
        g.drawRect(x, y - 4, w, 4);
        g.endFill();
        g.beginFill(0x92400e);
        g.drawRect(x, y - 6, w, 3);
        g.endFill();
        // Support posts
        g.beginFill(0x78350f);
        g.drawRect(x + 4, y - 2, 4, 6);
        g.drawRect(x + w - 8, y - 2, 4, 6);
        g.endFill();
        // Railing
        g.beginFill(0x92400e);
        g.drawRect(x, y - 18, 2, 14);
        g.drawRect(x + w - 2, y - 18, 2, 14);
        g.drawRect(x, y - 18, w, 2);
        g.endFill();
        // Railing posts
        for (let rx = x + 10; rx < x + w - 5; rx += 12) {
            g.beginFill(0x92400e);
            g.drawRect(rx, y - 16, 2, 12);
            g.endFill();
        }
        c.addChild(g);
    },

    drawRefreshmentStand(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Cart body
        g.beginFill(0xef4444);
        g.drawRoundedRect(x - 18, y - 28, 36, 22, 3);
        g.endFill();
        g.beginFill(0xb91c1c);
        g.drawRoundedRect(x - 16, y - 26, 32, 18, 2);
        g.endFill();
        // Striped awning
        g.beginFill(0xef4444);
        g.drawRect(x - 22, y - 34, 44, 8);
        g.endFill();
        for (let sx = x - 20; sx < x + 22; sx += 8) {
            g.beginFill(0xffffff, 0.3);
            g.drawRect(sx, y - 34, 4, 8);
            g.endFill();
        }
        // Counter shelf
        g.beginFill(0x4a2e1a);
        g.drawRect(x - 20, y - 8, 40, 3);
        g.endFill();
        // Drinks / items on counter
        g.beginFill(0xfbbf24); g.drawRect(x - 10, y - 14, 4, 6); g.endFill();
        g.beginFill(0x22d3ee); g.drawRect(x - 2, y - 14, 4, 6); g.endFill();
        g.beginFill(0xef4444); g.drawRect(x + 6, y - 14, 4, 6); g.endFill();
        // Wheels
        g.beginFill(0x333333);
        g.drawCircle(x - 12, y, 3);
        g.drawCircle(x + 12, y, 3);
        g.endFill();
        // Sign
        const sign = new PIXI.Text('SNACKS', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 5, fill: 0xffffff, fontWeight: 'bold'
        });
        sign.anchor.set(0.5, 0.5);
        sign.x = x; sign.y = y - 31;
        c.addChild(g, sign);
    },

    drawBinoculars(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Coin-operated viewfinder on a pole
        g.beginFill(0x475569);
        g.drawRect(x - 2, y - 30, 4, 30);
        g.endFill();
        // Viewfinder body
        g.beginFill(0x334155);
        g.drawRoundedRect(x - 10, y - 38, 20, 10, 3);
        g.endFill();
        // Eyepieces
        g.beginFill(0x111118);
        g.drawCircle(x - 5, y - 33, 3);
        g.drawCircle(x + 5, y - 33, 3);
        g.endFill();
        // Lenses
        g.beginFill(0x38bdf8, 0.5);
        g.drawCircle(x - 5, y - 33, 2);
        g.drawCircle(x + 5, y - 33, 2);
        g.endFill();
        // Coin slot indicator
        g.beginFill(0xfbbf24);
        g.drawCircle(x + 8, y - 28, 1.5);
        g.endFill();
        // Base
        g.beginFill(0x475569);
        g.drawRect(x - 6, y - 2, 12, 2);
        g.endFill();
        c.addChild(g);
    },

    drawCountdownBoard(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Pole
        g.beginFill(0x475569);
        g.drawRect(x - 2, y - 50, 4, 50);
        g.endFill();
        // Screen
        g.beginFill(0x0a0a15);
        g.drawRect(x - 28, y - 54, 56, 22);
        g.endFill();
        g.beginFill(0x111120);
        g.drawRect(x - 26, y - 52, 52, 18);
        g.endFill();
        // Border glow
        g.lineStyle(1, 0xef4444, 0.4);
        g.drawRect(x - 28, y - 54, 56, 22);
        g.lineStyle(0);
        // Static text
        const txt = new PIXI.Text('NEXT LAUNCH', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: 0xef4444, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 0.5);
        txt.x = x; txt.y = y - 46;
        const countTxt = new PIXI.Text('STANDBY', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x22d3ee, fontWeight: 'bold'
        });
        countTxt.anchor.set(0.5, 0.5);
        countTxt.x = x; countTxt.y = y - 38;
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(0xef4444, 0.06);
        screenGlow.drawRect(x - 28, y - 54, 56, 22);
        screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, screenGlow, txt, countTxt);
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: screenGlow, maxA: 0.1, type: 'screen' });
    },

    drawBlanketArea(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Picnic blanket on ground
        g.beginFill(0xef4444, 0.4);
        g.drawRect(x - 15, y - 3, 30, 6);
        g.endFill();
        g.beginFill(0xffffff, 0.15);
        for (let bx = x - 13; bx < x + 15; bx += 6) {
            g.drawRect(bx, y - 2, 3, 4);
        }
        g.endFill();
        // Thermos
        g.beginFill(0x475569);
        g.drawRect(x + 14, y - 8, 4, 8);
        g.endFill();
        g.beginFill(0xef4444);
        g.drawRect(x + 14, y - 10, 4, 3);
        g.endFill();
        c.addChild(g);
    },

    drawFrontierPine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rugged pine — darker than luxury redwoods
        g.beginFill(0x3d2514);
        g.drawRect(x - 3, y - 40, 6, 40);
        g.endFill();
        g.beginFill(0x064e3b);
        g.drawPolygon([x, y - 55, x - 16, y - 25, x + 16, y - 25]);
        g.endFill();
        g.beginFill(0x065f46);
        g.drawPolygon([x, y - 48, x - 12, y - 30, x + 12, y - 30]);
        g.endFill();
        g.beginFill(0x047857);
        g.drawPolygon([x, y - 42, x - 8, y - 32, x + 8, y - 32]);
        g.endFill();
        c.addChild(g);
    }
};

class CityElevator {
    constructor(layer, numFloors, floorHeight, shaftX) {
        this.layer = layer;
        this.numFloors = numFloors;
        this.floorHeight = floorHeight;
        this.x = shaftX;
        
        this.state = 'idle'; 
        this.currentFloor = 0;
        this.targetFloor = 0;
        this.timer = 0;
        this.doorWidth = 24;
        this.speed = 2.5;
        
        this.callQueue = [];
        this.doors = []; 
        
        this.shaft = new PIXI.Graphics();
        this.shaft.beginFill(0x1a1a24);
        this.shaft.drawRect(
            this.x - this.doorWidth, 
            -((this.numFloors - 1) * this.floorHeight), 
            this.doorWidth * 2, 
            (this.numFloors + 1) * this.floorHeight
        );
        this.shaft.endFill();
        this.layer.addChild(this.shaft);

        this.car = new PIXI.Graphics();
        this.car.beginFill(0x3a3a4c);
        this.car.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth * 2, this.floorHeight - 5);
        this.car.endFill();
        this.car.x = this.x;
        this.car.y = 0; 
        this.layer.addChild(this.car);

        const totalFloors = numFloors + 1;

        for(let i = -1; i < numFloors; i++) {
            let fy = -i * this.floorHeight;
            
            let leftDoor = new PIXI.Graphics();
            let rightDoor = new PIXI.Graphics();
            this.drawDoor(leftDoor, true);
            this.drawDoor(rightDoor, false);
            leftDoor.x = this.x; leftDoor.y = fy;
            rightDoor.x = this.x; rightDoor.y = fy;
            
            this.layer.addChild(leftDoor, rightDoor);
            
            let lightContainer = new PIXI.Container();
            lightContainer.x = this.x; 
            lightContainer.y = fy - this.floorHeight + 12;
            
            let floorLights = [];
            for(let j = -1; j < numFloors; j++) {
                let l = new PIXI.Graphics();
                l.beginFill(0x222222); 
                const maxW = 36;
                const spacing = Math.min(6, maxW / totalFloors);
                const lightIdx = j + 1;
                l.drawCircle((lightIdx - totalFloors/2) * spacing + (spacing/2), 0, Math.min(1.5, spacing/3)); 
                l.endFill();
                floorLights.push(l);
                lightContainer.addChild(l);
            }
            this.layer.addChild(lightContainer);

            this.doors.push({ 
                left: leftDoor, 
                right: rightDoor, 
                openAmt: 0, 
                lights: floorLights,
                floorNum: i
            });
        }
    }

    drawDoor(gfx, isLeft) {
        gfx.clear();
        gfx.beginFill(0x4a4a5a);
        gfx.lineStyle(1, 0x2a2a3a);
        if (isLeft) {
            gfx.drawRect(-this.doorWidth, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        } else {
            gfx.drawRect(0, -this.floorHeight + 5, this.doorWidth, this.floorHeight - 5);
        }
        gfx.endFill();
    }

    call(floor) {
        if (!this.callQueue.includes(floor) && (this.currentFloor !== floor || this.state !== 'open')) {
            this.callQueue.push(floor);
        }
    }

    update() {
        let currentPassingFloor = -Math.round(this.car.y / this.floorHeight);
        const totalFloors = this.numFloors + 1;
        const maxW = 36; 
        const spacing = Math.min(6, maxW / totalFloors);

        this.doors.forEach((doorObj) => {
            doorObj.lights.forEach((light, lightIdx) => {
                const representedFloor = lightIdx - 1; 
                light.clear();
                if (representedFloor === currentPassingFloor) {
                    light.beginFill(0x4ade80); 
                } else {
                    light.beginFill(0x222222); 
                }
                light.drawCircle((lightIdx - totalFloors/2) * spacing + (spacing/2), 0, Math.min(1.5, spacing/3));
                light.endFill();
            });
        });

        if (this.state === 'idle') {
            if (this.callQueue.length > 0) {
                this.targetFloor = this.callQueue.shift();
                if (this.targetFloor === this.currentFloor) {
                    this.state = 'opening';
                } else {
                    this.state = 'moving';
                }
            }
        } 
        else if (this.state === 'moving') {
            let targetY = -this.targetFloor * this.floorHeight;
            let dir = Math.sign(targetY - this.car.y);
            this.car.y += dir * this.speed;
            
            if (Math.abs(this.car.y - targetY) <= this.speed) {
                this.car.y = targetY;
                this.currentFloor = this.targetFloor;
                this.state = 'opening';
            }
        } 
        else if (this.state === 'opening') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt += 0.05;
            if (door.openAmt >= 1) {
                door.openAmt = 1;
                this.state = 'open';
                this.timer = 90; 
            }
            this.updateDoorVisuals(door);
        } 
        else if (this.state === 'open') {
            this.timer--;
            if (this.timer <= 0) {
                this.state = 'closing';
            }
        } 
        else if (this.state === 'closing') {
            let door = this.doors[this.currentFloor + 1];
            door.openAmt -= 0.05;
            if (door.openAmt <= 0) {
                door.openAmt = 0;
                this.state = 'idle';
            }
            this.updateDoorVisuals(door);
        }
    }

    updateDoorVisuals(door) {
        door.left.x = this.x - (door.openAmt * this.doorWidth * 0.9);
        door.right.x = this.x + (door.openAmt * this.doorWidth * 0.9);
    }

    destroy() {
        this.shaft.destroy();
        this.car.destroy();
        this.doors.forEach(d => {
            d.left.destroy();
            d.right.destroy();
            d.lights.forEach(l => l.destroy());
        });
    }
}
