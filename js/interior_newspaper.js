/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   NEWSPAPER INTERIOR — Singularity City Times HQ
   ────────────────────────────────────────────────────────────────────────────────────────────────
   3-floor building: Lobby + Printing Press (ground), Newsroom (2nd), Editor's Office (3rd).
   Clickable printing press on the ground floor opens the newspaper overlay.
   Day/night shift rotation with animated NPC avatars (Editors, Reporters, Photographers, etc.).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorNewspaper = {
    scene: null,
    layer: null,
    bld: null,
    avatarLayer: null,
    avatarPool: null,
    _lift: null,
    _staff: null,
    indoorLights: [],
    isDragging: false,
    _noYScroll: false,
    _startY: 0,
    _startSceneY: 0,
    minY: 0,
    maxY: 80,

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.avatarPool = new Map();
        this.indoorLights = [];
        layer.removeChildren();

        const W = G.vpW;
        const numFloors = 3;
        const floorH = 80;
        const roofH = 35;
        const bldW = Math.min(W * 0.85, 600);
        const startX = Math.round((W - bldW) / 2);
        const totalH = roofH + numFloors * floorH + 15;
        this.totalH = totalH;
        this.maxY = 80;
        this.minY = Math.min(0, G.vpH - totalH);

        // Scene container (scrollable)
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── SKY BACKDROP ───
        const sky = new PIXI.Graphics();
        sky.beginFill(0x1a1a2e);
        sky.drawRect(0, 0, W, roofH + 10);
        sky.endFill();
        this.scene.addChild(sky);

        // ─── ROOF / PARAPET ───
        const roof = new PIXI.Graphics();
        roof.beginFill(0x3a2a18);
        roof.drawRect(startX - 4, roofH - 18, bldW + 8, 20);
        roof.endFill();
        roof.beginFill(0x4a3828);
        roof.drawRect(startX - 6, roofH - 20, bldW + 12, 4);
        roof.endFill();
        // Sign backplate
        roof.beginFill(0x0f172a);
        roof.drawRect(startX + bldW / 2 - 90, roofH - 16, 180, 12);
        roof.endFill();
        roof.beginFill(0xfbbf24, 0.15);
        roof.drawRect(startX + bldW / 2 - 90, roofH - 16, 180, 12);
        roof.endFill();
        this.scene.addChild(roof);

        const signTxt = new PIXI.Text('SINGULARITY CITY TIMES', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 6,
            fill: 0xfbbf24, letterSpacing: 1
        });
        signTxt.anchor.set(0.5, 0.5);
        signTxt.x = startX + bldW / 2;
        signTxt.y = roofH - 10;
        this.scene.addChild(signTxt);

        // Rooftop satellite dish + antenna
        const antenna = new PIXI.Graphics();
        antenna.beginFill(0x64748b);
        antenna.drawRect(startX + bldW - 45, roofH - 34, 3, 16);
        antenna.endFill();
        antenna.beginFill(0x94a3b8);
        antenna.drawEllipse(startX + bldW - 43, roofH - 36, 8, 5);
        antenna.endFill();
        antenna.beginFill(0x1a1a2e);
        antenna.drawEllipse(startX + bldW - 43, roofH - 36, 5, 3);
        antenna.endFill();
        // Blinking red light
        antenna.beginFill(0xef4444);
        antenna.drawCircle(startX + bldW - 43, roofH - 42, 1.5);
        antenna.endFill();
        this.scene.addChild(antenna);
        this._antennaLight = antenna;

        // ─── ELEVATOR LAYOUT ───
        const elevatorX = startX + bldW - 26;
        const usableW = bldW - 54;

        // ─── FLOORS ───
        const floors = {};
        for (let f = numFloors - 1; f >= 0; f--) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            const floorCont = new PIXI.Container();
            floorCont.sortableChildren = true;
            this.scene.addChild(floorCont);

            const pY = fy + floorH - 4; // standing Y
            floors[f] = { fy, pY, cont: floorCont };

            // ─── STRUCTURE: wall, floor, ceiling ───
            const fg = new PIXI.Graphics();
            const wallCol = f === 2 ? 0x2a2218 : f === 1 ? 0x1e1e2e : 0x222230;
            fg.beginFill(wallCol);
            fg.drawRect(startX, fy, bldW, floorH);
            fg.endFill();
            // Floor tiles
            fg.beginFill(f === 0 ? 0x3a3a4a : 0x2d2d3d);
            fg.drawRect(startX, pY, usableW, 4);
            fg.endFill();
            // Ceiling line
            fg.beginFill(0x4a4a5a, 0.4);
            fg.drawRect(startX, fy, usableW, 2);
            fg.endFill();
            floorCont.addChild(fg);

            // ─── WINDOWS ───
            const winG = new PIXI.Graphics();
            for (let wx = startX + 30; wx < startX + usableW - 20; wx += 110) {
                winG.beginFill(0x1a1a2e, 0.25);
                winG.drawRect(wx, fy + 8, 32, 26);
                winG.endFill();
                winG.lineStyle(1, 0x64748b, 0.4);
                winG.drawRect(wx, fy + 8, 32, 26);
                winG.moveTo(wx + 16, fy + 8);
                winG.lineTo(wx + 16, fy + 34);
                winG.lineStyle(0);
            }
            floorCont.addChild(winG);

            // ─── CEILING LIGHTS ───
            const lights = new PIXI.Graphics();
            for (let lx = startX + 50; lx < startX + usableW - 20; lx += 120) {
                lights.beginFill(0xfef3c7, 0.6);
                lights.drawRect(lx - 12, fy + 2, 24, 2);
                lights.endFill();
                // Glow cone
                const glow = new PIXI.Graphics();
                glow.beginFill(0xfbbf24, 0.04);
                glow.drawPolygon([lx - 8, fy + 4, lx + 8, fy + 4, lx + 30, pY - 4, lx - 30, pY - 4]);
                glow.endFill();
                floorCont.addChild(glow);
                this.indoorLights.push({ g: glow, maxA: 0.06, type: 'warm' });
            }
            floorCont.addChild(lights);

            // ─── FLOOR-SPECIFIC PROPS ───
            if (f === 2) this._drawEditorFloor(floorCont, startX, usableW, fy, pY, floorH);
            else if (f === 1) this._drawNewsroomFloor(floorCont, startX, usableW, fy, pY, floorH);
            else this._drawLobbyFloor(floorCont, startX, usableW, fy, pY, floorH);
        }

        // ─── ELEVATOR SHAFT + CAR ───
        const shaftBg = new PIXI.Graphics();
        for (let f = 0; f < numFloors; f++) {
            const fy = roofH + (numFloors - 1 - f) * floorH;
            shaftBg.beginFill(0x0a0a14);
            shaftBg.drawRect(elevatorX - 24, fy, 48, floorH);
            shaftBg.endFill();
            shaftBg.lineStyle(1, 0x333344, 0.4);
            shaftBg.drawRect(elevatorX - 24, fy, 48, floorH);
            shaftBg.lineStyle(0);
        }
        this.scene.addChild(shaftBg);

        const ec = new PIXI.Container();
        ec.y = roofH + (numFloors - 1) * floorH + floorH;
        this.scene.addChild(ec);
        const em = new PIXI.Graphics();
        em.beginFill(0xffffff);
        em.drawRect(startX, roofH, bldW, numFloors * floorH);
        em.endFill();
        this.scene.addChild(em);
        ec.mask = em;
        this._lift = new CityElevator(ec, numFloors, floorH, elevatorX);

        // ─── UNDERGROUND SLAB ───
        const ugY = roofH + numFloors * floorH;
        const ug = new PIXI.Graphics();
        ug.beginFill(0x1a1a24);
        ug.drawRect(startX - 10, ugY, bldW + 20, 15);
        ug.endFill();
        ug.beginFill(0x2a2a34);
        ug.drawRect(startX - 10, ugY, bldW + 20, 3);
        ug.endFill();
        this.scene.addChild(ug);

        // ─── AVATAR LAYER ───
        this.avatarLayer = new PIXI.Container();
        this.avatarLayer.sortableChildren = true;
        this.scene.addChild(this.avatarLayer);

        // ─── STAFF NPCs ───
        this._spawnStaff(startX, usableW, floors);

        // ─── INITIAL POSITION + SCROLL HANDLERS ───
        this.scene.y = G.vpH - totalH + 20;
        this._noYScroll = false;
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';

        window.removeEventListener('pointermove', this.onMove);
        window.removeEventListener('pointerup', this.onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        window.addEventListener('pointermove', this.onMove);
        window.addEventListener('pointerup', this.onUp);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 2 — EDITOR'S OFFICE (top floor)
    // ═══════════════════════════════════════════════════════════════
    _drawEditorFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Large executive desk
        const deskX = startX + 60;
        g.beginFill(0x5c3a1e);
        g.drawRect(deskX, pY - 16, 50, 16);
        g.endFill();
        g.beginFill(0x4a2e16);
        g.drawRect(deskX, pY - 16, 50, 3);
        g.endFill();
        // Monitor
        g.beginFill(0x0f172a);
        g.drawRect(deskX + 15, pY - 30, 18, 14);
        g.endFill();
        const screenGlow = new PIXI.Graphics();
        screenGlow.beginFill(0xfbbf24, 0.4);
        screenGlow.drawRect(deskX + 17, pY - 28, 14, 10);
        screenGlow.endFill();
        screenGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(screenGlow);
        this.indoorLights.push({ g: screenGlow, maxA: 0.5, type: 'screen' });

        // Executive chair
        g.beginFill(0x1e293b);
        g.drawRect(deskX + 20, pY - 8, 12, 8);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRect(deskX + 18, pY - 18, 16, 10);
        g.endFill();

        // Bookshelf against back wall
        const shelfX = startX + usableW - 70;
        g.beginFill(0x5c3a1e);
        g.drawRect(shelfX, fy + 10, 50, floorH - 14);
        g.endFill();
        // Shelves
        for (let sy = fy + 22; sy < pY - 8; sy += 16) {
            g.beginFill(0x4a2e16);
            g.drawRect(shelfX + 2, sy, 46, 2);
            g.endFill();
            // Books
            for (let bx = shelfX + 4; bx < shelfX + 46; bx += 6) {
                const bookCol = [0x3b82f6, 0xef4444, 0x22c55e, 0xfbbf24, 0xa855f7, 0x06b6d4][Math.floor(Math.random() * 6)];
                g.beginFill(bookCol, 0.7);
                g.drawRect(bx, sy - 12, 4, 12);
                g.endFill();
            }
        }

        // Framed front page on wall
        const frameX = startX + usableW / 2 - 10;
        g.beginFill(0x5c3a1e);
        g.drawRect(frameX, fy + 12, 24, 30);
        g.endFill();
        g.beginFill(0xf4ecd6);
        g.drawRect(frameX + 2, fy + 14, 20, 26);
        g.endFill();
        g.beginFill(0x1a1308, 0.3);
        for (let ly = fy + 18; ly < fy + 38; ly += 4) {
            g.drawRect(frameX + 4, ly, 16, 1);
        }
        g.endFill();

        // Potted plant
        g.beginFill(0x5c3a1e);
        g.drawRect(startX + 20, pY - 12, 12, 12);
        g.endFill();
        g.beginFill(0x22c55e);
        g.drawCircle(startX + 26, pY - 18, 8);
        g.endFill();
        g.beginFill(0x16a34a);
        g.drawCircle(startX + 22, pY - 20, 5);
        g.endFill();

        // Floor label
        cont.addChild(g);
        const label = new PIXI.Text('EDITOR\'S OFFICE', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x64748b, letterSpacing: 1
        });
        label.anchor.set(0, 0);
        label.x = startX + 8;
        label.y = fy + 4;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 1 — NEWSROOM (middle floor)
    // ═══════════════════════════════════════════════════════════════
    _drawNewsroomFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Row of reporter desks with PCs
        for (let i = 0; i < 4; i++) {
            const dx = startX + 30 + i * (usableW / 4.5);
            // Desk
            g.beginFill(0x3a3a4a);
            g.drawRect(dx, pY - 14, 30, 14);
            g.endFill();
            // Monitor
            g.beginFill(0x0f172a);
            g.drawRect(dx + 8, pY - 26, 14, 12);
            g.endFill();
            const glow = new PIXI.Graphics();
            glow.beginFill(0x22d3ee, 0.35);
            glow.drawRect(dx + 9, pY - 25, 12, 10);
            glow.endFill();
            glow.blendMode = PIXI.BLEND_MODES.ADD;
            cont.addChild(glow);
            this.indoorLights.push({ g: glow, maxA: 0.4, type: 'screen' });
        }

        // Bulletin board on back wall
        const bbX = startX + usableW - 60;
        g.beginFill(0x78350f);
        g.drawRect(bbX, fy + 10, 45, 35);
        g.endFill();
        g.beginFill(0x92400e);
        g.drawRect(bbX + 2, fy + 12, 41, 31);
        g.endFill();
        // Pinned papers
        const pinCols = [0xf4ecd6, 0xfef3c7, 0xfde68a, 0xffffff];
        for (let pi = 0; pi < 6; pi++) {
            const px = bbX + 4 + (pi % 3) * 13;
            const py = fy + 14 + Math.floor(pi / 3) * 15;
            g.beginFill(pinCols[pi % pinCols.length], 0.8);
            g.drawRect(px, py, 10, 12);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(px + 5, py, 1.5);
            g.endFill();
        }

        // "BREAKING NEWS" monitor on wall
        const bnX = startX + usableW / 2 - 25;
        g.beginFill(0x0f172a);
        g.drawRect(bnX, fy + 10, 50, 28);
        g.endFill();
        g.beginFill(0x1e293b);
        g.drawRect(bnX + 2, fy + 12, 46, 24);
        g.endFill();
        const bnGlow = new PIXI.Graphics();
        bnGlow.beginFill(0xef4444, 0.3);
        bnGlow.drawRect(bnX + 4, fy + 14, 42, 20);
        bnGlow.endFill();
        bnGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(bnGlow);
        this.indoorLights.push({ g: bnGlow, maxA: 0.35, type: 'screen' });

        const bnText = new PIXI.Text('BREAKING', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 5,
            fill: 0xef4444
        });
        bnText.anchor.set(0.5, 0.5);
        bnText.x = bnX + 25;
        bnText.y = fy + 24;
        cont.addChild(bnText);

        // Coffee machine
        const cmX = startX + 15;
        g.beginFill(0x1e293b);
        g.drawRect(cmX, pY - 20, 14, 20);
        g.endFill();
        g.beginFill(0xef4444, 0.6);
        g.drawCircle(cmX + 7, pY - 14, 2);
        g.endFill();

        cont.addChild(g);

        // Floor label
        const label = new PIXI.Text('NEWSROOM', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x64748b, letterSpacing: 1
        });
        label.anchor.set(0, 0);
        label.x = startX + 8;
        label.y = fy + 4;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  FLOOR 0 — LOBBY + PRINT ROOM (ground floor)
    // ═══════════════════════════════════════════════════════════════
    _drawLobbyFloor(cont, startX, usableW, fy, pY, floorH) {
        const g = new PIXI.Graphics();

        // Reception desk
        const rxX = startX + 30;
        g.beginFill(0x5c3a1e);
        g.drawRect(rxX, pY - 18, 60, 18);
        g.endFill();
        g.beginFill(0x4a2e16);
        g.drawRect(rxX, pY - 18, 60, 3);
        g.endFill();
        // Small monitor at reception
        g.beginFill(0x0f172a);
        g.drawRect(rxX + 22, pY - 30, 14, 12);
        g.endFill();
        const rxGlow = new PIXI.Graphics();
        rxGlow.beginFill(0x22d3ee, 0.3);
        rxGlow.drawRect(rxX + 23, pY - 29, 12, 10);
        rxGlow.endFill();
        rxGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(rxGlow);
        this.indoorLights.push({ g: rxGlow, maxA: 0.4, type: 'screen' });

        // ─── PRINTING PRESS (interactive!) ───
        const pressX = startX + usableW / 2 + 20;
        const pressW = 90;
        const pressH = 50;
        const pressY = pY - pressH;

        // Press body
        g.beginFill(0x1e293b);
        g.drawRect(pressX, pressY, pressW, pressH);
        g.endFill();
        g.beginFill(0x334155);
        g.drawRect(pressX, pressY, pressW, 4);
        g.endFill();
        // Rollers
        g.beginFill(0x64748b);
        g.drawCircle(pressX + 20, pressY + 20, 8);
        g.drawCircle(pressX + 45, pressY + 20, 8);
        g.drawCircle(pressX + 70, pressY + 20, 8);
        g.endFill();
        g.beginFill(0x475569);
        g.drawCircle(pressX + 20, pressY + 20, 4);
        g.drawCircle(pressX + 45, pressY + 20, 4);
        g.drawCircle(pressX + 70, pressY + 20, 4);
        g.endFill();
        // Paper feed (output tray)
        g.beginFill(0xf4ecd6, 0.7);
        g.drawRect(pressX + pressW - 5, pressY + 30, 18, 2);
        g.drawRect(pressX + pressW - 3, pressY + 33, 14, 2);
        g.drawRect(pressX + pressW - 1, pressY + 36, 10, 2);
        g.endFill();
        // Status lights on press
        g.beginFill(0x22c55e);
        g.drawCircle(pressX + 10, pressY + 8, 2);
        g.endFill();
        g.beginFill(0xfbbf24);
        g.drawCircle(pressX + 18, pressY + 8, 2);
        g.endFill();

        cont.addChild(g);

        // Press glow (animated)
        const pressGlow = new PIXI.Graphics();
        pressGlow.beginFill(0xfbbf24, 0.08);
        pressGlow.drawRect(pressX - 4, pressY - 4, pressW + 8, pressH + 8);
        pressGlow.endFill();
        pressGlow.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(pressGlow);
        this.indoorLights.push({ g: pressGlow, maxA: 0.12, type: 'warm' });

        // Interactive click zone over the press
        const pressHit = new PIXI.Graphics();
        pressHit.beginFill(0xffffff, 0.001); // Nearly invisible but clickable
        pressHit.drawRect(pressX - 4, pressY - 4, pressW + 8, pressH + 8);
        pressHit.endFill();
        pressHit.eventMode = 'static';
        pressHit.cursor = 'pointer';
        pressHit.on('pointertap', () => {
            if (typeof Newspaper !== 'undefined') Newspaper.open();
        });
        cont.addChild(pressHit);

        // "READ TODAY'S EDITION" label under press
        const pressLabel = new PIXI.Text('CLICK PRESS TO READ', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 5,
            fill: 0xfbbf24, letterSpacing: 0.5
        });
        pressLabel.anchor.set(0.5, 0);
        pressLabel.x = pressX + pressW / 2;
        pressLabel.y = pY + 2;
        cont.addChild(pressLabel);
        this._pressLabel = pressLabel;

        // Newspaper stacks on floor
        for (let si = 0; si < 3; si++) {
            const sx = pressX + pressW + 18 + si * 12;
            const stackG = new PIXI.Graphics();
            for (let p = 0; p < 4 - si; p++) {
                stackG.beginFill(0xf4ecd6, 0.6 + p * 0.1);
                stackG.drawRect(sx, pY - 3 - p * 3, 10, 3);
                stackG.endFill();
            }
            cont.addChild(stackG);
        }

        // Delivery dolly
        const dollyX = startX + 15;
        g.beginFill(0x64748b);
        g.drawRect(dollyX, pY - 6, 18, 2);
        g.endFill();
        g.beginFill(0x475569);
        g.drawCircle(dollyX + 4, pY, 3);
        g.drawCircle(dollyX + 14, pY, 3);
        g.endFill();

        // Floor label
        const label = new PIXI.Text('LOBBY & PRESS ROOM', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 6,
            fill: 0x64748b, letterSpacing: 1
        });
        label.anchor.set(0, 0);
        label.x = startX + 8;
        label.y = fy + 4;
        cont.addChild(label);
    },

    // ═══════════════════════════════════════════════════════════════
    //  STAFF NPCs — day/night shift rotation
    // ═══════════════════════════════════════════════════════════════
    _spawnStaff(startX, usableW, floors) {
        const DAY_WORKERS = [
            { id: 'np_editor',     name: 'Editor-in-Chief',  role: 'Editor-in-Chief',  floor: 2, xOff: 0.20, col: 0xfbbf24 },
            { id: 'np_reporter1',  name: 'Senior Reporter',  role: 'Senior Reporter',  floor: 1, xOff: 0.15, col: 0x3b82f6 },
            { id: 'np_journalist', name: 'Journalist',       role: 'Journalist',       floor: 1, xOff: 0.35, col: 0x22c55e },
            { id: 'np_journalist2',name: 'Investigative',    role: 'Investigative',    floor: 1, xOff: 0.60, col: 0x06b6d4 },
            { id: 'np_photog',     name: 'Photographer',     role: 'Photographer',     floor: 1, xOff: 0.75, col: 0xa855f7 },
            { id: 'np_copyedit',   name: 'Copy Editor',      role: 'Copy Editor',      floor: 1, xOff: 0.50, col: 0xf97316 },
            { id: 'np_reception',  name: 'Receptionist',     role: 'Receptionist',     floor: 0, xOff: 0.18, col: 0xfb7185 },
        ];
        const NIGHT_WORKERS = [
            { id: 'np_nightedit',  name: 'Night Editor',     role: 'Night Editor',     floor: 2, xOff: 0.20, col: 0xfbbf24 },
            { id: 'np_breaking',   name: 'Breaking News',    role: 'Breaking News',    floor: 1, xOff: 0.30, col: 0xef4444 },
            { id: 'np_printop',    name: 'Print Operator',   role: 'Print Operator',   floor: 0, xOff: 0.55, col: 0x22c55e },
        ];

        this._staff = { day: DAY_WORKERS, night: NIGHT_WORKERS };

        for (const list of [DAY_WORKERS, NIGHT_WORKERS]) {
            for (const w of list) {
                const floorData = floors[w.floor];
                if (!floorData) continue;
                const wx = startX + usableW * w.xOff;
                const wy = floorData.pY;

                const fakeModel = { id: w.id, name: w.name, lab: 'other', role: w.role, _npcColor: w.col };
                const av = this._makeAvatarSprite(fakeModel);
                av.cont.x = wx;
                av.cont.y = wy;
                av._isStaff = true;
                av._deskX = wx;
                av._floorY = wy;
                av._speed = 0.4 + Math.random() * 0.3;
                av._walkTarget = wx;
                av._walkTimer = 120 + Math.floor(Math.random() * 300);
                av._walkRange = 35;
                this.avatarLayer.addChild(av.cont);
                this.avatarPool.set('staff_' + w.id, av);
            }
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  AVATAR SPRITE FACTORY (same pattern as Metro station)
    // ═══════════════════════════════════════════════════════════════
    _makeAvatarSprite(m) {
        const cont = new PIXI.Container();

        let suitHex = 0x22d3ee;
        if (m._npcColor) {
            suitHex = typeof m._npcColor === 'number' ? m._npcColor : parseInt(String(m._npcColor).replace('#', ''), 16);
        } else if (typeof LABS !== 'undefined' && LABS[m.lab]) {
            const c = LABS[m.lab].color || LABS[m.lab].col;
            suitHex = typeof c === 'string' ? parseInt(c.replace('#', ''), 16) : (typeof c === 'number' ? c : 0x22d3ee);
        }

        const bw = 16, h = 32, headH = 11, bodyH = h - headH - 4;
        const skinCol = 0xfdd8b5;
        const legCol = 0x3d2914;

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();
        cont.addChild(shadow);

        // Highlight ring (for tracking)
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -h / 2, h * 0.65);
        highlight.visible = false;
        cont.addChild(highlight);

        // Legs
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol);
        legL.drawRect(-2, 0, 4, 4);
        legL.endFill();
        legL.x = -bw * 0.15;
        legL.y = -4;
        cont.addChild(legL);
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol);
        legR.drawRect(-2, 0, 4, 4);
        legR.endFill();
        legR.x = bw * 0.15;
        legR.y = -4;
        cont.addChild(legR);

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(suitHex);
        body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1);
        body.endFill();
        body.beginFill(0xffffff, 0.08);
        body.drawRoundedRect(-bw / 2 + 2, bodyH * 0.55, bw - 4, 3, 2);
        body.endFill();
        body.y = -h + headH;
        cont.addChild(body);

        // Head
        const head = new PIXI.Graphics();
        head.beginFill(skinCol);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, 1.2);
        head.drawCircle(bw * 0.1, headH * 0.38, 1.2);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;
        cont.addChild(head);

        // Status dot
        const dot = new PIXI.Graphics();
        dot.beginFill(suitHex);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;
        cont.addChild(dot);

        // Name tag
        const nameTxt = new PIXI.Text(m.role || m.name, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0xffffff,
            stroke: 0x000000, strokeThickness: 2
        });
        nameTxt.anchor.set(0.5, 1);
        nameTxt.y = -h - 10;
        cont.addChild(nameTxt);

        // Click handler
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.on('pointertap', () => {
            if (typeof UI !== 'undefined' && UI.showNPCInfo) {
                UI.showNPCInfo({ name: m.name, role: m.role, building: 'Singularity City Times' });
            }
        });

        return { cont, body, head, legL, legR, dot, nameTxt, highlight };
    },

    // ═══════════════════════════════════════════════════════════════
    //  UPDATE — shift visibility + idle patrol animation
    // ═══════════════════════════════════════════════════════════════
    update() {
        if (!this.scene || !this.bld || !this.avatarPool) return;

        const tick = G.tick || 0;

        // ─── Day/night shift rotation ───
        const dp = G.getDayPhase();
        const isNightShift = dp > 0.83 || dp < 0.25;
        const activeShift = isNightShift
            ? (this._staff ? this._staff.night : [])
            : (this._staff ? this._staff.day : []);
        const inactiveShift = isNightShift
            ? (this._staff ? this._staff.day : [])
            : (this._staff ? this._staff.night : []);

        // Show active shift workers with idle patrol animation
        for (const w of activeShift) {
            const key = 'staff_' + w.id;
            const av = this.avatarPool.get(key);
            if (!av) continue;
            av.cont.visible = true;

            // Idle patrol: wander near their desk, then return
            av._walkTimer--;
            if (av._walkTimer <= 0) {
                av._walkTarget = av._deskX + (Math.random() - 0.5) * av._walkRange * 2;
                av._walkTimer = 150 + Math.floor(Math.random() * 300);
            }
            const dx = av._walkTarget - av.cont.x;
            if (Math.abs(dx) > 1) {
                av.cont.x += Math.sign(dx) * av._speed;
                // Walking leg animation
                if (av.legL && av.legR) {
                    const phase = Math.sin(tick * 0.25 + (w.id.charCodeAt(3) || 0) * 0.3);
                    av.legL.x = -2.4 + phase * 1.2;
                    av.legR.x = 2.4 - phase * 1.2;
                }
            } else {
                // Idle stance
                if (av.legL && av.legR) { av.legL.x = -2.4; av.legR.x = 2.4; }
                if (av.body) av.body.rotation = Math.sin(tick * 0.04 + (w.id.charCodeAt(3) || 0) * 0.5) * 0.02;
            }
            av.cont.zIndex = Math.round(av.cont.y);
        }

        // Hide inactive shift
        for (const w of inactiveShift) {
            const key = 'staff_' + w.id;
            const av = this.avatarPool.get(key);
            if (av) av.cont.visible = false;
        }

        // ─── Animate indoor lights ───
        for (const l of this.indoorLights) {
            if (!l.g || l.g.destroyed) continue;
            const flicker = 0.85 + Math.sin(tick * 0.08 + (l.g.x || 0) * 0.1) * 0.15;
            l.g.alpha = l.maxA * flicker * (isNightShift ? 1.2 : 0.6);
        }

        // ─── Blink antenna light ───
        if (this._antennaLight) {
            this._antennaLight.alpha = Math.sin(tick * 0.15) > 0 ? 1 : 0.3;
        }

        // ─── Pulse press label ───
        if (this._pressLabel) {
            this._pressLabel.alpha = 0.5 + Math.sin(tick * 0.08) * 0.4;
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //  SCROLL HANDLERS
    // ═══════════════════════════════════════════════════════════════
    onMove: (e) => {
        if (!InteriorNewspaper.isDragging || !InteriorNewspaper.scene || InteriorNewspaper.scene.destroyed) return;
        let newY = InteriorNewspaper._startSceneY + (e.clientY - InteriorNewspaper._startY);
        if (newY < InteriorNewspaper.minY) newY = InteriorNewspaper.minY;
        if (newY > InteriorNewspaper.maxY) newY = InteriorNewspaper.maxY;
        InteriorNewspaper.scene.y = newY;
    },
    onUp: () => {
        InteriorNewspaper.isDragging = false;
        if (InteriorNewspaper.layer) InteriorNewspaper.layer.cursor = 'grab';
    },

    // ═══════════════════════════════════════════════════════════════
    //  CLEANUP
    // ═══════════════════════════════════════════════════════════════
    cleanup() {
        this.avatarPool = null;
        this._staff = null;
        this._lift = null;
        this._antennaLight = null;
        this._pressLabel = null;
        this.indoorLights = [];
    },
};
