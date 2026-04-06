/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO STATION INTERIOR (v1.2.0 — Full polish, working scroll, proper NPCs, deep strata)
   Renders a station cross-section: ticket hall above + glass elevator shaft + platform + tracks + tunnels.
   Mirrors real-time state of avatars whose _metroLegs pass through this station, so when a
   tracked entity enters/waits/rides/exits the metro, the camera fade carries straight into
   this view with the same behavior visible from the inside.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorMetroStation = {
    scene: null,
    layer: null,
    bld: null,
    avatarLayer: null,
    avatarPool: null,
    trainGfx: null,
    _tunnelLightsCont: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _noYScroll: false,
    _startY: 0,
    _startSceneY: 0,
    minY: 0,
    maxY: 0,
    _hallNPCs: null,

    STATION_THEME: {
        'metro_dc':        { col: 0x06b6d4, label: 'COMPUTE DISTRICT',   sub: 'Line 1 · Westbound Terminus' },
        'metro_res':       { col: 0x38bdf8, label: 'RESIDENTIAL SECTOR', sub: 'Line 1 · Residential' },
        'metro_hq':        { col: 0xfacc15, label: 'TECH DISTRICT',      sub: 'Line 1 · Lab Row Interchange' },
        'metro_mid':       { col: 0xf97316, label: 'CENTRAL LINE',       sub: 'Line 2 · Mid-Tech' },
        'metro_east':      { col: 0xa855f7, label: 'EASTERN HUB',        sub: 'Line 2 · Neon Quarter' },
        'metro_longevity': { col: 0x22c55e, label: 'LONGEVITY LINE',     sub: 'Line 2 · Eastern Terminus' }
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this.avatarPool = new Map();
        this._hallNPCs = [];
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.STATION_THEME[bld.id] || { col: 0x22d3ee, label: bld.name ? bld.name.toUpperCase() : 'METRO STATION', sub: '' };

        // Scene container (scrollable)
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── SKY LAYER ───
        this.skyContainer = new PIXI.Container();
        this.skyContainer.eventMode = 'none';
        this.scene.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 40; i++) {
            const s = new PIXI.Graphics();
            s.beginFill(0xffffff);
            s.drawCircle(0, 0, 0.5 + Math.random() * 1.2);
            s.endFill();
            s.x = Math.random() * W;
            s.y = Math.random() * 30;
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);

        // ─── Layout bands ───
        const hallH = 140;
        const stairH = 110;
        const platH = 240;
        const deepH = 300;   // extended deep strata for full city stack
        const totalH = hallH + stairH + platH + deepH;

        this.totalH = totalH;
        this.maxY = 0;
        this.minY = Math.min(0, H - totalH);

        // ─── OPEN SKY STRIP (y=0..30) ───
        const skyline = new PIXI.Graphics();
        skyline.beginFill(0x1a2540, 0.75);
        for (let i = 0; i < 20; i++) {
            const bx = i * (W / 20);
            const bh = 6 + ((i * 37) % 16);
            skyline.drawRect(bx, 30 - bh, (W / 20) - 2, bh);
        }
        skyline.endFill();
        this.scene.addChild(skyline);

        // ─── STREET / SIDEWALK LEVEL ───
        const street = new PIXI.Graphics();
        street.beginFill(0x2a2a3a);
        street.drawRect(0, 30, W, 8);
        street.endFill();
        street.beginFill(0x3a3a4a);
        street.drawRect(0, 36, W, 2);
        street.endFill();
        street.beginFill(0xfbbf24, 0.5);
        for (let dx = 0; dx < W; dx += 30) street.drawRect(dx, 33, 14, 1);
        street.endFill();
        this.scene.addChild(street);

        // ─── TICKET HALL ───
        const hallTop = 38;
        const hallBottom = hallH;
        const hallH_total = hallBottom - hallTop;
        const hall = new PIXI.Graphics();
        const hallX = 40, hallW = W - 80;
        const headerH = 26;
        const winY = hallTop + headerH;
        const winH_px = 22;
        const winX = hallX + 24;
        const winW = hallW - 48;
        const mullionPitch = 90;
        const mullionW = 8;

        InteriorCity._drawWallWithWindowCutout(
            hall, 0xf5f5f5,
            hallX, hallTop, hallW, hallH_total,
            winX, winY, winW, winH_px,
            mullionPitch, mullionW
        );
        // Header accent
        hall.beginFill(theme.col, 0.18);
        hall.drawRect(hallX, hallTop, hallW, headerH);
        hall.endFill();
        hall.beginFill(theme.col, 0.85);
        hall.drawRect(hallX, hallTop, hallW, 3);
        hall.endFill();
        // Window frames
        hall.lineStyle(1.5, 0x64748b, 0.9);
        hall.drawRect(winX, winY, winW, winH_px);
        hall.moveTo(winX, winY + winH_px * 0.55);
        hall.lineTo(winX + winW, winY + winH_px * 0.55);
        hall.lineStyle(0);
        hall.beginFill(0xe0f2fe, 0.12);
        hall.drawRect(winX, winY, winW, winH_px);
        hall.endFill();
        // Floor tiles
        hall.beginFill(0xe2e8f0);
        hall.drawRect(hallX, hallBottom - 10, hallW, 10);
        hall.endFill();
        hall.beginFill(0xcbd5e1, 0.5);
        for (let tx = 50; tx < W - 50; tx += 24) hall.drawRect(tx, hallBottom - 10, 22, 1);
        hall.endFill();
        this.scene.addChild(hall);

        // ─── Ceiling light fixtures in ticket hall ───
        const ceilLights = new PIXI.Graphics();
        for (let lx = hallX + 60; lx < hallX + hallW - 40; lx += 120) {
            // Fixture bar
            ceilLights.beginFill(0x1e293b);
            ceilLights.drawRect(lx - 8, hallTop + 2, 16, 4);
            ceilLights.endFill();
            // Warm glow cone
            ceilLights.beginFill(0xfbbf24, 0.05);
            ceilLights.drawPolygon([lx - 4, hallTop + 6, lx + 4, hallTop + 6, lx + 30, hallBottom - 12, lx - 30, hallBottom - 12]);
            ceilLights.endFill();
            // Fixture highlight
            ceilLights.beginFill(0xfef3c7, 0.7);
            ceilLights.drawRect(lx - 5, hallTop + 2, 10, 2);
            ceilLights.endFill();
        }
        this.scene.addChild(ceilLights);

        // Station name
        const nameTxt = new PIXI.Text(theme.label, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 9,
            fill: theme.col, letterSpacing: 2
        });
        nameTxt.anchor.set(0.5, 0);
        nameTxt.x = W / 2;
        nameTxt.y = hallTop + 4;
        if (nameTxt.width > hallW - 16) nameTxt.scale.set((hallW - 16) / nameTxt.width);
        this.scene.addChild(nameTxt);

        // Subtitle
        const subTxt = new PIXI.Text(theme.sub, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0x475569
        });
        subTxt.anchor.set(0.5, 0);
        subTxt.x = W / 2;
        subTxt.y = hallTop + 16;
        if (subTxt.width > hallW - 16) subTxt.scale.set((hallW - 16) / subTxt.width);
        this.scene.addChild(subTxt);

        // Ticket machines
        for (let i = 0; i < 5; i++) {
            const tm = new PIXI.Graphics();
            tm.beginFill(0x1e293b);
            tm.drawRect(0, 0, 22, 44);
            tm.endFill();
            tm.beginFill(theme.col, 0.85);
            tm.drawRect(3, 6, 16, 10);
            tm.endFill();
            tm.beginFill(0x0f172a);
            tm.drawRect(5, 22, 12, 8);
            tm.endFill();
            tm.beginFill(0xfbbf24);
            tm.drawRect(6, 32, 10, 2);
            tm.endFill();
            tm.x = 80 + i * 80;
            tm.y = hallBottom - 54;
            this.scene.addChild(tm);
        }

        // Turnstile row
        for (let i = 0; i < 6; i++) {
            const ts = new PIXI.Graphics();
            ts.beginFill(0x64748b);
            ts.drawRect(0, 0, 6, 28);
            ts.endFill();
            ts.beginFill(theme.col, 0.7);
            ts.drawCircle(3, 8, 3);
            ts.endFill();
            ts.beginFill(0x94a3b8);
            ts.drawRect(6, 12, 18, 2);
            ts.endFill();
            ts.x = W * 0.35 + i * 36;
            ts.y = hallBottom - 34;
            this.scene.addChild(ts);
        }

        // ─── Decorative commuter NPCs (proper pixel-art, animated) ───
        const npcColors = [0x3b82f6, 0xec4899, 0xfbbf24, 0x22c55e, 0x8b5cf6, 0xef4444, 0x06b6d4, 0xf97316];
        const npcNames = ['Commuter', 'Tourist', 'Worker', 'Student', 'Traveler', 'Local', 'Visitor', 'Resident'];
        for (let i = 0; i < 8; i++) {
            const npc = this._makeDecorativeNPC(npcColors[i % npcColors.length], npcNames[i]);
            const baseX = 80 + i * ((W - 160) / 8) + ((i * 13) % 15);
            npc.cont.x = baseX;
            npc.cont.y = hallBottom - 2;
            npc._baseX = baseX;
            npc._wanderDir = (i % 2 === 0) ? 1 : -1;
            npc._wanderSpeed = 0.15 + (i * 0.03);
            npc._wanderRange = 30 + (i * 5) % 20;
            npc._phase = i * 0.7;
            npc._location = 'hall';
            this.scene.addChild(npc.cont);
            this._hallNPCs.push(npc);
        }
        // Platform NPCs (waiting passengers)
        const platTop = hallBottom + stairH;
        const platFloorY = platTop + 130;
        for (let i = 0; i < 6; i++) {
            const npc = this._makeDecorativeNPC(npcColors[(i + 3) % npcColors.length], npcNames[(i + 3) % npcNames.length]);
            const baseX = 100 + i * ((W - 200) / 6);
            npc.cont.x = baseX;
            npc.cont.y = platFloorY;
            npc._baseX = baseX;
            npc._wanderDir = (i % 2 === 0) ? 1 : -1;
            npc._wanderSpeed = 0.08 + (i * 0.02);
            npc._wanderRange = 15;
            npc._phase = i * 1.1;
            npc._location = 'platform';
            this.scene.addChild(npc.cont);
            this._hallNPCs.push(npc);
        }

        // ─── EARTH/BEDROCK flanking the glass elevator shaft ───
        const shaftW = 60;
        const shaftLeft = W / 2 - shaftW / 2;
        const shaftRight = W / 2 + shaftW / 2;
        const shaftTop = hallBottom;
        const shaftBottom = platFloorY;   // lift descends flush with platform

        // Seeded rng
        let rs = (bld.x || 0) + 101;
        const rr = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };

        // Rock flanks
        const rock = new PIXI.Graphics();
        rock.beginFill(0x2a1a10);
        rock.drawRect(0, shaftTop, shaftLeft, shaftBottom - shaftTop);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, shaftBottom - shaftTop);
        rock.endFill();
        rock.beginFill(0x3a2218);
        rock.drawRect(0, shaftTop, shaftLeft, 4);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, 4);
        rock.endFill();
        for (let i = 0; i < 260; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 2 && rx < shaftRight + 2) continue;
            rock.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            rock.drawRect(rx, shaftTop + rr() * (shaftBottom - shaftTop), 2 + rr() * 3, 2);
            rock.endFill();
        }
        // Rock texture details — mineral veins
        for (let i = 0; i < 30; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 5 && rx < shaftRight + 5) continue;
            rock.beginFill(rr() > 0.5 ? 0xb45309 : 0xfacc15, 0.3);
            rock.drawRect(rx, shaftTop + rr() * (shaftBottom - shaftTop), 1 + rr() * 3, 1);
            rock.endFill();
        }
        this.scene.addChild(rock);

        // ─── GLASS ELEVATOR SHAFT (upper section: hall to platform top) ───
        const glassShaft = new PIXI.Graphics();
        glassShaft.beginFill(0x050510, 0.85);
        glassShaft.drawRect(shaftLeft + 2, shaftTop + 2, shaftW - 4, shaftBottom - shaftTop - 4);
        glassShaft.endFill();
        glassShaft.beginFill(0x22d3ee, 0.10);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.endFill();
        glassShaft.lineStyle(2, 0x22d3ee, 0.4);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.lineStyle(0);
        // Vertical divider
        glassShaft.beginFill(0x22d3ee, 0.15);
        glassShaft.drawRect(shaftLeft + shaftW / 2 - 1, shaftTop + 4, 2, shaftBottom - shaftTop - 8);
        glassShaft.endFill();
        // Horizontal glass segments
        glassShaft.beginFill(0x22d3ee, 0.18);
        for (let sy = shaftTop + 30; sy < shaftBottom - 6; sy += 30) {
            glassShaft.drawRect(shaftLeft + 2, sy, shaftW - 4, 1);
        }
        glassShaft.endFill();
        this.scene.addChild(glassShaft);

        // Floor indicator
        const floorInd = new PIXI.Graphics();
        floorInd.beginFill(0x0f172a);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.endFill();
        floorInd.lineStyle(1, 0x22d3ee, 0.7);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.lineStyle(0);
        this.scene.addChild(floorInd);
        const floorTxt = new PIXI.Text('⇅ LIFT', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0x22d3ee
        });
        floorTxt.anchor.set(0.5, 0.5);
        floorTxt.x = (shaftLeft + shaftRight) / 2;
        floorTxt.y = shaftTop - 8;
        this.scene.addChild(floorTxt);
        this._liftFloorTxt = floorTxt;

        // ─── Elevator car ───
        const liftCar = new PIXI.Graphics();
        const carW = shaftW - 14;
        const carH = 6;
        const cable = new PIXI.Graphics();
        cable.beginFill(0x22d3ee, 0.35);
        cable.drawRect((shaftLeft + shaftRight) / 2 - 1, shaftTop + 2, 2, 10);
        cable.endFill();
        this.scene.addChild(cable);
        this._liftCable = cable;
        liftCar.beginFill(0x94a3b8);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.endFill();
        liftCar.lineStyle(1, 0x22d3ee, 0.6);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.lineStyle(0);
        liftCar.beginFill(0xe2e8f0, 0.6);
        liftCar.drawRect(-carW / 2 + 1, -carH / 2 + 1, carW - 2, 1);
        liftCar.endFill();
        liftCar.beginFill(0x22d3ee, 0.5);
        liftCar.drawRect(-carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.drawRect(carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.endFill();
        liftCar.x = (shaftLeft + shaftRight) / 2;
        liftCar.y = shaftTop + 20;
        this.scene.addChild(liftCar);
        this._liftCar = liftCar;
        this._liftCarH = carH;
        this._liftTop = { x: liftCar.x, y: shaftTop + 12 };
        this._liftBot = { x: liftCar.x, y: shaftBottom - 2 };

        // ─── PLATFORM LEVEL (back wall + deck) ───
        const platW = W;
        const backWallH = platFloorY - platTop;

        const backWall = new PIXI.Graphics();
        backWall.beginFill(0x0a0a12);
        backWall.drawRect(0, platTop, platW, backWallH);
        backWall.endFill();
        backWall.lineStyle(1, 0x1e1e2f, 0.5);
        for (let wx = 0; wx <= platW; wx += 20) {
            backWall.moveTo(wx, platTop);
            backWall.lineTo(wx, platFloorY);
        }
        backWall.lineStyle(0);
        // Side pillars
        backWall.beginFill(0x11111a);
        backWall.drawRect(0, platTop, 30, backWallH);
        backWall.drawRect(platW - 30, platTop, 30, backWallH);
        backWall.endFill();
        this.scene.addChild(backWall);

        // ─── Glass shaft OVERLAY in the platform zone (drawn AFTER back wall) ───
        const shaftOverlay = new PIXI.Graphics();
        // Dark backing inside shaft through platform zone
        shaftOverlay.beginFill(0x050510, 0.85);
        shaftOverlay.drawRect(shaftLeft + 2, platTop, shaftW - 4, backWallH);
        shaftOverlay.endFill();
        // Cyan glass tint
        shaftOverlay.beginFill(0x22d3ee, 0.10);
        shaftOverlay.drawRect(shaftLeft, platTop, shaftW, backWallH);
        shaftOverlay.endFill();
        // Cyan frame continuing through platform zone
        shaftOverlay.lineStyle(2, 0x22d3ee, 0.4);
        shaftOverlay.moveTo(shaftLeft, platTop);
        shaftOverlay.lineTo(shaftLeft, platFloorY);
        shaftOverlay.moveTo(shaftRight, platTop);
        shaftOverlay.lineTo(shaftRight, platFloorY);
        shaftOverlay.lineStyle(0);
        // Center divider continues
        shaftOverlay.beginFill(0x22d3ee, 0.15);
        shaftOverlay.drawRect(shaftLeft + shaftW / 2 - 1, platTop, 2, backWallH);
        shaftOverlay.endFill();
        // Horizontal glass segments continue
        shaftOverlay.beginFill(0x22d3ee, 0.18);
        for (let sy = platTop + 15; sy < platFloorY - 6; sy += 30) {
            shaftOverlay.drawRect(shaftLeft + 2, sy, shaftW - 4, 1);
        }
        shaftOverlay.endFill();
        // Shaft exit opening at bottom (where passengers step out)
        shaftOverlay.beginFill(0x22d3ee, 0.3);
        shaftOverlay.drawRect(shaftLeft, platFloorY - 2, shaftW, 2);
        shaftOverlay.endFill();
        this.scene.addChild(shaftOverlay);

        // Neon signs
        const signBg = new PIXI.Graphics();
        const signXOff = shaftW / 2 + 80;
        signBg.beginFill(0x05050a);
        signBg.lineStyle(1, theme.col, 0.5);
        signBg.drawRect(W / 2 - signXOff - 70, platTop + 20, 140, 16);
        signBg.drawRect(W / 2 + signXOff - 70, platTop + 20, 140, 16);
        signBg.endFill();
        signBg.lineStyle(0);
        this.scene.addChild(signBg);
        const signL = new PIXI.Text(theme.label, {
            fontFamily: 'Silkscreen, monospace', fontSize: 8, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
        });
        signL.anchor.set(0.5, 0.5);
        signL.x = W / 2 - signXOff;
        signL.y = platTop + 28;
        this.scene.addChild(signL);
        const signR = new PIXI.Text(theme.label, {
            fontFamily: 'Silkscreen, monospace', fontSize: 8, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
        });
        signR.anchor.set(0.5, 0.5);
        signR.x = W / 2 + signXOff;
        signR.y = platTop + 28;
        this.scene.addChild(signR);

        // ─── Platform ceiling lights (fluorescent strips) ───
        const platLights = new PIXI.Graphics();
        for (let lx = 50; lx < W - 30; lx += 100) {
            if (lx > shaftLeft - 15 && lx < shaftRight + 15) continue;
            // Fluorescent tube
            platLights.beginFill(0xe2e8f0, 0.6);
            platLights.drawRect(lx - 15, platTop + 4, 30, 2);
            platLights.endFill();
            // Diffused glow cone
            platLights.beginFill(0xcbd5e1, 0.03);
            platLights.drawPolygon([lx - 12, platTop + 6, lx + 12, platTop + 6, lx + 35, platFloorY - 5, lx - 35, platFloorY - 5]);
            platLights.endFill();
        }
        this.scene.addChild(platLights);

        // ─── Route map boards on back wall ───
        const mapBoard = new PIXI.Graphics();
        for (const mx of [W * 0.2, W * 0.8]) {
            mapBoard.beginFill(0x1e293b);
            mapBoard.drawRect(mx - 20, platTop + 50, 40, 30);
            mapBoard.endFill();
            mapBoard.beginFill(0x0f172a);
            mapBoard.drawRect(mx - 17, platTop + 53, 34, 24);
            mapBoard.endFill();
            // Fake route lines on the map
            mapBoard.beginFill(0x22d3ee, 0.7);
            mapBoard.drawRect(mx - 14, platTop + 62, 28, 2);
            mapBoard.endFill();
            mapBoard.beginFill(0xf97316, 0.7);
            mapBoard.drawRect(mx - 14, platTop + 68, 28, 2);
            mapBoard.endFill();
            // "MAP" label
            mapBoard.beginFill(0x94a3b8, 0.5);
            mapBoard.drawRect(mx - 8, platTop + 54, 16, 3);
            mapBoard.endFill();
        }
        this.scene.addChild(mapBoard);

        // ─── CCTV cameras ───
        const cctv = new PIXI.Graphics();
        for (const cx of [60, W - 60]) {
            cctv.beginFill(0x1e293b);
            cctv.drawRect(cx - 3, platTop + 2, 6, 8);
            cctv.endFill();
            cctv.beginFill(0xef4444, 0.8);
            cctv.drawCircle(cx, platTop + 12, 1.5);
            cctv.endFill();
        }
        this.scene.addChild(cctv);

        // Platform deck slab
        const slab = new PIXI.Graphics();
        slab.beginFill(0x2a2a3e);
        slab.drawRect(0, platFloorY, platW, 15);
        slab.endFill();
        slab.beginFill(0xfacc15);
        slab.drawRect(0, platFloorY + 13, platW, 2);
        slab.endFill();
        slab.beginFill(0xd97706);
        for (let sx = 0; sx < platW; sx += 6) {
            slab.drawRect(sx, platFloorY + 11, 4, 2);
        }
        slab.endFill();
        this.scene.addChild(slab);

        // Benches
        for (let bx = 120; bx < W - 120; bx += 220) {
            if (bx > shaftLeft - 70 && bx < shaftRight + 10) continue;
            const bench = new PIXI.Graphics();
            bench.beginFill(0x78350f);
            bench.drawRect(0, 0, 60, 3);
            bench.endFill();
            bench.beginFill(0x64748b);
            bench.drawRect(4, 3, 4, 8);
            bench.drawRect(52, 3, 4, 8);
            bench.endFill();
            bench.x = bx;
            bench.y = platFloorY - 12;
            this.scene.addChild(bench);
        }

        // ─── Trash cans ───
        for (const tx of [W * 0.15, W * 0.85]) {
            const trash = new PIXI.Graphics();
            trash.beginFill(0x475569);
            trash.drawRect(tx - 5, platFloorY - 14, 10, 14);
            trash.endFill();
            trash.beginFill(0x64748b);
            trash.drawRect(tx - 6, platFloorY - 14, 12, 2);
            trash.endFill();
            this.scene.addChild(trash);
        }

        // Store platform anchors
        this._platFloorY = platFloorY;
        this._platStandY = platFloorY;
        this._hallFloorY = hallBottom - 2;

        // ─── TRACK BED + TRAIN CORRIDOR ───
        const trainCenterY = platFloorY + 8;
        const trainBodyH = 65;
        const trainTopY = trainCenterY - 35;
        const trainBottomY = trainCenterY + 40;
        const trackBottom = platTop + platH - 10;

        const tbedTop = platFloorY + 18;
        const tbed = new PIXI.Graphics();
        tbed.beginFill(0x050510);
        tbed.drawRect(0, tbedTop, W, trackBottom - tbedTop);
        tbed.endFill();
        // Rails
        const railY = trainBottomY - 4;
        tbed.beginFill(0xd4d4d4);
        tbed.drawRect(0, railY, W, 2);
        tbed.drawRect(0, railY + 10, W, 2);
        tbed.endFill();
        // Track sleepers
        tbed.beginFill(0x3a2218);
        for (let sx = 0; sx < W; sx += 20) tbed.drawRect(sx, railY - 2, 14, 16);
        tbed.endFill();
        // Ballast
        for (let i = 0; i < 120; i++) {
            tbed.beginFill(0x1a1a24, 0.7);
            tbed.drawRect(rr() * W, railY + 14 + rr() * (trackBottom - railY - 16), 2, 2);
            tbed.endFill();
        }
        // Power rail
        tbed.beginFill(0xfbbf24, 0.4);
        tbed.drawRect(0, trackBottom - 8, W, 2);
        tbed.endFill();
        this.scene.addChild(tbed);

        // Tunnel mouths
        const tunnelTop = trainTopY;
        const tunnelBottom = trainBottomY;
        const tmouthL = new PIXI.Graphics();
        tmouthL.beginFill(0x000000, 0.9);
        tmouthL.drawRect(0, tunnelTop, 40, tunnelBottom - tunnelTop);
        tmouthL.endFill();
        tmouthL.beginFill(0x050510, 0.6);
        tmouthL.drawRect(40, tunnelTop, 30, tunnelBottom - tunnelTop);
        tmouthL.endFill();
        this.scene.addChild(tmouthL);

        const tmouthR = new PIXI.Graphics();
        tmouthR.beginFill(0x000000, 0.9);
        tmouthR.drawRect(W - 40, tunnelTop, 40, tunnelBottom - tunnelTop);
        tmouthR.endFill();
        tmouthR.beginFill(0x050510, 0.6);
        tmouthR.drawRect(W - 70, tunnelTop, 30, tunnelBottom - tunnelTop);
        tmouthR.endFill();
        this.scene.addChild(tmouthR);

        // ─── Tunnel receding lights (depth cue) ───
        this._tunnelLightsCont = new PIXI.Graphics();
        for (let d = 0; d < 5; d++) {
            const alpha = 0.5 - d * 0.08;
            // Left tunnel
            this._tunnelLightsCont.beginFill(0xef4444, alpha);
            this._tunnelLightsCont.drawCircle(35 - d * 6, tunnelTop + 10, 1.5 - d * 0.2);
            this._tunnelLightsCont.endFill();
            // Right tunnel
            this._tunnelLightsCont.beginFill(0xef4444, alpha);
            this._tunnelLightsCont.drawCircle(W - 35 + d * 6, tunnelTop + 10, 1.5 - d * 0.2);
            this._tunnelLightsCont.endFill();
        }
        this.scene.addChild(this._tunnelLightsCont);

        this._trackY = trainCenterY;
        this._trainBodyH = trainBodyH;
        this._trackTop = trainTopY;
        this._trackBottom = trackBottom;

        // ─── DEEP STRATA (full city stack below tracks) ───
        const deepTop = platTop + platH;
        const deep = new PIXI.Graphics();

        // Solid dark base fill to prevent any bleed-through
        deep.beginFill(0x050508);
        deep.drawRect(0, deepTop, W, deepH + 100);
        deep.endFill();

        // Layer 1: Dark rock transition (0-20px)
        deep.beginFill(0x2a1a10);
        deep.drawRect(0, deepTop, W, 20);
        deep.endFill();

        // Layer 2: Cable conduit zone (20-50px) — colored cables
        deep.beginFill(0x0a0a0f);
        deep.drawRect(0, deepTop + 20, W, 30);
        deep.endFill();
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
        for (let ci = 0; ci < 20; ci++) {
            const cy = deepTop + 23 + rr() * 24;
            const col = cableCols[Math.floor(rr() * cableCols.length)];
            deep.beginFill(col, 0.3 + rr() * 0.4);
            const cableLen = 40 + rr() * 120;
            deep.drawRect(rr() * (W - cableLen), cy, cableLen, 1 + rr() * 1.5);
            deep.endFill();
        }

        // Layer 3: Water main (55-65px)
        deep.beginFill(0x0369a1);
        deep.drawRect(0, deepTop + 55, W, 8);
        deep.endFill();
        deep.beginFill(0x0284c7);
        deep.drawRect(0, deepTop + 57, W, 4);
        deep.endFill();
        // Pipe joints
        for (let px = 80; px < W; px += 200) {
            deep.beginFill(0x0ea5e9, 0.5);
            deep.drawRect(px, deepTop + 53, 12, 12);
            deep.endFill();
        }

        // Layer 4: Sewer trunk (75-90px)
        deep.beginFill(0x78350f);
        deep.drawRect(0, deepTop + 75, W, 15);
        deep.endFill();
        deep.beginFill(0xb45309);
        deep.drawRect(0, deepTop + 78, W, 8);
        deep.endFill();

        // Layer 5: Rock strata with mineral veins (100-200px)
        deep.beginFill(0x2d1a11);
        deep.drawRect(0, deepTop + 100, W, 100);
        deep.endFill();
        // Strata bands
        deep.beginFill(0x1f100a, 0.6);
        deep.drawRect(0, deepTop + 120, W, 4);
        deep.drawRect(0, deepTop + 155, W, 3);
        deep.drawRect(0, deepTop + 185, W, 5);
        deep.endFill();
        // Rock flecks
        for (let i = 0; i < 200; i++) {
            deep.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            deep.drawRect(rr() * W, deepTop + 100 + rr() * 100, 2 + rr() * 3, 2);
            deep.endFill();
        }
        // Gold/mineral flecks
        for (let i = 0; i < 20; i++) {
            deep.beginFill(rr() > 0.5 ? 0xb45309 : 0xfacc15, 0.5);
            deep.drawRect(rr() * W, deepTop + 110 + rr() * 80, 1 + rr() * 2, 1);
            deep.endFill();
        }

        // Layer 6: Deep bedrock void (200px+)
        deep.beginFill(0x050508);
        deep.drawRect(0, deepTop + 200, W, deepH - 200 + 100);
        deep.endFill();
        // Sparse deep rock flecks
        for (let i = 0; i < 60; i++) {
            deep.beginFill(0x1a100a, 0.5);
            deep.drawRect(rr() * W, deepTop + 200 + rr() * 90, 2 + rr() * 4, 2);
            deep.endFill();
        }

        // Utility pipes
        for (let i = 0; i < 4; i++) {
            const px = 60 + i * (W / 4);
            const py = deepTop + 40 + (i % 2) * 45;
            deep.beginFill(0x475569);
            deep.drawRect(px, py, 24, 5);
            deep.endFill();
            deep.beginFill(0x64748b);
            deep.drawRect(px, py, 24, 1);
            deep.endFill();
        }
        this.scene.addChild(deep);

        // ─── TRAIN LAYER ───
        this.trainGfx = new PIXI.Container();
        this.trainGfx.sortableChildren = true;
        this.scene.addChild(this.trainGfx);
        this._trainG = new PIXI.Graphics();
        this.trainGfx.addChild(this._trainG);

        // ─── AVATAR LAYER ───
        this.avatarLayer = new PIXI.Container();
        this.avatarLayer.sortableChildren = true;
        this.scene.addChild(this.avatarLayer);

        // Initial position
        this.scene.y = 0;

        // ─── SCROLL HANDLERS (window-level like all other interiors) ───
        this._noYScroll = false;
        this.layer.eventMode = 'static';
        this.layer.cursor = 'grab';
        // Remove any stale listeners
        if (this._onMove) window.removeEventListener('pointermove', this._onMove);
        if (this._onUp) window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            if (this._noYScroll) return;
            this.isDragging = true;
            this._startY = e.clientY;
            this._startSceneY = this.scene.y;
            this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorMetroStation.isDragging || !InteriorMetroStation.scene || InteriorMetroStation.scene.destroyed) return;
            let ny = InteriorMetroStation._startSceneY + (e.clientY - InteriorMetroStation._startY);
            ny = Math.max(InteriorMetroStation.minY, Math.min(ny, InteriorMetroStation.maxY));
            InteriorMetroStation.scene.y = ny;
        };
        this._onUp = () => {
            InteriorMetroStation.isDragging = false;
            if (InteriorMetroStation.layer) InteriorMetroStation.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);

        // Auto-scroll so platform is visible
        const focusY = platTop + platH * 0.3;
        if (focusY > H * 0.5 && totalH > H) {
            this.scene.y = Math.max(this.minY, -(focusY - H * 0.4));
        }

        this.update();
    },

    update() {
        if (!this.scene || !this.bld || !this.avatarLayer) return;

        // Dynamic sky
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(null, this.starsLayer);
        }

        const stationX = this.bld.x + this.bld.w / 2;
        const W = G.vpW;
        const tick = (typeof G !== 'undefined' && G.tick) || 0;

        // ─── Animate decorative NPCs ───
        if (this._hallNPCs) {
            for (const npc of this._hallNPCs) {
                // Wander back and forth
                npc._phase += 0.016;
                const dx = Math.sin(npc._phase * npc._wanderSpeed * 2) * npc._wanderRange;
                npc.cont.x = npc._baseX + dx;
                // Walking leg animation
                const isMoving = Math.abs(Math.cos(npc._phase * npc._wanderSpeed * 2)) > 0.15;
                if (npc.legL && npc.legR) {
                    const phase = isMoving ? Math.sin(tick * 0.25 + npc._phase * 10) : 0;
                    npc.legL.x = -2.4 + phase * 1.2;
                    npc.legR.x = 2.4 - phase * 1.2;
                }
                // Face direction of travel
                const facingRight = Math.cos(npc._phase * npc._wanderSpeed * 2) > 0;
                npc.cont.scale.x = facingRight ? 1 : -1;
            }
        }

        // ─── Draw real exterior trains ───
        const g = this._trainG;
        if (g) {
            g.clear();
            const trainCenterY = this._trackY;
            const trainHalfW = 180;
            const offscreenCut = W / 2 + trainHalfW + 10;

            const trains = [];
            if (typeof Entities !== 'undefined') {
                if (Entities.trainWest)      trains.push(Entities.trainWest);
                if (Entities.trainEast)      trains.push(Entities.trainEast);
                if (Entities.trainMid)       trains.push(Entities.trainMid);
                if (Entities.trainDC)        trains.push(Entities.trainDC);
                if (Entities.trainLongevity) trains.push(Entities.trainLongevity);
            }

            for (const t of trains) {
                if (!t || t.st1 === undefined || t.st2 === undefined) continue;
                const servesThisStation =
                    Math.abs(t.st1 - stationX) < 8 || Math.abs(t.st2 - stationX) < 8;
                if (!servesThisStation) continue;

                const cxOffset = t.x - stationX;
                if (Math.abs(cxOffset) > offscreenCut) continue;

                const cx = W / 2 + cxOffset;
                const bob = (t.state === 'moving') ? Math.sin(tick * 0.5) * 1.5 : 0;
                const cy = trainCenterY + bob;
                const atStation = Math.abs(cxOffset) < 5;
                this._drawExteriorTrain(g, cx, cy, atStation, t.dir);
            }
        }

        // ─── Drive the LIFT ───
        const groundY = G.groundY || 0;
        const surfaceY = groundY - 20;
        const exteriorPlatY = groundY + 112;
        const descentRange = exteriorPlatY - surfaceY;
        const shaftTopY = this._liftTop ? this._liftTop.y : 0;
        const shaftBotY = this._liftBot ? this._liftBot.y : 0;
        const shaftRange = shaftBotY - shaftTopY;

        let liftTarget = shaftTopY;
        let liftActive = false;

        if (G && G.charRefs && G.models) {
            for (let mi = 0; mi < G.models.length; mi++) {
                const m = G.models[mi];
                const refs = G.charRefs[m.id];
                if (!refs) continue;
                if (refs._metroState !== 'entering' && refs._metroState !== 'exiting') continue;
                if (!refs._metroLegs) continue;
                const legX = refs._metroLegs[refs._currentLeg];
                if (Math.abs(legX - stationX) > 8) continue;
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                liftTarget = shaftTopY + progress * shaftRange;
                liftActive = true;
                break;
            }
        }

        if (this._liftCar) {
            const cur = this._liftCar.y;
            this._liftCar.y = cur + (liftTarget - cur) * 0.25;
            if (this._liftCable) {
                this._liftCable.clear();
                this._liftCable.beginFill(0x22d3ee, 0.35);
                this._liftCable.drawRect(this._liftCar.x - 1, shaftTopY - 12, 2, (this._liftCar.y - 3) - (shaftTopY - 12));
                this._liftCable.endFill();
            }
            if (this._liftFloorTxt) {
                const p = shaftRange > 0 ? (this._liftCar.y - shaftTopY) / shaftRange : 0;
                this._liftFloorTxt.text = liftActive
                    ? (p > 0.5 ? '▼ PLATFORM' : '▲ HALL')
                    : '⇅ LIFT';
            }
        }

        // ─── Mirror real-time avatars ───
        if (typeof G === 'undefined' || !G.charRefs || !G.models) return;

        const seen = new Set();
        const platStandY = this._platStandY;
        const hallFloorY = this._hallFloorY || 127;

        for (let mi = 0; mi < G.models.length; mi++) {
            const m = G.models[mi];
            const refs = G.charRefs[m.id];
            if (!refs) continue;
            if (!refs._metroState || refs._metroState === 'none') continue;
            if (!refs._metroLegs || refs._metroLegs.length === 0) continue;

            let legIdx = -1;
            for (let li = 0; li < refs._metroLegs.length; li++) {
                if (Math.abs(refs._metroLegs[li] - stationX) < 8) { legIdx = li; break; }
            }
            if (legIdx === -1) continue;

            const currentLegX = refs._metroLegs[refs._currentLeg];
            const atThisStation = Math.abs(currentLegX - stationX) < 8;

            const isRiding = refs._metroState === 'riding';
            const nextLegX = refs._metroLegs[refs._currentLeg + 1];
            const passingThrough = isRiding && nextLegX !== undefined &&
                                   ((currentLegX <= stationX && stationX <= nextLegX) ||
                                    (nextLegX <= stationX && stationX <= currentLegX));

            if (!atThisStation && !passingThrough) continue;

            seen.add(m.id);

            let ix, iy;
            const spread = ((m.id.charCodeAt(0) * 31 + mi * 7) % 240) - 120;

            if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                if (progress < 0.02) {
                    const dxExt = (refs.c && refs.c.x != null) ? (refs.c.x - stationX) : 0;
                    const clampedDx = Math.max(-W / 2 + 80, Math.min(W / 2 - 80, dxExt));
                    ix = W / 2 + clampedDx;
                    iy = hallFloorY;
                } else if (progress > 0.98) {
                    ix = W / 2 + spread * 0.3;
                    iy = platStandY;
                } else {
                    ix = this._liftCar.x;
                    iy = this._liftCar.y - 3;
                }
            } else if (refs._metroState === 'waiting_train') {
                ix = W / 2 + spread * 0.9;
                iy = platStandY;
            } else if (refs._metroState === 'riding') {
                let ridingX = null;
                if (refs._ridingTrain && refs._ridingTrain.x != null) {
                    ridingX = refs._ridingTrain.x;
                }
                if (ridingX == null) {
                    ix = W / 2 + spread * 0.3;
                } else {
                    const rideOffset = Math.max(-140, Math.min(140, spread));
                    ix = W / 2 + (ridingX - stationX) + rideOffset;
                }
                iy = this._trackY - 8;
            } else {
                ix = W / 2 + spread;
                iy = platStandY;
            }

            let av = this.avatarPool.get(m.id);
            if (!av) {
                av = this._makeAvatarSprite(m);
                this.avatarLayer.addChild(av.cont);
                this.avatarPool.set(m.id, av);
            }
            av.cont.x = ix;
            av.cont.y = iy;
            av.cont.visible = true;
            av.cont.zIndex = Math.round(iy);

            const isWalking = (refs._metroState === 'entering' || refs._metroState === 'exiting');
            if (av.legL && av.legR) {
                const phase = isWalking ? Math.sin(tick * 0.25 + (m.id.charCodeAt(0) * 0.3)) : 0;
                av.legL.x = -2.4 + phase * 1.2;
                av.legR.x =  2.4 - phase * 1.2;
            }

            const isTracked = G.tracking && G.tracking.type === 'model' && G.tracking.id === m.id;
            if (av.highlight) av.highlight.visible = !!isTracked;
        }

        this.avatarPool.forEach((av, id) => {
            if (!seen.has(id)) av.cont.visible = false;
        });
    },

    // ─────────────────────────────────────────────────────────────
    //  EXTERIOR-MATCHING TRAIN VISUAL
    // ─────────────────────────────────────────────────────────────
    _drawExteriorTrain(g, cx, cy, atStation, dir) {
        // Body
        g.beginFill(0x1e293b);
        g.drawRoundedRect(cx - 180, cy - 35, 360, 65, 8);
        g.endFill();
        g.beginFill(0x0284c7);
        g.drawRect(cx - 175, cy + 4, 350, 8);
        g.endFill();
        g.beginFill(0x94a3b8);
        for (let px = -160; px <= 160; px += 45) {
            g.drawRect(cx + px - 1, cy - 25, 2, 29);
        }
        g.endFill();
        // Front overlay
        g.beginFill(0xcbd5e1);
        g.drawRoundedRect(cx - 180, cy - 35, 360, 15, 8);
        g.endFill();
        g.beginFill(0x94a3b8);
        g.drawRect(cx - 180, cy - 4, 360, 34);
        g.endFill();
        g.beginFill(0x94a3b8);
        for (let px = -180; px <= 180; px += 45) {
            g.drawRect(cx + px - 5, cy - 20, 10, 16);
        }
        g.endFill();
        // Windows
        g.beginFill(0x64748b);
        g.drawRect(cx - 100, cy - 28, 20, 50);
        g.drawRect(cx + 0,   cy - 28, 20, 50);
        g.drawRect(cx + 100, cy - 28, 20, 50);
        g.endFill();
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(cx - 96, cy - 18, 12, 16);
        g.drawRect(cx + 4,  cy - 18, 12, 16);
        g.drawRect(cx + 104, cy - 18, 12, 16);
        g.endFill();
        // Skirt
        g.beginFill(0x1e293b);
        g.drawRect(cx - 175, cy + 30, 350, 10);
        g.endFill();
        // Accent line
        g.beginFill(0x0ea5e9);
        g.drawRect(cx - 180, cy - 2, 360, 4);
        g.endFill();
        // Glass tint
        g.beginFill(0xe0f2fe, 0.15);
        g.drawRect(cx - 180, cy - 20, 360, 16);
        g.endFill();
        // Headlights
        const dirSign = dir || 1;
        const leftCol  = dirSign > 0 ? 0xef4444 : 0x4ade80;
        const rightCol = dirSign > 0 ? 0x4ade80 : 0xef4444;
        g.beginFill(leftCol);
        g.drawCircle(cx - 175, cy, 4);
        g.endFill();
        g.beginFill(rightCol);
        g.drawCircle(cx + 175, cy, 4);
        g.endFill();
        // Door highlights when at station
        if (atStation) {
            g.beginFill(0xfef08a, 0.4);
            for (const px of [-100, 0, 100]) {
                g.drawRect(cx + px - 1, cy - 28, 1, 50);
                g.drawRect(cx + px + 20, cy - 28, 1, 50);
            }
            g.endFill();
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  DECORATIVE NPC (commuters/staff — proper pixel-art)
    // ─────────────────────────────────────────────────────────────
    _makeDecorativeNPC(suitHex, name) {
        const cont = new PIXI.Container();
        const bw = 16, h = 32, headH = 11, bodyH = h - headH - 4;
        const skinCol = 0xfdd8b5;
        const legCol = 0x3d2914;

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.2);
        shadow.drawEllipse(0, 2, bw * 0.5, 2.5);
        shadow.endFill();
        cont.addChild(shadow);

        // Legs
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol); legL.drawRect(-2, 0, 4, 4); legL.endFill();
        legL.x = -bw * 0.15;
        legL.y = -4;
        cont.addChild(legL);
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol); legR.drawRect(-2, 0, 4, 4); legR.endFill();
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
        head.drawCircle( bw * 0.1, headH * 0.38, 1.2);
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

        return { cont, body, head, legL, legR, dot };
    },

    _makeAvatarSprite(m) {
        const cont = new PIXI.Container();

        let suitHex = 0x22d3ee;
        if (typeof LABS !== 'undefined' && LABS[m.lab]) {
            const c = LABS[m.lab].color || LABS[m.lab].col;
            if (typeof c === 'string') suitHex = parseInt(c.replace('#', '0x'));
            else if (typeof c === 'number') suitHex = c;
        }

        const bw = 16, h = 32, headH = 11, bodyH = h - headH - 4;
        const skinCol = 0xfdd8b5;
        const legCol = 0x3d2914;

        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();
        cont.addChild(shadow);

        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -h / 2, h * 0.65);
        highlight.visible = false;
        cont.addChild(highlight);

        const legL = new PIXI.Graphics();
        legL.beginFill(legCol); legL.drawRect(-2, 0, 4, 4); legL.endFill();
        legL.x = -bw * 0.15;
        legL.y = -4;
        cont.addChild(legL);
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol); legR.drawRect(-2, 0, 4, 4); legR.endFill();
        legR.x = bw * 0.15;
        legR.y = -4;
        cont.addChild(legR);

        const body = new PIXI.Graphics();
        body.beginFill(suitHex);
        body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1);
        body.endFill();
        body.beginFill(0xffffff, 0.08);
        body.drawRoundedRect(-bw / 2 + 2, bodyH * 0.55, bw - 4, 3, 2);
        body.endFill();
        body.y = -h + headH;
        cont.addChild(body);

        const head = new PIXI.Graphics();
        head.beginFill(skinCol);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, 1.2);
        head.drawCircle( bw * 0.1, headH * 0.38, 1.2);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;
        cont.addChild(head);

        const dot = new PIXI.Graphics();
        dot.beginFill(suitHex);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;
        cont.addChild(dot);

        const nameTxt = new PIXI.Text(m.name ? m.name.split(' ')[0] : m.id, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0xe2e8f0,
            stroke: 0x000000, strokeThickness: 2
        });
        nameTxt.anchor.set(0.5, 1);
        nameTxt.y = -h - 10;
        cont.addChild(nameTxt);

        return { cont, body, head, legL, legR, dot, nameTxt, highlight };
    },

    cleanup() {
        // Remove window-level listeners
        if (this._onMove) window.removeEventListener('pointermove', this._onMove);
        if (this._onUp) window.removeEventListener('pointerup', this._onUp);
        if (this.avatarPool) {
            this.avatarPool.forEach(av => { if (av.cont && av.cont.destroy) av.cont.destroy({ children: true }); });
            this.avatarPool.clear();
        }
        this.avatarPool = null;
        this._hallNPCs = null;
        this.scene = null;
        this.layer = null;
        this.bld = null;
        this.trainGfx = null;
        this._trainG = null;
        this._liftCar = null;
        this._liftCable = null;
        this._liftFloorTxt = null;
        this._liftTop = null;
        this._liftBot = null;
        this._hallFloorY = null;
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this._tunnelLightsCont = null;
        this.isDragging = false;
    }
};
