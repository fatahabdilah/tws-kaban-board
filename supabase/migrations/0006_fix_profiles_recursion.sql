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
