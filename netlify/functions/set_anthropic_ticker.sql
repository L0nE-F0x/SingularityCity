-- ════════════════════════════════════════════════════════════════════════════
-- set_anthropic_ticker.sql — set Anthropic's stock ticker in Supabase `labs`.
--
-- WHY THIS EXISTS:
-- Anthropic completed its IPO on the Nasdaq Global Select Market on
-- 2026-11-19 under the ticker symbol ANT. The `public.labs` row for
-- `anthropic` was seeded with `ticker = null` before the IPO.
--
-- Note: js/api.js also includes a client-side fallback (`LAB_TICKER_FALLBACKS`)
-- so Anthropic HQ (`bld_a`) displays its scrolling ANT rooftop ticker right
-- away even before this SQL is run. Running this keeps Supabase authoritative
-- and in sync with the rest of `public.labs` (GOOGL, META, SPCX, etc.).
--
-- Per rls_all.sql the publishable (anon) key is SELECT-only on every table,
-- and submit-data.mjs does not accept `labs`, so run this in the Supabase
-- SQL Editor. Idempotent — safe to re-run.
-- ════════════════════════════════════════════════════════════════════════════

update public.labs
   set ticker = 'ANT'
 where id = 'anthropic';

-- ─── Verify ─────────────────────────────────────────────────────────────────
-- Expect exactly one row: anthropic | Anthropic | ANT
select id, name, ticker
  from public.labs
 where id = 'anthropic';
