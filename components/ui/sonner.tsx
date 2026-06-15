'use client';

import { Toaster as Sonner } from 'sonner';

export function Toaster() {
  return (
    <Sonner
      theme="dark"
      position="bottom-right"
      closeButton
      gap={10}
      toastOptions={{
        classNames: {
          toast:
            'group rounded-xl border border-border bg-card/95 text-foreground shadow-(--shadow-elevated) backdrop-blur-md',
          title: 'text-sm font-medium',
          description: 'text-muted-foreground',
          actionButton: 'bg-primary text-primary-foreground',
          cancelButton: 'bg-secondary text-secondary-foreground',
          success: '[&_[data-icon]]:text-success',
          error: '[&_[data-icon]]:text-destructive',
          warning: '[&_[data-icon]]:text-warning',
        },
      }}
    />
  );
}
