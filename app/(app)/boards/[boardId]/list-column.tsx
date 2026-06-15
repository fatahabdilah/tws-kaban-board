'use client';

import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useDroppable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Plus, MoreHorizontal, Pencil, Trash2, X, GripVertical } from 'lucide-react';
import { cn } from '@/components/ui/cn';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import type { Card, List } from '@/lib/supabase/types';
import type { MemberWithProfile, CardMeta, LabelMap } from './page';
import { CardItem } from './card-item';

export function ListColumn({
  list,
  cards,
  members,
  cardMeta,
  labelMap,
  canEdit,
  onAddCard,
  onRenameList,
  onDeleteList,
  onOpenCard,
}: {
  list: List;
  cards: Card[];
  members: MemberWithProfile[];
  cardMeta: Record<string, CardMeta>;
  labelMap: LabelMap;
  canEdit: boolean;
  onAddCard: (listId: string, title: string) => void;
  onRenameList: (listId: string, title: string) => void;
  onDeleteList: (listId: string) => void;
  onOpenCard: (card: Card) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(list.title);
  const [adding, setAdding] = useState(false);
  const [newCard, setNewCard] = useState('');

  const sortable = useSortable({ id: list.id, data: { type: 'list' }, disabled: !canEdit || editing });
  const { setNodeRef, transform, transition, isDragging, attributes, listeners } = sortable;
  const { setNodeRef: setDropRef, isOver } = useDroppable({ id: `list-drop-${list.id}`, data: { type: 'list-dropzone', listId: list.id } });

  function commitRename() {
    setEditing(false);
    if (titleDraft.trim() && titleDraft.trim() !== list.title) onRenameList(list.id, titleDraft.trim());
    else setTitleDraft(list.title);
  }

  function commitAdd() {
    if (newCard.trim()) onAddCard(list.id, newCard.trim());
    setNewCard('');
    setAdding(false);
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cn('flex w-72 shrink-0 flex-col', isDragging && 'opacity-50')}
    >
      <div
        className={cn(
          'flex max-h-[calc(100vh-7rem)] flex-col rounded-xl border bg-card transition-[border-color,box-shadow] duration-200',
          isOver ? 'border-primary/50 shadow-[0_0_0_1px_var(--primary)]' : 'border-card-border'
        )}
      >
        {/* Header */}
        <div className="flex items-center gap-1.5 px-3 py-2.5">
          {canEdit && (
            <button
              {...attributes}
              {...listeners}
              className="cursor-grab text-zinc-600 hover:text-zinc-400 active:cursor-grabbing"
              aria-label="Drag list"
            >
              <GripVertical className="h-4 w-4" />
            </button>
          )}
          {editing ? (
            <input
              autoFocus
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitRename();
                if (e.key === 'Escape') {
                  setTitleDraft(list.title);
                  setEditing(false);
                }
              }}
              className="flex-1 rounded-md bg-[#0e0e0e] px-2 py-1 text-sm font-medium text-white outline outline-1 outline-primary/60"
            />
          ) : (
            <h3
              onDoubleClick={() => canEdit && setEditing(true)}
              title={canEdit ? 'Klik dua kali untuk ubah nama' : undefined}
              className="flex-1 truncate text-sm font-medium text-zinc-100"
            >
              {list.title}
            </h3>
          )}
          <span className="rounded-md bg-sidebar-hover px-1.5 py-0.5 text-[11px] text-zinc-400">
            {cards.length}
          </span>
          {canEdit && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-md p-1 text-zinc-500 transition-colors hover:bg-accent hover:text-white focus:outline-none"
                aria-label="Opsi list"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditing(true)}>
                  <Pencil /> Ubah nama
                </DropdownMenuItem>
                <DropdownMenuItem variant="danger" onSelect={() => onDeleteList(list.id)}>
                  <Trash2 /> Hapus list
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Cards */}
        <div ref={setDropRef} className="flex flex-col gap-2 overflow-y-auto px-2 pb-2">
          <SortableContext items={cards.map((c) => c.id)} strategy={verticalListSortingStrategy}>
            {cards.map((card) => (
              <CardItem
                key={card.id}
                card={card}
                members={members}
                meta={cardMeta[card.id]}
                labelMap={labelMap}
                canEdit={canEdit}
                onOpen={() => onOpenCard(card)}
              />
            ))}
          </SortableContext>
          {cards.length === 0 && !adding && (
            <p
              className={cn(
                'rounded-lg px-1 py-3 text-center text-xs transition-colors',
                isOver
                  ? 'border border-dashed border-primary/50 bg-primary/5 text-primary-light'
                  : 'text-zinc-600'
              )}
            >
              {isOver ? 'Lepas di sini' : 'Belum ada kartu'}
            </p>
          )}
        </div>

        {/* Add card */}
        {canEdit && (
          <div className="p-2 pt-0">
            {adding ? (
              <div className="flex flex-col gap-2">
                <textarea
                  autoFocus
                  rows={2}
                  value={newCard}
                  onChange={(e) => setNewCard(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      commitAdd();
                    }
                    if (e.key === 'Escape') {
                      setNewCard('');
                      setAdding(false);
                    }
                  }}
                  placeholder="Judul kartu…"
                  className="w-full resize-none rounded-lg bg-surface px-3 py-2 text-sm text-white outline outline-1 outline-primary/60 placeholder:text-zinc-600"
                />
                <div className="flex items-center gap-2">
                  <button
                    onClick={commitAdd}
                    className="rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-dark"
                  >
                    Tambah
                  </button>
                  <button
                    onClick={() => {
                      setNewCard('');
                      setAdding(false);
                    }}
                    className="rounded-lg p-1.5 text-zinc-500 hover:text-white"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setAdding(true)}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:bg-sidebar-hover hover:text-white"
              >
                <Plus className="h-4 w-4" /> Tambah kartu
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
