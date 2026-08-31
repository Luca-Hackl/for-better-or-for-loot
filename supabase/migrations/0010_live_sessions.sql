-- ============================================================================
-- Migration 0010: real-time co-op live match sessions
--   * matches gain a lifecycle (live | final) + host + timing
--   * match_players double as membership (joined_at = accepted; null = invited)
--   * append-only match_events power the shared game-log
--   * RLS: self-join prevention, host-only finalize, append-only, member reads
--   * Realtime publication + REPLICA IDENTITY FULL
--   * stats views exclude in-progress (live) matches
-- Idempotent.
-- ============================================================================

alter table public.matches
  add column if not exists status text not null default 'final'
    check (status in ('live', 'final')),
  add column if not exists host_player_id uuid references public.players(id) on delete set null,
  add column if not exists started_at timestamptz,
  add column if not exists ended_at timestamptz;
create index if not exists matches_live_idx on public.matches (status) where status = 'live';

alter table public.match_players
  add column if not exists joined_at  timestamptz,   -- null = invited, not yet joined
  add column if not exists invited_by uuid references public.players(id) on delete set null;

create table if not exists public.match_events (
  id              uuid primary key default gen_random_uuid(),
  match_id        uuid not null references public.matches(id) on delete cascade,
  player_id       uuid references public.players(id) on delete set null,
  kind            text not null check (kind in ('start','kill','death','respawn','join','stop')),
  at_seconds      integer not null default 0 check (at_seconds >= 0),
  pos_x           numeric,
  pos_y           numeric,
  death_event_id  uuid references public.match_events(id) on delete set null,
  client_event_id uuid not null,
  meta            jsonb not null default '{}',
  created_at      timestamptz not null default now(),
  unique (match_id, player_id, client_event_id)
);
create index if not exists match_events_match_idx on public.match_events (match_id, at_seconds, created_at);
alter table public.match_events enable row level security;

-- ---- definer helpers (STABLE + pinned search_path to avoid RLS recursion) ----
create or replace function public.match_status(m_id uuid)
  returns text language sql security definer stable set search_path = public as $$
  select status from public.matches where id = m_id $$;

create or replace function public.is_match_host(m_id uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.matches m
    join public.players p on p.id = m.host_player_id
    where m.id = m_id and p.auth_user_id = auth.uid()
  ) $$;

create or replace function public.match_is_writable(m_id uuid)
  returns boolean language sql security definer stable set search_path = public as $$
  select exists (select 1 from public.matches m where m.id = m_id and m.status = 'live') $$;

-- Finalize a live match atomically: host-only, drop never-joined invitees (so
-- they don't pollute stats), flip status to final. SECURITY DEFINER because the
-- host can't delete rows for players they don't own under can_write_player.
create or replace function public.finish_live_match(m_id uuid, p_placement int, p_total int, p_notes text)
  returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_match_host(m_id) then
    raise exception 'Only the host can finish this match';
  end if;
  delete from public.match_players where match_id = m_id and joined_at is null;
  update public.matches
    set status = 'final', ended_at = now(),
        placement = coalesce(p_placement, placement),
        total_squads = coalesce(p_total, total_squads),
        notes = coalesce(p_notes, notes)
  where id = m_id;
end $$;
grant execute on function public.finish_live_match(uuid, int, int, text) to authenticated;

-- ---- matches: host-only lifecycle update; legacy 'final' path stays open ----
drop policy if exists matches_upd on public.matches;
create policy matches_upd on public.matches for update to authenticated
  using (public.is_member() and (public.match_status(id) = 'final' or public.is_match_host(id)))
  with check (public.is_member() and (status = 'final' or public.is_match_host(id)));

-- ---- match_players: keep legacy final path; host seeds live membership; no self-join ----
-- INSERT branches:
--   * legacy finished-match writes: your own / unclaimed rows into a final match
--   * host seeding membership rows (incl. invitees owned by others) into their live match
-- A non-host member therefore cannot INSERT themselves into a live match (no self-join);
-- invitees join by UPDATING their host-seeded row (joined_at) which can_write_player allows.
drop policy if exists match_players_ins on public.match_players;
create policy match_players_ins on public.match_players for insert to authenticated
  with check (
    public.is_member() and (
      (public.can_write_player(player_id) and public.match_status(match_id) = 'final')
      or (public.is_match_host(match_id) and public.match_is_writable(match_id))
    )
  );

drop policy if exists match_players_upd on public.match_players;
create policy match_players_upd on public.match_players for update to authenticated
  using (public.is_member() and public.can_write_player(player_id))
  with check (
    public.is_member() and public.can_write_player(player_id)
    and (public.match_status(match_id) = 'final' or public.match_is_writable(match_id))
  );

-- ---- match_events: member SELECT; self-only append while live; append-only ----
drop policy if exists match_events_sel on public.match_events;
create policy match_events_sel on public.match_events for select to authenticated
  using (public.is_member());

drop policy if exists match_events_ins on public.match_events;
create policy match_events_ins on public.match_events for insert to authenticated
  with check (
    public.is_member() and public.match_is_writable(match_id)
    and (
      (player_id is not null and public.can_write_player(player_id))
      or (player_id is null and public.is_match_host(match_id))
    )
  );

-- ---- realtime: publication membership (idempotent) + full replica identity ----
alter table public.matches       replica identity full;
alter table public.match_players replica identity full;
alter table public.match_events  replica identity full;
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime')
    then create publication supabase_realtime; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='matches')
    then alter publication supabase_realtime add table public.matches; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_players')
    then alter publication supabase_realtime add table public.match_players; end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='match_events')
    then alter publication supabase_realtime add table public.match_events; end if;
