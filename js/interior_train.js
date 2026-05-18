/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.2.0 — exterior-matched cutaway, real-rider cabin)
   Cutaway side view of one car. Palette is locked to the exterior train sprite
   (EntitiesGfx.buildTrainSprite / InteriorMetro._drawExteriorTrain) so inside ↔ outside never drift:
     hull 0x1e293b · cyan stripe 0x0284c7 · cyan accent 0x0ea5e9 · silver 0x94a3b8/0xcbd5e1 · glass 0x0f172a
   Passengers shown inside are the ACTUAL AI models / NPCs riding this train object (G.charRefs
   refs._ridingTrain === this train) — not random extras — so the cabin tracks ridership exactly
   the way building interiors track occupants. An empty train shows an empty (truthful) cabin.
   Tunnel scenery through the windows mirrors the exterior tunnel: dark void + pillars + red lights.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorTrain = {
    scene: null,
    layer: null,
    bld: null,
    _trainKey: null,
    isDragging: false,
    _tunnelG: null,
    _stationG: null,
    _windowMask: null,
    _passengersCont: null,
    _paxAvatars: null,
    _paxSig: null,
    _visiblePax: 0,
    _totalPax: 0,
    _doorL: null,
    _doorR: null,
    _doorOpen: 0,
    _lastTrainX: null,
    _scroll: 0,
    _destTxt: null,
    _speedTxt: null,
    _stationLabelTxt: null,
    _wheelGfx: null,
    _wheelCenters: null,
    _strapsG: null,
    _tiesG: null,
    _tick: 0,

    /* Cached layout — recomputed each build() so update() can size things. */
    _L: null,

    THEMES: {
        trainWest:      { col: 0x38bdf8, line: 'LINE 1 · WESTBOUND' },
        trainEast:      { col: 0xfacc15, line: 'LINE 1 · EASTBOUND' },
        trainMid:       { col: 0xf97316, line: 'LINE 2 · CENTRAL'   },
        trainDC:        { col: 0x06b6d4, line: 'COMPUTE SPUR'       },
        trainLongevity: { col: 0x22c55e, line: 'INNOVATION LINE'    }
    },

    STATION_LABELS: {
        metro_res:       'RESIDENTIAL SECTOR',
        metro_hq:        'TECH DISTRICT',
        metro_mid:       'CENTRAL LINE',
        metro_east:      'EASTERN HUB',
        metro_dc:        'COMPUTE DISTRICT',
        metro_longevity: 'INNOVATION CORRIDOR'
    },

    _stationAt(worldX) {
        if (worldX == null || typeof G === 'undefined' || !G.bldById) return null;
        let best = null, bestD = Infinity;
        for (const id in this.STATION_LABELS) {
            const b = G.bldById[id];
            if (!b) continue;
            const cx = b.x + b.w / 2;
            const d = Math.abs(cx - worldX);
            if (d < bestD) { bestD = d; best = id; }
        }
        return bestD < 80 ? best : null;
    },

    build(bld, layer) {
        this.bld = bld;
        this.layer = layer;
        this._trainKey = bld._trainKey;
        this._tick = 0;
        this._doorOpen = 0;
        this._scroll = 0;
        this._lastTrainX = null;
        this._paxSig = null;
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.THEMES[this._trainKey] || { col: 0x22d3ee, line: 'METRO TRAIN' };

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ── Layout (centered subway-car cross-section) ───────────────────────
        const ceilingH   = 58;
        const winTopGap  = 14;                           // slate sill above window
        const winH        = 122;                         // tall windows (exterior glass reads big)
        const sillH       = 18;                          // cyan-striped sill below window
        const winBandH    = winTopGap + winH + sillH;    // 154
        const wallH       = 226;                         // cabin: bench + standees + grab poles
        const floorH      = 16;
        const skirtH      = 10;                           // hull plating below floor (exterior skirt)
        const bogeyH      = 26;
        const railsH      = 22;
        const wheelR      = 12;
        const underH      = skirtH + bogeyH + railsH;
        const winPitch    = 212;                          // window-center spacing
        const winInsideW  = 152;                          // window opening width

        const totalH = ceilingH + winBandH + wallH + floorH + underH;
        const offsetY = Math.max(0, Math.round((H - totalH) / 2));

        const yCeilTop  = offsetY;
        const yCeilBot  = yCeilTop + ceilingH;
        const yWinTop   = yCeilBot;
        const yWinBot   = yWinTop + winBandH;
        const yWallTop  = yWinBot;
        const yFloorTop = yWallTop + wallH;
        const yFloorBot = yFloorTop + floorH;
        const yUnderTop = yFloorBot;
        const yUnderBot = yUnderTop + underH;
        const winY      = yWinTop + winTopGap;
        const benchTop  = yFloorTop - 70;                 // bench cushion top (seated avatars read here)

        this._L = {
            W, H, theme,
            yCeilTop, yCeilBot, yWinTop, yWinBot, yWallTop, yFloorTop, yFloorBot, yUnderTop, yUnderBot,
            benchTop, winY, winH, winPitch, winInsideW, ceilingH, winBandH, wallH, floorH, underH
        };

        // ── 0. TUNNEL VOID BACKDROP — mirrors the exterior metro tunnel
        //      (EntitiesGfx.initMetro: 0x050508 cavity, 0x111115 pillars @150px, red lights).
        //      NO cable tray / earth strata — keep it the same dark tunnel the train runs in
        //      so the cabin reads as a car inside that tunnel, not a sealed sci-fi box. ──
        const backdrop = new PIXI.Graphics();
        backdrop.beginFill(0x050508);
        backdrop.drawRect(0, 0, W, H);
        backdrop.endFill();
        // Far tunnel-wall sheen (barely lifts the void so depth reads)
        backdrop.beginFill(0x09090e, 0.6);
        backdrop.drawRect(0, 0, W, H);
        backdrop.endFill();
        // Static structural pillars in the dead space above & below the car
        const pillarPitch = 150, pillarW = 20;
        backdrop.beginFill(0x111115);
        for (let px = 30; px < W + pillarW; px += pillarPitch) {
            if (yCeilTop > 2)  backdrop.drawRect(px, 0, pillarW, yCeilTop);
            if (yUnderBot < H) backdrop.drawRect(px, yUnderBot, pillarW, H - yUnderBot);
        }
        backdrop.endFill();
        // Red status lights on the upper pillars (exterior tunnel signature, 0xef4444)
        if (yCeilTop > 26) {
            for (let px = 30; px < W + pillarW; px += pillarPitch) {
                backdrop.beginFill(0xef4444, 0.28);
                backdrop.drawCircle(px + pillarW / 2, yCeilTop - 18, 6);
                backdrop.endFill();
                backdrop.beginFill(0xef4444, 0.9);
                backdrop.drawCircle(px + pillarW / 2, yCeilTop - 18, 2);
                backdrop.endFill();
            }
        }
        this.scene.addChild(backdrop);

        // ── 1. TUNNEL STRIP (full-width; visible only through window cutouts via mask) ──
        const tunnelHost = new PIXI.Container();
        tunnelHost.x = 0;
        tunnelHost.y = winY;
        this.scene.addChild(tunnelHost);
        this._tunnelG = new PIXI.Graphics();
        tunnelHost.addChild(this._tunnelG);
        this._stationG = new PIXI.Graphics();
        this._stationG.alpha = 0;
        tunnelHost.addChild(this._stationG);

        this._windowMask = new PIXI.Graphics();
        this._windowMask.beginFill(0xffffff);
        const winCount = Math.max(2, Math.floor((W + winPitch - winInsideW) / winPitch));
        const totalWinSpan = winCount * winInsideW + (winCount - 1) * (winPitch - winInsideW);
        const winStartX = Math.round((W - totalWinSpan) / 2);
        const winRects = [];
        for (let i = 0; i < winCount; i++) {
            const wx = winStartX + i * winPitch;
            this._windowMask.drawRect(wx, 0, winInsideW, winH);
            winRects.push({ x: wx, y: winY, w: winInsideW, h: winH });
        }
        this._windowMask.endFill();
        this._windowMask.y = winY;
        this.scene.addChild(this._windowMask);
        tunnelHost.mask = this._windowMask;
        this._L.winRects = winRects;
        this._L.winStartX = winStartX;
        this._L.winCount = winCount;
        const lastWinEnd = winStartX + (winCount - 1) * winPitch + winInsideW;

        // ── 2. WINDOW BAND — slate hull plating drawn only OUTSIDE the cutouts ──
        const wall = new PIXI.Graphics();
        // Slate sliver above the windows (between ceiling and glass)
        wall.beginFill(0x1e293b);
        wall.drawRect(0, yWinTop, W, winTopGap);
        wall.endFill();
        // Sill below the windows
        const winOpenBot = winY + winH;
        wall.beginFill(0x1e293b);
        wall.drawRect(0, winOpenBot, W, yWinBot - winOpenBot);
        wall.endFill();
        // Side caps (full band height) + piers between windows
        wall.beginFill(0x1e293b);
        if (winStartX > 0) wall.drawRect(0, yWinTop, winStartX, winBandH);
        if (lastWinEnd < W) wall.drawRect(lastWinEnd, yWinTop, W - lastWinEnd, winBandH);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            wall.drawRect(mx, winY, winPitch - winInsideW, winH);
        }
        wall.endFill();
        // Exterior accent line just under the ceiling (0x0ea5e9 — mirrors exterior accent)
        wall.beginFill(0x0ea5e9);
        wall.drawRect(0, yWinTop + 3, W, 2);
        wall.endFill();
        // Cyan body stripe across the lower sill (mirrors exterior 0x0284c7 body stripe)
        wall.beginFill(0x0284c7);
        wall.drawRect(0, yWinBot - 10, W, 7);
        wall.endFill();
        // Silver trim line capping the sill (exterior 0x94a3b8)
        wall.beginFill(0x94a3b8);
        wall.drawRect(0, yWinBot - 3, W, 3);
        wall.endFill();
        // Pier highlight (silver center rib on each pier — echoes exterior railings)
        wall.beginFill(0x94a3b8, 0.85);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            const mw = winPitch - winInsideW;
            wall.drawRect(mx + mw / 2 - 1, winY + 2, 2, winH - 4);
        }
        wall.endFill();
        this.scene.addChild(wall);

        // Window frames (silver bezel + dark outer frame), drawn ABOVE the masked tunnel
        const winFrames = new PIXI.Graphics();
        winRects.forEach(r => {
            winFrames.lineStyle(3, 0x0f172a, 1);
            winFrames.drawRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 6);
            winFrames.lineStyle(2, 0x94a3b8, 0.95);
            winFrames.drawRoundedRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 4);
            winFrames.lineStyle(0);
            // Glass tint sheen (exterior 0xe0f2fe @0.15)
            winFrames.beginFill(0xe0f2fe, 0.13);
            winFrames.drawRect(r.x + 3, r.y + 3, r.w - 6, r.h * 0.30);
            winFrames.endFill();
            // Corner rivets
            winFrames.beginFill(0xcbd5e1);
            [[r.x + 5, r.y + 5], [r.x + r.w - 6, r.y + 5], [r.x + 5, r.y + r.h - 6], [r.x + r.w - 6, r.y + r.h - 6]]
                .forEach(([cx, cy]) => winFrames.drawCircle(cx, cy, 1.4));
            winFrames.endFill();
        });
        this.scene.addChild(winFrames);

        // ── 3. CEILING / ROOF ─────────────────────────────────────────────────
        const ceiling = new PIXI.Graphics();
        ceiling.beginFill(0x1e293b);
        ceiling.drawRect(0, yCeilTop, W, ceilingH);
        ceiling.endFill();
        // Exterior roof lip (silver, like the exterior front cap 0xcbd5e1 → 0x94a3b8)
        ceiling.beginFill(0xcbd5e1);
        ceiling.drawRect(0, yCeilTop, W, 6);
        ceiling.endFill();
        ceiling.beginFill(0x94a3b8);
        ceiling.drawRect(0, yCeilTop + 6, W, 4);
        ceiling.endFill();
        // Inner roof panel
        ceiling.beginFill(0x334155);
        ceiling.drawRoundedRect(10, yCeilTop + 13, W - 20, ceilingH - 22, 12);
        ceiling.endFill();
        // LED strip — continuous glow with bright tiles
        ceiling.beginFill(0xfde68a, 0.22);
        ceiling.drawRect(22, yCeilTop + ceilingH - 17, W - 44, 7);
        ceiling.endFill();
        ceiling.beginFill(0xfef9c3);
        for (let lx = 28; lx < W - 28; lx += 74) {
            ceiling.drawRoundedRect(lx, yCeilTop + ceilingH - 16, 50, 4, 2);
        }
        ceiling.endFill();
        // Destination LED display (theme-tinted, like exterior station signage)
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.85);
        destBg.drawRoundedRect(W / 2 - 150, yCeilTop + 9, 300, 22, 4);
        destBg.lineStyle(0);
        destBg.endFill();
        ceiling.addChild(destBg);
        this._destTxt = new PIXI.Text('— — —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 11, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 4, dropShadowDistance: 0
        });
        this._destTxt.anchor.set(0.5, 0.5);
        this._destTxt.x = W / 2;
        this._destTxt.y = yCeilTop + 20;
        ceiling.addChild(this._destTxt);
        this.scene.addChild(ceiling);

        // Line subtitle pill under the ceiling
        const lineTxt = new PIXI.Text(theme.line, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: theme.col, letterSpacing: 2
        });
        lineTxt.anchor.set(0.5, 0);
        lineTxt.x = W / 2;
        lineTxt.y = yCeilTop + ceilingH - 7;
        this.scene.addChild(lineTxt);

        // ── 4. CABIN WALL + ROUTE MAP + ADS + BENCH ───────────────────────────
        const cabin = new PIXI.Graphics();
        // Slate hull interior (exterior body colour, NOT a black void)
        cabin.beginFill(0x1e293b);
        cabin.drawRect(0, yWallTop, W, wallH);
        cabin.endFill();
        // Lighter inner liner panel
        cabin.beginFill(0x273548);
        cabin.drawRect(8, yWallTop + 8, W - 16, wallH - 8);
        cabin.endFill();
        // Vertical panel seams
        cabin.beginFill(0x1e293b, 0.6);
        for (let px = 0; px < W; px += winPitch) cabin.drawRect(px + 40, yWallTop + 8, 2, wallH - 8);
        cabin.endFill();
        // Header band directly under the sill
        cabin.beginFill(0x0f172a);
        cabin.drawRect(0, yWallTop, W, 10);
        cabin.endFill();
        cabin.beginFill(0x0284c7);
        cabin.drawRect(0, yWallTop + 10, W, 2);
        cabin.endFill();

        // Route-map strip (theme-coloured line with station nodes — fills the upper wall)
        const mapY = yWallTop + 30;
        cabin.beginFill(theme.col, 0.85);
        cabin.drawRect(40, mapY, W - 80, 3);
        cabin.endFill();
        const stIds = Object.keys(this.STATION_LABELS);
        const nodeN = Math.min(stIds.length, 6);
        for (let i = 0; i < nodeN; i++) {
            const nx = 40 + (i / (nodeN - 1)) * (W - 80);
            cabin.beginFill(0x0f172a);
            cabin.drawCircle(nx, mapY + 1.5, 6);
            cabin.endFill();
            cabin.beginFill(theme.col);
            cabin.drawCircle(nx, mapY + 1.5, 3.5);
            cabin.endFill();
        }

        // Ad / info panels between the grab poles
        const adY = mapY + 18;
        for (let ax = 70; ax < W - 180; ax += winPitch) {
            cabin.beginFill(0x0f172a);
            cabin.drawRoundedRect(ax, adY, 150, 30, 3);
            cabin.endFill();
            cabin.lineStyle(1, theme.col, 0.4);
            cabin.drawRoundedRect(ax, adY, 150, 30, 3);
            cabin.lineStyle(0);
            cabin.beginFill(theme.col, 0.22);
            cabin.drawRect(ax + 8, adY + 7, 40, 4);
            cabin.drawRect(ax + 8, adY + 16, 90, 3);
            cabin.drawRect(ax + 8, adY + 22, 70, 3);
            cabin.endFill();
        }

        // Long bench cushion (continuous run, exterior-slate base + theme accent)
        cabin.beginFill(0x0f172a);
        cabin.drawRoundedRect(12, benchTop, W - 24, yFloorTop - benchTop, 6);
        cabin.endFill();
        cabin.beginFill(0x273548);
        cabin.drawRoundedRect(14, benchTop + 2, W - 28, 34, 6);
        cabin.endFill();
        cabin.beginFill(theme.col, 0.5);
        cabin.drawRect(14, benchTop + 5, W - 28, 4);
        cabin.endFill();
        // Seat dividers
        cabin.beginFill(0x1e293b);
        for (let bx = 60; bx < W - 30; bx += 92) cabin.drawRect(bx, benchTop + 2, 3, 34);
        cabin.endFill();
        this.scene.addChild(cabin);

        // Grab poles (floor-to-ceiling silver bars at piers) — drawn BEHIND passengers
        const polesBack = new PIXI.Graphics();
        const poleXs = [];
        for (let i = 0; i < winCount; i++) {
            const cxp = winStartX + i * winPitch + winInsideW / 2;
            poleXs.push(cxp);
        }
        polesBack.beginFill(0x64748b);
        poleXs.forEach(px => polesBack.drawRect(px - 2, yWallTop + 12, 4, yFloorTop - yWallTop - 12));
        polesBack.endFill();
        polesBack.beginFill(0x94a3b8, 0.7);
        poleXs.forEach(px => polesBack.drawRect(px - 2, yWallTop + 12, 1.5, yFloorTop - yWallTop - 12));
        polesBack.endFill();
        this.scene.addChild(polesBack);

        // Hanging hand-straps along the ceiling rail (animated sway in update)
        this._strapsG = new PIXI.Graphics();
        this._L.strapTopY = yWallTop + 14;
        this._L.strapXs = [];
        for (let sx = 90; sx < W - 60; sx += 84) this._L.strapXs.push(sx);
        this.scene.addChild(this._strapsG);

        // Passenger container — real-rider HumanAvatar instances
        this._passengersCont = new PIXI.Container();
        this.scene.addChild(this._passengersCont);
        this._paxAvatars = [];
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;

        // Bench FRONT lip — drawn OVER seated avatars' legs so they read as seated
        const benchFront = new PIXI.Graphics();
        benchFront.beginFill(0x1e293b);
        benchFront.drawRect(12, benchTop + 30, W - 24, yFloorTop - (benchTop + 30));
        benchFront.endFill();
        benchFront.beginFill(0x0f172a);
        benchFront.drawRect(12, benchTop + 30, W - 24, 3);
        benchFront.endFill();
        benchFront.beginFill(0x334155);
        for (let bx = 28; bx < W - 16; bx += 92) benchFront.drawRect(bx, yFloorTop - 18, 4, 18);
        benchFront.endFill();
        this.scene.addChild(benchFront);

        // ── 5. FLOOR ──────────────────────────────────────────────────────────
        const floor = new PIXI.Graphics();
        floor.beginFill(0x334155);
        floor.drawRect(0, yFloorTop, W, floorH);
        floor.endFill();
        floor.beginFill(0x475569);
        for (let fx = 6; fx < W - 6; fx += 14) {
            floor.drawCircle(fx, yFloorTop + 5, 1.1);
            floor.drawCircle(fx + 7, yFloorTop + 11, 1.1);
        }
        floor.endFill();
        floor.beginFill(0xfacc15, 0.85);
        floor.drawRect(0, yFloorTop + floorH - 3, W, 2);
        floor.endFill();
        this.scene.addChild(floor);

        // ── 6. UNDERCARRIAGE / RAILS (flush on the rails, no floating gap) ─────
        const skirtY = yUnderTop;
        const bogeyY = skirtY + skirtH;
        const railY  = yUnderBot - railsH;
        const underside = new PIXI.Graphics();
        underside.beginFill(0x050508);
        underside.drawRect(0, yUnderTop, W, underH);
        underside.endFill();
        // Hull skirt (exterior body slate + cyan trim)
        underside.beginFill(0x1e293b);
        underside.drawRect(0, skirtY, W, skirtH);
        underside.endFill();
        underside.beginFill(0x0ea5e9);
        underside.drawRect(0, skirtY + skirtH - 2, W, 2);
        underside.endFill();
        // Bogey trucks
        const bogeyX = [Math.round(W * 0.25), Math.round(W * 0.75)];
        underside.beginFill(0x0f172a);
        bogeyX.forEach(bx => underside.drawRoundedRect(bx - 78, bogeyY, 156, bogeyH, 6));
        underside.endFill();
        underside.beginFill(0x334155);
        bogeyX.forEach(bx => underside.drawRect(bx - 78, bogeyY + 2, 156, 2));
        underside.endFill();
        // Wheel hubs
        const wheelY = bogeyY + bogeyH - 2;
        underside.beginFill(0x0a0a12);
        bogeyX.forEach(bx => { underside.drawCircle(bx - 42, wheelY, wheelR); underside.drawCircle(bx + 42, wheelY, wheelR); });
        underside.endFill();
        underside.beginFill(0x475569);
        bogeyX.forEach(bx => { underside.drawCircle(bx - 42, wheelY, wheelR - 5); underside.drawCircle(bx + 42, wheelY, wheelR - 5); });
        underside.endFill();
        // Rails + ballast
        underside.beginFill(0x1a1a24);
        underside.drawRect(0, railY, W, railsH);
        underside.endFill();
        underside.beginFill(0x4a4a5a);
        underside.drawRect(0, railY + 4, W, 3);
        underside.drawRect(0, railY + railsH - 6, W, 3);
        underside.endFill();
        this.scene.addChild(underside);

        // Scrolling ties
        this._tiesG = new PIXI.Graphics();
        this._tiesG.y = railY + 8;
        this.scene.addChild(this._tiesG);

        // Wheel spokes
        this._wheelGfx = new PIXI.Graphics();
        this._wheelCenters = [];
        bogeyX.forEach(bx => {
            this._wheelCenters.push({ x: bx - 42, y: wheelY });
            this._wheelCenters.push({ x: bx + 42, y: wheelY });
        });
        this.scene.addChild(this._wheelGfx);

        // ── 7. SLIDING DOOR PAIR ──────────────────────────────────────────────
        const doorCx = W / 2;
        const doorTop = yWallTop + 14;
        const doorBot = yFloorTop;
        const doorH = doorBot - doorTop;
        const doorPanelW = 58;
        const doorTotalW = doorPanelW * 2;
        const doorFrame = new PIXI.Graphics();
        doorFrame.beginFill(0x0f172a);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.endFill();
        doorFrame.lineStyle(2, theme.col, 0.7);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.lineStyle(0);
        doorFrame.beginFill(0x1e293b);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 15, doorTotalW + 10, 10);
        doorFrame.endFill();
        doorFrame.beginFill(theme.col, 0.9);
        doorFrame.drawCircle(doorCx, doorTop - 10, 2.5);
        doorFrame.endFill();
        this.scene.addChild(doorFrame);
        const makePanel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x1e293b);
            g.drawRect(0, 0, doorPanelW, doorH);
            g.endFill();
            g.beginFill(0x0284c7);
            g.drawRect(0, doorH * 0.55, doorPanelW, 5);
            g.endFill();
            // Door window
            g.beginFill(0x0f172a);
            g.drawRect(7, 14, doorPanelW - 14, doorH * 0.42);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.12);
            g.drawRect(7, 14, doorPanelW - 14, 6);
            g.endFill();
            g.lineStyle(2, 0x94a3b8, 0.85);
            g.drawRect(7, 14, doorPanelW - 14, doorH * 0.42);
            g.lineStyle(0);
            g.beginFill(0x94a3b8);
            g.drawRect(doorPanelW - 11, doorH * 0.64, 4, 26);
            g.endFill();
            return g;
        };
        this._doorL = makePanel();
        this._doorL.x = doorCx - doorPanelW;
        this._doorL.y = doorTop;
        this.scene.addChild(this._doorL);
        this._doorR = makePanel();
        this._doorR.scale.x = -1;
        this._doorR.x = doorCx + doorPanelW;
        this._doorR.y = doorTop;
        this.scene.addChild(this._doorR);
        this._L.doorCx = doorCx;
        this._L.doorPanelW = doorPanelW;
        this._L.doorTop = doorTop;
        this._L.doorBot = doorBot;

        // ── 8. HUD (speed / load pill) ────────────────────────────────────────
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0xfef9c3
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = W - 14;
        this._speedTxt.y = yWinTop + 6;
        this.scene.addChild(this._speedTxt);

        this._stationLabelTxt = new PIXI.Text('— STATION —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 11, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
        });
        this._stationLabelTxt.anchor.set(0.5, 0.5);
        this._stationLabelTxt.visible = false;
        tunnelHost.addChild(this._stationLabelTxt);

        this.scene.y = 0;
        this.update();
    },

    /* ─── Tunnel scenery seen through the windows. Mirrors the exterior tunnel
       (EntitiesGfx.initMetro): 0x050508 void + 0x111115 structural pillars @150px
       + red status lights. No brick texture. ─── */
    _drawTunnelStrip(g, scroll, W, winBandH) {
        g.clear();
        g.beginFill(0x050508);
        g.drawRect(0, 0, W, winBandH);
        g.endFill();
        g.beginFill(0x09090e, 0.7);
        g.drawRect(0, 6, W, winBandH - 12);
        g.endFill();
        const pillarPitch = 150, pillarW = 20;
        const pillarPhase = ((scroll * 1.05) % pillarPitch + pillarPitch) % pillarPitch;
        g.beginFill(0x111115);
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.drawRect(px, 0, pillarW, winBandH);
        }
        g.endFill();
        g.beginFill(0x1a1a22, 0.7);
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.drawRect(px + pillarW - 2, 0, 1, winBandH);
        }
        g.endFill();
        const lightY = 18;
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.beginFill(0xef4444, 0.3);
            g.drawCircle(px + pillarW / 2, lightY, 7);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(px + pillarW / 2, lightY, 2);
            g.endFill();
        }
        const flrY = winBandH - 16;
        g.beginFill(0x1a1a24);
        g.drawRect(0, flrY, W, 16);
        g.endFill();
        g.beginFill(0xfacc15, 0.5);
        g.drawRect(0, flrY - 1, W, 1);
        g.endFill();
    },

    /* ─── Station view shown through windows when waiting. ─── */
    _drawStationView(g, theme, W, winBandH) {
        g.clear();
        g.beginFill(0x0a0a14);
        g.drawRect(0, 0, W, winBandH);
        g.endFill();
        g.lineStyle(1, 0x1e1e2f, 0.6);
        for (let tx = 0; tx < W; tx += 24) { g.moveTo(tx, 6); g.lineTo(tx, winBandH - 28); }
        for (let ty = 12; ty < winBandH - 22; ty += 18) { g.moveTo(0, ty); g.lineTo(W, ty); }
        g.lineStyle(0);
        g.beginFill(0x11111a);
        for (let px = 60; px < W; px += 220) g.drawRect(px, 6, 14, winBandH - 34);
        g.endFill();
        g.beginFill(0x05050a);
        g.lineStyle(1, theme.col, 0.85);
        g.drawRect(W / 2 - 120, 22, 240, 26);
        g.lineStyle(0);
        g.endFill();
        const platY = winBandH - 28;
        g.beginFill(0x2a2a3e);
        g.drawRect(0, platY, W, 22);
        g.endFill();
        g.beginFill(0xfacc15);
        g.drawRect(0, platY - 2, W, 2);
        g.endFill();
        g.beginFill(0xd97706);
        for (let dx = 0; dx < W; dx += 12) g.drawRect(dx, platY, 8, 3);
        g.endFill();
        const seed = (this._lastTrainX | 0) + 7919;
        let s = seed || 1;
        const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
        const peopleCount = 7 + Math.floor(rng() * 9);
        for (let i = 0; i < peopleCount; i++) {
            const pxp = 24 + rng() * (W - 48);
            const sway = Math.sin((this._tick || 0) * 0.04 + i) * 0.6;
            g.beginFill(0x0f172a);
            g.drawRect(pxp - 4, platY - 24 + sway, 8, 20);
            g.endFill();
            g.beginFill(0x1e293b);
            g.drawCircle(pxp, platY - 26 + sway, 3.6);
            g.endFill();
            if (rng() > 0.65) {
                g.beginFill(0x38bdf8, 0.85);
                g.drawRect(pxp - 1, platY - 15 + sway, 2, 2);
                g.endFill();
            }
        }
    },

    /* ─── The ACTUAL riders attached to this train. G.charRefs is the source of
       truth — a model/NPC sets refs._ridingTrain to this train object while it is
       aboard (entities.js metro state machine). So the cabin shows exactly the
       AI models that are mid-commute, the same way a building interior shows its
       real occupants. Returns them in a stable order so the seating is steady. ─── */
    _gatherRiders(train) {
        const riders = [];
        if (!train || typeof G === 'undefined' || !G.charRefs || !G.models) return riders;
        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            const refs = G.charRefs[m.id];
            if (!refs || refs._ridingTrain !== train) continue;
            const labCol = (typeof LABS !== 'undefined' && LABS[m.lab] && LABS[m.lab].color)
                ? parseInt(String(LABS[m.lab].color).replace('#', ''), 16)
                : 0x4ade80;
            riders.push({ id: m.id, name: m.name, lab: m.lab, labCol });
        }
        return riders;
    },

    /* ─── Build/refresh the cabin from the REAL rider list (no padding with fakes).
       Rebuild only when the rider set changes (id signature) so it's cheap. ─── */
    _refreshPassengers(train) {
        const L = this._L;
        if (!this._passengersCont) return;

        const riders = this._gatherRiders(train);
        this._totalPax = riders.length;
        const VIS_CAP = 18;                         // one car only renders so many cleanly
        const shown = riders.slice(0, VIS_CAP);
        this._visiblePax = shown.length;

        const sig = shown.map(r => r.id).join('|') + '#' + riders.length;
        if (sig === this._paxSig) return;           // rider set unchanged → just animate
        this._paxSig = sig;

        if (this._paxAvatars) {
            this._paxAvatars.forEach(a => { if (a.cont && !a.cont.destroyed) a.cont.destroy({ children: true }); });
        }
        this._paxAvatars = [];
        this._passengersCont.removeChildren();

        if (shown.length === 0 || typeof HumanAvatar === 'undefined') return;

        const doorCx = L.doorCx, doorHalf = L.doorPanelW + 18;
        const inDoor = (px) => px > doorCx - doorHalf && px < doorCx + doorHalf;

        // Two standing rows for a packed-commuter-car feel with depth:
        //  • back row  — near the bench, slightly smaller & dimmer, higher up
        //  • front row — in the aisle, larger, at the floor
        // Riders alternate front/back so the crowd interleaves naturally.
        const back = [], front = [];
        shown.forEach((r, i) => (i % 2 === 0 ? front : back).push(r));

        const marginX = 44;
        const usable = L.W - marginX * 2;
        const slotsFor = (arr, py, scale, dim) => {
            const n = arr.length;
            return arr.map((rider, i) => {
                // Evenly space across the car; nudge riders out of the doorway.
                let px = marginX + (n === 1 ? usable / 2 : (i / (n - 1)) * usable);
                if (inDoor(px)) px += (px < doorCx ? -1 : 1) * doorHalf;
                px = Math.max(marginX, Math.min(L.W - marginX, px));
                return { rider, px, py, scale, dim };
            });
        };
        const backRow  = slotsFor(back,  L.yFloorTop - 30, 1.55, true);
        const frontRow = slotsFor(front, L.yFloorTop - 2,  1.9,  false);
        const allSlots = backRow.concat(frontRow);

        allSlots.forEach((slot, idx) => {
            const rider = slot.rider;
            if (!rider) return;
            const av = HumanAvatar.draw(this._passengersCont, {
                x: slot.px,
                y: slot.py,
                seed: rider.id,
                accent: rider.labCol,
                showTag: false,
                showDot: true               // every avatar here is a real tracked rider
            });
            av.cont.scale.set(slot.scale);
            if (slot.dim) av.cont.alpha = 0.82;     // back row recedes
            this._paxAvatars.push({
                cont: av.cont, head: av.head, body: av.body, legL: av.legL, legR: av.legR,
                slot, baseX: slot.px, baseY: slot.py, idx
            });
        });
    },

    /* Subtle per-frame standing sway/bob (no rebuild). */
    _animatePassengers() {
        if (!this._paxAvatars) return;
        const t = this._tick || 0;
        this._paxAvatars.forEach(a => {
            if (!a.cont || a.cont.destroyed) return;
            a.cont.x = a.baseX + Math.sin(t * 0.07 + a.idx * 0.8) * 1.3;
            a.cont.y = a.baseY + Math.sin(t * 0.11 + a.idx) * 0.5;
        });
    },

    update() {
        if (!this.scene || !this.bld || !this._L) return;
        const L = this._L;
        const t = (typeof Entities !== 'undefined') ? Entities[this._trainKey] : null;
        this._tick = (this._tick || 0) + 1;

        if (!t) {
            if (this._destTxt) this._destTxt.text = '— OUT OF SERVICE —';
            return;
        }

        if (this._lastTrainX == null) this._lastTrainX = t.x;
        const dx = t.x - this._lastTrainX;
        this._lastTrainX = t.x;
        this._scroll -= dx;

        const isWaiting = t.state === 'waiting';
        const atStation = this._stationAt(t.x);
        const nextStationId = this._stationAt(t.targetX);
        const stationLabel = atStation ? this.STATION_LABELS[atStation] : null;
        const nextLabel = nextStationId ? this.STATION_LABELS[nextStationId] : null;

        this._drawTunnelStrip(this._tunnelG, this._scroll, L.W, L.winBandH);

        if (isWaiting && stationLabel) {
            this._drawStationView(this._stationG, L.theme, L.W, L.winBandH);
            this._stationG.alpha = Math.min(1, (this._stationG.alpha || 0) + 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.text = stationLabel;
                this._stationLabelTxt.x = L.W / 2;
                this._stationLabelTxt.y = 34;
                this._stationLabelTxt.visible = true;
            }
        } else {
            this._stationG.alpha = Math.max(0, (this._stationG.alpha || 0) - 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.visible = this._stationG.alpha > 0.05;
            }
        }

        // Doors
        const doorTarget = isWaiting ? 1 : 0;
        this._doorOpen += (doorTarget - this._doorOpen) * 0.12;
        const openPx = this._doorOpen * (L.doorPanelW - 4);
        if (this._doorL) this._doorL.x = (L.doorCx - L.doorPanelW) - openPx;
        if (this._doorR) this._doorR.x = (L.doorCx + L.doorPanelW) + openPx;

        // Destination sign
        if (this._destTxt) {
            if (isWaiting && stationLabel) this._destTxt.text = stationLabel;
            else if (nextLabel) this._destTxt.text = 'NEXT: ' + nextLabel;
            else this._destTxt.text = '— in transit —';
        }

        // Passengers — driven by the real rider list (truthful, tracked)
        this._refreshPassengers(t);
        this._animatePassengers();

        if (this._speedTxt) {
            const speed = isWaiting ? 0 : Math.abs(dx);
            const total = this._totalPax | 0;
            const shownN = this._visiblePax | 0;
            const paxStr = total > shownN ? `${shownN}/${total} aboard` : `${total} aboard`;
            this._speedTxt.text = `${isWaiting ? 'STOPPED' : speed.toFixed(1) + ' u/t'}   ${paxStr}`;
        }

        // Hanging hand-straps sway with motion
        if (this._strapsG && L.strapXs) {
            this._strapsG.clear();
            const lean = (isWaiting ? 0 : Math.max(-1, Math.min(1, dx * 0.4)));
            L.strapXs.forEach((sx, i) => {
                const swing = Math.sin(this._tick * 0.06 + i) * 2 + lean * 6;
                this._strapsG.lineStyle(2, 0x64748b, 0.9);
                this._strapsG.moveTo(sx, L.strapTopY);
                this._strapsG.lineTo(sx + swing, L.strapTopY + 26);
                this._strapsG.lineStyle(0);
                this._strapsG.beginFill(0x94a3b8);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 30, 4);
                this._strapsG.endFill();
                this._strapsG.beginFill(0x0f172a);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 30, 2);
                this._strapsG.endFill();
            });
        }

        // Scrolling ties under the wheels
        if (this._tiesG) {
            this._tiesG.clear();
            const tiePitch = 18;
            const tiePhase = ((this._scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
            this._tiesG.beginFill(0xd97706);
            for (let tx = -tiePhase; tx < L.W + tiePitch; tx += tiePitch) {
                this._tiesG.drawRect(tx, 0, 9, 4);
            }
            this._tiesG.endFill();
        }

        // Spinning wheel spokes
        if (this._wheelGfx && this._wheelCenters) {
            this._wheelGfx.clear();
            const ang = (this._scroll * 0.05);
            this._wheelCenters.forEach(c => {
                this._wheelGfx.beginFill(0x475569);
                this._wheelGfx.drawCircle(c.x, c.y, 6);
                this._wheelGfx.endFill();
                this._wheelGfx.lineStyle(1.2, 0xe0f2fe, 0.85);
                for (let k = 0; k < 4; k++) {
                    const a = ang + k * Math.PI / 2;
                    this._wheelGfx.moveTo(c.x + Math.cos(a) * 8, c.y + Math.sin(a) * 8);
                    this._wheelGfx.lineTo(c.x - Math.cos(a) * 8, c.y - Math.sin(a) * 8);
                }
                this._wheelGfx.lineStyle(0);
            });
        }

        // Subtle vertical bob while moving
        const moving = !isWaiting && Math.abs(dx) > 0.05;
        const bob = moving ? Math.sin(this._tick * 0.5) * 0.7 : 0;
        if (this.scene) this.scene.y = bob;
    },

    cleanup() {
        this.scene = null;
        this.layer = null;
        this.bld = null;
        this._trainKey = null;
        this._tunnelG = null;
        this._stationG = null;
        this._windowMask = null;
        this._stationLabelTxt = null;
        if (this._paxAvatars) {
            this._paxAvatars.forEach(a => { if (a.cont && !a.cont.destroyed) a.cont.destroy({ children: true }); });
        }
        this._paxAvatars = null;
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;
        this._passengersCont = null;
        this._doorL = null;
        this._doorR = null;
        this._destTxt = null;
        this._speedTxt = null;
        this._wheelGfx = null;
        this._wheelCenters = null;
        this._strapsG = null;
        this._tiesG = null;
        this._L = null;
        this._lastTrainX = null;
        this._scroll = 0;
        this._doorOpen = 0;
        this._tick = 0;
    }
};
