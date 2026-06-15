'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
  buttonVariants,
} from './alert-dialog';
import { cn } from '@/lib/utils';

type ConfirmVariant = 'default' | 'danger';
type ConfirmOptions = {
  title: string;
  message?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: ConfirmVariant;
};
type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOptions | null>(null);
  const resolverRef = useRef<((v: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setOpts(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <AlertDialog open={!!opts} onOpenChange={(o) => !o && close(false)}>
        <AlertDialogContent>
          <AlertDialogTitle>{opts?.title}</AlertDialogTitle>
          {opts?.message && <AlertDialogDescription>{opts.message}</AlertDialogDescription>}
          <div className="mt-5 flex justify-end gap-2">
            <AlertDialogCancel className={cn(buttonVariants({ variant: 'secondary', size: 'sm' }))}>
              {opts?.cancelLabel ?? 'Batal'}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => close(true)}
              className={cn(
                buttonVariants({ variant: opts?.variant === 'danger' ? 'danger' : 'primary', size: 'sm' })
              )}
            >
              {opts?.confirmLabel ?? 'Konfirmasi'}
            </AlertDialogAction>
          </div>
        </AlertDialogContent>
      </AlertDialog>
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  return (
    ctx ??
    ((opts) => Promise.resolve(typeof window !== 'undefined' && window.confirm(opts.title)))
  );
}
