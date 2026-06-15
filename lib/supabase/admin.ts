import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';

// Service-role client — BYPASSES RLS. Server-only.
// Use ONLY for trusted platform tooling (e.g. super_admin bootstrap).
// Never import into a Client Component, never expose the key to the browser.
export function createAdminClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
