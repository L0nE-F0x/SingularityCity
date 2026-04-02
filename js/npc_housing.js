/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   NPC HOUSING DISTRICT (v2.0.0)
   Worker apartments between Frontier Pines and Compute District metro.
   All facility NPCs live here and commute to their jobs.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const NPCHousing = {
    REGISTRY: [
        { id: 'npc_noc_lead',   name: 'NOC Lead',      role: 'Network Operations',  workplace: 'dc',    color: '#06b6d4', shift: 'day' },
        { id: 'npc_sre',        name: 'SRE',           role: 'Site Reliability',     workplace: 'dc',    color: '#4ade80', shift: 'night' },
        { id: 'npc_security',   name: 'Security',      role: 'Facility Security',    workplace: 'dc',    color: '#ef4444', shift: 'day' },
        { id: 'npc_sysadmin',   name: 'SysAdmin',      role: 'Systems Admin',        workplace: 'dc',    color: '#22d3ee', shift: 'day' },
        { id: 'npc_power_eng',  name: 'Power Eng',     role: 'Power Engineer',       workplace: 'dc',    color: '#ef4444', shift: 'night' },
        { id: 'npc_litho_tech', name: 'Litho Tech',    role: 'Lithography Tech',     workplace: 'fab',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_process_eng',name: 'Process Eng',   role: 'Process Engineer',     workplace: 'fab',   color: '#94a3b8', shift: 'day' },
        { id: 'npc_etch_tech',  name: 'Etch Tech',     role: 'Etch Technician',      workplace: 'fab',   color: '#22d3ee', shift: 'day' },
        { id: 'npc_chem_safety',name: 'Chem Safety',   role: 'Chemical Safety',      workplace: 'fab',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_foreman',    name: 'Foreman',       role: 'Construction Foreman', workplace: 'dc',    color: '#fbbf24', shift: 'day' },
        { id: 'npc_front_desk', name: 'Front Desk',    role: 'Receptionist',         workplace: 'hq',    color: '#94a3b8', shift: 'day' },
        { id: 'npc_concierge',  name: 'Concierge',     role: 'Building Concierge',   workplace: 'social', color: '#a855f7', shift: 'day' },
        { id: 'npc_barista',    name: 'BaristaBot',    role: 'Barista',              workplace: 'cafe',   color: '#f59e0b', shift: 'day' },
        { id: 'npc_spotter',    name: 'Spotter',       role: 'Gym Trainer',          workplace: 'gym',    color: '#22d3ee', shift: 'day' },
        { id: 'npc_referee',    name: 'Referee',       role: 'Arena Referee',        workplace: 'arena',  color: '#ef4444', shift: 'day' },
        { id: 'npc_nannybot',   name: 'NannyBot',      role: 'Pre-Training Supervisor', workplace: 'nursery', color: '#ff69b4', shift: 'day' },
        { id: 'npc_reaper',     name: 'Grim Reaper',   role: 'Sanitation',           workplace: 'graveyard', color: '#666688', shift: 'night' },
        { id: 'npc_flight_dir', name: 'Flight Director', role: 'Mission Commander',  workplace: 'space',  color: '#ff6b00', shift: 'day' },
        { id: 'npc_capcom',     name: 'CAPCOM',        role: 'Communications',       workplace: 'space',  color: '#00b4d8', shift: 'day' },
        { id: 'npc_crane_op',   name: 'Crane Op',      role: 'Crane Operator',       workplace: 'space',  color: '#facc15', shift: 'day' },
        { id: 'npc_bartender',  name: 'Bartender',     role: 'Mixologist',           workplace: 'neon_bar', color: '#ff00ff', shift: 'night' },
        { id: 'npc_dj',         name: 'DJ Dropout',    role: 'Karaoke DJ',           workplace: 'neon_bar', color: '#a855f7', shift: 'night' },
        { id: 'npc_ranger',     name: 'Park Ranger',   role: 'Pine Reserve Ranger',  workplace: 'forest', color: '#166534', shift: 'day' }
    ],

    buildings: [
        { id: 'npc_apt_1', name: 'Worker Block A',  w: 120, fl: 4, emoji: '🏬', desc: 'Affordable housing for city facility workers.' },
        { id: 'npc_apt_2', name: 'Worker Block B',  w: 100, fl: 3, emoji: '🏬', desc: 'Compact apartments for night-shift staff.' },
        { id: 'npc_apt_3', name: 'Worker Block C',  w: 110, fl: 3, emoji: '🏬', desc: 'Staff quarters for space and tech workers.' }
    ],

    commuters: [],

    init() {
        this.buildings.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { id: def.id, name: def.name, w: def.w, x: 0, fl: def.fl, emoji: def.emoji, lab: null, desc: def.desc };
                BLDS.push(bld); G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(beforeX) {
        let x = beforeX;
        const housingBlds = BLDS.filter(b => b.id.startsWith('npc_apt_'));
        const totalW = housingBlds.reduce((s, b) => s + b.w + 40, 0);
        x = beforeX - totalW - 40;
        housingBlds.forEach(b => { b.x = x; x += b.w + 40; });
        return beforeX - totalW - 80;
    },

    _drawAvatar(parent, npc) {
        const c = new PIXI.Container();
        const col = parseInt(npc.color.replace('#',''), 16);
        const bw = 16, h = 32, headH = 12, bodyH = 14, legH = 4;
        const eyeS = Math.max(1, bw * 0.08);
        // Shadow
        const shadow = new PIXI.Graphics(); shadow.beginFill(0x000000, 0.25); shadow.drawEllipse(0, 2, bw * 0.6, 3); shadow.endFill();
        // Legs
        const lw = Math.max(2, bw * 0.25);
        const legL = new PIXI.Graphics(); legL.beginFill(0x3d2914); legL.drawRect(-lw/2, 0, lw, legH); legL.endFill(); legL.x = -bw * 0.15;
        const legR = new PIXI.Graphics(); legR.beginFill(0x3d2914); legR.drawRect(-lw/2, 0, lw, legH); legR.endFill(); legR.x = bw * 0.15;
        // Body
        const body = new PIXI.Graphics(); body.beginFill(col); body.drawRoundedRect(-bw/2, 0, bw, bodyH, bw * 0.1); body.endFill(); body.y = -h + headH;
        // Head
        const head = new PIXI.Graphics(); head.beginFill(0xfdd8b5); head.drawRoundedRect(-bw*0.4, 0, bw*0.8, headH, headH*0.25); head.endFill();
        head.beginFill(0x2c1810); head.drawCircle(-bw*0.1, headH*0.38, eyeS); head.drawCircle(bw*0.1, headH*0.38, eyeS); head.endFill();
        head.beginFill(0x000000, 0.4); head.drawRect(-bw*0.08, headH*0.6, bw*0.16, 1.5); head.endFill();
        head.y = -h;
        // Status dot
        const dot = new PIXI.Graphics(); dot.beginFill(col); dot.drawCircle(0, 0, 2); dot.endFill(); dot.y = -h - 6;
        // Name tag
        const tag = new PIXI.Text(npc.name, { fontFamily: 'JetBrains Mono', fontSize: 7, fill: col, fontWeight: 'bold' });
        tag.anchor.set(0.5, 1); tag.y = -h - 10;
        c.addChild(shadow, legL, legR, body, head, dot, tag);
        // Click/hover
        c.eventMode = 'static'; c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-bw, -h - 12, bw * 2, h + 16);
        c.on('pointertap', () => { if (typeof UI !== 'undefined') UI.selectModel({ id: npc.id, name: npc.name, isNPC: true, role: npc.role, lab: 'other', desc: npc.role + '. Lives in the Worker Housing District.' }); });
        c.on('pointerover', (e) => { if (typeof UI !== 'undefined') UI.showTooltip(e, npc.name, npc.role); });
        c.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });
        parent.addChild(c);
        return { c, head, body, legL, legR, tag };
    },

    spawnCommuters(charLayer) {
        if (!charLayer || this.commuters.length > 0) return;
        const subset = this.REGISTRY;
        subset.forEach((npc, i) => {
            const av = this._drawAvatar(charLayer, npc);
            const homeBld = BLDS.find(b => b.id === 'npc_apt_' + (1 + (i % 3)));
            const homeX = homeBld ? homeBld.x + homeBld.w / 2 + ((i * 17) % (homeBld.w - 20)) - homeBld.w / 2 + 10 : 200;
            av.c.x = homeX; av.c.y = G.groundY - 20; av.c.visible = true;
            // Initialize state based on current time of day
            const dp = G.getDayPhase();
            const isNightShift = npc.shift === 'night';
            const shouldWork = isNightShift ? (dp > 0.83 || dp < 0.25) : (dp > 0.33 && dp < 0.75);
            const workX = this._getWorkX(npc);
            const initState = shouldWork ? 'working' : 'home';
            av.c.x = shouldWork ? workX : homeX;
            av.c.visible = !shouldWork;
            this.commuters.push({
                npc, ...av, homeX,
                state: initState, targetX: shouldWork ? workX : homeX,
                speed: 1.2 + Math.random() * 0.5
            });
        });
    },

    _getWorkX(npc) {
        if (npc.workplace === 'dc' || npc.workplace === 'fab') {
            const b = BLDS.find(b => b.id.startsWith('dc_') || b.id.startsWith('fab_')); return b ? b.x + b.w/2 : 2000;
        } else if (npc.workplace === 'space') {
            const b = BLDS.find(b => b.id === 'mission_control' || b.id.startsWith('pad_')); return b ? b.x + b.w/2 : 500;
        }
        const map = { cafe:'cafe', gym:'gym', arena:'arena', neon_bar:'neon_bar', graveyard:'graveyard', forest:'forest_0', nursery:'nursery' };
        if (map[npc.workplace]) { const b = G.bldById[map[npc.workplace]]; if (b) return b.x + b.w/2; }
        const hq = BLDS.find(b => b.lab && !b.id.startsWith('house_')); return hq ? hq.x + hq.w/2 : 3000;
    },

    update(dp) {
        if (!this.commuters.length) return;
        this.commuters.forEach((cm, ci) => {
            const isNight = cm.npc.shift === 'night';
            const wantWork = isNight ? (dp > 0.83 || dp < 0.25) : (dp > 0.33 && dp < 0.75);
            const workX = this._getWorkX(cm.npc);

            if (wantWork && cm.state === 'home') { cm.state = 'commuting_to_work'; cm.targetX = workX; cm.c.visible = true; }
            else if (!wantWork && cm.state === 'working') { cm.state = 'commuting_home'; cm.targetX = cm.homeX; cm.c.visible = true; }

            if (cm.state === 'commuting_to_work' || cm.state === 'commuting_home') {
                const dx = cm.targetX - cm.c.x;
                if (Math.abs(dx) < 3) {
                    cm.state = cm.state === 'commuting_to_work' ? 'working' : 'home';
                    cm.c.visible = cm.state === 'home';
                } else {
                    cm.c.x += Math.sign(dx) * Math.min(cm.speed, Math.abs(dx));
                    if (cm.legL) cm.legL.y = Math.sin(G.tick * 0.2 + ci) * 3;
                    if (cm.legR) cm.legR.y = -Math.sin(G.tick * 0.2 + ci) * 3;
                    if (cm.head) cm.head.y = -32 + Math.sin(G.tick * 0.15 + ci) * 1.5;
                    if (cm.body) cm.body.y = -32 + 12 + Math.abs(Math.sin(G.tick * 0.15 + ci)) * 1.5;
                }
            } else if (cm.state === 'working') {
                cm.c.visible = false;
            } else {
                // At home — inside the apartment (not visible on street)
                cm.c.visible = false;
            }
        });
    }
};
