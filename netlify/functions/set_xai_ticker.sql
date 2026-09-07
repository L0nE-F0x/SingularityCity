-- ════════════════════════════════════════════════════════════════════════════
-- set_xai_ticker.sql — give the xAI HQ its stock ticker sign.
--
-- WHY THIS IS SQL AND NOT A COMMIT:
-- The 2D city has no code-level lab data. js/data.js declares `var LABS = {}`
-- and it is filled only from the Supabase `labs` table (API.fetchCoreData) or
-- from the localStorage cache of a previous fetch. The ticker sign in
-- js/environment.js is gated on `LABS[lab].ticker`, so a null column means no
-- sign — there is no JS file to edit. Per rls_all.sql the publishable (anon)
-- key is SELECT-only on every table, and submit-data.mjs does not accept
-- `labs`, so this has to be run by a human in the Supabase SQL Editor.
--
-- WHY SPCX AND NOT AN xAI SYMBOL:
-- xAI never IPO'd on its own. It was absorbed into SpaceX in the Feb-2026
-- all-stock merger as a wholly-owned subsidiary, and SpaceX is what listed —
-- on Nasdaq as SPCX, on 2026-06-12. So the HQ carries its parent's listing.
-- (First Person hardcodes its own LABS map and previously used TSLA as a
-- Musk-exposure proxy; that was changed to SPCX in the same session.)
--
-- Paste into the Supabase SQL Editor and Run. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

update public.labs
   set ticker = 'SPCX'
 where id = 'xai';

-- ─── Verify ─────────────────────────────────────────────────────────────────
-- Expect exactly one row: xai | xAI | SPCX
select id, name, ticker
  from public.labs
 where id = 'xai';

-- Then reload the city. Building `bld_x` (the xAI HQ) grows a scrolling ticker.
-- It reads "SPCX AWAITING TELEMETRY" until a player supplies their own Finnhub
-- key in settings — that is normal, and every other lab HQ behaves the same way.
-- API.fetchStocks() derives its symbol list from LABS, so nothing else changes.
