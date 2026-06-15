-- =========================================================
-- (A) Per-board membership: a board now has its own members.
--     Access = super_admin OR workspace admin OR explicit board member.
-- (B) Avatars storage bucket + policies for profile pictures.
-- Run AFTER 0001..0004.
-- =========================================================

-- ---------- BOARD MEMBERS ----------
create table if not exists public.board_members (
  board_id   uuid not null references public.boards(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  role       public.board_role not null default 'member',
  added_by   uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (board_id, user_id)
);
create index if not exists board_members_user_idx  on public.board_members(user_id);
create index if not exists board_members_board_idx on public.board_members(board_id);

-- ---------- REDEFINE BOARD HELPERS ----------
-- Board access requires explicit board membership, with workspace admins and
-- super admins always allowed (implicit board admins).
create or replace function public.is_board_member(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
    or public.is_workspace_admin((select workspace_id from public.boards where id = p_board_id))
    or exists (
      select 1 from public.board_members
      where board_id = p_board_id and user_id = auth.uid()
    );
$$;

create or replace function public.board_role(p_board_id uuid)
returns public.board_role language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then 'admin'::public.board_role
    when public.is_workspace_admin((select workspace_id from public.boards where id = p_board_id))
      then 'admin'::public.board_role
    else (
      select role from public.board_members
      where board_id = p_board_id and user_id = auth.uid()
    )
  end;
$$;

create or replace function public.can_edit_board(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.board_role(p_board_id) in ('admin','member');
$$;

create or replace function public.is_board_admin(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.board_role(p_board_id) = 'admin';
$$;

-- ---------- RLS: board_members ----------
alter table public.board_members enable row level security;

drop policy if exists bm_select on public.board_members;
create policy bm_select on public.board_members for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists bm_insert on public.board_members;
create policy bm_insert on public.board_members for insert to authenticated
with check (public.is_board_admin(board_id));

drop policy if exists bm_update on public.board_members;
create policy bm_update on public.board_members for update to authenticated
using (public.is_board_admin(board_id)) with check (public.is_board_admin(board_id));

drop policy if exists bm_delete on public.board_members;
create policy bm_delete on public.board_members for delete to authenticated
using (public.is_board_admin(board_id) or user_id = auth.uid());

grant select, insert, update, delete on public.board_members to authenticated;

-- ---------- CREATOR BECOMES BOARD ADMIN ----------
create or replace function public.tg_board_add_creator_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.board_members (board_id, user_id, role, added_by)
  values (new.id, new.created_by, 'admin', new.created_by)
  on conflict (board_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists boards_add_creator_admin on public.boards;
create trigger boards_add_creator_admin after insert on public.boards
  for each row execute function public.tg_board_add_creator_admin();

-- ---------- BACKFILL: keep existing boards accessible ----------
-- Existing boards predate board membership; copy each board's workspace
-- members onto it (with their workspace role) so nothing loses access.
insert into public.board_members (board_id, user_id, role)
select b.id, wm.user_id, wm.role
from public.boards b
join public.workspace_members wm on wm.workspace_id = b.workspace_id
on conflict (board_id, user_id) do nothing;

-- ---------- INVITE RPC (add existing workspace member to a board) ----------
create or replace function public.add_board_member(
  p_board_id uuid,
  p_user_id  uuid,
  p_role     public.board_role
)
returns public.board_members
language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_row public.board_members;
begin
  if not public.is_board_admin(p_board_id) then
    raise exception 'Hanya admin board yang dapat menambah anggota' using errcode = '42501';
  end if;
  select workspace_id into v_ws from public.boards where id = p_board_id;
  if not exists (select 1 from public.workspace_members where workspace_id = v_ws and user_id = p_user_id) then
    raise exception 'Pengguna harus menjadi anggota workspace terlebih dahulu' using errcode = 'P0002';
  end if;
  insert into public.board_members (board_id, user_id, role, added_by)
  values (p_board_id, p_user_id, p_role, auth.uid())
  on conflict (board_id, user_id) do update set role = excluded.role
  returning * into v_row;
  return v_row;
end $$;

revoke all on function public.add_board_member(uuid, uuid, public.board_role) from public;
grant execute on function public.add_board_member(uuid, uuid, public.board_role) to authenticated;

-- =========================================================
-- (B) AVATARS STORAGE
-- =========================================================
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true)
on conflict (id) do nothing;

-- Public read.
drop policy if exists "avatars public read" on storage.objects;
create policy "avatars public read" on storage.objects for select
using (bucket_id = 'avatars');

-- Authenticated users manage only files under their own uid/ folder.
drop policy if exists "avatars insert own" on storage.objects;
create policy "avatars insert own" on storage.objects for insert to authenticated
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars update own" on storage.objects;
create policy "avatars update own" on storage.objects for update to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "avatars delete own" on storage.objects;
create policy "avatars delete own" on storage.objects for delete to authenticated
using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text);
