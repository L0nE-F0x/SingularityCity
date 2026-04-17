/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   ORBIT MODE (v3.0.0 — Three.js 3D Earth + Real Inclined Satellite Orbits)
   Activated via minimap 🛰️ Orbit button. Full 3D WebGL scene: stylized holographic Earth,
   fresnel atmosphere glow, day/night terminator from real sun direction, 3D-inclined orbits,
   glowing satellite sprites, rotatable via OrbitControls. Satellite data comes from CelesTrak
   (Starlink, OneWeb), supplemented with hardcoded ISS/GPS/Galileo. DOM-based HUD + tooltip.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const OrbitMode = {
    active: false,
    _built: false,
    _transitioning: false,
    _exiting: false,
    _transitionProgress: 0,

    satellites: [],
    _satGroups: {},

    // ─── Three.js ───
    scene: null, camera: null, renderer: null, controls: null,
    raycaster: null, pointer: null,
    canvas: null, hudEl: null, tooltipEl: null,
    earthGroup: null, earthMesh: null, atmosphereMesh: null,
    gridGroup: null, starField: null, orbitLinesGroup: null,
    satGroup: null, satSprites: [],
    youMarker: null, sunDir: null,
    _satTextures: {},
    _hoverSprite: null, _selectedSprite: null,
    _tick: 0,

    // Saved PixiJS camera state (engine keeps ticking underneath)
    _savedCamX: 0, _savedCamY: 0, _savedCamZoom: 1,

    // Scene scale (Earth radius in scene units; real km → scene via /6371 * this)
    EARTH_R: 100,

    CACHE_KEY: 'sc_orbit_sats',
    CACHE_TTL: 60 * 60 * 1000,

    // ═══════════════════════════════════════════════
    //   SATELLITE DATA (preserved from v2)
    // ═══════════════════════════════════════════════

    async fetchSatellites() {
        try {
            const cached = JSON.parse(localStorage.getItem(this.CACHE_KEY));
            if (cached && Date.now() - cached.ts < this.CACHE_TTL) {
                this.satellites = cached.data;
                this._groupSatellites();
                return;
            }
        } catch (_) {}

        try {
            const isProd = typeof location !== 'undefined'
                && location.hostname
                && location.hostname !== 'localhost'
                && location.hostname !== '127.0.0.1';
            const base = isProd
                ? '/api/celestrak/NORAD/elements/gp.php'
                : 'https://celestrak.org/NORAD/elements/gp.php';
            const urls = [
                `${base}?GROUP=starlink&FORMAT=json`,
                `${base}?GROUP=oneweb&FORMAT=json`
            ];
            const results = await Promise.allSettled(
                urls.map(async u => {
                    try {
                        const r = await fetch(u, { signal: AbortSignal.timeout(25000) });
                        if (!r.ok) {
                            console.warn(`[Orbit] ${u} → HTTP ${r.status}`);
                            return [];
                        }
                        return await r.json();
                    } catch (err) {
                        console.warn(`[Orbit] ${u} failed:`, err.message);
                        return [];
                    }
                })
            );

            let sats = [];
            const starlinkRaw = results[0].status === 'fulfilled' ? results[0].value : [];
            const onewebRaw = results[1].status === 'fulfilled' ? results[1].value : [];

            const userLon = this._getUserLongitude();
            const filterByRegion = (arr) => {
                return arr.filter(s => {
                    const raan = s.RA_OF_ASC_NODE || 0;
                    const diff = Math.abs(((raan - userLon + 540) % 360) - 180);
                    return diff < 90;
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

            sats.push({
                name: 'ISS (ZARYA)', group: 'iss', noradId: 25544,
                inclination: 51.6, eccentricity: 0.0001, meanMotion: 15.5,
                altitude: 420, phase: Math.random() * 360, raan: Math.random() * 360
            });

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

        } catch (e) {
            console.warn('[Orbit] Satellite fetch failed:', e.message);
            this._generateFallbackSatellites();
        }
    },

    _getUserLongitude() {
        const offsetMin = new Date().getTimezoneOffset();
        return -offsetMin / 4;
    },

    _parseSat(raw, group) {
        // Kepler's 3rd: a_km = 42241.08 / mean_motion^(2/3) for Earth orbits.
        const mm = raw.MEAN_MOTION;
        const altitude = mm ? (42241.08 / Math.pow(mm, 2/3)) - 6371 : 550;
        return {
            name: raw.OBJECT_NAME || 'Unknown', group, noradId: raw.NORAD_CAT_ID || 0,
            inclination: raw.INCLINATION || 53, eccentricity: raw.ECCENTRICITY || 0.0001,
            meanMotion: mm || 15.0,
            altitude,
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

    registerPull() {},

    // ═══════════════════════════════════════════════
    //   ENTER / EXIT
    // ═══════════════════════════════════════════════

    async enter() {
        if (this.active || this._transitioning) return;
        if (typeof THREE === 'undefined') {
            console.warn('[Orbit] Three.js not loaded');
            return;
        }
        this._transitioning = true;
        this._exiting = false;
        this._transitionProgress = 0;

        if (typeof Camera !== 'undefined') {
            this._savedCamX = Camera.targetX;
            this._savedCamY = Camera.targetY;
            this._savedCamZoom = Camera.targetZoom;
        }

        if (typeof G !== 'undefined' && G.tracking) G.stopTracking();
        if (this.satellites.length === 0) await this.fetchSatellites();
        if (!this._built) this._build();
        else this._rebuildSatellites();

        this.active = true;
        if (this.canvas) {
            this.canvas.style.display = 'block';
            this.canvas.style.opacity = '0';
        }
        if (this.hudEl) this.hudEl.style.display = 'block';

        this._showExitBtn();
        this._hideGameUI();

        if (typeof SND !== 'undefined') SND.setAmbient('orbit');
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
        this._hoverSprite = null;
        this._selectedSprite = null;

        if (this.canvas) this.canvas.style.display = 'none';
        if (this.hudEl) this.hudEl.style.display = 'none';
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';

        this._restoreGameUI();

        const exitBtn = document.getElementById('btnExitOrbit');
        if (exitBtn) exitBtn.style.display = 'none';

        if (typeof Camera !== 'undefined') {
            Camera.targetX = this._savedCamX || 0;
            Camera.targetY = this._savedCamY || 0;
            Camera.targetZoom = this._savedCamZoom || 1;
            Camera.x = Camera.targetX;
            Camera.y = Camera.targetY;
            Camera.zoom = Camera.targetZoom;
        }
    },

    _hideGameUI() {
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = 'none';
        const infoPanel = document.getElementById('infoPanel');
        if (infoPanel) infoPanel.classList.remove('open');
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = 'none';
        document.querySelectorAll('.bld-tip, .ship-tip, .tooltip, [id*="tooltip"], [id*="Tip"]')
            .forEach(t => { if (t.id !== 'orbitTooltip') t.style.display = 'none'; });
    },

    _restoreGameUI() {
        const topUI = document.querySelector('.top');
        if (topUI) topUI.style.display = '';
        const mm = document.getElementById('minimap');
        if (mm) mm.style.display = '';
    },

    // ═══════════════════════════════════════════════
    //   BUILD THREE.JS SCENE
    // ═══════════════════════════════════════════════

    _build() {
        this.canvas = document.getElementById('orbitCv');
        this.hudEl = document.getElementById('orbit-hud');
        this.tooltipEl = document.getElementById('orbitTooltip');
        if (!this.canvas) {
            console.warn('[Orbit] #orbitCv canvas not found');
            return;
        }

        const W = window.innerWidth, H = window.innerHeight;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x020208);

        this.camera = new THREE.PerspectiveCamera(45, W / H, 1, 10000);
        this.camera.position.set(0, 80, 320);

        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(W, H);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

        this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.dampingFactor = 0.07;
        this.controls.rotateSpeed = 0.5;
        this.controls.minDistance = this.EARTH_R * 1.3;
        this.controls.maxDistance = this.EARTH_R * 9;
        this.controls.target.set(0, 0, 0);

        // Subtle ambient fill — most lighting happens in the earth shader
        this.scene.add(new THREE.AmbientLight(0x334455, 0.6));

        this.raycaster = new THREE.Raycaster();
        // Sprite raycasting default threshold is 0; we need to enable it
        this.pointer = new THREE.Vector2();

        this._buildStars();
        this._buildEarthGroup();
        this._buildOrbitLines();
        this._buildSatellites();
        this._buildHUD();

        this.canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        this.canvas.addEventListener('click', (e) => this._onClick(e));

        window.addEventListener('resize', () => this.resize());

        this._built = true;
    },

    _buildStars() {
        const geo = new THREE.BufferGeometry();
        const positions = [];
        const colors = [];
        for (let i = 0; i < 5000; i++) {
            const r = 3000 + Math.random() * 1500;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(2 * Math.random() - 1);
            positions.push(
                r * Math.sin(phi) * Math.cos(theta),
                r * Math.cos(phi),
                r * Math.sin(phi) * Math.sin(theta)
            );
            // Slight color variation — warm/cool mix
            const warm = Math.random() < 0.3;
            if (warm) { colors.push(1.0, 0.85, 0.7); }
            else { colors.push(0.75, 0.85, 1.0); }
        }
        geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        const mat = new THREE.PointsMaterial({
            size: 2,
            sizeAttenuation: false,
            vertexColors: true,
            transparent: true,
            opacity: 0.85
        });
        this.starField = new THREE.Points(geo, mat);
        this.scene.add(this.starField);
    },

    _buildEarthGroup() {
        this.earthGroup = new THREE.Group();
        this.scene.add(this.earthGroup);

        this._buildEarthSphere();
        this._buildAtmosphere();
        this._buildGrid();
        this._buildYouMarker();
    },

    _buildEarthSphere() {
        const dayTex = this._makeDayTexture();
        const nightTex = this._makeNightTexture();

        const mat = new THREE.ShaderMaterial({
            uniforms: {
                dayMap: { value: dayTex },
                nightMap: { value: nightTex },
                sunDir: { value: new THREE.Vector3(1, 0.2, 0.3).normalize() }
            },
            vertexShader: `
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    vUv = uv;
                    vNormalW = normalize(mat3(modelMatrix) * normal);
                    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
                }
            `,
            fragmentShader: `
                uniform sampler2D dayMap;
                uniform sampler2D nightMap;
                uniform vec3 sunDir;
                varying vec3 vNormalW;
                varying vec2 vUv;
                void main() {
                    float d = dot(vNormalW, sunDir);
                    float mixFactor = smoothstep(-0.15, 0.30, d);
                    vec3 day = texture2D(dayMap, vUv).rgb;
                    vec3 night = texture2D(nightMap, vUv).rgb;
                    vec3 color = mix(night, day, mixFactor);
                    // Subtle rim brighten on sunlit edge
                    float rim = smoothstep(0.0, 0.4, d) * (1.0 - abs(d));
                    color += vec3(0.08, 0.15, 0.25) * rim;
                    gl_FragColor = vec4(color, 1.0);
                }
            `
        });

        const geo = new THREE.SphereGeometry(this.EARTH_R, 96, 64);
        this.earthMesh = new THREE.Mesh(geo, mat);
        this.earthGroup.add(this.earthMesh);
    },

    _buildAtmosphere() {
        const mat = new THREE.ShaderMaterial({
            uniforms: {},
            vertexShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    vNormal = normalize(normalMatrix * normal);
                    vec4 mv = modelViewMatrix * vec4(position, 1.0);
                    vPosition = mv.xyz;
                    gl_Position = projectionMatrix * mv;
                }
            `,
            fragmentShader: `
                varying vec3 vNormal;
                varying vec3 vPosition;
                void main() {
                    float intensity = pow(0.72 - dot(vNormal, normalize(-vPosition)), 4.0);
                    vec3 color = vec3(0.26, 0.55, 1.0);
                    gl_FragColor = vec4(color, 1.0) * intensity;
                }
            `,
            blending: THREE.AdditiveBlending,
            side: THREE.BackSide,
            transparent: true,
            depthWrite: false
        });
        const geo = new THREE.SphereGeometry(this.EARTH_R * 1.18, 64, 32);
        this.atmosphereMesh = new THREE.Mesh(geo, mat);
        this.earthGroup.add(this.atmosphereMesh);
    },

    _buildGrid() {
        this.gridGroup = new THREE.Group();
        const r = this.EARTH_R * 1.002;
        const mat = new THREE.LineBasicMaterial({
            color: 0x44aaff, transparent: true, opacity: 0.12
        });
        // Latitudes
        for (let lat = -75; lat <= 75; lat += 15) {
            const pts = [];
            const phi = (lat / 180) * Math.PI;
            const rr = r * Math.cos(phi);
            const y = r * Math.sin(phi);
            for (let lon = 0; lon <= 360; lon += 3) {
                const theta = (lon / 180) * Math.PI;
                pts.push(new THREE.Vector3(rr * Math.cos(theta), y, rr * Math.sin(theta)));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            this.gridGroup.add(new THREE.Line(geo, mat));
        }
        // Longitudes
        for (let lon = 0; lon < 360; lon += 15) {
            const pts = [];
            const theta = (lon / 180) * Math.PI;
            for (let lat = -90; lat <= 90; lat += 3) {
                const phi = (lat / 180) * Math.PI;
                pts.push(new THREE.Vector3(
                    r * Math.cos(phi) * Math.cos(theta),
                    r * Math.sin(phi),
                    r * Math.cos(phi) * Math.sin(theta)
                ));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            this.gridGroup.add(new THREE.Line(geo, mat));
        }
        this.earthGroup.add(this.gridGroup);
    },

    _buildYouMarker() {
        const userLon = this._getUserLongitude();
        const lat = 0;
        const pos = this._latLonToVec3(lat, userLon, this.EARTH_R * 1.015);

        // Glowing dot
        const mat = new THREE.SpriteMaterial({
            map: this._getSatTexture(0x4ade80),
            color: 0x4ade80,
            transparent: true,
            depthWrite: false,
            blending: THREE.AdditiveBlending
        });
        const sprite = new THREE.Sprite(mat);
        sprite.scale.set(8, 8, 1);
        sprite.position.copy(pos);

        // Pulsing outer ring (updated in animate)
        sprite.userData.isYou = true;
        this.earthGroup.add(sprite);
        this.youMarker = sprite;
    },

    // Earth surface day texture — stylized continents on deep blue ocean
    _makeDayTexture() {
        const w = 1024, h = 512;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Ocean gradient (deep to shallower)
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0.0, '#0a1630');
        g.addColorStop(0.5, '#0d2350');
        g.addColorStop(1.0, '#06122a');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Subtle ocean "noise" to avoid perfectly flat look
        for (let i = 0; i < 1400; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const a = 0.04 + Math.random() * 0.08;
            ctx.fillStyle = `rgba(100,180,255,${a})`;
            ctx.fillRect(x, y, 1 + Math.random() * 2, 1);
        }

        // Continents — coarse hand-placed blobs in equirectangular space
        // UV convention: U=0 at lon=-180, U=1 at lon=+180; V=0 at lat=+90, V=1 at lat=-90
        const continents = [
            { cx: 0.23, cy: 0.30, rx: 0.11, ry: 0.17 }, // North America
            { cx: 0.27, cy: 0.48, rx: 0.03, ry: 0.05 }, // Central America
            { cx: 0.32, cy: 0.66, rx: 0.05, ry: 0.14 }, // South America
            { cx: 0.50, cy: 0.28, rx: 0.06, ry: 0.07 }, // Europe
            { cx: 0.55, cy: 0.52, rx: 0.07, ry: 0.16 }, // Africa
            { cx: 0.58, cy: 0.38, rx: 0.04, ry: 0.04 }, // Middle East
            { cx: 0.72, cy: 0.28, rx: 0.15, ry: 0.11 }, // Asia (continental mass)
            { cx: 0.70, cy: 0.44, rx: 0.03, ry: 0.06 }, // India
            { cx: 0.80, cy: 0.50, rx: 0.05, ry: 0.05 }, // SE Asia
            { cx: 0.86, cy: 0.66, rx: 0.06, ry: 0.05 }, // Australia
            { cx: 0.43, cy: 0.14, rx: 0.05, ry: 0.06 }, // Greenland
            { cx: 0.50, cy: 0.96, rx: 0.50, ry: 0.05 }  // Antarctica
        ];

        continents.forEach((cn, idx) => {
            const cx = cn.cx * w;
            const cy = cn.cy * h;
            const rx = cn.rx * w;
            const ry = cn.ry * h;
            ctx.fillStyle = '#1e3f22';
            ctx.beginPath();
            const steps = 72;
            for (let i = 0; i <= steps; i++) {
                const a = (i / steps) * Math.PI * 2;
                // Layered jitter so each continent has unique jagged coastline
                const seed = idx * 3.7;
                const j = 0.72
                    + 0.25 * Math.abs(Math.sin(a * 3.1 + seed))
                    + 0.18 * Math.abs(Math.sin(a * 7.3 + seed * 2.1))
                    + 0.10 * Math.abs(Math.cos(a * 11.7 + seed * 0.7));
                const x = cx + Math.cos(a) * rx * j;
                const y = cy + Math.sin(a) * ry * j;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            }
            ctx.closePath();
            ctx.fill();
        });

        // Land texture — darker splotches + lighter terrain variation
        ctx.globalCompositeOperation = 'source-atop';
        for (let i = 0; i < 400; i++) {
            const x = Math.random() * w;
            const y = Math.random() * h;
            const r = 6 + Math.random() * 30;
            const dark = Math.random() < 0.6;
            ctx.fillStyle = dark
                ? `rgba(0,0,0,${0.08 + Math.random() * 0.12})`
                : `rgba(90,130,70,${0.10 + Math.random() * 0.15})`;
            ctx.beginPath();
            ctx.arc(x, y, r, 0, Math.PI * 2);
            ctx.fill();
        }
        // Desert/arid bands — Sahara, Arabian, Gobi, Australian interior
        const arid = [
            { cx: 0.55, cy: 0.45, rx: 0.06, ry: 0.03 },
            { cx: 0.60, cy: 0.40, rx: 0.03, ry: 0.02 },
            { cx: 0.72, cy: 0.33, rx: 0.05, ry: 0.02 },
            { cx: 0.86, cy: 0.66, rx: 0.03, ry: 0.02 }
        ];
        arid.forEach(a => {
            ctx.fillStyle = 'rgba(180,140,80,0.35)';
            ctx.beginPath();
            ctx.ellipse(a.cx * w, a.cy * h, a.rx * w, a.ry * h, 0, 0, Math.PI * 2);
            ctx.fill();
        });
        // Polar ice — brighten Antarctica + Greenland
        ctx.fillStyle = 'rgba(220,235,255,0.55)';
        ctx.fillRect(0, h * 0.93, w, h * 0.07);
        ctx.beginPath();
        ctx.ellipse(0.43 * w, 0.14 * h, 0.05 * w, 0.06 * h, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        return tex;
    },

    // Night texture — dark background with city-light clusters on land
    _makeNightTexture() {
        const w = 1024, h = 512;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        const ctx = c.getContext('2d');

        // Nearly black base with deep-blue ocean tint
        ctx.fillStyle = '#02040c';
        ctx.fillRect(0, 0, w, h);

        // City-light clusters placed at approximate major metro areas
        // [cx, cy, radius, density, intensity]
        const cities = [
            // North America — East Coast megalopolis, Chicago, West Coast
            [0.26, 0.33, 0.04, 60, 0.9],   // US NE corridor
            [0.24, 0.32, 0.03, 40, 0.8],   // Midwest
            [0.18, 0.35, 0.02, 30, 0.8],   // CA
            [0.22, 0.38, 0.02, 25, 0.7],   // Texas
            [0.27, 0.47, 0.015, 20, 0.7],  // Mexico City
            // South America
            [0.32, 0.62, 0.02, 25, 0.8],   // São Paulo / Rio
            [0.31, 0.70, 0.015, 15, 0.6],  // Buenos Aires
            // Europe (very dense)
            [0.50, 0.26, 0.03, 70, 0.95],  // Western Europe
            [0.52, 0.23, 0.025, 45, 0.85], // UK/Germany
            [0.55, 0.29, 0.02, 30, 0.8],   // Italy/Greece
            // Middle East
            [0.59, 0.36, 0.025, 25, 0.75], // Turkey
            [0.60, 0.40, 0.02, 20, 0.75],  // Gulf
            [0.62, 0.43, 0.015, 15, 0.7],  // Iran
            // Africa (sparse, brighter on coast/Nile)
            [0.56, 0.44, 0.015, 12, 0.7],  // Nile/Egypt
            [0.55, 0.60, 0.015, 10, 0.6],  // South Africa
            [0.54, 0.52, 0.01, 8, 0.5],    // West Africa
            // India (dense)
            [0.69, 0.43, 0.03, 55, 0.85],  // India
            // Asia (very dense)
            [0.78, 0.34, 0.035, 80, 0.95], // China/Korea/Japan
            [0.82, 0.35, 0.02, 40, 0.9],   // Japan
            [0.75, 0.40, 0.02, 25, 0.8],   // Southern China
            [0.80, 0.49, 0.02, 30, 0.75],  // SE Asia / Singapore
            [0.82, 0.53, 0.015, 15, 0.7],  // Indonesia/Philippines
            // Australia
            [0.87, 0.66, 0.015, 12, 0.7],  // SE Australia
            [0.82, 0.64, 0.01, 6, 0.6]     // Perth
        ];

        cities.forEach(([cx, cy, radius, count, intensity]) => {
            const px = cx * w;
            const py = cy * h;
            const pr = radius * w;
            for (let i = 0; i < count; i++) {
                // Gaussian-ish distribution around the center
                let dx, dy, d;
                do {
                    dx = (Math.random() - 0.5) * pr * 2;
                    dy = (Math.random() - 0.5) * pr * 2 * (h / w);
                    d = Math.sqrt(dx * dx + dy * dy);
                } while (d > pr);
                const x = px + dx;
                const y = py + dy;
                const a = intensity * (0.5 + Math.random() * 0.5) * (1 - d / pr);
                // Warm yellow-orange city light
                ctx.fillStyle = `rgba(255,${180 + Math.random() * 50},${100 + Math.random() * 80},${a})`;
                ctx.fillRect(Math.floor(x), Math.floor(y), 1, 1);
                // Occasionally a brighter pixel
                if (Math.random() < 0.12) {
                    ctx.fillStyle = `rgba(255,230,150,${a * 0.8})`;
                    ctx.fillRect(Math.floor(x), Math.floor(y), 2, 1);
                }
            }
        });

        // Soft glow pass over dense cities
        ctx.globalCompositeOperation = 'lighter';
        cities.forEach(([cx, cy, radius, count, intensity]) => {
            if (count < 40) return;
            const px = cx * w;
            const py = cy * h;
            const pr = radius * w * 1.4;
            const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
            g.addColorStop(0, `rgba(255,180,100,${0.12 * intensity})`);
            g.addColorStop(1, 'rgba(255,180,100,0)');
            ctx.fillStyle = g;
            ctx.fillRect(px - pr, py - pr, pr * 2, pr * 2);
        });
        ctx.globalCompositeOperation = 'source-over';

        const tex = new THREE.CanvasTexture(c);
        tex.anisotropy = 4;
        return tex;
    },

    // ═══════════════════════════════════════════════
    //   SATELLITES + ORBIT LINES
    // ═══════════════════════════════════════════════

    _buildOrbitLines() {
        this.orbitLinesGroup = new THREE.Group();

        const groupOpacity = {
            starlink: 0.04, oneweb: 0.05, iss: 0.45, gps: 0.25, galileo: 0.25, other: 0.1
        };
        const groupColors = {
            starlink: 0x44aaff, oneweb: 0xff8844, iss: 0xffff00,
            gps: 0x44ff88, galileo: 0xaa88ff, other: 0x888888
        };

        this.satellites.forEach(sat => {
            const pts = [];
            const radius = this._satRadius(sat);
            const steps = sat.group === 'starlink' || sat.group === 'oneweb' ? 48 : 96;
            for (let i = 0; i <= steps; i++) {
                const u = (i / steps) * Math.PI * 2;
                pts.push(this._orbitPosition(sat, u, radius));
            }
            const geo = new THREE.BufferGeometry().setFromPoints(pts);
            const mat = new THREE.LineBasicMaterial({
                color: groupColors[sat.group] || 0x888888,
                transparent: true,
                opacity: groupOpacity[sat.group] || 0.1,
                depthWrite: false
            });
            this.orbitLinesGroup.add(new THREE.Line(geo, mat));
        });

        this.scene.add(this.orbitLinesGroup);
    },

    _buildSatellites() {
        this.satGroup = new THREE.Group();
        this.satSprites = [];

        const groupColors = {
            starlink: 0x44aaff, oneweb: 0xff8844, iss: 0xffff00,
            gps: 0x44ff88, galileo: 0xaa88ff, other: 0xffffff
        };
        const groupSize = {
            starlink: 3.0, oneweb: 3.2, iss: 6.0, gps: 5.0, galileo: 5.0, other: 3.0
        };

        this.satellites.forEach(sat => {
            const color = groupColors[sat.group] || 0xffffff;
            const size = groupSize[sat.group] || 3.0;
            const mat = new THREE.SpriteMaterial({
                map: this._getSatTexture(color),
                color: color,
                transparent: true,
                depthWrite: false,
                blending: THREE.AdditiveBlending
            });
            const sprite = new THREE.Sprite(mat);
            sprite.scale.set(size, size, 1);
            sprite.userData.sat = sat;
            sprite.userData.orbitAngle = (sat.phase / 180) * Math.PI;
            // Real mean motion → angular speed per frame (rev/day / 86400s * dt*60 frames).
            // Speed up 200× so orbits are visually observable within seconds rather than hours.
            sprite.userData.orbitSpeed = (sat.meanMotion / 86400) * (Math.PI * 2) * 200 / 60;
            sprite.userData.baseSize = size;
            sprite.userData.baseColor = color;
            sprite.userData.radius = this._satRadius(sat);

            // Initial position
            const pos = this._orbitPosition(sat, sprite.userData.orbitAngle, sprite.userData.radius);
            sprite.position.copy(pos);

            this.satGroup.add(sprite);
            this.satSprites.push(sprite);
        });

        this.scene.add(this.satGroup);
    },

    _rebuildSatellites() {
        // Called when re-entering after data refresh
        if (this.satGroup) { this.scene.remove(this.satGroup); this.satGroup = null; }
        if (this.orbitLinesGroup) { this.scene.remove(this.orbitLinesGroup); this.orbitLinesGroup = null; }
        this.satSprites = [];
        this._buildOrbitLines();
        this._buildSatellites();
    },

    // Radial-gradient glow texture cached per color
    _getSatTexture(color) {
        const key = color.toString(16);
        if (this._satTextures[key]) return this._satTextures[key];
        const c = document.createElement('canvas');
        c.width = 128; c.height = 128;
        const ctx = c.getContext('2d');
        const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
        const r = (color >> 16) & 0xff;
        const gg = (color >> 8) & 0xff;
        const b = color & 0xff;
        g.addColorStop(0.0, `rgba(255,255,255,1.0)`);
        g.addColorStop(0.15, `rgba(${r},${gg},${b},0.95)`);
        g.addColorStop(0.45, `rgba(${r},${gg},${b},0.35)`);
        g.addColorStop(1.0, `rgba(${r},${gg},${b},0.0)`);
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, 128, 128);
        const tex = new THREE.CanvasTexture(c);
        this._satTextures[key] = tex;
        return tex;
    },

    _satRadius(sat) {
        // km → scene units. Earth radius = 6371km maps to EARTH_R scene units.
        return this.EARTH_R * (1 + sat.altitude / 6371);
    },

    // Position of a satellite in 3D given orbital elements + phase angle u.
    // Equatorial plane is XZ (Y-up). Orbital plane = equatorial, rotated by inclination
    // about the line of nodes, which is itself rotated by RAAN about Y.
    _orbitPosition(sat, u, radius) {
        const p = new THREE.Vector3(Math.cos(u) * radius, 0, Math.sin(u) * radius);
        p.applyAxisAngle(new THREE.Vector3(1, 0, 0), THREE.MathUtils.degToRad(sat.inclination));
        p.applyAxisAngle(new THREE.Vector3(0, 1, 0), THREE.MathUtils.degToRad(sat.raan));
        return p;
    },

    _latLonToVec3(lat, lon, radius) {
        const phi = (lat / 180) * Math.PI;
        const theta = (lon / 180) * Math.PI;
        return new THREE.Vector3(
            radius * Math.cos(phi) * Math.cos(theta),
            radius * Math.sin(phi),
            radius * Math.cos(phi) * Math.sin(theta)
        );
    },

    // ═══════════════════════════════════════════════
    //   HUD (DOM)
    // ═══════════════════════════════════════════════

    _buildHUD() {
        if (!this.hudEl) return;
        const userLon = this._getUserLongitude();
        const tzOffset = new Date().getTimezoneOffset();
        const tzHours = -tzOffset / 60;
        const tzStr = `UTC${tzHours >= 0 ? '+' : ''}${tzHours}`;
        const g = this._satGroups;
        const gpsCount = (g.gps ? g.gps.length : 0) + (g.galileo ? g.galileo.length : 0);

        this.hudEl.innerHTML = `
            <div class="orbit-hud-title">ORBIT VIEW</div>
            <div class="orbit-hud-stats">
                Tracking <b>${this.satellites.length}</b> satellites<br>
                Starlink: ${g.starlink ? g.starlink.length : 0} · OneWeb: ${g.oneweb ? g.oneweb.length : 0} · GPS+Galileo: ${gpsCount} · ISS: ${g.iss ? g.iss.length : 0}
            </div>
            <div class="orbit-hud-loc">📍 Observer at ${tzStr} · lon ≈ ${userLon.toFixed(0)}°</div>
            <div class="orbit-hud-legend">
                <div><span class="orbit-dot" style="background:#44aaff"></span>Starlink — LEO ~550 km</div>
                <div><span class="orbit-dot" style="background:#ff8844"></span>OneWeb — ~1,200 km</div>
                <div><span class="orbit-dot" style="background:#ffff00"></span>ISS — ~420 km</div>
                <div><span class="orbit-dot" style="background:#44ff88"></span>GPS — ~20,200 km</div>
                <div><span class="orbit-dot" style="background:#aa88ff"></span>Galileo — ~23,200 km</div>
            </div>
            <div class="orbit-hud-hint">Drag to rotate · Scroll to zoom · Click satellite</div>
        `;
    },

    // ═══════════════════════════════════════════════
    //   INTERACTION
    // ═══════════════════════════════════════════════

    _onPointerMove(e) {
        if (!this.active) return;
        const rect = this.canvas.getBoundingClientRect();
        this.pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
        this.pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
        this._lastPointerEv = e;
    },

    _onClick(e) {
        if (!this.active) return;
        const hit = this._pickSatellite();
        if (hit) {
            this._selectedSprite = hit;
            this._showTooltip(hit, e.clientX, e.clientY);
            if (typeof SND !== 'undefined') SND.uiClick();
        } else {
            this._selectedSprite = null;
            this._hideTooltip();
        }
    },

    _pickSatellite() {
        if (!this.raycaster || !this.satSprites.length) return null;
        this.raycaster.setFromCamera(this.pointer, this.camera);
        // Slightly expanded sprite hit test — sprites are small, give a comfortable margin
        this.raycaster.params.Sprite = this.raycaster.params.Sprite || {};
        const hits = this.raycaster.intersectObjects(this.satSprites, false);
        return hits.length ? hits[0].object : null;
    },

    _showTooltip(sprite, mx, my) {
        if (!this.tooltipEl) return;
        const sat = sprite.userData.sat;
        const R_EARTH = 6371;
        const altStr = sat.altitude < 1000
            ? `${Math.round(sat.altitude)} km`
            : `${(sat.altitude / 1000).toFixed(1)}K km`;
        const periodMin = sat.meanMotion > 0 ? (1440 / sat.meanMotion) : 0;
        const periodStr = periodMin >= 60
            ? `${(periodMin / 60).toFixed(1)} h`
            : `${periodMin.toFixed(1)} min`;
        const orbitalVel = (2 * Math.PI * (R_EARTH + sat.altitude) * sat.meanMotion) / 86400;
        let regime = 'LEO';
        if (sat.altitude > 2000 && sat.altitude < 35000) regime = 'MEO';
        else if (sat.altitude >= 35000) regime = 'GEO';
        const meta = {
            starlink: { op: 'SpaceX', purpose: 'Broadband internet', country: 'USA' },
            oneweb:   { op: 'OneWeb / Eutelsat', purpose: 'Broadband internet', country: 'UK' },
            iss:      { op: 'NASA · Roscosmos · ESA · JAXA · CSA', purpose: 'Crewed space station', country: 'Intl.' },
            gps:      { op: 'US Space Force', purpose: 'Positioning / navigation', country: 'USA' },
            galileo:  { op: 'EU / ESA', purpose: 'Positioning / navigation', country: 'EU' },
            other:    { op: '—', purpose: '—', country: '—' }
        }[sat.group] || { op: '—', purpose: '—', country: '—' };

        const accent = '#' + (sprite.userData.baseColor || 0x44aaff).toString(16).padStart(6, '0');

        this.tooltipEl.innerHTML = `
            <div class="ott-name" style="color:${accent}">▓ ${sat.name}</div>
            <div class="ott-meta">${sat.group.toUpperCase()} · ${regime}</div>
            <div class="ott-row"><span>Operator</span><b>${meta.op}</b></div>
            <div class="ott-row"><span>Country</span><b>${meta.country}</b></div>
            <div class="ott-row"><span>Purpose</span><b>${meta.purpose}</b></div>
            <hr class="ott-sep">
            <div class="ott-row"><span>Altitude</span><b>${altStr}</b></div>
            <div class="ott-row"><span>Inclination</span><b>${sat.inclination.toFixed(2)}°</b></div>
            <div class="ott-row"><span>Eccentricity</span><b>${sat.eccentricity.toFixed(5)}</b></div>
            <div class="ott-row"><span>Period</span><b>${periodStr}</b></div>
            <div class="ott-row"><span>Velocity</span><b>${orbitalVel.toFixed(2)} km/s</b></div>
            <div class="ott-row"><span>Mean motion</span><b>${sat.meanMotion.toFixed(3)} rev/day</b></div>
            <div class="ott-row"><span>NORAD ID</span><b>${sat.noradId}</b></div>
        `;
        this.tooltipEl.style.borderColor = accent;
        this.tooltipEl.style.display = 'block';
        this._placeTooltip(mx, my);
    },

    _placeTooltip(mx, my) {
        if (!this.tooltipEl || this.tooltipEl.style.display === 'none') return;
        const w = this.tooltipEl.offsetWidth;
        const h = this.tooltipEl.offsetHeight;
        const vw = window.innerWidth, vh = window.innerHeight;
        let tx = mx + 16;
        let ty = my - 10;
        if (tx + w > vw - 10) tx = mx - w - 16;
        if (ty + h > vh - 10) ty = vh - h - 10;
        if (ty < 10) ty = 10;
        this.tooltipEl.style.left = tx + 'px';
        this.tooltipEl.style.top = ty + 'px';
    },

    _hideTooltip() {
        if (this.tooltipEl) this.tooltipEl.style.display = 'none';
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

    // ═══════════════════════════════════════════════
    //   FRAME UPDATE (called by engine)
    // ═══════════════════════════════════════════════

    update() {
        if (!this.active && !this._transitioning) return;
        if (!this._built) return;
        this._tick++;

        // Transition (crossfade)
        if (this._transitioning) {
            if (!this._exiting) {
                this._transitionProgress = Math.min(1, this._transitionProgress + 0.04);
                if (this.canvas) this.canvas.style.opacity = String(this._transitionProgress);
                if (typeof G !== 'undefined' && G.world) G.world.alpha = 1 - this._transitionProgress;
                if (this._transitionProgress >= 1) {
                    this._transitioning = false;
                    if (typeof G !== 'undefined' && G.world) G.world.visible = false;
                }
            } else {
                this._transitionProgress = Math.max(0, this._transitionProgress - 0.05);
                if (this.canvas) this.canvas.style.opacity = String(this._transitionProgress);
                if (typeof G !== 'undefined' && G.world) {
                    G.world.visible = true;
                    G.world.alpha = 1 - this._transitionProgress;
                }
                if (this._transitionProgress <= 0) {
                    this._completeExit();
                    if (typeof G !== 'undefined' && G.world) G.world.alpha = 1;
                    return;
                }
            }
        }

        if (!this.active) return;

        // Update sun direction (real day phase — drives the earth terminator)
        if (this.earthMesh) {
            const dp = (typeof G !== 'undefined' && G.getDayPhase) ? G.getDayPhase() : 0.5;
            const angle = (dp - 0.5) * Math.PI * 2 + Math.PI;
            const sunDir = this.earthMesh.material.uniforms.sunDir.value;
            sunDir.set(Math.cos(angle), 0.25, Math.sin(angle)).normalize();
        }

        // Earth slowly rotates (cosmetic — about 1 rev per ~60s)
        if (this.earthGroup) this.earthGroup.rotation.y += 0.001;

        // Animate satellites
        this.satSprites.forEach(sp => {
            sp.userData.orbitAngle += sp.userData.orbitSpeed;
            const pos = this._orbitPosition(
                sp.userData.sat,
                sp.userData.orbitAngle,
                sp.userData.radius
            );
            sp.position.copy(pos);
            // ISS pulsing blink
            if (sp.userData.sat.group === 'iss') {
                const p = 1 + Math.sin(this._tick * 0.08) * 0.25;
                sp.scale.setScalar(sp.userData.baseSize * p);
            }
        });

        // You-marker pulse
        if (this.youMarker) {
            const p = 1 + Math.sin(this._tick * 0.07) * 0.3;
            this.youMarker.scale.setScalar(8 * p);
        }

        // Selected satellite — pulse outline via scale
        if (this._selectedSprite) {
            const sp = this._selectedSprite;
            const p = 1 + Math.sin(this._tick * 0.15) * 0.4;
            sp.scale.setScalar(sp.userData.baseSize * p * 1.3);
            // Follow tooltip to the satellite
            if (this.tooltipEl && this.tooltipEl.style.display === 'block') {
                const screen = sp.position.clone().project(this.camera);
                const mx = (screen.x * 0.5 + 0.5) * window.innerWidth;
                const my = (-screen.y * 0.5 + 0.5) * window.innerHeight;
                this._placeTooltip(mx, my);
            }
        }

        // Subtle star twinkle (vary opacity slowly)
        if (this.starField && this._tick % 4 === 0) {
            this.starField.material.opacity = 0.75 + Math.sin(this._tick * 0.03) * 0.1;
        }

        this.controls.update();
        this.renderer.render(this.scene, this.camera);
    },

    resize() {
        if (!this._built) return;
        const W = window.innerWidth, H = window.innerHeight;
        this.camera.aspect = W / H;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(W, H);
    }
};
