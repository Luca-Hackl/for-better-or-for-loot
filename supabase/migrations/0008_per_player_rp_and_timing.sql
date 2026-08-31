-- ============================================================================
-- Migration 0008: per-player RP, marker-less drops, and match timing.
--   * RP + rank move onto match_players (each player tracks their own RP)
--   * match_jumps become coordinate-based (marker-less); location_id optional
--   * per-player death timings + game time
-- Idempotent.
-- ============================================================================

alter table public.match_players
  add column if not exists rp_before    integer,
  add column if not exists rp_after     integer,
  add column if not exists rp_delta      integer,
  add column if not exists rank_tier     text,
  add column if not exists rank_division smallint,
  add column if not exists death_times   integer[] not null default '{}',
  add column if not exists time_seconds  integer;

alter table public.match_jumps alter column location_id drop not null;
alter table public.match_jumps
  add column if not exists pos_x numeric,
  add column if not exists pos_y numeric;

-- Per-player RP timeline (was per-match). running_rp chains each player's RP.
create or replace view public.rp_timeline
with (security_invoker = true) as
select
  mp.player_id  as player_id,
  m.id          as match_id,
  m.played_at   as played_at,
  m.season      as season,
  mp.rp_delta   as rp_delta,
  mp.rp_after   as rp_end,
  coalesce(
    mp.rp_after,
    sum(coalesce(mp.rp_delta, 0)) over (
      partition by mp.player_id
      order by m.played_at, m.id
      rows between unbounded preceding and current row
    )
  )::int        as running_rp,
  mp.rank_tier  as rank_tier,
  mp.rank_division as rank_division
from public.match_players mp
join public.matches m on m.id = mp.match_id
where m.is_ranked;
