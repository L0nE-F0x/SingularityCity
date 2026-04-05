/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO STATION INTERIOR (v1.1.0 — Exterior-matched visuals + real train sync)
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

        // ─── EARTH/BEDROCK flanking the glass elevator shaft ───
        // The hall→platform gap is filled with dark earth on either side of a
        // central vertical glass lift shaft that matches the EXTERIOR station
        // glass-front (0x22d3ee @ 0.1 fill, 0x22d3ee @ 0.4 stroke).
        const shaftW = 60;                      // wider than exterior (which is 40) — scaled up
        const shaftLeft = W / 2 - shaftW / 2;
        const shaftRight = W / 2 + shaftW / 2;
        const shaftTop = hallBottom;             // lift arrives level with hall floor
        // shaftBottom is set after platFloorY is known — lift descends all the
        // way to the platform deck so avatars step straight out onto it.
        const platTop = hallBottom + stairH;
        const platFloorY = platTop + 130;        // passenger deck Y (avatars stand here)
        const shaftBottom = platFloorY;          // lift floor flush with platform deck

        // Seeded rng for rock flecks + ballast
        let rs = (bld.x || 0) + 101;
        const rr = () => { rs = (rs * 16807) % 2147483647; return (rs - 1) / 2147483646; };

        // Rock flanks (spans full hall→platform depth, cut around the glass shaft)
        const rock = new PIXI.Graphics();
        rock.beginFill(0x2a1a10);
        rock.drawRect(0, shaftTop, shaftLeft, shaftBottom - shaftTop);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, shaftBottom - shaftTop);
        rock.endFill();
        // Earth-to-station transition band
        rock.beginFill(0x3a2218);
        rock.drawRect(0, shaftTop, shaftLeft, 4);
        rock.drawRect(shaftRight, shaftTop, W - shaftRight, 4);
        rock.endFill();
        // Rock flecks
        for (let i = 0; i < 260; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft - 2 && rx < shaftRight + 2) continue;
            rock.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            rock.drawRect(rx, shaftTop + rr() * (shaftBottom - shaftTop), 2 + rr() * 3, 2);
            rock.endFill();
        }
        this.scene.addChild(rock);

        // ─── GLASS ELEVATOR SHAFT (matches exterior glassFront) ───
        // Light cyan fill 0x22d3ee @ 0.1, cyan stroke 0x22d3ee @ 0.4, same as
        // entities_gfx.js createStationVisuals glassFront.
        const glassShaft = new PIXI.Graphics();
        // Dark backing so the cyan tint reads as glass over deep interior
        glassShaft.beginFill(0x050510, 0.85);
        glassShaft.drawRect(shaftLeft + 2, shaftTop + 2, shaftW - 4, shaftBottom - shaftTop - 4);
        glassShaft.endFill();
        // Cyan glass tint
        glassShaft.beginFill(0x22d3ee, 0.10);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.endFill();
        // Cyan glass frame (matches exterior 2px stroke)
        glassShaft.lineStyle(2, 0x22d3ee, 0.4);
        glassShaft.drawRect(shaftLeft, shaftTop, shaftW, shaftBottom - shaftTop);
        glassShaft.lineStyle(0);
        // Subtle vertical divider down the middle (hints at the rails behind the glass)
        glassShaft.beginFill(0x22d3ee, 0.15);
        glassShaft.drawRect(shaftLeft + shaftW / 2 - 1, shaftTop + 4, 2, shaftBottom - shaftTop - 8);
        glassShaft.endFill();
        // Horizontal glass segment lines (~every 30px) to evoke a modular shaft
        glassShaft.beginFill(0x22d3ee, 0.18);
        for (let sy = shaftTop + 30; sy < shaftBottom - 6; sy += 30) {
            glassShaft.drawRect(shaftLeft + 2, sy, shaftW - 4, 1);
        }
        glassShaft.endFill();
        this.scene.addChild(glassShaft);

        // Floor indicator above the shaft (top of hall band)
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
        // Small grey platform (mirrors exterior createElevatorPlatform:
        // fill 0x94a3b8, stroke 0x22d3ee @ 0.5). Scaled up a bit so multiple
        // avatars can ride together visibly.
        const liftCar = new PIXI.Graphics();
        const carW = shaftW - 14;
        const carH = 6;
        // Cable from top of shaft down to car
        const cable = new PIXI.Graphics();
        cable.beginFill(0x22d3ee, 0.35);
        cable.drawRect((shaftLeft + shaftRight) / 2 - 1, shaftTop + 2, 2, 10);
        cable.endFill();
        this.scene.addChild(cable);
        this._liftCable = cable;
        // Platform plank
        liftCar.beginFill(0x94a3b8);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.endFill();
        liftCar.lineStyle(1, 0x22d3ee, 0.6);
        liftCar.drawRect(-carW / 2, -carH / 2, carW, carH);
        liftCar.lineStyle(0);
        // Deck highlight
        liftCar.beginFill(0xe2e8f0, 0.6);
        liftCar.drawRect(-carW / 2 + 1, -carH / 2 + 1, carW - 2, 1);
        liftCar.endFill();
        // Side guide rails (extend a bit above the plank for visual grip)
        liftCar.beginFill(0x22d3ee, 0.5);
        liftCar.drawRect(-carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.drawRect(carW / 2 - 1, -carH / 2 - 3, 2, carH + 6);
        liftCar.endFill();
        liftCar.x = (shaftLeft + shaftRight) / 2;
        liftCar.y = shaftTop + 20;   // starts parked at top
        this.scene.addChild(liftCar);
        this._liftCar = liftCar;
        this._liftCarH = carH;
        // Avatars on the lift stand ON TOP of the plank (feet at plank top).
        this._liftTop = { x: liftCar.x, y: shaftTop + 12 };
        this._liftBot = { x: liftCar.x, y: shaftBottom - 2 };

        // ─── PLATFORM LEVEL (back wall + deck, matching EXTERIOR colors) ───
        // Exterior back wall: 0x0a0a12 fill with 0x1e1e2f thin verticals every 20px,
        // 0x11111a side pillars, 0x2a2a3e slab, 0xfacc15 yellow line, 0xd97706 sleepers.
        const platW = W;                          // full interior width
        const backWallH = platFloorY - platTop;   // from top of platform to deck

        const backWall = new PIXI.Graphics();
        backWall.beginFill(0x0a0a12);
        backWall.drawRect(0, platTop, platW, backWallH);
        backWall.endFill();
        // Thin vertical courses (matches exterior pattern)
        backWall.lineStyle(1, 0x1e1e2f, 0.5);
        for (let wx = 0; wx <= platW; wx += 20) {
            backWall.moveTo(wx, platTop);
            backWall.lineTo(wx, platFloorY);
        }
        backWall.lineStyle(0);
        // Side pillars (darker) — scaled to interior viewport
        backWall.beginFill(0x11111a);
        backWall.drawRect(0, platTop, 30, backWallH);
        backWall.drawRect(platW - 30, platTop, 30, backWallH);
        backWall.endFill();
        // Cut a "cavity" around the glass shaft so the glass reads as continuous
        backWall.beginFill(0x050510);
        backWall.drawRect(shaftLeft + 2, platTop, shaftW - 4, backWallH);
        backWall.endFill();
        this.scene.addChild(backWall);

        // Neon sign backs (left and right) — same treatment as exterior
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

        // Platform deck slab (exterior: 0x2a2a3e, 15 tall)
        const slab = new PIXI.Graphics();
        slab.beginFill(0x2a2a3e);
        slab.drawRect(0, platFloorY, platW, 15);
        slab.endFill();
        // Yellow safety line (exterior: 0xfacc15 at deck+13, 2 tall)
        slab.beginFill(0xfacc15);
        slab.drawRect(0, platFloorY + 13, platW, 2);
        slab.endFill();
        // Orange sleepers (exterior: 0xd97706 at deck+11, 4x2 every 6)
        slab.beginFill(0xd97706);
        for (let sx = 0; sx < platW; sx += 6) {
            slab.drawRect(sx, platFloorY + 11, 4, 2);
        }
        slab.endFill();
        this.scene.addChild(slab);

        // Benches along platform (skip the central shaft region)
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

        // Store platform anchors. Feet on the deck.
        this._platFloorY = platFloorY;
        this._platStandY = platFloorY;
        this._hallFloorY = hallBottom - 2;    // where avatars stand in the hall

        // ─── TRACK BED + TRAIN CORRIDOR (matches exterior cross-section) ───
        // Exterior: tunnelY = platformY + 8, train body spans tunnelY-35..tunnelY+30.
        // So trainCenterY sits 8 px BELOW the avatar deck and the upper 27 px
        // of the train body overlaps the deck — same overlap as outside.
        const trainCenterY = platFloorY + 8;
        const trainBodyH = 65;                  // exterior train body is 65 tall (65 + 10 skirt)
        const trainTopY = trainCenterY - 35;
        const trainBottomY = trainCenterY + 40; // includes skirt
        const trackBottom = platTop + platH - 10;

        // Dark tunnel/back-of-track region — starts BELOW the slab and extends
        // down to the deep earth line.
        const tbedTop = platFloorY + 18;        // below the 15-tall slab + yellow line
        const tbed = new PIXI.Graphics();
        tbed.beginFill(0x050510);
        tbed.drawRect(0, tbedTop, W, trackBottom - tbedTop);
        tbed.endFill();
        // Rails at wheel level (just below train skirt)
        const railY = trainBottomY - 4;
        tbed.beginFill(0xd4d4d4);
        tbed.drawRect(0, railY, W, 2);
        tbed.drawRect(0, railY + 10, W, 2);
        tbed.endFill();
        // Track sleepers between rails (matches exterior underground gfx tones)
        tbed.beginFill(0x3a2218);
        for (let sx = 0; sx < W; sx += 20) tbed.drawRect(sx, railY - 2, 14, 16);
        tbed.endFill();
        // Ballast speckle beneath the rails
        for (let i = 0; i < 120; i++) {
            tbed.beginFill(0x1a1a24, 0.7);
            tbed.drawRect(rr() * W, railY + 14 + rr() * (trackBottom - railY - 16), 2, 2);
            tbed.endFill();
        }
        // Power rail (third rail) — subtle yellow line
        tbed.beginFill(0xfbbf24, 0.4);
        tbed.drawRect(0, trackBottom - 8, W, 2);
        tbed.endFill();
        this.scene.addChild(tbed);

        // Tunnel mouths at viewport edges (span only the train body height so
        // the train appears to emerge from them at the correct level).
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

        // Store track anchors
        this._trackY = trainCenterY;
        this._trainBodyH = trainBodyH;
        this._trackTop = trainTopY;
        this._trackBottom = trackBottom;

        // ─── DEEP EARTH STRATA (below tracks) ───
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
        const tick = (typeof G !== 'undefined' && G.tick) || 0;

        // ─── Draw ALL real exterior trains within interior viewport range ───
        // Each train's interior center X is simply W/2 + (t.x - stationX), so
        // when the outside train is at this station, it's perfectly centered
        // in the interior view; as it rolls toward its next station, it slides
        // out through the tunnel mouth at the exact same speed.
        const g = this._trainG;
        if (g) {
            g.clear();
            const trainCenterY = this._trackY;
            const trainHalfW = 180;
            const offscreenCut = W / 2 + trainHalfW + 10;

            // Collect real trains from Entities (exterior module)
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
                // Only draw trains whose route touches this station
                const servesThisStation =
                    Math.abs(t.st1 - stationX) < 8 || Math.abs(t.st2 - stationX) < 8;
                if (!servesThisStation) continue;

                const cxOffset = t.x - stationX;
                if (Math.abs(cxOffset) > offscreenCut) continue; // fully off-screen

                const cx = W / 2 + cxOffset;
                const bob = (t.state === 'moving') ? Math.sin(tick * 0.5) * 1.5 : 0;
                const cy = trainCenterY + bob;
                // At-station means x is close to the station (body centered)
                const atStation = Math.abs(cxOffset) < 5;
                this._drawExteriorTrain(g, cx, cy, atStation, t.dir);
            }
        }

        // ─── Drive the LIFT based on actual avatars using it ───
        // The exterior state machine drives refs._logicalY from ground level
        // (~G.groundY - 20) down to platformY (~G.groundY + 112) over the
        // 'entering' phase (and reverse for 'exiting'). We map that progress
        // to the interior shaft so the lift car visibly carries the avatar.
        const groundY = G.groundY || 0;
        const surfaceY = groundY - 20;
        const exteriorPlatY = groundY + 112;
        const descentRange = exteriorPlatY - surfaceY;      // ~132
        const shaftTopY = this._liftTop ? this._liftTop.y : 0;
        const shaftBotY = this._liftBot ? this._liftBot.y : 0;
        const shaftRange = shaftBotY - shaftTopY;

        let liftTarget = shaftTopY; // default idle at hall floor
        let liftActive = false;

        if (G && G.charRefs && G.models) {
            // First pass — find any avatar currently in the shaft, compute lift Y
            for (let mi = 0; mi < G.models.length; mi++) {
                const m = G.models[mi];
                const refs = G.charRefs[m.id];
                if (!refs) continue;
                if (refs._metroState !== 'entering' && refs._metroState !== 'exiting') continue;
                if (!refs._metroLegs) continue;
                // Must be at THIS station in their leg schedule
                const legX = refs._metroLegs[refs._currentLeg];
                if (Math.abs(legX - stationX) > 8) continue;
                // Compute how far they are along the descent
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                liftTarget = shaftTopY + progress * shaftRange;
                liftActive = true;
                break; // first one drives the lift
            }
        }

        if (this._liftCar) {
            // Smoothly interpolate toward target so it moves elevator-like
            const cur = this._liftCar.y;
            this._liftCar.y = cur + (liftTarget - cur) * 0.25;
            if (this._liftCable) {
                // Cable visually extends from top of shaft to top of car
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

        // ─── Mirror real-time avatars whose route includes this station ───
        if (typeof G === 'undefined' || !G.charRefs || !G.models) return;

        const seen = new Set();
        const platStandY = this._platStandY;
        const hallFloorY = this._hallFloorY || 127; // avatars stand on hall floor

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
            const spread = ((m.id.charCodeAt(0) * 31 + mi * 7) % 240) - 120;

            if (refs._metroState === 'entering' || refs._metroState === 'exiting') {
                // Real descent progress drives BOTH the lift car and the avatar:
                // - 0%   → in hall, walking toward shaft (y at hall floor)
                // - 100% → on platform, walking out of shaft (y at platform)
                // In between they ride the lift plank, feet at plank top.
                const ly = refs._logicalY != null ? refs._logicalY : surfaceY;
                const progress = Math.max(0, Math.min(1, (ly - surfaceY) / descentRange));
                if (progress < 0.02) {
                    // Hall phase — walking across hall toward shaft
                    const dxExt = (refs.c && refs.c.x != null) ? (refs.c.x - stationX) : 0;
                    const clampedDx = Math.max(-W / 2 + 80, Math.min(W / 2 - 80, dxExt));
                    ix = W / 2 + clampedDx;
                    iy = hallFloorY;
                } else if (progress > 0.98) {
                    // Just stepped onto the platform — spread out near shaft
                    ix = W / 2 + spread * 0.3;
                    iy = platStandY;
                } else {
                    // Riding the lift plank
                    ix = this._liftCar.x;
                    iy = this._liftCar.y - 3; // feet on plank top
                }
            } else if (refs._metroState === 'waiting_train') {
                // Standing on platform — fan out across the deck
                ix = W / 2 + spread * 0.9;
                iy = platStandY;
            } else if (refs._metroState === 'riding') {
                // Inside the train — use the riding train's actual position
                let ridingX = null;
                if (refs._ridingTrain && refs._ridingTrain.x != null) {
                    ridingX = refs._ridingTrain.x;
                }
                if (ridingX == null) {
                    ix = W / 2 + spread * 0.3;
                } else {
                    // Follow the train's interior center. rideOffset is capped ±150
                    // to stay inside the 360-wide body. Use a deterministic spread.
                    const rideOffset = Math.max(-140, Math.min(140, spread));
                    ix = W / 2 + (ridingX - stationX) + rideOffset;
                }
                // Passengers sit in the upper half of the train body
                iy = this._trackY - 8;
            } else {
                ix = W / 2 + spread;
                iy = platStandY;
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
            av.cont.zIndex = Math.round(iy);

            // Animate walking legs when in 'entering' or 'exiting' hall phase
            const isWalking = (refs._metroState === 'entering' || refs._metroState === 'exiting');
            if (av.legL && av.legR) {
                const phase = isWalking ? Math.sin(tick * 0.25 + (m.id.charCodeAt(0) * 0.3)) : 0;
                av.legL.x = -2.4 + phase * 1.2;
                av.legR.x =  2.4 - phase * 1.2;
            }

            // Highlight if this model is being tracked
            const isTracked = G.tracking && G.tracking.type === 'model' && G.tracking.id === m.id;
            if (av.highlight) av.highlight.visible = !!isTracked;
        }

        // Hide avatars that are no longer here
        this.avatarPool.forEach((av, id) => {
            if (!seen.has(id)) av.cont.visible = false;
        });
    },

    // ─────────────────────────────────────────────────────────────
    //  EXTERIOR-MATCHING TRAIN VISUAL
    //  Mirrors js/entities_gfx.js createTrainObj exactly so the
    //  interior station train looks identical to the city train.
    //  Dimensions: body 360×65 (y=-35..30), skirt 350×10 (y=30..40).
    //  Call with (cx, cy) = train center (horizontal midline).
    // ─────────────────────────────────────────────────────────────
    _drawExteriorTrain(g, cx, cy, atStation, dir) {
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

        // ─ Headlights — follow travel direction (matches exterior live update)
        const dirSign = dir || 1;
        const leftCol  = dirSign > 0 ? 0xef4444 : 0x4ade80;
        const rightCol = dirSign > 0 ? 0x4ade80 : 0xef4444;
        g.beginFill(leftCol);
        g.drawCircle(cx - 175, cy, 4);
        g.endFill();
        g.beginFill(rightCol);
        g.drawCircle(cx + 175, cy, 4);
        g.endFill();

        // Door slit highlights when dwelling at the station
        if (atStation) {
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

        // Lab suit color (note: real field is .color, not .col)
        let suitHex = 0x22d3ee;
        if (typeof LABS !== 'undefined' && LABS[m.lab]) {
            const c = LABS[m.lab].color || LABS[m.lab].col;
            if (typeof c === 'string') suitHex = parseInt(c.replace('#', '0x'));
            else if (typeof c === 'number') suitHex = c;
        }

        // Exterior-matched proportions (from updateCharStateVisuals):
        // bw=16, h=32, headH≈11, bodyH=h-headH-4=17, legH=4.
        const bw = 16, h = 32, headH = 11, bodyH = h - headH - 4;
        const skinCol = 0xfdd8b5;
        const legCol = 0x3d2914;

        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();
        cont.addChild(shadow);

        // Highlight ring (behind body, visible when tracked)
        const highlight = new PIXI.Graphics();
        highlight.lineStyle(2, 0x22d3ee, 0.9);
        highlight.drawCircle(0, -h / 2, h * 0.65);
        highlight.visible = false;
        cont.addChild(highlight);

        // Legs (positioned absolutely, bodyBottom = y=0)
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

        // Body (rounded rect in lab color)
        const body = new PIXI.Graphics();
        body.beginFill(suitHex);
        body.drawRoundedRect(-bw / 2, 0, bw, bodyH, bw * 0.1);
        body.endFill();
        // Subtle highlights
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
        // Eyes
        head.beginFill(0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, 1.2);
        head.drawCircle( bw * 0.1, headH * 0.38, 1.2);
        head.endFill();
        // Mouth
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;
        cont.addChild(head);

        // Status dot (lab color tag)
        const dot = new PIXI.Graphics();
        dot.beginFill(suitHex);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;
        cont.addChild(dot);

        // Name label
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
        this._liftCar = null;
        this._liftCable = null;
        this._liftFloorTxt = null;
        this._liftTop = null;
        this._liftBot = null;
        this._hallFloorY = null;
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this.isDragging = false;
    }
};
