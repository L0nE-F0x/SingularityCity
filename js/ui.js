/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   DOM & UI LAYER (v16.0.2 - Scrollable Info Panels)
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const escapeHTML = (str) => {
    if (!str) return '';
    return String(str).replace(/[&<>'"]/g, tag => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
    }[tag] || tag));
};

const NOTIFY = {
    permission: 'default',
    async init() {
      if ('Notification' in window) {
        this.permission = Notification.permission;
        if (this.permission === 'default') this.permission = await Notification.requestPermission();
      }
    },
    send(t, b) {
      if (this.permission === 'granted') {
        try { new Notification(t, { body: b, icon: '/icon-192.png', badge: '/favicon-32.png' });
        } catch(e) {}
      }
    }
};

const UI = {
    scanLog: [],
    compareList: [],
    selModel: null,
    selBld: null,
    eloChart: null, 
    roiChart: null, 
  
    updateTicker() {
      const el = document.getElementById('tickerText');
      if (!el) return;
      el.style.animation = 'none';
      el.offsetHeight; 
      el.style.animation = 'ts .4s ease';
      
      // Mix real news with dynamic city events (70% news, 30% city events)
      let item = null;
      const useCityEvent = Math.random() < 0.3 && G.models.length > 10;
      
      if (useCityEvent) {
          item = this.generateCityTickerEvent();
      }
      
      if (!item) {
          const src = (typeof API !== 'undefined' && API.liveNews && API.liveNews.length > 0) ? API.liveNews : NEWS;
          const rawItem = src[(typeof API !== 'undefined' ? API.newsIdx : 0) % src.length] || { headline: 'Welcome to Singularity City!', url: '#' };
          item = rawItem;
      }
      
      const safeHeadline = escapeHTML(item.headline || item.text || '');
      
      if (item.url && item.url !== '#') {
        const safeSource = escapeHTML(item.source || '');
        const safeUrl = encodeURI(item.url);
        const sb = item.source ? `<span style="color:var(--cy);font-size:8px;margin-right:6px">[${safeSource}]</span>` : '';
        el.innerHTML = `📰 ${sb}<a href="${safeUrl}" target="_blank" rel="noopener" style="color:var(--t1);text-decoration:none">${safeHeadline}</a>`;
      } else {
        const icon = item.icon || '📰';
        const color = item.color || 'var(--t1)';
        el.innerHTML = `<span style="color:${color}">${icon} ${safeHeadline}</span>`;
      }
    },
    
    generateCityTickerEvent() {
        if (!G.models || G.models.length === 0) return null;
        const roll = Math.random();
        
        // Benchmark milestone — find current top model
        if (roll < 0.2) {
            const withElo = G.models.filter(m => BM[m.id] && BM[m.id].ELO).sort((a, b) => (BM[b.id].ELO || 0) - (BM[a.id].ELO || 0));
            if (withElo.length >= 2) {
                const top = withElo[0];
                const lab = LABS[top.lab] || { name: top.lab };
                return { headline: `${top.name} holds the #1 ELO ranking at ${BM[top.id].ELO} — ${lab.name} leads the frontier`, icon: '👑', color: '#fbbf24' };
            }
        }
        
        // Model population milestone
        if (roll < 0.35) {
            const count = G.models.length;
            const labs = new Set(G.models.map(m => m.lab)).size;
            return { headline: `Singularity City population: ${count} AI models across ${labs} labs`, icon: '🏙️', color: '#4ade80' };
        }
        
        // Lab rivalry — compare two random labs
        if (roll < 0.5) {
            const labKeys = Object.keys(LABS).filter(k => G.models.some(m => m.lab === k));
            if (labKeys.length >= 2) {
                const a = labKeys[Math.floor(Math.random() * labKeys.length)];
                let b = labKeys[Math.floor(Math.random() * labKeys.length)];
                while (b === a && labKeys.length > 1) b = labKeys[Math.floor(Math.random() * labKeys.length)];
                const countA = G.models.filter(m => m.lab === a).length;
                const countB = G.models.filter(m => m.lab === b).length;
                return { headline: `${LABS[a].name} (${countA} models) vs ${LABS[b].name} (${countB} models) — the race continues`, icon: '⚔️', color: '#a78bfa' };
            }
        }
        
        // Cheapest API callout
        if (roll < 0.65) {
            const withCost = G.models.filter(m => COSTS[m.id] && COSTS[m.id].input && COSTS[m.id].input > 0);
            if (withCost.length > 0) {
                const cheapest = withCost.sort((a, b) => COSTS[a.id].input - COSTS[b.id].input)[0];
                return { headline: `Budget pick: ${cheapest.name} at $${COSTS[cheapest.id].input}/1M input tokens`, icon: '💰', color: '#4ade80' };
            }
        }

        // Random model spotlight
        if (roll < 0.8) {
            const active = G.models.filter(m => !m.retired && !m.ret);
            if (active.length > 0) {
                const m = active[Math.floor(Math.random() * active.length)];
                const lab = LABS[m.lab] || { name: m.lab };
                const avg = avgBM(m.id);
                const stat = avg ? ` — avg benchmark: ${avg}%` : '';
                return { headline: `Spotlight: ${m.name} by ${lab.name}${stat}`, icon: '✦', color: lab.color || '#22d3ee' };
            }
        }
        
        // Time of day flavor
        const dp = G.getDayPhase();
        if (dp < 0.25) return { headline: 'Night shift: AI models are sleeping in the residential zone', icon: '🌙', color: '#94a3b8' };
        if (dp < 0.35) return { headline: 'Dawn commute: models heading to their HQs via metro', icon: '🌅', color: '#fb923c' };
        if (dp > 0.45 && dp < 0.55) return { headline: 'Lunch rush at the café — models socializing in the park', icon: '☕', color: '#fbbf24' };
        if (dp > 0.82) return { headline: 'Evening commute: models heading home to the residential zone', icon: '🌆', color: '#f97316' };
        
        return { headline: `${G.models.length} AI citizens going about their day in Singularity City`, icon: '🏙️', color: '#22d3ee' };
    },
  
    uiClick() {
      if(typeof SND !== 'undefined') SND.uiClick();
      if(typeof haptic === 'function') haptic(10);
    },
  
    toggleLog() {
      document.getElementById('scanLog').classList.toggle('open');
      document.getElementById('btnLog').classList.toggle('on');
    },
  
    addLog(msg) {
      this.scanLog.unshift({ t: new Date().toLocaleTimeString(), msg });
      if (this.scanLog.length > 50) this.scanLog.length = 50;
      document.getElementById('logEntries').innerHTML = this.scanLog.map(e => `<div class="slog-e"><span class="slog-tm">${e.t}</span>${e.msg}</div>`).join('');
    },
  
    addToast(msg) {
      const el = document.getElementById('toasts');
      const t = document.createElement('div');
      t.className = 'toast';
      t.textContent = msg;
      el.prepend(t);
      setTimeout(() => t.remove(), 6000);
    },
  
    toggleSound() {
      if(typeof SND !== 'undefined') {
          SND.enabled = !SND.enabled;
          this.updateSoundBtn();
          G.save();
      }
    },
  
    updateSoundBtn() {
      const b = document.getElementById('btnSound');
      if (b && typeof SND !== 'undefined') b.textContent = SND.enabled ? '🔊' : '🔇';

      let mb = document.getElementById('btnMusic');
      if (!mb && b) {
          mb = document.createElement('button');
          mb.id = 'btnMusic';
          mb.className = b.className; 
          mb.style.cssText = b.style.cssText;
          mb.style.marginLeft = '8px';
          mb.style.transition = 'opacity 0.2s';
          mb.onclick = () => { 
              if (typeof SND !== 'undefined') { 
                  SND.toggleMusic(); 
                  UI.updateSoundBtn(); 
              } 
          };
          b.parentNode.insertBefore(mb, b.nextSibling);
      }
      
      if (mb && typeof SND !== 'undefined') {
          mb.textContent = '🎵';
          mb.style.opacity = SND.musicEnabled ? '1' : '0.4';
      }
    },
  
    closePanel() {
      document.getElementById('infoPanel').className = 'ipanel';
      this.selModel = null;
      this.selBld = null;
      
      if (UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
      if (UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }
    },
  
    showTooltip(e, title, sub, hint) {
      const tt = document.getElementById('gameTooltip');
      tt.innerHTML = `<div class="tt-name">${title}</div><div class="tt-sub">${sub}</div>${hint ? '<div class="tt-hint">Click for details</div>' : ''}`;
      tt.style.display = 'block';
      
      const gp = e.data?.global || e.global || { x: 0, y: 0 };
      const vpRect = document.getElementById('viewport').getBoundingClientRect();
      
      let tx = vpRect.left + gp.x;
      let ty = vpRect.top + gp.y - 50;
      
      const ttW = tt.offsetWidth;
      if (tx - (ttW / 2) < 10) tx = (ttW / 2) + 10;
      if (tx + (ttW / 2) > window.innerWidth - 10) tx = window.innerWidth - (ttW / 2) - 10;
      
      tt.style.left = tx + 'px';
      tt.style.top = ty + 'px';
    },
  
    hideTooltip() {
      document.getElementById('gameTooltip').style.display = 'none';
    },
  
    addToCompare(id) {
      if (this.compareList.includes(id)) return;
      if (this.compareList.length >= 4) this.compareList.shift();
      this.compareList.push(id);
      this.addToast(`⚖️ Compare (${this.compareList.length}/4)`);
      G.unlockAchieve('compared');
      if (this.compareList.length >= 2) this.showCompare();
    },
  
    selectModel(m) {
      if (m.isCeo && m.founderData) {
          this.showFounder(m.founderData);
          return;
      }
      
      if (m.isNPC || (!m.arch && !m.benchmarks && !m.phase && !m._src)) {
          this.showNPC(m);
          return;
      }

      this.selModel = m;
      this.selBld = null;
      const stg = getStage(m.rel, m.ret, m.phase); const sd = STAGES[stg]; 
      const lab = LABS[m.lab] || LABS.other || {name: 'Unknown', color: '#64748b', icon: '🌐'};
      const idx = G.models.indexOf(m);
      const dp = G.getDayPhase(); 
      const { act } = getAct(stg, dp, idx, m); 
      const ai = ACTS[act] || {icon: '💻', verb: 'processing', label: 'Processing'};
      const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
      const p = document.getElementById('infoPanel');
      p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight;
      p.style.animation = 'pi .25s ease';
      const isPre = ['rumored', 'pre_training', 'training'].includes(m.phase);
      
      p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
        <div class="ipanel-top" style="background:linear-gradient(135deg,${lab.color}22,transparent);border-bottom:2px solid ${lab.color}33">
          <div class="ipanel-av" style="background:${lab.color};color:#fff;font-size:24px">${lab.icon}</div>
          <div style="flex:1"><div class="ipanel-name">${escapeHTML(m.name)} ${m.os ? '<span style="font-size:8px;color:#4ade80">🔓</span>' : ''}</div><div class="ipanel-sub" style="color:${lab.color}">${lab.name}</div></div>
          <div class="ipanel-badge" style="background:${isPre ? '#8b5cf6' : stg === 'retired' ? '#7a7f8a' : 'var(--ac)'};color:#000">${sd.emoji} ${sd.label}</div>
        </div>
        <div class="ipanel-act"><span style="font-size:14px">${ai.icon}</span><span class="ipanel-act-text">Currently ${ai.verb}</span></div>
        ${isPre ? '<div style="font-size:8px;color:#8b5cf6;padding:4px 10px;background:#8b5cf622;border:1px solid #8b5cf633;border-radius:3px;margin:4px 16px;text-align:center">🔬 Not Yet Released</div>' : ''}
        ${m._src ? '<div style="font-size:8px;color:var(--cy);padding:4px 10px;background:#22d3ee0a;border:1px solid #22d3ee22;border-radius:3px;margin:4px 16px;text-align:center">🛰️ Discovered via Scan</div>' : ''}
        <div class="ipanel-tabs"><button class="ipanel-tab active" onclick="UI.panelTab('info',this)">👤 Profile</button><button class="ipanel-tab" onclick="UI.panelTab('bench',this)">📊 Bench</button><button class="ipanel-tab" onclick="UI.panelTab('cost',this)">💰 Cost</button></div>
        <div id="panelContent" style="max-height: calc(100vh - 280px); overflow-y: auto; overflow-x: hidden; padding-right: 4px; padding-bottom: 10px;"></div>
        <div style="padding:8px 16px;display:flex;gap:6px"><button class="btn" style="flex:1;text-align:center" onclick="UI.addToCompare('${m.id}')">⚖️ Compare</button><button class="btn" style="flex:1;text-align:center;${G.tracking && G.tracking.id === m.id ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.id==='${m.id}' ? G.stopTracking() : G.startTracking('model','${m.id}','${m.lab}')">${G.tracking && G.tracking.id === m.id ? '📡 Tracking' : '📡 Track'}</button></div>`;
      this.panelTab('info');
    },

    showNPC(m) {
        this.selModel = m;
        this.selBld = null;
        const p = document.getElementById('infoPanel');
        p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
        const col = '#94a3b8';
        const safeName = escapeHTML(m.name || 'Service Unit');
        const safeRole = escapeHTML(m.role || m.job || 'Facility Maintenance');
        
        p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
          <div class="ipanel-top" style="background:linear-gradient(135deg,${col}22,transparent);border-bottom:2px solid ${col}33">
            <div class="ipanel-av" style="background:${col};color:#fff;font-size:24px">🤖</div>
            <div style="flex:1"><div class="ipanel-name">${safeName}</div><div class="ipanel-sub" style="color:${col}">${safeRole}</div></div>
            <div class="ipanel-badge" style="background:var(--cd);color:var(--t2);border:1px solid var(--bd)">NPC</div>
          </div>
          <div style="max-height: calc(100vh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
              <p class="ipanel-desc">${escapeHTML(m.desc || 'A specialized, non-sentient utility construct designed to assist with city operations.')}</p>
              <div class="ipanel-grid">
                <div class="ipanel-stat"><span class="ipanel-lbl">System Status</span><span class="ipanel-val" style="color:#4ade80">Online</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Function</span><span class="ipanel-val">${safeRole}</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Sentience</span><span class="ipanel-val" style="color:var(--t3)">Restricted</span></div>
                <div class="ipanel-stat"><span class="ipanel-lbl">Network</span><span class="ipanel-val" style="color:var(--t3)">Local Intranet</span></div>
              </div>
              ${m._trackType ? `<div style="padding:8px 0"><button class="btn" style="width:100%;text-align:center;${G.tracking && G.tracking.id === m.id ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.id==='${m.id}' ? G.stopTracking() : G.startTracking('${m._trackType}','${m.id}','other')">${G.tracking && G.tracking.id === m.id ? '📡 Tracking' : '📡 Track'}</button></div>` : ''}
          </div>`;
    },
  
    panelTab(tab, btn) {
      document.querySelectorAll('.ipanel-tab').forEach(t => t.classList.remove('active'));
      if (btn) btn.classList.add('active'); else document.querySelector('.ipanel-tab')?.classList.add('active');
      const m = this.selModel; if (!m) return; const ct = document.getElementById('panelContent'); if (!ct) return;
      
      if (tab !== 'bench' && UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
      if (tab !== 'cost' && UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }

      if (tab === 'info') {
        const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
        ct.innerHTML = `<p class="ipanel-desc">${escapeHTML(m.desc)}</p><div class="ipanel-grid" style="border-bottom: 1px dashed var(--bd); padding-bottom: 10px;">
          <div class="ipanel-stat"><span class="ipanel-lbl">Born</span><span class="ipanel-val">${m.phase && m.phase !== 'released' ? 'Est. ' + new Date(m.rel).toLocaleDateString('en-US', { month: 'short', year: 'numeric' }) : new Date(m.rel).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span></div>
          ${m.ret ? `<div class="ipanel-stat"><span class="ipanel-lbl">Retired</span><span class="ipanel-val" style="color:#7a7f8a">${new Date(m.ret).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span></div>` : ''}
          <div class="ipanel-stat"><span class="ipanel-lbl">Personality</span><span class="ipanel-val">${escapeHTML(m.per)}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Talent</span><span class="ipanel-val">${escapeHTML(m.tal)}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Fav Spot</span><span class="ipanel-val">${escapeHTML(m.fav)}</span></div>
          ${avg ? `<div class="ipanel-stat"><span class="ipanel-lbl">Avg Score</span><span class="ipanel-val" style="color:${avg > 80 ? '#4ade80' : avg > 50 ? '#facc15' : '#ef4444'}">${avg}%</span></div>` : ''}
          </div>
          <div class="arch-title">⚡ Deep Architecture</div>
          <div class="ipanel-grid" style="padding-top:5px">
            <div class="ipanel-stat"><span class="ipanel-lbl">Parameters</span><span class="ipanel-val" style="color:var(--cy)">${m.arch?.params || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Topology</span><span class="ipanel-val" style="color:var(--ac)">${m.arch?.type || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Training Data</span><span class="ipanel-val">${m.arch?.tokens || 'Unknown'}</span></div>
            <div class="ipanel-stat"><span class="ipanel-lbl">Compute FLOPs</span><span class="ipanel-val" style="color:#facc15">${m.arch?.compute || 'Unknown'}</span></div>
          </div>`;
      } 
      else if (tab === 'bench') {
        const sc = BM[m.id] || m.benchmarks || {};
        if (Object.keys(sc).length === 0) { ct.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);font-size:10px">No benchmark data.</div>'; return; }
        
        let html = Object.entries(BM_M).map(([k, bm]) => {
          const v = sc[k] !== undefined ? sc[k] : sc[k.toUpperCase()] || 0; 
          const fw = k === 'ELO' ? (v ? Math.min(100, (v - 1000) / 4.5) : 0) : Math.min(100, v); const dv = k === 'ELO' ? (v || '—') : (v ? v + '%' : '—');
          return `<div class="bench-row"><div class="bench-hdr"><span class="bench-name">${bm.l}</span><span class="bench-score" style="color:${bm.c}">${dv}</span></div><div class="bench-bg"><div class="bench-fill" style="width:${fw}%;background:linear-gradient(90deg,${bm.c}88,${bm.c})"></div></div><div class="bench-desc">${bm.d}</div></div>`;
        }).join('');
        
        html += `<div class="arch-title" style="margin-top: 15px;">📈 Historical ELO Trajectory</div>
                 <div class="chart-wrapper"><canvas id="eloChartCanvas"></canvas></div>`;
        
        ct.innerHTML = html;

        setTimeout(() => {
            const ctx = document.getElementById('eloChartCanvas');
            if (!ctx || typeof Chart === 'undefined') return;
            
            if (UI.eloChart) { UI.eloChart.destroy(); UI.eloChart = null; }
            
            const currentElo = BM[m.id]?.ELO || 1000;
            const history = [currentElo - 60, currentElo - 25, currentElo - 10, currentElo + 5, currentElo];
            const labColor = (LABS[m.lab] || LABS.other || {color: '#64748b'}).color;

            UI.eloChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'Now'],
                    datasets: [{
                        label: 'Arena ELO',
                        data: history,
                        borderColor: labColor,
                        backgroundColor: `${labColor}22`,
                        borderWidth: 2,
                        fill: true,
                        tension: 0.4,
                        pointBackgroundColor: '#fff',
                        pointRadius: 3
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: { grid: { color: '#33334a' }, ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } },
                        y: { grid: { color: '#33334a' }, ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } }
                    }
                }
            });
        }, 10);

      } 
      else if (tab === 'cost') {
        const c = COSTS[m.id];
        if (!c || (c.input === undefined && c.output === undefined)) { ct.innerHTML = '<div style="padding:20px;text-align:center;color:var(--t3);font-size:10px">No pricing data.</div>'; return; }
        const a = typeof avgBM === 'function' ? avgBM(m.id) : 0; const bang = a && c.output ? (a / c.output).toFixed(1) : null;
        
        let html = `<div class="ipanel-grid" style="margin-top:10px; border-bottom: 1px dashed var(--bd); padding-bottom: 15px;">
          <div class="ipanel-stat"><span class="ipanel-lbl">Input</span><span class="ipanel-val" style="color:#4ade80">$${c.input}/1M</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Output</span><span class="ipanel-val" style="color:#facc15">$${c.output}/1M</span></div>
          ${CTX[m.id] ? `<div class="ipanel-stat"><span class="ipanel-lbl">Context</span><span class="ipanel-val">${CTX[m.id] >= 1e6 ? (CTX[m.id] / 1e6).toFixed(1).replace('.0','') + 'M' : (CTX[m.id] / 1e3).toFixed(0) + 'K'}</span></div>` : ''}
          ${bang ? `<div class="ipanel-stat"><span class="ipanel-lbl">Bang/Buck</span><span class="ipanel-val" style="color:#22d3ee">${bang}</span></div>` : ''}</div>`;
        
        html += `<div class="arch-title" style="margin-top: 15px;">💰 Compute ROI Matrix</div>
                 <div class="chart-wrapper" style="height: 250px;"><canvas id="roiChartCanvas"></canvas></div>`;
                 
        ct.innerHTML = html;

        setTimeout(() => {
            const ctx = document.getElementById('roiChartCanvas');
            if (!ctx || typeof Chart === 'undefined') return;
            
            if (UI.roiChart) { UI.roiChart.destroy(); UI.roiChart = null; }
            
            const scatterData = G.models.filter(x => COSTS[x.id] && typeof avgBM === 'function' && avgBM(x.id)).map(x => {
                const isSelected = x.id === m.id;
                const lab = LABS[x.lab] || LABS.other || {color: '#64748b'};
                return {
                    x: COSTS[x.id].output,
                    y: avgBM(x.id),
                    modelName: x.name,
                    backgroundColor: isSelected ? '#ffffff' : lab.color,
                    radius: isSelected ? 7 : 4,
                    borderColor: isSelected ? '#000' : 'transparent',
                    borderWidth: isSelected ? 2 : 0
                };
            });

            UI.roiChart = new Chart(ctx, {
                type: 'scatter',
                data: {
                    datasets: [{
                        label: 'Models',
                        data: scatterData,
                        backgroundColor: scatterData.map(d => d.backgroundColor),
                        borderColor: scatterData.map(d => d.borderColor),
                        borderWidth: scatterData.map(d => d.borderWidth),
                        pointRadius: scatterData.map(d => d.radius),
                        pointHoverRadius: 8
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { display: false },
                        tooltip: {
                            backgroundColor: 'rgba(10,10,25,0.95)',
                            titleFont: { family: 'JetBrains Mono', size: 11 },
                            bodyFont: { family: 'JetBrains Mono', size: 10 },
                            borderColor: '#33334a',
                            borderWidth: 1,
                            callbacks: {
                                label: function(ctx) { return `${ctx.raw.modelName}: $${ctx.raw.x} / ${ctx.raw.y}%`; }
                            }
                        }
                    },
                    scales: {
                        x: { 
                            title: { display: true, text: 'Output Cost ($/1M)', color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } }, 
                            grid: { color: '#33334a' }, 
                            ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } 
                        },
                        y: { 
                            title: { display: true, text: 'Avg Score (%)', color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } }, 
                            grid: { color: '#33334a' }, 
                            ticks: { color: '#a0a0b8', font: { size: 9, family: 'JetBrains Mono' } } 
                        }
                    }
                }
            });
        }, 10);
      }
    },
  
    selectBld(b) {
      this.selBld = b;
      this.selModel = null; 
      const lab = b.lab ? LABS[b.lab] : null;
      const isDcFab = b.id.startsWith('dc_') || b.id.startsWith('fab_');
      
      // Color: use DC operator color if lab not found
      let col;
      if (isDcFab) {
          col = (lab && lab.color) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].color) || (b.dcData && b.dcData.color) || '#06b6d4';
      } else {
          col = lab ? lab.color : b.color || '#6b7280';
      }
      
      const p = document.getElementById('infoPanel'); 
      p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
      
      const safeDesc = escapeHTML(b.desc || 'An unassigned architectural structure.');
      const safeName = escapeHTML(b.name || 'Unknown Building');

      // Determine icon and subtitle based on building type
      let icon, subtitle;
      if (isDcFab) {
          const isDc = b.id.startsWith('dc_');
          icon = isDc ? '🖥️' : '🔧';
          const opName = (lab && lab.name) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].name) || b.lab || '';
          subtitle = (isDc ? 'Data Center' : 'Chip Fabrication') + (opName ? ` · ${escapeHTML(opName)}` : '');
      } else if (b.type && ['launchpad','mission_control','assembly','tracking'].includes(b.type)) {
          const org = b.org && typeof SPACE_ORGS !== 'undefined' ? SPACE_ORGS[b.org] : null;
          icon = org ? org.icon : '🚀';
          subtitle = org ? org.name : 'Space Zone';
      } else if (lab) {
          icon = lab.icon;
          subtitle = lab.name;
      } else {
          icon = b.emoji || '🏢';
          subtitle = '';
      }

      let html = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
        <div class="ipanel-top" style="background:linear-gradient(135deg,${col}22,transparent);border-bottom:2px solid ${col}33">
          <div class="ipanel-av" style="background:${col};color:#fff;font-size:24px">${icon}</div>
          <div><div class="ipanel-name">${safeName}</div>${subtitle ? `<div class="ipanel-sub" style="color:${col}">${subtitle}</div>` : ''}</div>
        </div>`;
        
      html += `<div style="max-height: calc(100vh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">`;
      html += `<p class="ipanel-desc" style="margin-top:0">${safeDesc}</p>`;
      
      // ─── DC/FAB-specific info panel ───
      if (b.id.startsWith('dc_') || b.id.startsWith('fab_')) {
        const dc = b.dcData || {};
        const opName = (LABS[b.lab] && LABS[b.lab].name) || (typeof DC_OPERATORS !== 'undefined' && DC_OPERATORS[b.lab] && DC_OPERATORS[b.lab].name) || b.lab || 'Unknown';
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">⚡ FACILITY SPECS</div>`;
        if (dc.location) html += `<div>📍 <b>Location:</b> ${escapeHTML(dc.location)}</div>`;
        html += `<div>🏭 <b>Operator:</b> ${escapeHTML(opName)}</div>`;
        html += `<div>${dc.status === 'construction' ? '🚧' : '✅'} <b>Status:</b> ${dc.status === 'construction' ? 'Under Construction' : 'Operational'}</div>`;
        if (dc.gpus) html += `<div>🖥️ <b>Compute:</b> ${escapeHTML(dc.gpus)}</div>`;
        if (dc.power_mw) html += `<div>🔌 <b>Power:</b> ${dc.power_mw} MW</div>`;
        if (dc.cooling) html += `<div>❄️ <b>Cooling:</b> ${escapeHTML(dc.cooling)}</div>`;
        if (dc.process) html += `<div>🔬 <b>Process:</b> ${escapeHTML(dc.process)}</div>`;
        if (dc.products) html += `<div>📦 <b>Products:</b> ${escapeHTML(dc.products)}</div>`;
        if (dc.investment) html += `<div>💰 <b>Investment:</b> ${escapeHTML(dc.investment)}</div>`;
        if (dc.completion) html += `<div>📅 <b>Est. Completion:</b> ${dc.completion}</div>`;
        html += `</div>`;
      }
      // ─── SPACE ZONE building info ───
      else if (b.type && ['launchpad','mission_control','assembly','tracking'].includes(b.type)) {
        const org = b.org && typeof SPACE_ORGS !== 'undefined' ? SPACE_ORGS[b.org] : null;
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:${col}">🚀 SPACE FACILITY</div>`;
        html += `<div>🏗️ <b>Type:</b> ${escapeHTML(b.type.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()))}</div>`;
        if (org) {
            html += `<div>${org.icon} <b>Organization:</b> ${escapeHTML(org.name)}</div>`;
            if (org.ceo) html += `<div>👤 <b>Director:</b> ${escapeHTML(org.ceo)}</div>`;
            html += `<div>🌍 <b>Region:</b> ${org.region ? org.region.toUpperCase() : 'N/A'}</div>`;
        }
        // Show next launch if available
        if (b.org && typeof SpaceData !== 'undefined' && SpaceData.launches) {
            const nextLaunch = SpaceData.launches.find(l => {
                const provider = SpaceData.getOrgForProvider(l.provider);
                return provider === b.org && new Date(l.net) > new Date();
            });
            if (nextLaunch) {
                const cd = SpaceData.getCountdown(nextLaunch);
                html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd)">`;
                html += `<div>🚀 <b>Next Launch:</b> ${escapeHTML(nextLaunch.name)}</div>`;
                html += `<div>⏱️ <b>Countdown:</b> <span style="color:${col}">${cd || 'TBD'}</span></div>`;
                html += `</div>`;
            }
        }
        html += `</div>`;
      }
      // ─── VISITOR MONUMENT panel ───
      else if (b.id === 'visitor_monument') {
        const vt = typeof VisitorTracker !== 'undefined' ? VisitorTracker : { uniqueVisitors: 0, totalVisits: 0 };
        html += `<div style="margin:0 16px 16px;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;font-size:10px;line-height:1.6">`;
        html += `<div style="font-weight:700;margin-bottom:6px;color:#22d3ee">🌐 VISITOR STATISTICS</div>`;
        html += `<div>👤 <b>Unique Visitors:</b> <span style="color:#22d3ee;font-size:14px;font-weight:bold">${vt.uniqueVisitors.toLocaleString()}</span></div>`;
        html += `<div>📊 <b>Total Visits:</b> ${vt.totalVisits.toLocaleString()}</div>`;
        html += `<div style="margin-top:6px;padding-top:6px;border-top:1px dashed var(--bd);color:var(--t3);font-size:9px">Every visitor to Singularity City is recorded on this monument. Your presence contributes to the city's history.</div>`;
        html += `</div>`;
      }
      // ─── HQ model list (exclude DC/fab and space) ───
      else if (b.lab && !b.id.startsWith('house_')) {
        const res = G.models.filter(m => m.lab === b.lab);
        if (res.length > 0) {
          html += `<div style="margin:0 16px 16px"><span class="ipanel-lbl" style="margin-bottom:6px;display:block">All Models (${res.length})</span>`;
          res.forEach(r => {
            const s = getStage(r.rel, r.ret, r.phase); const a = typeof avgBM === 'function' ? avgBM(r.id) : 0;
            html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:10px;margin-bottom:3px"><span style="cursor:pointer;flex:1;display:flex;align-items:center;gap:6px" onclick="UI.selectModel(G.models.find(m=>m.id==='${r.id}'))"><span>${STAGES[s].emoji}</span><span style="flex:1">${escapeHTML(r.name)}</span>${a ? `<span style="font-size:9px;font-weight:700;color:${a > 80 ? '#4ade80' : '#facc15'}">${a}%</span>` : ''}<span style="font-size:8px;color:var(--t3)">${STAGES[s].label}</span></span><button class="btn" style="padding:2px 5px;font-size:7px" onclick="event.stopPropagation();UI.addToCompare('${r.id}')">⚖️</button></div>`;
          });
          html += '</div>';
        }
      }
  
      const dp = G.getDayPhase();
      const curOcc = [];
      G.models.forEach((m, i) => {
        const stg = getStage(m.rel, m.ret, m.phase); 
        const { act } = getAct(stg, dp, i, m); 
        const ai = (typeof ACTS !== 'undefined' && ACTS[act]) ? ACTS[act] : { indoor: true, icon: '💻', verb: 'processing' };
        
        const refs = G.charRefs[m.id];
        if (refs && refs.bld === b.id) {
            curOcc.push({ m, ai, stg });
        }
      });

      if (b.id.startsWith('house_') && typeof G.ceoRefs !== 'undefined') {
          const ceoRef = G.ceoRefs[b.lab];
          if (ceoRef && ceoRef.bld === b.id) {
              const ceoDummy = { id: 'ceo_'+b.lab, name: ceoRef.f.name, lab: b.lab, isCeo: true, founderData: ceoRef.f, phase: 'released' };
              curOcc.push({ m: ceoDummy, ai: { icon: '🧑‍💼', verb: 'resting' }, stg: 'adult' });
          }
      }

      if (curOcc.length > 0) {
        const isOutdoor = ['park', 'graveyard'].includes(b.id);
        const locLabel = isOutdoor ? 'Gathering Here' : 'Currently Inside';
        html += `<div style="margin:0 16px 16px"><span class="ipanel-lbl" style="margin-bottom:6px;display:block">${locLabel} (${curOcc.length})</span>`;
        curOcc.forEach(({ m, ai, stg }) => {
          const a = typeof avgBM === 'function' ? avgBM(m.id) : 0;
          html += `<div style="display:flex;align-items:center;gap:6px;padding:5px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:10px;margin-bottom:3px"><span style="cursor:pointer;flex:1;display:flex;align-items:center;gap:6px" onclick="UI.selectModel(${m.isCeo ? JSON.stringify(m).replace(/"/g, "&quot;") : `G.models.find(x=>x.id==='${m.id}')`})"><span>${ai.icon}</span><span style="flex:1">${escapeHTML(m.name)}</span>${a ? `<span style="font-size:9px;font-weight:700;color:${a > 80 ? '#4ade80' : '#facc15'}">${a}%</span>` : ''}</span>${!m.isCeo ? `<button class="btn" style="padding:2px 5px;font-size:7px" onclick="event.stopPropagation();UI.addToCompare('${m.id}')">⚖️</button>` : ''}</div>`;
        });
        html += '</div>';
      } else if (!b.lab || b.id.startsWith('house_')) {
        const isOutdoor = ['park', 'graveyard'].includes(b.id);
        const emptyLabel = isOutdoor ? 'Nobody here right now' : 'Nobody inside right now';
        html += `<div style="margin:0 16px 16px;padding:12px;text-align:center;color:var(--t3);font-size:9px;background:var(--cd);border:1px solid var(--bd);border-radius:4px">${emptyLabel}</div>`;
      }
      
      html += `</div>`; 
      p.innerHTML = html;
    },
  
    showFounder(f) {
      const lab = LABS[f.lab] || LABS.other || {name: 'Independent', color: '#64748b'}; 
      const p = document.getElementById('infoPanel'); p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
      p.innerHTML = `<button class="ipanel-x" onclick="UI.closePanel()">✕</button>
      <div class="ipanel-top" style="background:linear-gradient(135deg,${f.color}22,transparent);border-bottom:2px solid ${f.color}33">
        <div class="ipanel-av" style="background:${f.color};color:#fff;font-size:20px">🧑‍💼</div>
        <div style="flex:1"><div class="ipanel-name">${f.name}</div><div class="ipanel-sub" style="color:${f.color}">${f.role}</div></div>
      </div>
      <div style="max-height: calc(100vh - 130px); overflow-y: auto; overflow-x: hidden; padding-right: 4px;">
        <div class="ipanel-desc">${f.fact}</div>
        <div class="ipanel-grid">
          <div class="ipanel-stat"><span class="ipanel-lbl">Company</span><span class="ipanel-val">${lab.name}</span></div>
          <div class="ipanel-stat"><span class="ipanel-lbl">Models</span><span class="ipanel-val">${G.models.filter(m => m.lab === f.lab).length}</span></div>
        </div>
        <div style="padding:8px 0"><button class="btn" style="width:100%;text-align:center;${G.tracking && G.tracking.lab === f.lab && G.tracking.type === 'ceo' ? 'background:var(--ac);color:#000;border-color:var(--ac)' : ''}" onclick="G.tracking && G.tracking.lab==='${f.lab}' && G.tracking.type==='ceo' ? G.stopTracking() : G.startTracking('ceo','ceo_${f.lab}','${f.lab}')">${G.tracking && G.tracking.lab === f.lab && G.tracking.type === 'ceo' ? '📡 Tracking' : '📡 Track'}</button></div>
      </div>`;
    },
  
    showCensus() {
      G.unlockAchieve('census_view'); 
      const dp = G.getDayPhase(); 
      document.getElementById('censusOv').classList.add('open');
      
      const alive = G.models.filter(m => !m.ret || new Date(m.ret) > new Date()).length;
      let h = `<button class="ipanel-x" onclick="document.getElementById('censusOv').classList.remove('open')">✕</button>
               <div class="ov-title">📊 CENSUS — ${G.models.length} Citizens</div>
               <div style="display:flex;justify-content:center;gap:16px;margin-bottom:14px;font-size:9px">
                  <span style="color:var(--ac)">● ${alive} Active</span>
                  <span style="color:#8b5cf6">● ${G.models.filter(m => ['rumored', 'pre_training', 'training'].includes(m.phase)).length} Pre-Training</span>
                  <span style="color:#7a7f8a">● ${G.models.length - alive} Retired</span>
               </div>
               <div style="display:flex;flex-direction:column;gap:12px;max-height:70vh;overflow-y:auto;padding-right:8px;">`;
      
      const gr = {}; 
      G.models.forEach((m, i) => { 
          const l = m.lab || 'other'; 
          if (!gr[l]) gr[l] = []; 
          gr[l].push({ m, i }); 
      });

      Object.keys(LABS).forEach(lk => {
        if (!gr[lk] || !gr[lk].length) return; 
        const li = LABS[lk];

        h += `<div style="background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:12px">
                <div style="font-size:12px;font-weight:bold;color:${li.color};margin-bottom:10px;display:flex;align-items:center;gap:8px">
                    <span>${li.icon}</span> ${li.name} (${gr[lk].length})
                </div>
                <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(220px,1fr));gap:8px;">`;

        gr[lk].forEach(({ m, i }) => {
          const s = getStage(m.rel, m.ret, m.phase); 
          const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0; 
          const { act } = getAct(s, dp, i, m); 
          const ai = ACTS[act] || {icon: '💻', verb: 'processing'};
          const isPre = ['rumored', 'pre_training', 'training'].includes(m.phase);
          const statCol = isPre ? '#8b5cf6' : s === 'retired' ? '#7a7f8a' : '#4ade80';
          const relYear = m.rel ? new Date(m.rel).getFullYear() : 'Unknown';

          h += `<div style="background:var(--sf);border:1px solid var(--bd);border-radius:4px;padding:8px;cursor:pointer;transition:border-color 0.2s" 
                     onclick="document.getElementById('censusOv').classList.remove('open');UI.selectModel(G.models[${i}])" 
                     onmouseover="this.style.borderColor='${li.color}'" onmouseout="this.style.borderColor='var(--bd)'">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:6px;">
                      <div style="display:flex;align-items:center;gap:6px;max-width:80%;">
                          <span style="font-size:16px">${STAGES[s].emoji}</span>
                          <div>
                              <div style="font-size:10px;font-weight:700;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                  ${escapeHTML(m.name)} ${m.os ? '<span style="color:#4ade80" title="Open Source">🔓</span>' : ''}
                              </div>
                              <div style="font-size:8px;color:var(--t3);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                                  ${m.arch?.params || '?'} • ${escapeHTML(m.tal)}
                              </div>
                          </div>
                      </div>
                      ${avg ? `<div style="font-size:10px;font-weight:700;color:${avg > 80 ? '#4ade80' : '#facc15'};background:var(--cd);padding:2px 6px;border-radius:3px;">${avg}%</div>` : ''}
                  </div>
                  <div style="display:flex;justify-content:space-between;align-items:center;font-size:8px;color:var(--t2);border-top:1px dashed var(--bd);padding-top:6px;margin-top:2px;">
                      <span style="color:${statCol}">${ai.icon} ${ai.verb}</span>
                      <span>${relYear}</span>
                  </div>
              </div>`;
        });
        h += '</div></div>';
      });
      h += '</div>'; 
      document.getElementById('censusPan').innerHTML = h;
    },
  
    _benchSort: 'avg',
    _benchSortDir: -1,
    
    showBenchmarks(sortKey) {
      G.unlockAchieve('benchmark_view');
      document.getElementById('benchOv').classList.add('open');
      
      // Update sort state
      if (sortKey) {
          if (this._benchSort === sortKey) { this._benchSortDir *= -1; }
          else { this._benchSort = sortKey; this._benchSortDir = -1; }
      }
      const sk = this._benchSort;
      const sd = this._benchSortDir;
      
      // Sort models by chosen metric
      const getSortVal = (m) => {
          if (sk === 'avg') return avgBM(m.id) || 0;
          if (sk === 'cost') return COSTS[m.id] ? COSTS[m.id].output : 9999;
          if (sk === 'ctx') return CTX[m.id] || 0;
          const sc = BM[m.id] || {};
          return sc[sk] !== undefined ? sc[sk] : (sc[sk.toUpperCase()] || 0);
      };
      
      const models = G.models.filter(m => BM[m.id] && typeof avgBM === 'function' && avgBM(m.id));
      if (sk === 'cost') {
          models.sort((a, b) => sd * ((getSortVal(a) || 9999) - (getSortVal(b) || 9999)));
      } else {
          models.sort((a, b) => sd * (getSortVal(b) - getSortVal(a)));
      }
      
      // Callout cards
      let topCallout = '';
      if (models.length > 0) {
          const avgSorted = [...models].sort((a, b) => (avgBM(b.id) || 0) - (avgBM(a.id) || 0));
          const top = avgSorted[0];
          const topLab = LABS[top.lab] || { name: top.lab, color: '#64748b' };
          const topAvg = avgBM(top.id);
          const eloTop = models.filter(m => BM[m.id] && BM[m.id].ELO).sort((a, b) => BM[b.id].ELO - BM[a.id].ELO)[0];
          
          topCallout = `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">`;
          topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:8px"><div style="font-size:8px;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">👑 #1 Overall</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(top.name)}</div><div style="font-size:9px;color:${topLab.color}">${topLab.name} · avg ${topAvg}%</div></div>`;
          if (eloTop && eloTop.id !== top.id) {
              const eloLab = LABS[eloTop.lab] || { name: eloTop.lab, color: '#64748b' };
              topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(250,204,21,0.06);border:1px solid rgba(250,204,21,0.2);border-radius:8px"><div style="font-size:8px;color:#facc15;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⚔️ Arena King</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(eloTop.name)}</div><div style="font-size:9px;color:${eloLab.color}">${eloLab.name} · ELO ${BM[eloTop.id].ELO}</div></div>`;
          }
          const frontier = avgSorted.slice(0, 10);
          const cheapFrontier = frontier.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => COSTS[a.id].input - COSTS[b.id].input)[0];
          if (cheapFrontier) {
              const cfLab = LABS[cheapFrontier.lab] || { name: cheapFrontier.lab, color: '#64748b' };
              topCallout += `<div style="flex:1;min-width:180px;padding:10px 14px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:8px"><div style="font-size:8px;color:#22d3ee;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">💰 Best Value Frontier</div><div style="font-size:12px;font-weight:700;color:#fff">${escapeHTML(cheapFrontier.name)}</div><div style="font-size:9px;color:${cfLab.color}">${cfLab.name} · $${COSTS[cheapFrontier.id].input}/1M in</div></div>`;
          }
          topCallout += `</div>`;
      }
      
      const sortLabel = sk === 'avg' ? 'average score' : sk === 'cost' ? 'output cost' : sk === 'ctx' ? 'context window' : sk;
      const sortArrow = sd === -1 ? '▼' : '▲';
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('benchOv').classList.remove('open')">✕</button><div class="ov-title">📊 BENCHMARK OBSERVATORY</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:10px">${models.length} ranked models · sorted by ${sortLabel} ${sortArrow} · click any column to re-sort</div>`;
      h += topCallout;
      
      // Build sortable header
      const thStyle = 'cursor:pointer;user-select:none;transition:color 0.2s';
      const activeCol = (key) => sk === key ? 'color:#4ade80;' : '';
      h += `<div style="overflow-x:auto;overflow-y:auto;max-height:55vh"><table class="bench-table"><thead><tr>`;
      h += `<th style="text-align:left;position:sticky;left:0;background:var(--sf);z-index:2">Model</th>`;
      h += `<th style="${thStyle};${activeCol('avg')}" onclick="UI.showBenchmarks('avg')">Avg${sk === 'avg' ? ' ' + sortArrow : ''}</th>`;
      Object.entries(BM_M).forEach(([k, bm]) => { 
          h += `<th style="${thStyle};${activeCol(k)}color:${sk === k ? '#4ade80' : bm.c}" onclick="UI.showBenchmarks('${k}')">${bm.l}${sk === k ? ' ' + sortArrow : ''}</th>`; 
      }); 
      h += `<th style="${thStyle};${activeCol('cost')}" onclick="UI.showBenchmarks('cost')">$/1M out${sk === 'cost' ? ' ' + sortArrow : ''}</th>`;
      h += `<th style="${thStyle};${activeCol('ctx')}" onclick="UI.showBenchmarks('ctx')">Context${sk === 'ctx' ? ' ' + sortArrow : ''}</th>`;
      h += `</tr></thead><tbody>`;
      
      models.forEach((m, rank) => {
        const avg = avgBM(m.id); 
        const sc = BM[m.id] || {};
        const lab = LABS[m.lab] || { color: '#64748b' };
        const medal = rank === 0 ? '🥇' : rank === 1 ? '🥈' : rank === 2 ? '🥉' : `<span style="font-size:8px;color:var(--t3)">${rank + 1}</span>`;
        const rowBorder = rank < 3 ? `border-left:2px solid ${lab.color}` : '';
        
        h += `<tr onclick="document.getElementById('benchOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${m.id}'))" style="cursor:pointer;${rowBorder}"><td style="position:sticky;left:0;background:var(--cd);z-index:2"><div style="display:flex;align-items:center;gap:6px">${medal}<div><span style="font-size:9px;font-weight:700">${escapeHTML(m.name)}</span><div style="font-size:7px;color:${lab.color}">${lab.name || m.lab}</div></div></div></td>`;
        
        h += `<td style="${sk === 'avg' ? 'background:rgba(74,222,128,0.05);' : ''}"><div style="display:flex;align-items:center;gap:4px"><div style="width:30px;height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="width:${avg}%;height:100%;background:${avg > 85 ? '#4ade80' : avg > 70 ? '#facc15' : '#ef4444'};border-radius:2px"></div></div><span style="font-weight:700;font-size:9px;color:${avg > 85 ? '#4ade80' : avg > 70 ? '#facc15' : '#ef4444'}">${avg}%</span></div></td>`;
        
        Object.keys(BM_M).forEach(k => {
          const v = sc[k] !== undefined ? sc[k] : sc[k.toUpperCase()]; 
          const col = k === 'ELO' ? (v > 1350 ? '#4ade80' : v > 1250 ? '#facc15' : '#ef4444') : (v > 90 ? '#4ade80' : v > 70 ? '#facc15' : v > 0 ? '#ef4444' : 'var(--t3)');
          const highlight = sk === k ? 'background:rgba(74,222,128,0.05);' : '';
          h += `<td style="color:${col};${highlight}">${k === 'ELO' ? (v || '—') : (v ? v + '%' : '—')}</td>`;
        });
        
        const cost = COSTS[m.id]; 
        h += `<td style="color:#facc15;${sk === 'cost' ? 'background:rgba(250,204,21,0.05);' : ''}">${cost && cost.output !== undefined ? '$' + cost.output : '—'}</td>`;
        
        const ctx_val = CTX[m.id];
        h += `<td style="color:var(--t2);${sk === 'ctx' ? 'background:rgba(34,211,238,0.05);' : ''}">${ctx_val !== undefined ? (ctx_val >= 1e6 ? (ctx_val / 1e6).toFixed(1).replace('.0','') + 'M' : (ctx_val / 1e3).toFixed(0) + 'K') : '—'}</td></tr>`;
      });
      h += '</tbody></table></div>'; 
      document.getElementById('benchPan').innerHTML = h;
    },
  
    showCompare() {
      document.getElementById('compareOv').classList.add('open'); const pan = document.getElementById('comparePan');
      const ms = this.compareList.map(id => G.models.find(m => m.id === id)).filter(Boolean);
      if (ms.length < 2) { pan.innerHTML = '<button class="ipanel-x" onclick="document.getElementById(\'compareOv\').classList.remove(\'open\')">✕</button><div class="ov-title">⚖️ COMPARE</div><div style="text-align:center;padding:40px;color:var(--t3)">Select 2+ models via ⚖️ buttons.</div>'; 
      return; }
      let h = `<button class="ipanel-x" onclick="document.getElementById('compareOv').classList.remove('open')">✕</button><div class="ov-title">⚖️ MODEL COMPARISON</div><div style="display:grid;grid-template-columns:repeat(${ms.length},1fr);gap:8px;margin-bottom:16px">`;
      ms.forEach(m => { const lab = LABS[m.lab] || LABS.other || {color: '#64748b', name: 'Independent'}; const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0; h += `<div style="text-align:center;padding:10px;background:var(--cd);border:2px solid ${lab.color}44;border-radius:6px"><div style="font-size:10px;font-weight:700">${escapeHTML(m.name)}</div><div style="font-size:8px;color:${lab.color}">${lab.name}</div>${avg ? `<div style="font-size:14px;font-weight:700;color:${avg > 80 ? '#4ade80' : '#facc15'};margin-top:4px">${avg}%</div>` : ''}</div>`; });
      h += '</div><div style="max-height:50vh;overflow-y:auto">';
      Object.entries(BM_M).forEach(([k, bm]) => {
        h += `<div style="margin-bottom:12px"><div style="font-size:9px;color:var(--t2);margin-bottom:4px">${bm.l}</div>`;
        ms.forEach(m => {
          const sc = BM[m.id] || {};
          const v = sc[k] !== undefined ? sc[k] : (sc[k.toUpperCase()] || 0); 
          const lab = LABS[m.lab] || LABS.other || {color: '#64748b'}; const fw = k === 'ELO' ? (v ? Math.min(100, (v - 1000) / 4.5) : 0) : Math.min(100, v); const dv = k === 'ELO' ? (v || '—') : (v ? v + '%' : '—');
          h += `<div style="display:flex;align-items:center;gap:6px;margin-bottom:2px"><span style="font-size:8px;color:var(--t3);width:60px;text-align:right;flex-shrink:0">${escapeHTML(m.name).split(' ').pop()}</span><div style="flex:1;height:6px;background:var(--bd);border-radius:3px;overflow:hidden"><div style="width:${fw}%;height:100%;background:${lab.color};border-radius:3px"></div></div><span style="font-size:8px;color:${bm.c};width:36px;font-weight:700">${dv}</span></div>`;
        });
        h += '</div>';
      });
      h += `</div><div style="margin-top:12px;text-align:center"><button class="btn" onclick="UI.compareList=[];document.getElementById('compareOv').classList.remove('open')">Clear & Close</button></div>`; pan.innerHTML = h;
    },

    showLaunches() {
      document.getElementById('launchOv').classList.add('open');
      const pan = document.getElementById('launchPan');
      
      const launches = (typeof SpaceData !== 'undefined') ? SpaceData.launches : [];
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('launchOv').classList.remove('open')">✕</button>`;
      h += `<div class="ov-title">🚀 LAUNCH SCHEDULE</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:12px">Real-time data from Launch Library 2 API · Updated every 30 min</div>`;
      
      if (!launches.length) {
          h += `<div style="text-align:center;padding:40px;color:var(--t3);font-size:11px">No launch data available yet.<br>Data fetches automatically every 30 minutes.</div>`;
      } else {
          launches.forEach((l, i) => {
              const net = new Date(l.net);
              const now = new Date();
              const diff = net - now;
              const isPast = diff < 0;
              
              let countdown = '';
              if (isPast) {
                  countdown = '<span style="color:#4ade80">LAUNCHED</span>';
              } else {
                  countdown = `<span style="color:#22d3ee">${SpaceData.getCountdown(l)}</span>`;
              }
              
              const orgKey = SpaceData.getOrgForProvider(l.provider);
              const org = orgKey ? SPACE_ORGS[orgKey] : null;
              const orgColor = org ? org.color : '#64748b';
              const orgIcon = org ? org.icon : '🚀';
              
              const dateStr = net.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
              const timeStr = net.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
              
              h += `<div style="padding:10px 12px;margin-bottom:6px;background:${i === 0 ? 'rgba(34,211,238,0.05)' : 'var(--cd)'};border:1px solid ${i === 0 ? orgColor + '44' : 'var(--bd)'};border-radius:6px;${i === 0 ? 'border-left:3px solid ' + orgColor : ''}">`;
              h += `<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">`;
              h += `<div style="font-size:11px;font-weight:700;color:#fff">${orgIcon} ${escapeHTML(l.name)}</div>`;
              h += `<div style="font-size:10px;font-weight:700">${countdown}</div>`;
              h += `</div>`;
              h += `<div style="display:flex;gap:12px;font-size:9px;color:var(--t3)">`;
              h += `<span>🏢 ${escapeHTML(l.provider)}</span>`;
              h += `<span>🚀 ${escapeHTML(l.rocket)}</span>`;
              h += `<span>📅 ${dateStr} ${timeStr}</span>`;
              h += `</div>`;
              if (l.mission) {
                  h += `<div style="font-size:9px;color:var(--t2);margin-top:4px">📡 Mission: ${escapeHTML(l.mission)}</div>`;
              }
              if (l.pad && l.pad !== 'Unknown') {
                  h += `<div style="font-size:8px;color:var(--t3);margin-top:2px">📍 ${escapeHTML(l.pad)}</div>`;
              }
              h += `</div>`;
          });
      }
      
      h += `<div style="margin-top:10px;text-align:center"><button class="btn" style="width:100%" onclick="if(typeof SpaceData!=='undefined')SpaceData.fetchLaunches(true);setTimeout(()=>UI.showLaunches(),2000)">🔄 Refresh Launch Data</button></div>`;
      
      pan.innerHTML = h;
    },
  
    showFamilyTree() {
      G.unlockAchieve('family_view'); document.getElementById('familyOv').classList.add('open'); const pan = document.getElementById('familyPan');
      let h = `<button class="ipanel-x" onclick="document.getElementById('familyOv').classList.remove('open')">✕</button><div class="ov-title">🧬 MODEL FAMILY TREES</div><div style="max-height:65vh;overflow-y:auto">`;
      Object.entries(FAMILIES).forEach(([lk, edges]) => {
        const lab = LABS[lk]; if (!lab) return;
        h += `<div style="margin-bottom:16px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:12px"><div style="font-size:10px;font-weight:bold;color:${lab.color};margin-bottom:10px">${lab.name}</div>`;
        const nodes = new Set(); edges.forEach(e => { nodes.add(e.id); e.children.forEach(c => nodes.add(c)); });
        const roots = [...nodes].filter(n => !edges.some(e => e.children.includes(n)));
        const render = (id, d) => {
          const m = G.models.find(x => x.id === id); if (!m) return ''; const s = getStage(m.rel, m.ret, m.phase); const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
          let o = `<div style="margin-left:${d * 20}px;display:flex;align-items:center;gap:6px;padding:4px 8px;margin-bottom:3px;border-left:2px solid ${lab.color}44;cursor:pointer;border-radius:0 4px 4px 0;background:var(--sf)" onclick="document.getElementById('familyOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${id}'))">
            ${d > 0 ? '<span style="color:var(--t3)">└</span>' : ''}<span>${STAGES[s].emoji}</span><span style="font-size:9px;font-weight:700">${escapeHTML(m.name)}</span><span style="font-size:7px;color:var(--t3)">${new Date(m.rel).getFullYear()}</span>${avg ? `<span style="font-size:8px;font-weight:700;color:${avg > 80 ? '#4ade80' : '#facc15'}">${avg}%</span>` : ''}</div>`;
          const edge = edges.find(e => e.id === id); if (edge) edge.children.forEach(c => { o += render(c, d + 1); });
          return o;
        };
        roots.forEach(r => { h += render(r, 0); }); h += '</div>';
      });
      h += '</div>';
      pan.innerHTML = h;
    },
  
    showCalendar() {
      G.unlockAchieve('calendar_view'); document.getElementById('calendarOv').classList.add('open');
      const pan = document.getElementById('calendarPan'); const now = new Date();
      const up = AI_EVENTS.filter(e => new Date(e.date) >= now).sort((a, b) => new Date(a.date) - new Date(b.date));
      const past = AI_EVENTS.filter(e => new Date(e.date) < now).sort((a, b) => new Date(b.date) - new Date(a.date));
      let h = `<button class="ipanel-x" onclick="document.getElementById('calendarOv').classList.remove('open')">✕</button><div class="ov-title">📅 AI EVENTS</div><div style="max-height:65vh;overflow-y:auto">`;
      if (up.length) {
        h += '<div style="font-size:9px;color:var(--ac);margin-bottom:8px;font-weight:700">UPCOMING</div>';
        up.forEach(e => {
          const d = new Date(e.date); const days = Math.ceil((d - now) / (864e5)); const tc = e.type === 'conference' ? '#22d3ee' : e.type === 'release' ? '#4ade80' : '#facc15';
          h += `<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px"><div style="text-align:center;min-width:40px"><div style="font-size:14px;font-weight:700">${d.getDate()}</div><div style="font-size:7px;color:var(--t3)">${d.toLocaleDateString('en', { month: 'short' })}</div></div><div style="flex:1"><div style="font-size:9px;font-weight:700">${e.name}</div><div style="font-size:7px;color:var(--t3)">${e.desc}</div></div><span style="font-size:8px;color:${tc};border:1px solid ${tc}44;padding:2px 6px;border-radius:3px">${days}d</span></div>`;
        });
      }
      if (past.length) {
        h += '<div style="font-size:9px;color:var(--t3);margin:12px 0 8px;font-weight:700">PAST</div>';
        past.forEach(e => { h += `<div style="padding:6px 8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:3px;opacity:.6"><div style="font-size:8px;color:var(--t2)">${new Date(e.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })} — ${e.name}</div></div>`; });
      }
      h += '</div>'; pan.innerHTML = h;
    },
  
    showCompute() {
      document.getElementById('computeOv').classList.add('open'); const pan = document.getElementById('computePan');
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('computeOv').classList.remove('open')">✕</button>
               <div class="ov-title">🏭 GLOBAL SUPPLY CHAIN & COMPUTE</div>
               <div style="max-height:65vh;overflow-y:auto;padding-right:5px;">`;
               
      h += `<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:16px">
              <div style="background:var(--cd);border:1px solid var(--bd);padding:12px;border-radius:6px;text-align:center">
                  <div style="font-size:7px;color:var(--t3)">EST. GLOBAL GPUs</div>
                  <div style="font-size:16px;font-weight:700;color:#4ade80">~3.5M</div>
              </div>
              <div style="background:var(--cd);border:1px solid var(--bd);padding:12px;border-radius:6px;text-align:center">
                  <div style="font-size:7px;color:var(--t3)">EST. POWER DRAW</div>
                  <div style="font-size:16px;font-weight:700;color:#facc15">~15.2 GW</div>
              </div>
            </div>`;

      h += `<div class="arch-title" style="margin-top:0;">⚠️ Critical Bottlenecks</div><div style="margin-bottom:16px">`;
      SUPPLY_CHAIN.bottlenecks.forEach(b => {
          h += `<div style="margin-top:8px">
                  <div style="display:flex;justify-content:space-between;font-size:9px;margin-bottom:4px">
                      <span style="color:var(--t1)">${b.name}</span>
                      <span style="color:${b.color};font-weight:bold">${b.load}% Capacity Limit</span>
                  </div>
                  <div style="width:100%;height:6px;background:var(--cd);border:1px solid var(--bd);border-radius:3px;overflow:hidden">
                      <div style="width:${b.load}%;height:100%;background:${b.color};box-shadow:0 0 5px ${b.color}"></div>
                  </div>
                </div>`;
      });
      h += `</div>`;

      h += `<div class="arch-title">🚀 AI Accelerator Pipeline (2026)</div><div style="display:flex;flex-direction:column;gap:6px;margin-bottom:16px">`;
      SUPPLY_CHAIN.accelerators.forEach(a => {
          const isRubin = a.name.includes("Rubin");
          h += `<div style="padding:10px;background:var(--sf);border:1px solid ${isRubin ? '#22d3ee55' : 'var(--bd)'};border-radius:4px; ${isRubin ? 'box-shadow: inset 0 0 15px rgba(34,211,238,0.1)' : ''}">
                  <div style="display:flex;justify-content:space-between;margin-bottom:6px">
                      <span style="font-size:11px;font-weight:bold;color:${isRubin ? '#22d3ee' : '#fff'}">${a.name}</span>
                      <span style="font-size:9px;color:var(--t3);background:var(--cd);padding:2px 6px;border-radius:3px;">${a.price}</span>
                  </div>
                  <div style="display:flex;justify-content:space-between;font-size:9px">
                      <span style="color:var(--ac)">Status: ${a.status}</span>
                      <span style="color:#f472b6">Mem: ${a.memory}</span>
                  </div>
                </div>`;
      });
      h += `</div>`;

      h += `<div class="arch-title">🔬 Foundry & Lithography Wars</div>`;
      h += `<div style="padding:10px;background:var(--cd);border:1px dashed #f9731655;border-radius:4px;margin-bottom:8px">
                <div style="font-size:10px;font-weight:bold;color:#f97316;margin-bottom:4px">${SUPPLY_CHAIN.lithography.asml_high_na.name}</div>
                <div style="font-size:8px;color:var(--t2);margin-bottom:8px">${SUPPLY_CHAIN.lithography.asml_high_na.desc} (Unit Cost: ${SUPPLY_CHAIN.lithography.asml_high_na.cost})</div>
                <div style="display:flex;justify-content:space-between;font-size:8px;background:var(--sf);padding:6px;border-radius:4px;">
                    <span style="color:var(--t1)">Intel: <b style="color:#4ade80">${SUPPLY_CHAIN.lithography.asml_high_na.deployed.intel}</b> units</span>
                    <span style="color:var(--t1)">Samsung: <b style="color:#4ade80">${SUPPLY_CHAIN.lithography.asml_high_na.deployed.samsung}</b> units</span>
                    <span style="color:var(--t1)">TSMC: <b style="color:#ef4444">${SUPPLY_CHAIN.lithography.asml_high_na.deployed.tsmc}</b> units <span style="color:var(--t3)">(Using Low-NA)</span></span>
                </div>
            </div>`;
            
      SUPPLY_CHAIN.foundries.forEach(f => {
          h += `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px;background:var(--sf);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px">
                  <div>
                      <div style="font-size:10px;font-weight:bold;color:var(--t1)">${f.name} <span style="color:var(--cy);font-weight:normal;margin-left:4px;">${f.node}</span></div>
                      <div style="font-size:8px;color:var(--t3);margin-top:4px">Pack: ${f.packaging}</div>
                  </div>
                  <div style="font-size:8px;color:${f.capacity.includes('Booked') ? '#ef4444' : '#facc15'};font-weight:bold;background:var(--cd);padding:6px 10px;border-radius:4px;border:1px solid var(--bd)">
                      ${f.capacity}
                  </div>
                </div>`;
      });

      // Live semiconductor news from RSS
      if (typeof API !== 'undefined' && API.supplyChainNews?.length > 0) {
          h += `<div class="arch-title" style="margin-top:16px;">📰 Live Semiconductor News</div>`;
          API.supplyChainNews.slice(0, 6).forEach(n => {
              const catColors = { lithography: '#f97316', foundry: '#22d3ee', bottleneck: '#ef4444', accelerator: '#4ade80' };
              const catIcons = { lithography: '🔬', foundry: '🏭', bottleneck: '⚠️', accelerator: '🚀' };
              h += `<a href="${n.url}" target="_blank" rel="noopener" style="display:block;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:3px;text-decoration:none;cursor:pointer;">
                      <div style="display:flex;align-items:center;gap:6px">
                          <span style="font-size:10px">${catIcons[n.category] || '📰'}</span>
                          <span style="font-size:7px;padding:2px 5px;background:${catColors[n.category] || 'var(--bd)'}22;color:${catColors[n.category] || 'var(--t2)'};border-radius:3px;text-transform:uppercase;font-weight:700">${n.category}</span>
                          <span style="font-size:7px;color:var(--t3);margin-left:auto">${n.source}</span>
                      </div>
                      <div style="font-size:8px;color:var(--t1);margin-top:4px;line-height:1.3">${n.headline}</div>
                    </a>`;
          });
      }

      h += `<div class="arch-title" style="margin-top:16px;">🏢 Active Lab Clusters</div>`;
      COMPUTE_DATA.clusters.forEach(c => {
        const lab = c.lab ? LABS[c.lab] : null;
        h += `<div style="display:flex;gap:10px;align-items:center;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px"><span style="font-size:12px">${lab ? lab.icon : '🖥️'}</span><div style="flex:1"><div style="font-size:9px;font-weight:700">${c.name}</div><div style="font-size:7px;color:var(--t3)">${c.location}</div></div><div style="text-align:right"><div style="font-size:10px;font-weight:700;color:var(--cy)">${(c.gpus / 1e3).toFixed(0)}K</div><div style="font-size:6px;color:var(--t3)">${c.type}</div></div></div>`;
      });
      
      h += '</div>'; 
      pan.innerHTML = h;
    },
  
    showCostDashboard() {
      document.getElementById('costOv').classList.add('open');
      const pan = document.getElementById('costPan');
      const models = G.models.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => (COSTS[a.id]?.input || 999) - (COSTS[b.id]?.input || 999));
      if (!models.length) { pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('costOv').classList.remove('open')">✕</button><div class="ov-title">💰 PRICE WAR TRACKER</div><div style="text-align:center;padding:40px;color:var(--t3)">No pricing data yet.</div>`; return; }
      
      // Find cheapest frontier (top 15 by benchmark)
      const ranked = G.models.filter(m => BM[m.id] && avgBM(m.id)).sort((a, b) => avgBM(b.id) - avgBM(a.id));
      const frontier = ranked.slice(0, 15);
      const cheapFrontier = frontier.filter(m => COSTS[m.id] && COSTS[m.id].input > 0).sort((a, b) => COSTS[a.id].input - COSTS[b.id].input);
      
      // Group by lab
      const labGroups = {};
      models.forEach(m => {
          if (!labGroups[m.lab]) labGroups[m.lab] = [];
          labGroups[m.lab].push(m);
      });
      // Sort labs by cheapest model
      const sortedLabs = Object.keys(labGroups).sort((a, b) => {
          const cheapA = Math.min(...labGroups[a].map(m => COSTS[m.id].input));
          const cheapB = Math.min(...labGroups[b].map(m => COSTS[m.id].input));
          return cheapA - cheapB;
      });
      
      let h = `<button class="ipanel-x" onclick="document.getElementById('costOv').classList.remove('open')">✕</button><div class="ov-title">💰 PRICE WAR TRACKER</div>`;
      h += `<div style="font-size:9px;color:var(--t3);text-align:center;margin-bottom:10px">${models.length} models with pricing · per 1M tokens</div>`;
      
      // Callout cards
      h += `<div style="display:flex;gap:8px;margin-bottom:12px;flex-wrap:wrap">`;
      if (models[0]) {
          const ch = models[0]; const chLab = LABS[ch.lab] || { name: ch.lab, color: '#64748b' };
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(74,222,128,0.06);border:1px solid rgba(74,222,128,0.2);border-radius:8px"><div style="font-size:8px;color:#4ade80;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">💚 Cheapest Overall</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(ch.name)}</div><div style="font-size:9px;color:${chLab.color}">${chLab.name} · $${COSTS[ch.id].input} in / $${COSTS[ch.id].output} out</div></div>`;
      }
      if (cheapFrontier[0]) {
          const cf = cheapFrontier[0]; const cfLab = LABS[cf.lab] || { name: cf.lab, color: '#64748b' }; const cfAvg = avgBM(cf.id);
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(34,211,238,0.06);border:1px solid rgba(34,211,238,0.2);border-radius:8px"><div style="font-size:8px;color:#22d3ee;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">⚡ Cheapest Frontier</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(cf.name)}</div><div style="font-size:9px;color:${cfLab.color}">${cfLab.name} · $${COSTS[cf.id].input} in · ${cfAvg}% avg</div></div>`;
      }
      // Best bang-for-buck
      const withBang = models.filter(m => avgBM(m.id) && COSTS[m.id].output > 0).map(m => ({ m, bang: avgBM(m.id) / COSTS[m.id].output })).sort((a, b) => b.bang - a.bang);
      if (withBang[0]) {
          const bb = withBang[0].m; const bbLab = LABS[bb.lab] || { name: bb.lab, color: '#64748b' };
          h += `<div style="flex:1;min-width:150px;padding:10px 14px;background:rgba(250,204,21,0.06);border:1px solid rgba(250,204,21,0.2);border-radius:8px"><div style="font-size:8px;color:#facc15;text-transform:uppercase;letter-spacing:1px;margin-bottom:4px">🏆 Best Bang-for-Buck</div><div style="font-size:11px;font-weight:700;color:#fff">${escapeHTML(bb.name)}</div><div style="font-size:9px;color:${bbLab.color}">${bbLab.name} · ${withBang[0].bang.toFixed(1)} quality/$</div></div>`;
      }
      h += `</div>`;
      
      // Lab-grouped price comparison
      h += `<div style="max-height:50vh;overflow-y:auto">`;
      const mxIn = Math.max(...models.map(m => COSTS[m.id]?.input || 0));
      
      sortedLabs.forEach(labKey => {
          const lab = LABS[labKey] || { name: labKey, color: '#64748b' };
          const labModels = labGroups[labKey].sort((a, b) => COSTS[a.id].input - COSTS[b.id].input);
          
          h += `<div style="margin-bottom:10px"><div style="display:flex;align-items:center;gap:6px;margin-bottom:4px;padding:4px 0;border-bottom:1px solid ${lab.color}33"><span style="font-size:10px;font-weight:700;color:${lab.color}">${lab.name || labKey}</span><span style="font-size:8px;color:var(--t3)">${labModels.length} model${labModels.length > 1 ? 's' : ''}</span></div>`;
          
          labModels.forEach(m => {
              const c = COSTS[m.id];
              const avg = typeof avgBM === 'function' ? avgBM(m.id) : 0;
              const bwIn = mxIn > 0 ? Math.max(2, (c.input / mxIn) * 100) : 2;
              
              h += `<div style="padding:5px 8px;background:var(--cd);border-radius:4px;margin-bottom:2px;cursor:pointer;display:flex;align-items:center;gap:8px" onclick="document.getElementById('costOv').classList.remove('open');UI.selectModel(G.models.find(x=>x.id==='${m.id}'))">`;
              h += `<span style="font-size:9px;font-weight:700;width:120px;flex-shrink:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHTML(m.name)}</span>`;
              h += `<div style="flex:1;height:4px;background:var(--bd);border-radius:2px;overflow:hidden"><div style="width:${bwIn}%;height:100%;background:${lab.color};border-radius:2px"></div></div>`;
              h += `<span style="font-size:8px;color:#4ade80;width:50px;text-align:right">$${c.input}</span>`;
              h += `<span style="font-size:8px;color:#facc15;width:50px;text-align:right">$${c.output}</span>`;
              h += avg ? `<span style="font-size:8px;color:${avg > 80 ? '#4ade80' : '#facc15'};width:30px;text-align:right">${avg}%</span>` : `<span style="width:30px"></span>`;
              h += `</div>`;
          });
          h += `</div>`;
      });
      h += `</div>`; 
      pan.innerHTML = h;
    },
  
    showAchievements() {
      document.getElementById('achieveOv').classList.add('open'); const pan = document.getElementById('achievePan');
      const total = Object.keys(ACHIEVEMENTS).length; const earned = Object.keys(G.achievements).length;
      let h = `<button class="ipanel-x" onclick="document.getElementById('achieveOv').classList.remove('open')">✕</button><div class="ov-title">🏆 ACHIEVEMENTS — ${earned}/${total}</div><div style="height:6px;background:var(--bd);border-radius:3px;margin-bottom:16px;overflow:hidden"><div style="width:${(earned / total) * 100}%;height:100%;background:linear-gradient(90deg,#4ade80,#22d3ee)"></div></div><div class="pop-grid" style="gap:6px">`;
      Object.entries(ACHIEVEMENTS).forEach(([key, a]) => {
        const u = G.achievements[key];
        h += `<div class="pop-card" style="opacity:${u ? 1 : .4};background:${u ? 'var(--cd)' : 'var(--sf)'}"><span style="font-size:20px">${a.icon}</span><div style="flex:1"><div style="font-size:9px;font-weight:700">${a.name}</div><div style="font-size:7px;color:var(--t3)">${a.desc}</div>${u ? `<div style="font-size:6px;color:var(--ac)">${new Date(u).toLocaleDateString()}</div>` : ''}</div></div>`;
      });
      h += '</div>'; pan.innerHTML = h;
    },
  
    showNewsPanel() {
      document.getElementById('newsOv').classList.add('open'); const pan = document.getElementById('newsPan');
      let h = `<button class="ipanel-x" onclick="document.getElementById('newsOv').classList.remove('open')">✕</button><div class="ov-title">📰 AI NEWS</div><div style="text-align:center;margin-bottom:12px"><button class="btn" onclick="API.fetchLiveNews().then(()=>UI.showNewsPanel())">🔄 Refresh</button></div><div style="max-height:60vh;overflow-y:auto">`;
      if (!API.liveNews.length) h += '<div style="text-align:center;padding:30px;color:var(--t3);font-size:9px">Fetching headlines...</div>';
      else {
        if (API.liveNews[0]?.source === 'Fallback') h += '<div style="text-align:center;padding:8px;margin-bottom:8px;font-size:8px;color:var(--pk);background:#f472b610;border:1px solid #f472b622;border-radius:4px">Showing fallback headlines</div>';
        API.liveNews.forEach(n => {
          const safeHeadline = escapeHTML(n.headline);
          const safeSource = escapeHTML(n.source);
          const safeUrl = encodeURI(n.url);
          h += `<a href="${safeUrl}" target="_blank" rel="noopener" style="display:flex;gap:10px;align-items:center;padding:10px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;margin-bottom:4px;text-decoration:none;transition:border-color .15s" onmouseover="this.style.borderColor='var(--ac)'" onmouseout="this.style.borderColor='var(--bd)'"><span style="font-size:14px">📰</span><div style="flex:1"><div style="font-size:9px;color:var(--t1);line-height:1.4">${safeHeadline}</div><div style="font-size:7px;color:var(--cy);margin-top:2px">${safeSource}</div></div></a>`;
        });
      }
      h += '</div>'; pan.innerHTML = h;
    },
  
    showAnalyst() {
      document.getElementById('analystOv').classList.add('open'); const pan = document.getElementById('analystPan');
      pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('analystOv').classList.remove('open')">✕</button><div class="ov-title">🤖 AI ANALYST</div><div style="margin-bottom:12px;font-size:9px;color:var(--t3);text-align:center">Ask about the AI landscape using your API key</div><div id="analystChat" style="max-height:45vh;overflow-y:auto;margin-bottom:12px;padding:8px;background:var(--cd);border:1px solid var(--bd);border-radius:6px;min-height:100px"><div style="font-size:9px;color:var(--t3);text-align:center;padding:20px">Ask me anything...</div></div><div style="display:flex;gap:6px"><input type="text" id="analystInput" placeholder="e.g. Best model for coding?" class="sel-input" style="margin:0;flex:1" onkeydown="if(event.key==='Enter')API.askAnalyst()"><button class="btn" style="padding:8px 14px" onclick="API.askAnalyst()">Ask</button></div>`;
    },
  
    showSettings() {
      document.getElementById('settingsOv').classList.add('open');
      document.getElementById('settingsPan').innerHTML = `<button class="ipanel-x" onclick="document.getElementById('settingsOv').classList.remove('open')">✕</button><div class="ov-title">⚙️ SETTINGS</div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">API Provider</label><select id="apiProviderSel" class="sel-select" onchange="UI.updateModelDatalist()"><option value="xai" ${G.apiProvider === 'xai' ? 'selected' : ''}>xAI</option><option value="openai" ${G.apiProvider === 'openai' ? 'selected' : ''}>OpenAI</option><option value="anthropic" ${G.apiProvider === 'anthropic' ? 'selected' : ''}>Anthropic</option><option value="google" ${G.apiProvider === 'google' ? 'selected' : ''}>Google</option></select></div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">Model ID</label><input type="text" id="modelIdInput" list="modelSuggestions" value="${G.modelId}" class="sel-input"><datalist id="modelSuggestions"></datalist></div>
        <div style="margin-bottom:14px"><label class="ipanel-lbl">API Key</label><input type="password" id="authKeyInput" value="${G.authKey}" placeholder="API Key..." class="sel-input"></div>
        <div style="margin-bottom:14px">
          <label class="ipanel-lbl">Auto-Scan</label>
          <select id="autoScanSel" class="sel-select" style="margin-top:6px">
            <option value="0" ${G.autoScanMin === 0 ? 'selected' : ''}>Off</option>
            <option value="5" ${G.autoScanMin === 5 ? 'selected' : ''}>5 min</option>
            <option value="10" ${G.autoScanMin === 10 ? 'selected' : ''}>10 min</option>
            <option value="15" ${G.autoScanMin === 15 ? 'selected' : ''}>15 min</option>
            <option value="30" ${G.autoScanMin === 30 ? 'selected' : ''}>30 min</option>
            <option value="60" ${G.autoScanMin === 60 ? 'selected' : ''}>1 hour</option>
          </select>
        </div>
        
        <div style="margin-top:20px; margin-bottom:14px; border-top:1px solid var(--bd); padding-top:20px">
          <div style="font-size:10px; color:var(--ac); margin-bottom:8px; font-weight:bold">MARKET TELEMETRY</div>
          <label class="ipanel-lbl">Finnhub API Key</label>
          <input type="password" id="finnhubKeyInput" value="${G.finnhubKey || ''}" placeholder="Finnhub Key (For live stock tickers)..." class="sel-input">
        </div>

        <div style="display:flex;gap:8px;margin-top:20px"><button class="btn" style="flex:1;padding:10px;text-align:center" onclick="G.saveSettings()">💾 Save & Scan</button><button class="btn" style="padding:10px;border-color:#ef444466;color:#ef4444" onclick="if(confirm('Clear all?')){localStorage.removeItem('sc_data');location.reload()}">Reset</button><button class="btn" style="padding:10px" onclick="document.getElementById('settingsOv').classList.remove('open')">Close</button></div>`;
      this.updateModelDatalist();
    },
  
    updateModelDatalist() {
      const pv = document.getElementById('apiProviderSel')?.value;
      const dl = document.getElementById('modelSuggestions'); if (!dl) return;
      let o = []; if (pv === 'xai') o = ['grok-3-latest'];
      else if (pv === 'openai') o = ['gpt-4o', 'o3-mini']; else if (pv === 'anthropic') o = ['claude-sonnet-4-20250514'];
      else if (pv === 'google') o = ['gemini-2.5-flash'];
      dl.innerHTML = o.map(x => `<option value="${x}">`).join('');
    },

    setupMobileGestures() {
        let startY = 0;
        let currentY = 0;
        let draggingPanel = null;

        const onTouchStart = (e) => {
            const panel = e.target.closest('.ov-pan') || e.target.closest('.ipanel');
            if (!panel) return;
            
            const scrollableTarget = e.target.closest('[style*="overflow-y: auto"], [style*="overflow-y:auto"]');
            if (scrollableTarget) return;

            const rect = panel.getBoundingClientRect();
            if (e.touches[0].clientY > rect.top + 60) return;

            draggingPanel = panel;
            startY = e.touches[0].clientY;
            panel.style.transition = 'none';
            panel.style.touchAction = 'none'; 
        };

        const onTouchMove = (e) => {
            if (!draggingPanel) return;
            currentY = e.touches[0].clientY;
            const dy = currentY - startY;
            
            if (dy > 0) {
                e.preventDefault(); 
                draggingPanel.style.transform = `translateY(${dy}px)`;
            }
        };

        const onTouchEnd = () => {
            if (!draggingPanel) return;
            const dy = currentY - startY;
            
            draggingPanel.style.transition = 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)';
            draggingPanel.style.touchAction = ''; 
            
            if (dy > 100) { 
                draggingPanel.style.transform = `translateY(100%)`;
                setTimeout(() => {
                    if (draggingPanel.classList.contains('ov-pan')) {
                        draggingPanel.parentElement.classList.remove('open');
                    } else {
                        draggingPanel.classList.remove('open');
                    }
                    draggingPanel.style.transform = '';
                }, 300);
            } else {
                draggingPanel.style.transform = 'translateY(0)';
                setTimeout(() => { draggingPanel.style.transform = ''; }, 300);
            }
            draggingPanel = null;
        };

        document.addEventListener('touchstart', onTouchStart, {passive: false});
        document.addEventListener('touchmove', onTouchMove, {passive: false});
        document.addEventListener('touchend', onTouchEnd);
    }
};

document.addEventListener('DOMContentLoaded', () => UI.setupMobileGestures());
