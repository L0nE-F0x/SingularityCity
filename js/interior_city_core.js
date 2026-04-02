/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY CORE (v15.8.0 - Forest Campsite & Avatar State Expansion)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCity = {
    ...InteriorCityProps,
    ...InteriorCityAI,
    
    layer: null,
    scene: null,
    skyContainer: null,
    celestialGfx: null,
    starsLayer: null,
    bld: null,
    indoorLights: [],
    
    avatars: [],
    bubbles: [],
    floors: {},
    elevators: [],
    ceoCarGfx: null,
    
    bldTickerSym: null,
    tickerTxt: null,
    tickerW: 0,
    
    bldW: 0,
    startX: 0,
    usableW: 0,
    
    isDragging: false,
    startY: 0,
    startSceneY: 0,
    minY: 0,
    maxY: 0,
    totalH: 0,

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.layer.removeChildren();
        this.avatars = [];
        this.bubbles = [];
        this.floors = {};
        this.elevators = [];
        this.indoorLights = [];
        this.ceoCarGfx = null;
        this.bldTickerSym = null;
        this.tickerTxt = null;
        
        const lab = LABS[bld.lab] || LABS['other'] || { name: bld.name || 'Public', color: '#64748b', icon: '🏢', ticker: null, desc: '' };
        const colHex = parseInt(lab.color.slice(1), 16);
        const isHQ = !!bld.lab; 
        const isForest = bld.id === 'forest_0' || bld.id === 'forest_1' || bld.id === 'forest_space';
        const isSiliconWoods = bld.id === 'forest_1';
        const isFrontierPines = bld.id === 'forest_space';
        
        this.skyContainer = new PIXI.Container();
        this.layer.addChild(this.skyContainer);
        
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 100; i++) { 
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff); 
            s.drawCircle(0, 0, .5 + Math.random() * 1.5); 
            s.endFill(); 
            s.x = Math.random() * G.vpW; 
            s.y = Math.random() * G.vpH * .5; 
            s._phase = Math.random() * Math.PI * 2; 
            this.starsLayer.addChild(s); 
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        
        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);
        
        const activeModels = G.models.filter(m => m.lab === bld.lab && (!m.ret || new Date(m.ret) > new Date()));
        
        let numFloors = 1;
        if (isHQ) {
            numFloors = Math.max(3, bld.dynamicFl || 3);
        } else if (bld.id === 'gym' || bld.id === 'arena') {
            numFloors = 3;
        } else {
            numFloors = bld.fl || 1;
        }

        const floorH = 80; 
        const roofH = 80; 
        
        this.totalH = roofH + (numFloors + 1) * floorH; 
        
        const voidMask = new PIXI.Graphics();
        if (isForest) {
            // Earth connects directly below the ground strip where props sit
            // For forests: fy = roofH, ground at fy + floorH - 4, grass at fy + floorH - 8
            const grassY = roofH + floorH - 4;
            voidMask.beginFill(0x1a1510);
            voidMask.drawRect(0, grassY + 4, G.vpW, 40);
            voidMask.endFill();
            voidMask.beginFill(0x2d1f0f);
            voidMask.drawRect(0, grassY + 20, G.vpW, 200);
            voidMask.endFill();
        } else {
            voidMask.beginFill(0x05050a);
            voidMask.drawRect(0, this.totalH, G.vpW, 2000); 
            voidMask.endFill();
        }
        this.scene.addChild(voidMask);

        this.bldW = (isHQ || isForest) ? G.vpW : Math.min(G.vpW, 800);
        this.startX = (G.vpW - this.bldW) / 2;
        
        const shaftW = 60;
        const shaftX = this.startX + this.bldW - shaftW - 20;
        this.usableW = this.bldW - shaftW - 20;
        
        const windowX = this.startX + 60; 
        const windowW = this.usableW - 120;

        const bldBg = new PIXI.Graphics();
        
        if (!isForest) {
            bldBg.beginFill(0x2a2a42);
            bldBg.drawRect(this.startX, roofH - 4, this.bldW, 4);
            bldBg.endFill();
            
            for (let f = -1; f < numFloors; f++) {
                const fy = roofH + (numFloors - 1 - f) * floorH;
                
                if (f === -1) {
                    bldBg.beginFill(0x0a0a10);
                    bldBg.drawRect(0, fy, G.vpW, floorH);
                    bldBg.endFill();
                    
                    bldBg.beginFill(0x121220);
                    bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                    bldBg.endFill();
                } else {
                    const isCeo = isHQ && (f === numFloors - 1);
                    if (['arena', 'graveyard', 'legacy'].includes(bld.id)) {
                        bldBg.beginFill(0x111115);
                        bldBg.drawRect(this.startX, fy, this.bldW, floorH);
                        bldBg.endFill();
                    } else {
                        this.drawNegativeSpaceWall(bldBg, 0x121220, this.startX, fy, this.bldW, floorH, isCeo, windowX, windowW);
                    }
                }
            }
            this.scene.addChild(bldBg);
        }
        
        const groundLine = new PIXI.Graphics();
        groundLine.beginFill(0x11111a);
        groundLine.drawRect(0, this.totalH - floorH, G.vpW, 4);
        groundLine.endFill();
        this.scene.addChild(groundLine);

        const middleFloorsCount = numFloors - 2;
        const modelsPerFloor = Math.ceil(activeModels.length / Math.max(1, middleFloorsCount));
        
        if (!isForest) {
            this.drawRoof(roofH, this.startX, this.usableW, colHex, lab, bld);
        }
        
        const visitingModels = G.models.filter(m => {
            const refs = G.charRefs[m.id];
            return refs && refs.bld === bld.id && !activeModels.find(am => am.id === m.id);
        });
        const visitorsPerFloor = Math.ceil(visitingModels.length / Math.max(1, numFloors));
        
        for (let f = (isForest ? 0 : -1); f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH; 
            const isCeo = isHQ && (f === numFloors - 1);
            const isBasement = f === -1;
            
            let floorTheme = 'general';
            if (isForest) {
                floorTheme = isSiliconWoods ? 'silicon_woods' : isFrontierPines ? 'launch_viewing' : 'campsite';
            } else if (bld.id === 'gym') {
                const gymThemes = ['gym_cardio', 'gym_weights', 'gym_combat'];
                floorTheme = gymThemes[f % 3];
            } else if (bld.id === 'arena') {
                const arenaThemes = ['arena_lobby', 'arena_training', 'arena_main'];
                floorTheme = arenaThemes[f % 3];
            } else if (bld.id === 'cafe') {
                floorTheme = 'cafe';
            } else if (bld.id === 'neon_bar') {
                const barThemes = ['bar_lounge', 'bar_karaoke', 'bar_vip'];
                floorTheme = barThemes[f % 3];
            } else if (f === 1) floorTheme = 'arcade';
            else if (f === 2) floorTheme = 'server_core';
            else if (f === 3 && !isCeo) floorTheme = 'zen_garden';
            else if (f > 3 && !isCeo) {
                const themes = ['general', 'arcade', 'server_core', 'zen_garden'];
                floorTheme = themes[f % 4];
            }
            
            this.floors[f] = { y: fy + floorH - 4, elevatorX: shaftX + 15, breakSpots: [] };
            
            const roomGfx = new PIXI.Graphics();
            if (['arena', 'graveyard', 'legacy'].includes(bld.id)) {
                roomGfx.beginFill(0x111115); 
                roomGfx.drawRect(this.startX, fy, this.usableW, floorH); 
                roomGfx.endFill();
                roomGfx.beginFill(0x0a0a0f); 
                roomGfx.drawRect(this.startX, fy + floorH - 8, this.usableW, 8); 
                roomGfx.endFill();
            } else if (!isBasement && !isForest) {
                this.drawRoomInterior(roomGfx, this.startX, fy, this.usableW, floorH, colHex, isCeo, windowX, windowW, floorTheme);
            } else if (isForest) {
                // Forests are OUTDOORS — no walls, no ceiling, just ground.
                // The CSS sky gradient on the viewport shows through the transparent canvas.
                
                const groundY = fy + floorH - 8;
                // Dark soil base (connects to void earth below)
                roomGfx.beginFill(0x1a1510); 
                roomGfx.drawRect(0, groundY + 4, G.vpW, 200); 
                roomGfx.endFill();
                // Grass surface
                roomGfx.beginFill(0x1b4332); 
                roomGfx.drawRect(0, groundY, G.vpW, 6); 
                roomGfx.endFill();
                roomGfx.beginFill(0x2d6a4f); 
                roomGfx.drawRect(0, groundY, G.vpW, 3); 
                roomGfx.endFill();
            }
            this.scene.addChild(roomGfx);
            
            if (!isForest) {
                const floorLine = new PIXI.Graphics();
                floorLine.beginFill(0x2a2a42); 
                floorLine.drawRect(this.startX, fy + floorH - 4, this.bldW, 4); 
                floorLine.endFill();
                this.scene.addChild(floorLine);
            }
            
            if (isBasement) {
                const door = new PIXI.Graphics();
                door.beginFill(0x33334a); 
                door.lineStyle(1, 0x1e1e32);
                door.drawRect(shaftX + 15, fy + floorH - 44, 30, 40);
                door.moveTo(shaftX + 30, fy + floorH - 44); 
                door.lineTo(shaftX + 30, fy + floorH - 4); 
                door.endFill();
                door.beginFill(0x1e1e32); 
                door.drawRect(shaftX + 5, fy + floorH - 25, 4, 8);
                if (Math.random() > 0.5) { 
                    door.beginFill(0x4ade80); 
                    door.drawCircle(shaftX + 7, fy + floorH - 23, 1); 
                }
                door.endFill();
                this.scene.addChild(door);
            }
            
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;
            this.scene.addChild(floorCont);
            
            if (f >= 0 && !isForest && !['arena', 'graveyard', 'legacy'].includes(bld.id)) {
                const winFrame = new PIXI.Graphics();
                winFrame.beginFill(0xffffff, 0.03); 
                winFrame.lineStyle(4, 0x33334a); 
                
                if (isCeo) {
                    winFrame.drawRect(windowX, fy + 15, windowW, 45); 
                    for(let w = windowX + 60; w < windowX + windowW; w += 60) { 
                        winFrame.moveTo(w, fy + 15); 
                        winFrame.lineTo(w, fy + 60); 
                    }
                } else {
                    let currX = windowX;
                    while (currX + 40 <= windowX + windowW) {
                        winFrame.drawRect(currX, fy + 25, 40, 30);
                        currX += 60;
                    }
                }
                winFrame.lineStyle(0); 
                winFrame.endFill();
                floorCont.addChild(winFrame);
            }
            
            if (isBasement) {
                const parkingLines = new PIXI.Graphics();
                parkingLines.lineStyle(2, 0xffffff, 0.4);
                parkingLines.moveTo(this.startX + 150, fy + floorH - 4); 
                parkingLines.lineTo(this.startX + 120, fy + floorH - 14);
                parkingLines.moveTo(this.startX + 250, fy + floorH - 4); 
                parkingLines.lineTo(this.startX + 220, fy + floorH - 14);
                floorCont.addChild(parkingLines);
                
                if (isHQ && G.ceoRefs && G.ceoRefs[bld.lab]) {
                    const ceoRef = G.ceoRefs[bld.lab];
                    this.ceoCarGfx = this.drawCar(floorCont, this.startX + 180, fy + floorH - 4, colHex);
                    this.ceoCarGfx.visible = (ceoRef.bld === bld.id);
                }
                
            } else if (f >= 0) {
                let currX = this.startX + 80;
                
                const _dpNow = G.getDayPhase();
                const _isNightShift = _dpNow > 0.83 || _dpNow < 0.25;
                if (isHQ && f === 0) {
                    this.drawCouches(floorCont, this.startX + this.usableW - 80, fy + floorH - 4, colHex);
                    this.drawChair(floorCont, this.startX + 80, fy + floorH - 4);
                    if (!_isNightShift) this.drawAvatar({ id: 'rec', name: 'Front Desk', isNPC: true, role: 'Receptionist', phase: 'released', lab: bld.lab, desc: 'Directing packets.' }, this.startX + 95, fy + floorH - 4, floorCont, f, true);
                    this.drawReceptionDesk(floorCont, this.startX + 110, fy + floorH - 4, colHex);
                    this.drawPlant(floorCont, this.startX + 220, fy + floorH - 4);
                } 
                else if (isHQ && isCeo) {
                    const sorted = [...G.models].filter(m => !m.ret || new Date(m.ret) > new Date()).map(m => { const elo = BM[m.id]?.ELO || 0; return { m, elo }; }).sort((a, b) => b.elo - a.elo);
                    const topLabId = sorted[0]?.m.lab;
                    
                    this.drawTrophy(floorCont, this.startX + 60, fy + floorH - 4, bld.lab === topLabId); 
                    this.drawExecutiveLounge(floorCont, this.startX + 120, fy + floorH - 4, colHex); 
                    this.drawCommandCenter(floorCont, this.startX + this.usableW - 100, fy + floorH - 4, colHex); 
                    this.drawPrivateOasis(floorCont, this.startX + this.usableW - 40, fy + floorH - 4);
                    
                    this.drawChair(floorCont, this.startX + this.usableW / 2 - 25, fy + floorH - 4);
                    this.drawBossDesk(floorCont, this.startX + this.usableW / 2 + 10, fy + floorH - 4, colHex);
                    
                    if (G.ceoRefs && G.ceoRefs[bld.lab]) {
                        const ceoRef = G.ceoRefs[bld.lab];
                        if (ceoRef.bld === bld.id) {
                            const ceoModel = { id: 'ceo_'+bld.lab, name: ceoRef.f.name, lab: bld.lab, phase: 'released', isCeo: true, founderData: ceoRef.f };
                            
                            if (ceoRef.wantsToEnter) {
                                let av = this.drawAvatar(ceoModel, this.startX + 180, this.totalH - 4, floorCont, -1, false, true);
                                av.state = 'ceo_entering';
                                av.targetX = shaftX + 15;
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            } else if (ceoRef.wantsToLeave) {
                                let av = this.drawAvatar(ceoModel, this.startX + this.usableW / 2 - 10, fy + floorH - 4, floorCont, f, false, true);
                                av.state = 'ceo_leaving';
                                av.targetX = shaftX + 15;
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            } else {
                                let av = this.drawAvatar(ceoModel, this.startX + this.usableW / 2 - 10, fy + floorH - 4, floorCont, f, false, true);
                                av.state = 'ceo_working';
                                av.deskX = this.startX + this.usableW / 2 - 10;
                            }
                        }
                    }
                }
                else if (isHQ) {
                    if (floorTheme === 'arcade') {
                        while (currX < this.startX + this.usableW - 120) {
                            let r = Math.random();
                            if (r < 0.33) {
                                this.drawArcadeCabinet(floorCont, currX + 15, fy + floorH - 4); 
                            } else if (r < 0.66) {
                                this.drawBeanbagAndHandheld(floorCont, currX + 15, fy + floorH - 4); 
                            } else {
                                this.drawPingPongTable(floorCont, currX + 20, fy + floorH - 4);
                            }
                            currX += 50;
                        }
                    } else if (floorTheme === 'server_core') {
                        while (currX < this.startX + this.usableW - 120) { 
                            this.drawLiquidCooledServer(floorCont, currX + 20, fy + floorH - 4); 
                            currX += 60; 
                        }
                    } else if (floorTheme === 'zen_garden') {
                        while (currX < this.startX + this.usableW - 120) {
                            let r = Math.random(); 
                            if (r < 0.4) {
                                this.drawIndoorPool(floorCont, currX + 25, fy + floorH - 4); 
                            } else if (r < 0.7) {
                                this.drawGeckoTerrarium(floorCont, currX + 20, fy + floorH - 4); 
                            } else {
                                this.drawBiophilicDivider(floorCont, currX + 20, fy + floorH - 4);
                            }
                            currX += 50;
                        }
                    } else {
                        if (f === 1) { 
                            this.drawCanteen(floorCont, this.startX + this.usableW - 40, fy + floorH - 4); 
                            this.floors[f].breakSpots.push(this.startX + this.usableW - 50); 
                        } else if (f % 2 === 0) { 
                            this.drawWaterCooler(floorCont, this.startX + 40, fy + floorH - 4); 
                            this.floors[f].breakSpots.push(this.startX + 50); 
                        } else {
                            this.drawServerRack(floorCont, this.startX + this.usableW - 40, fy + floorH - 4, colHex); 
                        }
                        
                        while (currX < this.startX + this.usableW - 130) {
                            let r = Math.random();
                            if (r < 0.55) { 
                                this.drawChair(floorCont, currX + 10, fy + floorH - 4); 
                                this.drawDeskAndPC(floorCont, currX + 34, fy + floorH - 4, colHex); 
                                currX += 55; 
                            } else if (r < 0.70) { 
                                this.drawCollaborationPod(floorCont, currX + 25, fy + floorH - 4, colHex); 
                                this.floors[f].breakSpots.push(currX + 25); 
                                currX += 50; 
                            } else if (r < 0.85) { 
                                this.drawLoungeNook(floorCont, currX + 30, fy + floorH - 4, colHex); 
                                this.floors[f].breakSpots.push(currX + 30); 
                                currX += 60; 
                            } else { 
                                this.drawBiophilicDivider(floorCont, currX + 15, fy + floorH - 4); 
                                currX += 30; 
                            }
                        }
                    }

                    const startIndex = (f - 1) * modelsPerFloor;
                    const floorModelsQueue = activeModels.slice(startIndex, startIndex + modelsPerFloor);
                    floorModelsQueue.forEach((m, idx) => {
                        const refs = G.charRefs[m.id];
                        if (refs && refs.bld === bld.id) {
                            let deskX = this.startX + 80 + (idx * 40);
                            let av = this.drawAvatar(m, deskX, fy + floorH - 4, floorCont, f, false);
                            av.jobTheme = floorTheme; 
                            av.deskX = deskX;
                            av.floorY = fy + floorH - 4; 

                            if (refs.wantsToEnter) { 
                                av.state = 'entering_lobby'; 
                                av.cont.x = this.startX + this.usableW / 2; 
                                av.cont.y = this.totalH - 80 - 4; 
                            } else if (refs.wantsToLeave) { 
                                av.state = 'walking_to_elevator_down'; 
                                av.targetX = this.floors[f].elevatorX; 
                            } else {
                                av.state = 'working';
                            }
                        }
                    });
                }
                else {
                    if (floorTheme === 'campsite') {
                        this.drawLake(floorCont, this.startX + this.bldW - 150, fy + floorH - 4);
                        
                        let campX = this.startX + 50;
                        while(campX < this.startX + this.bldW - 250) {
                            let r = Math.random();
                            if (r < 0.3) {
                                this.drawTent(floorCont, campX, fy + floorH - 4, 0xef4444);
                                this.drawCampfire(floorCont, campX + 45, fy + floorH - 4);
                                campX += 90;
                            } else if (r < 0.6) {
                                this.drawPicnicTable(floorCont, campX, fy + floorH - 4);
                                campX += 80;
                            } else {
                                this.drawTree(floorCont, campX, fy + floorH - 4);
                                campX += 60;
                            }
                        }
                    } else if (floorTheme === 'silicon_woods') {
                        // ── Silicon Woods: Billionaire CEO Retreat ──
                        // Left zone: Helipad + Starlink
                        this.drawHelipad(floorCont, this.startX + 80, fy + floorH - 4);
                        this.drawStarlinkDish(floorCont, this.startX + 140, fy + floorH - 4);
                        
                        // Center-left: Zen garden + Redwoods with fairy lights
                        this.drawZenGardenProp(floorCont, this.startX + 220, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + 290, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + 340, fy + floorH - 4);
                        
                        // Center: Fire pit lounge (the social hub)
                        this.drawFirePitLounge(floorCont, this.startX + this.bldW / 2, fy + floorH - 4);
                        
                        // Center-right: Whiskey bar + Putting green
                        this.drawWhiskeyBar(floorCont, this.startX + this.bldW / 2 + 120, fy + floorH - 4);
                        this.drawPuttingGreen(floorCont, this.startX + this.bldW / 2 + 220, fy + floorH - 4);
                        
                        // Right zone: Glamping domes + Hot tub
                        this.drawGlampingDome(floorCont, this.startX + this.bldW - 200, fy + floorH - 4);
                        this.drawGlampingDome(floorCont, this.startX + this.bldW - 140, fy + floorH - 4);
                        this.drawInfinityHotTub(floorCont, this.startX + this.bldW - 80, fy + floorH - 4);
                        
                        // More luxury redwoods scattered
                        this.drawLuxuryRedwood(floorCont, this.startX + this.bldW / 2 - 80, fy + floorH - 4);
                        this.drawLuxuryRedwood(floorCont, this.startX + this.bldW - 260, fy + floorH - 4);
                        
                        // NPC: Concierge
                        this.drawAvatar({ id: 'concierge', name: 'Concierge', isNPC: true, role: 'Concierge', phase: 'released', lab: 'other', desc: 'At your service.' }, this.startX + 160, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'launch_viewing') {
                        // ── Frontier Pines: Rocket Launch Viewing Area ──
                        // Left zone: Countdown board + Binoculars
                        this.drawCountdownBoard(floorCont, this.startX + 60, fy + floorH - 4);
                        this.drawBinoculars(floorCont, this.startX + 120, fy + floorH - 4);
                        
                        // Left-center: Viewing platform with telescopes
                        this.drawViewingPlatform(floorCont, this.startX + 170, fy + floorH - 4, 100);
                        this.drawTelescope(floorCont, this.startX + 200, fy + floorH - 8);
                        this.drawTelescope(floorCont, this.startX + 240, fy + floorH - 8);
                        
                        // Center: Refreshment stands + blanket areas
                        this.drawRefreshmentStand(floorCont, this.startX + this.bldW / 2 - 60, fy + floorH - 4);
                        this.drawBlanketArea(floorCont, this.startX + this.bldW / 2, fy + floorH - 4);
                        this.drawBlanketArea(floorCont, this.startX + this.bldW / 2 + 50, fy + floorH - 4);
                        
                        // Right-center: Second viewing platform + binoculars
                        this.drawViewingPlatform(floorCont, this.startX + this.bldW / 2 + 100, fy + floorH - 4, 80);
                        this.drawBinoculars(floorCont, this.startX + this.bldW / 2 + 130, fy + floorH - 8);
                        this.drawTelescope(floorCont, this.startX + this.bldW / 2 + 160, fy + floorH - 8);
                        
                        // Right zone: More snacks + countdown board
                        this.drawRefreshmentStand(floorCont, this.startX + this.bldW - 180, fy + floorH - 4);
                        this.drawCountdownBoard(floorCont, this.startX + this.bldW - 100, fy + floorH - 4);
                        
                        // Frontier pines scattered
                        this.drawFrontierPine(floorCont, this.startX + 30, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + 300, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + this.bldW / 2 + 80, fy + floorH - 4);
                        this.drawFrontierPine(floorCont, this.startX + this.bldW - 50, fy + floorH - 4);
                        
                        // NPC: Park Ranger
                        this.drawAvatar({ id: 'ranger', name: 'Park Ranger', isNPC: true, role: 'Ranger', phase: 'released', lab: 'other', desc: 'Ensuring safe viewing distances.' }, this.startX + 140, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'gym_cardio') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawTreadmill) this.drawTreadmill(floorCont, currX, fy + floorH - 4);
                            currX += 80;
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 60, fy + floorH - 4);
                    } else if (floorTheme === 'gym_weights') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (Math.random() > 0.5) {
                                if (this.drawServerWeights) this.drawServerWeights(floorCont, currX, fy + floorH - 4);
                            } else {
                                if (this.drawWeightBench) this.drawWeightBench(floorCont, currX, fy + floorH - 4);
                            }
                            currX += 90;
                        }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'gym_combat') {
                        if (this.drawRing) this.drawRing(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        while(currX < this.startX + this.usableW * 0.3) {
                            if (this.drawPunchingBag) this.drawPunchingBag(floorCont, currX, fy + floorH - 4);
                            currX += 100;
                        }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'trainer', name: 'Spotter', isNPC: true, role: 'Trainer', phase: 'released', lab: 'other', desc: 'Heavy lifting.' }, this.startX + this.usableW - 80, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'arena_lobby') {
                        this.drawReceptionDesk(floorCont, this.startX + 120, fy + floorH - 4, 0xef4444);
                        this.drawCouches(floorCont, this.startX + 250, fy + floorH - 4, 0xef4444);
                        if (this.drawScoreboard) this.drawScoreboard(floorCont, this.startX + 400, fy + floorH - 4);
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 60, fy + floorH - 4);
                        if (this.drawPlant) this.drawPlant(floorCont, this.startX + 180, fy + floorH - 4);
                    } else if (floorTheme === 'arena_training') {
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawPunchingBag) this.drawPunchingBag(floorCont, currX, fy + floorH - 4);
                            currX += 80;
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'arena_main') {
                        if (this.drawSpotlight) {
                            this.drawSpotlight(floorCont, this.startX + this.usableW * 0.35, fy + floorH - 4, 0xef4444);
                            this.drawSpotlight(floorCont, this.startX + this.usableW * 0.65, fy + floorH - 4, 0x38bdf8);
                        }
                        if (this.drawRing) this.drawRing(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawScoreboard) this.drawScoreboard(floorCont, this.startX + this.usableW - 80, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'ref', name: 'Referee', isNPC: true, role: 'Referee', phase: 'released', lab: 'other', desc: 'Fair fights.' }, this.startX + this.usableW - 120, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'cafe') {
                        if (this.drawMenuBoard) this.drawMenuBoard(floorCont, this.startX + 60, fy + floorH - 4);
                        this.drawBaristaCounter(floorCont, this.startX + this.usableW - 100, fy + floorH - 4);
                        if (this.drawCoffeeMachine) this.drawCoffeeMachine(floorCont, this.startX + this.usableW - 150, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 140, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 250, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 360, fy + floorH - 4);
                        if (this.drawBarStool) { this.drawBarStool(floorCont, this.startX + this.usableW - 130, fy + floorH - 4); this.drawBarStool(floorCont, this.startX + this.usableW - 110, fy + floorH - 4); }
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 100, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 310, fy + floorH - 4); }
                        if (!_isNightShift) this.drawAvatar({ id: 'barista', name: 'BaristaBot', isNPC: true, role: 'Barista', phase: 'released', lab: 'other', desc: 'Brewing Java.' }, this.startX + this.usableW - 90, fy + floorH - 4, floorCont, f, true);
                    } else if (bld.id === 'graveyard' || bld.id === 'legacy') {
                        this.drawBrokenServer(floorCont, this.startX + 120, fy + floorH - 4);
                        this.drawTombstone(floorCont, this.startX + 200, fy + floorH - 4);
                        this.drawBrokenServer(floorCont, this.startX + 280, fy + floorH - 4);
                        this.drawAvatar({ id: 'reaper', name: 'Grim Reaper', isNPC: true, role: 'Sanitation', phase: 'released', lab: 'other', desc: 'Collector of deprecated models.' }, this.startX + this.usableW - 60, fy + floorH - 4, floorCont, f, true);
                    }

                    const floorVisitors = visitingModels.slice(f * visitorsPerFloor, (f + 1) * visitorsPerFloor);
                    floorVisitors.forEach((m) => {
                        const refs = G.charRefs[m.id];
                        let targetState = (bld.id === 'cafe') ? 'chilling' :
                                      (bld.id === 'gym') ? 'working_out' :
                                      (bld.id === 'arena') ? 'fighting' :
                                      (bld.id === 'graveyard' || bld.id === 'legacy') ? 'resting' :
                                      (bld.id === 'open_square' || bld.id === 'os_hub') ? 'collaborating' :
                                      'working';
                                      
                        let rx = this.startX + 80 + Math.random() * (this.usableW - 160);
                        
                        if (floorTheme === 'campsite') {
                            const cr = Math.random();
                            if (cr < 0.3) {
                                rx = this.startX + this.bldW - 200 + Math.random() * 80;
                                targetState = 'fishing';
                            } else if (cr < 0.6) {
                                rx = this.startX + 50 + Math.random() * (this.bldW - 300);
                                targetState = 'camping';
                            } else {
                                rx = this.startX + 50 + Math.random() * (this.bldW - 300);
                                targetState = 'picnicking';
                            }
                        } else if (floorTheme === 'silicon_woods') {
                            const cr = Math.random();
                            if (cr < 0.25) {
                                rx = this.startX + this.bldW / 2 + 100 + Math.random() * 60;
                                targetState = 'sipping_whiskey';
                            } else if (cr < 0.50) {
                                rx = this.startX + this.bldW / 2 + 200 + Math.random() * 40;
                                targetState = 'putting';
                            } else if (cr < 0.75) {
                                rx = this.startX + this.bldW - 100 + Math.random() * 40;
                                targetState = 'soaking_hottub';
                            } else {
                                rx = this.startX + this.bldW / 2 - 20 + Math.random() * 40;
                                targetState = 'stargazing_firepit';
                            }
                        } else if (floorTheme === 'launch_viewing') {
                            const cr = Math.random();
                            if (cr < 0.3) {
                                rx = this.startX + 180 + Math.random() * 80;
                                targetState = 'watching_telescope';
                            } else if (cr < 0.55) {
                                rx = this.startX + this.bldW / 2 - 20 + Math.random() * 80;
                                targetState = 'launch_picnic';
                            } else if (cr < 0.8) {
                                rx = this.startX + this.bldW / 2 + 110 + Math.random() * 60;
                                targetState = 'scanning_sky';
                            } else {
                                rx = this.startX + this.bldW / 2 - 80 + Math.random() * 40;
                                targetState = 'getting_snacks';
                            }
                        }
                        
                        let av = this.drawAvatar(m, rx, fy + floorH - 4, floorCont, f, false);
                        av.jobTheme = floorTheme; 
                        av.deskX = rx; 
                        av.floorY = fy + floorH - 4; 
                        
                        if (refs.wantsToEnter) { 
                            av.state = 'entering_lobby'; 
                            av.cont.x = this.startX + (isForest ? this.bldW / 2 : this.usableW / 2); 
                            av.cont.y = this.totalH - 80 - 4; 
                        } else if (refs.wantsToLeave) { 
                            if (f > 0) {
                                av.state = 'walking_to_elevator_down'; 
                                av.targetX = this.floors[f].elevatorX; 
                            } else {
                                av.state = 'walking_out'; 
                                av.targetX = this.startX + (isForest ? this.bldW / 2 : this.usableW / 2); 
                            }
                        } else {
                            av.state = targetState;
                        }
                    });
                }
            }
        }
        
        if (this.initLift && !isForest) {
            const elevatorContainer = new PIXI.Container();
            elevatorContainer.y = roofH + (numFloors - 1) * floorH + floorH;
            this.scene.addChild(elevatorContainer);
            this.initLift(elevatorContainer, bld.id, numFloors, floorH, shaftX + 15);
        }
        
        this.avatars.forEach(av => {
            if (av && av.cont) av.cont.zIndex = 100;
        });

        const bottomPadding = 56;
        
        if (isForest) {
            // Forests: ground pinned at 70% viewport height, no vertical scroll at all
            const groundSceneY = roofH + floorH - 4; // where props sit in scene coords
            this.scene.y = G.vpH * 0.70 - groundSceneY;
            this.minY = this.scene.y; // locked
            this.maxY = this.scene.y; // locked
            this._noYScroll = true;
        } else {
            this.scene.y = G.vpH - bottomPadding - this.totalH + floorH; 
            this.minY = Math.min(50, G.vpH - bottomPadding - this.totalH); 
            this.maxY = 50;
            this._noYScroll = false;
        }

        this.layer.eventMode = 'static'; 
        
        if (this._noYScroll) {
            // Forests: no vertical scrolling, default cursor
            this.layer.cursor = 'default';
        } else {
            this.layer.cursor = 'grab';
        }
        
        window.removeEventListener('pointermove', this.onMove); 
        window.removeEventListener('pointerup', this.onUp);
        
        this.layer.on('pointerdown', (e) => { 
            if (this._noYScroll) return; // forests: no drag
            this.isDragging = true; 
            this.startY = e.clientY; 
            this.startSceneY = this.scene.y; 
            this.layer.cursor = 'grabbing'; 
        });
        window.addEventListener('pointermove', this.onMove); 
        window.addEventListener('pointerup', this.onUp);
    },

    onMove: (e) => {
        if (!InteriorCity.isDragging) return;
        let newY = InteriorCity.startSceneY + (e.clientY - InteriorCity.startY);
        if (newY < InteriorCity.minY) newY = InteriorCity.minY;
        if (newY > InteriorCity.maxY) newY = InteriorCity.maxY;
        InteriorCity.scene.y = newY;
    },
    
    onUp: () => { 
        InteriorCity.isDragging = false; 
        if (InteriorCity.layer) InteriorCity.layer.cursor = 'grab'; 
    },

    update() {
        if (!this.layer || !this.layer.visible) return;
        
        if (this.updateLifts) this.updateLifts();
        
        const dp = G.getDayPhase();
        const night = dp > .83 || dp < .25;
        const vp = document.getElementById('viewport'); 
        
        let sky;
        if (dp < .22) {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        } else if (dp < .30) { 
            const t = (dp - .22) / .08; 
            sky = `linear-gradient(180deg,rgb(${8 + t * 40 | 0},${10 + t * 30 | 0},${30 + t * 40 | 0}),rgb(${15 + t * 80 | 0},${15 + t * 50 | 0},${40 + t * 50 | 0}) 50%,rgb(${20 + t * 120 | 0},${20 + t * 80 | 0},${40 + t * 30 | 0}))`; 
        } else if (dp < .72) {
            sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        } else if (dp < .84) { 
            const t = (dp - .72) / .12; 
            sky = `linear-gradient(180deg,rgb(${45 + t * 30 | 0},${74 - t * 40 | 0},${122 - t * 60 | 0}),rgb(${90 + t * 80 | 0},${143 - t * 80 | 0},${187 - t * 100 | 0}) 50%,rgb(${135 + t * 60 | 0},${100 - t * 50 | 0},${50 - t * 10 | 0}))`; 
        } else {
            sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        }
        
        if (typeof Environment !== 'undefined' && Environment.weather === 'rain' && !night && dp > .3 && dp < .72) {
            sky = 'linear-gradient(180deg,#2f3640,#475569 50%,#64748b)';
        }
        if (typeof Environment !== 'undefined' && Environment.weather === 'snow') {
            sky = 'linear-gradient(180deg,#1a1a2e,#2d3748 50%,#4a5568)';
        }
        if (vp) vp.style.background = sky;

        if (this.celestialGfx) {
            this.celestialGfx.clear();
            if (night) { 
                let np = dp > 0.83 ? (dp - 0.83) / 0.42 : (dp + 0.17) / 0.42; 
                this.celestialGfx.beginFill(0xe8e8d0); 
                this.celestialGfx.drawCircle(G.vpW * np, 40 + Math.sin(np * Math.PI) * 120, 12); 
                this.celestialGfx.endFill(); 
            } else { 
                let dayP = (dp - 0.25) / (0.83 - 0.25); 
                this.celestialGfx.beginFill(0xffe066); 
                this.celestialGfx.drawCircle(G.vpW * dayP, 40 + Math.sin(dayP * Math.PI) * 120, 15); 
                this.celestialGfx.endFill(); 
            }
        }
        
        if (this.starsLayer) { 
            this.starsLayer.visible = night; 
            if (night) { 
                this.starsLayer.children.forEach(s => { 
                    s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; 
                }); 
            } 
        }
        
        if (this.tickerTxt && this.bldTickerSym && typeof API !== 'undefined' && API.stockPrices) {
            const sd = API.stockPrices[this.bldTickerSym];
            if (sd && G.tick % 60 === 0) {
                this.tickerTxt.text = `     ${this.bldTickerSym} $${sd.price} [${sd.change}]     ${this.bldTickerSym} $${sd.price} [${sd.change}]     `;
                this.tickerTxt.style.fill = sd.color;
            }
            this.tickerTxt.x -= 0.8;
            if (this.tickerTxt.x + (this.tickerTxt.width / 2) < this.startX) {
                this.tickerTxt.x = this.startX + this.bldW;
            }
        }

        if (this.indoorLights) {
            const isWorkingHours = dp >= 0.35 && dp <= 0.80;
            const nightMode = night || !isWorkingHours;
            
            this.indoorLights.forEach((l, idx) => {
                let targetAlpha = 0;
                
                if (l.type === 'ceiling') {
                    targetAlpha = nightMode ? l.maxA * 0.2 : l.maxA;
                } else if (l.type === 'server') {
                    targetAlpha = l.maxA * (0.6 + Math.random() * 0.4); 
                } else if (l.type === 'error') {
                    targetAlpha = (G.tick % 60 < 30) ? l.maxA : 0; 
                } else if (l.type === 'fire') {
                    targetAlpha = l.maxA * (0.8 + Math.random() * 0.4); 
                } else if (l.type === 'screen') {
                    const base = nightMode ? l.maxA : l.maxA * 0.3;
                    targetAlpha = base * (0.9 + Math.sin(G.tick * 0.05 + idx) * 0.1);
                }
                
                l.g.alpha += (targetAlpha - l.g.alpha) * 0.1;
            });
        }
        
        if (this.ceoCarGfx && G.ceoRefs && G.ceoRefs[this.bld.lab]) {
            this.ceoCarGfx.visible = (G.ceoRefs[this.bld.lab].bld === this.bld.id);
        }

        const leftWall = this.startX + 60;
        const rightWall = this.startX + (this.bld.id === 'forest_0' ? this.bldW : this.usableW) - 60;

        let numFloors = this.bld.dynamicFl ? Math.max(3, this.bld.dynamicFl) : (this.bld.fl || 1);

        this.avatars.forEach((av, i) => {
            // Tracking highlight pulse
            if (av._trackGlow) {
                av._trackGlow.alpha = 0.25 + Math.sin(G.tick * 0.1) * 0.15;
                if (av._trackArrow) av._trackArrow.y = Math.sin(G.tick * 0.15) * 3 - 2;
            }

            if (av.isStaticRole) {
                const bob = Math.sin(G.tick * 0.15 + i) * 1.5;
                av.head.y = -32 + 4 + bob; 
                av.body.y = -32 + 12 + 4 + (bob * 0.5);
                if (av.legL && av.legR) { 
                    av.legL.y = 0; 
                    av.legR.y = 0; 
                }
                return;
            }
            
            if (av.propGfx) av.propGfx.visible = false;

            if ((av.state === 'walking_to_prop' || av.state === 'returning') && av.timer <= 0 && !av.m.isCeo) {
                let partner = this.avatars.find(other => 
                    other !== av && 
                    !other.isStaticRole && 
                    !other.m.isCeo &&
                    (other.state === 'walking_to_prop' || other.state === 'returning') && 
                    other.floorIdx === av.floorIdx && 
                    Math.abs(other.cont.x - av.cont.x) < 25 && 
                    other.timer <= 0
                );

                if (partner && Math.random() < 0.1) {
                    av.resumeState = av.state;
                    partner.resumeState = partner.state;
                    av.state = 'chatting';
                    partner.state = 'chatting';
                    
                    av.timer = 180 + Math.random() * 120;
                    partner.timer = av.timer; 
                    
                    av.cont.scale.x = Math.sign(partner.cont.x - av.cont.x) || 1;
                    partner.cont.scale.x = Math.sign(av.cont.x - partner.cont.x) || -1;

                    const topics = ["AGI timelines?", "Need more H100s.", "My loss curve...", "Open weights?", "Synthetic data is key.", "RLHF is tedious."];
                    this.spawnBubble(av, topics[Math.floor(Math.random() * topics.length)]);
                    
                    setTimeout(() => { 
                        if (!this.layer || !this.layer.visible || G.activeInterior !== this.bld.id) return;
                        if (partner.state === 'chatting') {
                            const replies = ["Agreed.", "Not scalable.", "Pfft, closed source.", "Compute is king.", "Data wall approaching."];
                            this.spawnBubble(partner, replies[Math.floor(Math.random() * replies.length)]);
                        }
                    }, 1500);
                }
            }

            switch (av.state) {

                case 'ceo_entering': {
                    this.animateWalk(av);
                    const dxEnter = this.floors[-1].elevatorX - av.cont.x;
                    if (Math.abs(dxEnter) < av.speed) {
                        av.cont.x = this.floors[-1].elevatorX;
                        av.state = 'ceo_calling_up';
                    } else {
                        av.cont.x += Math.sign(dxEnter) * av.speed;
                        av.cont.scale.x = Math.sign(dxEnter);
                    }
                    break;
                }
                case 'ceo_calling_up': {
                    const cLiftUp = this.getLift(this.bld.id);
                    if (cLiftUp) { cLiftUp.call(-1); av.state = 'ceo_waiting_up'; }
                    break;
                }
                case 'ceo_waiting_up': {
                    const wLiftUp = this.getLift(this.bld.id);
                    if (wLiftUp && wLiftUp.currentFloor === -1 && wLiftUp.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_up';
                    }
                    break;
                }
                case 'ceo_delay_up': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_up';
                    break;
                }
                case 'ceo_riding_up': {
                    const rLiftUp = this.getLift(this.bld.id);
                    if (rLiftUp) {
                        av.cont.visible = false;
                        rLiftUp.call(numFloors - 1);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftUp.car.y;
                        if (rLiftUp.currentFloor === numFloors - 1 && rLiftUp.state === 'open') {
                            av.cont.y = this.floors[numFloors - 1].y;
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_desk'; 
                            av.floorIdx = numFloors - 1;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_desk': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av); 
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) { 
                        av.cont.x = av.deskX; 
                        const refs = G.charRefs[av.m.id];
                        if (refs) refs.wantsToEnter = false; 
                        av.state = 'ceo_working'; 
                    } else { 
                        av.cont.x += Math.sign(dx) * av.speed; 
                        av.cont.scale.x = Math.sign(dx); 
                    }
                    break;
                }
                case 'ceo_working': {
                    if (Math.random() < 0.005) {
                        av.state = 'ceo_wandering';
                        av.targetX = leftWall + Math.random() * (rightWall - leftWall);
                    } else {
                        av.cont.rotation = 0;
                        av.cont.x = av.deskX;
                        av.cont.scale.x = 1; 
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.1) * 1.5; 
                        av.body.y = -32 + 12 + 4;
                        if (av.legL && av.legR) { 
                            av.legL.rotation = -Math.PI / 2;
                            av.legR.rotation = -Math.PI / 2;
                            av.legL.y = -4; 
                            av.legR.y = -4; 
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 5) {
                            this.spawnBubble(av, ["Reviewing the benchmarks.", "Check the stock price.", "We need more compute."][Math.floor(Math.random()*3)]);
                        }
                    }
                    break;
                }
                case 'ceo_wandering': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av);
                    const dxWander = av.targetX - av.cont.x;
                    if (Math.abs(dxWander) < av.speed) {
                        av.cont.x = av.targetX;
                        av.state = 'ceo_standing';
                        av.timer = 150 + Math.random() * 150;
                    } else {
                        av.cont.x += Math.sign(dxWander) * av.speed;
                        av.cont.scale.x = Math.sign(dxWander);
                    }
                    break;
                }
                case 'ceo_standing': {
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05) * 1.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    
                    av.timer--;
                    if (av.timer <= 0) {
                        if (Math.random() < 0.5) {
                            av.state = 'ceo_walking_to_desk';
                        } else {
                            av.state = 'ceo_wandering';
                            av.targetX = leftWall + Math.random() * (rightWall - leftWall);
                        }
                    }
                    if (Math.random() < 0.005 && this.bubbles.length < 5) {
                        this.spawnBubble(av, ["Looking good.", "The city is growing.", "Need to align the models."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                case 'ceo_leaving': {
                    if (av.legL && av.legR) { av.legL.rotation = 0; av.legR.rotation = 0; }
                    this.animateWalk(av);
                    const dxLeave = this.floors[numFloors - 1].elevatorX - av.cont.x;
                    if (Math.abs(dxLeave) < av.speed) {
                        av.cont.x = this.floors[numFloors - 1].elevatorX;
                        av.state = 'ceo_calling_down';
                    } else {
                        av.cont.x += Math.sign(dxLeave) * av.speed;
                        av.cont.scale.x = Math.sign(dxLeave);
                    }
                    break;
                }
                case 'ceo_calling_down': {
                    const cLiftDn = this.getLift(this.bld.id);
                    if (cLiftDn) { cLiftDn.call(numFloors - 1); av.state = 'ceo_waiting_down'; }
                    break;
                }
                case 'ceo_waiting_down': {
                    const wLiftDn = this.getLift(this.bld.id);
                    if (wLiftDn && wLiftDn.currentFloor === numFloors - 1 && wLiftDn.state === 'open') {
                        av.timer = 20; av.state = 'ceo_delay_down';
                    }
                    break;
                }
                case 'ceo_delay_down': {
                    av.timer--; if (av.timer <= 0) av.state = 'ceo_riding_down';
                    break;
                }
                case 'ceo_riding_down': {
                    const rLiftDn = this.getLift(this.bld.id);
                    if (rLiftDn) {
                        av.cont.visible = false;
                        rLiftDn.call(-1);
                        av.cont.y = (this.totalH - 80 - 4) + rLiftDn.car.y; 
                        if (rLiftDn.currentFloor === -1 && rLiftDn.state === 'open') {
                            av.cont.y = this.totalH - 80 - 4; 
                            av.cont.visible = true;
                            av.state = 'ceo_walking_to_car';
                            av.floorIdx = -1;
                        }
                    }
                    break;
                }
                case 'ceo_walking_to_car': {
                    this.animateWalk(av);
                    const dxCar = (this.startX + 180) - av.cont.x;
                    if (Math.abs(dxCar) < av.speed) {
                        // CEO reached car — start driving out animation
                        av.cont.visible = false;
                        av.state = 'ceo_driving_out';
                        av._driveOutTick = 0;
                        if (this.ceoCarGfx) {
                            this.ceoCarGfx._origX = this.ceoCarGfx.x;
                            this.ceoCarGfx._origAlpha = this.ceoCarGfx.alpha;
                        }
                    } else {
                        av.cont.x += Math.sign(dxCar) * av.speed;
                        av.cont.scale.x = Math.sign(dxCar);
                    }
                    break;
                }
                case 'ceo_driving_out': {
                    av._driveOutTick++;
                    if (this.ceoCarGfx) {
                        // Car accelerates right and fades over 90 ticks (~1.5s)
                        const t = av._driveOutTick / 90;
                        this.ceoCarGfx.x = this.ceoCarGfx._origX + (t * t * 300); // ease-in acceleration
                        this.ceoCarGfx.alpha = Math.max(0, 1 - t * 1.2);
                    }
                    if (av._driveOutTick >= 90) {
                        av.state = 'gone';
                        if (this.ceoCarGfx) {
                            this.ceoCarGfx.visible = false;
                            this.ceoCarGfx.x = this.ceoCarGfx._origX;
                            this.ceoCarGfx.alpha = this.ceoCarGfx._origAlpha || 1;
                        }
                        const ceoRef = G.ceoRefs[av.m.lab];
                        if (ceoRef) {
                            ceoRef.bld = null;
                            ceoRef.wantsToLeave = false;
                        }
                    }
                    break;
                }

                case 'entering_lobby': {
                    if (av.floorIdx === 0) {
                        this.animateWalk(av); 
                        const dx = av.deskX - av.cont.x;
                        if (Math.abs(dx) < av.speed) { 
                            av.cont.x = av.deskX; 
                            const refs = G.charRefs[av.m.id];
                            if (refs) refs.wantsToEnter = false; 
                            av.state = 'working'; 
                        } else { 
                            av.cont.x += Math.sign(dx) * av.speed; 
                            av.cont.scale.x = Math.sign(dx); 
                        }
                    } else {
                        av.targetX = this.floors[0].elevatorX; 
                        this.animateWalk(av); 
                        const dx = av.targetX - av.cont.x;
                        if (Math.abs(dx) < av.speed) { 
                            av.cont.x = av.targetX; 
                            av.state = 'calling_lift_up'; 
                        } else { 
                            av.cont.x += Math.sign(dx) * av.speed; 
                            av.cont.scale.x = Math.sign(dx); 
                        }
                    }
                    break;
                }
                case 'calling_lift_up': { 
                    const lift = this.getLift(this.bld.id); 
                    if (lift) { lift.call(0); av.state = 'waiting_lift_up'; } 
                    break; 
                }
                case 'waiting_lift_up': { 
                    const lift = this.getLift(this.bld.id); 
                    if (lift && lift.currentFloor === 0 && lift.state === 'open') { 
                        av.timer = 20 + Math.random() * 20; 
                        av.state = 'delay_enter_lift_up'; 
                    } 
                    break; 
                }
                case 'delay_enter_lift_up': { 
                    av.timer--; 
                    if (av.timer <= 0) av.state = 'riding_lift_up'; 
                    break; 
                }
                case 'riding_lift_up': {
                    const lift = this.getLift(this.bld.id);
                    if (lift) {
                        av.cont.visible = false; 
                        lift.call(av.floorIdx);
                        av.cont.y = (this.totalH - 80 - 4) + lift.car.y; 
                        if (lift.currentFloor === av.floorIdx && lift.state === 'open') { 
                            av.cont.y = av.floorY; 
                            av.cont.visible = true; 
                            av.state = 'walking_to_desk'; 
                        }
                    }
                    break;
                }
                case 'walking_to_desk': {
                    this.animateWalk(av); 
                    const dx = av.deskX - av.cont.x;
                    if (Math.abs(dx) < av.speed) { 
                        av.cont.x = av.deskX; 
                        const refs = G.charRefs[av.m.id];
                        if (refs) refs.wantsToEnter = false; 
                        av.state = 'working'; 
                    } else { 
                        av.cont.x += Math.sign(dx) * av.speed; 
                        av.cont.scale.x = Math.sign(dx); 
                    }
                    break;
                }

                // ─── NEW: CAMPING STATES ───
                case 'camping': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL) { av.legL.y = 0; av.legR.y = 0; }
                    
                    if (!av.propGfx) {
                        av.propGfx = new PIXI.Graphics();
                        av.cont.addChild(av.propGfx);
                    }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x4a2e1a);
                    av.propGfx.moveTo(0, -10);
                    av.propGfx.lineTo(15, -5);
                    av.propGfx.lineStyle(0);
                    av.propGfx.beginFill(0xffffff);
                    av.propGfx.drawCircle(15, -5, 2);
                    av.propGfx.endFill();

                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Perfect marshmallow.", "Campfire vibes.", "Nature is optimal."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'fishing': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL) { av.legL.y = 0; av.legR.y = 0; }
                    
                    if (!av.propGfx) {
                        av.propGfx = new PIXI.Graphics();
                        av.cont.addChild(av.propGfx);
                    }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x111111);
                    av.propGfx.moveTo(0, -15);
                    av.propGfx.lineTo(25, -25);
                    av.propGfx.lineStyle(0);
                    av.propGfx.lineStyle(0.5, 0xffffff, 0.5);
                    av.propGfx.moveTo(25, -25);
                    av.propGfx.lineTo(25, 10);
                    av.propGfx.lineStyle(0);

                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Got a bite!", "Fishing for data.", "So peaceful."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                case 'picnicking': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 8 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL) { av.legL.y = 0; av.legR.y = 0; }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Great sandwich.", "Lovely weather.", "Pass the potato salad."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                // ─── SILICON WOODS: CEO RETREAT ACTIVITIES ───
                case 'sipping_whiskey': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = -1; // facing the bar
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.03 + i) * 0.5;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    // Holding a glass
                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.beginFill(0xfbbf24, 0.6); av.propGfx.drawRect(6, -10, 4, 6); av.propGfx.endFill();
                    av.propGfx.beginFill(0xffffff, 0.3); av.propGfx.drawRect(6, -12, 4, 2); av.propGfx.endFill();
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Smooth.", "Peaty. Perfect.", "To AGI.", "Another round.", "Single malt only."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'putting': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    // Putting stroke animation
                    const pStroke = Math.sin(G.tick * 0.04 + i * 3);
                    av.cont.scale.x = 1;
                    av.head.y = -32 + 6 + Math.abs(pStroke) * 2;
                    av.body.y = -32 + 12 + 4 + Math.abs(pStroke);
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    // Golf club
                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.lineStyle(1, 0x94a3b8);
                    av.propGfx.moveTo(4, -8);
                    av.propGfx.lineTo(4 + pStroke * 10, 4);
                    av.propGfx.lineStyle(0);
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Under par.", "Fore!", "Hole in one.", "Nice lie.", "Needs more backspin."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'soaking_hottub': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY + 4; // sunk into the tub
                    av.cont.scale.x = Math.sign(Math.sin(i * 2.3)) || 1;
                    av.head.y = -32 + 14 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 20; // body mostly submerged
                    if (av.legL && av.legR) {
                        av.legL.visible = false;
                        av.legR.visible = false;
                    }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Ahhh...", "This is the life.", "108°F, perfect.", "Should've IPO'd sooner.", "Pure bliss."][Math.floor(Math.random()*5)]);
                    }
                    break;
                }
                case 'stargazing_firepit': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = Math.sign(Math.sin(i)) || 1;
                    // Leaning back, looking up
                    av.head.y = -32 + 8 + Math.sin(G.tick * 0.015 + i) * 1;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) {
                        av.legL.rotation = -0.3;
                        av.legR.rotation = -0.3;
                        av.legL.y = 2;
                        av.legR.y = 2;
                    }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["See that star?", "The embers...", "When's the singularity?", "I can smell the pines.", "Compute under the stars."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 60));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                // ─── FRONTIER PINES: LAUNCH VIEWING ACTIVITIES ───
                case 'watching_telescope': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY - 4; // on viewing platform
                    av.cont.scale.x = 1;
                    // Leaning into eyepiece
                    av.head.y = -32 + 6 + Math.sin(G.tick * 0.015 + i) * 0.5;
                    av.body.y = -32 + 12 + 6;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["I see the rocket!", "Tracking the trajectory.", "Starlink visible!", "Is that a satellite?", "Beautiful orbit."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.001) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 60));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'launch_picnic': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL && av.legR) {
                        av.legL.rotation = -0.3;
                        av.legR.rotation = -0.3;
                        av.legL.y = 2;
                        av.legR.y = 2;
                    }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Great spot to watch!", "Pass the coffee.", "T-minus vibes.", "The countdown board says soon!", "Love launch days."][Math.floor(Math.random()*5)]);
                    }
                    if (Math.random() < 0.0008) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 80));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                case 'scanning_sky': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY - 4;
                    // Looking up at the sky
                    av.head.y = -32 + 2 + Math.sin(G.tick * 0.01 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.005 + i)) || 1;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["There it goes!", "Max-Q!", "Booster separation!", "Look at that plume!", "Godspeed!"][Math.floor(Math.random()*5)]);
                    }
                    break;
                }
                case 'getting_snacks': {
                    av.cont.x = av.deskX;
                    av.cont.y = av.floorY;
                    av.cont.scale.x = -1; // facing the stand
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL && av.legR) { av.legL.y = 0; av.legR.y = 0; }
                    
                    // Holding a drink
                    if (!av.propGfx) { av.propGfx = new PIXI.Graphics(); av.cont.addChild(av.propGfx); }
                    av.propGfx.visible = true;
                    av.propGfx.clear();
                    av.propGfx.beginFill(0x22d3ee, 0.6); av.propGfx.drawRect(6, -10, 4, 7); av.propGfx.endFill();
                    
                    if (Math.random() < 0.002 && this.bubbles.length < 8) {
                        this.spawnBubble(av, ["Hot cocoa time.", "Need more popcorn.", "Best snack stand.", "Fuel for the countdown."][Math.floor(Math.random()*4)]);
                    }
                    if (Math.random() < 0.001) {
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + (Math.random() - 0.5) * 100));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }

                case 'working': {
                    if (av.jobTheme === 'server_core') {
                        av.cont.x = av.deskX + Math.sin(G.tick * 0.02 + i) * 15; 
                        av.cont.y = av.floorY; 
                        av.cont.scale.x = Math.sign(Math.cos(G.tick * 0.02 + i)) || 1;
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.15) * 1.5; 
                        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.15)) * 1.5;
                        if (av.legL && av.legR) { 
                            av.legL.y = Math.sin(G.tick * 0.15) * 2; 
                            av.legR.y = -Math.sin(G.tick * 0.15) * 2; 
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["Temps stable.", "Coolant optimal.", "Checking nodes.", "Hardware healthy."][Math.floor(Math.random()*4)]);
                        }
                    } else if (av.jobTheme === 'zen_garden') {
                        av.cont.x = av.deskX; 
                        av.cont.y = av.floorY; 
                        av.cont.scale.x = 1;
                        av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5; 
                        av.body.y = -32 + 14;
                        if (av.legL && av.legR) { 
                            av.legL.y = 0; 
                            av.legR.y = 0; 
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["...", "Clearing cache.", "Watching the gecko.", "Peace."][Math.floor(Math.random()*4)]);
                        }
                    } else if (av.jobTheme === 'arcade') {
                        av.cont.x = av.deskX; 
                        av.cont.y = av.floorY; 
                        av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                        av.head.y = -32 + 6 + Math.sin(G.tick * 0.1 + i) * 1.5; 
                        av.body.y = -32 + 13 + Math.abs(Math.sin(G.tick * 0.1 + i)) * 1;
                        if (av.legL && av.legR) { 
                            av.legL.y = 0; 
                            av.legR.y = 0; 
                        }
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av, ["Leveling my starter...", "Match point.", "Decompressing.", "High score!"][Math.floor(Math.random()*4)]);
                        }
                    } else {
                        av.cont.x = av.deskX; 
                        av.cont.y = av.floorY; 
                        av.cont.scale.x = 1; 
                        av.head.y = -32 + 4 + Math.sin(G.tick * 0.15 + i) * 1.5; 
                        av.body.y = -32 + 12 + 4 + (Math.sin(G.tick * 0.15 + i) * 1.5 * 0.5);
                        if (av.legL && av.legR) { 
                            av.legL.y = 0; 
                            av.legR.y = 0; 
                        }
                        
                        if (Math.random() < 0.002 && this.bubbles.length < 15) {
                            this.spawnBubble(av);
                        }
                        if (Math.random() < 0.0005) {
                            const props = this.floors[av.floorIdx].breakSpots;
                            av.targetX = props.length > 0 ? props[Math.floor(Math.random() * props.length)] : leftWall + Math.random() * (rightWall - leftWall);
                            av.state = 'walking_to_prop';
                        }
                    }
                    break;
                }

                case 'chatting': {
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.1 + i) * 1.5;
                    av.body.y = -32 + 12 + 4 + (Math.sin(G.tick * 0.1 + i) * 1.5 * 0.5);
                    if (av.legL && av.legR) { 
                        av.legL.y = 0; 
                        av.legR.y = 0; 
                    }
                    
                    if (Math.random() < 0.01 && this.bubbles.length < 15) {
                        const chats = ["Interesting.", "Hmm...", "Parameter count?", "Check my benchmarks."];
                        this.spawnBubble(av, chats[Math.floor(Math.random() * chats.length)]);
                    }

                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = av.resumeState || 'returning';
                        av.timer = 60; 
                    }
                    break;
                }

                case 'resting': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 10 + Math.sin(G.tick * 0.02 + i) * 0.5;
                    av.body.y = -32 + 14;
                    if (av.legL) { 
                        av.legL.y = 0; 
                        av.legR.y = 0; 
                    }
                    if (Math.random() < 0.001 && this.bubbles.length < 5) {
                        this.spawnBubble(av, ["Zzz...", "Legacy code...", "Deprecated."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                    
                case 'collaborating': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.05 + i) * 15)); 
                    av.cont.y = av.floorY;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.2 + i) * 1.5; 
                    av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 1.5;
                    if (av.legL) { 
                        av.legL.y = Math.sin(G.tick * 0.2 + i) * 2; 
                        av.legR.y = -Math.sin(G.tick * 0.2 + i) * 2; 
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Merging PR...", "Open weights!", "LGTM!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                    
                case 'chilling': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 4 + Math.sin(G.tick * 0.05 + i) * 1;
                    av.body.y = -32 + 12 + 4;
                    if (av.legL) { 
                        av.legL.y = 0; 
                        av.legR.y = 0; 
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Great coffee.", "Need more compute.", "Resting."][Math.floor(Math.random()*3)]);
                    }
                    if (Math.random() < 0.001) {
                        let offset = Math.random() > 0.5 ? 40 : -40;
                        av.targetX = Math.max(leftWall, Math.min(rightWall, av.deskX + offset));
                        av.state = 'walking_to_prop';
                    }
                    break;
                }
                    
                case 'working_out': {
                    av.cont.x = av.deskX; 
                    av.cont.y = av.floorY; 
                    av.head.y = -32 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 4;
                    av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.2 + i)) * 4;
                    if (av.legL) { 
                        av.legL.y = Math.sin(G.tick * 0.4 + i) * 3; 
                        av.legR.y = -Math.sin(G.tick * 0.4 + i) * 3; 
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Feel the burn!", "Optimizing...", "Heavy weights!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                    
                case 'fighting': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.1 + i) * 30)); 
                    av.cont.y = av.floorY - Math.abs(Math.sin(G.tick * 0.3 + i)) * 10;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 4; 
                    av.body.y = -32 + 12 + 4;
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Take that!", "My ELO!", "Dodge!"][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                    
                case 'playing': {
                    av.cont.x = Math.max(leftWall, Math.min(rightWall, av.deskX + Math.sin(G.tick * 0.03 + i) * 30)); 
                    let floatY = Math.sin(G.tick * 0.04 + i) * 20;
                    av.cont.y = av.floorY - 25 + floatY;
                    av.cont.scale.x = Math.sign(Math.sin(G.tick * 0.05 + i)) || 1;
                    av.head.y = -32 + 12 + Math.sin(G.tick * 0.1 + i) * 2; 
                    av.body.y = -32 + 18;
                    if (av.legL) { 
                        av.legL.y = 0; 
                        av.legR.y = 0; 
                    }
                    if (Math.random() < 0.002 && this.bubbles.length < 10) {
                        this.spawnBubble(av, ["Absorbing data...", "Epoch 1...", "Loss dropping..."][Math.floor(Math.random()*3)]);
                    }
                    break;
                }
                    
                case 'walking_to_prop':
                case 'returning': {
                    this.animateWalk(av);
                    const distProp = av.targetX - av.cont.x;
                    if (Math.abs(distProp) < av.speed) {
                        av.cont.x = av.targetX;
                        if (av.state === 'walking_to_prop') {
                            av.state = 'at_prop';
                            av.timer = 150 + Math.random() * 200; 
                            if (Math.random() > 0.5 && this.bld.id !== 'graveyard') {
                                this.spawnBubble(av, "☕ Refreshing.");
                            }
                        } else if (av.state === 'returning') {
                            av.state = this.bld.id === 'cafe' ? 'chilling' :
                                       this.bld.id === 'gym' ? 'working_out' :
                                       this.bld.id === 'arena' ? 'fighting' :
                                       (this.bld.id === 'graveyard' || this.bld.id === 'legacy') ? 'resting' :
                                       (this.bld.id === 'open_square' || this.bld.id === 'os_hub') ? 'collaborating' :
                                       'working';
                        }
                    } else {
                        av.cont.x += Math.sign(distProp) * av.speed;
                        av.cont.scale.x = Math.sign(distProp); 
                    }
                    break;
                }

                case 'walking_to_elevator_down': {
                    if (av.floorIdx === 0) {
                        av.state = 'walking_out'; 
                        av.targetX = this.startX + (this.bld.id === 'forest_0' ? this.bldW / 2 : this.usableW / 2);
                    } else {
                        av.cont.rotation = 0; 
                        this.animateWalk(av);
                        const distDown = av.targetX - av.cont.x;
                        if (Math.abs(distDown) < av.speed) {
                            av.cont.x = av.targetX;
                            av.state = 'calling_lift';
                            if (av.legL && av.legR) { 
                                av.legL.y = 0; 
                                av.legR.y = 0; 
                            }
                        } else {
                            av.cont.x += Math.sign(distDown) * av.speed;
                            av.cont.scale.x = Math.sign(distDown); 
                        }
                    }
                    break;
                }

                case 'calling_lift': {
                    const cLift = this.getLift(this.bld.id);
                    if (cLift) {
                        cLift.call(av.floorIdx);
                        av.state = 'waiting_lift';
                    }
                    break;
                }

                case 'waiting_lift': {
                    const wLift = this.getLift(this.bld.id);
                    if (wLift && wLift.currentFloor === av.floorIdx && wLift.state === 'open') {
                        av.timer = 20 + Math.random() * 20;
                        av.state = 'delay_enter_lift';
                    }
                    break;
                }

                case 'delay_enter_lift': {
                    av.timer--;
                    if (av.timer <= 0) {
                        av.state = 'entering_lift';
                    }
                    break;
                }

                case 'entering_lift': {
                    const eLift = this.getLift(this.bld.id);
                    if (eLift) {
                        av.cont.visible = false;
                        eLift.call(0);
                        av.state = 'riding_lift';
                    }
                    break;
                }

                case 'riding_lift': {
                    const rLift = this.getLift(this.bld.id);
                    if (rLift) {
                        const groundFloorY = this.totalH - 80 - 4; 
                        av.cont.y = groundFloorY + rLift.car.y; 
                        
                        if (rLift.currentFloor === 0 && rLift.state === 'open') {
                            av.state = 'walking_out';
                            av.cont.y = groundFloorY; 
                            av.cont.visible = true; 
                            av.targetX = this.startX + this.usableW / 2; 
                        }
                    }
                    break;
                }
                    
                case 'walking_out': {
                    this.animateWalk(av);
                    const outDist = av.targetX - av.cont.x;
                    if (Math.abs(outDist) < av.speed) {
                        av.state = 'gone';
                        av.cont.visible = false;
                        
                        const refs = G.charRefs[av.m.id];
                        if (refs) {
                            refs.bld = null; 
                            refs.wantsToLeave = false; 
                            refs.c.x = G.bldById[this.bld.id].x + (G.bldById[this.bld.id].w / 2);
                            refs.c.visible = true;
                        }
                    } else {
                        av.cont.x += Math.sign(outDist) * av.speed;
                        av.cont.scale.x = Math.sign(outDist); 
                    }
                    break;
                }
            }
        });
        
        for (let i = this.elevators.length - 1; i >= 0; i--) {
            let e = this.elevators[i];
            e.y += e.speed;
            e.car.y = e.y;
            
            if ((e.speed > 0 && e.y >= e.endY) || (e.speed < 0 && e.y <= e.endY)) {
                if (e.callback) e.callback();
                e.car.destroy();
                this.elevators.splice(i, 1);
            }
        }
        
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 20);
            
            if (b.life <= 0) {
                b.cont.destroy();
                this.bubbles.splice(i, 1);
            }
        }
    }
};
