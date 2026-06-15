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
