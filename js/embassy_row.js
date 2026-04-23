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
    },

    /* ──────────────────────────────────────────────────────────────────────
       drawCountryFlag(g, country, w, h)
       Country-accurate flag rendering into a PIXI.Graphics object. Origin
       (0,0) is the top-left of the flag. Scales cleanly from ~12×8 pole
       flags up to ~64×40 ceremonial flags. Falls back to grey if unknown.

       Implemented countries: us, uk, cn, eu, in, ae. Used by:
         • environment.js  (embassy exterior flying flag)
         • embassy_quarter.js  (residence rooftop pole)
         • interior_embassy.js  (interior pediment + ambassador desk pair)
         • interior_ambassador_res.js  (residence interior accents)
       ────────────────────────────────────────────────────────────────────── */
    drawCountryFlag(g, country, w, h) {
        const c = (country || '').toLowerCase();

        if (c === 'us') {
            // 13 horizontal stripes (7 red, 6 white) + blue canton w/ stars
            const sH = h / 13;
            g.beginFill(0xbf0a30); g.drawRect(0, 0, w, h); g.endFill();
            g.beginFill(0xffffff);
            for (let i = 1; i < 13; i += 2) g.drawRect(0, i * sH, w, sH);
            g.endFill();
            // Blue canton — upper-hoist, ~40% wide × 7 stripes tall
            const cW = w * 0.4, cH = sH * 7;
            g.beginFill(0x002868); g.drawRect(0, 0, cW, cH); g.endFill();
            // Star field (5 rows × 6 cols, alternating offset for dense feel)
            g.beginFill(0xffffff);
            const sCols = 6, sRows = 5;
            const dx = cW / (sCols + 1), dy = cH / (sRows + 1);
            const sR = Math.max(0.35, Math.min(dx, dy) * 0.28);
            for (let r = 0; r < sRows; r++) {
                for (let cc = 0; cc < sCols; cc++) {
                    const offset = (r % 2) * (dx * 0.5);
                    g.drawCircle(dx + cc * dx + offset, dy + r * dy, sR);
                }
            }
            g.endFill();

        } else if (c === 'uk') {
            // Union Jack — blue field, white+red saltire (X), white+red cross (+)
            g.beginFill(0x012169); g.drawRect(0, 0, w, h); g.endFill();
            // White saltire (full diagonals)
            g.lineStyle(Math.max(1.6, h * 0.20), 0xffffff, 1);
            g.moveTo(0, 0); g.lineTo(w, h);
            g.moveTo(w, 0); g.lineTo(0, h);
            // Red saltire on top (thinner)
            g.lineStyle(Math.max(0.8, h * 0.10), 0xc8102e, 1);
            g.moveTo(0, 0); g.lineTo(w, h);
            g.moveTo(w, 0); g.lineTo(0, h);
            g.lineStyle(0);
            // White cross (over the saltire — wider than red cross)
            g.beginFill(0xffffff);
            g.drawRect(0, h * 0.4, w, h * 0.2);
            g.drawRect(w * 0.4, 0, w * 0.2, h);
            g.endFill();
            // Red cross (St George — narrower, on top)
            g.beginFill(0xc8102e);
            g.drawRect(0, h * 0.45, w, h * 0.1);
            g.drawRect(w * 0.45, 0, w * 0.1, h);
            g.endFill();

        } else if (c === 'cn') {
            // Red field + 5 yellow stars (1 large + 4 small arc'd to its right)
            g.beginFill(0xde2910); g.drawRect(0, 0, w, h); g.endFill();
            const drawStar = (sx, sy, sR) => {
                g.beginFill(0xffde00);
                if (g.drawStar) g.drawStar(sx, sy, 5, sR, sR * 0.42);
                else g.drawCircle(sx, sy, sR);
                g.endFill();
            };
            const bigR = Math.max(1.4, h * 0.18);
            drawStar(w * 0.20, h * 0.30, bigR);
            const smR = Math.max(0.6, h * 0.07);
            // 4 small stars arc'd around the big one
            drawStar(w * 0.36, h * 0.13, smR);
            drawStar(w * 0.46, h * 0.28, smR);
            drawStar(w * 0.46, h * 0.46, smR);
            drawStar(w * 0.36, h * 0.62, smR);

        } else if (c === 'eu') {
            // Blue field + 12 gold stars in a circle
            g.beginFill(0x003399); g.drawRect(0, 0, w, h); g.endFill();
            const cx = w / 2, cy = h / 2;
            const rr = Math.min(w, h) * 0.32;
            const sR = Math.max(0.6, h * 0.07);
            g.beginFill(0xffcc00);
            for (let i = 0; i < 12; i++) {
                const a = (i / 12) * Math.PI * 2 - Math.PI / 2;
                const sx = cx + Math.cos(a) * rr;
                const sy = cy + Math.sin(a) * rr;
                if (g.drawStar) g.drawStar(sx, sy, 5, sR, sR * 0.42);
                else g.drawCircle(sx, sy, sR);
            }
            g.endFill();

        } else if (c === 'in') {
            // 3 horizontal bands (saffron, white, green) + Ashoka Chakra
            const sH = h / 3;
            g.beginFill(0xff9933); g.drawRect(0, 0, w, sH); g.endFill();
            g.beginFill(0xffffff); g.drawRect(0, sH, w, sH); g.endFill();
            g.beginFill(0x138808); g.drawRect(0, sH * 2, w, sH); g.endFill();
            // Chakra — navy wheel with 8 simplified spokes (24 in real flag, but 8 reads cleaner small)
            const ckCx = w / 2, ckCy = sH * 1.5;
            const ckR = sH * 0.42;
            g.lineStyle(Math.max(0.4, h * 0.025), 0x000080, 1);
            g.drawCircle(ckCx, ckCy, ckR);
            for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                g.moveTo(ckCx, ckCy);
                g.lineTo(ckCx + Math.cos(a) * ckR, ckCy + Math.sin(a) * ckR);
            }
            g.lineStyle(0);
            // Tiny navy hub at center
            g.beginFill(0x000080); g.drawCircle(ckCx, ckCy, Math.max(0.6, ckR * 0.12)); g.endFill();

        } else if (c === 'ae') {
            // Vertical red hoist (1/4 width) + 3 horizontal bands (green/white/black)
            const redW = w * 0.25;
            g.beginFill(0xce1126); g.drawRect(0, 0, redW, h); g.endFill();
            const fW = w - redW;
            const sH = h / 3;
            g.beginFill(0x00732f); g.drawRect(redW, 0, fW, sH); g.endFill();
            g.beginFill(0xffffff); g.drawRect(redW, sH, fW, sH); g.endFill();
            g.beginFill(0x000000); g.drawRect(redW, sH * 2, fW, sH); g.endFill();

        } else {
            g.beginFill(0xcccccc); g.drawRect(0, 0, w, h); g.endFill();
        }

        // Subtle dark border for legibility against bright skies
        g.lineStyle(0.4, 0x000000, 0.4);
        g.drawRect(0, 0, w, h);
        g.lineStyle(0);
    }
};
