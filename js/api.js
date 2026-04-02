/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   API & SERVICES LAYER (v16.5.0 - Dynamic Region Parameter Passing)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const API = {
    liveNews: [],
    newsIdx: 0,
    stockPrices: {},
    
    supabase: null,
    
    // Convert any model object to Supabase-safe format (matching scan nm schema)
    _dbSafeModel(m) {
        return {
            id: m.id,
            name: m.name,
            lab: m.lab,
            rel: m.released || m.rel || null,
            ret: m.retired || m.ret || null,
            phase: m.phase || 'released',
            os: m.os || false,
            desc: m.desc || '',
            per: m.personality || m.per || 'Analytical',
            tal: m.talent || m.tal || 'General',
            fav: m.favSpot || m.fav || 'Server Room',
            _src: true,
            benchmarks: m.benchmarks || null,
            arch: m.arch || null,
            ctx: m.ctx || null,
            cost_input: m.cost_input || 0,
            cost_out: m.cost_out || 0
        };
    },

    initSupabase() {
        if (G.supabaseUrl && G.supabaseKey && typeof window.supabase !== 'undefined') {
            this.supabase = window.supabase.createClient(G.supabaseUrl, G.supabaseKey);
            console.log("Supabase Connection Established.");
        } else {
            console.warn("Supabase credentials missing or SDK not loaded. Running in local-only mode.");
        }
    },

    async fetchCoreData() {
        if (!this.supabase) {
            console.warn("Supabase not initialized. Using local fallback data.");
            return false;
        }
        
        try {
            const [labsRes, foundersRes, computeRes, bldsRes, actsRes, famRes, evRes, dcRes] = await Promise.all([
                this.supabase.from('labs').select('*'),
                this.supabase.from('founders').select('*'),
                this.supabase.from('compute_clusters').select('*'),
                this.supabase.from('blds').select('*').order('x', { ascending: true }),
                this.supabase.from('acts').select('*'),
                this.supabase.from('families').select('*'),
                this.supabase.from('ai_events').select('*'),
                this.supabase.from('dc_facilities').select('*').then(r => r).catch(() => ({ data: null, error: null }))
            ]);

            if (labsRes.error) throw labsRes.error;
            if (foundersRes.error) throw foundersRes.error;
            if (computeRes.error) throw computeRes.error;
            if (bldsRes.error) throw bldsRes.error;
            if (actsRes.error) throw actsRes.error;
            if (famRes.error) throw famRes.error;
            if (evRes.error) throw evRes.error;

            LABS = {
                other: { name: 'Independent', color: '#64748b', icon: '🌐', ticker: null, desc: 'Independent entities and public spaces.', region: 'eu' }
            };
            
            labsRes.data.forEach(lab => {
                LABS[lab.id] = {
                    name: lab.name,
                    color: lab.color,
                    icon: lab.icon || '🏢',
                    ticker: lab.ticker,
                    desc: lab.lore_desc,
                    region: lab.region || 'eu' 
                };
            });

            REAL_FOUNDERS = foundersRes.data.map(f => ({
                lab: f.lab_id,
                name: f.name,
                role: f.role,
                fact: f.fact,
                color: f.color
            }));

            if (!window.COMPUTE_DATA) window.COMPUTE_DATA = {};
            window.COMPUTE_DATA.clusters = computeRes.data.map(c => ({
                lab: c.lab_id,
                name: c.cluster_name,
                gpus: c.gpus,
                type: c.type,
                location: c.location
            }));

            // Merge cloud DC facilities with hardcoded fallback
            if (dcRes && dcRes.data && dcRes.data.length > 0) {
                dcRes.data.forEach(row => {
                    const existing = DC_FACILITIES.find(dc => dc.id === row.id);
                    if (existing) {
                        // Update from cloud (cloud is source of truth for mutable fields)
                        if (row.status) existing.status = row.status;
                        if (row.gpus) existing.gpus = row.gpus;
                        if (row.power_mw) existing.power_mw = row.power_mw;
                        if (row.cooling) existing.cooling = row.cooling;
                        if (row.process) existing.process = row.process;
                        if (row.products) existing.products = row.products;
                        if (row.investment) existing.investment = row.investment;
                        if (row.completion) existing.completion = row.completion;
                        if (row.description) existing.desc = row.description;
                    } else {
                        // New facility discovered from cloud — add to local array
                        DC_FACILITIES.push({
                            id: row.id, name: row.name, operator: row.operator,
                            location: row.location, type: row.type || 'datacenter',
                            status: row.status || 'operational',
                            gpus: row.gpus, power_mw: row.power_mw, cooling: row.cooling,
                            process: row.process, products: row.products,
                            investment: row.investment, completion: row.completion,
                            desc: row.description || '', w: row.width || 160, color: row.color || '#64748b'
                        });
                    }
                });
                console.log(`🖥️ Synced ${dcRes.data.length} DC facilities from cloud`);
            }

            window.BLDS = bldsRes.data.map(b => ({
                id: b.id,
                name: b.name,
                w: b.w,
                x: b.x,
                fl: b.fl,
                emoji: b.emoji,
                lab: b.lab,
                desc: b.desc
            }));

            window.ACTS = {};
            actsRes.data.forEach(a => {
                window.ACTS[a.id] = {
                    label: a.label,
                    verb: a.verb,
                    icon: a.icon,
                    indoor: a.indoor
                };
            });

            window.FAMILIES = {};
            famRes.data.forEach(f => {
                window.FAMILIES[f.lab] = f.edges;
            });

            window.AI_EVENTS = evRes.data;

            console.log("✅ Core configuration data successfully loaded!");
            return true;
        } catch (err) {
            console.error("❌ Failed to fetch core data from Supabase:", err);
            return false;
        }
    },
    
    async fetchCloudModels() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('models').select('*');
            if (error) throw error;
            
            if (data && data.length > 0) {
                const existingMap = new Map(G.models.map(m => [m.id, m]));
                let added = 0;
                
                data.forEach(m => {
                    if (m.benchmarks) {
                        if (!window.BM) window.BM = {};
                        if (!window.BM[m.id]) window.BM[m.id] = {};
                        Object.keys(m.benchmarks).forEach(k => {
                            window.BM[m.id][k.toUpperCase()] = m.benchmarks[k];
                        });
                    }
                    
                    if (m.cost_input != null && m.cost_out != null) {
                        if (!window.COSTS) window.COSTS = {};
                        window.COSTS[m.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                    }
                    if (m.ctx != null) {
                        if (!window.CTX) window.CTX = {};
                        window.CTX[m.id] = parseInt(m.ctx);
                    }
                    
                    // PASS REGION INTO ENGINE DYNAMICALLY
                    m.lab = G.ensureLabExists(m.lab, m.region);

                    if (!existingMap.has(m.id)) {
                        G.models.push(m);
                        if (typeof Entities !== 'undefined') Entities.createChar(m); 
                        added++;
                    } else {
                        Object.assign(existingMap.get(m.id), m); 
                    }
                });
                
                if (added > 0) {
                    if (typeof UI !== 'undefined') UI.addLog(`☁️ Synced ${added} models from global database.`);
                }
                // Always re-evolve: cost, benchmark, and ELO data may have updated
                // for existing models even when no new models were added.
                // This recalculates cheapestLab (SALE sign) and topLab (Apex Beacon).
                G.evolveCity();
            }
        } catch(e) {
            console.error("Cloud fetch failed:", e);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   HUGGING FACE API — Free, no-auth, 100% accurate model data
    // ═══════════════════════════════════════════════════════════════
    
    _hfOrgToLab: {
        'meta-llama': 'meta', 'google': 'google', 'mistralai': 'mistral', 'Qwen': 'alibaba',
        'microsoft': 'microsoft', 'nvidia': 'nvidia', 'deepseek-ai': 'deepseek', 'apple': 'apple',
        'amazon': 'amazon', 'stabilityai': 'stability', 'bigcode': 'bigcode', 'tiiuae': 'tii',
        'THUDM': 'zhipu_ai', '01-ai': '01_ai', 'baichuan-inc': 'baichuan', 'internlm': 'shanghai_ai_lab',
        'CohereForAI': 'cohere', 'databricks': 'databricks',
        'allenai': 'allen_ai', 'cerebras': 'cerebras', 'EleutherAI': 'eleutherai',
        'HuggingFaceH4': 'huggingface', 'bigscience': 'bigscience', 'mosaicml': 'mosaicml',
        'Salesforce': 'salesforce', 'NousResearch': 'nous_research', 'upstage': 'upstage',
        'Phind': 'phind'
    },
    
    async fetchHuggingFace() {
        try {
            const isNetlify = window.location.hostname.includes('netlify');
            const url = isNetlify 
                ? '/api/hf/models?sort=likes&limit=25&pipeline_tag=text-generation'
                : 'https://huggingface.co/api/models?sort=likes&limit=25&pipeline_tag=text-generation';
            const res = await fetch(url, { signal: AbortSignal.timeout(15000) });
            if (!res.ok) { 
                const errBody = await res.text().catch(() => '');
                console.warn('[HF API] HTTP', res.status, errBody.substring(0, 200)); 
                return; 
            }
            const models = await res.json();
            
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            let added = 0;
            
            for (const hf of models) {
                if (!hf.id || !hf.modelId) continue;
                
                const parts = hf.modelId.split('/');
                const org = parts.length > 1 ? parts[0] : 'unknown';
                const modelName = parts.length > 1 ? parts[1] : parts[0];
                
                const displayName = modelName.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase()).trim();
                
                const safeName = displayName.toLowerCase().replace(/[^a-z0-9]/g, '');
                if (existingNames.has(safeName)) continue;
                
                const labId = this._hfOrgToLab[org] || org.toLowerCase().replace(/[^a-z0-9]/g, '_');
                const region = ['meta-llama', 'google', 'microsoft', 'nvidia', 'apple', 'amazon', 'allenai', 'cerebras'].includes(org) ? 'us' :
                               ['Qwen', 'deepseek-ai', 'THUDM', '01-ai', 'baichuan-inc', 'internlm'].includes(org) ? 'cn' : 'eu';
                
                const nm = {
                    id: hf.modelId.replace(/\//g, '_').toLowerCase(),
                    name: displayName,
                    lab: G.ensureLabExists(labId, region),
                    region: region,
                    released: hf.createdAt ? hf.createdAt.split('T')[0] : null,
                    retired: null,
                    phase: 'released',
                    os: true,
                    desc: `Open-weights model trending on Hugging Face. ${hf.downloads ? (hf.downloads > 1000000 ? (hf.downloads/1000000).toFixed(1) + 'M downloads' : (hf.downloads/1000).toFixed(0) + 'K downloads') : ''} ${hf.likes ? hf.likes + ' likes' : ''}`.trim(),
                    personality: 'Open Source',
                    talent: (hf.tags || []).includes('code') ? 'Coding' : 'General',
                    favSpot: 'Open Square',
                    _src: 'huggingface',
                    arch: { params: 'Unknown', type: 'Unknown', tokens: 'Unknown', compute: 'Unknown' }
                };
                
                const isDupe = G.models.some(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                if (isDupe) continue;
                
                existingNames.add(safeName);
                G.models.push(nm);
                if (typeof Entities !== 'undefined') Entities.createChar(nm);
                added++;
                
                if (this.supabase) {
                    try { await this.supabase.from('models').upsert(this._dbSafeModel(nm)); } catch(e) { /* silent */ }
                }
                
                if (added >= 6) break;
            }
            
            if (added > 0) {
                console.log(`🤗 [HF] Discovered ${added} trending open-source models`);
                if (typeof UI !== 'undefined') UI.addToast(`🤗 Hugging Face: ${added} new open-source models!`);
                if (typeof NOTIFY !== 'undefined') NOTIFY.send('Models Discovered!', `🤗 ${added} new open-source models from Hugging Face`);
                if (typeof UI !== 'undefined') UI.addLog(`🤗 HF API: ${added} trending models added`);
                G.evolveCity();
            } else {
                console.log('🤗 [HF] No new models (all trending already tracked)');
            }
        } catch(e) {
            console.warn('[HF API] Fetch failed:', e.message);
        }
    },

    // ═══════════════════════════════════════════════════════════════
    //   ZEROEVAL LEADERBOARD API — Free, no-auth, 100% accurate
    //   benchmarks, pricing, context windows for ALL models
    // ═══════════════════════════════════════════════════════════════
    
    _zeOrgToLab: {
        'openai': 'openai', 'anthropic': 'anthropic', 'google': 'google', 'meta': 'meta',
        'xai': 'xai', 'mistral': 'mistral', 'deepseek': 'deepseek', 'cohere': 'cohere',
        'microsoft': 'microsoft', 'nvidia': 'nvidia', 'amazon': 'amazon', 'alibaba': 'alibaba',
        'zhipu': 'zhipu_ai', '01ai': '01_ai', 'baichuan': 'baichuan', 'apple': 'apple',
        'databricks': 'databricks', 'ai21': 'ai21', 'minimax': 'minimax', 'reka': 'reka',
        'together': 'together', 'perplexity': 'perplexity', 'inflection': 'inflection',
        'stability': 'stability'
    },
    _zeCountryToRegion: { 'US': 'us', 'CN': 'cn', 'FR': 'eu', 'CA': 'eu', 'IL': 'eu', 'UK': 'eu', 'DE': 'eu', 'FI': 'eu', 'AE': 'eu', 'KR': 'cn', 'JP': 'cn', 'IN': 'cn' },
    
    async fetchZeroEval() {
        try {
            const isNetlify = window.location.hostname.includes('netlify');
            const url = isNetlify
                ? '/api/zeroeval/leaderboard/models/full?justCanonicals=true'
                : 'https://api.zeroeval.com/leaderboard/models/full?justCanonicals=true';
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) { console.warn('[ZeroEval] HTTP', res.status); return; }
            const models = await res.json();
            if (!Array.isArray(models)) return;
            
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            const existingIds = new Set(G.models.map(m => m.id.toLowerCase().replace(/[^a-z0-9]/g, '')));
            
            // Fuzzy name normalizer — strips version dates like "20250514", trailing numbers
            const fuzzyNorm = (s) => s.toLowerCase().replace(/[^a-z0-9]/g, '').replace(/\d{6,}/g, '').replace(/\d+$/,'');
            const existingFuzzy = new Set(G.models.map(m => fuzzyNorm(m.name)));
            
            // Track how many ZeroEval-sourced models we already have (cap at 150 total)
            const zeModelsCount = G.models.filter(m => m._src === 'zeroeval').length;
            const zeCapRemaining = Math.max(0, 150 - zeModelsCount);
            
            let added = 0, benchUpdated = 0;
            
            for (const ze of models) {
                if (!ze.name || !ze.organization_id) continue;
                
                const safeName = ze.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                const safeId = ze.model_id ? ze.model_id.toLowerCase().replace(/[^a-z0-9]/g, '') : safeName;
                const fuzzyName = fuzzyNorm(ze.name);
                
                // Build benchmark object from ZeroEval scores
                const bm = {};
                if (ze.gpqa_score) bm.GPQA = Math.round(ze.gpqa_score * 100);
                if (ze.mmmlu_score) bm.MMLU = Math.round(ze.mmmlu_score * 100);
                if (ze.aime_2025_score) bm.MATH = Math.round(ze.aime_2025_score * 100);
                if (ze.swe_bench_verified_score) bm.HumanEval = Math.round(ze.swe_bench_verified_score * 100);
                
                // Try to match to an existing model — use fuzzy matching to catch version variants
                const existing = G.models.find(m => {
                    const eName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eId = m.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eFuzzy = fuzzyNorm(m.name);
                    return eName === safeName || eId === safeId || eFuzzy === fuzzyName;
                });
                
                if (existing) {
                    // Backfill benchmarks, pricing, context, and correct stale data
                    let updated = false;
                    if (Object.keys(bm).length > 0) {
                        if (!window.BM) window.BM = {};
                        if (!window.BM[existing.id]) window.BM[existing.id] = {};
                        Object.entries(bm).forEach(([k, v]) => {
                            if (!window.BM[existing.id][k] || v > window.BM[existing.id][k]) {
                                window.BM[existing.id][k] = v;
                                updated = true;
                            }
                        });
                    }
                    if (ze.input_price != null && ze.output_price != null) {
                        if (!window.COSTS) window.COSTS = {};
                        window.COSTS[existing.id] = { input: ze.input_price, output: ze.output_price };
                        existing.cost_input = ze.input_price;
                        existing.cost_out = ze.output_price;
                        updated = true;
                    }
                    if (ze.context && !existing.ctx) {
                        if (!window.CTX) window.CTX = {};
                        window.CTX[existing.id] = ze.context;
                        existing.ctx = ze.context;
                        updated = true;
                    }
                    // Fix stale phase — ZeroEval only lists released models
                    if (existing.phase === 'rumored' || existing.phase === 'pre_training') {
                        console.log(`📊 [ZeroEval] Corrected ${existing.name}: "${existing.phase}" → "released"`);
                        existing.phase = 'released';
                        updated = true;
                    }
                    // Backfill release date if missing
                    if (ze.release_date && (!existing.rel && !existing.released)) {
                        existing.rel = ze.release_date;
                        existing.released = ze.release_date;
                        updated = true;
                    }
                    if (updated) benchUpdated++;
                    continue;
                }
                
                // New model — check fuzzy match and cap before creating
                if (existingFuzzy.has(fuzzyName)) { benchUpdated++; continue; } // fuzzy match caught a variant
                if (added >= zeCapRemaining) continue; // cap reached
                
                const orgId = ze.organization_id.toLowerCase();
                const labId = this._zeOrgToLab[orgId] || orgId.replace(/[^a-z0-9]/g, '_');
                const region = this._zeCountryToRegion[ze.organization_country] || 'us';
                
                const nm = {
                    id: ze.model_id || safeName,
                    name: ze.name,
                    lab: G.ensureLabExists(labId, region),
                    region: region,
                    released: ze.release_date || null,
                    retired: null,
                    phase: 'released',
                    os: ze.license && ze.license !== 'proprietary',
                    desc: `${ze.organization} model.${ze.params ? ' ' + (ze.params / 1e9).toFixed(0) + 'B params.' : ''}${ze.multimodal ? ' Multimodal.' : ''}`,
                    personality: ze.multimodal ? 'Multimodal' : 'Analytical',
                    talent: ze.swe_bench_verified_score > 0.5 ? 'Coding' : 'General',
                    favSpot: ze.license === 'proprietary' ? 'Server Room' : 'Open Square',
                    _src: 'zeroeval',
                    benchmarks: Object.keys(bm).length > 0 ? bm : null,
                    ctx: ze.context || null,
                    cost_input: ze.input_price || null,
                    cost_out: ze.output_price || null,
                    arch: {
                        params: ze.params ? (ze.params / 1e9).toFixed(0) + 'B' : 'Unknown',
                        type: ze.is_moe ? 'MoE' : 'Dense',
                        tokens: ze.training_tokens ? (ze.training_tokens / 1e12).toFixed(1) + 'T' : 'Unknown',
                        compute: 'Unknown'
                    }
                };
                
                // Store benchmarks
                if (Object.keys(bm).length > 0) {
                    if (!window.BM) window.BM = {};
                    window.BM[nm.id] = bm;
                }
                if (ze.input_price != null && ze.output_price != null) {
                    if (!window.COSTS) window.COSTS = {};
                    window.COSTS[nm.id] = { input: ze.input_price, output: ze.output_price };
                }
                if (ze.context) {
                    if (!window.CTX) window.CTX = {};
                    window.CTX[nm.id] = ze.context;
                }
                
                existingNames.add(safeName);
                existingFuzzy.add(fuzzyName);
                G.models.push(nm);
                if (typeof Entities !== 'undefined') Entities.createChar(nm);
                added++;
                
                if (this.supabase) {
                    try { await this.supabase.from('models').upsert(this._dbSafeModel(nm)); } catch(e) { /* silent */ }
                }
                
                if (added >= 8) break; // cap per fetch
            }
            
            if (added > 0 || benchUpdated > 0) {
                console.log(`📊 [ZeroEval] +${added} new models, ${benchUpdated} benchmark updates`);
                if (typeof UI !== 'undefined') {
                    if (added > 0) { UI.addToast(`📊 ZeroEval: ${added} new models with real benchmarks!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Benchmarks Updated!', `📊 ${added} new models with real benchmark scores`); }
                    UI.addLog(`📊 ZeroEval: +${added} models, ${benchUpdated} benchmark backfills`);
                }
                G.evolveCity();
            } else {
                console.log('📊 [ZeroEval] All leaderboard models already tracked');
            }
        } catch(e) {
            console.warn('[ZeroEval] Fetch failed:', e.message);
        }
    },
  
    async fetchLiveNews() {
      let got = false;
      const allFeeds = [
        { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
        { url: 'https://www.theverge.com/rss/ai-artificial-intelligence/index.xml', source: 'The Verge' },
        { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        { url: 'https://arstechnica.com/tag/ai/feed/', source: 'Ars Technica' }
      ];
      
      for (let i = allFeeds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allFeeds[i], allFeeds[j]] = [allFeeds[j], allFeeds[i]];
      }
      const selectedFeeds = allFeeds.slice(0, 2);
      
      for (const feed of selectedFeeds) {
        try {
          const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
          if (!r.ok) {
              console.warn(`[News API] Skipping ${feed.source}: Server returned ${r.status}`);
              continue; 
          }

          const d = await r.json();
          if (d.status === 'ok' && d.items?.length > 0) {
            this.liveNews = [...this.liveNews.filter(n => n.source !== feed.source), ...d.items.slice(0, 12).map(i => ({ headline: i.title, url: i.link, source: feed.source }))].slice(0, 40);
            got = true;
          }
        } catch(e) {
            console.warn(`[News API] Failed to load ${feed.source}`);
        }
      }

      if (!got && this.liveNews.length === 0) {
        this.liveNews = [
          { headline: "OpenAI releases GPT-5.4 with 1M token context", url: "https://openai.com", source: "Fallback" },
          { headline: "Claude Opus 4.6 leads SWE-bench coding benchmarks", url: "https://anthropic.com", source: "Fallback" },
          { headline: "Google Gemini 3.1 Pro launches with improved reasoning", url: "https://deepmind.google", source: "Fallback" },
          { headline: "DeepSeek R1 open-source reasoning model shocks industry", url: "https://deepseek.com", source: "Fallback" }
        ];
      }
      
      if (this.liveNews.length > 0) {
        for (let i = this.liveNews.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.liveNews[i], this.liveNews[j]] = [this.liveNews[j], this.liveNews[i]];
        }
        this.newsIdx = 0;
        if (typeof UI !== 'undefined') UI.updateTicker();
      }
    },

    async fetchStocks() {
      if (!G.finnhubKey) return;
      const symbols = [...new Set(Object.values(LABS).map(l => l.ticker).filter(Boolean))];
      
      for (const sym of symbols) {
          try {
              const r = await fetch(`https://finnhub.io/api/v1/quote?symbol=${sym}&token=${G.finnhubKey}`);
              if (!r.ok) continue;
              const d = await r.json();
              if (d) {
                  const currentPrice = d.c !== null && d.c !== undefined ? d.c.toFixed(2) : "0.00";
                  const dailyChange = d.d !== null && d.d !== undefined ? d.d.toFixed(2) : "0.00";
                  if (currentPrice !== "0.00") {
                      const changeVal = parseFloat(dailyChange);
                      const changeStr = changeVal > 0 ? '+' : '';
                      const color = changeVal >= 0 ? '#00ff00' : '#ff3333';
                      this.stockPrices[sym] = { 
                          price: currentPrice, 
                          change: `${changeStr}${dailyChange}`, 
                          color 
                      };
                  }
              }
          } catch(e) {
              console.warn(`Failed to fetch stock for ${sym}`);
          }
          await new Promise(res => setTimeout(res, 1100));
      }
    },
  
    async askAnalyst() {
      const input = document.getElementById('analystInput');
      if (!input) return;
      const q = input.value.trim();
      if (!q) return;
      if (!G.authKey) { if(typeof UI !== 'undefined') UI.addToast('❌ Set API key in Settings.'); return; }
  
      const safeQ = q.replace(/</g, "&lt;").replace(/>/g, "&gt;");

      const chat = document.getElementById('analystChat');
      if (!chat) return;
      
      chat.innerHTML += `<div style="text-align:right;margin-bottom:8px"><span style="background:var(--ac);color:#000;padding:4px 10px;border-radius:8px 8px 0 8px;font-size:9px">${safeQ}</span></div><div id="aL" style="font-size:9px;color:var(--cy)">🤔 Thinking...</div>`;
      input.value = '';
      chat.scrollTop = chat.scrollHeight;
  
      const ctx = `You are an AI analyst. Model data: ${JSON.stringify(G.models.slice(0, 25).map(m => ({ n: m.name, l: m.lab, p: m.phase, elo: window.BM && window.BM[m.id]?.ELO }))) }. Answer concisely.`;
  
      try {
        let url, hd = { 'Content-Type': 'application/json' }, pl;
        if (G.apiProvider === 'anthropic') {
          url = 'https://api.anthropic.com/v1/messages'; 
          hd['x-api-key'] = G.authKey; 
          hd['anthropic-version'] = '2023-06-01'; 
          hd['anthropic-dangerously-allow-browser'] = 'true';
          pl = { model: G.modelId || 'claude-3-5-sonnet-20240620', max_tokens: 4096, system: ctx, messages: [{ role: 'user', content: q }] };
        } else if (G.apiProvider === 'google') {
          url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || 'gemini-2.5-flash'}:generateContent?key=${G.authKey}`;
          pl = { systemInstruction: { parts: [{ text: ctx }] }, contents: [{ parts: [{ text: q }] }], generationConfig: { maxOutputTokens: 4096 } };
        } else if (G.apiProvider === 'xai') {
          url = 'https://api.x.ai/v1/chat/completions';
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || 'grok-3-latest', max_tokens: 4096, messages: [{ role: 'system', content: ctx }, { role: 'user', content: q }] };
        } else {
          url = 'https://api.openai.com/v1/chat/completions'; 
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || 'gpt-4o', max_tokens: 4096, messages: [{ role: 'system', content: ctx }, { role: 'user', content: q }] };
        }
  
        const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl) });
        const d = await r.json();
  
        let txt = '';
        if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || 'No response';
        else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';
        else txt = d.choices?.[0]?.message?.content || 'No response';
        
        const safeTxt = txt.replace(/</g, "&lt;").replace(/>/g, "&gt;");

        document.getElementById('aL')?.remove();
        chat.innerHTML += `<div style="margin-bottom:8px"><span style="background:var(--sf);border:1px solid var(--bd);padding:8px 12px;border-radius:0 8px 8px 8px;font-size:9px;display:inline-block;color:var(--t2);line-height:1.6;max-width:90%">${safeTxt}</span></div>`;
        chat.scrollTop = chat.scrollHeight;
      } catch(e) {
        const l = document.getElementById('aL');
        if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
            if (l) l.innerHTML = `❌ Network Error: Failed to connect to API provider. Retrying later usually works.`;
        } else {
            if (l) l.innerHTML = `❌ ${e.message}`;
        }
      }
    },
  
    async doScan() {
      if (this._scanning) return;
      this._scanning = true;

      if (!G.authKey) { if(typeof UI !== 'undefined') UI.addLog('❌ No API key.'); this._scanning = false; return; }
      
      const btn = document.getElementById('btnScan');
      if (btn) {
          btn.classList.add('scanning');
          btn.innerHTML = '🛰️ Scanning...';
      }
      
      if(typeof UI !== 'undefined') UI.addLog(`🛰️ Scanning via ${G.apiProvider}...`);
      if(typeof SND !== 'undefined') SND.scan();
      G.unlockAchieve('first_scan');
      
      try {
        if (!this.supabase && G.supabaseUrl && G.supabaseKey) {
            this.initSupabase();
        }

        const stockPromise = this.fetchStocks();
        
        let parsedData = null;
        let lastErr = "";
        let rawDataDump = null; 

        for (let attempt = 1; attempt <= 3; attempt++) {
            try {
                // ─── WEIGHTED CATEGORY SELECTION ───
                // Cutting-edge gets 50% of scans to ensure latest models arrive first
                const weightedCategories = [
                    { cat: "CUTTING-EDGE 2025-2026 Flagships (the NEWEST model from each major lab)", w: 50 },
                    { cat: "Asian Tech Latest (DeepSeek-R2, Qwen3, Ernie 5, GLM-5, Yi-Lightning)", w: 15 },
                    { cat: "Open-weights Latest (Llama 4, Mistral Large 2, Gemma 3, Phi-4, Command-R+)", w: 15 },
                    { cat: "Specialized/Niche (Coding, Audio, Vision, Medical, Robotics — 2025 releases only)", w: 10 },
                    { cat: "Rumored or In-Training (genuinely unconfirmed next-gen models)", w: 10 }
                ];
                
                let roll = Math.random() * 100, cumulative = 0;
                let focusCategory = weightedCategories[0].cat;
                for (const wc of weightedCategories) {
                    cumulative += wc.w;
                    if (roll < cumulative) { focusCategory = wc.cat; break; }
                }

                // ─── FLAGSHIP GAP: Which major labs are missing their LATEST model? ───
                const flagshipExpectations = {
                    anthropic: ['Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4'],
                    openai: ['GPT-4.1', 'o3', 'o4-mini', 'GPT-4o'],
                    google: ['Gemini 2.5 Pro', 'Gemini 2.5 Flash'],
                    xai: ['Grok 3', 'Grok 3 Mini', 'Grok 4'],
                    meta: ['Llama 4 Scout', 'Llama 4 Maverick'],
                    deepseek: ['DeepSeek-R1', 'DeepSeek-V3'],
                    microsoft: ['Phi-4', 'Phi-4-mini'],
                    amazon: ['Nova Pro', 'Nova Premier'],
                    nvidia: ['Nemotron Ultra', 'Llama-3.1-Nemotron-Ultra'],
                    alibaba: ['Qwen3', 'Qwen2.5-Max', 'QwQ'],
                    mistral: ['Mistral Large', 'Codestral', 'Mistral Medium']
                };
                const existingNames = new Set(G.models.map(m => m.name.toLowerCase()));
                const missingFlagships = [];
                Object.entries(flagshipExpectations).forEach(([lab, models]) => {
                    models.forEach(name => {
                        // Check if any existing model name contains the flagship name
                        const found = [...existingNames].some(e => e.includes(name.toLowerCase().split(' ')[0]) && e.includes(name.toLowerCase().split(' ').pop()));
                        if (!found) missingFlagships.push(`${name} (${lab})`);
                    });
                });
                const flagshipGap = missingFlagships.slice(0, 12).join(', ');

                // ─── GAP ANALYSIS: Tell the AI which major labs are thin ───
                const majorLabs = ['openai', 'anthropic', 'google', 'meta', 'xai', 'microsoft', 'deepseek', 'alibaba', 'mistral', 'apple', 'amazon', 'nvidia', 'cohere'];
                const labCounts = {};
                majorLabs.forEach(l => { labCounts[l] = G.models.filter(m => m.lab === l).length; });
                const underrepresented = majorLabs.filter(l => labCounts[l] < 4).map(l => `${l}(${labCounts[l]})`).join(', ');

                // ─── FOUNDER GAP: Which labs have no CEO/founder tracked? ───
                const allLabsWithModels = [...new Set(G.models.map(m => m.lab))];
                const founderLabs = new Set((typeof REAL_FOUNDERS !== 'undefined' ? REAL_FOUNDERS : []).map(f => f.lab));
                const labsMissingFounder = allLabsWithModels.filter(l => l !== 'other' && !founderLabs.has(l));
                const founderGap = labsMissingFounder.join(', ');

                // Send ALL existing model names for proper deduplication
                const allModelNames = G.models.map(m => m.name).join(', ');
                const existingLabs = Object.keys(LABS).join(', ');
                
                const prompt = `This is an analytical data request. Find exactly 4 REAL, existing AI models. Focus: ${focusCategory}.

⚠️ RECENCY IS THE #1 PRIORITY. We need the LATEST models from 2025-2026 FIRST. Older models can come later.

MISSING FLAGSHIPS — These specific cutting-edge models are NOT yet in our database and should be prioritized:
${flagshipGap || 'All major flagships tracked!'}

CONTEXT:
- Underrepresented labs needing priority: ${underrepresented || 'Good coverage'}
- Labs MISSING a founder/CEO: ${founderGap || 'All tracked'}
- EXISTING MODELS (do NOT duplicate): ${allModelNames}
- EXISTING LAB IDs: ${existingLabs}. Use exact lab IDs.

CRITICAL INSTRUCTIONS:
1. **FIND THE NEWEST MODELS FIRST.** If Claude Opus 4 or Grok 3 or Gemini 2.5 Pro is in the MISSING FLAGSHIPS list above, those MUST be returned before any older or niche models. The user needs cutting-edge models urgently.
2. Use the model's FULL official name (e.g. "Claude Opus 4", not just "Claude 4"; "Grok 3 Mini" not "Grok-mini").
3. For any lab in the "MISSING a founder/CEO" list, include "founder_name" (e.g. Dario Amodei for Anthropic, Sam Altman for OpenAI, Elon Musk for xAI).
4. Use 100% accurate, factual, real-world data. Do not hallucinate.
5. "phase": "released" for launched models, "rumored" ONLY for genuinely unconfirmed models.
6. Include accurate benchmarks, pricing (cost_input/cost_out per 1M tokens USD), and context window (ctx in tokens).
7. "released" date must be the actual public release date in YYYY-MM-DD format.

JSON (no markdown):
{"models":[{"id":"model_id","name":"Full Model Name","lab":"lab_id","region":"us","founder_name":"CEO Name or null","released":"2025-01-01","retired":null,"phase":"released","os":false,"desc":"Summary.","personality":"Helpful","talent":"Coding","favSpot":"Server Room","benchmarks":{"MMLU":90,"HumanEval":85,"MATH":75,"GPQA":55},"arch":{"params":"200B","type":"Dense","tokens":"15T","compute":"1e25 FLOPs"},"ctx":200000,"cost_input":3.0,"cost_out":15.0}],"retirements":[],"elo_updates":[],"events":[],"lineage_updates":[]}`;
                
                let url = '', hd = { 'Content-Type': 'application/json' }, pl = {};
                
                if (G.apiProvider === 'anthropic') {
                  url = 'https://api.anthropic.com/v1/messages';
                  hd['x-api-key'] = G.authKey;
                  hd['anthropic-version'] = '2023-06-01'; 
                  hd['anthropic-dangerously-allow-browser'] = 'true';
                  pl = { model: G.modelId || 'claude-3-5-sonnet-20240620', max_tokens: 8192, system: 'You are a real-time AI industry data API. Respond strictly in minified JSON format. No markdown. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API as of today is "released", NOT "rumored".', messages: [{ role: 'user', content: prompt }] };
                } else if (G.apiProvider === 'google') {
                  const targetModel = G.modelId || 'gemini-2.5-flash';
                  url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${G.authKey}`;
                  pl = { 
                      systemInstruction: { parts: [{ text: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only output real-world data. Do not truncate. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored".' }] }, 
                      contents: [{ parts: [{ text: prompt }] }], 
                      generationConfig: { temperature: 0.7, maxOutputTokens: 32768, responseMimeType: "application/json" }
                  };
                } else if (G.apiProvider === 'xai') {
                  url = 'https://api.x.ai/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { 
                      model: G.modelId || 'grok-3-latest', 
                      temperature: 0.7, 
                      max_tokens: 8192, 
                      messages: [
                          { role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. CRITICAL: Any model that is publicly available via API as of today MUST have phase "released", NOT "rumored". Grok 4 is released. Claude Opus 4 is released. GPT-4.1 is released. If you are unsure whether a model is released, default to "released" if it has been publicly announced with API access.' }, 
                          { role: 'user', content: prompt }
                      ] 
                  };
                } else {
                  url = 'https://api.openai.com/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { model: G.modelId || 'gpt-4o', temperature: 0.7, max_tokens: 8192, messages: [{ role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored".' }, { role: 'user', content: prompt }] };
                }
          
                console.log(`📡 [SCAN] Provider: ${G.apiProvider}, Model: ${G.modelId || 'default'}, Prompt chars: ${prompt.length}, Models in dedup list: ${G.models.length}`);
                const res = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(45000) });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`⛔ [SCAN] HTTP ${res.status} from ${G.apiProvider}`, errText);
                    console.error(`⛔ [SCAN] Request URL:`, url);
                    console.error(`⛔ [SCAN] Request payload:`, JSON.stringify(pl, null, 2));
                    throw new Error(`API returned HTTP ${res.status}: ${errText}`);
                }
                const data = await res.json();
                rawDataDump = data;
                console.log(`📡 [SCAN] Raw response from ${G.apiProvider}:`, data);

                if (G.apiProvider === 'google') {
                    if (data.promptFeedback && data.promptFeedback.blockReason) {
                        throw new Error(`Google blocked the prompt: ${data.promptFeedback.blockReason}`);
                    }
                    if (data.candidates && data.candidates[0]) {
                        const fr = data.candidates[0].finishReason;
                        if (fr && fr !== 'STOP' && fr !== 'MAX_TOKENS') {
                            throw new Error(`Google interrupted the stream. Reason: ${fr}`);
                        }
                        if (fr === 'MAX_TOKENS') {
                            console.warn(`⚠️ [SCAN] Google hit MAX_TOKENS (thinking model used too many reasoning tokens). Attempting to salvage partial response...`);
                        }
                    }
                }
          
                let txt = '';
                if (G.apiProvider === 'anthropic') txt = data.content?.[0]?.text || '';
                else if (G.apiProvider === 'google') txt = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
                else txt = data.choices?.[0]?.message?.content || '';
          
                if (!txt) {
                    throw new Error("API returned an empty text response. Check the Dev Console for the raw object dump.");
                }

                let cleanTxt = txt.replace(/```[a-zA-Z]*\n?/gi, '').replace(/```/g, '').trim();
                const firstBrace = cleanTxt.indexOf('{');
                const lastBrace = cleanTxt.lastIndexOf('}');
                
                if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
                    cleanTxt = cleanTxt.substring(firstBrace, lastBrace + 1);
                } else {
                    console.error("⛔ BRACKETS NOT FOUND. RAW TEXT:", txt);
                    throw new Error("No JSON brackets found in response.");
                }

                cleanTxt = cleanTxt.replace(/,\s*([\]}])/g, '$1');
                try {
                    parsedData = JSON.parse(cleanTxt);
                } catch (parseErr) {
                    // Salvage attempt: truncated JSON from MAX_TOKENS
                    // Find the last complete model object and close the structure
                    console.warn("⚠️ [SCAN] JSON parse failed, attempting salvage of truncated response...");
                    try {
                        // Find last complete object boundary in the models array
                        const modelsStart = cleanTxt.indexOf('"models"');
                        if (modelsStart !== -1) {
                            let lastCompleteObj = -1;
                            let depth = 0;
                            let inString = false;
                            let escape = false;
                            for (let ci = modelsStart; ci < cleanTxt.length; ci++) {
                                const ch = cleanTxt[ci];
                                if (escape) { escape = false; continue; }
                                if (ch === '\\') { escape = true; continue; }
                                if (ch === '"') { inString = !inString; continue; }
                                if (inString) continue;
                                if (ch === '{') depth++;
                                if (ch === '}') { depth--; if (depth === 1) lastCompleteObj = ci; }
                            }
                            if (lastCompleteObj > 0) {
                                const salvaged = cleanTxt.substring(0, lastCompleteObj + 1) + '],"retirements":[],"elo_updates":[],"events":[],"lineage_updates":[]}';
                                parsedData = JSON.parse(salvaged);
                                console.log(`✅ [SCAN] Salvaged ${parsedData.models?.length || 0} models from truncated response`);
                            } else {
                                throw parseErr;
                            }
                        } else {
                            throw parseErr;
                        }
                    } catch (salvageErr) {
                        console.error("⛔ JSON PARSE FAILED. CLEANED TEXT:", cleanTxt);
                        throw new Error("API syntax error despite brute force extraction.");
                    }
                }
                
                break;
            } catch (loopErr) {
                lastErr = loopErr.message;
                console.error(`⛔ [SCAN] Attempt ${attempt}/3 failed:`, loopErr.message);
                if (rawDataDump) console.error(`⛔ [SCAN] Raw response dump:`, rawDataDump);
                if (lastErr.includes('HTTP 401') || lastErr.includes('HTTP 403') || lastErr.includes('API returned HTTP 4')) {
                    throw loopErr;
                }
                
                if (attempt < 3) {
                    if(typeof UI !== 'undefined') UI.addLog(`⚠️ API hiccup. Retrying (${attempt}/3)...`);
                    await new Promise(res => setTimeout(res, 2000)); 
                }
            }
        }

        if (!parsedData) {
            if(typeof UI !== 'undefined') UI.addLog(`⛔ Failed: ${lastErr}`);
            console.error("⛔ FINAL RAW AI RESPONSE DUMP:", JSON.stringify(rawDataDump, null, 2));
            throw new Error(lastErr);
        }

        if(typeof UI !== 'undefined') UI.addLog(`📡 Got ${parsedData.models?.length || 0} models`);
        let nC = 0;
  
        if (parsedData.models) {
            for (const m of parsedData.models) {
                if (!m.name || !m.lab) continue;
                
                const safeId = m.id ? m.id.toLowerCase().replace(/[^a-z0-9]/g, '') : '';
                const safeName = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                let isDuplicate = false;
                for (const existing of G.models) {
                    const eId = existing.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                    const eName = existing.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    
                    if (safeId === eId || safeName === eName) {
                        isDuplicate = true;
                        break;
                    }
                }

                if (isDuplicate) {
                    console.log(`[Fact Checker] Caught duplicate model: ${m.name}. Checking for missing economic data to backfill...`);
                    let needsUpdate = false;
                    const target = G.models.find(mod => mod.id.toLowerCase().replace(/[^a-z0-9]/g, '') === safeId || mod.name.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                    
                    if (target) {
                        if ((!window.COSTS || !window.COSTS[target.id]) && m.cost_input != null && m.cost_out != null) {
                            if(!window.COSTS) window.COSTS = {};
                            window.COSTS[target.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                            target.cost_input = m.cost_input;
                            target.cost_out = m.cost_out;
                            needsUpdate = true;
                        }
                        if ((!window.CTX || !window.CTX[target.id]) && m.ctx != null) {
                            if(!window.CTX) window.CTX = {};
                            window.CTX[target.id] = parseInt(m.ctx);
                            target.ctx = m.ctx;
                            needsUpdate = true;
                        }
                        if (needsUpdate && this.supabase) {
                            this.supabase.from('models').update({ cost_input: m.cost_input, cost_out: m.cost_out, ctx: m.ctx }).eq('id', target.id).then(() => {
                                console.log(`[Data Backfill] Successfully updated economics for ${target.name} in cloud.`);
                                if(typeof UI !== 'undefined') UI.addToast(`📈 Backfilled economic data for ${target.name}!`);
                            });
                        }
                    }
                    continue;
                }
                
                if (m.benchmarks) {
                    if (!window.BM) window.BM = {};
                    window.BM[m.id] = {};
                    Object.keys(m.benchmarks).forEach(k => window.BM[m.id][k.toUpperCase()] = m.benchmarks[k]);
                }
                
                if (m.cost_input != null && m.cost_out != null) {
                    if (!window.COSTS) window.COSTS = {};
                    window.COSTS[m.id] = { input: parseFloat(m.cost_input), output: parseFloat(m.cost_out) };
                }
                if (m.ctx != null) {
                    if (!window.CTX) window.CTX = {};
                    window.CTX[m.id] = parseInt(m.ctx);
                }
                
                const nm = { 
                    id: m.id, name: m.name, lab: m.lab, rel: m.released, ret: m.retired || null, 
                    phase: m.phase || 'released', os: m.os || false, desc: m.desc || 'A new citizen!', 
                    per: m.personality || 'Fresh face', tal: m.talent || 'Being new', fav: m.favSpot || 'Town Square', 
                    _src: true, benchmarks: m.benchmarks, arch: m.arch,
                    ctx: m.ctx || null, cost_input: m.cost_input || 0, cost_out: m.cost_out || 0
                };
                
                // PASS REGION INTO ENGINE DYNAMICALLY
                nm.lab = G.ensureLabExists(nm.lab, m.region);

                if (m.founder_name && typeof REAL_FOUNDERS !== 'undefined') {
                    let existingFounder = REAL_FOUNDERS.find(f => f.lab === nm.lab);
                    if (!existingFounder) {
                        const labData = LABS[nm.lab] || LABS.other || { color: '#64748b' };
                        const newFounder = { 
                            name: m.founder_name, 
                            lab: nm.lab, 
                            role: "CEO / Lead Researcher",
                            color: labData.color,
                            fact: `Founder of ${labData.name || nm.lab}. Discovered via network scan.`
                        };
                        REAL_FOUNDERS.push(newFounder);
                        console.log(`[Founder Found] Mapped ${m.founder_name} to ${nm.lab}`);
                        
                        if (this.supabase) {
                            this.supabase.from('founders').upsert({
                                lab_id: nm.lab,
                                name: m.founder_name,
                                role: "CEO / Lead Researcher",
                                color: labData.color,
                                fact: newFounder.fact
                            }).then(({error}) => {
                                if (error) console.error(`[Founder] Save error for ${m.founder_name}:`, error);
                                else console.log(`[Founder] Saved ${m.founder_name} to cloud.`);
                            }).catch(err => console.error(`[Founder] Save failed:`, err));
                        }
                        
                        // ─── CREATE RUNTIME CEO ENTITIES ───
                        // Spawn car + helicopter for the new founder
                        if (typeof Entities !== 'undefined' && G.ceoRefs && !G.ceoRefs[nm.lab]) {
                            if (Entities.carLayer && Entities.reflectionLayer) {
                                const ceoObj = EntitiesGfx.initCEO(newFounder, Entities.carLayer, Entities.reflectionLayer);
                                const home = G.bldById['house_' + nm.lab];
                                if (home) {
                                    ceoObj.bld = home.id;
                                    ceoObj.logicalX = home.x + home.w / 2;
                                    ceoObj.carCont.visible = false;
                                    ceoObj.refCont.visible = false;
                                }
                                G.ceoRefs[nm.lab] = ceoObj;
                            }
                            
                            if (Entities.carLayer && !Entities.heliRefs[nm.lab]) {
                                const heli = EntitiesGfx.initHelicopter(newFounder, Entities.carLayer);
                                const home = G.bldById['house_' + nm.lab];
                                if (home) {
                                    heli.homeX = home.x + home.w / 2;
                                    heli.homeY = G.groundY - 80;
                                }
                                Entities.heliRefs[nm.lab] = heli;
                            }
                        }
                        
                        // ─── CREATE ESTATE IN BILLIONAIRE'S ROW ───
                        if (!BLDS.find(b => b.id === 'house_' + nm.lab)) {
                            const hash = Array.from(nm.lab).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                            const newW = 160 + (hash % 40);
                            
                            const newEstate = {
                                id: 'house_' + nm.lab, 
                                name: `${m.founder_name}'s Estate`, 
                                w: newW, x: 0, fl: 2, 
                                lab: nm.lab, 
                                desc: `The private residential estate of ${m.founder_name}.`
                            };
                            
                            BLDS.push(newEstate);
                            G.bldById[newEstate.id] = newEstate;
                            if (!G.bldsByLab[nm.lab]) G.bldsByLab[nm.lab] = [];
                            G.bldsByLab[nm.lab].push(newEstate);
                            
                            G.recalculateZoning();
                            
                            if (G.bldLayer && typeof Environment !== 'undefined') {
                                Environment.buildGround();
                                Environment.buildBuildings();
                            }
                            
                            // Update the CEO's home reference now that the estate exists
                            if (G.ceoRefs && G.ceoRefs[nm.lab]) {
                                const ceo = G.ceoRefs[nm.lab];
                                ceo.bld = newEstate.id;
                                ceo.logicalX = newEstate.x + newEstate.w / 2;
                                ceo.carCont.visible = false;
                                ceo.refCont.visible = false;
                            }
                            
                            if (typeof UI !== 'undefined') UI.addToast(`🏡 ${m.founder_name}'s Estate built in Billionaire's Row!`);
                        }
                        
                        if (typeof UI !== 'undefined') UI.addToast(`🧑‍💼 ${m.founder_name} (${labData.name}) has arrived in the city!`);
                    }
                }
                
                G.models.push(nm);
                if(typeof Entities !== 'undefined') Entities.createChar(nm); 
                nC++;
                
                if (this.supabase) {
                    try {
                        const { error } = await this.supabase.from('models').upsert(this._dbSafeModel(nm));
                        if (error) console.error("Supabase Save Error:", error);
                        else console.log(`Successfully synced ${nm.name} to cloud database.`);
                    } catch (dbErr) {
                        console.error("Cloud Sync Failed:", dbErr);
                    }
                }

                if(typeof SND !== 'undefined') SND.birth();
                G.dramaticLaunch(m.name);
                G.unlockAchieve('witnessed');
            }
        }
        
        if (parsedData.lineage_updates) {
            let famAdded = 0;
            parsedData.lineage_updates.forEach(lu => {
                if (!lu.lab || !lu.parent || !lu.child) return;
                
                const safeLab = lu.lab.toLowerCase().replace(/[^a-z0-9_]/g, '');
                const safeParent = lu.parent.toLowerCase().replace(/[^a-z0-9-]/g, '');
                const safeChild = lu.child.toLowerCase().replace(/[^a-z0-9-]/g, '');
                
                if (!window.FAMILIES) window.FAMILIES = {};
                if (!window.FAMILIES[safeLab]) window.FAMILIES[safeLab] = [];
                
                let parentEdge = window.FAMILIES[safeLab].find(e => e.id === safeParent);
                if (!parentEdge) {
                    parentEdge = { id: safeParent, children: [] };
                    window.FAMILIES[safeLab].push(parentEdge);
                }
                
                if (!parentEdge.children.includes(safeChild)) {
                    parentEdge.children.push(safeChild);
                    famAdded++;
                    
                    if (this.supabase) {
                        this.supabase.from('families').upsert({ lab: safeLab, edges: window.FAMILIES[safeLab] }).then(({error}) => {
                            if (!error) console.log(`[Lineage] Saved new family tree link for ${safeLab}`);
                        });
                    }
                }
            });
            if (famAdded > 0 && typeof UI !== 'undefined') { UI.addToast(`🧬 Mapped ${famAdded} new family tree connections!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Lineage Updated!', `🧬 ${famAdded} new model family connections mapped`); }
        }

        if (parsedData.events) {
            let addedEvents = 0;
            for (const ev of parsedData.events) {
                if (window.AI_EVENTS && !window.AI_EVENTS.find(e => e.date === ev.date && e.name === ev.name)) {
                    window.AI_EVENTS.push(ev);
                    addedEvents++;
                    if (this.supabase) {
                        this.supabase.from('ai_events').insert(ev).then(({error}) => {
                            if (!error) console.log(`[Calendar] Saved new event: ${ev.name}`);
                        });
                    }
                }
            }
            if (addedEvents > 0 && typeof UI !== 'undefined') { UI.addToast(`📅 Added ${addedEvents} new tech events to Calendar!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Events Added!', `📅 ${addedEvents} new tech events on the calendar`); }
        }

        if (parsedData.retirements) {
            parsedData.retirements.forEach(rt => {
                const safeName = rt.id.toLowerCase().replace(/[^a-z0-9]/g, '');
                const m = G.models.find(mod => mod.id.toLowerCase().replace(/[^a-z0-9]/g, '') === safeName);
                if (m && !m.ret) {
                    m.ret = rt.retired_date;
                    if(typeof SND !== 'undefined') SND.retire();
                    if(typeof UI !== 'undefined') UI.addToast(`👻 ${m.name} retired.`);
                }
            });
        }
        
        let ec = 0;
        if (parsedData.elo_updates) {
            parsedData.elo_updates.forEach(eu => {
                if (!eu.name || !eu.elo || eu.elo < 800 || eu.elo > 2000) return;
                
                const safeName = eu.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                
                const m = G.models.find(mod => {
                    const eName = mod.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                    return eName === safeName;
                });
                
                if (m) {
                    if (!window.BM) window.BM = {};
                    if (!window.BM[m.id]) window.BM[m.id] = {};
                    const old = window.BM[m.id].ELO;
                    window.BM[m.id].ELO = Math.round(eu.elo);
                    ec++;
                    if (old && Math.abs(old - eu.elo) > 20 && typeof UI !== 'undefined') {
                        UI.addToast(`📊 ${m.name} ELO: ${old} → ${Math.round(eu.elo)}`);
                    }
                }
            });
        }
  
        if (ec > 0 && typeof UI !== 'undefined') UI.addLog(`📡 Updated ELO for ${ec} models.`);
        if (typeof UI !== 'undefined') {
            UI.addLog(`✅ ${nC} new models.`);
            if (nC === 0) UI.addLog('ℹ️ City up to date!');
        }
  
        if (G.models.filter(m => m._src).length >= 10) G.unlockAchieve('ten_models');
        if (G.models.length >= 50) G.unlockAchieve('fifty_models');
        if (G.models.length >= 100) G.unlockAchieve('hundred_models');
        if (new Set(G.models.map(m => m.lab)).size >= 7) G.unlockAchieve('all_labs');
        
        G.save(); 
        G.evolveCity();
        
        await stockPromise;

      } catch(e) {
        console.error(`⛔ [SCAN] FATAL ERROR:`, e.message);
        console.error(`⛔ [SCAN] Provider: ${G.apiProvider}, Model: ${G.modelId}`);
        console.error(`⛔ [SCAN] Full error:`, e);
        if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError') || e.message.includes('CORS')) {
            if(typeof UI !== 'undefined') UI.addLog(`⚠️ Network/CORS error. Try switching API providers.`);
        } else {
            if(typeof UI !== 'undefined') UI.addLog(`❌ ${e.message}`);
        }
      }
    
      if (btn) {
          btn.classList.remove('scanning');
          btn.innerHTML = '🛰️ Scan';
      }
      this._scanning = false;
    },
    
    async syncBuildingPositions() {
        if (!this.supabase) return;
        try {
            const toSync = BLDS.filter(b => b.lab || ['cafe','gym','arena','open_square','park','graveyard','nursery','neon_bar','visitor_monument'].includes(b.id));
            const rows = toSync.map(b => ({ id: b.id, name: b.name, w: b.w, x: Math.round(b.x), fl: b.fl || 1, emoji: b.emoji || null, lab: b.lab || null, desc: b.desc || null }));
            if (rows.length > 0) {
                const { error } = await this.supabase.from('blds').upsert(rows, { onConflict: 'id' });
                if (!error) console.log(`🏗️ Synced ${rows.length} building positions to cloud`);
            }
        } catch (e) { /* silent */ }
    }
};

