/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PERSISTENCE (v16.5.0 - Extracted from engine.js)
   Mixin providing save/load and worker communication for the game engine.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const Persistence = {
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
                camX: currentCamX,
                seasonalVisited: typeof Seasonal !== 'undefined' ? Seasonal._eventsVisited : {}
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
            if (d.seasonalVisited && typeof Seasonal !== 'undefined') Seasonal._eventsVisited = d.seasonalVisited;

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
                if (typeof UI !== 'undefined') UI.addLog(`\ud83d\udcc2 Loaded ${d.discovered.length} discovered models.`);
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
            if (typeof UI !== 'undefined') UI.addLog(`\ud83d\udd04 Auto-scan: every ${this.autoScanMin}m`);
        }
    },

    _postToWorker() {
        if (!this._computeWorker) return;
        try {
            const models = [];
            for (let i = 0; i < this.models.length; i++) {
                const m = this.models[i];
                models.push({ id: m.id, lab: m.lab, name: m.name, ret: m.ret, os: m.os, phase: m.phase, _src: m._src });
            }
            const labRegions = {};
            for (const k in LABS) if (LABS[k]) labRegions[k] = LABS[k].region || 'eu';
            this._computeWorker.postMessage({
                type: 'crunch',
                payload: { models, benchmarks: (typeof BM !== 'undefined' ? BM : {}), costs: (typeof COSTS !== 'undefined' ? COSTS : {}), labRegions }
            });
        } catch(ex) { /* serialization failed — will use inline fallback */ }
    }
};
