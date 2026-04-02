/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER ZONE INTERIORS (v1.0.0)
   Self-contained interior module for power grid facilities.
   Nuclear: Control Room, Reactor Hall, Turbine Floor, Waste Storage
   Coal: Boiler Room, Control Deck, Conveyor Level, Ash Pit
   Others: simplified 2-floor layouts
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorPower = {
    scene: null, layer: null, bld: null, avatars: [], indoorLights: [],
    skyContainer: null, starsLayer: null, celestialGfx: null,
    isDragging: false,

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
            'power_nuclear': { floors: ['Waste Storage', 'Turbine Hall', 'Reactor Core', 'Control Room'], roofLabel: 'NUCLEAR PLANT', col: 0x4ade80, npcs: ['Reactor Tech', 'Grid Operator'] },
            'power_coal':    { floors: ['Ash Pit', 'Conveyor Level', 'Boiler Room', 'Control Deck'], roofLabel: 'COAL STATION', col: 0x94a3b8, npcs: ['Coal Foreman'] },
            'power_hydro':   { floors: ['Turbine Hall', 'Generator Room', 'Control Room'], roofLabel: 'HYDRO DAM', col: 0x06b6d4, npcs: ['Dam Keeper'] },
            'power_solar':   { floors: ['Inverter Room', 'Monitoring Station'], roofLabel: 'SOLAR ARRAY', col: 0xfbbf24, npcs: ['Solar Engineer'] },
            'power_wind':    { floors: ['Nacelle Access', 'Monitoring Hub'], roofLabel: 'WIND FARM', col: 0x60a5fa, npcs: ['Turbine Tech'] }
        };
        const layout = layouts[bld.id] || { floors: ['Operations'], roofLabel: bld.name.toUpperCase(), col: 0x94a3b8, npcs: [] };
        const numFloors = layout.floors.length;
        const roofH = 60;
        this.totalH = roofH + (numFloors + 1) * floorH;

        // Roof sign
        const rc = new PIXI.Container();
        const bW = 200, bH = 28, bX = startX + bldW/2 - bW/2, bY = roofH - bH - 8;
        const sg = new PIXI.Graphics();
        sg.beginFill(0x111111); sg.lineStyle(2, layout.col, 0.8); sg.drawRect(bX, bY, bW, bH); sg.endFill(); sg.lineStyle(0);
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
            rg.beginFill(0x1a2030); rg.drawRect(startX-6, fy, 6, floorH); rg.drawRect(startX+bldW, fy, 6, floorH); rg.endFill();
            const wc = isB ? 0x10161e : 0x151c28;
            rg.beginFill(wc); rg.drawRect(startX, fy, bldW, floorH); rg.endFill();
            rg.beginFill(0x0f1520); rg.drawRect(startX, fy+floorH-6, bldW, 6); rg.endFill();
            rg.beginFill(0x222a38); rg.drawRect(startX-6, fy+floorH-3, bldW+12, 3); rg.endFill();
            // Windows (above ground)
            if (!isB) {
                let wx = startX + 50;
                while (wx + 40 <= startX + bldW - 50) {
                    rg.lineStyle(2, 0x2a3448); rg.drawRect(wx, fy+20, 40, 32);
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

        // Earth + data cables
        const groundY = roofH + numFloors * floorH;
        const earth = new PIXI.Graphics();
        earth.beginFill(0x2a2218); earth.drawRect(0, groundY, startX-6, floorH); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, floorH); earth.endFill();
        earth.beginFill(0x3a3020); earth.drawRect(0, groundY, startX-6, 6); earth.drawRect(startX+bldW+6, groundY, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x4a4a5a); earth.drawRect(0, groundY-2, startX-6, 6); earth.drawRect(startX+bldW+6, groundY-2, G.vpW-startX-bldW-6, 6); earth.endFill();
        earth.beginFill(0x2d5a3f); earth.drawRect(0, groundY-4, startX-6, 4); earth.drawRect(startX+bldW+6, groundY-4, G.vpW-startX-bldW-6, 4); earth.endFill();
        this.scene.addChild(earth);
        const vmY = roofH + (numFloors+1) * floorH;
        const vm = new PIXI.Graphics();
        vm.beginFill(0x1a1810); vm.drawRect(0, vmY-4, G.vpW, 10); vm.endFill();
        vm.beginFill(0x050508); vm.drawRect(0, vmY+6, G.vpW, 3000); vm.endFill();
        const cc = [0xef4444,0x22d3ee,0x4ade80,0xfbbf24,0xa855f7];
        for (let cy = vmY+20; cy < vmY+120; cy += 6) { vm.beginFill(cc[Math.floor(Math.random()*cc.length)], 0.15+Math.random()*0.25); vm.drawRect(0, cy+Math.random()*3, G.vpW, 1+Math.random()*2); vm.endFill(); }
        for (let px = 80; px < G.vpW; px += 150) { vm.beginFill(0x111115); vm.drawRect(px, vmY+6, 20, 100); vm.endFill(); }
        this.scene.addChild(vm);

        // Position + scroll
        const bp = 56; this.scene.y = G.vpH-bp-this.totalH+floorH;
        this.minY = this.scene.y - floorH*3; this.maxY = this.scene.y + floorH*3;
        this.layer.eventMode = 'static'; this.layer.cursor = 'grab';
        window.removeEventListener('pointermove', this._onMove); window.removeEventListener('pointerup', this._onUp);
        this.layer.on('pointerdown', (e) => { this.isDragging=true; this._startY=e.clientY; this._startSceneY=this.scene.y; this.layer.cursor='grabbing'; });
        this._onMove = (e) => { if(!InteriorPower.isDragging) return; let ny=InteriorPower._startSceneY+(e.clientY-InteriorPower._startY); ny=Math.max(InteriorPower.minY,Math.min(ny,InteriorPower.maxY)); InteriorPower.scene.y=ny; };
        this._onUp = () => { InteriorPower.isDragging=false; if(InteriorPower.layer) InteriorPower.layer.cursor='grab'; };
        window.addEventListener('pointermove', this._onMove); window.addEventListener('pointerup', this._onUp);
    },

    _drawFloorProps(c, sx, bw, pY, fy, fh, floorName, col, bldId) {
        const fn = floorName.toLowerCase();
        const g = new PIXI.Graphics(); g.eventMode = 'none';

        if (fn.includes('control')) {
            // Control room: monitor wall, desks, operator chairs
            for (let mx = sx+40; mx < sx+bw-60; mx += 70) {
                g.beginFill(0x0a0a18); g.drawRect(mx, fy+14, 50, 30); g.endFill();
                g.beginFill(col, 0.2); g.drawRect(mx+2, fy+16, 46, 26); g.endFill();
                for (let ly = fy+18; ly < fy+40; ly += 6) { g.beginFill(col, 0.15); g.drawRect(mx+4, ly, 42, 2); g.endFill(); }
            }
            for (let dx = sx+60; dx < sx+bw-80; dx += 90) {
                g.beginFill(0x334155); g.drawRect(dx, pY-16, 50, 16); g.endFill();
                g.beginFill(0x475569); g.drawRect(dx, pY-18, 50, 3); g.endFill();
                g.beginFill(0x334155); g.drawRect(dx+15, pY-8, 14, 8); g.endFill();
            }
            this._npc(c, sx+bw/2, pY, 'Operator', col);
        } else if (fn.includes('reactor') || fn.includes('core')) {
            // Reactor vessel
            const rx = sx + bw/2;
            g.beginFill(0x334155); g.drawEllipse(rx, pY-25, 50, 25); g.endFill();
            g.beginFill(0x475569); g.drawEllipse(rx, pY-28, 45, 8); g.endFill();
            g.beginFill(col, 0.15); g.drawEllipse(rx, pY-25, 35, 18); g.endFill();
            g.beginFill(0xfbbf24); g.drawRect(rx-20, pY-12, 40, 3); g.endFill(); // hazard line
            // Pipes
            for (let px = sx+40; px < sx+bw-40; px += 80) {
                g.beginFill(0x94a3b8); g.drawRect(px, fy+10, 6, fh-16); g.endFill();
                g.beginFill(0x475569); g.drawRect(px-1, fy+20, 8, 4); g.drawRect(px-1, fy+50, 8, 4); g.endFill();
            }
        } else if (fn.includes('turbine')) {
            // Turbine generators
            for (let tx = sx+60; tx < sx+bw-60; tx += 100) {
                g.beginFill(0x334155); g.drawEllipse(tx+25, pY-15, 30, 15); g.endFill();
                g.beginFill(0x475569); g.drawEllipse(tx+25, pY-18, 25, 5); g.endFill();
                g.beginFill(col, 0.2); g.drawCircle(tx+25, pY-15, 8); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(tx+50, pY-20, 8, 20); g.endFill(); // shaft
            }
        } else if (fn.includes('boiler')) {
            // Boiler drums
            for (let bx = sx+50; bx < sx+bw-50; bx += 80) {
                g.beginFill(0x78582e); g.drawEllipse(bx+20, pY-20, 25, 20); g.endFill();
                g.beginFill(0xef4444, 0.2); g.drawEllipse(bx+20, pY-20, 18, 14); g.endFill();
                g.beginFill(0x94a3b8); g.drawRect(bx+10, fy+10, 4, fh-16); g.drawRect(bx+30, fy+10, 4, fh-16); g.endFill();
            }
            this._npc(c, sx+100, pY, 'Stoker', 0xf59e0b);
        } else if (fn.includes('conveyor')) {
            g.beginFill(0x334155); g.drawRect(sx+30, pY-8, bw-60, 8); g.endFill();
            for (let cx = sx+40; cx < sx+bw-40; cx += 20) { g.beginFill(0x1e293b); g.drawRect(cx, pY-10, 8, 10); g.endFill(); }
            for (let cx = sx+50; cx < sx+bw-50; cx += 30) { g.beginFill(0x444444); g.drawRect(cx, pY-12, 14, 6); g.endFill(); } // coal lumps
        } else if (fn.includes('waste') || fn.includes('ash')) {
            // Storage drums/containers
            for (let dx = sx+40; dx < sx+bw-40; dx += 35) {
                const dc = fn.includes('waste') ? 0xfbbf24 : 0x666666;
                g.beginFill(dc, 0.5); g.drawRect(dx, pY-22, 18, 22); g.endFill();
                g.beginFill(0x000000, 0.2); g.drawRect(dx+2, pY-20, 14, 18); g.endFill();
                if (fn.includes('waste')) { g.beginFill(0xfbbf24); g.drawRect(dx+5, pY-18, 8, 2); g.drawRect(dx+7, pY-16, 4, 6); g.endFill(); } // hazard symbol
            }
        } else if (fn.includes('generator') || fn.includes('inverter')) {
            for (let gx = sx+50; gx < sx+bw-50; gx += 60) {
                g.beginFill(0x334155); g.drawRect(gx, pY-30, 40, 30); g.endFill();
                g.beginFill(col, 0.15); g.drawRect(gx+4, pY-26, 32, 10); g.endFill();
                g.beginFill(0x4ade80); g.drawCircle(gx+10, pY-8, 2); g.endFill();
                g.beginFill(0xef4444); g.drawCircle(gx+20, pY-8, 2); g.endFill();
            }
        } else if (fn.includes('monitor') || fn.includes('nacelle')) {
            for (let mx = sx+60; mx < sx+bw-60; mx += 80) {
                g.beginFill(0x0a0a18); g.drawRect(mx, pY-30, 30, 20); g.endFill();
                g.beginFill(col, 0.25); g.drawRect(mx+2, pY-28, 26, 16); g.endFill();
            }
            this._npc(c, sx+bw/2, pY, 'Technician', col);
        } else {
            // Generic: crates and equipment
            for (let ex = sx+40; ex < sx+bw-40; ex += 50) {
                g.beginFill(0x334155); g.drawRect(ex, pY-20, 30, 20); g.endFill();
            }
        }
        // Warning stripes on basement
        if (fn.includes('waste') || fn.includes('ash') || fn.includes('storage')) {
            for (let sx2 = sx; sx2 < sx+bw; sx2 += 16) { g.beginFill(0xfbbf24, 0.15); g.drawRect(sx2, fy+2, 8, 3); g.endFill(); }
        }
        c.addChild(g);
    },

    _npc(c, x, y, name, col) {
        const cont = new PIXI.Container(); cont.x=x; cont.y=y; cont.zIndex=5;
        const bw=16, h=32, headH=12;
        const sh = new PIXI.Graphics(); sh.beginFill(0x000000,0.25); sh.drawEllipse(0,2,bw*0.6,3); sh.endFill();
        const lw = Math.max(2, bw*0.25);
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2,0,lw,4); legL.endFill(); legL.x=-bw*0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2,0,lw,4); legR.endFill(); legR.x=bw*0.15;
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2,0,bw,14,bw*0.1); body.endFill(); body.y=-h+headH;
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4,0,bw*0.8,headH,headH*0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1,headH*0.38,1); head.drawCircle(bw*0.1,headH*0.38,1); head.endFill(); head.y=-h;
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0,0,2); dot.endFill(); dot.y=-h-6;
        const tx = new PIXI.Text(name, { fontFamily:'JetBrains Mono', fontSize:7, fill:col, fontWeight:'bold' }); tx.anchor.set(0.5,1); tx.y=-h-10;
        cont.addChild(sh,legL,legR,body,head,dot,tx);
        cont.eventMode='static'; cont.cursor='pointer'; cont.hitArea=new PIXI.Rectangle(-bw,-h-12,bw*2,h+16);
        cont.on('pointertap', () => { if(typeof UI!=='undefined') UI.selectModel({ id:'npc_'+name.toLowerCase().replace(/\s/g,'_'), name, isNPC:true, role:name+' — Power Grid', lab:'other', desc:'Power Grid facility staff.' }); });
        c.addChild(cont);
        this.avatars.push({ cont, head, legL, legR, _minX:x-40, _maxX:x+40, _phase:Math.random()*Math.PI*2, _walkTimer:0, _walkDir:0 });
    },

    update() {
        if (!this.scene) return;
        const dp = G.getDayPhase(); const night = dp>.83||dp<.25;
        const vp = document.getElementById('viewport');
        if(vp){let sky;if(dp<.22)sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';else if(dp<.30){const t=(dp-.22)/.08;sky=`linear-gradient(180deg,rgb(${8+t*40|0},${10+t*30|0},${30+t*40|0}),rgb(${15+t*80|0},${15+t*50|0},${40+t*50|0}) 50%,rgb(${20+t*120|0},${20+t*80|0},${40+t*30|0}))`;} else if(dp<.72) sky='linear-gradient(180deg,#2d4a7a,#5a8fbb 50%,#87b5d6)'; else if(dp<.84){const t=(dp-.72)/.12;sky=`linear-gradient(180deg,rgb(${45+t*30|0},${74-t*40|0},${122-t*60|0}),rgb(${90+t*80|0},${143-t*80|0},${187-t*100|0}) 50%,rgb(${135+t*60|0},${100-t*50|0},${50-t*10|0}))`;} else sky='linear-gradient(180deg,#080a1e,#0f0f28 50%,#141430)';vp.style.background=sky;}
        if(this.celestialGfx){this.celestialGfx.clear();if(night){let np=dp>0.83?(dp-0.83)/0.42:(dp+0.17)/0.42;this.celestialGfx.beginFill(0xe8e8d0);this.celestialGfx.drawCircle(G.vpW*np,40+Math.sin(np*Math.PI)*120,12);this.celestialGfx.endFill();}else{let dayP=(dp-0.25)/(0.83-0.25);this.celestialGfx.beginFill(0xffe066);this.celestialGfx.drawCircle(G.vpW*dayP,40+Math.sin(dayP*Math.PI)*120,15);this.celestialGfx.endFill();}}
        if(this.starsLayer){this.starsLayer.visible=night;if(night)this.starsLayer.children.forEach(s=>{s.alpha=.15+Math.abs(Math.sin(G.tick*.03+s._phase))*.5;});}
        this.avatars.forEach((av,ci) => { if(!av.cont||av.cont.destroyed) return; av._walkTimer--; if(av._walkTimer<=0){av._walkDir=(Math.random()>0.5)?1:-1;av._walkTimer=60+Math.random()*120;} const nx=av.cont.x+av._walkDir*0.3; if(nx>av._minX&&nx<av._maxX)av.cont.x=nx; if(av.head)av.head.y=-32+Math.sin(G.tick*0.15+av._phase)*1.5; if(av.legL)av.legL.y=Math.sin(G.tick*0.2+ci)*3; if(av.legR)av.legR.y=-Math.sin(G.tick*0.2+ci)*3; });
    }
};
