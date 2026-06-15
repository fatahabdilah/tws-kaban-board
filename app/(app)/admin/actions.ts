'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import type { PlatformRole } from '@/lib/supabase/types';

export async function setPlatformRole(userId: string, role: PlatformRole) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Defense-in-depth: confirm caller is a super admin (RLS also enforces this).
  const { data: isSuper } = await supabase.rpc('is_super_admin');
  if (!isSuper) throw new Error('Hanya super admin yang dapat mengubah peran platform.');
  if (userId === user.id) throw new Error('Anda tidak dapat mengubah peran Anda sendiri.');

  const { error } = await supabase.from('profiles').update({ platform_role: role }).eq('id', userId);
  if (error) throw new Error(error.message);
  revalidatePath('/admin');
}
