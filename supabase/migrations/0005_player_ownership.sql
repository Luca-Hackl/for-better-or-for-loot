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
