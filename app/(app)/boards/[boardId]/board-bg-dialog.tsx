'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Check } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { cn } from '@/components/ui/cn';
import { BOARD_BACKGROUNDS, backgroundCss } from '@/lib/board-theme';
import { setBoardBackground } from './actions';

export function BoardBackgroundDialog({
  open,
  onClose,
  boardId,
  current,
}: {
  open: boolean;
  onClose: () => void;
  boardId: string;
  current: string | null;
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [url, setUrl] = useState('');

  function apply(value: string | null) {
    start(async () => {
      try {
        await setBoardBackground(boardId, value);
        router.refresh();
        onClose();
      } catch {
        /* surfaced elsewhere */
      }
    });
  }

  const activeId = current ?? 'default';

  return (
    <Dialog open={open} onClose={onClose} title="Latar board">
      <div className="grid grid-cols-4 gap-3">
        {BOARD_BACKGROUNDS.map((bg) => {
          const active = activeId === bg.id;
          return (
            <button
              key={bg.id}
              onClick={() => apply(bg.id === 'default' ? null : bg.id)}
              disabled={pending}
              title={bg.name}
              className={cn(
                'relative h-16 cursor-pointer overflow-hidden rounded-lg border transition-all hover:scale-[1.03] active:scale-95',
                active ? 'border-primary ring-2 ring-primary/50' : 'border-zinc-700'
              )}
              style={{ background: backgroundCss(bg.id) }}
            >
              {active && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-white">
                  <Check className="h-3 w-3" />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-5">
        <p className="mb-1.5 text-[10px] font-medium uppercase tracking-wide text-zinc-500">
          Atau pakai URL gambar
        </p>
        <div className="flex gap-2">
          <Input
            placeholder="https://…/wallpaper.jpg"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && url.trim() && apply(url.trim())}
          />
          <Button size="sm" loading={pending} onClick={() => url.trim() && apply(url.trim())} className="shrink-0">
            Pasang
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
