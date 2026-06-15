'use client';

import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  "inline-flex cursor-pointer items-center justify-center gap-1.5 whitespace-nowrap rounded-md font-medium transition-[transform,background-color,border-color,box-shadow,color] duration-150 ease-[cubic-bezier(0.16,1,0.3,1)] active:scale-[0.97] active:duration-75 disabled:pointer-events-none disabled:opacity-50 outline-none focus-visible:ring-2 focus-visible:ring-ring/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        primary:
          'bg-primary text-primary-foreground shadow-sm hover:bg-primary-dark hover:shadow-[0_4px_14px_-2px_color-mix(in_srgb,var(--primary)_60%,transparent)] hover:-translate-y-px',
        secondary:
          'border border-border bg-secondary text-secondary-foreground hover:border-zinc-600 hover:bg-zinc-700',
        ghost: 'text-muted-foreground hover:bg-accent hover:text-accent-foreground',
        danger:
          'bg-destructive text-white shadow-sm hover:bg-red-500 hover:shadow-[0_4px_14px_-2px_color-mix(in_srgb,var(--destructive)_55%,transparent)] hover:-translate-y-px',
        outline: 'border border-border bg-transparent hover:border-zinc-600 hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary-light underline-offset-4 hover:underline',
      },
      size: {
        sm: 'h-8 px-3 text-xs',
        md: 'h-9 px-4 text-sm',
        lg: 'h-10 px-6 text-sm',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  asChild = false,
  loading = false,
  disabled,
  children,
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : 'button';
  // Slot requires exactly one child, so the spinner can only be injected when
  // rendering a real <button>. With asChild the caller's element is passed through as-is.
  return (
    <Comp className={cn(buttonVariants({ variant, size, className }))} disabled={disabled || loading} {...props}>
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="h-4 w-4 animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  );
}

export { buttonVariants };
