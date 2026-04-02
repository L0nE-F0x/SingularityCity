/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   GLOBAL CASH BURN TRACKER (v1.1.0 - UI Layout Patch)
   Real-world macro-economic modeling for AGI infrastructure.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const BurnTracker = {
    totalBurned: 0,
    capexPerSec: 0,
    opexPerSec: 0,
    lastTime: 0,
    
    // UI Elements
    container: null,
    totalEl: null,
    rateEl: null,

    init() {
        this.calculateCapex();
        this.buildUI();
        this.lastTime = performance.now();
        requestAnimationFrame((t) => this.tick(t));
    },

    calculateCapex() {
        if (typeof COMPUTE_DATA === 'undefined' || !COMPUTE_DATA.clusters) return;
        
        let totalGPUs = 0;
        COMPUTE_DATA.clusters.forEach(cluster => {
            totalGPUs += cluster.gpus;
        });

        // Industry standard blended cost to rent/run flagship GPUs (H100/B200) 
        // including power, cooling, and hardware amortization is ~$2.50 per hour.
        const hourlyCapex = totalGPUs * 2.50; 
        this.capexPerSec = hourlyCapex / 3600; 
    },

    calculateDynamicOpex() {
        if (typeof G === 'undefined' || !G.models) return;

        let currentOpex = 0;

        G.models.forEach((m, i) => {
            const refs = G.charRefs ? G.charRefs[m.id] : null;
            if (!refs) return;

            if (refs._state && (refs._state.includes('work') || refs._state.includes('socialize') || refs._state.includes('train'))) {
                
                let outputCostPerMillion = 1.00; 
                if (typeof COSTS !== 'undefined' && COSTS[m.id]) {
                    outputCostPerMillion = COSTS[m.id].output;
                }

                const pScale = refs.paramScale || 1.0;
                const simulatedTokensPerSec = 10000000 * pScale; 
                
                const costPerSec = (simulatedTokensPerSec / 1000000) * outputCostPerMillion;
                currentOpex += costPerSec;
            }
        });

        this.opexPerSec = currentOpex;
    },

    buildUI() {
        this.container = document.createElement('div');
        this.container.id = 'burn-tracker-hud';
        
        // Sleek, inline styling to fit the top bar seamlessly
        Object.assign(this.container.style, {
            display: 'flex',
            alignItems: 'center',
            fontFamily: '"JetBrains Mono", "Courier New", monospace',
            color: '#ef4444',
            marginLeft: 'auto', // Pushes it to the far right of the top-main flex container
            paddingRight: '20px',
            userSelect: 'none'
        });

        const textWrap = document.createElement('div');
        Object.assign(textWrap.style, {
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end'
        });

        this.totalEl = document.createElement('div');
        Object.assign(this.totalEl.style, {
            fontSize: '18px',
            fontWeight: '900',
            textShadow: '0 0 8px rgba(239, 68, 68, 0.6)',
            lineHeight: '1.2'
        });

        this.rateEl = document.createElement('div');
        Object.assign(this.rateEl.style, {
            fontSize: '10px',
            color: '#fca5a5',
            letterSpacing: '1px',
            opacity: '0.8'
        });

        textWrap.appendChild(this.totalEl);
        textWrap.appendChild(this.rateEl);
        this.container.appendChild(textWrap);

        // Inject into the game wrapper's top bar so it hides on the landing page!
        const topMain = document.querySelector('.top-main');
        if (topMain) {
            topMain.appendChild(this.container);
        } else {
            // Fallback just in case the DOM isn't fully ready
            document.body.appendChild(this.container); 
        }
    },

    formatMoney(amount) {
        return '$' + amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    },

    tick(currentTime) {
        const deltaSec = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;

        if (this.capexPerSec === 0) this.calculateCapex();
        this.calculateDynamicOpex();

        const totalBurnRate = this.capexPerSec + this.opexPerSec;
        this.totalBurned += totalBurnRate * deltaSec;

        if (this.totalEl) {
            this.totalEl.innerText = this.formatMoney(this.totalBurned);
            this.rateEl.innerText = `GLOBAL BURN RATE: ${this.formatMoney(totalBurnRate)}/s`;
        }

        requestAnimationFrame((t) => this.tick(t));
    }
};

window.addEventListener('DOMContentLoaded', () => {
    setTimeout(() => {
        BurnTracker.init();
    }, 1000);
});
