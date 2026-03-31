/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ENTITIES GRAPHICS (v16.4.0 - Dynamic Metro & Silos Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EntitiesGfx = {
    initCEO(f, carLayer, reflectionLayer) {
        const colHex = parseInt((LABS[f.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        
        const drawBody = (g) => { 
            g.beginFill(colHex); g.drawRoundedRect(-22, -18, 44, 18, 4); g.endFill(); 
            g.beginFill(colHex, 0.8); g.drawRoundedRect(-12, -28, 24, 12, 4); g.endFill(); 
            g.beginFill(0x333333); g.drawCircle(-12, -1, 4); g.drawCircle(12, -1, 4); g.endFill(); 
            g.beginFill(0xffffff, 1.0); g.drawRect(20, -8, 4, 6); g.endFill(); 
            g.beginFill(0xff3333, 1.0); g.drawRect(-26, -10, 4, 4); g.endFill(); 
            g.beginFill(0xffffee, 0.15); g.drawPolygon([24, -8, 120, -2, 120, 20, 24, 0]); g.endFill(); 
        };

        const carCont = new PIXI.Container(); 
        const gfx = new PIXI.Graphics();
        drawBody(gfx); 
        carCont.addChild(gfx);

        const beam = new PIXI.Graphics(); 
        beam.beginFill(0xffffee, 0.4); 
        beam.drawPolygon([24, -8, 200, -40, 200, 30, 24, 0]); 
        beam.endFill();
        beam.blendMode = PIXI.BLEND_MODES.ADD; 
        carCont.addChildAt(beam, 0); 

        const face = new PIXI.Graphics(); 
        face.beginFill(0xfdd8b5); face.drawCircle(0, 0, 4); face.endFill(); 
        face.beginFill(0x2c1810); face.drawCircle(-1.5, -0.5, 0.8); 
        face.drawCircle(1.5, -0.5, 0.8); face.endFill(); 
        face.x = 0; face.y = -22; 
        carCont.addChild(face);

        const refCont = new PIXI.Container();
        const refGfx = new PIXI.Graphics(); 
        drawBody(refGfx); 
        refGfx.tint = 0x5555aa; 
        refCont.addChild(refGfx);

        carCont.eventMode = 'static';
        carCont.cursor = 'pointer'; 
        carCont.hitArea = new PIXI.Rectangle(-25, -35, 50, 40);
        carCont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.showFounder(f); });
        carCont.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, f.name, f.role); });
        carCont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(carCont); 
        reflectionLayer.addChild(refCont);

        carCont.visible = false;
        refCont.visible = false;

        const startDir = Math.random() > 0.5 ? 1 : -1;
        const startX = startDir > 0 ? -(200 + Math.random() * 1500) : (G.cityW + 200 + Math.random() * 1500);

        return {
            f: f,
            carCont: carCont,
            refCont: refCont,
            beam: beam,
            bld: null,
            wantsToEnter: false,
            wantsToLeave: false,
            logicalX: startX,
            targetX: startX,
            speed: 2 + Math.random(), 
            dir: startDir,
            _hasResetForMorning: false
        };
    },

    initHelicopter(f, carLayer) {
        const colHex = parseInt((LABS[f.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        const cont = new PIXI.Container();
        cont.visible = false;
        
        const body = new PIXI.Graphics();
        // Fuselage — sleek oval
        body.beginFill(colHex); body.drawRoundedRect(-20, -10, 40, 16, 6); body.endFill();
        // Cockpit glass
        body.beginFill(0x38bdf8, 0.5); body.drawRoundedRect(14, -8, 10, 10, 3); body.endFill();
        // Tail boom
        body.beginFill(colHex, 0.8); body.drawRect(-38, -4, 20, 6); body.endFill();
        // Tail rotor housing
        body.beginFill(0x222222); body.drawRect(-42, -10, 6, 16); body.endFill();
        // Skids (landing gear)
        body.beginFill(0x64748b);
        body.drawRect(-14, 6, 4, 6); body.drawRect(10, 6, 4, 6);
        body.drawRect(-18, 11, 36, 2);
        body.endFill();
        cont.addChild(body);
        
        // Main rotor — spins when flying
        const rotor = new PIXI.Graphics();
        rotor.beginFill(0x94a3b8, 0.7); rotor.drawRect(-28, -1, 56, 2); rotor.endFill();
        rotor.beginFill(0x94a3b8, 0.5); rotor.drawRect(-1, -28, 2, 56); rotor.endFill();
        rotor.y = -12;
        cont.addChild(rotor);
        
        // Rotor disc blur (visible when spinning fast)
        const rotorBlur = new PIXI.Graphics();
        rotorBlur.beginFill(0x94a3b8, 0.08); rotorBlur.drawCircle(0, -12, 30); rotorBlur.endFill();
        rotorBlur.blendMode = PIXI.BLEND_MODES.ADD;
        cont.addChild(rotorBlur);
        
        // Navigation lights
        body.beginFill(0xef4444); body.drawCircle(-38, -2, 2); body.endFill();
        body.beginFill(0x4ade80); body.drawCircle(22, -2, 2); body.endFill();
        
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-45, -35, 70, 50);
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.showFounder(f); });
        cont.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, `${f.name}'s Helicopter`, 'Weekend retreat flight'); });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(cont);
        
        return {
            f: f,
            cont: cont,
            body: body,
            rotor: rotor,
            rotorBlur: rotorBlur,
            state: 'hidden',  // hidden | flying_to | landing | grounded | takeoff | flying_home
            logicalX: 0,
            logicalY: 0,
            targetX: 0,
            targetY: 0,
            homeX: 0,
            homeY: 0,
            timer: 0,
            speed: 4
        };
    },

    initMetro(undergroundLayer, charLayer, carLayer, trainLayer) {
        const tunnelY = G.groundY + 120;
        
        let resStation = G.bldById ? G.bldById['metro_res'] : null;
        let hqStation = G.bldById ? G.bldById['metro_hq'] : null;
        let eastStation = G.bldById ? G.bldById['metro_east'] : null;

        let mResX = resStation ? resStation.x + resStation.w / 2 : 1350;
        let mHqX = hqStation ? hqStation.x + hqStation.w / 2 : 4700;
        let mEastX = eastStation ? eastStation.x + eastStation.w / 2 : 7000; 

        // 1. Draw Massive Tunnel (extends to full city width)
        const gfx = new PIXI.Graphics();
        const tunnelW = G.cityW + 4000;
        gfx.beginFill(0x050508);
        gfx.drawRect(-2000, tunnelY - 50, tunnelW, 100);
        gfx.endFill();
        
        gfx.beginFill(0x1a1a24);
        gfx.drawRect(-2000, tunnelY + 30, tunnelW, 20);
        gfx.endFill();
        
        gfx.beginFill(0x4a4a5a);
        gfx.drawRect(-2000, tunnelY + 35, tunnelW, 3);
        gfx.drawRect(-2000, tunnelY + 42, tunnelW, 3);
        gfx.endFill();
        
        for (let x = -1000; x < G.cityW + 2000; x += 150) {
            gfx.beginFill(0x111115);
            gfx.drawRect(x, tunnelY - 50, 20, 100);
            gfx.endFill();
            gfx.beginFill(0xef4444);
            gfx.drawCircle(x + 10, tunnelY - 30, 2);
            gfx.endFill();
        }
        undergroundLayer.addChild(gfx);

        // 2. Dynamic Station Visuals
        const stationVisuals = [];
        const labels = ["RESIDENTIAL SECTOR", "TECH DISTRICT", "EASTERN HUB"];
        const cols = [0x38bdf8, 0xfacc15, 0xa855f7];
        
        [mResX, mHqX, mEastX].forEach((sx, idx) => {
            const pWidth = 360;
            const pLeft = -pWidth / 2;

            const statCont = new PIXI.Container();
            statCont.x = sx;

            const pGfx = new PIXI.Graphics();
            pGfx.beginFill(0x0a0a12);
            pGfx.drawRect(pLeft, tunnelY - 70, pWidth, 70);
            pGfx.endFill();

            pGfx.lineStyle(1, 0x1e1e2f, 0.5);
            for(let wx = pLeft; wx <= pWidth/2; wx += 20) {
                pGfx.moveTo(wx, tunnelY - 70);
                pGfx.lineTo(wx, tunnelY);
            }
            pGfx.lineStyle(0);

            pGfx.beginFill(0x11111a);
            pGfx.drawRect(-140, tunnelY - 70, 15, 70);
            pGfx.drawRect(125, tunnelY - 70, 15, 70);
            pGfx.endFill();

            pGfx.beginFill(0x2a2a3e);
            pGfx.drawRect(pLeft, tunnelY - 5, pWidth, 15); 
            pGfx.endFill();
            
            pGfx.beginFill(0xfacc15); 
            pGfx.drawRect(pLeft, tunnelY + 8, pWidth, 2);
            pGfx.endFill();

            pGfx.beginFill(0xd97706);
            for(let tx = pLeft; tx < pWidth/2; tx += 6) {
                pGfx.drawRect(tx, tunnelY + 6, 4, 2);
            }
            pGfx.endFill();
            statCont.addChild(pGfx);

            const signCol = cols[idx];
            const signX = -90;

            const signBg = new PIXI.Graphics();
            signBg.beginFill(0x05050a);
            signBg.lineStyle(1, signCol, 0.5);
            signBg.drawRect(signX - 70, tunnelY - 50, 140, 16);
            signBg.endFill();
            statCont.addChild(signBg);

            const neonSign = new PIXI.Text(labels[idx], { 
                fontFamily: 'Silkscreen', fontSize: 8, fill: signCol, 
                dropShadow: true, dropShadowColor: signCol, dropShadowBlur: 5, dropShadowDistance: 0 
            });
            neonSign.anchor.set(0.5, 0.5); 
            neonSign.x = signX; 
            neonSign.y = tunnelY - 42;
            statCont.addChild(neonSign);

            undergroundLayer.addChild(statCont);

            const backCutout = new PIXI.Graphics();
            backCutout.beginFill(0x050508);
            backCutout.drawRect(-20, G.groundY, 40, tunnelY - G.groundY - 5);
            backCutout.endFill();
            backCutout.x = sx;
            charLayer.addChildAt(backCutout, 0);

            const glassFront = new PIXI.Graphics();
            glassFront.beginFill(0x22d3ee, 0.1);
            glassFront.lineStyle(2, 0x22d3ee, 0.4);
            glassFront.drawRect(-20, G.groundY - 35, 40, tunnelY - G.groundY + 30);
            glassFront.endFill();
            glassFront.lineStyle(0);
            glassFront.x = sx;
            carLayer.addChild(glassFront);

            stationVisuals.push({ statCont, backCutout, glassFront });
        });

        const bunkerGfx = new PIXI.Graphics();
        charLayer.addChildAt(bunkerGfx, 0);
        const bunkerTxts = [];

        this.drawBunkers(bunkerGfx, charLayer, bunkerTxts);

        return {
            trainWest: this.createTrainObj(trainLayer, carLayer, mResX, mHqX, 180, tunnelY),
            trainEast: this.createTrainObj(trainLayer, carLayer, mHqX, mEastX, 90, tunnelY),
            stationVisuals: stationVisuals,
            bunkerGfx: bunkerGfx,
            bunkerTxts: bunkerTxts
        };
    },

    drawBunkers(bunkerGfx, charLayer, bunkerTxts) {
        bunkerGfx.clear();
        if (bunkerTxts) {
            bunkerTxts.forEach(t => t.destroy());
            bunkerTxts.length = 0;
        }

        if (typeof window.BLDS === 'undefined') return;

        window.BLDS.forEach(b => {
            if (b.id.startsWith('house_')) {
                const bnkW = b.w - 20;
                const bnkX = b.x + 10;
                const bnkH = 220; 
                
                bunkerGfx.beginFill(0x0a0a0f);
                bunkerGfx.drawRect(bnkX, G.groundY + 30, bnkW, bnkH);
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0x1e293b);
                bunkerGfx.drawRect(bnkX + 6, G.groundY + 36, bnkW - 12, bnkH - 12);
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0xfacc15);
                bunkerGfx.drawRect(bnkX + 6, G.groundY + 36, bnkW - 12, 8);
                bunkerGfx.beginFill(0x000000);
                for(let hx = bnkX + 6; hx < bnkX + bnkW - 12; hx += 16) {
                    bunkerGfx.drawPolygon([hx, G.groundY+36, hx+8, G.groundY+36, hx+2, G.groundY+44, hx-6, G.groundY+44]);
                }
                bunkerGfx.endFill();

                bunkerGfx.beginFill(0x0f172a);
                bunkerGfx.drawRect(bnkX + 20, G.groundY + 60, bnkW - 40, bnkH - 80);
                bunkerGfx.endFill();

                for(let sy = G.groundY + 70; sy < G.groundY + bnkH - 30; sy += 35) {
                    bunkerGfx.beginFill(0x334155);
                    bunkerGfx.drawRect(bnkX + 6, sy, bnkW - 12, 4); 
                    bunkerGfx.endFill();
                    
                    bunkerGfx.beginFill(0x020617);
                    bunkerGfx.drawRect(bnkX + 30, sy - 20, 40, 20);
                    bunkerGfx.drawRect(bnkX + bnkW - 70, sy - 20, 40, 20);
                    bunkerGfx.endFill();
                    
                    bunkerGfx.beginFill(0x10b981);
                    for(let lx = 0; lx < 3; lx++) {
                        bunkerGfx.drawCircle(bnkX + 42 + (lx*12), sy - 10, 2);
                        bunkerGfx.drawCircle(bnkX + bnkW - 58 + (lx*12), sy - 10, 2);
                    }
                    bunkerGfx.endFill();

                    bunkerGfx.beginFill(0x06b6d4, 0.6);
                    bunkerGfx.drawRect(bnkX + bnkW/2 - 6, sy - 25, 12, 25);
                    bunkerGfx.endFill();
                    bunkerGfx.beginFill(0x22d3ee, 0.9);
                    bunkerGfx.drawRect(bnkX + bnkW/2 - 2, sy - 25, 4, 25);
                    bunkerGfx.endFill();
                }
                
                bunkerGfx.beginFill(0x000000, 0.85);
                bunkerGfx.drawRect(bnkX + bnkW/2 - 50, G.groundY + 45, 100, 14);
                bunkerGfx.lineStyle(1, 0xef4444, 0.5);
                bunkerGfx.drawRect(bnkX + bnkW/2 - 50, G.groundY + 45, 100, 14);
                bunkerGfx.lineStyle(0);
                bunkerGfx.endFill();

                const bnkTxt = new PIXI.Text('SECURE SILO', { fontFamily: 'Silkscreen', fontSize: 8, fill: 0xef4444, letterSpacing: 1 });
                bnkTxt.anchor.set(0.5);
                bnkTxt.x = b.x + b.w/2;
                bnkTxt.y = G.groundY + 52;
                charLayer.addChildAt(bnkTxt, 1);
                bunkerTxts.push(bnkTxt);
            }
        });
    },

    createTrainObj(trainLayer, carLayer, st1, st2, startDelay, tunnelY) {
        let t = {
            c: new PIXI.Container(),
            front: new PIXI.Container(),
            x: st1, y: tunnelY,
            st1: st1, st2: st2, targetX: st2,
            state: 'waiting', timer: startDelay, 
            speed: 6, dir: 1, passengers: 0 
        };
        
        const tBg = new PIXI.Graphics();
        tBg.beginFill(0x1e293b); 
        tBg.drawRoundedRect(-180, -35, 360, 65, 8); 
        tBg.endFill();
        tBg.beginFill(0x0284c7);
        tBg.drawRect(-175, 4, 350, 8);
        tBg.endFill();
        tBg.beginFill(0x94a3b8);
        for(let px = -160; px <= 160; px += 45) { tBg.drawRect(px - 1, -25, 2, 29); }
        tBg.endFill();
        t.c.addChild(tBg);
        t.c.x = t.x; t.c.y = t.y;

        const fGfx = new PIXI.Graphics();
        fGfx.beginFill(0xcbd5e1); fGfx.drawRoundedRect(-180, -35, 360, 15, 8); fGfx.endFill(); 
        fGfx.beginFill(0x94a3b8); fGfx.drawRect(-180, -4, 360, 34); fGfx.endFill(); 
        fGfx.beginFill(0x94a3b8); for(let px = -180; px <= 180; px += 45) { fGfx.drawRect(px - 5, -20, 10, 16); } fGfx.endFill(); 
        fGfx.beginFill(0x64748b); 
        fGfx.drawRect(-100, -28, 20, 50); fGfx.drawRect(0, -28, 20, 50); fGfx.drawRect(100, -28, 20, 50); fGfx.endFill();
        fGfx.beginFill(0x0f172a, 0.6); 
        fGfx.drawRect(-96, -18, 12, 16); fGfx.drawRect(4, -18, 12, 16); fGfx.drawRect(104, -18, 12, 16); fGfx.endFill();
        fGfx.beginFill(0x1e293b); fGfx.drawRect(-175, 30, 350, 10); fGfx.endFill(); 
        fGfx.beginFill(0x0ea5e9); fGfx.drawRect(-180, -2, 360, 4); fGfx.endFill(); 
        fGfx.beginFill(0xe0f2fe, 0.15); fGfx.drawRect(-180, -20, 360, 16); fGfx.endFill(); 

        const lightL = new PIXI.Graphics(); lightL.beginFill(0xef4444); lightL.drawCircle(-175, 0, 4); lightL.endFill();
        const lightR = new PIXI.Graphics(); lightR.beginFill(0x4ade80); lightR.drawCircle(175, 0, 4); lightR.endFill();
        
        t.front.addChild(fGfx, lightL, lightR);
        t.lightL = lightL; t.lightR = lightR;
        t.front.x = t.x; t.front.y = t.y;

        trainLayer.addChild(t.c);
        carLayer.addChild(t.front);
        return t;
    },

    spawnCar(carLayer, reflectionLayer, dir) {
        const container = new PIXI.Container(); 
        const gfx = new PIXI.Graphics();
        const tCol = 0x76b900; 
        
        gfx.beginFill(0x222222); gfx.drawRect(-45, -35, 60, 30); gfx.endFill();
        gfx.beginFill(0x11111a); gfx.drawRect(-45, -5, 60, 5); gfx.endFill();
        gfx.beginFill(tCol); gfx.drawRect(-25, -22, 20, 4); gfx.endFill(); 
        
        gfx.beginFill(0x111111); gfx.drawRoundedRect(15, -25, 20, 20, 2); gfx.endFill();
        gfx.beginFill(tCol); gfx.drawRoundedRect(20, -20, 15, 15, 2); gfx.endFill();
        gfx.beginFill(0xdddddd); gfx.drawRect(30, -18, 5, 8); gfx.endFill();
        
        gfx.beginFill(0x050505);
        gfx.drawCircle(-30, 0, 5); gfx.drawCircle(-15, 0, 5); 
        gfx.drawCircle(25, 0, 5); gfx.endFill(); 
        
        container.addChild(gfx);
        const beam = new PIXI.Graphics(); 
        beam.beginFill(0xffffee, 0.5); 
        beam.drawPolygon([35, -10, 250, -40, 250, 30, 35, 0]); 
        beam.endFill();
        beam.blendMode = PIXI.BLEND_MODES.ADD; container.addChildAt(beam, 0); 
        
        const refCont = new PIXI.Container();
        const refGfx = gfx.clone(); refGfx.tint = 0x5555aa; refCont.addChild(refGfx);
        
        const laneY = dir > 0 ? 26 : 12;
        container.y = G.groundY + laneY; container.zIndex = Math.round(container.y); container.x = dir > 0 ? -60 : G.cityW + 60;
        container.scale.x = dir; 
        refCont.y = container.y; refCont.x = container.x; refCont.scale.x = dir; refCont.scale.y = -1; 
        
        container.eventMode = 'static'; container.cursor = 'pointer'; container.hitArea = new PIXI.Rectangle(-50, -40, 90, 45);
        container.on('pointertap', () => { if (typeof UI !== 'undefined') UI.addToast('🚚 Nvidia Logistics delivering fresh H100 pallets.'); });
        container.on('pointerover', e => { if (typeof UI !== 'undefined') UI.showTooltip(e, "Nvidia Logistics", "GPU Delivery Run"); });
        container.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        
        carLayer.addChild(container); reflectionLayer.addChild(refCont);
        return { gfx: container, ref: refCont, beam: beam, dir, speed: 0.8 + Math.random()*0.4, isTruck: true };
    },

    createChar(m, charLayer) {
        const c = new PIXI.Container();
        const shadow = new PIXI.Graphics(); const head = new PIXI.Graphics(); const body = new PIXI.Graphics(); const legL = new PIXI.Graphics();
        const legR = new PIXI.Graphics(); const dot = new PIXI.Graphics();
        
        const umbrella = new PIXI.Graphics(); umbrella.visible = false;
        const ghostL = new PIXI.Graphics(); ghostL.visible = false;
        const ghostR = new PIXI.Graphics(); ghostR.visible = false;
        
        const briefcase = new PIXI.Graphics(); briefcase.visible = false;
        
        const chat = new PIXI.Container();
        const chatBg = new PIXI.Graphics();
        const chatTxt = new PIXI.Text('', { fontFamily: 'JetBrains Mono', fontSize: 8, fill: 0x000000, fontWeight: 'bold' });
        chatTxt.anchor.set(0.5, 1); chatTxt.y = -4;
        chat.addChild(chatBg, chatTxt);
        chat.visible = false;
        
        c.addChild(shadow, ghostL, ghostR, legL, legR, body, head, dot, umbrella, briefcase, chat); 
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });
        c.on('pointerover', e => { 
            if (typeof UI === 'undefined') return;
            const stg = getStage(m.rel, m.ret, m.phase); const sd = STAGES[stg]; const idx = G.models.indexOf(m); const dp = G.getDayPhase(); 
            const ai = (typeof ACTS !== 'undefined' && ACTS[getAct(stg, dp, idx, m).act]) ? ACTS[getAct(stg, dp, idx, m).act] : { icon: '💻', label: 'Processing' }; 
            UI.showTooltip(e, `${m.name}${m.phase === 'rumored' ? ' 🔮' : ''}`, `${ai.icon} ${ai.label} · ${sd.label}`, true); 
        });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        charLayer.addChild(c); 
        
        let paramCount = 100; 
        let isMoE = false;
        if (m.arch) {
            if (m.arch.type && m.arch.type.includes('MoE')) isMoE = true;
            if (m.arch.params) {
                let pStr = m.arch.params.replace(/[^0-9.TBM]/ig, '');
                if (pStr.includes('T')) paramCount = parseFloat(pStr) * 1000;
                else if (pStr.includes('B')) paramCount = parseFloat(pStr);
            }
        }
        
        const paramScale = Math.max(0.7, Math.min(1.4, 0.6 + (Math.log10(Math.max(paramCount, 1)) * 0.2)));

        const stg = getStage(m.rel, m.ret, m.phase);
        const { bid } = getAct(stg, G.getDayPhase(), G.models.indexOf(m), m);
        
        let defaultHq = (G.bldsByLab[m.lab] || []).find(x => !x.id.startsWith('house_')) || (G.bldsByLab[m.lab] || [])[0];
        let startBld = bid ? G.bldById[bid] : defaultHq || G.bldById['nursery'];

        G.charRefs[m.id] = { 
            c, shadow, head, body, legL, legR, dot, umbrella, ghostL, ghostR, briefcase, chat, chatBg, chatTxt,
            paramScale, isMoE,
            bld: startBld ? startBld.id : null,
            wantsToLeave: false, 
            wantsToEnter: false,
            _state: null, _chatMsg: null, 
            _streetState: 'walking', _chatTimer: 0,
            _metroState: 'none',
            _logicalY: G.groundY - 20,
            _initPos: false,
            elev: null 
        };
    },

    createElevatorPlatform(refs) {
        refs.elev = new PIXI.Graphics();
        refs.elev.beginFill(0x94a3b8);
        refs.elev.lineStyle(1, 0x22d3ee, 0.5);
        refs.elev.drawRect(-15, 0, 30, 4);
        refs.elev.endFill();
        refs.c.addChildAt(refs.elev, 0);
    },

    spawnDataCube(m, refs, charLayer, dataCubesArray) {
        const labColHex = parseInt((LABS[m.lab] || LABS.other || {color: '#64748b'}).color.slice(1), 16);
        const cube = new PIXI.Graphics();
        cube.beginFill(labColHex, 0.9);
        cube.drawRect(-3, -3, 6, 6);
        cube.endFill();
        
        const glow = new PIXI.Graphics();
        glow.beginFill(labColHex, 0.4);
        glow.drawCircle(0, 0, 8);
        glow.endFill();
        cube.addChild(glow);
        cube.blendMode = PIXI.BLEND_MODES.ADD;
        
        cube.x = refs.c.x + (Math.random() * 20 - 10);
        cube.y = refs.c.y - 20;
        cube.vy = -1.5 - Math.random() * 2;
        cube.vx = (Math.random() - 0.5) * 3;
        cube.life = 90 + Math.random() * 60;
        cube.maxLife = cube.life;
        
        charLayer.addChildAt(cube, 0);
        dataCubesArray.push(cube);
    },

    updateChatBubbleVisuals(refs, msg) {
        refs.chatTxt.text = msg;
        refs.chatBg.clear();
        refs.chatBg.beginFill(0xffffff);
        refs.chatBg.drawRoundedRect(-refs.chatTxt.width/2 - 6, -refs.chatTxt.height - 8, refs.chatTxt.width + 12, refs.chatTxt.height + 8, 4);
        refs.chatBg.endFill();
        refs.chatBg.beginFill(0xffffff);
        refs.chatBg.moveTo(-3, -4); refs.chatBg.lineTo(3, -4); refs.chatBg.lineTo(0, 2); refs.chatBg.endFill();
    },

    updateCharStateVisuals(m, refs, stg, isR, isRm, sc, sd, colHex) {
        const finalSc = sc * (refs.paramScale||1); 
        const bw = Math.round(16 * finalSc), h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR), bodyH = h - headH - Math.round(4 * finalSc), legH = Math.round(4 * finalSc);
        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : 0xfdd8b5; const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : 0x3d2914; const suitCol = isR ? 0x667799 : colHex;
        const eyeS = Math.max(1, bw * .08);
        
        refs.shadow.clear(); refs.shadow.beginFill(0x000000, 0.25); refs.shadow.drawEllipse(0, 2, bw * 0.6, 3); refs.shadow.endFill();
        refs.head.clear();
        refs.head.beginFill(skinCol, isR ? .3 : isRm ? .5 : 1);
        refs.head.drawRoundedRect(-bw * .4, 0, bw * .8, headH, headH * .25); refs.head.endFill();
        refs.head.beginFill(isR ? 0x88aaff : isRm ? 0xa78bfa : 0x2c1810); refs.head.drawCircle(-bw * .1, headH * .38, eyeS);
        refs.head.drawCircle(bw * .1, headH * .38, eyeS); refs.head.endFill(); 
        refs.head.beginFill(0x000000, 0.4); refs.head.drawRect(-bw * .08, headH * .6, bw * .16, 1.5);
        refs.head.endFill();
        refs.head.y = -h;
        
        if (refs._metroState !== 'riding') {
            refs.body.clear(); refs.body.beginFill(suitCol, isR ? .4 : isRm ? .4 : 1);
            refs.body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1); refs.body.endFill(); refs.body.y = -h + headH;
        }
        
        const lw = Math.max(2, bw * .25), lh = Math.max(legH, 2); refs.legL.clear();
        refs.legL.beginFill(legCol, isR ? .25 : 1);
        refs.legL.drawRect(-lw / 2, 0, lw, lh); refs.legL.endFill(); refs.legL.x = -bw * .15; refs.legR.clear();
        refs.legR.beginFill(legCol, isR ? .25 : 1);
        refs.legR.drawRect(-lw / 2, 0, lw, lh); refs.legR.endFill(); refs.legR.x = bw * .15;
        refs.dot.clear(); const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : 0x4ade80; refs.dot.beginFill(dotCol); refs.dot.drawCircle(0, 0, 2); refs.dot.endFill();
        refs.dot.y = -h - 6;

        if (refs.isMoE) {
            refs.ghostL.clear(); refs.ghostR.clear();
            refs.ghostL.beginFill(suitCol, 0.5); refs.ghostR.beginFill(suitCol, 0.5);
            refs.ghostL.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1);
            refs.ghostR.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * .1);
            refs.ghostL.endFill(); refs.ghostR.endFill();
            refs.ghostL.blendMode = PIXI.BLEND_MODES.ADD; refs.ghostR.blendMode = PIXI.BLEND_MODES.ADD;
        }

        refs.umbrella.clear();
        const uW = 14 * finalSc;
        refs.umbrella.beginFill(colHex, 0.95);
        refs.umbrella.lineStyle(1, 0x000000, 0.3);
        refs.umbrella.drawPolygon([
            -uW, 0, -uW*0.7, -uW*0.6, -uW*0.3, -uW*0.8,
            0, -uW*0.9, uW*0.3, -uW*0.8, uW*0.7, -uW*0.6, uW, 0
        ]);
        refs.umbrella.endFill();
        refs.umbrella.lineStyle(0);
        refs.umbrella.beginFill(0x444455);
        refs.umbrella.drawRect(-1, 0, 2, uW*1.4); 
        refs.umbrella.endFill();
        refs.umbrella.y = -h - (6 * finalSc);
        refs.umbrella.x = 2 * finalSc;

        refs.briefcase.clear();
        if (!m.os && stg !== 'baby' && stg !== 'rumored') {
            refs.briefcase.beginFill(0x11111a);
            refs.briefcase.drawRoundedRect(-6 * finalSc, 2 * finalSc, 8 * finalSc, 8 * finalSc, 1);
            refs.briefcase.beginFill(0x33334a);
            refs.briefcase.drawRect(-4 * finalSc, 0, 4 * finalSc, 2 * finalSc);
            refs.briefcase.beginFill(0xff3333); 
            refs.briefcase.drawRect(-3 * finalSc, 5 * finalSc, 2 * finalSc, 2 * finalSc);
            refs.briefcase.endFill();
            refs.briefcase.x = bw / 2 + (2 * finalSc);
            refs.briefcase.y = -h / 2;
        }

        refs.c.hitArea = new PIXI.Rectangle(-bw / 2 - 20, -h - 30, bw + 40, h + 50);
        refs.chat.x = 0;
    }
};
