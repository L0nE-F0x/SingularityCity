/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   SPACE DATA LAYER (v1.0.0 — Compute in Space: Phase 1)
   Defines space organizations, launch facilities, and real-time launch API integration.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const SPACE_ORGS = {
    spacex:      { name: 'SpaceX',       ceo: 'Elon Musk',       color: '#0033a0', icon: '🚀', region: 'us', desc: 'Leading the charge in reusable rocketry and Starlink compute constellation.' },
    blue_origin: { name: 'Blue Origin',  ceo: 'Jeff Bezos',      color: '#0077c8', icon: '🔵', region: 'us', desc: 'Building orbital infrastructure for compute offloading and Project Kuiper.' },
    nasa:        { name: 'NASA',          ceo: 'Bill Nelson',     color: '#fc3d21', icon: '🛸', region: 'us', desc: 'Pioneering deep space compute networks and Artemis program data relay.' },
    cnsa:        { name: 'CNSA',          ceo: null,              color: '#de2910', icon: '🇨🇳', region: 'cn', desc: 'Chinese National Space Administration. Tiangong station compute clusters.' },
    esa:         { name: 'ESA',           ceo: 'Josef Aschbacher', color: '#003399', icon: '🇪🇺', region: 'eu', desc: 'European Space Agency. HPC in orbit research and Copernicus AI platform.' },
    ula:         { name: 'ULA',           ceo: 'Tory Bruno',      color: '#1a1a2e', icon: '⚡', region: 'us', desc: 'United Launch Alliance. Vulcan Centaur heavy-lift for orbital data centers.' },
    rocketlab:   { name: 'Rocket Lab',    ceo: 'Peter Beck',      color: '#00b4d8', icon: '🌙', region: 'us', desc: 'Small-sat specialist enabling edge compute constellation deployments.' },
    isro:        { name: 'ISRO',          ceo: 'S. Somanath',     color: '#ff6b00', icon: '🇮🇳', region: 'eu', desc: 'Indian Space Research Organisation. Cost-effective orbital compute access.' },
    jaxa:        { name: 'JAXA',          ceo: 'Hiroshi Yamakawa', color: '#00479d', icon: '🇯🇵', region: 'cn', desc: 'Japan Aerospace Exploration Agency. Quantum compute satellite research.' },
    roscosmos:   { name: 'Roscosmos',     ceo: 'Yuri Borisov',    color: '#cc0000', icon: '☭',  region: 'eu', desc: 'Russian Federal Space Agency. ISS module compute and Angara heavy-lift.' }
};

const SPACE_BLDS = [
    // Launch pads — each org gets a pad + mission control
    { id: 'pad_spacex',      name: 'LC-39A',              w: 180, fl: 1, org: 'spacex',      type: 'launchpad',      desc: 'Kennedy Space Center Launch Complex 39A. Falcon 9 & Starship operations.' },
    { id: 'pad_blue_origin', name: 'LC-36',               w: 160, fl: 1, org: 'blue_origin',  type: 'launchpad',      desc: 'Cape Canaveral Launch Complex 36. New Glenn orbital launches.' },
    { id: 'pad_nasa',        name: 'SLS Pad 39B',         w: 180, fl: 1, org: 'nasa',         type: 'launchpad',      desc: 'NASA Space Launch System pad. Artemis deep space missions.' },
    { id: 'pad_cnsa',        name: 'Wenchang LC-2',       w: 160, fl: 1, org: 'cnsa',         type: 'launchpad',      desc: 'Wenchang Spacecraft Launch Site. Long March 5B heavy-lift.' },
    { id: 'pad_esa',         name: 'ELA-4',               w: 140, fl: 1, org: 'esa',          type: 'launchpad',      desc: 'Guiana Space Centre. Ariane 6 European access to orbit.' },
    { id: 'pad_ula',         name: 'SLC-41',              w: 150, fl: 1, org: 'ula',           type: 'launchpad',      desc: 'Space Launch Complex 41. Vulcan Centaur operations.' },
    { id: 'pad_rocketlab',   name: 'LC-1A',               w: 120, fl: 1, org: 'rocketlab',     type: 'launchpad',      desc: 'Rocket Lab Launch Complex 1. Electron & Neutron missions.' },
    
    // Shared infrastructure
    { id: 'mission_control',  name: 'Deep Space Network',  w: 200, fl: 3, org: null,           type: 'mission_control', desc: 'Interplanetary communication hub. Tracks all orbital compute assets.' },
    { id: 'space_assembly',   name: 'Vehicle Assembly',    w: 220, fl: 4, org: null,           type: 'assembly',        desc: 'Vertical Assembly Building. Rocket integration and payload mating.' },
    { id: 'tracking_station', name: 'Orbital Tracking',    w: 160, fl: 2, org: null,           type: 'tracking',        desc: 'Real-time tracking of compute satellites and space station assets.' }
];

