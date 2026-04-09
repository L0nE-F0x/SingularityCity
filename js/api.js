/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   API & SERVICES LAYER (v16.5.0 - Dynamic Region Parameter Passing)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */
const API = {
    liveNews: [],
    regulationNews: [],
    arxivPapers: [],
    vcDeals: [],
    supplyChainNews: [],
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
                
                // Build verification registry before processing cloud models
                if (!this._verifiedModelNames) this._buildVerifiedRegistry();
                const rejectIds = [];
                const rejectNames = [];

                data.forEach(m => {
                    // Verify cloud models too — purge hallucinated data from DB
                    const verification = this._verifyModel(m);
                    if (!verification.ok) {
                        rejectIds.push(m.id);
                        rejectNames.push(m.name);
                        return;
                    }

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
                // Batch-purge rejected models from Supabase (more reliable than individual fire-and-forget)
                if (rejectIds.length > 0) {
                    console.warn(`🚫 [Cloud] Rejected ${rejectIds.length} hallucinated models: ${rejectNames.join(', ')}`);
                    if (this.supabase) {
                        for (let i = 0; i < rejectIds.length; i += 50) {
                            const batch = rejectIds.slice(i, i + 50);
                            this.supabase.from('models').delete().in('id', batch).then(({error}) => {
                                if (error) console.warn(`⚠️ [Purge] DB delete failed (check Supabase RLS policy):`, error.message);
                            });
                        }
                    }
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
            const isDeployed = !['localhost','127.0.0.1'].includes(window.location.hostname);
            const url = isDeployed 
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

                if (typeof UI !== 'undefined') UI.addToast(`🤗 Hugging Face: ${added} new open-source models!`);
                if (typeof NOTIFY !== 'undefined') NOTIFY.send('Models Discovered!', `🤗 ${added} new open-source models from Hugging Face`);
                if (typeof UI !== 'undefined') UI.addLog(`🤗 HF API: ${added} trending models added`);
                G.evolveCity();
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
            const isDeployed = !['localhost','127.0.0.1'].includes(window.location.hostname);
            const url = isDeployed
                ? '/api/zeroeval/leaderboard/models/full?justCanonicals=true'
                : 'https://api.zeroeval.com/leaderboard/models/full?justCanonicals=true';
            const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
            if (!res.ok) { console.warn('[ZeroEval] HTTP', res.status); return; }
            const models = await res.json();
            if (!Array.isArray(models)) return;
            
            const existingNames = new Set(G.models.map(m => m.name.toLowerCase().replace(/[^a-z0-9]/g, '')));
            const _existingIds = new Set(G.models.map(m => m.id.toLowerCase().replace(/[^a-z0-9]/g, '')));
            
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

                if (typeof UI !== 'undefined') {
                    if (added > 0) { UI.addToast(`📊 ZeroEval: ${added} new models with real benchmarks!`); if (typeof NOTIFY !== 'undefined') NOTIFY.send('Benchmarks Updated!', `📊 ${added} new models with real benchmark scores`); }
                    UI.addLog(`📊 ZeroEval: +${added} models, ${benchUpdated} benchmark backfills`);
                }
                G.evolveCity();
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
          { headline: "OpenAI launches GPT-4.1 and o4-mini reasoning models", url: "https://openai.com", source: "Fallback" },
          { headline: "Claude Opus 4.6 leads SWE-bench coding benchmarks", url: "https://anthropic.com", source: "Fallback" },
          { headline: "Google Gemini 2.5 Pro tops multi-modal leaderboards", url: "https://deepmind.google", source: "Fallback" },
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
      const fabTickers = ['TSM', 'ASML', 'INTC']; // TSMC, ASML, Intel — public semiconductor companies
      const symbols = [...new Set([...Object.values(LABS).map(l => l.ticker).filter(Boolean), ...fabTickers])];
      
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
  
    // ═══ LIVE VC FUNDING — reads from Supabase vc_funding table ═══
    async fetchVCFunding() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('vc_funding').select('*');
            if (error || !data || data.length === 0) return;
            if (typeof VCRow !== 'undefined' && VCRow.FUNDING) {
                data.forEach(row => {
                    VCRow.FUNDING[row.lab_id] = {
                        total: row.total_m || VCRow.FUNDING[row.lab_id]?.total || 0,
                        valuation: row.valuation_m || VCRow.FUNDING[row.lab_id]?.valuation || 0,
                        rounds: row.rounds || VCRow.FUNDING[row.lab_id]?.rounds || ''
                    };
                });
                VCRow._buildTicker();

            }
        } catch (e) { console.warn('[VC Funding] Fetch failed:', e.message); }
    },

    // ═══ LIVE SUPPLY CHAIN — reads from Supabase supply_chain table ═══
    async fetchSupplyChain() {
        if (!this.supabase) return;
        try {
            const { data, error } = await this.supabase.from('supply_chain').select('*');
            if (error || !data || data.length === 0) return;
            if (typeof SUPPLY_CHAIN !== 'undefined') {
                const cats = { bottleneck: [], accelerator: [], foundry: [] };
                data.forEach(row => {
                    if (!row.data || typeof row.data !== 'object') return;
                    if (row.category === 'lithography' && row.data.name) {
                        SUPPLY_CHAIN.lithography = { asml_high_na: row.data };
                    } else if (row.category === 'bottleneck' && row.data.name && row.data.load != null) {
                        cats.bottleneck.push(row.data);
                    } else if (row.category === 'accelerator' && row.data.name) {
                        cats.accelerator.push(row.data);
                    } else if (row.category === 'foundry' && row.data.name) {
                        cats.foundry.push(row.data);
                    }
                });
                if (cats.bottleneck.length) SUPPLY_CHAIN.bottlenecks = cats.bottleneck;
                if (cats.accelerator.length) SUPPLY_CHAIN.accelerators = cats.accelerator;
                if (cats.foundry.length) SUPPLY_CHAIN.foundries = cats.foundry;

            }
        } catch (e) { console.warn('[Supply Chain] Fetch failed:', e.message); }
    },

    // ═══ REGULATION NEWS — filters live news for AI policy/regulation headlines ═══
    async fetchRegulationNews() {
        // Extract regulation-relevant items from the live news feed
        const regKeywords = /regulat|senate|congress|EU AI Act|compliance|safety|ban|lawsuit|copyright|FTC|antitrust|oversight|hearing|legislation|policy|GDPR|govern/i;
        const regItems = this.liveNews.filter(n => regKeywords.test(n.headline));
        if (regItems.length > 0) {
            this.regulationNews = regItems;

        }
        // Also try dedicated regulation RSS feed
        try {
            const r = await fetch('https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent('https://www.theverge.com/rss/ai-artificial-intelligence/index.xml'), { signal: AbortSignal.timeout(8000) });
            if (r.ok) {
                const d = await r.json();
                if (d.status === 'ok' && d.items?.length > 0) {
                    const regFiltered = d.items.filter(i => regKeywords.test(i.title));
                    regFiltered.forEach(i => {
                        if (!this.regulationNews.find(n => n.headline === i.title)) {
                            this.regulationNews.push({ headline: i.title, url: i.link, source: 'Regulation Feed' });
                        }
                    });
                }
            }
        } catch (e) { /* silent */ }
    },

    // ═══ ARXIV PAPERS — real CS/AI papers for conference poster sessions ═══
    async fetchArxivPapers() {
        const isDeployed = !['localhost', '127.0.0.1'].includes(window.location.hostname);
        const url = isDeployed
            ? '/api/arxiv/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20'
            : 'https://export.arxiv.org/api/query?search_query=cat:cs.AI+OR+cat:cs.LG+OR+cat:cs.CL&sortBy=submittedDate&sortOrder=descending&max_results=20';
        try {
            const r = await fetch(url, { signal: AbortSignal.timeout(12000) });
            if (!r.ok) return;
            const text = await r.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(text, 'text/xml');
            const entries = xml.querySelectorAll('entry');
            const papers = [];
            entries.forEach(e => {
                const title = e.querySelector('title')?.textContent?.trim().replace(/\s+/g, ' ');
                const id = e.querySelector('id')?.textContent?.split('/abs/').pop() || '';
                const published = e.querySelector('published')?.textContent?.split('T')[0] || '';
                if (title) papers.push({ title, id, published });
            });
            if (papers.length > 0) {
                this.arxivPapers = papers;

            }
        } catch (e) { console.warn('[arXiv] Fetch failed:', e.message); }
    },

    // ═══ LIVE VC DEALS — parses funding headlines from venture RSS feeds ═══
    async fetchVCDealsRSS() {
        const feeds = [
            { url: 'https://techcrunch.com/category/venture/feed/', source: 'TechCrunch' },
            { url: 'https://venturebeat.com/category/business/feed/', source: 'VentureBeat' },
        ];

        // 1. Load persisted deals from Supabase first
        if (this.supabase && this.vcDeals.length === 0) {
            try {
                const { data } = await this.supabase.from('vc_deals')
                    .select('*').order('created_at', { ascending: false }).limit(20);
                if (data?.length) {
                    this.vcDeals = data.map(d => ({
                        headline: d.headline, amount: d.amount, round: d.round,
                        url: d.url, source: d.source, date: d.pub_date
                    }));
                }
            } catch (e) { /* table may not exist yet */ }
        }

        // 2. Fetch fresh from RSS
        const amtPattern = /\$\s*([\d,.]+)\s*(M|B|million|billion|mn|bn)/i;
        const fundingVerbs = /\b(raises?|raised|secures?|secured|closes?|closed|lands?|landed|gets?|got|nabs?|nabbed|bags?|bagged|grabs?|grabbed|nets?|netted|funding)\b/i;
        const roundPattern = /\b(seed|pre-seed|series\s+[a-f])\b/i;

        const existingHeadlines = new Set(this.vcDeals.map(d => d.headline));

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                for (const item of d.items) {
                    if (!amtPattern.test(item.title) || !fundingVerbs.test(item.title)) continue;
                    if (existingHeadlines.has(item.title)) continue;

                    const amtMatch = item.title.match(amtPattern);
                    const rawNum = parseFloat(amtMatch[1].replace(/,/g, ''));
                    const unit = /^b/i.test(amtMatch[2]) ? 'B' : 'M';

                    const roundMatch = item.title.match(roundPattern);

                    const deal = {
                        headline: item.title,
                        amount: `$${rawNum}${unit}`,
                        round: roundMatch ? roundMatch[1] : '',
                        url: item.link,
                        source: feed.source,
                        date: item.pubDate?.split(' ')[0] || item.pubDate?.split('T')[0] || ''
                    };

                    this.vcDeals.unshift(deal);
                    existingHeadlines.add(item.title);

                    // Persist to Supabase (fire-and-forget)
                    if (this.supabase) {
                        this.supabase.from('vc_deals').insert({
                            headline: deal.headline,
                            amount: deal.amount,
                            round: deal.round || null,
                            url: deal.url,
                            source: deal.source,
                            pub_date: deal.date || null
                        }).then(() => {}).catch(() => {});
                    }
                }
            } catch (e) { console.warn(`[VC RSS] ${feed.source}:`, e.message); }
        }

        // Keep max 30 deals
        this.vcDeals = this.vcDeals.slice(0, 30);

        if (this.vcDeals.length > 0) {

            if (typeof VCRow !== 'undefined') VCRow._buildTicker();
        }
    },

    // ═══ LIVE SUPPLY CHAIN NEWS — semiconductor industry headlines from RSS ═══
    async fetchSupplyChainNews() {
        const feeds = [
            { url: 'https://www.tomshardware.com/feeds/all', source: "Tom's Hardware" },
            { url: 'https://wccftech.com/feed/', source: 'WCCFTech' },
        ];

        const chipKeywords = /\b(TSMC|Samsung.{0,12}(?:foundry|fab|chip|semiconductor)|Intel.{0,12}(?:foundry|fab|chip)|ASML|HBM\d?|CoWoS|EUV|DUV|semiconductor|chip.{0,8}(?:shortage|supply|demand)|wafer|foundry|lithograph|advanced\s+packaging|\dnm\b|GPU.{0,8}(?:supply|shortage|production)|Nvidia.{0,8}(?:supply|production|chip)|AMD.{0,8}(?:supply|chip)|DRAM|NAND|memory.{0,8}(?:shortage|supply)|Blackwell|Rubin|B200|B100|H100|H200|MI\d{3})\b/i;

        // 1. Load persisted from Supabase
        if (this.supabase && this.supplyChainNews.length === 0) {
            try {
                const { data } = await this.supabase.from('supply_chain')
                    .select('*').order('created_at', { ascending: false }).limit(20);
                if (data?.length) {
                    this.supplyChainNews = data.map(d => ({
                        headline: d.title, url: d.source_url,
                        source: d.detail, category: d.category,
                        date: d.created_at?.split('T')[0]
                    }));
                }
            } catch (e) { /* table may not exist yet */ }
        }

        // 2. Fetch fresh from RSS
        const existing = new Set(this.supplyChainNews.map(n => n.headline));

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                for (const item of d.items) {
                    if (!chipKeywords.test(item.title) || existing.has(item.title)) continue;

                    // Auto-categorize based on headline keywords
                    const cat = /ASML|EUV|DUV|lithograph/i.test(item.title) ? 'lithography'
                        : /foundry|TSMC|Samsung.{0,6}fab|Intel.{0,6}fab|wafer|node|nanometer|\dnm/i.test(item.title) ? 'foundry'
                        : /HBM|CoWoS|packaging|memory|DRAM|NAND|shortage/i.test(item.title) ? 'bottleneck'
                        : 'accelerator';

                    const entry = {
                        headline: item.title,
                        url: item.link,
                        source: feed.source,
                        category: cat,
                        date: item.pubDate?.split(' ')[0] || item.pubDate?.split('T')[0] || ''
                    };

                    this.supplyChainNews.unshift(entry);
                    existing.add(item.title);

                    // Persist to Supabase (fire-and-forget)
                    if (this.supabase) {
                        this.supabase.from('supply_chain').insert({
                            category: cat,
                            title: entry.headline.substring(0, 200),
                            detail: entry.source,
                            source_url: entry.url
                        }).then(() => {}).catch(() => {});
                    }
                }
            } catch (e) { console.warn(`[Supply Chain RSS] ${feed.source}:`, e.message); }
        }

        this.supplyChainNews = this.supplyChainNews.slice(0, 25);

        // supplyChainNews refreshed — UI picks up changes on next tick
    },

    // ═══ AI EVENTS CALENDAR — auto-populate from tech event RSS feeds ═══
    async fetchAIEvents() {
        const feeds = [
            { url: 'https://techcrunch.com/category/artificial-intelligence/feed/', source: 'TechCrunch' },
            { url: 'https://venturebeat.com/category/ai/feed/', source: 'VentureBeat' },
        ];

        // Keywords that indicate an event/conference/summit (not just news articles)
        const eventKeywords = /\b(conference|summit|workshop|hackathon|symposium|keynote|demo day|launch event|developer day|devday|I\/O|Build|WWDC|re:Invent|Ignite|Connect|NeurIPS|ICML|ICLR|CVPR|AAAI|SIGMOD|KDD|NAACL|ACL|EMNLP|CoRL|RSS\b|IJCAI|ECCV|ICCV|WSDM|GTC|Microsoft Build|Google I\/O|Apple WWDC|AWS re:Invent|Dreamforce|CES\s+\d{4}|MWC\s+\d{4})\b/i;

        const existing = new Set((window.AI_EVENTS || []).map(e => e.name));
        let added = 0;

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const json = await r.json();
                if (!json.items) continue;

                for (const item of json.items) {
                    if (!eventKeywords.test(item.title)) continue;
                    const name = item.title.replace(/<[^>]*>/g, '').trim();
                    if (existing.has(name) || name.length > 120) continue;

                    // Try to extract a date from the item
                    const pubDate = item.pubDate ? new Date(item.pubDate) : new Date();
                    // For event announcements, the event itself is usually in the future
                    // Use publication date as fallback — if it mentions a specific date in the title, prefer that
                    const dateMatch = item.title.match(/(\w+ \d{1,2}(?:[-–]\d{1,2})?,?\s*\d{4})/);
                    let eventDate = pubDate;
                    if (dateMatch) {
                        const parsed = new Date(dateMatch[1].replace(/[-–]\d{1,2}/, ''));
                        if (!isNaN(parsed.getTime())) eventDate = parsed;
                    }

                    const desc = (item.description || '').replace(/<[^>]*>/g, '').trim().slice(0, 140);
                    const ev = {
                        name,
                        date: eventDate.toISOString().split('T')[0],
                        desc: desc || `Via ${feed.source}`,
                        type: 'conference'
                    };

                    if (!window.AI_EVENTS) window.AI_EVENTS = [];
                    window.AI_EVENTS.push(ev);
                    existing.add(name);
                    added++;

                    // Persist to Supabase
                    if (this.supabase) {
                        this.supabase.from('ai_events').insert(ev).then(({ error }) => {
                            if (!error) { /* saved */ }
                        });
                    }
                }
            } catch (e) { /* silent — RSS feeds sometimes fail */ }
        }

        // Also use the LLM scan to ask for upcoming events if API key is set
        if (added === 0 && G.authKey && this._chatHistory !== undefined) {
            await this._fetchEventsFromLLM();
        }

        if (added > 0) {

            if (typeof UI !== 'undefined') UI.addToast(`📅 Found ${added} new AI events!`);
        }
    },

    async _fetchEventsFromLLM() {
        if (!G.authKey) return;
        try {
            const prompt = `List 15 major upcoming AI/ML conferences, summits, and tech events for the remainder of 2025 and early 2026. Include real events only with accurate dates. Return ONLY a JSON array, no other text. Format: [{"name":"Event Name","date":"YYYY-MM-DD","desc":"Short description","type":"conference"}]`;
            let url, hd = { 'Content-Type': 'application/json' }, pl;

            if (G.apiProvider === 'anthropic') {
                url = 'https://api.anthropic.com/v1/messages';
                hd['x-api-key'] = G.authKey; hd['anthropic-version'] = '2023-06-01'; hd['anthropic-dangerously-allow-browser'] = 'true';
                pl = { model: G.modelId || 'claude-sonnet-4-20250514', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            } else if (G.apiProvider === 'google') {
                url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || 'gemini-2.5-flash'}:generateContent?key=${G.authKey}`;
                pl = { contents: [{ parts: [{ text: prompt }] }], generationConfig: { maxOutputTokens: 2048 } };
            } else if (G.apiProvider === 'xai') {
                url = 'https://api.x.ai/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || 'grok-3-latest', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            } else {
                url = 'https://api.openai.com/v1/chat/completions';
                hd['Authorization'] = `Bearer ${G.authKey}`;
                pl = { model: G.modelId || 'gpt-4o', max_tokens: 2048, messages: [{ role: 'user', content: prompt }] };
            }

            const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl) });
            const d = await r.json();

            let txt = '';
            if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || '';
            else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || '';
            else txt = d.choices?.[0]?.message?.content || '';

            // Extract JSON array from response
            const match = txt.match(/\[[\s\S]*\]/);
            if (!match) return;
            const events = JSON.parse(match[0]);
            const existing = new Set((window.AI_EVENTS || []).map(e => e.name));
            let added = 0;

            for (const ev of events) {
                if (!ev.name || !ev.date || existing.has(ev.name)) continue;
                if (!window.AI_EVENTS) window.AI_EVENTS = [];
                window.AI_EVENTS.push(ev);
                existing.add(ev.name);
                added++;
                if (this.supabase) {
                    this.supabase.from('ai_events').insert(ev).then(() => {});
                }
            }

            if (added > 0) {

                if (typeof UI !== 'undefined') UI.addToast(`📅 Discovered ${added} upcoming AI events!`);
            }
        } catch (e) { console.warn('[Calendar LLM]', e.message); }
    },

    // ═══ NETWORK STATUS — cloud provider incidents + internet health for The Backbone ═══
    async fetchNetworkStatus() {
        const feeds = [
            { url: 'https://status.aws.amazon.com/rss/all.rss', source: 'AWS' },
            { url: 'https://status.cloud.google.com/feed.atom', source: 'Google Cloud' },
        ];

        const incidents = [];

        for (const feed of feeds) {
            try {
                const r = await fetch(`https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(feed.url)}`, { signal: AbortSignal.timeout(8000) });
                if (!r.ok) continue;
                const d = await r.json();
                if (d.status !== 'ok' || !d.items?.length) continue;

                d.items.slice(0, 5).forEach(item => {
                    const isMajor = /outage|degraded|disruption|emergency/i.test(item.title);
                    const isMinor = /elevated|latency|intermittent|delay/i.test(item.title);
                    incidents.push({
                        headline: `${feed.source}: ${item.title}`,
                        severity: isMajor ? 'major' : isMinor ? 'minor' : 'info',
                        url: item.link,
                        date: item.pubDate?.split(' ')[0] || ''
                    });
                });
            } catch (e) { /* silent — status feeds sometimes fail */ }
        }

        if (incidents.length > 0 && typeof BackboneZone !== 'undefined') {
            BackboneZone.cloudStatus = incidents;
            BackboneZone._buildTicker();

        }
    },

    // ═══ GLOBAL POWER GRID — Supabase (auto-refreshed weekly) + static fallback ═══
    _gridData: null,
    _gridTs: 0,

    async fetchGlobalGrid() {
        // Skip if already fetched this session (data changes slowly)
        if (this._gridData && (Date.now() - this._gridTs) < 6 * 3600 * 1000) return;



        // Try Supabase first (auto-refreshed weekly by scheduled function)
        try {
            const sbUrl = G.supabaseUrl;
            const sbKey = G.supabaseKey;
            if (sbUrl && sbKey) {
                const r = await fetch(
                    `${sbUrl}/rest/v1/grid_data?id=eq.global&select=data,updated_at`,
                    { headers: { 'apikey': sbKey }, signal: AbortSignal.timeout(8000) }
                );
                if (r.ok) {
                    const rows = await r.json();
                    if (rows.length > 0 && rows[0].data) {
                        this._gridData = rows[0].data;
                        this._gridData._updatedAt = rows[0].updated_at;
                        this._gridTs = Date.now();

                        if (typeof UI !== 'undefined') UI.addLog(`⚡ Grid: ${this._gridData.plantCount.toLocaleString()} plants across ${this._gridData.regionsScanned} regions (live data)`);
                        return;
                    }
                }
            }
        } catch (_e) { /* fall through to static */ }

        // Fallback: static bundled dataset
        try {
            const r = await fetch('/data/global-grid.json', { signal: AbortSignal.timeout(10000) });
            if (!r.ok) throw new Error('http-' + r.status);
            this._gridData = await r.json();
            this._gridTs = Date.now();

            if (typeof UI !== 'undefined') UI.addLog(`⚡ Grid: ${this._gridData.plantCount.toLocaleString()} power plants across ${this._gridData.regionsScanned} regions`);
        } catch (e) {
            console.debug('⚡ Grid data load failed:', e.message);
        }
    },

    _chatHistory: [],

    _mdToHtml(md) {
        return md
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre style="background:rgba(0,0,0,0.4);padding:8px;border-radius:4px;overflow-x:auto;font-size:8px;margin:6px 0;border:1px solid var(--bd)"><code>$2</code></pre>')
            .replace(/`([^`]+)`/g, '<code style="background:rgba(0,0,0,0.3);padding:1px 4px;border-radius:3px;font-size:8px">$1</code>')
            .replace(/\*\*(.+?)\*\*/g, '<b>$1</b>')
            .replace(/\*(.+?)\*/g, '<i>$1</i>')
            .replace(/^### (.+)$/gm, '<div style="font-size:10px;font-weight:bold;color:var(--ac);margin:8px 0 4px">$1</div>')
            .replace(/^## (.+)$/gm, '<div style="font-size:11px;font-weight:bold;color:var(--cy);margin:8px 0 4px">$1</div>')
            .replace(/^# (.+)$/gm, '<div style="font-size:12px;font-weight:bold;color:#fff;margin:8px 0 4px">$1</div>')
            .replace(/^[-*] (.+)$/gm, '<div style="padding-left:12px">• $1</div>')
            .replace(/^\d+\. (.+)$/gm, '<div style="padding-left:12px">$&</div>')
            .replace(/\n{2,}/g, '<br><br>')
            .replace(/\n/g, '<br>');
    },

    async askAnalyst() {
      const input = document.getElementById('analystInput');
      if (!input) return;
      const q = input.value.trim();
      if (!q) return;
      if (!G.authKey) { if(typeof UI !== 'undefined') UI.addToast('❌ Set API key in Settings first.'); return; }

      const safeQ = q.replace(/</g, '&lt;').replace(/>/g, '&gt;');
      const chat = document.getElementById('analystChat');
      if (!chat) return;

      // Clear welcome message on first use
      if (this._chatHistory.length === 0) chat.innerHTML = '';

      chat.innerHTML += `<div style="text-align:right;margin-bottom:10px"><span style="background:var(--ac);color:#000;padding:6px 12px;border-radius:12px 12px 2px 12px;font-size:9px;display:inline-block;max-width:80%;line-height:1.5">${safeQ}</span></div>`;
      chat.innerHTML += `<div id="aL" style="font-size:9px;color:var(--cy);padding:8px">Thinking...</div>`;
      input.value = '';
      chat.scrollTop = chat.scrollHeight;

      // Add to conversation history
      this._chatHistory.push({ role: 'user', content: q });

      // System prompt with live city context
      const sysPrompt = `You are a helpful AI assistant embedded in Singularity City — a real-time simulation of the AI industry. You can answer any question the user asks, on any topic. You have access to some live city data for context but you are not limited to discussing it. Be conversational and helpful. Current city data: ${G.models ? G.models.length : 0} AI models tracked across ${Object.keys(LABS || {}).length} labs.`;

      try {
        let url, hd = { 'Content-Type': 'application/json' }, pl;

        if (G.apiProvider === 'anthropic') {
          url = 'https://api.anthropic.com/v1/messages';
          hd['x-api-key'] = G.authKey;
          hd['anthropic-version'] = '2023-06-01';
          hd['anthropic-dangerously-allow-browser'] = 'true';
          pl = { model: G.modelId || 'claude-sonnet-4-20250514', max_tokens: 4096, system: sysPrompt, messages: this._chatHistory };
        } else if (G.apiProvider === 'google') {
          url = `https://generativelanguage.googleapis.com/v1beta/models/${G.modelId || 'gemini-2.5-flash'}:generateContent?key=${G.authKey}`;
          const contents = this._chatHistory.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
          pl = { systemInstruction: { parts: [{ text: sysPrompt }] }, contents, generationConfig: { maxOutputTokens: 4096 } };
        } else if (G.apiProvider === 'xai') {
          url = 'https://api.x.ai/v1/chat/completions';
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || 'grok-3-latest', max_tokens: 4096, messages: [{ role: 'system', content: sysPrompt }, ...this._chatHistory] };
        } else {
          url = 'https://api.openai.com/v1/chat/completions';
          hd['Authorization'] = `Bearer ${G.authKey}`;
          pl = { model: G.modelId || 'gpt-4o', max_tokens: 4096, messages: [{ role: 'system', content: sysPrompt }, ...this._chatHistory] };
        }

        const r = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl) });
        const d = await r.json();

        let txt = '';
        if (G.apiProvider === 'anthropic') txt = d.content?.[0]?.text || d.error?.message || 'No response';
        else if (G.apiProvider === 'google') txt = d.candidates?.[0]?.content?.parts?.[0]?.text || d.error?.message || 'No response';
        else txt = d.choices?.[0]?.message?.content || d.error?.message || 'No response';

        // Add assistant response to history
        this._chatHistory.push({ role: 'assistant', content: txt });

        const rendered = this._mdToHtml(txt);
        document.getElementById('aL')?.remove();
        chat.innerHTML += `<div style="margin-bottom:10px"><div style="background:var(--sf);border:1px solid var(--bd);padding:10px 14px;border-radius:2px 12px 12px 12px;font-size:9px;display:inline-block;color:var(--t2);line-height:1.7;max-width:90%">${rendered}</div></div>`;
        chat.scrollTop = chat.scrollHeight;
      } catch(e) {
        // Remove failed message from history
        this._chatHistory.pop();
        const l = document.getElementById('aL');
        if (l) l.innerHTML = `<span style="color:#ef4444">❌ ${e.message.includes('Failed to fetch') ? 'Network error — check your connection and try again.' : e.message}</span>`;
      }
    },
  
    // ═══════════════════════════════════════════════════════════════
    //   MODEL VERIFICATION — Reject hallucinated/impossible models
    // ═══════════════════════════════════════════════════════════════

    // Known maximum version numbers per model family (update as new models release)
    _maxKnownVersions: {
        'gemini': 3.1, 'gpt': 4.1, 'claude': 4.6, 'llama': 4, 'grok': 4,
        'phi': 4, 'mistral': 3, 'deepseek': 3, 'qwen': 3, 'palm': 2,
        'bard': 1, 'ernie': 5, 'glm': 5, 'command': 2, 'nova': 2,
        'nemotron': 4, 'codestral': 1
    },

    _verifyModel(m) {
        // Returns { ok: true } or { ok: false, reason: "..." }
        if (!m.name || !m.lab) return { ok: false, reason: 'Missing name or lab' };

        const name = m.name.toLowerCase();
        const today = new Date().toISOString().split('T')[0];
        const relDate = m.released || m.rel; // Handle both DB and local formats

        // 1. Reject future release dates
        if (relDate && relDate > today) {
            return { ok: false, reason: `Future release date: ${relDate}` };
        }

        // 2. Reject impossibly old release dates for new models
        if (relDate && relDate < '2017-01-01') {
            return { ok: false, reason: `Implausibly old release date: ${relDate}` };
        }

        // 3. Check version numbers against known maximums
        for (const [family, maxVer] of Object.entries(this._maxKnownVersions)) {
            // Match version patterns like "gemini 3", "gpt-4.1", "claude 4" etc.
            // Capture the number AND one trailing letter to detect param counts (e.g., "7B")
            const verMatch = name.match(new RegExp(`${family}[\\s\\-_]*([\\d]+(?:\\.[\\d]+)?)\\s*([a-z]?)`, 'i'));
            if (verMatch) {
                const ver = parseFloat(verMatch[1]);
                const suffix = (verMatch[2] || '').toLowerCase();
                // Skip parameter counts: numbers followed by 'b' (e.g., "7B", "70B", "13B")
                // These are model sizes in billions of parameters, not version numbers
                if (suffix === 'b') continue;
                // Skip date codes: 3+ digit numbers like 2501 (Jan 2025) or 2025 are release dates, not versions
                if (ver >= 100) continue;
                // Allow up to maxVer + 1 for genuinely rumored next-gen, reject anything beyond
                if (ver > maxVer + 1) {
                    return { ok: false, reason: `Version ${ver} exceeds max known ${family} version ${maxVer}` };
                }
            }
        }

        // 4. Reject benchmark scores that are impossible (>100 for percentage-based)
        if (m.benchmarks) {
            for (const [k, v] of Object.entries(m.benchmarks)) {
                if (k !== 'ELO' && (v > 100 || v < 0)) {
                    return { ok: false, reason: `Impossible benchmark ${k}=${v}` };
                }
                if (k === 'ELO' && (v < 500 || v > 2500)) {
                    return { ok: false, reason: `Impossible ELO=${v}` };
                }
            }
        }

        // 5. Reject absurd pricing (>$1000 per 1M tokens)
        if (m.cost_input != null && m.cost_input > 1000) {
            return { ok: false, reason: `Absurd input pricing: $${m.cost_input}/1M` };
        }
        if (m.cost_out != null && m.cost_out > 1000) {
            return { ok: false, reason: `Absurd output pricing: $${m.cost_out}/1M` };
        }

        // 6. Cross-reference against verified sources if available
        // Models from ZeroEval/HuggingFace are trusted; LLM-sourced models get extra scrutiny
        if (this._verifiedModelNames && this._verifiedModelNames.size > 0) {
            const normName = name.replace(/[^a-z0-9]/g, '');
            const fuzzyName = normName.replace(/\d{6,}/g, '').replace(/\d+$/, '');
            const isVerified = this._verifiedModelNames.has(normName) || this._verifiedModelNames.has(fuzzyName);
            // Not being verified is not an automatic rejection, but flag it
            if (!isVerified) {
                console.debug(`⚠️ [Verify] ${m.name} not found in ZeroEval/HuggingFace registry — allowing with caution`);
            }
        }

        return { ok: true };
    },

    // Build verified model registry from ZeroEval and HuggingFace data
    _buildVerifiedRegistry() {
        this._verifiedModelNames = new Set();
        // Add all models already in G.models that came from trusted sources
        for (const m of G.models) {
            if (m._src === 'zeroeval' || m._src === 'huggingface') {
                const norm = m.name.toLowerCase().replace(/[^a-z0-9]/g, '');
                this._verifiedModelNames.add(norm);
            }
        }
        // Also add all flagship models we know are real
        const knownReal = [
            'claude opus 4', 'claude opus 4.6', 'claude sonnet 4', 'claude sonnet 4.6',
            'claude haiku 4', 'claude haiku 4.5',
            'claude 3.5 sonnet', 'claude 3.5 haiku', 'claude 3 opus',
            'gpt-4o', 'gpt-4o mini', 'gpt-4.1', 'gpt-4.1 mini', 'gpt-4.1 nano',
            'o1', 'o1-mini', 'o1-pro', 'o3', 'o3-mini', 'o4-mini',
            'gemini 2.5 pro', 'gemini 2.5 flash', 'gemini 2.0 flash',
            'gemini 1.5 pro', 'gemini 1.5 flash',
            'grok 3', 'grok 3 mini', 'grok 4',
            'llama 4 scout', 'llama 4 maverick', 'llama 3.3', 'llama 3.1',
            'deepseek-r1', 'deepseek-v3', 'deepseek-r2',
            'qwen3', 'qwen2.5', 'qwen2.5-max', 'qwq',
            'phi-4', 'phi-4-mini', 'phi-3',
            'mistral large', 'mistral medium', 'codestral',
            'command r+', 'command r', 'command a',
            'nova pro', 'nova premier', 'nova lite',
            'nemotron ultra', 'llama-3.1-nemotron-ultra',
            'nemotron-4 340b', 'nemotron-4 340b instruct', 'nemotron-4 15b',
            'nemotron-4-mini-4b-instruct', 'codestral 2501',
            'yi-lightning', 'ernie 4.5', 'glm-4'
        ];
        for (const name of knownReal) {
            this._verifiedModelNames.add(name.toLowerCase().replace(/[^a-z0-9]/g, ''));
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

      // Build verified model registry for cross-referencing scan results
      this._buildVerifiedRegistry();
      
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
                    anthropic: ['Claude Opus 4.6', 'Claude Sonnet 4.6', 'Claude Opus 4', 'Claude Sonnet 4', 'Claude Haiku 4.5'],
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

                // Send existing model names for deduplication (compact: id-based for large lists)
                const allModelNames = G.models.length > 400
                    ? G.models.map(m => m.id).join(',')
                    : G.models.map(m => m.name).join(', ');
                const existingLabs = Object.keys(LABS).join(', ');
                
                const prompt = `This is an analytical data request. Find exactly 4 REAL, existing AI models. Focus: ${focusCategory}.

⚠️ RECENCY IS THE #1 PRIORITY. We need the LATEST models from 2025-2026 FIRST. Older models can come later.
⚠️ TODAY IS ${new Date().toISOString().split('T')[0]}. Do NOT return any model with a release date AFTER today.

MISSING FLAGSHIPS — These specific cutting-edge models are NOT yet in our database and should be prioritized:
${flagshipGap || 'All major flagships tracked!'}

CONTEXT:
- Underrepresented labs needing priority: ${underrepresented || 'Good coverage'}
- Labs MISSING a founder/CEO: ${founderGap || 'All tracked'}
- EXISTING MODELS (do NOT duplicate): ${allModelNames}
- EXISTING LAB IDs: ${existingLabs}. Use exact lab IDs.

CRITICAL ACCURACY RULES — VIOLATIONS WILL CORRUPT A PUBLIC DATABASE:
1. ONLY return models that have been OFFICIALLY ANNOUNCED by the lab with a public blog post, API endpoint, or press release.
2. Do NOT invent, extrapolate, or speculate about future model versions. For example:
   - If the latest known Gemini is 2.5, do NOT return "Gemini 4", "Gemini 5", "Gemini 8 Ultra", etc.
   - If the latest known GPT is 4.1, do NOT return "GPT-6", "GPT-7", etc.
   - If the latest known Claude is Opus 4.6, do NOT return "Claude 6", "Claude 7", etc.
   - If the latest known Llama is 4, do NOT return "Llama 6", "Llama 7", etc.
3. Version numbers must match real, publicly documented versions. If unsure, SKIP that model entirely.
4. Release dates must be real dates when the model became publicly available. If unsure, use null.
5. Benchmarks must be from official papers or leaderboards (e.g. LMSYS, ZeroEval). If unsure, omit the benchmark.
6. "phase": "released" for launched models, "rumored" ONLY for models officially teased/leaked by the lab itself.
7. Use the model's FULL official name (e.g. "Claude Opus 4", not just "Claude 4"; "Grok 3 Mini" not "Grok-mini").
8. For any lab in the "MISSING a founder/CEO" list, include "founder_name" (e.g. Dario Amodei for Anthropic, Sam Altman for OpenAI, Elon Musk for xAI).
9. Include accurate pricing (cost_input/cost_out per 1M tokens USD) and context window (ctx in tokens).
10. If you are not 100% certain a model exists, DO NOT include it. Return fewer than 4 models if needed.

JSON (no markdown):
{"models":[{"id":"model_id","name":"Full Model Name","lab":"lab_id","region":"us","founder_name":"CEO Name or null","released":"2025-01-01","retired":null,"phase":"released","os":false,"desc":"Summary.","personality":"Helpful","talent":"Coding","favSpot":"Server Room","benchmarks":{"MMLU":90,"HumanEval":85,"MATH":75,"GPQA":55},"arch":{"params":"200B","type":"Dense","tokens":"15T","compute":"1e25 FLOPs"},"ctx":200000,"cost_input":3.0,"cost_out":15.0}],"retirements":[],"elo_updates":[],"events":[],"lineage_updates":[]}`;
                
                let url = '', hd = { 'Content-Type': 'application/json' }, pl = {};
                
                if (G.apiProvider === 'anthropic') {
                  url = 'https://api.anthropic.com/v1/messages';
                  hd['x-api-key'] = G.authKey;
                  hd['anthropic-version'] = '2023-06-01'; 
                  hd['anthropic-dangerously-allow-browser'] = 'true';
                  pl = { model: G.modelId || 'claude-3-5-sonnet-20240620', max_tokens: 8192, system: 'You are a real-time AI industry data API. Respond strictly in minified JSON format. No markdown. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API as of today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.', messages: [{ role: 'user', content: prompt }] };
                } else if (G.apiProvider === 'google') {
                  const targetModel = G.modelId || 'gemini-2.5-flash';
                  url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModel}:generateContent?key=${G.authKey}`;
                  pl = { 
                      systemInstruction: { parts: [{ text: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only output real-world data. Do not truncate. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' }] },
                      contents: [{ parts: [{ text: prompt }] }], 
                      generationConfig: { temperature: 0.1, maxOutputTokens: 32768, responseMimeType: "application/json" }
                  };
                } else if (G.apiProvider === 'xai') {
                  url = 'https://api.x.ai/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { 
                      model: G.modelId || 'grok-3-latest',
                      temperature: 0.1,
                      max_tokens: 8192,
                      messages: [
                          { role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real, verified data. Today is ' + new Date().toISOString().split('T')[0] + '. CRITICAL: Any model that is publicly available via API as of today MUST have phase "released", NOT "rumored". Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' },
                          { role: 'user', content: prompt }
                      ] 
                  };
                } else {
                  url = 'https://api.openai.com/v1/chat/completions';
                  hd['Authorization'] = `Bearer ${G.authKey}`;
                  pl = { model: G.modelId || 'gpt-4o', temperature: 0.1, max_tokens: 8192, messages: [{ role: 'system', content: 'You are a real-time AI industry data API. Respond strictly in valid JSON format. Only use real data. Today is ' + new Date().toISOString().split('T')[0] + '. Any model publicly available via API today is "released", NOT "rumored". CRITICAL: Do NOT invent future model versions that do not exist yet. Only return models you are certain have been publicly released or officially announced. If unsure, omit the model.' }, { role: 'user', content: prompt }] };
                }
          

                const res = await fetch(url, { method: 'POST', headers: hd, body: JSON.stringify(pl), signal: AbortSignal.timeout(120000) });
                if (!res.ok) {
                    const errText = await res.text();
                    console.error(`⛔ [SCAN] HTTP ${res.status} from ${G.apiProvider}`, errText);
                    console.error(`⛔ [SCAN] Request URL:`, url);
                    console.error(`⛔ [SCAN] Request payload:`, JSON.stringify(pl, null, 2));
                    throw new Error(`API returned HTTP ${res.status}: ${errText}`);
                }
                const data = await res.json();
                rawDataDump = data;


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

                                if(typeof UI !== 'undefined') UI.addToast(`📈 Backfilled economic data for ${target.name}!`);
                            });
                        }
                    }
                    continue;
                }

                // ─── VERIFICATION GATE: Reject hallucinated/impossible models ───
                const verification = this._verifyModel(m);
                if (!verification.ok) {
                    console.warn(`🚫 [Verify] REJECTED "${m.name}": ${verification.reason}`);
                    if (typeof UI !== 'undefined') UI.addLog(`🚫 Rejected "${m.name}": ${verification.reason}`);
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
                    _src: 'llm_scan', benchmarks: m.benchmarks, arch: m.arch,
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

                        
                        if (this.supabase) {
                            // Only save founder if lab exists in DB (avoids FK violation)
                            this.supabase.from('labs').select('id').eq('id', nm.lab).maybeSingle().then(({data: labRow}) => {
                                if (!labRow) return; // Lab not in DB yet — skip silently
                                return this.supabase.from('founders').upsert({
                                    lab_id: nm.lab,
                                    name: m.founder_name,
                                    role: "CEO / Lead Researcher",
                                    color: labData.color,
                                    fact: newFounder.fact
                                }, { onConflict: 'lab_id', ignoreDuplicates: true }).then(({error}) => {
                                    if (error) console.error(`[Founder] Save error for ${m.founder_name}:`, error);
                                });
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
                            if (!error) { /* saved */ }
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
                            if (!error) { /* saved */ }
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

        // ─── LIVE DATA REFRESH: Piggyback on scan to update all live feeds ───
        Promise.allSettled([
            this.fetchVCFunding(),
            this.fetchSupplyChain(),
            this.fetchRegulationNews(),
            this.fetchArxivPapers(),
            this.fetchAIEvents()
        ]);

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
    
    // ═══════════════════════════════════════════════════════════════
    //   DATABASE PURGE — Remove hallucinated models from Supabase
    //   Call via console: API.purgeHallucinations()
    // ═══════════════════════════════════════════════════════════════

    async purgeHallucinations() {
        if (!this.supabase) { console.error('No Supabase connection'); return; }
        if (!this._verifiedModelNames) this._buildVerifiedRegistry();


        if (typeof UI !== 'undefined') UI.addLog('🧹 Scanning for hallucinated data...');

        try {
            const { data, error } = await this.supabase.from('models').select('id, name, lab, rel, phase, benchmarks, cost_input, cost_out');
            if (error) throw error;
            if (!data) return;

            let purged = 0;
            const toDelete = [];

            for (const m of data) {
                const result = this._verifyModel(m);
                if (!result.ok) {

                    toDelete.push(m.id);
                    purged++;
                }
            }

            if (toDelete.length > 0) {
                // Delete in batches of 50
                for (let i = 0; i < toDelete.length; i += 50) {
                    const batch = toDelete.slice(i, i + 50);
                    const { error: delErr } = await this.supabase.from('models').delete().in('id', batch);
                    if (delErr) console.error(`[Purge] Batch delete error:`, delErr);
                }
            }

            // Also purge from local G.models
            const localBefore = G.models.length;
            G.models = G.models.filter(m => {
                const result = this._verifyModel(m);
                if (!result.ok) {

                    // Remove character sprite
                    if (typeof Entities !== 'undefined' && G.charRefs && G.charRefs[m.id]) {
                        const refs = G.charRefs[m.id];
                        if (refs.c && refs.c.parent) refs.c.parent.removeChild(refs.c);
                        delete G.charRefs[m.id];
                    }
                    return false;
                }
                return true;
            });
            const localPurged = localBefore - G.models.length;


            if (typeof UI !== 'undefined') UI.addLog(`🧹 Purged ${purged} hallucinated models from cloud, ${localPurged} from local`);
            if (typeof UI !== 'undefined') UI.addToast(`🧹 Cleaned ${purged + localPurged} hallucinated models!`);

            G.save();
            G.evolveCity();
        } catch (e) {
            console.error('🧹 [Purge] Error:', e);
        }
    },

    async syncBuildingPositions() {
        if (!this.supabase) return;
        try {
            const toSync = BLDS.filter(b => b.lab || ['cafe','gym','arena','open_square','park','graveyard','neon_bar','visitor_monument','city_park'].includes(b.id));
            const rows = toSync.map(b => ({ id: b.id, name: b.name, w: b.w, x: Math.round(b.x), fl: b.fl || 1, emoji: b.emoji || null, lab: b.lab || null, desc: b.desc || null }));
            if (rows.length > 0) {
                const { error } = await this.supabase.from('blds').upsert(rows, { onConflict: 'id' });
                if (!error) { /* synced */ }
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
            const { data, error: _visitErr } = await API.supabase.rpc('record_visit', { p_visitor_id: vid });
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
