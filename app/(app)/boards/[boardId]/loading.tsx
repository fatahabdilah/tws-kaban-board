import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="flex h-screen flex-col">
      <div className="flex items-center justify-between border-b border-border px-6 py-4">
        <div>
          <Skeleton className="h-3 w-28" />
          <Skeleton className="mt-2 h-6 w-44" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <div className="flex flex-1 items-start gap-4 overflow-hidden p-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="w-72 shrink-0 rounded-xl border border-border bg-card p-3">
            <Skeleton className="mb-3 h-5 w-28" />
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-16 w-full rounded-xl" />
              <Skeleton className="h-12 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
