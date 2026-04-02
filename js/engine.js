/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SINGULARITY CITY v16.5.0 — HYBRID DYNAMIC ENGINE (Restored Region Mapping)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const CoreLabRegions = {
    openai: 'us', anthropic: 'us', google: 'us', meta: 'us', xai: 'us',
    microsoft: 'us', amazon: 'us', apple: 'us', databricks: 'us',
    snowflake: 'us', nvidia: 'us', ibm: 'us', ai21: 'us', cohere: 'us',
    huggingface: 'us',
    
    deepseek: 'cn', alibaba: 'cn', baidu: 'cn', tencent: 'cn', 
    zhipu_ai: 'cn', '01_ai': 'cn', upstage: 'cn',
    
    mistral: 'eu', stability: 'eu', tii: 'eu', bigcode: 'eu'
};

const G = {
    app: null, world: null, macroLayer: null, viewMode: 'micro', 
    tick: 0, models: [],
    charRefs: {}, autoScanId: null, autoScanMin: 0,
    cars: [], nextCarTick: 200,
    apiProvider: "google", modelId: "", authKey: "", finnhubKey: "", 
    
    supabaseUrl: "https://uojpqygjbxranpdvkwwz.supabase.co", 
    supabaseKey: "sb_publishable_ucIgRt4nL0kY_ZHbcz92nQ_8O0PzeNA",
    
    achievements: {}, chatBubbles: {},
    bldById: {}, bldsByLab: {}, socialSpots: [],
    
    // ─── EASTER EGGS & TRACKING ───
    _konamiSeq: [], _moonClicks: 0, _catMode: false, _matrixMode: false,
    _visitedInteriors: {}, _trainsDeparted: 0,
    
    starsLayer: null, cloudLayer: null, bldLayer: null, groundGfx: null,
    undergroundLayer: null, trainLayer: null, 
    reflectionLayer: null, charLayer: null, carLayer: null, lightLayer: null, fxGfx: null, celestialGfx: null,
    staticLightsGfx: null,
    
    dataPackets: [], macroNodes: [], pingRings: [],
    
    // ─── CAMERA TRACKING ───
    tracking: null,  // { type: 'model'|'ceo', id: string, lab: string, _lastBld: string|null }
    
    vpW: 0, vpH: 0, cityW: 3400, groundY: 0,
    savedCamX: 0, 
    
    interiorLayer: null,
    activeInterior: null,
  
    getDayPhase() { 
        const n = new Date();
        return (n.getHours() * 60 + n.getMinutes()) / 1440; 
    },
    getCityWidth() { 
        if (!BLDS || BLDS.length === 0) return 3400;
        const last = BLDS[BLDS.length - 1];
        return Math.max(3400, last.x + last.w + 200); 
    },

    recalculateZoning() {
        if (!window.BLDS) return;
        
        if (!BLDS.find(b => b.id === 'metro_east')) {
            const mEast = { id: 'metro_east', name: 'Eastern Hub', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Eastern transit hub.' };
            BLDS.push(mEast);
            this.bldById['metro_east'] = mEast;
        }
        
        // Neon Bar — nightlife destination
        if (!BLDS.find(b => b.id === 'neon_bar')) {
            const bar = { id: 'neon_bar', name: 'Neon Bar', w: 130, x: 0, fl: 3, emoji: '🍸', lab: null, desc: 'Late-night karaoke bar. Models unwind with drinks and sing their training data.' };
            BLDS.push(bar);
            this.bldById['neon_bar'] = bar;
        }
        
        // Visitor Monument — public counter
        if (!BLDS.find(b => b.id === 'visitor_monument')) {
            const mon = { id: 'visitor_monument', name: 'Visitor Monument', w: 80, x: 0, fl: 1, emoji: '🌐', lab: null, desc: 'A monument tracking every unique visitor to Singularity City. Your presence is recorded.' };
            BLDS.push(mon);
            this.bldById['visitor_monument'] = mon;
        }

        let fCamp = BLDS.find(b => b.id === 'forest_0');
        if (!fCamp) {
            fCamp = { id: 'forest_0', name: 'Pine Reserve', w: 400, x: 1450, fl: 1, emoji: '🌲', lab: null, desc: 'A serene camping ground.' };
            BLDS.push(fCamp);
            this.bldById['forest_0'] = fCamp;
        }

        // Helper: is this a space zone building?
        const isSpaceBld = (b) => b.id.startsWith('pad_') || b.id === 'mission_control' || b.id === 'space_assembly' || b.id === 'tracking_station';
        const isSpaceOrForestSep = (b) => isSpaceBld(b) || b.id === 'forest_space';

        // ─── PORT / TRADE ZONE: Initialize buildings ───
        if (typeof PortZone !== 'undefined') PortZone.init();
        
        // ─── SPACE ZONE: Place all space buildings to the far left ───
        // ─── PORT / TRADE ZONE: Position at far left, then space after it ───
        let portEndX = 100;
        if (typeof PortZone !== 'undefined') {
            const portBlds = BLDS.filter(b => b.id.startsWith('port_'));
            let px = 100;
            portBlds.forEach(b => { b.x = px; px += b.w + 40; });
            portEndX = px + 60;
            
            // Set ocean coordinates (left of port buildings)
            PortZone.oceanStartX = -400;
            PortZone.oceanEndX = 80;
            PortZone.coastlineX = 60;
            if (!PortZone.ships.length) PortZone._spawnShips();
        }
        
        let spaceX = portEndX;
        
        const spaceBlds = BLDS.filter(isSpaceBld).sort((a, b) => {
            // Launch pads first, then shared infrastructure
            const typeOrder = { launchpad: 0, mission_control: 1, assembly: 2, tracking: 3 };
            return (typeOrder[a.type] || 99) - (typeOrder[b.type] || 99);
        });
        spaceBlds.forEach(b => {
            b.x = spaceX;
            spaceX += b.w + 60;
        });
        
        // Separation forest between space zone and residential
        let fSpace = BLDS.find(b => b.id === 'forest_space');
        if (fSpace) {
            fSpace.x = spaceX + 150;
            spaceX = fSpace.x + fSpace.w + 150;
        }
        
        // ─── DATA CENTER & CHIP FAB ZONE (between space zone and residential) ───
        const isDcBld = (b) => b.id.startsWith('dc_') || b.id.startsWith('fab_') || b.id === 'metro_dc';
        
        // Ensure DC facilities exist as BLDS entries
        if (typeof DC_FACILITIES !== 'undefined') {
            DC_FACILITIES.forEach(dc => {
                const statusIcon = dc.status === 'construction' ? '🚧' : '✅';
                const typeIcon = dc.type === 'chipfab' ? '🔧' : '🖥️';
                
                let existing = BLDS.find(b => b.id === dc.id);
                if (!existing) {
                    existing = {
                        id: dc.id, name: dc.name, w: dc.w || 160, x: 0,
                        fl: dc.status === 'construction' ? 4 : 3,
                        emoji: typeIcon,
                        lab: dc.operator
                    };
                    BLDS.push(existing);
                    this.bldById[dc.id] = existing;
                }
                
                // Always refresh DC-specific data (survives Supabase reloads)
                existing.dcData = dc;
                existing.type = dc.type;
                existing.desc = dc.desc;
                existing.fl = dc.status === 'construction' ? 4 : 3;
                
                // Build rich tooltip
                let tipParts = [dc.desc];
                tipParts.push('<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">');
                tipParts.push(`${statusIcon} STATUS: ${dc.status === 'construction' ? 'Under Construction' : 'Operational'}<br>`);
                tipParts.push(`📍 ${dc.location}<br>`);
                if (dc.gpus) tipParts.push(`⚡ GPUs: ${dc.gpus}<br>`);
                if (dc.power_mw) tipParts.push(`🔌 Power: ${dc.power_mw} MW<br>`);
                if (dc.cooling) tipParts.push(`❄️ Cooling: ${dc.cooling}<br>`);
                if (dc.process) tipParts.push(`🔬 Process: ${dc.process}<br>`);
                if (dc.products) tipParts.push(`📦 Products: ${dc.products}<br>`);
                if (dc.investment) tipParts.push(`💰 Investment: ${dc.investment}<br>`);
                if (dc.completion) tipParts.push(`📅 Est. Completion: ${dc.completion}<br>`);
                tipParts.push('</span>');
                existing.tip = tipParts.join('');
            });
        }
        
        // Metro station for data center zone
        if (!BLDS.find(b => b.id === 'metro_dc')) {
            const mDc = { id: 'metro_dc', name: 'Compute District', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Data center district transit hub.' };
            BLDS.push(mDc);
            this.bldById['metro_dc'] = mDc;
        }
        
        // ─── NPC HOUSING: Place worker apartments between Frontier Pines and Metro DC ───
        // (Positioned AFTER fSpace, BEFORE dcX)
        let npcEndX = spaceX + 100;
        if (typeof NPCHousing !== 'undefined') {
            let npcX = fSpace ? fSpace.x + fSpace.w + 80 : spaceX + 100;
            const npcBlds = BLDS.filter(b => b.id.startsWith('npc_apt_'));
            npcBlds.forEach(b => {
                b.x = npcX;
                npcX += b.w + 40;
            });
            npcEndX = npcX;
        }

        // Place DC zone after NPC housing — metro station first (leftmost)
        let dcX = npcEndX + 60;
        
        const mDc = BLDS.find(b => b.id === 'metro_dc');
        if (mDc) { mDc.x = dcX; dcX += mDc.w + 60; }
        
        // Then operational DCs, construction sites, chip fabs
        const dcOrder = { datacenter: 0, chipfab: 1 };
        const statusOrder = { operational: 0, construction: 1 };
        BLDS.filter(b => b.id.startsWith('dc_') || b.id.startsWith('fab_'))
            .sort((a, b) => {
                const ad = a.dcData || {}; const bd = b.dcData || {};
                const typeA = dcOrder[ad.type] || 0; const typeB = dcOrder[bd.type] || 0;
                if (typeA !== typeB) return typeA - typeB;
                const statA = statusOrder[ad.status] || 0; const statB = statusOrder[bd.status] || 0;
                return statA - statB;
            })
            .forEach(b => {
                b.x = dcX;
                dcX += b.w + 50;
            });

        // Place residential buildings after the DC zone
        let resX = dcX + 80;
        BLDS.filter(b => b.id.startsWith('res_') || b.id === 'metro_res')
            .sort((a, b) => (a.x || 0) - (b.x || 0))
            .forEach(b => {
                b.x = resX;
                resX += b.w + 60;
            });

        BLDS.sort((a, b) => a.x - b.x);

        let maxResOrDcX = 0;
        BLDS.forEach(b => {
            if (b.id.startsWith('res_') || b.id === 'metro_res' || isDcBld(b) || b.id.startsWith('npc_apt_')) {
                if (b.x + b.w > maxResOrDcX) maxResOrDcX = b.x + b.w;
            }
        });

        // ─── TECH DISTRICT COMPACTION ───
        // Collect all tech buildings (lab HQs + social), sort by current x, reposition tightly
        const isSpecialId = (id) => id.startsWith('res_') || id === 'metro_res' || id.startsWith('house_') || 
            id === 'metro_east' || id === 'metro_dc' || id === 'metro_mid' || id.startsWith('npc_apt_') ||
            id === 'neon_bar' || id === 'visitor_monument' || id === 'forest_0' || id === 'forest_1' || id.startsWith('port_') || id.startsWith('power_');
        
        const techBldsList = BLDS.filter(b => 
            !isSpecialId(b.id) && !isDcBld(b) && !isSpaceOrForestSep(b)
        ).sort((a, b) => a.x - b.x);
        
        // Place Pine Reserve, then start tech district after it
        const pineGap = 100; // gap on each side of forest
        let techStartX = maxResOrDcX + pineGap;
        if (fCamp) {
            fCamp.x = techStartX;
            techStartX = fCamp.x + fCamp.w + pineGap;
        }
        
        // Compact tech buildings with consistent 50px gaps
        let techX = techStartX;
        techBldsList.forEach(b => {
            b.x = techX;
            techX += b.w + 65;
        });
        
        let rightMostTechX = techX;

        // Mid-tech metro station — placed after the median tech building
        if (!BLDS.find(b => b.id === 'metro_mid')) {
            const mMid2 = { id: 'metro_mid', name: 'Central Line', w: 120, x: 0, fl: 1, emoji: '🚇', lab: null, desc: 'Central tech district transit hub.' };
            BLDS.push(mMid2);
            this.bldById['metro_mid'] = mMid2;
        }
        const mMid = BLDS.find(b => b.id === 'metro_mid');
        if (mMid && techBldsList.length >= 4) {
            const medianIdx = Math.floor(techBldsList.length / 2);
            const leftBld = techBldsList[medianIdx];
            mMid.x = leftBld.x + leftBld.w + 15;
            
            // Shift right-side buildings to make room for station
            const stationRight = mMid.x + mMid.w + 15;
            const rightBlds = techBldsList.filter(b => b.x > leftBld.x);
            if (rightBlds.length > 0 && rightBlds[0].x < stationRight) {
                const shiftNeeded = stationRight - rightBlds[0].x;
                rightBlds.forEach(b => { b.x += shiftNeeded; });
            }
            // Update rightMostTechX after shift
            const lastTech = rightBlds[rightBlds.length - 1] || leftBld;
            rightMostTechX = lastTech.x + lastTech.w + 30;
        } else if (mMid) {
            mMid.x = techStartX + (rightMostTechX - techStartX) / 2;
        }

        let currentX = rightMostTechX + 60;
        
        // Visitor Monument — public obelisk
        const vMon = BLDS.find(b => b.id === 'visitor_monument');
        if (vMon) {
            vMon.x = currentX;
            currentX += vMon.w + 40;
        }
        
        // Neon Bar — nightlife strip
        const nBar = BLDS.find(b => b.id === 'neon_bar');
        if (nBar) {
            nBar.x = currentX;
            currentX += nBar.w + 40;
        }
        
        let mEast = BLDS.find(b => b.id === 'metro_east');
        if (mEast) {
            mEast.x = currentX;
            currentX += mEast.w;
        }

        currentX += 500; 
        let fSilicon = BLDS.find(b => b.id === 'forest_1');
        if (fSilicon) {
            fSilicon.x = currentX;
            currentX += fSilicon.w + 300;
        }

        // ─── Ensure every founder has an estate in Billionaire's Row ───
        if (typeof REAL_FOUNDERS !== 'undefined') {
            REAL_FOUNDERS.forEach(f => {
                if (!f.lab) return;
                const estateId = 'house_' + f.lab;
                if (!BLDS.find(b => b.id === estateId)) {
                    const labData = LABS[f.lab] || LABS.other || { name: f.lab, color: '#64748b' };
                    const newEstate = {
                        id: estateId,
                        name: `${f.name}'s Estate`,
                        w: 200,
                        x: 0, // will be placed below
                        fl: 2,
                        emoji: '🏡',
                        lab: f.lab,
                        desc: `Private residence of ${f.name}, ${f.role || 'CEO'} of ${labData.name}.`
                    };
                    BLDS.push(newEstate);
                    this.bldById[estateId] = newEstate;
                    if (!this.bldsByLab[f.lab]) this.bldsByLab[f.lab] = [];
                    this.bldsByLab[f.lab].push(newEstate);
                }
            });
        }

        BLDS.forEach(b => {
            if (b.id.startsWith('house_')) {
                b.x = currentX;
                currentX += b.w + 100; 
            }
        });

        // ─── POWER GRID ZONE: Far right after estates ───
        if (typeof PowerZone !== 'undefined') {
            currentX = PowerZone.positionZone(currentX);
        }

        BLDS.sort((a, b) => a.x - b.x);
        this.cityW = this.getCityWidth();
    },
  
    unlockAchieve(key) {
      if (this.achievements[key]) return;
      this.achievements[key] = Date.now();
      const a = ACHIEVEMENTS[key]; 
      if (!a) return;
      if (typeof UI !== 'undefined') UI.addToast(`🏆 Achievement: ${a.icon} ${a.name}!`);
      if (typeof SND !== 'undefined') SND.achieve();
      if (typeof NOTIFY !== 'undefined') NOTIFY.send('Achievement Unlocked!', `${a.icon} ${a.name} — ${a.desc}`); 
      this.save();
    },

    // ═══════════════════════════════════════════════
    //   EASTER EGGS & ACHIEVEMENT TRIGGERS
    // ═══════════════════════════════════════════════
    
    initEasterEggs() {
        const KONAMI = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
        
        // Konami Code listener
        window.addEventListener('keydown', (e) => {
            this._konamiSeq.push(e.key);
            if (this._konamiSeq.length > 10) this._konamiSeq.shift();
            if (this._konamiSeq.length === 10 && this._konamiSeq.every((k, i) => k === KONAMI[i])) {
                this._konamiSeq = [];
                this.triggerMatrixRain();
                this.unlockAchieve('konami');
            }
        });
        
        // Moon click listener — detect clicks near the moon/sun in celestialGfx
        if (this.celestialGfx) {
            this.celestialGfx.eventMode = 'static';
            this.celestialGfx.cursor = 'pointer';
            this.celestialGfx.on('pointerdown', () => {
                this._moonClicks++;
                if (typeof SND !== 'undefined') SND.playTone(600 + this._moonClicks * 200, 'sine', 0.08, 0.03);
                if (this._moonClicks >= 5) {
                    this._moonClicks = 0;
                    this.triggerCatMode();
                    this.unlockAchieve('cat_mode');
                }
            });
        }
        
        // Night Owl check
        const h = new Date().getHours();
        if (h >= 0 && h < 5) {
            setTimeout(() => this.unlockAchieve('night_owl'), 5000);
        }
    },
    
    triggerMatrixRain() {
        if (this._matrixMode) return;
        this._matrixMode = true;
        if (typeof UI !== 'undefined') UI.addToast('🕹️ THE MATRIX HAS YOU...');
        if (typeof SND !== 'undefined') { SND.playTone(200, 'sawtooth', 0.5, 0.05, 100); SND.playTone(150, 'square', 1.0, 0.03, 50); }
        
        const overlay = document.createElement('canvas');
        overlay.id = 'matrixRain';
        overlay.width = window.innerWidth;
        overlay.height = window.innerHeight;
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;z-index:9999;pointer-events:none;opacity:0.85;';
        document.body.appendChild(overlay);
        
        const ctx = overlay.getContext('2d');
        const cols = Math.floor(overlay.width / 14);
        const drops = Array(cols).fill(1);
        const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノハヒフヘホマミムメモヤユヨラリルレロワヲン01';
        
        const drawFrame = () => {
            ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
            ctx.fillRect(0, 0, overlay.width, overlay.height);
            ctx.fillStyle = '#0f0';
            ctx.font = '12px monospace';
            for (let i = 0; i < drops.length; i++) {
                const ch = chars[Math.floor(Math.random() * chars.length)];
                ctx.fillStyle = Math.random() > 0.9 ? '#fff' : '#0f0';
                ctx.fillText(ch, i * 14, drops[i] * 14);
                if (drops[i] * 14 > overlay.height && Math.random() > 0.975) drops[i] = 0;
                drops[i]++;
            }
        };
        
        const matrixId = setInterval(drawFrame, 50);
        setTimeout(() => {
            clearInterval(matrixId);
            overlay.remove();
            this._matrixMode = false;
        }, 10000);
    },
    
    triggerCatMode() {
        if (this._catMode) return;
        this._catMode = true;
        if (typeof UI !== 'undefined') UI.addToast('🐱 CATURDAY MODE ACTIVATED!');
        if (typeof SND !== 'undefined') { SND.playTone(800, 'sine', 0.1, 0.04, 1200); SND.playTone(1000, 'triangle', 0.08, 0.03, 600); }
        
        // Store original emojis and swap to cats
        const catEmojis = ['🐱', '😺', '😸', '😻', '🐈', '😼', '🙀', '😹', '😽', '😾'];
        const origEmojis = {};
        Object.keys(this.charRefs).forEach(id => {
            const refs = this.charRefs[id];
            if (refs && refs.emojiTxt) {
                origEmojis[id] = refs.emojiTxt.text;
                refs.emojiTxt.text = catEmojis[Math.floor(Math.random() * catEmojis.length)];
            }
        });
        
        // Restore after 30 seconds
        setTimeout(() => {
            Object.keys(origEmojis).forEach(id => {
                const refs = this.charRefs[id];
                if (refs && refs.emojiTxt) refs.emojiTxt.text = origEmojis[id];
            });
            this._catMode = false;
            if (typeof UI !== 'undefined') UI.addToast('🐱 Cats have returned to their dimension.');
        }, 30000);
    },

    getLabIcon(labId) {
        const pool = ['🚀', '🛰️', '⚡', '💡', '🔥', '⚙️', '🧬', '🧪', '🔭', '📡', '🕹️', '💎', '💠', '🔆', '🔑', '🌍', '💻'];
        const hash = Array.from(labId).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        return pool[hash % pool.length];
    },

    ensureLabExists(rawLabId, suggestedRegion) {
        if (!rawLabId || rawLabId === 'other') return 'other';
        
        let norm = rawLabId.toLowerCase().replace(/[^a-z0-9]/g, '');
        let canonical = rawLabId.toLowerCase().trim().replace(/\s+/g, '_');
        
        if (norm.includes('google') || norm.includes('deepmind')) canonical = 'google';
        else if (norm.includes('openai')) canonical = 'openai';
        else if (norm.includes('meta') || norm.includes('facebook')) canonical = 'meta';
        else if (norm.includes('anthropic')) canonical = 'anthropic';
        else if (norm.includes('xai') || norm === 'x') canonical = 'xai';
        else if (norm.includes('mistral')) canonical = 'mistral';
        else if (norm.includes('alibaba') || norm.includes('qwen') || norm.includes('tongyi')) canonical = 'alibaba';
        else if (norm.includes('deepseek')) canonical = 'deepseek';
        else if (norm.includes('cohere')) canonical = 'cohere';
        else if (norm.includes('01ai') || norm.includes('01_ai')) canonical = '01_ai';
        else if (norm.includes('microsoft')) canonical = 'microsoft';
        else if (norm.includes('amazon') || norm.includes('aws')) canonical = 'amazon';
        else if (norm.includes('stability')) canonical = 'stability';
        else if (norm.includes('apple')) canonical = 'apple';
        else if (norm.includes('ibm')) canonical = 'ibm';
        else if (norm.includes('nvidia')) canonical = 'nvidia';
        else if (norm.includes('baidu') || norm.includes('ernie')) canonical = 'baidu';
        else if (norm.includes('tencent')) canonical = 'tencent';
        else if (norm.includes('ai21')) canonical = 'ai21';
        else if (norm.includes('bigcode')) canonical = 'bigcode';
        else if (norm.includes('tii') || norm.includes('falcon')) canonical = 'tii';
        else if (norm.includes('zhipu') || norm.includes('glm')) canonical = 'zhipu_ai';
        else if (norm.includes('upstage')) canonical = 'upstage';
        else if (norm.includes('databricks')) canonical = 'databricks';
        else if (norm.includes('snowflake')) canonical = 'snowflake';
        else if (norm.includes('huggingface') || norm.includes('hugging')) canonical = 'huggingface';

        if (LABS[canonical]) {
            if (suggestedRegion && (!LABS[canonical].region || LABS[canonical].region === 'eu')) {
                LABS[canonical].region = suggestedRegion;
            }
            
            // FIX: Lab exists in LABS (from Supabase) but may have no HQ building.
            // This happens when a lab is added to the 'labs' table but not the 'blds' table.
            const hasHQ = BLDS.some(b => b.lab === canonical && !b.id.startsWith('house_'));
            if (!hasHQ && canonical !== 'other') {
                const hash = Array.from(canonical).reduce((acc, char) => acc + char.charCodeAt(0), 0);
                const newW = 140 + (hash % 60);
                const techBlds = BLDS.filter(b => b.id !== 'forest_1' && b.id !== 'forest_0' && !b.id.startsWith('house_') && b.id !== 'metro_east');
                const lastTech = techBlds[techBlds.length - 1];
                const newX = lastTech ? (lastTech.x + lastTech.w + 80) : 100;
                
                const newBld = {
                    id: 'bld_' + canonical, name: (LABS[canonical].name || canonical) + ' HQ', w: newW, x: newX, fl: 3, lab: canonical, desc: `Headquarters for ${LABS[canonical].name || canonical}.`
                };
                
                BLDS.push(newBld);
                this.bldById[newBld.id] = newBld;
                if (!this.bldsByLab[canonical]) this.bldsByLab[canonical] = [];
                this.bldsByLab[canonical].unshift(newBld);
                
                this.recalculateZoning();
                
                if (this.bldLayer) {
                    if (typeof Environment !== 'undefined') { Environment.buildGround(); Environment.buildBuildings(); }
                    if (this.viewMode === 'macro') this.buildMacroLayer();
                }
                
                if (typeof UI !== 'undefined') UI.addLog(`🏗️ New HQ zoned for ${LABS[canonical].name || canonical}!`);
            }
            
            return canonical;
        }

        for (let existingKey in LABS) {
            let existingNorm = existingKey.toLowerCase().replace(/[^a-z0-9]/g, '');
            if (norm === existingNorm || (norm.length > 5 && existingNorm.includes(norm)) || (existingNorm.length > 5 && norm.includes(existingNorm))) {
                if (suggestedRegion && (!LABS[existingKey].region || LABS[existingKey].region === 'eu')) {
                    LABS[existingKey].region = suggestedRegion;
                }
                return existingKey;
            }
        }

        const colors = ['#f43f5e', '#ec4899', '#d946ef', '#a855f7', '#8b5cf6', '#6366f1', '#3b82f6', '#0ea5e9', '#06b6d4', '#14b8a6', '#10b981', '#84cc16'];
        const hash = Array.from(canonical).reduce((acc, char) => acc + char.charCodeAt(0), 0);
        const color = colors[hash % colors.length];
        const niceName = canonical.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');

        // ─── HYBRID LOGIC: Use local mapping if known, otherwise use API guess ───
        const finalRegion = CoreLabRegions[canonical] || suggestedRegion || 'eu';

        LABS[canonical] = { name: niceName, color: color, icon: this.getLabIcon(canonical), ticker: null, region: finalRegion };
        
        const techBlds = BLDS.filter(b => b.id !== 'forest_1' && b.id !== 'forest_0' && !b.id.startsWith('house_') && b.id !== 'metro_east');
        const lastTech = techBlds[techBlds.length - 1];
        const newX = lastTech ? (lastTech.x + lastTech.w + 80) : 100;
        const newW = 140 + (hash % 60); 
        
        const newBld = {
            id: 'bld_' + canonical, name: niceName + ' HQ', w: newW, x: newX, fl: 3, lab: canonical, desc: `Newly zoned headquarters for ${niceName}.`
        };
        
        BLDS.push(newBld);
        this.bldById[newBld.id] = newBld;
        
        if (!this.bldsByLab[canonical]) this.bldsByLab[canonical] = [];
        this.bldsByLab[canonical].unshift(newBld);
        
        this.recalculateZoning();
        
        if (this.bldLayer) { 
            if (typeof Environment !== 'undefined') { Environment.buildGround(); Environment.buildBuildings(); }
            if (this.viewMode === 'macro') this.buildMacroLayer();
        }
        
        if (typeof UI !== 'undefined') UI.addLog(`🏗️ New land zoned for ${niceName} HQ in ${finalRegion.toUpperCase()} Sector!`);
        return canonical;
    },
    
    save() {
      const disc = this.models.filter(m => m._src);
      let currentCamX = 0;
      if (typeof Camera !== 'undefined') currentCamX = Camera.targetX;
      else if (this.savedCamX !== undefined) currentCamX = this.savedCamX;

      try { 
          localStorage.setItem('sc_data', JSON.stringify({ 
              apiProvider: this.apiProvider, 
              modelId: this.modelId, 
              authKey: this.authKey, 
              finnhubKey: this.finnhubKey, 
              autoScanMin: this.autoScanMin, 
              discovered: disc, 
              sound: typeof SND !== 'undefined' ? SND.enabled : true, 
              achievements: this.achievements,
              camX: currentCamX 
          }));
      } catch(e) {}
    },
    
    load() {
      try {
        const raw = localStorage.getItem('sc_data');
        if (!raw) return; 
        const d = JSON.parse(raw);
        if (d.apiProvider) this.apiProvider = d.apiProvider; 
        if (d.modelId) this.modelId = d.modelId;
        if (d.authKey) this.authKey = d.authKey; 
        if (d.finnhubKey) this.finnhubKey = d.finnhubKey;
        if (d.sound !== undefined && typeof SND !== 'undefined') SND.enabled = d.sound; 
        if (d.autoScanMin) this.autoScanMin = d.autoScanMin;
        if (d.achievements) this.achievements = d.achievements;
        if (d.camX !== undefined) this.savedCamX = d.camX;
        
        if (d.discovered && d.discovered.length) {
          const ids = new Set(this.models.map(m => m.id));
          d.discovered.forEach(m => { 
              if (!ids.has(m.id)) { 
                  if (m.benchmarks) BM[m.id] = m.benchmarks; 
                  m.lab = this.ensureLabExists(m.lab, m.region); 
                  this.models.push(m); 
                  ids.add(m.id); 
              } 
          });
          if (typeof UI !== 'undefined') UI.addLog(`📂 Loaded ${d.discovered.length} discovered models.`);
        }
      } catch(e) {}
    },
    
    saveSettings() {
      this.apiProvider = document.getElementById('apiProviderSel').value; 
      this.modelId = document.getElementById('modelIdInput').value; 
      this.authKey = document.getElementById('authKeyInput').value; 
      this.finnhubKey = document.getElementById('finnhubKeyInput').value; 
      this.autoScanMin = parseInt(document.getElementById('autoScanSel').value) || 0;
      this.save(); 
      this.startAutoScan(); 
      document.getElementById('settingsOv').classList.remove('open'); 
      if (this.authKey && typeof API !== 'undefined') API.doScan();
    },
    
    startAutoScan() {
      if (this.autoScanId) clearInterval(this.autoScanId);
      if (this.autoScanMin > 0 && this.authKey) { 
          this.autoScanId = setInterval(() => { if(typeof API !== 'undefined') API.doScan(); }, this.autoScanMin * 60000); 
          if (typeof UI !== 'undefined') UI.addLog(`🔄 Auto-scan: every ${this.autoScanMin}m`);
      }
    },
  
    evolveCity() {
      // Time-gate: don't rebuild more than once every 3 seconds
      const now = Date.now();
      if (this._lastEvolve && now - this._lastEvolve < 3000) {
          // Schedule a deferred evolve so we don't miss the last call
          if (!this._evolveDeferred) {
              this._evolveDeferred = setTimeout(() => { this._evolveDeferred = null; this.evolveCity(); }, 3000);
          }
          return;
      }
      this._lastEvolve = now;
      
      let topElo = 0;
      let topLab = null; 
      let cheapestLab = null; 
      let lowestCost = 999;

      this.models.forEach(m => {
        if (BM[m.id]?.ELO > topElo) { topElo = BM[m.id].ELO; topLab = m.lab; }
        if (COSTS[m.id]?.output > 0 && COSTS[m.id].output < lowestCost) { lowestCost = COSTS[m.id].output; cheapestLab = m.lab; }
      });
      
      BLDS.forEach(b => {
        if (b.id === 'gym' || b.id === 'arena') {
            b.dynamicFl = 3;
            b.desc = b.id === 'gym' ? 'RLHF Gym for heavy compute training.' : 'LMSYS Chatbot Arena for model battles.';
        }
        
        if (b.id === 'neon_bar') {
            b.dynamicFl = 3;
            b.desc = 'Late-night karaoke bar. Models unwind and sing their training data.';
        }

        if (b.id.startsWith('res_')) {
            const resRegion = b.id.split('_')[1] || 'eu';
            const activeResModels = this.models.filter(m => {
                if (m.ret && new Date(m.ret) < new Date()) return false;
                const r = (LABS[m.lab] && LABS[m.lab].region) ? LABS[m.lab].region : 'eu';
                return r === resRegion;
            });
            b.dynamicFl = Math.max(b.fl || 2, Math.floor(activeResModels.length / 4) + 2);
            b.desc = `High-density residential housing block for AI citizens in the ${resRegion.toUpperCase()} region.`;
            b.tip = `🏢 ${b.name}<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">POPULATION: ${activeResModels.length} Citizens<br>CAPACITY: ${b.dynamicFl * 4} Units</span>`;
            return;
        }

        if (!b.lab) return;

        if (b.id.startsWith('house_')) {
            const founder = typeof REAL_FOUNDERS !== 'undefined' ? REAL_FOUNDERS.find(f => f.lab === b.lab) : null;
            const fName = founder ? founder.name : 'Executive';
            b.desc = `The private residential estate of ${fName}.`;
            b.tip = `🏡 ${fName}'s Estate<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">Highly secure, private grounds.<br>Off-limits to standard AI citizens.</span>`;
            return;
        }

        // DC/fab buildings have their own fixed height — skip HQ scaling
        if (b.id.startsWith('dc_') || b.id.startsWith('fab_')) return;

        const activeModels = this.models.filter(m => m.lab === b.lab && (!m.ret || new Date(m.ret) > new Date()));
        
        b.dynamicFl = Math.max(b.fl || 3, Math.floor(activeModels.length / 2) + 2);
        if (b.dynamicFl < 3) b.dynamicFl = 3; 

        b.isTopLab = (b.lab === topLab); 
        b.isCheapest = (b.lab === cheapestLab);
        
        const allLabModels = this.models.filter(m => m.lab === b.lab);
        let topModel = null; 
        let highest = 0; 
        let openSourceCount = 0;
        
        allLabModels.forEach(m => { 
            // Use avgBM if available, fall back to ELO, then individual benchmarks
            let score = 0;
            if (typeof avgBM === 'function') score = avgBM(m.id) || 0;
            if (score === 0) score = BM[m.id]?.ELO || 0;
            if (score === 0) {
                const bms = BM[m.id] || {};
                const vals = Object.values(bms).filter(v => typeof v === 'number' && v > 0);
                if (vals.length > 0) score = vals.reduce((a, b) => a + b, 0) / vals.length;
            }
            if (score >= highest) { highest = score; topModel = m; } 
            if (m.os) openSourceCount++; 
        });

        const baseLore = LABS[b.lab]?.desc || `An emerging AI research facility actively contributing to the global intelligence frontier.`;
        const philosophy = openSourceCount >= (allLabModels.length / 2) ? "🟢 Open-Weights Focus" : "🔒 Closed-Weights Focus";
        const flagshipText = topModel ? topModel.name : (allLabModels.length > 0 ? allLabModels[allLabModels.length - 1].name : 'Awaiting Data');
        const modelCount = allLabModels.length;
        const benchInfo = highest > 0 ? `⚡ AVG SCORE: ${highest.toFixed(0)}%` : '';
        
        b.desc = baseLore; 
        b.tip = `${baseLore}<br><br><span style="color:#a0a0b8;font-size:9px;line-height:1.4;display:block;">🏢 STAFF: ${modelCount} AI Citizens<br>🧠 FLAGSHIP: ${flagshipText}<br>${benchInfo ? benchInfo + '<br>' : ''}${philosophy}</span>`;
      });

      if (typeof Environment !== 'undefined' && Environment.buildBuildings) Environment.buildBuildings();
    },

    enterInterior(b) {
        this.activeInterior = b.id;
        
        // Track unique interiors visited for Interior Designer achievement
        if (!this._visitedInteriors[b.id]) {
            this._visitedInteriors[b.id] = true;
            if (Object.keys(this._visitedInteriors).length >= 10) {
                this.unlockAchieve('interior_designer');
            }
        }
        
        if (typeof SND !== 'undefined') SND.setAmbient(b.id);
        
        this.world.visible = false;
        if(this.macroLayer) this.macroLayer.visible = false;
        
        if (!this.interiorLayer) {
            this.interiorLayer = new PIXI.Container();
            this.app.stage.addChild(this.interiorLayer);
        }
        this.interiorLayer.visible = true;
        
        if (typeof Interior !== 'undefined') {
            Interior.build(b, this.interiorLayer);
        }
        
        let exitBtn = document.getElementById('btnExitInterior');
        if (!exitBtn) {
            exitBtn = document.createElement('button');
            exitBtn.id = 'btnExitInterior';
            exitBtn.innerHTML = '🚪 EXIT BUILDING';
            exitBtn.style.cssText = 'position:absolute; top:0px; right:20px; z-index:9999; background:#f43f5e; color:#fff; border:none; border-bottom: 3px solid #be123c; padding:12px 20px; border-radius:0 0 6px 6px; cursor:pointer; font-size:12px; font-weight:bold; font-family:"Press Start 2P", monospace; box-shadow: 0 4px 8px rgba(0,0,0,0.5); transition: background 0.2s;';
            exitBtn.onmouseover = () => { exitBtn.style.background = '#e11d48'; };
            exitBtn.onmouseout = () => { exitBtn.style.background = '#f43f5e'; };
            exitBtn.onclick = () => { if(typeof SND !== 'undefined') SND.uiClick(); this.exitInterior(); };
            document.body.appendChild(exitBtn);
        }
        exitBtn.style.display = 'block';
        
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
    },

    exitInterior() {
        const prevId = this.activeInterior;
        this.activeInterior = null;
        
        if (typeof SND !== 'undefined') SND.setAmbient('outside');
        if (this.interiorLayer) this.interiorLayer.visible = false;
        this.world.visible = true;
        
        const exitBtn = document.getElementById('btnExitInterior');
        if (exitBtn) exitBtn.style.display = 'none';
        
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = ''; 
        
        // NO full rebuild here — just let the normal update loop handle positioning.
        // Full rebuilds were causing tracking mode lag and metro passenger teleportation.
        
        if (typeof Camera !== 'undefined') {
            Camera.targetZoom = this.tracking ? 1.3 : 1;
        }
    },

    // ═══════════════════════════════════════════════
    //   CAMERA TRACKING SYSTEM
    // ═══════════════════════════════════════════════
    
    startTracking(type, id, lab) {
        this.tracking = { type, id, lab, _lastBld: null };
        
        // Show persistent tracking HUD
        let hud = document.getElementById('trackingHud');
        if (!hud) {
            hud = document.createElement('div');
            hud.id = 'trackingHud';
            hud.style.cssText = 'position:absolute; bottom:40px; left:50%; transform:translateX(-50%); z-index:150; background:rgba(10,10,25,0.9); border:1px solid #22d3ee; border-radius:20px; padding:6px 16px; display:flex; align-items:center; gap:10px; font-family:"JetBrains Mono",monospace; font-size:10px; color:#22d3ee; pointer-events:all; box-shadow:0 4px 15px rgba(34,211,238,0.3); animation:slideUp 0.3s ease;';
            document.getElementById('gameWrap').appendChild(hud);
        }
        
        const name = type === 'ceo' 
            ? (G.ceoRefs[lab]?.f?.name || lab)
            : (G.models.find(m => m.id === id)?.name || id);
        
        hud.innerHTML = `<span style="animation:pulse 2s infinite">📡</span> <span style="color:#fff;font-weight:bold">${escapeHTML(name)}</span> <span style="color:#a0a0b8">TRACKING</span> <button onclick="G.stopTracking()" style="background:#f43f5e;color:#fff;border:none;border-radius:10px;padding:2px 10px;font-family:inherit;font-size:9px;cursor:pointer;font-weight:bold">STOP</button>`;
        hud.style.display = 'flex';
        
        if (typeof UI !== 'undefined') UI.addToast(`📡 Tracking ${name}`);
    },
    
    stopTracking() {
        this.tracking = null;
        
        const hud = document.getElementById('trackingHud');
        if (hud) hud.style.display = 'none';
        
        if (typeof Camera !== 'undefined') {
            Camera.targetZoom = 1;
        }
    },
    
    updateTracking() {
        if (!this.tracking) return;
        
        let entityBld = null;
        
        if (this.tracking.type === 'model') {
            const refs = G.charRefs[this.tracking.id];
            if (!refs) return;
            entityBld = refs.bld; // null if on street, building id if inside
        } else if (this.tracking.type === 'ceo') {
            const ceo = G.ceoRefs ? G.ceoRefs[this.tracking.lab] : null;
            if (!ceo) return;
            entityBld = ceo.bld;
        }
        
        const wasInside = this.tracking._lastBld;
        const isNowInside = entityBld;
        
        // Entity just entered a building — follow them in
        if (!wasInside && isNowInside) {
            const bld = this.bldById[isNowInside];
            if (bld && !this.activeInterior) {
                this.enterInterior(bld);
            }
        }
        
        // Entity just left a building — follow them out
        if (wasInside && !isNowInside) {
            if (this.activeInterior) {
                this.exitInterior();
            }
        }
        
        // Entity moved to a DIFFERENT building — transition
        if (wasInside && isNowInside && wasInside !== isNowInside) {
            if (this.activeInterior) {
                this.exitInterior();
            }
            setTimeout(() => {
                if (this.tracking) {
                    const bld = this.bldById[isNowInside];
                    if (bld) this.enterInterior(bld);
                }
            }, 400); // brief pause for visual transition
        }
        
        this.tracking._lastBld = entityBld;
    },
  
    toggleMacro() {
      const btn = document.getElementById('btnMacro');
      const wrap = document.getElementById('gameWrap');
      if (this.viewMode === 'micro') {
        this.viewMode = 'macro'; 
        btn.classList.add('macro-active');
        wrap.classList.add('macro-mode'); 
        btn.innerHTML = '🏙️ Street View';
        this.world.visible = false; 
        this.macroLayer.visible = false;
        // Launch 3D Holomap
        if (typeof Holomap !== 'undefined') Holomap.show();
      } else {
        this.viewMode = 'micro'; 
        btn.classList.remove('macro-active'); 
        wrap.classList.remove('macro-mode'); 
        btn.innerHTML = '🌍 Holomap';
        this.world.visible = true; 
        this.macroLayer.visible = false;
        // Hide 3D Holomap
        if (typeof Holomap !== 'undefined') Holomap.hide();
      }
    },

    // ═══════════════════════════════════════════════
    //   MINIMAP
    // ═══════════════════════════════════════════════
    
    _mmZones: [
        { id: 'port',     emoji: '🚢', label: 'Port District',  match: b => b.id.startsWith('port_') },
        { id: 'space',    emoji: '🚀', label: 'Space Zone',     match: b => b.type === 'launchpad' },
        { id: 'frontier', emoji: '🌲', label: 'Frontier Pines', match: b => b.id === 'forest_space' },
        { id: 'npc_housing', emoji: '🏬', label: 'Worker Housing', match: b => b.id.startsWith('npc_apt_') },
        { id: 'dc',       emoji: '🖥️', label: 'Compute Dist.',  match: b => b.id.startsWith('dc_') || b.id.startsWith('fab_') || b.id === 'metro_dc' },
        { id: 'res',      emoji: '🏠', label: 'Residential',    match: b => b.id.startsWith('res_') || b.id === 'metro_res' },
        { id: 'pine',     emoji: '🌲', label: 'Pine Reserve',   match: b => b.id === 'forest_0' },
        { id: 'tech',     emoji: '🏢', label: 'Tech District',  match: b => b.lab && !b.id.startsWith('house_') && !b.id.startsWith('res_') && b.id !== 'metro_res' && !b.id.startsWith('dc_') && !b.id.startsWith('fab_') && b.id !== 'metro_dc', wide: true },
        { id: 'midline',  emoji: '🚇', label: 'Central Line',   match: b => b.id === 'metro_mid' },
        { id: 'metro',    emoji: '🚇', label: 'Metro East',     match: b => b.id === 'metro_east' },
        { id: 'nightlife', emoji: '🍸', label: 'Nightlife',     match: b => b.id === 'neon_bar' },
        { id: 'silicon',  emoji: '🌲', label: 'Silicon Woods',  match: b => b.id === 'forest_1' },
        { id: 'estates',  emoji: '🏡', label: "Billionaire's",  match: b => b.id.startsWith('house_') },
        { id: 'power',   emoji: '⚡', label: 'Power Grid',    match: b => b.id.startsWith('power_') }
    ],
    
    initMinimap() {
        const mm = document.getElementById('minimap');
        const zones = document.getElementById('mmZones');
        const canvas = document.getElementById('mmCanvas');
        if (!mm || !zones || !canvas) return;
        
        // Build zone quick-jump buttons
        zones.innerHTML = '';
        this._mmZones.forEach(z => {
            const btn = document.createElement('div');
            btn.className = 'mm-zone' + (z.wide ? ' wide' : '');
            btn.dataset.zone = z.id;
            btn.textContent = `${z.emoji} ${z.label}`;
            btn.onclick = () => this.jumpToZone(z);
            zones.appendChild(btn);
        });
        
        // Click-to-jump on the canvas
        canvas.addEventListener('click', (e) => {
            const rect = canvas.getBoundingClientRect();
            const clickRatio = (e.clientX - rect.left) / rect.width;
            const targetWorldX = clickRatio * this.cityW;
            Camera.targetX = -targetWorldX + (this.vpW / 2) / Camera.zoom;
            Camera.targetZoom = 1;
            if (this.tracking) this.stopTracking();
        });
        
        this._mmCanvas = canvas;
        this._mmCtx = canvas.getContext('2d');
    },
    
    jumpToZone(zone) {
        const match = BLDS.find(zone.match);
        if (!match) return;
        const targetX = match.x + match.w / 2;
        Camera.targetX = -targetX + (this.vpW / 2) / Camera.zoom;
        Camera.targetZoom = 1;
        if (this.tracking) this.stopTracking();
        if (this.activeInterior) this.exitInterior();
    },
    
    updateMinimap() {
        const mm = document.getElementById('minimap');
        if (!mm) return;
        
        // Hide during interiors and macro mode
        if (this.activeInterior || this.viewMode === 'macro') {
            mm.style.display = 'none';
            return;
        }
        mm.style.display = '';
        
        // Skip canvas draw if collapsed
        if (mm.classList.contains('collapsed')) return;
        
        const ctx = this._mmCtx;
        const c = this._mmCanvas;
        if (!ctx || !c) return;
        
        const cW = c.width;
        const cH = c.height;
        ctx.clearRect(0, 0, cW, cH);
        
        // Background
        ctx.fillStyle = 'rgba(10,10,25,0.8)';
        ctx.fillRect(0, 0, cW, cH);
        
        const scale = cW / Math.max(this.cityW, 1);
        
        // Draw zone color bands
        const zoneColors = { port: '#0a1628', space: '#c2956a', frontier: '#1b4332', npc_housing: '#1a2030', res: '#334155', pine: '#1b4332', tech: '#2a2a42', metro: '#475569', nightlife: '#1a0a2e', silicon: '#1b4332', estates: '#3d2514', power: '#1a1a10' };
        
        this._mmZones.forEach(z => {
            let minX = Infinity, maxX = 0;
            BLDS.forEach(b => {
                if (z.match(b)) {
                    if (b.x < minX) minX = b.x;
                    if (b.x + b.w > maxX) maxX = b.x + b.w;
                }
            });
            if (minX < Infinity) {
                ctx.fillStyle = zoneColors[z.id] || '#222';
                ctx.fillRect(minX * scale, 8, Math.max((maxX - minX) * scale, 3), cH - 16);
            }
        });
        
        // Draw buildings as thin lines
        BLDS.forEach(b => {
            const bx = b.x * scale;
            const bw = Math.max(b.w * scale, 1);
            const floors = b.dynamicFl || b.fl || 1;
            const bh = Math.min(floors * 2, cH - 10);
            
            if (b.lab) {
                const lab = LABS[b.lab];
                ctx.fillStyle = lab ? lab.color : '#64748b';
            } else if (b.type === 'launchpad') {
                ctx.fillStyle = '#fc3d21';
            } else {
                ctx.fillStyle = '#445';
            }
            ctx.fillRect(bx, cH - 4 - bh, bw, bh);
        });
        
        // Draw viewport indicator
        const vpLeft = (-Camera.x) * scale;
        const vpWidth = (this.vpW / Camera.zoom) * scale;
        ctx.strokeStyle = 'rgba(34,211,238,0.7)';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(vpLeft, 1, vpWidth, cH - 2);
        ctx.fillStyle = 'rgba(34,211,238,0.06)';
        ctx.fillRect(vpLeft, 1, vpWidth, cH - 2);
        
        // Highlight active zone button
        const camCenter = -Camera.x + (this.vpW / 2) / Camera.zoom;
        document.querySelectorAll('.mm-zone').forEach(el => {
            const zoneId = el.dataset.zone;
            const z = this._mmZones.find(zz => zz.id === zoneId);
            if (!z) return;
            let minX = Infinity, maxX = 0;
            BLDS.forEach(b => { if (z.match(b)) { if (b.x < minX) minX = b.x; if (b.x + b.w > maxX) maxX = b.x + b.w; }});
            el.classList.toggle('active', camCenter >= minX && camCenter <= maxX);
        });
    },
  
    init() {
      Object.keys(LABS).forEach(key => { 
          if (!LABS[key].icon || LABS[key].icon === '🏗️') { LABS[key].icon = this.getLabIcon(key); } 
          // FIX: CoreLabRegions is the ground-truth for known labs.
          // The old check `if (!LABS[key].region)` never fired because
          // fetchCoreData() already set every lab to 'eu' as a fallback,
          // making the condition always false and bypassing CoreLabRegions entirely.
          if (CoreLabRegions[key]) {
              LABS[key].region = CoreLabRegions[key];
          } else if (!LABS[key].region) {
              LABS[key].region = 'eu';
          }
      });
      
      if (typeof UI !== 'undefined' && UI.selectBld) {
          const origSelect = UI.selectBld;
          UI.selectBld = function(b) {
              origSelect.call(UI, b);
              setTimeout(() => {
                  const p = document.getElementById('infoPanel');
                  if (p && b && b.id !== 'park' && b.id !== 'graveyard' && b.id !== 'visitor_monument') {
                      const titleArea = p.querySelector('.ipanel-name') || p.querySelector('.ipanel-title');
                      if (!document.getElementById('btnInside')) {
                          const btn = document.createElement('button');
                          btn.id = 'btnInside';
                          btn.innerHTML = '🏢 GO INSIDE';
                          btn.style.cssText = 'background:var(--ac); color:#000; border:none; padding:6px 10px; border-radius:4px; cursor:pointer; font-size:10px; margin-left:15px; font-family:"Press Start 2P", monospace; display:inline-block; vertical-align:middle;';
                          btn.onclick = () => { if(typeof SND !== 'undefined') SND.uiClick(); G.enterInterior(b); };
                          
                          if (titleArea) { titleArea.appendChild(btn); } 
                          else { p.insertBefore(btn, p.firstChild); }
                      }
                  }
              }, 50);
          };
      }

      if (typeof SND !== 'undefined') SND.init(); 
      if (typeof NOTIFY !== 'undefined') NOTIFY.init();
      
      this.models = [...SEED]; 
      this.load(); 
      this.pingRings = [];
      
      BLDS.forEach(b => { 
          this.bldById[b.id] = b; 
          if (b.lab) { 
              if (!this.bldsByLab[b.lab]) this.bldsByLab[b.lab] = []; 
              if (!b.id.startsWith('house_')) {
                  this.bldsByLab[b.lab].unshift(b); 
              } else {
                  this.bldsByLab[b.lab].push(b); 
              }
          } 
      });
      
      // ─── SPACE ZONE: Inject space buildings before zoning ───
      if (typeof SpaceData !== 'undefined') SpaceData.init();
      
      // ─── Register nightlife activity ───
      if (typeof ACTS !== 'undefined') {
          if (!ACTS.nightlife) ACTS.nightlife = { label: 'Nightlife', verb: 'partying', icon: '🍸', indoor: true };
      }
      
      // ─── Visitor tracking ───
      if (typeof VisitorTracker !== 'undefined') {
          VisitorTracker.init();
          setInterval(() => VisitorTracker.refresh(), 120000); // refresh every 2 min
      }
      
      // ─── COMPUTE DISTRICT: Check construction completions ───
      if (typeof DCManager !== 'undefined') DCManager.checkCompletions();
      
      // ─── NPC HOUSING: Initialize buildings ───
      if (typeof NPCHousing !== 'undefined') NPCHousing.init();
      if (typeof PowerZone !== 'undefined') PowerZone.init();
      
      this.recalculateZoning(); 
      
      
      this.socialSpots = BLDS.filter(b => ['cafe', 'open_square', 'gym', 'arena', 'forest_0'].includes(b.id));
      
      // Add Frontier Pines as a social destination when a launch is within 2 hours
      if (typeof SpaceData !== 'undefined' && SpaceData.launches && SpaceData.launches.length > 0) {
          const now = Date.now();
          const imminentLaunch = SpaceData.launches.find(l => {
              const diff = new Date(l.net).getTime() - now;
              return diff > -300000 && diff < 7200000; // within 2 hours or just happened
          });
          if (imminentLaunch) {
              const fp = BLDS.find(b => b.id === 'forest_space');
              if (fp && !this.socialSpots.includes(fp)) {
                  this.socialSpots.push(fp);
              }
          }
      }
  
      const vp = document.getElementById('viewport'); 
      this.vpW = window.innerWidth; 
      this.vpH = window.innerHeight;
      this.groundY = this.vpH - 56;
      
      this.app = new PIXI.Application({ width: this.vpW, height: this.vpH, backgroundAlpha: 0, antialias: false, resolution: window.devicePixelRatio || 1, autoDensity: true });
      vp.appendChild(this.app.view); 
      this.app.view.style.touchAction = 'none';

      // ─── RESIZE HANDLER ───
      // groundY is a WORLD coordinate, not a screen coordinate.
      // It is set ONCE at init and NEVER changes. The camera maps world→screen.
      // Read from window (not vp element) to avoid feedback loop with canvas resize.
      window.addEventListener('resize', () => {
          this.vpW = window.innerWidth;
          this.vpH = window.innerHeight;
          this.app.renderer.resize(this.vpW, this.vpH);
          if (this.viewMode === 'macro') this.buildMacroLayer();
      });
      
      // Alt-tab: browser toolbar may appear/disappear without firing resize
      document.addEventListener('visibilitychange', () => {
          if (!document.hidden) {
              this.vpW = window.innerWidth;
              this.vpH = window.innerHeight;
              this.app.renderer.resize(this.vpW, this.vpH);
          }
      });
      
      this.world = new PIXI.Container(); 
      this.macroLayer = new PIXI.Container(); 
      this.app.stage.addChild(this.world); 
      this.app.stage.addChild(this.macroLayer); 
      this.macroLayer.visible = false;
      
      if (PIXI.filters && PIXI.filters.AdvancedBloomFilter) {
          this.bloomFilter = new PIXI.filters.AdvancedBloomFilter({ threshold: 0.6, bloomScale: 1.2, brightness: 1.0, blur: 6, quality: 4 });
          this.world.filters = [this.bloomFilter];
          this.crtFilter = new PIXI.filters.CRTFilter({ curvature: 2, lineContrast: 0.25, vignetting: 0.3, vignettingAlpha: 0.7, noise: 0.15, seed: Math.random() });
          this.glitchFilter = new PIXI.filters.GlitchFilter({ slices: 6, offset: 4, direction: 0, fillMode: 2, average: false }); 
          this.macroLayer.filters = [this.crtFilter, this.glitchFilter];
      }
  
      this.starsLayer = new PIXI.Container(); 
      this.celestialGfx = new PIXI.Graphics(); 
      this.cloudLayer = new PIXI.Container();
      this.bldLayer = new PIXI.Container(); 
      this.groundGfx = new PIXI.Graphics(); 
      this.reflectionLayer = new PIXI.Container();
      this.undergroundLayer = new PIXI.Container();
      this.trainLayer = new PIXI.Container();
      
      this.charLayer = new PIXI.Container(); 
      this.charLayer.sortableChildren = true;
      this.carLayer = new PIXI.Container(); 
      this.carLayer.sortableChildren = true;
      this.lightLayer = new PIXI.Container(); 
      this.lightLayer.alpha = 0; 
      this.staticLightsGfx = new PIXI.Graphics();
      this.lightLayer.addChild(this.staticLightsGfx);
      this.fxGfx = new PIXI.Graphics();
      
      this.world.addChild(this.starsLayer, this.celestialGfx, this.cloudLayer, this.bldLayer, this.undergroundLayer, this.trainLayer, this.groundGfx, this.reflectionLayer, this.charLayer, this.carLayer, this.lightLayer, this.fxGfx);
      
      if (typeof Environment !== 'undefined') {
          Environment.init({ starsLayer: this.starsLayer, celestialGfx: this.celestialGfx, cloudLayer: this.cloudLayer, bldLayer: this.bldLayer, groundGfx: this.groundGfx, reflectionLayer: this.reflectionLayer, staticLightsGfx: this.staticLightsGfx, lightLayer: this.lightLayer, fxGfx: this.fxGfx });
      }
      
      if (typeof Entities !== 'undefined') {
          Entities.init({ 
              charLayer: this.charLayer, 
              carLayer: this.carLayer, 
              reflectionLayer: this.reflectionLayer, 
              lightLayer: this.lightLayer,
              undergroundLayer: this.undergroundLayer, 
              trainLayer: this.trainLayer              
          });
      }
      
      // ─── NPC HOUSING: Spawn commuter NPCs ───
      if (typeof NPCHousing !== 'undefined' && this.charLayer) {
          NPCHousing.spawnCommuters(this.charLayer);
      }
      
      // ─── PORT ZONE: Ships + Ocean Life ───
      if (typeof PortEnv !== 'undefined') {
          PortEnv.buildShips(this.charLayer);
          PortEnv.buildOceanLife(this.charLayer);
      }
      if (typeof PowerEnv !== 'undefined') {
          PowerEnv.buildAnimations(this.charLayer);
      }
      
      // ─── SPACE ENTITIES: Rockets on launch pads ───
      if (typeof SpaceEntities !== 'undefined') {
          SpaceEntities.init(this.carLayer);
      }
  
      this.evolveCity(); 
      if (typeof Entities !== 'undefined') {
          this.models.forEach(m => Entities.createChar(m));
      }
      
      if (typeof Camera !== 'undefined') {
          Camera.init();
          if (this.savedCamX !== undefined) {
              Camera.x = this.savedCamX;
              Camera.targetX = this.savedCamX;
          }
      }
      
      if (typeof API !== 'undefined') {
          API.fetchLiveNews();
          setInterval(() => API.fetchLiveNews(), 10 * 60 * 1000);
          if (this.finnhubKey) API.fetchStocks();
          setInterval(() => { 
              API.newsIdx = (API.newsIdx + 1) % (API.liveNews.length || NEWS.length); 
              if (typeof UI !== 'undefined') UI.updateTicker(); 
          }, 6000);
      }
      
      // ─── SPACE ZONE: Fetch upcoming launches ───
      if (typeof SpaceData !== 'undefined') {
          SpaceData.fetchLaunches();
          setInterval(() => SpaceData.fetchLaunches(), 30 * 60 * 1000); // every 30 min
      }
      
      // ─── HUGGING FACE: Trending open-source model discovery ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchHuggingFace(), 5000); // initial fetch after 5s
          setInterval(() => API.fetchHuggingFace(), 15 * 60 * 1000); // every 15 min
      }
      
      // ─── ZEROEVAL: Benchmark, pricing & model data (free, no-auth) ───
      if (typeof API !== 'undefined') {
          setTimeout(() => API.fetchZeroEval(), 8000); // initial fetch after 8s
          setInterval(() => API.fetchZeroEval(), 20 * 60 * 1000); // every 20 min
      }
      
      this.startAutoScan(); 
      if (typeof UI !== 'undefined') UI.updateSoundBtn();
      
      this.initMinimap();
      this.initEasterEggs();
      
      window.addEventListener('beforeunload', () => this.save());

      this.app.ticker.add(() => this.loop()); 
    },
  
    buildMacroLayer() {
      this.macroLayer.removeChildren(); 
      this.dataPackets = [];
      this.macroNodes = []; 
      this.pingRings = []; 
      const cx = this.vpW / 2; 
      const cy = this.vpH / 2;
      
      const grid = new PIXI.Graphics(); 
      grid.lineStyle(1, 0x33334a, 0.3); 
      for(let i=0; i<this.vpW; i+=50) { grid.moveTo(i, 0); grid.lineTo(i, this.vpH); } 
      for(let i=0; i<this.vpH; i+=50) { grid.moveTo(0, i); grid.lineTo(this.vpW, i); } 
      this.macroLayer.addChild(grid);
      
      const sgGfx = new PIXI.Graphics(); 
      sgGfx.beginFill(0xffffff, 0.1);
      sgGfx.drawCircle(cx, cy, 50); 
      sgGfx.endFill(); 
      sgGfx.beginFill(0xffffff, 0.5); 
      sgGfx.drawCircle(cx, cy, 20); 
      sgGfx.endFill(); 
      this.macroLayer.addChild(sgGfx); 
      this.centerNodeGfx = sgGfx; 
      
      const linesGfx = new PIXI.Graphics(); 
      this.macroLayer.addChild(linesGfx);
      
      const rad = Math.min(cx, cy) * 0.65; 
      const labsEntries = Object.entries(LABS); 
      const angleStep = (Math.PI * 2) / labsEntries.length;
      
      labsEntries.forEach(([labId, lab], i) => {
        const angle = i * angleStep; 
        const nx = cx + Math.cos(angle) * rad; 
        const ny = cy + Math.sin(angle) * rad; 
        const col = parseInt(lab.color.slice(1), 16);
        
        linesGfx.lineStyle(2, col, 0.4); 
        linesGfx.moveTo(nx, ny); 
        linesGfx.lineTo(cx, cy); 
        
        const nodeCont = new PIXI.Container(); 
        nodeCont.x = nx; 
        nodeCont.y = ny;
        
        const clusterInfo = (typeof COMPUTE_DATA !== 'undefined' && COMPUTE_DATA.clusters) ? 
                            (COMPUTE_DATA.clusters.find(c => c.lab === labId) || { name: "Remote Cluster", gpus: 0, type: "Unknown", location: "Unknown" }) :
                            { name: "Remote Cluster", gpus: 0, type: "Unknown", location: "Unknown" };
                            
        if(clusterInfo.gpus > 0) { 
            const subX = Math.cos(angle) * 60; 
            const subY = Math.sin(angle) * 60; 
            linesGfx.lineStyle(1, 0x22d3ee, 0.3); 
            linesGfx.moveTo(nx, ny); 
            linesGfx.lineTo(nx + subX, ny + subY); 
            const sub = new PIXI.Graphics(); 
            sub.beginFill(0x22d3ee); 
            sub.drawCircle(nx + subX, ny + subY, 4); 
            sub.endFill(); 
            this.macroLayer.addChild(sub); 
        }
        
        const nGfx = new PIXI.Graphics(); 
        nGfx.beginFill(col, 0.2); 
        nGfx.drawCircle(0, 0, 24); 
        nGfx.endFill(); 
        nGfx.beginFill(col, 0.8);
        nGfx.drawCircle(0, 0, 12); 
        nGfx.endFill(); 
        nodeCont.addChild(nGfx);
        
        const lbl = new PIXI.Text(lab.name, { fontSize: 10, fill: 0xffffff, fontWeight: 'bold' }); 
        lbl.anchor.set(0.5, 0.5);
        lbl.y = 32; 
        nodeCont.addChild(lbl);
        
        nodeCont.eventMode = 'static'; 
        nodeCont.cursor = 'pointer';
        nodeCont.on('pointerover', (e) => { 
            nodeCont.scale.set(1.2); 
            if (typeof UI !== 'undefined') UI.showTooltip(e, `${lab.name} Uplink`, `${clusterInfo.name}<br><span style="color:#4ade80">${(clusterInfo.gpus/1000).toFixed(0)}K GPUs</span>`, false); 
        });
        nodeCont.on('pointerout', () => { 
            nodeCont.scale.set(1.0); 
            if (typeof UI !== 'undefined') UI.hideTooltip(); 
        });
        this.macroLayer.addChild(nodeCont);
      });
      
      this.packetGfx = new PIXI.Graphics(); 
      this.macroLayer.addChild(this.packetGfx);
    },

    loop() {
      this.tick++;
      if(this.viewMode === 'micro' && typeof Entities !== 'undefined') { 
          if (this.tick > this.nextCarTick) { 
              Entities.spawnCar();
              this.nextCarTick = this.tick + 600 + Math.floor(Math.random() * 800); 
          } 
          Entities.updateChatBubbles(this.getDayPhase());
      }
      // Tracking runs every frame, even during interiors, to detect transitions
      if (this.tracking) this.updateTracking();
      // Minimap update every 10 frames
      if (this.tick % 10 === 0) this.updateMinimap();
      this.update();
    },
  
    update() {
      if (this.activeInterior && typeof Interior !== 'undefined') {
          Interior.update();
          return; 
      }

      if(this.viewMode === 'macro') {
        if(this.macroLayer.alpha < 1) this.macroLayer.alpha += 0.05;
        if(this.centerNodeGfx) this.centerNodeGfx.scale.set(1 + Math.sin(this.tick * 0.05) * 0.1);
        if (this.crtFilter && this.glitchFilter) { 
            this.crtFilter.time += 0.3; 
            this.crtFilter.seed = Math.random();
            if (Math.random() > 0.98 && this.glitchFilter.offset < 5) { 
                this.glitchFilter.refresh(); 
                this.glitchFilter.offset = 2 + Math.random() * 4;
            } else if(this.glitchFilter.offset > 0) { 
                this.glitchFilter.offset *= 0.8; 
                if(this.glitchFilter.offset < 0.5) this.glitchFilter.offset = 0;
            } 
        }
        return;
      }

      if (typeof Camera !== 'undefined') Camera.update();

      const dp = this.getDayPhase();
      const night = dp > .83 || dp < .25; 
      const targetLightAlpha = night ? 1 : 0;
      this.lightLayer.alpha += (targetLightAlpha - this.lightLayer.alpha) * 0.05;

      let occ = {};
      if (typeof Entities !== 'undefined') occ = Entities.update(dp, night);
      if (typeof Environment !== 'undefined') Environment.update(dp, night, occ);
      if (typeof SpaceEntities !== 'undefined') SpaceEntities.update();
      if (typeof NPCHousing !== 'undefined') NPCHousing.update(dp);
      if (typeof PortEnv !== 'undefined') PortEnv.update();
      if (typeof PowerEnv !== 'undefined') PowerEnv.update();
  
      if (this.tick % 60 === 0) {
        // NOTE: Building sign/window occupancy updates are handled by Environment.update()

        const hh = Math.floor(dp * 24), mn = Math.floor((dp * 1440) % 60);
        const ts = `${String(hh).padStart(2, '0')}:${String(mn).padStart(2, '0')}`;
        let lbl; 
        if (hh < 6) lbl = 'Night';
        else if (hh < 8) lbl = 'Dawn'; 
        else if (hh < 12) lbl = 'Morning';
        else if (hh < 14) lbl = 'Lunch'; 
        else if (hh < 17) lbl = 'Afternoon';
        else if (hh < 20) lbl = 'Evening'; 
        else lbl = 'Night';
        
        const now = Date.now();
        const alive = this.models.filter(m => !m.ret || new Date(m.ret).getTime() > now).length; 
        const dead = this.models.length - alive;
        const disc = this.models.filter(m => m._src).length; 
        const preT = this.models.filter(m => ['rumored', 'pre_training', 'training'].includes(m.phase)).length;
        const wI = (typeof Environment !== 'undefined') ? (Environment.weather === 'rain' ? '🌧️' : Environment.weather === 'snow' ? '❄️' : Environment.weather === 'cherry' ? '🌸' : '') : '';
        
        const nfoEl = document.getElementById('nfo');
        if (nfoEl) {
            const labCount = new Set(this.models.map(m => m.lab)).size;
            const estateCount = typeof BLDS !== 'undefined' ? BLDS.filter(b => b.id.startsWith('house_')).length : 0;
            nfoEl.innerHTML = `<span title="Current time of day in Singularity City — ${lbl}">🕒 <span class="st">${ts}</span></span><span style="font-size:7px;color:var(--ac)" title="City is running live — all data updates in real time">● LIVE</span><span title="Active AI model citizens currently in the city">👥 <span class="st">${alive}</span></span><span title="${labCount} AI labs with districts in the city">🏢 <span class="st">${labCount}</span></span><span title="${estateCount} CEO/Founder estates on Billionaire's Row">🏛️ <span class="st">${estateCount}</span></span>${preT > 0 ? `<span title="Models currently in pre-training, training, or rumored phase">🔬 <span class="st" style="color:var(--pk)">${preT}</span></span>` : ''}<span title="${dead} retired or deprecated models (visible as ghosts)">👻 <span class="st">${dead}</span></span>${disc > 0 ? `<span title="${disc} models discovered via network scans by all players globally">🛰️ <span class="st" style="color:var(--cy)">${disc}</span></span>` : ''}${wI ? `<span title="Current weather: ${Environment.weather || 'clear'}">${wI}</span>` : ''}${this.autoScanMin > 0 ? `<span style="font-size:7px;color:var(--cy)" title="Auto-scan interval — scanning for new models every ${this.autoScanMin} minutes">🔄 ${this.autoScanMin}m</span>` : ''}`;
        }
      }
    },
    
    celebrate() { if (typeof SND !== 'undefined') SND.launch(); },
    
    dramaticLaunch(name) { 
        if (typeof SND !== 'undefined') SND.launch(); 
        if (typeof UI !== 'undefined') UI.addToast(`🎉 ${name} HAS ARRIVED IN SINGULARITY CITY!`); 
        if (typeof NOTIFY !== 'undefined') NOTIFY.send('New Model Born!', `${name} has arrived!`); 
    }
};

(function() {
  const uiFix = document.createElement('style');
  uiFix.innerHTML = `
      #nfo {
          position: absolute !important;
          left: 50% !important;
          transform: translateX(-50%) !important;
          margin: 0 !important;
          z-index: 100;
      }
  `;
  document.head.appendChild(uiFix);

  const ls = document.getElementById('landStars');
  if (ls) { 
      for (let i = 0; i < 80; i++) { 
          const s = document.createElement('div'); 
          s.className = 'land-star'; 
          s.style.cssText = `left:${Math.random() * 100}%;top:${Math.random() * 100}%;width:${Math.random() * 2 + .5}px;height:${Math.random() * 2 + .5}px;animation-delay:${Math.random() * 3}s`; 
          ls.appendChild(s); 
      } 
  }
  const sk = document.getElementById('landSkyline'); 
  if (sk) { 
      [40, 65, 90, 55, 70, 45, 80, 50, 35, 60, 75, 45, 85, 55, 40].forEach(h => { 
          const b = document.createElement('div');
          b.className = 'land-bld'; 
          b.style.cssText = `width:${20 + Math.random() * 30}px;height:${h + Math.random() * 20}px`; 
          sk.appendChild(b); 
      }); 
  }
})();

async function enterCity() {
  const btn = document.querySelector('.land-enter');
  if (btn) {
      btn.innerHTML = '⏳ Downloading City Data...';
      btn.disabled = true;
      btn.style.opacity = '0.7';
  }

  if (typeof API !== 'undefined') {
      API.initSupabase();
      await API.fetchCoreData();
  }

  G.init();

  // Initialize 3D Holomap (Three.js galaxy view)
  if (typeof Holomap !== 'undefined') Holomap.init();

  if (typeof API !== 'undefined') {
      await API.fetchCloudModels();
  }

  const instrOv = document.getElementById('instrOv'); 
  if (instrOv) instrOv.classList.remove('open');
  const l = document.getElementById('landing'); 
  if (l) l.classList.add('exit');
  const gw = document.getElementById('gameWrap'); 
  if (gw) gw.classList.add('active');
  if (l) setTimeout(() => l.remove(), 900);
  
  if (typeof SND !== 'undefined') {
      SND.init();
      SND.setAmbient('outside');
  }
}
