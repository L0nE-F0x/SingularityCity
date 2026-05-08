/* ════════════════════════════════════════════════════════════════════════════════
   DAILY BRIEFING — auto-generated 30-second video summary of yesterday's
   news-engine reactions, ready to drag into an X post.

   Flow:
     1. On boot, we check the persisted news event log (sc_news_events_v1)
        for ≥3 events from yesterday's UTC date. If found AND we haven't
        already generated/skipped a briefing for today, the prompt toast
        auto-shows: "📽 Daily Briefing for [date] is ready" → [Generate]
        [Skip] [×]
     2. Generate enters briefing mode. The viewport plays a scripted reel
        recorded by MediaRecorder pulled from G.app.view.captureStream():
          • 3s intro overlay (date banner)
          • 6 events × 4s reel — camera lerps to each lab's HQ, the
            reaction re-fires (NewsReactivity.fire() bypassing cooldown),
            we hold for the visible burst
          • 3s outro overlay (@SingularityCity branding)
     3. On stop, the recorded WebM is downloaded as
        singularity-city-briefing-YYYY-MM-DD.webm and a share toast appears
        with a pre-written X post body + drag-drop instruction.
     4. A floating ✕ Stop button is visible the whole time so the user can
        abort. Stopping mid-briefing discards the recording.

   For testing without real news data: DailyBriefing._test() seeds 6 fake
   events for "yesterday" and immediately enters briefing mode.
   ════════════════════════════════════════════════════════════════════════════════ */

