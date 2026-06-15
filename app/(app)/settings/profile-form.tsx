'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Save, Eye, EyeOff, KeyRound, Camera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input, Label } from '@/components/ui/Input';
import { Avatar } from '@/components/ui/Avatar';
import { useToast } from '@/components/ui/Toast';
import { createClient } from '@/lib/supabase/client';
import { updateProfile, changePassword } from './actions';

export function ProfileForm({
  userId,
  email,
  fullName,
  avatarUrl,
}: {
  userId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
}) {
  const router = useRouter();
  const toast = useToast();

  const [name, setName] = useState(fullName ?? '');
  const [avatar, setAvatar] = useState(avatarUrl);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [savingProfile, startProfile] = useTransition();

  async function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) return toast.error('File harus berupa gambar.');
    if (file.size > 2 * 1024 * 1024) return toast.error('Ukuran maksimal 2MB.');

    setUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `${userId}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true, cacheControl: '3600' });
      if (upErr) throw upErr;
      const { data } = supabase.storage.from('avatars').getPublicUrl(path);
      const publicUrl = data.publicUrl;
      await updateProfile({ avatar_url: publicUrl });
      setAvatar(publicUrl);
      toast.success('Foto profil diperbarui');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengunggah foto.');
    } finally {
      setUploading(false);
    }
  }

  async function removeAvatar() {
    setUploading(true);
    try {
      await updateProfile({ avatar_url: null });
      setAvatar(null);
      toast.success('Foto profil dihapus');
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus foto.');
    } finally {
      setUploading(false);
    }
  }

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [savingPw, startPw] = useTransition();

  function saveProfile() {
    startProfile(async () => {
      try {
        await updateProfile({ full_name: name });
        toast.success('Profil disimpan');
        router.refresh();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal menyimpan profil.');
      }
    });
  }

  function savePassword() {
    if (password.length < 6) return toast.error('Password minimal 6 karakter.');
    if (password !== confirm) return toast.error('Konfirmasi password tidak cocok.');
    startPw(async () => {
      try {
        await changePassword(password);
        toast.success('Password diperbarui');
        setPassword('');
        setConfirm('');
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Gagal mengubah password.');
      }
    });
  }

  return (
    <div className="max-w-xl space-y-6">
      {/* Profile */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="relative">
            <Avatar name={name || fullName} email={email} url={avatar} size={56} />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border-2 border-zinc-900 bg-primary text-white transition-colors hover:bg-primary-dark disabled:opacity-60"
              aria-label="Ganti foto"
            >
              {uploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />}
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={onPickFile} />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-medium text-white">{name || fullName || email}</p>
            <p className="text-[11px] text-zinc-500">{email}</p>
            <div className="mt-1.5 flex items-center gap-3 text-[11px]">
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="text-primary-light hover:underline disabled:opacity-60"
              >
                Ganti foto
              </button>
              {avatar && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  disabled={uploading}
                  className="text-zinc-500 hover:text-danger disabled:opacity-60"
                >
                  Hapus
                </button>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="full_name">Nama tampilan</Label>
            <Input
              id="full_name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nama Anda"
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={email} disabled className="opacity-60" />
            <p className="mt-1 text-[11px] text-zinc-600">Email tidak dapat diubah.</p>
          </div>
          <div>
            <Button size="sm" onClick={saveProfile} loading={savingProfile}>
              <Save className="h-4 w-4" /> Simpan profil
            </Button>
          </div>
        </div>
      </div>

      {/* Password */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <h3 className="mb-4 flex items-center gap-2 text-sm font-semibold text-white">
          <KeyRound className="h-4 w-4 text-primary-light" /> Ganti password
        </h3>
        <div className="flex flex-col gap-4">
          <div>
            <Label htmlFor="password">Password baru</Label>
            <div className="relative">
              <Input
                id="password"
                type={show ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 6 karakter"
                className="pr-11"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShow((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
                aria-label={show ? 'Sembunyikan' : 'Tampilkan'}
              >
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>
          <div>
            <Label htmlFor="confirm">Konfirmasi password</Label>
            <Input
              id="confirm"
              type={show ? 'text' : 'password'}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi password baru"
              autoComplete="new-password"
            />
          </div>
          <div>
            <Button size="sm" onClick={savePassword} loading={savingPw}>
              <KeyRound className="h-4 w-4" /> Perbarui password
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
