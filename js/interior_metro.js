/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO STATION INTERIOR (v1.0.0)
   Renders a station cross-section: ticket hall above + stairs + platform + tracks + tunnels.
   Mirrors real-time state of avatars whose _metroLegs pass through this station, so when a
   tracked entity enters/waits/rides/exits the metro, the camera fade carries straight into
   this view with the same behavior visible from the inside.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorMetroStation = {
    scene: null,
    layer: null,
    bld: null,
    avatarLayer: null,
    avatarPool: null, // Map<modelId, {cont, sprite, nameTxt, bubble}>
    trainGfx: null,
    _tunnelLightsCont: null,
    skyContainer: null,
    starsLayer: null,
    celestialGfx: null,
    isDragging: false,
    _startY: 0,
    _startSceneY: 0,
    minY: 0,
    maxY: 0,

    // Visual config per station
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
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.STATION_THEME[bld.id] || { col: 0x22d3ee, label: bld.name ? bld.name.toUpperCase() : 'METRO STATION', sub: '' };

        // Scene container (scrollable)
        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── SKY LAYER (INSIDE scene so it scrolls off when viewing platforms) ───
        // The DOM sky is still set on the viewport so any transparent region of the
        // canvas shows it. Stars + sun/moon are attached to scene so they only appear
        // over the hall/street strip, not over the underground platform when scrolled.
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
            s.y = Math.random() * 30; // only in sky strip
            s._phase = Math.random() * Math.PI * 2;
            this.starsLayer.addChild(s);
        }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);

        // ─── Layout bands ───
        // 0..hallH             : sky / surface / ticket hall
        // hallH..platformTop   : stair shaft cut through rock
        // platformTop..platH   : platform level with tracks / tunnels
        // platH..(platH+deepH) : deep utility strata
        const hallH = 140;
        const stairH = 110;
        const platH = 240;
        const deepH = 140;
        const totalH = hallH + stairH + platH + deepH;

        this.totalH = totalH;
        this.maxY = 0;
        this.minY = Math.min(0, H - totalH);

        // ─── OPEN SKY STRIP (y=0..30) — no fill so DOM sky shows through ───
        // Distant cityscape silhouette at the horizon
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
        // Dashed road line
        street.beginFill(0xfbbf24, 0.5);
        for (let dx = 0; dx < W; dx += 30) street.drawRect(dx, 33, 14, 1);
        street.endFill();
        this.scene.addChild(street);

        // ─── TICKET HALL (enclosed interior with storefront windows) ───
        // The hall has punched-out windows on its upper portion showing the
        // street/sky outside (negative-space wall pattern).
        const hallTop = 38;
        const hallBottom = hallH;
        const hallH_total = hallBottom - hallTop;
        const hall = new PIXI.Graphics();

        // Hall layout bands:
        //   header  (26px): sign strip — station name + subtitle stacked
        //   window  (22px): storefront windows — sky shows through
        //   ticket   (54px): ticket machines + turnstiles on hall floor
        const hallX = 40, hallW = W - 80;
        const headerH = 26;
        const winY = hallTop + headerH;
        const winH_px = 22;
        const winX = hallX + 24;
        const winW = hallW - 48;
        const mullionPitch = 90;
        const mullionW = 8;

        // Draw the hall wall with a punched window cutout
        InteriorCity._drawWallWithWindowCutout(
            hall, 0xf5f5f5,
            hallX, hallTop, hallW, hallH_total,
            winX, winY, winW, winH_px,
            mullionPitch, mullionW
        );
        // Header strip (above the windows) — themed accent band for the sign
        hall.beginFill(theme.col, 0.18);
        hall.drawRect(hallX, hallTop, hallW, headerH);
        hall.endFill();
        hall.beginFill(theme.col, 0.85);
        hall.drawRect(hallX, hallTop, hallW, 3);
        hall.endFill();
        // Window frames (stroked)
        hall.lineStyle(1.5, 0x64748b, 0.9);
        hall.drawRect(winX, winY, winW, winH_px);
        hall.moveTo(winX, winY + winH_px * 0.55);
        hall.lineTo(winX + winW, winY + winH_px * 0.55);
        hall.lineStyle(0);
        // Subtle window tint (very light to keep sky readable)
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

        // Station name in the header strip (upper row, above the windows)
        const nameTxt = new PIXI.Text(theme.label, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 9,
            fill: theme.col, letterSpacing: 2
        });
        nameTxt.anchor.set(0.5, 0);
        nameTxt.x = W / 2;
        nameTxt.y = hallTop + 4;
        if (nameTxt.width > hallW - 16) nameTxt.scale.set((hallW - 16) / nameTxt.width);
        this.scene.addChild(nameTxt);

        // Subtitle in the header strip (lower row, still above the windows)
        const subTxt = new PIXI.Text(theme.sub, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: 0x475569
        });
        subTxt.anchor.set(0.5, 0);
        subTxt.x = W / 2;
        subTxt.y = hallTop + 16;
        if (subTxt.width > hallW - 16) subTxt.scale.set((hallW - 16) / subTxt.width);
        this.scene.addChild(subTxt);

        // Ticket machines along hall floor
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
            // Card reader
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
            // Gate arm
            ts.beginFill(0x94a3b8);
            ts.drawRect(6, 12, 18, 2);
            ts.endFill();
            ts.x = W * 0.35 + i * 36;
            ts.y = hallBottom - 34;
            this.scene.addChild(ts);
        }

        // Ticket-hall NPCs — decorative commuters
        for (let i = 0; i < 8; i++) {
            const npc = new PIXI.Graphics();
            const c = [0x3b82f6, 0xec4899, 0xfbbf24, 0x22c55e, 0x8b5cf6][i % 5];
            npc.beginFill(0xfbbf24, 0.7); npc.drawRect(0, 0, 4, 4); npc.endFill(); // head
            npc.beginFill(c, 0.7);        npc.drawRect(0, 4, 4, 6); npc.endFill(); // body
            npc.beginFill(0x0f172a);      npc.drawRect(0, 10, 4, 3); npc.endFill(); // legs
            npc.x = 80 + i * ((W - 160) / 8) + ((i * 13) % 15);
            npc.y = hallBottom - 23;
            this.scene.addChild(npc);
        }

        // ─── CENTRAL ELEVATOR SHAFT (hallH → hallH + stairH) ───
        // A single lift shaft down the middle replaces stairs/escalator.
        const shaftLeft = W * 0.46;
        const shaftRight = W * 0.54;
        const shaftW = shaftRight - shaftLeft;
        const shaftTop = hallBottom;
        const shaftBottom = hallBottom + stairH;

        // Rock on either side of shaft
        const rock = new PIXI.Graphics();
        rock.beginFill(0x2a1a10);
        rock.drawRect(0, shaftTop, shaftLeft, stairH);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, stairH);
        rock.endFill();
        rock.beginFill(0x3a2218);
        rock.drawRect(0, shaftTop, shaftLeft, 4);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, 4);
        rock.endFill();
        // Rock flecks
        let rs = (bld.x || 0) + 101;
        const rr = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };
        for (let i = 0; i < 160; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 2 && rx < shaftRight + 2) continue;
            rock.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            rock.drawRect(rx, shaftTop + rr() * stairH, 2 + rr() * 3, 2);
            rock.endFill();
        }
        this.scene.addChild(rock);

        // Shaft cavity (dark recessed column)
        const shaft = new PIXI.Graphics();
        shaft.beginFill(0x0a0a14);
        shaft.drawRect(shaftLeft, shaftTop, shaftW, stairH);
        shaft.endFill();
        // Side walls + subtle inner trim
        shaft.beginFill(0x1e293b);
        shaft.drawRect(shaftLeft, shaftTop, 3, stairH);
        shaft.drawRect(shaftRight - 3, shaftTop, 3, stairH);
        shaft.endFill();
        // Rails on the back of the cavity
        shaft.beginFill(0x334155);
        shaft.drawRect(shaftLeft + shaftW * 0.25, shaftTop + 4, 2, stairH - 8);
        shaft.drawRect(shaftLeft + shaftW * 0.75 - 2, shaftTop + 4, 2, stairH - 8);
        shaft.endFill();
        // Counter-weight cable down one side
        shaft.beginFill(0x475569);
        shaft.drawRect(shaftLeft + shaftW * 0.5 - 1, shaftTop + 2, 2, stairH - 4);
        shaft.endFill();
        this.scene.addChild(shaft);

        // Floor indicator (above shaft, in hall band) — illuminated panel
        const floorInd = new PIXI.Graphics();
        floorInd.beginFill(0x0f172a);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.endFill();
        floorInd.lineStyle(1, theme.col, 0.7);
        floorInd.drawRect(shaftLeft - 2, shaftTop - 14, shaftW + 4, 12);
        floorInd.lineStyle(0);
        this.scene.addChild(floorInd);
        const floorTxt = new PIXI.Text('▼ LIFT', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 7,
            fill: theme.col
        });
        floorTxt.anchor.set(0.5, 0.5);
        floorTxt.x = (shaftLeft + shaftRight) / 2;
        floorTxt.y = shaftTop - 8;
        this.scene.addChild(floorTxt);
        this._liftFloorTxt = floorTxt;

        // Elevator car (animated in update) — sits inside the shaft cavity
        const liftCar = new PIXI.Graphics();
        const carW = shaftW - 10;
        const carH = 48;
        // Car body
        liftCar.beginFill(0x1e293b);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.endFill();
        // Themed accent top & bottom
        liftCar.beginFill(theme.col, 0.85);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, 2);
        liftCar.drawRect(-carW / 2, carH / 2 - 2, carW, 2);
        liftCar.endFill();
        // Interior light panel
        liftCar.beginFill(0xfef3c7, 0.55);
        liftCar.drawRect(-carW / 2 + 3, -carH / 2 + 4, carW - 6, 14);
        liftCar.endFill();
        // Door split (two sliding panels)
        liftCar.beginFill(0x334155);
        liftCar.drawRect(-carW / 2 + 3, -carH / 2 + 20, (carW - 6) / 2 - 1, carH - 26);
        liftCar.drawRect(1, -carH / 2 + 20, (carW - 6) / 2 - 1, carH - 26);
        liftCar.endFill();
        // Door seam
        liftCar.beginFill(theme.col, 0.6);
        liftCar.drawRect(-1, -carH / 2 + 20, 2, carH - 26);
        liftCar.endFill();
        liftCar.x = (shaftLeft + shaftRight) / 2;
        liftCar.y = shaftTop + stairH / 2;
        this.scene.addChild(liftCar);
        this._liftCar = liftCar;
        this._liftCarH = carH;
        this._liftTop = { x: liftCar.x, y: shaftTop + carH / 2 + 2 };
        this._liftBot = { x: liftCar.x, y: shaftBottom - carH / 2 - 2 };

        // ─── PLATFORM LEVEL (shaftBottom → shaftBottom + platH) ───
        // Reworked so the train arrives AT the platform (not below it) —
        // the train body straddles the platform edge, exactly like the
        // exterior station view.
        const platTop = shaftBottom;
        const platFloorY = platTop + 130;       // passenger deck Y (avatars stand here)

        // Platform hall back wall — tiled wall rising BEHIND the platform deck.
        // Full height from platTop to platFloorY so there is no dark gap
        // between the tile wall and the passenger deck.
        const backWall = new PIXI.Graphics();
        backWall.beginFill(0x0f172a);
        backWall.drawRect(0, platTop, W, platFloorY - platTop);
        backWall.endFill();
        // Tile courses
        for (let ty = platTop + 12; ty < platFloorY - 6; ty += 16) {
            backWall.beginFill(0x1e293b);
            for (let tx = (ty % 32 === 0) ? 0 : 12; tx < W; tx += 24) {
                backWall.drawRect(tx, ty, 22, 14);
            }
            backWall.endFill();
        }
        this.scene.addChild(backWall);

        // Accent line color band at top of back wall
        const accent = new PIXI.Graphics();
        accent.beginFill(theme.col, 0.9);
        accent.drawRect(0, platTop + 6, W, 3);
        accent.endFill();
        accent.beginFill(theme.col, 0.4);
        accent.drawRect(0, platTop + 9, W, 1);
        accent.endFill();
        this.scene.addChild(accent);

        // Platform concrete slab (the passenger deck avatars stand on)
        const slab = new PIXI.Graphics();
        slab.beginFill(0x475569);
        slab.drawRect(0, platFloorY, W, 6);
        slab.endFill();
        slab.beginFill(0x64748b);
        slab.drawRect(0, platFloorY, W, 1);
        slab.endFill();
        // Yellow safety stripe along the edge
        slab.beginFill(0xfbbf24);
        slab.drawRect(0, platFloorY + 6, W, 3);
        slab.endFill();
        slab.beginFill(0x1a1a2e);
        for (let dx = 0; dx < W; dx += 12) slab.drawRect(dx, platFloorY + 6, 6, 3);
        slab.endFill();
        this.scene.addChild(slab);

        // Departure board
        const board = new PIXI.Graphics();
        board.beginFill(0x0a0a14);
        board.drawRect(W * 0.35, platTop + 16, W * 0.3, 24);
        board.endFill();
        board.lineStyle(1, theme.col, 0.8);
        board.drawRect(W * 0.35, platTop + 16, W * 0.3, 24);
        board.lineStyle(0);
        this.scene.addChild(board);
        const boardTxt = new PIXI.Text('NEXT TRAIN · ARRIVING', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            fill: theme.col
        });
        boardTxt.anchor.set(0.5, 0.5);
        boardTxt.x = W / 2;
        boardTxt.y = platTop + 28;
        this.scene.addChild(boardTxt);
        this._boardTxt = boardTxt;

        // Support pillars on platform
        for (let px = 60; px < W - 40; px += 160) {
            const col = new PIXI.Graphics();
            col.beginFill(0x64748b);
            col.drawRect(px, platTop + 12, 10, platFloorY - platTop - 12);
            col.endFill();
            col.beginFill(theme.col, 0.3);
            col.drawRect(px, platTop + 12, 10, 3);
            col.endFill();
            this.scene.addChild(col);
        }

        // Benches along platform
        for (let bx = 120; bx < W - 120; bx += 220) {
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

        // Store platform anchors
        this._platFloorY = platFloorY;
        this._platStandY = platFloorY - 14; // avatars stand here

        // ─── TRACK BED + TRAIN CORRIDOR ───
        // The train arrives AT the platform — train body straddles platFloorY
        // so most of it is ABOVE the platform edge (visible over the deck),
        // exactly like the exterior view where avatars board at grade.
        const trainCenterY = platFloorY - 28;   // centerline well above the platform edge
        const trainBodyH = 75;                  // matches exterior train height
        const trackTop = trainCenterY - trainBodyH / 2;
        const trackBottom = platTop + platH - 10;
        const trainBottomY = trainCenterY + trainBodyH / 2;

        // Dark tunnel/back-of-track region — starts at the platform edge
        // (just below the passenger slab) and extends down past the train.
        const tbedTop = platFloorY + 9;
        const tbed = new PIXI.Graphics();
        tbed.beginFill(0x050510);
        tbed.drawRect(0, tbedTop, W, trackBottom - tbedTop);
        tbed.endFill();
        // Ballast texture beneath the train wheels
        for (let i = 0; i < 100; i++) {
            tbed.beginFill(0x1a1a24, 0.7);
            tbed.drawRect(rr() * W, trainBottomY + rr() * (trackBottom - trainBottomY - 2), 2, 2);
            tbed.endFill();
        }
        // Rails at wheel level (just below train bottom)
        const railY = trainBottomY - 4;
        tbed.beginFill(0xd4d4d4);
        tbed.drawRect(0, railY, W, 2);
        tbed.drawRect(0, railY + 10, W, 2);
        tbed.endFill();
        // Sleepers between rails
        tbed.beginFill(0x3a2218);
        for (let sx = 0; sx < W; sx += 20) tbed.drawRect(sx, railY - 2, 14, 16);
        tbed.endFill();
        // Power rail (third rail) — subtle yellow line
        tbed.beginFill(0xfbbf24, 0.4);
        tbed.drawRect(0, trackBottom - 8, W, 2);
        tbed.endFill();
        this.scene.addChild(tbed);

        // Tunnel mouth gradients — span the full train-band height so the
        // train appears to emerge from the tunnel at the correct level.
        const tunnelTop = trackTop;
        const tunnelBottom = trackBottom;
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

        // Tunnel red safety lights (static strip) — up near the train roof line
        const lights = new PIXI.Graphics();
        lights.beginFill(0xef4444);
        for (let lx = 20; lx < W; lx += 70) {
            lights.drawCircle(lx, tunnelTop + 8, 2);
        }
        lights.endFill();
        this.scene.addChild(lights);

        // Store track anchors
        this._trackY = trainCenterY;
        this._trainBodyH = trainBodyH;
        this._trackTop = trackTop;
        this._trackBottom = trackBottom;

        // ─── DEEP EARTH STRATA (below tracks) ───
        // Replaces the old blue/orange pipe bands (which read as a "blue void").
        // Now just dark earth with rock flecks and small utility conduits.
        const deepTop = platTop + platH;
        const deep = new PIXI.Graphics();
        deep.beginFill(0x2a1a10);
        deep.drawRect(0, deepTop, W, deepH);
        deep.endFill();
        // Strata bands (very subtle earth tones)
        deep.beginFill(0x1f100a, 0.6);
        deep.drawRect(0, deepTop + 20, W, 4);
        deep.drawRect(0, deepTop + 60, W, 3);
        deep.drawRect(0, deepTop + 100, W, 5);
        deep.endFill();
        // Rock flecks scattered through the earth
        for (let i = 0; i < 140; i++) {
            deep.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            deep.drawRect(rr() * W, deepTop + rr() * deepH, 2 + rr() * 3, 2);
            deep.endFill();
        }
        // Small embedded utility pipes (short segments, not full-width voids)
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

        // ─── TRAIN LAYER (animated above tracks) ───
        this.trainGfx = new PIXI.Container();
        this.trainGfx.sortableChildren = true;
        this.scene.addChild(this.trainGfx);
        this._trainG = new PIXI.Graphics();
        this.trainGfx.addChild(this._trainG);

        // ─── AVATAR LAYER (real-time mirror of outside entities) ───
        this.avatarLayer = new PIXI.Container();
        this.avatarLayer.sortableChildren = true;
        this.scene.addChild(this.avatarLayer);

        // Initial position at top of scene
        this.scene.y = 0;

        // ─── SCROLL HANDLERS ───
        layer.eventMode = 'static';
        layer.on('pointerdown', this._onDown = (e) => {
            this.isDragging = true;
            this._startY = e.data.global.y;
            this._startSceneY = this.scene.y;
        });
        layer.on('pointermove', this._onMove = (e) => {
            if (!this.isDragging) return;
            const dy = e.data.global.y - this._startY;
            this.scene.y = Math.max(this.minY, Math.min(this.maxY, this._startSceneY + dy));
        });
        layer.on('pointerup',        this._onUp = () => { this.isDragging = false; });
        layer.on('pointerupoutside', this._onUp);

        // Auto-scroll so platform is visible (center on the track bed)
        const focusY = platTop + platH * 0.3;
        if (focusY > H * 0.5 && totalH > H) {
            this.scene.y = Math.max(this.minY, -(focusY - H * 0.4));
        }

        // Initial paint
        this.update();
    },

    update() {
        if (!this.scene || !this.bld || !this.avatarLayer) return;

        // Paint DOM sky gradient so the ticket-hall storefront windows show the
        // correct time-of-day sky. Skip celestial gfx (sun/moon would arc outside
        // the 30px sky strip); only animate the star field.
        if (typeof InteriorCity !== 'undefined' && InteriorCity._applyDynamicSky) {
            InteriorCity._applyDynamicSky(null, this.starsLayer);
        }

        const stationX = this.bld.x + this.bld.w / 2;
        const W = G.vpW;
        const theme = this.STATION_THEME[this.bld.id] || { col: 0x22d3ee };

        // ─── Animate lift car ───
        // Slow vertical bounce between hall level (top of shaft) and platform level
        // (bottom of shaft). Cycle is ~12s so it feels like a real elevator.
        if (this._liftCar && this._liftTop && this._liftBot) {
            const tick = (typeof G !== 'undefined' && G.tick) || 0;
            const cycle = 720; // ~12s
            const t = (tick % cycle) / cycle;
            // Ease between top/bottom with dwell at each end
            let p;
            if (t < 0.1)      p = 0;                          // dwell top
            else if (t < 0.5) p = (t - 0.1) / 0.4;             // descend
            else if (t < 0.6) p = 1;                           // dwell bottom
            else              p = 1 - (t - 0.6) / 0.4;         // ascend
            this._liftCar.y = this._liftTop.y + p * (this._liftBot.y - this._liftTop.y);
            if (this._liftFloorTxt) {
                this._liftFloorTxt.text = p < 0.2 ? '▲ HALL' : p > 0.8 ? '▼ PLATFORM' : '⇅ LIFT';
            }
        }

        // ─── Animate the single arriving train ───
        // Exterior-style visual (matches createTrainObj in entities_gfx.js).
        const g = this._trainG;
        if (g) {
            g.clear();
            const trainCenterY = this._trackY;
            const trainW = 360;  // exterior train width
            const tick = (typeof G !== 'undefined' && G.tick) || 0;
            const cycle = 720; // ~12s full cycle (arrive → dwell → depart)
            const phase = (tick % cycle) / cycle;

            const cx = this._computeTrainCenterX(phase, trainW, W);
            this._drawExteriorTrain(g, cx, trainCenterY, phase);

            // Update board text
            if (this._boardTxt) {
                if (phase < 0.35) this._boardTxt.text = 'NEXT TRAIN · ARRIVING';
                else if (phase < 0.55) this._boardTxt.text = 'NEXT TRAIN · AT PLATFORM';
                else if (phase < 0.75) this._boardTxt.text = 'NEXT TRAIN · DEPARTING';
                else this._boardTxt.text = 'NEXT TRAIN · 1 MIN';
            }
        }

        // ─── Mirror real-time avatars whose route includes this station ───
        if (typeof G === 'undefined' || !G.charRefs || !G.models) return;

        const seen = new Set();
        const W2 = G.vpW;
        const platL = W2 * 0.12;
        const platR = W2 * 0.88;
        const platW = platR - platL;

        for (let mi = 0; mi < G.models.length; mi++) {
            const m = G.models[mi];
            const refs = G.charRefs[m.id];
            if (!refs) continue;
            if (!refs._metroState || refs._metroState === 'none') continue;
            if (!refs._metroLegs || refs._metroLegs.length === 0) continue;

            // Is this station on their route?
            let legIdx = -1;
            for (let li = 0; li < refs._metroLegs.length; li++) {
                if (Math.abs(refs._metroLegs[li] - stationX) < 8) { legIdx = li; break; }
            }
            if (legIdx === -1) continue;

            // Determine whether they are currently AT this station
            const currentLegX = refs._metroLegs[refs._currentLeg];
            const atThisStation = Math.abs(currentLegX - stationX) < 8;

            // For 'riding', also show them if the train passes through here
            const isRiding = refs._metroState === 'riding';
            const nextLegX = refs._metroLegs[refs._currentLeg + 1];
            const passingThrough = isRiding && nextLegX !== undefined &&
                                   ((currentLegX <= stationX && stationX <= nextLegX) ||
                                    (nextLegX <= stationX && stationX <= currentLegX));

            if (!atThisStation && !passingThrough) continue;

            seen.add(m.id);

            // Compute interior position based on state
            let ix, iy;
            const spread = ((m.id.charCodeAt(0) * 31 + mi * 7) % Math.max(1, platW - 80)) - (platW - 80) / 2;

            if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                // Inside the elevator car — position matches animated lift Y
                ix = this._liftCar ? this._liftCar.x : W2 / 2;
                iy = this._liftCar ? this._liftCar.y : (this._liftTop.y + this._liftBot.y) / 2;
            } else if (refs._metroState === 'waiting_train') {
                // Standing on platform
                ix = W2 / 2 + spread * 0.8;
                iy = this._platStandY;
            } else if (refs._metroState === 'riding') {
                // Inside the train — use train body position (center of tracks for now)
                if (passingThrough && !atThisStation) {
                    // Zooming through — follow a moving x across the scene
                    const tick = (typeof G !== 'undefined' && G.tick) || 0;
                    const pass = ((tick + (mi * 17) % 100) % 300) / 300;
                    ix = -80 + pass * (W2 + 160);
                    iy = this._trackY - 4;
                } else {
                    ix = W2 / 2 + spread * 0.4;
                    iy = this._trackY - 4;
                }
            } else {
                ix = W2 / 2 + spread;
                iy = this._platStandY;
            }

            // Get or create avatar display object
            let av = this.avatarPool.get(m.id);
            if (!av) {
                av = this._makeAvatarSprite(m);
                this.avatarLayer.addChild(av.cont);
                this.avatarPool.set(m.id, av);
            }
            av.cont.x = ix;
            av.cont.y = iy;
            av.cont.visible = true;

            // Highlight if this model is being tracked
            const isTracked = G.tracking && G.tracking.type === 'model' && G.tracking.id === m.id;
            av.highlight.visible = !!isTracked;
        }

        // Hide avatars that are no longer here
        this.avatarPool.forEach((av, id) => {
            if (!seen.has(id)) av.cont.visible = false;
        });
    },

    _computeTrainCenterX(phase, trainW, W) {
        // Phase: 0..0.35  train slides in from the left tunnel to station center
        //        0.35..0.65 dwelling at the station
        //        0.65..1.0 departs toward the right tunnel
        // Returns the train's CENTER x position.
        const stationCx = W / 2;
        const offscreenL = -trainW / 2 - 20;
        const offscreenR = W + trainW / 2 + 20;
        if (phase < 0.35) {
            const t = phase / 0.35;
            return offscreenL + t * (stationCx - offscreenL);
        } else if (phase < 0.65) {
            return stationCx;
        } else {
            const t = (phase - 0.65) / 0.35;
            return stationCx + t * (offscreenR - stationCx);
        }
    },

    // ─────────────────────────────────────────────────────────────
    //  EXTERIOR-MATCHING TRAIN VISUAL
    //  Mirrors js/entities_gfx.js createTrainObj exactly so the
    //  interior station train looks identical to the city train.
    //  Dimensions: body 360×65 (y=-35..30), skirt 350×10 (y=30..40).
    //  Call with (cx, cy) = train center (horizontal midline).
    // ─────────────────────────────────────────────────────────────
    _drawExteriorTrain(g, cx, cy, phase) {
        // ─ Body (tBg)
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

        // ─ Front overlay (fGfx)
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
        // Three big window blocks
        g.beginFill(0x64748b);
        g.drawRect(cx - 100, cy - 28, 20, 50);
        g.drawRect(cx + 0,   cy - 28, 20, 50);
        g.drawRect(cx + 100, cy - 28, 20, 50);
        g.endFill();
        // Window panes (dark interior)
        g.beginFill(0x0f172a, 0.6);
        g.drawRect(cx - 96, cy - 18, 12, 16);
        g.drawRect(cx + 4,  cy - 18, 12, 16);
        g.drawRect(cx + 104, cy - 18, 12, 16);
        g.endFill();
        // Skirt housing
        g.beginFill(0x1e293b);
        g.drawRect(cx - 175, cy + 30, 350, 10);
        g.endFill();
        // Cyan accent line across middle
        g.beginFill(0x0ea5e9);
        g.drawRect(cx - 180, cy - 2, 360, 4);
        g.endFill();
        // Glass overlay tint
        g.beginFill(0xe0f2fe, 0.15);
        g.drawRect(cx - 180, cy - 20, 360, 16);
        g.endFill();

        // ─ Headlights (red left, green right)
        g.beginFill(0xef4444);
        g.drawCircle(cx - 175, cy, 4);
        g.endFill();
        g.beginFill(0x4ade80);
        g.drawCircle(cx + 175, cy, 4);
        g.endFill();

        // Door slit highlights when dwelling at the station
        if (phase > 0.35 && phase < 0.65) {
            g.beginFill(0xfef08a, 0.4);
            for (const px of [-100, 0, 100]) {
                g.drawRect(cx + px - 1, cy - 28, 1, 50);
                g.drawRect(cx + px + 20, cy - 28, 1, 50);
            }
            g.endFill();
        }
    },

    _makeAvatarSprite(m) {
        const cont = new PIXI.Container();

        // Highlight ring (visible when tracked)
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -6, 10);
        highlight.visible = false;
        cont.addChild(highlight);

        // Simple pixel avatar matching outside style
        const body = new PIXI.Graphics();
        const labCol = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].col) ? LABS[m.lab].col : 0x22d3ee;
        // Head
        body.beginFill(0xfbbf24);
        body.drawRect(-3, -14, 6, 6);
        body.endFill();
        // Torso (lab color)
        body.beginFill(typeof labCol === 'string' ? parseInt(labCol.replace('#', '0x')) : labCol);
        body.drawRect(-4, -8, 8, 10);
        body.endFill();
        // Legs
        body.beginFill(0x0f172a);
        body.drawRect(-4, 2, 3, 6);
        body.drawRect(1, 2, 3, 6);
        body.endFill();
        cont.addChild(body);

        // Name label
        const nameTxt = new PIXI.Text(m.name ? m.name.split(' ')[0] : m.id, {
            fontFamily: 'monospace', fontSize: 7, fill: 0xe2e8f0
        });
        nameTxt.anchor.set(0.5, 1);
        nameTxt.y = -18;
        cont.addChild(nameTxt);

        return { cont, body, nameTxt, highlight };
    },

    cleanup() {
        if (this.layer && this._onDown) {
            this.layer.off('pointerdown', this._onDown);
            this.layer.off('pointermove', this._onMove);
            this.layer.off('pointerup', this._onUp);
            this.layer.off('pointerupoutside', this._onUp);
        }
        if (this.avatarPool) {
            this.avatarPool.forEach(av => { if (av.cont && av.cont.destroy) av.cont.destroy({ children: true }); });
            this.avatarPool.clear();
        }
        this.avatarPool = null;
        this.scene = null;
        this.layer = null;
        this.bld = null;
        this.trainGfx = null;
        this._trainG = null;
        this._boardTxt = null;
        this._liftCar = null;
        this._liftFloorTxt = null;
        this._liftTop = null;
        this._liftBot = null;
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this.isDragging = false;
    }
};
