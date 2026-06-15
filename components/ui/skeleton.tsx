import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn('skeleton-shimmer relative overflow-hidden rounded-md bg-zinc-800/70', className)}
      {...props}
    />
  );
}
