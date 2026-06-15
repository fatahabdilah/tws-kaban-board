'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');
  return { supabase, userId: user.id };
}

export async function updateProfile(fields: { full_name?: string; avatar_url?: string | null }) {
  const { supabase, userId } = await authed();
  const patch: Record<string, unknown> = {};
  if (fields.full_name !== undefined) patch.full_name = fields.full_name.trim() || null;
  if (fields.avatar_url !== undefined) patch.avatar_url = fields.avatar_url || null;
  if (Object.keys(patch).length === 0) return;

  // RLS (profiles_update_self) allows this but blocks changing platform_role.
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/', 'layout');
  revalidatePath('/settings');
}

export async function changePassword(newPassword: string) {
  if (newPassword.length < 6) throw new Error('Password minimal 6 karakter.');
  const { supabase } = await authed();
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
