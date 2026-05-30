/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.5.0 — discrete car in the real tunnel)
   A zoom-in of the SAME car you see outside, sitting in the SAME tunnel:

   • The car is a DISCRETE unit with rounded front/back end-caps + red/green head/tail
     lights (direction-aware, exterior convention) — not a tube spanning the whole screen.
     Tunnel is visible to the left & right of the car ends.
   • Full-width environment behind it, matching the exterior stack exactly:
       data/fiber CABLE TRAY above (Underground.CABLE_COLS / 0x060a14, 38px)
       tunnel cavity (0x050508 + 0x111115 pillars + red lights) — also seen through windows
       ballast + twin rails the car sits on
       water/power/sewer INFRASTRUCTURE below (0x0369a1/0x0284c7 water, 0xb45309/0xd97706
       sewer, 0x334155/0x0ea5e9/0xf59e0b junction boxes) — exact Underground values.
   • Body palette = exterior composited look: light silver 0x94a3b8 hull / 0xcbd5e1 roof,
     dark navy 0x1e293b skirt, dark glass, cyan 0x0284c7 / accent 0x0ea5e9.
   • Passengers = the real models aboard, built with InteriorMetroStation._makeAvatarSprite
     (1:1 copy of the city avatar). The train object is the shared Entities[key] read live,
     so state / x / targetX / arrivals mirror the exterior; scenery scrolls OPPOSITE travel.
   • Windows + open doors reveal the same environment behind the car (tunnel in transit,
     station hall when stopped) — one consistent world, no separate masked layers.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorTrain = {
    scene: null,
    layer: null,
    bld: null,
    _trainKey: null,
    isDragging: false,
    _envG: null,
    _passengersCont: null,
    _paxAvatars: null,
    _paxSig: null,
    _visiblePax: 0,
    _totalPax: 0,
    _doorL: null,
    _doorR: null,
    _doorOpen: 0,
    _lightA: null,
    _lightB: null,
    _lastTrainX: null,
    _scroll: 0,
    _destTxt: null,
    _speedTxt: null,
    _strapsG: null,
    _tick: 0,
    _L: null,

    // Exterior train materials (final composited look)
    C_ROOF:   0xcbd5e1,
    C_BODY:   0x94a3b8,
    C_TRIM:   0x64748b,
    C_GLASS:  0x0f172a,
    C_STRIPE: 0x0284c7,
    C_ACCENT: 0x0ea5e9,
    C_SKIRT:  0x1e293b,
    C_LED:    0x0f172a,

    // Underground environment palette (verbatim from underground.js)
    CABLE_COLS: [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6],
    CABLE_BG:   0x060a14,
    TUN_VOID:   0x050508,
    TUN_PILLAR: 0x111115,
    TUN_LIGHT:  0xef4444,
    RAIL_BED:   0x1a1a24,
    RAIL_STEEL: 0x4a4a5a,
    TIE:        0xd97706,
    INFRA_DEEP: 0x0a0a0f,
    INFRA_P1:   0x1a202c,
    INFRA_P2:   0x0f172a,
    WATER:      0x0369a1,
    WATER_IN:   0x0284c7,
    SEWER:      0xb45309,
    SEWER_IN:   0xd97706,
    JBOX:       0x334155,
    JBOX_W:     0x0ea5e9,
    JBOX_S:     0xf59e0b,

    // Above-ground world (night sky + scrolling skyline + street) — warm residential
    // palette mirroring the exterior city the train runs beneath.
    CITY_SKY_TOP:  0x0a0e18,
    CITY_SKY_MID:  0x12101e,
    CITY_HORIZON:  0x3a2616,
    CITY_STREET:   0x16161f,
    CITY_ASPHALT:  0x101018,
    CITY_LANE:     0xfacc15,
    NEAR_BODIES:   [0x6e4632, 0x835539, 0x8f7a45, 0x66664a, 0x744f44, 0x55485a],
    NEAR_ROOF:     0xb9886a,
    FAR_BODIES:    [0x241f33, 0x2c2740, 0x1e2236],
    WIN_WARM:      0xfde68a,
    WIN_WARM2:     0xfff3c7,
    WIN_COOL:      0x9fb0e0,
    // Deep earth (below the pipes) — exact Underground.drawDeepEarth values.
    EARTH_BASE:    0x2d1a11,
    EARTH_A:       0x3d261a,
    EARTH_B:       0x1f100a,
    EARTH_VEIN_G:  0xfacc15,
    EARTH_VEIN_R:  0xb45309,

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

        // ── Vertical stack (mirrors the exterior cable→tunnel→infra layering) ──
        const cableH    = 38;
        const voidGap   = 22;   // tunnel void between cable tray and the car roof
        const ceilingH  = 40;
        const topBandH  = 20;   // dark LED route strip
        const winH       = 100;
        const lowerWallH = 30;
        const floorH     = 12;
        const skirtH     = 10;
        const railBedH   = 22;
        const infraH     = 100;
        const streetH    = 24;   // road surface sitting directly on the cable tray
        const carH = ceilingH + topBandH + winH + lowerWallH + floorH + skirtH;
        const stack = cableH + voidGap + carH + railBedH + infraH;
        // Bias the stack downward so the city skyline above gets the larger share of
        // the slack (we want to SEE the city going past), with deep earth filling below.
        const slack = H - stack;
        const offsetY = Math.max(16, Math.round(slack * 0.58));

        const yCableTop = offsetY;
        const yCableBot = yCableTop + cableH;
        const yRoofTop  = yCableBot + voidGap;
        const yTopBand  = yRoofTop + ceilingH;
        const yWinTop   = yTopBand + topBandH;
        const yWinBot   = yWinTop + winH;
        const yWallTop  = yWinBot;
        const yFloorTop = yWallTop + lowerWallH;
        const yFloorBot = yFloorTop + floorH;
        const ySkirtTop = yFloorBot;
        const ySkirtBot = ySkirtTop + skirtH;
        const yRailTop  = ySkirtBot;
        const yRailBot  = yRailTop + railBedH;
        const yInfraTop = yRailBot;
        const yInfraBot = yInfraTop + infraH;

        // ── Horizontal: a bounded car with tunnel visible past both ends ──
        const sideTun = Math.max(90, Math.min(220, Math.round(W * 0.11)));
        const carLeft  = sideTun;
        const carRight = W - sideTun;
        const carW = carRight - carLeft;
        const endCapW = 62;                       // cab nose at each end
        const innerLeft  = carLeft + endCapW;
        const innerRight = carRight - endCapW;
        const carMidY = (yRoofTop + ySkirtBot) / 2;
        const doorCx = Math.round((carLeft + carRight) / 2);
        const doorPanelW = 56;
        const doorHalf = doorPanelW + 4;          // door aperture half-width

        // Window layout: fill the two segments either side of the centre door.
        const winInsideW = 104, winGap = 46, winPitch = winInsideW + winGap;
        const winRects = [];
        const fillSeg = (a, b) => {
            const segW = b - a;
            const n = Math.floor((segW + winGap) / winPitch);
            if (n < 1) return;
            const used = n * winInsideW + (n - 1) * winGap;
            let sx = a + (segW - used) / 2;
            for (let i = 0; i < n; i++) { winRects.push({ x: Math.round(sx), w: winInsideW }); sx += winPitch; }
        };
        fillSeg(innerLeft, doorCx - doorHalf - 10);
        fillSeg(doorCx + doorHalf + 10, innerRight);

        this._L = {
            W, H, theme,
            yCableTop, yCableBot, yRoofTop, yTopBand, yWinTop, yWinBot, yWallTop,
            yFloorTop, yFloorBot, ySkirtTop, ySkirtBot, yRailTop, yRailBot, yInfraTop, yInfraBot,
            cableH, winH, carLeft, carRight, carW, innerLeft, innerRight, endCapW,
            carMidY, doorCx, doorPanelW, doorHalf, winRects, streetH,
            // Horizontal over-draw so the world still covers the viewport when the
            // track-follow camera zooms (scene scales to 1.45 and pans to a rider).
            ext: Math.round(W * 0.55)
        };

        // ── 0. ENVIRONMENT (full-width, redrawn each frame: cables / tunnel|station
        //      / rails / pipes — the world the car moves through) ──
        this._envG = new PIXI.Graphics();
        this.scene.addChild(this._envG);

        // ── 1. THE CAR (static silver hull with window/door holes; env shows through) ──
        const car = new PIXI.Graphics();
        const R = 16;

        // Roof + ceiling + LED-route block (rounded TOP corners)
        car.beginFill(C.C_BODY);
        car.drawRoundedRect(carLeft, yRoofTop, carW, (yWinTop - yRoofTop), R);
        car.drawRect(carLeft, yRoofTop + R, carW, (yWinTop - yRoofTop) - R);
        car.endFill();
        // Lower wall (window-bottom → floor) — left & right of the door gap
        car.beginFill(C.C_BODY);
        car.drawRect(carLeft, yWinBot, (doorCx - doorHalf) - carLeft, yFloorTop - yWinBot);
        car.drawRect(doorCx + doorHalf, yWinBot, carRight - (doorCx + doorHalf), yFloorTop - yWinBot);
        car.endFill();
        // Floor + skirt (rounded BOTTOM corners), full car width
        car.beginFill(C.C_BODY);
        car.drawRect(carLeft, yFloorTop, carW, (ySkirtBot - yFloorTop) - R);
        car.drawRoundedRect(carLeft, yFloorTop, carW, ySkirtBot - yFloorTop, R);
        car.endFill();
        // Window-band hull: end caps + piers between windows (holes stay open)
        car.beginFill(C.C_BODY);
        car.drawRect(carLeft, yWinTop, endCapW, winH);                  // left cab
        car.drawRect(innerRight, yWinTop, carRight - innerRight, winH); // right cab
        let prevEnd = innerLeft;
        winRects.forEach(r => {
            if (r.x > prevEnd) car.drawRect(prevEnd, yWinTop, r.x - prevEnd, winH);
            prevEnd = r.x + r.w;
        });
        if (innerRight > prevEnd) car.drawRect(prevEnd, yWinTop, innerRight - prevEnd, winH);
        // Pier on each side of the door aperture (so the gap is exactly the door)
        car.drawRect(doorCx - doorHalf - 2, yWinTop, 4, winH);
        car.drawRect(doorCx + doorHalf - 2, yWinTop, 4, winH);
        car.endFill();

        // Roof cap (light silver) + inner ceiling panel + LED
        car.beginFill(C.C_ROOF);
        car.drawRoundedRect(carLeft, yRoofTop, carW, 7, R);
        car.drawRect(carLeft, yRoofTop + Math.min(7, R), carW, Math.max(0, 7 - R));
        car.endFill();
        car.beginFill(C.C_ROOF, 0.5);
        car.drawRoundedRect(carLeft + 10, yRoofTop + 10, carW - 20, ceilingH - 18, 8);
        car.endFill();
        car.beginFill(0xfde68a, 0.28);
        car.drawRect(carLeft + 18, yRoofTop + ceilingH - 12, carW - 36, 5);
        car.endFill();
        car.beginFill(0xfffbe8);
        for (let lx = carLeft + 24; lx < carRight - 24; lx += 70) car.drawRoundedRect(lx, yRoofTop + ceilingH - 11, 46, 3, 2);
        car.endFill();

        // Dark LED route strip (between ceiling and glass) — door must NOT cover this
        car.beginFill(C.C_LED);
        car.drawRect(carLeft, yTopBand, carW, topBandH);
        car.endFill();
        car.beginFill(C.C_ACCENT);
        car.drawRect(carLeft, yTopBand, carW, 2);
        car.endFill();
        const mapY = yTopBand + topBandH - 8;
        car.beginFill(theme.col, 0.9);
        car.drawRect(carLeft + 50, mapY, carW - 100, 3);
        car.endFill();
        const nodeN = Math.min(Object.keys(this.STATION_LABELS).length, 6);
        for (let i = 0; i < nodeN; i++) {
            const nx = carLeft + 50 + (i / (nodeN - 1)) * (carW - 100);
            car.beginFill(0x05050a); car.drawCircle(nx, mapY + 1.5, 5); car.endFill();
            car.beginFill(theme.col); car.drawCircle(nx, mapY + 1.5, 3); car.endFill();
        }

        // Cyan accent + body stripe along the sill
        car.beginFill(C.C_TRIM);
        car.drawRect(carLeft, yWallTop, carW, 3);
        car.endFill();
        car.beginFill(C.C_ACCENT);
        car.drawRect(carLeft, yWallTop + 3, carW, 3);
        car.endFill();
        car.beginFill(C.C_STRIPE);
        car.drawRect(carLeft, yWallTop + 6, carW, 6);
        car.endFill();
        // Bench cushion in the lower wall (skip the door gap)
        car.beginFill(C.C_TRIM);
        car.drawRect(carLeft + 8, yWallTop + 14, (doorCx - doorHalf) - (carLeft + 8), lowerWallH - 14);
        car.drawRect(doorCx + doorHalf, yWallTop + 14, (carRight - 8) - (doorCx + doorHalf), lowerWallH - 14);
        car.endFill();
        car.beginFill(theme.col, 0.45);
        car.drawRect(carLeft + 8, yWallTop + 17, (doorCx - doorHalf) - (carLeft + 8), 3);
        car.drawRect(doorCx + doorHalf, yWallTop + 17, (carRight - 8) - (doorCx + doorHalf), 3);
        car.endFill();

        // Floor + yellow safety line
        car.beginFill(C.C_TRIM);
        car.drawRect(carLeft, yFloorTop, carW, floorH);
        car.endFill();
        car.beginFill(0xfacc15, 0.85);
        car.drawRect(carLeft, yFloorBot - 2, carW, 2);
        car.endFill();
        // Skirt (dark navy, exterior) + cyan trim
        car.beginFill(C.C_SKIRT);
        car.drawRect(carLeft, ySkirtTop, carW, skirtH);
        car.endFill();
        car.beginFill(C.C_ACCENT);
        car.drawRect(carLeft, ySkirtTop + skirtH - 2, carW, 2);
        car.endFill();

        // End-cap cab windshields (one small window per nose) + nose shading
        const wsW = 30, wsH = winH - 26;
        [[carLeft + 16], [carRight - 16 - wsW]].forEach(([wx]) => {
            car.beginFill(C.C_GLASS);
            car.drawRoundedRect(wx, yWinTop + 13, wsW, wsH, 4);
            car.endFill();
            car.beginFill(0xe0f2fe, 0.13);
            car.drawRect(wx + 2, yWinTop + 15, wsW - 4, 6);
            car.endFill();
            car.lineStyle(2, C.C_TRIM, 0.9);
            car.drawRoundedRect(wx, yWinTop + 13, wsW, wsH, 4);
            car.lineStyle(0);
        });
        this.scene.addChild(car);

        // Window frames (silver bezels around the open holes)
        const frames = new PIXI.Graphics();
        winRects.forEach(r => {
            frames.lineStyle(4, C.C_TRIM, 1);
            frames.drawRoundedRect(r.x - 2, yWinTop - 2, r.w + 4, winH + 4, 5);
            frames.lineStyle(2, C.C_BODY, 0.9);
            frames.drawRoundedRect(r.x + 2, yWinTop + 2, r.w - 4, winH - 4, 4);
            frames.lineStyle(0);
            frames.beginFill(0xe0f2fe, 0.12);
            frames.drawRect(r.x + 3, yWinTop + 3, r.w - 6, winH * 0.24);
            frames.endFill();
        });
        this.scene.addChild(frames);

        // Destination LED sign (on the ceiling)
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.9);
        destBg.drawRoundedRect(doorCx - 150, yRoofTop + 9, 300, 20, 4);
        destBg.lineStyle(0);
        destBg.endFill();
        this.scene.addChild(destBg);
        this._destTxt = new PIXI.Text('— — —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 10, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 4, dropShadowDistance: 0
        });
        this._destTxt.anchor.set(0.5, 0.5);
        this._destTxt.x = doorCx;
        this._destTxt.y = yRoofTop + 19;
        this.scene.addChild(this._destTxt);
        const lineTxt = new PIXI.Text(theme.line, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: theme.col, letterSpacing: 2
        });
        lineTxt.anchor.set(0.5, 0);
        lineTxt.x = doorCx;
        lineTxt.y = yTopBand + 4;
        this.scene.addChild(lineTxt);

        // Head / tail lights at the very ends (colour set per direction in update)
        this._lightA = new PIXI.Graphics();
        this._lightA.beginFill(0xffffff); this._lightA.drawCircle(0, 0, 5); this._lightA.endFill();
        this._lightA.x = carLeft + 8; this._lightA.y = carMidY;
        this.scene.addChild(this._lightA);
        this._lightB = new PIXI.Graphics();
        this._lightB.beginFill(0xffffff); this._lightB.drawCircle(0, 0, 5); this._lightB.endFill();
        this._lightB.x = carRight - 8; this._lightB.y = carMidY;
        this.scene.addChild(this._lightB);

        // Grab poles + hand-straps
        const poles = new PIXI.Graphics();
        const poleXs = [];
        winRects.forEach(r => poleXs.push(r.x + r.w / 2));
        poles.beginFill(C.C_TRIM);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 4, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        poles.beginFill(C.C_ROOF, 0.8);
        poleXs.forEach(px => poles.drawRect(px - 2, yTopBand + 6, 1.5, yFloorTop - (yTopBand + 6)));
        poles.endFill();
        this.scene.addChild(poles);
        this._strapsG = new PIXI.Graphics();
        this._L.strapTopY = yTopBand + 4;
        this._L.strapXs = [];
        for (let sx = innerLeft + 30; sx < innerRight - 20; sx += 80) {
            if (Math.abs(sx - doorCx) > doorHalf + 14) this._L.strapXs.push(sx);
        }
        this.scene.addChild(this._strapsG);

        // Passengers
        this._passengersCont = new PIXI.Container();
        this.scene.addChild(this._passengersCont);
        this._paxAvatars = [];
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;
        // Tracking pool keyed by model id — lets Interior._findTrackedAvatar follow a
        // tracked NPC who is aboard, exactly like the metro-station interior.
        this.avatarPool = new Map();

        // Bench front lip (over back-row legs → depth)
        const benchFront = new PIXI.Graphics();
        benchFront.beginFill(C.C_BODY);
        benchFront.drawRect(carLeft, yFloorTop - 10, carW, 10);
        benchFront.endFill();
        this.scene.addChild(benchFront);

        // ── Sliding doors (sit exactly in the window+lower-wall band, NOT over
        //    the LED route strip — frame top = yWinTop) ──
        const doorTop = yWinTop;
        const doorBot = yFloorTop;
        const doorH = doorBot - doorTop;
        const doorFrame = new PIXI.Graphics();
        doorFrame.lineStyle(3, theme.col, 0.8);
        doorFrame.drawRect(doorCx - doorHalf, doorTop, doorHalf * 2, doorH);
        doorFrame.lineStyle(0);
        this.scene.addChild(doorFrame);
        const makePanel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(C.C_BODY);
            g.drawRect(0, 0, doorPanelW, doorH);
            g.endFill();
            g.beginFill(C.C_ACCENT);
            g.drawRect(0, (yWallTop - doorTop) + 3, doorPanelW, 3);
            g.endFill();
            g.beginFill(C.C_STRIPE);
            g.drawRect(0, (yWallTop - doorTop) + 6, doorPanelW, 6);
            g.endFill();
            const dwTop = 8, dwH = winH - 16;
            g.beginFill(C.C_GLASS);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.12);
            g.drawRect(7, dwTop, doorPanelW - 14, 6);
            g.endFill();
            g.lineStyle(2, C.C_TRIM, 0.95);
            g.drawRect(7, dwTop, doorPanelW - 14, dwH);
            g.lineStyle(0);
            g.beginFill(C.C_TRIM);
            g.drawRect(doorPanelW - 11, dwTop + dwH + 6, 4, 20);
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
        this._L.doorTop = doorTop;
        this._L.doorBot = doorBot;

        // HUD
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: 0x0f172a, fontWeight: 'bold'
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = carRight - 10;
        this._speedTxt.y = yWallTop + 15;
        this.scene.addChild(this._speedTxt);

        this.scene.y = 0;
        this.update();
    },

    /* ─── The full-width world the car sits in. Redrawn each frame: cable tray
       above, tunnel (scrolling) or station hall in the middle, ballast + rails +
       scrolling ties, then water/power/sewer infrastructure — exact Underground
       colours/offsets. Visible beside the car ends and through windows/doors. ─── */
    _drawEnv(scroll, isStation, theme, stationCx) {
        const L = this._L, g = this._envG, W = L.W, H = L.H;
        const ext = L.ext, xL = -ext, wF = W + ext * 2, xR = W + ext;
        g.clear();
        // Opaque void backing — gives the semi-transparent tunnel band something to
        // sit on; the top & bottom margins get overpainted by city / earth below so
        // no black bars remain. Drawn wider than the viewport so the track-follow
        // camera (which zooms in on a rider) never exposes an empty edge.
        g.beginFill(this.TUN_VOID);
        g.drawRect(xL, 0, wF, H);
        g.endFill();

        // ── ABOVE GROUND: night sky + scrolling city skyline + street, filling the
        //    whole top margin (0 → cable tray). This is the city the train runs under,
        //    going past as you ride — mirrors the exterior stack above the tunnel. ──
        this._drawCityAbove(scroll, isStation, theme);

        // Cable tray (data/fiber) — Underground.drawCableTray, static
        g.beginFill(this.CABLE_BG);
        g.drawRect(xL, L.yCableTop, wF, L.cableH);
        g.endFill();
        const fibers = 10, fSpace = (L.cableH - 6) / fibers;
        for (let fi = 0; fi < fibers; fi++) {
            g.beginFill(this.CABLE_COLS[fi % this.CABLE_COLS.length], 0.55);
            g.drawRect(xL + 5, L.yCableTop + 3 + fi * fSpace, wF - 10, 2);
            g.endFill();
        }
        let s = 7919;
        const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
        const dots = Math.max(6, Math.floor(wF / 18));
        for (let i = 0; i < dots; i++) {
            g.beginFill(this.CABLE_COLS[Math.floor(rnd() * this.CABLE_COLS.length)], 0.6);
            g.drawCircle(xL + 5 + rnd() * (wF - 10), L.yCableTop + 3 + rnd() * (L.cableH - 6), 1 + rnd() * 1.5);
            g.endFill();
        }

        // Tunnel / station band (yCableBot → yRailTop): seen beside the car and,
        // because the hull has open window/door holes, straight through them.
        const bTop = L.yCableBot, bBot = L.yRailTop, bH = bBot - bTop;
        if (isStation) {
            g.beginFill(0x15151f); g.drawRect(xL, bTop, wF, bH); g.endFill();
            g.lineStyle(1, 0x2a2a3a, 0.5);
            for (let tx = xL; tx < xR; tx += 26) { g.moveTo(tx, bTop + 4); g.lineTo(tx, L.yFloorTop - 4); }
            for (let ty = bTop + 10; ty < L.yFloorTop - 6; ty += 20) { g.moveTo(xL, ty); g.lineTo(xR, ty); }
            g.lineStyle(0);
            g.beginFill(0x1c1c28);
            for (let px = xL + 70; px < xR; px += 260) g.drawRect(px, bTop + 4, 16, L.yFloorTop - bTop - 8);
            g.endFill();
            // Lit sign near the top of the hall
            g.beginFill(0x05050a);
            g.lineStyle(1, theme.col, 0.85);
            g.drawRect(W / 2 - 150, bTop + 14, 300, 22);
            g.lineStyle(0);
            g.endFill();
            g.beginFill(theme.col, 0.4);
            g.drawRect(W / 2 - 140, bTop + 21, 280, 4);
            g.endFill();
            // Platform — top aligned to the car floor so doors open onto it
            const platTop = L.yFloorTop - 2;
            g.beginFill(0x3a3a52); g.drawRect(xL, platTop, wF, bBot - platTop); g.endFill();
            g.beginFill(0xfacc15); g.drawRect(xL, platTop - 2, wF, 2); g.endFill();
            g.beginFill(0xd97706);
            for (let dx = xL; dx < xR; dx += 12) g.drawRect(dx, platTop, 8, 3);
            g.endFill();
            // Real waiting / boarding / alighting people on the platform (no padded
            // fakes) — seen through the windows and the open doors as they board.
            const occ = this._gatherPlatformOccupants(stationCx);
            occ.forEach((o, i) => {
                const sway = Math.sin((this._tick || 0) * 0.05 + i * 1.3) * (o.moving ? 0 : 0.7);
                const px = o.x + (o.moving ? Math.sin((this._tick || 0) * 0.18 + i) * 1.5 : 0);
                g.beginFill(0x1e293b); g.drawRect(px - 5, platTop - 30 + sway, 10, 28); g.endFill();
                g.beginFill(0x334155); g.drawCircle(px, platTop - 33 + sway, 4.5); g.endFill();
                g.beginFill(o.col, 0.9); g.drawRect(px - 4, platTop - 20 + sway, 8, 7); g.endFill();
            });
        } else {
            g.beginFill(0x09090e, 0.7);
            g.drawRect(xL, bTop, wF, bH);
            g.endFill();
            const pPitch = 150, pW = 20;
            const phase = ((scroll * 1.05) % pPitch + pPitch) % pPitch;
            g.beginFill(this.TUN_PILLAR);
            for (let px = xL - phase; px < xR + pPitch; px += pPitch) g.drawRect(px, bTop, pW, bH);
            g.endFill();
            for (let px = xL - phase; px < xR + pPitch; px += pPitch) {
                g.beginFill(this.TUN_LIGHT, 0.3); g.drawCircle(px + pW / 2, bTop + 18, 7); g.endFill();
                g.beginFill(this.TUN_LIGHT);     g.drawCircle(px + pW / 2, bTop + 18, 2); g.endFill();
            }
        }

        // Ballast + twin rails + scrolling ties (the track the car sits on)
        g.beginFill(this.RAIL_BED); g.drawRect(xL, L.yRailTop, wF, L.yRailBot - L.yRailTop); g.endFill();
        g.beginFill(this.RAIL_STEEL);
        g.drawRect(xL, L.yRailTop + 5, wF, 3);
        g.drawRect(xL, L.yRailBot - 7, wF, 3);
        g.endFill();
        const tiePitch = 18, tiePhase = ((scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
        g.beginFill(this.TIE);
        for (let tx = xL - tiePhase; tx < xR + tiePitch; tx += tiePitch) g.drawRect(tx, L.yRailTop + 9, 9, 3);
        g.endFill();

        // Infrastructure — water / power / sewer + junction boxes (exact Underground)
        const iT = L.yInfraTop;
        g.beginFill(this.INFRA_DEEP); g.drawRect(xL, iT, wF, L.yInfraBot - iT); g.endFill();
        g.beginFill(this.INFRA_P1); g.drawRect(xL, iT + 10, wF, 30); g.endFill();
        g.beginFill(this.INFRA_P2); g.drawRect(xL, iT + 15, wF, 20); g.endFill();
        g.beginFill(this.WATER);    g.drawRect(xL, iT + 50, wF, 8); g.endFill();
        g.beginFill(this.WATER_IN); g.drawRect(xL, iT + 52, wF, 4); g.endFill();
        g.beginFill(this.SEWER);    g.drawRect(xL, iT + 65, wF, 12); g.endFill();
        g.beginFill(this.SEWER_IN); g.drawRect(xL, iT + 67, wF, 8); g.endFill();
        const boxPhase = ((scroll) % 200 + 200) % 200;
        for (let bx = xL - boxPhase - 200; bx < xR + 200; bx += 200) {
            g.beginFill(this.JBOX);   g.drawRect(bx, iT + 5, 15, 40); g.endFill();
            g.beginFill(this.JBOX_W); g.drawRect(bx + 50, iT + 48, 10, 12); g.endFill();
            g.beginFill(this.JBOX_S); g.drawRect(bx + 100, iT + 63, 10, 16); g.endFill();
        }

        // ── BELOW: deep earth + rock veins fills to the bottom edge (no black bar) ──
        if (H > L.yInfraBot) this._drawEarthBelow(scroll, L.yInfraBot, H);
    },

    /* Real people on the platform at the station we're stopped at — AI models
       (waiting / boarding / alighting) and worker-NPC commuters routing through
       this station. World-x is mapped into the car's local scale and clamped to
       the view, so a rider you're about to board appears beside the open doors.
       Returns [] when nobody is genuinely here (never padded with fakes). */
    _gatherPlatformOccupants(stationCx) {
        const out = [];
        const L = this._L;
        if (stationCx == null) return out;
        const SCALE = L.carW / 360;            // interior car width ≈ one 360px exterior car
        const toScreen = (wx) => Math.max(24, Math.min(L.W - 24, L.doorCx + (wx - stationCx) * SCALE));
        const hashCol = (id) => {
            let h = 0; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
            return [0x38bdf8, 0xfacc15, 0xf97316, 0x22c55e, 0xa855f7, 0xf43f5e, 0x06b6d4][h % 7];
        };
        if (typeof G !== 'undefined' && G.charRefs && G.models) {
            for (const m of G.models) {
                const r = G.charRefs[m.id];
                if (!r || !r._metroLegs) continue;
                const st = r._metroState;
                if (st !== 'waiting_train' && st !== 'entering' && st !== 'exiting') continue;
                const legX = r._metroLegs[r._currentLeg];
                if (legX == null || Math.abs(legX - stationCx) > 8) continue;
                const wx = (r.c && r.c.x != null) ? r.c.x : legX;
                out.push({ x: toScreen(wx), col: hashCol(m.id), moving: st !== 'waiting_train' });
            }
        }
        if (typeof NPCHousing !== 'undefined' && NPCHousing.commuters) {
            for (const cm of NPCHousing.commuters) {
                if (!cm || !cm.npc) continue;
                const st = cm.state;
                if (st !== 'walk_to_metro' && st !== 'riding_metro' && st !== 'walk_from_metro') continue;
                const entry = cm._metroEntryX != null && Math.abs(cm._metroEntryX - stationCx) < 8;
                const exit  = cm._metroExitX  != null && Math.abs(cm._metroExitX  - stationCx) < 8;
                if (!entry && !exit) continue;
                let wx;
                if (st === 'riding_metro') {           // underground — mill near the centre
                    let h = 0; const id = cm.npc.id; for (let k = 0; k < id.length; k++) h = (h * 31 + id.charCodeAt(k)) >>> 0;
                    wx = stationCx + ((h % 200) - 100);
                } else {
                    wx = (cm.c && cm.c.x != null) ? cm.c.x : stationCx;
                }
                let col = cm.npc.color;
                if (typeof col === 'string') col = parseInt(col.replace('#', ''), 16);
                if (typeof col !== 'number') col = 0x94a3b8;
                out.push({ x: toScreen(wx), col, moving: st !== 'riding_metro' });
            }
        }
        return out;
    },

    /* ─── Deterministic per-column PRNG (mulberry32) — a given column index always
       yields the same building/earth, so the world stays stable while it scrolls. ─── */
    _colRng(seed) {
        let a = ((seed | 0) ^ 0x9e3779b9) >>> 0;
        return () => {
            a = (a + 0x6d2b79f5) | 0;
            let t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    },

    /* ─── The above-ground city: night sky, a far parallax skyline, near warm-lit
       towers, and the street they stand on — the world directly over the tunnel.
       Everything scrolls opposite travel (slower the higher / farther it is). ─── */
    _drawCityAbove(scroll, isStation, theme) {
        const L = this._L, g = this._envG, W = L.W, ext = L.ext, xL = -ext, wF = W + ext * 2, xR = W + ext;
        const yStreet = L.yCableTop - L.streetH;     // street surface line
        const skyBot  = yStreet;
        if (skyBot <= 2) return;                      // no room (tiny viewport)

        // Sky gradient (deep navy → warmer near the rooftops)
        g.beginFill(this.CITY_SKY_TOP); g.drawRect(xL, 0, wF, skyBot); g.endFill();
        g.beginFill(this.CITY_SKY_MID, 0.7); g.drawRect(xL, skyBot * 0.42, wF, skyBot * 0.58); g.endFill();
        g.beginFill(this.CITY_HORIZON, 0.45); g.drawRect(xL, skyBot - 46, wF, 46); g.endFill();

        // Stars (slow parallax, only in the upper sky)
        const starShift = scroll * 0.15, sPitch = 46, starTop = skyBot * 0.55;
        let sc0 = Math.floor((starShift + xL) / sPitch) - 1;
        for (let ci = sc0; ci * sPitch - starShift < xR; ci++) {
            const r = this._colRng(ci ^ 0x51a7);
            if (r() > 0.5) continue;
            const sx = Math.round(ci * sPitch - starShift + r() * sPitch);
            const sy = 4 + r() * Math.max(4, starTop);
            g.beginFill(0xfff8e0, 0.25 + r() * 0.4); g.drawRect(sx, sy, 1 + (r() > 0.85 ? 1 : 0), 1); g.endFill();
        }

        // Far skyline (cool, dim, half-speed) then near towers (warm, full-ish speed)
        this._skylineLayer(scroll * 0.5, skyBot, {
            salt: 0x1f1, pitch: 84, gap: 8, gapVar: 16,
            minH: skyBot * 0.30, maxH: skyBot * 0.66, bodies: this.FAR_BODIES, roof: 0x3a3550,
            winPitchX: 12, winPitchY: 15, winW: 4, winH: 5, litProb: 0.30,
            winA: 0.5, warm: false
        });
        this._skylineLayer(scroll * 0.9, skyBot, {
            salt: 0x9c4, pitch: 132, gap: 16, gapVar: 30,
            minH: skyBot * 0.46, maxH: skyBot * 0.96, bodies: this.NEAR_BODIES, roof: this.NEAR_ROOF,
            winPitchX: 15, winPitchY: 17, winW: 7, winH: 9, litProb: 0.62,
            winA: 0.95, warm: true
        });

        // Street the towers stand on — asphalt + dashed centre line + curb
        g.beginFill(this.CITY_STREET); g.drawRect(xL, yStreet, wF, L.streetH); g.endFill();
        g.beginFill(this.CITY_ASPHALT); g.drawRect(xL, yStreet + 5, wF, L.streetH - 5); g.endFill();
        g.beginFill(0x2a2a36); g.drawRect(xL, yStreet, wF, 2); g.endFill();   // curb highlight
        const laneShift = ((scroll * 0.9) % 34 + 34) % 34, laneY = yStreet + L.streetH * 0.55;
        g.beginFill(this.CITY_LANE, 0.7);
        for (let lx = xL - laneShift; lx < xR; lx += 34) g.drawRect(lx, laneY, 18, 2);
        g.endFill();
    },

    /* One horizontal band of buildings, deterministically tiled so it scrolls without
       flicker. `worldShift` = how far the world has slid (scroll × parallax rate). */
    _skylineLayer(worldShift, baseY, o) {
        const g = this._envG, W = this._L.W, ext = this._L.ext, xL = -ext, xR = W + ext;
        const pitch = o.pitch;
        let ci = Math.floor((worldShift + xL) / pitch) - 1;
        for (; ; ci++) {
            const x = Math.round(ci * pitch - worldShift);
            if (x > xR) break;
            const r = this._colRng(ci ^ o.salt);
            const bw = pitch - o.gap - Math.floor(r() * o.gapVar);
            const bh = Math.round(o.minH + r() * (o.maxH - o.minH));
            const top = baseY - bh;
            g.beginFill(o.bodies[Math.floor(r() * o.bodies.length)]);
            g.drawRect(x, top, bw, bh);
            g.endFill();
            g.beginFill(o.roof, 0.5); g.drawRect(x, top, bw, 3); g.endFill();
            // Lit window grid (only lit cells drawn — unlit read as the facade itself)
            const cols = Math.max(1, Math.floor((bw - 6) / o.winPitchX));
            const rows = Math.max(1, Math.floor((bh - 8) / o.winPitchY));
            for (let cx = 0; cx < cols; cx++) {
                for (let cy = 0; cy < rows; cy++) {
                    if (r() > o.litProb) continue;
                    const wx = x + 4 + cx * o.winPitchX;
                    const wy = top + 5 + cy * o.winPitchY;
                    const col = o.warm ? (r() > 0.5 ? this.WIN_WARM : this.WIN_WARM2) : this.WIN_COOL;
                    g.beginFill(col, o.winA); g.drawRect(wx, wy, o.winW, o.winH); g.endFill();
                }
            }
        }
    },

    /* Deep earth below the pipes — zone-tinted base + scattered rock + gold/rust veins
       (exact Underground.drawDeepEarth look), tiled so it scrolls with the track. */
    _drawEarthBelow(scroll, yTop, yBot) {
        const g = this._envG, W = this._L.W, ext = this._L.ext, xL = -ext, wF = W + ext * 2, xR = W + ext;
        g.beginFill(this.EARTH_BASE); g.drawRect(xL, yTop, wF, yBot - yTop); g.endFill();
        const shift = scroll * 1.1, pitch = 14;
        let ci = Math.floor((shift + xL) / pitch) - 1;
        for (; ; ci++) {
            const x = ci * pitch - shift;
            if (x > xR) break;
            const r = this._colRng(ci ^ 0x5151);
            for (let ry = yTop + 4; ry < yBot; ry += 14) {
                if (r() > 0.4) {
                    g.beginFill(r() > 0.5 ? this.EARTH_A : this.EARTH_B, 0.8);
                    g.drawRect(x + r() * 9, ry + r() * 7, 2 + r() * 4, 2 + r() * 3);
                    g.endFill();
                }
                if (r() > 0.95) {
                    g.beginFill(r() > 0.5 ? this.EARTH_VEIN_R : this.EARTH_VEIN_G, 0.55);
                    g.drawRect(x + r() * 9, ry + r() * 9, 1 + r() * 2, 1);
                    g.endFill();
                }
            }
        }
    },

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

    _refreshPassengers(train) {
        const L = this._L;
        if (!this._passengersCont) return;
        const riders = this._gatherRiders(train);
        this._totalPax = riders.length;
        const VIS_CAP = 16;
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
        if (this.avatarPool) this.avatarPool.clear();

        const canMake = typeof InteriorMetroStation !== 'undefined' && typeof InteriorMetroStation._makeAvatarSprite === 'function';
        if (shown.length === 0 || !canMake) return;

        const doorCx = L.doorCx, doorHalf = L.doorHalf + 16;
        const inDoor = (px) => px > doorCx - doorHalf && px < doorCx + doorHalf;

        const back = [], front = [];
        shown.forEach((r, i) => (i % 2 === 0 ? front : back).push(r));
        const a = L.innerLeft + 20, b = L.innerRight - 20, span = b - a;
        const slotsFor = (arr, py, sc, dim) => {
            const n = arr.length;
            return arr.map((m, i) => {
                let px = a + (n === 1 ? span / 2 : (i / (n - 1)) * span);
                if (inDoor(px)) px += (px < doorCx ? -1 : 1) * doorHalf;
                px = Math.max(a, Math.min(b, px));
                return { m, px, py, sc, dim };
            });
        };
        const backRow  = slotsFor(back,  L.yFloorTop - 12, 1.45, true);
        const frontRow = slotsFor(front, L.yFloorTop - 1,  1.8,  false);
        backRow.concat(frontRow).forEach((slot, idx) => {
            const m = slot.m; if (!m) return;
            let av;
            try { av = InteriorMetroStation._makeAvatarSprite(m); } catch (e) { av = null; }
            if (!av || !av.cont) return;
            av.cont.x = slot.px;
            av.cont.y = slot.py;
            av.cont.scale.set(slot.sc * (av.cont.scale.x || 1));
            if (slot.dim) av.cont.alpha = (av.cont.alpha || 1) * 0.85;
            this._passengersCont.addChild(av.cont);
            this._paxAvatars.push({ cont: av.cont, baseX: slot.px, baseY: slot.py, idx, m });
            // Register for track-follow (Interior._findTrackedAvatar reads avatarPool).
            if (this.avatarPool) this.avatarPool.set(m.id, { cont: av.cont, m });
        });
    },

    _animatePassengers() {
        if (!this._paxAvatars) return;
        const t = this._tick || 0;
        this._paxAvatars.forEach(a => {
            if (!a.cont || a.cont.destroyed) return;
            a.cont.x = a.baseX + Math.sin(t * 0.07 + a.idx * 0.8) * 1.2;
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
        this._scroll += dx;                                  // scenery moves opposite travel

        const isWaiting = t.state === 'waiting';
        const atStation = this._stationAt(t.x);
        const nextStationId = this._stationAt(t.targetX);
        const stationLabel = atStation ? this.STATION_LABELS[atStation] : null;
        const nextLabel = nextStationId ? this.STATION_LABELS[nextStationId] : null;
        const showStation = !!(isWaiting && stationLabel);
        const stationBld = atStation && G.bldById ? G.bldById[atStation] : null;
        const stationCx = stationBld ? stationBld.x + stationBld.w / 2 : null;

        // Only over-draw the world wider than the viewport while the track-follow
        // camera is actually zoomed in on a rider (or easing back out) — otherwise
        // the scene sits at scale 1 and [0,W] is all that's visible, so we skip the
        // extra ~half-screen of skyline/earth each frame and keep the framerate up.
        const tracked = G.tracking && this.avatarPool && this.avatarPool.has(G.tracking.id);
        const easing = this.scene && this.scene._cameraEngaged;
        L.ext = (tracked || easing) ? Math.round(L.W * 0.55) : 0;

        this._drawEnv(this._scroll, showStation, L.theme, showStation ? stationCx : null);

        // Head / tail lights — exterior convention (dir>0 → left red, right green)
        let dir = t.dir || Math.sign((t.targetX || 0) - t.x) || 1;
        const aCol = dir > 0 ? 0xef4444 : 0x4ade80;
        const bCol = dir > 0 ? 0x4ade80 : 0xef4444;
        if (this._lightA) { this._lightA.clear(); this._lightA.beginFill(aCol); this._lightA.drawCircle(0, 0, 5); this._lightA.endFill(); }
        if (this._lightB) { this._lightB.clear(); this._lightB.beginFill(bCol); this._lightB.drawCircle(0, 0, 5); this._lightB.endFill(); }

        // Doors
        const doorTarget = showStation ? 1 : 0;
        this._doorOpen += (doorTarget - this._doorOpen) * 0.12;
        const openPx = this._doorOpen * (L.doorPanelW - 4);
        if (this._doorL) this._doorL.x = (L.doorCx - L.doorPanelW) - openPx;
        if (this._doorR) this._doorR.x = (L.doorCx + L.doorPanelW) + openPx;

        if (this._destTxt) {
            if (showStation) this._destTxt.text = stationLabel;
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
                this._strapsG.lineTo(sx + swing, L.strapTopY + 22);
                this._strapsG.lineStyle(0);
                this._strapsG.beginFill(this.C_ROOF);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 26, 4);
                this._strapsG.endFill();
                this._strapsG.beginFill(this.C_GLASS);
                this._strapsG.drawCircle(sx + swing, L.strapTopY + 26, 2);
                this._strapsG.endFill();
            });
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
        this._envG = null;
        if (this._paxAvatars) {
            this._paxAvatars.forEach(a => { if (a.cont && !a.cont.destroyed) a.cont.destroy({ children: true }); });
        }
        this._paxAvatars = null;
        this._paxSig = null;
        this._visiblePax = 0;
        this._totalPax = 0;
        if (this.avatarPool) this.avatarPool.clear();
        this.avatarPool = null;
        this._passengersCont = null;
        this._doorL = null;
        this._doorR = null;
        this._lightA = null;
        this._lightB = null;
        this._destTxt = null;
        this._speedTxt = null;
        this._strapsG = null;
        this._L = null;
        this._lastTrainX = null;
        this._scroll = 0;
        this._doorOpen = 0;
        this._tick = 0;
    }
};
