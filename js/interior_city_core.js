/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR CITY CORE (v15.8.0 - Forest Campsite & Avatar State Expansion)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorCity = {
    ...InteriorCityProps,
    ...InteriorCityAI,
    ...InteriorAvatarStates,
    
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
        } else if (bld.id === 'gym' || bld.id === 'arena' || bld.id === 'cafe' || bld.id === 'open_square') {
            numFloors = bld.dynamicFl || 3;
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
                    if (['arena', 'graveyard'].includes(bld.id)) {
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
                const gymThemes = ['gym_cardio', 'gym_weights', 'gym_combat', 'gym_yoga', 'gym_pool'];
                floorTheme = gymThemes[f % gymThemes.length];
            } else if (bld.id === 'arena') {
                const arenaThemes = ['arena_lobby', 'arena_training', 'arena_main', 'arena_commentary', 'arena_trophy'];
                floorTheme = arenaThemes[f % arenaThemes.length];
            } else if (bld.id === 'cafe') {
                const cafeThemes = ['cafe', 'cafe_lounge', 'cafe_kitchen', 'cafe_rooftop'];
                floorTheme = cafeThemes[f % cafeThemes.length];
            } else if (bld.id === 'open_square') {
                const osThemes = ['os_lobby', 'os_hackathon', 'os_collab', 'os_server', 'os_garden'];
                floorTheme = osThemes[f % osThemes.length];
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
            if (['arena', 'graveyard'].includes(bld.id)) {
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
                // Grass surface
                roomGfx.beginFill(0x2d6a4f);
                roomGfx.drawRect(0, groundY, G.vpW, 3);
                roomGfx.endFill();
                roomGfx.beginFill(0x1b4332);
                roomGfx.drawRect(0, groundY + 3, G.vpW, 4);
                roomGfx.endFill();
                // Rich topsoil
                roomGfx.beginFill(0x2a1f0e);
                roomGfx.drawRect(0, groundY + 7, G.vpW, 18);
                roomGfx.endFill();
                roomGfx.beginFill(0x1e1608);
                roomGfx.drawRect(0, groundY + 12, G.vpW, 14);
                roomGfx.endFill();
                // Root-filled soil (darker with texture)
                roomGfx.beginFill(0x1a1208);
                roomGfx.drawRect(0, groundY + 26, G.vpW, 20);
                roomGfx.endFill();
                // Scattered roots
                for (let rx = 20; rx < G.vpW; rx += 40 + Math.random() * 60) {
                    roomGfx.beginFill(0x3d2b10, 0.3);
                    roomGfx.drawRect(rx, groundY + 10 + Math.random() * 12, 12 + Math.random() * 20, 2);
                    roomGfx.endFill();
                }
                // Clay layer
                roomGfx.beginFill(0x1a0f06);
                roomGfx.drawRect(0, groundY + 46, G.vpW, 25);
                roomGfx.endFill();
                roomGfx.beginFill(0x14100a);
                roomGfx.drawRect(0, groundY + 56, G.vpW, 20);
                roomGfx.endFill();
                // Rock / sediment
                roomGfx.beginFill(0x0e0c08);
                roomGfx.drawRect(0, groundY + 71, G.vpW, 30);
                roomGfx.endFill();
                // Scattered stones
                for (let sx = 30; sx < G.vpW; sx += 50 + Math.random() * 80) {
                    roomGfx.beginFill(0x2a2520, 0.25);
                    roomGfx.drawEllipse(sx, groundY + 60 + Math.random() * 30, 4 + Math.random() * 6, 2 + Math.random() * 3);
                    roomGfx.endFill();
                }
                // Deep earth (fills to bottom)
                roomGfx.beginFill(0x080604);
                roomGfx.drawRect(0, groundY + 101, G.vpW, 400);
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
            
            if (f >= 0 && !isForest && !['arena', 'graveyard'].includes(bld.id)) {
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

                        // Spawn visiting CEOs/Founders who flew in by helicopter
                        if (G.ceoRefs) {
                            Object.values(G.ceoRefs).forEach(ceoRef => {
                                if (ceoRef.bld === bld.id) {
                                    const ceoModel = { id: 'ceo_'+ceoRef.f.lab, name: ceoRef.f.name, lab: ceoRef.f.lab, phase: 'released', isCeo: true, founderData: ceoRef.f };
                                    const cr = Math.random();
                                    let rx, targetState;
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
                                    let av = this.drawAvatar(ceoModel, rx, fy + floorH - 4, floorCont, f, false, true);
                                    av.state = targetState;
                                }
                            });
                        }
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
                    // ─── GYM FLOORS ───
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
                    } else if (floorTheme === 'gym_yoga') {
                        // Yoga / Pilates studio
                        if (this.drawMirrorWall) this.drawMirrorWall(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, this.usableW - 100);
                        while(currX < this.startX + this.usableW - 120) {
                            if (this.drawYogaMat) this.drawYogaMat(floorCont, currX, fy + floorH - 4);
                            if (Math.random() > 0.6 && this.drawExerciseBall) this.drawExerciseBall(floorCont, currX + 30, fy + floorH - 4);
                            currX += 70;
                        }
                        if (this.drawPlant) this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'yoga_inst', name: 'Yoga Sensei', isNPC: true, role: 'Instructor', phase: 'released', lab: 'other', desc: 'Namaste, gradient.' }, this.startX + this.usableW / 2, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'gym_pool') {
                        // Pool & steam room
                        if (this.drawPoolLane) this.drawPoolLane(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawSteamRoom) this.drawSteamRoom(floorCont, this.startX + this.usableW - 60, fy + floorH - 4);
                        if (this.drawLockerRow) this.drawLockerRow(floorCont, this.startX + 60, fy + floorH - 4);
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + 140, fy + floorH - 4);

                    // ─── ARENA FLOORS ───
                    } else if (floorTheme === 'arena_lobby') {
                        this.drawReceptionDesk(floorCont, this.startX + 120, fy + floorH - 4, 0xef4444);
                        this.drawCouches(floorCont, this.startX + 250, fy + floorH - 4, 0xef4444);
                        if (this.drawLeaderboard) this.drawLeaderboard(floorCont, this.startX + this.usableW - 80, fy + floorH - 4);
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 140, fy + floorH - 4);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 180, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 340, fy + floorH - 4); }
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
                        if (this.drawAudienceStands) this.drawAudienceStands(floorCont, this.startX + 100, fy + floorH - 4, 80);
                        if (this.drawAudienceStands) this.drawAudienceStands(floorCont, this.startX + this.usableW - 100, fy + floorH - 4, 80);
                        if (!_isNightShift) this.drawAvatar({ id: 'ref', name: 'Referee', isNPC: true, role: 'Referee', phase: 'released', lab: 'other', desc: 'Fair fights.' }, this.startX + this.usableW / 2, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'arena_commentary') {
                        // Commentary booth with monitors and jumbotron
                        if (this.drawCommentaryDesk) this.drawCommentaryDesk(floorCont, this.startX + this.usableW / 2, fy + floorH - 4);
                        if (this.drawJumbotron) this.drawJumbotron(floorCont, this.startX + 100, fy + floorH - 4);
                        if (this.drawPlant) this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'commentator', name: 'Commentator', isNPC: true, role: 'Commentator', phase: 'released', lab: 'other', desc: 'And the ELO shifts again!' }, this.startX + this.usableW / 2 - 15, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'arena_trophy') {
                        // Trophy room / hall of fame
                        if (this.drawTrophyCase) {
                            this.drawTrophyCase(floorCont, this.startX + 100, fy + floorH - 4);
                            this.drawTrophyCase(floorCont, this.startX + 200, fy + floorH - 4);
                            this.drawTrophyCase(floorCont, this.startX + 300, fy + floorH - 4);
                        }
                        if (this.drawLeaderboard) this.drawLeaderboard(floorCont, this.startX + this.usableW - 80, fy + floorH - 4);
                        if (this.drawSpotlight) {
                            this.drawSpotlight(floorCont, this.startX + 100, fy + floorH - 4, 0xfbbf24);
                            this.drawSpotlight(floorCont, this.startX + 300, fy + floorH - 4, 0xfbbf24);
                        }
                        this.drawCouches(floorCont, this.startX + this.usableW / 2, fy + floorH - 4, 0xef4444);

                    // ─── CAFÉ FLOORS ───
                    } else if (floorTheme === 'cafe') {
                        // Ground floor — main café
                        if (this.drawMenuBoard) this.drawMenuBoard(floorCont, this.startX + 60, fy + floorH - 4);
                        this.drawBaristaCounter(floorCont, this.startX + this.usableW - 100, fy + floorH - 4);
                        if (this.drawCoffeeMachine) this.drawCoffeeMachine(floorCont, this.startX + this.usableW - 160, fy + floorH - 4);
                        if (this.drawPastryDisplay) this.drawPastryDisplay(floorCont, this.startX + this.usableW - 220, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 140, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 230, fy + floorH - 4);
                        this.drawCafeTable(floorCont, this.startX + 320, fy + floorH - 4);
                        if (this.drawBarStool) { this.drawBarStool(floorCont, this.startX + this.usableW - 130, fy + floorH - 4); this.drawBarStool(floorCont, this.startX + this.usableW - 115, fy + floorH - 4); this.drawBarStool(floorCont, this.startX + this.usableW - 100, fy + floorH - 4); }
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 100, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 280, fy + floorH - 4); }
                        if (!_isNightShift) this.drawAvatar({ id: 'barista', name: 'BaristaBot', isNPC: true, role: 'Barista', phase: 'released', lab: 'other', desc: 'Brewing Java.' }, this.startX + this.usableW - 90, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'cafe_lounge') {
                        // Upstairs lounge — couches, bookshelves, ambient lighting
                        if (this.drawCafeBookshelf) { this.drawCafeBookshelf(floorCont, this.startX + 80, fy + floorH - 4); this.drawCafeBookshelf(floorCont, this.startX + this.usableW - 80, fy + floorH - 4); }
                        if (this.drawCafeCouch) { this.drawCafeCouch(floorCont, this.startX + 160, fy + floorH - 4, 0x8b4513); this.drawCafeCouch(floorCont, this.startX + 320, fy + floorH - 4, 0x6b3410); }
                        this.drawCafeTable(floorCont, this.startX + 240, fy + floorH - 4);
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 8, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 200, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 380, fy + floorH - 4); }
                    } else if (floorTheme === 'cafe_kitchen') {
                        // Back kitchen — ovens, prep stations
                        if (this.drawKitchenOven) { this.drawKitchenOven(floorCont, this.startX + 100, fy + floorH - 4); this.drawKitchenOven(floorCont, this.startX + 200, fy + floorH - 4); }
                        if (this.drawPrepStation) { this.drawPrepStation(floorCont, this.startX + 300, fy + floorH - 4); this.drawPrepStation(floorCont, this.startX + 400, fy + floorH - 4); }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'baker', name: 'Baker Bot', isNPC: true, role: 'Pastry Chef', phase: 'released', lab: 'other', desc: 'Batch processing croissants.' }, this.startX + 260, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'cafe_rooftop') {
                        // Rooftop terrace with outdoor seating
                        if (this.drawOutdoorTable) { this.drawOutdoorTable(floorCont, this.startX + 120, fy + floorH - 4); this.drawOutdoorTable(floorCont, this.startX + 260, fy + floorH - 4); this.drawOutdoorTable(floorCont, this.startX + 400, fy + floorH - 4); }
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 6, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 60, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 190, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 330, fy + floorH - 4); this.drawPlant(floorCont, this.startX + this.usableW - 50, fy + floorH - 4); }
                        if (this.drawBiophilicDivider) this.drawBiophilicDivider(floorCont, this.startX + this.usableW - 100, fy + floorH - 4);

                    // ─── OPEN SOURCE HUB FLOORS ───
                    } else if (floorTheme === 'os_lobby') {
                        // Welcome hall + contributor wall
                        this.drawReceptionDesk(floorCont, this.startX + 120, fy + floorH - 4, 0xa855f7);
                        if (this.drawContributorWall) this.drawContributorWall(floorCont, this.startX + 280, fy + floorH - 4);
                        this.drawCouches(floorCont, this.startX + 400, fy + floorH - 4, 0xa855f7);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 60, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 200, fy + floorH - 4); }
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                        if (!_isNightShift) this.drawAvatar({ id: 'os_greeter', name: 'Maintainer', isNPC: true, role: 'Lead Maintainer', phase: 'released', lab: 'other', desc: 'Reviewing pull requests since 2020.' }, this.startX + 140, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'os_hackathon') {
                        // Hackathon space — long desks, laptops, energy drinks
                        if (this.drawHackathonDesk) {
                            this.drawHackathonDesk(floorCont, this.startX + 120, fy + floorH - 4);
                            this.drawHackathonDesk(floorCont, this.startX + 280, fy + floorH - 4);
                            this.drawHackathonDesk(floorCont, this.startX + 440, fy + floorH - 4);
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + 60, fy + floorH - 4);
                        if (this.drawVendingMachine) this.drawVendingMachine(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'os_collab') {
                        // Collaboration pods + whiteboards
                        if (this.drawWhiteboard) { this.drawWhiteboard(floorCont, this.startX + 100, fy + floorH - 4); this.drawWhiteboard(floorCont, this.startX + 350, fy + floorH - 4); }
                        if (this.drawCollaborationPod) { this.drawCollaborationPod(floorCont, this.startX + 220, fy + floorH - 4, 0xa855f7); this.drawCollaborationPod(floorCont, this.startX + 450, fy + floorH - 4, 0x06b6d4); }
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 160, fy + floorH - 4); this.drawPlant(floorCont, this.startX + 300, fy + floorH - 4); }
                        if (!_isNightShift) this.drawAvatar({ id: 'os_contrib', name: 'Contributor', isNPC: true, role: 'Core Contributor', phase: 'released', lab: 'other', desc: 'Squashing bugs, one PR at a time.' }, this.startX + 260, fy + floorH - 4, floorCont, f, true);
                    } else if (floorTheme === 'os_server') {
                        // Community server infrastructure
                        if (this.drawOpenServerRack) {
                            let sx = this.startX + 80;
                            while (sx < this.startX + this.usableW - 120) {
                                this.drawOpenServerRack(floorCont, sx, fy + floorH - 4);
                                sx += 60;
                            }
                        }
                        if (this.drawWaterCooler) this.drawWaterCooler(floorCont, this.startX + this.usableW - 50, fy + floorH - 4);
                    } else if (floorTheme === 'os_garden') {
                        // Rooftop garden / relaxation for devs
                        if (this.drawGardenPlanter) {
                            this.drawGardenPlanter(floorCont, this.startX + 80, fy + floorH - 4);
                            this.drawGardenPlanter(floorCont, this.startX + 200, fy + floorH - 4);
                            this.drawGardenPlanter(floorCont, this.startX + 400, fy + floorH - 4);
                        }
                        if (this.drawHammock) this.drawHammock(floorCont, this.startX + 300, fy + floorH - 4);
                        if (this.drawBiophilicDivider) this.drawBiophilicDivider(floorCont, this.startX + 140, fy + floorH - 4);
                        if (this.drawStringLights) this.drawStringLights(floorCont, this.startX + 60, fy + 6, this.usableW - 120);
                        if (this.drawPlant) { this.drawPlant(floorCont, this.startX + 340, fy + floorH - 4); this.drawPlant(floorCont, this.startX + this.usableW - 60, fy + floorH - 4); }

                    } else if (bld.id === 'graveyard') {
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
                                      (bld.id === 'graveyard') ? 'resting' :
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
            this.minY = Math.min(this.scene.y - floorH * 3, G.vpH - bottomPadding - this.totalH - floorH);
            this.maxY = Math.max(this.scene.y + floorH * 3, G.vpH - bottomPadding);
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
        if (!InteriorCity.isDragging || !InteriorCity.scene || InteriorCity.scene.destroyed) return;
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

        this.updateAvatarStates(leftWall, rightWall, numFloors);

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
