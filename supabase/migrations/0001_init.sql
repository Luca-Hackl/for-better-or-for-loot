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
