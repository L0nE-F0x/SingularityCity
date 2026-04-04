/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH WING (v1.0.0 — AI Drug Discovery & Life Extension)
   Calico, Altos Labs, Insilico Medicine, Recursion — genomics, clinical trials, cryonics.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const LONGEVITY_COMPANIES = {
    calico:      { name: 'Calico Labs',        ceo: 'Art Levinson',     color: '#22c55e', icon: '🧬', desc: 'Alphabet-funded lab tackling aging as a disease. Combines ML with wet-lab biology.' },
    altos:       { name: 'Altos Labs',          ceo: 'Hal Barron',      color: '#06b6d4', icon: '🔬', desc: 'Cellular reprogramming to reverse biological age. $3B in founding capital.' },
    insilico:    { name: 'Insilico Medicine',   ceo: 'Alex Zhavoronkov', color: '#8b5cf6', icon: '💊', desc: 'AI-discovered drug candidates entering Phase II trials. Generative chemistry at scale.' },
    recursion:   { name: 'Recursion',           ceo: 'Chris Gibson',    color: '#ec4899', icon: '🧫', desc: 'Industrialized drug discovery using computer vision on cellular images.' },
    bioage:      { name: 'BioAge Labs',         ceo: 'Kristen Fortney', color: '#f59e0b', icon: '⏳', desc: 'Human data-first approach to aging biology. Repurposing existing drugs for longevity.' },
    unity:       { name: 'Unity Biotech',       ceo: 'Anirvan Ghosh',   color: '#ef4444', icon: '🎯', desc: 'Senolytic therapies targeting and clearing senescent zombie cells.' },
    isomorphic:  { name: 'Isomorphic Labs',     ceo: 'Demis Hassabis',  color: '#3b82f6', icon: '🧠', desc: 'DeepMind spin-off applying AlphaFold to drug design. Protein structure meets pharma.' },
    retro:       { name: 'Retro Biosciences',   ceo: 'Joe Betts-LaCroix', color: '#a855f7', icon: '⏪', desc: 'Backed by Sam Altman. Autophagy, plasma-inspired therapies, and cellular reprogramming.' }
};

const LongevityZone = {
    BLDS: [
        { id: 'longevity_discovery', name: 'Drug Discovery Lab',    w: 220, fl: 5, emoji: '💊', type: 'longevity', desc: 'AI-powered molecular screening. Generative chemistry models design novel drug candidates in silico before wet-lab synthesis.' },
        { id: 'longevity_trials',    name: 'Clinical Trials Center', w: 200, fl: 4, emoji: '🏥', type: 'longevity', desc: 'Phase I-III trial management. Real-time patient monitoring, adaptive trial protocols, and regulatory compliance dashboards.' },
        { id: 'longevity_genomics',  name: 'Genomics Sequencing',   w: 190, fl: 4, emoji: '🧬', type: 'longevity', desc: 'High-throughput sequencing facility. Whole-genome, epigenome, and transcriptome analysis powering personalized medicine.' },
        { id: 'longevity_cryo',      name: 'Cryonics Vault',        w: 160, fl: 3, emoji: '❄️', type: 'longevity', desc: 'Tissue preservation and vitrification research. Maintains biobanks at -196°C for long-term cellular storage.' },
    ],

    NPCS: [
        { id: 'npc_longevity_chemist',    name: 'Medicinal Chemist',     role: 'Drug Design',           workplace: 'longevity_discovery', color: '#22c55e', shift: 'day' },
        { id: 'npc_longevity_mleng',      name: 'ML Engineer',           role: 'Molecular Modeling',    workplace: 'longevity_discovery', color: '#3b82f6', shift: 'day' },
        { id: 'npc_longevity_synth',      name: 'Synthesis Tech',        role: 'Compound Synthesis',    workplace: 'longevity_discovery', color: '#06b6d4', shift: 'day' },
        { id: 'npc_longevity_trial_mgr',  name: 'Trial Manager',         role: 'Clinical Operations',   workplace: 'longevity_trials',    color: '#ec4899', shift: 'day' },
        { id: 'npc_longevity_biostat',    name: 'Biostatistician',       role: 'Data Analysis',         workplace: 'longevity_trials',    color: '#f59e0b', shift: 'day' },
        { id: 'npc_longevity_genomics',   name: 'Genomics Scientist',    role: 'Sequencing Lead',       workplace: 'longevity_genomics',  color: '#8b5cf6', shift: 'day' },
        { id: 'npc_longevity_bioinfo',    name: 'Bioinformatics Eng',    role: 'Pipeline Dev',          workplace: 'longevity_genomics',  color: '#a855f7', shift: 'day' },
        { id: 'npc_longevity_cryo_tech',  name: 'Cryonics Technician',   role: 'Preservation Ops',      workplace: 'longevity_cryo',      color: '#67e8f9', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    // Research stats
    compoundsScreened: 0,
    trialsActive: 0,
    genomesSequenced: 0,

    init() {
        if (this._inited) return;
        this._inited = true;

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

        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }

        console.log('🧬 Longevity Research Wing initialized with', this.BLDS.length, 'buildings and', this.NPCS.length, 'NPCs');
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
        const dp = G.getDayPhase();
        if (dp > 0.30 && dp < 0.80 && G.tick % 90 === 0) {
            this.compoundsScreened += Math.floor(Math.random() * 50) + 10;
        }
        if (G.tick % 300 === 0) {
            this.trialsActive = 3 + Math.floor(Math.random() * 5);
            this.genomesSequenced += Math.floor(Math.random() * 3) + 1;
        }
    },

    getCompany(name) {
        const n = name.toLowerCase();
        for (const [key, co] of Object.entries(LONGEVITY_COMPANIES)) {
            if (n.includes(key) || n.includes(co.name.toLowerCase())) return co;
        }
        return null;
    }
};
