/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   METRO TRAIN INTERIOR (v1.0.0)
   Cutaway side-view of a moving metro car. Reuses the exterior train palette so the inside
   never visually drifts from the outside. The view tracks the underlying train object in
   Entities[key] in real time — at-station vs. between-stations, speed, direction, passenger count.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorTrain = {
    scene: null,
    layer: null,
    bld: null,
    _trainKey: null,
    isDragging: false,
    _tunnelLayer: null,
    _tunnelG: null,
    _stationLayer: null,
    _stationG: null,
    _passengersG: null,
    _doorL: null,
    _doorR: null,
    _doorOpen: 0,
    _lastTrainX: null,
    _scroll: 0,
    _destTxt: null,
    _speedTxt: null,
    _bobBase: 0,

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
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const theme = this.THEMES[this._trainKey] || { col: 0x22d3ee, line: 'METRO TRAIN' };

        this.scene = new PIXI.Container();
        layer.addChild(this.scene);

        // ─── Layout bands (full viewport, no scroll) ──────────────────────────
        const wallTop    = 0;
        const ceilingH   = 56;          // ceiling + light strip
        const winTop     = wallTop + ceilingH;
        const winH       = Math.max(190, H * 0.32);
        const winBottom  = winTop + winH;
        const seatTop    = winBottom + 8;
        const floorY     = H - 110;
        const undersideY = floorY + 6;

        // ─── BACKDROP TUNNEL (sits behind windows; scrolls with train.x) ─────
        this._tunnelLayer = new PIXI.Container();
        this._tunnelLayer.x = 0;
        this._tunnelLayer.y = winTop;
        this.scene.addChild(this._tunnelLayer);
        // Solid void behind the window strip
        const voidBg = new PIXI.Graphics();
        voidBg.beginFill(0x050508);
        voidBg.drawRect(0, 0, W, winH);
        voidBg.endFill();
        this._tunnelLayer.addChild(voidBg);
        this._tunnelG = new PIXI.Graphics();
        this._tunnelLayer.addChild(this._tunnelG);
        this._stationG = new PIXI.Graphics();
        this._stationG.alpha = 0;
        this._tunnelLayer.addChild(this._stationG);

        // ─── CEILING (interior of train roof) ────────────────────────────────
        const ceiling = new PIXI.Graphics();
        // Outer hull (matches exterior body 0x1e293b)
        ceiling.beginFill(0x1e293b);
        ceiling.drawRect(0, wallTop, W, ceilingH);
        ceiling.endFill();
        // Curved roof inner panel (lighter, mirrors exterior front 0xcbd5e1 top)
        ceiling.beginFill(0xcbd5e1);
        ceiling.drawRoundedRect(8, wallTop + 4, W - 16, ceilingH - 8, 14);
        ceiling.endFill();
        // Inner panel highlight
        ceiling.beginFill(0xe0f2fe, 0.6);
        ceiling.drawRect(20, wallTop + 8, W - 40, 3);
        ceiling.endFill();
        // Ceiling LED strip
        ceiling.beginFill(0xfef9c3);
        for (let lx = 24; lx < W - 24; lx += 56) {
            ceiling.drawRoundedRect(lx, wallTop + ceilingH - 16, 38, 5, 2);
        }
        ceiling.endFill();
        ceiling.beginFill(0xfde68a, 0.35);
        for (let lx = 24; lx < W - 24; lx += 56) {
            ceiling.drawRect(lx - 6, wallTop + ceilingH - 11, 50, 8);
        }
        ceiling.endFill();
        // Grab-handle hooks dangling
        ceiling.beginFill(0x64748b);
        for (let hx = 50; hx < W - 30; hx += 110) {
            ceiling.drawRect(hx, wallTop + ceilingH - 4, 2, 14);
            ceiling.drawEllipse(hx + 1, wallTop + ceilingH + 12, 5, 3);
        }
        ceiling.endFill();
        // Destination LED display (centered)
        const destBg = new PIXI.Graphics();
        destBg.beginFill(0x05050a);
        destBg.lineStyle(1, theme.col, 0.8);
        destBg.drawRoundedRect(W / 2 - 130, wallTop + 6, 260, 22, 4);
        destBg.endFill();
        destBg.lineStyle(0);
        ceiling.addChild(destBg);
        this._destTxt = new PIXI.Text('— — —', {
            fontFamily: 'Silkscreen, monospace', fontSize: 10, fill: theme.col,
            dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 4, dropShadowDistance: 0
        });
        this._destTxt.anchor.set(0.5, 0.5);
        this._destTxt.x = W / 2;
        this._destTxt.y = wallTop + 17;
        ceiling.addChild(this._destTxt);
        this.scene.addChild(ceiling);

        // Line subtitle
        const lineTxt = new PIXI.Text(theme.line, {
            fontFamily: 'Press Start 2P, monospace', fontSize: 7,
            fill: theme.col, letterSpacing: 2
        });
        lineTxt.anchor.set(0.5, 0);
        lineTxt.x = W / 2;
        lineTxt.y = wallTop + ceilingH + 2;
        this.scene.addChild(lineTxt);

        // ─── WINDOW STRIP + MULLIONS ─────────────────────────────────────────
        // Window frame mask is implicit: window cutout is everything in winTop..winBottom
        // We draw mullions (vertical dividers) and a header/footer trim band.
        const winFrame = new PIXI.Graphics();
        // Header — silver band above window (mirrors exterior 0x94a3b8 lower band)
        winFrame.beginFill(0x94a3b8);
        winFrame.drawRect(0, winTop - 4, W, 4);
        winFrame.endFill();
        // Cyan accent stripe (mirrors exterior 0x0ea5e9 highlight)
        winFrame.beginFill(0x0ea5e9);
        winFrame.drawRect(0, winTop - 1, W, 1);
        winFrame.endFill();
        // Vertical mullions (window dividers). Window is 20px wide, gap ~80px (mirrors exterior 100px pitch).
        const winPitch = 110;
        const mullionW = 18;
        winFrame.beginFill(0x1e293b);
        for (let mx = -(mullionW / 2); mx < W + mullionW; mx += winPitch) {
            winFrame.drawRect(mx, winTop, mullionW, winH);
        }
        winFrame.endFill();
        // Mullion highlight
        winFrame.beginFill(0x64748b, 0.7);
        for (let mx = -(mullionW / 2); mx < W + mullionW; mx += winPitch) {
            winFrame.drawRect(mx + 2, winTop + 4, 2, winH - 8);
        }
        winFrame.endFill();
        // Footer — silver sill below windows
        winFrame.beginFill(0x94a3b8);
        winFrame.drawRect(0, winBottom, W, 5);
        winFrame.endFill();
        winFrame.beginFill(0x0284c7);
        winFrame.drawRect(0, winBottom + 5, W, 3);
        winFrame.endFill();
        // Glass reflection sheen across all windows
        winFrame.beginFill(0xe0f2fe, 0.08);
        winFrame.drawRect(0, winTop + 4, W, 18);
        winFrame.endFill();
        this.scene.addChild(winFrame);

        // ─── SEAT BAND (between window sill and floor) ───────────────────────
        const seats = new PIXI.Graphics();
        // Wall behind seats — dark navy interior panel (mirrors exterior 0x0f172a)
        seats.beginFill(0x0f172a);
        seats.drawRect(0, seatTop, W, floorY - seatTop);
        seats.endFill();
        // Wall scuff highlight
        seats.beginFill(0x1e293b, 0.6);
        seats.drawRect(0, seatTop, W, 6);
        seats.endFill();
        // Long bench cushion running edge to edge
        const benchTop = floorY - 26;
        seats.beginFill(0x1e293b);
        seats.drawRoundedRect(8, benchTop, W - 16, 22, 4);
        seats.endFill();
        seats.beginFill(theme.col, 0.55);
        seats.drawRect(8, benchTop + 2, W - 16, 4);
        seats.endFill();
        // Bench legs / brackets every 110px
        seats.beginFill(0x334155);
        for (let bx = 20; bx < W - 20; bx += 110) {
            seats.drawRect(bx, benchTop + 22, 6, 4);
        }
        seats.endFill();
        // Priority-seat icons embedded in the bench colour stripe
        seats.beginFill(0x0a0a12, 0.6);
        for (let ix = 24; ix < W - 24; ix += 220) {
            seats.drawCircle(ix, benchTop + 4, 2);
        }
        seats.endFill();
        this.scene.addChild(seats);

        // Passenger graphics (silhouettes redrawn each frame)
        this._passengersG = new PIXI.Graphics();
        this._passengersG.x = 0;
        this._passengersG.y = 0;
        this.scene.addChild(this._passengersG);
        this._seatBaseY = benchTop;

        // ─── FLOOR + SAFETY STRIPE ───────────────────────────────────────────
        const floor = new PIXI.Graphics();
        floor.beginFill(0x334155);
        floor.drawRect(0, floorY, W, 14);
        floor.endFill();
        // Anti-slip dots
        floor.beginFill(0x475569);
        for (let fx = 6; fx < W - 6; fx += 14) {
            floor.drawCircle(fx, floorY + 4, 1.2);
            floor.drawCircle(fx + 7, floorY + 10, 1.2);
        }
        floor.endFill();
        // Yellow safety stripe at edge
        floor.beginFill(0xfacc15, 0.85);
        floor.drawRect(0, floorY + 12, W, 2);
        floor.endFill();
        this.scene.addChild(floor);

        // ─── UNDERSIDE / BOGEY (visible below the cutaway floor) ─────────────
        const underside = new PIXI.Graphics();
        underside.beginFill(0x1e293b);
        underside.drawRect(0, undersideY + 8, W, H - undersideY - 8);
        underside.endFill();
        // Rail
        underside.beginFill(0x4a4a5a);
        underside.drawRect(0, H - 38, W, 3);
        underside.drawRect(0, H - 30, W, 3);
        underside.endFill();
        // Ties — these will translate via _bogeyTies graphics for scrolling
        underside.beginFill(0xd97706);
        for (let tx = 0; tx < W; tx += 16) {
            underside.drawRect(tx, H - 33, 8, 4);
        }
        underside.endFill();
        // Bogey trucks (two wheel pairs)
        const bogeyOffsets = [W * 0.25, W * 0.75];
        underside.beginFill(0x111115);
        bogeyOffsets.forEach(bx => {
            underside.drawRoundedRect(bx - 50, H - 60, 100, 18, 4);
        });
        underside.endFill();
        underside.beginFill(0x0f172a);
        bogeyOffsets.forEach(bx => {
            underside.drawCircle(bx - 30, H - 42, 11);
            underside.drawCircle(bx + 30, H - 42, 11);
        });
        underside.endFill();
        underside.beginFill(0x475569);
        bogeyOffsets.forEach(bx => {
            underside.drawCircle(bx - 30, H - 42, 5);
            underside.drawCircle(bx + 30, H - 42, 5);
        });
        underside.endFill();
        this._wheelGfx = new PIXI.Graphics();
        this._wheelCenters = [];
        bogeyOffsets.forEach(bx => {
            this._wheelCenters.push({ x: bx - 30, y: H - 42 });
            this._wheelCenters.push({ x: bx + 30, y: H - 42 });
        });
        this.scene.addChild(underside);
        this.scene.addChild(this._wheelGfx);

        // ─── SLIDING DOORS (open at stations) ────────────────────────────────
        // Door pair sits at viewport center, spanning from sill to floor.
        const doorTop = winBottom + 2;
        const doorBot = floorY;
        const doorH = doorBot - doorTop;
        const doorW = 64;
        const doorCx = W / 2;
        // Door frame
        const doorFrame = new PIXI.Graphics();
        doorFrame.beginFill(0x05050a);
        doorFrame.drawRect(doorCx - doorW / 2 - 4, doorTop - 2, doorW + 8, doorH + 4);
        doorFrame.endFill();
        doorFrame.lineStyle(2, theme.col, 0.55);
        doorFrame.drawRect(doorCx - doorW / 2 - 4, doorTop - 2, doorW + 8, doorH + 4);
        doorFrame.lineStyle(0);
        this.scene.addChild(doorFrame);
        // Left & right sliding panels
        const makePanel = () => {
            const g = new PIXI.Graphics();
            g.beginFill(0x1e293b);
            g.drawRect(0, 0, doorW / 2, doorH);
            g.endFill();
            // Window in the door
            g.beginFill(0x0f172a);
            g.drawRect(4, 8, doorW / 2 - 8, doorH * 0.45);
            g.endFill();
            g.beginFill(0xe0f2fe, 0.12);
            g.drawRect(4, 8, doorW / 2 - 8, 6);
            g.endFill();
            // Handle bar
            g.beginFill(0x94a3b8);
            g.drawRect(doorW / 2 - 6, doorH * 0.6, 3, 22);
            g.endFill();
            return g;
        };
        this._doorL = makePanel();
        this._doorL.x = doorCx - doorW / 2;
        this._doorL.y = doorTop;
        this._doorR = makePanel();
        this._doorR.scale.x = -1;
        this._doorR.x = doorCx + doorW / 2;
        this._doorR.y = doorTop;
        this.scene.addChild(this._doorL);
        this.scene.addChild(this._doorR);

        // ─── HEADER OVERLAY (load gauge + speed pill) ────────────────────────
        const hudY = winTop + winH - 24;
        this._speedTxt = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: 0xfef9c3
        });
        this._speedTxt.anchor.set(1, 0);
        this._speedTxt.x = W - 12;
        this._speedTxt.y = hudY;
        this.scene.addChild(this._speedTxt);

        // No scroll — fits viewport.
        this.scene.y = 0;
        this._bobBase = this.scene.y;

        // Pre-render once
        this._lastTrainX = null;
        this._scroll = 0;
        this.update();
    },

    /* ─── Tunnel content that scrolls past the windows ─── */
    _drawTunnelStrip(g, scroll, winH, W) {
        g.clear();
        // Deep void already drawn by voidBg; we add scrolling features.
        // Cable bundles at top of tunnel
        g.beginFill(0x222831);
        g.drawRect(0, 4, W, 10);
        g.endFill();
        const cableCols = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6];
        cableCols.forEach((c, i) => {
            g.beginFill(c, 0.7);
            g.drawRect(0, 5 + i, W, 1);
            g.endFill();
        });
        // Junction dots scrolling
        const dotPitch = 60;
        const dotPhase = ((scroll * 0.6) % dotPitch + dotPitch) % dotPitch;
        for (let dx = -dotPhase; dx < W + dotPitch; dx += dotPitch) {
            g.beginFill(0xfacc15, 0.9);
            g.drawCircle(dx, 10, 1.6);
            g.endFill();
        }
        // Tunnel wall rough texture (faster parallax)
        const wallY = 22;
        const wallH = winH - 50;
        g.beginFill(0x111115);
        g.drawRect(0, wallY, W, wallH);
        g.endFill();
        // Concrete blocks scrolling
        const blockW = 80;
        const blockPhase = ((scroll) % blockW + blockW) % blockW;
        g.lineStyle(1, 0x1e293b, 0.85);
        for (let bx = -blockPhase; bx < W + blockW; bx += blockW) {
            for (let by = wallY + 12; by < wallY + wallH - 8; by += 28) {
                g.moveTo(bx, by);
                g.lineTo(bx + blockW, by);
            }
            g.moveTo(bx, wallY);
            g.lineTo(bx, wallY + wallH);
        }
        g.lineStyle(0);
        // Random graffiti / vent slats scrolling
        const ventPitch = 320;
        const ventPhase = ((scroll * 0.9) % ventPitch + ventPitch) % ventPitch;
        for (let vx = -ventPhase; vx < W + ventPitch; vx += ventPitch) {
            g.beginFill(0x334155);
            g.drawRect(vx, wallY + 30, 60, 24);
            g.endFill();
            g.beginFill(0x05050a);
            for (let sy = 0; sy < 5; sy++) {
                g.drawRect(vx + 4, wallY + 34 + sy * 4, 52, 2);
            }
            g.endFill();
        }
        // Red warning lights scrolling faster (closer-to-camera)
        const lightPitch = 180;
        const lightPhase = ((scroll * 1.4) % lightPitch + lightPitch) % lightPitch;
        for (let lx = -lightPhase; lx < W + lightPitch; lx += lightPitch) {
            g.beginFill(0xef4444);
            g.drawCircle(lx, wallY + 8, 2.4);
            g.endFill();
            g.beginFill(0xfca5a5, 0.35);
            g.drawCircle(lx, wallY + 8, 6);
            g.endFill();
        }
        // Pillars (the structural columns from the exterior tunnel)
        const pillarPitch = 240;
        const pillarPhase = ((scroll * 1.05) % pillarPitch + pillarPitch) % pillarPitch;
        g.beginFill(0x05050a);
        for (let px = -pillarPhase; px < W + pillarPitch; px += pillarPitch) {
            g.drawRect(px, 14, 16, winH - 28);
        }
        g.endFill();
        // Tunnel floor / rails at the bottom of the window strip
        const floorY = winH - 26;
        g.beginFill(0x1a1a24);
        g.drawRect(0, floorY, W, 26);
        g.endFill();
        g.beginFill(0x4a4a5a);
        g.drawRect(0, floorY + 6, W, 2);
        g.drawRect(0, floorY + 14, W, 2);
        g.endFill();
        // Wooden ties scrolling
        const tiePitch = 18;
        const tiePhase = ((scroll * 1.2) % tiePitch + tiePitch) % tiePitch;
        g.beginFill(0xd97706);
        for (let tx = -tiePhase; tx < W + tiePitch; tx += tiePitch) {
            g.drawRect(tx, floorY + 9, 9, 5);
        }
        g.endFill();
    },

    /* ─── Station view shown through windows when train is waiting ─── */
    _drawStationView(g, theme, label, winH, W) {
        g.clear();
        // Platform back wall (lighter than tunnel — tiled cyan-tinged)
        g.beginFill(0x0a0a12);
        g.drawRect(0, 0, W, winH);
        g.endFill();
        // Tile grid across back wall
        g.lineStyle(1, 0x1e1e2f, 0.55);
        for (let tx = 0; tx < W; tx += 24) {
            g.moveTo(tx, 6);
            g.lineTo(tx, winH - 30);
        }
        g.lineStyle(0);
        // Neon station sign (centered)
        const signY = 18;
        g.beginFill(0x05050a);
        g.lineStyle(1, theme.col, 0.7);
        g.drawRect(W / 2 - 110, signY, 220, 22);
        g.lineStyle(0);
        g.endFill();
        // Platform edge / yellow stripe
        const platY = winH - 30;
        g.beginFill(0x2a2a3e);
        g.drawRect(0, platY, W, 18);
        g.endFill();
        g.beginFill(0xfacc15);
        g.drawRect(0, platY - 2, W, 2);
        g.endFill();
        g.beginFill(0xd97706);
        for (let dx = 0; dx < W; dx += 12) g.drawRect(dx, platY, 8, 3);
        g.endFill();
        // Pillars on platform
        g.beginFill(0x11111a);
        for (let px = 60; px < W; px += 220) g.drawRect(px, 4, 14, winH - 30);
        g.endFill();
        // Silhouette commuters waiting on platform
        const r = ((this._lastTrainX | 0) + 7919) >>> 0;
        const rng = (() => { let s = r || 1; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
        const peopleCount = 8 + Math.floor(rng() * 10);
        for (let i = 0; i < peopleCount; i++) {
            const pxp = 30 + rng() * (W - 60);
            const sway = Math.sin((this._tick || 0) * 0.04 + i) * 0.6;
            g.beginFill(0x0f172a);
            g.drawRect(pxp - 5, platY - 28 + sway, 10, 24);
            g.endFill();
            g.beginFill(0x1e293b);
            g.drawCircle(pxp, platY - 30 + sway, 4);
            g.endFill();
            // tiny phone glow on some
            if (rng() > 0.65) {
                g.beginFill(0x38bdf8, 0.7);
                g.drawRect(pxp - 1, platY - 18 + sway, 2, 3);
                g.endFill();
            }
        }
        // Station label on the sign
        // Rendered separately via _stationLabelTxt so emoji/glyph render cleanly.
        if (this._stationLabelTxt && !this._stationLabelTxt.destroyed) {
            this._stationLabelTxt.text = label || '— STATION —';
            this._stationLabelTxt.x = W / 2;
            this._stationLabelTxt.y = signY + 11;
            this._stationLabelTxt.visible = true;
        }
    },

    /* ─── Passenger silhouettes inside the car — count mirrors Entities[key].passengers. ─── */
    _drawPassengers(g, count, theme, W) {
        g.clear();
        if (!count || count <= 0) return;
        const seatedCap = Math.min(count, 16);
        const standCap  = Math.max(0, Math.min(count - seatedCap, 14));
        const benchY = this._seatBaseY;
        const skinTones = [0xfcd5b4, 0xe0a899, 0xc69076, 0x8d5524, 0xf5c8a7];
        const shirtCols = [0x0ea5e9, 0xef4444, 0x22c55e, 0xfacc15, 0xa855f7, 0xf97316, 0x06b6d4];
        // Seated — distributed evenly along the bench, alternating posture
        const seatPitch = (W - 40) / Math.max(seatedCap, 1);
        for (let i = 0; i < seatedCap; i++) {
            const px = 20 + (i + 0.5) * seatPitch;
            const py = benchY - 22;
            const sk = skinTones[(i + (this._trainKey ? this._trainKey.charCodeAt(5) : 0)) % skinTones.length];
            const sh = shirtCols[(i * 3 + (this._trainKey ? this._trainKey.charCodeAt(0) : 0)) % shirtCols.length];
            // body
            g.beginFill(sh);
            g.drawRoundedRect(px - 7, py, 14, 20, 3);
            g.endFill();
            // head
            g.beginFill(sk);
            g.drawCircle(px, py - 4, 5);
            g.endFill();
            // legs/feet — split posture
            g.beginFill(0x1e293b);
            g.drawRect(px - 6, py + 18, 4, 6);
            g.drawRect(px + 2, py + 18, 4, 6);
            g.endFill();
            // hint of a phone for ~half of riders
            if ((i * 7 + 3) % 3 === 0) {
                g.beginFill(0x38bdf8, 0.9);
                g.drawRect(px - 2, py + 6, 4, 5);
                g.endFill();
            }
        }
        // Standing — clustered, hands raised toward the grab handles
        if (standCap > 0) {
            const standPitch = (W - 80) / Math.max(standCap, 1);
            for (let j = 0; j < standCap; j++) {
                const px = 40 + (j + 0.5) * standPitch;
                const py = benchY - 56;
                const sk = skinTones[(j + 2) % skinTones.length];
                const sh = shirtCols[(j * 5 + 1) % shirtCols.length];
                // sway
                const sway = Math.sin((this._tick || 0) * 0.07 + j * 0.8) * 1.2;
                g.beginFill(sh);
                g.drawRoundedRect(px - 6 + sway, py, 12, 28, 3);
                g.endFill();
                g.beginFill(sk);
                g.drawCircle(px + sway, py - 4, 5);
                g.endFill();
                // raised arm to grab handle
                g.beginFill(sh);
                g.drawRect(px + 4 + sway, py - 8, 3, 14);
                g.endFill();
                g.beginFill(sk);
                g.drawCircle(px + 5 + sway, py - 10, 2.2);
                g.endFill();
                // legs
                g.beginFill(0x1e293b);
                g.drawRect(px - 5 + sway, py + 26, 4, 8);
                g.drawRect(px + 1 + sway, py + 26, 4, 8);
                g.endFill();
            }
        }
    },

    update() {
        if (!this.scene || !this.bld) return;
        const t = (typeof Entities !== 'undefined') ? Entities[this._trainKey] : null;
        const W = G.vpW;
        const theme = this.THEMES[this._trainKey] || { col: 0x22d3ee, line: 'METRO TRAIN' };
        this._tick = (this._tick || 0) + 1;

        if (!t) {
            if (this._destTxt) this._destTxt.text = '— OUT OF SERVICE —';
            return;
        }

        // ─── Compute scroll delta from real train motion ──────────────────
        if (this._lastTrainX == null) this._lastTrainX = t.x;
        const dx = t.x - this._lastTrainX;
        this._lastTrainX = t.x;
        // Scroll opposite to train direction so scenery moves the right way.
        this._scroll -= dx;

        // ─── State-driven visuals ─────────────────────────────────────────
        const isWaiting = t.state === 'waiting';
        const atStation = this._stationAt(t.x);
        const nextStationId = this._stationAt(t.targetX);
        const stationLabel = atStation ? this.STATION_LABELS[atStation] : null;
        const nextLabel = nextStationId ? this.STATION_LABELS[nextStationId] : null;

        // Tunnel always drawn — at-station it fades behind the station view.
        const winH = this._tunnelLayer.height || (this._tunnelLayer.getBounds ? this._tunnelLayer.getBounds().height : 0) || 220;
        // Recompute window height from layout — we know winH from build:
        const layoutWinH = Math.max(190, G.vpH * 0.32);
        this._drawTunnelStrip(this._tunnelG, this._scroll, layoutWinH, W);

        // ─── Station view ─────────────────────────────────────────────────
        if (isWaiting && stationLabel) {
            if (!this._stationLabelTxt) {
                this._stationLabelTxt = new PIXI.Text('', {
                    fontFamily: 'Silkscreen, monospace', fontSize: 10, fill: theme.col,
                    dropShadow: true, dropShadowColor: theme.col, dropShadowBlur: 5, dropShadowDistance: 0
                });
                this._stationLabelTxt.anchor.set(0.5, 0.5);
                this._tunnelLayer.addChild(this._stationLabelTxt);
            }
            this._drawStationView(this._stationG, theme, stationLabel, layoutWinH, W);
            this._stationG.alpha = Math.min(1, (this._stationG.alpha || 0) + 0.12);
        } else {
            if (this._stationLabelTxt) this._stationLabelTxt.visible = false;
            this._stationG.alpha = Math.max(0, (this._stationG.alpha || 0) - 0.12);
        }

        // ─── Doors open/close at stations ─────────────────────────────────
        const doorTarget = isWaiting ? 1 : 0;
        this._doorOpen += (doorTarget - this._doorOpen) * 0.12;
        const openPx = this._doorOpen * 32;
        if (this._doorL) this._doorL.x = (W / 2 - 32) - openPx;
        if (this._doorR) this._doorR.x = (W / 2 + 32) + openPx;

        // ─── Destination sign ─────────────────────────────────────────────
        if (this._destTxt) {
            if (isWaiting && stationLabel) {
                this._destTxt.text = stationLabel;
            } else if (nextLabel) {
                this._destTxt.text = 'NEXT: ' + nextLabel;
            } else {
                this._destTxt.text = '— in transit —';
            }
        }

        // ─── Speed pill / load gauge ─────────────────────────────────────
        if (this._speedTxt) {
            const speed = isWaiting ? 0 : Math.abs(dx);
            const pax = t.passengers || 0;
            this._speedTxt.text = `${isWaiting ? 'STOPPED' : speed.toFixed(1) + ' u/t'}    ${pax} pax`;
        }

        // ─── Wheel spin ──────────────────────────────────────────────────
        if (this._wheelGfx && this._wheelCenters) {
            this._wheelGfx.clear();
            const ang = (this._scroll * 0.05);
            this._wheelCenters.forEach(c => {
                this._wheelGfx.beginFill(0x94a3b8);
                this._wheelGfx.drawRect(c.x - 0.6, c.y - 6, 1.2, 12);
                this._wheelGfx.endFill();
                this._wheelGfx.lineStyle(1, 0xe0f2fe, 0.7);
                this._wheelGfx.moveTo(c.x + Math.cos(ang) * 5, c.y + Math.sin(ang) * 5);
                this._wheelGfx.lineTo(c.x - Math.cos(ang) * 5, c.y - Math.sin(ang) * 5);
                this._wheelGfx.moveTo(c.x + Math.cos(ang + Math.PI / 2) * 5, c.y + Math.sin(ang + Math.PI / 2) * 5);
                this._wheelGfx.lineTo(c.x - Math.cos(ang + Math.PI / 2) * 5, c.y - Math.sin(ang + Math.PI / 2) * 5);
                this._wheelGfx.lineStyle(0);
            });
        }

        // ─── Passengers ──────────────────────────────────────────────────
        if (this._passengersG) {
            this._drawPassengers(this._passengersG, t.passengers || 0, theme, W);
        }

        // ─── Subtle bob while moving ─────────────────────────────────────
        const moving = !isWaiting && Math.abs(dx) > 0.05;
        const bob = moving ? Math.sin(this._tick * 0.5) * 0.8 : 0;
        if (this.scene) this.scene.y = this._bobBase + bob;
    },

    cleanup() {
        this.scene = null;
        this.layer = null;
        this.bld = null;
        this._trainKey = null;
        this._tunnelLayer = null;
        this._tunnelG = null;
        this._stationG = null;
        this._stationLabelTxt = null;
        this._passengersG = null;
        this._doorL = null;
        this._doorR = null;
        this._destTxt = null;
        this._speedTxt = null;
        this._wheelGfx = null;
        this._wheelCenters = null;
        this._lastTrainX = null;
        this._scroll = 0;
        this._doorOpen = 0;
    }
};
