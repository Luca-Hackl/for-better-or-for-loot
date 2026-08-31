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
