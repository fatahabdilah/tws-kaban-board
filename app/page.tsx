import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  Move,
  Shield,
  Briefcase,
  Tags,
  Paperclip,
  Image as ImageIcon,
  ArrowRight,
  SquareKanban,
} from 'lucide-react';
import { getCurrentUser } from '@/lib/auth/get-user';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/card';
import { LandingNavbar } from '@/components/landing/landing-navbar';
import { BoardPreview } from '@/components/landing/board-preview';

const FEATURES = [
  {
    icon: Move,
    title: 'Drag & drop yang mulus',
    desc: 'Pindahkan kartu antar list dan susun ulang urutan hanya dengan menyeret. Perubahan tersimpan otomatis.',
  },
  {
    icon: Shield,
    title: 'Peran & izin',
    desc: 'Atur siapa yang bisa mengubah lewat peran Admin, Member, dan Viewer — di level workspace maupun board.',
  },
  {
    icon: Briefcase,
    title: 'Workspace untuk tiap tim',
    desc: 'Kelompokkan board ke dalam workspace, undang anggota, dan jaga pekerjaan tetap rapi per tim.',
  },
  {
    icon: Tags,
    title: 'Label & checklist',
    desc: 'Tandai kartu dengan label warna, pecah pekerjaan jadi checklist, dan pantau progres sampai tuntas.',
  },
  {
    icon: Paperclip,
    title: 'Lampiran & tenggat',
    desc: 'Tambahkan lampiran, tetapkan tanggal jatuh tempo, dan tugaskan anggota langsung dari kartu.',
  },
  {
    icon: ImageIcon,
    title: 'Latar board kustom',
    desc: 'Beri tiap board identitasnya sendiri dengan pilihan latar gradien atau gambar.',
  },
];

const STEPS = [
  {
    n: '01',
    title: 'Buat workspace',
    desc: 'Mulai dengan satu workspace untuk tim Anda dan undang anggotanya.',
  },
  {
    n: '02',
    title: 'Susun board & list',
    desc: 'Buat board, tambahkan list seperti Backlog, Dikerjakan, dan Selesai.',
  },
  {
    n: '03',
    title: 'Kerja bareng tim',
    desc: 'Tambah kartu, tugaskan anggota, dan seret kartu seiring pekerjaan berjalan.',
  },
];

