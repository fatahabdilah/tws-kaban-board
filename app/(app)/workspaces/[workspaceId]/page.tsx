import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { LayoutGrid, Users, Settings as SettingsIcon } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { requireUser } from '@/lib/auth/get-user';
import { RoleBadge } from '@/components/ui/RoleBadge';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { Board, BoardRole, MemberWithProfile, Workspace } from '@/lib/supabase/types';
import { NewBoardButton } from './new-board-button';
import { BoardCard } from './board-card';
import { MembersPanel } from './members-panel';
import { SettingsPanel } from './settings-panel';

type Tab = 'boards' | 'members' | 'settings';

export default async function WorkspacePage({
  params,
  searchParams,
}: {
  params: Promise<{ workspaceId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { workspaceId } = await params;
  const { tab: rawTab } = await searchParams;
  const me = await requireUser();
  const supabase = await createClient();

  const { data: workspace } = await supabase
    .from('workspaces')
    .select('*')
    .eq('id', workspaceId)
    .maybeSingle<Workspace>();
  if (!workspace) notFound();

  const [{ data: role }, { data: boards }, { data: rawMembers }] = await Promise.all([
    supabase.rpc('workspace_role', { p_ws_id: workspaceId }),
    supabase
      .from('boards')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .returns<Board[]>(),
    supabase
      .from('workspace_members')
      .select('user_id, role, division, job_title, profile:profiles(id, email, full_name, avatar_url)')
      .eq('workspace_id', workspaceId)
      .returns<MemberWithProfile[]>(),
  ]);

  const effectiveRole = (role as BoardRole | null) ?? 'viewer';
  const isAdmin = me.profile.platform_role === 'super_admin' || effectiveRole === 'admin';
  const canEdit = isAdmin || effectiveRole === 'member';
  const members = (rawMembers ?? []).filter((m) => m.profile) as MemberWithProfile[];

  let tab: Tab = rawTab === 'members' || rawTab === 'settings' ? rawTab : 'boards';
  if (tab === 'settings' && !isAdmin) redirect(`/workspaces/${workspaceId}`);

  const tabs: { key: Tab; label: string; icon: React.ElementType; show: boolean }[] = [
    { key: 'boards', label: 'Boards', icon: LayoutGrid, show: true },
    { key: 'members', label: 'Members', icon: Users, show: true },
    { key: 'settings', label: 'Settings', icon: SettingsIcon, show: isAdmin },
  ];

  return (
    <div className="mx-auto max-w-6xl px-8 py-10">
      <Link href="/workspaces" className="text-xs text-zinc-500 transition-colors hover:text-zinc-300">
        ← Semua workspace
      </Link>

      <div className="mb-6 mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{workspace.name}</h1>
            <RoleBadge role={effectiveRole} />
          </div>
          {workspace.description && <p className="mt-1 text-sm text-zinc-400">{workspace.description}</p>}
        </div>
        <Link
          href={`/workspaces/${workspaceId}?tab=members`}
          className="flex -space-x-2"
          title="Lihat anggota"
        >
          {members.slice(0, 6).map((m) => (
            <Avatar
              key={m.user_id}
              name={m.profile.full_name}
              email={m.profile.email}
              url={m.profile.avatar_url}
              size={30}
              className="ring-2 ring-background"
            />
          ))}
          {members.length > 6 && (
            <span className="flex h-7.5 w-7.5 items-center justify-center rounded-full bg-sidebar-hover text-[11px] text-zinc-400 ring-2 ring-background">
              +{members.length - 6}
            </span>
          )}
        </Link>
      </div>

      {/* Tab bar (shadcn segmented) */}
      <div className="mb-6 inline-flex items-center gap-1 rounded-lg bg-muted p-1 text-muted-foreground">
        {tabs
          .filter((t) => t.show)
          .map((t) => {
            const active = tab === t.key;
            return (
              <Link
                key={t.key}
                href={`/workspaces/${workspaceId}${t.key === 'boards' ? '' : `?tab=${t.key}`}`}
                className={cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium transition-all',
                  active ? 'bg-card text-foreground shadow-sm' : 'hover:text-foreground'
                )}
              >
                <t.icon className="h-4 w-4" />
                {t.label}
              </Link>
            );
          })}
      </div>

      {/* Tab content */}
      {tab === 'boards' && (
        <>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Boards ({boards?.length ?? 0})</h2>
            {canEdit && <NewBoardButton workspaceId={workspaceId} />}
          </div>
          {(boards?.length ?? 0) === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-zinc-800 py-16 text-center">
              <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-sidebar-hover text-zinc-500">
                <LayoutGrid className="h-6 w-6" />
              </span>
              <p className="text-sm font-medium">Belum ada board</p>
              <p className="mt-1 max-w-xs text-sm text-zinc-500">
                {canEdit ? 'Buat board pertama di workspace ini.' : 'Belum ada board untuk ditampilkan.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {(boards ?? []).map((board) => (
                <BoardCard
                  key={board.id}
                  board={board}
                  workspaceId={workspaceId}
                  canEdit={canEdit}
                  canDelete={isAdmin}
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'members' && (
        <MembersPanel
          workspaceId={workspaceId}
          members={members}
          isAdmin={isAdmin}
          currentUserId={me.userId}
        />
      )}

      {tab === 'settings' && isAdmin && (
        <SettingsPanel
          workspaceId={workspaceId}
          name={workspace.name}
          description={workspace.description}
        />
      )}
    </div>
  );
}
