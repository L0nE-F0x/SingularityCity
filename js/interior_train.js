/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.1.0 — proper subway-car proportions)
   Cutaway side view of one car. Window strip is a short landscape band (not floor-to-ceiling).
   Tunnel/station scenery is masked to only show through the window cutouts.
   Reuses the exterior train palette (EntitiesGfx.buildTrainSprite) so inside ↔ outside never drift.
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
    _passengersG: null,
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
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.THEMES[this._trainKey] || { col: 0x22d3ee, line: 'METRO TRAIN' };

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ── Layout (subway-car cross-section side view) ───────────────────────
        // Use fixed-height bands so proportions stay correct at any aspect ratio.
        const ceilingH   = 56;
        const winBandH   = 110;                          // window strip total (short, landscape)
        const winTopGap  = 12;                           // wall sliver above each window
        const winH       = 76;                           // window opening height
        const winPitch   = 150;                          // distance between window centers
        const winFrameT  = 4;                            // window frame thickness
        const winInsideW = 110;                          // window opening width
        const wallH      = 220;                          // wall section that holds seats/standees
        const floorH     = 16;
        const bandsTotal = ceilingH + winBandH + wallH + floorH;
        const underH     = Math.min(220, Math.max(120, H - bandsTotal - 40));
        const totalH     = bandsTotal + underH;

        // Vertical offset so the car is centered vertically when the viewport is taller than needed
        const offsetY = Math.max(0, (H - totalH) / 2);

        const yCeilTop = offsetY;
        const yCeilBot = yCeilTop + ceilingH;
        const yWinTop  = yCeilBot;
        const yWinBot  = yWinTop + winBandH;
        const yWallTop = yWinBot;
        const yFloorTop = yWallTop + wallH;
        const yFloorBot = yFloorTop + floorH;
        const yUnderTop = yFloorBot;
        const yUnderBot = yUnderTop + underH;
        const benchTop = yFloorTop - 38;                 // bench cushion sits just above floor
        const winY     = yWinTop + winTopGap;            // window opening Y

        this._L = {
            W, H, theme,
            yCeilTop, yCeilBot, yWinTop, yWinBot, yWallTop, yFloorTop, yFloorBot, yUnderTop, yUnderBot,
            benchTop, winY, winH, winPitch, winInsideW, winFrameT, ceilingH, winBandH, wallH, floorH, underH
        };

        // ── 1. TUNNEL BACKDROP (full-width; visible only through window cutouts via mask) ──
        const tunnelHost = new PIXI.Container();
        tunnelHost.x = 0;
        tunnelHost.y = winY;
        this.scene.addChild(tunnelHost);
        this._tunnelG = new PIXI.Graphics();
        tunnelHost.addChild(this._tunnelG);
        this._stationG = new PIXI.Graphics();
        this._stationG.alpha = 0;
        tunnelHost.addChild(this._stationG);
        // Mask: a row of rectangles, one per window opening
        this._windowMask = new PIXI.Graphics();
        this._windowMask.beginFill(0xffffff);
        // Center the window row: compute how many fit and offset so they're balanced.
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

        // ── 2. WALL BAND AROUND WINDOWS (hull plating drawn only OUTSIDE the cutouts,
        //      so the masked tunnelHost behind it is visible through the windows). ──
        const wall = new PIXI.Graphics();
        // Top sliver above windows (between ceiling and window opening top)
        wall.beginFill(0x1e293b);
        wall.drawRect(0, yWinTop, W, winTopGap);
        wall.endFill();
        // Bottom sliver below windows (between window opening bottom and window band bottom)
        const winOpenBot = winY + winH;
        wall.beginFill(0x1e293b);
        wall.drawRect(0, winOpenBot, W, yWinBot - winOpenBot);
        wall.endFill();
        // Cyan accent stripe along top of band (immediately under ceiling)
        wall.beginFill(0x0ea5e9);
        wall.drawRect(0, yWinTop + 2, W, 2);
        wall.endFill();
        // Silver trim band at bottom of window section
        wall.beginFill(0x94a3b8);
        wall.drawRect(0, yWinBot - 6, W, 6);
        wall.endFill();
        // Side caps (left/right edges, full band height)
        wall.beginFill(0x1e293b);
        if (winStartX > 0) wall.drawRect(0, yWinTop, winStartX, winBandH);
        const lastWinEnd = winStartX + (winCount - 1) * winPitch + winInsideW;
        if (lastWinEnd < W) wall.drawRect(lastWinEnd, yWinTop, W - lastWinEnd, winBandH);
        wall.endFill();
        // Mullions (vertical hull bars between windows, only across the window opening Y range)
        wall.beginFill(0x1e293b);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            const mw = winPitch - winInsideW;
            wall.drawRect(mx, winY, mw, winH);
        }
        wall.endFill();
        // Mullion highlight
        wall.beginFill(0x334155, 0.85);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            const mw = winPitch - winInsideW;
            wall.drawRect(mx + mw / 2 - 1, winY + 2, 2, winH - 4);
        }
        wall.endFill();
        this.scene.addChild(wall);

        // Window frames (silver inner bezel + outer dark frame), drawn ABOVE the masked tunnel
        const winFrames = new PIXI.Graphics();
        winRects.forEach(r => {
            // Outer dark frame
            winFrames.lineStyle(2, 0x0f172a, 1);
            winFrames.drawRect(r.x - 1, r.y - 1, r.w + 2, r.h + 2);
            // Inner silver bezel
            winFrames.lineStyle(1, 0x64748b, 0.9);
            winFrames.drawRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2);
            winFrames.lineStyle(0);
            // Subtle glass sheen across top quarter
            winFrames.beginFill(0xe0f2fe, 0.10);
            winFrames.drawRect(r.x + 2, r.y + 2, r.w - 4, r.h * 0.28);
            winFrames.endFill();
            // Tiny corner rivets
            winFrames.beginFill(0x94a3b8);
            [[r.x + 4, r.y + 4], [r.x + r.w - 5, r.y + 4], [r.x + 4, r.y + r.h - 5], [r.x + r.w - 5, r.y + r.h - 5]]
                .forEach(([cx, cy]) => winFrames.drawCircle(cx, cy, 1.2));
            winFrames.endFill();
        });
        this.scene.addChild(winFrames);

        // ── 3. CEILING ────────────────────────────────────────────────────────
        const ceiling = new PIXI.Graphics();
        ceiling.beginFill(0x1e293b);
        ceiling.drawRect(0, yCeilTop, W, ceilingH);
        ceiling.endFill();
        // Inner panel
        ceiling.beginFill(0xcbd5e1);
        ceiling.drawRoundedRect(8, yCeilTop + 4, W - 16, ceilingH - 10, 14);
        ceiling.endFill();
        ceiling.beginFill(0xe0f2fe, 0.55);
        ceiling.drawRect(20, yCeilTop + 8, W - 40, 3);
        ceiling.endFill();
        // LED strip — single continuous strip with periodic bright tiles
        ceiling.beginFill(0xfde68a, 0.25);
        ceiling.drawRect(20, yCeilTop + ceilingH - 16, W - 40, 6);
        ceiling.endFill();
        ceiling.beginFill(0xfef9c3);
        for (let lx = 26; lx < W - 26; lx += 70) {
            ceiling.drawRoundedRect(lx, yCeilTop + ceilingH - 15, 48, 4, 2);
        }
        ceiling.endFill();
        // Grab-handle hooks dangling into the cabin
        ceiling.beginFill(0x64748b);
        for (let hx = 60; hx < W - 30; hx += 120) {
            ceiling.drawRect(hx, yCeilTop + ceilingH - 4, 2, 18);
            ceiling.drawEllipse(hx + 1, yCeilTop + ceilingH + 16, 6, 4);
        }
        ceiling.endFill();
        // Destination LED display
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.8);
        destBg.drawRoundedRect(W / 2 - 140, yCeilTop + 6, 280, 22, 4);
        destBg.lineStyle(0);
        destBg.endFill();
        ceiling.addChild(destBg);
        this._destTxt = new PIXI.Text('— — —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 11, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 4, dropShadowDistance: 0
        });
        this._destTxt.anchor.set(0.5, 0.5);
        this._destTxt.x = W / 2;
        this._destTxt.y = yCeilTop + 17;
        ceiling.addChild(this._destTxt);
        this.scene.addChild(ceiling);

        // Line subtitle (tiny pill under ceiling)
        const lineTxt = new PIXI.Text(theme.line, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: theme.col, letterSpacing: 2
        });
        lineTxt.anchor.set(0.5, 0);
        lineTxt.x = W / 2;
        lineTxt.y = yCeilTop + ceilingH - 6;
        this.scene.addChild(lineTxt);

        // ── 4. WALL BAND + BENCH + STANDEES BACKDROP ──────────────────────────
        const wallBand = new PIXI.Graphics();
        wallBand.beginFill(0x0f172a);
        wallBand.drawRect(0, yWallTop, W, wallH);
        wallBand.endFill();
        // Subtle wall panels (vertical seams every ~150px)
        wallBand.beginFill(0x1e293b, 0.5);
        for (let px = 0; px < W; px += 150) {
            wallBand.drawRect(px, yWallTop, 2, wallH);
        }
        wallBand.endFill();
        // Header band (lighter slate) directly under window sill
        wallBand.beginFill(0x1e293b);
        wallBand.drawRect(0, yWallTop, W, 14);
        wallBand.endFill();
        wallBand.beginFill(0x0284c7);
        wallBand.drawRect(0, yWallTop + 14, W, 2);
        wallBand.endFill();
        // Long bench cushion (continuous run)
        wallBand.beginFill(0x1e293b);
        wallBand.drawRoundedRect(12, benchTop, W - 24, 32, 6);
        wallBand.endFill();
        // Bench colored accent stripe (mirrors theme)
        wallBand.beginFill(theme.col, 0.55);
        wallBand.drawRect(12, benchTop + 4, W - 24, 5);
        wallBand.endFill();
        // Bench brackets to the floor
        wallBand.beginFill(0x334155);
        for (let bx = 28; bx < W - 16; bx += 120) {
            wallBand.drawRect(bx, benchTop + 32, 5, yFloorTop - (benchTop + 32));
        }
        wallBand.endFill();
        // Priority seat icons (small dots in cushion)
        wallBand.beginFill(0x0a0a12, 0.7);
        for (let ix = 32; ix < W - 24; ix += 280) {
            wallBand.drawCircle(ix, benchTop + 6, 2.2);
        }
        wallBand.endFill();
        this.scene.addChild(wallBand);

        // Passenger silhouettes (re-rendered each frame)
        this._passengersG = new PIXI.Graphics();
        this.scene.addChild(this._passengersG);

        // ── 5. FLOOR ──────────────────────────────────────────────────────────
        const floor = new PIXI.Graphics();
        floor.beginFill(0x334155);
        floor.drawRect(0, yFloorTop, W, floorH);
        floor.endFill();
        floor.beginFill(0x475569);
        for (let fx = 6; fx < W - 6; fx += 14) {
            floor.drawCircle(fx, yFloorTop + 4, 1.1);
            floor.drawCircle(fx + 7, yFloorTop + 10, 1.1);
        }
        floor.endFill();
        floor.beginFill(0xfacc15, 0.85);
        floor.drawRect(0, yFloorTop + floorH - 3, W, 2);
        floor.endFill();
        this.scene.addChild(floor);

        // ── 6. UNDERCARRIAGE / RAILS (visible below the cutaway) ──────────────
        const underside = new PIXI.Graphics();
        underside.beginFill(0x111115);
        underside.drawRect(0, yUnderTop, W, underH);
        underside.endFill();
        // Cyan trim hugging the floor
        underside.beginFill(0x0284c7);
        underside.drawRect(0, yUnderTop, W, 4);
        underside.endFill();
        // Twin rails along bottom
        const railY = yUnderBot - 18;
        underside.beginFill(0x4a4a5a);
        underside.drawRect(0, railY, W, 3);
        underside.drawRect(0, railY + 10, W, 3);
        underside.endFill();
        // Wooden ties (drawn once, scroll handled by separate graphic)
        // Bogey trucks (two)
        const bogeyX = [W * 0.25, W * 0.75];
        underside.beginFill(0x1e293b);
        bogeyX.forEach(bx => underside.drawRoundedRect(bx - 70, yUnderTop + 18, 140, 26, 6));
        underside.endFill();
        // Wheel hubs (static dark; spinning detail comes from _wheelGfx)
        underside.beginFill(0x0a0a12);
        bogeyX.forEach(bx => {
            underside.drawCircle(bx - 40, yUnderTop + 50, 13);
            underside.drawCircle(bx + 40, yUnderTop + 50, 13);
        });
        underside.endFill();
        this.scene.addChild(underside);

        // Scrolling ties graphic (over rails)
        this._tiesG = new PIXI.Graphics();
        this._tiesG.y = railY + 5;
        this.scene.addChild(this._tiesG);

        // Wheel spokes (over hubs)
        this._wheelGfx = new PIXI.Graphics();
        this._wheelCenters = [];
        bogeyX.forEach(bx => {
            this._wheelCenters.push({ x: bx - 40, y: yUnderTop + 50 });
            this._wheelCenters.push({ x: bx + 40, y: yUnderTop + 50 });
        });
        this.scene.addChild(this._wheelGfx);

        // ── 7. SLIDING DOOR PAIR (sits in the wall band between two windows) ──
        const doorCx = W / 2;
        const doorTop = yWallTop + 16;           // just below the window sill trim
        const doorBot = yFloorTop;
        const doorH = doorBot - doorTop;
        const doorPanelW = 56;
        const doorTotalW = doorPanelW * 2;
        // Door frame (extends slightly into ceiling band)
        const doorFrame = new PIXI.Graphics();
        doorFrame.beginFill(0x05050a);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 4, doorTop - 4, doorTotalW + 8, doorH + 8);
        doorFrame.endFill();
        doorFrame.lineStyle(2, theme.col, 0.6);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 4, doorTop - 4, doorTotalW + 8, doorH + 8);
        doorFrame.lineStyle(0);
        // Door overhead sign
        doorFrame.beginFill(0x1e293b);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 4, doorTop - 14, doorTotalW + 8, 10);
        doorFrame.endFill();
        doorFrame.beginFill(theme.col, 0.85);
        doorFrame.drawCircle(doorCx, doorTop - 9, 2.5);
        doorFrame.endFill();
        this.scene.addChild(doorFrame);
        const makePanel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x1e293b);
            g.drawRect(0, 0, doorPanelW, doorH);
            g.endFill();
            // Door window (landscape, in upper half)
            g.beginFill(0x0f172a);
            g.drawRect(6, 14, doorPanelW - 12, doorH * 0.42);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.12);
            g.drawRect(6, 14, doorPanelW - 12, 6);
            g.endFill();
            g.lineStyle(1, 0x64748b, 0.8);
            g.drawRect(6, 14, doorPanelW - 12, doorH * 0.42);
            g.lineStyle(0);
            // Handle bar
            g.beginFill(0x94a3b8);
            g.drawRect(doorPanelW - 10, doorH * 0.62, 4, 26);
            g.endFill();
            // Bottom panel detail line
            g.beginFill(0x334155);
            g.drawRect(4, doorH - 16, doorPanelW - 8, 2);
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

        // ── 8. HUD (speed/load pill at corner of window band) ─────────────────
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0xfef9c3
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = W - 12;
        this._speedTxt.y = yWinTop + 4;
        this.scene.addChild(this._speedTxt);

        // Pre-create the station label (lazily shown in update())
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

    /* ─── Tunnel scenery drawn inside winBandH; only visible through window mask. ─── */
    _drawTunnelStrip(g, scroll, W, winBandH) {
        g.clear();
        // Solid void background
        g.beginFill(0x050508);
        g.drawRect(0, 0, W, winBandH);
        g.endFill();
        // Cable run along the top of the tunnel
        g.beginFill(0x12161f);
        g.drawRect(0, 6, W, 8);
        g.endFill();
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6];
        cableCols.forEach((c, i) => {
            g.beginFill(c, 0.7);
            g.drawRect(0, 7 + i * 1.3, W, 1);
            g.endFill();
        });
        // Brick/concrete wall behind the train (brighter so it reads through the windows)
        const wallY = 18;
        const wallH = winBandH - 36;
        g.beginFill(0x2a2f3b);
        g.drawRect(0, wallY, W, wallH);
        g.endFill();
        // Variable brightness bands so the wall feels textured, not flat
        g.beginFill(0x1a1f29, 0.6);
        g.drawRect(0, wallY + wallH * 0.55, W, wallH * 0.45);
        g.endFill();
        // Brick grout lines scrolling
        const brickW = 56, brickH = 16;
        const phaseX = ((scroll * 0.9) % brickW + brickW) % brickW;
        g.lineStyle(1, 0x0a0b10, 0.95);
        for (let by = wallY; by < wallY + wallH; by += brickH) {
            g.moveTo(0, by);
            g.lineTo(W, by);
            const off = ((by - wallY) / brickH) % 2 === 0 ? 0 : brickW / 2;
            for (let bx = -phaseX + off; bx < W + brickW; bx += brickW) {
                g.moveTo(bx, by);
                g.lineTo(bx, by + brickH);
            }
        }
        g.lineStyle(0);
        // Brick highlights — a few brighter individual bricks
        const phaseHL = ((scroll * 0.9) % brickW + brickW) % brickW;
        g.beginFill(0x3a4150, 0.55);
        for (let by = wallY; by < wallY + wallH; by += brickH) {
            const off = ((by - wallY) / brickH) % 2 === 0 ? 0 : brickW / 2;
            for (let bx = -phaseHL + off; bx < W + brickW; bx += brickW * 3) {
                g.drawRect(bx + 2, by + 2, brickW - 4, brickH - 4);
            }
        }
        g.endFill();
        // Red warning lights bobbing past (faster — close to camera)
        const lightPitch = 220;
        const lightPhase = ((scroll * 1.3) % lightPitch + lightPitch) % lightPitch;
        for (let lx = -lightPhase; lx < W + lightPitch; lx += lightPitch) {
            g.beginFill(0xfca5a5, 0.35);
            g.drawCircle(lx, wallY + 18, 7);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(lx, wallY + 18, 2.6);
            g.endFill();
        }
        // Structural pillars passing by
        const pillarPitch = 320;
        const pillarPhase = ((scroll * 1.1) % pillarPitch + pillarPitch) % pillarPitch;
        g.beginFill(0x05050a);
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.drawRect(px, wallY - 4, 18, wallH + 8);
        }
        g.endFill();
        // Tunnel floor (rails) at the bottom of the visible band
        const flrY = winBandH - 18;
        g.beginFill(0x1a1a24);
        g.drawRect(0, flrY, W, 18);
        g.endFill();
        g.beginFill(0x4a4a5a);
        g.drawRect(0, flrY + 4, W, 2);
        g.drawRect(0, flrY + 11, W, 2);
        g.endFill();
        // Wooden ties scrolling
        const tiePitch = 18;
        const tiePhase = ((scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
        g.beginFill(0xd97706);
        for (let tx = -tiePhase; tx < W + tiePitch; tx += tiePitch) {
            g.drawRect(tx, flrY + 7, 9, 4);
        }
        g.endFill();
    },

    /* ─── Station view shown through windows when waiting. ─── */
    _drawStationView(g, theme, W, winBandH) {
        g.clear();
        // Tiled back wall
        g.beginFill(0x0a0a14);
        g.drawRect(0, 0, W, winBandH);
        g.endFill();
        g.lineStyle(1, 0x1e1e2f, 0.6);
        for (let tx = 0; tx < W; tx += 24) {
            g.moveTo(tx, 6);
            g.lineTo(tx, winBandH - 24);
        }
        for (let ty = 12; ty < winBandH - 18; ty += 18) {
            g.moveTo(0, ty);
            g.lineTo(W, ty);
        }
        g.lineStyle(0);
        // Pillars
        g.beginFill(0x11111a);
        for (let px = 60; px < W; px += 220) g.drawRect(px, 6, 14, winBandH - 30);
        g.endFill();
        // Neon sign frame (centered, behind the train)
        g.beginFill(0x05050a);
        g.lineStyle(1, theme.col, 0.85);
        g.drawRect(W / 2 - 120, 18, 240, 24);
        g.lineStyle(0);
        g.endFill();
        // Platform edge
        const platY = winBandH - 24;
        g.beginFill(0x2a2a3e);
        g.drawRect(0, platY, W, 18);
        g.endFill();
        g.beginFill(0xfacc15);
        g.drawRect(0, platY - 2, W, 2);
        g.endFill();
        g.beginFill(0xd97706);
        for (let dx = 0; dx < W; dx += 12) g.drawRect(dx, platY, 8, 3);
        g.endFill();
        // Silhouette commuters waiting on platform
        const seed = (this._lastTrainX | 0) + 7919;
        let s = seed || 1;
        const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
        const peopleCount = 7 + Math.floor(rng() * 9);
        for (let i = 0; i < peopleCount; i++) {
            const pxp = 24 + rng() * (W - 48);
            const sway = Math.sin((this._tick || 0) * 0.04 + i) * 0.6;
            g.beginFill(0x0f172a);
            g.drawRect(pxp - 4, platY - 22 + sway, 8, 18);
            g.endFill();
            g.beginFill(0x1e293b);
            g.drawCircle(pxp, platY - 24 + sway, 3.4);
            g.endFill();
            if (rng() > 0.65) {
                g.beginFill(0x38bdf8, 0.85);
                g.drawRect(pxp - 1, platY - 14 + sway, 2, 2);
                g.endFill();
            }
        }
    },

    /* ─── Passenger silhouettes inside the car. Count = Entities[key].passengers. ─── */
    _drawPassengers(g, count) {
        g.clear();
        if (!count || count <= 0) return;
        const L = this._L;
        const seatedCap = Math.min(count, 14);
        const standCap  = Math.max(0, Math.min(count - seatedCap, 10));
        const skinTones = [0xfcd5b4, 0xe0a899, 0xc69076, 0x8d5524, 0xf5c8a7];
        const shirtCols = [0x0ea5e9, 0xef4444, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316, 0x06b6d4];
        const keySeed = this._trainKey ? this._trainKey.charCodeAt(5) || 0 : 0;
        const keySeed2 = this._trainKey ? this._trainKey.charCodeAt(0) || 0 : 0;
        const doorCx = L.doorCx, doorHalf = L.doorPanelW;
        const inDoor = (px) => px > doorCx - doorHalf - 14 && px < doorCx + doorHalf + 14;

        // Seated — distributed across the bench but skipping over the door gap
        const benchY = L.benchTop;
        const tries = seatedCap * 3;
        let placed = 0;
        const slots = [];
        const usable = L.W - 40;
        for (let i = 0; i < tries && placed < seatedCap; i++) {
            const t = (i + 0.5) / tries;
            const px = 20 + t * usable;
            if (inDoor(px)) continue;
            if (slots.some(s => Math.abs(s - px) < 22)) continue;
            slots.push(px);
            placed++;
        }
        slots.forEach((px, i) => {
            const py = benchY - 22;
            const sk = skinTones[(i + keySeed) % skinTones.length];
            const sh = shirtCols[(i * 3 + keySeed2) % shirtCols.length];
            // body
            g.beginFill(sh);
            g.drawRoundedRect(px - 8, py, 16, 22, 3);
            g.endFill();
            // head
            g.beginFill(sk);
            g.drawCircle(px, py - 5, 6);
            g.endFill();
            // legs
            g.beginFill(0x1e293b);
            g.drawRect(px - 7, py + 20, 5, 14);
            g.drawRect(px + 2, py + 20, 5, 14);
            g.endFill();
            // phone glow for some
            if ((i * 7 + 3) % 3 === 0) {
                g.beginFill(0x38bdf8, 0.9);
                g.drawRect(px - 2, py + 7, 4, 5);
                g.endFill();
            }
        });

        // Standing — between the bench and the door / scattered along the floor
        if (standCap > 0) {
            const standY = L.yFloorTop - 56;
            const standUsable = L.W - 80;
            const standSlots = [];
            const standTries = standCap * 3;
            let sPlaced = 0;
            for (let i = 0; i < standTries && sPlaced < standCap; i++) {
                const t = (i + 0.5) / standTries;
                const px = 40 + t * standUsable;
                if (inDoor(px)) continue;
                if (standSlots.some(s => Math.abs(s - px) < 26)) continue;
                standSlots.push(px);
                sPlaced++;
            }
            standSlots.forEach((px, j) => {
                const sway = Math.sin((this._tick || 0) * 0.07 + j * 0.8) * 1.2;
                const py = standY;
                const sk = skinTones[(j + 2) % skinTones.length];
                const sh = shirtCols[(j * 5 + 1) % shirtCols.length];
                g.beginFill(sh);
                g.drawRoundedRect(px - 7 + sway, py, 14, 32, 3);
                g.endFill();
                g.beginFill(sk);
                g.drawCircle(px + sway, py - 5, 6);
                g.endFill();
                // raised arm to grab handle
                g.beginFill(sh);
                g.drawRect(px + 5 + sway, py - 12, 3, 18);
                g.endFill();
                g.beginFill(sk);
                g.drawCircle(px + 6 + sway, py - 14, 2.6);
                g.endFill();
                // legs
                g.beginFill(0x1e293b);
                g.drawRect(px - 6 + sway, py + 30, 5, 12);
                g.drawRect(px + 1 + sway, py + 30, 5, 12);
                g.endFill();
            });
        }
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

        // Scroll delta from real train motion
        if (this._lastTrainX == null) this._lastTrainX = t.x;
        const dx = t.x - this._lastTrainX;
        this._lastTrainX = t.x;
        this._scroll -= dx;

        const isWaiting = t.state === 'waiting';
        const atStation = this._stationAt(t.x);
        const nextStationId = this._stationAt(t.targetX);
        const stationLabel = atStation ? this.STATION_LABELS[atStation] : null;
        const nextLabel = nextStationId ? this.STATION_LABELS[nextStationId] : null;

        // Tunnel scenery
        this._drawTunnelStrip(this._tunnelG, this._scroll, L.W, L.winBandH);

        // Station view (cross-fade)
        if (isWaiting && stationLabel) {
            this._drawStationView(this._stationG, L.theme, L.W, L.winBandH);
            this._stationG.alpha = Math.min(1, (this._stationG.alpha || 0) + 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.text = stationLabel;
                this._stationLabelTxt.x = L.W / 2;
                this._stationLabelTxt.y = 30;
                this._stationLabelTxt.visible = true;
            }
        } else {
            this._stationG.alpha = Math.max(0, (this._stationG.alpha || 0) - 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.visible = this._stationG.alpha > 0.05;
            }
        }

        // Doors animate
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
        if (this._speedTxt) {
            const speed = isWaiting ? 0 : Math.abs(dx);
            const pax = t.passengers || 0;
            this._speedTxt.text = `${isWaiting ? 'STOPPED' : speed.toFixed(1) + ' u/t'}   ${pax} pax`;
        }

        // Scrolling ties under the wheels (mirrors the tunnel ties)
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

        // Passengers
        if (this._passengersG) this._drawPassengers(this._passengersG, t.passengers || 0);

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
        this._passengersG = null;
        this._doorL = null;
        this._doorR = null;
        this._destTxt = null;
        this._speedTxt = null;
        this._wheelGfx = null;
        this._wheelCenters = null;
        this._tiesG = null;
        this._L = null;
        this._lastTrainX = null;
        this._scroll = 0;
        this._doorOpen = 0;
        this._tick = 0;
    }
};
