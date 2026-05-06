/* ════════════════════════════════════════════════════════════════════════════════
   FOUNDER TRACKER — live camera-lock view of a single founder NPC.

   Activates when the page is loaded as `/founder/:slug` (the Netlify function
   injects window.SC_FOUNDER_SLUG/_NAME/_LAB) or when `?founder=<slug>` is in the
   query string. The module:

     1. Resolves the slug to a founder in REAL_FOUNDERS
     2. Sets G.tracking = { type: 'ceo', lab } so the existing camera tracking
        in camera.js follows the founder NPC across HQ / home / helicopter / etc.
     3. Renders a sticky top-bar chrome with the founder's portrait, current
        location, activity, city time, and Tweet/Share buttons
     4. Re-derives the location label every ~30 frames

   Shape of data used:
     REAL_FOUNDERS  — array of { lab, name, role, fact, color }
     LABS[labId]    — { name, color, icon, ticker, region }
     G.ceoRefs[lab] — { f, bld, _heliTrip, _inHeli, logicalX, ... }
     G.bldById[id]  — { id, name, lab, x, w, emoji, ... }
     Entities.heliRefs[lab].state  — 'grounded'|'flying_to'|'flying_home'|...
   ════════════════════════════════════════════════════════════════════════════════ */

window.FounderTracker = (function() {

    const STATE = {
        active: false,
        slug: null,
        founder: null,    // resolved REAL_FOUNDERS entry
        lab: null,        // resolved LABS entry
        bar: null,        // top bar element
        whereEl: null,
        activityEl: null,
        timeEl: null,
        portraitEl: null,
        lastLabel: '',
        lastTickUpdate: -1,
        bootAttempts: 0
    };

    function slugify(name) {
        return String(name || '')
            .toLowerCase()
            .normalize('NFKD').replace(/[̀-ͯ]/g, '')
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-|-$/g, '');
    }

    function getRequestedSlug() {
        if (window.SC_FOUNDER_SLUG) return String(window.SC_FOUNDER_SLUG).toLowerCase();
        try {
            const p = new URLSearchParams(window.location.search);
            const q = p.get('founder');
            if (q) return q.toLowerCase();
            // /founder/:slug path-based fallback (in case the redirect failed)
            const m = window.location.pathname.match(/^\/founder\/([^/]+)/i);
            if (m) return decodeURIComponent(m[1]).toLowerCase();
        } catch (e) { /* ignore */ }
        return null;
    }

    function resolveFounder(slug) {
        if (!slug) return null;
        if (typeof REAL_FOUNDERS === 'undefined' || !REAL_FOUNDERS.length) return null;
        return REAL_FOUNDERS.find(f => slugify(f.name) === slug) || null;
    }

    /* ──────────────────────────────────────────────────────────────────────────
       LOCATION LABEL — derive a human-readable "where + activity" pair from
       the founder's NPC state. Called every ~30 frames from updateBar().
       ────────────────────────────────────────────────────────────────────────── */
    function deriveLocation() {
        const founder = STATE.founder;
        if (!founder) return null;

        const ceo = (typeof G !== 'undefined' && G.ceoRefs) ? G.ceoRefs[founder.lab] : null;
        const heli = (typeof Entities !== 'undefined' && Entities.heliRefs) ? Entities.heliRefs[founder.lab] : null;
        const labName = (typeof LABS !== 'undefined' && LABS[founder.lab] && LABS[founder.lab].name) || founder.lab;

        // Time-of-day label (city time, not user wall clock)
        let timeLabel = '';
        if (typeof G !== 'undefined' && typeof G.getDayPhase === 'function') {
            const dp = G.getDayPhase();
            const totalMin = Math.round(dp * 24 * 60);
            const hr = Math.floor(totalMin / 60) % 24;
            const mn = totalMin % 60;
            const h12 = hr % 12 === 0 ? 12 : hr % 12;
            const ampm = hr < 12 ? 'AM' : 'PM';
            timeLabel = `${h12}:${String(mn).padStart(2,'0')} ${ampm}`;
        }

        if (!ceo) {
            return {
                emoji: '⏳',
                where: 'Loading citizen...',
                activity: 'Waiting for the simulation to spawn this founder',
                timeLabel
            };
        }

        // ─── Helicopter states (highest priority — beats building checks) ───
        const heliFlying = heli && heli.cont && heli.cont.visible &&
            (heli.state === 'flying_to' || heli.state === 'flying_home' ||
             heli.state === 'scenic_flight' || heli.state === 'flying_to_hq');

        if (heliFlying) {
            const map = {
                'flying_to':       { where: 'In the helicopter',  activity: 'En route to Silicon Woods' },
                'flying_home':     { where: 'In the helicopter',  activity: 'Flying home' },
                'scenic_flight':   { where: 'In the helicopter',  activity: 'On a scenic flight over the city' },
                'flying_to_hq':    { where: 'In the helicopter',  activity: 'Returning to HQ' }
            };
            const d = map[heli.state] || { where: 'In the helicopter', activity: 'Mid-flight' };
            return { emoji: '🚁', where: d.where, activity: d.activity, timeLabel };
        }

        if (ceo._inHeli) {
            return { emoji: '🚁', where: 'In the helicopter', activity: 'Flying somewhere over the city', timeLabel };
        }

        // ─── Inside a building ───
        if (ceo.bld && typeof G !== 'undefined' && G.bldById) {
            const bld = G.bldById[ceo.bld];
            if (bld) {
                // Special-case the founder's home estate
                if (ceo.bld === 'house_' + founder.lab) {
                    const dp = (typeof G.getDayPhase === 'function') ? G.getDayPhase() : 0.5;
                    const sleeping = dp > 0.85 || dp < 0.25;
                    return {
                        emoji: '🏡',
                        where: `At their estate`,
                        activity: sleeping ? 'Sleeping' : 'Relaxing at home',
                        timeLabel
                    };
                }
                if (ceo.bld === 'forest_1') {
                    return { emoji: '🌲', where: 'At Silicon Woods', activity: 'Out at the CEO retreat', timeLabel };
                }
                // Generic: at a named building
                const name = bld.name || (labName + ' HQ');
                const isOwnHq = bld.lab === founder.lab;
                return {
                    emoji: bld.emoji || '🏢',
                    where: `At ${name}`,
                    activity: isOwnHq ? 'In the office' : 'On a visit',
                    timeLabel
                };
            }
        }

        // ─── In transit (car or walking) ───
        // ceo.dir: 1 = right, -1 = left
        const dir = ceo.dir > 0 ? 'eastbound' : 'westbound';
        const carVisible = ceo.carCont && ceo.carCont.visible;
        return {
            emoji: carVisible ? '🚗' : '🚶',
            where: 'Out on the streets',
            activity: carVisible ? `Driving ${dir} through the city` : `Walking ${dir}`,
            timeLabel
        };
    }

    /* ──────────────────────────────────────────────────────────────────────────
       BAR DOM — built once, then text-updated each frame. Avoids reflow churn.
       ────────────────────────────────────────────────────────────────────────── */
    function buildBar() {
        const founder = STATE.founder;
        const lab = STATE.lab || { name: founder.lab, color: '#22d3ee', icon: '🏢' };
        const labColor = lab.color || '#22d3ee';

        const bar = document.createElement('div');
        bar.id = 'sc-founder-bar';
        bar.innerHTML = `
            <div class="sc-fb-portrait" style="background:${labColor}22;border-color:${labColor};color:${labColor};">
                ${lab.icon || '🏢'}
            </div>
            <div class="sc-fb-meta">
                <div class="sc-fb-headline">
                    <span class="sc-fb-name">${escape(founder.name)}</span>
                    <span class="sc-fb-role" style="color:${labColor};">${escape(founder.role || 'Founder')} · ${escape(lab.name || founder.lab)}</span>
                </div>
                <div class="sc-fb-status">
                    <span class="sc-fb-where" id="sc-fb-where">Locating...</span>
                    <span class="sc-fb-dot">·</span>
                    <span class="sc-fb-activity" id="sc-fb-activity">—</span>
                    <span class="sc-fb-dot">·</span>
                    <span class="sc-fb-time" id="sc-fb-time">--:-- --</span>
                </div>
            </div>
            <div class="sc-fb-actions">
                <button id="sc-fb-snap" class="sc-fb-btn sc-fb-btn-primary" title="Snap a screenshot and post to X">
                    <span class="sc-fb-btn-icon">📸</span><span class="sc-fb-btn-label">Snap & Tweet</span>
                </button>
                <button id="sc-fb-copy" class="sc-fb-btn" title="Copy this tracker link">
                    <span class="sc-fb-btn-icon">🔗</span><span class="sc-fb-btn-label">Copy Link</span>
                </button>
                <a href="/founders" class="sc-fb-btn" title="Browse all founder trackers">
                    <span class="sc-fb-btn-icon">👥</span><span class="sc-fb-btn-label">All Founders</span>
                </a>
                <a href="/" class="sc-fb-btn sc-fb-btn-ghost" title="Open the full city">
                    <span class="sc-fb-btn-icon">🏙️</span><span class="sc-fb-btn-label">Full City</span>
                </a>
            </div>
            <button id="sc-fb-close" class="sc-fb-close" title="Stop tracking">×</button>
        `;
        document.body.appendChild(bar);

        STATE.bar = bar;
        STATE.whereEl    = bar.querySelector('#sc-fb-where');
        STATE.activityEl = bar.querySelector('#sc-fb-activity');
        STATE.timeEl     = bar.querySelector('#sc-fb-time');
        STATE.portraitEl = bar.querySelector('.sc-fb-portrait');

        bar.querySelector('#sc-fb-snap').addEventListener('click', onSnap);
        bar.querySelector('#sc-fb-copy').addEventListener('click', onCopy);
        bar.querySelector('#sc-fb-close').addEventListener('click', stop);

        // Phase the bar in
        requestAnimationFrame(() => {
            bar.classList.add('sc-fb-in');
            syncToolbarOffset();
        });
        window.addEventListener('resize', syncToolbarOffset, { passive: true });
    }

    // Push the in-game .top toolbar down by the actual bar height so the bar
    // never overlaps zone tabs even when it wraps to multiple lines on narrow
    // viewports. Sets a CSS var consumed by the .sc-founder-mode rule.
    function syncToolbarOffset() {
        if (!STATE.bar) return;
        const h = STATE.bar.offsetHeight || 64;
        document.documentElement.style.setProperty('--sc-fb-h', h + 'px');
    }

    function escape(s) {
        return String(s == null ? '' : s)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function updateBar() {
        if (!STATE.active || !STATE.bar) return;
        const loc = deriveLocation();
        if (!loc) return;

        // Avoid touching DOM unless changed
        if (STATE.whereEl    && STATE.whereEl.textContent    !== loc.where)    STATE.whereEl.textContent    = loc.where;
        if (STATE.activityEl && STATE.activityEl.textContent !== loc.activity) STATE.activityEl.textContent = loc.activity;
        if (STATE.timeEl     && loc.timeLabel && STATE.timeEl.textContent !== loc.timeLabel) STATE.timeEl.textContent = loc.timeLabel;

        // Portrait emoji can change between heli/building/etc
        if (STATE.portraitEl) {
            const want = loc.emoji + ' ' + ((STATE.lab && STATE.lab.icon) || '🏢');
            if (STATE.lastLabel !== want) {
                STATE.portraitEl.firstChild && (STATE.portraitEl.textContent = (loc.emoji || '🏢'));
                STATE.lastLabel = want;
            }
        }
    }

    /* ──────────────────────────────────────────────────────────────────────────
       SHARE — snap a viewport screenshot and open Twitter compose intent
       prefilled with the founder's tracker URL.
       ────────────────────────────────────────────────────────────────────────── */
    function onCopy() {
        const slug = STATE.slug;
        const url = location.origin + '/founder/' + slug;
        const text = `Tracking ${STATE.founder.name} live in Singularity City → ${url}`;
        try {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(url);
                flash('Link copied');
                return;
            }
        } catch (e) { /* fall through */ }
        try {
            const ta = document.createElement('textarea');
            ta.value = url; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            ta.remove();
            flash('Link copied');
        } catch (e) {
            flash('Could not copy', true);
        }
        // Mark unused but keep the variable so future edits can show a richer copy
        void text;
    }

    function onSnap() {
        const slug = STATE.slug;
        const founder = STATE.founder;
        const url = location.origin + '/founder/' + slug;
        const loc = deriveLocation() || { where: 'in the city', activity: '' };
        const tweet = `${founder.name} is currently ${loc.where.toLowerCase()} — ${loc.activity.toLowerCase()}.\n\nLive tracker: ${url}`;
        const intent = 'https://twitter.com/intent/tweet?text=' + encodeURIComponent(tweet);

        // Try to capture the canvas as an image first; offer a download since
        // X's web intent does not accept image uploads via URL.
        try {
            if (typeof G !== 'undefined' && G.app && G.app.renderer && G.app.renderer.extract) {
                const canvas = G.app.renderer.extract.canvas(G.app.stage);
                canvas.toBlob(blob => {
                    if (blob) {
                        const dlUrl = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = dlUrl;
                        a.download = `singularity-city-${slug}-${Date.now()}.png`;
                        document.body.appendChild(a);
                        a.click();
                        a.remove();
                        setTimeout(() => URL.revokeObjectURL(dlUrl), 60000);
                        flash('Screenshot saved — opening tweet...');
                    } else {
                        flash('Opening tweet...');
                    }
                    setTimeout(() => window.open(intent, '_blank', 'noopener'), 250);
                }, 'image/png');
                return;
            }
        } catch (e) {
            console.warn('[FounderTracker] Snap failed, falling back to text-only:', e);
        }
        // Fallback: just open the tweet intent
        window.open(intent, '_blank', 'noopener');
        flash('Opening tweet...');
    }

    function flash(msg, isErr) {
        let el = document.getElementById('sc-fb-toast');
        if (!el) {
            el = document.createElement('div');
            el.id = 'sc-fb-toast';
            document.body.appendChild(el);
        }
        el.textContent = msg;
        el.className = isErr ? 'sc-fb-toast-err' : '';
        el.classList.add('sc-fb-show');
        clearTimeout(el._timer);
        el._timer = setTimeout(() => el.classList.remove('sc-fb-show'), 2400);
    }

    /* ──────────────────────────────────────────────────────────────────────────
       BOOT — entry point. Called once after enterCity() has finished. Polls
       briefly for REAL_FOUNDERS and G.ceoRefs to settle, then activates.
       ────────────────────────────────────────────────────────────────────────── */
    function activate() {
        const founder = STATE.founder;
        if (!founder) return false;

        // Lock camera onto founder's CEO NPC. Camera handles building/helicopter
        // transitions automatically (see camera.js).
        if (typeof G !== 'undefined') {
            G.tracking = { type: 'ceo', lab: founder.lab };
        }

        // Disable AutoTour — founder mode shouldn't get hijacked by the screensaver.
        try {
            if (typeof AutoTour !== 'undefined') {
                AutoTour.embedSticky = false;
                if (AutoTour.stop) AutoTour.stop();
                AutoTour._disabled = true;
            }
        } catch (e) { /* ignore */ }

        STATE.active = true;
        document.documentElement.classList.add('sc-founder-mode');

        if (!STATE.bar) buildBar();

        // Tick driver — runs from rAF so it stays in sync with the city clock.
        const tick = () => {
            if (!STATE.active) return;
            if (typeof G !== 'undefined' && typeof G.tick === 'number' &&
                G.tick !== STATE.lastTickUpdate && G.tick % 30 === 0) {
                STATE.lastTickUpdate = G.tick;
                updateBar();
            }
            requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);

        // Fire one immediate update so the bar isn't stuck at "Locating..."
        updateBar();
        return true;
    }

    function pollUntilReady() {
        STATE.bootAttempts++;
        const ready = (
            typeof REAL_FOUNDERS !== 'undefined' && REAL_FOUNDERS.length &&
            typeof G !== 'undefined' && G.ceoRefs &&
            Object.keys(G.ceoRefs).length > 0
        );
        if (!ready) {
            if (STATE.bootAttempts < 600) { // ~20s @ 30fps
                setTimeout(pollUntilReady, 33);
            } else {
                console.warn('[FounderTracker] Gave up waiting for citizens to spawn.');
                // Still build the bar so the user sees a "Loading..." state instead of nothing
                if (!STATE.bar && STATE.founder) buildBar();
            }
            return;
        }

        const founder = resolveFounder(STATE.slug);
        if (!founder) {
            console.warn('[FounderTracker] No founder matches slug:', STATE.slug);
            // Show a transient toast and bail out — don't lock camera on nothing.
            flash('Founder not found in this city', true);
            return;
        }
        STATE.founder = founder;
        STATE.lab = (typeof LABS !== 'undefined') ? LABS[founder.lab] : null;
        activate();
    }

    function init() {
        const slug = getRequestedSlug();
        if (!slug) return;
        STATE.slug = slug;

        // If we already have founder hints from the SSR injection, use them so
        // we can show the bar even before REAL_FOUNDERS finishes loading.
        if (window.SC_FOUNDER_NAME && window.SC_FOUNDER_LAB) {
            STATE.founder = {
                lab: window.SC_FOUNDER_LAB,
                name: window.SC_FOUNDER_NAME,
                role: window.SC_FOUNDER_ROLE || 'Founder',
                fact: window.SC_FOUNDER_FACT || ''
            };
            STATE.lab = (typeof LABS !== 'undefined') ? LABS[STATE.founder.lab] : null;
            // Pre-build the bar so the user sees something while citizens spawn
            if (document.body) buildBar();
            else document.addEventListener('DOMContentLoaded', () => { if (!STATE.bar) buildBar(); });
        }

        // Wait for the city to boot, then activate camera lock + live updates.
        pollUntilReady();
    }

    function stop() {
        STATE.active = false;
        if (typeof G !== 'undefined' && G.tracking && G.tracking.type === 'ceo') {
            G.tracking = null;
        }
        if (STATE.bar) {
            STATE.bar.classList.remove('sc-fb-in');
            setTimeout(() => { if (STATE.bar) { STATE.bar.remove(); STATE.bar = null; } }, 250);
        }
        document.documentElement.classList.remove('sc-founder-mode');
        // Drop the founder query from the URL so the user can browse normally
        try {
            if (window.history && window.history.replaceState) {
                const u = new URL(window.location.href);
                u.searchParams.delete('founder');
                if (u.pathname.startsWith('/founder/')) u.pathname = '/';
                window.history.replaceState({}, '', u.toString());
            }
        } catch (e) { /* ignore */ }
    }

    return { init, stop, _state: STATE };
})();
