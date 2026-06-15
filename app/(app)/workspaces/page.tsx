import Link from 'next/link';
import { Users, Briefcase } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/get-user';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { BoardRole, Workspace } from '@/lib/supabase/types';
import { NewWorkspaceButton } from './new-workspace-button';

type MembershipRow = { role: BoardRole; workspaces: Workspace | null };

export default async function WorkspacesPage() {
  await requireUser();
  const supabase = await createClient();

  const { data } = await supabase
    .from('workspace_members')
    .select('role, workspaces(*)')
    .order('created_at', { ascending: false })
    .returns<MembershipRow[]>();

  const memberships = (data ?? []).filter((m) => m.workspaces) as MembershipRow[];

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Workspace</h1>
          <p className="mt-1 text-sm text-zinc-400">Ruang kerja yang Anda miliki atau ikuti.</p>
        </div>
        <NewWorkspaceButton />
      </div>

      {memberships.length === 0 ? (
        <div className="flex animate-fade-in flex-col items-center justify-center rounded-xl border border-dashed border-card-border py-20 text-center">
          <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-hover text-zinc-500">
            <Briefcase className="h-6 w-6" />
          </span>
          <p className="text-sm font-medium">Belum ada workspace</p>
          <p className="mt-1 max-w-xs text-sm text-zinc-500">
            Buat workspace pertama Anda, lalu undang anggota dan buat board di dalamnya.
          </p>
        </div>
      ) : (
        <div className="stagger grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {memberships.map(({ role, workspaces: ws }, i) => (
            <Link
              key={ws!.id}
              href={`/workspaces/${ws!.id}`}
              style={{ '--i': i } as React.CSSProperties}
              className="lift group flex flex-col rounded-xl border border-card-border bg-card p-5 hover:border-zinc-600"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary-light transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
                  <Briefcase className="h-5 w-5" />
                </span>
                <RoleBadge role={role} />
              </div>
              <h2 className="line-clamp-1 font-semibold text-white">{ws!.name}</h2>
              <p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-400">
                {ws!.description || 'Tanpa deskripsi.'}
              </p>
              <div className="mt-4 flex items-center gap-1.5 text-xs text-zinc-500">
                <Users className="h-3.5 w-3.5" />
                <span>Dibuat {new Date(ws!.created_at).toLocaleDateString('id-ID')}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
