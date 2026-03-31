/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   INTERIOR RESIDENTIAL AI (Phase 6: Modular Extraction + Ghost Visuals Patch)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const InteriorResAI = {

    drawAvatar(m, x, y, container, floorIdx, isStatic = false, isCeo = false) {
        const cont = new PIXI.Container();
        const stg = getStage(m.rel, m.ret, m.phase);
        const sd = STAGES[stg] || STAGES.adult;
        const sc = sd.size;
        
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
        const finalSc = sc * paramScale;
        
        // ─── Proportions: identical to exterior updateCharStateVisuals ───
        const bw = Math.round(16 * finalSc);
        const h = Math.round(32 * finalSc);
        const headH = Math.round(h * sd.headR);
        const bodyH = h - headH - Math.round(4 * finalSc);
        const legH = Math.round(4 * finalSc);
        const eyeS = Math.max(1, bw * 0.08);
        
        const lab = LABS[m.lab] || LABS.other || { color: '#64748b' };
        const colHex = (isCeo && m.founderData && m.founderData.color)
            ? parseInt(m.founderData.color.slice(1), 16)
            : parseInt(lab.color.slice(1), 16);
        
        const isR = stg === 'retired';
        const isRm = stg === 'rumored';
        const suitCol = isR ? 0x667799 : colHex;
        const skinCol = isR ? 0xb8c0cc : isRm ? 0x8b5cf6 : 0xfdd8b5;
        const legCol = isR ? 0x7788aa : isRm ? 0x6b7280 : 0x3d2914;
        
        // Shadow
        const shadow = new PIXI.Graphics();
        shadow.beginFill(0x000000, 0.25);
        shadow.drawEllipse(0, 2, bw * 0.6, 3);
        shadow.endFill();

        // Head — stage-based headR, proportional corners, eyes + mouth
        const head = new PIXI.Graphics();
        head.beginFill(skinCol, isR ? 0.3 : isRm ? 0.5 : 1);
        head.drawRoundedRect(-bw * 0.4, 0, bw * 0.8, headH, headH * 0.25);
        head.endFill();
        head.beginFill(isR ? 0x88aaff : isRm ? 0xa78bfa : 0x2c1810);
        head.drawCircle(-bw * 0.1, headH * 0.38, eyeS);
        head.drawCircle(bw * 0.1, headH * 0.38, eyeS);
        head.endFill();
        head.beginFill(0x000000, 0.4);
        head.drawRect(-bw * 0.08, headH * 0.6, bw * 0.16, 1.5);
        head.endFill();
        head.y = -h;

        // Body
        const body = new PIXI.Graphics();
        body.beginFill(suitCol, isR ? 0.4 : isRm ? 0.4 : 1);
        body.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
        body.endFill();
        body.y = -h + headH;

        // Legs
        const lw = Math.max(2, bw * 0.25);
        const lh = Math.max(legH, 2);
        const legL = new PIXI.Graphics();
        legL.beginFill(legCol, isR ? 0.25 : 1);
        legL.drawRect(-lw / 2, 0, lw, lh);
        legL.endFill();
        legL.x = -bw * 0.15;
        legL.y = 0;
        const legR = new PIXI.Graphics();
        legR.beginFill(legCol, isR ? 0.25 : 1);
        legR.drawRect(-lw / 2, 0, lw, lh);
        legR.endFill();
        legR.x = bw * 0.15;
        legR.y = 0;

        // Status dot — color-coded by lifecycle stage
        const dot = new PIXI.Graphics();
        const dotCol = isR ? 0x88aaff : isRm ? 0x8b5cf6 : stg === 'baby' ? 0xff69b4 : 0x4ade80;
        dot.beginFill(dotCol);
        dot.drawCircle(0, 0, 2);
        dot.endFill();
        dot.y = -h - 6;

        // MoE ghost bodies
        const ghostL = new PIXI.Graphics();
        const ghostR = new PIXI.Graphics();
        ghostL.visible = false;
        ghostR.visible = false;
        if (isMoE && !isR) {
            ghostL.beginFill(suitCol, 0.5);
            ghostL.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
            ghostL.endFill();
            ghostR.beginFill(suitCol, 0.5);
            ghostR.drawRoundedRect(-bw / 2, 0, bw, Math.max(bodyH, 4), bw * 0.1);
            ghostR.endFill();
            ghostL.blendMode = PIXI.BLEND_MODES.ADD;
            ghostR.blendMode = PIXI.BLEND_MODES.ADD;
            ghostL.visible = true;
            ghostR.visible = true;
            ghostL.y = body.y;
            ghostR.y = body.y;
            ghostL.x = -bw * 0.2;
            ghostR.x = bw * 0.2;
            ghostL.alpha = 0.4;
            ghostR.alpha = 0.4;
        }

        cont.addChild(shadow, ghostL, ghostR, legL, legR, body, head, dot);
        cont.x = x; 
        cont.y = y;
        
        cont.alpha = isR ? 0.6 : isRm ? 0.8 : 1.0;
        cont.blendMode = isR ? PIXI.BLEND_MODES.ADD : PIXI.BLEND_MODES.NORMAL;
        
        cont.eventMode = 'static'; 
        cont.cursor = 'pointer';
        cont.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel(m); });

        container.addChild(cont);

        const agent = { 
            m, cont, head, body, legL, legR, dot, shadow, ghostL, ghostR, isMoE,
            state: 'working', timer: 0, deskX: x, floorIdx, speed: 1.5,
            isStaticRole: isStatic,
            bedX: 0, bedY: 0
        };
        
        this.avatars.push(agent);
        return agent;
    },

    spawnBubble(av, msgOverride = null) {
        if (!this.layer || !this.layer.visible) return;

        const msgs = [
            "Calculating...", "Optimizing...", "Compiling...", 
            "Data incoming.", "Adjusting weights.", "Processing."
        ];
        const msg = msgOverride || msgs[Math.floor(Math.random() * msgs.length)];
        
        const bCont = new PIXI.Container();
        const bg = new PIXI.Graphics();
        const txt = new PIXI.Text(msg, { 
            fontFamily: 'JetBrains Mono', fontSize: 9, fill: 0x000000, fontWeight: 'bold' 
        });
        
        txt.anchor.set(0.5, 1);
        txt.y = -6;
        
        bg.beginFill(0xffffff);
        bg.drawRoundedRect(-txt.width/2 - 6, -txt.height - 10, txt.width + 12, txt.height + 8, 4);
        bg.endFill();
        bg.beginFill(0xffffff);
        bg.moveTo(-4, -4); bg.lineTo(4, -4); bg.lineTo(0, 2); bg.endFill();
        
        bCont.addChild(bg, txt);
        
        const finalSc = STAGES[getStage(av.m.rel, av.m.ret, av.m.phase)]?.size || 1;
        const h = Math.round(32 * finalSc);
        bCont.x = av.cont.x;
        bCont.y = av.cont.y - h - 10;
        
        this.scene.addChild(bCont);
        this.bubbles.push({ cont: bCont, life: 120 });
    },

    animateWalk(av) {
        av.head.y = -32 + 4 + Math.sin(G.tick * 0.2) * 1.5;
        av.body.y = -32 + 12 + 4 + Math.abs(Math.sin(G.tick * 0.2)) * 1.5;
        if (av.legL && av.legR) {
            av.legL.y = Math.sin(G.tick * 0.3) * 3;
            av.legR.y = -Math.sin(G.tick * 0.3) * 3;
        }
    }
};

