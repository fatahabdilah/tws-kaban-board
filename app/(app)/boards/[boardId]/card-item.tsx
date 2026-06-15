'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Calendar, AlignLeft, Paperclip, CheckSquare } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/components/ui/cn';
import type { Card } from '@/lib/supabase/types';
import type { MemberWithProfile, CardMeta, LabelMap } from './page';

function readableText(hex: string): string {
  const m = hex.replace('#', '');
  if (m.length < 6) return '#fff';
  const r = parseInt(m.slice(0, 2), 16);
  const g = parseInt(m.slice(2, 4), 16);
  const b = parseInt(m.slice(4, 6), 16);
  // Perceived luminance — dark text on light labels, white on dark.
  return 0.299 * r + 0.587 * g + 0.114 * b > 150 ? '#18181b' : '#ffffff';
}

export function CardItem({
  card,
  members,
  meta,
  labelMap,
  canEdit,
  onOpen,
  overlay = false,
}: {
  card: Card;
  members: MemberWithProfile[];
  meta?: CardMeta;
  labelMap?: LabelMap;
  canEdit: boolean;
  onOpen: () => void;
  overlay?: boolean;
}) {
  const sortable = useSortable({
    id: card.id,
    data: { type: 'card', listId: card.list_id },
    disabled: !canEdit,
  });
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = sortable;

  const assignee = members.find((m) => m.user_id === card.assignee_id)?.profile;
  const due = card.due_date ? new Date(card.due_date) : null;
  const overdue = due ? due.getTime() < Date.now() : false;
  const labels = (card.labels ?? [])
    .map((id) => ({ id, def: labelMap?.[id] }))
    .filter((x): x is { id: string; def: { name: string; color: string } } => !!x.def);

  return (
    <div
      ref={overlay ? undefined : setNodeRef}
      style={overlay ? undefined : { transform: CSS.Translate.toString(transform), transition }}
      {...(overlay ? {} : attributes)}
      {...(overlay ? {} : listeners)}
      onClick={onOpen}
      className={cn(
        'group/card overflow-hidden rounded-xl border border-card-border bg-surface text-sm shadow-sm transition-[transform,box-shadow,border-color,opacity] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]',
        canEdit
          ? 'cursor-grab hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-(--shadow-float) active:cursor-grabbing'
          : 'cursor-pointer hover:-translate-y-0.5 hover:border-zinc-600 hover:shadow-(--shadow-float)',
        isDragging && !overlay && 'scale-[0.98] opacity-40',
        overlay && 'rotate-2 scale-[1.02] cursor-grabbing border-primary/40 shadow-(--shadow-elevated) ring-1 ring-primary/40'
      )}
    >
      {card.cover_url && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={card.cover_url} alt="" className="h-28 w-full object-cover" />
      )}

      <div className="p-3">
        {labels.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-1">
            {labels.map(({ id, def }) =>
              def.name ? (
                <span
                  key={id}
                  className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-tight"
                  style={{ backgroundColor: def.color, color: readableText(def.color) }}
                  title={def.name}
                >
                  {def.name}
                </span>
              ) : (
                <span
                  key={id}
                  className="h-2 w-10 rounded-full transition-all group-hover/card:w-12"
                  style={{ backgroundColor: def.color }}
                />
              )
            )}
          </div>
        )}

        <p className="whitespace-pre-wrap break-words text-zinc-100">{card.title}</p>

        {(card.description || due || assignee || (meta && (meta.checkTotal > 0 || meta.attach > 0))) && (
          <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-zinc-500">
            {card.description && <AlignLeft className="h-3.5 w-3.5" />}
            {meta && meta.checkTotal > 0 && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                  meta.checkDone === meta.checkTotal ? 'bg-success/15 text-success' : 'text-zinc-400'
                )}
              >
                <CheckSquare className="h-3.5 w-3.5" />
                {meta.checkDone}/{meta.checkTotal}
              </span>
            )}
            {meta && meta.attach > 0 && (
              <span className="inline-flex items-center gap-1 text-zinc-400">
                <Paperclip className="h-3.5 w-3.5" />
                {meta.attach}
              </span>
            )}
            {due && (
              <span
                className={cn(
                  'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                  overdue ? 'bg-danger/15 text-danger' : 'text-zinc-400'
                )}
              >
                <Calendar className="h-3.5 w-3.5" />
                {due.toLocaleDateString('id-ID', { day: 'numeric', month: 'short' })}
              </span>
            )}
            {assignee && (
              <span className="ml-auto">
                <Avatar name={assignee.full_name} email={assignee.email} url={assignee.avatar_url} size={20} />
              </span>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
