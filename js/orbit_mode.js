/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ORBIT MODE (v1.0.0 — Low Earth Orbit View with Real Satellite Data)
   Pull up from the city sky boundary to transition into LEO. Starlink + other satellites
   mapped from CelesTrak GP data. Smooth city→stratosphere→space transition.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const OrbitMode = {
    active: false,
    layer: null,           // PIXI.Container added to app.stage
    _built: false,
    _transitioning: false,
    _exiting: false,        // true when transitioning OUT of orbit
    _transitionProgress: 0, // 0 = city, 1 = full orbit
    _pullCount: 0,          // consecutive upward scroll attempts at sky ceiling
    _pullDecay: null,       // timeout to reset pull count

    // Satellite data
    satellites: [],
    _satSprites: [],
    _satGroups: {},         // { starlink: [...], oneweb: [...], other: [...] }
    _earthGfx: null,
    _atmosGfx: null,
    _starField: null,
    _satLayer: null,
    _hudCont: null,
    _tooltip: null,
    _orbitTick: 0,

    // ─── SATELLITE FETCH (CelesTrak GP JSON) ───
    CACHE_KEY: 'sc_orbit_sats',
    CACHE_TTL: 60 * 60 * 1000,  // 1 hour

    async fetchSatellites() {
        // Check localStorage cache first
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
                this.satellites = cached.data;
                this._groupSatellites();
                console.log(`🛰️ Orbit: Using cached ${this.satellites.length} satellites`);
                return;
            }
        } catch (_) {}

        // Fetch Starlink constellation (biggest visual impact)
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

            // Take a sample — rendering 6000+ satellites kills performance
            const sampleStarlink = this._sampleArray(starlinkRaw, 300);
            const sampleOneweb = this._sampleArray(onewebRaw, 60);

            sats = [
                ...sampleStarlink.map(s => this._parseSat(s, 'starlink')),
                ...sampleOneweb.map(s => this._parseSat(s, 'oneweb'))
            ];

            // Add ISS manually (always visible)
            sats.push({
                name: 'ISS (ZARYA)', group: 'iss', noradId: 25544,
                inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5,
                altitude: 420, phase: Math.random() * 360, raan: Math.random() * 360
            });

            // Add some GPS/Galileo for variety
            sats.push(
                { name: 'GPS BIIR-2', group: 'gps', noradId: 28474, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 45 },
                { name: 'GPS BIIR-3', group: 'gps', noradId: 28874, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 120 },
                { name: 'GPS BIIR-6', group: 'gps', noradId: 29486, inclination: 55, eccentricity: 0.01, meanMotion: 2.0, altitude: 20200, phase: Math.random() * 360, raan: 200 },
                { name: 'GALILEO-1', group: 'galileo', noradId: 37846, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 90 },
                { name: 'GALILEO-2', group: 'galileo', noradId: 37847, inclination: 56, eccentricity: 0.0002, meanMotion: 1.7, altitude: 23222, phase: Math.random() * 360, raan: 270 }
            );

            // If API returned empty (CORS/blocked), use fallback constellation
            if (sampleStarlink.length === 0 && sampleOneweb.length === 0) {
                console.warn('[Orbit] CelesTrak returned empty — using fallback constellation');
                this._generateFallbackSatellites();
                return;
            }

            this.satellites = sats;
            this._groupSatellites();
            try { localStorage.setItem(this.CACHE_KEY, JSON.stringify({ ts: Date.now(), data: this.satellites })); } catch (_) {}
            console.log(`🛰️ Orbit: Loaded ${this.satellites.length} satellites (${sampleStarlink.length} Starlink, ${sampleOneweb.length} OneWeb)`);
        } catch (e) {
            console.warn('[Orbit] Satellite fetch failed:', e.message);
            this._generateFallbackSatellites();
        }
    },

    _parseSat(raw, group) {
        return {
            name: raw.OBJECT_NAME || 'Unknown',
            group,
            noradId: raw.NORAD_CAT_ID || 0,
            inclination: raw.INCLINATION || 53,
            eccentricity: raw.ECCENTRICITY || 0.0001,
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
        // If API fails, generate plausible Starlink-like distribution
        const sats = [];
        for (let i = 0; i < 200; i++) {
            sats.push({
                name: `STARLINK-${1000 + i}`,
                group: 'starlink',
                noradId: 50000 + i,
                inclination: 53 + (Math.random() - 0.5) * 4,
                eccentricity: 0.0001,
                meanMotion: 15.0 + (Math.random() - 0.5) * 0.4,
                altitude: 540 + Math.random() * 30,
                phase: Math.random() * 360,
                raan: Math.random() * 360
            });
        }
        sats.push({ name: 'ISS (ZARYA)', group: 'iss', noradId: 25544, inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5, altitude: 420, phase: Math.random() * 360, raan: Math.random() * 360 });
        this.satellites = sats;
        this._groupSatellites();
    },

    // ─── PULL DETECTION (called from Camera) ───
    registerPull() {
        if (this.active || this._transitioning) return;
        this._pullCount++;
        clearTimeout(this._pullDecay);
        this._pullDecay = setTimeout(() => { this._pullCount = 0; }, 800);

        if (this._pullCount >= 12) {
            this._pullCount = 0;
            this.enter();
        }
    },

    // ─── ENTER ORBIT ───
    async enter() {
        if (this.active || this._transitioning) return;
        this._transitioning = true;
        this._exiting = false;
        this._transitionProgress = 0;

        // Save camera state for restoration on exit
        this._savedCamX = Camera.targetX;
        this._savedCamY = Camera.targetY;
        this._savedCamZoom = Camera.targetZoom;

        // Stop tracking
        if (typeof G !== 'undefined' && G.tracking) G.stopTracking();

        // Fetch satellite data if we haven't yet
        if (this.satellites.length === 0) await this.fetchSatellites();

        // Build orbit layer if first time
        if (!this._built) this._build();

        this.layer.visible = true;
        this.layer.alpha = 0;
        this.active = true;

        // Show exit button
        this._showExitBtn();

        // Hide normal UI
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = 'none';
        // Hide any HTML tooltips that could bleed through
        const htmlTips = document.querySelectorAll('.bld-tip, .ship-tip, .tooltip, [id*="tooltip"], [id*="Tip"]');
        htmlTips.forEach(t => { t.style.display = 'none'; });

        if (typeof SND !== 'undefined') SND.setAmbient('orbit');

        // Set renderer background opaque (canvas is normally transparent)
        if (G.app && G.app.renderer && G.app.renderer.background) {
            G.app.renderer.background.alpha = 1;
            G.app.renderer.background.color = 0x020208;
        }

        if (typeof UI !== 'undefined') UI.addToast('🛰️ Entering Low Earth Orbit...');
        console.log('🌍 Orbit Mode: entering');
    },

    // ─── EXIT ORBIT ───
    exit() {
        if (!this.active) return;
        this._transitioning = true;
        this._exiting = true;
        this._transitionProgress = 1; // will animate back to 0

        if (typeof SND !== 'undefined') SND.setAmbient('outside');
        console.log('🌍 Orbit Mode: exiting');
    },

    _completeExit() {
        this.active = false;
        this._transitioning = false;
        this._exiting = false;
        this._transitionProgress = 0;

        if (this.layer) this.layer.visible = false;

        // Restore UI
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = '';

        // Restore renderer transparency
        if (G.app && G.app.renderer && G.app.renderer.background) {
            G.app.renderer.background.alpha = 0;
        }

        // Restore world
        if (G.world) { G.world.visible = true; G.world.alpha = 1; }

        // Hide exit button
        const exitBtn = document.getElementById('btnExitOrbit');
        if (exitBtn) exitBtn.style.display = 'none';

        // Hide tooltip
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

    // ─── BUILD PIXI SCENE ───
    _build() {
        if (!G.app) return;
        this.layer = new PIXI.Container();
        G.app.stage.addChild(this.layer);

        const W = G.vpW, H = G.vpH;

        // Opaque black background (canvas is transparent, must cover HTML beneath)
        this._bgGfx = new PIXI.Graphics();
        this._bgGfx.beginFill(0x020208);
        this._bgGfx.drawRect(-200, -200, W + 400, H + 400);
        this._bgGfx.endFill();
        this.layer.addChild(this._bgGfx);

        // Star field background
        this._starField = new PIXI.Container();
        for (let i = 0; i < 400; i++) {
            const s = new PIXI.Graphics();
            const sz = 0.3 + Math.random() * 1.8;
            const brightness = 0.3 + Math.random() * 0.7;
            s.beginFill(0xffffff, brightness);
            s.drawCircle(0, 0, sz);
            s.endFill();
            s.x = Math.random() * W * 1.5 - W * 0.25;
            s.y = Math.random() * H * 0.75;
            s._twinklePhase = Math.random() * Math.PI * 2;
            s._twinkleSpeed = 0.01 + Math.random() * 0.03;
            this._starField.addChild(s);
        }
        this.layer.addChild(this._starField);

        // Earth curvature (bottom of screen)
        this._earthGfx = new PIXI.Graphics();
        this._atmosGfx = new PIXI.Graphics();
        this._drawEarth();
        this.layer.addChild(this._atmosGfx);
        this.layer.addChild(this._earthGfx);

        // Satellite layer
        this._satLayer = new PIXI.Container();
        this.layer.addChild(this._satLayer);
        this._buildSatelliteSprites();

        // HUD overlay
        this._hudCont = new PIXI.Container();
        this._buildHUD();
        this.layer.addChild(this._hudCont);

        // Tooltip (hidden by default)
        this._tooltip = new PIXI.Container();
        this._tooltip.visible = false;
        this._tooltipBg = new PIXI.Graphics();
        this._tooltipText = new PIXI.Text('', { fontFamily: 'JetBrains Mono, monospace', fontSize: 10, fill: '#ffffff', wordWrap: true, wordWrapWidth: 200 });
        this._tooltip.addChild(this._tooltipBg, this._tooltipText);
        this.layer.addChild(this._tooltip);

        // Pointer interaction for satellite tapping
        this.layer.eventMode = 'static';
        this.layer.on('pointerdown', (e) => this._onTap(e));

        this._built = true;
    },

    _drawEarth() {
        const W = G.vpW, H = G.vpH;
        const earthY = H * 0.78;          // Earth starts at 78% down
        const curveRadius = W * 1.2;       // Wide curve for horizon effect
        const centerX = W / 2;

        // Atmosphere glow layers
        const atmos = this._atmosGfx;
        atmos.clear();
        // Outer atmosphere (faint blue glow)
        for (let i = 4; i >= 0; i--) {
            const offset = i * 8;
            const alpha = 0.04 + (4 - i) * 0.03;
            atmos.beginFill(0x4488ff, alpha);
            atmos.drawEllipse(centerX, earthY + curveRadius - offset, curveRadius + 40 - i * 5, curveRadius);
            atmos.endFill();
        }
        // Thin bright atmosphere line
        atmos.lineStyle(2, 0x66bbff, 0.6);
        atmos.drawEllipse(centerX, earthY + curveRadius, curveRadius + 10, curveRadius);

        // Earth body
        const earth = this._earthGfx;
        earth.clear();

        // Dark earth surface — deep ocean blue
        earth.beginFill(0x060d1a);
        earth.drawEllipse(centerX, earthY + curveRadius + 8, curveRadius + 5, curveRadius);
        earth.endFill();

        // Subtle latitude grid lines on the surface (abstract/clean)
        earth.lineStyle(1, 0x1a2a44, 0.2);
        for (let i = 1; i <= 4; i++) {
            const gridOffset = i * 12;
            const gridRadiusX = curveRadius - i * 30;
            if (gridRadiusX > 0) {
                earth.drawEllipse(centerX, earthY + curveRadius + 8 + gridOffset, gridRadiusX, curveRadius - gridOffset);
            }
        }
        // Longitude lines
        for (let i = -3; i <= 3; i++) {
            const lx = centerX + i * (curveRadius / 4);
            earth.lineStyle(1, 0x1a2a44, 0.12);
            earth.moveTo(lx, earthY + 10);
            earth.lineTo(lx + i * 3, earthY + 80);
        }
        earth.lineStyle(0);

        // City light clusters (warm dots scattered on the surface — no landmasses)
        const cityLightClusters = [
            // North America
            { cx: -0.30, cy: 0.01, count: 6, spread: 0.04 },
            // Europe
            { cx: 0.05, cy: 0.01, count: 8, spread: 0.04 },
            // East Asia
            { cx: 0.25, cy: 0.015, count: 7, spread: 0.05 },
            // South America
            { cx: -0.18, cy: 0.03, count: 3, spread: 0.03 },
            // India
            { cx: 0.15, cy: 0.025, count: 4, spread: 0.03 },
            // Middle East
            { cx: 0.10, cy: 0.018, count: 3, spread: 0.02 },
            // Australia
            { cx: 0.35, cy: 0.03, count: 2, spread: 0.02 },
            // Africa
            { cx: 0.02, cy: 0.025, count: 2, spread: 0.02 },
        ];
        cityLightClusters.forEach(cluster => {
            for (let i = 0; i < cluster.count; i++) {
                const ox = (Math.random() - 0.5) * cluster.spread * 2;
                const oy = Math.random() * cluster.spread * 0.5;
                const brightness = 0.3 + Math.random() * 0.5;
                const size = 0.5 + Math.random() * 1.2;
                earth.beginFill(0xffcc44, brightness);
                earth.drawCircle(
                    centerX + (cluster.cx + ox) * W,
                    earthY + (cluster.cy + oy) * H + 14,
                    size
                );
                earth.endFill();
                // Soft glow around larger lights
                if (size > 1) {
                    earth.beginFill(0xffcc44, brightness * 0.15);
                    earth.drawCircle(
                        centerX + (cluster.cx + ox) * W,
                        earthY + (cluster.cy + oy) * H + 14,
                        size * 3
                    );
                    earth.endFill();
                }
            }
        });
    },

    _buildSatelliteSprites() {
        this._satSprites = [];
        const W = G.vpW, H = G.vpH;
        const earthY = H * 0.78;

        const groupColors = {
            starlink: 0x44aaff,
            oneweb: 0xff8844,
            iss: 0xffff00,
            gps: 0x44ff88,
            galileo: 0xaa88ff,
            other: 0x888888
        };

        this.satellites.forEach((sat, i) => {
            const g = new PIXI.Graphics();
            const color = groupColors[sat.group] || 0x888888;
            const size = sat.group === 'iss' ? 3.5 : (sat.group === 'gps' || sat.group === 'galileo') ? 1.8 : 1.0;

            g.beginFill(color);
            g.drawCircle(0, 0, size);
            g.endFill();

            // Solar panel glint for ISS
            if (sat.group === 'iss') {
                g.beginFill(0xffffaa, 0.6);
                g.drawRect(-6, -1, 12, 2);
                g.endFill();
            }

            // Position satellites in orbital arcs
            // Map satellite orbital parameters to screen positions
            const orbitHeight = this._altitudeToScreenY(sat.altitude, earthY, H);
            const angle = (sat.phase / 180) * Math.PI;
            const orbitWidth = W * 0.8 + (sat.raan / 360) * W * 0.4;

            g.x = W / 2 + Math.cos(angle) * orbitWidth * 0.5;
            g.y = orbitHeight + Math.sin(angle * 0.3) * 30;

            // Store orbital animation params
            g._sat = sat;
            g._orbitSpeed = (sat.meanMotion / 15) * 0.0003;  // normalized orbital speed
            g._orbitPhase = angle;
            g._orbitRadius = orbitWidth * 0.5;
            g._orbitCenterY = orbitHeight;
            g._baseColor = color;
            g._size = size;

            this._satLayer.addChild(g);
            this._satSprites.push(g);
        });
    },

    _altitudeToScreenY(altKm, earthY, H) {
        // Map real altitude to screen position
        // LEO (200-2000km) → 55%-75% of screen height
        // MEO (2000-35786km) → 25%-55%
        // Normalize: 200km → near earth, 35000km → high up
        const minAlt = 200, maxAlt = 36000;
        const clamped = Math.max(minAlt, Math.min(maxAlt, altKm));
        const t = (clamped - minAlt) / (maxAlt - minAlt);
        // Logarithmic mapping for visual spread
        const logT = Math.log(1 + t * 9) / Math.log(10);
        return earthY - 40 - logT * (earthY - H * 0.08);
    },

    _buildHUD() {
        const W = G.vpW;
        // Title
        const title = new PIXI.Text('LOW EARTH ORBIT', {
            fontFamily: 'Press Start 2P, monospace',
            fontSize: 12,
            fill: '#66bbff',
            letterSpacing: 2
        });
        title.x = 16;
        title.y = 16;
        this._hudCont.addChild(title);

        // Satellite count
        this._satCountText = new PIXI.Text('', {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fill: '#88aacc'
        });
        this._satCountText.x = 16;
        this._satCountText.y = 36;
        this._hudCont.addChild(this._satCountText);

        // Legend
        const legendItems = [
            { color: 0x44aaff, label: 'Starlink' },
            { color: 0xff8844, label: 'OneWeb' },
            { color: 0xffff00, label: 'ISS' },
            { color: 0x44ff88, label: 'GPS' },
            { color: 0xaa88ff, label: 'Galileo' }
        ];
        const legendY = 58;
        legendItems.forEach((item, i) => {
            const dot = new PIXI.Graphics();
            dot.beginFill(item.color);
            dot.drawCircle(0, 0, 3);
            dot.endFill();
            dot.x = 22;
            dot.y = legendY + i * 16;

            const lbl = new PIXI.Text(item.label, {
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 9,
                fill: '#aabbcc'
            });
            lbl.x = 32;
            lbl.y = legendY + i * 16 - 5;

            this._hudCont.addChild(dot, lbl);
        });

        // Altitude scale (right side)
        const scaleX = W - 60;
        const altitudes = [
            { alt: 400, label: '400km LEO' },
            { alt: 550, label: '550km Starlink' },
            { alt: 1200, label: '1200km OneWeb' },
            { alt: 20200, label: '20,200km GPS' },
            { alt: 35786, label: '35,786km GEO' }
        ];
        const earthY = G.vpH * 0.78;
        altitudes.forEach(a => {
            const y = this._altitudeToScreenY(a.alt, earthY, G.vpH);
            const tick = new PIXI.Graphics();
            tick.lineStyle(1, 0x445566, 0.5);
            tick.moveTo(scaleX, y);
            tick.lineTo(scaleX + 20, y);

            const lbl = new PIXI.Text(a.label, {
                fontFamily: 'JetBrains Mono, monospace',
                fontSize: 7,
                fill: '#556677'
            });
            lbl.x = scaleX - lbl.width - 4;
            lbl.y = y - 4;

            this._hudCont.addChild(tick, lbl);
        });
    },

    // ─── TAP INTERACTION ───
    _onTap(e) {
        if (!this.active || this._transitioning) return;
        const pos = e.data ? e.data.global : e.global;
        if (!pos) return;

        // Check if we tapped near a satellite
        let closest = null, closestDist = 20; // 20px tap radius
        this._satSprites.forEach(sp => {
            if (sp.destroyed) return;
            const dx = sp.x - pos.x;
            const dy = sp.y - pos.y;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d < closestDist) {
                closestDist = d;
                closest = sp;
            }
        });

        if (closest && closest._sat) {
            this._showTooltip(closest);
        } else {
            if (this._tooltip) this._tooltip.visible = false;
        }
    },

    _showTooltip(sprite) {
        const sat = sprite._sat;
        const tt = this._tooltip;
        const bg = this._tooltipBg;
        const txt = this._tooltipText;

        const altStr = sat.altitude < 1000 ? `${Math.round(sat.altitude)}km` : `${(sat.altitude / 1000).toFixed(1)}K km`;
        const speedKmS = (2 * Math.PI * (6371 + sat.altitude)) / (86400 / sat.meanMotion) ;
        const speedStr = `${(speedKmS).toFixed(1)} km/s`;

        txt.text = `${sat.name}\n` +
                   `Group: ${sat.group.toUpperCase()}\n` +
                   `Altitude: ${altStr}\n` +
                   `Inclination: ${sat.inclination.toFixed(1)}°\n` +
                   `Speed: ${speedStr}\n` +
                   `NORAD: ${sat.noradId}`;

        bg.clear();
        bg.beginFill(0x0a1628, 0.92);
        bg.lineStyle(1, 0x44aaff, 0.6);
        bg.drawRoundedRect(-8, -8, txt.width + 16, txt.height + 16, 4);
        bg.endFill();

        tt.x = Math.min(sprite.x + 12, G.vpW - txt.width - 30);
        tt.y = Math.max(sprite.y - 20, 10);
        tt.visible = true;
    },

    // ─── EXIT BUTTON ───
    _showExitBtn() {
        let btn = document.getElementById('btnExitOrbit');
        if (!btn) {
            btn = document.createElement('button');
            btn.id = 'btnExitOrbit';
            btn.innerHTML = '🌍 RETURN TO CITY';
            btn.style.cssText = 'position:absolute; top:0px; right:20px; z-index:9999; background:linear-gradient(135deg, #1a3a5c, #0d2240); color:#66bbff; border:none; border-bottom: 3px solid #44aaff; padding:12px 20px; border-radius:0 0 6px 6px; cursor:pointer; font-size:12px; font-weight:bold; font-family:"Press Start 2P", monospace; box-shadow: 0 4px 12px rgba(68,170,255,0.3); transition: background 0.2s;';
            btn.onmouseover = () => { btn.style.background = 'linear-gradient(135deg, #234b6e, #153050)'; };
            btn.onmouseout = () => { btn.style.background = 'linear-gradient(135deg, #1a3a5c, #0d2240)'; };
            btn.onclick = () => { if (typeof SND !== 'undefined') SND.uiClick(); this.exit(); };
            document.body.appendChild(btn);
        }
        btn.style.display = 'block';
    },

    // ─── FRAME UPDATE (called from engine loop) ───
    update() {
        if (!this.active && !this._transitioning) return;
        this._orbitTick++;

        // ─── TRANSITION ANIMATION ───
        if (this._transitioning) {
            if (!this._exiting) {
                // Entering: fade in orbit, fade out city
                this._transitionProgress = Math.min(1, this._transitionProgress + 0.025);
                this.layer.alpha = this._transitionProgress;
                if (G.world) {
                    G.world.alpha = 1 - this._transitionProgress;
                    const z = 1 - this._transitionProgress * 0.5;
                    Camera.targetZoom = z;
                }
                if (this._transitionProgress >= 1) {
                    this._transitioning = false;
                    if (G.world) G.world.visible = false;
                }
            } else {
                // Exiting: fade out orbit, fade in city
                this._transitionProgress = Math.max(0, this._transitionProgress - 0.03);
                this.layer.alpha = this._transitionProgress;
                if (G.world) {
                    G.world.visible = true;
                    G.world.alpha = 1 - this._transitionProgress;
                }
                if (this._transitionProgress <= 0) {
                    this._completeExit();
                    if (G.world) G.world.alpha = 1;
                    return;
                }
            }
        }

        if (!this.active) return;

        // ─── ANIMATE SATELLITES ───
        const W = G.vpW, H = G.vpH;
        const earthY = H * 0.78;

        this._satSprites.forEach(sp => {
            if (sp.destroyed) return;
            sp._orbitPhase += sp._orbitSpeed;

            // Orbital motion: primarily horizontal sweep with slight vertical oscillation
            const phase = sp._orbitPhase;
            sp.x = W / 2 + Math.cos(phase) * sp._orbitRadius;
            sp.y = sp._orbitCenterY + Math.sin(phase * 0.4) * 20;

            // Wrap horizontally
            if (sp.x < -20) sp.x += W + 40;
            if (sp.x > W + 20) sp.x -= W + 40;

            // Hide satellites that go below earth
            sp.visible = sp.y < earthY - 5;

            // Solar panel glint effect for ISS
            if (sp._sat.group === 'iss') {
                sp.alpha = 0.8 + Math.sin(this._orbitTick * 0.05) * 0.2;
            }

            // Twinkle for small satellites
            if (sp._size <= 1.0) {
                sp.alpha = 0.4 + Math.sin(this._orbitTick * 0.02 + sp._orbitPhase * 100) * 0.3;
            }
        });

        // ─── TWINKLE STARS ───
        if (this._starField && this._orbitTick % 2 === 0) {
            this._starField.children.forEach(s => {
                if (s.destroyed) return;
                s.alpha = 0.2 + Math.sin(this._orbitTick * s._twinkleSpeed + s._twinklePhase) * 0.3;
            });
        }

        // ─── UPDATE HUD ───
        if (this._satCountText && this._orbitTick % 30 === 0) {
            const groups = this._satGroups;
            this._satCountText.text =
                `Tracking ${this.satellites.length} satellites  |  ` +
                `Starlink: ${groups.starlink ? groups.starlink.length : 0}  ` +
                `OneWeb: ${groups.oneweb ? groups.oneweb.length : 0}  ` +
                `GPS: ${(groups.gps ? groups.gps.length : 0) + (groups.galileo ? groups.galileo.length : 0)}`;
        }
    },

    // ─── RESIZE HANDLER ───
    resize() {
        if (!this._built) return;
        // Resize opaque background
        if (this._bgGfx) {
            this._bgGfx.clear();
            this._bgGfx.beginFill(0x020208);
            this._bgGfx.drawRect(-200, -200, G.vpW + 400, G.vpH + 400);
            this._bgGfx.endFill();
        }
        // Rebuild earth and reposition on viewport change
        this._drawEarth();
        // Reposition satellites
        this._satLayer.removeChildren();
        this._satSprites = [];
        this._buildSatelliteSprites();
        // Rebuild HUD
        this._hudCont.removeChildren();
        this._buildHUD();
    }
};
