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
