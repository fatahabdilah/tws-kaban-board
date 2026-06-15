'use client';

import { useTransition } from 'react';
import { ShieldCheck, ShieldOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { PlatformRole } from '@/lib/supabase/types';
import { setPlatformRole } from './actions';

export function RoleToggle({
  userId,
  role,
  self,
}: {
  userId: string;
  role: PlatformRole;
  self: boolean;
}) {
  const [pending, start] = useTransition();
  const toast = useToast();
  const confirm = useConfirm();
  const isSuper = role === 'super_admin';

  if (self) {
    return <span className="text-xs text-zinc-500">Anda</span>;
  }

  function toggle() {
    start(async () => {
      const next: PlatformRole = isSuper ? 'user' : 'super_admin';
      const ok = await confirm({
        title: isSuper ? 'Cabut akses super admin?' : 'Jadikan super admin?',
        message: isSuper
          ? 'Pengguna ini akan kehilangan akses ke seluruh board dan panel admin.'
          : 'Pengguna ini akan dapat melihat dan mengelola semua board.',
        variant: isSuper ? 'danger' : 'default',
        confirmLabel: 'Ya',
      });
      if (!ok) return;
      try {
        await setPlatformRole(userId, next);
        toast.success('Peran diperbarui');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal mengubah peran.');
      }
    });
  }

  return (
    <Button variant={isSuper ? 'danger' : 'secondary'} size="sm" loading={pending} onClick={toggle}>
      {isSuper ? <ShieldOff className="h-4 w-4" /> : <ShieldCheck className="h-4 w-4" />}
      {isSuper ? 'Cabut admin' : 'Jadikan admin'}
    </Button>
  );
}