window.DailyBriefing = (function() {

    const STATE = {
        // Prompt
        promptEl: null,
        // Briefing
        active: false,
        date: null,           // "YYYY-MM-DD" — the day this briefing summarizes
        events: [],
        phase: 'idle',        // 'idle' | 'intro' | 'reel' | 'outro' | 'done'
        phaseStartMs: 0,
        eventIdx: -1,
        eventStartMs: 0,
        eventReactionFired: false,
        // PIXI overlay
        overlay: null,
        overlayBg: null,
        overlayTitle: null,
        overlaySub: null,
        // Recording
        recorder: null,
        chunks: [],
        // UI
        stopBtnEl: null,
        // Persistence
        lastChecked: 0
    };

    const LS_BRIEF_KEY = 'sc_briefing_v1';     // { generatedDate, skippedDate }
    const LS_EVENTS_KEY = 'sc_news_events_v1'; // shared with news_reactivity.js
    const FPS = 30;

    // Phase timings in ms — total = 3000 + 6*4000 + 3000 = 30,000ms (30s)
    const TIMING = {
        intro:    3000,
        perEvent: 4000,
        eventCount: 6,
        outro:    3000
    };

    // ─── DATE UTILS ──────────────────────────────────────────────────────────
    function utcDateString(d) {
        d = d || new Date();
        return `${d.getUTCFullYear()}-${String(d.getUTCMonth()+1).padStart(2,'0')}-${String(d.getUTCDate()).padStart(2,'0')}`;
    }
    function yesterdayUtcDateString() {
        return utcDateString(new Date(Date.now() - 86400000));
    }
    function prettyDate(s) {
        // "2026-05-08" → "May 8, 2026"
        try {
            const [y, m, d] = s.split('-').map(Number);
            const dt = new Date(Date.UTC(y, m - 1, d));
            return dt.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
        } catch { return s; }
    }

    // ─── PERSISTENCE ─────────────────────────────────────────────────────────
    function loadBriefState() {
        try { return JSON.parse(localStorage.getItem(LS_BRIEF_KEY) || '{}') || {}; }
        catch { return {}; }
    }
    function saveBriefState(p) {
        try {
            const cur = loadBriefState();
            const next = Object.assign({}, cur, p);
            localStorage.setItem(LS_BRIEF_KEY, JSON.stringify(next));
        } catch { /* ignore */ }
    }
    function loadNewsEvents() {
        try { return JSON.parse(localStorage.getItem(LS_EVENTS_KEY) || '[]') || []; }
        catch { return []; }
    }

    // ─── EVENT SELECTION ─────────────────────────────────────────────────────
    function pickEventsForDate(dateStr) {
        const all = loadNewsEvents();
        const filtered = all.filter(e => e && e.date === dateStr && e.lab);
        // Up to 6 events. Prefer one per lab for variety, then fill chronologically.
        const seenLabs = new Set();
        const primary = [];
        for (const e of filtered) {
            if (seenLabs.has(e.lab)) continue;
            seenLabs.add(e.lab);
            primary.push(e);
            if (primary.length >= TIMING.eventCount) break;
        }
        if (primary.length < TIMING.eventCount) {
            // Top up with remaining events not yet selected
            for (const e of filtered) {
                if (primary.includes(e)) continue;
                primary.push(e);
                if (primary.length >= TIMING.eventCount) break;
            }
        }
        return primary.slice(0, TIMING.eventCount);
    }

    // ─── PROMPT TOAST ────────────────────────────────────────────────────────
    function showPrompt(events, dateStr) {
        if (STATE.promptEl) return;
        const host = document.createElement('div');
        host.id = 'sc-briefing-prompt';
        host.innerHTML = `
            <div class="sc-bp-head">
                <span class="sc-bp-emoji">📽</span>
                <span class="sc-bp-title">Daily Briefing</span>
                <button class="sc-bp-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-bp-body">${escapeHtml(prettyDate(dateStr))} — ${events.length} event${events.length === 1 ? '' : 's'} from yesterday in Singularity City. Generate a 30-second video summary?</div>
            <div class="sc-bp-actions">
                <button class="sc-bp-btn sc-bp-go">▶ Generate</button>
                <button class="sc-bp-btn sc-bp-skip">Skip Today</button>
            </div>
        `;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('sc-bp-in'));
        STATE.promptEl = host;

        host.querySelector('.sc-bp-close').onclick = dismissPrompt;
        host.querySelector('.sc-bp-skip').onclick = () => {
            saveBriefState({ skippedDate: utcDateString() });
            dismissPrompt();
        };
        host.querySelector('.sc-bp-go').onclick = () => {
            dismissPrompt();
            startBriefing(events, dateStr);
        };
    }

    function dismissPrompt() {
        if (!STATE.promptEl) return;
        STATE.promptEl.classList.remove('sc-bp-in');
        const el = STATE.promptEl;
        STATE.promptEl = null;
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }

    // ─── STOP BUTTON ─────────────────────────────────────────────────────────
    function showStopButton() {
        if (STATE.stopBtnEl) return;
        const btn = document.createElement('button');
        btn.id = 'sc-briefing-stop';
        btn.innerHTML = '✕ Stop Briefing';
        btn.onclick = () => abortBriefing();
        document.body.appendChild(btn);
        requestAnimationFrame(() => btn.classList.add('sc-bs-in'));
        STATE.stopBtnEl = btn;
    }
    function hideStopButton() {
        if (!STATE.stopBtnEl) return;
        STATE.stopBtnEl.classList.remove('sc-bs-in');
        const el = STATE.stopBtnEl;
        STATE.stopBtnEl = null;
        setTimeout(() => { if (el.parentNode) el.parentNode.removeChild(el); }, 280);
    }

    // ─── PIXI OVERLAY (intro/outro banners drawn into the canvas so
    //     MediaRecorder captures them) ───────────────────────────────────────
    function buildOverlay() {
        if (!G.app || !G.app.stage) return null;
        const cont = new PIXI.Container();
        cont.zIndex = 99999;

        const bg = new PIXI.Graphics();
        cont.addChild(bg);

        const titleStyle = new PIXI.TextStyle({
            fontFamily: 'Press Start 2P, Silkscreen, monospace',
            fontSize: 32,
            fill: '#fbbf24',
            stroke: '#000000',
            strokeThickness: 4,
            dropShadow: true,
            dropShadowColor: '#000',
            dropShadowDistance: 0,
            dropShadowBlur: 12,
            align: 'center'
        });
        const subStyle = new PIXI.TextStyle({
            fontFamily: 'JetBrains Mono, monospace',
            fontSize: 16,
            fill: '#e8e8f0',
            align: 'center'
        });
        const title = new PIXI.Text('', titleStyle);
        title.anchor.set(0.5);
        cont.addChild(title);

        const sub = new PIXI.Text('', subStyle);
        sub.anchor.set(0.5);
        cont.addChild(sub);

        G.app.stage.addChild(cont);

        STATE.overlay = cont;
        STATE.overlayBg = bg;
        STATE.overlayTitle = title;
        STATE.overlaySub = sub;
        return cont;
    }

    function destroyOverlay() {
        if (!STATE.overlay) return;
        if (STATE.overlay.parent) STATE.overlay.parent.removeChild(STATE.overlay);
        STATE.overlay.destroy({ children: true });
        STATE.overlay = null;
        STATE.overlayBg = null;
        STATE.overlayTitle = null;
        STATE.overlaySub = null;
    }

    function drawOverlay({ alpha, title, subtitle, bandY }) {
        if (!STATE.overlay) return;
        const w = G.vpW || G.app.renderer.width;
        const h = G.vpH || G.app.renderer.height;
        STATE.overlay.x = 0;
        STATE.overlay.y = 0;

        // Lower-third dark band with cyan border. Drawn in screen space.
        const bandH = 110;
        const cy = bandY != null ? bandY : (h * 0.5);
        STATE.overlayBg.clear();
        STATE.overlayBg.beginFill(0x040410, 0.78 * alpha);
        STATE.overlayBg.drawRect(0, cy - bandH / 2, w, bandH);
        STATE.overlayBg.endFill();
        STATE.overlayBg.beginFill(0xfbbf24, 0.85 * alpha);
        STATE.overlayBg.drawRect(0, cy - bandH / 2, w, 2);
        STATE.overlayBg.drawRect(0, cy + bandH / 2 - 2, w, 2);
        STATE.overlayBg.endFill();

        STATE.overlayTitle.text = title || '';
        STATE.overlayTitle.x = w / 2;
        STATE.overlayTitle.y = cy - 16;
        STATE.overlayTitle.alpha = alpha;

        STATE.overlaySub.text = subtitle || '';
        STATE.overlaySub.x = w / 2;
        STATE.overlaySub.y = cy + 22;
        STATE.overlaySub.alpha = alpha;
    }

    function clearOverlay() {
        if (!STATE.overlay) return;
        STATE.overlayBg.clear();
        STATE.overlayTitle.text = '';
        STATE.overlaySub.text = '';
    }

    // ─── CAMERA SCRIPTING ────────────────────────────────────────────────────
    function camFlyToLab(labId) {
        if (typeof G === 'undefined' || !G.bldsByLab) return;
        const blds = G.bldsByLab[labId] || [];
        const hq = blds.find(b => !b.id.startsWith('house_'));
        if (!hq) return;
        const cx = hq.x + hq.w / 2;
        // Disable any active tracking so we own the camera target
        G.tracking = null;
        if (typeof Camera !== 'undefined') {
            // Match the city's natural Y framing: targetY = 0 keeps screen_y=0
            // mapped to world_y=0 (top of the sky). Anything more negative
            // looks above the sky's bounded geometry → black void.
            // Zoom matches the player's default city view (~0.85) so the shot
            // feels familiar, not zoomed-in surveillance-cam.
            const targetZoom = 0.85;
            Camera.targetX = -(cx) + (G.vpW / 2) / targetZoom;
            Camera.targetY = 0;
            Camera.targetZoom = targetZoom;
        }
    }

    function camWideAerial() {
        if (typeof Camera === 'undefined') return;
        G.tracking = null;
        const cw = G.cityW || 4000;
        // Wider shot for the intro/outro. Same Y=0 rule — never frame above
        // the sky's draw bounds.
        const targetZoom = 0.6;
        Camera.targetX = -(cw / 2) + (G.vpW / 2) / targetZoom;
        Camera.targetY = 0;
        Camera.targetZoom = targetZoom;
    }

    // ─── RECORDING ───────────────────────────────────────────────────────────
    function pickBestMimeType() {
        const candidates = [
            'video/webm;codecs=vp9',
            'video/webm;codecs=vp8',
            'video/webm'
        ];
        for (const m of candidates) {
            if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(m)) return m;
        }
        return 'video/webm';
    }

    function startRecording() {
        if (!G.app || !G.app.view) return false;
        let stream;
        try { stream = G.app.view.captureStream(FPS); }
        catch (_e) { return false; }
        if (!stream) return false;

        STATE.chunks = [];
        const mimeType = pickBestMimeType();
        let rec;
        try {
            // Pixel art at native canvas resolution looks crisp at high bitrate;
            // 8 Mbps is the sweet spot for hard-edge pixel content without
            // breaking X's upload limit (X allows up to 512 MB / 140s).
            rec = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
        } catch (_e) {
            // Fallback without explicit mime
            try { rec = new MediaRecorder(stream); } catch { return false; }
        }
        rec.ondataavailable = (e) => { if (e.data && e.data.size > 0) STATE.chunks.push(e.data); };
        rec.onstop = () => onRecordingStop(mimeType);
        try { rec.start(250); } catch (_e) { return false; }
        STATE.recorder = rec;
        return true;
    }

    function stopRecording() {
        if (STATE.recorder && STATE.recorder.state !== 'inactive') {
            try { STATE.recorder.stop(); } catch (_e) { /* ignore */ }
        }
    }

    function onRecordingStop(mimeType) {
        if (STATE.phase === 'cancelled') {
            STATE.recorder = null;
            STATE.chunks = [];
            return;
        }
        if (!STATE.chunks.length) {
            STATE.recorder = null;
            return;
        }
        const blob = new Blob(STATE.chunks, { type: mimeType.split(';')[0] });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `singularity-city-briefing-${STATE.date}.webm`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60000);

        STATE.recorder = null;
        STATE.chunks = [];

        showShareToast(STATE.date, STATE.events);
    }

    // ─── SHARE TOAST (post-briefing) ─────────────────────────────────────────
    function showShareToast(dateStr, events) {
        const summary = events.slice(0, 4).map(e => `${e.emoji || '•'} ${labShortName(e.lab)}`).join('  ');
        const body = `Yesterday in Singularity City — ${prettyDate(dateStr)}.\n${summary}\n\nWatch: https://singularitycity.net`;

        const host = document.createElement('div');
        host.id = 'sc-briefing-share';
        host.innerHTML = `
            <div class="sc-bs-head">
                <span class="sc-bs-emoji">📽</span>
                <span class="sc-bs-title">Briefing Saved</span>
                <button class="sc-bs-close" aria-label="Dismiss">×</button>
            </div>
            <div class="sc-bs-body">Your video downloaded — drag it onto your X post.</div>
            <div class="sc-bs-actions">
                <button class="sc-bs-btn sc-bs-post">𝕏 Post Draft</button>
                <button class="sc-bs-btn sc-bs-copy">📋 Copy Text</button>
            </div>
        `;
        document.body.appendChild(host);
        requestAnimationFrame(() => host.classList.add('sc-bs-show-in'));

        host.querySelector('.sc-bs-close').onclick = () => fadeOut(host);
        host.querySelector('.sc-bs-post').onclick = () => {
            const intent = 'https://x.com/intent/post?text=' + encodeURIComponent(body);
            window.open(intent, '_blank', 'noopener');
        };
        host.querySelector('.sc-bs-copy').onclick = async () => {
            try { await navigator.clipboard.writeText(body); }
            catch { /* ignore */ }
            const b = host.querySelector('.sc-bs-copy');
            b.textContent = '✓ Copied';
            setTimeout(() => { b.textContent = '📋 Copy Text'; }, 1500);
        };

        // Auto-fade after 60s
        setTimeout(() => fadeOut(host), 60000);
    }

    function fadeOut(host) {
        if (!host || !host.parentNode) return;
        host.classList.remove('sc-bs-show-in');
        setTimeout(() => { if (host.parentNode) host.parentNode.removeChild(host); }, 280);
    }

    function labShortName(labId) {
        if (typeof LABS !== 'undefined' && LABS[labId] && LABS[labId].name) return LABS[labId].name;
        return labId || 'Lab';
    }

    // ─── BRIEFING FLOW ───────────────────────────────────────────────────────
    function startBriefing(events, dateStr) {
        if (STATE.active) return;
        if (!events || !events.length) return;
        if (typeof G === 'undefined' || !G.app) return;

        STATE.active = true;
        STATE.events = events;
        STATE.date = dateStr;
        STATE.phase = 'intro';
        STATE.phaseStartMs = Date.now();
        STATE.eventIdx = -1;
        STATE.eventStartMs = 0;
        STATE.eventReactionFired = false;

        // Disable AutoTour and other camera hijackers for the duration
        try { if (typeof AutoTour !== 'undefined' && AutoTour.stop) AutoTour.stop(); } catch (_e) { /* ignore */ }
        try {
            if (typeof AutoTour !== 'undefined') {
                AutoTour._briefingDisabled = true;
                AutoTour._disabled = true;
            }
        } catch (_e) { /* ignore */ }

        // Tell NewsReactivity to not flood share toasts during replay
        try { if (typeof NewsReactivity !== 'undefined' && NewsReactivity.setReplayMode) NewsReactivity.setReplayMode(true); } catch (_e) { /* ignore */ }

        buildOverlay();
        camWideAerial();
        showStopButton();

        // Mark today as generated regardless of recording success — so we
        // don't keep prompting on subsequent reloads today.
        saveBriefState({ generatedDate: utcDateString() });

        // Start MediaRecorder a tick later so the overlay has rendered at
        // least one frame before the first capture.
        setTimeout(() => {
            const ok = startRecording();
            if (!ok) {
                console.warn('[DailyBriefing] Recording unavailable — running without capture');
            }
        }, 60);
    }

    function abortBriefing() {
        STATE.phase = 'cancelled';
        finishBriefing(true);
    }

    function finishBriefing(cancelled) {
        // Stop the recording (download triggered in onstop unless cancelled)
        stopRecording();

        STATE.active = false;
        STATE.events = [];
        STATE.eventIdx = -1;
        STATE.phase = cancelled ? 'cancelled' : 'done';
        clearOverlay();
        destroyOverlay();
        hideStopButton();

        try { if (typeof NewsReactivity !== 'undefined' && NewsReactivity.setReplayMode) NewsReactivity.setReplayMode(false); } catch (_e) { /* ignore */ }
        try {
            if (typeof AutoTour !== 'undefined') {
                AutoTour._briefingDisabled = false;
                AutoTour._disabled = false;
            }
        } catch (_e) { /* ignore */ }
    }

    // ─── UPDATE TICK ─────────────────────────────────────────────────────────
    function update() {
        // First-load auto-prompt detection (cheap, run once per ~5s)
        const now = Date.now();
        if (!STATE.active && (now - STATE.lastChecked) > 5000) {
            STATE.lastChecked = now;
            maybeShowPrompt();
        }

        if (!STATE.active) return;
        const elapsed = now - STATE.phaseStartMs;

        switch (STATE.phase) {
            case 'intro': {
                const t = Math.min(1, elapsed / TIMING.intro);
                const fade = t < 0.85 ? Math.min(1, t / 0.25) : Math.max(0, (1 - (t - 0.85) / 0.15));
                drawOverlay({
                    alpha: fade,
                    title: 'DAILY BRIEFING',
                    subtitle: prettyDate(STATE.date) + ' · @SingularityCity'
                });
                if (elapsed >= TIMING.intro) {
                    STATE.phase = 'reel';
                    STATE.phaseStartMs = now;
                    STATE.eventIdx = -1;
                    advanceEvent(now);
                }
                break;
            }
            case 'reel': {
                if (STATE.eventIdx < 0 || STATE.eventIdx >= STATE.events.length) {
                    STATE.phase = 'outro';
                    STATE.phaseStartMs = now;
                    clearOverlay();
                    camWideAerial();
                    break;
                }
                const ev = STATE.events[STATE.eventIdx];
                const evElapsed = now - STATE.eventStartMs;

                // Lower-third headline band for the current event
                drawOverlay({
                    alpha: 0.92,
                    title: (ev.emoji || '🚨') + ' ' + (ev.archetype || 'News'),
                    subtitle: trimTitle(ev.title || ''),
                    bandY: G.vpH - 80
                });

                // Fire the actual reaction at +1.2s so the camera has settled
                if (!STATE.eventReactionFired && evElapsed >= 1200) {
                    STATE.eventReactionFired = true;
                    try {
                        if (typeof NewsReactivity !== 'undefined' && NewsReactivity.fire) NewsReactivity.fire(ev);
                    } catch (_e) { /* ignore */ }
                }

                if (evElapsed >= TIMING.perEvent) advanceEvent(now);
                break;
            }
            case 'outro': {
                const t = Math.min(1, elapsed / TIMING.outro);
                const fade = t < 0.85 ? Math.min(1, t / 0.25) : Math.max(0, (1 - (t - 0.85) / 0.15));
                drawOverlay({
                    alpha: fade,
                    title: 'SINGULARITY CITY',
                    subtitle: 'singularitycity.net · @SingularityCity'
                });
                if (elapsed >= TIMING.outro) finishBriefing(false);
                break;
            }
            default: break;
        }
    }

    function advanceEvent(now) {
        STATE.eventIdx++;
        if (STATE.eventIdx >= STATE.events.length) {
            STATE.phase = 'outro';
            STATE.phaseStartMs = now;
            clearOverlay();
            camWideAerial();
            return;
        }
        STATE.eventStartMs = now;
        STATE.eventReactionFired = false;
        const ev = STATE.events[STATE.eventIdx];
        camFlyToLab(ev.lab);
    }

    function trimTitle(s) {
        if (!s) return '';
        return s.length > 70 ? s.slice(0, 67) + '...' : s;
    }

    // ─── AUTO-PROMPT DETECTION ───────────────────────────────────────────────
    function maybeShowPrompt() {
        if (typeof G === 'undefined' || !G.app) return;   // wait for boot
        if (STATE.promptEl) return;                        // already shown
        const today = utcDateString();
        const yest = yesterdayUtcDateString();
        const brief = loadBriefState();
        if (brief.generatedDate === today) return;         // already generated today
        if (brief.skippedDate === today) return;           // user said skip today
        const events = pickEventsForDate(yest);
        if (events.length < 3) return;                     // not enough drama
        showPrompt(events, yest);
    }

    // ─── PUBLIC TEST HOOK ────────────────────────────────────────────────────
    function _test() {
        // Synthesize 6 fake events for "yesterday" and start the briefing now.
        const yest = yesterdayUtcDateString();
        const labs = (typeof LABS !== 'undefined') ? Object.keys(LABS).filter(k => k !== 'other').slice(0, 6) : ['openai','anthropic','google','xai','meta','deepseek'];
        if (!labs.length) labs.push('openai');
        const types = ['celebrate','crisis','emergency','regulatory','celebrate','crisis'];
        const titles = [
            'Lab unveils next-gen reasoning model',
            'Lab faces controversy over training data',
            'Board fires CEO in late-night meeting',
            'EU regulators open hearing on lab',
            'Lab partners with Microsoft for $10B deal',
            'Outage hits flagship API for 4 hours'
        ];
        const archetypes = { celebrate: 'Launch Party', crisis: 'Crisis Flicker', emergency: 'Emergency Huddle', regulatory: 'Court Convene' };
        const emojis     = { celebrate: '🎉',           crisis: '😰',             emergency: '🚁',                 regulatory: '⚖️'           };
        const fake = [];
        for (let i = 0; i < 6; i++) {
            const t = types[i];
            fake.push({
                date: yest,
                ts: yest + 'T0' + (8 + i) + ':00:00Z',
                type: t,
                archetype: archetypes[t],
                emoji: emojis[t],
                lab: labs[i % labs.length],
                title: titles[i] + ' (test)',
                url: 'https://news.ycombinator.com'
            });
        }
        startBriefing(fake, yest);
    }

    function escapeHtml(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }

    function init() { /* nothing — update() handles auto-prompt */ }

    return { init, update, _test, abort: abortBriefing, _state: STATE };
})();
