/**
 * Secret key client — bypasses RLS for internal/background operations.
 *
 * SECURITY (L-003): Only use createSecretClient() when:
 * - No user session is available (webhooks, cron jobs, background processing)
 * - Cross-user data access is explicitly required (webhook delivery, API key lookup)
 * - Admin operations that intentionally need RLS bypass
 *
 * Every user-facing operation using this client, including through the legacy
 * createUserScopedClient helper, requires explicit object authorization.
 * Use the session client when storage or database RLS must remain authoritative.
 */
import { createServerClient } from '@supabase/ssr'

// Secret key client for API-key/webhook/background job access (bypasses RLS).
export function createSecretClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createServerClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_KEY!,
    {
      cookies: {
        getAll() {
          return []
        },
        setAll() {},
      },
    }
  )
}
