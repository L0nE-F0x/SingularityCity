/* ============================================================================
   Cross-view navigation — hard-swap between root FP and vendored Pixi 2D.
   Shared resume token in sessionStorage/localStorage (sc_view_resume_v1).
   ============================================================================ */

import { INTEGRATION } from './config.js';
import { CityStore } from './city_store.js';
import { G } from '../state.js';

const RESUME_KEY = INTEGRATION.resumeKey || 'sc_view_resume_v1';

/* A resume token describes ONE navigation that is happening right now. It is
   mirrored into localStorage only because a hard-swap between two origins-worth
   of storage can lose the sessionStorage copy. Anything older than this is a
   leftover from a previous visit and must never steer the current load — an
   un-expired token is what made the 2D landing page auto-enter the city. */
const RESUME_TTL_MS = 2 * 60 * 1000;

export function readResumeToken() {
    let raw = null;
    try { raw = sessionStorage.getItem(RESUME_KEY); } catch (_) { /* ignore */ }
    if (!raw) {
        try { raw = localStorage.getItem(RESUME_KEY); } catch (_) { /* ignore */ }
    }
    if (!raw) return null;
    let tok = null;
    try { tok = JSON.parse(raw); } catch (_) { return null; }
    if (!tok) return null;
    if (!tok.at || Date.now() - tok.at > RESUME_TTL_MS) {
        clearResumeToken();
        return null;
    }
    return tok;
}

export function writeResumeToken(token) {
    const t = { ...token, at: Date.now() };
    const s = JSON.stringify(t);
    try { sessionStorage.setItem(RESUME_KEY, s); } catch (_) { /* ignore */ }
    try { localStorage.setItem(RESUME_KEY, s); } catch (_) { /* ignore */ }
    return t;
}

export function clearResumeToken() {
    // BOTH copies. writeResumeToken mirrors into localStorage, so clearing only
    // the session copy leaves a token that survives the tab and replays on every
    // later visit.
    try { sessionStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
    try { localStorage.removeItem(RESUME_KEY); } catch (_) { /* ignore */ }
}

/** Capture FP pose and navigate to vendored Pixi 2D. */
export function goPixi2D(extra = {}) {
    // Leaving FP intentionally — don't flash the pause menu when pointer lock drops
    try { G._suppressPauseOnUnlock = true; } catch (_) { /* ignore */ }
    try { G.player?.unlock?.(); } catch (_) { /* ignore */ }
    CityStore.saveProgress();
    const token = {
        view: 'pixi',
        from: 'fp',
        dayPhase: G.dayPhase,
        buildingId: G.inside?.id || null,
        camX: extra.camX ?? null,
        fpX: G.camera?.position?.x,
        fpZ: G.camera?.position?.z,
        yaw: G.player?.yaw,
        districtId: extra.districtId || null
    };
    writeResumeToken(token);
    CityStore.patch({ view: 'pixi' });
    const url = new URL(INTEGRATION.classic2dUrl, window.location.href);
    // Prefer entering city when arriving from FP
    url.searchParams.set('from', 'fp');
    window.location.href = url.href;
}

/** Build FP URL (used rarely from module context). */
export function fpHref(params = {}) {
    const u = new URL('./index.html', window.location.href);
    Object.entries(params).forEach(([k, v]) => {
        if (v != null) u.searchParams.set(k, String(v));
    });
    return u.href;
}

