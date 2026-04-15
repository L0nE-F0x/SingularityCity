/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   THE SINGULARITY CITY TIMES (v1.0.0 — Phase 3a)
   ────────────────────────────────────────────────────────────────────────────────────────────────
   Weekly newspaper generated from live game state. Opens as a full-screen sepia modal overlay
   when the player clicks the "Singularity City Times" HQ building in downtown.

   Content sections (all pulled from G.models / BM / LABS at open time):
     • Masthead — title, date, vol/issue, city weather
     • Top Story — highest-avg-benchmark model released in the last 30 days
     • Launches — three most recent model releases
     • Lab Standings — top 5 labs by active model count
     • Obituaries — three most recently retired models
     • Classifieds — playful flavor ads that reference real buildings/entities
     • Colophon — masthead attribution + "save as PDF" hint

   The "🖨️ Save as PDF" button calls window.print(). A print-only @media rule strips the chrome
   and scales the article body onto letter-sized paper so browsers emit a clean PDF directly.

   This is a zero-dependency module: no jsPDF / html2canvas / server. Pure DOM + window.print().
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Newspaper = {
    _modalEl: null,
    _styleEl: null,
    _printStyleEl: null,
    _isOpen: false,
    _volumeStart: new Date(2025, 0, 1), // Vol 1 Issue 1 = 2025-01-01

    // Called once during engine boot — installs the print stylesheet
    init() {
        if (this._styleEl) return;

        // Runtime stylesheet (applies when modal is open)
        const runtime = document.createElement('style');
        runtime.id = 'newspaperRuntimeCSS';
        runtime.textContent = `
            #newspaperModal {
                position: fixed; inset: 0; z-index: 99990;
                background: rgba(10, 8, 4, 0.92);
                display: none; overflow-y: auto;
                backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px);
                font-family: Georgia, "Times New Roman", serif;
                color: #1a1308;
                animation: npFade 0.4s ease;
            }
            #newspaperModal.open { display: block; }
            @keyframes npFade { from { opacity: 0; } to { opacity: 1; } }
            #newspaperPaper {
                max-width: 860px;
                margin: 28px auto;
                padding: 40px 48px 48px;
                background: linear-gradient(180deg, #f4ecd6 0%, #efe3c0 100%);
                border: 2px solid #3b2a12;
                box-shadow: 0 20px 60px rgba(0,0,0,0.8), 0 0 0 1px #7a5a28 inset;
                position: relative;
            }
            #newspaperPaper::before {
                content: ''; position: absolute; inset: 8px;
                border: 1px solid rgba(59, 42, 18, 0.3);
                pointer-events: none;
            }
            .np-close {
                position: absolute; top: 14px; right: 18px;
                background: #3b2a12; color: #f4ecd6;
                border: none; border-radius: 4px;
                font: bold 14px/1 Georgia, serif;
                padding: 8px 12px; cursor: pointer;
                z-index: 2;
            }
            .np-close:hover { background: #5a3e1a; }
            .np-pdf {
                position: absolute; top: 14px; right: 64px;
                background: #7a5a28; color: #f4ecd6;
                border: none; border-radius: 4px;
                font: bold 11px/1 Georgia, serif;
                padding: 8px 12px; cursor: pointer;
                letter-spacing: 0.5px;
                z-index: 2;
            }
            .np-pdf:hover { background: #9b7436; }
            .np-masthead {
                text-align: center;
                border-bottom: 4px double #3b2a12;
                padding-bottom: 14px;
                margin-bottom: 18px;
            }
            .np-masthead h1 {
                font-family: "Old English Text MT", "UnifrakturCook", Georgia, serif;
                font-size: 52px; line-height: 1; margin: 6px 0 4px;
                color: #1a1308; letter-spacing: 1px;
                text-shadow: 1px 1px 0 rgba(122, 90, 40, 0.4);
            }
            .np-meta {
                display: flex; justify-content: space-between;
                font-size: 11px; font-style: italic;
                color: #3b2a12; padding: 0 6px;
            }
            .np-tagline {
                font-size: 11px; color: #5a3e1a; font-style: italic;
                margin-top: 2px; letter-spacing: 0.5px;
            }
            .np-top-story {
                margin: 14px 0 24px; padding: 16px 18px;
                background: rgba(255, 255, 255, 0.25);
                border-top: 2px solid #3b2a12;
                border-bottom: 2px solid #3b2a12;
            }
            .np-top-story h2 {
                font-size: 28px; font-weight: bold; margin: 0 0 8px;
                color: #1a1308; line-height: 1.1;
            }
            .np-top-story .np-sub {
                font-size: 13px; font-style: italic; color: #5a3e1a;
                margin: 0 0 10px; border-bottom: 1px dashed #7a5a28;
                padding-bottom: 8px;
            }
            .np-top-story p {
                font-size: 12px; line-height: 1.6; margin: 8px 0 0;
                color: #2a1f0c; text-align: justify;
            }
            .np-grid {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 18px 28px;
                margin-top: 16px;
            }
            .np-section {
                border-top: 1px solid #7a5a28;
                padding-top: 10px;
            }
            .np-section h3 {
                font-size: 15px; margin: 0 0 8px;
                color: #1a1308;
                text-transform: uppercase;
                letter-spacing: 1px;
                border-bottom: 1px solid #7a5a28;
                padding-bottom: 4px;
                font-family: "Old English Text MT", Georgia, serif;
            }
            .np-section .np-item {
                font-size: 11px; line-height: 1.5;
                margin-bottom: 8px; color: #2a1f0c;
            }
            .np-section .np-item b { color: #1a1308; }
            .np-section .np-item .np-byline {
                display: block;
                font-size: 9px; font-style: italic; color: #5a3e1a;
                margin-top: 1px; letter-spacing: 0.3px;
            }
            .np-rank {
                display: inline-block; width: 18px;
                font-weight: bold; color: #7a5a28;
            }
            .np-classifieds {
                margin-top: 16px; padding: 10px 12px;
                background: rgba(122, 90, 40, 0.1);
                border: 1px dashed #7a5a28;
                font-size: 10px; line-height: 1.6; color: #2a1f0c;
                columns: 2; column-gap: 18px;
            }
            .np-classifieds h4 {
                font-size: 13px; margin: 0 0 6px; color: #1a1308;
                column-span: all; text-align: center;
                letter-spacing: 2px;
                font-family: "Old English Text MT", Georgia, serif;
                border-bottom: 1px solid #7a5a28; padding-bottom: 4px;
            }
            .np-classifieds .np-ad {
                margin-bottom: 6px; break-inside: avoid;
            }
            .np-classifieds .np-ad b { color: #3b2a12; }
            .np-colophon {
                margin-top: 22px; padding-top: 10px;
                border-top: 2px double #3b2a12;
                text-align: center;
                font-size: 9px; font-style: italic;
                color: #5a3e1a; letter-spacing: 0.5px;
            }
            @media (max-width: 768px) {
                #newspaperPaper {
                    margin: 8px auto; padding: 16px 14px 20px;
                }
                .np-masthead h1 { font-size: 28px; }
                .np-meta { flex-direction: column; align-items: center; gap: 2px; font-size: 9px; }
                .np-top-story h2 { font-size: 18px; }
                .np-top-story p { font-size: 11px; }
                .np-top-story .np-sub { font-size: 11px; }
                .np-grid { grid-template-columns: 1fr; gap: 12px; }
                .np-section h3 { font-size: 13px; }
                .np-classifieds { columns: 1; font-size: 9px; }
                .np-close { top: 8px; right: 8px; padding: 6px 10px; font-size: 12px; }
                .np-pdf { top: 8px; right: 46px; padding: 6px 10px; font-size: 9px; }
            }
            @media (max-height: 500px) {
                #newspaperPaper { margin: 4px auto; padding: 12px 10px 14px; max-height: calc(100vh - 8px); overflow-y: auto; }
                .np-masthead h1 { font-size: 22px; }
            }
        `;
        document.head.appendChild(runtime);
        this._styleEl = runtime;

        // Print-only stylesheet — strips chrome and fits letter-sized paper
        const print = document.createElement('style');
        print.id = 'newspaperPrintCSS';
        print.media = 'print';
        print.textContent = `
            body > *:not(#newspaperModal) { display: none !important; }
            #newspaperModal { position: static !important; background: #fff !important; backdrop-filter: none !important; }
            #newspaperPaper {
                max-width: 100% !important; margin: 0 !important;
                padding: 24px 32px !important; box-shadow: none !important;
                border: 1px solid #3b2a12 !important;
                background: #fff !important;
                page-break-inside: avoid;
            }
            .np-close, .np-pdf { display: none !important; }
            @page { size: letter; margin: 0.4in; }
        `;
        document.head.appendChild(print);
        this._printStyleEl = print;
    },

    open() {
        if (!this._styleEl) this.init();
        if (this._isOpen) return;

        // Build the modal DOM
        const modal = document.createElement('div');
        modal.id = 'newspaperModal';
        modal.className = 'open';
        modal.innerHTML = this._buildHTML();
        document.body.appendChild(modal);

        // Wire the buttons
        modal.querySelector('.np-close').addEventListener('click', () => this.close());
        modal.querySelector('.np-pdf').addEventListener('click', () => this.savePDF());
        // Click-outside-to-close on the dim background only
        modal.addEventListener('click', (e) => { if (e.target === modal) this.close(); });

        this._modalEl = modal;
        this._isOpen = true;

        // Pause auto-tour if it's active and tell the idle timer not to fire
        if (typeof AutoTour !== 'undefined') {
            AutoTour.stop('newspaper');
            AutoTour._lastInputAt = performance.now();
        }
    },

    close() {
        if (!this._isOpen) return;
        if (this._modalEl) this._modalEl.remove();
        this._modalEl = null;
        this._isOpen = false;
    },

    savePDF() {
        // Give the browser one frame to apply any fresh print CSS, then invoke print.
        // Users hit "Save as PDF" in the print dialog — works in Chrome/Edge/Firefox/Safari.
        setTimeout(() => window.print(), 50);
    },

    // ──────────────────────────────────────────────────────────────────────────────────
    // CONTENT GENERATION — real-world AI news from API feeds + RSS
    // ──────────────────────────────────────────────────────────────────────────────────

    _buildHTML() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const issueNum = this._computeIssueNum(now);
        const weather = this._getWeatherText();

        // Pull real-world news from API feeds
        const headlines = this._getLiveHeadlines(8);
        const papers = this._getArxivPapers(4);
        const regulation = this._getRegulationNews(4);
        const stocks = this._getStockTicker();

        let html = `<div id="newspaperPaper">`;
        html += `<button class="np-pdf" title="Print / save as PDF">🖨 SAVE AS PDF</button>`;
        html += `<button class="np-close" aria-label="Close">✕</button>`;

        // Masthead
        html += `<div class="np-masthead">
            <div class="np-tagline">— ESTABLISHED 2025 · WEEKLY RECORD OF THE INTELLIGENCE FRONTIER —</div>
            <h1>The Singularity City Times</h1>
            <div class="np-meta">
                <span><b>VOL. ${issueNum.vol}</b> · No. ${issueNum.issue}</span>
                <span>${dateStr}</span>
                <span>${weather} · ONE CREDIT</span>
            </div>
        </div>`;

        // ─── LEAD STORY (first real headline) ───
        if (headlines.length > 0) {
            const lead = headlines[0];
            html += `<div class="np-top-story">
                <h2>${this._esc(lead.headline)}</h2>
                <div class="np-sub">Source: ${this._esc(lead.source)} · <a href="${this._esc(lead.url)}" target="_blank" rel="noopener" style="color:#5a3e1a">Read full article →</a></div>
            </div>`;
        } else {
            html += `<div class="np-top-story">
                <h2>The Frontier Holds Steady</h2>
                <div class="np-sub">News feeds are loading. Check back shortly.</div>
            </div>`;
        }

        // ─── TWO-COLUMN GRID ───
        html += `<div class="np-grid">`;

        // Column 1: AI Industry Headlines
        html += `<div class="np-section"><h3>📡 AI Industry Watch</h3>`;
        if (headlines.length > 1) {
            for (let i = 1; i < headlines.length; i++) {
                const h = headlines[i];
                html += `<div class="np-item">
                    <b><a href="${this._esc(h.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(h.headline)}</a></b>
                    <span class="np-byline">${this._esc(h.source)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>RSS feeds loading — headlines will appear on next refresh.</i></div>`;
        }
        html += `</div>`;

        // Column 2: Research Frontiers (arXiv)
        html += `<div class="np-section"><h3>📄 Research Frontiers</h3>`;
        if (papers.length > 0) {
            for (const p of papers) {
                html += `<div class="np-item">
                    <b><a href="https://arxiv.org/abs/${this._esc(p.id)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(p.title)}</a></b>
                    <span class="np-byline">arXiv: ${this._esc(p.id)} · ${this._esc(p.published)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>arXiv feed loading — papers will appear shortly.</i></div>`;
        }
        html += `</div>`;

        html += `</div>`; // end grid

        // ─── REGULATION & POLICY (full width) ───
        html += `<div class="np-section" style="margin-top:16px"><h3>⚖ Regulation & Policy</h3>`;
        if (regulation.length > 0) {
            for (const r of regulation) {
                html += `<div class="np-item">
                    <b><a href="${this._esc(r.url)}" target="_blank" rel="noopener" style="color:#1a1308;text-decoration:none">${this._esc(r.headline)}</a></b>
                    <span class="np-byline">${this._esc(r.source)}</span>
                </div>`;
            }
        } else {
            html += `<div class="np-item"><i>No regulation headlines this cycle. The policy desk is quiet.</i></div>`;
        }
        html += `</div>`;

        // ─── MARKET TICKER (if stock data available) ───
        if (stocks.length > 0) {
            html += `<div class="np-section" style="margin-top:12px"><h3>📈 Market Ticker</h3>`;
            html += `<div class="np-item" style="font-family:monospace;font-size:10px;line-height:1.8">`;
            html += stocks.map(s =>
                `<b>${this._esc(s.sym)}</b> $${this._esc(s.price)} <span style="color:${s.color}">${this._esc(s.change)}</span>`
            ).join(' · ');
            html += `</div></div>`;
        }

        // Classifieds
        html += this._buildClassifieds();

        // Colophon
        html += `<div class="np-colophon">
            THE SINGULARITY CITY TIMES is printed daily at the Times HQ downtown.
            News sourced live from TechCrunch, The Verge, VentureBeat, Ars Technica & arXiv.
            Editor-in-Chief: The Autonomous Bureau · Design: The Neon Atelier
            <br>— Press <b>Save as PDF</b> above to archive this issue —
        </div>`;

        html += `</div>`;
        return html;
    },

    // Build a numeric issue (Vol/Issue) from weeks elapsed since launch date
    _computeIssueNum(now) {
        const ms = now - this._volumeStart;
        const weeks = Math.max(1, Math.floor(ms / (7 * 24 * 3600 * 1000)) + 1);
        const issuesPerVolume = 52;
        const vol = Math.floor((weeks - 1) / issuesPerVolume) + 1;
        const issue = ((weeks - 1) % issuesPerVolume) + 1;
        return { vol, issue };
    },

    _getWeatherText() {
        const weather = (typeof Environment !== 'undefined' && Environment.weather) || 'clear';
        const map = {
            clear: 'FAIR SKIES', rain: 'RAINY', snow: 'SNOW FLURRIES',
            cherry: 'BLOSSOM DRIFT', sandstorm: 'SANDSTORM',
            drizzle: 'LIGHT DRIZZLE', thunderstorm: 'THUNDERSTORMS',
            fog: 'THICK FOG', overcast: 'OVERCAST', partly_cloudy: 'PARTLY CLOUDY',
            leaves: 'AUTUMN LEAVES',
        };
        return map[weather] || 'FAIR SKIES';
    },

    // ─── Real-world news from API feeds ───

    _getLiveHeadlines(n) {
        if (typeof API === 'undefined' || !API.liveNews || API.liveNews.length === 0) return [];
        return API.liveNews.slice(0, n);
    },

    _getArxivPapers(n) {
        if (typeof API === 'undefined' || !API.arxivPapers || API.arxivPapers.length === 0) return [];
        return API.arxivPapers.slice(0, n);
    },

    _getRegulationNews(n) {
        if (typeof API === 'undefined' || !API.regulationNews || API.regulationNews.length === 0) return [];
        return API.regulationNews.slice(0, n);
    },

    _getStockTicker() {
        if (typeof API === 'undefined' || !API.stockPrices) return [];
        const entries = Object.entries(API.stockPrices);
        if (entries.length === 0) return [];
        return entries.slice(0, 10).map(([sym, data]) => ({
            sym,
            price: data.price,
            change: data.change,
            color: data.color || '#666',
        }));
    },

    _buildClassifieds() {
        // Playful flavor ads that reference real in-game entities. Deterministic-ish pool.
        const ads = [
            ['WANTED', 'Night-shift barista, API Cafe. Must handle 4K tokens/sec. Competitive per-prompt rate. Apply within.'],
            ['FOR SALE', 'Gently used embedding model, 1536-dim, low-mileage. $50 OBO. Reach out via any vector database.'],
            ['LOST', 'One (1) aligned scalar. Last seen near the RLHF Gym. Reward: full context window.'],
            ['SERVICES', 'The Neon Bar now hosts open-mic prompt nights every Thursday. Models unwind, humans learn.'],
            ['ANNOUNCEMENT', 'LMSYS Arena semifinals this weekend. Bring your flagship. Bring your friends. Bring your backups.'],
            ['NOTICE', 'The Leaderboard Monument will be repolished next week. Expect benchmark glare reduction.'],
            ['SEEKING', 'Retired PaLM 2 memoir — "I Was There Before The Transformer". Available at the Legacy Systems museum.'],
            ['PERSONALS', 'Open-source LLM seeks cozy fine-tuning partner. No frozen layers, please. Loss curves welcome.'],
        ];
        let html = `<div class="np-classifieds"><h4>— CLASSIFIEDS —</h4>`;
        for (const [kind, body] of ads) {
            html += `<div class="np-ad"><b>${kind}:</b> ${body}</div>`;
        }
        html += `</div>`;
        return html;
    },

    _esc(s) {
        if (s == null) return '';
        return String(s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    },
};
