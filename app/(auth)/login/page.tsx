import { LoginForm } from '../auth-forms';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirectTo?: string }>;
}) {
  const { redirectTo } = await searchParams;
  return <LoginForm redirectTo={redirectTo && redirectTo.startsWith('/') ? redirectTo : '/workspaces'} />;
}