export default async function Home() {
  const me = await getCurrentUser();
  if (me) redirect('/workspaces');

  return (
    <div className="min-h-screen overflow-x-hidden bg-background">
      <LandingNavbar />

      {/* Hero */}
      <section className="relative">
        {/* Ambient glow */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          <div className="absolute -top-32 left-1/2 h-96 w-[42rem] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        </div>

        <div className="relative mx-auto max-w-6xl px-6 pb-20 pt-32 text-center md:pt-40">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-border bg-card/60 px-3 py-1 text-xs text-zinc-300">
            <span className="flex h-1.5 w-1.5 rounded-full bg-success" />
            Manajemen kerja tim, sederhana
          </span>

          <h1
            style={{ animationDelay: '60ms' }}
            className="mx-auto mt-6 max-w-3xl animate-fade-up text-4xl font-semibold leading-[1.1] tracking-tight text-white md:text-6xl"
          >
            Atur pekerjaan tim Anda,{' '}
            <span className="bg-linear-to-r from-primary-light to-primary bg-clip-text text-transparent">
              satu kartu sekaligus.
            </span>
          </h1>

          <p
            style={{ animationDelay: '120ms' }}
            className="mx-auto mt-5 max-w-xl animate-fade-up text-base text-zinc-400 md:text-lg"
          >
            Board, list, dan kartu dengan drag-and-drop. Kelola anggota lewat peran admin, member,
            dan viewer — semua dalam satu workspace.
          </p>

          <div
            style={{ animationDelay: '180ms' }}
            className="mt-8 flex animate-fade-up items-center justify-center gap-3"
          >
            <Button asChild size="lg">
              <Link href="/signup">
                Mulai gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="secondary">
              <Link href="/login">Masuk</Link>
            </Button>
          </div>

          {/* Board showcase — real product UI */}
          <div
            style={{ animationDelay: '260ms' }}
            className="relative mx-auto mt-16 max-w-5xl animate-fade-up"
          >
            <div className="pointer-events-none absolute -inset-x-6 -top-6 bottom-0 rounded-3xl bg-linear-to-b from-primary/10 to-transparent blur-2xl" />
            <div className="relative overflow-hidden rounded-2xl border border-border bg-card/40 p-4 shadow-(--shadow-elevated) backdrop-blur-sm md:p-6">
              <div className="mb-4 flex items-center gap-2 px-1">
                <span className="h-3 w-3 rounded-full bg-danger/70" />
                <span className="h-3 w-3 rounded-full bg-warning/70" />
                <span className="h-3 w-3 rounded-full bg-success/70" />
                <span className="ml-3 text-xs text-zinc-500">Board · Peluncuran Produk</span>
              </div>
              <BoardPreview />
              {/* fade the right edge for an "infinite board" feel */}
              <div className="pointer-events-none absolute inset-y-0 right-0 w-20 bg-linear-to-l from-card/80 to-transparent" />
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="fitur" className="mx-auto max-w-6xl scroll-mt-20 px-6 py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Semua yang dibutuhkan untuk tetap selaras
          </h2>
          <p className="mt-3 text-zinc-400">
            Dibuat untuk tim kecil yang ingin bergerak cepat tanpa kehilangan gambaran besar.
          </p>
        </div>

        <div className="mt-12 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <Card key={f.title} interactive className="p-6 hover:border-zinc-700">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15 text-primary-light">
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 font-semibold text-white">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{f.desc}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section id="cara-kerja" className="scroll-mt-20 border-y border-border bg-card/30">
        <div className="mx-auto max-w-6xl px-6 py-24">
          <div className="mx-auto max-w-2xl text-center">
            <h2 className="text-3xl font-semibold tracking-tight text-white md:text-4xl">
              Mulai dalam tiga langkah
            </h2>
            <p className="mt-3 text-zinc-400">Tanpa setup ribet. Buat akun dan langsung kerja.</p>
          </div>

          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-3">
            {STEPS.map((s) => (
              <div key={s.n} className="relative">
                <span className="text-5xl font-semibold text-primary/25">{s.n}</span>
                <h3 className="mt-2 text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-6 py-24">
        <div className="relative overflow-hidden rounded-3xl border border-border bg-linear-to-br from-primary-deep/40 via-card to-background px-8 py-16 text-center md:py-20">
          <div className="pointer-events-none absolute -left-20 top-0 h-64 w-64 rounded-full bg-primary/25 blur-[100px]" />
          <h2 className="relative mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white md:text-4xl">
            Siap merapikan pekerjaan tim Anda?
          </h2>
          <p className="relative mx-auto mt-3 max-w-md text-zinc-300">
            Buat akun gratis dan susun board pertama Anda hari ini.
          </p>
          <div className="relative mt-8 flex items-center justify-center gap-3">
            <Button asChild size="lg">
              <Link href="/signup">
                Mulai gratis <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 sm:flex-row">
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-white">
              <SquareKanban className="h-4 w-4" />
            </span>
            <span className="text-sm font-semibold tracking-tight">Kanban</span>
            <span className="text-sm text-zinc-600">— board workspace untuk tim</span>
          </div>
          <div className="flex items-center gap-5 text-sm text-zinc-500">
            <a href="#fitur" className="transition-colors hover:text-white">
              Fitur
            </a>
            <Link href="/login" className="transition-colors hover:text-white">
              Masuk
            </Link>
            <Link href="/signup" className="transition-colors hover:text-white">
              Daftar
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
