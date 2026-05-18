/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.4.0 — true exterior parity)
   This is literally a zoom-in of the SAME train you see on the surface, at the same moment.

   • Palette is the EXACT composited exterior look (entities_gfx.buildTrainSprite, after the
     fGfx front overlays the tBg body): the car body is light silver — roof 0xcbd5e1,
     hull 0x94a3b8 — with a dark navy skirt 0x1e293b, dark glass, cyan stripe 0x0284c7 /
     accent 0x0ea5e9. (It is NOT dark navy; that was wrong.)
   • Passengers are built with InteriorMetroStation._makeAvatarSprite(m) — the verified 1:1 copy of
     the exterior model/NPC avatar (lab colour, lifecycle stage, MoE ghosts, retired glow,
     click-to-track). The riders are the ACTUAL models attached to this train.
   • The train object is the shared Entities[key], read live every frame, so state / x /
     targetX / direction mirror the exterior exactly. The tunnel scrolls OPPOSITE to travel
     (move right outside → scenery slides left in the windows).
   • The exterior train has no wheels/bogeys, so neither does this: a slate skirt sitting on
     the tunnel ballast + twin rails. The car is short with tunnel void above the roof.
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
    _L: null,

    // Exterior train materials (final composited look — see buildTrainSprite)
    C_ROOF:   0xcbd5e1,   // light silver roof cap
    C_BODY:   0x94a3b8,   // hull / walls / doors (dominant)
    C_TRIM:   0x64748b,   // window bezels, dividers, bench
    C_GLASS:  0x0f172a,   // dark glass
    C_STRIPE: 0x0284c7,   // cyan body stripe
    C_ACCENT: 0x0ea5e9,   // bright cyan accent line
    C_SKIRT:  0x1e293b,   // dark navy skirt (only dark part of the body)
    C_RAILBED:0x1a1a24,
    C_RAIL:   0x4a4a5a,
    C_TIE:    0xd97706,
    C_LEDPANEL:0x0f172a,  // dark route/LED strip (high contrast on the silver body)

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
        const C = this;

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ── Layout — short, realistic car cross-section ───────────────────────
        const ceilingH   = 44;
        const topBandH   = 22;                          // dark LED route strip
        const winH        = 104;
        const lowerWallH  = 34;
        const floorH      = 14;
        const skirtH      = 10;
        const railBedH    = 22;
        const underH      = skirtH + railBedH;
        const winPitch    = 212;
        const winInsideW  = 152;

        const totalH = ceilingH + topBandH + winH + lowerWallH + floorH + underH;
        const offsetY = Math.max(40, Math.round((H - totalH) / 2));

        const yCeilTop  = offsetY;
        const yCeilBot  = yCeilTop + ceilingH;
        const yTopBand  = yCeilBot;
        const yWinTop   = yTopBand + topBandH;
        const yWinBot   = yWinTop + winH;
        const yWallTop  = yWinBot;
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
            winY, winH, winPitch, winInsideW, ceilingH, topBandH, lowerWallH, floorH, railBedH
        };

        // ── 0. TUNNEL VOID BACKDROP (same dark tunnel the train runs in) ──
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

        // ── 1. TUNNEL STRIP (through window cutouts via mask) ──
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

        // ── 2. HULL PLATING around the windows (light silver body) ──
        const wall = new PIXI.Graphics();
        wall.beginFill(C.C_BODY);
        if (winStartX > 0) wall.drawRect(0, yWinTop, winStartX, winH);
        if (lastWinEnd < W) wall.drawRect(lastWinEnd, yWinTop, W - lastWinEnd, winH);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            wall.drawRect(mx, winY, winPitch - winInsideW, winH);
        }
        wall.endFill();
        // Darker pier rib (window divider, exterior 0x64748b)
        wall.beginFill(C.C_TRIM);
        for (let i = 0; i < winCount - 1; i++) {
            const mx = winStartX + i * winPitch + winInsideW;
            const mw = winPitch - winInsideW;
            wall.drawRect(mx + mw / 2 - 3, winY + 2, 6, winH - 4);
        }
        wall.endFill();
        this.scene.addChild(wall);

        // Window frames — silver bezel (0x64748b) like exterior window cutouts
        const winFrames = new PIXI.Graphics();
        winRects.forEach(r => {
            winFrames.lineStyle(4, C.C_TRIM, 1);
            winFrames.drawRoundedRect(r.x - 2, r.y - 2, r.w + 4, r.h + 4, 5);
            winFrames.lineStyle(2, C.C_BODY, 0.9);
            winFrames.drawRoundedRect(r.x + 2, r.y + 2, r.w - 4, r.h - 4, 4);
            winFrames.lineStyle(0);
            // Light-cyan glass tint (exterior 0xe0f2fe @0.15)
            winFrames.beginFill(0xe0f2fe, 0.15);
            winFrames.drawRect(r.x + 3, r.y + 3, r.w - 6, r.h * 0.26);
            winFrames.endFill();
        });
        this.scene.addChild(winFrames);

        // ── 3. CEILING / ROOF (silver body + light roof cap) ──
        const ceiling = new PIXI.Graphics();
        ceiling.beginFill(C.C_BODY);
        ceiling.drawRect(0, yCeilTop, W, ceilingH);
        ceiling.endFill();
        ceiling.beginFill(C.C_ROOF);                      // light silver roof cap
        ceiling.drawRect(0, yCeilTop, W, 7);
        ceiling.endFill();
        ceiling.beginFill(C.C_ROOF, 0.5);                 // inner roof panel (bright)
        ceiling.drawRoundedRect(10, yCeilTop + 11, W - 20, ceilingH - 18, 10);
        ceiling.endFill();
        ceiling.beginFill(0xfde68a, 0.30);                // warm LED glow
        ceiling.drawRect(20, yCeilTop + ceilingH - 13, W - 40, 6);
        ceiling.endFill();
        ceiling.beginFill(0xfffbe8);
        for (let lx = 26; lx < W - 26; lx += 72) {
            ceiling.drawRoundedRect(lx, yCeilTop + ceilingH - 12, 48, 3, 2);
        }
        ceiling.endFill();
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.9);
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

        // ── 4. DARK LED ROUTE STRIP (between roof and glass) ──
        const sign = new PIXI.Graphics();
        sign.beginFill(C.C_LEDPANEL);
        sign.drawRect(0, yTopBand, W, topBandH);
        sign.endFill();
        sign.beginFill(C.C_ACCENT);                       // exterior cyan accent line
        sign.drawRect(0, yTopBand, W, 2);
        sign.endFill();
        const mapY = yTopBand + topBandH - 8;
        sign.beginFill(theme.col, 0.9);
        sign.drawRect(60, mapY, W - 120, 3);
        sign.endFill();
        const nodeN = Math.min(Object.keys(this.STATION_LABELS).length, 6);
        for (let i = 0; i < nodeN; i++) {
            const nx = 60 + (i / (nodeN - 1)) * (W - 120);
            sign.beginFill(0x05050a); sign.drawCircle(nx, mapY + 1.5, 5); sign.endFill();
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

        // ── 5. LOWER WALL + CYAN STRIPE + BENCH ──
        const cabin = new PIXI.Graphics();
        cabin.beginFill(C.C_BODY);
        cabin.drawRect(0, yWallTop, W, lowerWallH + floorH);
        cabin.endFill();
        cabin.beginFill(C.C_TRIM);                         // silver sill capping the glass
        cabin.drawRect(0, yWallTop, W, 3);
        cabin.endFill();
        cabin.beginFill(C.C_ACCENT);                       // exterior bright cyan accent
        cabin.drawRect(0, yWallTop + 4, W, 3);
        cabin.endFill();
        cabin.beginFill(C.C_STRIPE);                       // exterior cyan body stripe
        cabin.drawRect(0, yWallTop + 7, W, 6);
        cabin.endFill();
        cabin.beginFill(C.C_TRIM);                          // bench cushion (darker silver)
        cabin.drawRoundedRect(10, yWallTop + 15, W - 20, lowerWallH - 15, 5);
        cabin.endFill();
        cabin.beginFill(theme.col, 0.5);
        cabin.drawRect(10, yWallTop + 18, W - 20, 3);
        cabin.endFill();
        cabin.beginFill(C.C_SKIRT, 0.5);                    // seat dividers
        for (let bx = 70; bx < W - 30; bx += 96) cabin.drawRect(bx, yWallTop + 15, 3, lowerWallH - 15);
        cabin.endFill();
        this.scene.addChild(cabin);

        // Grab poles (silver) behind passengers
        const poles = new PIXI.Graphics();
        const poleXs = [];
        for (let i = 0; i < winCount; i++) poleXs.push(winStartX + i * winPitch + winInsideW / 2);
        poles.beginFill(C.C_TRIM);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 4, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        poles.beginFill(C.C_ROOF, 0.8);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 1.5, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        this.scene.addChild(poles);

        // Hand-straps from the ceiling rail (animated)
        this._strapsG = new PIXI.Graphics();
        this._L.strapTopY = yTopBand + 4;
        this._L.strapXs = [];
        for (let sx = 96; sx < W - 60; sx += 86) this._L.strapXs.push(sx);
        this.scene.addChild(this._strapsG);

        // Passengers (real models, exterior-faithful avatars)
        this._passengersCont = new PIXI.Container();
        this.scene.addChild(this._passengersCont);
        this._paxAvatars = [];
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;

        // Bench front lip over the back row's lower legs → depth
        const benchFront = new PIXI.Graphics();
        benchFront.beginFill(C.C_BODY);
        benchFront.drawRect(10, yFloorTop - 12, W - 20, 12);
        benchFront.endFill();
        benchFront.beginFill(C.C_SKIRT, 0.4);
        benchFront.drawRect(10, yFloorTop - 12, W - 20, 2);
        benchFront.endFill();
        this.scene.addChild(benchFront);

        // ── 6. FLOOR ──
        const floor = new PIXI.Graphics();
        floor.beginFill(C.C_TRIM);
        floor.drawRect(0, yFloorTop, W, floorH);
        floor.endFill();
        floor.beginFill(C.C_BODY);
        for (let fx = 6; fx < W - 6; fx += 14) {
            floor.drawCircle(fx, yFloorTop + 5, 1.1);
            floor.drawCircle(fx + 7, yFloorTop + 10, 1.1);
        }
        floor.endFill();
        floor.beginFill(0xfacc15, 0.85);
        floor.drawRect(0, yFloorTop + floorH - 3, W, 2);
        floor.endFill();
        this.scene.addChild(floor);

        // ── 7. UNDERCARRIAGE — exterior-exact: dark navy skirt on the rail bed,
        //      NO wheels/bogeys (the surface train sprite has none). ──
        const under = new PIXI.Graphics();
        under.beginFill(C.C_SKIRT);                        // exterior skirt 0x1e293b
        under.drawRect(0, ySkirtTop, W, skirtH);
        under.endFill();
        under.beginFill(C.C_ACCENT);
        under.drawRect(0, ySkirtTop + skirtH - 2, W, 2);
        under.endFill();
        under.beginFill(C.C_RAILBED);                      // ballast (exterior 0x1a1a24)
        under.drawRect(0, yRailTop, W, railBedH);
        under.endFill();
        under.beginFill(C.C_RAIL);                          // twin rails (exterior 0x4a4a5a)
        under.drawRect(0, yRailTop + 5, W, 3);
        under.drawRect(0, yRailTop + railBedH - 7, W, 3);
        under.endFill();
        this.scene.addChild(under);

        this._tiesG = new PIXI.Graphics();
        this._tiesG.y = yRailTop + 10;
        this.scene.addChild(this._tiesG);

        // ── 8. SLIDING DOOR PAIR + platform-through-doorway ──
        const doorCx = W / 2;
        const doorTop = yWinTop - 4;
        const doorBot = yFloorTop;
        const doorH = doorBot - doorTop;
        const doorPanelW = 56;
        const doorTotalW = doorPanelW * 2;
        const doorFrame = new PIXI.Graphics();
        doorFrame.beginFill(C.C_TRIM);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.endFill();
        doorFrame.lineStyle(2, theme.col, 0.7);
        doorFrame.drawRect(doorCx - doorTotalW / 2 - 5, doorTop - 5, doorTotalW + 10, doorH + 10);
        doorFrame.lineStyle(0);
        this.scene.addChild(doorFrame);

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
            g.beginFill(C.C_BODY);
            g.drawRect(0, 0, doorPanelW, doorH);
            g.endFill();
            g.beginFill(C.C_ACCENT);
            g.drawRect(0, (yWallTop - doorTop) + 4, doorPanelW, 3);
            g.endFill();
            g.beginFill(C.C_STRIPE);
            g.drawRect(0, (yWallTop - doorTop) + 7, doorPanelW, 6);
            g.endFill();
            const dwTop = 6, dwH = (yWinBot - yWinTop) - 10;
            g.beginFill(C.C_GLASS);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.13);
            g.drawRect(7, dwTop, doorPanelW - 14, 6);
            g.endFill();
            g.lineStyle(2, C.C_TRIM, 0.95);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.lineStyle(0);
            g.beginFill(C.C_TRIM);
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

        // ── 9. HUD ──
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0x0f172a,
            fontWeight: 'bold'
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = W - 14;
        this._speedTxt.y = yWallTop + 16;
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

    /* ─── Station hall seen through the windows when stopped. ─── */
    _drawStationView(g, theme, W, winBandH) {
        g.clear();
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

    /* ─── Full-height platform seen through the OPEN DOORS (clipped to the
       aperture; revealed as the panels part). Same lit palette as the windows. ─── */
    _drawDoorStation(g, theme, atStation) {
        const L = this._L;
        g.clear();
        const x0 = L.doorCx - L.doorTotalW / 2;
        const w = L.doorTotalW;
        const y0 = L.doorTop;
        const yB = L.doorBot;
        const hh = yB - y0;

        if (!atStation) {
            g.beginFill(0x050508); g.drawRect(x0, y0, w, hh); g.endFill();
            g.beginFill(0x111115);
            g.drawRect(x0 + 6, y0, 14, hh);
            g.drawRect(x0 + w - 20, y0, 14, hh);
            g.endFill();
            return;
        }
        g.beginFill(0x15151f);
        g.drawRect(x0, y0, w, hh);
        g.endFill();
        g.lineStyle(1, 0x2a2a3a, 0.5);
        for (let tx = x0; tx < x0 + w; tx += 22) { g.moveTo(tx, y0 + 4); g.lineTo(tx, yB - 22); }
        for (let ty = y0 + 10; ty < yB - 18; ty += 18) { g.moveTo(x0, ty); g.lineTo(x0 + w, ty); }
        g.lineStyle(0);
        g.beginFill(0x1c1c28);
        g.drawRect(x0, y0, 12, hh);
        g.drawRect(x0 + w - 12, y0, 12, hh);
        g.endFill();
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

    /* ─── The ACTUAL riders attached to this train. Returns the real model
       objects (refs._ridingTrain === train) so the cabin uses the exterior
       avatar renderer with the model's real lab/stage. ─── */
    _gatherRiders(train) {
        const riders = [];
        if (!train || typeof G === 'undefined' || !G.charRefs || !G.models) return riders;
        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            const refs = G.charRefs[m.id];
            if (!refs || refs._ridingTrain !== train) continue;
            riders.push(m);
        }
        return riders;
    },

    /* ─── Build the cabin from the real rider list using the SAME avatar as the
       exterior (InteriorMetroStation._makeAvatarSprite, a 1:1 copy of the city avatar).
       Rebuild only when the rider set changes. ─── */
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

        const canMake = typeof InteriorMetroStation !== 'undefined' && typeof InteriorMetroStation._makeAvatarSprite === 'function';
        if (shown.length === 0 || !canMake) return;

        const doorCx = L.doorCx, doorHalf = L.doorPanelW + 18;
        const inDoor = (px) => px > doorCx - doorHalf && px < doorCx + doorHalf;

        const back = [], front = [];
        shown.forEach((r, i) => (i % 2 === 0 ? front : back).push(r));

        const marginX = 46;
        const usable = L.W - marginX * 2;
        const slotsFor = (arr, py, scale, dim) => {
            const n = arr.length;
            return arr.map((m, i) => {
                let px = marginX + (n === 1 ? usable / 2 : (i / (n - 1)) * usable);
                if (inDoor(px)) px += (px < doorCx ? -1 : 1) * doorHalf;
                px = Math.max(marginX, Math.min(L.W - marginX, px));
                return { m, px, py, scale, dim };
            });
        };
        // Avatars are ~32px tall at finalSc 1; scale up so the zoomed-in cabin
        // reads like the city, keeping each model's relative size differences.
        const backRow  = slotsFor(back,  L.yFloorTop - 13, 1.5,  true);
        const frontRow = slotsFor(front, L.yFloorTop - 1,  1.85, false);
        const allSlots = backRow.concat(frontRow);

        allSlots.forEach((slot, idx) => {
            const m = slot.m;
            if (!m) return;
            let av;
            try { av = InteriorMetroStation._makeAvatarSprite(m); } catch (e) { av = null; }
            if (!av || !av.cont) return;
            av.cont.x = slot.px;
            av.cont.y = slot.py;
            av.cont.scale.set(slot.scale * (av.cont.scale.x || 1));
            if (slot.dim) av.cont.alpha = (av.cont.alpha || 1) * 0.85;
            this._passengersCont.addChild(av.cont);
            this._paxAvatars.push({
                cont: av.cont, baseX: slot.px, baseY: slot.py, idx
            });
        });
    },

    /* Gentle standing sway/bob (no rebuild). */
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

        // Live mirror of the shared exterior train object. Scenery scrolls
        // OPPOSITE to travel: train moving right (dx>0) → world slides left.
        if (this._lastTrainX == null) this._lastTrainX = t.x;
        const dx = t.x - this._lastTrainX;
        this._lastTrainX = t.x;
        this._scroll += dx;

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

        if (this._doorViewG && !this._doorViewG.destroyed) {
            this._drawDoorStation(this._doorViewG, L.theme, !!(isWaiting && stationLabel));
        }

        // Doors
        const doorTarget = isWaiting ? 1 : 0;
        this._doorOpen += (doorTarget - this._doorOpen) * 0.12;
        const openPx = this._doorOpen * (L.doorPanelW - 4);
        if (this._doorL) this._doorL.x = (L.doorCx - L.doorPanelW) - openPx;
        if (this._doorR) this._doorR.x = (L.doorCx + L.doorPanelW) + openPx;

        // Destination — uses the shared targetX, so it matches the exterior run
        if (this._destTxt) {
            if (isWaiting && stationLabel) this._destTxt.text = stationLabel;
            else if (nextLabel) this._destTxt.text = 'NEXT: ' + nextLabel;
            else this._destTxt.text = '— in transit —';
        }

        this._refreshPassengers(t);
        this._animatePassengers();

        if (this._speedTxt) {
            const speed = isWaiting ? 0 : Math.abs(dx);
            const total = this._totalPax | 0;
            const shownN = this._visiblePax | 0;
            const paxStr = total > shownN ? `${shownN}/${total} aboard` : `${total} aboard`;
            this._speedTxt.text = `${isWaiting ? 'STOPPED' : speed.toFixed(1) + ' u/t'}   ${paxStr}`;
        }

        if (this._strapsG && L.strapXs) {
            this._strapsG.clear();
            const lean = (isWaiting ? 0 : Math.max(-1, Math.min(1, dx * 0.4)));
            L.strapXs.forEach((sx, i) => {
                const swing = Math.sin(this._tick * 0.06 + i) * 2 - lean * 6;
                this._strapsG.lineStyle(2, this.C_TRIM, 0.95);
                this._strapsG.moveTo(sx, L.strapTopY);
                this._strapsG.lineTo(sx + swing, L.strapTopY + 24);
                this._strapsG.lineStyle(0);
                this._strapsG.beginFill(this.C_ROOF);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 28, 4);
                this._strapsG.endFill();
                this._strapsG.beginFill(this.C_GLASS);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 28, 2);
                this._strapsG.endFill();
            });
        }

        // Scrolling ties — slide opposite to travel, same as the windows
        if (this._tiesG) {
            this._tiesG.clear();
            const tiePitch = 18;
            const tiePhase = ((this._scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
            this._tiesG.beginFill(this.C_TIE);
            for (let tx = -tiePhase; tx < L.W + tiePitch; tx += tiePitch) {
                this._tiesG.drawRect(tx, 0, 9, 3);
            }
            this._tiesG.endFill();
        }

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
