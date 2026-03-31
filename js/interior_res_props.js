/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR RESIDENTIAL PROPS (v15.2.0 - Billionaire's Row Props)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorResProps = {
    lifts: {},

    initLift(layer, bldId, numFloors, floorHeight, shaftX) {
        if (this.lifts[bldId]) {
            this.lifts[bldId].destroy();
        }
        const lift = new ResElevator(layer, numFloors, floorHeight, shaftX);
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
        const roofCont = new PIXI.Container();
        const isEstate = bld.id.startsWith('house_');
        const boardW = isEstate ? 280 : 220; 
        const boardH = 34; 
        const boardX = startX + usableW / 2 - boardW / 2; 
        const boardY = roofH - boardH - 10;
        
        const gfx = new PIXI.Graphics();
        gfx.beginFill(0x111111); 
        gfx.lineStyle(2, colHex, 0.8); 
        gfx.drawRect(boardX, boardY, boardW, boardH); 
        gfx.endFill(); 
        gfx.lineStyle(0);
        
        gfx.beginFill(0x333333); 
        gfx.drawRect(boardX + 15, boardY + boardH, 6, 10); 
        gfx.drawRect(boardX + boardW - 21, boardY + boardH, 6, 10); 
        gfx.endFill();
        
        if (isEstate && bld.lab === 'xai') {
            gfx.beginFill(0x222233); gfx.drawEllipse(startX + usableW/2, roofH - 5, 40, 10); gfx.endFill();
            gfx.lineStyle(2, 0xfacc15); gfx.drawCircle(startX + usableW/2, roofH - 5, 15); gfx.lineStyle(0);
            const hTxt = new PIXI.Text('H', { fontFamily: 'Arial', fontSize: 16, fill: 0xfacc15, fontWeight: 'bold' });
            hTxt.anchor.set(0.5); hTxt.x = startX + usableW/2; hTxt.y = roofH - 5;
            roofCont.addChild(hTxt);
        }
        
        roofCont.addChild(gfx);
        
        const safeLabName = lab ? (lab.name || bld.name) : (bld.name || 'RESIDENTIAL');
        const textToDisplay = isEstate ? bld.name.toUpperCase() : (bld.lab ? safeLabName.toUpperCase() : `${bld.emoji || ''} ${(bld.name || 'TOWER').toUpperCase()}`.trim());
        
        const logoTxt = new PIXI.Text(textToDisplay, { 
            fontFamily: 'JetBrains Mono', 
            fontSize: 14, 
            fontWeight: 'bold', 
            fill: 0xffffff, 
            letterSpacing: 2, 
            dropShadow: true, 
            dropShadowColor: colHex, 
            dropShadowBlur: 8, 
            dropShadowDistance: 0 
        });
        logoTxt.anchor.set(0.5, 0.5); 
        logoTxt.x = startX + usableW / 2; 
        logoTxt.y = boardY + boardH / 2; 
        roofCont.addChild(logoTxt);
        
        this.scene.addChild(roofCont);
    },

    drawBasementInterior(gfx, x, y, w, h) {
        gfx.beginFill(0x0e0e15); 
        gfx.drawRect(x, y, w, h); 
        gfx.endFill();
        
        gfx.beginFill(0x0a0a10); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill();
        
        gfx.beginFill(0x1a1a2e); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill();
        
        for(let i = x + 100; i < x + w - 100; i += 150) {
            gfx.beginFill(0xffffff, 0.5); 
            gfx.drawRect(i - 10, y, 20, 2); 
            gfx.endFill();
            
            gfx.beginFill(0xfffce0, 0.02);
            gfx.moveTo(i - 10, y + 2); 
            gfx.lineTo(i + 10, y + 2);
            gfx.lineTo(i + 40, y + h - 8); 
            gfx.lineTo(i - 40, y + h - 8);
            gfx.endFill();
        }
    },

    drawNegativeSpaceWall(gfx, wallColor, x, y, w, h, isCeo, windowX, windowW, theme = 'residential') {
        gfx.beginFill(wallColor);
        if (theme === 'estate') {
            gfx.drawRect(x, y, w, 15); 
            gfx.drawRect(x, y + h - 20, w, 20); 
            gfx.drawRect(x, y + 15, windowX - x, h - 35); 
            gfx.drawRect(windowX + windowW, y + 15, x + w - (windowX + windowW), h - 35);
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
        let wallCol = theme === 'estate' ? 0x151520 : 0x1e1e2f;
        let floorCol = theme === 'estate' ? 0x0a0a10 : 0x0f0f1a;
        let lightCol = 0xfef08a;
        let beamAlpha = 0.20;
        let ceilingLightA = 0.6;
        
        this.drawNegativeSpaceWall(gfx, wallCol, x, y, w, h, isCeo, windowX, windowW, theme);
        
        gfx.beginFill(floorCol); 
        gfx.drawRect(x, y + h - 8, w, 8); 
        gfx.endFill(); 
        
        gfx.lineStyle(1, 0x000000, 0.15);
        for(let i = x; i < x + w; i += 20) { 
            if (theme !== 'estate' && i > windowX && i < windowX + windowW) {
                let offset = i - windowX;
                if (offset % 60 < 40) continue; 
            }
            gfx.moveTo(i, y); 
            gfx.lineTo(i, y + h - 8); 
        }
        gfx.lineStyle(0);
        
        gfx.beginFill(0x222233); 
        gfx.drawRect(x, y, w, 4); 
        gfx.endFill(); 
        
        const lightZones = theme === 'estate' ? 4 : 2; 
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

    drawServerRack(c, x, y, col) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0x11111a); 
        g.drawRect(x-10, y-30, 20, 30); 
        g.endFill(); 
        
        g.beginFill(0x222233); 
        for(let sy=y-26; sy<y-4; sy+=6) g.drawRect(x-8, sy, 16, 4); 
        
        g.beginFill(col); 
        for(let sy=y-25; sy<y-4; sy+=6) { 
            g.drawCircle(x-5, sy+1, 1); 
            g.drawCircle(x-1, sy+1, 1); 
        } 
        g.endFill(); 
        c.addChild(g); 
        
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.8);
        for(let sy=y-25; sy<y-4; sy+=6) { 
            glow.drawCircle(x-5, sy+1, 1.5); 
            glow.drawCircle(x-1, sy+1, 1.5); 
        }
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 1.0, type: 'server' });
    },

    drawLiquidCooledServer(c, x, y) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        g.beginFill(0x11111a); 
        g.drawRect(x-15, y-40, 30, 40); 
        g.endFill();
        
        g.beginFill(0x222233); 
        g.drawRect(x-12, y-38, 24, 36); 
        g.endFill();
        
        g.beginFill(0x06b6d4); 
        g.drawRect(x-8, y-36, 4, 32); 
        g.drawRect(x+4, y-36, 4, 32); 
        g.endFill();
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0x06b6d4, 0.4); 
        glow.drawRect(x-8, y-36, 4, 32); 
        glow.drawRect(x+4, y-36, 4, 32); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; 
        c.addChild(g, glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'server' });
    },

    drawReceptionDesk(c, x, y, col) { 
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none'; 
        g.beginFill(0x2a2a3e); 
        g.drawRect(x-10, y-22, 40, 22); 
        g.endFill(); 
        g.beginFill(col, 0.8); 
        g.drawRect(x-12, y-22, 44, 4); 
        g.endFill(); 
        g.beginFill(0x11111a); 
        g.drawRect(x+5, y-32, 6, 10); 
        g.endFill(); 
        g.beginFill(0x22d3ee); 
        g.drawRect(x+4, y-31, 2, 8); 
        g.endFill(); 
        c.addChild(g); 
    },
    
    drawCouches(c, x, y, colHex) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(colHex, 0.3); 
        g.drawRect(x-20, y-10, 40, 10); 
        g.beginFill(0x333333); 
        g.drawRect(x-24, y-16, 6, 16); 
        g.drawRect(x+18, y-16, 6, 16); 
        g.drawRect(x-20, y-20, 40, 10); 
        g.endFill(); 
        c.addChild(g); 
    },

    drawWaterCooler(c, x, y) { 
        const g = new PIXI.Graphics(); 
        g.beginFill(0xdddddd); 
        g.drawRect(x-5, y-18, 10, 18); 
        g.endFill(); 
        g.beginFill(0x3b82f6, 0.6); 
        g.drawRoundedRect(x-4, y-32, 8, 14, 2); 
        g.endFill(); 
        g.beginFill(0x11111a); 
        g.drawRect(x-3, y-14, 6, 4); 
        g.endFill(); 
        g.beginFill(0xff3333); 
        g.drawRect(x-3, y-17, 2, 2); 
        g.beginFill(0x3b82f6); 
        g.drawRect(x+1, y-17, 2, 2); 
        g.endFill(); 
        c.addChild(g); 
    },

    drawShower(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        if (style === 1 || style === 3) { 
            g.beginFill(0x1e293b); g.drawRect(x - 14, y - 4, 28, 4); g.endFill(); 
            g.beginFill(0x0ea5e9, 0.15); g.lineStyle(1, 0xcbd5e1, 0.3); g.drawRect(x - 14, y - 40, 28, 40); g.lineStyle(0); 
            g.beginFill(0x94a3b8); g.drawRect(x - 4, y - 40, 8, 3); g.endFill(); 
            g.beginFill(0x38bdf8, 0.4); g.drawRect(x - 2, y - 37, 4, 25); g.endFill(); 
        } else { 
            g.beginFill(0xf8fafc); g.drawRect(x - 18, y - 10, 36, 10); g.endFill(); 
            g.beginFill(0xe2e8f0); g.drawRect(x - 16, y - 40, 32, 2); g.endFill(); 
            g.beginFill(0x38bdf8, 0.2); g.drawRect(x - 16, y - 38, 16, 28); g.endFill(); 
            g.beginFill(0x94a3b8); g.drawRect(x + 10, y - 30, 4, 4); g.endFill(); 
        }
        c.addChild(g);
    },

    drawKitchen(c, x, y, region, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x475569); g.drawRect(x - 25, y - 40, 14, 40); g.endFill(); 
        g.beginFill(0x94a3b8); g.drawRect(x - 23, y - 20, 2, 10); g.drawRect(x - 23, y - 35, 2, 10); g.endFill(); 
        
        const counterCol = (style === 1 || style === 4) ? 0x1e293b : 0xb45309; 
        const topCol = (style === 1 || style === 4) ? 0xf1f5f9 : 0x0f172a; 
        
        g.beginFill(counterCol); g.drawRect(x - 10, y - 18, 35, 18); g.endFill(); 
        g.beginFill(topCol); g.drawRect(x - 12, y - 18, 39, 3); g.endFill(); 
        
        g.beginFill(0x0ea5e9); g.drawRect(x - 5, y - 18, 10, 2); g.endFill(); 
        g.beginFill(0x64748b); g.drawRect(x - 1, y - 22, 2, 4); g.endFill(); 
        
        g.beginFill(0x111111); g.drawRect(x + 10, y - 18, 12, 2); g.endFill(); 
        g.beginFill(0xef4444); g.drawCircle(x + 13, y - 17, 1); g.drawCircle(x + 19, y - 17, 1); g.endFill(); 
        
        if (style === 2 || style === 3) {
            g.beginFill(counterCol); g.drawRect(x - 10, y - 40, 35, 10); g.endFill(); 
        } else {
            g.beginFill(0x64748b); g.drawRect(x + 10, y - 35, 12, 4); g.endFill(); 
        }
        c.addChild(g);
    },

    drawBed(c, x, y, region, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const frameCol = (style === 1 || style === 4) ? 0x334155 : 0x78350f;
        const duvetCol = style === 1 ? 0x3b82f6 : (style === 2 ? 0x10b981 : (style === 3 ? 0xf43f5e : 0xa855f7));
        
        g.beginFill(frameCol); g.drawRect(x - 22, y - 18, 6, 18); g.endFill();
        g.beginFill(frameCol); g.drawRect(x - 18, y - 6, 38, 6); g.endFill();
        g.beginFill(0xf1f5f9); g.drawRect(x - 16, y - 10, 34, 4); g.endFill();
        g.beginFill(duvetCol); g.drawRect(x - 2, y - 11, 20, 6); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x - 15, y - 12, 6, 4); g.drawRect(x - 8, y - 12, 6, 4); g.endFill();
        
        c.addChild(g);
    },

    drawPottedPlant(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const potCol = (style === 1 || style === 3) ? 0xffedd5 : 0xc2410c; 
        
        g.beginFill(potCol); 
        g.drawPolygon([x - 4, y - 6, x + 4, y - 6, x + 3, y, x - 3, y]); 
        g.endFill();
        
        g.beginFill(0x22c55e); 
        if (style === 1 || style === 4) { 
            g.drawCircle(x, y - 10, 5); 
            g.drawCircle(x - 4, y - 8, 4); 
            g.drawCircle(x + 4, y - 8, 4);
        } else { 
            g.drawPolygon([x - 2, y - 6, x - 4, y - 18, x, y - 6]);
            g.drawPolygon([x, y - 6, x + 1, y - 20, x + 2, y - 6]);
            g.drawPolygon([x + 2, y - 6, x + 5, y - 15, x + 4, y - 6]);
        }
        g.endFill();
        c.addChild(g);
    },

    drawGeckoTerrarium(c, x, y) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x33334a); 
        g.drawRect(x-12, y-8, 24, 8); 
        g.endFill(); 
        
        g.beginFill(0x111111, 0.5); 
        g.drawRect(x-10, y-20, 20, 12); 
        g.endFill(); 
        
        g.lineStyle(1, 0xffffff, 0.2); 
        g.drawRect(x-10, y-20, 20, 12); 
        g.lineStyle(0);
        
        g.beginFill(0x22c55e); 
        g.drawCircle(x-5, y-12, 3); 
        g.drawCircle(x+4, y-14, 2); 
        g.endFill(); 
        
        g.beginFill(0xfacc15); 
        g.drawRect(x-1, y-10, 2, 1); 
        g.endFill(); 
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.2); 
        glow.drawRect(x-10, y-20, 20, 12); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD; 
        c.addChild(g, glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.3, type: 'ceiling' });
    },

    drawLivingArea(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        const sofaCol = (style === 1 || style === 3) ? 0x6366f1 : 0x8b5cf6;
        
        g.beginFill(sofaCol); 
        g.drawRect(x - 15, y - 12, 30, 8); 
        g.beginFill(sofaCol - 0x111111); 
        g.drawRect(x - 15, y - 6, 30, 6); 
        g.beginFill(0x333333); 
        g.drawRect(x - 16, y - 10, 4, 10); 
        g.drawRect(x + 12, y - 10, 4, 10); 
        g.endFill();
        
        g.beginFill(0xd97706); g.drawRect(x - 8, y - 2, 16, 2); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x - 7, y, 2, 2); g.drawRect(x + 5, y, 2, 2); g.endFill();
        
        const tvX = x + 25;
        g.beginFill(0x1e293b); g.drawRect(tvX - 10, y - 6, 20, 6); g.endFill(); 
        g.beginFill(0x0f172a); g.drawRect(tvX - 8, y - 20, 16, 10); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(tvX - 7, y - 19, 14, 8); g.endFill(); 
        c.addChild(g);
        
        const tvGlow = new PIXI.Graphics();
        tvGlow.beginFill(0x22d3ee, 0.3); 
        tvGlow.drawRect(tvX - 7, y - 19, 14, 8); 
        tvGlow.endFill();
        tvGlow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(tvGlow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: tvGlow, maxA: 0.5, type: 'screen' });
    },

    drawNightstand(c, x, y, style = 1) {
        const g = new PIXI.Graphics(); 
        g.eventMode = 'none';
        
        g.beginFill(0x475569); g.drawRect(x - 5, y - 8, 10, 8); g.endFill(); 
        g.beginFill(0x1e293b); g.drawRect(x - 4, y - 6, 8, 2); g.endFill(); 
        
        g.beginFill(0x94a3b8); g.drawRect(x - 1, y - 12, 2, 4); g.endFill(); 
        g.beginFill(0xfef08a); g.drawPolygon([x - 3, y - 12, x + 3, y - 12, x + 2, y - 16, x - 2, y - 16]); g.endFill(); 
        c.addChild(g);
        
        const glow = new PIXI.Graphics();
        glow.beginFill(0xfacc15, 0.4); 
        glow.drawCircle(x, y - 12, 15); 
        glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(glow);
        
        if (!this.indoorLights) this.indoorLights = [];
        this.indoorLights.push({ g: glow, maxA: 0.6, type: 'ceiling' }); 
    },

    // ─── NEW ESTATE EXCLUSIVE PROPS ───
    drawGrandPiano(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111111); 
        g.drawRect(x-20, y-15, 40, 10); 
        g.drawRect(x-18, y-5, 4, 5); 
        g.drawRect(x+14, y-5, 4, 5); 
        g.endFill();
        g.beginFill(0xffffff); 
        for(let i=0; i<10; i++) g.drawRect(x-18 + i*4, y-15, 3, 2); 
        g.endFill();
        c.addChild(g);
    },

    drawLuxuryBed(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-30, y-20, 6, 20); g.endFill();
        g.beginFill(0x2a2a42); g.drawRect(x-24, y-10, 48, 10); g.endFill();
        g.beginFill(col); g.drawRect(x-10, y-12, 34, 8); g.endFill();
        g.beginFill(0xffffff); g.drawRect(x-22, y-14, 8, 5); g.drawRect(x-12, y-14, 8, 5); g.endFill();
        c.addChild(g);
    },

    drawBossDesk(c, x, y, col) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,50,18); g.endFill(); 
        g.beginFill(col); g.drawRect(x-8,y-18,56,5); g.endFill(); 
        g.beginFill(0x11111a); g.drawRect(x+10,y-30,6,12); g.drawRect(x+20,y-30,6,12); g.endFill(); 
        g.beginFill(0x22d3ee); g.drawRect(x+9,y-29,2,10); g.drawRect(x+19,y-29,2,10); g.endFill(); 
        c.addChild(g); 
    },

    drawChair(c, x, y) { 
        const g = new PIXI.Graphics(); g.eventMode = 'none'; 
        g.beginFill(0x1a1a2e); g.drawRect(x-5,y-18,4,12); g.drawRect(x-5,y-8,12,3); 
        g.beginFill(0x33334a); g.drawRect(x+1,y-5,2,3); g.drawRect(x-3,y-2,10,2); g.endFill(); 
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

    drawRing(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x-40, y-10, 80, 10); g.endFill(); 
        g.beginFill(0x4ade80, 0.4); g.drawRect(x-40, y-10, 80, 2); g.endFill(); 
        g.beginFill(0x33334a); g.drawRect(x-40, y-30, 4, 20); g.drawRect(x+36, y-30, 4, 20); g.endFill(); 
        g.beginFill(0xef4444); g.drawRect(x-40, y-25, 80, 2); g.endFill(); 
        g.beginFill(0xffffff); g.drawRect(x-40, y-15, 80, 2); g.endFill(); 
        c.addChild(g);
    }
};

class ResElevator {
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
