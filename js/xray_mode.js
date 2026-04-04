/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   X-RAY MODE (v1.0.0 — Data Spine Diagnostic Overlay)
   Strips away city visuals to reveal pure data flows, network connections, building stats,
   and inter-lab relationships as a dark hacker/terminal aesthetic.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const XRayMode = {
    active: false,
    overlay: null,         // PIXI container for x-ray graphics
    _dataFlows: [],        // Animated data packets between buildings
    _statLabels: [],       // Building stat text overlays
    _wireframes: [],       // Building wireframe outlines
    _gridLines: null,      // Background grid
    _connectionLines: null, // Lab-to-lab connection lines
    _pulseRings: [],       // Pulse rings at building bases
    _scanLine: null,       // Horizontal scan line effect
    _scanY: 0,

    // Saved layer alphas for restoration
    _savedAlphas: {},

    toggle() {
        if (this.active) this.exit();
        else this.enter();
    },

    enter() {
        if (this.active || !G.app || G.activeInterior) return;
        if (typeof OrbitMode !== 'undefined' && OrbitMode.active) return;
        this.active = true;

        const btn = document.getElementById('btnXRay');
        if (btn) btn.classList.add('xray-active');

        const wrap = document.getElementById('gameWrap');
        if (wrap) wrap.classList.add('xray-mode');

        // Save & dim existing layers
        this._savedAlphas = {
            cloud: G.cloudLayer ? G.cloudLayer.alpha : 1,
            stars: G.starsLayer ? G.starsLayer.alpha : 1,
            celestial: G.celestialGfx ? G.celestialGfx.alpha : 1,
            light: G.lightLayer ? G.lightLayer.alpha : 1,
            staticLights: G.staticLightsGfx ? G.staticLightsGfx.alpha : 1,
            char: G.charLayer ? G.charLayer.alpha : 1,
            car: G.carLayer ? G.carLayer.alpha : 1,
            fx: G.fxGfx ? G.fxGfx.alpha : 1,
            reflection: G.reflectionLayer ? G.reflectionLayer.alpha : 1,
        };

        if (G.cloudLayer) G.cloudLayer.alpha = 0;
        if (G.starsLayer) G.starsLayer.alpha = 0.15;
        if (G.celestialGfx) G.celestialGfx.alpha = 0;
        if (G.lightLayer) G.lightLayer.alpha = 0.1;
        if (G.staticLightsGfx) G.staticLightsGfx.alpha = 0.1;
        if (G.charLayer) G.charLayer.alpha = 0.08;
        if (G.carLayer) G.carLayer.alpha = 0.05;
        if (G.fxGfx) G.fxGfx.alpha = 0.1;
        if (G.reflectionLayer) G.reflectionLayer.alpha = 0;

        // Dim building layer and tint
        if (G.bldLayer) G.bldLayer.alpha = 0.15;
        if (G.groundGfx) G.groundGfx.alpha = 0.2;

        // Build overlay
        this.overlay = new PIXI.Container();
        this.overlay.zIndex = 999;
        G.world.addChild(this.overlay);

        this._buildGrid();
        this._buildWireframes();
        this._buildConnections();
        this._buildStatLabels();
        this._buildScanLine();

        console.log('🔬 X-Ray Mode activated');
    },

    exit() {
        if (!this.active) return;
        this.active = false;

        const btn = document.getElementById('btnXRay');
        if (btn) btn.classList.remove('xray-active');

        const wrap = document.getElementById('gameWrap');
        if (wrap) wrap.classList.remove('xray-mode');

        // Restore layer alphas
        if (G.cloudLayer) G.cloudLayer.alpha = this._savedAlphas.cloud || 1;
        if (G.starsLayer) G.starsLayer.alpha = this._savedAlphas.stars || 1;
        if (G.celestialGfx) G.celestialGfx.alpha = this._savedAlphas.celestial || 1;
        if (G.lightLayer) G.lightLayer.alpha = this._savedAlphas.light || 1;
        if (G.staticLightsGfx) G.staticLightsGfx.alpha = this._savedAlphas.staticLights || 1;
        if (G.charLayer) G.charLayer.alpha = this._savedAlphas.char || 1;
        if (G.carLayer) G.carLayer.alpha = this._savedAlphas.car || 1;
        if (G.fxGfx) G.fxGfx.alpha = this._savedAlphas.fx || 1;
        if (G.reflectionLayer) G.reflectionLayer.alpha = this._savedAlphas.reflection || 1;
        if (G.bldLayer) G.bldLayer.alpha = 1;
        if (G.groundGfx) G.groundGfx.alpha = 1;

        // Remove overlay
        if (this.overlay) {
            if (this.overlay.parent) this.overlay.parent.removeChild(this.overlay);
            this.overlay.destroy({ children: true });
            this.overlay = null;
        }

        this._dataFlows = [];
        this._statLabels = [];
        this._wireframes = [];
        this._pulseRings = [];
        this._gridLines = null;
        this._connectionLines = null;
        this._scanLine = null;

        console.log('🔬 X-Ray Mode deactivated');
    },

    // ─── GRID: Subtle coordinate grid across the city ───
    _buildGrid() {
        const g = new PIXI.Graphics();
        const gy = G.groundY;
        const cityW = G.cityW || G.getCityWidth();

        g.lineStyle(1, 0x00ff88, 0.06);
        // Vertical lines every 200px
        for (let x = 0; x < cityW; x += 200) {
            g.moveTo(x, gy - 300);
            g.lineTo(x, gy + 20);
        }
        // Horizontal lines
        for (let y = gy - 300; y <= gy + 20; y += 50) {
            g.moveTo(0, y);
            g.lineTo(cityW, y);
        }

        // Ground line highlight
        g.lineStyle(2, 0x00ff88, 0.3);
        g.moveTo(0, gy);
        g.lineTo(cityW, gy);

        this._gridLines = g;
        this.overlay.addChild(g);
    },

    // ─── WIREFRAMES: Neon outlines of all buildings ───
    _buildWireframes() {
        this._wireframes = [];
        this._pulseRings = [];
        const gy = G.groundY;

        BLDS.forEach(b => {
            if (!b.w || b.w < 10) return;
            const h = (b.fl || 2) * 18 + 24;
            const labColor = this._getLabColor(b);

            // Wireframe outline
            const wf = new PIXI.Graphics();
            wf.lineStyle(1.5, labColor, 0.7);
            wf.drawRect(b.x, gy - h, b.w, h);

            // Floor lines
            wf.lineStyle(0.5, labColor, 0.2);
            for (let f = 1; f < (b.fl || 2); f++) {
                const fy = gy - f * 18;
                wf.moveTo(b.x, fy);
                wf.lineTo(b.x + b.w, fy);
            }

            // Corner brackets (tech overlay feel)
            const bracketLen = Math.min(12, b.w * 0.15);
            wf.lineStyle(2, labColor, 0.9);
            // Top-left
            wf.moveTo(b.x, gy - h + bracketLen);
            wf.lineTo(b.x, gy - h);
            wf.lineTo(b.x + bracketLen, gy - h);
            // Top-right
            wf.moveTo(b.x + b.w - bracketLen, gy - h);
            wf.lineTo(b.x + b.w, gy - h);
            wf.lineTo(b.x + b.w, gy - h + bracketLen);
            // Bottom-left
            wf.moveTo(b.x, gy - bracketLen);
            wf.lineTo(b.x, gy);
            wf.lineTo(b.x + bracketLen, gy);
            // Bottom-right
            wf.moveTo(b.x + b.w - bracketLen, gy);
            wf.lineTo(b.x + b.w, gy);
            wf.lineTo(b.x + b.w, gy - bracketLen);

            this.overlay.addChild(wf);
            this._wireframes.push(wf);

            // Pulse ring at building base
            const ring = new PIXI.Graphics();
            ring._cx = b.x + b.w / 2;
            ring._cy = gy;
            ring._col = labColor;
            ring._phase = Math.random() * Math.PI * 2;
            ring._radius = b.w * 0.3;
            this.overlay.addChild(ring);
            this._pulseRings.push(ring);
        });
    },

    // ─── CONNECTIONS: Lines between buildings of the same lab ───
    _buildConnections() {
        const gy = G.groundY;
        const g = new PIXI.Graphics();
        const labGroups = {};

        BLDS.forEach(b => {
            if (!b.lab) return;
            if (!labGroups[b.lab]) labGroups[b.lab] = [];
            labGroups[b.lab].push(b);
        });

        // Draw arc connections between same-lab buildings
        Object.entries(labGroups).forEach(([lab, blds]) => {
            if (blds.length < 2) return;
            const col = this._getLabColorFromId(lab);

            for (let i = 0; i < blds.length - 1; i++) {
                const a = blds[i];
                const b = blds[i + 1];
                const ax = a.x + a.w / 2;
                const bx = b.x + b.w / 2;
                const midX = (ax + bx) / 2;
                const dist = Math.abs(bx - ax);
                const arcHeight = Math.min(dist * 0.15, 60);

                g.lineStyle(1, col, 0.15);
                g.moveTo(ax, gy - 5);
                g.quadraticCurveTo(midX, gy - 5 - arcHeight, bx, gy - 5);
            }

            // Spawn data flow packets between connected buildings
            if (blds.length >= 2) {
                for (let i = 0; i < Math.min(blds.length - 1, 3); i++) {
                    this._spawnDataFlow(blds[i], blds[i + 1], col);
                }
            }
        });

        // Cross-lab data flow: connect labs that share a zone
        const zonePairs = [
            ['robotics_', 0x22c55e],
            ['longevity_', 0x8b5cf6],
            ['backbone_', 0x06b6d4],
            ['dc_', 0x3b82f6],
            ['power_', 0xfbbf24],
        ];
        zonePairs.forEach(([prefix, col]) => {
            const zoneBlds = BLDS.filter(b => b.id.startsWith(prefix));
            for (let i = 0; i < zoneBlds.length - 1; i++) {
                const a = zoneBlds[i];
                const b = zoneBlds[i + 1];
                g.lineStyle(1, col, 0.12);
                g.moveTo(a.x + a.w / 2, gy - 5);
                g.lineTo(b.x + b.w / 2, gy - 5);
                this._spawnDataFlow(a, b, col);
            }
        });

        this._connectionLines = g;
        this.overlay.addChild(g);
    },

    _spawnDataFlow(bldA, bldB, col) {
        const gy = G.groundY;
        const packet = new PIXI.Graphics();
        packet.beginFill(col, 0.8);
        packet.drawCircle(0, 0, 2);
        packet.endFill();
        // Glow ring
        packet.lineStyle(1, col, 0.3);
        packet.drawCircle(0, 0, 4);

        const ax = bldA.x + bldA.w / 2;
        const bx = bldB.x + bldB.w / 2;
        const dist = Math.abs(bx - ax);
        const arcHeight = Math.min(dist * 0.15, 60);

        packet._ax = ax;
        packet._bx = bx;
        packet._arcHeight = arcHeight;
        packet._baseY = gy - 5;
        packet._t = Math.random(); // progress 0-1
        packet._speed = 0.003 + Math.random() * 0.004;
        packet._dir = Math.random() > 0.5 ? 1 : -1;

        packet.x = ax;
        packet.y = gy - 5;
        this.overlay.addChild(packet);
        this._dataFlows.push(packet);
    },

    // ─── STAT LABELS: Building name + key metrics floating above ───
    _buildStatLabels() {
        const gy = G.groundY;
        this._statLabels = [];

        BLDS.forEach(b => {
            if (!b.w || b.w < 30) return;
            const h = (b.fl || 2) * 18 + 24;
            const labColor = this._getLabColor(b);
            const hexStr = '#' + labColor.toString(16).padStart(6, '0');

            // Building ID label
            const idLabel = new PIXI.Text(b.id, {
                fontFamily: 'monospace', fontSize: 7, fill: hexStr, fontWeight: 'bold'
            });
            idLabel.anchor.set(0.5, 1);
            idLabel.x = b.x + b.w / 2;
            idLabel.y = gy - h - 18;
            this.overlay.addChild(idLabel);

            // Stats line
            const stats = [];
            if (b.lab) stats.push(b.lab.toUpperCase());
            if (b.fl) stats.push(b.fl + 'F');
            if (b.type) stats.push(b.type);
            if (b.dcData) stats.push(b.dcData.status || 'active');

            if (stats.length > 0) {
                const statLine = new PIXI.Text(stats.join(' | '), {
                    fontFamily: 'monospace', fontSize: 6, fill: 0x64748b
                });
                statLine.anchor.set(0.5, 1);
                statLine.x = b.x + b.w / 2;
                statLine.y = gy - h - 8;
                this.overlay.addChild(statLine);
                this._statLabels.push(statLine);
            }

            // Vertical data bar (height = relative floors)
            const maxFl = 50; // normalize against
            const barH = Math.min(h, ((b.fl || 2) / maxFl) * 80);
            const bar = new PIXI.Graphics();
            bar.beginFill(labColor, 0.25);
            bar.drawRect(0, 0, 3, barH);
            bar.endFill();
            bar.beginFill(labColor, 0.6);
            bar.drawRect(0, 0, 3, barH * 0.3); // highlight top
            bar.endFill();
            bar.x = b.x + b.w + 4;
            bar.y = gy - barH;
            this.overlay.addChild(bar);

            this._statLabels.push(idLabel);
        });
    },

    // ─── SCAN LINE: Horizontal sweep effect ───
    _buildScanLine() {
        const sl = new PIXI.Graphics();
        sl.beginFill(0x00ff88, 0.08);
        sl.drawRect(-5000, 0, 80000, 3);
        sl.endFill();
        // Glow above
        sl.beginFill(0x00ff88, 0.03);
        sl.drawRect(-5000, -15, 80000, 15);
        sl.endFill();
        this._scanLine = sl;
        this._scanY = G.groundY - 300;
        sl.y = this._scanY;
        this.overlay.addChild(sl);
    },

    // ─── UPDATE: Called every frame from engine ───
    update() {
        if (!this.active || !this.overlay) return;
        const fc = G.tick;

        // Data flow packets — move along arcs
        this._dataFlows.forEach(p => {
            if (!p || p.destroyed) return;
            p._t += p._speed * p._dir;
            if (p._t > 1) { p._t = 0; }
            if (p._t < 0) { p._t = 1; }

            const t = p._t;
            // Quadratic bezier interpolation
            const ax = p._ax;
            const bx = p._bx;
            const midX = (ax + bx) / 2;
            const x = (1 - t) * (1 - t) * ax + 2 * (1 - t) * t * midX + t * t * bx;
            const y = (1 - t) * (1 - t) * p._baseY + 2 * (1 - t) * t * (p._baseY - p._arcHeight) + t * t * p._baseY;
            p.x = x;
            p.y = y;
            p.alpha = 0.4 + Math.sin(t * Math.PI) * 0.6; // brightest at midpoint
        });

        // Pulse rings — breathing effect
        this._pulseRings.forEach(ring => {
            if (!ring || ring.destroyed) return;
            ring.clear();
            ring._phase += 0.03;
            const scale = 1 + Math.sin(ring._phase) * 0.3;
            const alpha = 0.15 + Math.sin(ring._phase) * 0.1;
            ring.lineStyle(1, ring._col, alpha);
            ring.drawCircle(ring._cx, ring._cy, ring._radius * scale);
        });

        // Scan line — sweep up and down
        if (this._scanLine) {
            this._scanY += 0.5;
            if (this._scanY > G.groundY + 20) this._scanY = G.groundY - 300;
            this._scanLine.y = this._scanY;
        }
    },

    // ─── HELPERS ───
    _getLabColor(bld) {
        if (bld.lab && typeof LABS !== 'undefined' && LABS[bld.lab]) {
            return parseInt(LABS[bld.lab].color.replace('#', ''), 16) || 0x00ff88;
        }
        // Zone-specific colors
        if (bld.type === 'robotics') return 0xf59e0b;
        if (bld.type === 'longevity') return 0x22c55e;
        if (bld.type === 'backbone') return 0x06b6d4;
        if (bld.type === 'court') return 0xef4444;
        if (bld.type === 'university') return 0x8b5cf6;
        if (bld.type === 'launchpad') return 0xf97316;
        if (bld.id.startsWith('dc_') || bld.id.startsWith('fab_')) return 0x3b82f6;
        if (bld.id.startsWith('power_')) return 0xfbbf24;
        if (bld.id.startsWith('port_')) return 0x06b6d4;
        if (bld.id.startsWith('vcrow_')) return 0x10b981;
        if (bld.id.startsWith('house_')) return 0xa855f7;
        if (bld.id.startsWith('res_')) return 0x64748b;
        return 0x00ff88; // default matrix green
    },

    _getLabColorFromId(labId) {
        if (typeof LABS !== 'undefined' && LABS[labId]) {
            return parseInt(LABS[labId].color.replace('#', ''), 16) || 0x00ff88;
        }
        return 0x00ff88;
    }
};
