/* ════════════════════════════════════════════════════════════════════════════
   DATA CENTER & CHIP FAB ZONE DATA (v1.0)
   Real-world compute infrastructure data for Singularity City
   ════════════════════════════════════════════════════════════════════════════ */

const DC_FACILITIES = [
    // ─── OPERATIONAL DATA CENTERS ───
    {
        id: 'dc_google_dalles', name: 'Google (The Dalles)', operator: 'google',
        location: 'The Dalles, Oregon', type: 'datacenter', status: 'operational',
        gpus: '~50,000 TPU v5p', power_mw: 600, cooling: 'River water cooling',
        desc: 'One of Google\'s largest AI training clusters. TPU v5p pods power Gemini training runs.',
        w: 180, color: '#4285f4'
    },
    {
        id: 'dc_msft_quincy', name: 'Azure (Quincy)', operator: 'microsoft',
        location: 'Quincy, Washington', type: 'datacenter', status: 'operational',
        gpus: '~30,000 H100', power_mw: 400, cooling: 'Air + evaporative',
        desc: 'Microsoft Azure\'s Pacific NW hub. Hosts GPT-4/4.1 inference and Azure OpenAI Service.',
        w: 160, color: '#00a4ef'
    },
    {
        id: 'dc_aws_virginia', name: 'AWS (N. Virginia)', operator: 'amazon',
        location: 'Ashburn, Virginia', type: 'datacenter', status: 'operational',
        gpus: '~40,000 Trainium2', power_mw: 500, cooling: 'Chilled water',
        desc: 'The world\'s largest cloud region. Powers Bedrock, SageMaker, and Anthropic\'s Claude via AWS.',
        w: 200, color: '#ff9900'
    },
    {
        id: 'dc_meta_prineville', name: 'Meta (Prineville)', operator: 'meta',
        location: 'Prineville, Oregon', type: 'datacenter', status: 'operational',
        gpus: '~35,000 H100', power_mw: 450, cooling: 'Outside air + evaporative',
        desc: 'Meta\'s flagship AI campus. Houses the Grand Teton GPU cluster for Llama model training.',
        w: 170, color: '#0668e1'
    },
    {
        id: 'dc_xai_memphis', name: 'xAI Colossus', operator: 'xai',
        location: 'Memphis, Tennessee', type: 'datacenter', status: 'operational',
        gpus: '100,000 H100', power_mw: 150, cooling: 'Direct liquid cooling',
        desc: 'The world\'s largest single AI training cluster. 100K H100s in a single fabric for Grok training.',
        w: 190, color: '#1d9bf0'
    },
    {
        id: 'dc_oracle_austin', name: 'Oracle Cloud (Austin)', operator: 'oracle',
        location: 'Austin, Texas', type: 'datacenter', status: 'operational',
        gpus: '~20,000 A100/H100', power_mw: 250, cooling: 'Liquid cooling',
        desc: 'Oracle\'s OCI supercluster. Provides bare-metal GPU instances for AI startups.',
        w: 140, color: '#f80000'
    },
    {
        id: 'dc_coreweave', name: 'CoreWeave (NJ)', operator: 'coreweave',
        location: 'Weehawken, New Jersey', type: 'datacenter', status: 'operational',
        gpus: '~25,000 H100', power_mw: 200, cooling: 'Liquid cooling',
        desc: 'GPU-specialized cloud provider. Hosts training for Stability AI, Mistral, and others.',
        w: 150, color: '#7c3aed'
    },

    // ─── UNDER CONSTRUCTION ───
    {
        id: 'dc_stargate', name: 'Stargate (Abilene)', operator: 'microsoft',
        location: 'Abilene, Texas', type: 'datacenter', status: 'construction',
        gpus: 'Target: 500,000+ GPUs', power_mw: 5000, cooling: 'Next-gen liquid',
        desc: '$100B joint venture between Microsoft, OpenAI, Oracle, and SoftBank. The largest AI data center ever planned.',
        w: 220, color: '#00a4ef', completion: '2028'
    },
    {
        id: 'dc_xai_expansion', name: 'Colossus Phase 2', operator: 'xai',
        location: 'Memphis, Tennessee', type: 'datacenter', status: 'construction',
        gpus: 'Target: 200,000 H200', power_mw: 300, cooling: 'Advanced liquid',
        desc: 'Doubling Colossus to 200K GPUs. Will be the largest operational AI cluster when complete.',
        w: 160, color: '#1d9bf0', completion: '2025'
    },
    {
        id: 'dc_meta_louisiana', name: 'Meta (Richland Parish)', operator: 'meta',
        location: 'Richland Parish, Louisiana', type: 'datacenter', status: 'construction',
        gpus: 'Target: 100,000+ H200', power_mw: 2000, cooling: 'TBD',
        desc: 'Meta\'s $10B+ mega campus for next-gen Llama training. One of the largest planned AI facilities.',
        w: 180, color: '#0668e1', completion: '2027'
    },

    // ─── CHIP FABS ───
    {
        id: 'fab_tsmc_arizona', name: 'TSMC Arizona', operator: 'tsmc',
        location: 'Phoenix, Arizona', type: 'chipfab', status: 'operational',
        process: '4nm / 3nm N3', products: 'Apple M-series, NVIDIA H100/B200, AMD MI300',
        desc: 'TSMC\'s $40B US fab complex. Fabricates the most advanced AI chips in the Western hemisphere.',
        w: 170, color: '#e31937', investment: '$40B'
    },
    {
        id: 'fab_tsmc_taiwan', name: 'TSMC (Hsinchu)', operator: 'tsmc',
        location: 'Hsinchu, Taiwan', type: 'chipfab', status: 'operational',
        process: '3nm N3E / 2nm', products: 'All leading-edge AI chips globally',
        desc: 'The world\'s most advanced semiconductor fab. Produces 90%+ of the world\'s most advanced chips.',
        w: 200, color: '#e31937', investment: '$30B/year'
    },
    {
        id: 'fab_samsung', name: 'Samsung Foundry', operator: 'samsung',
        location: 'Pyeongtaek, South Korea', type: 'chipfab', status: 'operational',
        process: '3nm GAA', products: 'Samsung Exynos, Qualcomm, Google TPU',
        desc: 'Samsung\'s flagship foundry. Pioneered Gate-All-Around (GAA) transistor architecture.',
        w: 160, color: '#1428a0', investment: '$25B'
    },
    {
        id: 'fab_intel_ohio', name: 'Intel (Ohio)', operator: 'intel',
        location: 'New Albany, Ohio', type: 'chipfab', status: 'construction',
        process: 'Intel 18A', products: 'Intel Gaudi AI accelerators, foundry services',
        desc: 'Intel\'s $20B Ohio mega-fab. Part of Intel Foundry Services\' bid to rival TSMC.',
        w: 180, color: '#0071c5', investment: '$20B', completion: '2026'
    },
    {
        id: 'fab_asml', name: 'ASML (Veldhoven)', operator: 'asml',
        location: 'Veldhoven, Netherlands', type: 'chipfab', status: 'operational',
        process: 'EUV Lithography', products: 'Sole supplier of EUV machines to all fabs worldwide',
        desc: 'The only company on Earth that makes EUV lithography machines. No ASML, no advanced chips.',
        w: 160, color: '#00a3e0', investment: 'N/A'
    },
    {
        id: 'fab_nvidia_design', name: 'NVIDIA (Santa Clara)', operator: 'nvidia',
        location: 'Santa Clara, California', type: 'chipfab', status: 'operational',
        process: 'Chip Design (fabless)', products: 'H100, H200, B200, GB200, Blackwell Ultra',
        desc: 'NVIDIA\'s HQ and chip design center. Designs the GPUs that power 95%+ of AI training worldwide.',
        w: 150, color: '#76b900', investment: 'N/A'
    }
];

