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
