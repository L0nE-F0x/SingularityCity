/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ROBOTICS FACTORY ZONE (v1.0.0 — Physical AI Manufacturing District)
   Tesla Optimus, Figure, 1X, Boston Dynamics — assembly line, testing ground, deployment dock.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ROBOTICS_COMPANIES = {
    tesla:          { name: 'Tesla Optimus',    ceo: 'Elon Musk',       color: '#e82127', icon: '🤖', desc: 'Humanoid robot designed for dangerous, repetitive tasks. Targeting mass production at <$20K.' },
    figure:         { name: 'Figure 02',        ceo: 'Brett Adcock',    color: '#3b82f6', icon: '🦾', desc: 'General-purpose humanoid powered by OpenAI vision-language models.' },
    '1x':           { name: '1X NEO',           ceo: 'Bernt Øivind',    color: '#06b6d4', icon: '🧍', desc: 'Android form factor optimized for home environments and eldercare.' },
    boston_dynamics: { name: 'Atlas',            ceo: 'Robert Playter',  color: '#f59e0b', icon: '🏃', desc: 'The OG. Fully electric Atlas with unprecedented mobility and dexterity.' },
    unitree:        { name: 'Unitree H1',       ceo: 'Xingxing Wang',   color: '#10b981', icon: '🐕', desc: 'Chinese manufacturer pushing aggressive pricing on humanoid and quadruped robots.' },
    agility:        { name: 'Digit',            ceo: 'Damion Shelton',  color: '#8b5cf6', icon: '📦', desc: 'Warehouse logistics robot. First commercial humanoid deployed in Amazon fulfillment.' },
    apptronik:      { name: 'Apollo',           ceo: 'Jeff Cardenas',   color: '#ec4899', icon: '🌟', desc: 'Versatile humanoid for manufacturing, logistics, and construction.' },
    sanctuary:      { name: 'Phoenix',          ceo: 'Geordie Rose',    color: '#f97316', icon: '🔥', desc: 'Carbon-based intelligence meets silicon. AI-controlled hands with human-level dexterity.' }
};

const RoboticsZone = {
    BLDS: [
        { id: 'robotics_assembly',  name: 'Assembly Line',       w: 240, fl: 5, emoji: '🏭', type: 'robotics', desc: 'Primary humanoid robot assembly. Chassis fabrication, motor integration, AI brain upload, and final calibration.' },
        { id: 'robotics_testing',   name: 'Testing Ground',      w: 200, fl: 3, emoji: '🔬', type: 'robotics', desc: 'Performance validation chambers. Walk tests, manipulation trials, obstacle courses, and endurance runs.' },
        { id: 'robotics_deploy',    name: 'Deployment Dock',     w: 180, fl: 3, emoji: '🚛', type: 'robotics', desc: 'Finished robots are loaded onto trucks for delivery to factories, warehouses, and homes worldwide.' },
        { id: 'robotics_rd',        name: 'R&D Lab',             w: 200, fl: 4, emoji: '🧠', type: 'robotics', desc: 'Where next-gen actuators, sensors, and embodied AI models are developed. Home to the morphology team.' },
    ],

    NPCS: [
        { id: 'npc_robo_engineer',   name: 'Robotics Engineer',   role: 'System Design',        workplace: 'robotics_assembly', color: '#ec4899', shift: 'day' },
        { id: 'npc_robo_mfg',        name: 'Manufacturing Tech',  role: 'Production Ops',       workplace: 'robotics_assembly', color: '#f97316', shift: 'day' },
        { id: 'npc_robo_welder',     name: 'Precision Welder',    role: 'Chassis Fabrication',   workplace: 'robotics_assembly', color: '#facc15', shift: 'day' },
        { id: 'npc_robo_tester',     name: 'Test Engineer',       role: 'QA Lead',               workplace: 'robotics_testing',  color: '#06b6d4', shift: 'day' },
        { id: 'npc_robo_calibrator', name: 'Calibration Tech',    role: 'Sensor Calibration',    workplace: 'robotics_testing',  color: '#22d3ee', shift: 'day' },
        { id: 'npc_robo_logistics',  name: 'Logistics Manager',   role: 'Shipping Coordinator',  workplace: 'robotics_deploy',   color: '#10b981', shift: 'day' },
        { id: 'npc_robo_researcher', name: 'AI Researcher',       role: 'Embodied Intelligence', workplace: 'robotics_rd',       color: '#8b5cf6', shift: 'day' },
        { id: 'npc_robo_intern',     name: 'Robotics Intern',     role: 'Junior Engineer',       workplace: 'robotics_rd',       color: '#a855f7', shift: 'day' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Production stats (visual flair)
    unitsProduced: 0,
    _prodRate: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

        // Inject buildings into global BLDS
        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Register NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 45;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    update() {
        if (!this._inited) return;
        // Increment production counter during working hours
        const dp = G.getDayPhase();
        if (dp > 0.33 && dp < 0.75 && G.tick % 120 === 0) {
            this.unitsProduced++;
        }
    },

    getCompany(name) {
        const n = name.toLowerCase();
        for (const [key, co] of Object.entries(ROBOTICS_COMPANIES)) {
            if (n.includes(key) || n.includes(co.name.toLowerCase())) return co;
        }
        return null;
    }
};
