/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.3.0 — realistic proportions, exterior-matched)
   Cutaway side view of one car. Palette + undercarriage are locked to the exterior train
   (EntitiesGfx.buildTrainSprite / InteriorMetro._drawExteriorTrain): hull 0x1e293b ·
   cyan stripe 0x0284c7 · accent 0x0ea5e9 · silver 0x94a3b8/0xcbd5e1 · glass 0x0f172a.
   The exterior train has NO wheels/bogeys — just a slate body on the tunnel rail bed —
   so the inside shows the same: a hull skirt sitting straight on 0x1a1a24 ballast + twin
   0x4a4a5a rails, nothing else. Windows sit at standing-passenger HEAD height (you see
   heads in the windows from outside, so it must read that way inside too). The car is kept
   short so there's always tunnel void between the roof and the top of the screen.
   Passengers are the ACTUAL riders attached to this train (refs._ridingTrain === train) —
   never padded with fakes — so the cabin tracks ridership like a building tracks occupants.
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
    _doorViewG: null,
    _doorMask: null,
    _doorOpen: 0,
    _lastTrainX: null,
    _scroll: 0,
    _destTxt: null,
    _speedTxt: null,
    _stationLabelTxt: null,
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

        // ── Layout — a SHORT, realistic car cross-section ─────────────────────
        //   roof gap (offsetY) │ ceiling │ signage strip │ WINDOWS │ low wall │
        //   floor │ skirt │ rail bed │ … tunnel void …
        // Windows bottom-edge ≈ standing shoulder height; standing heads cross
        // into the glass (matches what you see from outside the train).
        const ceilingH   = 44;
        const topBandH   = 22;                          // route/signage strip above the glass
        const winH        = 104;
        const lowerWallH  = 34;                          // window-bottom → floor (wall behind bench)
        const floorH      = 14;
        const skirtH      = 10;                           // hull plating below the floor
        const railBedH    = 22;                           // ballast + twin rails (exterior style)
        const underH      = skirtH + railBedH;
        const winPitch    = 212;
        const winInsideW  = 152;

        const totalH = ceilingH + topBandH + winH + lowerWallH + floorH + underH;
        // Always keep tunnel void above the roof (and centre when there's room).
        const offsetY = Math.max(40, Math.round((H - totalH) / 2));

        const yCeilTop  = offsetY;
        const yCeilBot  = yCeilTop + ceilingH;
        const yTopBand  = yCeilBot;
        const yWinTop   = yTopBand + topBandH;
        const yWinBot   = yWinTop + winH;
        const yWallTop  = yWinBot;                        // low wall below the glass
        const yFloorTop = yWallTop + lowerWallH;
        const yFloorBot = yFloorTop + floorH;
        const ySkirtTop = yFloorBot;
        const yRailTop  = ySkirtTop + skirtH;
        const yUnderBot = yRailTop + railBedH;
        const winY      = yWinTop;

        this._L = {
            W, H, theme,
            yCeilTop, yCeilBot, yTopBand, yWinTop, yWinBot, yWallTop,
            yFloorTop, yFloorBot, ySkirtTop, yRailTop, yUnderBot,
            winY, winH, winPitch, winInsideW, ceilingH, topBandH, lowerWallH, floorH
        };

        // ── 0. TUNNEL VOID BACKDROP — same dark tunnel the train runs in
        //      (EntitiesGfx.initMetro: 0x050508 cavity, 0x111115 pillars @150,
        //      red status lights). Fills the screen ABOVE the roof and BELOW the
        //      rails so the car reads as a slice inside the tunnel. ──
        const backdrop = new PIXI.Graphics();
        backdrop.beginFill(0x050508);
        backdrop.drawRect(0, 0, W, H);
        backdrop.endFill();
        backdrop.beginFill(0x09090e, 0.6);
        backdrop.drawRect(0, 0, W, H);
        backdrop.endFill();
        const pPitch = 150, pW = 20;
        backdrop.beginFill(0x111115);
        for (let px = 30; px < W + pW; px += pPitch) {
            if (yCeilTop > 2)  backdrop.drawRect(px, 0, pW, yCeilTop);
            if (yUnderBot < H) backdrop.drawRect(px, yUnderBot, pW, H - yUnderBot);
        }
        backdrop.endFill();
        if (yCeilTop > 28) {
            for (let px = 30; px < W + pW; px += pPitch) {
                backdrop.beginFill(0xef4444, 0.26);
                backdrop.drawCircle(px + pW / 2, yCeilTop - 20, 6);
                backdrop.endFill();
                backdrop.beginFill(0xef4444, 0.9);
                backdrop.drawCircle(px + pW / 2, yCeilTop - 20, 2);
                backdrop.endFill();
            }
        }
        this.scene.addChild(backdrop);

        // ── 1. TUNNEL STRIP (visible only through window cutouts via mask) ──
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

        // ── 2. HULL PLATING around the windows (slate, only OUTSIDE the cutouts) ──
        const wall = new PIXI.Graphics();
        wall.beginFill(0x1e293b);
        // Side caps + piers between windows (full glass-band height)
        if (winStartX > 0) wall.drawRect(0, yWinTop, winStartX, winH);
        if (lastWinEnd < W) wall.drawRect(lastWinEnd, yWinTop, W - lastWinEnd, winH);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            wall.drawRect(mx, winY, winPitch - winInsideW, winH);
        }
        wall.endFill();
        // Silver rib down the centre of each pier (echoes exterior railings)
        wall.beginFill(0x94a3b8, 0.85);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            const mw = winPitch - winInsideW;
            wall.drawRect(mx + mw / 2 - 1, winY + 2, 2, winH - 4);
        }
        wall.endFill();
        this.scene.addChild(wall);

        // Window frames (dark outer + silver bezel), drawn ABOVE the masked tunnel
        const winFrames = new PIXI.Graphics();
        winRects.forEach(r => {
            winFrames.lineStyle(3, 0x0f172a, 1);
            winFrames.drawRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 6);
            winFrames.lineStyle(2, 0x94a3b8, 0.95);
            winFrames.drawRoundedRect(r.x + 1, r.y + 1, r.w - 2, r.h - 2, 4);
            winFrames.lineStyle(0);
            winFrames.beginFill(0xe0f2fe, 0.12);          // glass sheen (exterior tint)
            winFrames.drawRect(r.x + 3, r.y + 3, r.w - 6, r.h * 0.26);
            winFrames.endFill();
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
        ceiling.beginFill(0xcbd5e1);                      // exterior silver roof cap
        ceiling.drawRect(0, yCeilTop, W, 5);
        ceiling.endFill();
        ceiling.beginFill(0x94a3b8);
        ceiling.drawRect(0, yCeilTop + 5, W, 3);
        ceiling.endFill();
        ceiling.beginFill(0x334155);                      // inner roof panel
        ceiling.drawRoundedRect(10, yCeilTop + 11, W - 20, ceilingH - 18, 10);
        ceiling.endFill();
        ceiling.beginFill(0xfde68a, 0.20);                // LED glow
        ceiling.drawRect(20, yCeilTop + ceilingH - 13, W - 40, 6);
        ceiling.endFill();
        ceiling.beginFill(0xfef9c3);
        for (let lx = 26; lx < W - 26; lx += 72) {
            ceiling.drawRoundedRect(lx, yCeilTop + ceilingH - 12, 48, 3, 2);
        }
        ceiling.endFill();
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.85);
        destBg.drawRoundedRect(W / 2 - 150, yCeilTop + 11, 300, 20, 4);
        destBg.lineStyle(0);
        destBg.endFill();
        ceiling.addChild(destBg);
        this._destTxt = new PIXI.Text('— — —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 10, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 4, dropShadowDistance: 0
        });
        this._destTxt.anchor.set(0.5, 0.5);
        this._destTxt.x = W / 2;
        this._destTxt.y = yCeilTop + 21;
        ceiling.addChild(this._destTxt);
        this.scene.addChild(ceiling);

        // ── 4. SIGNAGE STRIP (between ceiling and glass: line subtitle + route map) ──
        const sign = new PIXI.Graphics();
        sign.beginFill(0x1e293b);
        sign.drawRect(0, yTopBand, W, topBandH);
        sign.endFill();
        sign.beginFill(0x0ea5e9);                         // exterior accent line
        sign.drawRect(0, yTopBand + 2, W, 2);
        sign.endFill();
        // Route-map line with station nodes
        const mapY = yTopBand + topBandH - 8;
        sign.beginFill(theme.col, 0.85);
        sign.drawRect(60, mapY, W - 120, 3);
        sign.endFill();
        const nodeN = Math.min(Object.keys(this.STATION_LABELS).length, 6);
        for (let i = 0; i < nodeN; i++) {
            const nx = 60 + (i / (nodeN - 1)) * (W - 120);
            sign.beginFill(0x0f172a); sign.drawCircle(nx, mapY + 1.5, 5); sign.endFill();
            sign.beginFill(theme.col); sign.drawCircle(nx, mapY + 1.5, 3); sign.endFill();
        }
        this.scene.addChild(sign);
        const lineTxt = new PIXI.Text(theme.line, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: theme.col, letterSpacing: 2
        });
        lineTxt.anchor.set(0.5, 0);
        lineTxt.x = W / 2;
        lineTxt.y = yTopBand + 5;
        this.scene.addChild(lineTxt);

        // ── 5. LOW WALL BELOW THE GLASS + BENCH (exterior cyan body stripe) ───
        const cabin = new PIXI.Graphics();
        cabin.beginFill(0x1e293b);
        cabin.drawRect(0, yWallTop, W, lowerWallH + floorH);
        cabin.endFill();
        cabin.beginFill(0x94a3b8);                        // silver sill capping the glass
        cabin.drawRect(0, yWallTop, W, 3);
        cabin.endFill();
        cabin.beginFill(0x0284c7);                        // exterior cyan body stripe
        cabin.drawRect(0, yWallTop + 5, W, 6);
        cabin.endFill();
        cabin.beginFill(0x273548);                        // bench cushion
        cabin.drawRoundedRect(10, yWallTop + 14, W - 20, lowerWallH - 14, 5);
        cabin.endFill();
        cabin.beginFill(theme.col, 0.45);
        cabin.drawRect(10, yWallTop + 17, W - 20, 3);
        cabin.endFill();
        cabin.beginFill(0x1e293b);                         // seat dividers
        for (let bx = 70; bx < W - 30; bx += 96) cabin.drawRect(bx, yWallTop + 14, 3, lowerWallH - 14);
        cabin.endFill();
        this.scene.addChild(cabin);

        // Grab poles (signage-strip → floor) behind passengers
        const poles = new PIXI.Graphics();
        const poleXs = [];
        for (let i = 0; i < winCount; i++) poleXs.push(winStartX + i * winPitch + winInsideW / 2);
        poles.beginFill(0x64748b);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 4, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        poles.beginFill(0x94a3b8, 0.7);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 1.5, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        this.scene.addChild(poles);

        // Hand-straps hanging from the ceiling rail (animated in update)
        this._strapsG = new PIXI.Graphics();
        this._L.strapTopY = yTopBand + 4;
        this._L.strapXs = [];
        for (let sx = 96; sx < W - 60; sx += 86) this._L.strapXs.push(sx);
        this.scene.addChild(this._strapsG);

        // Passenger container (real riders only)
        this._passengersCont = new PIXI.Container();
        this.scene.addChild(this._passengersCont);
        this._paxAvatars = [];
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;

        // Bench front lip — over the lower legs of the back row → depth
        const benchFront = new PIXI.Graphics();
        benchFront.beginFill(0x1e293b);
        benchFront.drawRect(10, yFloorTop - 12, W - 20, 12);
        benchFront.endFill();
        benchFront.beginFill(0x0f172a);
        benchFront.drawRect(10, yFloorTop - 12, W - 20, 2);
        benchFront.endFill();
        this.scene.addChild(benchFront);

        // ── 6. FLOOR ──────────────────────────────────────────────────────────
        const floor = new PIXI.Graphics();
        floor.beginFill(0x334155);
        floor.drawRect(0, yFloorTop, W, floorH);
        floor.endFill();
        floor.beginFill(0x475569);
        for (let fx = 6; fx < W - 6; fx += 14) {
            floor.drawCircle(fx, yFloorTop + 5, 1.1);
            floor.drawCircle(fx + 7, yFloorTop + 10, 1.1);
        }
        floor.endFill();
        floor.beginFill(0xfacc15, 0.85);
        floor.drawRect(0, yFloorTop + floorH - 3, W, 2);
        floor.endFill();
        this.scene.addChild(floor);

        // ── 7. UNDERCARRIAGE — EXACTLY like the exterior: slate skirt sitting
        //      straight on the tunnel rail bed. The exterior train sprite has NO
        //      wheels or bogeys, so neither does this. ──
        const under = new PIXI.Graphics();
        under.beginFill(0x1e293b);                         // hull skirt (exterior body slate)
        under.drawRect(0, ySkirtTop, W, skirtH);
        under.endFill();
        under.beginFill(0x0ea5e9);                         // cyan trim (exterior accent)
        under.drawRect(0, ySkirtTop + skirtH - 2, W, 2);
        under.endFill();
        under.beginFill(0x1a1a24);                          // ballast bed (exterior 0x1a1a24)
        under.drawRect(0, yRailTop, W, railBedH);
        under.endFill();
        under.beginFill(0x4a4a5a);                          // twin steel rails (exterior 0x4a4a5a)
        under.drawRect(0, yRailTop + 5, W, 3);
        under.drawRect(0, yRailTop + railBedH - 7, W, 3);
        under.endFill();
        this.scene.addChild(under);

        // Scrolling sleeper ties over the ballast (sense of motion)
        this._tiesG = new PIXI.Graphics();
        this._tiesG.y = yRailTop + 10;
        this._L.railBedH = railBedH;
        this.scene.addChild(this._tiesG);

        // ── 8. SLIDING DOOR PAIR (glass aligned to the car windows) ──────────
        const doorCx = W / 2;
        const doorTop = yWinTop - 4;
        const doorBot = yFloorTop;
        const doorH = doorBot - doorTop;
        const doorPanelW = 56;
        const doorTotalW = doorPanelW * 2;
        const doorFrame = new PIXI.Graphics();
        doorFrame.beginFill(0x0f172a);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.endFill();
        doorFrame.lineStyle(2, theme.col, 0.7);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.lineStyle(0);
        this.scene.addChild(doorFrame);

        // Platform seen THROUGH the doorway (full height: sign → platform → edge).
        // Sits behind the sliding panels, clipped to the door opening, so when the
        // doors part at a station you look straight out onto the platform — the
        // same station that's visible through the windows.
        this._doorViewG = new PIXI.Graphics();
        this._doorMask = new PIXI.Graphics();
        this._doorMask.beginFill(0xffffff);
        this._doorMask.drawRect(doorCx - doorTotalW / 2, doorTop, doorTotalW, doorH);
        this._doorMask.endFill();
        this.scene.addChild(this._doorMask);
        this._doorViewG.mask = this._doorMask;
        this.scene.addChild(this._doorViewG);
        this._L.doorTotalW = doorTotalW;
        const makePanel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x1e293b);
            g.drawRect(0, 0, doorPanelW, doorH);
            g.endFill();
            g.beginFill(0x0284c7);                          // cyan body stripe (matches sill)
            g.drawRect(0, (yWallTop - doorTop) + 5, doorPanelW, 6);
            g.endFill();
            // Door window aligned with the car glass band
            const dwTop = 6, dwH = (yWinBot - yWinTop) - 10;
            g.beginFill(0x0f172a);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.12);
            g.drawRect(7, dwTop, doorPanelW - 14, 6);
            g.endFill();
            g.lineStyle(2, 0x94a3b8, 0.85);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.lineStyle(0);
            g.beginFill(0x94a3b8);
            g.drawRect(doorPanelW - 11, dwTop + dwH + 8, 4, 22);
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

        // ── 9. HUD ────────────────────────────────────────────────────────────
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0xfef9c3
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = W - 14;
        this._speedTxt.y = yTopBand + 6;
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
       (EntitiesGfx.initMetro): 0x050508 void + 0x111115 pillars @150 + red lights. ─── */
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
        const lightY = Math.min(20, winBandH * 0.18);
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.beginFill(0xef4444, 0.3);
            g.drawCircle(px + pillarW / 2, lightY, 7);
            g.endFill();
            g.beginFill(0xef4444);
            g.drawCircle(px + pillarW / 2, lightY, 2);
            g.endFill();
        }
        const flrY = winBandH - 14;
        g.beginFill(0x1a1a24);
        g.drawRect(0, flrY, W, 14);
        g.endFill();
        g.beginFill(0xfacc15, 0.5);
        g.drawRect(0, flrY - 1, W, 1);
        g.endFill();
    },

    /* ─── Station view shown through windows when waiting. ─── */
    _drawStationView(g, theme, W, winBandH) {
        g.clear();
        // Lit station hall — kept brighter than the tunnel so it clearly reads
        // as "pulled into a station" through the glass.
        g.beginFill(0x15151f);
        g.drawRect(0, 0, W, winBandH);
        g.endFill();
        g.lineStyle(1, 0x2a2a3a, 0.55);
        for (let tx = 0; tx < W; tx += 24) { g.moveTo(tx, 6); g.lineTo(tx, winBandH - 26); }
        for (let ty = 12; ty < winBandH - 20; ty += 18) { g.moveTo(0, ty); g.lineTo(W, ty); }
        g.lineStyle(0);
        g.beginFill(0x1c1c28);
        for (let px = 60; px < W; px += 220) g.drawRect(px, 6, 14, winBandH - 32);
        g.endFill();
        // Lit signage band
        g.beginFill(0x05050a);
        g.lineStyle(1, theme.col, 0.9);
        g.drawRect(W / 2 - 120, 14, 240, 22);
        g.lineStyle(0);
        g.endFill();
        g.beginFill(theme.col, 0.45);
        g.drawRect(W / 2 - 110, 21, 220, 4);
        g.endFill();
        const platY = winBandH - 26;
        g.beginFill(0x3a3a52);
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
            g.beginFill(0x1e293b);
            g.drawRect(pxp - 4, platY - 22 + sway, 8, 18);
            g.endFill();
            g.beginFill(0x334155);
            g.drawCircle(pxp, platY - 24 + sway, 3.4);
            g.endFill();
            if (rng() > 0.6) {
                g.beginFill(theme.col, 0.85);
                g.drawRect(pxp - 1, platY - 14 + sway, 2, 2);
                g.endFill();
            }
        }
    },

    /* ─── Full-height platform seen through the OPEN DOORS. Drawn in scene
       coords inside the door aperture (clipped by _doorMask), so it lines up
       with the same station shown through the windows: station back wall +
       sign up top, platform floor + safety strip at the bottom, a couple of
       commuters waiting. When in the tunnel it falls back to the dark cavity
       (the doors are shut then anyway). ─── */
    _drawDoorStation(g, theme, atStation) {
        const L = this._L;
        g.clear();
        const x0 = L.doorCx - L.doorTotalW / 2;
        const w = L.doorTotalW;
        const y0 = L.doorTop;
        const yB = L.doorBot;
        const hh = yB - y0;

        if (!atStation) {
            // Tunnel cavity (doors are closed in transit; this is just a fallback)
            g.beginFill(0x050508); g.drawRect(x0, y0, w, hh); g.endFill();
            g.beginFill(0x111115);
            g.drawRect(x0 + 6, y0, 14, hh);
            g.drawRect(x0 + w - 20, y0, 14, hh);
            g.endFill();
            return;
        }

        // Station back wall — same lit palette as the window station view
        g.beginFill(0x15151f);
        g.drawRect(x0, y0, w, hh);
        g.endFill();
        g.lineStyle(1, 0x2a2a3a, 0.5);
        for (let tx = x0; tx < x0 + w; tx += 22) { g.moveTo(tx, y0 + 4); g.lineTo(tx, yB - 22); }
        for (let ty = y0 + 10; ty < yB - 18; ty += 18) { g.moveTo(x0, ty); g.lineTo(x0 + w, ty); }
        g.lineStyle(0);
        // Side pillars framing the doorway
        g.beginFill(0x1c1c28);
        g.drawRect(x0, y0, 12, hh);
        g.drawRect(x0 + w - 12, y0, 12, hh);
        g.endFill();
        // Lit station sign up top (theme-coloured, mirrors the window sign)
        g.beginFill(0x05050a);
        g.lineStyle(1, theme.col, 0.85);
        g.drawRect(x0 + 16, y0 + 12, w - 32, 20);
        g.lineStyle(0);
        g.endFill();
        g.beginFill(theme.col, 0.5);
        g.drawRect(x0 + 22, y0 + 19, w - 44, 3);
        g.endFill();
        g.beginFill(theme.col, 0.22);
        g.drawRect(x0 + 22, y0 + 25, (w - 44) * 0.7, 2);
        g.endFill();
        // Platform floor + tactile edge at the bottom (aligns to car floor)
        const platTop = yB - 22;
        g.beginFill(0x3a3a52);
        g.drawRect(x0, platTop, w, 22);
        g.endFill();
        g.beginFill(0xfacc15);
        g.drawRect(x0, platTop - 2, w, 2);
        g.endFill();
        g.beginFill(0xd97706);
        for (let dx = x0; dx < x0 + w; dx += 12) g.drawRect(dx, platTop, 8, 3);
        g.endFill();
        // A couple of commuters waiting on the platform (silhouettes, slight sway)
        const seed = ((this._lastTrainX | 0) + (L.doorCx | 0)) || 1;
        let s = seed;
        const rng = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
        const n = 2 + Math.floor(rng() * 2);
        for (let i = 0; i < n; i++) {
            const px = x0 + 20 + rng() * (w - 40);
            const sway = Math.sin((this._tick || 0) * 0.05 + i * 1.7) * 0.8;
            g.beginFill(0x1e293b);
            g.drawRect(px - 5, platTop - 34 + sway, 10, 30);
            g.endFill();
            g.beginFill(0x334155);
            g.drawCircle(px, platTop - 38 + sway, 5);
            g.endFill();
            if (rng() > 0.55) {
                g.beginFill(theme.col, 0.8);
                g.drawRect(px - 1.5, platTop - 24 + sway, 3, 3);
                g.endFill();
            }
        }
    },

    /* ─── The ACTUAL riders attached to this train. Source of truth is
       G.charRefs — a model/NPC sets refs._ridingTrain to this train object
       while aboard (entities.js metro state machine), so the cabin shows
       exactly the AI models mid-commute, the way a building shows its real
       occupants. No padding with fakes; an empty train → an empty cabin. ─── */
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

    /* ─── Build the cabin from the real rider list. Rebuild only when the rider
       set changes (id signature) so it's cheap. ─── */
    _refreshPassengers(train) {
        const L = this._L;
        if (!this._passengersCont) return;

        const riders = this._gatherRiders(train);
        this._totalPax = riders.length;
        const VIS_CAP = 18;
        const shown = riders.slice(0, VIS_CAP);
        this._visiblePax = shown.length;

        const sig = shown.map(r => r.id).join('|') + '#' + riders.length;
        if (sig === this._paxSig) return;
        this._paxSig = sig;

        if (this._paxAvatars) {
            this._paxAvatars.forEach(a => { if (a.cont && !a.cont.destroyed) a.cont.destroy({ children: true }); });
        }
        this._paxAvatars = [];
        this._passengersCont.removeChildren();

        if (shown.length === 0 || typeof HumanAvatar === 'undefined') return;

        const doorCx = L.doorCx, doorHalf = L.doorPanelW + 18;
        const inDoor = (px) => px > doorCx - doorHalf && px < doorCx + doorHalf;

        // Two standing rows for a packed-car feel with depth. Feet are placed so
        // standing HEADS rise into the window band (matches the exterior view).
        const back = [], front = [];
        shown.forEach((r, i) => (i % 2 === 0 ? front : back).push(r));

        const marginX = 46;
        const usable = L.W - marginX * 2;
        const slotsFor = (arr, py, scale, dim) => {
            const n = arr.length;
            return arr.map((rider, i) => {
                let px = marginX + (n === 1 ? usable / 2 : (i / (n - 1)) * usable);
                if (inDoor(px)) px += (px < doorCx ? -1 : 1) * doorHalf;
                px = Math.max(marginX, Math.min(L.W - marginX, px));
                return { rider, px, py, scale, dim };
            });
        };
        const backRow  = slotsFor(back,  L.yFloorTop - 14, 1.55, true);
        const frontRow = slotsFor(front, L.yFloorTop - 1,  1.85, false);
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
                showDot: true
            });
            av.cont.scale.set(slot.scale);
            if (slot.dim) av.cont.alpha = 0.82;
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

        this._drawTunnelStrip(this._tunnelG, this._scroll, L.W, L.winH);

        if (isWaiting && stationLabel) {
            this._drawStationView(this._stationG, L.theme, L.W, L.winH);
            this._stationG.alpha = Math.min(1, (this._stationG.alpha || 0) + 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.text = stationLabel;
                this._stationLabelTxt.x = L.W / 2;
                this._stationLabelTxt.y = 28;
                this._stationLabelTxt.visible = true;
            }
        } else {
            this._stationG.alpha = Math.max(0, (this._stationG.alpha || 0) - 0.12);
            if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
                this._stationLabelTxt.visible = this._stationG.alpha > 0.05;
            }
        }

        // Platform visible through the doorway — the sliding panels reveal it
        // as they part, so an arriving train opens onto the same station the
        // windows show.
        if (this._doorViewG && !this._doorViewG.destroyed) {
            this._drawDoorStation(this._doorViewG, L.theme, !!(isWaiting && stationLabel));
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

        // Passengers — real rider list (truthful, tracked)
        this._refreshPassengers(t);
        this._animatePassengers();

        if (this._speedTxt) {
            const speed = isWaiting ? 0 : Math.abs(dx);
            const total = this._totalPax | 0;
            const shownN = this._visiblePax | 0;
            const paxStr = total > shownN ? `${shownN}/${total} aboard` : `${total} aboard`;
            this._speedTxt.text = `${isWaiting ? 'STOPPED' : speed.toFixed(1) + ' u/t'}   ${paxStr}`;
        }

        // Hand-straps sway with motion
        if (this._strapsG && L.strapXs) {
            this._strapsG.clear();
            const lean = (isWaiting ? 0 : Math.max(-1, Math.min(1, dx * 0.4)));
            L.strapXs.forEach((sx, i) => {
                const swing = Math.sin(this._tick * 0.06 + i) * 2 + lean * 6;
                this._strapsG.lineStyle(2, 0x64748b, 0.9);
                this._strapsG.moveTo(sx, L.strapTopY);
                this._strapsG.lineTo(sx + swing, L.strapTopY + 24);
                this._strapsG.lineStyle(0);
                this._strapsG.beginFill(0x94a3b8);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 28, 4);
                this._strapsG.endFill();
                this._strapsG.beginFill(0x0f172a);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 28, 2);
                this._strapsG.endFill();
            });
        }

        // Scrolling sleeper ties (exterior-style rail bed, no wheels)
        if (this._tiesG) {
            this._tiesG.clear();
            const tiePitch = 18;
            const tiePhase = ((this._scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
            this._tiesG.beginFill(0xd97706);
            for (let tx = -tiePhase; tx < L.W + tiePitch; tx += tiePitch) {
                this._tiesG.drawRect(tx, 0, 9, 3);
            }
            this._tiesG.endFill();
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
        this._doorViewG = null;
        this._doorMask = null;
        this._destTxt = null;
        this._speedTxt = null;
        this._strapsG = null;
        this._tiesG = null;
        this._L = null;
        this._lastTrainX = null;
        this._scroll = 0;
        this._doorOpen = 0;
        this._tick = 0;
    }
};
