'use client';

import { useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import Link from 'next/link';
import { Plus, Users, MoreHorizontal, Trash2, Image as ImageIcon } from 'lucide-react';
import { deleteBoard } from '@/app/(app)/workspaces/actions';
import { backgroundCss } from '@/lib/board-theme';
import { positionBetween } from '@/lib/positions';
import { useToast } from '@/components/ui/Toast';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { Avatar } from '@/components/ui/Avatar';
import { RoleBadge } from '@/components/ui/RoleBadge';
import type { Board, BoardLabel, BoardRole, Card, List, MemberWithProfile } from '@/lib/supabase/types';
import type { CardMeta, LabelMap } from './page';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu';
import { Hint } from '@/components/ui/tooltip';
import { ListColumn } from './list-column';
import { CardItem } from './card-item';
import { CardDialog } from './card-dialog';
import { BoardMembersDialog } from './board-members-dialog';
import { BoardBackgroundDialog } from './board-bg-dialog';
import {
  createCard,
  createList,
  deleteCard,
  deleteList,
  moveCard,
  renameList,
  reorderList,
} from './actions';

type Columns = Record<string, Card[]>;

function buildColumns(lists: List[], cards: Card[]): Columns {
  const cols: Columns = {};
  for (const l of lists) cols[l.id] = [];
  for (const c of cards) (cols[c.list_id] ??= []).push(c);
  return cols;
}

export function BoardView({
  board,
  workspaceName,
  role,
  isSuperAdmin,
  currentUserId,
  initialLists,
  initialCards,
  members,
  candidates,
  cardMeta,
  boardLabels,
  labelMap,
}: {
  board: Board;
  workspaceName: string;
  role: BoardRole;
  isSuperAdmin: boolean;
  currentUserId: string;
  initialLists: List[];
  initialCards: Card[];
  members: MemberWithProfile[];
  candidates: MemberWithProfile[];
  cardMeta: Record<string, CardMeta>;
  boardLabels: BoardLabel[];
  labelMap: LabelMap;
}) {
  const canEdit = isSuperAdmin || role === 'admin' || role === 'member';
  const isAdmin = isSuperAdmin || role === 'admin';
  const router = useRouter();
  const toast = useToast();
  const confirm = useConfirm();

  const [lists, setLists] = useState<List[]>(initialLists);
  const [columns, setColumns] = useState<Columns>(() => buildColumns(initialLists, initialCards));
  const [activeId, setActiveId] = useState<string | null>(null);
  const [activeType, setActiveType] = useState<'card' | 'list' | null>(null);
  const [, startTransition] = useTransition();

  const [openCard, setOpenCard] = useState<Card | null>(null);
  const [membersOpen, setMembersOpen] = useState(false);
  const [bgOpen, setBgOpen] = useState(false);
  const [addingList, setAddingList] = useState(false);

  async function handleDeleteBoard() {
    const ok = await confirm({
      title: `Hapus board "${board.title}"?`,
      message: 'Semua list dan kartu di dalamnya ikut terhapus permanen.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    try {
      await deleteBoard(board.workspace_id, board.id);
      router.push(`/workspaces/${board.workspace_id}`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Gagal menghapus board.');
    }
  }
  const [newListTitle, setNewListTitle] = useState('');

  // Re-sync from server props after revalidation — but not mid-drag.
  const signature = useMemo(
    () => JSON.stringify({ l: initialLists.map((l) => [l.id, l.position]), c: initialCards.map((c) => [c.id, c.list_id, c.position]) }),
    [initialLists, initialCards]
  );
  const lastSig = useRef(signature);
  useEffect(() => {
    if (activeId) return;
    if (lastSig.current === signature) return;
    lastSig.current = signature;
    setLists(initialLists);
    setColumns(buildColumns(initialLists, initialCards));
  }, [signature, activeId, initialLists, initialCards]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  const allCards = useMemo(() => Object.values(columns).flat(), [columns]);
  const activeCard = activeType === 'card' ? allCards.find((c) => c.id === activeId) : null;
  const activeList = activeType === 'list' ? lists.find((l) => l.id === activeId) : null;

  function containerOfCard(cardId: string): string | null {
    for (const [listId, cards] of Object.entries(columns)) {
      if (cards.some((c) => c.id === cardId)) return listId;
    }
    return null;
  }

  function containerFromOver(over: DragOverEvent['over'] | DragEndEvent['over']): string | null {
    if (!over) return null;
    const type = over.data.current?.type;
    if (type === 'card') return (over.data.current as { listId: string }).listId;
    if (type === 'list-dropzone') return (over.data.current as { listId: string }).listId;
    if (type === 'list') return String(over.id);
    return null;
  }

  function onDragStart(e: DragStartEvent) {
    setActiveId(String(e.active.id));
    setActiveType((e.active.data.current?.type as 'card' | 'list') ?? null);
  }

  function onDragOver(e: DragOverEvent) {
    const { active, over } = e;
    if (!over || active.data.current?.type !== 'card') return;
    const from = containerOfCard(String(active.id));
    const to = containerFromOver(over);
    if (!from || !to || from === to) return;

    setColumns((prev) => {
      const fromCards = [...prev[from]];
      const toCards = [...(prev[to] ?? [])];
      const idx = fromCards.findIndex((c) => c.id === active.id);
      if (idx === -1) return prev;
      const [moved] = fromCards.splice(idx, 1);
      const overType = over.data.current?.type;
      let insertAt = toCards.length;
      if (overType === 'card') {
        const oi = toCards.findIndex((c) => c.id === over.id);
        insertAt = oi === -1 ? toCards.length : oi;
      }
      toCards.splice(insertAt, 0, { ...moved, list_id: to });
      return { ...prev, [from]: fromCards, [to]: toCards };
    });
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    const type = active.data.current?.type;
    setActiveId(null);
    setActiveType(null);
    if (!over) return;

    if (type === 'list') {
      // `over` may be another list, a card inside a list, or a list dropzone —
      // resolve it down to a list id either way.
      const overType = over.data.current?.type;
      const overListId =
        overType === 'card' || overType === 'list-dropzone'
          ? (over.data.current as { listId: string }).listId
          : String(over.id);
      const oldIndex = lists.findIndex((l) => l.id === active.id);
      const newIndex = lists.findIndex((l) => l.id === overListId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;
      const next = arrayMove(lists, oldIndex, newIndex);
      setLists(next);
      const pos = positionBetween(next[newIndex - 1]?.position, next[newIndex + 1]?.position);
      next[newIndex] = { ...next[newIndex], position: pos };
      setLists([...next]);
      runAction(() => reorderList(board.id, String(active.id), pos), 'Gagal memindah list.');
      return;
    }

    if (type === 'card') {
      const container = containerOfCard(String(active.id));
      if (!container) return;
      let cards = columns[container];
      const overType = over.data.current?.type;
      // Reorder within the same container if dropped over another card.
      if (overType === 'card') {
        const oldIndex = cards.findIndex((c) => c.id === active.id);
        const newIndex = cards.findIndex((c) => c.id === over.id);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          cards = arrayMove(cards, oldIndex, newIndex);
          setColumns((prev) => ({ ...prev, [container]: cards }));
        }
      }
      const index = cards.findIndex((c) => c.id === active.id);
      const pos = positionBetween(cards[index - 1]?.position, cards[index + 1]?.position);
      setColumns((prev) => ({
        ...prev,
        [container]: prev[container].map((c) => (c.id === active.id ? { ...c, position: pos } : c)),
      }));
      runAction(() => moveCard(board.id, String(active.id), container, pos), 'Gagal memindah kartu.');
    }
  }

  function runAction(fn: () => Promise<void>, errMsg: string) {
    startTransition(async () => {
      try {
        await fn();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : errMsg);
        router.refresh();
      }
    });
  }

  /* ---- mutation handlers (optimistic where cheap, else action + refresh) ---- */

  function handleAddCard(listId: string, title: string) {
    runAction(() => createCard(board.id, listId, title), 'Gagal menambah kartu.');
  }
  function handleRenameList(listId: string, title: string) {
    setLists((ls) => ls.map((l) => (l.id === listId ? { ...l, title } : l)));
    runAction(() => renameList(board.id, listId, title), 'Gagal mengubah nama list.');
  }
  async function handleDeleteList(listId: string) {
    const ok = await confirm({
      title: 'Hapus list ini?',
      message: 'Semua kartu di dalamnya akan ikut terhapus.',
      variant: 'danger',
      confirmLabel: 'Hapus',
    });
    if (!ok) return;
    setLists((ls) => ls.filter((l) => l.id !== listId));
    setColumns((prev) => {
      const next = { ...prev };
      delete next[listId];
      return next;
    });
    runAction(() => deleteList(board.id, listId), 'Gagal menghapus list.');
  }
  function handleAddList() {
    const title = newListTitle.trim();
    if (!title) {
      setAddingList(false);
      return;
    }
    setNewListTitle('');
    setAddingList(false);
    runAction(() => createList(board.id, title), 'Gagal menambah list.');
  }
  async function handleDeleteCard(cardId: string) {
    const ok = await confirm({ title: 'Hapus kartu ini?', variant: 'danger', confirmLabel: 'Hapus' });
    if (!ok) return;
    setColumns((prev) => {
      const next: Columns = {};
      for (const [k, v] of Object.entries(prev)) next[k] = v.filter((c) => c.id !== cardId);
      return next;
    });
    setOpenCard(null);
    runAction(() => deleteCard(board.id, cardId), 'Gagal menghapus kartu.');
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Header */}
      <header className="flex items-center justify-between gap-4 border-b border-card-border px-6 py-4">
        <div>
          <Link
            href={`/workspaces/${board.workspace_id}`}
            className="text-xs text-zinc-500 transition-colors hover:text-zinc-300"
          >
            ← {workspaceName}
          </Link>
          <div className="mt-0.5 flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">{board.title}</h1>
            <RoleBadge role={role} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {canEdit && (
            <Hint label="Latar board">
              <button
                onClick={() => setBgOpen(true)}
                className="rounded-xl border border-card-border bg-card p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
              >
                <ImageIcon className="h-4 w-4" />
              </button>
            </Hint>
          )}
          <button
            onClick={() => setMembersOpen(true)}
            className="flex cursor-pointer items-center gap-3 rounded-xl border border-card-border bg-card px-3 py-2 transition-colors hover:border-zinc-600"
            title="Anggota board"
          >
            <div className="flex -space-x-2">
              {members.slice(0, 5).map((m) => (
                <Avatar
                  key={m.user_id}
                  name={m.profile.full_name}
                  email={m.profile.email}
                  url={m.profile.avatar_url}
                  size={26}
                  className="ring-2 ring-card"
                />
              ))}
              {members.length > 5 && (
                <span className="flex h-6.5 w-6.5 items-center justify-center rounded-full bg-sidebar-hover text-[11px] text-zinc-400 ring-2 ring-card">
                  +{members.length - 5}
                </span>
              )}
            </div>
            <span className="flex items-center gap-1.5 text-sm text-zinc-300">
              <Users className="h-4 w-4" /> Anggota
            </span>
          </button>

          {isAdmin && (
            <DropdownMenu>
              <DropdownMenuTrigger
                className="rounded-xl border border-card-border bg-card p-2 text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white focus:outline-none"
                aria-label="Opsi board"
              >
                <MoreHorizontal className="h-4 w-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem variant="danger" onSelect={handleDeleteBoard}>
                  <Trash2 /> Hapus board
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </header>

      {/* Board */}
      <DndContext
        id="board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={onDragStart}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
      >
        <div
          className="flex flex-1 items-start gap-4 overflow-x-auto p-6 transition-[background] duration-300"
          style={{ background: backgroundCss(board.background) }}
        >
          <SortableContext items={lists.map((l) => l.id)} strategy={horizontalListSortingStrategy}>
            {lists.map((list) => (
              <ListColumn
                key={list.id}
                list={list}
                cards={columns[list.id] ?? []}
                members={members}
                cardMeta={cardMeta}
                labelMap={labelMap}
                canEdit={canEdit}
                onAddCard={handleAddCard}
                onRenameList={handleRenameList}
                onDeleteList={handleDeleteList}
                onOpenCard={setOpenCard}
              />
            ))}
          </SortableContext>

          {/* Add list */}
          {canEdit && (
            <div className="w-72 shrink-0">
              {addingList ? (
                <div className="rounded-xl border border-card-border bg-card p-3">
                  <input
                    autoFocus
                    value={newListTitle}
                    onChange={(e) => setNewListTitle(e.target.value)}
                    onBlur={handleAddList}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleAddList();
                      if (e.key === 'Escape') {
                        setNewListTitle('');
                        setAddingList(false);
                      }
                    }}
                    placeholder="Judul list…"
                    className="w-full rounded-lg bg-surface px-3 py-2 text-sm text-white outline outline-1 outline-primary/60 placeholder:text-zinc-600"
                  />
                </div>
              ) : (
                <button
                  onClick={() => setAddingList(true)}
                  className="flex w-full items-center gap-2 rounded-xl border border-dashed border-card-border px-4 py-3 text-sm text-zinc-400 transition-colors hover:border-zinc-600 hover:text-white"
                >
                  <Plus className="h-4 w-4" /> Tambah list
                </button>
              )}
            </div>
          )}
        </div>

        <DragOverlay>
          {activeCard ? (
            <CardItem card={activeCard} members={members} labelMap={labelMap} canEdit={canEdit} onOpen={() => {}} overlay />
          ) : activeList ? (
            <div className="w-72 rotate-2 scale-[1.02] cursor-grabbing rounded-xl border border-primary/50 bg-card p-3 opacity-95 shadow-(--shadow-elevated)">
              <p className="text-sm font-medium">{activeList.title}</p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {openCard && (
        <CardDialog
          key={openCard.id}
          boardId={board.id}
          card={columns[openCard.list_id]?.find((c) => c.id === openCard.id) ?? openCard}
          members={members}
          boardLabels={boardLabels}
          canEdit={canEdit}
          currentUserId={currentUserId}
          onClose={() => setOpenCard(null)}
          onDelete={() => handleDeleteCard(openCard.id)}
          onSaved={() => router.refresh()}
        />
      )}

      <BoardMembersDialog
        open={membersOpen}
        onClose={() => setMembersOpen(false)}
        boardId={board.id}
        workspaceId={board.workspace_id}
        members={members}
        candidates={candidates}
        isAdmin={isAdmin}
        currentUserId={currentUserId}
      />

      <BoardBackgroundDialog
        open={bgOpen}
        onClose={() => setBgOpen(false)}
        boardId={board.id}
        current={board.background}
      />
    </div>
  );
}
