-- ============================================================================
-- Migration 0006: remove the old default drop zones.
-- Deletes the originally-seeded Fort Lyndon POIs, but ONLY ones not yet used by
-- any match (a used location is protected by the match_jumps FK). Safe to re-run.
-- ============================================================================

delete from public.locations l
where l.name in (
  'Downtown','Main Street','Marina','Golf Course','Fleetview Ridge',
  'Defense Nexus','The Dam','The Hills','Suburbs'
)
and not exists (select 1 from public.match_jumps j where j.location_id = l.id);
