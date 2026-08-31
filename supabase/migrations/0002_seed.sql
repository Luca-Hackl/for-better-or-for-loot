-- ============================================================================
-- Migration 0002: seed data
--   * Two editable players (rename + set EA IDs in the app's Settings page)
-- Drop zones are NOT seeded — add your own on the map (Locations or Play mode).
-- Idempotent: safe to re-run.
-- ============================================================================

-- --- Players -----------------------------------------------------------------
insert into public.players (display_name, color)
select 'Player 1', '#ff3b4e'
where not exists (select 1 from public.players);

insert into public.players (display_name, color)
select 'Player 2', '#35d0e0'
where (select count(*) from public.players) < 2;
