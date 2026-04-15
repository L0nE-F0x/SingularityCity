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

    SUBURB_BLDS: [
        { id: 'suburb_1', name: 'Maple Crescent',   w: 150, fl: 2, emoji: '🏡', desc: 'Upper middle-class townhome. Home of a VC Partner. Picket fence, two-car garage, smart driveway.' },
        { id: 'suburb_2', name: 'Cypress Drive',    w: 150, fl: 2, emoji: '🏡', desc: 'Brick-front Craftsman. Home of the Analyst. Home office with multi-monitor workstation.' },
        { id: 'suburb_3', name: 'Oakwood Lane',     w: 150, fl: 2, emoji: '🏡', desc: 'Colonial townhouse. Home of the Startup Mentor. Fireplace, whiskey collection, pitch deck archive.' },
        { id: 'suburb_4', name: 'Birch Hollow',     w: 150, fl: 2, emoji: '🏡', desc: 'Modern farmhouse. Home of the Investment Banker. Commutes to Titan Bank every dawn.' },
        { id: 'suburb_5', name: 'Willow Terrace',   w: 150, fl: 2, emoji: '🏡', desc: 'Corner lot Tudor. Home of the Floor Trader. Three monitors above the kitchen island.' },
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

        // Middle-class suburbia for VC Row commuters
        this.SUBURB_BLDS.forEach(def => {
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

    // Position suburb district (called separately from VC Row)
    positionSuburbs(afterX) {
        let x = afterX + 80;
        this.suburbStartX = x;
        this.SUBURB_BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) { bld.x = x; x += bld.w + 30; }
        });
        this.suburbEndX = x + 60;
        return this.suburbEndX;
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
            // Daytime headlight/tail light housings (dim, always visible)
            gfx.beginFill(0x888888, 0.5); gfx.drawRect(20, -8, 4, 6); gfx.endFill();
            gfx.beginFill(0x993333, 0.4); gfx.drawRect(-26, -10, 4, 4); gfx.endFill();
            carCont.addChild(gfx);

            // Headlight & tail light glow (on at night / bad weather only)
            const lights = new PIXI.Graphics();
            lights.beginFill(0xffffff, 1.0); lights.drawRect(20, -8, 4, 6); lights.endFill();
            lights.beginFill(0xff3333, 1.0); lights.drawRect(-26, -10, 4, 4); lights.endFill();
            lights.alpha = 0;
            carCont.addChild(lights);

            // Headlight beam cone
            const beam = new PIXI.Graphics();
            beam.beginFill(0xffffee, 0.12);
            beam.drawPolygon([24, -8, 80, -20, 80, 10, 24, 0]);
            beam.endFill();
            beam.blendMode = PIXI.BLEND_MODES.ADD;
            beam.alpha = 0;
            carCont.addChildAt(beam, 0);

            // NPC face in car
            const face = new PIXI.Graphics();
            face.beginFill(0xfdd8b5); face.drawCircle(0, 0, 3.5); face.endFill();
            face.beginFill(0x2c1810); face.drawCircle(-1.2, -0.5, 0.7); face.drawCircle(1.2, -0.5, 0.7); face.endFill();
            face.x = 0; face.y = -22;
            carCont.addChild(face);

            // Start with headlights off (controlled by day/night in updateCommuters)
            beam.alpha = 0;

            carCont.y = G.groundY - 12; // road level
            carCont.visible = false;
            carCont.zIndex = Math.round(G.groundY - 12);
            carLayer.addChild(carCont);

            // Home = a suburb townhome (one per VC NPC), work = VC Row
            const suburbDef = this.SUBURB_BLDS[i % this.SUBURB_BLDS.length];
            const homeBld = suburbDef ? BLDS.find(b => b.id === suburbDef.id) : null;
            const homeX = homeBld ? homeBld.x + homeBld.w / 2 : 200;
            const workBld = G.bldById['vcrow_titan'] || G.bldById['vcrow_apex'];
            const workX = workBld ? workBld.x + workBld.w / 2 + i * 40 : this.zoneStartX + 100;

            // Start in correct state
            const dp = G.getDayPhase();
            const shouldWork = dp > 0.33 && dp < 0.75;

            const workBldId = G.bldById['vcrow_titan'] ? 'vcrow_titan' : (G.bldById['vcrow_apex'] ? 'vcrow_apex' : null);
            const homeBldId = homeBld ? homeBld.id : (suburbDef ? suburbDef.id : 'suburb_1');

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
                npc, carCont, beam, lights, homeX, workX,
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

        // Headlights: on at night or in bad weather, off during clear day
        const night = dp > 0.83 || dp < 0.25;
        const badWeather = typeof Environment !== 'undefined' && (
            Environment.isRainy?.() || Environment.weather === 'snow' ||
            Environment.weather === 'overcast' || Environment.weather === 'fog'
        );
        const beamTarget = night ? 1 : (badWeather ? 0.5 : 0);

        this.carCommuters.forEach((cm, ci) => {
            // Smooth headlight + tail light transition
            cm.beam.alpha += (beamTarget - cm.beam.alpha) * 0.05;
            cm.lights.alpha += (beamTarget - cm.lights.alpha) * 0.05;

            // Skip commuters currently on a deal trip — handled by _updateDealFlow
            if (cm.state === 'deal_trip') return;

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
            } else if (cm.state !== 'driving_to_work' && cm.state !== 'driving_home' && cm.state !== 'driving_to_lunch' && cm.state !== 'at_lunch' && cm.state !== 'driving_from_lunch' && cm.state !== 'back_from_lunch') {
                cm.carCont.visible = false;
            }
        });
    },

    update() {
        // ─── DEAL FLOW: Periodic VC → Lab HQ funding trips ───
        this._updateDealFlow();
    },

    // ═══════════════════════════════════════════════════════
    //   DEAL FLOW ANIMATION SYSTEM
    // ═══════════════════════════════════════════════════════

    _activeDeals: [],
    _dealParticles: [],
    _nextDealTick: 800,
    _dealLayer: null,

    _updateDealFlow() {
        if (!this._dealLayer && this._carLayer) {
            this._dealLayer = new PIXI.Container();
            this._carLayer.addChild(this._dealLayer);
        }
        if (!this._dealLayer) return;

        const dp = G.getDayPhase();
        const isBusinessHours = dp >= 0.35 && dp < 0.72;

        // Spawn new deals periodically during business hours
        if (isBusinessHours && G.tick >= this._nextDealTick && this._activeDeals.length < 2) {
            this._spawnDeal();
            this._nextDealTick = G.tick + 1500 + Math.floor(Math.random() * 1500);
        }

        // Update active deals
        for (let i = this._activeDeals.length - 1; i >= 0; i--) {
            const deal = this._activeDeals[i];
            this._updateDeal(deal, i);
        }

        // Update money particles
        for (let i = this._dealParticles.length - 1; i >= 0; i--) {
            const p = this._dealParticles[i];
            p.sprite.x += p.vx;
            p.sprite.y += p.vy;
            p.vy += 0.03;
            p.life--;
            p.sprite.alpha = Math.max(0, p.life / p.maxLife);
            p.sprite.rotation += 0.05;
            if (p.life <= 0) {
                if (p.sprite.parent) p.sprite.parent.removeChild(p.sprite);
                this._dealParticles.splice(i, 1);
            }
        }
    },

    _spawnDeal() {
        // Pick a VC commuter (the partner or analyst)
        const vcCandidates = this.carCommuters.filter(c => c.state === 'at_work' || c.state === 'back_from_lunch');
        if (vcCandidates.length === 0) return;
        const vc = vcCandidates[Math.floor(Math.random() * vcCandidates.length)];

        // Pick a random funded lab HQ as destination
        const fundedLabs = Object.keys(this.FUNDING);
        const lab = fundedLabs[Math.floor(Math.random() * fundedLabs.length)];
        const labBlds = G.bldsByLab[lab] || [];
        const hq = labBlds.find(b => !b.id.startsWith('house_'));
        if (!hq) return;

        const funding = this.FUNDING[lab];
        const labName = (typeof LABS !== 'undefined' && LABS[lab]) ? LABS[lab].name : lab;
        const labCol = (typeof LABS !== 'undefined' && LABS[lab]) ? parseInt(LABS[lab].color.replace('#', ''), 16) : 0x4ade80;

        // Mark commuter as doing a deal trip
        vc.state = 'deal_trip';
        vc.carCont.visible = true;
        vc.carCont.x = vc.workX;
        vc._dealTargetX = hq.x + hq.w / 2;
        vc.carCont.scale.x = vc._dealTargetX > vc.workX ? 1 : -1;

        // Create valuation popup (follows the deal)
        const popup = new PIXI.Container();
        const popBg = new PIXI.Graphics();
        popBg.beginFill(0x0a0a18, 0.85);
        popBg.drawRoundedRect(-50, -24, 100, 22, 4);
        popBg.endFill();
        popBg.beginFill(labCol, 0.3);
        popBg.drawRoundedRect(-50, -24, 100, 22, 4);
        popBg.endFill();
        popup.addChild(popBg);

        const valText = `$${(funding.valuation / 1000).toFixed(0)}B ${labName}`;
        const txt = new PIXI.Text(valText, { fontFamily: 'Silkscreen', fontSize: 6, fill: 0xffffff });
        txt.anchor.set(0.5, 0.5);
        txt.y = -13;
        popup.addChild(txt);

        popup.x = vc.workX;
        popup.y = G.groundY - 50;
        popup.alpha = 0;
        this._dealLayer.addChild(popup);

        this._activeDeals.push({
            vc,
            lab,
            labCol,
            hq,
            popup,
            phase: 'traveling', // traveling → handshake → celebrating → returning → done
            timer: 0,
        });

        if (typeof UI !== 'undefined') {
            UI.addToast(`💰 ${vc.npc.name} heading to ${labName} HQ for funding meeting`);
        }
    },

    _updateDeal(deal, index) {
        const vc = deal.vc;

        if (deal.phase === 'traveling') {
            const dx = vc._dealTargetX - vc.carCont.x;
            deal.popup.x = vc.carCont.x;
            deal.popup.alpha = Math.min(1, deal.popup.alpha + 0.02);

            if (Math.abs(dx) < 5) {
                deal.phase = 'handshake';
                deal.timer = 120;
                vc.carCont.visible = false;
                deal.popup.y = G.groundY - 60;
            } else {
                vc.carCont.x += Math.sign(dx) * Math.min(vc.speed, Math.abs(dx));
            }
        } else if (deal.phase === 'handshake') {
            deal.timer--;
            deal.popup.x = vc._dealTargetX;
            // Pulse the popup
            deal.popup.scale.set(1 + Math.sin(G.tick * 0.1) * 0.05);

            // Handshake indicator
            if (deal.timer === 80) {
                // Spawn handshake emoji
                const shake = new PIXI.Text('🤝', { fontSize: 16, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' });
                shake.anchor.set(0.5, 0.5);
                shake.x = vc._dealTargetX;
                shake.y = G.groundY - 40;
                this._dealLayer.addChild(shake);
                deal._shakeEmoji = shake;
            }

            if (deal.timer <= 0) {
                deal.phase = 'celebrating';
                deal.timer = 90;
                // Spawn money particles
                this._spawnMoneyBurst(vc._dealTargetX, G.groundY - 30, deal.labCol);
                if (deal._shakeEmoji && deal._shakeEmoji.parent) {
                    deal._shakeEmoji.parent.removeChild(deal._shakeEmoji);
                }
            }
        } else if (deal.phase === 'celebrating') {
            deal.timer--;
            deal.popup.alpha = Math.max(0, deal.timer / 90);
            if (deal.timer <= 0) {
                deal.phase = 'returning';
                vc.carCont.visible = true;
                vc.carCont.x = vc._dealTargetX;
                vc.carCont.scale.x = vc.workX > vc._dealTargetX ? 1 : -1;
            }
        } else if (deal.phase === 'returning') {
            const dx = vc.workX - vc.carCont.x;
            if (Math.abs(dx) < 5) {
                deal.phase = 'done';
                vc.state = 'at_work';
                vc.carCont.visible = false;
                vc.bld = vc.workBldId;
            } else {
                vc.carCont.x += Math.sign(dx) * Math.min(vc.speed, Math.abs(dx));
            }
        } else if (deal.phase === 'done') {
            if (deal.popup.parent) deal.popup.parent.removeChild(deal.popup);
            this._activeDeals.splice(index, 1);
        }
    },

    _spawnMoneyBurst(x, y, color) {
        const count = 12 + Math.floor(Math.random() * 8);
        for (let i = 0; i < count; i++) {
            const g = new PIXI.Graphics();
            const isGold = Math.random() > 0.4;
            const col = isGold ? 0xfbbf24 : color;
            g.beginFill(col, 0.8);
            if (isGold) {
                g.drawCircle(0, 0, 2 + Math.random()); // coin
            } else {
                g.drawRect(-2, -1, 4, 2); // bill
            }
            g.endFill();
            g.x = x;
            g.y = y;
            this._dealLayer.addChild(g);

            this._dealParticles.push({
                sprite: g,
                vx: (Math.random() - 0.5) * 3,
                vy: -(1.5 + Math.random() * 3),
                life: 60 + Math.floor(Math.random() * 40),
                maxLife: 100,
            });
        }

        // Dollar sign popup
        const dollar = new PIXI.Text('💰', { fontSize: 18, fontFamily: 'Segoe UI Emoji, Apple Color Emoji, sans-serif' });
        dollar.anchor.set(0.5, 0.5);
        dollar.x = x; dollar.y = y - 10;
        this._dealLayer.addChild(dollar);
        this._dealParticles.push({
            sprite: dollar,
            vx: 0, vy: -0.8,
            life: 60, maxLife: 60,
        });
    }
};
