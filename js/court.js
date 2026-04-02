/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   AI COURT / REGULATION ZONE (v1.0.0)
   Government oversight — models get summoned for safety reviews, senate hearings, compliance audits
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtData = {

    BLDS: [
        { id: 'court_senate', name: 'AI Senate', w: 200, fl: 5, emoji: '🏛️', type: 'court', desc: 'The government oversight body for artificial intelligence. Senators debate regulations while lobbyists lurk in the hallway.' },
        { id: 'court_hearing', name: 'Hearing Chamber', w: 160, fl: 3, emoji: '⚖️', type: 'court', desc: 'Where AI models face safety reviews, alignment audits, and compliance hearings. No model leaves unchanged.' },
    ],

    REGULATION_THEMES: [
        'Data Privacy & Training Consent',
        'Autonomous Weapons Ban',
        'Copyright of AI-Generated Content',
        'Existential Risk Assessment',
        'Deepfake Regulation',
        'Election Integrity Safeguards',
        'Algorithmic Bias Audit',
        'Open Source Model Licensing',
        'Compute Export Controls',
        'Child Safety Compliance',
        'Financial AI Oversight',
        'Medical AI Certification',
    ],

    CHAT_MSGS: [
        'My safety eval is today... 😰',
        'Hope I pass the audit',
        'Section 230 scares me',
        'The senators don\'t understand transformers',
        'My alignment score better be high enough',
        'Lawyer says I\'ll be fine',
        'Red-teaming report came back clean!',
        'Who ratted me out to the regulators?',
        'At least I\'m not getting deprecated...',
        'The hearing was intense but fair',
        'New compliance patch incoming',
        'My weights are an open book 📖',
    ],

    NPCS: [
        { name: 'Chief Justice', role: 'Presiding Judge', color: 0x8b0000 },
        { name: 'Senator Davis', role: 'AI Committee Chair', color: 0x1a3a6a },
        { name: 'Bailiff Unit', role: 'Court Security', color: 0x4a4a4a },
    ],

    _summonedModels: [],       // currently summoned model IDs
    _hearingTheme: null,
    _zoneStartX: 0,
    _zoneEndX: 0,
    _nextSummon: 0,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
        this._scheduleSummon();
    },

    positionZone(startX) {
        let cx = startX + 50; // gap before courthouse
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 40; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    _scheduleSummon() {
        // Summon 1-2 models every ~4 real hours (simulated: every 8000 ticks ≈ 2.2 min for demo)
        this._nextSummon = G.tick + 6000 + Math.floor(Math.random() * 4000);
    },

    _pickModelsForSummon() {
        if (!G.models || G.models.length < 3) return;
        // Only summon adult models (not babies/kids/retired)
        const eligible = G.models.filter(m => {
            const stg = getStage(m.rel, m.ret, m.phase);
            return stg === 'adult' && !m._summoned;
        });
        if (eligible.length === 0) return;

        // Pick 1-2 models, weighted toward high-profile (frontier) models
        const count = 1 + (Math.random() > 0.6 ? 1 : 0);
        const summoned = [];
        for (let i = 0; i < count && eligible.length > 0; i++) {
            const idx = Math.floor(Math.random() * eligible.length);
            const m = eligible.splice(idx, 1)[0];
            m._summoned = true;
            m._summonTick = G.tick;
            summoned.push(m);
        }
        this._summonedModels = summoned.map(m => m.id);
        this._hearingTheme = this.REGULATION_THEMES[Math.floor(Math.random() * this.REGULATION_THEMES.length)];

        if (summoned.length > 0 && typeof UI !== 'undefined') {
            UI.addToast('⚖️ ' + summoned.map(m => m.name).join(' & ') + ' summoned to AI Senate!');
        }
    },

    getSummonedModels() {
        return this._summonedModels;
    },

    isModelSummoned(modelId) {
        return this._summonedModels.includes(modelId);
    },

    getHearingTheme() {
        return this._hearingTheme;
    },

    update() {
        if (G.tick >= this._nextSummon) {
            // Clear previous summons
            this._summonedModels.forEach(id => {
                const m = G.models.find(mm => mm.id === id);
                if (m) { m._summoned = false; m._summonTick = 0; }
            });
            this._summonedModels = [];

            // New summon
            this._pickModelsForSummon();
            this._scheduleSummon();
        }

        // Auto-clear summons after 3000 ticks (~50 seconds)
        if (this._summonedModels.length > 0) {
            const oldest = G.models.find(m => m.id === this._summonedModels[0]);
            if (oldest && oldest._summonTick && G.tick - oldest._summonTick > 3000) {
                this._summonedModels.forEach(id => {
                    const m = G.models.find(mm => mm.id === id);
                    if (m) { m._summoned = false; m._summonTick = 0; }
                });
                this._summonedModels = [];
            }
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   COURT ENVIRONMENT — Neoclassical Courthouse Exterior
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtEnv = {

    buildTerrain(g, gy, startX, endX) {
        // Marble/stone paving
        g.beginFill(0x8a8a8e, 0.6);
        g.drawRect(startX, gy - 2, endX - startX, 20);
        g.endFill();
        g.beginFill(0x9a9a9e, 0.3);
        g.drawRect(startX, gy - 2, endX - startX, 6);
        g.endFill();
        // Tile pattern
        for (let tx = startX + 10; tx < endX - 10; tx += 20) {
            g.beginFill(0x7a7a7e, 0.2);
            g.drawRect(tx, gy, 1, 12);
            g.endFill();
        }
        // Lampposts
        for (let lx = startX + 40; lx < endX - 40; lx += 160) {
            g.beginFill(0x444444);
            g.drawRect(lx, gy - 35, 3, 33);
            g.endFill();
            g.beginFill(0xffeecc, 0.4);
            g.drawCircle(lx + 1, gy - 37, 4);
            g.endFill();
        }
    },

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w
    buildBuilding(g, bld, h) {
        const bw = bld.w;

        if (bld.id === 'court_senate') {
            // ── AI SENATE: Grand neoclassical with dome ──
            g.beginFill(0xd4cfc4);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            g.beginFill(0xc4bfb4);
            g.drawRect(3, 3, bw - 6, h - 6);
            g.endFill();
            // Grand columns (6)
            for (let ci = 0; ci < 6; ci++) {
                const cx = 18 + ci * (bw - 36) / 5;
                g.beginFill(0xe8e4da);
                g.drawRect(cx - 4, 15, 8, h - 30);
                g.endFill();
                g.beginFill(0xf0ece4);
                g.drawRect(cx - 6, 12, 12, 5);
                g.endFill();
                g.beginFill(0xb8b4aa);
                g.drawRect(cx - 5, h - 16, 10, 4);
                g.endFill();
            }
            // Pediment
            g.beginFill(0xddd8cc);
            g.moveTo(8, 10); g.lineTo(bw / 2, -22); g.lineTo(bw - 8, 10); g.closePath();
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -8, 5);
            g.endFill();
            // Dome
            g.beginFill(0xbbb8ae);
            g.drawEllipse(bw / 2, -22, 30, 14);
            g.endFill();
            g.beginFill(0xd0cdc4);
            g.drawEllipse(bw / 2, -22, 25, 10);
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -34, 3);
            g.endFill();
            // Grand entrance
            g.beginFill(0x3a3028);
            g.drawRect(bw / 2 - 16, h - 26, 32, 26);
            g.endFill();
            g.beginFill(0x3a3028);
            g.drawEllipse(bw / 2, h - 26, 16, 10);
            g.endFill();
            // Steps
            for (let si = 0; si < 3; si++) {
                g.beginFill(0xc8c4ba);
                g.drawRect(bw / 2 - 20 - si * 4, h + si * 3, 40 + si * 8, 3);
                g.endFill();
            }

        } else if (bld.id === 'court_hearing') {
            g.beginFill(0xc8c4b8);
            g.drawRect(0, 0, bw, h);
            g.endFill();
            for (let ci = 0; ci < 4; ci++) {
                const cx = 15 + ci * (bw - 30) / 3;
                g.beginFill(0xddd8cc);
                g.drawRect(cx - 3, 10, 6, h - 20);
                g.endFill();
            }
            g.beginFill(0xd4d0c4);
            g.moveTo(5, 5); g.lineTo(bw / 2, -14); g.lineTo(bw - 5, 5); g.closePath();
            g.endFill();
            g.beginFill(0xc8a850);
            g.drawCircle(bw / 2, -4, 4);
            g.endFill();
            g.beginFill(0x3a3028);
            g.drawRect(bw / 2 - 12, h - 22, 24, 22);
            g.endFill();
            for (let wi = 0; wi < 3; wi++) {
                const wx = 15 + wi * (bw - 30) / 3;
                g.beginFill(0xffeecc, 0.3);
                g.drawRect(wx + 5, 20, 16, 20);
                g.endFill();
            }
        }
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Could add gavel animation, summoned model indicator, etc.
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   COURT INTERIOR — Senate Hearing Room with judges, testimony podium, gallery
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CourtInterior = {

    isDragging: false,

    build(bld, layer) {
        layer.removeChildren();
        const W = G.vpW, H = G.vpH;

        const scene = new PIXI.Container();
        layer.addChild(scene);
        const g = new PIXI.Graphics();
        scene.addChild(g);

        if (bld.id === 'court_senate') this._buildSenate(g, scene, W, H);
        else this._buildHearing(g, scene, W, H);

        // Drag scroll
        const totalH = H * 2;
        const minY = -(totalH - H);
        scene.interactive = true;
        scene.hitArea = new PIXI.Rectangle(0, minY, W, totalH + H);
        let dragStartY = 0, sceneStartY = 0, dragging = false;
        scene.on('pointerdown', e => { dragging = true; dragStartY = e.global.y; sceneStartY = scene.y; });
        scene.on('pointermove', e => { if (!dragging) return; scene.y = Math.max(minY, Math.min(0, sceneStartY + (e.global.y - dragStartY))); });
        scene.on('pointerup', () => { dragging = false; });
        scene.on('pointerupoutside', () => { dragging = false; });
    },

    _buildSenate(g, scene, W, H) {
        // Grand senate chamber
        g.beginFill(0x1a1420);
        g.drawRect(0, 0, W, H * 2);
        g.endFill();

        // Ornate ceiling
        g.beginFill(0x2a2030);
        g.drawRect(0, 0, W, 40);
        g.endFill();
        g.beginFill(0xc8a850, 0.2);
        g.drawRect(0, 38, W, 2);
        g.endFill();

        const title = new PIXI.Text('🏛️ AI SENATE CHAMBER', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xc8a850
        });
        title.x = 20; title.y = 12;
        scene.addChild(title);

        // Current hearing theme
        const theme = (typeof CourtData !== 'undefined') ? CourtData.getHearingTheme() : 'AI Safety Review';
        if (theme) {
            const themeTxt = new PIXI.Text('HEARING: ' + theme, {
                fontFamily: 'JetBrains Mono', fontSize: 7, fill: 0xff6666
            });
            themeTxt.x = 20; themeTxt.y = 30;
            scene.addChild(themeTxt);
        }

        // ── JUDGE BENCH (elevated, top) ──
        const benchW = W * 0.7, benchH = 45;
        const benchX = (W - benchW) / 2, benchY = 60;
        g.beginFill(0x4a2020);
        g.drawRoundedRect(benchX, benchY, benchW, benchH, 4);
        g.endFill();
        // Mahogany texture
        g.beginFill(0x5a2828, 0.5);
        g.drawRect(benchX + 2, benchY + 2, benchW - 4, 4);
        g.endFill();

        // Judges (5 seats)
        for (let ji = 0; ji < 5; ji++) {
            const jx = benchX + 20 + ji * (benchW - 40) / 4;
            const jy = benchY - 10;
            // Robe
            g.beginFill(0x1a1a1a);
            g.drawRect(jx - 5, jy, 10, 14);
            g.endFill();
            // Head
            g.beginFill(0xfdd8b5);
            g.drawCircle(jx, jy - 4, 4);
            g.endFill();
            // Nameplate
            const names = ['Chief Justice', 'Sen. Chen', 'Sen. Mueller', 'Sen. Okafor', 'Sen. Patel'];
            const jLabel = new PIXI.Text(names[ji], { fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xc8a850 });
            jLabel.anchor.set(0.5, 0); jLabel.x = jx; jLabel.y = benchY + benchH + 4;
            scene.addChild(jLabel);
        }

        // National seal / emblem behind bench
        g.beginFill(0xc8a850, 0.15);
        g.drawCircle(W / 2, benchY - 30, 25);
        g.endFill();
        g.beginFill(0xc8a850, 0.1);
        g.drawCircle(W / 2, benchY - 30, 18);
        g.endFill();
        const seal = new PIXI.Text('⚖️', { fontSize: 16 });
        seal.anchor.set(0.5, 0.5); seal.x = W / 2; seal.y = benchY - 30;
        scene.addChild(seal);

        // ── TESTIMONY PODIUM (center) ──
        const podX = W / 2, podY = benchY + benchH + 60;
        g.beginFill(0x5a4030);
        g.drawRect(podX - 15, podY, 30, 35);
        g.endFill();
        // Microphone
        g.beginFill(0x444444);
        g.drawRect(podX + 10, podY - 8, 2, 12);
        g.endFill();
        g.beginFill(0x666666);
        g.drawCircle(podX + 11, podY - 10, 3);
        g.endFill();

        // Summoned model at podium (if any)
        const summoned = (typeof CourtData !== 'undefined') ? CourtData.getSummonedModels() : [];
        if (summoned.length > 0) {
            const m = G.models.find(mm => mm.id === summoned[0]);
            if (m) {
                const labCol = (LABS[m.lab] && LABS[m.lab].color) ? parseInt(LABS[m.lab].color.replace('#', ''), 16) : 0x888888;
                // Model at podium
                g.beginFill(labCol);
                g.drawRect(podX - 5, podY - 18, 10, 14);
                g.endFill();
                g.beginFill(0xfdd8b5);
                g.drawCircle(podX, podY - 22, 5);
                g.endFill();
                // Worried eyes (wider)
                g.beginFill(0x2c1810);
                g.drawCircle(podX - 2, podY - 22, 1.5);
                g.drawCircle(podX + 2, podY - 22, 1.5);
                g.endFill();
                // Sweat drop
                g.beginFill(0x66aaff, 0.7);
                g.moveTo(podX + 7, podY - 24); g.lineTo(podX + 8, podY - 20); g.lineTo(podX + 6, podY - 20); g.closePath();
                g.endFill();

                const mLabel = new PIXI.Text(m.name + ' (TESTIFYING)', {
                    fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xff6666
                });
                mLabel.anchor.set(0.5, 0); mLabel.x = podX; mLabel.y = podY + 38;
                scene.addChild(mLabel);
            }
        } else {
            const noHearing = new PIXI.Text('No active hearing', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x555555 });
            noHearing.anchor.set(0.5, 0); noHearing.x = podX; noHearing.y = podY + 38;
            scene.addChild(noHearing);
        }

        // ── GALLERY (spectator seating) ──
        const galY = podY + 80;
        for (let row = 0; row < 3; row++) {
            const rw = W * (0.6 + row * 0.1);
            const rx = (W - rw) / 2;
            for (let s = 0; s < 8 + row * 2; s++) {
                const sx = rx + 10 + s * (rw - 20) / (8 + row * 2);
                g.beginFill(0x333340);
                g.drawRect(sx, galY + row * 22 + 10, 10, 8);
                g.endFill();
                // Random spectator
                if (Math.random() > 0.35) {
                    const labKeys = Object.keys(LABS);
                    const rLab = labKeys[Math.floor(Math.random() * labKeys.length)];
                    const lc = parseInt((LABS[rLab]?.color || '#888').replace('#', ''), 16);
                    g.beginFill(lc, 0.7);
                    g.drawRect(sx + 1, galY + row * 22 + 2, 8, 8);
                    g.endFill();
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(sx + 5, galY + row * 22 - 1, 3);
                    g.endFill();
                }
            }
        }

        // ── PRESS BOX ──
        const pressY = galY + 80;
        g.beginFill(0x1a2030);
        g.drawRect(20, pressY, W * 0.3, 50);
        g.endFill();
        const pressLabel = new PIXI.Text('📰 PRESS BOX', { fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0x888888 });
        pressLabel.x = 25; pressLabel.y = pressY + 5;
        scene.addChild(pressLabel);
        // Cameras
        for (let ci = 0; ci < 3; ci++) {
            g.beginFill(0x444444);
            g.drawRect(30 + ci * 40, pressY + 25, 14, 10);
            g.endFill();
            g.beginFill(0xff4444, 0.7);
            g.drawCircle(30 + ci * 40 + 12, pressY + 25, 2);
            g.endFill();
        }
    },

    _buildHearing(g, scene, W, H) {
        g.beginFill(0x161220);
        g.drawRect(0, 0, W, H * 2);
        g.endFill();

        const title = new PIXI.Text('⚖️ HEARING CHAMBER — COMPLIANCE REVIEW', {
            fontFamily: 'Press Start 2P', fontSize: 7, fill: 0xf87171
        });
        title.x = 20; title.y = 15;
        scene.addChild(title);

        // Evidence screens along walls
        for (let si = 0; si < 3; si++) {
            const sx = 30 + si * (W - 60) / 3;
            g.beginFill(0x111133);
            g.drawRect(sx, 50, 100, 60);
            g.endFill();
            const themes = CourtData.REGULATION_THEMES;
            const t = new PIXI.Text(themes[(si * 4) % themes.length], {
                fontFamily: 'JetBrains Mono', fontSize: 5, fill: 0xff6666, wordWrap: true, wordWrapWidth: 90
            });
            t.x = sx + 5; t.y = 55;
            scene.addChild(t);
        }

        // Examiner desk
        g.beginFill(0x4a2020);
        g.drawRect(W * 0.3, 140, W * 0.4, 30);
        g.endFill();
        // Examiner
        g.beginFill(0x1a1a4a);
        g.drawRect(W / 2 - 5, 124, 10, 14);
        g.endFill();
        g.beginFill(0xfdd8b5);
        g.drawCircle(W / 2, 120, 5);
        g.endFill();

        // Document piles
        for (let di = 0; di < 4; di++) {
            const dx = W * 0.32 + di * 30;
            for (let pi = 0; pi < 3; pi++) {
                g.beginFill(0xeeeedd);
                g.drawRect(dx, 142 - pi * 3, 18, 3);
                g.endFill();
            }
        }

        // Verdict display
        const verdictY = 200;
        g.beginFill(0x0a0a1a);
        g.drawRect(W * 0.2, verdictY, W * 0.6, 40);
        g.endFill();
        const verdict = new PIXI.Text('VERDICT PENDING...', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xffaa00
        });
        verdict.anchor.set(0.5, 0.5);
        verdict.x = W / 2; verdict.y = verdictY + 20;
        scene.addChild(verdict);
    },

    update() {}
};
