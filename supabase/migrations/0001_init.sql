-- =========================================================
-- Kanban Board — initial schema, helpers, triggers, RLS
-- Next.js 16 + Supabase. Apply via Supabase SQL editor or MCP.
-- =========================================================

create extension if not exists "pgcrypto";

-- ---------- ENUMS ----------
do $$ begin
  create type public.platform_role as enum ('user', 'super_admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.board_role as enum ('admin', 'member', 'viewer');
exception when duplicate_object then null; end $$;

-- ---------- PROFILES (1:1 with auth.users) ----------
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  avatar_url    text,
  platform_role public.platform_role not null default 'user',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ---------- BOARDS ----------
create table if not exists public.boards (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 1 and 120),
  description text,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists boards_created_by_idx on public.boards(created_by);

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

-- ---------- LISTS (columns) ----------
create table if not exists public.lists (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  title      text not null check (char_length(title) between 1 and 120),
  position   numeric not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists lists_board_position_idx on public.lists(board_id, position);

-- ---------- CARDS ----------
create table if not exists public.cards (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.lists(id) on delete cascade,
  board_id    uuid not null references public.boards(id) on delete cascade, -- denormalized for RLS
  title       text not null check (char_length(title) between 1 and 280),
  description text,
  position    numeric not null,
  due_date    timestamptz,
  assignee_id uuid references public.profiles(id) on delete set null,
  created_by  uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists cards_list_position_idx on public.cards(list_id, position);
create index if not exists cards_board_idx          on public.cards(board_id);
create index if not exists cards_assignee_idx       on public.cards(assignee_id);

-- =========================================================
-- TRIGGERS
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists profiles_updated on public.profiles;
create trigger profiles_updated before update on public.profiles
  for each row execute function public.tg_set_updated_at();
drop trigger if exists boards_updated on public.boards;
create trigger boards_updated before update on public.boards
  for each row execute function public.tg_set_updated_at();
drop trigger if exists lists_updated on public.lists;
create trigger lists_updated before update on public.lists
  for each row execute function public.tg_set_updated_at();
drop trigger if exists cards_updated on public.cards;
create trigger cards_updated before update on public.cards
  for each row execute function public.tg_set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Creator becomes board admin (atomic, sidesteps insert-RLS chicken-and-egg)
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

-- Keep cards.board_id consistent with its list (ignore client-sent value)
create or replace function public.tg_card_sync_board()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select l.board_id into new.board_id from public.lists l where l.id = new.list_id;
  if new.board_id is null then
    raise exception 'list % not found', new.list_id;
  end if;
  return new;
end $$;

drop trigger if exists cards_sync_board on public.cards;
create trigger cards_sync_board before insert or update of list_id on public.cards
  for each row execute function public.tg_card_sync_board();

-- =========================================================
-- SECURITY DEFINER HELPERS (break RLS recursion)
-- =========================================================
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'super_admin'
  );
$$;

create or replace function public.is_board_member(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.board_members
        where board_id = p_board_id and user_id = auth.uid()
      );
$$;

create or replace function public.board_role(p_board_id uuid)
returns public.board_role language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then 'admin'::public.board_role
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

revoke all on function
  public.is_super_admin(),
  public.is_board_member(uuid),
  public.board_role(uuid),
  public.can_edit_board(uuid),
  public.is_board_admin(uuid)
from public;
grant execute on function
  public.is_super_admin(),
  public.is_board_member(uuid),
  public.board_role(uuid),
  public.can_edit_board(uuid),
  public.is_board_admin(uuid)
to authenticated;

-- =========================================================
-- ROW LEVEL SECURITY
-- =========================================================
alter table public.profiles      enable row level security;
alter table public.boards        enable row level security;
alter table public.board_members enable row level security;
alter table public.lists         enable row level security;
alter table public.cards         enable row level security;

-- ---------- PROFILES ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1 from public.board_members me
    join public.board_members them on them.board_id = me.board_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and platform_role = (select platform_role from public.profiles where id = auth.uid())
);

drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());

