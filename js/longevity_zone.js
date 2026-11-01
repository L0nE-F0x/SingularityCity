/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   LONGEVITY RESEARCH WING (v1.0.0 — AI Drug Discovery & Life Extension)
   Calico, Altos Labs, Insilico Medicine, Recursion — genomics, clinical trials, cryonics.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

// Each company carries real 2026 flavor: drug (lead candidate) / hq / founded /
// program / milestone (latest real headline) / facts[] (panel bullets).
const LONGEVITY_COMPANIES = {
    isomorphic: {
        name: 'Isomorphic Labs',
        ceo: 'Demis Hassabis',
        color: '#3b82f6',
        icon: '🧠',
        hq: 'London, UK',
        founded: '2021',
        drug: 'AlphaFold 3 oncology candidates',
        program: 'AI-first drug design on AlphaFold 3',
        milestone:
            'Oct 8, 2026: reportedly in early talks to raise at a $40B–$50B valuation — five months after its $2.1B Series B, with its AI-designed drugs still preclinical.',
        facts: [
            'A DeepMind spin-off; AlphaFold 3 predicts protein–DNA–ligand interactions at atomic precision',
            'May 12, 2026: $2.1B Series B led by Thrive Capital — first human trials now targeted by end-2026',
            'Jan 20, 2026: J&J signed a cross-modality, multi-target research deal — small molecules, antibodies, peptides and molecular glues',
        ],
        desc: "DeepMind's drug-design spin-off. AlphaFold 3 turned protein structure into a multi-billion-dollar pipeline — its first AI-designed drugs are racing to reach the clinic by end-2026.",
    },
    retro: {
        name: 'Retro Biosciences',
        ceo: 'Joe Betts-LaCroix',
        color: '#a855f7',
        icon: '⏪',
        hq: 'Redwood City, California',
        founded: '2021',
        drug: "Alzheimer's autophagy pill",
        program: 'Add 10 healthy years to human life',
        milestone:
            'May 2026: hit a $1.8B valuation after Sam Altman personally put in ~$180M; its first trial — an Alzheimer\'s pill — is "going super good."',
        facts: [
            "OpenAI's Sam Altman is the anchor investor in the anti-aging bet",
            "RTR242's Phase 1 is recruiting in Australia — 24 of a planned 108 adults enrolled by Sep 2026",
            'Autophagy, plasma-inspired therapies and cellular reprogramming',
        ],
        desc: "Sam Altman's longevity bet. Aiming to add ten healthy years to human life — its first Alzheimer's pill is already in the clinic.",
    },
    insilico: {
        name: 'Insilico Medicine',
        ceo: 'Alex Zhavoronkov',
        color: '#8b5cf6',
        icon: '💊',
        hq: 'Cambridge, MA / Hong Kong',
        founded: '2014',
        drug: 'Rentosertib (ISM001-055)',
        program: 'Generative chemistry via Pharma.AI',
        milestone:
            "Sep 9, 2026: first patient dosed in GENESIS-IPF-3, rentosertib's Phase III for pulmonary fibrosis (~320 patients, 47 centers in China) — billed as the world's first Phase III of a generative-AI-driven drug.",
        facts: [
            'TNIK inhibitor for idiopathic pulmonary fibrosis (IPF)',
            'Published Phase IIa results in Nature Medicine; an inhaled version cleared IND',
            "Its inhalation solution is the world's first AI-driven direct-to-lung candidate",
            'End-to-end: Pharma.AI picks the target AND designs the molecule',
        ],
        desc: 'The generative-chemistry pioneer. Rentosertib became the first AI-designed drug with human proof-of-concept, published in Nature Medicine.',
    },
    recursion: {
        name: 'Recursion',
        ceo: 'Najat Khan',
        color: '#ec4899',
        icon: '🧫',
        hq: 'Salt Lake City, Utah',
        founded: '2013',
        drug: 'REC-1245',
        program: 'Industrialized "techbio" drug discovery',
        milestone:
            'Oct 15, 2026: REC-1245 locked in 45 mg daily for expansion cohorts after three partial responses in heavily pretreated endometrial and liver cancer patients — endometrial expansion data due 2H 2027.',
        facts: [
            'Runs millions of automated cell-image experiments a week',
            'REC-1245 is its first fully end-to-end AI-discovered program — a first-in-class RBM39 degrader',
            'The Recursion + Exscientia $688M all-stock merger created a trans-Atlantic AI-pharma leader',
        ],
        desc: 'Drug discovery at industrial scale — computer vision on millions of cell images. Now merged with Exscientia into a full-stack AI-pharma machine.',
    },
    altos: {
        name: 'Altos Labs',
        ceo: 'Hal Barron',
        color: '#06b6d4',
        icon: '🔬',
        hq: 'San Diego / Cambridge / Bay Area',
        founded: '2021',
        drug: 'Partial reprogramming therapies',
        program: 'Cellular rejuvenation to reverse biological age',
        milestone:
            '2026: emerging from stealth — partial reprogramming extended mouse lifespan, and early human safety testing began in 2025.',
        facts: [
            'Launched with a record ~$3B in founding capital',
            "Restored 90-year-olds' skin cells to youth in a dish",
            'Targeting the kidney, heart and liver — the first organs to fail with age',
        ],
        desc: 'The $3B rejuvenation moonshot. Reprogramming old cells back to a youthful state — reversing biological age, one organ at a time.',
    },
    calico: {
        name: 'Calico Labs',
        ceo: 'Art Levinson',
        color: '#22c55e',
        icon: '🧬',
        hq: 'South San Francisco',
        founded: '2013',
        drug: 'Aging-biology pipeline',
        program: 'Treat aging itself as a disease',
        milestone:
            "Jun 23, 2026: FDA granted Breakthrough Therapy status to fosigotifator — Calico's eIF2B drug for vanishing white matter, an ultra-rare brain disease with no approved treatment.",
        facts: [
            'Founded and chaired by ex-Genentech/Apple chairman Art Levinson',
            'Backed by Alphabet + AbbVie with billions in committed capital',
            'Studies naked mole rats and other species that barely age',
        ],
        desc: "Alphabet's longevity lab. Treats aging as a disease to be understood and slowed, combining machine learning with deep biology.",
    },
    bioage: {
        name: 'BioAge Labs',
        ceo: 'Kristen Fortney',
        color: '#f59e0b',
        icon: '⏳',
        hq: 'Richmond, California',
        founded: '2015',
        drug: 'BGE-102 (oral NLRP3 inhibitor)',
        program: 'Human longevity data → drug targets',
        milestone:
            'Oct 2, 2026: dosed the first patient in QUELL-DME, a ~180-person Phase 2 of its once-daily NLRP3 pill BGE-102 in diabetic macular edema — topline due 2H 2027.',
        facts: [
            'Human-data-first: starts from people who age well, not mice',
            'Lead drug BGE-102: a once-daily NLRP3 pill that cut IL-1β by up to 98% in Phase 1',
            'Publicly traded — a rare listed pure-play longevity biotech',
        ],
        desc: 'Human-data-first longevity. Mines the biology of people who reach 95 in good health to find drugs that extend healthspan.',
    },
    unity: {
        name: 'Unity Biotech',
        ceo: 'Dissolved Sep 2025',
        color: '#ef4444',
        icon: '🎯',
        hq: 'South San Francisco',
        founded: '2011',
        drug: 'Senolytics (UBX1325)',
        program: 'Clear senescent "zombie" cells',
        milestone:
            'Sep 26, 2025: Unity dissolved — after its eye trial of UBX1325 it laid off all staff, won stockholder approval to liquidate and filed a Delaware certificate of dissolution.',
        facts: [
            'Senescent cells accumulate with age and inflame surrounding tissue',
            'Its lead drug targeted diabetic macular edema in the eye',
            'A pioneer of the "clear the zombie cells" thesis of aging',
        ],
        desc: 'The senolytics pioneer that ran out of road. Unity hunted the senescent "zombie" cells that accumulate with age — then dissolved in 2025 after its eye-drug trial.',
    },
};