end $$;

-- ============================================================================
-- Keep stats/aggregates to FINAL matches only (live sessions never pollute).
-- ============================================================================
drop view if exists public.rp_timeline;
create view public.rp_timeline with (security_invoker = true) as
select
  mp.player_id, m.id as match_id, m.played_at, m.season,
  mp.rp_delta, mp.rp_after as rp_end,
  coalesce(mp.rp_after, sum(coalesce(mp.rp_delta,0)) over (
    partition by mp.player_id order by m.played_at, m.id
    rows between unbounded preceding and current row))::int as running_rp,
  mp.rank_tier, mp.rank_division
from public.match_players mp
join public.matches m on m.id = mp.match_id
where m.is_ranked and m.status = 'final';

create or replace view public.player_stats with (security_invoker = true) as
select
  p.id as player_id, p.display_name, p.color,
  count(mp.id)::int as games,
  coalesce(sum(mp.kills),0)::int   as kills,
  coalesce(sum(mp.assists),0)::int as assists,
  coalesce(sum(mp.deaths),0)::int  as deaths,
  coalesce(sum(mp.revives),0)::int as revives,
  (case when coalesce(sum(mp.deaths),0)=0 then coalesce(sum(mp.kills),0)::float
        else sum(mp.kills)::float/sum(mp.deaths) end)::float as kd,
  (case when count(mp.id)=0 then 0 else sum(mp.kills)::float/count(mp.id) end)::float   as avg_kills,
  (case when count(mp.id)=0 then 0 else sum(mp.assists)::float/count(mp.id) end)::float as avg_assists,
  (case when count(mp.id)=0 then 0 else sum(mp.deaths)::float/count(mp.id) end)::float  as avg_deaths,
  count(*) filter (where mp.was_mvp)::int as mvps
from public.players p
left join (
  select mp.* from public.match_players mp
  join public.matches m on m.id = mp.match_id and m.status = 'final'
) mp on mp.player_id = p.id
group by p.id, p.display_name, p.color;

create or replace view public.season_summary with (security_invoker = true) as
select
  m.season,
  count(*)::int as games,
  count(*) filter (where m.won)::int as wins,
  coalesce(avg((m.won)::int::float),0)::float as win_rate,
  coalesce(sum(m.rp_delta),0)::int as net_rp,
  avg(m.rp_delta)::float as avg_rp_delta,
  min(m.placement)::int as best_placement
from public.matches m
where m.status = 'final'
group by m.season;

create or replace view public.location_stats with (security_invoker = true) as
with drops as (
  select distinct j.location_id, j.match_id
  from public.match_jumps j where j.kind = 'initial_drop' and j.location_id is not null
),
mk as (select match_id, sum(kills) as team_kills from public.match_players group by match_id)
select
  l.id as location_id, l.name,
  count(m.id)::int as games,
  count(m.id) filter (where m.won)::int as wins,
  coalesce(avg((m.won)::int::float),0)::float as win_rate,
  avg(m.placement)::float as avg_placement,
  avg(m.rp_delta)::float as avg_rp_delta,
  avg(mk.team_kills)::float as avg_kills
from public.locations l
left join drops d on d.location_id = l.id
left join public.matches m on m.id = d.match_id and m.status = 'final'
left join mk on mk.match_id = d.match_id
group by l.id, l.name;
