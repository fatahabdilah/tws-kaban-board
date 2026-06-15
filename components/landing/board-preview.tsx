import { AlignLeft, CheckSquare, Calendar, Paperclip, Plus, GripVertical } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { cn } from '@/lib/utils';

// A static mock of the real board UI — same visual language as the dashboard's
// ListColumn / CardItem, so the landing feels like the product, not a brochure.

type MockCard = {
  title: string;
  labels?: string[];
  desc?: boolean;
  check?: [number, number];
  attach?: number;
  due?: string;
  overdue?: boolean;
  assignee?: { name: string; email: string };
  tilt?: boolean;
};

type MockColumn = { title: string; cards: MockCard[]; accent?: boolean };

const COLUMNS: MockColumn[] = [
  {
    title: 'Backlog',
    cards: [
      { title: 'Riset kompetitor & benchmark fitur', labels: ['#a855f7'], desc: true, assignee: { name: 'Dina', email: 'dina@tim.id' } },
      { title: 'Susun brand guideline v2', labels: ['#3b82f6', '#22c55e'], check: [1, 4] },
    ],
  },
  {
    title: 'Sedang dikerjakan',
    cards: [
      {
        title: 'Desain ulang halaman onboarding',
        labels: ['#f97316'],
        desc: true,
        check: [3, 5],
        attach: 2,
        assignee: { name: 'Raka', email: 'raka@tim.id' },
        tilt: true,
      },
      { title: 'Integrasi pembayaran', labels: ['#ef4444'], due: '12 Jun', overdue: true },
    ],
  },
  {
    title: 'Selesai',
    cards: [
      { title: 'Setup workspace tim', labels: ['#22c55e'], check: [4, 4], assignee: { name: 'Sari', email: 'sari@tim.id' } },
      { title: 'Tulis dokumentasi API', desc: true, attach: 1 },
    ],
  },
];

function MockCardView({ card }: { card: MockCard }) {
  return (
    <div
      className={cn(
        'rounded-xl border border-card-border bg-surface p-3 text-sm shadow-sm transition-transform duration-300',
        card.tilt && 'rotate-2 scale-[1.03] border-primary/40 shadow-(--shadow-elevated) ring-1 ring-primary/40'
      )}
    >
      {card.labels && card.labels.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-1">
          {card.labels.map((c, i) => (
            <span key={i} className="h-2 w-10 rounded-full" style={{ backgroundColor: c }} />
          ))}
        </div>
      )}
      <p className="break-words text-zinc-100">{card.title}</p>
      {(card.desc || card.check || card.attach || card.due || card.assignee) && (
        <div className="mt-2.5 flex items-center gap-2.5 text-[11px] text-zinc-500">
          {card.desc && <AlignLeft className="h-3.5 w-3.5" />}
          {card.check && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                card.check[0] === card.check[1] ? 'bg-success/15 text-success' : 'text-zinc-400'
              )}
            >
              <CheckSquare className="h-3.5 w-3.5" />
              {card.check[0]}/{card.check[1]}
            </span>
          )}
          {card.attach && (
            <span className="inline-flex items-center gap-1 text-zinc-400">
              <Paperclip className="h-3.5 w-3.5" />
              {card.attach}
            </span>
          )}
          {card.due && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded px-1.5 py-0.5',
                card.overdue ? 'bg-danger/15 text-danger' : 'text-zinc-400'
              )}
            >
              <Calendar className="h-3.5 w-3.5" />
              {card.due}
            </span>
          )}
          {card.assignee && (
            <span className="ml-auto">
              <Avatar name={card.assignee.name} email={card.assignee.email} size={20} />
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function BoardPreview() {
  return (
    <div className="flex gap-4 overflow-hidden">
      {COLUMNS.map((col, i) => (
        <div
          key={col.title}
          className={cn('flex w-64 shrink-0 flex-col', i === 2 && 'hidden lg:flex')}
        >
          <div className="flex flex-col rounded-xl border border-card-border bg-card">
            <div className="flex items-center gap-1.5 px-3 py-2.5">
              <GripVertical className="h-4 w-4 text-zinc-600" />
              <h3 className="flex-1 truncate text-sm font-medium text-zinc-100">{col.title}</h3>
              <span className="rounded-md bg-sidebar-hover px-1.5 py-0.5 text-[11px] text-zinc-400">
                {col.cards.length}
              </span>
            </div>
            <div className="flex flex-col gap-2 px-2 pb-2">
              {col.cards.map((card, ci) => (
                <MockCardView key={ci} card={card} />
              ))}
              <button className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-zinc-500">
                <Plus className="h-4 w-4" /> Tambah kartu
              </button>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
