-- ============================================================
-- supabase/migrations/0001_init.sql
-- ============================================================
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


-- ============================================================
-- supabase/migrations/0002_member_division.sql
-- ============================================================
-- =========================================================
-- Add division + job_title to board membership.
-- Run AFTER 0001_init.sql. Idempotent.
-- =========================================================

alter table public.board_members
  add column if not exists division  text,
  add column if not exists job_title text;

-- Recreate the invite RPC to optionally set division + job_title at invite time.
drop function if exists public.add_board_member_by_email(uuid, text, public.board_role);

create or replace function public.add_board_member_by_email(
  p_board_id  uuid,
  p_email     text,
  p_role      public.board_role,
  p_division  text default null,
  p_job_title text default null
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

  insert into public.board_members (board_id, user_id, role, division, job_title, added_by)
  values (
    p_board_id, v_user_id, p_role,
    nullif(btrim(coalesce(p_division, '')), ''),
    nullif(btrim(coalesce(p_job_title, '')), ''),
    auth.uid()
  )
  on conflict (board_id, user_id) do update set
    role      = excluded.role,
    division  = coalesce(excluded.division,  public.board_members.division),
    job_title = coalesce(excluded.job_title, public.board_members.job_title)
  returning * into v_row;

  return v_row;
end $$;

revoke all on function public.add_board_member_by_email(uuid, text, public.board_role, text, text) from public;
grant execute on function public.add_board_member_by_email(uuid, text, public.board_role, text, text) to authenticated;


-- ============================================================
-- supabase/migrations/0003_workspaces.sql
-- ============================================================
-- =========================================================
-- Introduce WORKSPACES as the membership layer.
-- Hierarchy: workspaces -> boards -> lists -> cards.
-- Membership (role + division + job_title) moves from board to workspace.
-- Run AFTER 0001 + 0002. Idempotent-ish (safe to run once).
-- =========================================================

-- ---------- NEW TABLES ----------
create table if not exists public.workspaces (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(name) between 1 and 120),
  description text,
  owner_id    uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists workspaces_owner_idx on public.workspaces(owner_id);

create table if not exists public.workspace_members (
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  user_id      uuid not null references public.profiles(id) on delete cascade,
  role         public.board_role not null default 'member',
  division     text,
  job_title    text,
  added_by     uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  primary key (workspace_id, user_id)
);
create index if not exists workspace_members_user_idx on public.workspace_members(user_id);
create index if not exists workspace_members_ws_idx   on public.workspace_members(workspace_id);

-- ---------- LINK BOARDS -> WORKSPACES ----------
alter table public.boards add column if not exists workspace_id uuid references public.workspaces(id) on delete cascade;
create index if not exists boards_workspace_idx on public.boards(workspace_id);

-- ---------- BACKFILL EXISTING DATA ----------
do $$
declare
  b record;
  ws_id uuid;
begin
  -- One workspace per existing board owner; attach the owner's boards to it.
  for b in select * from public.boards where workspace_id is null loop
    select id into ws_id from public.workspaces where owner_id = b.created_by limit 1;
    if ws_id is null then
      insert into public.workspaces (name, owner_id)
      values ('Workspace Saya', b.created_by)
      returning id into ws_id;
    end if;
    update public.boards set workspace_id = ws_id where id = b.id;
  end loop;

  -- Migrate board memberships -> workspace memberships (if board_members exists).
  if exists (select 1 from information_schema.tables
             where table_schema = 'public' and table_name = 'board_members') then
    insert into public.workspace_members (workspace_id, user_id, role, division, job_title, added_by)
    select bo.workspace_id, bm.user_id, bm.role, bm.division, bm.job_title, bm.added_by
    from public.board_members bm
    join public.boards bo on bo.id = bm.board_id
    where bo.workspace_id is not null
    on conflict (workspace_id, user_id) do nothing;
  end if;
end $$;

alter table public.boards alter column workspace_id set not null;

-- =========================================================
-- WORKSPACE HELPER FUNCTIONS (definer; break recursion)
-- =========================================================
create or replace function public.is_workspace_member(p_ws_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_super_admin()
      or exists (
        select 1 from public.workspace_members
        where workspace_id = p_ws_id and user_id = auth.uid()
      );
$$;

create or replace function public.workspace_role(p_ws_id uuid)
returns public.board_role language sql stable security definer set search_path = public as $$
  select case
    when public.is_super_admin() then 'admin'::public.board_role
    else (
      select role from public.workspace_members
      where workspace_id = p_ws_id and user_id = auth.uid()
    )
  end;
$$;

create or replace function public.can_edit_workspace(p_ws_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.workspace_role(p_ws_id) in ('admin','member');
$$;

create or replace function public.is_workspace_admin(p_ws_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.workspace_role(p_ws_id) = 'admin';
$$;

-- Board-level helpers now RESOLVE to the board's workspace (keeps existing
-- lists/cards policies + the board view working unchanged).
create or replace function public.is_board_member(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_workspace_member((select workspace_id from public.boards where id = p_board_id));
$$;

create or replace function public.board_role(p_board_id uuid)
returns public.board_role language sql stable security definer set search_path = public as $$
  select public.workspace_role((select workspace_id from public.boards where id = p_board_id));
$$;

create or replace function public.can_edit_board(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.can_edit_workspace((select workspace_id from public.boards where id = p_board_id));
$$;

create or replace function public.is_board_admin(p_board_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_workspace_admin((select workspace_id from public.boards where id = p_board_id));
$$;

revoke all on function
  public.is_workspace_member(uuid), public.workspace_role(uuid),
  public.can_edit_workspace(uuid), public.is_workspace_admin(uuid)
from public;
grant execute on function
  public.is_workspace_member(uuid), public.workspace_role(uuid),
  public.can_edit_workspace(uuid), public.is_workspace_admin(uuid)
to authenticated;

-- =========================================================
-- RLS: workspaces + workspace_members
-- =========================================================
alter table public.workspaces        enable row level security;
alter table public.workspace_members enable row level security;

drop policy if exists ws_select on public.workspaces;
create policy ws_select on public.workspaces for select to authenticated
using (public.is_workspace_member(id));

drop policy if exists ws_insert on public.workspaces;
create policy ws_insert on public.workspaces for insert to authenticated
with check (owner_id = auth.uid());

drop policy if exists ws_update on public.workspaces;
create policy ws_update on public.workspaces for update to authenticated
using (public.is_workspace_admin(id)) with check (public.is_workspace_admin(id));

drop policy if exists ws_delete on public.workspaces;
create policy ws_delete on public.workspaces for delete to authenticated
using (public.is_workspace_admin(id));

drop policy if exists wm_select on public.workspace_members;
create policy wm_select on public.workspace_members for select to authenticated
using (public.is_workspace_member(workspace_id));

drop policy if exists wm_insert on public.workspace_members;
create policy wm_insert on public.workspace_members for insert to authenticated
with check (public.is_workspace_admin(workspace_id));

drop policy if exists wm_update on public.workspace_members;
create policy wm_update on public.workspace_members for update to authenticated
using (public.is_workspace_admin(workspace_id)) with check (public.is_workspace_admin(workspace_id));

drop policy if exists wm_delete on public.workspace_members;
create policy wm_delete on public.workspace_members for delete to authenticated
using (public.is_workspace_admin(workspace_id) or user_id = auth.uid());

-- =========================================================
-- UPDATE BOARD POLICIES for the workspace model
-- =========================================================
drop policy if exists boards_insert on public.boards;
create policy boards_insert on public.boards for insert to authenticated
with check (created_by = auth.uid() and public.can_edit_workspace(workspace_id));

drop policy if exists boards_update on public.boards;
create policy boards_update on public.boards for update to authenticated
using (public.can_edit_board(id)) with check (public.is_workspace_member(workspace_id));

drop policy if exists boards_delete on public.boards;
create policy boards_delete on public.boards for delete to authenticated
using (public.is_board_admin(id));

-- profiles visibility: co-members now share a WORKSPACE (not a board).
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or exists (
    select 1 from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid() and them.user_id = profiles.id
  )
);

-- =========================================================
-- TRIGGERS
-- =========================================================
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists workspaces_updated on public.workspaces;
create trigger workspaces_updated before update on public.workspaces
  for each row execute function public.tg_set_updated_at();

-- Workspace creator becomes its admin (atomic, sidesteps insert-RLS chicken-and-egg).
create or replace function public.tg_workspace_add_owner_admin()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.workspace_members (workspace_id, user_id, role, added_by)
  values (new.id, new.owner_id, 'admin', new.owner_id)
  on conflict (workspace_id, user_id) do nothing;
  return new;
end $$;

drop trigger if exists workspaces_add_owner_admin on public.workspaces;
create trigger workspaces_add_owner_admin after insert on public.workspaces
  for each row execute function public.tg_workspace_add_owner_admin();

-- Never leave a workspace without an admin.
create or replace function public.tg_guard_last_ws_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_admins int;
begin
  v_ws := coalesce(old.workspace_id, new.workspace_id);

  -- Skip the guard when the parent workspace is being deleted (cascade):
  -- RI cascade fires after the workspace row is removed, so it is gone here.
  if tg_op = 'DELETE' and not exists (select 1 from public.workspaces where id = v_ws) then
    return old;
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_admins
    from public.workspace_members
    where workspace_id = v_ws and role = 'admin' and user_id <> old.user_id;
    if v_admins = 0 then
      raise exception 'Workspace harus memiliki minimal satu admin' using errcode = 'P0001';
    end if;
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;

drop trigger if exists ws_members_guard_last_admin on public.workspace_members;
create trigger ws_members_guard_last_admin
  before update or delete on public.workspace_members
  for each row execute function public.tg_guard_last_ws_admin();

-- =========================================================
-- INVITE RPC (workspace-level)
-- =========================================================
create or replace function public.add_workspace_member_by_email(
  p_ws_id     uuid,
  p_email     text,
  p_role      public.board_role,
  p_division  text default null,
  p_job_title text default null
)
returns public.workspace_members
language plpgsql security definer set search_path = public as $$
declare v_user_id uuid; v_row public.workspace_members;
begin
  if not public.is_workspace_admin(p_ws_id) then
    raise exception 'Hanya admin workspace yang dapat menambah anggota' using errcode = '42501';
  end if;
  select id into v_user_id from public.profiles where lower(email) = lower(trim(p_email));
  if v_user_id is null then
    raise exception 'Pengguna dengan email % belum terdaftar', p_email using errcode = 'P0002';
  end if;
  insert into public.workspace_members (workspace_id, user_id, role, division, job_title, added_by)
  values (
    p_ws_id, v_user_id, p_role,
    nullif(btrim(coalesce(p_division, '')), ''),
    nullif(btrim(coalesce(p_job_title, '')), ''),
    auth.uid()
  )
  on conflict (workspace_id, user_id) do update set
    role      = excluded.role,
    division  = coalesce(excluded.division,  public.workspace_members.division),
    job_title = coalesce(excluded.job_title, public.workspace_members.job_title)
  returning * into v_row;
  return v_row;
end $$;

revoke all on function public.add_workspace_member_by_email(uuid, text, public.board_role, text, text) from public;
grant execute on function public.add_workspace_member_by_email(uuid, text, public.board_role, text, text) to authenticated;

-- =========================================================
-- GRANTS
-- =========================================================
grant select, insert, update, delete on public.workspaces, public.workspace_members to authenticated;

-- =========================================================
-- DROP OBSOLETE BOARD-MEMBERSHIP OBJECTS
-- =========================================================
drop trigger if exists boards_add_creator_admin on public.boards;
drop function if exists public.tg_board_add_creator_admin() cascade;

drop function if exists public.add_board_member_by_email(uuid, text, public.board_role) cascade;
drop function if exists public.add_board_member_by_email(uuid, text, public.board_role, text, text) cascade;

drop trigger if exists board_members_guard_last_admin on public.board_members;
drop function if exists public.tg_guard_last_admin() cascade;

drop table if exists public.board_members cascade;


-- ============================================================
-- supabase/migrations/0004_fix_last_admin_guard.sql
-- ============================================================
-- =========================================================
-- Fix: deleting a workspace failed with "Workspace harus memiliki
-- minimal satu admin". The ON DELETE CASCADE removes workspace_members,
-- which fired the last-admin guard. Skip the guard when the parent
-- workspace itself is gone (cascade delete). Run AFTER 0003.
-- =========================================================

create or replace function public.tg_guard_last_ws_admin()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_ws uuid; v_admins int;
begin
  v_ws := coalesce(old.workspace_id, new.workspace_id);

  -- RI cascade fires AFTER the workspace row is deleted, so if the workspace
  -- no longer exists this DELETE is part of dropping the whole workspace —
  -- there is nothing to protect, allow it.
  if tg_op = 'DELETE' and not exists (select 1 from public.workspaces where id = v_ws) then
    return old;
  end if;

  if (tg_op = 'DELETE' and old.role = 'admin')
     or (tg_op = 'UPDATE' and old.role = 'admin' and new.role <> 'admin') then
    select count(*) into v_admins
    from public.workspace_members
    where workspace_id = v_ws and role = 'admin' and user_id <> old.user_id;
    if v_admins = 0 then
      raise exception 'Workspace harus memiliki minimal satu admin' using errcode = 'P0001';
    end if;
  end if;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end $$;


-- ============================================================
-- supabase/migrations/0005_board_members_and_avatars.sql
-- ============================================================
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


-- ============================================================
-- supabase/migrations/0006_fix_profiles_recursion.sql
-- ============================================================
-- =========================================================
-- Fix: "infinite recursion detected in policy for relation profiles".
-- Cause: a profiles policy read the profiles table directly (the
-- platform_role self-check in profiles_update_self, and the co-member
-- check). Move every check into SECURITY DEFINER helpers (which bypass
-- RLS) so no profiles policy ever queries profiles directly.
-- Run AFTER 0001..0005. Idempotent.
-- =========================================================

-- Ensure the super-admin check bypasses RLS (SECURITY DEFINER).
create or replace function public.is_super_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and platform_role = 'super_admin'
  );
$$;

-- Definer helper: does the caller share any workspace with the target user?
create or replace function public.shares_workspace_with(p_target uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from public.workspace_members me
    join public.workspace_members them on them.workspace_id = me.workspace_id
    where me.user_id = auth.uid() and them.user_id = p_target
  );
$$;

revoke all on function public.is_super_admin(), public.shares_workspace_with(uuid) from public;
grant execute on function public.is_super_admin(), public.shares_workspace_with(uuid) to authenticated;

-- ---------- PROFILES SELECT (no direct profiles read) ----------
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select to authenticated
using (
  id = auth.uid()
  or public.is_super_admin()
  or public.shares_workspace_with(id)
);

-- ---------- Protect platform_role via trigger, simplify update policy ----------
-- A user may update their own profile, but must not change their own
-- platform_role. Enforce in a trigger so the policy needn't read profiles.
create or replace function public.tg_protect_platform_role()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.platform_role is distinct from old.platform_role and not public.is_super_admin() then
    new.platform_role := old.platform_role;
  end if;
  return new;
end $$;

drop trigger if exists profiles_protect_role on public.profiles;
create trigger profiles_protect_role before update on public.profiles
  for each row execute function public.tg_protect_platform_role();

drop policy if exists profiles_update_self on public.profiles;
create policy profiles_update_self on public.profiles for update to authenticated
using (id = auth.uid()) with check (id = auth.uid());

-- profiles_update_admin (super admin may update anyone) stays as-is; recreate
-- defensively in case it was missing.
drop policy if exists profiles_update_admin on public.profiles;
create policy profiles_update_admin on public.profiles for update to authenticated
using (public.is_super_admin()) with check (public.is_super_admin());


-- ============================================================
-- supabase/migrations/0007_card_covers_labels_board_bg.sql
-- ============================================================
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


-- ============================================================
-- supabase/migrations/0008_attachments_checklists.sql
-- ============================================================
-- =========================================================
-- Card attachments (files) + checklists. Run AFTER 0001..0007.
-- board_id is denormalized for RLS (synced from the card via trigger).
-- =========================================================

-- ---------- ATTACHMENTS ----------
create table if not exists public.card_attachments (
  id          uuid primary key default gen_random_uuid(),
  card_id     uuid not null references public.cards(id) on delete cascade,
  board_id    uuid not null references public.boards(id) on delete cascade,
  name        text not null,
  url         text not null,
  mime        text,
  size        bigint,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists card_attachments_card_idx  on public.card_attachments(card_id);
create index if not exists card_attachments_board_idx on public.card_attachments(board_id);

-- ---------- CHECKLIST ITEMS ----------
create table if not exists public.card_checklist_items (
  id         uuid primary key default gen_random_uuid(),
  card_id    uuid not null references public.cards(id) on delete cascade,
  board_id   uuid not null references public.boards(id) on delete cascade,
  text       text not null check (char_length(text) between 1 and 500),
  done       boolean not null default false,
  position   numeric not null,
  created_at timestamptz not null default now()
);
create index if not exists checklist_card_idx  on public.card_checklist_items(card_id);
create index if not exists checklist_board_idx on public.card_checklist_items(board_id);

-- ---------- board_id sync trigger (shared) ----------
create or replace function public.tg_sync_board_from_card()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select board_id into new.board_id from public.cards where id = new.card_id;
  if new.board_id is null then
    raise exception 'card % not found', new.card_id;
  end if;
  return new;
end $$;

drop trigger if exists attachments_sync_board on public.card_attachments;
create trigger attachments_sync_board before insert on public.card_attachments
  for each row execute function public.tg_sync_board_from_card();

drop trigger if exists checklist_sync_board on public.card_checklist_items;
create trigger checklist_sync_board before insert on public.card_checklist_items
  for each row execute function public.tg_sync_board_from_card();

-- ---------- RLS ----------
alter table public.card_attachments     enable row level security;
alter table public.card_checklist_items enable row level security;

drop policy if exists att_select on public.card_attachments;
create policy att_select on public.card_attachments for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists att_insert on public.card_attachments;
create policy att_insert on public.card_attachments for insert to authenticated
with check (public.can_edit_board(board_id) and uploaded_by = auth.uid());

drop policy if exists att_delete on public.card_attachments;
create policy att_delete on public.card_attachments for delete to authenticated
using (public.can_edit_board(board_id));

drop policy if exists chk_select on public.card_checklist_items;
create policy chk_select on public.card_checklist_items for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists chk_insert on public.card_checklist_items;
create policy chk_insert on public.card_checklist_items for insert to authenticated
with check (public.can_edit_board(board_id));

drop policy if exists chk_update on public.card_checklist_items;
create policy chk_update on public.card_checklist_items for update to authenticated
using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists chk_delete on public.card_checklist_items;
create policy chk_delete on public.card_checklist_items for delete to authenticated
using (public.can_edit_board(board_id));

grant select, insert, update, delete on public.card_attachments, public.card_checklist_items to authenticated;


-- ============================================================
-- supabase/migrations/0009_board_labels.sql
-- ============================================================
-- =========================================================
-- Named, colored labels per board (Trello-style). Cards reference
-- label ids via the existing cards.labels text[] column.
-- Run AFTER 0001..0008.
-- =========================================================

create table if not exists public.board_labels (
  id         uuid primary key default gen_random_uuid(),
  board_id   uuid not null references public.boards(id) on delete cascade,
  name       text not null default '',
  color      text not null,
  created_at timestamptz not null default now()
);
create index if not exists board_labels_board_idx on public.board_labels(board_id);

alter table public.board_labels enable row level security;

drop policy if exists lbl_select on public.board_labels;
create policy lbl_select on public.board_labels for select to authenticated
using (public.is_board_member(board_id));

drop policy if exists lbl_insert on public.board_labels;
create policy lbl_insert on public.board_labels for insert to authenticated
with check (public.can_edit_board(board_id));

drop policy if exists lbl_update on public.board_labels;
create policy lbl_update on public.board_labels for update to authenticated
using (public.can_edit_board(board_id)) with check (public.can_edit_board(board_id));

drop policy if exists lbl_delete on public.board_labels;
create policy lbl_delete on public.board_labels for delete to authenticated
using (public.can_edit_board(board_id));

grant select, insert, update, delete on public.board_labels to authenticated;

-- ---------- Seed default labels on new boards ----------
create or replace function public.tg_board_seed_labels()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.board_labels (board_id, name, color)
  select new.id, '', c
  from unnest(array['#22c55e','#eab308','#f97316','#ef4444','#3b82f6','#a855f7']) as c;
  return new;
end $$;

drop trigger if exists boards_seed_labels on public.boards;
create trigger boards_seed_labels after insert on public.boards
  for each row execute function public.tg_board_seed_labels();

-- ---------- Backfill defaults for existing boards ----------
insert into public.board_labels (board_id, name, color)
select b.id, '', c
from public.boards b
cross join unnest(array['#22c55e','#eab308','#f97316','#ef4444','#3b82f6','#a855f7']) as c
where not exists (select 1 from public.board_labels bl where bl.board_id = b.id);


