'use client';

import { useState, useTransition } from 'react';
import { Plus } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label } from '@/components/ui/Input';
import { useToast } from '@/components/ui/Toast';
import { createBoard } from '../actions';

export function NewBoardButton({ workspaceId }: { workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [pending, start] = useTransition();
  const toast = useToast();

  function onSubmit(formData: FormData) {
    start(async () => {
      try {
        await createBoard(workspaceId, formData);
      } catch (e) {
        if (e && typeof e === 'object' && 'digest' in e) throw e; // redirect signal
        toast.error(e instanceof Error ? e.message : 'Gagal membuat board.');
      }
    });
  }

  return (
    <>
      <Button onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        Board baru
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title="Buat board baru">
        <form action={onSubmit} className="flex flex-col gap-4">
          <div>
            <Label htmlFor="title">Judul</Label>
            <Input id="title" name="title" placeholder="mis. Sprint Planning" required autoFocus />
          </div>
          <div>
            <Label htmlFor="description">Deskripsi (opsional)</Label>
            <Textarea id="description" name="description" rows={3} placeholder="Tentang board ini…" />
          </div>
          <div className="mt-1 flex justify-end gap-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button type="submit" size="sm" loading={pending}>
              Buat board
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}
