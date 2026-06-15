import { cache } from 'react';
import { createClient } from '@/lib/supabase/server';
import type { Profile } from '@/lib/supabase/types';

// Request-cached current user + profile. Always uses getUser() (validates the
// JWT against the auth server) — never getSession() alone for authorization.
export const getCurrentUser = cache(async (): Promise<{
  userId: string;
  profile: Profile;
} | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single();

  if (!profile) return null;
  return { userId: user.id, profile };
});

export async function requireUser() {
  const me = await getCurrentUser();
  if (!me) throw new Error('Unauthorized');
  return me;
}
