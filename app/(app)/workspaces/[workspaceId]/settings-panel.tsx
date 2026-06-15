'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label } from '@/components/ui/Input';
import { Card } from '@/components/ui/card';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { updateWorkspace, deleteWorkspace } from '../actions';

export function SettingsPanel({
  workspaceId,
  name: initialName,
  description: initialDescription,
}: {
  workspaceId: string;
  name: string;
  description: string | null;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [pending, start] = useTransition();
  const [name, setName] = useState(initialName);
  const [description, setDescription] = useState(initialDescription ?? '');

  function save() {
    start(async () => {
      try {
        await updateWorkspace(workspaceId, { name, description });
        toast.success('Workspace disimpan');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan.');
      }
    });
  }

  async function remove() {
    const ok = await confirm({
      title: 'Hapus workspace ini?',
      message: 'Semua board, list, dan kartu di dalamnya ikut terhapus permanen.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    start(async () => {
      try {
        await deleteWorkspace(workspaceId);
      } catch (e) {
        if (e && typeof e === 'object' && 'digest' in e) throw e;
        toast.error(e instanceof Error ? e.message : 'Gagal menghapus.');
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      <Card className="p-5">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="ws-name">Nama workspace</Label>
            <Input id="ws-name" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div>
            <Label htmlFor="ws-desc">Deskripsi</Label>
            <Textarea
              id="ws-desc"
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tentang workspace ini…"
            />
          </div>
          <div>
            <Button size="sm" onClick={save} loading={pending}>
              <Save className="h-4 w-4" /> Simpan
            </Button>
          </div>
        </div>
      </Card>

      <div className="rounded-xl border border-danger/30 bg-danger/5 p-5">
        <h3 className="text-sm font-semibold text-danger">Zona berbahaya</h3>
        <p className="mt-1 text-xs text-zinc-400">
          Menghapus workspace tidak dapat dibatalkan dan akan menghapus semua board di dalamnya.
        </p>
        <div className="mt-3">
          <Button variant="danger" size="sm" onClick={remove} loading={pending}>
            <Trash2 className="h-4 w-4" /> Hapus workspace
          </Button>
        </div>
      </div>
    </div>
  );
}
