/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   VENTURE CAPITAL ROW (v1.0.0)
   Financial district between Tech District and Convention Center.
   VC firms, investment banks, accelerators, and a live AI exchange.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const VCRow = {
    BLDS: [
        { id: 'vcrow_apex',      name: 'Apex Ventures',     w: 200, fl: 6, emoji: '💰', type: 'vcrow', desc: 'Premier venture capital firm. Has backed 60% of the city\'s AI labs from seed to IPO.' },
        { id: 'vcrow_horizon',   name: 'Horizon Capital',   w: 180, fl: 5, emoji: '📈', type: 'vcrow', desc: 'Growth-stage fund specializing in AI infrastructure, compute clusters, and data moats.' },
        { id: 'vcrow_launchpad', name: 'Startup Launchpad', w: 180, fl: 4, emoji: '🚀', type: 'vcrow', desc: 'AI accelerator program. Fresh graduates and rumored models pitch here for seed funding.' },
        { id: 'vcrow_titan',     name: 'Titan Bank',        w: 240, fl: 7, emoji: '🏦', type: 'vcrow', desc: 'The tallest building on VC Row. Handles IPOs, M&A, and billion-dollar debt financing.' },
        { id: 'vcrow_exchange',  name: 'AI Exchange',       w: 200, fl: 3, emoji: '📊', type: 'vcrow', desc: 'Real-time trading floor. Model valuations, compute futures, and API pricing derivatives.' },
    ],

    NPCS: [
        { id: 'npc_vc_partner',    name: 'VC Partner',     role: 'Venture Partner',     workplace: 'vcrow', color: '#4ade80', shift: 'day' },
        { id: 'npc_analyst_vc',    name: 'Analyst',        role: 'Financial Analyst',   workplace: 'vcrow', color: '#22d3ee', shift: 'day' },
        { id: 'npc_founder_coach', name: 'Mentor',         role: 'Startup Mentor',      workplace: 'vcrow', color: '#fbbf24', shift: 'day' },
        { id: 'npc_banker',        name: 'Banker',         role: 'Investment Banker',   workplace: 'vcrow', color: '#94a3b8', shift: 'day' },
        { id: 'npc_trader',        name: 'Trader',         role: 'Floor Trader',        workplace: 'vcrow', color: '#ef4444', shift: 'day' },
    ],

    // Real-world AI funding data (approximate, in $M)
    FUNDING: {
        openai:    { total: 11700, valuation: 157000, rounds: 'Seed → Microsoft $1B → $10B → SoftBank $500M' },
        anthropic: { total: 7600,  valuation: 61500,  rounds: 'Seed $124M → Google $300M → Amazon $4B → Series E $750M' },
        xai:       { total: 12000, valuation: 50000,  rounds: 'Series A $6B → Series C $6B' },
        mistral:   { total: 1100,  valuation: 6000,   rounds: 'Seed €105M → Series A €385M → Series B €600M' },
        cohere:    { total: 970,   valuation: 5500,   rounds: 'Series A $40M → Series C $270M → Series D $500M' },
        inflection:{ total: 1525,  valuation: 4000,   rounds: 'Seed → Series A $225M → Microsoft $1.3B' },
        stability: { total: 250,   valuation: 1000,   rounds: 'Seed $100M → Series A $150M' },
        adept:     { total: 415,   valuation: 1000,   rounds: 'Series A $65M → Series B $350M' },
    },

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,
    dealTicker: [],
    tickerIdx: 0,
    carCommuters: [],
    _carLayer: null,

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { ...def, x: 0, lab: null };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // VC NPCs use cars, not walking — don't register with NPCHousing

        // Build scrolling deal ticker
        this._buildTicker();
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;
        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) { bld.x = x; x += bld.w + 50; }
        });
        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    _buildTicker() {
        this.dealTicker = [];
        // Lab aggregate totals (reference data)
        Object.entries(this.FUNDING).forEach(([lab, data]) => {
            const labName = (typeof LABS !== 'undefined' && LABS[lab]) ? LABS[lab].name : lab;
            if (data.total > 0) {
                this.dealTicker.push(`💰 ${labName}: $${(data.total / 1000).toFixed(1)}B raised`);
                if (data.valuation) this.dealTicker.push(`📊 ${labName} valued at $${(data.valuation / 1000).toFixed(0)}B`);
            }
        });
        // Real RSS-sourced deal headlines (replaces old hardcoded filler)
        if (typeof API !== 'undefined' && API.vcDeals?.length > 0) {
            API.vcDeals.slice(0, 10).forEach(deal => {
                const emoji = /series\s+[c-f]/i.test(deal.round) ? '🦄' : deal.round ? '🔔' : '💰';
                this.dealTicker.push(`${emoji} ${deal.headline}`);
            });
        } else {
            // Generic fallback when no RSS data available yet
            this.dealTicker.push('📈 GPU compute demand trending up on AI training surge');
            this.dealTicker.push('🔔 AI startup funding at record highs');
            this.dealTicker.push('📉 API pricing dropping as competition intensifies');
            this.dealTicker.push('🏦 Late-stage mega-rounds dominating AI investment');
            this.dealTicker.push('🚀 Early-stage AI seed rounds accelerating globally');
            this.dealTicker.push('⚡ Datacenter capacity demand outpacing supply');
        }
        // Shuffle
        for (let i = this.dealTicker.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.dealTicker[i], this.dealTicker[j]] = [this.dealTicker[j], this.dealTicker[i]];
        }
    },

    getNextTickerItem() {
        if (!this.dealTicker.length) return '';
        const item = this.dealTicker[this.tickerIdx % this.dealTicker.length];
        this.tickerIdx++;
        return item;
    },

    // Get total industry funding
    getTotalFunding() {
        return Object.values(this.FUNDING).reduce((s, d) => s + d.total, 0);
    },

    // Get lab funding if available
    getLabFunding(labId) {
        return this.FUNDING[labId] || null;
    },

    // ─── CAR COMMUTER SYSTEM (VC NPCs drive luxury cars) ───
    spawnCars(carLayer) {
        if (!carLayer || this.carCommuters.length > 0) return;
        this._carLayer = carLayer;

        this.NPCS.forEach((npc, i) => {
            const col = parseInt(npc.color.replace('#', ''), 16);
            const carCont = new PIXI.Container();

            // CEO-style car body
            const gfx = new PIXI.Graphics();
            gfx.beginFill(col); gfx.drawRoundedRect(-22, -18, 44, 18, 4); gfx.endFill();
            gfx.beginFill(col, 0.8); gfx.drawRoundedRect(-12, -28, 24, 12, 4); gfx.endFill();
            gfx.beginFill(0xffffff, 0.15); gfx.drawRect(-10, -26, 9, 8); gfx.drawRect(1, -26, 9, 8); gfx.endFill();
            gfx.beginFill(0x333333); gfx.drawCircle(-12, -1, 4); gfx.drawCircle(12, -1, 4); gfx.endFill();
            gfx.beginFill(0x555555); gfx.drawCircle(-12, -1, 2); gfx.drawCircle(12, -1, 2); gfx.endFill();
            gfx.beginFill(0xffffff, 1.0); gfx.drawRect(20, -8, 4, 6); gfx.endFill();
            gfx.beginFill(0xff3333, 1.0); gfx.drawRect(-26, -10, 4, 4); gfx.endFill();
            carCont.addChild(gfx);

            // Headlight beam
            const beam = new PIXI.Graphics();
            beam.beginFill(0xffffee, 0.12);
            beam.drawPolygon([24, -8, 80, -20, 80, 10, 24, 0]);
            beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD;
            carCont.addChildAt(beam, 0);

            // NPC face in car
            const face = new PIXI.Graphics();
            face.beginFill(0xfdd8b5); face.drawCircle(0, 0, 3.5); face.endFill();
            face.beginFill(0x2c1810); face.drawCircle(-1.2, -0.5, 0.7); face.drawCircle(1.2, -0.5, 0.7); face.endFill();
            face.x = 0; face.y = -22;
            carCont.addChild(face);

            // Name label above car
            const tag = new PIXI.Text(npc.name, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
            tag.anchor.set(0.5, 1); tag.y = -32;
            carCont.addChild(tag);

            carCont.y = G.groundY - 12; // road level
            carCont.visible = false;
            carCont.zIndex = Math.round(G.groundY - 12);
            carLayer.addChild(carCont);

            // Home and work positions
            const homeBld = typeof NPCHousing !== 'undefined' ? BLDS.find(b => b.id === 'npc_apt_' + (1 + (i % 3))) : null;
            const homeX = homeBld ? homeBld.x + homeBld.w / 2 : 200;
            const workBld = G.bldById['vcrow_titan'] || G.bldById['vcrow_apex'];
            const workX = workBld ? workBld.x + workBld.w / 2 + i * 40 : this.zoneStartX + 100;

            // Start in correct state
            const dp = G.getDayPhase();
            const shouldWork = dp > 0.33 && dp < 0.75;

            const workBldId = G.bldById['vcrow_titan'] ? 'vcrow_titan' : (G.bldById['vcrow_apex'] ? 'vcrow_apex' : null);
            const homeBldId = homeBld ? homeBld.id : 'npc_apt_1';

            // Click to select/track VC commuter
            carCont.eventMode = 'static';
            carCont.cursor = 'pointer';
            carCont.hitArea = new PIXI.Rectangle(-28, -34, 56, 40);
            const _npc = npc;
            carCont.on('pointertap', () => {
                if (typeof UI !== 'undefined') UI.selectModel({
                    id: _npc.id, name: _npc.name, isNPC: true, _trackType: 'vc_commuter',
                    role: _npc.role, lab: 'other',
                    desc: `${_npc.name} commutes to VC Row by car. ${_npc.role} in the financial district.`
                });
            });
            carCont.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, _npc.name, _npc.role); });
            carCont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

            this.carCommuters.push({
                npc, carCont, beam, homeX, workX,
                state: shouldWork ? 'at_work' : 'at_home',
                speed: 2.5 + Math.random() * 1.0,
                bld: shouldWork ? workBldId : homeBldId,
                workBldId, homeBldId
            });
        });
    },

    updateCommuters(dp) {
        if (!this.carCommuters.length) return;
        const wantWork = dp > 0.33 && dp < 0.75;
        const lunchWindow = dp >= 0.45 && dp < 0.55;

        this.carCommuters.forEach((cm, ci) => {
            // Morning arrival
            if (wantWork && cm.state === 'at_home') {
                cm.state = 'driving_to_work';
                cm.carCont.visible = true;
                cm.carCont.x = cm.homeX;
                cm.carCont.scale.x = cm.workX > cm.homeX ? 1 : -1;
                cm.bld = null;
            }
            // Evening departure
            else if (!wantWork && (cm.state === 'at_work' || cm.state === 'back_from_lunch')) {
                cm.state = 'driving_home';
                cm.carCont.visible = true;
                cm.carCont.x = cm.workX;
                cm.carCont.scale.x = cm.homeX > cm.workX ? 1 : -1;
                cm.bld = null;
            }
            // Lunch break — staggered by NPC index so they don't all leave at once
            else if (lunchWindow && cm.state === 'at_work' && !cm._lunchDone) {
                const lunchThreshold = 0.45 + (ci * 0.015);
                if (dp >= lunchThreshold && Math.random() < 0.003) {
                    cm.state = 'driving_to_lunch';
                    cm.carCont.visible = true;
                    cm.carCont.x = cm.workX;
                    // Drive to a random spot (cafe area or a short cruise)
                    const cafeBld = G.bldById['cafe'];
                    cm._lunchX = cafeBld ? cafeBld.x + cafeBld.w / 2 : cm.workX + (Math.random() > 0.5 ? 400 : -400);
                    cm.carCont.scale.x = cm._lunchX > cm.workX ? 1 : -1;
                    cm.bld = null;
                    cm._lunchDone = true;
                }
            }
            // Reset lunch flag for next day
            if (dp < 0.33) cm._lunchDone = false;

            // Movement states
            if (cm.state === 'driving_to_work') {
                const dx = cm.workX - cm.carCont.x;
                if (Math.abs(dx) < 5) {
                    cm.state = 'at_work';
                    cm.carCont.visible = false;
                    cm.bld = cm.workBldId;
                } else {
                    cm.carCont.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                }
            } else if (cm.state === 'driving_home') {
                const dx = cm.homeX - cm.carCont.x;
                if (Math.abs(dx) < 5) {
                    cm.state = 'at_home';
                    cm.carCont.visible = false;
                    cm.bld = cm.homeBldId;
                } else {
                    cm.carCont.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                }
            } else if (cm.state === 'driving_to_lunch') {
                const dx = cm._lunchX - cm.carCont.x;
                if (Math.abs(dx) < 5) {
                    cm.state = 'at_lunch';
                    cm.carCont.visible = false;  // Car disappears — NPC enters building
                    cm._lunchTimer = 400 + Math.random() * 300;
                } else {
                    cm.carCont.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                }
            } else if (cm.state === 'at_lunch') {
                cm.carCont.visible = false;
                cm._lunchTimer--;
                if (cm._lunchTimer <= 0) {
                    cm.state = 'driving_from_lunch';
                    cm.carCont.visible = true;   // Car reappears — NPC exits building
                    cm.carCont.scale.x = cm.workX > cm.carCont.x ? 1 : -1;
                }
            } else if (cm.state === 'driving_from_lunch') {
                const dx = cm.workX - cm.carCont.x;
                if (Math.abs(dx) < 5) {
                    cm.state = 'back_from_lunch';
                    cm.carCont.visible = false;
                    cm.bld = cm.workBldId;
                } else {
                    cm.carCont.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                }
            } else if (cm.state !== 'driving_to_work' && cm.state !== 'driving_home' && cm.state !== 'driving_to_lunch' && cm.state !== 'at_lunch' && cm.state !== 'driving_from_lunch') {
                cm.carCont.visible = false;
            }
        });
    },

    update() {
        // Dynamic data updates could go here (e.g., Supabase fetch for live funding)
    }
};
