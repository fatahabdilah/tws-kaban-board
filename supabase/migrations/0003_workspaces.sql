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
