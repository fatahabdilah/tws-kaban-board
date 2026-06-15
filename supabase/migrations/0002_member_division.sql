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
