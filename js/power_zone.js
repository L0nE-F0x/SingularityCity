/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER GRID ZONE (v1.0.0)
   Utility district powering Singularity City. Located far right after Billionaire's Row.
   Solar, wind, nuclear, coal, and hydro — each with real MW output and cost/MWh.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PowerZone = {
    SOURCES: [
        { id: 'power_solar',   name: 'Solar Array',     emoji: '☀️', mw: 200, costMWh: 28,  type: 'renewable', w: 200, fl: 3, desc: 'Photovoltaic farm tracking the sun. Output varies with daylight — zero at night.', tip: '200 MW peak · $28/MWh · Renewable' },
        { id: 'power_wind',    name: 'Wind Farm',       emoji: '💨', mw: 150, costMWh: 35,  type: 'renewable', w: 160, fl: 5, desc: 'Three turbines harnessing wind. Output scales with weather intensity.', tip: '150 MW peak · $35/MWh · Renewable' },
        { id: 'power_nuclear', name: 'Nuclear Plant',   emoji: '☢️', mw: 1100, costMWh: 65, type: 'baseload',  w: 180, fl: 6, desc: 'Pressurized water reactor. Constant 1.1GW baseload — the backbone of the grid.', tip: '1,100 MW constant · $65/MWh · Baseload' },
        { id: 'power_coal',    name: 'Coal Station',    emoji: '🏭', mw: 600, costMWh: 95,  type: 'fossil',    w: 160, fl: 5, desc: 'Pulverized coal boiler. Reliable but dirty. Slated for decommission by 2035.', tip: '600 MW constant · $95/MWh · Fossil' },
        { id: 'power_hydro',   name: 'Hydro Dam',       emoji: '🌊', mw: 400, costMWh: 42,  type: 'renewable', w: 200, fl: 5, desc: 'Concrete gravity dam with 400MW turbine hall. Clean constant baseload power.', tip: '400 MW constant · $42/MWh · Renewable' }
    ],

    NPCS: [
        { id: 'npc_grid_ops',     name: 'Grid Operator',    role: 'Grid Operations',       workplace: 'power_nuclear', color: '#22d3ee', shift: 'day' },
        { id: 'npc_reactor_tech', name: 'Reactor Tech',     role: 'Nuclear Technician',     workplace: 'power_nuclear', color: '#4ade80', shift: 'night' },
        { id: 'npc_solar_eng',    name: 'Solar Engineer',   role: 'PV Array Maintenance',   workplace: 'power_solar',   color: '#fbbf24', shift: 'day' },
        { id: 'npc_turbine_tech', name: 'Turbine Tech',     role: 'Wind Turbine Engineer',  workplace: 'power_wind',    color: '#60a5fa', shift: 'day' },
        { id: 'npc_coal_foreman', name: 'Coal Foreman',     role: 'Boiler Operations',      workplace: 'power_coal',    color: '#94a3b8', shift: 'night' },
        { id: 'npc_dam_keeper',   name: 'Dam Keeper',       role: 'Hydroelectric Ops',      workplace: 'power_hydro',   color: '#06b6d4', shift: 'day' }
    ],

    _inited: false,
    gridSupply: 0,
    gridDemand: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.SOURCES.forEach(src => {
            if (!BLDS.find(b => b.id === src.id)) {
                const bld = { id: src.id, name: src.name, w: src.w, x: 0, fl: src.fl, emoji: src.emoji, lab: null, desc: src.desc, _isPower: true, _powerSrc: src };
                BLDS.push(bld); G.bldById[src.id] = bld;
            }
        });
        // Register power NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }
    },

    positionZone(afterX) {
        let x = afterX + 80;
        // Transmission pylons gap
        const pylonStartX = x; x += 120;
        this.SOURCES.forEach(src => {
            const bld = BLDS.find(b => b.id === src.id);
            if (bld) { bld.x = x; x += bld.w + 60; }
        });
        this.zoneStartX = pylonStartX;
        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    // Calculate live power output (solar varies by time, wind by weather)
    getOutput(srcId) {
        const src = this.SOURCES.find(s => s.id === srcId);
        if (!src) return 0;
        if (srcId === 'power_solar') {
            const dp = G.getDayPhase();
            if (dp < 0.25 || dp > 0.83) return 0; // Night
            const dayProgress = (dp - 0.25) / (0.83 - 0.25);
            // Weather derate: clouds, fog, and storms choke photovoltaic output.
            const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            const wDerate = w === 'thunderstorm' ? 0.15
                : w === 'overcast' ? 0.35
                : (w === 'rain' || w === 'snow') ? 0.50
                : w === 'drizzle' ? 0.65
                : w === 'fog' ? 0.45
                : w === 'partly_cloudy' ? 0.80
                : w === 'sandstorm' ? 0.30
                : 1.0;
            return Math.round(src.mw * Math.sin(dayProgress * Math.PI) * wDerate);
        }
        if (srcId === 'power_wind') {
            const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
            // Wind output: stronger during storms, weaker during fog/calm.
            const mult = w === 'thunderstorm' ? 1.8
                : (w === 'rain' || w === 'drizzle') ? 1.4
                : w === 'snow' ? 1.2
                : w === 'sandstorm' ? 1.6
                : w === 'overcast' ? 0.9
                : w === 'partly_cloudy' ? 0.75
                : w === 'fog' ? 0.35
                : 0.6;
            return Math.round(src.mw * mult);
        }
        return src.mw; // Nuclear, coal, hydro = constant
    },

    getTotalSupply() {
        return this.SOURCES.reduce((sum, s) => sum + this.getOutput(s.id), 0);
    },

    getTotalDemand() {
        let dcDemand = 0;
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => { if (dc.power_mw) dcDemand += dc.power_mw; });
        }
        const cityBase = 200; // Metro, streetlights, buildings
        return dcDemand + cityBase;
    },

    update() {
        this.gridSupply = this.getTotalSupply();
        this.gridDemand = this.getTotalDemand();
    }
};
