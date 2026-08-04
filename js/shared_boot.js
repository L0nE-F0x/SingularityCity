/* ════════════════════════════════════════════════════════════════════════════
   SHARED-MODULE BRIDGE for the 2D city.

   The 2D app is ~99 classic scripts sharing globals; the shared/ modules are
   ESM. This is the one module script in the 2D page: it imports them and hangs
   them on window.SC_SHARED so the classic code can delegate.

   ── Why this runs early enough ───────────────────────────────────────────────
   Module scripts are implicitly deferred, and deferred classic scripts and
   module scripts execute in DOCUMENT ORDER as one list after parsing. This tag
   sits above the js/*.js block in index.html, and a module's imports are fully
   resolved before its body runs — so window.SC_SHARED is populated before
   data.js or engine.js execute. Keep this tag ABOVE them.

   ── If it fails to load ──────────────────────────────────────────────────────
   Every consumer checks for SC_SHARED and falls back to its own local copy, so
   a CSP block or a network failure degrades to today's behaviour rather than a
   white screen. The warning below is the signal that the views may disagree.
   ════════════════════════════════════════════════════════════════════════════ */
import * as schedule from '../shared/schedule.js';
import * as spaceLive from '../shared/space_live.js';
import * as aiBans from '../shared/ai_bans.js';
import * as aiDocket from '../shared/ai_docket.js';
import * as portPrices from '../shared/port_prices.js';

window.SC_SHARED = { schedule, spaceLive, aiBans, aiDocket, portPrices };

// Let anything that booted before this module resolve pick the shared path up.
window.dispatchEvent(new Event('sc-shared-ready'));

if (!window.SC_SHARED.schedule || typeof window.SC_SHARED.schedule.getAct !== 'function') {
    console.warn('[SC] shared modules loaded but incomplete — 2D is running its local copies, ' +
        'which means it can disagree with First Person.');
}
