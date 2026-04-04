/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH INTERIORS (v1.0.0)
   Interior views for Drug Discovery Lab, Clinical Trials Center, Genomics, Cryonics Vault.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorLongevity = {
    container: null,
    scene: null,
    isDragging: false,
    _startY: 0,
    _startSceneY: 0,

    layouts: {
        'longevity_discovery': {
            floors: ['Compound Synthesis', 'Molecular Screening', 'Generative Chemistry AI', 'Target Identification', 'Lead Optimization'],
            roofLabel: 'DRUG DISCOVERY LAB',
            col: 0x22c55e,
            npcs: ['Drug Design', 'Molecular Modeling', 'Compound Synthesis']
        },
        'longevity_trials': {
            floors: ['Patient Intake', 'Phase I Safety', 'Phase II Efficacy', 'Adaptive Protocol Engine'],
            roofLabel: 'CLINICAL TRIALS CENTER',
            col: 0xec4899,
            npcs: ['Clinical Operations', 'Data Analysis']
        },
        'longevity_genomics': {
            floors: ['Sample Prep', 'Sequencing Arrays', 'Bioinformatics Pipeline', 'Epigenome Analysis'],
            roofLabel: 'GENOMICS SEQUENCING',
            col: 0x8b5cf6,
            npcs: ['Sequencing Lead', 'Pipeline Dev']
        },
        'longevity_cryo': {
            floors: ['Intake Processing', 'Vitrification Chamber', 'Deep Storage (-196°C)'],
            roofLabel: 'CRYONICS VAULT',
            col: 0x67e8f9,
            npcs: ['Preservation Ops']
        }
    },

    build(bld, layer) {
        this.container = layer;
        const layout = this.layouts[bld.id];
        if (!layout) return;

        const W = G.app.renderer.width;
        const H = G.app.renderer.height;
        const floorH = 80;
        const roofH = 36;
        const numFloors = layout.floors.length;
        const totalH = roofH + numFloors * floorH + 40;
        const startX = W * 0.12;
        const bldW = W * 0.76;

        // Scene container for scrolling
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── ROOF ───
        const roof = new PIXI.Graphics();
        roof.beginFill(0x1a1a2e);
        roof.drawRect(startX - 6, 0, bldW + 12, roofH);
        roof.endFill();
        roof.beginFill(layout.col, 0.3);
        roof.drawRect(startX, 2, bldW, 4);
        roof.endFill();
        this.scene.addChild(roof);

        const roofTxt = new PIXI.Text(layout.roofLabel, {
            fontFamily: 'monospace', fontSize: 11, fill: layout.col, fontWeight: 'bold'
        });
        roofTxt.anchor.set(0.5, 0.5);
        roofTxt.x = startX + bldW / 2;
        roofTxt.y = roofH / 2;
        this.scene.addChild(roofTxt);

        // ─── FLOORS ───
        for (let f = 0; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;

            // Floor slab
            const slab = new PIXI.Graphics();
            slab.beginFill(0x111827);
            slab.drawRect(startX, fy, bldW, floorH);
            slab.endFill();
            // Left & right walls
            slab.beginFill(0x1e293b);
            slab.drawRect(startX - 6, fy, 6, floorH);
            slab.drawRect(startX + bldW, fy, 6, floorH);
            slab.endFill();
            // Floor line
            slab.beginFill(0x334155);
            slab.drawRect(startX, fy + floorH - 2, bldW, 2);
            slab.endFill();
            // Accent
            slab.beginFill(layout.col, 0.15);
            slab.drawRect(startX, fy, bldW, 2);
            slab.endFill();
            this.scene.addChild(slab);

            // Floor label
            const floorName = layout.floors[f];
            const label = new PIXI.Text(floorName, {
                fontFamily: 'monospace', fontSize: 9, fill: 0x94a3b8
            });
            label.x = startX + 8;
            label.y = fy + 5;
            this.scene.addChild(label);

            // Floor props
            const propsContainer = new PIXI.Container();
            propsContainer.sortableChildren = true;
            propsContainer.x = startX;
            propsContainer.y = fy;
            this.scene.addChild(propsContainer);
            this._buildFloorProps(propsContainer, floorName, bldW, floorH, layout.col, bld.id);
        }

        // ─── GROUND SECTION ───
        const groundY = roofH + numFloors * floorH;
        const ground = new PIXI.Graphics();
        ground.beginFill(0x064e3b, 0.3);
        ground.drawRect(startX - 6, groundY, bldW + 12, 40);
        ground.endFill();
        this.scene.addChild(ground);

        // DNA strand decoration at bottom
        for (let i = 0; i < 20; i++) {
            const dot = new PIXI.Graphics();
            const col = i % 2 === 0 ? layout.col : 0x06b6d4;
            dot.beginFill(col, 0.4);
            dot.drawCircle(0, 0, 1.5);
            dot.endFill();
            dot.x = startX + 10 + i * ((bldW - 20) / 20);
            dot.y = groundY + 20 + Math.sin(i * 0.6) * 8;
            this.scene.addChild(dot);
        }

        // ─── Spawn interior NPCs ───
        if (layout.npcs && typeof NPCHousing !== 'undefined') {
            this._spawnInteriorNPCs(layout, numFloors, floorH, roofH, startX, bldW);
        }

        // ─── Scrolling ───
        if (totalH > H) {
            this.scene.y = H - totalH;
        }

        layer.interactive = true;
        layer.on('pointerdown', e => {
            this.isDragging = true;
            this._startY = e.data.global.y;
            this._startSceneY = this.scene.y;
        });
        layer.on('pointermove', e => {
            if (!this.isDragging) return;
            const dy = e.data.global.y - this._startY;
            const minY = H - totalH;
            this.scene.y = Math.max(minY, Math.min(0, this._startSceneY + dy));
        });
        layer.on('pointerup', () => { this.isDragging = false; });
        layer.on('pointerupoutside', () => { this.isDragging = false; });
    },

    _buildFloorProps(container, floorName, bldW, floorH, col, bldId) {
        const fn = floorName.toLowerCase();
        const midY = floorH * 0.55;

        if (fn.includes('synthesis') || fn.includes('compound')) {
            // Lab benches with flasks
            for (let i = 0; i < 4; i++) {
                const bench = new PIXI.Graphics();
                bench.beginFill(0x374151);
                bench.drawRect(0, 0, 40, 8);
                bench.endFill();
                // Flask
                bench.beginFill(0x22c55e, 0.6);
                bench.drawRect(10, -12, 6, 12);
                bench.endFill();
                bench.beginFill(0x22c55e, 0.3);
                bench.drawCircle(13, -14, 5);
                bench.endFill();
                bench.x = 20 + i * (bldW / 4.5);
                bench.y = midY;
                container.addChild(bench);
            }
        } else if (fn.includes('screening') || fn.includes('molecular')) {
            // HTS microplate arrays
            for (let i = 0; i < 3; i++) {
                const plate = new PIXI.Graphics();
                plate.beginFill(0x1e293b);
                plate.drawRect(0, 0, 50, 25);
                plate.endFill();
                // Wells grid
                for (let r = 0; r < 4; r++) {
                    for (let c = 0; c < 6; c++) {
                        const wellCol = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444][Math.floor(Math.random() * 4)];
                        plate.beginFill(wellCol, 0.5);
                        plate.drawCircle(6 + c * 7, 5 + r * 6, 2);
                        plate.endFill();
                    }
                }
                plate.x = 15 + i * (bldW / 3.5);
                plate.y = midY - 10;
                container.addChild(plate);
            }
        } else if (fn.includes('generative') || fn.includes('chemistry ai')) {
            // Server racks with neural network viz
            for (let i = 0; i < 5; i++) {
                const rack = new PIXI.Graphics();
                rack.beginFill(0x1e293b);
                rack.drawRect(0, 0, 20, 35);
                rack.endFill();
                for (let l = 0; l < 5; l++) {
                    rack.beginFill(col, 0.6);
                    rack.drawRect(3, 3 + l * 6, 14, 4);
                    rack.endFill();
                }
                rack.x = 15 + i * (bldW / 5.5);
                rack.y = midY - 15;
                container.addChild(rack);
            }
        } else if (fn.includes('target')) {
            // Protein structure display
            for (let i = 0; i < 3; i++) {
                const screen = new PIXI.Graphics();
                screen.beginFill(0x0f172a);
                screen.drawRect(0, 0, 55, 35);
                screen.endFill();
                screen.lineStyle(1, col, 0.5);
                // Ribbon diagram hint
                for (let s = 0; s < 6; s++) {
                    screen.moveTo(5 + s * 8, 8 + Math.sin(s) * 10);
                    screen.lineTo(5 + (s + 1) * 8, 8 + Math.sin(s + 1) * 10);
                }
                screen.x = 15 + i * (bldW / 3.5);
                screen.y = midY - 15;
                container.addChild(screen);
            }
        } else if (fn.includes('lead optimization')) {
            // ADMET dashboards
            for (let i = 0; i < 4; i++) {
                const dash = new PIXI.Graphics();
                dash.beginFill(0x0f172a);
                dash.drawRect(0, 0, 40, 28);
                dash.endFill();
                // Bar chart
                for (let b = 0; b < 5; b++) {
                    const h = 5 + Math.random() * 18;
                    dash.beginFill([0x22c55e, 0xfbbf24, 0xef4444][Math.floor(Math.random() * 3)], 0.6);
                    dash.drawRect(4 + b * 7, 25 - h, 5, h);
                    dash.endFill();
                }
                dash.x = 15 + i * (bldW / 4.5);
                dash.y = midY - 10;
                container.addChild(dash);
            }
        } else if (fn.includes('patient') || fn.includes('intake')) {
            // Reception desks with patient icons
            for (let i = 0; i < 3; i++) {
                const desk = new PIXI.Graphics();
                desk.beginFill(0x374151);
                desk.drawRect(0, 0, 50, 10);
                desk.endFill();
                desk.beginFill(0xec4899, 0.4);
                desk.drawRect(5, -8, 12, 8);
                desk.endFill();
                desk.x = 20 + i * (bldW / 3.5);
                desk.y = midY;
                container.addChild(desk);
            }
        } else if (fn.includes('phase i') || fn.includes('safety')) {
            // Monitoring stations with vital signs
            for (let i = 0; i < 4; i++) {
                const mon = new PIXI.Graphics();
                mon.beginFill(0x0f172a);
                mon.drawRect(0, 0, 35, 25);
                mon.endFill();
                // ECG line
                mon.lineStyle(1, 0x22c55e, 0.8);
                mon.moveTo(2, 12);
                for (let x = 0; x < 30; x += 3) {
                    const spike = (x > 12 && x < 18) ? -8 + Math.random() * 16 : 0;
                    mon.lineTo(2 + x, 12 + spike);
                }
                mon.x = 15 + i * (bldW / 4.5);
                mon.y = midY - 10;
                container.addChild(mon);
            }
        } else if (fn.includes('phase ii') || fn.includes('efficacy')) {
            // Data analysis screens
            for (let i = 0; i < 3; i++) {
                const scr = new PIXI.Graphics();
                scr.beginFill(0x0f172a);
                scr.drawRect(0, 0, 50, 30);
                scr.endFill();
                // Kaplan-Meier curve hint
                scr.lineStyle(1, 0x3b82f6, 0.7);
                scr.moveTo(5, 5);
                let cx = 5, cy = 5;
                for (let s = 0; s < 5; s++) {
                    cx += 8;
                    scr.lineTo(cx, cy);
                    cy += 2 + Math.random() * 3;
                    scr.lineTo(cx, cy);
                }
                // Control arm
                scr.lineStyle(1, 0xef4444, 0.5);
                scr.moveTo(5, 5);
                cx = 5; cy = 5;
                for (let s = 0; s < 5; s++) {
                    cx += 8;
                    scr.lineTo(cx, cy);
                    cy += 3 + Math.random() * 4;
                    scr.lineTo(cx, cy);
                }
                scr.x = 15 + i * (bldW / 3.5);
                scr.y = midY - 12;
                container.addChild(scr);
            }
        } else if (fn.includes('adaptive') || fn.includes('protocol')) {
            // Protocol engine dashboards
            for (let i = 0; i < 3; i++) {
                const panel = new PIXI.Graphics();
                panel.beginFill(0x1e293b);
                panel.drawRect(0, 0, 55, 30);
                panel.endFill();
                // Flow diagram nodes
                const nodeColors = [0x22c55e, 0xfbbf24, 0x3b82f6];
                for (let n = 0; n < 3; n++) {
                    panel.beginFill(nodeColors[n], 0.6);
                    panel.drawCircle(10 + n * 16, 15, 4);
                    panel.endFill();
                    if (n < 2) {
                        panel.lineStyle(1, 0x64748b, 0.5);
                        panel.moveTo(14 + n * 16, 15);
                        panel.lineTo(22 + n * 16, 15);
                        panel.lineStyle(0);
                    }
                }
                panel.x = 15 + i * (bldW / 3.5);
                panel.y = midY - 12;
                container.addChild(panel);
            }
        } else if (fn.includes('sample prep')) {
            // Pipettes and tubes
            for (let i = 0; i < 5; i++) {
                const tube = new PIXI.Graphics();
                tube.beginFill(0x374151);
                tube.drawRect(0, 0, 4, 22);
                tube.endFill();
                const fillH = 5 + Math.random() * 14;
                const fillCol = [0x22c55e, 0x06b6d4, 0xfbbf24, 0xec4899][Math.floor(Math.random() * 4)];
                tube.beginFill(fillCol, 0.5);
                tube.drawRect(0, 22 - fillH, 4, fillH);
                tube.endFill();
                tube.x = 20 + i * (bldW / 5.5);
                tube.y = midY - 8;
                container.addChild(tube);
            }
        } else if (fn.includes('sequencing') || fn.includes('arrays')) {
            // Sequencer machines
            for (let i = 0; i < 3; i++) {
                const seq = new PIXI.Graphics();
                seq.beginFill(0x1e293b);
                seq.drawRect(0, 0, 45, 30);
                seq.endFill();
                // ATCG color bars
                const bases = [0x22c55e, 0x3b82f6, 0xfbbf24, 0xef4444];
                for (let b = 0; b < 20; b++) {
                    seq.beginFill(bases[Math.floor(Math.random() * 4)], 0.7);
                    seq.drawRect(3 + b * 2, 5, 1.5, 20);
                    seq.endFill();
                }
                seq.x = 15 + i * (bldW / 3.5);
                seq.y = midY - 12;
                container.addChild(seq);
            }
        } else if (fn.includes('bioinformatics') || fn.includes('pipeline')) {
            // Terminal screens with alignment data
            for (let i = 0; i < 4; i++) {
                const term = new PIXI.Graphics();
                term.beginFill(0x0a0a0a);
                term.drawRect(0, 0, 40, 28);
                term.endFill();
                // Text lines
                for (let l = 0; l < 5; l++) {
                    const lineCol = [0x22c55e, 0x06b6d4][l % 2];
                    term.beginFill(lineCol, 0.4);
                    term.drawRect(3, 3 + l * 5, 15 + Math.random() * 18, 2);
                    term.endFill();
                }
                term.x = 15 + i * (bldW / 4.5);
                term.y = midY - 10;
                container.addChild(term);
            }
        } else if (fn.includes('epigenome')) {
            // Methylation heatmaps
            for (let i = 0; i < 3; i++) {
                const hm = new PIXI.Graphics();
                for (let r = 0; r < 6; r++) {
                    for (let c = 0; c < 8; c++) {
                        const intensity = Math.random();
                        const hmCol = intensity > 0.5 ? 0x8b5cf6 : 0x1e293b;
                        hm.beginFill(hmCol, 0.3 + intensity * 0.5);
                        hm.drawRect(c * 5, r * 5, 4, 4);
                        hm.endFill();
                    }
                }
                hm.x = 15 + i * (bldW / 3.5);
                hm.y = midY - 12;
                container.addChild(hm);
            }
        } else if (fn.includes('vitrification')) {
            // Cryo tanks
            for (let i = 0; i < 4; i++) {
                const tank = new PIXI.Graphics();
                tank.beginFill(0x1e3a5f);
                tank.drawRect(0, 0, 18, 35);
                tank.endFill();
                tank.beginFill(0x93c5fd, 0.3);
                tank.drawRect(2, 10, 14, 23);
                tank.endFill();
                // Frost line
                tank.beginFill(0xbfdbfe, 0.5);
                tank.drawRect(0, 8, 18, 2);
                tank.endFill();
                tank.x = 20 + i * (bldW / 4.5);
                tank.y = midY - 15;
                container.addChild(tank);
            }
        } else if (fn.includes('deep storage') || fn.includes('-196')) {
            // Dewar vessels with frost
            for (let i = 0; i < 5; i++) {
                const dewar = new PIXI.Graphics();
                dewar.beginFill(0x1e293b);
                dewar.drawCircle(0, 0, 12);
                dewar.endFill();
                dewar.beginFill(0x67e8f9, 0.2);
                dewar.drawCircle(0, 0, 9);
                dewar.endFill();
                // Frost crystals
                dewar.beginFill(0xbfdbfe, 0.6);
                for (let c = 0; c < 3; c++) {
                    const angle = c * 2.1;
                    dewar.drawCircle(Math.cos(angle) * 5, Math.sin(angle) * 5, 1.5);
                }
                dewar.endFill();
                dewar.x = 20 + i * (bldW / 5.5);
                dewar.y = midY;
                container.addChild(dewar);
            }
        } else if (fn.includes('processing')) {
            // Intake desks and scanners
            for (let i = 0; i < 3; i++) {
                const desk = new PIXI.Graphics();
                desk.beginFill(0x374151);
                desk.drawRect(0, 0, 45, 10);
                desk.endFill();
                desk.beginFill(0x67e8f9, 0.3);
                desk.drawRect(15, -15, 15, 15);
                desk.endFill();
                desk.x = 20 + i * (bldW / 3.5);
                desk.y = midY;
                container.addChild(desk);
            }
        }
    },

    _spawnInteriorNPCs(layout, numFloors, floorH, roofH, startX, bldW) {
        const dp = G.getDayPhase();
        const isWorkHours = dp > 0.30 && dp < 0.75;
        if (!isWorkHours && !layout.npcs.find(r => r === 'Preservation Ops')) return;

        layout.npcs.forEach((role, idx) => {
            const npcDef = LongevityZone.NPCS.find(n => n.role === role);
            if (!npcDef) return;

            const floorIdx = Math.min(idx, numFloors - 1);
            const fy = roofH + (numFloors - 1 - floorIdx) * floorH;

            const npc = new PIXI.Graphics();
            const col = parseInt(npcDef.color.replace('#', ''), 16);
            // Head
            npc.beginFill(0xd4a574);
            npc.drawCircle(0, -10, 3);
            npc.endFill();
            // Body
            npc.beginFill(col);
            npc.drawRect(-3, -7, 6, 8);
            npc.endFill();
            // Lab coat overlay
            npc.beginFill(0xffffff, 0.3);
            npc.drawRect(-3, -7, 6, 8);
            npc.endFill();
            // Legs
            npc.beginFill(0x374151);
            npc.drawRect(-2, 1, 2, 4);
            npc.drawRect(1, 1, 2, 4);
            npc.endFill();

            npc.x = startX + 30 + idx * (bldW / (layout.npcs.length + 1));
            npc.y = fy + floorH - 8;
            npc.zIndex = 10;
            this.scene.addChild(npc);
        });
    },

    cleanup() {
        this.container = null;
        this.scene = null;
        this.isDragging = false;
    }
};
