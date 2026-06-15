'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { SquareKanban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/Button';

const links = [
  { label: 'Fitur', href: '#fitur' },
  { label: 'Cara kerja', href: '#cara-kerja' },
];

export function LandingNavbar() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-colors duration-300',
        scrolled
          ? 'border-b border-border/80 bg-background/80 backdrop-blur-md'
          : 'border-b border-transparent bg-transparent'
      )}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white shadow-[0_4px_16px_-2px_color-mix(in_srgb,var(--primary)_55%,transparent)]">
            <SquareKanban className="h-4.5 w-4.5" />
          </span>
          <span className="text-base font-semibold tracking-tight">Kanban</span>
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {links.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm text-zinc-400 transition-colors hover:text-white"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button asChild variant="ghost" size="sm" className="text-zinc-300">
            <Link href="/login">Masuk</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/signup">Daftar gratis</Link>
          </Button>
        </div>
      </nav>
    </header>
  );
}
