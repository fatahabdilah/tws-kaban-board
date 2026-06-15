-- =========================================================
-- Card covers + labels, board background, and a 'media' storage bucket.
-- Run AFTER 0001..0006. Idempotent.
-- =========================================================

alter table public.cards
  add column if not exists cover_url text,
  add column if not exists labels    text[] not null default '{}';

alter table public.boards
  add column if not exists background text;

-- ---------- MEDIA STORAGE (card covers, board images, etc.) ----------
insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

drop policy if exists "media public read" on storage.objects;
create policy "media public read" on storage.objects for select
using (bucket_id = 'media');

drop policy if exists "media insert own" on storage.objects;
create policy "media insert own" on storage.objects for insert to authenticated
with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media update own" on storage.objects;
create policy "media update own" on storage.objects for update to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "media delete own" on storage.objects;
create policy "media delete own" on storage.objects for delete to authenticated
using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