const LongevityZone = {
    BLDS: [
        {
            id: 'longevity_protein',
            name: 'AI Protein Foundry',
            w: 200,
            fl: 5,
            emoji: '🧠',
            type: 'longevity',
            desc: 'Where AlphaFold 3 folds proteins in silico. Structure prediction of the entire "interactome" — proteins, DNA, RNA and small molecules — feeding every downstream drug program.',
        },
        {
            id: 'longevity_discovery',
            name: 'Drug Discovery Lab',
            w: 220,
            fl: 5,
            emoji: '💊',
            type: 'longevity',
            desc: 'AI-powered molecular screening. Generative chemistry models design novel drug candidates in silico before wet-lab synthesis.',
        },
        {
            id: 'longevity_trials',
            name: 'Clinical Trials Center',
            w: 200,
            fl: 4,
            emoji: '🏥',
            type: 'longevity',
            desc: 'Phase I-III trial management. Real-time patient monitoring, adaptive trial protocols, and regulatory compliance dashboards.',
        },
        {
            id: 'longevity_genomics',
            name: 'Genomics Sequencing',
            w: 190,
            fl: 4,
            emoji: '🧬',
            type: 'longevity',
            desc: 'High-throughput sequencing facility. Whole-genome, epigenome, and transcriptome analysis powering personalized medicine.',
        },
        {
            id: 'longevity_cryo',
            name: 'Cryonics Vault',
            w: 160,
            fl: 3,
            emoji: '❄️',
            type: 'longevity',
            desc: 'Tissue preservation and vitrification research. Maintains biobanks at -196°C for long-term cellular storage.',
        },
    ],

    NPCS: [
        {
            id: 'npc_longevity_protein_ai',
            name: 'Structure AI Lead',
            role: 'AlphaFold 3 Ops',
            workplace: 'longevity_protein',
            color: '#3b82f6',
            shift: 'day',
        },
        {
            id: 'npc_longevity_biophys',
            name: 'Biophysicist',
            role: 'Protein Modeling',
            workplace: 'longevity_protein',
            color: '#60a5fa',
            shift: 'day',
        },
        {
            id: 'npc_longevity_chemist',
            name: 'Medicinal Chemist',
            role: 'Drug Design',
            workplace: 'longevity_discovery',
            color: '#22c55e',
            shift: 'day',
        },
        {
            id: 'npc_longevity_mleng',
            name: 'ML Engineer',
            role: 'Molecular Modeling',
            workplace: 'longevity_discovery',
            color: '#3b82f6',
            shift: 'day',
        },
        {
            id: 'npc_longevity_synth',
            name: 'Synthesis Tech',
            role: 'Compound Synthesis',
            workplace: 'longevity_discovery',
            color: '#06b6d4',
            shift: 'day',
        },
        {
            id: 'npc_longevity_trial_mgr',
            name: 'Trial Manager',
            role: 'Clinical Operations',
            workplace: 'longevity_trials',
            color: '#ec4899',
            shift: 'day',
        },
        {
            id: 'npc_longevity_biostat',
            name: 'Biostatistician',
            role: 'Data Analysis',
            workplace: 'longevity_trials',
            color: '#f59e0b',
            shift: 'day',
        },
        {
            id: 'npc_longevity_genomics',
            name: 'Genomics Scientist',
            role: 'Sequencing Lead',
            workplace: 'longevity_genomics',
            color: '#8b5cf6',
            shift: 'day',
        },
        {
            id: 'npc_longevity_bioinfo',
            name: 'Bioinformatics Eng',
            role: 'Pipeline Dev',
            workplace: 'longevity_genomics',
            color: '#a855f7',
            shift: 'day',
        },
        {
            id: 'npc_longevity_cryo_tech',
            name: 'Cryonics Technician',
            role: 'Preservation Ops',
            workplace: 'longevity_cryo',
            color: '#67e8f9',
            shift: 'night',
        },
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

        this.BLDS.forEach((def) => {
            if (!BLDS.find((b) => b.id === def.id)) {
                const bld = {
                    id: def.id,
                    name: def.name,
                    w: def.w,
                    x: 0,
                    fl: def.fl,
                    emoji: def.emoji,
                    lab: null,
                    desc: def.desc,
                    type: def.type,
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach((npc) => {
                if (!NPCHousing.REGISTRY.find((n) => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach((def) => {
            const bld = BLDS.find((b) => b.id === def.id);
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
        if (dp > 0.3 && dp < 0.8 && G.tick % 90 === 0) {
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
    },
};
