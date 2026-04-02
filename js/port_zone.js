/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   PORT / TRADE ZONE (v1.0.0)
   Harbor district representing the global AI supply chain.
   Container ships deliver critical resources for the race to AGI.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PortZone = {
    COMMODITIES: [
        { id: 'gpu_h100',       name: 'NVIDIA H100 80GB',     emoji: '🖥️', unit: 'unit',  category: 'compute',     desc: 'The workhorse GPU powering frontier model training.' },
        { id: 'gpu_b200',       name: 'NVIDIA B200',          emoji: '🖥️', unit: 'unit',  category: 'compute',     desc: 'Next-gen Blackwell GPU for trillion-parameter models.' },
        { id: 'helium',         name: 'Liquid Helium',        emoji: '💨', unit: 'L',     category: 'cooling',     desc: 'Cryogenic coolant for EUV lithography and quantum systems.' },
        { id: 'silicon_wafer',  name: 'Silicon Wafers (300mm)', emoji: '🔬', unit: 'wafer', category: 'fabrication', desc: 'Ultra-pure silicon substrates for chip manufacturing.' },
        { id: 'rare_earth',     name: 'Rare Earth (Nd/Ga)',   emoji: '⛏️', unit: 'kg',    category: 'materials',   desc: 'Neodymium & gallium — critical for magnets, LEDs, and semiconductors.' },
        { id: 'hbm_memory',     name: 'HBM3e Memory',        emoji: '🧠', unit: 'stack', category: 'compute',     desc: 'High-bandwidth memory stacks by SK Hynix — GPU bottleneck.' },
        { id: 'power_xfmr',     name: 'Power Transformers',   emoji: '⚡', unit: 'unit',  category: 'power',       desc: 'High-voltage transformers for data center grid connections.' },
        { id: 'fiber_optic',    name: 'Fiber Optic Cable',    emoji: '📡', unit: 'km',    category: 'network',     desc: 'Submarine & terrestrial fiber for inter-DC networking.' },
        { id: 'coolant_sys',    name: 'Liquid Cooling Systems', emoji: '🧊', unit: 'unit', category: 'cooling',    desc: 'Direct-to-chip liquid cooling for high-density GPU clusters.' },
        { id: 'server_rack',    name: 'Server Rack Chassis',  emoji: '🏗️', unit: 'unit',  category: 'infra',       desc: 'Open Compute Project rack frames for hyperscale DCs.' },
        { id: 'copper',         name: 'Copper (Grade A)',     emoji: '🔶', unit: 'tonne', category: 'materials',   desc: 'Essential conductor for power distribution and PCBs.' },
        { id: 'electricity',    name: 'Electricity (Ind.)',   emoji: '🔌', unit: 'MWh',   category: 'power',       desc: 'Industrial electricity — the largest ongoing cost of AGI.' }
    ],

    // Live price cache (loaded from Supabase or fallback)
    prices: {},
    ships: [],
    buildings: [],
    _inited: false,

    init() {
        if (this._inited) return;
        this._inited = true;

        // Ensure port buildings exist in BLDS
        const portBlds = [
            { id: 'port_authority', name: 'Port Authority',  w: 140, fl: 3, emoji: '🏗️', desc: 'Singularity City harbor master. All cargo clears customs here.' },
            { id: 'port_warehouse', name: 'GPU Warehouse',   w: 180, fl: 2, emoji: '📦', desc: 'Bonded warehouse storing compute hardware awaiting deployment to data centers.' },
            { id: 'port_fuel',      name: 'Fuel & Gas Depot', w: 120, fl: 1, emoji: '⛽', desc: 'Cryogenic helium storage and diesel reserves for backup generators.' },
            { id: 'port_crane',     name: 'Cargo Crane',      w: 80,  fl: 1, emoji: '🏗️', desc: 'Automated gantry crane. Unloads 40 containers per hour.' }
        ];
        portBlds.forEach(def => {
            if (!BLDS.find(b => b.id === def.id)) {
                const bld = { id: def.id, name: def.name, w: def.w, x: 0, fl: def.fl, emoji: def.emoji, lab: null, desc: def.desc, _isPort: true };
                BLDS.push(bld);
                G.bldById[def.id] = bld;
            }
        });

        // Ships spawned after positioning (in positionZone)
        this.loadPrices();
    },

    // Position port zone to the LEFT of Space Zone
    positionZone(spaceLeftX) {
        const portBlds = BLDS.filter(b => b._isPort || b.id.startsWith('port_'));
        let px = spaceLeftX - 200;
        const reversed = [...portBlds].reverse();
        reversed.forEach(b => {
            px -= b.w + 40;
            b.x = px;
        });
        const leftmost = portBlds.reduce((min, b) => b.x < min ? b.x : min, Infinity);
        this.oceanStartX = leftmost - 600;
        this.oceanEndX = leftmost;
        this.coastlineX = leftmost - 40;
        
        // Spawn ships now that we know ocean coordinates
        if (!this.ships.length) this._spawnShips();
        
        return this.oceanStartX;
    },

    _spawnShips() {
        // 3 cargo ships cycling in and out
        const shipCargos = [
            { cargo: 'gpu_h100', label: 'MV COMPUTE PRIME', color: 0x3b82f6 },
            { cargo: 'helium', label: 'SS CRYO VENTURE', color: 0x22d3ee },
            { cargo: 'rare_earth', label: 'MV MINERAL KING', color: 0xf59e0b }
        ];
        shipCargos.forEach((sc, i) => {
            this.ships.push({
                ...sc, x: -100 - i * 400,
                state: i === 0 ? 'sailing_in' : 'waiting', dir: 1,
                dockX: 0, // set during positioning
                speed: 0.3 + Math.random() * 0.2,
                dockTimer: 0,
                bobPhase: Math.random() * Math.PI * 2
            });
        });
    },

    async loadPrices() {
        // Try Supabase first
        if (typeof API !== 'undefined' && API.supabase) {
            try {
                const { data, error } = await API.supabase.from('port_commodities').select('*');
                if (!error && data && data.length > 0) {
                    data.forEach(row => {
                        this.prices[row.id] = {
                            price: row.price, currency: row.currency || 'USD',
                            change_pct: row.change_pct || 0, updated: row.updated_at,
                            supply_status: row.supply_status || 'stable'
                        };
                    });
                    console.log(`🚢 Port Zone: Loaded ${data.length} commodity prices from cloud`);
                    return;
                }
            } catch (e) { /* fall through to defaults */ }
        }
        // Fallback estimated prices
        this.prices = {
            gpu_h100:      { price: 30000,   currency: 'USD', change_pct: -8.2,  supply_status: 'surplus',  updated: '2025-Q4' },
            gpu_b200:      { price: 45000,   currency: 'USD', change_pct: 12.5,  supply_status: 'scarce',   updated: '2025-Q4' },
            helium:        { price: 35,      currency: 'USD', change_pct: 28.4,  supply_status: 'critical', updated: '2025-Q4' },
            silicon_wafer: { price: 142,     currency: 'USD', change_pct: 3.1,   supply_status: 'stable',   updated: '2025-Q4' },
            rare_earth:    { price: 380,     currency: 'USD', change_pct: 15.7,  supply_status: 'tight',    updated: '2025-Q4' },
            hbm_memory:    { price: 900,     currency: 'USD', change_pct: 22.0,  supply_status: 'scarce',   updated: '2025-Q4' },
            power_xfmr:    { price: 85000,   currency: 'USD', change_pct: 6.3,   supply_status: 'tight',    updated: '2025-Q4' },
            fiber_optic:   { price: 1200,    currency: 'USD', change_pct: -2.1,  supply_status: 'stable',   updated: '2025-Q4' },
            coolant_sys:   { price: 4500,    currency: 'USD', change_pct: 18.9,  supply_status: 'tight',    updated: '2025-Q4' },
            server_rack:   { price: 2200,    currency: 'USD', change_pct: 1.4,   supply_status: 'stable',   updated: '2025-Q4' },
            copper:        { price: 9800,    currency: 'USD', change_pct: 5.6,   supply_status: 'stable',   updated: '2025-Q4' },
            electricity:   { price: 68,      currency: 'USD', change_pct: 11.2,  supply_status: 'tight',    updated: '2025-Q4' }
        };
    },

    update() {
        if (!this.ships.length) return;
        const craneBld = BLDS.find(b => b.id === 'port_crane');
        const warehouseBld = BLDS.find(b => b.id === 'port_warehouse');
        const baseDockX = craneBld ? craneBld.x - 20 : (warehouseBld ? warehouseBld.x + warehouseBld.w / 2 : 300);

        this.ships.forEach((ship, si) => {
            // Each ship docks further left (under crane, then warehouse area)
            ship.dockX = baseDockX - si * 180;
            
            // Staggered arrival: ship can only sail in if previous ship has docked or left
            const prevShip = si > 0 ? this.ships[si - 1] : null;
            const canSail = !prevShip || prevShip.state === 'docked' || prevShip.state === 'sailing_out' || (prevShip.x > ship.dockX + 200);

            if (ship.state === 'waiting') {
                // Waiting offshore for slot
                if (canSail) ship.state = 'sailing_in';
            } else if (ship.state === 'sailing_in') {
                ship.x += ship.speed;
                ship.dir = 1; // facing right
                if (ship.x >= ship.dockX) { 
                    ship.state = 'docked'; 
                    ship.dockTimer = 800 + Math.random() * 400;
                    ship.x = ship.dockX;
                }
            } else if (ship.state === 'docked') {
                ship.x = ship.dockX;
                ship.dir = 1;
                ship.dockTimer--;
                if (ship.dockTimer <= 0) ship.state = 'sailing_out';
            } else if (ship.state === 'sailing_out') {
                ship.x -= ship.speed * 0.8;
                ship.dir = -1; // facing left (departing)
                if (ship.x < -400) {
                    ship.state = 'waiting';
                    ship.x = -200 - Math.random() * 200;
                    ship.dir = 1;
                }
            }
        });
    },

    // Format price for display
    fmtPrice(id) {
        const p = this.prices[id];
        if (!p) return '—';
        const val = p.price >= 10000 ? `$${(p.price/1000).toFixed(1)}K` : p.price >= 1000 ? `$${p.price.toLocaleString()}` : `$${p.price}`;
        const arrow = p.change_pct > 0 ? '▲' : p.change_pct < 0 ? '▼' : '—';
        const col = p.change_pct > 10 ? '#ef4444' : p.change_pct > 0 ? '#f59e0b' : p.change_pct < -5 ? '#4ade80' : '#94a3b8';
        return `${val} <span style="color:${col}">${arrow} ${Math.abs(p.change_pct).toFixed(1)}%</span>`;
    },

    supplyColor(id) {
        const s = this.prices[id]?.supply_status;
        if (s === 'critical') return '#ef4444';
        if (s === 'scarce') return '#f59e0b';
        if (s === 'tight') return '#fbbf24';
        return '#4ade80';
    },

    supplyLabel(id) {
        return (this.prices[id]?.supply_status || 'unknown').toUpperCase();
    }
};
