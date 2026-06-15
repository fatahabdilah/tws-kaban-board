'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { UserPlus, Trash2, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { inputCls } from '@/components/ui/cn';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { BoardRole, MemberWithProfile } from '@/lib/supabase/types';
import { addMember, changeMemberRole, removeMember, updateMemberMeta } from '../actions';

const ROLES: { value: BoardRole; label: string }[] = [
  { value: 'admin', label: 'Admin' },
  { value: 'member', label: 'Member' },
  { value: 'viewer', label: 'Viewer' },
];

const DIVISION_LIST_ID = 'ws-division-suggestions';

function MemberRow({
  member,
  isAdmin,
  self,
  workspaceId,
  onChanged,
  onError,
}: {
  member: MemberWithProfile;
  isAdmin: boolean;
  self: boolean;
  workspaceId: string;
  onChanged: () => void;
  onError: (msg: string) => void;
}) {
  const [pending, start] = useTransition();
  const confirm = useConfirm();
  const [division, setDivision] = useState(member.division ?? '');
  const [jobTitle, setJobTitle] = useState(member.job_title ?? '');

  function run(fn: () => Promise<void>) {
    start(async () => {
      try {
        await fn();
        onChanged();
      } catch (e) {
        onError(e instanceof Error ? e.message : 'Terjadi kesalahan.');
      }
    });
  }

  function saveMeta() {
    if ((member.division ?? '') === division.trim() && (member.job_title ?? '') === jobTitle.trim()) return;
    run(() => updateMemberMeta(workspaceId, member.user_id, { division, job_title: jobTitle }));
  }

  return (
    <li className="flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Avatar name={member.profile.full_name} email={member.profile.email} url={member.profile.avatar_url} size={32} />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="truncate text-sm text-zinc-100">
            {member.profile.full_name || member.profile.email}
            {self && <span className="ml-1.5 text-[11px] text-zinc-500">(Anda)</span>}
          </p>
          <p className="truncate text-[11px] text-zinc-500">{member.profile.email}</p>
        </div>
        {isAdmin ? (
          <>
            <Select
              value={member.role}
              disabled={pending}
              onValueChange={(v) => run(() => changeMemberRole(workspaceId, member.user_id, v as BoardRole))}
            >
              <SelectTrigger className="h-8 w-28" title="Akses">
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
              onClick={async () => {
                const ok = await confirm({
                  title: self ? 'Keluar dari workspace?' : 'Keluarkan anggota?',
                  variant: 'danger',
                  confirmLabel: self ? 'Keluar' : 'Keluarkan',
                });
                if (ok) run(() => removeMember(workspaceId, member.user_id));
              }}
              className="rounded-lg p-2 text-zinc-500 transition-colors hover:bg-danger/10 hover:text-danger"
              aria-label="Remove member"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        ) : (
          <span className="text-xs capitalize text-zinc-400">{member.role}</span>
        )}
      </div>

      {isAdmin ? (
        <div className="grid grid-cols-2 gap-2 pl-11">
          <input
            value={division}
            list={DIVISION_LIST_ID}
            disabled={pending}
            onChange={(e) => setDivision(e.target.value)}
            onBlur={saveMeta}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Divisi (mis. Creative)"
            className={`${inputCls} py-1.5 text-xs`}
          />
          <input
            value={jobTitle}
            disabled={pending}
            onChange={(e) => setJobTitle(e.target.value)}
            onBlur={saveMeta}
            onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
            placeholder="Jabatan (mis. Editor)"
            className={`${inputCls} py-1.5 text-xs`}
          />
        </div>
      ) : (
        (member.division || member.job_title) && (
          <div className="flex flex-wrap gap-1.5 pl-11">
            {member.division && (
              <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[11px] text-primary-light">
                {member.division}
              </span>
            )}
            {member.job_title && (
              <span className="rounded-full bg-zinc-700/40 px-2 py-0.5 text-[11px] text-zinc-300">
                {member.job_title}
              </span>
            )}
          </div>
        )
      )}
    </li>
  );
}

export function MembersPanel({
  workspaceId,
  members,
  isAdmin,
  currentUserId,
}: {
  workspaceId: string;
  members: MemberWithProfile[];
  isAdmin: boolean;
  currentUserId: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<BoardRole>('member');
  const [division, setDivision] = useState('');
  const [jobTitle, setJobTitle] = useState('');

  const isMember = members.some((m) => m.user_id === currentUserId);

  async function leaveWorkspace() {
    const ok = await confirm({
      title: 'Keluar dari workspace?',
      message: 'Anda akan kehilangan akses ke workspace ini dan semua board-nya.',
      variant: 'danger',
      confirmLabel: 'Keluar',
    });
    if (!ok) return;
    start(async () => {
      try {
        await removeMember(workspaceId, currentUserId);
        router.push('/workspaces');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal keluar dari workspace.');
      }
    });
  }

  const divisions = useMemo(
    () => Array.from(new Set(members.map((m) => m.division).filter(Boolean))) as string[],
    [members]
  );

  function invite() {
    if (!email.trim()) return;
    start(async () => {
      try {
        await addMember(workspaceId, email, role, division, jobTitle);
        toast.success('Anggota ditambahkan');
        setEmail('');
        setDivision('');
        setJobTitle('');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menambah anggota.');
      }
    });
  }

  return (
    <div className="max-w-3xl">
      <datalist id={DIVISION_LIST_ID}>
        {divisions.map((d) => (
          <option key={d} value={d} />
        ))}
      </datalist>

      {isAdmin && (
        <div className="mb-5 flex flex-col gap-2 rounded-xl border border-zinc-800 bg-zinc-900 p-4">
          <p className="text-xs font-medium text-zinc-400">Tambah anggota</p>
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="email@pengguna.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
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
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Divisi (opsional)"
              list={DIVISION_LIST_ID}
              value={division}
              onChange={(e) => setDivision(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <Input
              placeholder="Jabatan (opsional)"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && invite()}
            />
            <Button size="sm" onClick={invite} loading={pending} className="shrink-0">
              <UserPlus className="h-4 w-4" />
            </Button>
          </div>
          <p className="text-[11px] text-zinc-600">Pengguna harus sudah terdaftar dengan email tersebut.</p>
        </div>
      )}

      <ul className="flex flex-col gap-2">
        {members.map((m) => (
          <MemberRow
            key={m.user_id}
            member={m}
            isAdmin={isAdmin}
            self={m.user_id === currentUserId}
            workspaceId={workspaceId}
            onChanged={() => router.refresh()}
            onError={(msg) => toast.error(msg)}
          />
        ))}
      </ul>

      {isMember && (
        <div className="mt-5 border-t border-zinc-800 pt-4">
          <Button variant="secondary" size="sm" onClick={leaveWorkspace} loading={pending}>
            <LogOut className="h-4 w-4" /> Keluar dari workspace
          </Button>
        </div>
      )}
    </div>
  );
}
