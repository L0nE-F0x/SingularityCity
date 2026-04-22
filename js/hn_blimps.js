/* ════════════════════════════════════════════════════════════════════════════════════════════════════
   HN AI BLIMPS (v1.0.0 — Phase 2, Roadmap Feature #3)
   Drifts up to 5 cartoon blimps across the city sky, each carrying the title of a top AI-tagged
   Hacker News story. Click a blimp → overlay modal with the story's HN thread + article link.

   Data source: /.netlify/functions/hn-ai-stories (server-cached 10 min; refetched client-side
   every 15 min). Gracefully silent on network failure — no blimps spawn, nothing crashes.

   Mounts into G.charLayer with zIndex 800 so blimps render above buildings and NPCs but under
   the HTML UI chrome. Ticked every frame from G.loop() — cheap: 5 sprites, one x translate each.
   ════════════════════════════════════════════════════════════════════════════════════════════════════ */

const HNBlimps = {
    MAX_BLIMPS: 5,
    REFRESH_MS: 15 * 60 * 1000,
    // HN orange + muted AI palette (distinct per blimp so they read as separate stories)
    COLORS: [0xff6600, 0xfbbf24, 0x22d3ee, 0xa78bfa, 0xf472b6],

    _container: null,
    _blimps: [],
    _stories: [],
    _fetched: false,
    _fetchAt: 0,

    init({ charLayer }) {
        if (this._container) return;
        if (!charLayer) return;
        this._container = new PIXI.Container();
        this._container.zIndex = 800;
        this._container.sortableChildren = false;
        charLayer.addChild(this._container);
        this._fetch();
    },

    async _fetch() {
        try {
            const r = await fetch('/.netlify/functions/hn-ai-stories', {
                signal: AbortSignal.timeout(8000)
            });
            if (!r.ok) throw new Error('hn fetch HTTP ' + r.status);
            const d = await r.json();
            this._stories = Array.isArray(d.stories) ? d.stories : [];
            this._fetched = true;
            this._fetchAt = Date.now();
            if (this._container && this._stories.length) this._respawn();
        } catch (_err) {
            // Silent fail — no blimps, no crash.
            this._fetched = true;
            this._fetchAt = Date.now();
        }
    },

    _respawn() {
        for (const b of this._blimps) {
            if (b.container && b.container.parent) b.container.parent.removeChild(b.container);
        }
        this._blimps = [];

        const n = Math.min(this.MAX_BLIMPS, this._stories.length);
        const cityW = (typeof G !== 'undefined' && G.cityW) ? G.cityW : 4000;
        for (let i = 0; i < n; i++) {
            const story = this._stories[i];
            const color = this.COLORS[i % this.COLORS.length];
            const blimp = this._makeBlimp(story, color);
            blimp.container.x = (cityW / n) * i + Math.random() * 200;
            blimp.container.y = 60 + (i % 3) * 50;
            blimp.vx = 0.25 + Math.random() * 0.25;
            this._container.addChild(blimp.container);
            this._blimps.push(blimp);
        }
    },

    _makeBlimp(story, color) {
        const c = new PIXI.Container();

        // Main body — ellipse with a subtle darker stripe
        const body = new PIXI.Graphics();
        body.beginFill(color);
        body.lineStyle(1.5, 0x000000, 0.35);
        body.drawEllipse(0, 0, 70, 22);
        body.endFill();
        body.lineStyle(0);
        body.beginFill(0x000000, 0.14);
        body.drawEllipse(0, 0, 68, 2.5);
        body.endFill();
        c.addChild(body);

        // Tail fin (triangle at rear)
        const tail = new PIXI.Graphics();
        tail.beginFill(color, 0.95);
        tail.lineStyle(1, 0x000000, 0.35);
        tail.drawPolygon([-66, 0, -84, -14, -84, 14]);
        tail.endFill();
        c.addChild(tail);

        // Gondola (passenger cabin underneath)
        const gond = new PIXI.Graphics();
        gond.beginFill(0x2d2d3a);
        gond.lineStyle(1, 0x000000, 0.45);
        gond.drawRoundedRect(-14, 20, 28, 10, 2);
        gond.endFill();
        // Tiny gondola window
        gond.beginFill(0xfbbf24, 0.7);
        gond.drawRect(-10, 23, 5, 4);
        gond.drawRect(5, 23, 5, 4);
        gond.endFill();
        c.addChild(gond);

        // Spinning propeller at nose (front right of blimp)
        const prop = new PIXI.Graphics();
        prop.lineStyle(1.6, 0xcccccc, 0.95);
        prop.moveTo(-7, 0); prop.lineTo(7, 0);
        prop.moveTo(0, -7); prop.lineTo(0, 7);
        prop.lineStyle(0);
        prop.beginFill(0x888888);
        prop.drawCircle(0, 0, 2);
        prop.endFill();
        prop.x = 78;
        prop.y = 0;
        c.addChild(prop);

        // Banner text — truncated title, black outline so it reads over any sky color
        const full = String(story.title || '');
        const short = full.length > 36 ? full.slice(0, 34) + '…' : full;
        const label = new PIXI.Text(short, {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 10,
            fontWeight: '700',
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 3,
            align: 'center'
        });
        label.anchor.set(0.5, 0);
        label.x = 0;
        label.y = 36;
        c.addChild(label);

        // Small HN badge above
        const badge = new PIXI.Text('▲ HN', {
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 7,
            fontWeight: '700',
            fill: 0xffffff,
            stroke: 0x000000,
            strokeThickness: 2
        });
        badge.anchor.set(0.5, 1);
        badge.x = 0;
        badge.y = -24;
        c.addChild(badge);

        // Make the whole blimp clickable with a slightly generous hit box
        c.eventMode = 'static';
        c.cursor = 'pointer';
        c.hitArea = new PIXI.Rectangle(-92, -28, 184, 78);
        c.on('pointerdown', () => this._onClick(story));

        return { container: c, prop, vx: 0.3, propSpin: 0 };
    },

    _onClick(story) {
        if (typeof SND !== 'undefined' && SND.playTone) {
            try { SND.playTone(880, 'sine', 0.06, 0.03, 120); } catch (_e) {}
        }
        if (typeof G !== 'undefined' && G.unlockAchieve) G.unlockAchieve('hn_read');
        this.showModal(story);
    },

    showModal(story) {
        const ov = document.getElementById('hnOv');
        const pan = document.getElementById('hnPan');
        if (!ov || !pan) return;
        const title = this._escape(story.title || 'Untitled');
        const url = story.url && /^https?:\/\//i.test(story.url)
            ? story.url
            : ('https://news.ycombinator.com/item?id=' + story.id);
        const hnThread = 'https://news.ycombinator.com/item?id=' + story.id;
        const safeUrl = this._escape(url);
        const safeThread = this._escape(hnThread);
        const by = this._escape(story.by || 'anon');
        const score = Number(story.score) || 0;
        const comments = Number(story.descendants) || 0;
        const domain = this._domainOf(url);

        pan.innerHTML = `<button class="ipanel-x" onclick="document.getElementById('hnOv').classList.remove('open')">✕</button>
            <div style="font-size:8px;color:#ff6600;letter-spacing:2px;margin-bottom:10px;font-weight:700">▲ HACKER NEWS</div>
            <div style="font-size:14px;font-weight:700;line-height:1.4;margin-bottom:8px">${title}</div>
            <div style="font-size:9px;color:var(--t3);margin-bottom:16px">
                <span style="color:var(--ac)">${score}</span> points
                · by ${by}
                · <span style="color:var(--ac)">${comments}</span> comments
                ${domain ? `· <span>${this._escape(domain)}</span>` : ''}
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap">
                <a href="${safeUrl}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none;flex:1;justify-content:center;padding:10px 14px">🔗 Read article</a>
                <a href="${safeThread}" target="_blank" rel="noopener noreferrer" class="btn" style="text-decoration:none;flex:1;justify-content:center;padding:10px 14px">💬 HN thread</a>
            </div>`;
        ov.classList.add('open');
    },

    _domainOf(url) {
        try { return new URL(url).hostname.replace(/^www\./, ''); }
        catch (_e) { return ''; }
    },

    _escape(s) {
        const div = document.createElement('div');
        div.textContent = String(s == null ? '' : s);
        return div.innerHTML;
    },

    update() {
        // Periodic refetch (covers idle tabs too)
        if (this._fetched && Date.now() - this._fetchAt > this.REFRESH_MS) {
            this._fetchAt = Date.now(); // dedupe
            this._fetch();
        }
        if (!this._container || !this._blimps.length) return;

        const cityW = (typeof G !== 'undefined' && G.cityW) ? G.cityW : 4000;
        for (const b of this._blimps) {
            b.container.x += b.vx;
            if (b.container.x > cityW + 140) b.container.x = -140;
            b.propSpin += 0.28;
            if (b.prop) b.prop.rotation = b.propSpin;
        }
    }
};
