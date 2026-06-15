'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { appendPosition } from '@/lib/positions';

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, userId: user.id };
}

function touch(boardId: string) {
  revalidatePath(`/boards/${boardId}`);
}

/* ----------------------------- LISTS ----------------------------- */

export async function createList(boardId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Judul list wajib diisi.');
  const { supabase } = await authed();

  const { data: last } = await supabase
    .from('lists')
    .select('position')
    .eq('board_id', boardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase
    .from('lists')
    .insert({ board_id: boardId, title: trimmed, position: appendPosition(last?.position) });
  if (error) throw error;
  touch(boardId);
}

export async function renameList(boardId: string, listId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Judul tidak boleh kosong.');
  const { supabase } = await authed();
  const { error } = await supabase.from('lists').update({ title: trimmed }).eq('id', listId);
  if (error) throw error;
  touch(boardId);
}

export async function deleteList(boardId: string, listId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('lists').delete().eq('id', listId);
  if (error) throw error;
  touch(boardId);
}

export async function reorderList(boardId: string, listId: string, position: number) {
  const { supabase } = await authed();
  const { error } = await supabase.from('lists').update({ position }).eq('id', listId);
  if (error) throw error;
  touch(boardId);
}

/* ----------------------------- CARDS ----------------------------- */

export async function createCard(boardId: string, listId: string, title: string) {
  const trimmed = title.trim();
  if (!trimmed) throw new Error('Judul kartu wajib diisi.');
  const { supabase, userId } = await authed();

  const { data: last } = await supabase
    .from('cards')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('cards').insert({
    board_id: boardId,
    list_id: listId,
    title: trimmed,
    position: appendPosition(last?.position),
    created_by: userId,
  });
  if (error) throw error;
  touch(boardId);
}

export async function updateCard(
  boardId: string,
  cardId: string,
  fields: {
    title?: string;
    description?: string | null;
    due_date?: string | null;
    assignee_id?: string | null;
    cover_url?: string | null;
    labels?: string[];
  }
) {
  const { supabase } = await authed();
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    const t = fields.title.trim();
    if (!t) throw new Error('Judul tidak boleh kosong.');
    patch.title = t;
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (fields.due_date !== undefined) patch.due_date = fields.due_date || null;
  if (fields.assignee_id !== undefined) patch.assignee_id = fields.assignee_id || null;
  if (fields.cover_url !== undefined) patch.cover_url = fields.cover_url || null;
  if (fields.labels !== undefined) patch.labels = fields.labels;

  const { error } = await supabase.from('cards').update(patch).eq('id', cardId);
  if (error) throw error;
  touch(boardId);
}

/* ------------------------- BOARD LABELS ------------------------- */

export async function createBoardLabel(boardId: string, name: string, color: string) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('board_labels')
    .insert({ board_id: boardId, name: name.trim(), color });
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function updateBoardLabel(
  boardId: string,
  labelId: string,
  fields: { name?: string; color?: string }
) {
  const { supabase } = await authed();
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) patch.name = fields.name.trim();
  if (fields.color !== undefined) patch.color = fields.color;
  if (Object.keys(patch).length === 0) return;
  const { error } = await supabase.from('board_labels').update(patch).eq('id', labelId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function deleteBoardLabel(boardId: string, labelId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('board_labels').delete().eq('id', labelId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function setBoardBackground(boardId: string, background: string | null) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('boards')
    .update({ background: background || null })
    .eq('id', boardId);
  if (error) throw error;
  touch(boardId);
}

export async function deleteCard(boardId: string, cardId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('cards').delete().eq('id', cardId);
  if (error) throw error;
  touch(boardId);
}

// Move/reorder a card: client computes the midpoint position + target list.
export async function moveCard(
  boardId: string,
  cardId: string,
  listId: string,
  position: number
) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('cards')
    .update({ list_id: listId, position })
    .eq('id', cardId);
  if (error) throw error;
  touch(boardId);
}

/* ------------------------- BOARD MEMBERS ------------------------- */
// Workspace membership stays in app/(app)/workspaces/actions.ts.
// These manage who is on a specific board (must already be a workspace member).

export async function addBoardMember(
  boardId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const { supabase } = await authed();
  const { error } = await supabase.rpc('add_board_member', {
    p_board_id: boardId,
    p_user_id: userId,
    p_role: role,
  });
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function changeBoardMemberRole(
  boardId: string,
  userId: string,
  role: 'admin' | 'member' | 'viewer'
) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('board_members')
    .update({ role })
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function removeBoardMember(boardId: string, userId: string) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

/* ------------------------- ATTACHMENTS ------------------------- */

export async function addAttachment(
  boardId: string,
  cardId: string,
  file: { name: string; url: string; mime?: string | null; size?: number | null }
) {
  const { supabase, userId } = await authed();
  const { error } = await supabase.from('card_attachments').insert({
    card_id: cardId,
    name: file.name,
    url: file.url,
    mime: file.mime ?? null,
    size: file.size ?? null,
    uploaded_by: userId,
  });
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function deleteAttachment(boardId: string, attachmentId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('card_attachments').delete().eq('id', attachmentId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

/* ------------------------- CHECKLIST ------------------------- */

export async function addChecklistItem(boardId: string, cardId: string, text: string) {
  const trimmed = text.trim();
  if (!trimmed) throw new Error('Teks checklist wajib diisi.');
  const { supabase } = await authed();

  const { data: last } = await supabase
    .from('card_checklist_items')
    .select('position')
    .eq('card_id', cardId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { error } = await supabase.from('card_checklist_items').insert({
    card_id: cardId,
    text: trimmed,
    position: appendPosition(last?.position),
  });
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function toggleChecklistItem(boardId: string, itemId: string, done: boolean) {
  const { supabase } = await authed();
  const { error } = await supabase.from('card_checklist_items').update({ done }).eq('id', itemId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function deleteChecklistItem(boardId: string, itemId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('card_checklist_items').delete().eq('id', itemId);
  if (error) throw new Error(error.message);
  touch(boardId);
}

export async function leaveBoard(boardId: string) {
  const { supabase, userId } = await authed();
  const { error } = await supabase
    .from('board_members')
    .delete()
    .eq('board_id', boardId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
