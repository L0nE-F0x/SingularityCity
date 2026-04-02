/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE SYSTEM (v1.0.0)
   NeurIPS, ICML, ICLR conference weeks — convention center with keynotes, posters, and demo booths
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceData = {

    CONFERENCES: [
        { id: 'neurips', name: 'NeurIPS',  month: 12, startDay: 8,  endDay: 14, color: 0xf43f5e, hex: '#f43f5e', theme: 'Neural Information Processing Systems' },
        { id: 'icml',    name: 'ICML',     month: 7,  startDay: 21, endDay: 27, color: 0x3b82f6, hex: '#3b82f6', theme: 'International Conference on Machine Learning' },
        { id: 'iclr',    name: 'ICLR',     month: 5,  startDay: 5,  endDay: 9,  color: 0x4ade80, hex: '#4ade80', theme: 'International Conference on Learning Representations' },
        { id: 'cvpr',    name: 'CVPR',     month: 6,  startDay: 16, endDay: 20, color: 0xfbbf24, hex: '#fbbf24', theme: 'Conference on Computer Vision and Pattern Recognition' },
        { id: 'aaai',    name: 'AAAI',     month: 2,  startDay: 24, endDay: 28, color: 0xa78bfa, hex: '#a78bfa', theme: 'Association for the Advancement of AI' },
    ],

    PAPER_TITLES: [
        'Scaling Laws for Neural Language Models',
        'Attention Is Still All You Need (For Now)',
        'Towards Efficient Inference at the Edge',
        'Can Transformers Learn to Reason?',
        'RLHF Considered Harmful: A Retrospective',
        'Mixture of Experts: A Practical Guide',
        'Self-Play and the Emergence of Agency',
        'Sparse Attention Beats Dense: Empirical Results',
        'Why Your Tokenizer Matters More Than You Think',
        'The Unreasonable Effectiveness of Data',
        'Alignment Tax: How Much Performance Do We Lose?',
        'Benchmarking the Benchmarks',
        'Long-Context Models: Are We There Yet?',
        'Multimodal Reasoning in the Wild',
        'On the Geometry of Latent Spaces',
        'Emergent Tool Use in Foundation Models',
    ],

    CHAT_MSGS: [
        'My poster is in session B3',
        'Did you see that keynote? 🎤',
        'Rejected from oral presentation 😤',
        'Spotlight paper! 🌟',
        'The coffee line is insane',
        'Networking event tonight!',
        'Our ablation study is solid',
        'Best paper nominee!',
        'So many vision papers this year',
        'The hallway track is where the real talks happen',
        'Anyone going to the workshop tomorrow?',
        'My GPU cluster ran out mid-experiment 😭',
        'SOTA on 3 benchmarks!',
        'Need more baselines...',
        'The reviewer was harsh but fair',
    ],

    _bld: null,
    _active: null,

    init() {
        // Only inject building if a conference is currently active
        this._active = this.getActiveConference();
        if (this._active) {
            this._injectBuilding();
        }
    },

    _injectBuilding() {
        if (BLDS.find(b => b.id === 'convention_center')) return;
        const conf = this._active;
        const bld = {
            id: 'convention_center',
            name: conf.name + ' Convention Center',
            w: 200, fl: 4, x: 0,
            emoji: '🎓',
            lab: null,
            type: 'convention_center',
            desc: conf.theme + '. ' + conf.name + ' ' + new Date().getFullYear() + ' is in session — posters, keynotes, and demo booths.',
            _confColor: conf.color,
            _confId: conf.id,
        };
        BLDS.push(bld);
        G.bldById['convention_center'] = bld;
        this._bld = bld;
    },

    getActiveConference() {
        const now = new Date();
        const m = now.getMonth() + 1, d = now.getDate();
        for (const c of this.CONFERENCES) {
            if (m === c.month && d >= c.startDay && d <= c.endDay) return c;
        }
        return null;
    },

    isActive() {
        return this._active !== null;
    },

    getConferenceChat() {
        return this.CHAT_MSGS[Math.floor(Math.random() * this.CHAT_MSGS.length)];
    },

    getPaperTitle() {
        return this.PAPER_TITLES[Math.floor(Math.random() * this.PAPER_TITLES.length)];
    },

    /* Called from engine loop */
    update() {
        // Re-check conference status every 60 seconds
        if (G.tick % 3600 === 0) {
            const was = this._active;
            this._active = this.getActiveConference();
            if (!was && this._active) {
                this._injectBuilding();
                if (typeof UI !== 'undefined') UI.addToast('🎓 ' + this._active.name + ' conference has begun!');
            } else if (was && !this._active) {
                // Conference ended — remove building from arrays
                const idx = BLDS.findIndex(b => b.id === 'convention_center');
                if (idx !== -1) BLDS.splice(idx, 1);
                delete G.bldById['convention_center'];
                this._bld = null;
                if (typeof Environment !== 'undefined' && Environment.buildBuildings) Environment.buildBuildings();
            }
        }
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE ENVIRONMENT — Convention Center Exterior Rendering
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceEnv = {

    // NOTE: g=local graphics (0=top, h=ground), bw=bld.w
    buildBuilding(g, bld, h) {
        if (!bld || bld.id !== 'convention_center') return;
        const bw = bld.w;
        const conf = ConferenceData._active;
        const col = conf ? conf.color : 0x6366f1;

        g.beginFill(0x1e1b2e);
        g.drawRoundedRect(0, 0, bw, h, 4);
        g.endFill();
        g.beginFill(0x2a2745, 0.8);
        g.drawRect(4, 4, bw - 8, h * 0.6);
        g.endFill();
        // Conference banner
        g.beginFill(col, 0.9);
        g.drawRect(10, h * 0.3, bw - 20, 14);
        g.endFill();
        // Entrance
        g.beginFill(0x444466);
        g.drawRect(bw / 2 - 15, h - 20, 30, 20);
        g.endFill();
        g.beginFill(col, 0.5);
        g.drawRect(bw / 2 - 12, h - 18, 11, 16);
        g.drawRect(bw / 2 + 1, h - 18, 11, 16);
        g.endFill();
        // Roof dome
        g.beginFill(0x2a2745);
        g.drawEllipse(bw / 2, -4, bw * 0.25, 8);
        g.endFill();
        g.beginFill(col, 0.4);
        g.drawEllipse(bw / 2, -4, bw * 0.2, 5);
        g.endFill();
        // Glowing windows
        for (let row = 0; row < 2; row++) {
            for (let col2 = 0; col2 < 5; col2++) {
                const wx = 12 + col2 * (bw - 24) / 5;
                const wy = h * 0.65 + row * 16;
                g.beginFill(0x334466, 0.6);
                g.drawRect(wx, wy, 18, 10);
                g.endFill();
                g.beginFill(0xffcc66, 0.15);
                g.drawRect(wx + 1, wy + 1, 16, 8);
                g.endFill();
            }
        }
        // Spotlights
        g.beginFill(col, 0.08);
        g.moveTo(bw * 0.3, 0); g.lineTo(bw * 0.2, h); g.lineTo(bw * 0.4, h); g.closePath();
        g.endFill();
        g.beginFill(col, 0.08);
        g.moveTo(bw * 0.7, 0); g.lineTo(bw * 0.6, h); g.lineTo(bw * 0.8, h); g.closePath();
        g.endFill();
        g.beginFill(0x000000, 0.15); g.drawRect(0, h - 2, bw, 4); g.endFill();
    },

    update() {
        // Could add banner animation, attendee particles, etc.
    }
};

/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   CONFERENCE INTERIOR — Poster session, keynote stage, demo booths
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ConferenceInterior = {

    isDragging: false,
    _layer: null,
    _dragY: 0,
    _startY: 0,
    _gfx: null,

    build(bld, layer) {
        this._layer = layer;
        layer.removeChildren();

        const W = G.vpW, H = G.vpH;
        const conf = ConferenceData._active || { name: 'AI Conference', color: 0x6366f1 };
        const col = conf.color;

        const scene = new PIXI.Container();
        layer.addChild(scene);

        const g = new PIXI.Graphics();
        scene.addChild(g);
        this._gfx = g;

        // ── BACKGROUND ──
        g.beginFill(0x0f0e1a);
        g.drawRect(0, 0, W, H * 3);
        g.endFill();

        const floorH = H * 0.85;
        let cy = 30;

        // ════ FLOOR 1: KEYNOTE STAGE ════
        // Floor background
        g.beginFill(0x161428);
        g.drawRect(0, cy, W, floorH);
        g.endFill();

        // Stage platform
        const stageW = W * 0.5, stageH = 60;
        const sx = (W - stageW) / 2, sy = cy + floorH - stageH - 40;
        g.beginFill(0x2a1f4e);
        g.drawRoundedRect(sx, sy, stageW, stageH, 6);
        g.endFill();
        g.beginFill(col, 0.3);
        g.drawRect(sx + 2, sy + 2, stageW - 4, 4); // stage edge accent
        g.endFill();

        // Podium
        g.beginFill(0x3a3060);
        g.drawRect(sx + stageW / 2 - 12, sy + 10, 24, 35);
        g.endFill();
        g.beginFill(col, 0.5);
        g.drawRect(sx + stageW / 2 - 8, sy + 14, 16, 10); // screen on podium
        g.endFill();

        // Keynote banner
        g.beginFill(col, 0.8);
        g.drawRect(W * 0.15, cy + 15, W * 0.7, 24);
        g.endFill();
        const titleTxt = new PIXI.Text(conf.name + ' ' + new Date().getFullYear() + ' — KEYNOTE', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xffffff
        });
        titleTxt.anchor.set(0.5, 0.5);
        titleTxt.x = W / 2; titleTxt.y = cy + 27;
        scene.addChild(titleTxt);

        // Presentation screen
        g.beginFill(0x111133);
        g.drawRect(sx + stageW / 2 - 80, sy - 80, 160, 70);
        g.endFill();
        g.beginFill(0x1a1a4a);
        g.drawRect(sx + stageW / 2 - 76, sy - 76, 152, 62);
        g.endFill();
        const slideTxt = new PIXI.Text(ConferenceData.getPaperTitle(), {
            fontFamily: 'JetBrains Mono', fontSize: 7, fill: 0x88aaff, wordWrap: true, wordWrapWidth: 140
        });
        slideTxt.x = sx + stageW / 2 - 70; slideTxt.y = sy - 70;
        scene.addChild(slideTxt);

        // Audience seats
        for (let row = 0; row < 4; row++) {
            for (let seat = 0; seat < 8; seat++) {
                const ax = sx - 20 + seat * (stageW + 40) / 8;
                const ay = sy + stageH + 15 + row * 16;
                g.beginFill(0x333350);
                g.drawRect(ax, ay, 12, 10);
                g.endFill();
                // Random attendee (50% occupied)
                if (Math.random() > 0.5) {
                    const labKeys = Object.keys(LABS);
                    const rLab = labKeys[Math.floor(Math.random() * labKeys.length)];
                    const lc = LABS[rLab] ? LABS[rLab].color : '#888';
                    g.beginFill(parseInt(lc.replace('#', ''), 16));
                    g.drawCircle(ax + 6, ay - 3, 3);
                    g.endFill();
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(ax + 6, ay - 7, 2.5);
                    g.endFill();
                }
            }
        }

        // Spotlights on stage
        g.beginFill(0xffeecc, 0.06);
        g.moveTo(sx + stageW * 0.3, cy); g.lineTo(sx + stageW * 0.1, sy); g.lineTo(sx + stageW * 0.5, sy); g.closePath();
        g.endFill();
        g.beginFill(0xffeecc, 0.06);
        g.moveTo(sx + stageW * 0.7, cy); g.lineTo(sx + stageW * 0.5, sy); g.lineTo(sx + stageW * 0.9, sy); g.closePath();
        g.endFill();

        cy += floorH + 10;

        // ════ FLOOR 2: POSTER SESSION ════
        g.beginFill(0x141224);
        g.drawRect(0, cy, W, floorH);
        g.endFill();

        // Section label
        const posterLabel = new PIXI.Text('POSTER SESSION', {
            fontFamily: 'Press Start 2P', fontSize: 7, fill: col
        });
        posterLabel.x = 20; posterLabel.y = cy + 10;
        scene.addChild(posterLabel);

        // Poster boards in two rows
        const posterW = 50, posterH = 65, posterGap = 15;
        const postersPerRow = Math.floor((W - 40) / (posterW + posterGap));
        for (let row = 0; row < 2; row++) {
            for (let p = 0; p < postersPerRow; p++) {
                const px = 20 + p * (posterW + posterGap);
                const py = cy + 40 + row * (posterH + 50);
                // Board
                g.beginFill(0xeeeeee);
                g.drawRect(px, py, posterW, posterH);
                g.endFill();
                // Color-coded header by lab
                const labKeys = Object.keys(LABS);
                const rLab = labKeys[(p + row * postersPerRow) % labKeys.length];
                const labCol = parseInt((LABS[rLab]?.color || '#666').replace('#', ''), 16);
                g.beginFill(labCol);
                g.drawRect(px, py, posterW, 8);
                g.endFill();
                // Fake content lines
                for (let line = 0; line < 4; line++) {
                    g.beginFill(0xcccccc);
                    g.drawRect(px + 4, py + 14 + line * 10, posterW - 8, 3);
                    g.endFill();
                }
                // Chart placeholder
                g.beginFill(labCol, 0.3);
                g.drawRect(px + 6, py + posterH - 18, posterW - 12, 14);
                g.endFill();

                // Presenter avatar
                if (Math.random() > 0.3) {
                    g.beginFill(labCol);
                    g.drawRect(px + posterW / 2 - 5, py + posterH + 8, 10, 14);
                    g.endFill();
                    g.beginFill(0xfdd8b5);
                    g.drawCircle(px + posterW / 2, py + posterH + 5, 4);
                    g.endFill();
                }
            }
        }

        cy += floorH + 10;

        // ════ FLOOR 3: DEMO BOOTHS ════
        g.beginFill(0x121020);
        g.drawRect(0, cy, W, floorH);
        g.endFill();

        const boothLabel = new PIXI.Text('DEMO BOOTHS & EXPO HALL', {
            fontFamily: 'Press Start 2P', fontSize: 7, fill: col
        });
        boothLabel.x = 20; boothLabel.y = cy + 10;
        scene.addChild(boothLabel);

        // Lab-branded booths
        const labKeys = Object.keys(LABS);
        const boothW = 90, boothH = 80;
        const boothsPerRow = Math.min(labKeys.length, Math.floor((W - 30) / (boothW + 15)));
        labKeys.slice(0, boothsPerRow * 2).forEach((labId, i) => {
            const lab = LABS[labId];
            const row = Math.floor(i / boothsPerRow);
            const col2 = i % boothsPerRow;
            const bx = 15 + col2 * (boothW + 15);
            const by = cy + 35 + row * (boothH + 30);
            const labCol = parseInt((lab.color || '#666').replace('#', ''), 16);

            // Booth structure
            g.beginFill(0x1a1830);
            g.drawRoundedRect(bx, by, boothW, boothH, 4);
            g.endFill();
            // Lab color top bar
            g.beginFill(labCol);
            g.drawRect(bx, by, boothW, 10);
            g.endFill();
            // Demo screen
            g.beginFill(0x111122);
            g.drawRect(bx + 8, by + 16, boothW - 16, 30);
            g.endFill();
            g.beginFill(labCol, 0.2);
            g.drawRect(bx + 10, by + 18, boothW - 20, 26);
            g.endFill();

            // Lab name
            const labTxt = new PIXI.Text(lab.name || labId, {
                fontFamily: 'JetBrains Mono', fontSize: 6, fill: 0xffffff, fontWeight: 'bold'
            });
            labTxt.x = bx + 5; labTxt.y = by + 1;
            scene.addChild(labTxt);

            // Booth attendant
            g.beginFill(labCol);
            g.drawRect(bx + boothW / 2 - 5, by + boothH - 20, 10, 14);
            g.endFill();
            g.beginFill(0xfdd8b5);
            g.drawCircle(bx + boothW / 2, by + boothH - 23, 4);
            g.endFill();
        });

        // ── DRAG SCROLL ──
        const totalH = cy + floorH + 40;
        const minY = -(totalH - H);
        scene.interactive = true;
        scene.hitArea = new PIXI.Rectangle(0, minY, W, totalH + H);

        let dragStartY = 0, sceneStartY = 0, dragging = false;
        scene.on('pointerdown', e => { dragging = true; dragStartY = e.global.y; sceneStartY = scene.y; });
        scene.on('pointermove', e => { if (!dragging) return; scene.y = Math.max(minY, Math.min(0, sceneStartY + (e.global.y - dragStartY))); });
        scene.on('pointerup', () => { dragging = false; });
        scene.on('pointerupoutside', () => { dragging = false; });

        // Achievement
        if (typeof G !== 'undefined') G.unlockAchieve('peer_reviewed');
    },

    update() {
        // Could animate slide transitions, moving attendees, etc.
    }
};
