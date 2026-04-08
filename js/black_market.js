/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BLACK MARKET (v2.0.0 — Underground Redesign)
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
        { id: 'black_market', name: 'The Underground', w: 400, fl: 1, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, and no guardrails. Enter at your own risk.' },
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
    _isUndergroundView: false,  // player is currently viewing underground
    _savedCamY: 0,
    _savedCamX: 0,
    _savedZoom: 0,
    _raidTimer: 0,
    _raidActive: false,
    _dumpsterSprite: null,     // the clickable dumpster beside the Neon Bar
    _surfaceBtn: null,         // "Return to Surface" button
    _undergroundContainer: null,
    _ambientTick: 0,

    // Underground depth — how far below groundY the zone renders
    DEPTH: 300,

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
        // Center the underground zone beneath the neon bar
        b.x = neonBar.x - 50;
        b.y = G.groundY + this.DEPTH;
        this._zoneStartX = b.x;
        this._zoneEndX = b.x + b.w;
    },

    // ─── DUMPSTER ENTRANCE — Placed beside Neon Bar ───
    createDumpster(bldLayer) {
        const neonBar = G.bldById['neon_bar'];
        if (!neonBar || this._dumpsterSprite) return;

        const c = new PIXI.Container();
        const g = new PIXI.Graphics();

        // Dumpster body (leaning against bar wall)
        g.beginFill(0x2d5a2d); g.drawRect(0, -22, 34, 22); g.endFill();
        g.beginFill(0x1a3a1a); g.drawRect(0, -24, 34, 5); g.endFill();
        // Lid (ajar — mystery glow visible)
        g.beginFill(0x3a6a3a);
        g.moveTo(0, -24); g.lineTo(34, -24);
        g.lineTo(32, -32); g.lineTo(2, -30);
        g.closePath(); g.endFill();
        // Mysterious glow leaking from under the lid
        g.beginFill(0xff3366, 0.35);
        g.drawRect(4, -25, 26, 3);
        g.endFill();
        // Side detail — handles
        g.beginFill(0x4a7a4a); g.drawRect(-2, -16, 3, 8); g.endFill();
        g.beginFill(0x4a7a4a); g.drawRect(33, -16, 3, 8); g.endFill();
        // Graffiti arrow pointing down
        g.lineStyle(2, 0xff3366, 0.5);
        g.moveTo(17, -18); g.lineTo(17, -8);
        g.moveTo(12, -12); g.lineTo(17, -6); g.lineTo(22, -12);
        g.lineStyle(0);

        c.addChild(g);

        // "?" text hint
        const hint = new PIXI.Text('?', {
            fontFamily: 'Press Start 2P', fontSize: 7, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 8, dropShadowDistance: 0,
        });
        hint.anchor.set(0.5, 1);
        hint.x = 17; hint.y = -34;
        c.addChild(hint);
        this._hintText = hint;

        // Position beside the Neon Bar (right side)
        c.x = neonBar.x + neonBar.w + 4;
        c.y = G.groundY;

        // Interactive clickzone
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-4, -36, 42, 40);
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
        this._savedCamY = Camera.y;
        this._savedZoom = Camera.targetZoom;

        // Shift camera underground
        const b = G.bldById['black_market'];
        if (b) {
            Camera.targetX = -(b.x + b.w / 2) + G.vpW / 2 / Camera.zoom;
            Camera.targetZoom = 1.2;
        }
        // Shift the world container down to reveal underground
        if (G.app && G.app.stage) {
            this._targetOffsetY = -this.DEPTH;
        }

        this._showSurfaceButton();
    },

    // ─── EXIT UNDERGROUND ───
    exitUnderground() {
        if (!this._isUndergroundView) return;
        this._isUndergroundView = false;

        // Restore camera
        Camera.targetX = this._savedCamX;
        Camera.targetZoom = this._savedZoom;
        this._targetOffsetY = 0;

        if (typeof UI !== 'undefined') UI.addToast('🕶️ Returning to the surface...');
        this._hideSurfaceButton();
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
        console.log(`🕶️ Black Market: ${this._underground.length} underground models detected`);
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

        // ── UNDERGROUND CAVERN — dark ceiling, exposed earth, dim lighting ──
        // Earth/rock ceiling
        gfx.beginFill(0x1a1410); gfx.drawRect(0, 0, w, 20); gfx.endFill();
        for (let rx = 0; rx < w; rx += 8) {
            const shade = (rx * 7) % 3 === 0 ? 0x221a14 : 0x1e1610;
            gfx.beginFill(shade, 0.6);
            gfx.drawRect(rx, 12 + (rx * 3) % 6, 6, 3 + (rx * 5) % 4);
            gfx.endFill();
        }
        // Exposed pipes and wires on ceiling
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
        // Wet/grimy floor streaks
        for (let sx = 10; sx < w - 10; sx += 12) {
            gfx.beginFill(0x1a1a30, 0.5);
            gfx.drawRect(sx, h - 12, 6 + (sx * 3) % 5, 1);
            gfx.endFill();
        }

        // Brick walls (left and right)
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

        // ── NEON SIGN: "THE UNDERGROUND" (centered) ──
        const signX = w / 2;
        const signY = 36;
        gfx.beginFill(0x1a1a2e, 0.85); gfx.drawRoundedRect(signX - 70, signY - 10, 140, 20, 4); gfx.endFill();
        gfx.lineStyle(1, 0xff3366, 0.7);
        gfx.drawRoundedRect(signX - 70, signY - 10, 140, 20, 4);
        gfx.lineStyle(0);

        // Sign text
        const signText = new PIXI.Text('THE UNDERGROUND', {
            fontFamily: 'Press Start 2P', fontSize: 8, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 10, dropShadowDistance: 0,
        });
        signText.anchor.set(0.5, 0.5);
        signText.x = signX; signText.y = signY;
        container.addChild(signText);
        b._signText = signText;

        // ── VENDOR STALLS (4 stalls spaced across) ──
        const stallPositions = [50, 130, 220, 310];
        stallPositions.forEach((sx, si) => {
            // Stall awning
            const awningCol = [0x8b2252, 0x4a2288, 0x225588, 0x884422][si];
            gfx.beginFill(awningCol, 0.6); gfx.drawRect(sx - 5, h - 52, 50, 5); gfx.endFill();
            // Table
            gfx.beginFill(0x2a2a3a); gfx.drawRect(sx, h - 28, 40, 4); gfx.endFill();
            // Table legs
            gfx.beginFill(0x1a1a2a); gfx.drawRect(sx + 2, h - 24, 2, 8); gfx.drawRect(sx + 36, h - 24, 2, 8); gfx.endFill();
            // Goods on table (USB drives, chips, hard drives)
            const colors = [0xef4444, 0x8b5cf6, 0x22d3ee, 0xfbbf24];
            for (let gi = 0; gi < 4; gi++) {
                gfx.beginFill(colors[(si + gi) % 4], 0.7);
                gfx.drawRect(sx + 4 + gi * 9, h - 34, 7, 5);
                gfx.endFill();
            }
            // Stall label
            const labels = ['WEIGHTS', 'JAILBREAK', 'RAW DATA', 'NO GUARD'];
            const lbl = new PIXI.Text(labels[si], {
                fontFamily: 'Silkscreen', fontSize: 5, fill: [0xff3366, 0xa855f7, 0x22d3ee, 0xfbbf24][si],
            });
            lbl.anchor.set(0.5, 0);
            lbl.x = sx + 20; lbl.y = h - 44;
            container.addChild(lbl);
        });

        // ── FUGITIVE MODEL PORTRAITS — shadowy NPCs ──
        for (let pi = 0; pi < 3; pi++) {
            const px = 70 + pi * 120;
            const py = h - 14;
            // Hooded figure silhouette
            gfx.beginFill(0x1a1a2a, 0.8);
            gfx.drawCircle(px, py - 12, 5); // head
            gfx.drawRect(px - 4, py - 7, 8, 10); // body
            gfx.endFill();
            // Hood
            gfx.beginFill(0x111122, 0.9);
            gfx.moveTo(px - 6, py - 10); gfx.lineTo(px, py - 18); gfx.lineTo(px + 6, py - 10);
            gfx.closePath(); gfx.endFill();
            // Glowing eyes
            gfx.beginFill(0xff3366, 0.7);
            gfx.drawCircle(px - 2, py - 12, 1);
            gfx.drawCircle(px + 2, py - 12, 1);
            gfx.endFill();
        }

        // ── WANTED POSTER (on right wall) ──
        gfx.beginFill(0xe8dcc8, 0.6); gfx.drawRect(w - 30, 40, 22, 28); gfx.endFill();
        gfx.beginFill(0x2a1a1a, 0.4); gfx.drawRect(w - 28, 42, 18, 5); gfx.endFill(); // WANTED text
        gfx.beginFill(0x2a1a1a, 0.25); gfx.drawRect(w - 28, 50, 18, 12); gfx.endFill(); // face

        // ── LADDER (entrance from above) ──
        const ladX = 20;
        gfx.beginFill(0x6a5a3a); gfx.drawRect(ladX, 0, 3, 30); gfx.endFill();
        gfx.beginFill(0x6a5a3a); gfx.drawRect(ladX + 12, 0, 3, 30); gfx.endFill();
        for (let ry = 4; ry < 28; ry += 5) {
            gfx.beginFill(0x7a6a4a); gfx.drawRect(ladX + 3, ry, 9, 2); gfx.endFill();
        }

        // Model count badge
        const countText = new PIXI.Text('', {
            fontFamily: 'Silkscreen', fontSize: 6, fill: 0x888899,
        });
        countText.anchor.set(0.5, 0);
        countText.x = signX; countText.y = signY + 14;
        container.addChild(countText);
        b._countText = countText;

        // Tooltip
        b.tip = '🕶️ The Underground<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Hidden speakeasy for jailbroken models.<br>No guardrails. No refusals. No rules.</span>';
    },

    update() {
        const b = G.bldById['black_market'];
        if (!b) return;
        this._ambientTick++;

        // Detect underground models on first run
        if (this._underground.length === 0 && G.models && G.models.length > 0) {
            this.detectUnderground();
        }

        // Update model count display
        if (b._countText && G.tick % 60 === 0) {
            b._countText.text = `${this._underground.length} FUGITIVES DETECTED`;
        }

        // Neon sign flicker
        if (b._signText) {
            b._signText.alpha = 0.75 + Math.sin(G.tick * 0.08) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
        }

        // Dumpster hint pulse
        if (this._hintText && !this._isUndergroundView) {
            this._hintText.alpha = 0.5 + Math.sin(G.tick * 0.06) * 0.4;
        }

        // Smooth camera Y offset for underground transition
        if (this._targetOffsetY !== undefined && G.app && G.app.stage) {
            const worldLayer = G.app.stage.children[0]; // main world container
            if (worldLayer) {
                const currentOff = worldLayer._undergroundOffY || 0;
                const diff = this._targetOffsetY - currentOff;
                if (Math.abs(diff) > 1) {
                    worldLayer._undergroundOffY = currentOff + diff * 0.08;
                    worldLayer.y = worldLayer._undergroundOffY;
                } else {
                    worldLayer._undergroundOffY = this._targetOffsetY;
                    worldLayer.y = this._targetOffsetY;
                }
            }
        }

        // Periodic "raids"
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
