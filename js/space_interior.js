/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE INTERIOR (v1.0.0 — Phase 3: Mission Control, Assembly, Tracking Interiors)
   Handles interior views for space zone buildings with unique props and compute tracking.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SpaceInterior = {
    avatars: [],
    bubbles: [],
    indoorLights: [],
    scene: null,
    layer: null,
    bld: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _noYScroll: false,
    
    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.layer.removeChildren();
        this.avatars = [];
        this.bubbles = [];
        this.indoorLights = [];
        
        this.skyContainer = new PIXI.Container();
        this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 100; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff); s.drawCircle(0, 0, .5 + Math.random() * 1.5); s.endFill();
            s.x = Math.random() * G.vpW; s.y = Math.random() * G.vpH * .5;
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        
        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);
        
        const org = bld.org ? SPACE_ORGS[bld.org] : null;
        const colHex = org ? parseInt(org.color.slice(1), 16) : 0x0ea5e9;
        
        const floorH = 80;
        const numFloors = bld.type === 'assembly' ? 4 : bld.type === 'mission_control' ? 3 : bld.type === 'launchpad' ? 2 : 2;
        const roofH = 80;
        const totalH = roofH + (numFloors + 1) * floorH;
        this.totalH = totalH;
        
        const bldW = G.vpW;
        const startX = 0;
        
        // Building background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x0a0a15);
        bg.drawRect(0, 0, bldW, totalH + 200);
        bg.endFill();
        this.scene.addChild(bg);
        
        // Roof
        const roof = new PIXI.Graphics();
        roof.beginFill(colHex, 0.3);
        roof.drawRect(startX, roofH - 4, bldW, 4);
        roof.endFill();
        roof.beginFill(colHex, 0.15);
        roof.drawRect(startX, roofH - 20, bldW, 20);
        roof.endFill();
        // Org name on roof
        const orgName = org ? org.name : bld.name;
        const roofTxt = new PIXI.Text(orgName.toUpperCase(), {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 12, fill: colHex, fontWeight: 'bold', letterSpacing: 4
        });
        roofTxt.anchor.set(0.5, 0.5);
        roofTxt.x = bldW / 2;
        roofTxt.y = roofH - 12;
        roof.addChild(roofTxt);
        this.scene.addChild(roof);
        
        // Build floors
        for (let f = 0; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;
            
            // Floor background
            const floorBg = new PIXI.Graphics();
            floorBg.beginFill(0x0f0f1a);
            floorBg.drawRect(startX, fy, bldW, floorH);
            floorBg.endFill();
            // Floor line
            floorBg.beginFill(0x1a1a30);
            floorBg.drawRect(startX, fy + floorH - 4, bldW, 4);
            floorBg.endFill();
            // Accent strip
            floorBg.beginFill(colHex, 0.1);
            floorBg.drawRect(startX, fy, bldW, 2);
            floorBg.endFill();
            floorCont.addChild(floorBg);
            
            const propY = fy + floorH - 4;
            
            if (bld.type === 'mission_control') {
                if (f === numFloors - 1) {
                    this.drawBigScreen(floorCont, startX + bldW / 2, fy + 8, bldW - 100, floorH - 20, colHex);
                    this.drawNPC(floorCont, startX + 120, propY, 'Flight Director', colHex);
                    this.drawNPC(floorCont, startX + bldW - 120, propY, 'CAPCOM', colHex);
                } else if (f === 0) {
                    this.drawCommRack(floorCont, startX + 60, propY, colHex);
                    this.drawCommRack(floorCont, startX + 160, propY, colHex);
                    this.drawServerCabinet(floorCont, startX + 280, propY, colHex);
                    this.drawCoffeeMachine(floorCont, startX + bldW - 100, propY);
                    this.drawNPC(floorCont, startX + 350, propY, 'Network Ops', colHex);
                    this.drawNPC(floorCont, startX + bldW - 60, propY, 'Intern', 0x94a3b8);
                } else {
                    let currX = startX + 60;
                    let npcCount = 0;
                    while (currX < startX + bldW - 120) {
                        this.drawOperatorDesk(floorCont, currX, propY, colHex);
                        if (npcCount < 3) this.drawNPC(floorCont, currX + 50, propY, ['GNC', 'Telemetry', 'Propulsion'][npcCount], colHex);
                        currX += 120; npcCount++;
                    }
                }
            } else if (bld.type === 'assembly') {
                if (f === numFloors - 1) {
                    this.drawOverheadCrane(floorCont, startX + bldW / 2, fy + 10, bldW - 60);
                    this.drawNPC(floorCont, startX + 100, propY, 'Crane Op', 0xfacc15);
                } else if (f === 0) {
                    this.drawRocketBay(floorCont, startX + bldW / 2, propY, colHex);
                    this.drawNPC(floorCont, startX + bldW / 2 + 100, propY, 'Chief Engineer', colHex);
                    this.drawNPC(floorCont, startX + bldW / 2 - 100, propY, 'Technician', 0x94a3b8);
                } else {
                    this.drawCleanRoom(floorCont, startX + 80, fy, bldW - 160, floorH);
                    let currX = startX + 100;
                    while (currX < startX + bldW - 160) {
                        this.drawPayloadRack(floorCont, currX, propY, colHex);
                        currX += 100;
                    }
                    this.drawNPC(floorCont, startX + bldW / 2, propY, 'Payload Spec', 0xf1f5f9);
                }
            } else if (bld.type === 'tracking') {
                if (f === numFloors - 1) {
                    this.drawOrbitalDisplay(floorCont, startX + bldW / 2, fy + 8, bldW - 80, floorH - 16);
                    this.drawNPC(floorCont, startX + bldW / 2 - 60, propY, 'Analyst', colHex);
                } else {
                    let currX = startX + 60;
                    let npcIdx = 0;
                    while (currX < startX + bldW - 120) {
                        this.drawTrackingConsole(floorCont, currX, propY, colHex);
                        if (npcIdx < 2) this.drawNPC(floorCont, currX + 50, propY, ['Signal Proc', 'Orbit Calc'][npcIdx], colHex);
                        currX += 140; npcIdx++;
                    }
                }
            } else if (bld.type === 'launchpad') {
                if (f === 0) {
                    // Ground floor: launch consoles + countdown + fire suppression
                    this.drawLaunchConsole(floorCont, startX + 80, propY, colHex);
                    this.drawLaunchConsole(floorCont, startX + 240, propY, colHex);
                    this.drawLaunchConsole(floorCont, startX + 400, propY, colHex);
                    this.drawCountdownClock(floorCont, startX + bldW / 2, fy + 10, bld);
                    this.drawNPC(floorCont, startX + 160, propY, 'Launch Dir', 0xef4444);
                    this.drawNPC(floorCont, startX + 320, propY, 'Range Safety', 0xfacc15);
                } else {
                    // Upper floor: observation + comms
                    this.drawCommRack(floorCont, startX + 60, propY, colHex);
                    this.drawServerCabinet(floorCont, startX + 180, propY, colHex);
                    this.drawCoffeeMachine(floorCont, startX + bldW - 80, propY);
                    this.drawNPC(floorCont, startX + 300, propY, 'Weather', 0x38bdf8);
                }
            }
            
            this.scene.addChild(floorCont);
        }
        
        // Position scene
        const bottomPadding = 56;
        this.scene.y = G.vpH - bottomPadding - totalH + floorH;
        this.minY = Math.min(50, G.vpH - bottomPadding - totalH);
        this.maxY = 50;
        this._noYScroll = false;
        
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!this.isDragging || !this.scene || this.scene.destroyed) return;
            let newY = this._startSceneY + (e.clientY - this._startY);
            if (newY < this.minY) newY = this.minY;
            if (newY > this.maxY) newY = this.maxY;
            this.scene.y = newY;
        };
        this._onUp = () => { this.isDragging = false; if (this.layer) this.layer.cursor = 'grab'; };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },
    
    update() {
        if (!this.layer || !this.layer.visible) return;
        
        const dp = G.getDayPhase();
        const night = dp > .83 || dp < .25;
        const vp = document.getElementById('viewport');
        
        let sky;
        if (dp < .22) sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        else if (dp < .30) { const t = (dp-.22)/.08; sky = `linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`; }
        else if (dp < .72) sky = 'linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)';
        else if (dp < .84) { const t = (dp-.72)/.12; sky = `linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`; }
        else sky = 'linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';
        if (vp) vp.style.background = sky;
        
        if (this.starsLayer) { this.starsLayer.visible = night; if (night) { this.starsLayer.children.forEach(s => { s.alpha = .15 + Math.abs(Math.sin(G.tick * .03 + s._phase)) * .5; }); } }
        if (this.celestialGfx) {
            this.celestialGfx.clear();
            if (night) { let np = dp > 0.83 ? (dp-0.83)/0.42 : (dp+0.17)/0.42; this.celestialGfx.beginFill(0xe8e8d0); this.celestialGfx.drawCircle(G.vpW*np, 40+Math.sin(np*Math.PI)*120, 12); this.celestialGfx.endFill(); }
            else { let dayP = (dp-0.25)/(0.83-0.25); this.celestialGfx.beginFill(0xffe066); this.celestialGfx.drawCircle(G.vpW*dayP, 40+Math.sin(dayP*Math.PI)*120, 15); this.celestialGfx.endFill(); }
        }
        
        // Animate indoor lights (screen flicker)
        this.indoorLights.forEach(l => {
            if (l.type === 'screen') {
                l.g.alpha = l.maxA * (0.7 + Math.sin(G.tick * 0.1 + l.g.x * 0.01) * 0.3);
            } else if (l.type === 'blink') {
                l.g.alpha = Math.sin(G.tick * 0.05) > 0 ? l.maxA : 0.1;
            }
        });

        // Animate space NPCs
        this.updateAvatars();
    },
    
    // ════════════════════════════════════════════════════
    //   SPACE INTERIOR PROPS
    // ════════════════════════════════════════════════════
    
    drawBigScreen(c, cx, y, w, h, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Screen bezel
        g.beginFill(0x1a1a2e);
        g.drawRect(cx - w/2, y, w, h);
        g.endFill();
        // Screen surface
        g.beginFill(0x0a1628);
        g.drawRect(cx - w/2 + 4, y + 4, w - 8, h - 8);
        g.endFill();
        // Grid lines (orbital tracks)
        g.lineStyle(1, col, 0.15);
        for (let gx = cx - w/2 + 20; gx < cx + w/2; gx += 40) {
            g.moveTo(gx, y + 4); g.lineTo(gx, y + h - 4);
        }
        for (let gy = y + 15; gy < y + h; gy += 20) {
            g.moveTo(cx - w/2 + 4, gy); g.lineTo(cx + w/2 - 4, gy);
        }
        g.lineStyle(0);
        // Earth circle
        g.beginFill(0x1e40af, 0.4);
        g.drawCircle(cx, y + h/2, Math.min(w, h) * 0.25);
        g.endFill();
        g.beginFill(0x166534, 0.3);
        g.drawEllipse(cx - 5, y + h/2 - 3, 12, 8);
        g.drawEllipse(cx + 10, y + h/2 + 5, 8, 6);
        g.endFill();
        // Orbital path arcs
        g.lineStyle(1, 0x22d3ee, 0.4);
        g.drawEllipse(cx, y + h/2, Math.min(w,h) * 0.35, Math.min(w,h) * 0.15);
        g.lineStyle(1, 0xfbbf24, 0.3);
        g.drawEllipse(cx, y + h/2, Math.min(w,h) * 0.42, Math.min(w,h) * 0.2);
        g.lineStyle(0);
        // Satellite dots on orbits
        const t = G.tick * 0.005;
        [0x22d3ee, 0xfbbf24, 0x4ade80].forEach((dotCol, i) => {
            const angle = t + i * 2.1;
            const rx = Math.min(w,h) * (0.35 + i * 0.07);
            const ry = Math.min(w,h) * (0.15 + i * 0.05);
            g.beginFill(dotCol); g.drawCircle(cx + Math.cos(angle)*rx, y + h/2 + Math.sin(angle)*ry, 2); g.endFill();
        });
        // Glow
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.05); glow.drawRect(cx - w/2, y, w, h); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'screen' });
    },
    
    drawOperatorDesk(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Desk surface
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 18, 80, 18); g.endFill();
        g.beginFill(0x222240); g.drawRect(x, y - 20, 80, 4); g.endFill();
        // Triple monitors
        for (let mx = 0; mx < 3; mx++) {
            const sx = x + 5 + mx * 26;
            g.beginFill(0x111118); g.drawRect(sx, y - 38, 22, 16); g.endFill();
            const screenGlow = new PIXI.Graphics();
            screenGlow.beginFill(col, 0.5); screenGlow.drawRect(sx + 1, y - 37, 20, 14); screenGlow.endFill();
            screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
            c.addChild(screenGlow);
            this.indoorLights.push({ g: screenGlow, maxA: 0.6, type: 'screen' });
        }
        // Chair
        g.beginFill(0x1e293b); g.drawRect(x + 30, y - 6, 16, 6); g.endFill();
        g.beginFill(0x1e293b); g.drawRect(x + 36, y - 14, 4, 8); g.endFill();
        c.addChild(g);
    },
    
    drawCommRack(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x111118); g.drawRect(x, y - 50, 30, 50); g.endFill();
        g.beginFill(0x1a1a2e); g.drawRect(x + 2, y - 48, 26, 46); g.endFill();
        // LEDs
        for (let ly = y - 45; ly < y - 5; ly += 8) {
            const ledCol = Math.random() > 0.3 ? 0x4ade80 : 0xef4444;
            g.beginFill(ledCol); g.drawCircle(x + 8, ly, 1.5); g.endFill();
            g.beginFill(col, 0.3); g.drawRect(x + 14, ly - 2, 12, 4); g.endFill();
        }
        c.addChild(g);
    },
    
    drawServerCabinet(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a12); g.drawRect(x, y - 55, 40, 55); g.endFill();
        g.beginFill(0x111120); g.drawRect(x + 3, y - 52, 34, 49); g.endFill();
        // Server units
        for (let sy = y - 50; sy < y - 5; sy += 10) {
            g.beginFill(0x1a1a30); g.drawRect(x + 5, sy, 30, 8); g.endFill();
            g.beginFill(0x4ade80); g.drawCircle(x + 10, sy + 4, 1); g.endFill();
            g.beginFill(col, 0.2); g.drawRect(x + 14, sy + 2, 18, 4); g.endFill();
        }
        const glow = new PIXI.Graphics();
        glow.beginFill(col, 0.06); glow.drawRect(x, y - 55, 40, 55); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow);
        this.indoorLights.push({ g: glow, maxA: 0.08, type: 'blink' });
    },
    
    drawCoffeeMachine(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x333340); g.drawRect(x, y - 25, 18, 25); g.endFill();
        g.beginFill(0x78350f); g.drawRect(x + 4, y - 8, 10, 8); g.endFill();
        g.beginFill(0x4ade80); g.drawCircle(x + 9, y - 18, 2); g.endFill();
        c.addChild(g);
    },
    
    drawOverheadCrane(c, cx, y, w) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rail
        g.beginFill(0xfacc15); g.drawRect(cx - w/2, y, w, 4); g.endFill();
        // Trolley
        g.beginFill(0x475569); g.drawRect(cx - 15, y + 4, 30, 12); g.endFill();
        // Hook cable
        g.beginFill(0x94a3b8); g.drawRect(cx - 1, y + 16, 2, 30); g.endFill();
        // Hook
        g.lineStyle(2, 0xfacc15); g.arc(cx, y + 48, 6, 0, Math.PI); g.lineStyle(0);
        c.addChild(g);
    },
    
    drawRocketBay(c, cx, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Rocket in assembly (horizontal)
        g.beginFill(0xf1f5f9); g.drawRect(cx - 60, y - 20, 120, 16); g.endFill();
        g.beginFill(col); g.drawPolygon([cx + 60, y - 20, cx + 76, y - 12, cx + 60, y - 4]); g.endFill();
        g.beginFill(col); g.drawRect(cx - 20, y - 18, 30, 12); g.endFill();
        // Support cradle
        g.beginFill(0x475569); g.drawRect(cx - 50, y - 4, 20, 4); g.drawRect(cx + 30, y - 4, 20, 4); g.endFill();
        g.beginFill(0x334155); g.drawRect(cx - 45, y - 8, 4, 8); g.drawRect(cx + 41, y - 8, 4, 8); g.endFill();
        // Floor markings
        g.beginFill(0xfacc15, 0.3);
        for (let mx = cx - 80; mx < cx + 80; mx += 20) { g.drawRect(mx, y - 2, 10, 2); }
        g.endFill();
        c.addChild(g);
    },
    
    drawCleanRoom(c, x, y, w, h) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // White clean room overlay
        g.beginFill(0xffffff, 0.03); g.drawRect(x, y, w, h); g.endFill();
        g.lineStyle(1, 0x38bdf8, 0.15); g.drawRect(x, y, w, h); g.lineStyle(0);
        // Airlock markers
        g.beginFill(0x22d3ee, 0.2); g.drawRect(x, y + h/2 - 15, 4, 30); g.drawRect(x + w - 4, y + h/2 - 15, 4, 30); g.endFill();
        c.addChild(g);
    },
    
    drawPayloadRack(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 40, 50, 40); g.endFill();
        g.beginFill(0x111118); g.drawRect(x + 4, y - 36, 42, 32); g.endFill();
        // Payload fairing shape
        g.beginFill(0xf1f5f9, 0.3);
        g.drawPolygon([x + 15, y - 32, x + 25, y - 8, x + 35, y - 32]);
        g.endFill();
        g.beginFill(col, 0.2); g.drawRect(x + 18, y - 25, 14, 12); g.endFill();
        // Status LED
        g.beginFill(0x4ade80); g.drawCircle(x + 45, y - 4, 2); g.endFill();
        c.addChild(g);
    },
    
    drawOrbitalDisplay(c, cx, y, w, h) {
        // Similar to big screen but with satellite constellation focus
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a18); g.drawRect(cx - w/2, y, w, h); g.endFill();
        g.beginFill(0x0a1628); g.drawRect(cx - w/2 + 3, y + 3, w - 6, h - 6); g.endFill();
        // Polar grid
        g.lineStyle(1, 0x22d3ee, 0.1);
        for (let r = 10; r < Math.min(w,h)/2; r += 15) {
            g.drawCircle(cx, y + h/2, r);
        }
        g.lineStyle(0);
        // Constellation dots
        for (let i = 0; i < 30; i++) {
            const angle = i * 0.21 + G.tick * 0.002;
            const radius = 10 + (i % 5) * 12;
            g.beginFill(i % 3 === 0 ? 0x22d3ee : i % 3 === 1 ? 0x4ade80 : 0xfbbf24, 0.7);
            g.drawCircle(cx + Math.cos(angle) * radius, y + h/2 + Math.sin(angle) * radius * 0.4, 1.5);
            g.endFill();
        }
        // Label
        const lbl = new PIXI.Text('ORBITAL CONSTELLATION', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 7, fill: 0x22d3ee, letterSpacing: 2
        });
        lbl.anchor.set(0.5, 0); lbl.x = cx; lbl.y = y + h - 12;
        const glow = new PIXI.Graphics();
        glow.beginFill(0x22d3ee, 0.04); glow.drawRect(cx - w/2, y, w, h); glow.endFill();
        glow.blendMode = PIXI.BLEND_MODES.ADD;
        c.addChild(g, glow, lbl);
        this.indoorLights.push({ g: glow, maxA: 0.06, type: 'screen' });
    },
    
    drawTrackingConsole(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Console desk
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 16, 100, 16); g.endFill();
        // Dual screens
        g.beginFill(0x111118); g.drawRect(x + 5, y - 36, 40, 18); g.endFill();
        g.beginFill(0x111118); g.drawRect(x + 50, y - 36, 40, 18); g.endFill();
        // Screen content — signal waveform
        const wave1 = new PIXI.Graphics();
        wave1.lineStyle(1, 0x22d3ee, 0.7);
        for (let wx = 0; wx < 36; wx++) {
            const wy = Math.sin(wx * 0.3) * 4;
            if (wx === 0) wave1.moveTo(x + 7 + wx, y - 27 + wy);
            else wave1.lineTo(x + 7 + wx, y - 27 + wy);
        }
        wave1.lineStyle(0);
        const wave2 = new PIXI.Graphics();
        wave2.lineStyle(1, 0x4ade80, 0.7);
        for (let wx = 0; wx < 36; wx++) {
            const wy = Math.cos(wx * 0.4) * 3;
            if (wx === 0) wave2.moveTo(x + 52 + wx, y - 27 + wy);
            else wave2.lineTo(x + 52 + wx, y - 27 + wy);
        }
        wave2.lineStyle(0);
        // Chair
        g.beginFill(0x1e293b); g.drawRect(x + 40, y - 4, 16, 4); g.endFill();
        c.addChild(g, wave1, wave2);
    },
    
    drawLaunchConsole(c, x, y, col) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Wide console
        g.beginFill(0x1a1a2e); g.drawRect(x, y - 20, 120, 20); g.endFill();
        g.beginFill(0x222240); g.drawRect(x, y - 22, 120, 4); g.endFill();
        // Main screen
        g.beginFill(0x111118); g.drawRect(x + 10, y - 42, 60, 18); g.endFill();
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(col, 0.4); screenGlow.drawRect(x + 11, y - 41, 58, 16); screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        // Status panel
        g.beginFill(0x111118); g.drawRect(x + 80, y - 42, 30, 18); g.endFill();
        // GO/NO-GO lights
        ['#4ade80', '#4ade80', '#4ade80', '#fbbf24'].forEach((ledCol, i) => {
            g.beginFill(parseInt(ledCol.slice(1), 16));
            g.drawCircle(x + 88 + i * 7, y - 33, 2);
            g.endFill();
        });
        // Big red button
        g.beginFill(0xef4444); g.drawCircle(x + 95, y - 6, 6); g.endFill();
        g.beginFill(0xb91c1c); g.drawCircle(x + 95, y - 6, 4); g.endFill();
        c.addChild(g, screenGlow);
        this.indoorLights.push({ g: screenGlow, maxA: 0.5, type: 'screen' });
    },
    
    drawCountdownClock(c, cx, y, bld) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        g.beginFill(0x0a0a12); g.drawRect(cx - 50, y, 100, 30); g.endFill();
        g.beginFill(0x111120); g.drawRect(cx - 48, y + 2, 96, 26); g.endFill();
        g.lineStyle(1, 0xef4444, 0.5); g.drawRect(cx - 50, y, 100, 30); g.lineStyle(0);
        const txt = new PIXI.Text('T-00:00:00', {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 14, fill: 0xef4444, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 0.5);
        txt.x = cx; txt.y = y + 15;
        c.addChild(g, txt);
        bld._countdownClock = txt;
    },
    
    drawNPC(c, x, y, role, col) {
        const colHex = col || 0x64748b;
        const bw = 12;
        const h = 28;
        const headH = 10;
        const bodyH = h - headH - 4;
        const legH = 4;
        const eyeS = 1;

        const cont = new PIXI.Container();

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();

        // Head
        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, eyeS);
        head.drawCircle(bw * 0.1, headH * 0.38, eyeS);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(colHex);
        body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
        body.endFill();
        body.y = -h + headH;

        // Legs
        const lw = Math.max(2, bw * 0.25);
        const lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x1e293b);
        legL.drawRect(-lw / 2, 0, lw, lh);
        legL.endFill();
        legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x1e293b);
        legR.drawRect(-lw / 2, 0, lw, lh);
        legR.endFill();
        legR.x = bw * 0.15;

        // Status dot
        const dot = new PIXI.Graphics();
        dot.beginFill(colHex);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;

        cont.addChild(shadow, legL, legR, body, head, dot);
        cont.x = x;
        cont.y = y;

        // Role label above head
        const txt = new PIXI.Text(role, { fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: colHex });
        txt.anchor.set(0.5, 1);
        txt.y = -h - 8;
        cont.addChild(txt);

        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined') UI.addToast(`${role} — Space Zone Personnel`);
        });

        c.addChild(cont);

        const agent = {
            m: { id: 'npc_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.8,
            role, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   SPACE NPC ANIMATION & STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const SPACE_MSGS = [
            "Telemetry nominal.", "Signal acquired.", "Orbit stable.",
            "Recalculating trajectory.", "Comms check.", "All systems go.",
            "Adjusting azimuth.", "Fuel pressure OK.", "T-minus holding.",
            "Copy that, Houston.", "Roger, flight.", "Go for launch."
        ];

        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            switch (av.state) {
                case 'working': {
                    // Idle animation — slight head bob and body sway
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.03 + av.deskX)) * 0.3;

                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.3) {
                            // Walk to a random nearby spot
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 120;
                            av.targetX = Math.max(30, Math.min(G.vpW - 30, av.targetX));
                        } else if (r < 0.5) {
                            // Chat with someone
                            av.state = 'chatting';
                            av.timer = 80 + Math.floor(Math.random() * 60);
                            this.spawnBubble(av, SPACE_MSGS[Math.floor(Math.random() * SPACE_MSGS.length)]);
                        } else {
                            // Keep working, reset timer
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.3) {
                                this.spawnBubble(av, SPACE_MSGS[Math.floor(Math.random() * SPACE_MSGS.length)]);
                            }
                        }
                    }
                    break;
                }

                case 'walking': {
                    const dx = av.targetX - av.cont.x;
                    if (Math.abs(dx) < 2) {
                        av.cont.x = av.targetX;
                        av.cont.scale.x = 1;
                        if (av.label) av.label.scale.x = 1;
                        if (av.dot) av.dot.scale.x = 1;
                        av.state = 'working';
                        av.timer = 100 + Math.floor(Math.random() * 200);
                    } else {
                        const dir = dx > 0 ? 1 : -1;
                        av.cont.x += dir * av.speed;
                        av.cont.scale.x = dir;
                        // Counter-scale text & dot so they don't mirror
                        if (av.label) av.label.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    // Walk animation
                    av.head.y = -av._h + Math.sin(G.tick * 0.2) * 1.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.2)) * 1.5;
                    av.legL.y = Math.sin(G.tick * 0.3) * 3;
                    av.legR.y = -Math.sin(G.tick * 0.3) * 3;
                    break;
                }

                case 'chatting': {
                    // Slight gesturing animation
                    av.head.y = -av._h + Math.sin(G.tick * 0.06) * 1;
                    av.body.y = -av._h + av._h * 0.36;

                    if (av.timer <= 0) {
                        av.state = 'working';
                        av.timer = 80 + Math.floor(Math.random() * 150);
                    }
                    break;
                }
            }
        });

        // Update speech bubbles
        for (let i = this.bubbles.length - 1; i >= 0; i--) {
            const b = this.bubbles[i];
            b.life--;
            b.cont.y -= 0.15;
            b.cont.alpha = Math.min(1, b.life / 20);
            if (b.life <= 0) {
                if (b.cont.parent) b.cont.parent.removeChild(b.cont);
                b.cont.destroy({ children: true });
                this.bubbles.splice(i, 1);
            }
        }
    },

    spawnBubble(av, msg) {
        if (!this.scene || this.scene.destroyed) return;
        const bCont = new PIXI.Container();
        const txt = new PIXI.Text(msg, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x000000, fontWeight: 'bold'
        });
        txt.anchor.set(0.5, 1);
        txt.y = -6;
        const bg = new PIXI.Graphics();
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width / 2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.beginFill(0xffffff);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        bCont.addChild(bg, txt);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - av._h - 10;
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    }
};
