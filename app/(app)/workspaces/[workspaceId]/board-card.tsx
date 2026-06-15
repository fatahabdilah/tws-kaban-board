'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { LayoutGrid, MoreHorizontal, Pencil, Trash2 } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input, Textarea, Label } from '@/components/ui/Input';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/components/ui/cn';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import type { Board } from '@/lib/supabase/types';
import { deleteBoard, updateBoard } from '../actions';

export function BoardCard({
  board,
  workspaceId,
  canEdit,
  canDelete,
}: {
  board: Board;
  workspaceId: string;
  canEdit: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();
  const [editOpen, setEditOpen] = useState(false);
  const [title, setTitle] = useState(board.title);
  const [description, setDescription] = useState(board.description ?? '');
  const [pending, start] = useTransition();

  function saveEdit() {
    start(async () => {
      try {
        await updateBoard(workspaceId, board.id, { title, description });
        toast.success('Board diperbarui');
        setEditOpen(false);
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan board.');
      }
    });
  }

  async function onDelete() {
    const ok = await confirm({
      title: `Hapus board "${board.title}"?`,
      message: 'Semua list dan kartu di dalamnya ikut terhapus permanen.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    start(async () => {
      try {
        await deleteBoard(workspaceId, board.id);
        toast.success('Board dihapus');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menghapus board.');
      }
    });
  }

  const showMenu = canEdit || canDelete;

  return (
    <>
      <div className={cn('group relative', pending && 'pointer-events-none opacity-50')}>
        <Link
          href={`/boards/${board.id}`}
          className="lift flex flex-col rounded-xl border border-zinc-800 bg-zinc-900 p-5 hover:border-zinc-700"
        >
          <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-lg bg-primary/15 text-primary-light transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:scale-105">
            <LayoutGrid className="h-4 w-4" />
          </div>
          <h3 className="line-clamp-1 pr-6 font-semibold text-white">{board.title}</h3>
          <p className="mt-1 line-clamp-2 min-h-10 text-sm text-zinc-400">
            {board.description || 'Tanpa deskripsi.'}
          </p>
        </Link>

        {showMenu && (
          <div className="absolute right-3 top-3">
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-md p-1 text-zinc-500 opacity-0 transition-opacity hover:bg-accent hover:text-white focus:opacity-100 focus:outline-none group-hover:opacity-100 data-[state=open]:opacity-100"
                aria-label="Opsi board"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canEdit && (
                  <DropdownMenuItem
                    onSelect={() => {
                      setTitle(board.title);
                      setDescription(board.description ?? '');
                      setEditOpen(true);
                    }}
                  >
                    <Pencil /> Edit board
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem variant="danger" onSelect={onDelete}>
                    <Trash2 /> Hapus board
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      <Dialog open={editOpen} onClose={() => setEditOpen(false)} title="Edit board">
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor={`bt-${board.id}`}>Judul</Label>
            <Input
              id={`bt-${board.id}`}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </div>
          <div>
            <Label htmlFor={`bd-${board.id}`}>Deskripsi</Label>
            <Textarea
              id={`bd-${board.id}`}
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Tentang board ini…"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" size="sm" onClick={() => setEditOpen(false)}>
              Batal
            </Button>
            <Button size="sm" loading={pending} onClick={saveEdit}>
              Simpan
            </Button>
          </div>
        </div>
      </Dialog>
    </>
  );
}
