-- ============================================================================
-- RedSec Ranked — CONSOLIDATED schema (all migrations, idempotent).
-- Paste this whole file into the Supabase SQL editor. Safe on a fresh OR an
-- already-partly-migrated project (create-if-not-exists / drop-then-create).
-- Includes per-player RP (0008) and live co-op (0010) required by the newest
-- features.
--
-- STORAGE is LAST. If it errors 'relation "storage.buckets" does not exist',
-- open the Storage tab in Supabase once, then re-run — everything above it is
-- already applied (only screenshots + map upload need it).
-- Source of truth: supabase/migrations/*.sql (regenerate, don't hand-edit).
-- ============================================================================

-- ####################################################################
-- ## 0001_init.sql

-- ============================================================================
-- RedSec Ranked Dashboard — schema, RLS, views, storage
-- Migration 0001: initial schema
-- ============================================================================

-- gen_random_uuid() is available in Supabase by default (pgcrypto).

-- ----------------------------------------------------------------------------
-- Access allowlist (defense-in-depth on top of disabled signups)
-- ----------------------------------------------------------------------------
create table if not exists public.allowed_emails (
  email text primary key
);

-- is_member(): TRUE when the current user's email is allow-listed.
-- If the allowlist is EMPTY, any authenticated user is allowed — so the app
-- works out-of-the-box with signups disabled, and you can optionally lock it
-- down to specific emails by inserting rows into allowed_emails.
create or replace function public.is_member()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select
    not exists (select 1 from public.allowed_emails)
    or exists (
      select 1 from public.allowed_emails
      where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    );
$$;

-- ----------------------------------------------------------------------------
-- players
-- ----------------------------------------------------------------------------
create table if not exists public.players (
  id           uuid primary key default gen_random_uuid(),
  display_name text not null,
  ea_id        text,                      -- EA ID / gamertag for the Career fetch
  platform     text check (platform in ('pc','xbl','psn')),
  color        text,                      -- chart accent, e.g. '#ff3b4e'
  avatar_url   text,
  auth_user_id uuid references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- locations (Fort Lyndon POIs / drop spots)
-- ----------------------------------------------------------------------------
create table if not exists public.locations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  description text,
  map         text not null default 'Fort Lyndon',
  pos_x       numeric,                     -- optional 0..1 coords for the map view
  pos_y       numeric,
  is_hot_drop boolean not null default false,
  created_at  timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- location_feedback (ratings + notes per drop spot)
-- ----------------------------------------------------------------------------
create table if not exists public.location_feedback (
  id               uuid primary key default gen_random_uuid(),
  location_id      uuid not null references public.locations(id) on delete cascade,
  author_player_id uuid references public.players(id) on delete set null,
  rating           smallint check (rating between 1 and 5),
  loot_quality     smallint check (loot_quality between 1 and 5),
  note             text,
  created_at       timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- matches (one row per round)
-- ----------------------------------------------------------------------------
create table if not exists public.matches (
  id             uuid primary key default gen_random_uuid(),
  played_at      timestamptz not null default now(),
  season         text,
  mode           text not null default 'ranked_quads'
                   check (mode in ('ranked_quads','quads','duos','gauntlet')),
  is_ranked      boolean not null default true,
  map            text not null default 'Fort Lyndon',
  placement      smallint,
  total_squads   smallint,
  won            boolean generated always as (placement = 1) stored,
  rp_start       integer,
  rp_end         integer,
  rp_delta       integer,
  rank_tier      text,
  rank_division  smallint check (rank_division between 1 and 5),
  screenshot_url text,
  ocr_source     text not null default 'manual' check (ocr_source in ('manual','ocr')),
  ocr_confidence numeric,
  notes          text,
  created_by     uuid references public.players(id) on delete set null,
  created_at     timestamptz not null default now()
);
create index if not exists matches_played_at_idx on public.matches (played_at desc);
create index if not exists matches_ranked_idx on public.matches (is_ranked, played_at);

-- ----------------------------------------------------------------------------
-- match_players (per-player line for head-to-head K/D/A)
-- ----------------------------------------------------------------------------
create table if not exists public.match_players (
  id        uuid primary key default gen_random_uuid(),
  match_id  uuid not null references public.matches(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  kills     smallint not null default 0,
  assists   smallint not null default 0,
  deaths    smallint not null default 0,
  revives   smallint,
  damage    integer,
  was_mvp   boolean not null default false,
  unique (match_id, player_id)
);
create index if not exists match_players_match_idx on public.match_players (match_id);
create index if not exists match_players_player_idx on public.match_players (player_id);

-- ----------------------------------------------------------------------------
-- match_jumps (1..n drop / redeploy / respawn locations per match)
-- ----------------------------------------------------------------------------
create table if not exists public.match_jumps (
  id          uuid primary key default gen_random_uuid(),
  match_id    uuid not null references public.matches(id) on delete cascade,
  location_id uuid not null references public.locations(id) on delete restrict,
  jump_order  smallint not null default 1,
  kind        text not null default 'initial_drop'
                check (kind in ('initial_drop','second_chance','respawn')),
  player_id   uuid references public.players(id) on delete set null,
  note        text
);
create index if not exists match_jumps_match_idx on public.match_jumps (match_id);
create index if not exists match_jumps_location_idx on public.match_jumps (location_id);

-- ============================================================================
-- Row Level Security — members only (read + write)
-- ============================================================================
alter table public.allowed_emails   enable row level security;
alter table public.players          enable row level security;
alter table public.locations        enable row level security;
alter table public.location_feedback enable row level security;
alter table public.matches          enable row level security;
alter table public.match_players    enable row level security;
alter table public.match_jumps      enable row level security;

-- allowed_emails: readable by members (so the app can show the roster); no client writes.
drop policy if exists "allowed_emails read" on public.allowed_emails;
create policy "allowed_emails read" on public.allowed_emails
  for select to authenticated using (public.is_member());

-- Helper: apply the same member policy to a data table for all commands.
-- (drop-then-create so this migration is safe to re-run.)
do $$
declare t text;
begin
  foreach t in array array[
    'players','locations','location_feedback','matches','match_players','match_jumps'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t||'_sel', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_member());', t||'_sel', t);
    execute format('drop policy if exists %I on public.%I;', t||'_ins', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_member());', t||'_ins', t);
    execute format('drop policy if exists %I on public.%I;', t||'_upd', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_member()) with check (public.is_member());', t||'_upd', t);
    execute format('drop policy if exists %I on public.%I;', t||'_del', t);
    execute format('create policy %I on public.%I for delete to authenticated using (public.is_member());', t||'_del', t);
  end loop;
end $$;

-- ============================================================================
-- Views (security_invoker so RLS on base tables still applies)
-- ============================================================================

create or replace view public.location_stats
with (security_invoker = true) as
with drops as (
  select distinct j.location_id, j.match_id
  from public.match_jumps j
  where j.kind = 'initial_drop'
),
mk as (
  select match_id, sum(kills) as team_kills
  from public.match_players group by match_id
)
select
  l.id                                             as location_id,
  l.name                                           as name,
  count(d.match_id)::int                            as games,
  count(d.match_id) filter (where m.won)::int       as wins,
  coalesce(avg((m.won)::int::float), 0)::float       as win_rate,
  avg(m.placement)::float                            as avg_placement,
  avg(m.rp_delta)::float                             as avg_rp_delta,
  avg(mk.team_kills)::float                          as avg_kills
from public.locations l
left join drops d  on d.location_id = l.id
left join public.matches m on m.id = d.match_id
left join mk on mk.match_id = d.match_id
group by l.id, l.name;

create or replace view public.player_stats
with (security_invoker = true) as
select
  p.id                                              as player_id,
  p.display_name                                    as display_name,
  p.color                                           as color,
  count(mp.id)::int                                  as games,
  coalesce(sum(mp.kills), 0)::int                    as kills,
  coalesce(sum(mp.assists), 0)::int                  as assists,
  coalesce(sum(mp.deaths), 0)::int                   as deaths,
  coalesce(sum(mp.revives), 0)::int                  as revives,
  (case when coalesce(sum(mp.deaths), 0) = 0
        then coalesce(sum(mp.kills), 0)::float
        else sum(mp.kills)::float / sum(mp.deaths) end)::float as kd,
  (case when count(mp.id) = 0 then 0
        else sum(mp.kills)::float / count(mp.id) end)::float   as avg_kills,
  (case when count(mp.id) = 0 then 0
        else sum(mp.assists)::float / count(mp.id) end)::float as avg_assists,
  (case when count(mp.id) = 0 then 0
        else sum(mp.deaths)::float / count(mp.id) end)::float  as avg_deaths,
  count(*) filter (where mp.was_mvp)::int            as mvps
from public.players p
left join public.match_players mp on mp.player_id = p.id
group by p.id, p.display_name, p.color;

create or replace view public.rp_timeline
with (security_invoker = true) as
select
  m.id          as match_id,
  m.played_at   as played_at,
  m.season      as season,
  m.rp_delta    as rp_delta,
  m.rp_end      as rp_end,
  coalesce(
    m.rp_end,
    sum(coalesce(m.rp_delta, 0)) over (
      order by m.played_at, m.id
      rows between unbounded preceding and current row
    )
  )::int        as running_rp,
  m.rank_tier   as rank_tier,
  m.rank_division as rank_division
from public.matches m
where m.is_ranked;

create or replace view public.season_summary
with (security_invoker = true) as
select
  m.season                                        as season,
  count(*)::int                                    as games,
  count(*) filter (where m.won)::int               as wins,
  coalesce(avg((m.won)::int::float), 0)::float      as win_rate,
  coalesce(sum(m.rp_delta), 0)::int                 as net_rp,
  avg(m.rp_delta)::float                            as avg_rp_delta,
  min(m.placement)::int                             as best_placement
from public.matches m
group by m.season;

-- ============================================================================
-- Storage (screenshots bucket) lives in 0003_storage.sql — run it AFTER Storage
-- is provisioned on the project (open the Storage tab once, or create the bucket
-- in the UI). It's optional and only powers the OCR-later screenshot upload.
-- ============================================================================

-- ####################################################################
-- ## 0002_seed.sql

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

-- ####################################################################
-- ## 0004_app_settings.sql

-- ============================================================================
-- Migration 0004: app_settings — a tiny shared key/value store.
-- Used to persist the single uploaded map image (URL + natural dimensions)
-- so both players see the same map background. Idempotent.
-- ============================================================================

create table if not exists public.app_settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "app_settings sel" on public.app_settings;
create policy "app_settings sel" on public.app_settings
  for select to authenticated using (public.is_member());

drop policy if exists "app_settings ins" on public.app_settings;
create policy "app_settings ins" on public.app_settings
  for insert to authenticated with check (public.is_member());

drop policy if exists "app_settings upd" on public.app_settings;
create policy "app_settings upd" on public.app_settings
  for update to authenticated using (public.is_member()) with check (public.is_member());

drop policy if exists "app_settings del" on public.app_settings;
create policy "app_settings del" on public.app_settings
  for delete to authenticated using (public.is_member());

-- ####################################################################
-- ## 0005_player_ownership.sql

-- ============================================================================
-- Migration 0005: player-profile ownership
-- A claimed player row (auth_user_id set) can only be edited/deleted by its
-- owner. Unclaimed rows (auth_user_id null) remain editable by any member, so
-- setup and guest roster entries still work. SELECT/INSERT stay open to members
-- (everyone needs to see the roster / add squadmates). Idempotent.
-- ============================================================================

drop policy if exists players_upd on public.players;
create policy players_upd on public.players
  for update to authenticated
  using (public.is_member() and (auth_user_id is null or auth_user_id = auth.uid()))
  with check (public.is_member() and (auth_user_id is null or auth_user_id = auth.uid()));

drop policy if exists players_del on public.players;
create policy players_del on public.players
  for delete to authenticated
  using (public.is_member() and (auth_user_id is null or auth_user_id = auth.uid()));

-- ####################################################################
-- ## 0006_clear_default_locations.sql

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

-- ####################################################################
-- ## 0007_match_player_ownership.sql

-- ============================================================================
-- Migration 0007: per-player match-stat ownership.
-- A member may only INSERT/UPDATE/DELETE a match_players row whose player is
-- unclaimed OR owned by them (players.auth_user_id = auth.uid()). So once you
-- claim your profile, nobody else can enter or change your kills/assists/etc.
-- SELECT stays open to members (everyone sees the full scoreboard). Idempotent.
-- ============================================================================

create or replace function public.can_write_player(p_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.players p
    where p.id = p_id
      and (p.auth_user_id is null or p.auth_user_id = auth.uid())
  );
$$;

drop policy if exists match_players_ins on public.match_players;
create policy match_players_ins on public.match_players
  for insert to authenticated
  with check (public.is_member() and public.can_write_player(player_id));

drop policy if exists match_players_upd on public.match_players;
create policy match_players_upd on public.match_players
  for update to authenticated
  using (public.is_member() and public.can_write_player(player_id))
  with check (public.is_member() and public.can_write_player(player_id));

drop policy if exists match_players_del on public.match_players;
create policy match_players_del on public.match_players
  for delete to authenticated
  using (public.is_member() and public.can_write_player(player_id));

-- ####################################################################
-- ## 0008_per_player_rp_and_timing.sql

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
-- Drop first: CREATE OR REPLACE can't reorder/rename existing view columns.
drop view if exists public.rp_timeline;
create view public.rp_timeline
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

-- ####################################################################
-- ## 0010_live_sessions.sql

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

-- ####################################################################
-- ## 0003_storage.sql

-- ============================================================================
-- Migration 0003: Storage — screenshots bucket (OPTIONAL, OCR-later feature)
--
-- Run this ONLY after Storage is provisioned on your project. If you get
-- 'relation "storage.buckets" does not exist', open the Storage tab in the
-- dashboard once (or create any bucket in the UI) to initialize it, then re-run.
--
-- Public read (unguessable UUID filenames) + member-only write. Idempotent.
-- ============================================================================

insert into storage.buckets (id, name, public)
values ('screenshots', 'screenshots', true)
on conflict (id) do nothing;

drop policy if exists "screenshots public read" on storage.objects;
create policy "screenshots public read" on storage.objects
  for select using (bucket_id = 'screenshots');

drop policy if exists "screenshots member insert" on storage.objects;
create policy "screenshots member insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'screenshots' and public.is_member());

drop policy if exists "screenshots member update" on storage.objects;
create policy "screenshots member update" on storage.objects
  for update to authenticated using (bucket_id = 'screenshots' and public.is_member());

drop policy if exists "screenshots member delete" on storage.objects;
create policy "screenshots member delete" on storage.objects
  for delete to authenticated using (bucket_id = 'screenshots' and public.is_member());
