import Link from 'next/link';
import { Button } from '@/components/ui/Button';

export default function BoardNotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 text-center">
      <h1 className="text-xl font-semibold">Board tidak ditemukan</h1>
      <p className="max-w-sm text-sm text-zinc-400">
        Board ini tidak ada atau Anda tidak memiliki akses.
      </p>
      <Link href="/boards">
        <Button variant="secondary" size="sm">
          Kembali ke Boards
        </Button>
      </Link>
    </div>
  );
}
