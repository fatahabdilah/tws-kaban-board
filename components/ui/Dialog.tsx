'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// Controlled wrapper kept for the app's existing call sites, built on Radix.
export function Dialog({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/65 backdrop-blur-sm duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn(
            'fixed left-1/2 top-[8vh] z-50 w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 rounded-2xl border border-border bg-card p-6 shadow-(--shadow-elevated)',
            'max-h-[84vh] overflow-y-auto',
            'duration-200 ease-[cubic-bezier(0.16,1,0.3,1)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-2 data-[state=open]:slide-in-from-top-2',
            className
          )}
        >
          <DialogPrimitive.Title className={cn('text-base font-semibold text-white', !title && 'sr-only')}>
            {title ?? 'Dialog'}
          </DialogPrimitive.Title>
          {title !== undefined && (
            <DialogPrimitive.Close
              className="absolute right-3.5 top-3.5 flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition-colors hover:bg-accent hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
              aria-label="Tutup"
            >
              <X className="h-4 w-4" />
            </DialogPrimitive.Close>
          )}
          <div className={cn(title !== undefined && 'mt-4')}>{children}</div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
