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
