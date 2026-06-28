'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import type { BoardRole } from '@/lib/supabase/types';

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, userId: user.id };
}

/* --------------------------- WORKSPACES --------------------------- */

export async function createWorkspace(formData: FormData) {
  const name = String(formData.get('name') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!name) throw new Error('Nama workspace wajib diisi.');

  const { supabase, userId } = await authed();

  // Tulis lewat SECURITY DEFINER RPC (tidak bergantung auth.uid()).
  // owner_id diambil dari getUser() yang sudah terverifikasi di server.
  const { data, error } = await supabase
    .rpc('create_workspace', { p_owner_id: userId, p_name: name, p_description: description })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath('/workspaces');
  redirect(`/workspaces/${(data as { id: string }).id}`);
}

export async function renameWorkspace(workspaceId: string, name: string) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error('Nama tidak boleh kosong.');
  const { supabase } = await authed();
  const { error } = await supabase.from('workspaces').update({ name: trimmed }).eq('id', workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath('/workspaces');
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function updateWorkspace(
  workspaceId: string,
  fields: { name?: string; description?: string | null }
) {
  const patch: Record<string, unknown> = {};
  if (fields.name !== undefined) {
    const t = fields.name.trim();
    if (!t) throw new Error('Nama tidak boleh kosong.');
    patch.name = t;
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (Object.keys(patch).length === 0) return;

  const { supabase } = await authed();
  const { error } = await supabase.from('workspaces').update(patch).eq('id', workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath('/workspaces');
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function deleteWorkspace(workspaceId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('workspaces').delete().eq('id', workspaceId);
  if (error) throw new Error(error.message);
  revalidatePath('/workspaces');
  redirect('/workspaces');
}

/* ----------------------------- BOARDS ----------------------------- */

export async function createBoard(workspaceId: string, formData: FormData) {
  const title = String(formData.get('title') ?? '').trim();
  const description = String(formData.get('description') ?? '').trim() || null;
  if (!title) throw new Error('Judul board wajib diisi.');

  const { supabase, userId } = await authed();
  const { data, error } = await supabase
    .from('boards')
    .insert({ workspace_id: workspaceId, title, description, created_by: userId })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  revalidatePath(`/workspaces/${workspaceId}`);
  redirect(`/boards/${data!.id}`);
}

export async function updateBoard(
  workspaceId: string,
  boardId: string,
  fields: { title?: string; description?: string | null }
) {
  const { supabase } = await authed();
  const patch: Record<string, unknown> = {};
  if (fields.title !== undefined) {
    const t = fields.title.trim();
    if (!t) throw new Error('Judul board tidak boleh kosong.');
    patch.title = t;
  }
  if (fields.description !== undefined) patch.description = fields.description?.trim() || null;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase.from('boards').update(patch).eq('id', boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
  revalidatePath(`/boards/${boardId}`);
}

export async function deleteBoard(workspaceId: string, boardId: string) {
  const { supabase } = await authed();
  const { error } = await supabase.from('boards').delete().eq('id', boardId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}

/* --------------------------- MEMBERSHIP --------------------------- */

export async function addMember(
  workspaceId: string,
  email: string,
  role: BoardRole,
  division?: string,
  jobTitle?: string
) {
  const trimmed = email.trim();
  if (!trimmed) throw new Error('Email wajib diisi.');
  const { supabase } = await authed();
  const { error } = await supabase.rpc('add_workspace_member_by_email', {
    p_ws_id: workspaceId,
    p_email: trimmed,
    p_role: role,
    p_division: division?.trim() || null,
    p_job_title: jobTitle?.trim() || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function changeMemberRole(workspaceId: string, userId: string, role: BoardRole) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function removeMember(workspaceId: string, userId: string) {
  const { supabase } = await authed();
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}

export async function updateMemberMeta(
  workspaceId: string,
  userId: string,
  fields: { division?: string | null; job_title?: string | null }
) {
  const { supabase } = await authed();
  const patch: Record<string, unknown> = {};
  if (fields.division !== undefined) patch.division = fields.division?.trim() || null;
  if (fields.job_title !== undefined) patch.job_title = fields.job_title?.trim() || null;
  if (Object.keys(patch).length === 0) return;

  const { error } = await supabase
    .from('workspace_members')
    .update(patch)
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
  revalidatePath(`/workspaces/${workspaceId}`);
}
