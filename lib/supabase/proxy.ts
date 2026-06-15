import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

const PUBLIC_PREFIXES = ['/login', '/signup', '/auth'];

// The marketing landing page is public; everything else under "/" is gated.
function isPublicPath(path: string): boolean {
  if (path === '/') return true;
  return PUBLIC_PREFIXES.some((p) => path.startsWith(p));
}

// Refresh the Supabase session on every request and gate private routes.
// Invoked from the root proxy.ts (Next.js 16's replacement for middleware.ts).
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // getUser() validates the token against the auth server and refreshes it.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = isPublicPath(path);

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('redirectTo', path);
    return NextResponse.redirect(url);
  }

  // Already signed in but visiting an auth page → send to the app.
  if (user && (path.startsWith('/login') || path.startsWith('/signup'))) {
    const url = request.nextUrl.clone();
    url.pathname = '/workspaces';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Return THIS response so refreshed cookies propagate.
  return response;
}
