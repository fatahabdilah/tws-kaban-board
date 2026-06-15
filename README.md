# Kanban Board

Aplikasi papan Kanban ala Trello — multi-user dengan peran, dibangun dengan **Next.js 16**, **React 19**, **Tailwind v4**, dan **Supabase** (Auth + Postgres + Row Level Security). Drag-and-drop memakai **@dnd-kit**. Tema gelap dengan brand biru tua.

## Fitur

- **Auth**: daftar / masuk dengan email + password (Supabase Auth).
- **Boards → Lists → Cards** dengan drag-and-drop (pindah & urutkan kartu antar kolom, urutkan kolom).
- **Kartu**: judul, deskripsi, tenggat, penanggung jawab (assignee).
- **Peran per board**: `admin` (kelola anggota + semua isi), `member` (edit list & kartu), `viewer` (read-only).
- **Super admin platform**: melihat & mengelola semua board, mengatur peran platform pengguna lain via `/admin`.

## Setup

### 1. Buat project Supabase
Buat project di [supabase.com](https://supabase.com). Catat dari **Project Settings → API**:
- Project URL
- `anon` public key
- `service_role` key (rahasia)

### 2. Isi environment variables
Salin `.env.example` menjadi `.env.local` dan isi nilai aslinya:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

### 3. Terapkan schema database
Buka **SQL Editor** di dashboard Supabase, tempel seluruh isi
[`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql), dan jalankan.
Ini membuat semua tabel, fungsi helper, trigger, dan kebijakan RLS.

> Catatan: nonaktifkan "Confirm email" di **Authentication → Providers → Email**
> jika ingin login langsung tanpa verifikasi email (cocok untuk dev).

### 4. Bootstrap super admin
Daftar akun lewat aplikasi terlebih dulu (`/signup`), lalu jalankan sekali di SQL Editor:

```sql
update public.profiles set platform_role = 'super_admin'
where email = 'fatah.abdilah@orovagroup.id';
```

Setelah itu, super admin bisa mengangkat pengguna lain lewat halaman `/admin`.

### 5. Jalankan
```bash
npm install
npm run dev
```
Buka [http://localhost:3000](http://localhost:3000).

## Arsitektur (catatan Next.js 16)

Versi Next.js ini memiliki beberapa perubahan penting:
- `cookies()` bersifat **async** → di-`await` (lihat [`lib/supabase/server.ts`](lib/supabase/server.ts)).
- `params` / `searchParams` adalah **Promise** → di-`await` di page.
- **`proxy.ts`** menggantikan `middleware.ts` untuk refresh sesi & proteksi rute.

Keamanan ditegakkan di lapisan database via RLS; setiap Server Action juga memverifikasi `auth.getUser()`. Fungsi `SECURITY DEFINER` (`is_board_member`, `board_role`, dll.) mencegah rekursi RLS pada tabel keanggotaan.

## Regenerasi tipe Supabase (opsional)
Untuk mengganti tipe tulis-tangan dengan tipe hasil generate:
```bash
npx supabase gen types typescript --project-id <project-id> > lib/supabase/types.ts
```
