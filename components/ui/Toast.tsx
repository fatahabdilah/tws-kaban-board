'use client';

import { toast as sonnerToast } from 'sonner';
import { Toaster } from './sonner';

type Variant = 'success' | 'error' | 'info' | 'warning';

// Provider now just mounts the sonner <Toaster/>; kept for existing layout usage.
export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <Toaster />
    </>
  );
}

// Same API the app already uses: const toast = useToast(); toast.success('...').
export function useToast() {
  return {
    show: (message: string, variant: Variant = 'info') =>
      variant === 'success'
        ? sonnerToast.success(message)
        : variant === 'error'
          ? sonnerToast.error(message)
          : variant === 'warning'
            ? sonnerToast.warning(message)
            : sonnerToast(message),
    success: (message: string) => sonnerToast.success(message),
    error: (message: string) => sonnerToast.error(message),
    info: (message: string) => sonnerToast(message),
    warning: (message: string) => sonnerToast.warning(message),
  };
}