// Separation forest between space zone and residential
const SPACE_FOREST = { id: 'forest_space', name: 'Frontier Pines', w: 350, fl: 1, emoji: '🌲', lab: null, desc: 'A rugged treeline marking the boundary between the space frontier and the city.' };

const SpaceData = {
    launches: [],
    nextFetchTick: 0,
    
    init() {
        // Inject space buildings into BLDS if not already present
        if (!BLDS.find(b => b.id === 'pad_spacex')) {
            SPACE_BLDS.forEach(sb => {
                const bld = { ...sb, x: 0 }; // x will be set by recalculateZoning
                BLDS.push(bld);
                G.bldById[bld.id] = bld;
            });
        }
        
        // Inject separation forest
        if (!BLDS.find(b => b.id === 'forest_space')) {
            const f = { ...SPACE_FOREST, x: 0 };
            BLDS.push(f);
            G.bldById[f.id] = f;
        }
        
        console.log('🚀 Space Zone initialized with', SPACE_BLDS.length, 'facilities');
    },
    
    async fetchLaunches(force) {
        // Cache in localStorage to avoid 429 rate limits (15-min TTL)
        const CACHE_KEY = 'sc_launches', TTL = 15 * 60 * 1000;
        if (!force) {
            try {
                const cached = JSON.parse(localStorage.getItem(CACHE_KEY));
                if (cached && Date.now() - cached.ts < TTL) {
                    this.launches = cached.data;
                    console.log(`🛰️ Using cached ${this.launches.length} launches (${Math.round((TTL - (Date.now() - cached.ts)) / 60000)}min left)`);
                    return;
                }
            } catch(_) {}
        }
        try {
            const r = await fetch('https://ll.thespacedevs.com/2.2.0/launch/upcoming/?limit=10&mode=list', {
                signal: AbortSignal.timeout(10000)
            });
            if (!r.ok) {
                if (r.status === 429) { console.warn('[Space API] Rate limited (429). Using cached data if available.'); return; }
                return;
            }
            const d = await r.json();
            if (d.results) {
                this.launches = d.results.map(l => ({
                    id: l.id,
                    name: l.name,
                    net: l.net, // NET = No Earlier Than (ISO date)
                    status: l.status?.abbrev || 'TBD',
                    provider: l.launch_service_provider?.name || 'Unknown',
                    rocket: l.rocket?.configuration?.name || 'Unknown',
                    pad: l.pad?.name || 'Unknown',
                    mission: l.mission?.name || null,
                    image: l.image || null
                }));
                try { localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data: this.launches })); } catch(_) {}
                console.log(`🛰️ Loaded ${this.launches.length} upcoming launches`);

                if (typeof UI !== 'undefined') {
                    UI.addToast(`🚀 ${this.launches.length} upcoming launches tracked`);
                }
            }
        } catch(e) {
            console.warn('[Space API] Failed to fetch launches:', e.message);
        }
    },
    
    getNextLaunch() {
        if (!this.launches.length) return null;
        const now = new Date();
        return this.launches.find(l => new Date(l.net) > now) || this.launches[0];
    },
    
    getCountdown(launch) {
        if (!launch || !launch.net) return null;
        const diff = new Date(launch.net) - new Date();
        if (diff < 0) return 'LAUNCHED';
        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);
        if (d > 0) return `T-${d}d ${h}h ${m}m`;
        if (h > 0) return `T-${h}h ${m}m ${s}s`;
        return `T-${m}m ${s}s`;
    },
    
    getOrgForProvider(providerName) {
        const n = providerName.toLowerCase();
        if (n.includes('spacex')) return 'spacex';
        if (n.includes('blue origin')) return 'blue_origin';
        if (n.includes('nasa')) return 'nasa';
        if (n.includes('ula') || n.includes('united launch')) return 'ula';
        if (n.includes('rocket lab')) return 'rocketlab';
        if (n.includes('isro')) return 'isro';
        if (n.includes('jaxa')) return 'jaxa';
        if (n.includes('roscosmos')) return 'roscosmos';
        if (n.includes('arianespace') || n.includes('esa')) return 'esa';
        if (n.includes('casc') || n.includes('china')) return 'cnsa';
        return null;
    }
};