// ─── VISITOR COUNTER ───
const VisitorTracker = {
    uniqueVisitors: 0,
    totalVisits: 0,
    
    async init() {
        if (!API.supabase) { this._fallbackCount(); return; }
        try {
            // Get or create visitor ID
            let vid = localStorage.getItem('sc_visitor_id');
            if (!vid) {
                vid = 'v_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
                localStorage.setItem('sc_visitor_id', vid);
            }
            // Call RPC to record visit and get counts
            const { data, error } = await API.supabase.rpc('record_visit', { p_visitor_id: vid });
            if (data && data.length > 0) {
                this.uniqueVisitors = data[0].unique_visitors || 0;
                this.totalVisits = data[0].total_visits || 0;
            } else {
                this._fallbackCount();
            }
        } catch (e) {
            this._fallbackCount();
        }
        this._updateMonument();
    },
    
    async refresh() {
        if (!API.supabase) return;
        try {
            const { data } = await API.supabase.from('visitor_counter').select('*').eq('id', 'global').single();
            if (data) {
                this.uniqueVisitors = data.unique_visitors || 0;
                this.totalVisits = data.total_visits || 0;
                this._updateMonument();
            }
        } catch (e) { /* silent */ }
    },
    
    _fallbackCount() {
        // If Supabase not available, use localStorage session count
        let visits = parseInt(localStorage.getItem('sc_visits') || '0');
        visits++;
        localStorage.setItem('sc_visits', visits.toString());
        this.totalVisits = visits;
        this.uniqueVisitors = 1;
    },
    
    _updateMonument() {
        // Update the in-world monument text
        const mon = G.bldById && G.bldById['visitor_monument'];
        if (mon && mon._counterTxt) {
            mon._counterTxt.text = this.uniqueVisitors.toLocaleString();
        }
        if (mon && mon._visitsTxt) {
            mon._visitsTxt.text = this.totalVisits.toLocaleString() + ' visits';
        }
    }
};
