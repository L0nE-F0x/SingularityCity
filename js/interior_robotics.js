/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOTICS FACTORY INTERIOR (v1.0.0 — Assembly Line Cross-Section)
   Floor themes: chassis fab, motor integration, AI brain upload, calibration, QA walk test.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorRobotics = {
    scene: null, layer: null, bld: null, avatars: [], bubbles: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0,
    minY: 0, maxY: 0, totalH: 0,

    LAYOUTS: {
        'robotics_assembly': {
            roofLabel: 'ROBOTICS ASSEMBLY LINE',
            col: 0xec4899,
            floors: ['Finished Goods Bay', 'Calibration Station', 'AI Brain Upload', 'Motor Integration', 'Chassis Fabrication']
        },
        'robotics_testing': {
            roofLabel: 'TESTING GROUND',
            col: 0x06b6d4,
            floors: ['Endurance Run', 'Obstacle Course', 'Walk Test Chamber']
        },
        'robotics_deploy': {
            roofLabel: 'DEPLOYMENT DOCK',
            col: 0x10b981,
            floors: ['Loading Bay', 'Packaging', 'QA Final Check']
        },
        'robotics_rd': {
            roofLabel: 'R&D LABORATORY',
            col: 0x8b5cf6,
            floors: ['Morphology Lab', 'Actuator R&D', 'Sensor Fusion', 'Embodied AI']
        }
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.avatars = [];
        this.bubbles = [];
        layer.removeChildren();

        const layout = this.LAYOUTS[bld.id] || { roofLabel: bld.name.toUpperCase(), col: 0xec4899, floors: ['Operations'] };
        const W = G.vpW, H = G.vpH;
        const floorH = 75;
        const bldW = Math.min(W - 80, 800);
        const startX = (W - bldW) / 2;
        const floors = layout.floors;
        const numFloors = floors.length;
        // Added ~220px for themed basement + zone underground stack below ground
        this.totalH = numFloors * floorH + 60 + floorH + 220;

        // ─── SKY LAYER (behind scene — DOM sky shows through window cutouts) ───
        if (typeof InteriorCity !== 'undefined' && InteriorCity._createSkyLayer) {
            const sky = InteriorCity._createSkyLayer(layer, 70);
            this.skyContainer = sky.skyContainer;
            this.starsLayer = sky.starsLayer;
            this.celestialGfx = sky.celestialGfx;
        }

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // Scrollable offset
        this.maxY = 0;
        this.minY = Math.min(0, -(this.totalH - H + 40));

        const baseY = H - 30;

        // Window band constants for punched-out cutouts
        const winMarginX = 40;
        const winY_off = 12;
        const winH_px = floorH - 26;
        const mullionPitch = 60;
        const mullionW = 6;

        // ─── DRAW FLOORS ───
        for (let fi = 0; fi < numFloors; fi++) {
            const floorY = baseY - (fi + 1) * floorH;
            const floorName = floors[fi];

            // Floor slab with punched window cutout — DOM sky shows through
            const slab = new PIXI.Graphics();
            const wallCol = 0x0d1220;
            const winX = startX + winMarginX;
            const winW = bldW - winMarginX * 2;
            const winY = floorY + winY_off;
            InteriorCity._drawWallWithWindowCutout(
                slab, wallCol,
                startX, floorY, bldW, floorH,
                winX, winY, winW, winH_px,
                mullionPitch, mullionW
            );
            // Window frame (stroked, no fill)
            slab.lineStyle(1.5, 0x1e293b, 0.9);
            slab.drawRect(winX, winY, winW, winH_px);
            slab.moveTo(winX, winY + winH_px * 0.5);
            slab.lineTo(winX + winW, winY + winH_px * 0.5);
            slab.lineStyle(0);
            // Subtle factory-tint glazing hint
            slab.beginFill(layout.col, 0.04);
            slab.drawRect(winX, winY, winW, winH_px);
            slab.endFill();
            // Floor border
            slab.lineStyle(1, layout.col, 0.15);
            slab.drawRect(startX, floorY, bldW, floorH);

            // Floor label
            const label = new PIXI.Text(floorName.toUpperCase(), {
                fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
                fill: layout.col, letterSpacing: 1
            });
            label.x = startX + 8;
            label.y = floorY + 4;
            label.alpha = 0.6;

            this.scene.addChild(slab, label);

            // Floor-specific props
            this._drawFloorProps(this.scene, startX, bldW, floorY, floorH, floorName, layout.col, bld.id);
        }

        // ─── ROOF ───
        const roofY = baseY - numFloors * floorH - 20;
        const roof = new PIXI.Graphics();
        roof.beginFill(layout.col, 0.15);
        roof.drawRect(startX, roofY, bldW, 20);
        roof.endFill();

        const roofText = new PIXI.Text(layout.roofLabel, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 9,
            fill: layout.col, letterSpacing: 2
        });
        roofText.x = startX + bldW / 2 - roofText.width / 2;
        roofText.y = roofY + 4;
        this.scene.addChild(roof, roofText);

        // ─── BASEMENT (B1) ───
        const basementY = baseY;
        const basementSlab = new PIXI.Graphics();
        basementSlab.beginFill(0x0a0f1a);
        basementSlab.drawRect(startX, basementY, bldW, floorH);
        basementSlab.endFill();
        basementSlab.lineStyle(1, layout.col, 0.1);
        basementSlab.drawRect(startX, basementY, bldW, floorH);
        basementSlab.beginFill(layout.col, 0.06);
        basementSlab.drawRect(startX, basementY, bldW, 2);
        basementSlab.endFill();
        this.scene.addChild(basementSlab);

        const basementLabel = new PIXI.Text('B1 · ' + this._basementLabel(bld.id), {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            fill: 0x64748b, letterSpacing: 1
        });
        basementLabel.x = startX + 8;
        basementLabel.y = basementY + 4;
        basementLabel.alpha = 0.7;
        this.scene.addChild(basementLabel);

        this._drawBasementProps(this.scene, startX, bldW, basementY, floorH, bld.id, layout.col);

        // ─── ZONE-AWARE UNDERGROUND ───
        // Robotics district is past the metro terminus → east_rock zone per _determineZone
        const surfaceY = baseY;
        const belowBasementY = baseY + floorH;
        if (typeof InteriorCity !== 'undefined' && InteriorCity._drawZoneUnderground) {
            InteriorCity._drawZoneUnderground.call(InteriorCity, this.scene, bld, startX, bldW, surfaceY, belowBasementY, floorH);
        }

        // ─── GROUND (fills sides beyond the building footprint) ───
        const ground = new PIXI.Graphics();
        ground.beginFill(0x0a0a14);
        ground.drawRect(0, baseY, startX, H - baseY + 20);
        ground.drawRect(startX + bldW, baseY, W - (startX + bldW), H - baseY + 20);
        ground.endFill();
        this.scene.addChild(ground);

        // ─── SPAWN INTERIOR NPCs ───
        this._spawnNPCs(this.scene, startX, bldW, baseY, floorH, numFloors, layout);

        // ─── Y-AXIS SCROLLING ───
        // Note: `e` is a PIXI FederatedPointerEvent — its .target is a PIXI display
        // object, not a DOM element, so we must not call .closest() on it. The exit
        // button is a DOM element overlaid outside the canvas, so it can't fire here.
        this._onDown = (e) => {
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
        };
        this._onMove = (e) => {
            if (!this.isDragging) return;
            const dy = e.clientY - this._startY;
            this.scene.y = Math.max(this.minY, Math.min(this.maxY, this._startSceneY + dy));
        };
        this._onUp = () => { this.isDragging = false; };

        layer.eventMode = 'static';
        layer.on('pointerdown', this._onDown);
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    _basementLabel(bldId) {
        return {
            'robotics_assembly': 'PARTS WAREHOUSE',
            'robotics_testing':  'CRASH-TEST PIT',
            'robotics_deploy':   'SHIPPING DOCK',
            'robotics_rd':       'PROTOTYPE GRAVEYARD'
        }[bldId] || 'SUB-LEVEL';
    },

    _drawBasementProps(cont, sx, bw, fy, fh, bldId, col) {
        const g = new PIXI.Graphics();
        // Concrete floor strip with hazard stripes
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(sx + 6, fy + fh - 10, bw - 12, 8);
        g.endFill();
        for (let i = 0; i < Math.floor(bw / 18); i++) {
            g.beginFill((i % 2 === 0) ? 0xfbbf24 : 0x1a1a2e, 0.35);
            g.drawRect(sx + 8 + i * 18, fy + fh - 3, 16, 2);
            g.endFill();
        }
        cont.addChild(g);

        if (bldId === 'robotics_assembly') {
            // Parts warehouse — tall racks with chassis / arms / wheels crates
            for (let i = 0; i < 6; i++) {
                const rack = new PIXI.Graphics();
                rack.beginFill(0x374151);
                rack.drawRect(0, 0, 52, fh - 18);
                rack.endFill();
                for (let shelf = 0; shelf < 4; shelf++) {
                    const shY = 6 + shelf * 14;
                    // Shelf plank
                    rack.beginFill(0x64748b);
                    rack.drawRect(2, shY, 48, 2);
                    rack.endFill();
                    // Parts boxes
                    const partCol = [0xec4899, 0x06b6d4, 0xfbbf24, 0x8b5cf6][shelf];
                    rack.beginFill(partCol, 0.5);
                    rack.drawRect(4, shY - 10, 12, 10);
                    rack.drawRect(20, shY - 8, 10, 8);
                    rack.drawRect(34, shY - 11, 14, 11);
                    rack.endFill();
                }
                rack.x = sx + 15 + i * ((bw - 30) / 6);
                rack.y = fy + 10;
                cont.addChild(rack);
            }
            // Forklift
            const fl = new PIXI.Graphics();
            fl.beginFill(0xfbbf24);
            fl.drawRect(0, 18, 30, 16);
            fl.endFill();
            fl.beginFill(0x1a1a2e);
            fl.drawCircle(6, 36, 4);
            fl.drawCircle(26, 36, 4);
            fl.endFill();
            // Mast
            fl.beginFill(0x334155);
            fl.drawRect(28, 0, 3, 30);
            fl.drawRect(34, 0, 3, 30);
            // Forks
            fl.drawRect(28, 30, 14, 2);
            fl.endFill();
            fl.x = sx + bw * 0.55;
            fl.y = fy + fh - 38;
            cont.addChild(fl);
        } else if (bldId === 'robotics_testing') {
            // Crash-test pit — padded walls, dummies, impact sled
            // Padded walls
            const pad = new PIXI.Graphics();
            pad.beginFill(0xef4444, 0.3);
            for (let i = 0; i < 12; i++) {
                pad.drawRect(sx + 8 + i * ((bw - 16) / 12), fy + 10, ((bw - 16) / 12) - 2, 12);
            }
            pad.endFill();
            cont.addChild(pad);
            // Yellow impact track
            const track = new PIXI.Graphics();
            track.beginFill(0xfbbf24, 0.2);
            track.drawRect(sx + 10, fy + fh - 22, bw - 20, 10);
            track.endFill();
            track.lineStyle(1, 0xfbbf24, 0.7);
            for (let i = 0; i < 20; i++) {
                track.moveTo(sx + 12 + i * ((bw - 24) / 20), fy + fh - 17);
                track.lineTo(sx + 12 + i * ((bw - 24) / 20) + 6, fy + fh - 17);
            }
            track.lineStyle(0);
            cont.addChild(track);
            // Crash dummy robots in various poses
            for (let i = 0; i < 4; i++) {
                const d = new PIXI.Graphics();
                d.beginFill(0xc0c0d0, 0.5);
                d.drawRect(0, 0, 9, 8); // head
                d.drawRect(-2, 8, 13, 16); // torso
                d.endFill();
                d.beginFill(0xef4444, 0.7);
                d.drawRect(-2, 12, 13, 2); // red stripe
                d.endFill();
                d.beginFill(0x64748b);
                d.drawRect(-1, 24, 4, 10);
                d.drawRect(6, 24, 4, 10);
                d.endFill();
                // Randomly tilted
                d.rotation = (i - 2) * 0.15;
                d.x = sx + 30 + i * ((bw - 60) / 4);
                d.y = fy + fh - 46;
                cont.addChild(d);
            }
            // Impact sled
            const sled = new PIXI.Graphics();
            sled.beginFill(0x475569);
            sled.drawRect(0, 0, 40, 14);
            sled.endFill();
            sled.beginFill(0xef4444);
            sled.drawRect(36, 2, 6, 10);
            sled.endFill();
            sled.x = sx + 10;
            sled.y = fy + fh - 22;
            cont.addChild(sled);
        } else if (bldId === 'robotics_deploy') {
            // Shipping dock — loading bay doors, pallets stacked with shrink-wrapped robots, truck rear
            // Roll-up door sections at back wall
            const door = new PIXI.Graphics();
            door.beginFill(0x334155);
            for (let s = 0; s < 6; s++) {
                door.drawRect(sx + 15, fy + 8 + s * 6, bw * 0.45, 4);
            }
            door.endFill();
            door.lineStyle(2, 0x10b981, 0.4);
            door.drawRect(sx + 12, fy + 6, bw * 0.45 + 6, 40);
            door.lineStyle(0);
            cont.addChild(door);
            // Truck rear backed into dock
            const truck = new PIXI.Graphics();
            truck.beginFill(0x1e293b);
            truck.drawRect(sx + bw * 0.6, fy + 10, bw * 0.35, fh - 28);
            truck.endFill();
            truck.beginFill(0x10b981, 0.3);
            truck.drawRect(sx + bw * 0.62, fy + 14, 40, 20);
            truck.endFill();
            truck.beginFill(0x64748b);
            truck.drawCircle(sx + bw * 0.65, fy + fh - 14, 5);
            truck.drawCircle(sx + bw * 0.88, fy + fh - 14, 5);
            truck.endFill();
            cont.addChild(truck);
            // Pallets of shrink-wrapped robots waiting to load
            for (let i = 0; i < 4; i++) {
                const p = new PIXI.Graphics();
                // Pallet
                p.beginFill(0x78350f);
                p.drawRect(0, 22, 40, 6);
                p.endFill();
                // Shrink-wrapped stack
                p.beginFill(0xbae6fd, 0.4);
                p.drawRect(2, 0, 36, 22);
                p.endFill();
                // Robot silhouette through wrap
                p.beginFill(0x64748b, 0.5);
                p.drawRect(8, 4, 8, 6);
                p.drawRect(5, 10, 14, 10);
                p.endFill();
                p.x = sx + 18 + i * 44;
                p.y = fy + fh - 34;
                cont.addChild(p);
            }
        } else if (bldId === 'robotics_rd') {
            // Prototype graveyard — stacked failed prototypes, shelves of spare parts, whiteboard with sketches
            // Whiteboard
            const wb = new PIXI.Graphics();
            wb.beginFill(0xf8fafc);
            wb.drawRect(0, 0, 80, 36);
            wb.endFill();
            wb.lineStyle(1, 0x8b5cf6, 0.6);
            wb.moveTo(8, 10); wb.lineTo(22, 20); wb.lineTo(18, 28); wb.lineTo(30, 30);
            wb.moveTo(40, 8); wb.drawCircle(46, 14, 4);
            wb.moveTo(55, 20); wb.lineTo(72, 20); wb.lineTo(68, 30);
            wb.lineStyle(0);
            wb.x = sx + 12;
            wb.y = fy + 10;
            cont.addChild(wb);
            // Dismantled prototypes piled up
            for (let i = 0; i < 5; i++) {
                const proto = new PIXI.Graphics();
                const tilt = (i - 2) * 0.25;
                proto.beginFill(0x64748b, 0.5);
                proto.drawRect(0, 0, 14, 12); // head
                proto.endFill();
                proto.beginFill(0x475569, 0.5);
                proto.drawRect(-3, 12, 20, 20); // torso
                proto.endFill();
                // Exposed wires
                proto.lineStyle(1, [0xef4444, 0xfbbf24, 0x22d3ee][i % 3], 0.7);
                proto.moveTo(2, 32); proto.lineTo(5, 38);
                proto.moveTo(8, 32); proto.lineTo(11, 40);
                proto.lineStyle(0);
                // Missing eye / cracked screen
                proto.beginFill(0x0f172a);
                proto.drawRect(2, 3, 4, 4);
                proto.endFill();
                proto.beginFill(0xef4444, 0.8);
                proto.drawRect(8, 3, 4, 4);
                proto.endFill();
                proto.rotation = tilt;
                proto.x = sx + 110 + i * 36;
                proto.y = fy + fh - 44;
                cont.addChild(proto);
            }
            // Spare parts shelves at far right
            for (let shelf = 0; shelf < 3; shelf++) {
                const sh = new PIXI.Graphics();
                sh.beginFill(0x374151);
                sh.drawRect(0, 0, 70, 3);
                sh.endFill();
                // Junk on shelf
                for (let j = 0; j < 4; j++) {
                    sh.beginFill([0x8b5cf6, 0xec4899, 0xfbbf24, 0x06b6d4][j], 0.4);
                    sh.drawRect(4 + j * 16, -8, 10, 8);
                    sh.endFill();
                }
                sh.x = sx + bw - 90;
                sh.y = fy + 18 + shelf * 16;
                cont.addChild(sh);
            }
        }
    },

    _drawFloorProps(cont, sx, bw, fy, fh, floorName, col, bldId) {
        const g = new PIXI.Graphics();
        const fn = floorName.toLowerCase();

        if (fn.includes('chassis')) {
            // Welding stations with robot arms
            for (let rx = sx + 40; rx < sx + bw - 60; rx += 100) {
                // Workbench
                g.beginFill(0x1a2540);
                g.drawRect(rx, fy + fh - 22, 70, 12);
                g.endFill();
                // Robot arm base
                g.beginFill(0x4a5568);
                g.drawRect(rx + 28, fy + 18, 14, fh - 40);
                g.endFill();
                // Arm joint
                g.beginFill(col, 0.5);
                g.drawCircle(rx + 35, fy + 22, 4);
                g.endFill();
                // Sparks
                g.beginFill(0xfbbf24, 0.7);
                g.drawCircle(rx + 35, fy + fh - 26, 2);
                g.drawCircle(rx + 32, fy + fh - 28, 1.5);
                g.drawCircle(rx + 38, fy + fh - 24, 1);
                g.endFill();
                // Partial robot on bench
                g.beginFill(0x8890a0, 0.5);
                g.drawRect(rx + 10, fy + fh - 30, 20, 8);
                g.endFill();
            }
        } else if (fn.includes('motor')) {
            // Motor testing rigs
            for (let rx = sx + 30; rx < sx + bw - 50; rx += 90) {
                // Rig frame
                g.beginFill(0x1e293b);
                g.drawRect(rx, fy + 15, 60, fh - 25);
                g.endFill();
                // Motor coils (circles)
                g.lineStyle(2, 0xf97316, 0.5);
                g.drawCircle(rx + 30, fy + 35, 12);
                g.lineStyle(1, 0xfbbf24, 0.3);
                g.drawCircle(rx + 30, fy + 35, 8);
                g.lineStyle(0);
                // Power indicator
                g.beginFill(0x4ade80, 0.8);
                g.drawCircle(rx + 50, fy + 20, 2);
                g.endFill();
            }
        } else if (fn.includes('brain') || fn.includes('upload')) {
            // Server racks for AI upload
            for (let rx = sx + 25; rx < sx + bw - 30; rx += 55) {
                g.beginFill(0x0f172a);
                g.drawRect(rx, fy + 12, 40, fh - 20);
                g.endFill();
                // Blinking LEDs
                for (let ly = 0; ly < 5; ly++) {
                    const ledCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0x8b5cf6][ly % 4];
                    g.beginFill(ledCol, 0.7);
                    g.drawRect(rx + 4, fy + 18 + ly * 10, 3, 2);
                    g.drawRect(rx + 33, fy + 18 + ly * 10, 3, 2);
                    g.endFill();
                }
                // Data cable
                g.lineStyle(1, 0x8b5cf6, 0.3);
                g.moveTo(rx + 20, fy + fh - 8);
                g.lineTo(rx + 20, fy + fh + 2);
                g.lineStyle(0);
            }
        } else if (fn.includes('calibration')) {
            // Laser grid calibration chamber
            g.lineStyle(1, 0xf43f5e, 0.15);
            for (let lx = sx + 30; lx < sx + bw - 20; lx += 40) {
                g.moveTo(lx, fy + 10);
                g.lineTo(lx, fy + fh - 5);
            }
            for (let ly = fy + 20; ly < fy + fh; ly += 15) {
                g.moveTo(sx + 20, ly);
                g.lineTo(sx + bw - 20, ly);
            }
            g.lineStyle(0);
            // Robot silhouette in center
            const cx = sx + bw / 2;
            g.beginFill(0xc0c0d0, 0.3);
            g.drawRect(cx - 5, fy + 20, 10, 8); // head
            g.drawRect(cx - 7, fy + 28, 14, 14); // torso
            g.drawRect(cx - 5, fy + 42, 4, 10); // legs
            g.drawRect(cx + 1, fy + 42, 4, 10);
            g.endFill();
        } else if (fn.includes('finished') || fn.includes('goods')) {
            // Rows of completed robots standing in bays
            for (let rx = sx + 35; rx < sx + bw - 25; rx += 40) {
                const robotCol = [0xe82127, 0x3b82f6, 0x06b6d4, 0xf59e0b, 0x8b5cf6][Math.floor((rx - sx) / 40) % 5];
                // Standing robot
                g.beginFill(0xc0c0d0, 0.6);
                g.drawRect(rx, fy + 18, 8, 7); // head
                g.endFill();
                g.beginFill(0x8890a0, 0.6);
                g.drawRect(rx - 2, fy + 25, 12, 14); // torso
                g.endFill();
                g.beginFill(robotCol, 0.4);
                g.drawRect(rx, fy + 28, 8, 3); // color stripe
                g.endFill();
                g.beginFill(0x607080, 0.5);
                g.drawRect(rx, fy + 39, 3, 12); // legs
                g.drawRect(rx + 5, fy + 39, 3, 12);
                g.endFill();
                // Bay divider
                g.beginFill(0x1a2540, 0.3);
                g.drawRect(rx + 16, fy + 12, 2, fh - 18);
                g.endFill();
            }
        } else if (fn.includes('walk test') || fn.includes('obstacle')) {
            // Obstacle course elements
            // Ramps
            g.beginFill(0x334155, 0.5);
            g.moveTo(sx + 60, fy + fh - 8);
            g.lineTo(sx + 100, fy + fh - 8);
            g.lineTo(sx + 100, fy + fh - 25);
            g.closePath();
            g.endFill();
            // Hurdles
            for (let hx = sx + 150; hx < sx + bw - 100; hx += 80) {
                g.beginFill(0x475569, 0.6);
                g.drawRect(hx, fy + fh - 20, 4, 14);
                g.drawRect(hx + 25, fy + fh - 20, 4, 14);
                g.drawRect(hx - 2, fy + fh - 22, 33, 3);
                g.endFill();
            }
            // Finish line
            g.beginFill(0x4ade80, 0.3);
            g.drawRect(sx + bw - 50, fy + 10, 4, fh - 15);
            g.endFill();
        } else if (fn.includes('endurance')) {
            // Treadmill stations
            for (let tx = sx + 40; tx < sx + bw - 60; tx += 100) {
                g.beginFill(0x1e293b);
                g.drawRect(tx, fy + fh - 15, 70, 10);
                g.endFill();
                // Belt lines
                g.lineStyle(1, 0x475569, 0.4);
                for (let lx = tx + 5; lx < tx + 65; lx += 8) {
                    g.moveTo(lx, fy + fh - 13);
                    g.lineTo(lx + 3, fy + fh - 7);
                }
                g.lineStyle(0);
                // Speed display
                g.beginFill(0x22d3ee, 0.5);
                g.drawRect(tx + 72, fy + fh - 25, 12, 8);
                g.endFill();
            }
        } else if (fn.includes('loading') || fn.includes('packaging')) {
            // Crates and pallets
            for (let cx = sx + 30; cx < sx + bw - 40; cx += 60) {
                g.beginFill(0x78350f, 0.5);
                g.drawRect(cx, fy + fh - 25, 35, 18);
                g.endFill();
                g.beginFill(0x92400e, 0.3);
                g.drawRect(cx + 2, fy + fh - 23, 31, 2);
                g.drawRect(cx + 2, fy + fh - 15, 31, 2);
                g.endFill();
            }
            // Truck outline (at loading bay)
            if (fn.includes('loading')) {
                const tx = sx + bw - 90;
                g.beginFill(0x1e293b, 0.6);
                g.drawRect(tx, fy + 12, 70, fh - 18);
                g.endFill();
                g.beginFill(0x10b981, 0.3);
                g.drawRect(tx + 2, fy + 14, 20, 15);
                g.endFill();
            }
        } else if (fn.includes('actuator') || fn.includes('sensor') || fn.includes('morphology') || fn.includes('embodied')) {
            // Lab benches with equipment
            for (let bx = sx + 35; bx < sx + bw - 40; bx += 80) {
                // Bench
                g.beginFill(0x1a2540);
                g.drawRect(bx, fy + fh - 20, 55, 12);
                g.endFill();
                // Microscope / equipment
                g.beginFill(0x64748b, 0.5);
                g.drawRect(bx + 10, fy + fh - 35, 6, 15);
                g.drawRect(bx + 7, fy + fh - 37, 12, 3);
                g.endFill();
                // Screens
                g.beginFill(col, 0.2);
                g.drawRect(bx + 30, fy + fh - 38, 18, 14);
                g.endFill();
                g.beginFill(col, 0.4);
                g.drawRect(bx + 32, fy + fh - 36, 14, 10);
                g.endFill();
            }
        } else if (fn.includes('qa') || fn.includes('check')) {
            // Checklist stations with green/red indicators
            for (let cx = sx + 40; cx < sx + bw - 50; cx += 70) {
                // Checkpoint station
                g.beginFill(0x1e293b);
                g.drawRect(cx, fy + 15, 50, fh - 25);
                g.endFill();
                // Green/red lights
                for (let li = 0; li < 4; li++) {
                    const pass = Math.random() > 0.15;
                    g.beginFill(pass ? 0x4ade80 : 0xf43f5e, 0.7);
                    g.drawCircle(cx + 25, fy + 22 + li * 12, 3);
                    g.endFill();
                }
            }
        }

        cont.addChild(g);
    },

    _spawnNPCs(cont, sx, bw, baseY, floorH, numFloors, layout) {
        // NPCs populate every floor regardless of hour — factory runs 24/7 on skeleton crew at night.
        for (let fi = 0; fi < numFloors; fi++) {
            const floorY = baseY - (fi + 1) * floorH;
            const ny = floorY + floorH - 8;
            const floorName = layout.floors[fi];
            const floorNpcs = this._getNPCsForFloor(floorName, layout, bw);
            floorNpcs.forEach(def => {
                this.drawNPC(cont, sx + def.xOff, ny, def.role, def.col);
            });
        }
    },

    // ════════════════════════════════════════════════════
    //   FLOOR → NPC ASSIGNMENT
    // ════════════════════════════════════════════════════

    _getNPCsForFloor(floorName, layout, bw) {
        const fn = floorName.toLowerCase();
        const col = layout.col;

        if (fn.includes('chassis')) {
            return [
                { role: 'Precision Welder', col: 0xfacc15, xOff: bw * 0.25 },
                { role: 'Frame Builder',    col: 0xf97316, xOff: bw * 0.55 },
                { role: 'Mfg Tech',         col: 0xfbbf24, xOff: bw * 0.8 }
            ];
        } else if (fn.includes('motor')) {
            return [
                { role: 'Motor Engineer', col: 0xf97316, xOff: bw * 0.3 },
                { role: 'Actuator Tech',  col: 0xfbbf24, xOff: bw * 0.65 }
            ];
        } else if (fn.includes('brain') || fn.includes('upload')) {
            return [
                { role: 'AI Uploader',   col: 0x8b5cf6, xOff: bw * 0.3 },
                { role: 'Weights Eng',   col: 0x22d3ee, xOff: bw * 0.6 },
                { role: 'Neural Tuner',  col: 0xa855f7, xOff: bw * 0.85 }
            ];
        } else if (fn.includes('calibration')) {
            return [
                { role: 'Calibration Tech', col: 0x22d3ee, xOff: bw * 0.35 },
                { role: 'Sensor Eng',       col: 0x06b6d4, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('finished') || fn.includes('goods')) {
            return [
                { role: 'QA Inspector',   col: 0x4ade80, xOff: bw * 0.25 },
                { role: 'Shipping Lead',  col: 0x10b981, xOff: bw * 0.75 }
            ];
        } else if (fn.includes('walk test')) {
            return [
                { role: 'Gait Analyst',   col: 0x06b6d4, xOff: bw * 0.4 },
                { role: 'Test Engineer',  col: col,      xOff: bw * 0.75 }
            ];
        } else if (fn.includes('obstacle')) {
            return [
                { role: 'Course Designer', col: 0x06b6d4, xOff: bw * 0.3 },
                { role: 'Balance Tester',  col: 0xf43f5e, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('endurance')) {
            return [
                { role: 'Endurance Lead', col: 0x06b6d4, xOff: bw * 0.35 },
                { role: 'Battery Eng',    col: 0x4ade80, xOff: bw * 0.75 }
            ];
        } else if (fn.includes('loading') || fn.includes('bay')) {
            return [
                { role: 'Dock Foreman', col: 0x10b981, xOff: bw * 0.3 },
                { role: 'Logistics Mgr', col: 0xfbbf24, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('packaging')) {
            return [
                { role: 'Packing Tech', col: 0x10b981, xOff: bw * 0.5 }
            ];
        } else if (fn.includes('qa') || fn.includes('check')) {
            return [
                { role: 'QA Lead',        col: 0x4ade80, xOff: bw * 0.3 },
                { role: 'Final Inspect',  col: 0xf43f5e, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('morphology')) {
            return [
                { role: 'Morphology Lead', col: 0x8b5cf6, xOff: bw * 0.3 },
                { role: 'Kinematics Eng',  col: 0xa855f7, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('actuator')) {
            return [
                { role: 'Actuator R&D', col: 0xf97316, xOff: bw * 0.35 },
                { role: 'Torque Eng',   col: 0xfbbf24, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('sensor')) {
            return [
                { role: 'Sensor Fusion', col: 0x22d3ee, xOff: bw * 0.3 },
                { role: 'Lidar Eng',     col: 0x06b6d4, xOff: bw * 0.7 }
            ];
        } else if (fn.includes('embodied')) {
            return [
                { role: 'Embodied AI',   col: 0x8b5cf6, xOff: bw * 0.3 },
                { role: 'RL Researcher', col: 0xa855f7, xOff: bw * 0.7 }
            ];
        } else {
            return [{ role: 'Technician', col: col, xOff: bw * 0.5 }];
        }
    },

    // ════════════════════════════════════════════════════
    //   PIXEL ART NPC (standard avatar pattern)
    // ════════════════════════════════════════════════════

    drawNPC(c, x, y, role, col) {
        const colHex = col || 0xec4899;
        const bw = 12, h = 28, headH = 10, bodyH = h - headH - 4, legH = 4, eyeS = 1;
        const cont = new PIXI.Container();

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();

        const head = new PIXI.Graphics();
        head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw * 0.1, headH * 0.38, eyeS); head.drawCircle(bw * 0.1, headH * 0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5); head.endFill();
        // Hard hat (robotics factory signature)
        head.beginFill(0xfbbf24); head.drawRoundedRect(-bw * 0.45, -2, bw * 0.9, 3, 1); head.endFill();
        head.beginFill(0xf59e0b, 0.6); head.drawRect(-bw * 0.45, 0, bw * 0.9, 1); head.endFill();
        head.y = -h;

        const body = new PIXI.Graphics();
        body.beginFill(colHex); body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1); body.endFill();
        // Safety vest stripe
        body.beginFill(0xfef08a, 0.6); body.drawRect(-bw / 2, Math.max(bodyH, 4) * 0.4, bw, 1.5); body.endFill();
        body.y = -h + headH;

        const lw = Math.max(2, bw * 0.25), lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(0x1e293b); legL.drawRect(-lw / 2, 0, lw, lh); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics();
        legR.beginFill(0x1e293b); legR.drawRect(-lw / 2, 0, lw, lh); legR.endFill(); legR.x = bw * 0.15;

        const dot = new PIXI.Graphics();
        dot.beginFill(colHex); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;

        cont.addChild(shadow, legL, legR, body, head, dot);
        cont.x = x; cont.y = y;

        const txt = new PIXI.Text(role, { fontFamily: '"JetBrains Mono", monospace', fontSize: 6, fill: colHex });
        txt.anchor.set(0.5, 1); txt.y = -h - 8;
        cont.addChild(txt);

        cont.eventMode = 'static'; cont.cursor = 'pointer';
        cont.on('pointertap', () => { if (typeof UI !== 'undefined' && UI.addToast) UI.addToast(`${role} — Robotics Factory`); });

        c.addChild(cont);

        const agent = {
            m: { id: 'robo_' + role.replace(/\s/g, '_').toLowerCase(), name: role, isNPC: true },
            cont, head, body, legL, legR, dot, shadow, label: txt,
            state: 'working', timer: 60 + Math.floor(Math.random() * 200),
            deskX: x, floorY: y, targetX: x, speed: 0.7,
            role, _h: h
        };
        this.avatars.push(agent);
        return agent;
    },

    // ════════════════════════════════════════════════════
    //   NPC ANIMATION STATE MACHINE
    // ════════════════════════════════════════════════════

    updateAvatars() {
        const ROBOTICS_MSGS = [
            "Torque within spec.", "Chassis weld clean.", "Gait stable.",
            "Battery at 94%.", "Calibration locked.", "Sensor fusion OK.",
            "Actuator nominal.", "AI upload complete.", "Walk test passed.",
            "Ready for shipping.", "QA green.", "Embodied loop live.",
            "Morphology sweep done.", "Motor rpm nominal.", "Balance OK."
        ];

        this.avatars.forEach(av => {
            if (!av.cont || av.cont.destroyed) return;
            av.timer--;

            switch (av.state) {
                case 'working': {
                    av.head.y = -av._h + Math.sin(G.tick * 0.04 + av.deskX) * 0.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.03 + av.deskX)) * 0.3;
                    if (av.timer <= 0) {
                        const r = Math.random();
                        if (r < 0.3) {
                            av.state = 'walking';
                            av.targetX = av.deskX + (Math.random() - 0.5) * 120;
                            av.targetX = Math.max(30, Math.min(G.vpW - 30, av.targetX));
                        } else if (r < 0.5) {
                            av.state = 'chatting';
                            av.timer = 80 + Math.floor(Math.random() * 60);
                            this.spawnBubble(av, ROBOTICS_MSGS[Math.floor(Math.random() * ROBOTICS_MSGS.length)]);
                        } else {
                            av.timer = 100 + Math.floor(Math.random() * 200);
                            if (Math.random() < 0.25) {
                                this.spawnBubble(av, ROBOTICS_MSGS[Math.floor(Math.random() * ROBOTICS_MSGS.length)]);
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
                        if (av.label) av.label.scale.x = dir;
                        if (av.dot) av.dot.scale.x = dir;
                    }
                    av.head.y = -av._h + Math.sin(G.tick * 0.2) * 1.5;
                    av.body.y = -av._h + av._h * 0.36 + Math.abs(Math.sin(G.tick * 0.2)) * 1.5;
                    av.legL.y = Math.sin(G.tick * 0.3) * 3;
                    av.legR.y = -Math.sin(G.tick * 0.3) * 3;
                    break;
                }
                case 'chatting': {
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
        const txt = new PIXI.Text(msg, { fontFamily: '"JetBrains Mono", monospace', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        txt.anchor.set(0.5, 1); txt.y = -6;
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
    },

    update() {
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(this.celestialGfx, this.starsLayer);
        }
        this.updateAvatars();
    },

    cleanup() {
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
    }
};
