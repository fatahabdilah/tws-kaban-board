import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth/get-user';
import { createClient } from '@/lib/supabase/server';
import type { Workspace } from '@/lib/supabase/types';
import { Sidebar } from './sidebar';

type WsRow = { workspaces: Pick<Workspace, 'id' | 'name'> | null };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  if (!me) redirect('/login');

  const supabase = await createClient();
  const { data } = await supabase
    .from('workspace_members')
    .select('workspaces(id, name)')
    .order('created_at', { ascending: true })
    .returns<WsRow[]>();

  const workspaces = (data ?? [])
    .map((r) => r.workspaces)
    .filter((w): w is Pick<Workspace, 'id' | 'name'> => !!w);

  return (
    <div className="min-h-screen">
      <Sidebar profile={me.profile} workspaces={workspaces} />
      <main className="ml-65 min-h-screen">{children}</main>
    </div>
  );
}
