/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOTICS FACTORY INTERIOR (v1.0.0 — Assembly Line Cross-Section)
   Floor themes: chassis fab, motor integration, AI brain upload, calibration, QA walk test.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorRobotics = {
    scene: null, layer: null, bld: null,
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
        layer.removeChildren();

        const layout = this.LAYOUTS[bld.id] || { roofLabel: bld.name.toUpperCase(), col: 0xec4899, floors: ['Operations'] };
        const W = G.vpW, H = G.vpH;
        const floorH = 75;
        const bldW = Math.min(W - 80, 800);
        const startX = (W - bldW) / 2;
        const floors = layout.floors;
        const numFloors = floors.length;
        this.totalH = numFloors * floorH + 60;

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // Scrollable offset
        this.maxY = 0;
        this.minY = Math.min(0, -(this.totalH - H + 40));

        const baseY = H - 30;

        // ─── DRAW FLOORS ───
        for (let fi = 0; fi < numFloors; fi++) {
            const floorY = baseY - (fi + 1) * floorH;
            const floorName = floors[fi];

            // Floor slab
            const slab = new PIXI.Graphics();
            slab.beginFill(0x0d1220);
            slab.drawRect(startX, floorY, bldW, floorH);
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

        // ─── GROUND ───
        const ground = new PIXI.Graphics();
        ground.beginFill(0x0a0a14);
        ground.drawRect(0, baseY, W, H - baseY + 20);
        ground.endFill();
        this.scene.addChild(ground);

        // ─── SPAWN INTERIOR NPCs ───
        this._spawnNPCs(this.scene, startX, bldW, baseY, floorH, numFloors, layout);

        // ─── Y-AXIS SCROLLING ───
        this._onDown = (e) => {
            if (e.target.closest('#btnExitInterior')) return;
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
        const dp = G.getDayPhase();
        const isWork = dp > 0.33 && dp < 0.75;
        if (!isWork) return;

        // Place 2-3 NPCs per floor
        for (let fi = 0; fi < numFloors; fi++) {
            const floorY = baseY - (fi + 1) * floorH;
            const npcsOnFloor = 2 + Math.floor(Math.random() * 2);

            for (let ni = 0; ni < npcsOnFloor; ni++) {
                const nx = sx + 50 + ni * (bw / (npcsOnFloor + 1));
                const ny = floorY + floorH - 8;

                const npc = new PIXI.Graphics();
                const col = layout.col;
                // Head
                npc.beginFill(0xffcc88);
                npc.drawCircle(nx, ny - 12, 3);
                npc.endFill();
                // Body
                npc.beginFill(col, 0.7);
                npc.drawRect(nx - 3, ny - 9, 6, 7);
                npc.endFill();
                // Hard hat
                npc.beginFill(0xfbbf24);
                npc.drawRect(nx - 4, ny - 16, 8, 3);
                npc.endFill();

                cont.addChild(npc);
            }
        }
    },

    update() {
        // Static interior — no per-frame updates needed
    }
};
