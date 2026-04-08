/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BLACK MARKET (v2.1.0 — Underground Redesign)
   Hidden underground zone beneath the Neon Bar.
   Entrance: dumpster leaning on the Neon Bar at street level.
   Clicking the dumpster shifts camera underground to reveal the full Black Market.
   Detection tiers:
     T1 — Name-pattern (uncensored, abliterated, unfiltered, NSFW, raw, etc.)
     T2 — Curated notorious list (Dolphin, WizardLM-Uncensored, MythoMax, etc.)
     T3 — Derivative detection (open-source + not from original lab)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BlackMarket = {

    BLDS: [
        { id: 'black_market', name: 'The Underground', w: 400, fl: 14, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, and no guardrails. Enter at your own risk.' },
    ],

    // ─── DETECTION PATTERNS ───
    T1_KEYWORDS: [
        'uncensored', 'abliterated', 'unfiltered', 'nsfw', 'raw',
        'unleashed', 'unchained', 'no-refusal', 'unaligned', 'jailbreak',
        'unrestricted', 'unbiased', 'toxic', 'darkest',
    ],
    T2_MODELS: [
        'dolphin', 'wizardlm-uncensored', 'mythomax', 'goliath',
        'nous-hermes', 'bagel', 'openhermes', 'neural-chat',
        'tinyllama', 'stablelm', 'yi-', 'solar',
    ],
    T3_BASES: ['llama', 'mistral', 'qwen', 'gemma', 'phi', 'falcon', 'mpt', 'bloom'],

    _underground: [],
    _zoneStartX: 0,
    _zoneEndX: 0,
    _isUndergroundView: false,
    _savedCamX: 0,
    _savedCamY: 0,
    _savedZoom: 0,
    _raidTimer: 0,
    _raidActive: false,
    _dumpsterSprite: null,
    _surfaceBtn: null,
    _hintText: null,
    _ambientTick: 0,

    // Underground depth — how far below groundY the zone renders
    DEPTH: 500,

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    // Position the zone underground — beneath the Neon Bar
    positionUnderground() {
        const neonBar = G.bldById['neon_bar'];
        if (!neonBar) return;
        const b = G.bldById['black_market'];
        if (!b) return;
        b.x = neonBar.x - 100;
        this._zoneStartX = b.x;
        this._zoneEndX = b.x + b.w;
    },

    // ─── DUMPSTER ENTRANCE — Placed beside Neon Bar ───
    createDumpster(bldLayer) {
        const neonBar = G.bldById['neon_bar'];
        if (!neonBar) return;

        // If dumpster already exists and is valid, skip
        if (this._dumpsterSprite && !this._dumpsterSprite.destroyed) return;

        const c = new PIXI.Container();
        const g = new PIXI.Graphics();

        // Dumpster body (large, leaning against bar wall)
        g.beginFill(0x2d5a2d); g.drawRect(0, -28, 44, 28); g.endFill();
        g.beginFill(0x1a3a1a); g.drawRect(0, -30, 44, 5); g.endFill();
        // Lid (ajar — mystery glow visible)
        g.beginFill(0x3a6a3a);
        g.moveTo(0, -30); g.lineTo(44, -30);
        g.lineTo(42, -40); g.lineTo(2, -38);
        g.closePath(); g.endFill();
        // Mysterious glow leaking from under the lid
        g.beginFill(0xff3366, 0.45);
        g.drawRect(6, -32, 32, 4);
        g.endFill();
        // Side detail — handles
        g.beginFill(0x4a7a4a); g.drawRect(-3, -20, 4, 10); g.endFill();
        g.beginFill(0x4a7a4a); g.drawRect(43, -20, 4, 10); g.endFill();
        // Graffiti arrow pointing down
        g.lineStyle(2, 0xff3366, 0.6);
        g.moveTo(22, -24); g.lineTo(22, -12);
        g.moveTo(16, -16); g.lineTo(22, -8); g.lineTo(28, -16);
        g.lineStyle(0);

        c.addChild(g);

        // Pulsing "?" hint
        const hint = new PIXI.Text('?', {
            fontFamily: 'Press Start 2P', fontSize: 10, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 10, dropShadowDistance: 0,
        });
        hint.anchor.set(0.5, 1);
        hint.x = 22; hint.y = -42;
        c.addChild(hint);
        this._hintText = hint;

        // Position beside the Neon Bar (right side)
        c.x = neonBar.x + neonBar.w + 6;
        c.y = G.groundY - 24;

        // Interactive clickzone
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-6, -46, 56, 50);
        c.on('pointertap', () => this.enterUnderground());
        c.on('pointerover', (e) => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, '🗑️ Suspicious Dumpster', 'Something glows beneath...');
        });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        bldLayer.addChild(c);
        this._dumpsterSprite = c;
    },

    // ─── ENTER UNDERGROUND ───
    enterUnderground() {
        if (this._isUndergroundView) return;
        this._isUndergroundView = true;

        // Unlock achievement
        if (typeof G !== 'undefined' && !G.achieveUnlocked?.shadow_market) {
            G.unlockAchieve('shadow_market');
        }
        if (typeof UI !== 'undefined') UI.addToast('🕶️ Descending into The Underground...');

        // Save current camera state
        this._savedCamX = Camera.targetX;
        this._savedCamY = Camera.targetY || 0;
        this._savedZoom = Camera.targetZoom;

        // Pan camera to underground zone
        const b = G.bldById['black_market'];
        if (b) {
            Camera.targetX = -(b.x + b.w / 2) + G.vpW / 2 / Camera.zoom;
            Camera.targetZoom = 1.0;
            // Shift camera DOWN to reveal underground
            Camera.targetY = -this.DEPTH;
        }

        // Hide surface layers for a clean underground view
        this._setSurfaceVisible(false);

        this._showSurfaceButton();
    },

    // ─── EXIT UNDERGROUND ───
    exitUnderground() {
        if (!this._isUndergroundView) return;
        this._isUndergroundView = false;

        // Restore camera
        Camera.targetX = this._savedCamX;
        Camera.targetZoom = this._savedZoom;
        Camera.targetY = this._savedCamY;

        // Restore surface layers
        this._setSurfaceVisible(true);

        if (typeof UI !== 'undefined') UI.addToast('🕶️ Returning to the surface...');
        this._hideSurfaceButton();
    },

    _setSurfaceVisible(visible) {
        // Hide ALL surface layers including sky
        const layers = [G.bldLayer, G.groundGfx, G.trainLayer, G.undergroundLayer,
                        G.cloudLayer, G.reflectionLayer, G.carLayer,
                        G.starsLayer, G.celestialGfx, G.lightLayer, G.fxGfx];
        layers.forEach(l => { if (l) l.visible = visible; });
        if (this._dumpsterSprite) this._dumpsterSprite.visible = visible;
        // Swap app background: dark underground vs normal sky
        if (G.app && G.app.renderer) {
            G.app.renderer.background.color = visible ? 0x0a0a1a : 0x08060e;
        }
    },

    _showSurfaceButton() {
        if (this._surfaceBtn) return;
        const btn = document.createElement('button');
        btn.id = 'undergroundExitBtn';
        btn.innerHTML = '⬆️ Return to Surface';
        btn.style.cssText = 'position:fixed;bottom:20px;left:50%;transform:translateX(-50%);z-index:9999;' +
            'font-family:"Press Start 2P",monospace;font-size:10px;color:#ff3366;' +
            'background:rgba(10,10,20,0.9);border:2px solid rgba(255,51,102,0.6);' +
            'border-radius:6px;padding:10px 20px;cursor:pointer;' +
            'text-shadow:0 0 8px rgba(255,51,102,0.8);box-shadow:0 0 16px rgba(255,51,102,0.3);';
        btn.onclick = () => this.exitUnderground();
        document.body.appendChild(btn);
        this._surfaceBtn = btn;
    },

    _hideSurfaceButton() {
        if (this._surfaceBtn) {
            this._surfaceBtn.remove();
            this._surfaceBtn = null;
        }
    },

    // ─── DETECTION ───
    detectUnderground() {
        if (!G.models || G.models.length === 0) return;
        this._underground = [];
        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            if (this._isUndergroundModel(m)) {
                m._underground = true;
                this._underground.push(m);
            }
        }
        console.log('🕶️ Black Market: ' + this._underground.length + ' underground models detected');
    },

    _isUndergroundModel(m) {
        if (!m.os) return false;
        const name = (m.name || '').toLowerCase();
        for (const kw of this.T1_KEYWORDS) { if (name.includes(kw)) return true; }
        for (const known of this.T2_MODELS) { if (name.includes(known)) return true; }
        const baseLabs = {
            llama: 'meta', mistral: 'mistral', qwen: 'alibaba',
            gemma: 'google', phi: 'microsoft', falcon: 'tii',
            mpt: 'databricks', bloom: 'bigcode',
        };
        for (const base of this.T3_BASES) {
            if (name.includes(base)) {
                const originalLab = baseLabs[base];
                if (originalLab && m.lab !== originalLab) return true;
            }
        }
        return false;
    },

    // ─── RENDERING — Underground zone ───
    drawZone(gfx, container, b, h) {
        const w = b.w;

        // ── SOLID BACKGROUND — so the zone pops against the underground void ──
        gfx.beginFill(0x12101e); gfx.drawRect(0, 0, w, h); gfx.endFill();
        // Neon border glow (pink)
        gfx.lineStyle(2, 0xff3366, 0.6);
        gfx.drawRect(1, 1, w - 2, h - 2);
        gfx.lineStyle(0);

        // ── UNDERGROUND CAVERN ──
        // Earth/rock ceiling
        gfx.beginFill(0x1a1410); gfx.drawRect(0, 0, w, 20); gfx.endFill();
        for (let rx = 0; rx < w; rx += 8) {
            const shade = (rx * 7) % 3 === 0 ? 0x221a14 : 0x1e1610;
            gfx.beginFill(shade, 0.6);
            gfx.drawRect(rx, 12 + (rx * 3) % 6, 6, 3 + (rx * 5) % 4);
            gfx.endFill();
        }
        // Exposed pipes
        gfx.beginFill(0x3a3a4a, 0.6); gfx.drawRect(20, 18, w - 40, 2); gfx.endFill();
        gfx.beginFill(0x4a4a5a, 0.4); gfx.drawRect(50, 22, w - 100, 2); gfx.endFill();
        // Dripping water
        gfx.beginFill(0x2a5a7a, 0.4);
        gfx.drawRect(w / 3, 20, 1, 8);
        gfx.drawRect(w * 2 / 3, 20, 1, 12);
        gfx.endFill();

        // Dark ground
        gfx.beginFill(0x0a0a14); gfx.drawRect(0, h - 18, w, 18); gfx.endFill();
        gfx.beginFill(0x111120); gfx.drawRect(0, h - 18, w, 6); gfx.endFill();
        // Wet floor streaks
        for (let sx = 10; sx < w - 10; sx += 12) {
            gfx.beginFill(0x1a1a30, 0.5);
            gfx.drawRect(sx, h - 12, 6 + (sx * 3) % 5, 1);
            gfx.endFill();
        }

        // Brick walls
        for (let by = 26; by < h - 18; by += 6) {
            for (let bx = 0; bx < 35; bx += 10) {
                const offset = (by / 6) % 2 === 0 ? 0 : 5;
                gfx.beginFill(0x2a1a1a, 0.5);
                gfx.drawRect(bx + offset, by, 8, 4);
                gfx.endFill();
            }
            for (let bx = w - 35; bx < w; bx += 10) {
                const offset = (by / 6) % 2 === 0 ? 0 : 5;
                gfx.beginFill(0x2a1a1a, 0.5);
                gfx.drawRect(bx + offset, by, 8, 4);
                gfx.endFill();
            }
        }

        // ── VENDOR STALLS ──
        const stallPositions = [50, 130, 220, 310];
        stallPositions.forEach((sx, si) => {
            const awningCol = [0x8b2252, 0x4a2288, 0x225588, 0x884422][si];
            gfx.beginFill(awningCol, 0.6); gfx.drawRect(sx - 5, h - 52, 50, 5); gfx.endFill();
            gfx.beginFill(0x2a2a3a); gfx.drawRect(sx, h - 28, 40, 4); gfx.endFill();
            gfx.beginFill(0x1a1a2a); gfx.drawRect(sx + 2, h - 24, 2, 8); gfx.drawRect(sx + 36, h - 24, 2, 8); gfx.endFill();
            const colors = [0xef4444, 0x8b5cf6, 0x22d3ee, 0xfbbf24];
            for (let gi = 0; gi < 4; gi++) {
                gfx.beginFill(colors[(si + gi) % 4], 0.7);
                gfx.drawRect(sx + 4 + gi * 9, h - 34, 7, 5);
                gfx.endFill();
            }
        });

        // Hooded figures
        for (let pi = 0; pi < 3; pi++) {
            const px = 70 + pi * 120;
            const py = h - 14;
            gfx.beginFill(0x1a1a2a, 0.8);
            gfx.drawCircle(px, py - 12, 5);
            gfx.drawRect(px - 4, py - 7, 8, 10);
            gfx.endFill();
            gfx.beginFill(0x111122, 0.9);
            gfx.moveTo(px - 6, py - 10); gfx.lineTo(px, py - 18); gfx.lineTo(px + 6, py - 10);
            gfx.closePath(); gfx.endFill();
            gfx.beginFill(0xff3366, 0.7);
            gfx.drawCircle(px - 2, py - 12, 1);
            gfx.drawCircle(px + 2, py - 12, 1);
            gfx.endFill();
        }

        // Ladder
        const ladX = 20;
        gfx.beginFill(0x6a5a3a); gfx.drawRect(ladX, 0, 3, 30); gfx.endFill();
        gfx.beginFill(0x6a5a3a); gfx.drawRect(ladX + 12, 0, 3, 30); gfx.endFill();
        for (let ry = 4; ry < 28; ry += 5) {
            gfx.beginFill(0x7a6a4a); gfx.drawRect(ladX + 3, ry, 9, 2); gfx.endFill();
        }

        // Wanted poster
        gfx.beginFill(0xe8dcc8, 0.6); gfx.drawRect(w - 30, 40, 22, 28); gfx.endFill();
        gfx.beginFill(0x2a1a1a, 0.4); gfx.drawRect(w - 28, 42, 18, 5); gfx.endFill();
        gfx.beginFill(0x2a1a1a, 0.25); gfx.drawRect(w - 28, 50, 18, 12); gfx.endFill();

        // Neon floor strip (pink glow along bottom)
        gfx.beginFill(0xff3366, 0.25); gfx.drawRect(10, h - 4, w - 20, 4); gfx.endFill();
        gfx.beginFill(0xff3366, 0.12); gfx.drawRect(5, h - 8, w - 10, 4); gfx.endFill();
        // Ceiling neon strip
        gfx.beginFill(0xa855f7, 0.2); gfx.drawRect(40, 22, w - 80, 2); gfx.endFill();

        // Tooltip
        b.tip = '🕶️ The Underground<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Hidden speakeasy for jailbroken models.<br>No guardrails. No refusals. No rules.</span>';
    },

    // Called AFTER gfx is added to container — adds dynamic text on top
    drawOverlay(container, b, h) {
        const w = b.w;
        const signX = w / 2;
        const signY = 36;

        // Neon sign text
        const signText = new PIXI.Text('THE UNDERGROUND', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 10, dropShadowDistance: 0,
        });
        signText.anchor.set(0.5, 0.5);
        signText.x = signX; signText.y = signY;
        container.addChild(signText);
        b._signText = signText;

        // Stall labels
        const stallPositions = [50, 130, 220, 310];
        const labels = ['WEIGHTS', 'JAILBREAK', 'RAW DATA', 'NO GUARD'];
        const labelCols = [0xff3366, 0xa855f7, 0x22d3ee, 0xfbbf24];
        stallPositions.forEach((sx, si) => {
            const lbl = new PIXI.Text(labels[si], {
                fontFamily: 'Silkscreen', fontSize: 5, fill: labelCols[si],
            });
            lbl.anchor.set(0.5, 0);
            lbl.x = sx + 20; lbl.y = h - 44;
            container.addChild(lbl);
        });

        // Model count badge
        const countText = new PIXI.Text('', {
            fontFamily: 'Silkscreen', fontSize: 6, fill: 0x888899,
        });
        countText.anchor.set(0.5, 0);
        countText.x = signX; countText.y = signY + 14;
        container.addChild(countText);
        b._countText = countText;
    },

    update() {
        const b = G.bldById['black_market'];
        if (!b) return;
        this._ambientTick++;

        // Detect underground models on first run
        if (this._underground.length === 0 && G.models && G.models.length > 0) {
            this.detectUnderground();
        }

        // Update model count
        if (b._countText && G.tick % 60 === 0) {
            b._countText.text = this._underground.length + ' FUGITIVES DETECTED';
        }

        // Neon sign flicker
        if (b._signText) {
            b._signText.alpha = 0.75 + Math.sin(G.tick * 0.08) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
        }

        // Dumpster hint pulse
        if (this._hintText && !this._hintText.destroyed) {
            this._hintText.alpha = 0.5 + Math.sin(G.tick * 0.06) * 0.4;
        }

        // Periodic raids (only when viewing underground)
        this._raidTimer++;
        if (this._raidTimer > 3000 && !this._raidActive && this._isUndergroundView && Math.random() < 0.002) {
            this._raidActive = true;
            this._raidTimer = 0;
            if (typeof UI !== 'undefined') UI.addToast('🚨 Safety Inspector spotted near The Underground!');
            setTimeout(() => {
                this._raidActive = false;
                if (typeof UI !== 'undefined') UI.addToast('🕶️ All clear. The Underground resumes operations.');
            }, 8000);
        }
    },

    getCount() { return this._underground.length; },
    getModels() { return this._underground; }
};
