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

        // ─── STAIRCASE SHAFT (hallH → hallH + stairH) ───
        const shaftLeft = W * 0.38;
        const shaftRight = W * 0.62;
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
        for (let i = 0; i < 120; i++) {
            const rx = rr() * W;
            if (rx > shaftLeft && rx < shaftRight) continue;
            rock.beginFill(rr() > 0.5 ? 0x3d261a : 0x1f100a, 0.7);
            rock.drawRect(rx, shaftTop + rr() * stairH, 2 + rr() * 3, 2);
            rock.endFill();
        }
        this.scene.addChild(rock);

        // Shaft cavity
        const shaft = new PIXI.Graphics();
        shaft.beginFill(0x0a0a14);
        shaft.drawRect(shaftLeft, shaftTop, shaftRight - shaftLeft, stairH);
        shaft.endFill();
        // Side walls
        shaft.beginFill(0x1e293b);
        shaft.drawRect(shaftLeft, shaftTop, 4, stairH);
        shaft.drawRect(shaftRight - 4, shaftTop, 4, stairH);
        shaft.endFill();
        this.scene.addChild(shaft);

        // ESCALATOR (left half of shaft — descending)
        const escX = shaftLeft + 16;
        const escW = (shaftRight - shaftLeft) / 2 - 20;
        const esc = new PIXI.Graphics();
        esc.beginFill(0x334155);
        // Diagonal belt from top-left to bottom-right
        esc.drawPolygon([
            escX, shaftTop + 4,
            escX + escW, shaftTop + 4,
            escX + escW, shaftTop + 18,
            escX + 20, shaftBottom,
            escX, shaftBottom,
            escX, shaftTop + 18
        ]);
        esc.endFill();
        // Step lines
        esc.lineStyle(1, theme.col, 0.6);
        for (let i = 0; i < 10; i++) {
            const t = i / 10;
            const xA = escX + t * (escW - 20);
            const yA = shaftTop + 18 + t * (stairH - 18);
            esc.moveTo(xA, yA);
            esc.lineTo(xA + 20, yA);
        }
        esc.lineStyle(0);
        // Handrail
        esc.beginFill(theme.col, 0.35);
        esc.drawRect(escX, shaftTop + 16, escW, 2);
        esc.endFill();
        this.scene.addChild(esc);

        // STAIRS (right half — ascending)
        const stX = escX + escW + 12;
        const stW = (shaftRight - shaftLeft) / 2 - 20;
        const stairs = new PIXI.Graphics();
        stairs.beginFill(0x1e293b);
        stairs.drawRect(stX, shaftTop + 4, stW, stairH - 4);
        stairs.endFill();
        // Step treads
        const steps = 14;
        for (let i = 0; i < steps; i++) {
            const t = i / steps;
            stairs.beginFill(0x475569);
            stairs.drawRect(stX + t * (stW - 12), shaftTop + 6 + t * (stairH - 10), 14, 3);
            stairs.endFill();
        }
        // Handrail
        stairs.lineStyle(2, theme.col, 0.5);
        stairs.moveTo(stX, shaftTop + 6);
        stairs.lineTo(stX + stW - 4, shaftBottom - 4);
        stairs.lineStyle(0);
        this.scene.addChild(stairs);

        // Direction signs
        const signDown = new PIXI.Text('▼ TO PLATFORM', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8,
            fill: theme.col
        });
        signDown.x = shaftLeft + 10;
        signDown.y = shaftTop - 14;
        this.scene.addChild(signDown);

        // Store stair anchors for avatar placement
        this._escTop = { x: escX + escW / 2, y: shaftTop + 8 };
        this._escBot = { x: escX + 10, y: shaftBottom - 4 };
        this._stBot  = { x: stX + 4, y: shaftBottom - 4 };
        this._stTop  = { x: stX + stW - 4, y: shaftTop + 8 };

        // ─── PLATFORM LEVEL (shaftBottom → shaftBottom + platH) ───
        const platTop = shaftBottom;
        const platCenterY = platTop + platH * 0.55;
        const platFloorY = platTop + platH * 0.7;

        // Platform hall back wall (tile)
        const backWall = new PIXI.Graphics();
        backWall.beginFill(0x0f172a);
        backWall.drawRect(0, platTop, W, platH);
        backWall.endFill();
        // Tile courses
        for (let ty = platTop + 10; ty < platTop + platH - 40; ty += 16) {
            backWall.beginFill(0x1e293b);
            for (let tx = (ty % 32 === 0) ? 0 : 12; tx < W; tx += 24) {
                backWall.drawRect(tx, ty, 22, 14);
            }
            backWall.endFill();
        }
        this.scene.addChild(backWall);

        // Accent line color band
        const accent = new PIXI.Graphics();
        accent.beginFill(theme.col, 0.9);
        accent.drawRect(0, platTop + 6, W, 3);
        accent.endFill();
        accent.beginFill(theme.col, 0.4);
        accent.drawRect(0, platTop + 9, W, 1);
        accent.endFill();
        this.scene.addChild(accent);

        // Platform edge (yellow safety stripe)
        const edge = new PIXI.Graphics();
        edge.beginFill(0x334155);
        edge.drawRect(0, platFloorY, W, 6);
        edge.endFill();
        edge.beginFill(0xfbbf24);
        edge.drawRect(0, platFloorY + 6, W, 3);
        edge.endFill();
        edge.beginFill(0x1a1a2e);
        for (let dx = 0; dx < W; dx += 12) edge.drawRect(dx, platFloorY + 6, 6, 3);
        edge.endFill();
        this.scene.addChild(edge);

        // Platform floor
        const pfloor = new PIXI.Graphics();
        pfloor.beginFill(0x0a0a14);
        pfloor.drawRect(0, platFloorY + 9, W, platTop + platH - (platFloorY + 9));
        pfloor.endFill();
        this.scene.addChild(pfloor);

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
        this._platCenterY = platCenterY;
        this._platFloorY = platFloorY;
        this._platStandY = platFloorY - 14; // avatars stand here

        // ─── TRACK BED + TRAIN CORRIDOR ───
        const trackTop = platFloorY + 12;
        const trackBottom = platTop + platH - 20;
        const trackMidY = (trackTop + trackBottom) / 2;

        const tbed = new PIXI.Graphics();
        tbed.beginFill(0x050510);
        tbed.drawRect(0, trackTop, W, trackBottom - trackTop);
        tbed.endFill();
        // Ballast texture
        for (let i = 0; i < 120; i++) {
            tbed.beginFill(0x1a1a24, 0.7);
            tbed.drawRect(rr() * W, trackTop + rr() * (trackBottom - trackTop), 2, 2);
            tbed.endFill();
        }
        // Rails
        tbed.beginFill(0xd4d4d4);
        tbed.drawRect(0, trackMidY - 4, W, 2);
        tbed.drawRect(0, trackMidY + 6, W, 2);
        tbed.endFill();
        // Sleepers
        tbed.beginFill(0x3a2218);
        for (let sx = 0; sx < W; sx += 20) tbed.drawRect(sx, trackMidY - 6, 14, 14);
        tbed.endFill();
        // Power rail
        tbed.beginFill(0xfbbf24, 0.5);
        tbed.drawRect(0, trackBottom - 6, W, 2);
        tbed.endFill();
        this.scene.addChild(tbed);

        // Tunnel mouth gradient left and right
        const tmouthL = new PIXI.Graphics();
        tmouthL.beginFill(0x000000, 0.9);
        tmouthL.drawRect(0, trackTop, 40, trackBottom - trackTop);
        tmouthL.endFill();
        tmouthL.beginFill(0x050510, 0.6);
        tmouthL.drawRect(40, trackTop, 30, trackBottom - trackTop);
        tmouthL.endFill();
        this.scene.addChild(tmouthL);

        const tmouthR = new PIXI.Graphics();
        tmouthR.beginFill(0x000000, 0.9);
        tmouthR.drawRect(W - 40, trackTop, 40, trackBottom - trackTop);
        tmouthR.endFill();
        tmouthR.beginFill(0x050510, 0.6);
        tmouthR.drawRect(W - 70, trackTop, 30, trackBottom - trackTop);
        tmouthR.endFill();
        this.scene.addChild(tmouthR);

        // Tunnel red safety lights (static strip)
        const lights = new PIXI.Graphics();
        lights.beginFill(0xef4444);
        for (let lx = 20; lx < W; lx += 70) {
            lights.drawCircle(lx, trackTop + 8, 2);
            lights.drawCircle(lx, trackBottom - 8, 2);
        }
        lights.endFill();
        this.scene.addChild(lights);

        // Store track anchors
        this._trackY = trackMidY;
        this._trackTop = trackTop;
        this._trackBottom = trackBottom;

        // ─── DEEP STRATA (below tracks) ───
        const deepTop = platTop + platH;
        // Water pipe
        const deep = new PIXI.Graphics();
        deep.beginFill(0x0a0a0f);
        deep.drawRect(0, deepTop, W, deepH);
        deep.endFill();
        deep.beginFill(0x0369a1);
        deep.drawRect(0, deepTop + 30, W, 8);
        deep.endFill();
        deep.beginFill(0x0284c7);
        deep.drawRect(0, deepTop + 32, W, 4);
        deep.endFill();
        deep.beginFill(0xb45309);
        deep.drawRect(0, deepTop + 60, W, 12);
        deep.endFill();
        deep.beginFill(0xd97706);
        deep.drawRect(0, deepTop + 62, W, 8);
        deep.endFill();
        // Deep void
        deep.beginFill(0x050508);
        deep.drawRect(0, deepTop + 90, W, deepH - 90);
        deep.endFill();
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

        // ─── Animate trains ───
        // We render up to 2 simulated trains: one westbound, one eastbound, keyed by tick.
        const g = this._trainG;
        if (g) {
            g.clear();
            const trackY = this._trackY;
            const trainH = 28;
            const trainW = Math.min(W * 0.75, 560);

            // Phase based on G.tick (~60fps)
            const tick = (typeof G !== 'undefined' && G.tick) || 0;
            const cycle = 600; // ~10s full cycle
            const phaseA = (tick % cycle) / cycle;     // west → east train
            const phaseB = ((tick + 300) % cycle) / cycle; // east → west train (offset)

            // Train A (left→right): enters tunnel L, stops at station, departs R
            this._drawTrain(g, this._computeTrainX(phaseA, trainW, W, true),
                            trackY - trainH / 2, trainW, trainH, theme.col, true, phaseA);
            // Train B (right→left): opposite direction, rendered slightly above on far track
            // Only show occasionally to avoid collision — visible when Train A is not at station
            if (phaseA < 0.3 || phaseA > 0.7) {
                this._drawTrain(g, this._computeTrainX(phaseB, trainW, W, false),
                                trackY - trainH / 2 - 3, trainW, trainH, 0x94a3b8, false, phaseB);
            }

            // Update board text
            if (this._boardTxt) {
                if (phaseA < 0.35) this._boardTxt.text = 'NEXT TRAIN · ARRIVING';
                else if (phaseA < 0.55) this._boardTxt.text = 'NEXT TRAIN · AT PLATFORM';
                else if (phaseA < 0.75) this._boardTxt.text = 'NEXT TRAIN · DEPARTING';
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

            if (refs._metroState === 'entering') {
                // Descending: interpolate from hall → platform along escalator
                // Use _logicalY relative to G.groundY as a t ∈ [0,1]
                const platformYOut = G.groundY + 112;
                const topY = G.groundY - 20;
                let t = 0;
                if (refs._logicalY !== undefined) {
                    t = Math.max(0, Math.min(1, (refs._logicalY - topY) / (platformYOut - topY)));
                }
                ix = this._escTop.x + t * (this._escBot.x - this._escTop.x);
                iy = this._escTop.y + t * (this._escBot.y - this._escTop.y);
            } else if (refs._metroState === 'exiting') {
                // Ascending stairs
                const platformYOut = G.groundY + 112;
                const topY = G.groundY - 20;
                let t = 1;
                if (refs._logicalY !== undefined) {
                    t = Math.max(0, Math.min(1, (refs._logicalY - topY) / (platformYOut - topY)));
                }
                ix = this._stBot.x + (1 - t) * (this._stTop.x - this._stBot.x);
                iy = this._stBot.y + (1 - t) * (this._stTop.y - this._stBot.y);
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

    _computeTrainX(phase, trainW, W, westbound) {
        // Phase: 0..0.35 enter from left/right → slide to station
        //        0.35..0.65 stopped at station
        //        0.65..1.0 depart toward opposite tunnel
        const centerX = (W - trainW) / 2;
        if (westbound) {
            if (phase < 0.35) {
                const t = phase / 0.35;
                return -trainW + t * (centerX + trainW);
            } else if (phase < 0.65) {
                return centerX;
            } else {
                const t = (phase - 0.65) / 0.35;
                return centerX + t * (W - centerX);
            }
        } else {
            if (phase < 0.35) {
                const t = phase / 0.35;
                return W - t * (W - centerX);
            } else if (phase < 0.65) {
                return centerX;
            } else {
                const t = (phase - 0.65) / 0.35;
                return centerX - t * (centerX + trainW);
            }
        }
    },

    _drawTrain(g, x, y, w, h, col, primary, phase) {
        // Body
        g.beginFill(primary ? 0x1e293b : 0x0f172a);
        g.drawRoundedRect(x, y, w, h, 4);
        g.endFill();
        // Accent stripe
        g.beginFill(col, primary ? 0.9 : 0.5);
        g.drawRect(x, y + h - 6, w, 3);
        g.endFill();
        // Windows
        g.beginFill(0x67e8f9, primary ? 0.75 : 0.4);
        for (let wx = x + 12; wx < x + w - 12; wx += 32) {
            g.drawRect(wx, y + 6, 22, 12);
        }
        g.endFill();
        // Headlight at leading edge
        if (primary && phase < 0.4) {
            g.beginFill(0xfef08a, 0.9);
            g.drawCircle(x + w - 4, y + h / 2, 3);
            g.endFill();
        }
        // Door slits when stopped
        if (primary && phase > 0.35 && phase < 0.65) {
            g.beginFill(0x0f172a);
            for (let dx = x + 30; dx < x + w - 30; dx += 80) {
                g.drawRect(dx, y + 4, 2, h - 10);
                g.drawRect(dx + 20, y + 4, 2, h - 10);
            }
            g.endFill();
        }
        // Coupling between cars
        g.beginFill(0x475569);
        g.drawRect(x - 3, y + h / 2 - 1, 3, 2);
        g.drawRect(x + w, y + h / 2 - 1, 3, 2);
        g.endFill();
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
        this.skyContainer = null;
        this.starsLayer = null;
        this.celestialGfx = null;
        this.isDragging = false;
    }
};
