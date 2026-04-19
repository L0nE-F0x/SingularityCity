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

        // ─── SKY LAYER (behind scene — DOM sky shows through window cutouts) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 80);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        } else {
            // Fallback if InteriorCity not loaded yet
            this.skyContainer = new PIXI.Container();
            layer.addChild(this.skyContainer);
            this.starsLayer = new PIXI.Container();
            this.celestialGfx = new PIXI.Graphics();
            this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        }

        this.scene = new PIXI.Container();
        this.layer.addChild(this.scene);

        const org = bld.org ? SPACE_ORGS[bld.org] : null;
        const colHex = org ? parseInt(org.color.slice(1), 16) : 0x0ea5e9;

        // Building palette by type — mirrors space_environment.js exterior values
        // launchpad: concrete grey gantry; mission_control & tracking: navy; assembly: VAB grey
        const isAssembly = bld.type === 'assembly';
        const isLaunchpad = bld.type === 'launchpad';
        const wallCol  = isAssembly  ? 0x6b7280 :  // VAB grey-blue
                         isLaunchpad ? 0x475569 :  // dark concrete
                                       0x1e293b;   // navy (mission_control / tracking)
        const trimCol  = isAssembly  ? 0xcbd5e1 :  // light VAB highlight
                         isLaunchpad ? 0x64748b :  // medium concrete
                                       0x334155;   // navy trim
        const wallEdge = isAssembly  ? 0x4b5563 :
                         isLaunchpad ? 0x334155 :
                                       0x0f172a;
        const floorSlabCol = isAssembly ? 0x4b5563 : 0x0a1018;

        const floorH = 80;
        const numFloors = isAssembly ? 4 : bld.type === 'mission_control' ? 3 : isLaunchpad ? 2 : 2;
        const roofH = 70;
        // totalH includes roof + above-ground floors + basement floor + underground stack
        const undergroundH = (typeof Underground !== 'undefined') ? (Underground.depthOf('space') + 60) : 360;
        this.totalH = roofH + (numFloors + 1) * floorH + undergroundH;

        const bldW = Math.min(G.vpW - 60, 900);
        const startX = (G.vpW - bldW) / 2;

        // Window band constants for punched cutouts (above-ground floors)
        const winMarginX = 40;
        const winY_off = 14;
        const winH_px = floorH - 30;
        const mullionPitch = 60;
        const mullionW = 6;

        // ─── ROOF — type-specific silhouette ───
        const roof = new PIXI.Graphics();
        // Roof slab
        roof.beginFill(wallCol);
        roof.drawRect(startX, roofH - 12, bldW, 12);
        roof.endFill();
        // Trim line
        roof.beginFill(trimCol, 0.85);
        roof.drawRect(startX, roofH - 14, bldW, 2);
        roof.endFill();
        // Roof label band
        roof.beginFill(wallEdge, 0.95);
        roof.drawRect(startX, roofH - 30, bldW, 18);
        roof.endFill();
        roof.beginFill(colHex, 0.18);
        roof.drawRect(startX, roofH - 30, bldW, 18);
        roof.endFill();
        this.scene.addChild(roof);

        // Type-specific rooftop features (built into the roof container, scene-relative)
        this._drawRoofFeatures(this.scene, bld, startX, bldW, roofH, colHex);

        // Roof label text
        const orgName = org ? org.name : (bld.name || '');
        const roofTxt = new PIXI.Text(orgName.toUpperCase(), {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 11, fill: colHex, fontWeight: 'bold', letterSpacing: 4
        });
        roofTxt.anchor.set(0.5, 0.5);
        roofTxt.x = startX + bldW / 2;
        roofTxt.y = roofH - 21;
        if (roofTxt.width > bldW - 20) roofTxt.scale.set((bldW - 20) / roofTxt.width);
        this.scene.addChild(roofTxt);

        // Side wall columns (frame the building)
        const sideCols = new PIXI.Graphics();
        sideCols.beginFill(wallEdge);
        sideCols.drawRect(startX - 6, roofH, 6, (numFloors + 1) * floorH);
        sideCols.drawRect(startX + bldW, roofH, 6, (numFloors + 1) * floorH);
        sideCols.endFill();
        // Edge highlight
        sideCols.beginFill(trimCol, 0.6);
        sideCols.drawRect(startX - 6, roofH, 2, (numFloors + 1) * floorH);
        sideCols.drawRect(startX + bldW + 4, roofH, 2, (numFloors + 1) * floorH);
        sideCols.endFill();
        this.scene.addChild(sideCols);

        // Build floors — basement (f=-1) + above-ground (f=0..numFloors-1)
        for (let f = -1; f < numFloors; f++) {
            const isBasement = f === -1;
            const fy = isBasement
                ? roofH + numFloors * floorH
                : roofH + (numFloors - 1 - f) * floorH;
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;

            // Floor background — basement is solid, above-ground has window cutout
            const floorBg = new PIXI.Graphics();
            if (isBasement) {
                floorBg.beginFill(wallEdge);
                floorBg.drawRect(startX, fy, bldW, floorH);
                floorBg.endFill();
                // Subtle hazard accent
                floorBg.beginFill(colHex, 0.08);
                floorBg.drawRect(startX, fy, bldW, 2);
                floorBg.endFill();
            } else {
                const winX = startX + winMarginX;
                const winW = bldW - winMarginX * 2;
                const winY = fy + winY_off;
                if (typeof InteriorCity !== 'undefined' && InteriorCity._drawWallWithWindowCutout) {
                    InteriorCity._drawWallWithWindowCutout(
                        floorBg, wallCol,
                        startX, fy, bldW, floorH,
                        winX, winY, winW, winH_px,
                        mullionPitch, mullionW
                    );
                } else {
                    floorBg.beginFill(wallCol); floorBg.drawRect(startX, fy, bldW, floorH); floorBg.endFill();
                }
                // Window frame
                floorBg.lineStyle(1.5, trimCol, 0.9);
                floorBg.drawRect(winX, winY, winW, winH_px);
                floorBg.moveTo(winX, winY + winH_px * 0.5);
                floorBg.lineTo(winX + winW, winY + winH_px * 0.5);
                floorBg.lineStyle(0);
                // Faint org-color tint over window glass
                floorBg.beginFill(colHex, 0.05);
                floorBg.drawRect(winX, winY, winW, winH_px);
                floorBg.endFill();
            }
            // Floor slab divider
            floorBg.beginFill(floorSlabCol);
            floorBg.drawRect(startX, fy + floorH - 6, bldW, 6);
            floorBg.endFill();
            // Top accent
            floorBg.beginFill(colHex, 0.12);
            floorBg.drawRect(startX, fy, bldW, 2);
            floorBg.endFill();
            floorCont.addChild(floorBg);

            const propY = fy + floorH - 6;

            if (isBasement) {
                // Basement floor — type-specific industrial sub-level
                this._drawBasementProps(floorCont, bld, startX, bldW, fy, floorH, colHex);
            } else if (bld.type === 'mission_control') {
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

        // ─── DESERT SAND SURFACE STRIP (matches space_environment.js exterior) ───
        // Only the flanks — building basement occludes its own footprint.
        const groundY = roofH + numFloors * floorH;
        const sand = new PIXI.Graphics();
        const leftW = startX - 6;
        const rightX = startX + bldW + 6;
        const rightW = G.vpW - rightX;
        // Compacted sand "road" — only on the flanks (continues behind building's basement wall)
        if (leftW > 0) {
            sand.beginFill(0x8b7355); sand.drawRect(0, groundY, leftW, 28); sand.endFill();
            sand.beginFill(0x9a8265); sand.drawRect(0, groundY, leftW, 14); sand.endFill();
        }
        if (rightW > 0) {
            sand.beginFill(0x8b7355); sand.drawRect(rightX, groundY, rightW, 28); sand.endFill();
            sand.beginFill(0x9a8265); sand.drawRect(rightX, groundY, rightW, 14); sand.endFill();
        }
        // Soft sand top surface (above the road slab) on flanks
        if (leftW > 0) {
            sand.beginFill(0xc2956a); sand.drawRect(0, groundY - 18, leftW, 18); sand.endFill();
            sand.beginFill(0xd4a574); sand.drawRect(0, groundY - 18, leftW, 9); sand.endFill();
            sand.beginFill(0xe0b88a); sand.drawRect(0, groundY - 18, leftW, 2); sand.endFill();
        }
        if (rightW > 0) {
            sand.beginFill(0xc2956a); sand.drawRect(rightX, groundY - 18, rightW, 18); sand.endFill();
            sand.beginFill(0xd4a574); sand.drawRect(rightX, groundY - 18, rightW, 9); sand.endFill();
            sand.beginFill(0xe0b88a); sand.drawRect(rightX, groundY - 18, rightW, 2); sand.endFill();
        }
        // Road dashed centerline (skip building footprint)
        for (let mx = 0; mx < G.vpW; mx += 40) {
            if (mx + 20 < startX || mx > startX + bldW) {
                sand.beginFill(0xd4a574, 0.4); sand.drawRect(mx, groundY + 12, 20, 3); sand.endFill();
            }
        }
        // Sand texture dots scattered across flanks
        const sandRng = this._sandSeed(bld.x | 0);
        for (let i = 0; i < 80; i++) {
            const sx = sandRng() * G.vpW;
            if (sx > startX - 8 && sx < startX + bldW + 8) continue;
            const sy = groundY - 16 + sandRng() * 14;
            sand.beginFill(sandRng() > 0.5 ? 0xb8895e : 0xdabc8e, 0.3);
            sand.drawRect(sx, sy, 1 + sandRng() * 2, 1);
            sand.endFill();
        }
        this.scene.addChild(sand);

        // ─── DESERT UNDERGROUND STACK (space profile) ───
        const basementBottom = roofH + (numFloors + 1) * floorH;
        const undergroundY = basementBottom + 2;
        if (typeof Underground !== 'undefined') {
            const ug = new PIXI.Graphics();
            Underground.drawBasementStack(ug, 0, undergroundY, G.vpW, undergroundH, 'space', (bld.x | 0));
            this.scene.addChild(ug);
            // Final dark fill below
            const fill = new PIXI.Graphics();
            fill.beginFill(0x080503);
            fill.drawRect(0, undergroundY + undergroundH, G.vpW, 2000);
            fill.endFill();
            this.scene.addChild(fill);
        }

        // Position scene — bottom of basement floor sits near viewport bottom
        // (underground extends below; user scrolls down to expose it)
        const bottomPadding = 56;
        this.scene.y = G.vpH - bottomPadding - this.totalH + (floorH + undergroundH);
        // Scroll bounds: up to expose roof+sky, down to expose full underground stack
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + undergroundH + floorH;
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

        // Shared sky/sun/moon/stars logic — keeps in sync with all other interiors
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
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

    // Deterministic PRNG seeded by building world-X — keeps sand texture stable per visit.
    _sandSeed(seed) {
        let s = (seed | 0) || 7;
        return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    },

    // ════════════════════════════════════════════════════
    //   ROOFTOP FEATURES — type-specific silhouettes that mirror the exterior
    // ════════════════════════════════════════════════════
    _drawRoofFeatures(parent, bld, startX, bldW, roofH, colHex) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        if (bld.type === 'mission_control') {
            // Satellite dish on roof (centered, mirrors exterior)
            const cx = startX + bldW / 2;
            g.beginFill(0xf1f5f9);
            g.drawPolygon([cx - 22, roofH - 30, cx, roofH - 50, cx + 22, roofH - 30]);
            g.endFill();
            g.beginFill(0x94a3b8);
            g.drawRect(cx - 2, roofH - 30, 4, 14);
            g.endFill();
            // Receiver tip
            g.beginFill(0x22d3ee);
            g.drawCircle(cx, roofH - 48, 2);
            g.endFill();
            // Signal arcs
            g.lineStyle(1, 0x22d3ee, 0.3);
            g.drawCircle(cx, roofH - 50, 8);
            g.drawCircle(cx, roofH - 50, 14);
            g.lineStyle(0);
        } else if (bld.type === 'tracking') {
            // Multiple dish array on roof (mirrors exterior)
            [-50, -16, 18, 52].forEach((off, i) => {
                const dx = startX + bldW / 2 + off;
                // Dish (triangle)
                g.beginFill(0xf1f5f9);
                g.drawPolygon([dx - 12, roofH - 30, dx, roofH - 46, dx + 12, roofH - 30]);
                g.endFill();
                // Mast
                g.beginFill(0x94a3b8);
                g.drawRect(dx - 1, roofH - 30, 2, 12);
                g.endFill();
                // Signal arc
                g.lineStyle(1, 0x22d3ee, 0.3 + (i % 2) * 0.2);
                g.drawCircle(dx, roofH - 48, 5);
                g.drawCircle(dx, roofH - 48, 9);
                g.lineStyle(0);
            });
        } else if (bld.type === 'assembly') {
            // VAB-style flag stripe (mirrors exterior NASA homage)
            const cx = startX + bldW / 2;
            g.beginFill(0x1e40af);
            g.drawRect(cx - 38, roofH - 60, 76, 28);
            g.endFill();
            g.beginFill(0xef4444);
            for (let sy = roofH - 56; sy < roofH - 32; sy += 6) {
                g.drawRect(cx - 36, sy, 72, 3);
            }
            g.endFill();
            g.beginFill(0xffffff);
            g.drawRect(cx - 36, roofH - 58, 26, 12);
            g.endFill();
            // Star dots in canton
            g.beginFill(0x1e40af);
            for (let sx = cx - 33; sx < cx - 12; sx += 6) {
                for (let sy = roofH - 56; sy < roofH - 48; sy += 4) {
                    g.drawRect(sx, sy, 1.5, 1.5);
                }
            }
            g.endFill();
        } else if (bld.type === 'launchpad') {
            // Gantry tower silhouette behind the building
            const cx = startX + bldW / 2;
            // Twin tower legs
            g.beginFill(0x475569);
            g.drawRect(cx - 18, roofH - 80, 5, 50);
            g.drawRect(cx + 13, roofH - 80, 5, 50);
            g.endFill();
            // Cross beams
            g.beginFill(0x64748b);
            for (let by = roofH - 75; by < roofH - 30; by += 8) {
                g.drawRect(cx - 18, by, 36, 2);
            }
            g.endFill();
            // Swing arm (red)
            g.beginFill(0xef4444);
            g.drawRect(cx + 18, roofH - 60, 20, 3);
            g.endFill();
            // Top antenna
            g.beginFill(0xfacc15);
            g.drawCircle(cx, roofH - 84, 2);
            g.endFill();
        }
        parent.addChild(g);
    },

    // ════════════════════════════════════════════════════
    //   BASEMENT PROPS — type-specific industrial sub-level
    // ════════════════════════════════════════════════════
    _drawBasementProps(c, bld, startX, bldW, fy, floorH, colHex) {
        const g = new PIXI.Graphics(); g.eventMode = 'none';
        // Concrete floor with hazard stripes (common to all)
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(startX + 6, fy + floorH - 12, bldW - 12, 8);
        g.endFill();
        for (let i = 0; i < Math.floor(bldW / 22); i++) {
            g.beginFill((i % 2 === 0) ? 0xfbbf24 : 0x1a1a2e, 0.4);
            g.drawRect(startX + 8 + i * 22, fy + floorH - 4, 18, 2);
            g.endFill();
        }
        const labelTxt = (bld.type === 'launchpad'      ? 'B1 · FLAME TRENCH & FUEL LINES' :
                         bld.type === 'mission_control' ? 'B1 · BACKUP POWER & COOLING'   :
                         bld.type === 'assembly'        ? 'B1 · TRANSPORTER CRAWLER BAY'  :
                         bld.type === 'tracking'        ? 'B1 · COOLED SIGNAL VAULT'      :
                                                          'B1 · SUB-LEVEL');
        const lbl = new PIXI.Text(labelTxt, {
            fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x64748b, letterSpacing: 1
        });
        lbl.x = startX + 8; lbl.y = fy + 4;
        lbl.alpha = 0.7;
        c.addChild(g, lbl);

        if (bld.type === 'launchpad') {
            // Flame trench — angled black void with ducting
            const tx = startX + bldW / 2 - 60;
            g.beginFill(0x000000);
            g.drawPolygon([tx, fy + 18, tx + 120, fy + 18, tx + 100, fy + floorH - 14, tx + 20, fy + floorH - 14]);
            g.endFill();
            g.beginFill(0xfbbf24, 0.15);
            g.drawPolygon([tx + 10, fy + 22, tx + 110, fy + 22, tx + 95, fy + floorH - 18, tx + 25, fy + floorH - 18]);
            g.endFill();
            // Fuel pipes flanking
            g.beginFill(0x0369a1);
            g.drawRect(startX + 30, fy + 30, bldW - 60, 5);
            g.endFill();
            g.beginFill(0x0284c7);
            g.drawRect(startX + 30, fy + 31, bldW - 60, 2);
            g.endFill();
            g.beginFill(0xb45309);
            g.drawRect(startX + 30, fy + 50, bldW - 60, 5);
            g.endFill();
            // Junction valves
            for (let vx = startX + 60; vx < startX + bldW - 40; vx += 200) {
                g.beginFill(0x334155); g.drawRect(vx, fy + 26, 12, 12); g.endFill();
                g.beginFill(0xef4444); g.drawCircle(vx + 6, fy + 32, 2); g.endFill();
            }
        } else if (bld.type === 'mission_control') {
            // Backup generator banks + cooling ducts
            for (let i = 0; i < 5; i++) {
                const gx = startX + 30 + i * 100;
                if (gx + 70 > startX + bldW - 20) break;
                // Generator
                g.beginFill(0x334155); g.drawRect(gx, fy + 24, 60, 36); g.endFill();
                g.beginFill(0x1f2937); g.drawRect(gx + 4, fy + 28, 52, 28); g.endFill();
                // Vents
                for (let vy = fy + 32; vy < fy + 55; vy += 4) {
                    g.beginFill(0x0f172a); g.drawRect(gx + 8, vy, 44, 2); g.endFill();
                }
                // Status LED
                g.beginFill(0x4ade80); g.drawCircle(gx + 56, fy + 28, 2); g.endFill();
            }
            // Cooling pipe overhead
            g.beginFill(0x0369a1); g.drawRect(startX + 20, fy + 12, bldW - 40, 6); g.endFill();
            g.beginFill(0x0284c7); g.drawRect(startX + 20, fy + 13, bldW - 40, 3); g.endFill();
        } else if (bld.type === 'assembly') {
            // Crawler transporter — wide tracked vehicle
            const cx = startX + bldW / 2;
            g.beginFill(0x4b5563); g.drawRect(cx - 140, fy + 30, 280, 26); g.endFill();
            g.beginFill(0x374151); g.drawRect(cx - 130, fy + 35, 260, 16); g.endFill();
            // Tracks (wheel rows)
            for (let trx = cx - 130; trx < cx + 130; trx += 18) {
                g.beginFill(0x1f2937); g.drawCircle(trx, fy + 56, 5); g.endFill();
                g.beginFill(0x0a0f1a); g.drawCircle(trx, fy + 56, 2); g.endFill();
            }
            // Top platform (where rocket would sit)
            g.beginFill(0x6b7280); g.drawRect(cx - 100, fy + 22, 200, 8); g.endFill();
            g.beginFill(0xfbbf24); g.drawRect(cx - 100, fy + 22, 200, 1); g.endFill();
            // Side warning markings
            g.beginFill(0xfbbf24);
            for (let mx = cx - 130; mx < cx + 130; mx += 18) {
                g.drawRect(mx, fy + 30, 8, 3);
            }
            g.endFill();
        } else if (bld.type === 'tracking') {
            // Cooled signal vault — server racks + LN2 tanks
            for (let i = 0; i < 4; i++) {
                const rx = startX + 40 + i * 110;
                if (rx + 80 > startX + bldW - 20) break;
                // Server rack
                g.beginFill(0x0a0a12); g.drawRect(rx, fy + 14, 50, 50); g.endFill();
                g.beginFill(0x111120); g.drawRect(rx + 3, fy + 17, 44, 44); g.endFill();
                for (let sy = fy + 20; sy < fy + 60; sy += 7) {
                    g.beginFill(0x1a1a30); g.drawRect(rx + 6, sy, 38, 5); g.endFill();
                    g.beginFill(0x4ade80); g.drawCircle(rx + 10, sy + 2.5, 0.8); g.endFill();
                    g.beginFill(colHex, 0.25); g.drawRect(rx + 14, sy + 1, 26, 3); g.endFill();
                }
                // LN2 tank beside rack
                g.beginFill(0xcbd5e1); g.drawRect(rx + 56, fy + 24, 20, 38); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(rx + 58, fy + 26, 16, 34); g.endFill();
                g.beginFill(0x22d3ee, 0.4); g.drawRect(rx + 60, fy + 28, 12, 10); g.endFill();
                // Frost wisps
                g.beginFill(0xffffff, 0.2); g.drawCircle(rx + 66, fy + 22, 3); g.endFill();
            }
            // Cold pipe along ceiling
            g.beginFill(0x22d3ee, 0.3); g.drawRect(startX + 20, fy + 8, bldW - 40, 4); g.endFill();
        }
        c.addChild(g);
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