-- ---------- BOARDS ----------
drop policy if exists boards_select on public.boards;
create policy boards_select on public.boards for select to authenticated
using (public.is_board_member(id));

drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards for insert to authenticated
with check (created_by = auth.uid());

drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards for update to authenticated
using (public.is_board_admin(id)) with check (public.is_board_admin(id));

drop policy if exists boards_delete on public.boards;
create policy boards_delete on public.boards for delete to authenticated
using (public.is_board_admin(id));

-- ---------- BOARD_MEMBERS ----------
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

-- ---------- LISTS ----------
drop policy if exists lists_select on public.lists;
create policy lists_select on public.lists for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists lists_insert on public.lists;
create policy lists_insert on public.lists for insert to authenticated
with check (public.can_edit_board(board_id));

drop policy if exists lists_update on public.lists;
create policy lists_update on public.lists for update to authenticated
using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists lists_delete on public.lists;
create policy lists_delete on public.lists for delete to authenticated
using (public.can_edit_board(board_id));

-- ---------- CARDS ----------
drop policy if exists cards_select on public.cards;
create policy cards_select on public.cards for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists cards_insert on public.cards;
create policy cards_insert on public.cards for insert to authenticated
with check (public.can_edit_board(board_id) and created_by = auth.uid());

drop policy if exists cards_update on public.cards;
create policy cards_update on public.cards for update to authenticated
using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists cards_delete on public.cards;
create policy cards_delete on public.cards for delete to authenticated
using (public.can_edit_board(board_id));

-- =========================================================
-- MEMBERSHIP RPC + GUARDS
-- =========================================================

-- Add a member by email. Runs as definer so the email lookup bypasses the
-- profiles RLS (an admin can't yet SELECT a user they don't share a board with).
-- Caller must be a board admin. Upserts the role if already a member.
create or replace function public.add_board_member_by_email(
  p_board_id uuid,
  p_email text,
  p_role public.board_role
)
returns public.board_members
language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid;
  v_row public.board_members;
begin
  if not public.is_board_admin(p_board_id) then
    raise exception 'Hanya admin board yang dapat menambah anggota' using errcode = '42501';
  end if;

  select id into v_user_id from public.profiles where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Pengguna dengan email % belum terdaftar', p_email using errcode = 'P0002';
  end if;

  insert into public.board_members (board_id, user_id, role, added_by)
  values (p_board_id, v_user_id, p_role, auth.uid())
  on conflict (board_id, user_id) do update set role = excluded.role
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.add_board_member_by_email(uuid, text, public.board_role) from public;
grant execute on function public.add_board_member_by_email(uuid, text, public.board_role) to authenticated;

-- Prevent a board from ever losing its last admin (lockout protection).
create or replace function public.tg_guard_last_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_board uuid;
  v_admins int;
begin
  v_board := coalesce(old.board_id, new.board_id);

  -- Only relevant when an admin is being demoted or removed.
  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_admins
    from public.board_members
    where board_id = v_board and role = 'admin'
      and user_id <> old.user_id;
    if v_admins = 0 then
      raise exception 'Board harus memiliki minimal satu admin' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists board_members_guard_last_admin on public.board_members;
create trigger board_members_guard_last_admin
  before update or delete on public.board_members
  for each row execute function public.tg_guard_last_admin();

-- =========================================================
-- TABLE GRANTS
-- RLS still gates which rows are visible/mutable; these grants just let the
-- `authenticated` role reach the tables via the Data API. Works regardless of
-- the project's "Automatically expose new tables" setting. `anon` gets nothing
-- (every policy above is scoped `to authenticated`).
-- =========================================================
grant usage on schema public to authenticated;
grant select, insert, update, delete on
  public.profiles, public.boards, public.board_members, public.lists, public.cards
to authenticated;
