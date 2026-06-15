'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  Home,
  Shield,
  LogOut,
  SquareKanban,
  Plus,
  ChevronDown,
  LayoutGrid,
  Users,
  Settings,
} from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { signOut } from '@/app/auth/actions';
import { cn } from '@/components/ui/cn';
import type { Profile, Workspace } from '@/lib/supabase/types';

const topBase =
  'group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors';
const topActive =
  'bg-linear-to-br from-neutral-950 to-neutral-900 text-white outline outline-1 -outline-offset-1 outline-[#1a1a1a]';
const topIdle = 'text-white/50 hover:bg-white/5 hover:text-white';

function WorkspaceItem({
  ws,
  activeWsId,
  activeTab,
}: {
  ws: Pick<Workspace, 'id' | 'name'>;
  activeWsId: string | null;
  activeTab: 'boards' | 'members' | 'settings';
}) {
  const isCurrent = activeWsId === ws.id;
  const [open, setOpen] = useState(isCurrent);

  // Auto-expand when this workspace becomes the active route.
  useEffect(() => {
    if (isCurrent) setOpen(true);
  }, [isCurrent]);

  const sub = [
    { key: 'boards' as const, label: 'Boards', icon: LayoutGrid, href: `/workspaces/${ws.id}` },
    { key: 'members' as const, label: 'Members', icon: Users, href: `/workspaces/${ws.id}?tab=members` },
    { key: 'settings' as const, label: 'Settings', icon: Settings, href: `/workspaces/${ws.id}?tab=settings` },
  ];

  return (
    <div>
      {/* Workspace header row */}
      <div
        className={cn(
          'flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors',
          isCurrent ? 'bg-primary/15 text-primary-light' : 'text-zinc-200 hover:bg-white/5'
        )}
      >
        <Link href={`/workspaces/${ws.id}`} className="flex min-w-0 flex-1 items-center gap-2.5">
          <span
            className={cn(
              'flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[11px] font-bold',
              isCurrent ? 'bg-primary text-white' : 'bg-linear-to-br from-primary to-primary-deep text-white'
            )}
          >
            {ws.name.charAt(0).toUpperCase()}
          </span>
          <span className="truncate font-medium">{ws.name}</span>
        </Link>
        <button
          onClick={() => setOpen((o) => !o)}
          className="shrink-0 rounded p-0.5 opacity-60 transition-opacity hover:opacity-100"
          aria-label={open ? 'Tutup' : 'Buka'}
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform', open ? 'rotate-0' : '-rotate-90')} />
        </button>
      </div>

      {/* Sub-items */}
      {open && (
        <div className="mb-1 mt-0.5 space-y-0.5 pl-3">
          {sub.map((s) => {
            const active = isCurrent && activeTab === s.key;
            const isMembers = s.key === 'members';
            return (
              <div key={s.key} className="flex items-center">
                <Link
                  href={s.href}
                  className={cn(
                    'flex flex-1 items-center gap-2.5 rounded-lg px-3 py-1.5 text-sm transition-colors',
                    active ? 'bg-white/10 text-white' : 'text-white/50 hover:bg-white/5 hover:text-white'
                  )}
                >
                  <s.icon className="h-4 w-4 shrink-0" />
                  {s.label}
                </Link>
                {isMembers && (
                  <Link
                    href={`/workspaces/${ws.id}?tab=members`}
                    className="ml-1 rounded p-1 text-white/40 transition-colors hover:bg-white/5 hover:text-white"
                    aria-label="Tambah anggota"
                    title="Tambah anggota"
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function Sidebar({
  profile,
  workspaces,
}: {
  profile: Profile;
  workspaces: Pick<Workspace, 'id' | 'name'>[];
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isSuper = profile.platform_role === 'super_admin';

  const wsMatch = pathname.match(/^\/workspaces\/([^/]+)/);
  const activeWsId = wsMatch ? wsMatch[1] : null;
  const tabParam = searchParams.get('tab');
  const activeTab: 'boards' | 'members' | 'settings' =
    tabParam === 'members' || tabParam === 'settings' ? tabParam : 'boards';

  return (
    <aside className="fixed left-0 top-0 z-40 flex h-screen w-65 flex-col gap-4 overflow-y-auto bg-black px-2 py-4 sidebar-scroll">
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-3 pt-1">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
          <SquareKanban className="h-4.5 w-4.5" />
        </span>
        <div className="leading-tight">
          <p className="text-sm font-semibold">Kanban</p>
          <p className="text-[11px] text-zinc-500">Board workspace</p>
        </div>
      </div>

      {/* Top group */}
      <nav className="flex flex-col gap-1">
        <Link href="/workspaces" className={cn(topBase, pathname === '/workspaces' ? topActive : topIdle)}>
          <Home className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
          Beranda
        </Link>
        {isSuper && (
          <Link href="/admin" className={cn(topBase, pathname.startsWith('/admin') ? topActive : topIdle)}>
            <Shield className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
            Admin
          </Link>
        )}
      </nav>

      <div className="mx-3 h-px bg-[#1a1a1a]" />

      {/* Workspaces */}
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-1 flex items-center justify-between px-3">
          <span className="text-[10px] font-semibold uppercase tracking-wider text-zinc-600">
            Workspaces
          </span>
          <Link
            href="/workspaces"
            className="text-zinc-600 transition-colors hover:text-white"
            aria-label="Buat workspace"
            title="Buat / lihat workspace"
          >
            <Plus className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="-mr-1 flex-1 space-y-0.5 overflow-y-auto pr-1 sidebar-scroll">
          {workspaces.length === 0 ? (
            <p className="px-3 py-2 text-xs text-zinc-600">Belum ada workspace</p>
          ) : (
            workspaces.map((ws) => (
              <WorkspaceItem key={ws.id} ws={ws} activeWsId={activeWsId} activeTab={activeTab} />
            ))
          )}
        </div>
      </div>

      <div className="mx-auto h-px w-[75%] bg-[#1a1a1a]" />

      {/* User + sign out */}
      <div className="px-1">
        <Link
          href="/settings"
          className={cn(
            'mb-1 flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors',
            pathname.startsWith('/settings') ? 'bg-white/5' : 'hover:bg-white/5'
          )}
        >
          <Avatar name={profile.full_name} email={profile.email} url={profile.avatar_url} size={32} />
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
            <p className="truncate text-[11px] text-zinc-500">{isSuper ? 'Super Admin' : profile.email}</p>
          </div>
        </Link>
        <form action={signOut}>
          <button
            type="submit"
            className="group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm text-white/50 transition-colors hover:bg-white/5 hover:text-white"
          >
            <LogOut className="h-[18px] w-[18px] shrink-0 transition-transform duration-300 group-hover:-translate-y-0.5" />
            Keluar
          </button>
        </form>
      </div>
    </aside>
  );
}
