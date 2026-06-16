-- ════════════════════════════════════════════════════════════════════════════
-- ai_bans — editable, government-ban registry for the AI Detention Center
-- (js/jail.js → JailData.fetchRemoteBans). Each row detains every citizen whose
-- lab/name matches, scoped to the viewer's jurisdiction. Edit rows here to add or
-- release detentions with ZERO code changes / redeploys — the client re-reads via
-- the anon key every few seconds. This LAYERS ON TOP of the in-code seed rules
-- (Claude Fable/Mythos = global, DeepSeek = AU/CZ/DE/US, Grok = TR), so you only
-- need rows here for NEW bans the seed + live-news layers don't already cover.
--
-- Paste this whole file into the Supabase SQL Editor and Run.
-- ════════════════════════════════════════════════════════════════════════════

create table if not exists ai_bans (
    id          bigint generated always as identity primary key,
    label       text,                                  -- short chip shown on the detainee, e.g. 'Italy (Garante)'
    authority   text,                                  -- who issued it, e.g. 'Italy' / 'EU Commission'
    -- scope: 'global' = detained for EVERY visitor; or a JSON object naming the
    -- affected countries (ISO-3166 alpha-2), e.g. '{"countries":["TR"]}'.
    -- Stored as text so it is trivial to hand-edit; the client parses it.
    scope       text not null default 'global',
    until       date,                                  -- optional auto-release date (null = indefinite)
    reason      text,                                  -- one line shown in the cell / model tooltip
    source      text,                                  -- click-through URL to the news/order
    match_lab   text,                                  -- lab id to jail wholesale, e.g. 'deepseek' (optional)
    match_name  text,                                  -- case-insensitive regex on model name, e.g. 'gemini' (optional)
    active      boolean not null default true,         -- flip to false to release without deleting the row
    created_at  timestamptz not null default now(),
    -- A row must target SOMETHING: a lab, a name pattern, or both.
    constraint ai_bans_has_target check (match_lab is not null or match_name is not null),
    -- scope must be the literal 'global' or look like a JSON object.
    constraint ai_bans_scope_shape check (scope = 'global' or scope like '{%}')
);

create index if not exists idx_ai_bans_active on ai_bans (active);

-- ─── ROW LEVEL SECURITY ──────────────────────────────────────────────────────
-- Reads: public (anon key) — the browser client needs to see the bans.
-- Writes: none for anon → curate rows from the Supabase dashboard / SQL editor
-- (service role bypasses RLS), exactly like sc_events.
alter table ai_bans enable row level security;

drop policy if exists "ai_bans anon read" on ai_bans;
create policy "ai_bans anon read"
    on ai_bans for select
    to anon, authenticated
    using (true);

-- ─── EXAMPLES ────────────────────────────────────────────────────────────────
-- Uncomment any of these (or write your own) to try it. They are illustrative;
-- the seed + live-news layers already handle the real June-2026 cases.
--
-- A whole lab, in one country only (jurisdictional device ban):
-- insert into ai_bans (label, authority, scope, reason, source, match_lab)
-- values ('India (MeitY)', 'India', '{"countries":["IN"]}',
--         'Blocked pending data-localisation compliance.', 'https://example.com', 'deepseek');
--
-- A model family, everywhere (a global recall / worldwide suspension):
-- insert into ai_bans (label, authority, scope, reason, source, match_name)
-- values ('Worldwide recall', 'Vendor', 'global',
--         'Voluntarily pulled after a safety incident.', 'https://example.com', 'gemini');
--
-- A temporary block that auto-releases on a date:
-- insert into ai_bans (label, authority, scope, until, reason, match_name)
-- values ('EU (interim)', 'EU Commission', '{"countries":["FR","DE","IT","ES","NL"]}',
--         '2026-09-01', 'Interim order during a DSA review.', 'grok');
--
-- To release a ban: update ai_bans set active = false where id = <n>;  (or delete the row,
-- or set `until` to a past date). The detainee walks back to its home lab on the next scan.
