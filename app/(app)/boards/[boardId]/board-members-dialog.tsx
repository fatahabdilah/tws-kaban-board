'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, LogOut } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { BoardRole, MemberWithProfile } from '@/lib/supabase/types';
import { addBoardMember, changeBoardMemberRole, removeBoardMember, leaveBoard } from './actions';

const ROLES: { value: BoardRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

export function BoardMembersDialog({
  open,
  onClose,
  boardId,
  workspaceId,
  members,
  candidates,
  isAdmin,
  currentUserId,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string;
  workspaceId: string;
  members: MemberWithProfile[];
  candidates: MemberWithProfile[]; // workspace members
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [pick, setPick] = useState('');
  const [role, setRole] = useState<BoardRole>('member');

  const onBoard = useMemo(() => new Set(members.map((m) => m.user_id)), [members]);
  const addable = candidates.filter((c) => !onBoard.has(c.user_id));
  const selfMember = members.find((m) => m.user_id === currentUserId);

  function run(fn: () => Promise<void>, ok?: string) {
    start(async () => {
      try {
        await fn();
        if (ok) toast.success(ok);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Terjadi kesalahan.');
      }
    });
  }

  function add() {
    if (!pick) return;
    run(async () => {
      await addBoardMember(boardId, pick, role);
      setPick('');
    }, 'Anggota ditambahkan ke board');
  }

  async function leave() {
    const ok = await confirm({
      title: 'Keluar dari board ini?',
      message: 'Anda akan kehilangan akses ke board ini sampai ditambahkan lagi.',
      variant: 'danger',
      confirmLabel: 'Keluar',
    });
    if (!ok) return;
    start(async () => {
      try {
        await leaveBoard(boardId);
        router.push(`/workspaces/${workspaceId}`);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal keluar dari board.');
      }
    });
  }

  return (
    <Dialog open={open} onClose={onClose} title="Anggota board">
      {isAdmin && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-3">
          <p className="text-xs font-medium text-zinc-400">Tambah dari anggota workspace</p>
          <div className="flex gap-2">
            <Select value={pick} onValueChange={setPick} disabled={addable.length === 0}>
              <SelectTrigger className="flex-1">
                <SelectValue
                  placeholder={addable.length ? 'Pilih anggota…' : 'Semua anggota workspace sudah di board'}
                />
              </SelectTrigger>
              <SelectContent>
                {addable.map((c) => (
                  <SelectItem key={c.user_id} value={c.user_id}>
                    {c.profile.full_name || c.profile.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={role} onValueChange={(v) => setRole(v as BoardRole)}>
              <SelectTrigger className="w-28 shrink-0" title="Akses">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={add} loading={pending} className="shrink-0" disabled={!pick}>
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600">
            Hanya anggota workspace yang bisa ditambahkan. Undang ke workspace dulu bila belum ada.
          </p>
        </div>
      )}

      <ul className="flex max-h-80 flex-col gap-1 overflow-y-auto">
        {members.map((m) => {
          const self = m.user_id === currentUserId;
          return (
            <li key={m.user_id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-white/5">
              <Avatar name={m.profile.full_name} email={m.profile.email} url={m.profile.avatar_url} size={32} />
              <div className="min-w-0 flex-1 leading-tight">
                <p className="truncate text-sm text-zinc-100">
                  {m.profile.full_name || m.profile.email}
                  {self && <span className="ml-1.5 text-[11px] text-zinc-500">(Anda)</span>}
                </p>
                <p className="truncate text-[11px] text-zinc-500">{m.profile.email}</p>
              </div>
              {isAdmin ? (
                <>
                  <Select
                    value={m.role}
                    disabled={pending}
                    onValueChange={(v) => run(() => changeBoardMemberRole(boardId, m.user_id, v as BoardRole))}
                  >
                    <SelectTrigger className="h-8 w-24">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((r) => (
                        <SelectItem key={r.value} value={r.value}>
                          {r.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <button
                    onClick={() =>
                      run(() => removeBoardMember(boardId, m.user_id), 'Anggota dikeluarkan dari board')
                    }
                    className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-danger/10 hover:text-danger"
                    aria-label="Keluarkan"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <span className="text-xs capitalize text-zinc-400">{m.role}</span>
              )}
            </li>
          );
        })}
      </ul>

      {selfMember && (
        <div className="mt-4 border-t border-zinc-800 pt-4">
          <Button variant="secondary" size="sm" onClick={leave} loading={pending}>
            <LogOut className="h-4 w-4" /> Keluar dari board
          </Button>
        </div>
      )}
    </Dialog>
  );
}
