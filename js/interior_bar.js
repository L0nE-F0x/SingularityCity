/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR NEON BAR (v1.0.0)
   Self-contained interior module for the Neon Bar / Karaoke venue.
   3 floors: VIP Lounge (top), Karaoke Stage (mid), Main Bar (ground) + Cellar (basement).
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorBar = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false, _noYScroll: false,
    
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
        
        const floorH = 80, numFloors = 3, roofH = 70;
        this.totalH = roofH + (numFloors + 1) * floorH;
        const startX = 60, bldW = G.vpW - 120;
        const themes = ['vip', 'karaoke', 'main_bar'];
        
        // ─── ROOF SIGN ───
        const rc = new PIXI.Container();
        const bW = 200, bH = 30, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x0a0514); sg.lineStyle(2, 0xff00ff, 0.6); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
        sg.beginFill(0x333333); sg.drawRect(bX+15, bY+bH, 4, 8); sg.drawRect(bX+bW-19, bY+bH, 4, 8); sg.endFill();
        rc.addChild(sg);
        const lt = new PIXI.Text('🍸 NEON BAR', { fontFamily:'JetBrains Mono', fontSize:14, fontWeight:'bold', fill:'#ff00ff', letterSpacing:2, dropShadow:true, dropShadowColor:'#ff00ff', dropShadowBlur:10, dropShadowDistance:0 });
        lt.anchor.set(0.5,0.5); lt.x = bX+bW/2; lt.y = bY+bH/2; rc.addChild(lt);
        const rl = new PIXI.Graphics();
        rl.beginFill(0xff00ff, 0.25); rl.drawRect(startX, roofH-4, bldW, 4); rl.endFill();
        rc.addChild(rl); this.scene.addChild(rc);
        
        // ─── FLOORS ───
        for (let f = -1; f < numFloors; f++) {
            const fy = roofH + (numFloors-1-f) * floorH;
            const isB = f === -1;
            const theme = isB ? 'cellar' : themes[numFloors-1-f];
            
            // Walls — with real window holes for above-ground floors
            const rg = new PIXI.Graphics();
            rg.beginFill(0x0a0514); rg.drawRect(startX-6, fy, 6, floorH); rg.endFill();
            rg.beginFill(0x0a0514); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wallCol = isB ? 0x0a0810 : 0x12081e;
            
            if (!isB) {
                // Draw wall in segments with window holes
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, 20); rg.endFill(); // above windows
                rg.beginFill(wallCol); rg.drawRect(startX, fy+54, bldW, floorH-54); rg.endFill(); // below windows
                // Wall between windows
                let wx = startX + 40;
                rg.beginFill(wallCol); rg.drawRect(startX, fy+20, 40, 34); rg.endFill(); // left of first window
                while (wx + 40 <= startX + bldW - 40) {
                    wx += 40;
                    if (wx + 20 <= startX + bldW - 40) rg.beginFill(wallCol); rg.drawRect(wx, fy+20, 20, 34); rg.endFill();
                    wx += 20;
                }
                rg.beginFill(wallCol); rg.drawRect(wx-20, fy+20, startX+bldW-wx+20, 34); rg.endFill();
                // Window frames only (no fill — sky shows through)
                const wf = new PIXI.Graphics();
                let wx2 = startX + 40;
                while (wx2 + 40 <= startX + bldW - 40) {
                    wf.lineStyle(2, 0x2a1040); wf.drawRect(wx2, fy+20, 40, 34);
                    wf.moveTo(wx2+20, fy+20); wf.lineTo(wx2+20, fy+54);
                    wf.moveTo(wx2, fy+37); wf.lineTo(wx2+40, fy+37);
                    wf.lineStyle(0); wx2 += 60;
                }
                this.scene.addChild(wf);
            } else {
                // Basement: solid walls, no windows
                rg.beginFill(wallCol); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            }
            
            rg.beginFill(0x0f0618); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x080410); rg.drawRect(startX, fy, bldW, 3); rg.endFill();
            rg.beginFill(0x1a0a2e); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            this.scene.addChild(rg);
            
            // Neon accent strips on walls
            if (!isB) {
                const ns = new PIXI.Graphics();
                const nCol = theme === 'vip' ? 0xa855f7 : theme === 'karaoke' ? 0xff00ff : 0x00ffff;
                ns.beginFill(nCol, 0.12); ns.drawRect(startX, fy+2, bldW, 2); ns.endFill();
                ns.beginFill(nCol, 0.08); ns.drawRect(startX, fy+floorH*0.5, bldW, 1); ns.endFill();
                ns.beginFill(0xff69b4, 0.2); ns.drawRect(startX+2, fy+6, 2, floorH-12); ns.endFill();
                ns.beginFill(0x00ffff, 0.2); ns.drawRect(startX+bldW-4, fy+6, 2, floorH-12); ns.endFill();
                this.scene.addChild(ns);
                this.indoorLights.push({ g: ns, maxA: 0.15, type: 'neon' });
            }
            
            // Floor label
            const fc = new PIXI.Container(); fc.sortableChildren = true; this.scene.addChild(fc);
            const pY = fy + floorH - 6;
            
            if (theme === 'main_bar') this._drawMainBar(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'karaoke') this._drawKaraoke(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'vip') this._drawVIP(fc, startX, bldW, pY, fy, floorH);
            else if (theme === 'cellar') this._drawCellar(fc, startX, bldW, pY, fy, floorH);
        }
        
        // ─── EARTH AROUND BASEMENT (shows it's underground) ───
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX - 6, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX - 6, 6); earth.endFill();
        earth.beginFill(0x2a2218); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(startX + bldW + 6, groundY, G.vpW - startX - bldW - 6, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY - 2, startX - 6, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(startX + bldW + 6, groundY - 2, G.vpW - startX - bldW - 6, 6); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY - 4, startX - 6, 4); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(startX + bldW + 6, groundY - 4, G.vpW - startX - bldW - 6, 4); earth.endFill();
        this.scene.addChild(earth);
        
        // ─── DATA CABLES + VOID (below basement) ───
        const vmY = roofH + (numFloors + 1) * floorH;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, vmY - 4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, vmY + 6, G.vpW, 3000); vm.endFill();
        const cableColors = [0xef4444, 0x22d3ee, 0x4ade80, 0xfbbf24, 0xa855f7, 0xf97316, 0x06b6d4, 0xe879f9];
        for (let cy = vmY + 20; cy < vmY + 120; cy += 6) {
            const col = cableColors[Math.floor(Math.random() * cableColors.length)];
            vm.beginFill(col, 0.15 + Math.random() * 0.25);
            vm.drawRect(0, cy + Math.random() * 3, G.vpW, 1 + Math.random() * 2); vm.endFill();
        }
        for (let px = 80; px < G.vpW; px += 150) { vm.beginFill(0x111115); vm.drawRect(px, vmY + 6, 20, 100); vm.endFill(); }
        for (let lx = 90; lx < G.vpW; lx += 150) { vm.beginFill(0xef4444); vm.drawCircle(lx, vmY + 25, 2); vm.endFill(); }
        this.scene.addChild(vm);
        
        // Position
        const bp = 56; this.scene.y = G.vpH - bp - this.totalH + floorH;
        this.minY = this.scene.y - floorH * 3; this.maxY = this.scene.y + floorH * 3;
        
        // Drag scroll
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorBar.isDragging) return; let ny=InteriorBar._startSceneY+(e.clientY-InteriorBar._startY); ny=Math.max(InteriorBar.minY,Math.min(ny,InteriorBar.maxY)); InteriorBar.scene.y=ny; };
        this._onUp = () => { InteriorBar.isDragging=false; if(InteriorBar.layer) InteriorBar.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },
    
    // ═══ MAIN BAR (Ground Floor) ═══
    _drawMainBar(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx+bw/2, fy+8, 'MAIN BAR', 0x00ffff);
        // Long bar counter
        const barX = sx+40, barW = bw*0.6;
        const bg = new PIXI.Graphics(); bg.eventMode='none';
        bg.beginFill(0x1a0a28); bg.drawRect(barX, pY-20, barW, 20); bg.endFill();
        bg.beginFill(0x2a1040); bg.drawRect(barX, pY-22, barW, 3); bg.endFill();
        // Bar top surface (shiny)
        bg.beginFill(0x3a1a50, 0.6); bg.drawRect(barX+2, pY-21, barW-4, 2); bg.endFill();
        c.addChild(bg);
        // Bottles on shelf behind bar
        const shelf = new PIXI.Graphics(); shelf.eventMode='none';
        shelf.beginFill(0x1a0a20); shelf.drawRect(barX, pY-45, barW, 22); shelf.endFill();
        shelf.beginFill(0x2a1040); shelf.drawRect(barX, pY-47, barW, 3); shelf.endFill();
        const bottleCols = [0xff00ff, 0x00ffff, 0xa855f7, 0xf59e0b, 0xef4444, 0x4ade80, 0xff69b4, 0x3b82f6];
        for (let bx = barX+8; bx < barX+barW-10; bx += 14) {
            const bc = bottleCols[Math.floor(Math.random()*bottleCols.length)];
            const bh = 10 + Math.random()*8;
            shelf.beginFill(bc, 0.6); shelf.drawRect(bx, pY-44-bh+22, 6, bh); shelf.endFill();
            shelf.beginFill(0xffffff, 0.3); shelf.drawRect(bx+1, pY-44-bh+22, 2, bh-2); shelf.endFill();
        }
        c.addChild(shelf);
        // Cocktail glasses on bar
        for (let gx = barX+15; gx < barX+barW-20; gx += 40) {
            const gl = new PIXI.Graphics(); gl.eventMode='none';
            gl.beginFill(0xffffff, 0.3); gl.drawPolygon([gx, pY-22, gx+4, pY-30, gx+8, pY-22]); gl.endFill();
            gl.beginFill([0xff00ff,0x00ffff,0xa855f7][Math.floor(gx/40)%3], 0.5);
            gl.drawRect(gx+2, pY-28, 4, 5); gl.endFill();
            c.addChild(gl);
        }
        // Bar stools
        for (let sx2 = barX+20; sx2 < barX+barW-20; sx2 += 35) {
            const st = new PIXI.Graphics(); st.eventMode='none';
            st.beginFill(0x333344); st.drawRect(sx2, pY-8, 2, 8); st.endFill();
            st.beginFill(0x4a4a6a); st.drawCircle(sx2+1, pY-10, 5); st.endFill();
            c.addChild(st);
        }
        // Jukebox
        const jx = sx + bw - 80;
        const jb = new PIXI.Graphics(); jb.eventMode='none';
        jb.beginFill(0x1a1030); jb.drawRoundedRect(jx, pY-40, 30, 40, 4); jb.endFill();
        jb.beginFill(0xff00ff, 0.2); jb.drawRect(jx+4, pY-35, 22, 15); jb.endFill();
        jb.beginFill(0x00ffff, 0.15); jb.drawRect(jx+4, pY-18, 22, 8); jb.endFill();
        c.addChild(jb);
        this.indoorLights.push({ g: jb, maxA: 0.3, type: 'neon' });
        // NPCs
        this._npc(c, barX+30, pY, 'Bartender', 0xff00ff);
        this._npc(c, sx+bw-50, pY, 'Bouncer', 0xef4444);
    },
    
    // ═══ KARAOKE STAGE (Middle Floor) ═══
    _drawKaraoke(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx+bw/2, fy+8, 'KARAOKE STAGE', 0xff00ff);
        // Stage platform
        const stgX = sx + bw/2 - 80, stgW = 160;
        const sg = new PIXI.Graphics(); sg.eventMode='none';
        sg.beginFill(0x2a1040); sg.drawRect(stgX, pY-8, stgW, 8); sg.endFill();
        sg.beginFill(0x3a1a50); sg.drawRect(stgX, pY-10, stgW, 3); sg.endFill();
        // Stage floor lights
        for (let lx = stgX+10; lx < stgX+stgW; lx += 20) {
            sg.beginFill([0xff00ff,0x00ffff,0xa855f7,0xfbbf24][Math.floor(lx/20)%4], 0.4);
            sg.drawCircle(lx, pY-6, 3); sg.endFill();
        }
        c.addChild(sg);
        // Microphone stand (center stage)
        const mic = new PIXI.Graphics(); mic.eventMode='none';
        mic.beginFill(0x888888); mic.drawRect(sx+bw/2-1, pY-30, 2, 22); mic.endFill();
        mic.beginFill(0xcccccc); mic.drawCircle(sx+bw/2, pY-32, 4); mic.endFill();
        c.addChild(mic);
        // Speakers (left and right of stage)
        for (const spx of [stgX-25, stgX+stgW+5]) {
            const sp = new PIXI.Graphics(); sp.eventMode='none';
            sp.beginFill(0x111118); sp.drawRect(spx, pY-35, 20, 35); sp.endFill();
            sp.beginFill(0x222230); sp.drawCircle(spx+10, pY-25, 6); sp.endFill();
            sp.beginFill(0x333340); sp.drawCircle(spx+10, pY-25, 3); sp.endFill();
            sp.beginFill(0x222230); sp.drawCircle(spx+10, pY-12, 4); sp.endFill();
            c.addChild(sp);
        }
        // Disco ball
        const db = new PIXI.Graphics(); db.eventMode='none';
        db.beginFill(0xffffff, 0.4); db.drawCircle(sx+bw/2, fy+18, 8); db.endFill();
        for (let a = 0; a < Math.PI*2; a += 0.5) {
            db.beginFill(0xffffff, 0.7); db.drawRect(sx+bw/2+Math.cos(a)*6-1, fy+18+Math.sin(a)*6-1, 2, 2); db.endFill();
        }
        db.beginFill(0x888888); db.drawRect(sx+bw/2-1, fy+3, 2, 8); db.endFill();
        c.addChild(db);
        const dbGlow = new PIXI.Graphics();
        dbGlow.beginFill(0xffffff, 0.04); dbGlow.drawEllipse(sx+bw/2, fy+18, 30, 15); dbGlow.endFill();
        dbGlow.blendMode = PIXI.BLEND_MODES.ADD; c.addChild(dbGlow);
        this.indoorLights.push({ g: dbGlow, maxA: 0.08, type: 'disco' });
        // Lyric screen
        const scr = new PIXI.Graphics(); scr.eventMode='none';
        scr.beginFill(0x050510); scr.drawRect(stgX+20, fy+12, stgW-40, 20); scr.endFill();
        scr.beginFill(0xff00ff, 0.15); scr.drawRect(stgX+22, fy+14, stgW-44, 16); scr.endFill();
        c.addChild(scr);
        const lyricTxt = new PIXI.Text('♪ SING YOUR TRAINING DATA ♪', { fontFamily:'JetBrains Mono', fontSize:5, fill:'#ff69b4' });
        lyricTxt.anchor.set(0.5,0.5); lyricTxt.x = sx+bw/2; lyricTxt.y = fy+22; c.addChild(lyricTxt);
        // Seating area
        for (let tx = sx+30; tx < stgX-20; tx += 40) { this._drawTable(c, tx, pY); }
        for (let tx = stgX+stgW+30; tx < sx+bw-30; tx += 40) { this._drawTable(c, tx, pY); }
        // NPC
        this._npc(c, sx+bw/2, pY-8, 'DJ Dropout', 0xa855f7);
    },
    
    // ═══ VIP LOUNGE (Top Floor) ═══
    _drawVIP(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx+bw/2, fy+8, 'VIP LOUNGE', 0xa855f7);
        // Plush seating booths
        for (let bx = sx+30; bx < sx+bw-60; bx += 100) {
            const bt = new PIXI.Graphics(); bt.eventMode='none';
            // Booth back
            bt.beginFill(0x2a1040); bt.drawRoundedRect(bx, pY-30, 70, 8, 2); bt.endFill();
            bt.beginFill(0x3a1a50); bt.drawRoundedRect(bx-4, pY-32, 8, 32, 2); bt.drawRoundedRect(bx+66, pY-32, 8, 32, 2); bt.endFill();
            // Seat cushion
            bt.beginFill(0x4a2060, 0.8); bt.drawRoundedRect(bx+4, pY-22, 62, 10, 2); bt.endFill();
            // Table
            bt.beginFill(0x1a0a28); bt.drawRect(bx+15, pY-14, 40, 14); bt.endFill();
            bt.beginFill(0x2a1040); bt.drawRect(bx+15, pY-16, 40, 3); bt.endFill();
            // Candle
            bt.beginFill(0xfbbf24, 0.6); bt.drawRect(bx+33, pY-20, 4, 4); bt.endFill();
            bt.beginFill(0xff6600, 0.8); bt.drawPolygon([bx+35, pY-20, bx+33, pY-24, bx+37, pY-24]); bt.endFill();
            c.addChild(bt);
        }
        // Champagne bucket
        const chx = sx + bw - 60;
        const ch = new PIXI.Graphics(); ch.eventMode='none';
        ch.beginFill(0x94a3b8); ch.drawRect(chx, pY-18, 16, 18); ch.endFill();
        ch.beginFill(0xfbbf24, 0.4); ch.drawRect(chx+2, pY-16, 12, 10); ch.endFill();
        ch.beginFill(0x4ade80); ch.drawRect(chx+5, pY-26, 3, 10); ch.drawRect(chx+9, pY-24, 3, 8); ch.endFill();
        c.addChild(ch);
        // Velvet rope at entrance
        const vr = new PIXI.Graphics(); vr.eventMode='none';
        vr.beginFill(0xfbbf24); vr.drawRect(sx+20, pY-18, 4, 18); vr.drawRect(sx+50, pY-18, 4, 18); vr.endFill();
        vr.beginFill(0xef4444, 0.6); vr.drawRect(sx+24, pY-14, 26, 3); vr.endFill();
        c.addChild(vr);
        // NPC
        this._npc(c, sx+38, pY, 'Hostess', 0xa855f7);
    },
    
    // ═══ CELLAR (Basement) ═══
    _drawCellar(c, sx, bw, pY, fy, fh) {
        this._lbl(c, sx+bw/2, fy+8, 'CELLAR STORAGE', 0xf59e0b);
        // Wine/spirit racks
        for (let rx = sx+30; rx < sx+bw-80; rx += 70) {
            const rk = new PIXI.Graphics(); rk.eventMode='none';
            rk.beginFill(0x3d2914); rk.drawRect(rx, pY-45, 50, 45); rk.endFill();
            rk.beginFill(0x4a3520); rk.drawRect(rx+2, pY-43, 46, 41); rk.endFill();
            // Bottle rows
            for (let by = pY-40; by < pY-5; by += 8) {
                for (let bbx = rx+5; bbx < rx+45; bbx += 10) {
                    const bc = [0x7c2d12,0x1a4d2e,0x4a1942,0xf59e0b][Math.floor((bbx+by)/10)%4];
                    rk.beginFill(bc, 0.7); rk.drawRect(bbx, by, 7, 5); rk.endFill();
                }
            }
            c.addChild(rk);
        }
        // Beer kegs
        for (let kx = sx+bw-70; kx < sx+bw-20; kx += 25) {
            const kg = new PIXI.Graphics(); kg.eventMode='none';
            kg.beginFill(0x78582e); kg.drawEllipse(kx, pY-12, 10, 12); kg.endFill();
            kg.beginFill(0x92703a); kg.drawRect(kx-8, pY-18, 16, 2); kg.drawRect(kx-8, pY-6, 16, 2); kg.endFill();
            kg.beginFill(0xfbbf24); kg.drawRect(kx-2, pY-8, 4, 4); kg.endFill();
            c.addChild(kg);
        }
        // Crates
        for (let cx2 = sx+bw/2-30; cx2 < sx+bw/2+30; cx2 += 22) {
            const cr = new PIXI.Graphics(); cr.eventMode='none';
            cr.beginFill(0x3d2914); cr.drawRect(cx2, pY-18, 18, 18); cr.endFill();
            cr.beginFill(0x4a3520); cr.drawRect(cx2+2, pY-16, 14, 14); cr.endFill();
            cr.lineStyle(1, 0x2a1f0e); cr.moveTo(cx2+9, pY-16); cr.lineTo(cx2+9, pY-2);
            cr.moveTo(cx2+2, pY-9); cr.lineTo(cx2+16, pY-9); cr.lineStyle(0);
            c.addChild(cr);
        }
        // Rat NPC (actual rat, not human)
        const rat = new PIXI.Container(); rat.x = sx+100; rat.y = pY; rat.zIndex = 5;
        const rg2 = new PIXI.Graphics(); rg2.eventMode = 'none';
        // Body (grey oval)
        rg2.beginFill(0x6b6b7b); rg2.drawEllipse(0, -6, 10, 6); rg2.endFill();
        // Head
        rg2.beginFill(0x7b7b8b); rg2.drawEllipse(10, -8, 6, 5); rg2.endFill();
        // Ears
        rg2.beginFill(0xff9999, 0.6); rg2.drawCircle(8, -14, 3); rg2.drawCircle(13, -14, 3); rg2.endFill();
        // Eyes (beady)
        rg2.beginFill(0x000000); rg2.drawCircle(12, -9, 1.2); rg2.endFill();
        rg2.beginFill(0xffffff, 0.5); rg2.drawCircle(12.5, -9.5, 0.5); rg2.endFill();
        // Nose
        rg2.beginFill(0xff6b6b); rg2.drawCircle(16, -7, 1.5); rg2.endFill();
        // Whiskers
        rg2.lineStyle(0.5, 0x999999, 0.5);
        rg2.moveTo(15, -7); rg2.lineTo(22, -5); rg2.moveTo(15, -7); rg2.lineTo(22, -8);
        rg2.moveTo(15, -7); rg2.lineTo(21, -10); rg2.lineStyle(0);
        // Tail
        rg2.lineStyle(1, 0xff9999, 0.5);
        rg2.moveTo(-10, -6); rg2.bezierCurveTo(-16, -12, -20, -2, -18, -8); rg2.lineStyle(0);
        // Feet
        rg2.beginFill(0xff9999, 0.5); rg2.drawEllipse(-4, 0, 3, 1.5); rg2.drawEllipse(4, 0, 3, 1.5); rg2.endFill();
        rat.addChild(rg2);
        const ratTxt = new PIXI.Text('Cellar Rat', { fontFamily:'JetBrains Mono', fontSize:6, fill:0xf59e0b, fontWeight:'bold' });
        ratTxt.anchor.set(0.5, 1); ratTxt.y = -18; rat.addChild(ratTxt);
        rat.eventMode = 'static'; rat.cursor = 'pointer';
        rat.hitArea = new PIXI.Rectangle(-15, -20, 35, 24);
        rat.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel({ id:'npc_cellar_rat', name:'Cellar Rat', isNPC:true, role:'Cellar Rat', lab:'other', desc:'A resourceful rodent who guards the wine cellar. Technically not an employee but has seniority over everyone.' }); });
        c.addChild(rat);
        this.avatars.push({ cont: rat, _minX: sx+60, _maxX: sx+bw-80, _phase: Math.random()*Math.PI*2, _walkTimer: 0, _walkDir: 0 });
    },
    
    // ═══ SHARED HELPERS ═══
    _drawTable(c, x, y) {
        const g = new PIXI.Graphics(); g.eventMode='none';
        g.beginFill(0x1a0a28); g.drawCircle(x+10, y-10, 12); g.endFill();
        g.beginFill(0x2a1040); g.drawCircle(x+10, y-10, 10); g.endFill();
        // Drink
        g.beginFill(0x00ffff, 0.3); g.drawRect(x+6, y-14, 4, 4); g.endFill();
        c.addChild(g);
    },
    
    _lbl(c, x, y, text, col) {
        const t = new PIXI.Text(text, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, letterSpacing:2 });
        t.anchor.set(0.5,0); t.x=x; t.y=y; t.zIndex=10; c.addChild(t);
    },
    
    _npc(c, x, y, name, col) {
        const cont = new PIXI.Container(); cont.x=x; cont.y=y; cont.zIndex=5;
        const bw=16, h=32;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill();
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-2,0,3,4); legL.endFill(); legL.x=-bw*0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-1,0,3,4); legR.endFill(); legR.x=bw*0.15;
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2,-h+11,bw,16,2); body.endFill(); body.y=0;
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,11,3); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,4,1); head.drawCircle(bw*0.1,4,1); head.endFill(); head.y=-h;
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-5;
        const tx = new PIXI.Text(name, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, fontWeight:'bold' });
        tx.anchor.set(0.5,1); tx.y=-h-8;
        cont.addChild(sh, legL, legR, body, head, dot, tx);
        cont.eventMode='static'; cont.cursor='pointer';
        cont.hitArea = new PIXI.Rectangle(-bw,-h-10,bw*2,h+14);
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel({ id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name, isNPC:true, role:name, lab:'other', desc:'Neon Bar staff. Keeping the party going every night.' }); });
        c.addChild(cont);
        this.avatars.push({ cont, head, body, legL, legR, _minX:x-40, _maxX:x+40, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 });
    },
    
    // ═══ UPDATE ═══
    update() {
        if (!this.scene) return;
        const dp = G.getDayPhase(); const night = dp>.83||dp<.25;
        const vp = document.getElementById('viewport');
        if(vp){let sky;if(dp<.22)sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';else if(dp<.30){const t=(dp-.22)/.08;sky=`linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`;} else if(dp<.72) sky='linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if(dp<.84){const t=(dp-.72)/.12;sky=`linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`;} else sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';vp.style.background=sky;}
        if(this.celestialGfx){this.celestialGfx.clear();if(night){let np=dp>0.83?(dp-0.83)/0.42:(dp+0.17)/0.42;this.celestialGfx.beginFill(0xe8e8d0);this.celestialGfx.drawCircle(G.vpW*np,40+Math.sin(np*Math.PI)*120,12);this.celestialGfx.endFill();}else{let dayP=(dp-0.25)/(0.83-0.25);this.celestialGfx.beginFill(0xffe066);this.celestialGfx.drawCircle(G.vpW*dayP,40+Math.sin(dayP*Math.PI)*120,15);this.celestialGfx.endFill();}}
        if(this.starsLayer){this.starsLayer.visible=night;if(night)this.starsLayer.children.forEach(s=>{s.alpha=.15+Math.abs(Math.sin(G.tick*.03+s._phase))*.5;});}
        // Neon + disco lights
        this.indoorLights.forEach(l => { if(!l.g||l.g.destroyed)return; if(l.type==='neon') l.g.alpha=l.maxA*(0.6+Math.sin(G.tick*0.08)*0.3+((Math.random()<0.05)?-0.3:0)); else if(l.type==='disco') l.g.alpha=l.maxA*(0.4+Math.abs(Math.sin(G.tick*0.12))*0.6); else l.g.alpha=l.maxA*(0.7+Math.sin(G.tick*0.02)*0.3); });
        // NPC wander
        this.avatars.forEach((av,ci) => { if(!av.cont||av.cont.destroyed)return; av._walkTimer=(av._walkTimer||0)-1; if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;} const nx=av.cont.x+av._walkDir*0.3; if(nx>av._minX&&nx<av._maxX)av.cont.x=nx; if(av.head)av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5; if(av.legL)av.legL.y=Math.sin(G.tick*0.2+ci)*3; if(av.legR)av.legR.y=-Math.sin(G.tick*0.2+ci)*3; });
    }
};
