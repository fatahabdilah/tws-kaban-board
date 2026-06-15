'use client';

import { useActionState, useState } from 'react';
import Link from 'next/link';
import { Eye, EyeOff, SquareKanban } from 'lucide-react';
import { login, signup, type AuthState } from '@/app/auth/actions';
import { Input, Label } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';

function PasswordInput({ name }: { name: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        type={show ? 'text' : 'password'}
        name={name}
        placeholder="••••••••"
        autoComplete={name === 'password' ? 'current-password' : 'new-password'}
        className="pr-11"
        required
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
        aria-label={show ? 'Hide password' : 'Show password'}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

function Shell({
  heading,
  sub,
  children,
  footer,
}: {
  heading: string;
  sub: string;
  children: React.ReactNode;
  footer: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen">
      {/* Form side */}
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm animate-fade-up">
          <div className="mb-8 flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white shadow-[0_4px_16px_-2px_color-mix(in_srgb,var(--primary)_55%,transparent)]">
              <SquareKanban className="h-5 w-5" />
            </span>
            <span className="text-lg font-semibold tracking-tight">Kanban</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">{heading}</h1>
          <p className="mt-1.5 text-sm text-zinc-400">{sub}</p>
          <div className="mt-8">{children}</div>
          <div className="mt-6 text-center text-sm text-zinc-400">{footer}</div>
        </div>
      </div>
      {/* Brand side */}
      <div className="relative hidden flex-1 items-center justify-center overflow-hidden border-l border-card-border bg-linear-to-br from-primary-deep via-[#0c1b3f] to-background lg:flex">
        {/* Ambient glow + grid for depth */}
        <div className="pointer-events-none absolute -left-20 top-1/4 h-72 w-72 rounded-full bg-primary/25 blur-[100px]" />
        <div className="pointer-events-none absolute bottom-10 right-0 h-64 w-64 rounded-full bg-primary-light/15 blur-[90px]" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              'linear-gradient(to right, #fff 1px, transparent 1px), linear-gradient(to bottom, #fff 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="relative max-w-md animate-fade-up px-12">
          <h2 className="text-3xl font-semibold leading-tight text-white">
            Atur pekerjaan tim Anda, satu kartu sekaligus.
          </h2>
          <p className="mt-4 text-zinc-300">
            Board, list, dan kartu dengan drag-and-drop. Kelola anggota dengan peran admin,
            member, dan viewer.
          </p>
        </div>
      </div>
    </div>
  );
}

export function LoginForm({ redirectTo }: { redirectTo: string }) {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(login, null);
  return (
    <Shell
      heading="Masuk"
      sub="Selamat datang kembali. Silakan masuk ke akun Anda."
      footer={
        <>
          Belum punya akun?{' '}
          <Link href="/signup" className="font-medium text-primary-light hover:underline">
            Daftar
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="redirectTo" value={redirectTo} />
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" name="email" placeholder="you@email.com" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput name="password" />
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" loading={pending} className="mt-2 w-full">
          Masuk
        </Button>
      </form>
    </Shell>
  );
}

export function SignupForm() {
  const [state, formAction, pending] = useActionState<AuthState, FormData>(signup, null);
  return (
    <Shell
      heading="Buat akun"
      sub="Mulai kelola board Anda dalam hitungan detik."
      footer={
        <>
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-primary-light hover:underline">
            Masuk
          </Link>
        </>
      }
    >
      <form action={formAction} className="flex flex-col gap-4">
        <div>
          <Label htmlFor="full_name">Nama lengkap</Label>
          <Input id="full_name" type="text" name="full_name" placeholder="Nama Anda" autoComplete="name" />
        </div>
        <div>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" name="email" placeholder="you@email.com" autoComplete="email" required />
        </div>
        <div>
          <Label htmlFor="password">Password</Label>
          <PasswordInput name="password" />
        </div>
        {state?.error && <p className="text-sm text-danger">{state.error}</p>}
        <Button type="submit" loading={pending} className="mt-2 w-full">
          Daftar
        </Button>
      </form>
    </Shell>
  );
}
