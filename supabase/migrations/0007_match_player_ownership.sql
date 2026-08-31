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
