/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   POWER ENVIRONMENT (v1.0.0)
   Renders power grid buildings, animations (turbines, steam, solar tracking), HUD, and panel.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const PowerEnv = {
    steamParts: [], smokeParts: [], _built: false,
    turbineBlades: [], solarPanels: [], waterFlows: [],

    buildAnimations(charLayer) {
        if (this._built || typeof PowerZone === 'undefined') return;
        this._built = true;
        const gy = G.groundY;

        // ─── NUCLEAR STEAM PARTICLES ───
        const nucBld = BLDS.find(b => b.id === 'power_nuclear');
        if (nucBld) {
            for (let i = 0; i < 20; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(0xffffff, 0.15 + Math.random() * 0.15);
                p.drawCircle(0, 0, 3 + Math.random() * 5); p.endFill();
                p.x = nucBld.x + nucBld.w / 2 + (Math.random() - 0.5) * 20;
                p.y = gy - 80 - Math.random() * 40;
                p._baseX = p.x; p._speed = 0.3 + Math.random() * 0.4; p._phase = Math.random() * Math.PI * 2;
                p._resetY = gy - 60;
                charLayer.addChild(p);
                this.steamParts.push(p);
            }
        }
        // ─── COAL SMOKE PARTICLES ───
        const coalBld = BLDS.find(b => b.id === 'power_coal');
        if (coalBld) {
            for (let i = 0; i < 15; i++) {
                const p = new PIXI.Graphics();
                p.beginFill(0x333333, 0.2 + Math.random() * 0.15);
                p.drawCircle(0, 0, 2 + Math.random() * 4); p.endFill();
                p.x = coalBld.x + coalBld.w * 0.7 + (Math.random() - 0.5) * 10;
                p.y = gy - 60 - Math.random() * 30;
                p._baseX = p.x; p._speed = 0.2 + Math.random() * 0.3; p._phase = Math.random() * Math.PI * 2;
                p._resetY = gy - 40;
                charLayer.addChild(p);
                this.smokeParts.push(p);
            }
        }
        // ─── WIND TURBINE BLADES (PIXI containers for rotation) ───
        const windBld = BLDS.find(b => b.id === 'power_wind');
        if (windBld) {
            for (let ti = 0; ti < 3; ti++) {
                const tx = windBld.x + 40 + ti * 45;
                const bladeC = new PIXI.Container();
                bladeC.x = tx; bladeC.y = gy - 72;
                // 3 blades
                const bg = new PIXI.Graphics();
                for (let a = 0; a < 3; a++) {
                    const angle = (a * Math.PI * 2) / 3;
                    bg.beginFill(0xf1f5f9, 0.8);
                    bg.moveTo(0, 0);
                    bg.lineTo(Math.cos(angle) * 25, Math.sin(angle) * 25);
                    bg.lineTo(Math.cos(angle + 0.15) * 22, Math.sin(angle + 0.15) * 22);
                    bg.closePath(); bg.endFill();
                }
                bg.beginFill(0x94a3b8); bg.drawCircle(0, 0, 3); bg.endFill();
                bladeC.addChild(bg);
                charLayer.addChild(bladeC);
                this.turbineBlades.push({ cont: bladeC, speed: 0.02 + ti * 0.005 });
            }
        }
    },

    update() {
        if (typeof PowerZone === 'undefined') return;
        PowerZone.update();
        const w = typeof Environment !== 'undefined' ? Environment.weather : 'clear';
        const windMult = w === 'rain' ? 2.5 : w === 'snow' ? 1.8 : w === 'sandstorm' ? 3.0 : 1.0;

        // Steam particles rise and reset
        this.steamParts.forEach(p => {
            if (!p || p.destroyed) return;
            p.y -= p._speed;
            p.x = p._baseX + Math.sin(G.tick * 0.02 + p._phase) * 8;
            p.alpha = Math.max(0, 0.25 - (p._resetY - p.y) * 0.002);
            if (p.y < p._resetY - 80) { p.y = p._resetY; p.alpha = 0.25; }
        });
        // Smoke particles
        this.smokeParts.forEach(p => {
            if (!p || p.destroyed) return;
            p.y -= p._speed * 0.8;
            p.x = p._baseX + Math.sin(G.tick * 0.015 + p._phase) * 12;
            p.alpha = Math.max(0, 0.2 - (p._resetY - p.y) * 0.002);
            if (p.y < p._resetY - 60) { p.y = p._resetY; p.alpha = 0.2; }
        });
        // Wind turbine rotation
        this.turbineBlades.forEach(tb => {
            if (!tb.cont || tb.cont.destroyed) return;
            tb.cont.rotation += tb.speed * windMult;
        });
    },

    // ─── POWER GRID PANEL ───
    showGridPanel() {
        const p = document.getElementById('infoPanel');
        if (!p || typeof PowerZone === 'undefined') return;
        const pz = PowerZone;
        const supply = pz.getTotalSupply();
        const demand = pz.getTotalDemand();
        const balance = supply - demand;
        const balCol = balance >= 0 ? '#4ade80' : '#ef4444';
        const balIcon = balance >= 0 ? '✅' : '⚠️';
        const balLabel = balance >= 0 ? 'SURPLUS' : 'DEFICIT';
        const pct = demand > 0 ? Math.round((supply / demand) * 100) : 100;

        let html = '<button class="ipanel-x" onclick="UI.closePanel()">✕</button>';
        html += '<div style="text-align:center;margin-bottom:12px"><span style="font-size:20px">⚡</span><br><span style="color:var(--cy);font-size:11px;letter-spacing:2px">POWER GRID STATUS</span></div>';
        // Balance meter
        html += '<div style="background:var(--cd);border:1px solid var(--bd);border-radius:6px;padding:8px;margin-bottom:10px;text-align:center">';
        html += '<div style="font-size:9px;color:var(--t3);margin-bottom:4px">GRID BALANCE</div>';
        html += '<div style="display:flex;align-items:center;justify-content:center;gap:8px">';
        html += '<span style="font-size:16px;color:' + balCol + '">' + balIcon + '</span>';
        html += '<span style="font-size:14px;color:#fff;font-weight:bold">' + supply.toLocaleString() + ' MW</span>';
        html += '<span style="font-size:9px;color:var(--t3)">/ ' + demand.toLocaleString() + ' MW demand</span>';
        html += '</div>';
        html += '<div style="margin-top:6px;background:rgba(255,255,255,0.05);border-radius:4px;height:8px;overflow:hidden">';
        const barW = Math.min(100, pct);
        html += '<div style="width:' + barW + '%;height:100%;background:' + balCol + ';border-radius:4px"></div></div>';
        html += '<div style="margin-top:4px;font-size:8px;color:' + balCol + ';font-weight:bold">' + balLabel + ' ' + (balance >= 0 ? '+' : '') + balance.toLocaleString() + ' MW (' + pct + '%)</div></div>';

        // Source table
        html += '<table style="width:100%;border-collapse:collapse;font-size:8px;font-family:\'JetBrains Mono\',monospace">';
        html += '<tr style="color:var(--t3);border-bottom:1px solid var(--bd)"><th style="text-align:left;padding:4px">Source</th><th style="text-align:right;padding:4px">Output</th><th style="text-align:right;padding:4px">Capacity</th><th style="text-align:right;padding:4px">$/MWh</th><th style="text-align:center;padding:4px">Type</th></tr>';
        pz.SOURCES.forEach(s => {
            const output = pz.getOutput(s.id);
            const capFactor = Math.round((output / s.mw) * 100);
            const typeCol = s.type === 'renewable' ? '#4ade80' : s.type === 'baseload' ? '#22d3ee' : '#f59e0b';
            html += '<tr style="border-bottom:1px solid rgba(255,255,255,0.03)">';
            html += '<td style="padding:4px">' + s.emoji + ' ' + s.name + '</td>';
            html += '<td style="text-align:right;padding:4px;color:#fff">' + output.toLocaleString() + ' MW</td>';
            html += '<td style="text-align:right;padding:4px;color:var(--t3)">' + capFactor + '%</td>';
            html += '<td style="text-align:right;padding:4px;color:#fbbf24">$' + s.costMWh + '</td>';
            html += '<td style="text-align:center;padding:4px"><span style="color:' + typeCol + ';font-size:7px;font-weight:bold">' + s.type.toUpperCase() + '</span></td></tr>';
        });
        html += '</table>';
        // Demand breakdown
        let dcDemand = 0;
        if (typeof DC_FACILITIES !== 'undefined') DC_FACILITIES.forEach(dc => { if (dc.power_mw) dcDemand += dc.power_mw; });
        html += '<div style="margin-top:8px;padding:6px;background:var(--cd);border:1px solid var(--bd);border-radius:4px;font-size:7px;color:var(--t3)">';
        html += '<b style="color:var(--t2)">DEMAND BREAKDOWN:</b><br>';
        html += '🖥️ Data Centers & Fabs: ' + dcDemand.toLocaleString() + ' MW<br>';
        html += '🏙️ City Infrastructure: 200 MW (metro, lighting, buildings)</div>';

        p.innerHTML = html;
        p.className = 'ipanel open'; p.style.animation = 'none'; p.offsetHeight; p.style.animation = 'pi .25s ease';
    }
};
