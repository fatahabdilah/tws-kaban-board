import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Users, Briefcase, LayoutGrid, StickyNote } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/get-user';
import { Avatar } from '@/components/ui/Avatar';
import { Card } from '@/components/ui/card';
import type { Profile, Workspace } from '@/lib/supabase/types';
import { RoleToggle } from './role-toggle';

type WorkspaceWithOwner = Workspace & { owner: Pick<Profile, 'email' | 'full_name'> | null };

function StatCard({
  icon: Icon,
  label,
  value,
  i,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  i: number;
}) {
  return (
    <Card
      interactive
      style={{ '--i': i } as React.CSSProperties}
      className="group animate-fade-up p-5 hover:border-zinc-700"
    >
      <div className="mb-3 flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary-light transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
          <Icon className="h-4 w-4" />
        </span>
      </div>
      <p className="text-2xl font-semibold tracking-tight tabular-nums">{value}</p>
    </Card>
  );
}

export default async function AdminPage() {
  const me = await requireUser();
  if (me.profile.platform_role !== 'super_admin') redirect('/workspaces');

  const supabase = await createClient();

  const [usersC, wsC, boardsC, cardsC, profilesRes, workspacesRes] = await Promise.all([
    supabase.from('profiles').select('*', { count: 'exact', head: true }),
    supabase.from('workspaces').select('*', { count: 'exact', head: true }),
    supabase.from('boards').select('*', { count: 'exact', head: true }),
    supabase.from('cards').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('*').order('created_at', { ascending: true }).returns<Profile[]>(),
    supabase
      .from('workspaces')
      .select('*, owner:profiles!workspaces_owner_id_fkey(email, full_name)')
      .order('created_at', { ascending: false })
      .returns<WorkspaceWithOwner[]>(),
  ]);

  const profiles = profilesRes.data ?? [];
  const workspaces = workspacesRes.data ?? [];

  return (
    <div className="mx-auto max-w-5xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Panel Admin</h1>
      <p className="mt-1 text-sm text-zinc-400">Ringkasan platform &amp; kelola pengguna.</p>

      {/* Stats */}
      <section className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={Users} label="Pengguna" value={usersC.count ?? 0} i={0} />
        <StatCard icon={Briefcase} label="Workspace" value={wsC.count ?? 0} i={1} />
        <StatCard icon={LayoutGrid} label="Board" value={boardsC.count ?? 0} i={2} />
        <StatCard icon={StickyNote} label="Kartu" value={cardsC.count ?? 0} i={3} />
      </section>

      {/* Users */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Pengguna ({profiles.length})</h2>
        <Card className="overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-surface text-left text-xs text-zinc-500">
              <tr>
                <th className="px-4 py-3 font-medium">Pengguna</th>
                <th className="px-4 py-3 font-medium">Peran platform</th>
                <th className="px-4 py-3 font-medium text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-card-border">
              {profiles.map((p) => (
                <tr key={p.id} className="bg-card transition-colors hover:bg-white/2">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={p.full_name} email={p.email} url={p.avatar_url} size={32} />
                      <div className="leading-tight">
                        <p className="text-zinc-100">{p.full_name || '—'}</p>
                        <p className="text-[11px] text-zinc-500">{p.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={
                        p.platform_role === 'super_admin'
                          ? 'rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary-light'
                          : 'rounded-full bg-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-300'
                      }
                    >
                      {p.platform_role === 'super_admin' ? 'Super Admin' : 'User'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end">
                      <RoleToggle userId={p.id} role={p.platform_role} self={p.id === me.userId} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </section>

      {/* Workspaces */}
      <section className="mt-10">
        <h2 className="mb-3 text-sm font-medium text-zinc-300">Semua workspace ({workspaces.length})</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {workspaces.map((w) => (
            <Link
              key={w.id}
              href={`/workspaces/${w.id}`}
              className="lift group flex items-center gap-3 rounded-xl border border-card-border bg-card p-4 hover:border-zinc-600"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary-light transition-transform duration-300 group-hover:scale-105">
                <Briefcase className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm text-zinc-100">{w.name}</p>
                <p className="truncate text-[11px] text-zinc-500">
                  {w.owner?.full_name || w.owner?.email || 'owner?'}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
