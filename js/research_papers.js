/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   RESEARCH PAPER TRACKER (v1.0.0)
   Fetches recent AI papers from arXiv API and animates them as mail/envelopes arriving at lab HQs.
   Papers are matched to labs by author affiliation keywords in title/abstract.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const ResearchPapers = {

    papers: [],           // fetched paper list
    _deliveries: [],      // animated envelope sprites
    _deliveryLayer: null,
    _lastFetchTick: 0,
    _lastDeliveryTick: 0,
    _fetched: false,

    // Lab keyword matching for paper → lab affiliation
    LAB_KEYWORDS: {
        openai:    ['openai', 'gpt-4', 'gpt-5', 'dall-e', 'chatgpt', 'o1', 'o3'],
        google:    ['google', 'deepmind', 'gemini', 'palm', 'bard', 'alphafold', 'gemma'],
        anthropic: ['anthropic', 'claude', 'constitutional ai', 'rlhf'],
        meta:      ['meta ai', 'llama', 'fair', 'facebook ai'],
        mistral:   ['mistral', 'mixtral'],
        microsoft: ['microsoft', 'phi-', 'orca', 'azure ai'],
        deepseek:  ['deepseek'],
        alibaba:   ['alibaba', 'qwen', 'tongyi'],
        amazon:    ['amazon', 'aws', 'titan'],
        nvidia:    ['nvidia', 'megatron', 'nemo'],
        xai:       ['xai', 'grok'],
        cohere:    ['cohere', 'command-r'],
    },

    init(charLayer) {
        this._deliveryLayer = new PIXI.Container();
        charLayer.addChild(this._deliveryLayer);
    },

    async fetchPapers() {
        if (this._fetched) return;
        this._fetched = true;

        try {
            // arXiv API: recent AI/ML papers (cs.AI + cs.LG categories)
            const query = 'cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL';
            const url = `https://export.arxiv.org/api/query?search_query=${query}&sortBy=submittedDate&sortOrder=descending&max_results=30`;

            const resp = await fetch(url);
            if (!resp.ok) throw new Error('arXiv fetch failed');
            const xml = await resp.text();

            // Parse XML response
            const parser = new DOMParser();
            const doc = parser.parseFromString(xml, 'text/xml');
            const entries = doc.querySelectorAll('entry');

            entries.forEach(entry => {
                const title = entry.querySelector('title')?.textContent?.trim() || '';
                const summary = entry.querySelector('summary')?.textContent?.trim() || '';
                const published = entry.querySelector('published')?.textContent || '';
                const authors = [];
                entry.querySelectorAll('author name').forEach(n => authors.push(n.textContent));

                // Match to a lab
                const matchedLab = this._matchLab(title, summary, authors);

                this.papers.push({
                    title: title.replace(/\s+/g, ' ').slice(0, 80),
                    authors: authors.slice(0, 3).join(', '),
                    published,
                    lab: matchedLab,
                    delivered: false,
                });
            });

            console.log(`📄 Research Papers: Loaded ${this.papers.length} from arXiv`);
        } catch (e) {
            console.warn('📄 Research Papers: arXiv fetch failed, using fallback');
            this._useFallback();
        }
    },

    _matchLab(title, summary, authors) {
        const text = (title + ' ' + summary + ' ' + authors.join(' ')).toLowerCase();
        for (const [lab, keywords] of Object.entries(this.LAB_KEYWORDS)) {
            for (const kw of keywords) {
                if (text.includes(kw.toLowerCase())) return lab;
            }
        }
        return null; // no specific lab match
    },

    _useFallback() {
        // Pre-seeded papers when arXiv is unreachable
        const fallback = [
            { title: 'Scaling Laws for Neural Language Models', lab: 'openai' },
            { title: 'Constitutional AI: Harmlessness from AI Feedback', lab: 'anthropic' },
            { title: 'Gemini: A Family of Highly Capable Multimodal Models', lab: 'google' },
            { title: 'LLaMA: Open and Efficient Foundation Language Models', lab: 'meta' },
            { title: 'Mixtral of Experts: High Quality Sparse Mixture-of-Experts', lab: 'mistral' },
            { title: 'DeepSeek-V3: Strong Efficient Open-Source Language Model', lab: 'deepseek' },
            { title: 'Phi-4: Small Language Models with Outsized Reasoning', lab: 'microsoft' },
            { title: 'Qwen-2.5: Advancing Multilingual LLM Capabilities', lab: 'alibaba' },
            { title: 'Grok-2: Open-Weights Conversational Model', lab: 'xai' },
            { title: 'Command-R+: Retrieval-Augmented Generation at Scale', lab: 'cohere' },
            { title: 'Attention Is All You Need: Revisited for 2026', lab: 'google' },
            { title: 'Training Compute-Optimal Large Language Models', lab: 'google' },
            { title: 'RLHF at Scale: Lessons from Claude 4', lab: 'anthropic' },
            { title: 'Efficient Inference with Speculative Decoding', lab: null },
            { title: 'Vision Transformers Need Registers for Robust Features', lab: null },
        ];
        fallback.forEach(p => {
            this.papers.push({
                title: p.title,
                authors: 'et al.',
                published: new Date().toISOString(),
                lab: p.lab,
                delivered: false,
            });
        });
    },

    update() {
        if (!this._deliveryLayer) return;

        // Fetch papers on first update
        if (!this._fetched && G.tick > 200) {
            this.fetchPapers();
        }

        // Deliver papers periodically (every ~10 seconds)
        if (G.tick - this._lastDeliveryTick >= 600 && this.papers.length > 0) {
            this._deliverPaper();
            this._lastDeliveryTick = G.tick;
        }

        // Animate active deliveries
        for (let i = this._deliveries.length - 1; i >= 0; i--) {
            const d = this._deliveries[i];
            this._updateDelivery(d, i);
        }
    },

    _deliverPaper() {
        // Find an undelivered paper with a lab match
        const candidates = this.papers.filter(p => !p.delivered && p.lab);
        if (candidates.length === 0) {
            // Reset all for cycling
            this.papers.forEach(p => p.delivered = false);
            return;
        }

        const paper = candidates[Math.floor(Math.random() * candidates.length)];
        paper.delivered = true;

        // Find the lab's HQ building
        const labBlds = G.bldsByLab[paper.lab] || [];
        const hq = labBlds.find(b => !b.id.startsWith('house_'));
        if (!hq) return;

        // Spawn envelope at top of screen, dropping toward HQ
        const envelope = this._createEnvelope(paper);
        const startX = hq.x + hq.w / 2 + (Math.random() - 0.5) * 100;
        const startY = G.groundY - 200;
        envelope.x = startX;
        envelope.y = startY;
        this._deliveryLayer.addChild(envelope);

        const labName = (typeof LABS !== 'undefined' && LABS[paper.lab]) ? LABS[paper.lab].name : paper.lab;

        this._deliveries.push({
            sprite: envelope,
            targetX: hq.x + hq.w / 2,
            targetY: G.groundY - ((hq.dynamicFl || hq.fl || 3) * 18 + 30),
            phase: 'floating', // floating → landing → flash → done
            timer: 0,
            paper,
            labName,
        });
    },

    _createEnvelope(paper) {
        const cont = new PIXI.Container();

        // Envelope body
        const g = new PIXI.Graphics();
        g.beginFill(0xf5f0e0); g.drawRoundedRect(-8, -6, 16, 12, 2); g.endFill();
        // Envelope flap
        g.beginFill(0xe8e0cc);
        g.moveTo(-8, -6); g.lineTo(0, 2); g.lineTo(8, -6); g.closePath();
        g.endFill();
        // Seal
        g.beginFill(0xef4444, 0.8); g.drawCircle(0, -1, 2); g.endFill();
        cont.addChild(g);

        // Paper label (tiny)
        const labCol = (paper.lab && typeof LABS !== 'undefined' && LABS[paper.lab]) ?
            parseInt(LABS[paper.lab].color.replace('#', ''), 16) : 0x6688aa;
        const dot = new PIXI.Graphics();
        dot.beginFill(labCol, 0.8); dot.drawCircle(0, -6, 1.5); dot.endFill();
        cont.addChild(dot);

        // Title tooltip on hover
        cont.eventMode = 'static';
        cont.cursor = 'pointer';
        cont.hitArea = new PIXI.Rectangle(-10, -8, 20, 16);
        cont.on('pointerover', (e) => {
            if (typeof UI !== 'undefined') UI.showTooltip(e, '📄 New Paper', paper.title);
        });
        cont.on('pointerout', () => { if (typeof UI !== 'undefined') UI.hideTooltip(); });

        return cont;
    },

    _updateDelivery(delivery, index) {
        if (delivery.phase === 'floating') {
            // Gentle floating descent with swaying
            const dx = delivery.targetX - delivery.sprite.x;
            const dy = delivery.targetY - delivery.sprite.y;
            delivery.sprite.x += dx * 0.015 + Math.sin(G.tick * 0.05) * 0.5;
            delivery.sprite.y += dy * 0.02;
            delivery.sprite.rotation = Math.sin(G.tick * 0.04) * 0.15;

            if (Math.abs(dy) < 5) {
                delivery.phase = 'landing';
                delivery.timer = 60;
                delivery.sprite.rotation = 0;
                if (typeof UI !== 'undefined') {
                    UI.addToast(`📄 ${delivery.labName} received: "${delivery.paper.title.slice(0, 45)}..."`);
                }
            }
        } else if (delivery.phase === 'landing') {
            delivery.timer--;
            // Flash effect
            delivery.sprite.alpha = 0.5 + Math.sin(G.tick * 0.2) * 0.5;
            delivery.sprite.scale.set(1 + (60 - delivery.timer) * 0.005);

            if (delivery.timer <= 0) {
                delivery.phase = 'done';
            }
        } else if (delivery.phase === 'done') {
            if (delivery.sprite.parent) delivery.sprite.parent.removeChild(delivery.sprite);
            this._deliveries.splice(index, 1);
        }
    },

    // Get papers summary for UI
    getRecentPapers(count) {
        return this.papers.filter(p => p.lab).slice(0, count || 10);
    }
};
