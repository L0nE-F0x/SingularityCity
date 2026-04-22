/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   EMBASSY ROW (v1.0.0 — Phase 3, Roadmap Feature #1)
   Diplomatic quarter between the Convention Center and the Global AI Index. Six national
   consulates, each with a classical columned facade, flying flag, and AI-policy info panel.

   Clicking an embassy opens a UI.selectBld panel with that country's AI regulatory stance,
   flagship labs, and governance framework. Data is curated (not live) — policy evolves
   slowly enough that a refresh every few commits is fine.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const EmbassyRow = {
    BLDS: [
        {
            id: 'embassy_us', name: 'US Consulate', w: 150, fl: 3, emoji: '🇺🇸',
            type: 'embassy', country: 'us',
            flagColors: [0xbf0a30, 0xffffff, 0x002868],
            accent: 0x002868,
            regulator: 'Executive branch · NIST · FTC',
            framework: 'Executive Order 14110 · NIST AI RMF · AI Bill of Rights',
            stance: 'Light-touch federal; state patchwork (California SB 1047 vetoed). Export controls on advanced chips.',
            labs: ['OpenAI', 'Anthropic', 'Google DeepMind', 'Meta AI', 'xAI', 'Microsoft Research'],
            desc: 'United States of America. The dominant hub of frontier AI — Silicon Valley, Seattle, and New York host the majority of the world\'s capability frontier. Federal policy favours voluntary commitments and sector-specific rules over a comprehensive AI act.'
        },
        {
            id: 'embassy_cn', name: 'Chinese Embassy', w: 150, fl: 4, emoji: '🇨🇳',
            type: 'embassy', country: 'cn',
            flagColors: [0xde2910, 0xffde00],
            accent: 0xde2910,
            regulator: 'Cyberspace Administration (CAC)',
            framework: 'Interim Measures for Generative AI Services (Aug 2023)',
            stance: 'Strict pre-market registration, mandatory security assessments, content alignment with core socialist values. Strategic state-led compute build-out.',
            labs: ['DeepSeek', 'Alibaba Qwen', 'Baidu Ernie', 'Tencent Hunyuan', '01.AI', 'Moonshot'],
            desc: 'People\'s Republic of China. The world\'s second AI superpower. Rapid open-weight releases (DeepSeek, Qwen) despite US export controls on H100/H200-class silicon. Industry directed under Made in China 2025 and New Generation AI Development Plan.'
        },
        {
            id: 'embassy_eu', name: 'EU Delegation', w: 150, fl: 3, emoji: '🇪🇺',
            type: 'embassy', country: 'eu',
            flagColors: [0x003399, 0xffcc00],
            accent: 0x003399,
            regulator: 'European Commission · National DPAs',
            framework: 'EU AI Act (2024) · GDPR · Digital Services Act',
            stance: 'World-first comprehensive AI law. Risk-tiered bans + obligations. GPAI rules above 10^25 FLOPs. Phased enforcement through 2027.',
            labs: ['Mistral', 'Black Forest Labs', 'Aleph Alpha', 'Silo AI', 'Kyutai'],
            desc: 'European Union. The world\'s first jurisdiction with a comprehensive horizontal AI regulation. The AI Act bans social scoring and untargeted biometric scraping, classifies high-risk systems, and imposes transparency duties on foundation models.'
        },
        {
            id: 'embassy_uk', name: 'UK High Commission', w: 150, fl: 3, emoji: '🇬🇧',
            type: 'embassy', country: 'uk',
            flagColors: [0xc8102e, 0xffffff, 0x012169],
            accent: 0x012169,
            regulator: 'AI Safety Institute (AISI) · DSIT',
            framework: 'Pro-innovation principles (2023 White Paper) · Bletchley Declaration',
            stance: 'Sector-led, principles-based. No statutory AI act — AISI does pre-deployment evaluations of frontier models by agreement.',
            labs: ['Google DeepMind', 'Stability AI', 'Synthesia', 'PolyAI', 'Wayve', 'ElevenLabs'],
            desc: 'United Kingdom. Host of the inaugural AI Safety Summit at Bletchley Park (Nov 2023) and home of the world\'s first government AI Safety Institute. London anchors DeepMind, the single lab with the longest continuous history at the AGI frontier.'
        },
        {
            id: 'embassy_in', name: 'India High Commission', w: 150, fl: 3, emoji: '🇮🇳',
            type: 'embassy', country: 'in',
            flagColors: [0xff9933, 0xffffff, 0x138808],
            accent: 0xff9933,
            regulator: 'MeitY · NITI Aayog',
            framework: 'IndiaAI Mission (₹10,372 crore, 2024) · Responsible AI guidelines',
            stance: 'Pro-innovation, non-binding principles. Focus on sovereign compute, Indian-language foundation models, and responsible-AI guardrails.',
            labs: ['Sarvam AI', 'Krutrim', 'Yellow.ai', 'Soket AI', 'CoRover'],
            desc: 'Republic of India. The largest pool of ML engineering talent on earth and the third-largest source of foundation-model training contributors. National strategy emphasises multilingual capability across 22 official languages and indigenous GPU capacity.'
        },
        {
            id: 'embassy_ae', name: 'UAE Embassy', w: 150, fl: 3, emoji: '🇦🇪',
            type: 'embassy', country: 'ae',
            flagColors: [0xce1126, 0x00732f, 0xffffff, 0x000000],
            accent: 0x00732f,
            regulator: 'Ministry of AI · UAE Council for AI',
            framework: 'National AI Strategy 2031 · Falcon open-weights program',
            stance: 'Sovereign-wealth-scale compute investment. Aligned with US export controls post-2024 Microsoft/G42 deal. Race-to-the-top on permissive talent visas.',
            labs: ['G42', 'TII (Falcon)', 'MBZUAI', 'Core42', 'Inception'],
            desc: 'United Arab Emirates. First country to appoint a Minister of AI (2017). Abu Dhabi\'s G42 and the Technology Innovation Institute publish the most-downloaded Arabic-language open models. Partner in the planned Stargate UAE datacenter build.'
        }
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,

    init() {
        if (this._inited) return;
        this._inited = true;
        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { ...def, x: 0, lab: null };
                BLDS.push(bld);
                if (typeof G !== 'undefined' && G.bldById) G.bldById[def.id] = bld;
            }
        });
    },

    positionZone(afterX) {
        let x = afterX + 50;
        this.zoneStartX = x;
        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) { bld.x = x; x += bld.w + 25; }
        });
        this.zoneEndX = x + 30;
        return this.zoneEndX;
    },

    update() {
        // Gentle flag-wave animation on all embassy buildings.
        const t = (typeof G !== 'undefined' ? G.tick : 0) * 0.05;
        this.BLDS.forEach(def => {
            const bld = (typeof G !== 'undefined' && G.bldById) ? G.bldById[def.id] : null;
            if (!bld || !bld._flagGfx) return;
            const flagIdx = this.BLDS.indexOf(def);
            bld._flagGfx.skew.x = Math.sin(t + flagIdx * 0.8) * 0.18;
        });
    }
};