// Map operator names to lab IDs for color/linking
const DC_OPERATOR_MAP = {
    google: 'google', microsoft: 'microsoft', amazon: 'amazon', meta: 'meta',
    xai: 'xai', oracle: 'oracle', coreweave: 'coreweave',
    tsmc: 'tsmc', samsung: 'samsung', intel: 'intel', asml: 'asml', nvidia: 'nvidia'
};

// Lab-like entries for operators that aren't AI labs
const DC_OPERATORS = {
    oracle: { name: 'Oracle', color: '#f80000' },
    coreweave: { name: 'CoreWeave', color: '#7c3aed' },
    tsmc: { name: 'TSMC', color: '#e31937' },
    samsung: { name: 'Samsung Foundry', color: '#1428a0' },
    intel: { name: 'Intel', color: '#0071c5' },
    asml: { name: 'ASML', color: '#00a3e0' }
};

// ─── DYNAMIC DC MANAGER ───
const DCManager = {
    _lastCheck: 0,
    _completedIds: new Set(),
    
    // Check construction completion dates — runs every evolveCity cycle
    checkCompletions() {
        const now = new Date();
        const currentYear = now.getFullYear();
        let changed = false;
        
        DC_FACILITIES.forEach(dc => {
            if (dc.status === 'construction' && dc.completion) {
                const completionYear = parseInt(dc.completion);
                if (currentYear >= completionYear && !this._completedIds.has(dc.id)) {
                    dc.status = 'operational';
                    this._completedIds.add(dc.id);
                    changed = true;
                    
                    // Update the BLDS entry
                    if (typeof BLDS !== 'undefined') {
                        const bld = BLDS.find(b => b.id === dc.id);
                        if (bld) {
                            bld.dcData = dc;
                            bld.fl = dc.type === 'chipfab' ? 3 : 3;
                        }
                    }
                    
                    // Sync to Supabase
                    this._syncToCloud(dc);
                    
                    // Announce completion
                    if (typeof UI !== 'undefined') {
                        UI.addToast(`🏗️ ${dc.name} construction complete! Now operational.`);
                    }
                }
            }
        });
        
        // Trigger visual rebuild if anything changed
        if (changed && typeof Environment !== 'undefined' && Environment.drawCityscape) {
            Environment.drawCityscape();
        }
        
        return changed;
    },
    
    // Add a new facility dynamically (can be called from console or future API)
    addFacility(facility) {
        if (!facility.id || DC_FACILITIES.find(dc => dc.id === facility.id)) return false;
        DC_FACILITIES.push(facility);
        
        // Sync to Supabase
        this._syncToCloud(facility);
        
        // Trigger zone recalculation to place the new building
        if (typeof G !== 'undefined' && G.recalculateZoning) {
            G.recalculateZoning();
        }
        if (typeof Environment !== 'undefined' && Environment.drawCityscape) {
            Environment.drawCityscape();
        }
        if (typeof UI !== 'undefined') {
            UI.addToast(`🖥️ New facility discovered: ${facility.name}`);
        }
        return true;
    },
    
    // Write facility data to Supabase
    _syncToCloud(dc) {
        if (typeof API === 'undefined' || !API.supabase) return;
        const row = {
            id: dc.id, name: dc.name, operator: dc.operator,
            location: dc.location || null, type: dc.type || 'datacenter',
            status: dc.status || 'operational',
            gpus: dc.gpus || null, power_mw: dc.power_mw || null,
            cooling: dc.cooling || null, process: dc.process || null,
            products: dc.products || null, investment: dc.investment || null,
            completion: dc.completion || null, description: dc.desc || null,
            width: dc.w || 160, color: dc.color || '#64748b'
        };
        API.supabase.from('dc_facilities').upsert(row).then(({ error }) => {
            if (error) console.warn(`[DCManager] Supabase sync failed for ${dc.id}:`, error.message);
            else console.log(`🖥️ Synced ${dc.id} to cloud (status: ${dc.status})`);
        });
    }
};
