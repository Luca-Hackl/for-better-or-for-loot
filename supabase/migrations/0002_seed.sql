-- ============================================================================
-- Migration 0002: seed data
--   * Two editable players (rename + set EA IDs in the app's Settings page)
--   * Known Fort Lyndon POIs (add the rest in-app; ~20 exist in total)
-- Idempotent: safe to re-run.
-- ============================================================================

-- --- Players -----------------------------------------------------------------
insert into public.players (display_name, color)
select 'Player 1', '#ff3b4e'
where not exists (select 1 from public.players);

insert into public.players (display_name, color)
select 'Player 2', '#35d0e0'
where (select count(*) from public.players) < 2;

-- --- Fort Lyndon POIs --------------------------------------------------------
-- pos_x / pos_y are rough 0..1 layout coords for the map view (top-left origin).
insert into public.locations (name, description, pos_x, pos_y, is_hot_drop) values
  ('Downtown',       'High-rise core — dense loot, very hot early fights.', 0.52, 0.38, true),
  ('Main Street',    'Central commercial strip connecting Downtown to the Marina.', 0.46, 0.50, true),
  ('Marina',         'Waterfront docks and boats on the coastal edge.', 0.30, 0.66, false),
  ('Golf Course',    'Open greens — long sightlines, weak cover.', 0.70, 0.58, false),
  ('Fleetview Ridge','Elevated ridge with commanding overwatch of the valley.', 0.78, 0.30, true),
  ('Defense Nexus',  'Fortified military compound — top-tier loot, high risk.', 0.62, 0.20, true),
  ('The Dam',        'Hydro dam chokepoint on the north edge of the map.', 0.40, 0.14, false),
  ('The Hills',      'Rural high ground — quiet rotations and safe landings.', 0.20, 0.34, false),
  ('Suburbs',        'Residential blocks — steady loot, moderate traffic.', 0.34, 0.50, false)
on conflict (name) do nothing;
