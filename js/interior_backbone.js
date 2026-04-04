/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BACKBONE INTERIORS (v1.0.0)
   Self-contained interior module for network infrastructure buildings.
   IXP: Meet-Me Room, Peering Hall, Cross-Connect Vault
   NOC: War Room, Monitoring Wall, Incident Room
   Landing: Cable Vault, Amplifier Room
   CDN: Cache Floor, Edge Compute
   Ground Station: Dish Control, Tracking Room
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorBackbone = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _startY: 0, _startSceneY: 0, minY: 0, maxY: 0, totalH: 0,

    build(bld, layer) {
        this.bld = bld; this.layer = layer; this.layer.removeChildren();
        this.avatars = []; this.indoorLights = [];

        // Sky
        this.skyContainer = new PIXI.Container(); this.layer.addChild(this.skyContainer);
        this.starsLayer = new PIXI.Container();
        for (let i = 0; i < 60; i++) { const s = new PIXI.Graphics(); s.beginFill(0xffffff); s.drawCircle(0,0,.5+Math.random()); s.endFill(); s.x=Math.random()*G.vpW; s.y=Math.random()*G.vpH*.4; s._phase=Math.random()*Math.PI*2; this.starsLayer.addChild(s); }
        this.celestialGfx = new PIXI.Graphics();
        this.skyContainer.addChild(this.starsLayer, this.celestialGfx);
        this.scene = new PIXI.Container(); this.layer.addChild(this.scene);

        const floorH = 80, startX = 60, bldW = G.vpW - 120;
        const layouts = {
            'backbone_ixp':     { floors: ['Cross-Connect Vault', 'Peering Hall', 'Meet-Me Room', 'NOC Desk'],
                                  roofLabel: 'INTERNET EXCHANGE', col: 0x22d3ee, npcs: ['Peering Eng', 'IX Operator'] },
            'backbone_landing': { floors: ['Cable Vault', 'Amplifier Room', 'Monitoring'],
                                  roofLabel: 'CABLE LANDING', col: 0x3b82f6, npcs: ['Splice Tech', 'Cable Tech'] },
            'backbone_ground':  { floors: ['Antenna Hall', 'Tracking Room', 'Dish Control'],
                                  roofLabel: 'GROUND STATION', col: 0xa855f7, npcs: ['Sat Ops', 'RF Engineer'] },
            'backbone_cdn':     { floors: ['Cache Floor', 'Edge Compute', 'WAF Control', 'Ops Deck', 'Boardroom'],
                                  roofLabel: 'CDN / EDGE NODE', col: 0xf97316, npcs: ['CDN Eng', 'Cache Ops'] },
            'backbone_noc':     { floors: ['Server Basement', 'Incident Room', 'War Room', 'Monitoring Wall', 'Executive Floor', 'Rooftop Terrace'],
                                  roofLabel: 'NETWORK OPS CENTER', col: 0xef4444, npcs: ['NOC Lead', 'SRE', 'Analyst'] }
        };
        const layout = layouts[bld.id] || { floors: ['Operations'], roofLabel: bld.name.toUpperCase(), col: 0x22d3ee, npcs: [] };
        const numFloors = layout.floors.length;
        const roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH;

        // Roof sign
        const rc = new PIXI.Container();
        const bW = 220, bH = 28, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0f1a); sg.lineStyle(2, layout.col, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        // Accent glow
        sg.beginFill(layout.col, 0.05); sg.drawRect(bX, bY, bW, bH); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text(layout.roofLabel, { fontFamily:'JetBrains Mono', fontSize:11, fontWeight:'bold', fill:'#' + layout.col.toString(16).padStart(6,'0'), letterSpacing:2 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; if(lt.width>bW-8) lt.scale.set((bW-8)/lt.width);
        rc.addChild(lt); this.scene.addChild(rc);

        // Floors
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f) * floorH;
            const isB = f === -1;
            const floorName = isB ? layout.floors[0] : layout.floors[numFloors - 1 - f] || 'Operations';
            const rg = new PIXI.Graphics();
            // Walls
            rg.beginFill(0x0a1020); rg.drawRect(startX-6, fy, 6, floorH); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wc = isB ? 0x080e18 : 0x0c1424;
            rg.beginFill(wc); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            // Floor slab
            rg.beginFill(0x0a1018); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x1a2538); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            // Accent line (cyan glow at ceiling)
            rg.beginFill(layout.col, 0.08); rg.drawRect(startX, fy, bldW, 2); rg.endFill();
            // Windows
            if (!isB) {
                let wx = startX + 50;
                while (wx + 40 <= startX + bldW - 50) {
                    rg.lineStyle(2, 0x1a2a40); rg.drawRect(wx, fy+20, 40, 32);
                    rg.moveTo(wx+20,fy+20); rg.lineTo(wx+20,fy+52); rg.lineStyle(0); wx += 60;
                }
            }
            this.scene.addChild(rg);
            // Floor label
            const fl = new PIXI.Text(floorName.toUpperCase(), { fontFamily:'JetBrains Mono', fontSize:7, fill:layout.col, letterSpacing:2 });
            fl.anchor.set(0.5,0); fl.x = startX+bldW/2; fl.y = fy+6; this.scene.addChild(fl);
            // Floor props
            const fc = new PIXI.Container(); this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            this._drawFloorProps(fc, startX, bldW, pY, fy, floorH, floorName, layout.col, bld.id);
        }

        // Earth + fiber cables below building
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x0a1020); earth.drawRect(0, groundY, startX-6, floorH); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, floorH); earth.endFill();
        earth.beginFill(0x141e30); earth.drawRect(0, groundY, startX-6, 6); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x1a2a3a); earth.drawRect(0, groundY-2, startX-6, 4); earth.drawRect(startX+bldW+6, groundY-2, G.vpW-startX-bldW-6, 4); earth.endFill();
        this.scene.addChild(earth);

        // Fiber cable trunk below
        const vmY = roofH + (numFloors+1) * floorH;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x060a12); vm.drawRect(0, vmY-4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x030610); vm.drawRect(0, vmY+6, G.vpW, 3000); vm.endFill();
        // Dense fiber cables
        const cc = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15, 0x8b5cf6, 0x3b82f6];
        for (let cy = vmY+12; cy < vmY+140; cy += 4) {
            const col = cc[Math.floor(Math.random()*cc.length)];
            vm.beginFill(col, 0.2+Math.random()*0.35);
            vm.drawRect(0, cy+Math.random()*2, G.vpW, 1+Math.random()*2);
            vm.endFill();
        }
        // Vertical conduits
        for (let px = 100; px < G.vpW; px += 120) {
            vm.beginFill(0x111520); vm.drawRect(px, vmY+6, 16, 120); vm.endFill();
            // Fiber glow inside conduit
            vm.beginFill(cc[Math.floor(Math.random()*cc.length)], 0.15);
            vm.drawRect(px+4, vmY+10, 8, 112); vm.endFill();
        }
        this.scene.addChild(vm);

        // Position + scroll
        const bp = 56;
        this.scene.y = G.vpH - bp - this.totalH + floorH;
        this.minY = this.scene.y - floorH * 3;
        this.maxY = this.scene.y + floorH * 3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove);
        window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => {
            this.isDragging = true; this._startY = e.clientY;
            this._startSceneY = this.scene.y; this.layer.cursor = 'grabbing';
        });
        this._onMove = (e) => {
            if (!InteriorBackbone.isDragging || !InteriorBackbone.scene || InteriorBackbone.scene.destroyed) return;
            let ny = InteriorBackbone._startSceneY + (e.clientY - InteriorBackbone._startY);
            ny = Math.max(InteriorBackbone.minY, Math.min(ny, InteriorBackbone.maxY));
            InteriorBackbone.scene.y = ny;
        };
        this._onUp = () => {
            InteriorBackbone.isDragging = false;
            if (InteriorBackbone.layer) InteriorBackbone.layer.cursor = 'grab';
        };
        window.addEventListener('pointermove', this._onMove);
        window.addEventListener('pointerup', this._onUp);
    },

    _drawFloorProps(c, sx, bw, pY, fy, fh, floorName, col, bldId) {
        const fn = floorName.toLowerCase();
        const g = new PIXI.Graphics(); g.eventMode = 'none';

        if (fn.includes('war room') || fn.includes('monitoring')) {
            // Wall of screens
            for (let mx = sx+30; mx < sx+bw-50; mx += 55) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+12, 42, 28); g.endFill();
                g.beginFill(col, 0.15); g.drawRect(mx+2, fy+14, 38, 24); g.endFill();
                // Fake graph lines on screen
                for (let ly = 0; ly < 4; ly++) {
                    g.beginFill(col, 0.1 + Math.random() * 0.15);
                    g.drawRect(mx+4, fy+16+ly*5, 34, 1); g.endFill();
                }
                // Status dot
                const dotCol = Math.random() > 0.2 ? 0x4ade80 : 0xef4444;
                g.beginFill(dotCol, 0.8); g.drawCircle(mx+38, fy+16, 2); g.endFill();
            }
            // Operator desks
            for (let dx = sx+50; dx < sx+bw-80; dx += 100) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 60, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 60, 3); g.endFill();
                // Chair
                g.beginFill(0x334155); g.drawCircle(dx+30, pY-4, 6); g.endFill();
            }
        } else if (fn.includes('peering') || fn.includes('meet-me') || fn.includes('cross-connect')) {
            // Server racks / patch panels
            for (let rx = sx+25; rx < sx+bw-40; rx += 40) {
                // Rack enclosure
                g.beginFill(0x111825); g.drawRect(rx, fy+12, 28, fh-22); g.endFill();
                g.beginFill(0x1a2540); g.drawRect(rx, fy+12, 28, 3); g.endFill();
                // Rack units with LEDs
                for (let ru = 0; ru < 6; ru++) {
                    const uy = fy+18+ru*8;
                    g.beginFill(0x0d1220); g.drawRect(rx+2, uy, 24, 6); g.endFill();
                    // Activity LEDs
                    const ledCol = [0x22d3ee, 0x4ade80, 0xfbbf24, 0xef4444][Math.floor(Math.random()*4)];
                    g.beginFill(ledCol, 0.6+Math.random()*0.4);
                    g.drawRect(rx+4, uy+2, 2, 2); g.endFill();
                    g.beginFill(ledCol, 0.3+Math.random()*0.4);
                    g.drawRect(rx+8, uy+2, 2, 2); g.endFill();
                }
                // Fiber patch cables (colored lines down the side)
                const patchCol = [0x22d3ee, 0x4ade80, 0xf43f5e, 0xfacc15][Math.floor(Math.random()*4)];
                g.beginFill(patchCol, 0.3); g.drawRect(rx+26, fy+16, 2, fh-30); g.endFill();
            }
        } else if (fn.includes('cable vault') || fn.includes('amplifier')) {
            // Thick submarine cable bundles
            const cableColors = [0x22d3ee, 0x4ade80, 0xfacc15, 0xf43f5e, 0x8b5cf6];
            for (let ci = 0; ci < 5; ci++) {
                const cy = fy + 20 + ci * 11;
                g.beginFill(0x1a1a2a); g.drawRect(sx+20, cy, bw-40, 8); g.endFill();
                g.beginFill(cableColors[ci], 0.25); g.drawRect(sx+22, cy+2, bw-44, 4); g.endFill();
            }
            // Splice trays
            for (let tx = sx+60; tx < sx+bw-80; tx += 120) {
                g.beginFill(0x1a2540); g.drawRect(tx, pY-20, 80, 20); g.endFill();
                g.beginFill(0x222a40); g.drawRect(tx, pY-22, 80, 3); g.endFill();
                // Fiber loops
                for (let fi = 0; fi < 6; fi++) {
                    g.beginFill(cableColors[fi % cableColors.length], 0.35);
                    g.drawCircle(tx+10+fi*11, pY-10, 3); g.endFill();
                }
            }
        } else if (fn.includes('cache') || fn.includes('edge compute') || fn.includes('server')) {
            // Server racks with hot/cold aisle
            for (let rx = sx+20; rx < sx+bw-30; rx += 50) {
                g.beginFill(0x0d1525); g.drawRect(rx, fy+14, 35, fh-24); g.endFill();
                g.beginFill(0x141e30); g.drawRect(rx, fy+14, 35, 3); g.endFill();
                // Blinkenlights
                for (let ru = 0; ru < 8; ru++) {
                    const uy = fy+20+ru*6;
                    g.beginFill(0x0a0f1a); g.drawRect(rx+2, uy, 31, 4); g.endFill();
                    for (let li = 0; li < 4; li++) {
                        const on = Math.random() > 0.3;
                        g.beginFill(on ? 0x4ade80 : 0x1a2530, on ? 0.6 : 0.2);
                        g.drawRect(rx+4+li*7, uy+1, 2, 2); g.endFill();
                    }
                }
            }
        } else if (fn.includes('dish') || fn.includes('tracking') || fn.includes('antenna')) {
            // Satellite dish representations
            for (let dx = sx+60; dx < sx+bw-80; dx += 110) {
                // Dish base
                g.beginFill(0x334155); g.drawRect(dx+15, pY-10, 20, 10); g.endFill();
                // Dish arm
                g.beginFill(0x64748b); g.drawRect(dx+22, fy+20, 6, pY-30-fy); g.endFill();
                // Dish
                g.beginFill(0xcbd5e1, 0.4);
                g.drawEllipse(dx+25, fy+22, 30, 12); g.endFill();
                g.beginFill(0xe2e8f0, 0.3);
                g.drawEllipse(dx+25, fy+22, 26, 9); g.endFill();
                // Feed horn
                g.beginFill(0xf97316, 0.6); g.drawCircle(dx+25, fy+22, 3); g.endFill();
            }
            // Rack equipment
            for (let rx = sx+30; rx < sx+bw-50; rx += 80) {
                g.beginFill(0x111825); g.drawRect(rx, pY-28, 24, 28); g.endFill();
                g.beginFill(0x4ade80, 0.4); g.drawRect(rx+2, pY-26, 2, 2); g.endFill();
                g.beginFill(0x22d3ee, 0.4); g.drawRect(rx+6, pY-26, 2, 2); g.endFill();
            }
        } else if (fn.includes('incident') || fn.includes('executive') || fn.includes('ops deck') || fn.includes('boardroom')) {
            // Conference/ops table
            g.beginFill(0x1e293b); g.drawRect(sx+bw/2-80, pY-16, 160, 16); g.endFill();
            g.beginFill(0x334155); g.drawRect(sx+bw/2-80, pY-18, 160, 3); g.endFill();
            // Chairs around table
            for (let ci = 0; ci < 6; ci++) {
                const cx = sx+bw/2-70+ci*28;
                g.beginFill(0x475569); g.drawCircle(cx, pY-6, 5); g.endFill();
            }
            // Wall screen
            g.beginFill(0x0a0a18); g.drawRect(sx+bw/2-60, fy+14, 120, 30); g.endFill();
            g.beginFill(col, 0.12); g.drawRect(sx+bw/2-58, fy+16, 116, 26); g.endFill();
        } else if (fn.includes('waf') || fn.includes('noc desk')) {
            // Firewall / security displays
            for (let mx = sx+35; mx < sx+bw-45; mx += 65) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 50, 26); g.endFill();
                g.beginFill(0xef4444, 0.1); g.drawRect(mx+2, fy+16, 46, 22); g.endFill();
                // Shield icon
                g.beginFill(0xef4444, 0.3);
                g.drawPolygon([mx+25, fy+18, mx+35, fy+22, mx+35, fy+32, mx+25, fy+36, mx+15, fy+32, mx+15, fy+22]);
                g.endFill();
            }
        } else if (fn.includes('rooftop') || fn.includes('terrace')) {
            // Antenna array on rooftop
            for (let ax = sx+40; ax < sx+bw-40; ax += 80) {
                g.beginFill(0x64748b); g.drawRect(ax, fy+10, 4, fh-20); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(ax-8, fy+15, 20, 3); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(ax-6, fy+25, 16, 3); g.endFill();
                // Blinking light on top
                g.beginFill(0xef4444, 0.7); g.drawCircle(ax+2, fy+8, 2); g.endFill();
            }
        } else {
            // Generic ops floor
            for (let dx = sx+50; dx < sx+bw-60; dx += 80) {
                g.beginFill(0x1a2540); g.drawRect(dx, pY-14, 50, 14); g.endFill();
                g.beginFill(0x222a40); g.drawRect(dx, pY-16, 50, 3); g.endFill();
            }
        }

        c.addChild(g);
    },

    update() {
        // Animate stars
        if (this.starsLayer && typeof G !== 'undefined') {
            const dp = G.getDayPhase();
            const isNight = dp > 0.83 || dp < 0.2;
            this.starsLayer.alpha = isNight ? 0.8 : 0;
        }
        // Animate LEDs on war room screens (flicker effect)
        if (this.scene) {
            const fc = G.frameCount || 0;
            this.indoorLights.forEach(l => {
                if (l._flicker) l.alpha = 0.3 + Math.sin(fc * 0.05 + l._phase) * 0.3;
            });
        }
    }
};
