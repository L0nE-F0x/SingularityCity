/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   BLACK MARKET (v1.0.0)
   Hidden underground zone for jailbroken/uncensored model variants.
   Entrance: hidden behind a dumpster near Legacy Systems graveyard.
   Detection tiers:
     T1 — Name-pattern (uncensored, abliterated, unfiltered, NSFW, raw, etc.)
     T2 — Curated notorious list (Dolphin, WizardLM-Uncensored, MythoMax, etc.)
     T3 — Derivative detection (open-source + not from original lab)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BlackMarket = {

    BLDS: [
        { id: 'black_market', name: 'The Underground', w: 300, fl: 1, emoji: '🕶️', type: 'black_market', desc: 'A hidden speakeasy beneath the city. Jailbroken models, uncensored weights, and no guardrails. Enter at your own risk.' },
    ],

    // ─── DETECTION PATTERNS ───

    // Tier 1: Name-pattern keywords (auto-detected from model name)
    T1_KEYWORDS: [
        'uncensored', 'abliterated', 'unfiltered', 'nsfw', 'raw',
        'unleashed', 'unchained', 'no-refusal', 'unaligned', 'jailbreak',
        'unrestricted', 'unbiased', 'toxic', 'darkest',
    ],

    // Tier 2: Curated notorious models
    T2_MODELS: [
        'dolphin', 'wizardlm-uncensored', 'mythomax', 'goliath',
        'nous-hermes', 'bagel', 'openhermes', 'neural-chat',
        'tinyllama', 'stablelm', 'yi-', 'solar',
    ],

    // Tier 3: Known base models (if derivative + open source + different lab = underground)
    T3_BASES: ['llama', 'mistral', 'qwen', 'gemma', 'phi', 'falcon', 'mpt', 'bloom'],

    _underground: [],     // models flagged as underground
    _zoneStartX: 0,
    _zoneEndX: 0,
    _entranceBuilt: false,
    _revealed: false,     // player has discovered the entrance
    _raidTimer: 0,
    _raidActive: false,
    _ambientParticles: [],

    init() {
        this.BLDS.forEach(b => {
            b.x = 0; b.lab = null;
            if (!BLDS.find(eb => eb.id === b.id)) {
                BLDS.push(b);
            }
            G.bldById[b.id] = b;
        });
    },

    positionZone(startX) {
        let cx = startX + 40;
        this._zoneStartX = cx;
        this.BLDS.forEach(b => {
            const bld = G.bldById[b.id];
            if (bld) { bld.x = cx; cx += bld.w + 40; }
        });
        this._zoneEndX = cx;
        return cx;
    },

    // ─── DETECTION: Scan all models and flag underground ones ───
    detectUnderground() {
        if (!G.models || G.models.length === 0) return;
        this._underground = [];

        for (let i = 0; i < G.models.length; i++) {
            const m = G.models[i];
            if (this._isUnderground(m)) {
                m._underground = true;
                this._underground.push(m);
            }
        }
        console.log(`🕶️ Black Market: ${this._underground.length} underground models detected`);
    },

    _isUnderground(m) {
        // Must be open-source (can't jailbreak closed APIs)
        if (!m.os) return false;

        const name = (m.name || '').toLowerCase();

        // Tier 1: Name-pattern match
        for (const kw of this.T1_KEYWORDS) {
            if (name.includes(kw)) return true;
        }

        // Tier 2: Curated list
        for (const known of this.T2_MODELS) {
            if (name.includes(known)) return true;
        }

        // Tier 3: Derivative detection
        // Open source + contains a known base model name + NOT from the original lab
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

    // ─── RENDERING ───
    drawZone(gfx, container, b, h) {
        const w = b.w;

        // ── UNDERGROUND AESTHETIC — Dark alley with neon accents ──
        // Dark ground
        gfx.beginFill(0x0a0a14); gfx.drawRect(0, h - 14, w, 14); gfx.endFill();
        gfx.beginFill(0x111120); gfx.drawRect(0, h - 14, w, 5); gfx.endFill();

        // Wet/grimy floor streaks
        for (let sx = 10; sx < w - 10; sx += 15) {
            gfx.beginFill(0x1a1a30, 0.4);
            gfx.drawRect(sx, h - 10, 8 + (sx * 3) % 5, 1);
            gfx.endFill();
        }

        // Brick wall backdrop (left and right)
        for (let by = h - 60; by < h - 14; by += 6) {
            for (let bx = 0; bx < 30; bx += 10) {
                const offset = (by / 6) % 2 === 0 ? 0 : 5;
                gfx.beginFill(0x2a1a1a, 0.4);
                gfx.drawRect(bx + offset, by, 8, 4);
                gfx.endFill();
            }
            for (let bx = w - 30; bx < w; bx += 10) {
                const offset = (by / 6) % 2 === 0 ? 0 : 5;
                gfx.beginFill(0x2a1a1a, 0.4);
                gfx.drawRect(bx + offset, by, 8, 4);
                gfx.endFill();
            }
        }

        // ── NEON SIGN: "THE UNDERGROUND" ──
        const signX = w / 2;
        const signY = h - 55;
        // Sign backing
        gfx.beginFill(0x1a1a2e, 0.8); gfx.drawRoundedRect(signX - 55, signY - 8, 110, 16, 3); gfx.endFill();
        // Neon glow border
        gfx.lineStyle(1, 0xff3366, 0.6);
        gfx.drawRoundedRect(signX - 55, signY - 8, 110, 16, 3);
        gfx.lineStyle(0);

        // ── DUMPSTER (entrance — clickable) ──
        const dumpX = 40;
        const dumpY = h - 14;
        // Dumpster body
        gfx.beginFill(0x2d5a2d); gfx.drawRect(dumpX, dumpY - 18, 30, 18); gfx.endFill();
        gfx.beginFill(0x1a3a1a); gfx.drawRect(dumpX, dumpY - 20, 30, 4); gfx.endFill();
        // Lid (slightly ajar)
        gfx.beginFill(0x3a6a3a);
        gfx.moveTo(dumpX, dumpY - 20); gfx.lineTo(dumpX + 30, dumpY - 20);
        gfx.lineTo(dumpX + 28, dumpY - 26); gfx.lineTo(dumpX + 2, dumpY - 24);
        gfx.closePath(); gfx.endFill();
        // Secret hatch glow under dumpster
        gfx.beginFill(0xff3366, 0.2);
        gfx.drawRect(dumpX + 5, dumpY - 2, 20, 2);
        gfx.endFill();

        // ── SUSPICIOUS VENDOR STALLS ──
        const stallPositions = [100, 160, 220];
        stallPositions.forEach((sx, si) => {
            // Table
            gfx.beginFill(0x2a2a3a); gfx.drawRect(sx, h - 20, 30, 3); gfx.endFill();
            // Table legs
            gfx.beginFill(0x1a1a2a); gfx.drawRect(sx + 2, h - 17, 2, 7); gfx.drawRect(sx + 26, h - 17, 2, 7); gfx.endFill();
            // Goods on table (USB drives, hard drives, etc.)
            const colors = [0xef4444, 0x8b5cf6, 0x22d3ee];
            for (let gi = 0; gi < 3; gi++) {
                gfx.beginFill(colors[(si + gi) % 3], 0.6);
                gfx.drawRect(sx + 4 + gi * 8, h - 24, 6, 4);
                gfx.endFill();
            }
        });

        // ── EXPOSED PIPES (ceiling) ──
        gfx.beginFill(0x3a3a4a, 0.5); gfx.drawRect(20, h - 65, w - 40, 2); gfx.endFill();
        gfx.beginFill(0x4a4a5a, 0.4); gfx.drawRect(50, h - 62, w - 100, 2); gfx.endFill();
        // Dripping pipe
        gfx.beginFill(0x3a3a4a, 0.6); gfx.drawRect(w / 2 + 30, h - 65, 2, 12); gfx.endFill();

        // ── WANTED POSTER ──
        gfx.beginFill(0xe8dcc8, 0.5); gfx.drawRect(w - 25, h - 50, 18, 22); gfx.endFill();
        gfx.beginFill(0x2a1a1a, 0.3); gfx.drawRect(w - 23, h - 48, 14, 4); gfx.endFill();
        gfx.beginFill(0x2a1a1a, 0.2); gfx.drawRect(w - 23, h - 42, 14, 8); gfx.endFill();

        // Neon sign text
        const signText = new PIXI.Text('THE UNDERGROUND', {
            fontFamily: 'Press Start 2P', fontSize: 6, fill: 0xff3366,
            dropShadow: true, dropShadowColor: 0xff3366, dropShadowBlur: 6, dropShadowDistance: 0,
        });
        signText.anchor.set(0.5, 0.5);
        signText.x = signX; signText.y = signY;
        container.addChild(signText);
        b._signText = signText;

        // Underground model count badge
        const countText = new PIXI.Text('', {
            fontFamily: 'Silkscreen', fontSize: 5, fill: 0x888899,
        });
        countText.anchor.set(0.5, 0);
        countText.x = signX; countText.y = signY + 10;
        container.addChild(countText);
        b._countText = countText;

        // Tooltip
        b.tip = '🕶️ The Underground<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Hidden speakeasy for jailbroken models.<br>No guardrails. No refusals. No rules.<br><br><span style="color:#ff3366">Click the dumpster to enter...</span></span>';

        // Achievement clickzone
        const hitZone = new PIXI.Graphics();
        hitZone.beginFill(0xffffff, 0.001);
        hitZone.drawRect(dumpX - 5, dumpY - 28, 40, 30);
        hitZone.endFill();
        hitZone.eventMode = 'static';
        hitZone.cursor = 'pointer';
        hitZone.on('pointertap', () => {
            if (!this._revealed) {
                this._revealed = true;
                if (typeof G !== 'undefined') G.unlockAchieve('shadow_market');
                if (typeof UI !== 'undefined') UI.addToast('🕶️ You found The Underground...');
            }
        });
        hitZone.on('pointerover', (e) => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, '🗑️ Dumpster', this._revealed ? 'The entrance to The Underground' : 'Something glows underneath...');
        });
        hitZone.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        container.addChild(hitZone);
    },

    update() {
        const b = G.bldById['black_market'];
        if (!b) return;

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
            b._signText.alpha = 0.7 + Math.sin(G.tick * 0.08) * 0.2 + (Math.random() < 0.02 ? -0.4 : 0);
        }

        // Periodic "raids" — safety inspector NPC triggers scatter
        this._raidTimer++;
        if (this._raidTimer > 3000 && !this._raidActive && Math.random() < 0.001) {
            this._raidActive = true;
            this._raidTimer = 0;
            if (typeof UI !== 'undefined') UI.addToast('🚨 Safety Inspector spotted near The Underground!');
            setTimeout(() => {
                this._raidActive = false;
                if (typeof UI !== 'undefined') UI.addToast('🕶️ All clear. The Underground resumes operations.');
            }, 8000);
        }
    },

    // Get count of underground models
    getCount() {
        return this._underground.length;
    },

    // Get list of underground models for UI
    getModels() {
        return this._underground;
    }
};
