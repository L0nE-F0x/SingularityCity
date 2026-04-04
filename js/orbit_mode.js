/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ORBIT MODE (v2.0.0 — Top-Down Pixel Art Earth with Real Satellite Data)
   Activated via minimap 🛰️ Orbit button. Top-down view of Earth with cute pixel art
   satellites orbiting on rings. Fetches real data from CelesTrak, filtered to user's
   timezone region. Matches the 2D pixel art aesthetic of the rest of the city.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const OrbitMode = {
    active: false,
    layer: null,
    _built: false,
    _transitioning: false,
    _exiting: false,
    _transitionProgress: 0,
    _pullCount: 0,
    _pullDecay: null,

    satellites: [],
    _satSprites: [],
    _satGroups: {},
    _earthCont: null,
    _orbitRings: null,
    _starField: null,
    _satLayer: null,
    _hudCont: null,
    _tooltip: null,
    _orbitTick: 0,
    _earthRadius: 0,
    _centerX: 0,
    _centerY: 0,

    // Saved camera state
    _savedCamX: 0, _savedCamY: 0, _savedCamZoom: 1,

    CACHE_KEY: 'sc_orbit_sats',
    CACHE_TTL: 60 * 60 * 1000,

    // ─── SATELLITE FETCH ───
    async fetchSatellites() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
                this.satellites = cached.data;
                this._groupSatellites();
                console.log(`🛰️ Orbit: Using cached ${this.satellites.length} satellites`);
                return;
            }
        } catch (_) {}

        try {
            const urls = [
                'https://celestrak.org/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json',
                'https://celestrak.org/NORAD/elements/gp.php?GROUP=oneweb&FORMAT=json'
            ];
            const results = await Promise.allSettled(
                urls.map(u => fetch(u, { signal: AbortSignal.timeout(12000) }).then(r => r.ok ? r.json() : []))
            );

            let sats = [];
            const starlinkRaw = results[0].status === 'fulfilled' ? results[0].value : [];
            const onewebRaw = results[1].status === 'fulfilled' ? results[1].value : [];

            // Filter to user's longitude region (+/- 60 degrees) based on RAAN
            const userLon = this._getUserLongitude();
            const filterByRegion = (arr) => {
                return arr.filter(s => {
                    const raan = s.RA_OF_ASC_NODE || 0;
                    const diff = Math.abs(((raan - userLon + 540) % 360) - 180);
                    return diff < 90; // show satellites in a 180-degree arc around user
                });
            };

            const regionStarlink = filterByRegion(starlinkRaw);
            const regionOneweb = filterByRegion(onewebRaw);

            const sampleStarlink = this._sampleArray(regionStarlink.length ? regionStarlink : starlinkRaw, 80);
            const sampleOneweb = this._sampleArray(regionOneweb.length ? regionOneweb : onewebRaw, 20);

            sats = [
                ...sampleStarlink.map(s => this._parseSat(s, 'starlink')),
                ...sampleOneweb.map(s => this._parseSat(s, 'oneweb'))
            ];

            // Always show ISS
            sats.push({
                name: 'ISS (ZARYA)', group: 'iss', noradId: 25544,
                inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5,
                altitude: 420, phase: Math.random() * 360, raan: Math.random() * 360
            });

            // GPS + Galileo
            sats.push(
                { name: 'GPS BIIR-2', group: 'gps', noradId: 28474, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 45 },
                { name: 'GPS BIIR-3', group: 'gps', noradId: 28874, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 120 },
                { name: 'GALILEO-1', group: 'galileo', noradId: 37846, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 90 },
                { name: 'GALILEO-2', group: 'galileo', noradId: 38857, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 270 }
            );

            if (sampleStarlink.length === 0 && sampleOneweb.length === 0) {
                this._generateFallbackSatellites();
            } else {
                this.satellites = sats;
                this._groupSatellites();
                try {
                    localStorage.setItem(this.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: sats }));
                } catch (_) {}
            }

            console.log(`🛰️ Orbit: Loaded ${this.satellites.length} satellites (filtered to your region)`);
        } catch (e) {
            console.warn('[Orbit] Satellite fetch failed:', e.message);
            this._generateFallbackSatellites();
        }
    },

    _getUserLongitude() {
        // Approximate longitude from timezone offset
        const offsetMin = new Date().getTimezoneOffset();
        return -offsetMin / 4; // 1 degree = 4 minutes of time
    },

    _parseSat(raw, group) {
        return {
            name: raw.OBJECT_NAME || 'Unknown', group, noradId: raw.NORAD_CAT_ID || 0,
            inclination: raw.INCLINATION || 53, eccentricity: raw.ECCENTRICITY || 0.0001,
            meanMotion: raw.MEAN_MOTION || 15.0,
            altitude: raw.MEAN_MOTION ? (8681663.5 / Math.pow(raw.MEAN_MOTION, 2/3)) - 6371 : 550,
            phase: raw.MEAN_ANOMALY || Math.random() * 360,
            raan: raw.RA_OF_ASC_NODE || Math.random() * 360
        };
    },

    _sampleArray(arr, n) {
        if (arr.length <= n) return arr;
        const step = arr.length / n;
        const result = [];
        for (let i = 0; i < n; i++) result.push(arr[Math.floor(i * step)]);
        return result;
    },

    _groupSatellites() {
        this._satGroups = { starlink: [], oneweb: [], iss: [], gps: [], galileo: [], other: [] };
        this.satellites.forEach(s => {
            const g = this._satGroups[s.group] || this._satGroups.other;
            g.push(s);
        });
    },

    _generateFallbackSatellites() {
        const sats = [];
        for (let i = 0; i < 60; i++) {
            sats.push({
                name: `STARLINK-${1000 + i}`, group: 'starlink', noradId: 50000 + i,
                inclination: 53 + Math.random() * 4, eccentricity: 0.0001,
                meanMotion: 15.0 + Math.random() * 0.5, altitude: 540 + Math.random() * 30,
                phase: Math.random() * 360, raan: Math.random() * 360
            });
        }
        sats.push({ name: 'ISS (ZARYA)', group: 'iss', noradId: 25544, inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5, altitude: 420, phase: Math.random() * 360, raan: 0 });
        sats.push({ name: 'GPS BIIR-2', group: 'gps', noradId: 28474, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 45 });
        sats.push({ name: 'GALILEO-1', group: 'galileo', noradId: 37846, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 90 });
        this.satellites = sats;
        this._groupSatellites();
    },

    // Pull detection (kept for API compatibility but no longer triggered from camera)
    registerPull() {},

    // ─── ENTER / EXIT ───
    async enter() {
        if (this.active || this._transitioning) return;
        this._transitioning = true;
        this._exiting = false;
        this._transitionProgress = 0;

        this._savedCamX = Camera.targetX;
        this._savedCamY = Camera.targetY;
        this._savedCamZoom = Camera.targetZoom;

        if (typeof G !== 'undefined' && G.tracking) G.stopTracking();
        if (this.satellites.length === 0) await this.fetchSatellites();
        if (!this._built) this._build();

        this.layer.visible = true;
        this.layer.alpha = 0;
        this.active = true;

        this._showExitBtn();

        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = 'none';
        const htmlTips = document.querySelectorAll('.bld-tip, .ship-tip, .tooltip, [id*="tooltip"], [id*="Tip"]');
        htmlTips.forEach(t => { t.style.display = 'none'; });

        if (typeof SND !== 'undefined') SND.setAmbient('orbit');

        if (G.app && G.app.renderer && G.app.renderer.background) {
            G.app.renderer.background.alpha = 1;
            G.app.renderer.background.color = 0x020208;
        }

        if (typeof UI !== 'undefined') UI.addToast('🛰️ Entering orbit view...');
    },

    exit() {
        if (!this.active) return;
        this._transitioning = true;
        this._exiting = true;
        this._transitionProgress = 1;
        if (typeof SND !== 'undefined') SND.setAmbient('outside');
    },

    _completeExit() {
        this.active = false;
        this._transitioning = false;
        this._exiting = false;
        this._transitionProgress = 0;

        if (this.layer) this.layer.visible = false;

        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = '';

        if (G.app && G.app.renderer && G.app.renderer.background) {
            G.app.renderer.background.alpha = 0;
        }

        if (G.world) { G.world.visible = true; G.world.alpha = 1; }

        const exitBtn = document.getElementById('btnExitOrbit');
        if (exitBtn) exitBtn.style.display = 'none';
        if (this._tooltip) this._tooltip.visible = false;

        if (typeof Camera !== 'undefined') {
            Camera.targetX = this._savedCamX || 0;
            Camera.targetY = this._savedCamY || 0;
            Camera.targetZoom = this._savedCamZoom || 1;
            Camera.x = Camera.targetX;
            Camera.y = Camera.targetY;
            Camera.zoom = Camera.targetZoom;
        }
    },

    // ─── BUILD TOP-DOWN PIXEL ART SCENE ───
    _build() {
        if (!G.app) return;
        this.layer = new PIXI.Container();
        G.app.stage.addChild(this.layer);

        const W = G.vpW, H = G.vpH;
        this._centerX = W / 2;
        this._centerY = H / 2;
        this._earthRadius = Math.min(W, H) * 0.22;

        // Background
        const bg = new PIXI.Graphics();
        bg.beginFill(0x020208);
        bg.drawRect(-200, -200, W + 400, H + 400);
        bg.endFill();
        this.layer.addChild(bg);
        this._bgGfx = bg;

        // Star field
        this._starField = new PIXI.Container();
        for (let i = 0; i < 300; i++) {
            const s = new PIXI.Graphics();
            const sz = Math.random() < 0.1 ? 2 : 1; // pixel art: 1px or 2px dots
            s.beginFill(0xffffff, 0.3 + Math.random() * 0.5);
            s.drawRect(0, 0, sz, sz); // square pixels, not circles
            s.endFill();
            s.x = Math.floor(Math.random() * W);
            s.y = Math.floor(Math.random() * H);
            s._twinklePhase = Math.random() * Math.PI * 2;
            s._twinkleSpeed = 0.01 + Math.random() * 0.02;
            this._starField.addChild(s);
        }
        this.layer.addChild(this._starField);

        // Orbit rings (dashed circles at different altitudes)
        this._orbitRings = new PIXI.Graphics();
        this._drawOrbitRings();
        this.layer.addChild(this._orbitRings);

        // Earth (top-down pixel art circle)
        this._earthCont = new PIXI.Container();
        this._drawEarth();
        this.layer.addChild(this._earthCont);

        // Satellite layer
        this._satLayer = new PIXI.Container();
        this.layer.addChild(this._satLayer);
        this._buildSatelliteSprites();

        // HUD
        this._hudCont = new PIXI.Container();
        this._buildHUD();
        this.layer.addChild(this._hudCont);

        // Tooltip
        this._tooltip = new PIXI.Container();
        this._tooltip.visible = false;
        this._tooltipBg = new PIXI.Graphics();
        this._tooltipText = new PIXI.Text('', { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#ffffff', wordWrap: true, wordWrapWidth: 200 });
        this._tooltip.addChild(this._tooltipBg, this._tooltipText);
        this.layer.addChild(this._tooltip);

        // Tap interaction
        this.layer.eventMode = 'static';
        this.layer.on('pointerdown', (e) => this._onTap(e));

        this._built = true;
    },

    _drawEarth() {
        this._earthCont.removeChildren();
        const cx = this._centerX, cy = this._centerY, r = this._earthRadius;
        const earth = new PIXI.Graphics();

        // Ocean (dark blue circle)
        earth.beginFill(0x0a1a3a);
        earth.drawCircle(cx, cy, r);
        earth.endFill();

        // Latitude/longitude grid (subtle)
        earth.lineStyle(1, 0x1a3060, 0.25);
        earth.drawCircle(cx, cy, r * 0.33);
        earth.drawCircle(cx, cy, r * 0.66);
        earth.moveTo(cx - r, cy); earth.lineTo(cx + r, cy);
        earth.moveTo(cx, cy - r); earth.lineTo(cx, cy + r);
        // Diagonals
        const d = r * 0.707;
        earth.moveTo(cx - d, cy - d); earth.lineTo(cx + d, cy + d);
        earth.moveTo(cx + d, cy - d); earth.lineTo(cx - d, cy + d);
        earth.lineStyle(0);

        // Day/night terminator based on real time
        const dp = G.getDayPhase();
        const terminatorAngle = dp * Math.PI * 2 - Math.PI / 2;
        // Dark side overlay (half the earth in shadow)
        earth.beginFill(0x000008, 0.5);
        earth.arc(cx, cy, r, terminatorAngle, terminatorAngle + Math.PI);
        earth.lineTo(cx, cy);
        earth.closePath();
        earth.endFill();

        // City light clusters on the dark side (pixel dots)
        const clusters = [
            { angle: 0.0, dist: 0.4, count: 5 },     // East coast US
            { angle: 0.5, dist: 0.3, count: 6 },      // Europe
            { angle: 0.8, dist: 0.5, count: 4 },       // East Asia
            { angle: 1.2, dist: 0.6, count: 3 },       // SE Asia
            { angle: 0.3, dist: 0.55, count: 3 },      // Middle East
            { angle: -0.3, dist: 0.35, count: 4 },     // West coast US
            { angle: -0.5, dist: 0.7, count: 2 },      // South America
            { angle: 0.6, dist: 0.7, count: 2 },       // Africa
            { angle: 1.5, dist: 0.55, count: 2 },      // Australia
        ];
        clusters.forEach(c => {
            for (let i = 0; i < c.count; i++) {
                const a = c.angle + (Math.random() - 0.5) * 0.3;
                const d = c.dist + (Math.random() - 0.5) * 0.15;
                const lx = cx + Math.cos(a) * r * d;
                const ly = cy + Math.sin(a) * r * d;
                earth.beginFill(0xffcc44, 0.4 + Math.random() * 0.4);
                earth.drawRect(Math.floor(lx), Math.floor(ly), 1, 1); // 1px pixel dots
                earth.endFill();
            }
        });

        // Atmosphere glow ring
        earth.lineStyle(3, 0x4488ff, 0.15);
        earth.drawCircle(cx, cy, r + 4);
        earth.lineStyle(2, 0x66bbff, 0.25);
        earth.drawCircle(cx, cy, r + 2);
        earth.lineStyle(1, 0x88ccff, 0.4);
        earth.drawCircle(cx, cy, r + 1);

        // "YOU ARE HERE" marker based on timezone
        const userLon = this._getUserLongitude();
        const userAngle = (userLon / 180) * Math.PI - Math.PI / 2;
        const markerX = cx + Math.cos(userAngle) * r * 0.6;
        const markerY = cy + Math.sin(userAngle) * r * 0.6;
        earth.beginFill(0x4ade80);
        earth.drawRect(Math.floor(markerX) - 1, Math.floor(markerY) - 1, 3, 3);
        earth.endFill();
        // Pulsing ring drawn in update()

        this._earthCont.addChild(earth);
        this._earthGfx = earth;

        // "YOU" label
        const youLabel = new PIXI.Text('YOU', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 6, fill: '#4ade80'
        });
        youLabel.anchor.set(0.5, 0);
        youLabel.x = Math.floor(markerX);
        youLabel.y = Math.floor(markerY) + 5;
        this._earthCont.addChild(youLabel);
        this._youMarkerX = markerX;
        this._youMarkerY = markerY;
    },

    _drawOrbitRings() {
        const g = this._orbitRings;
        g.clear();
        const cx = this._centerX, cy = this._centerY, r = this._earthRadius;

        // LEO ring (Starlink ~550km)
        const leoR = r + r * 0.35;
        this._drawDashedCircle(g, cx, cy, leoR, 0x44aaff, 0.12, 4, 6);

        // MEO ring (OneWeb ~1200km)
        const meoR = r + r * 0.55;
        this._drawDashedCircle(g, cx, cy, meoR, 0xff8844, 0.10, 4, 8);

        // GPS ring (~20200km)
        const gpsR = r + r * 0.85;
        this._drawDashedCircle(g, cx, cy, gpsR, 0x44ff88, 0.08, 3, 10);

        // Labels on rings
        const ringLabels = [
            { r: leoR, label: 'LEO 550km', color: '#44aaff' },
            { r: meoR, label: '1,200km', color: '#ff8844' },
            { r: gpsR, label: 'GPS 20,200km', color: '#44ff88' },
        ];
        ringLabels.forEach(rl => {
            const lbl = new PIXI.Text(rl.label, {
                fontFamily: 'JetBrains Mono, monospace', fontSize: 7, fill: rl.color
            });
            lbl.alpha = 0.4;
            lbl.x = cx + rl.r * 0.7;
            lbl.y = cy - rl.r * 0.7 - 8;
            this._orbitRings.addChild(lbl);
        });
    },

    _drawDashedCircle(g, cx, cy, radius, color, alpha, dashLen, gapLen) {
        const circumference = 2 * Math.PI * radius;
        const segLen = dashLen + gapLen;
        const segments = Math.floor(circumference / segLen);
        g.lineStyle(1, color, alpha);
        for (let i = 0; i < segments; i++) {
            const startAngle = (i * segLen / circumference) * Math.PI * 2;
            const endAngle = ((i * segLen + dashLen) / circumference) * Math.PI * 2;
            g.moveTo(cx + Math.cos(startAngle) * radius, cy + Math.sin(startAngle) * radius);
            // Draw small line segments along the arc
            const steps = 3;
            for (let s = 1; s <= steps; s++) {
                const a = startAngle + (endAngle - startAngle) * (s / steps);
                g.lineTo(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius);
            }
        }
        g.lineStyle(0);
    },

    // ─── PIXEL ART SATELLITE SPRITES ───
    _buildSatelliteSprites() {
        this._satSprites = [];
        const cx = this._centerX, cy = this._centerY, r = this._earthRadius;

        const groupColors = {
            starlink: 0x44aaff, oneweb: 0xff8844,
            iss: 0xffff00, gps: 0x44ff88,
            galileo: 0xaa88ff, other: 0x888888
        };

        this.satellites.forEach((sat) => {
            const color = groupColors[sat.group] || 0x888888;
            const g = new PIXI.Graphics();

            if (sat.group === 'iss') {
                // Pixel art ISS — larger, detailed
                // Main truss
                g.beginFill(0xc0c0c0);
                g.drawRect(-6, -1, 12, 2);
                g.endFill();
                // Solar panels (4 pairs)
                g.beginFill(0x3366cc);
                g.drawRect(-8, -4, 3, 3); g.drawRect(-8, 1, 3, 3);
                g.drawRect(-3, -4, 3, 3); g.drawRect(-3, 1, 3, 3);
                g.drawRect(1, -4, 3, 3);  g.drawRect(1, 1, 3, 3);
                g.drawRect(5, -4, 3, 3);  g.drawRect(5, 1, 3, 3);
                g.endFill();
                // Modules (center)
                g.beginFill(0xeeeeee);
                g.drawRect(-2, -1, 4, 2);
                g.endFill();
            } else if (sat.group === 'gps' || sat.group === 'galileo') {
                // Pixel art nav sat — body + small panels
                g.beginFill(color);
                g.drawRect(-1, -1, 3, 3);
                g.endFill();
                g.beginFill(0x2255aa);
                g.drawRect(-3, -1, 2, 2);
                g.drawRect(2, -1, 2, 2);
                g.endFill();
                // Antenna
                g.beginFill(0xcccccc);
                g.drawRect(0, -3, 1, 2);
                g.endFill();
            } else {
                // Starlink/OneWeb — tiny pixel dot with mini solar panels
                g.beginFill(color);
                g.drawRect(0, 0, 2, 2);
                g.endFill();
                // Tiny solar panels
                g.beginFill(color, 0.5);
                g.drawRect(-2, 0, 2, 1);
                g.drawRect(2, 0, 2, 1);
                g.endFill();
            }

            // Calculate orbit radius on screen
            const altNorm = Math.log(1 + (sat.altitude - 200) / 35800 * 9) / Math.log(10);
            const orbitR = r + r * (0.35 + altNorm * 0.6);
            const startAngle = (sat.phase / 180) * Math.PI;

            g.x = cx + Math.cos(startAngle) * orbitR;
            g.y = cy + Math.sin(startAngle) * orbitR;

            g._sat = sat;
            g._orbitRadius = orbitR;
            g._orbitPhase = startAngle;
            g._orbitSpeed = (sat.meanMotion / 15) * 0.002; // faster for visual interest
            g._baseColor = color;

            this._satLayer.addChild(g);
            this._satSprites.push(g);
        });
    },

    // ─── HUD ───
    _buildHUD() {
        const W = G.vpW;

        const title = new PIXI.Text('ORBIT VIEW', {
            fontFamily: 'Press Start 2P, monospace', fontSize: 12, fill: '#66bbff', letterSpacing: 2
        });
        title.x = 16; title.y = 16;
        this._hudCont.addChild(title);

        this._satCountText = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#88aacc'
        });
        this._satCountText.x = 16; this._satCountText.y = 36;
        this._hudCont.addChild(this._satCountText);

        // Location info
        const tzOffset = new Date().getTimezoneOffset();
        const tzHours = -tzOffset / 60;
        const tzStr = `UTC${tzHours >= 0 ? '+' : ''}${tzHours}`;
        const locText = new PIXI.Text(`Showing satellites near ${tzStr}`, {
            fontFamily: 'JetBrains Mono, monospace', fontSize: 8, fill: '#4ade80'
        });
        locText.x = 16; locText.y = 52;
        this._hudCont.addChild(locText);

        // Legend
        const legendItems = [
            { color: 0x44aaff, label: 'Starlink' },
            { color: 0xff8844, label: 'OneWeb' },
            { color: 0xffff00, label: 'ISS' },
            { color: 0x44ff88, label: 'GPS' },
            { color: 0xaa88ff, label: 'Galileo' }
        ];
        legendItems.forEach((item, i) => {
            const dot = new PIXI.Graphics();
            dot.beginFill(item.color);
            dot.drawRect(0, 0, 4, 4); // pixel square
            dot.endFill();
            dot.x = 18; dot.y = 72 + i * 16;

            const lbl = new PIXI.Text(item.label, {
                fontFamily: 'JetBrains Mono, monospace', fontSize: 9, fill: '#aabbcc'
            });
            lbl.x = 28; lbl.y = 72 + i * 16 - 3;
            this._hudCont.addChild(dot, lbl);
        });
    },

    // ─── TAP INTERACTION ───
    _onTap(e) {
        if (!this.active || this._transitioning) return;
        const pos = e.data ? e.data.global : e.global;
        if (!pos) return;

        let closest = null, closestDist = 15;
        this._satSprites.forEach(sp => {
            if (sp.destroyed) return;
            const dx = sp.x - pos.x;
            const dy = sp.y - pos.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < closestDist) { closestDist = d; closest = sp; }
        });

        if (closest && closest._sat) {
            this._showTooltip(closest);
        } else {
            if (this._tooltip) this._tooltip.visible = false;
        }
    },

    _showTooltip(sprite) {
        const sat = sprite._sat;
        const altStr = sat.altitude < 1000 ? `${Math.round(sat.altitude)}km` : `${(sat.altitude / 1000).toFixed(1)}K km`;
        const speedKmS = (2 * Math.PI * (6371 + sat.altitude)) / (86400 / sat.meanMotion);

        this._tooltipText.text = `${sat.name}\nGroup: ${sat.group.toUpperCase()}\nAlt: ${altStr}\nIncl: ${sat.inclination.toFixed(1)}°\nSpeed: ${speedKmS.toFixed(1)} km/s\nNORAD: ${sat.noradId}`;

        this._tooltipBg.clear();
        this._tooltipBg.beginFill(0x0a1628, 0.92);
        this._tooltipBg.lineStyle(1, 0x44aaff, 0.6);
        this._tooltipBg.drawRect(-8, -8, this._tooltipText.width + 16, this._tooltipText.height + 16);
        this._tooltipBg.endFill();

        this._tooltip.x = Math.min(sprite.x + 12, G.vpW - this._tooltipText.width - 30);
        this._tooltip.y = Math.max(sprite.y - 20, 10);
        this._tooltip.visible = true;
    },

    _showExitBtn() {
        let btn = document.getElementById('btnExitOrbit');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btnExitOrbit';
            btn.innerHTML = '🌍 RETURN TO CITY';
            btn.style.cssText = 'position:absolute;top:0;right:20px;z-index:9999;background:linear-gradient(135deg,#1a3a5c,#0d2240);color:#66bbff;border:none;border-bottom:3px solid #44aaff;padding:12px 20px;border-radius:0 0 6px 6px;cursor:pointer;font-size:12px;font-weight:bold;font-family:"Press Start 2P",monospace;box-shadow:0 4px 12px rgba(68,170,255,0.3);transition:background 0.2s;';
            btn.onmouseover = () => { btn.style.background = 'linear-gradient(135deg,#234b6e,#153050)'; };
            btn.onmouseout = () => { btn.style.background = 'linear-gradient(135deg,#1a3a5c,#0d2240)'; };
            btn.onclick = () => { if (typeof SND !== 'undefined') SND.uiClick(); this.exit(); };
            document.body.appendChild(btn);
        }
        btn.style.display = 'block';
    },

    // ─── FRAME UPDATE ───
    update() {
        if (!this.active && !this._transitioning) return;
        this._orbitTick++;

        // Transition animation
        if (this._transitioning) {
            if (!this._exiting) {
                this._transitionProgress = Math.min(1, this._transitionProgress + 0.03);
                this.layer.alpha = this._transitionProgress;
                if (G.world) G.world.alpha = 1 - this._transitionProgress;
                if (this._transitionProgress >= 1) {
                    this._transitioning = false;
                    if (G.world) G.world.visible = false;
                }
            } else {
                this._transitionProgress = Math.max(0, this._transitionProgress - 0.035);
                this.layer.alpha = this._transitionProgress;
                if (G.world) { G.world.visible = true; G.world.alpha = 1 - this._transitionProgress; }
                if (this._transitionProgress <= 0) {
                    this._completeExit();
                    if (G.world) G.world.alpha = 1;
                    return;
                }
            }
        }

        if (!this.active) return;

        const cx = this._centerX, cy = this._centerY;

        // Animate satellites orbiting around Earth
        this._satSprites.forEach(sp => {
            if (sp.destroyed) return;
            sp._orbitPhase += sp._orbitSpeed;
            sp.x = cx + Math.cos(sp._orbitPhase) * sp._orbitRadius;
            sp.y = cy + Math.sin(sp._orbitPhase) * sp._orbitRadius;

            // Rotate satellite sprite to face direction of travel
            sp.rotation = sp._orbitPhase + Math.PI / 2;

            // Dim satellites on the "far side" of Earth (behind the planet)
            const distFromCenter = Math.sqrt((sp.x - cx) ** 2 + (sp.y - cy) ** 2);
            const behindEarth = distFromCenter < this._earthRadius * 0.9;
            sp.visible = !behindEarth;

            // ISS blink
            if (sp._sat.group === 'iss') {
                sp.alpha = 0.8 + Math.sin(this._orbitTick * 0.08) * 0.2;
            }
        });

        // Twinkle stars
        if (this._orbitTick % 3 === 0) {
            this._starField.children.forEach(s => {
                if (s.destroyed) return;
                s.alpha = 0.15 + Math.sin(this._orbitTick * s._twinkleSpeed + s._twinklePhase) * 0.35;
            });
        }

        // Update HUD
        if (this._satCountText && this._orbitTick % 30 === 0) {
            const g = this._satGroups;
            this._satCountText.text =
                `Tracking ${this.satellites.length} satellites  |  ` +
                `Starlink: ${g.starlink ? g.starlink.length : 0}  ` +
                `OneWeb: ${g.oneweb ? g.oneweb.length : 0}  ` +
                `GPS: ${(g.gps ? g.gps.length : 0) + (g.galileo ? g.galileo.length : 0)}`;
        }
    },

    resize() {
        if (!this._built) return;
        const W = G.vpW, H = G.vpH;
        this._centerX = W / 2;
        this._centerY = H / 2;
        this._earthRadius = Math.min(W, H) * 0.22;

        if (this._bgGfx) {
            this._bgGfx.clear();
            this._bgGfx.beginFill(0x020208);
            this._bgGfx.drawRect(-200, -200, W + 400, H + 400);
            this._bgGfx.endFill();
        }
        this._drawOrbitRings();
        this._earthCont.removeChildren();
        this._drawEarth();
        this._satLayer.removeChildren();
        this._satSprites = [];
        this._buildSatelliteSprites();
        this._hudCont.removeChildren();
        this._buildHUD();
    }
};
