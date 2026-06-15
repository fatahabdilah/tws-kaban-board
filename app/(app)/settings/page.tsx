import { requireUser } from '@/lib/auth/get-user';
import { ProfileForm } from './profile-form';

export default async function SettingsPage() {
  const me = await requireUser();

  return (
    <div className="mx-auto max-w-2xl px-8 py-10">
      <h1 className="text-2xl font-semibold tracking-tight">Pengaturan profil</h1>
      <p className="mt-1 mb-8 text-sm text-zinc-400">Kelola informasi akun dan keamanan Anda.</p>
      <ProfileForm
        userId={me.userId}
        email={me.profile.email}
        fullName={me.profile.full_name}
        avatarUrl={me.profile.avatar_url}
      />
    </div>
  );
}
