/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   THE BACKBONE — Network Infrastructure District (v1.0.0)
   Internet backbone hub for Singularity City. Where submarine cables surface, networks peer,
   satellites downlink, and every byte enters the city. Origin point for all data cables.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BackboneZone = {
    BLDS: [
        { id: 'backbone_landing', name: 'Cable Landing Station',      w: 180, fl: 3, emoji: '🌊', type: 'backbone',
          desc: 'Submarine cable terminus. 14 trans-oceanic fiber pairs surface here, connecting the city to every continent. Armored cable vault 40m below sea level.' },
        { id: 'backbone_ixp',     name: 'Internet Exchange Point',    w: 200, fl: 4, emoji: '🔀', type: 'backbone',
          desc: 'Singularity City IX — where all networks peer. 800+ connected ASNs exchanging 12 Tbps peak traffic. The hub from which every data cable in the city originates.' },
        { id: 'backbone_ground',  name: 'Satellite Ground Station',   w: 190, fl: 3, emoji: '📡', type: 'backbone',
          desc: 'Starlink, Kuiper, and OneWeb downlink array. 48 steerable dishes tracking 4,000+ LEO satellites. Low-latency orbital internet becomes terrestrial fiber here.' },
        { id: 'backbone_cdn',     name: 'CDN / Edge Node',            w: 160, fl: 5, emoji: '⚡', type: 'backbone',
          desc: 'Cloudflare, Akamai & Fastly edge presence. Caches 40% of the city\'s web traffic locally. DDoS mitigation filters 2M+ malicious requests per second.' },
        { id: 'backbone_noc',     name: 'Network Operations Center',  w: 220, fl: 6, emoji: '🖥️', type: 'backbone',
          desc: 'The 24/7 nerve center. Engineers monitor every packet, route, and BGP session. War room activates during outages. Screens cover every wall.' },
    ],

    NPCS: [
        { id: 'npc_noc_lead',     name: 'NOC Lead',         role: 'Network Operations',     workplace: 'backbone_noc',     color: '#22d3ee', shift: 'night' },
        { id: 'npc_peering_mgr',  name: 'Peering Manager',  role: 'IX Peering Relations',   workplace: 'backbone_ixp',     color: '#4ade80', shift: 'day' },
        { id: 'npc_cable_tech',   name: 'Cable Technician', role: 'Submarine Fiber Ops',    workplace: 'backbone_landing', color: '#fbbf24', shift: 'day' },
        { id: 'npc_sat_ops',      name: 'Satellite Ops',    role: 'Ground Station Control', workplace: 'backbone_ground',  color: '#a855f7', shift: 'night' },
        { id: 'npc_cdn_eng',      name: 'CDN Engineer',     role: 'Edge Cache Operations',  workplace: 'backbone_cdn',     color: '#f97316', shift: 'day' },
        { id: 'npc_sre',          name: 'Site Reliability',  role: 'SRE / Incident Response', workplace: 'backbone_noc',   color: '#ef4444', shift: 'night' },
    ],

    _inited: false,
    zoneStartX: 0,
    zoneEndX: 0,
    networkStats: {
        trafficTbps: 12.4,
        peeringASNs: 847,
        activeSats: 4200,
        cacheHitRate: 94.2,
        avgLatencyMs: 3.1,
        bgpPrefixes: 985000,
        status: 'operational'
    },
    statusTicker: [],
    tickerIdx: 0,
    cloudStatus: [],     // live cloud provider incidents
    trafficTrend: 'up',  // up/down/stable from Cloudflare Radar

    init() {
        if (this._inited) return;
        this._inited = true;

        this.BLDS.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = {
                    id: def.id, name: def.name, w: def.w, x: 0,
                    fl: def.fl, emoji: def.emoji, lab: null,
                    desc: def.desc, type: def.type,
                    _isBackbone: true
                };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Register NPCs with housing system
        if (typeof NPCHousing !== 'undefined') {
            this.NPCS.forEach(npc => {
                if (!NPCHousing.REGISTRY.find(n => n.id === npc.id)) {
                    NPCHousing.REGISTRY.push(npc);
                }
            });
        }

        this._buildTicker();
    },

    positionZone(afterX) {
        let x = afterX + 60;
        this.zoneStartX = x;

        this.BLDS.forEach(def => {
            const bld = BLDS.find(b => b.id === def.id);
            if (bld) {
                bld.x = x;
                x += bld.w + 50;
            }
        });

        this.zoneEndX = x + 40;
        return this.zoneEndX;
    },

    _buildTicker() {
        this.statusTicker = [];

        // Reference stats
        this.statusTicker.push(`🔀 IX Peak: ${this.networkStats.trafficTbps} Tbps — ${this.networkStats.peeringASNs} ASNs peering`);
        this.statusTicker.push(`📡 ${this.networkStats.activeSats.toLocaleString()} LEO satellites tracked — Starlink, Kuiper, OneWeb`);
        this.statusTicker.push(`⚡ CDN cache hit rate: ${this.networkStats.cacheHitRate}% — ${this.networkStats.avgLatencyMs}ms avg latency`);
        this.statusTicker.push(`🌐 BGP routing table: ${(this.networkStats.bgpPrefixes / 1000).toFixed(0)}K prefixes active`);
        this.statusTicker.push('🔒 DDoS mitigation: 2.1M malicious req/s filtered by edge nodes');
        this.statusTicker.push('🌊 14 submarine cable pairs — 800 Tbps total trans-oceanic capacity');

        // Live cloud status (if available)
        if (this.cloudStatus.length > 0) {
            this.cloudStatus.slice(0, 4).forEach(s => {
                const emoji = s.severity === 'major' ? '🔴' : s.severity === 'minor' ? '🟡' : '🟢';
                this.statusTicker.push(`${emoji} ${s.headline}`);
            });
        }

        // Shuffle
        for (let i = this.statusTicker.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.statusTicker[i], this.statusTicker[j]] = [this.statusTicker[j], this.statusTicker[i]];
        }
    },

    getNextTickerItem() {
        if (!this.statusTicker.length) return '';
        const item = this.statusTicker[this.tickerIdx % this.statusTicker.length];
        this.tickerIdx++;
        return item;
    },

    update() {
        // Slowly vary stats for visual interest
        if (G.tick % 300 === 0) {
            this.networkStats.trafficTbps = +(10 + Math.random() * 5).toFixed(1);
            this.networkStats.cacheHitRate = +(92 + Math.random() * 6).toFixed(1);
            this.networkStats.avgLatencyMs = +(2 + Math.random() * 3).toFixed(1);
            this.networkStats.activeSats = 4000 + Math.floor(Math.random() * 500);
        }
    }
};
