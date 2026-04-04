/**
 * Secret key client — bypasses RLS for internal/background operations.
 *
 * SECURITY (L-003): Only use createSecretClient() when:
 * - No user session is available (webhooks, cron jobs, background processing)
 * - Cross-user data access is explicitly required (webhook delivery, API key lookup)
 * - Admin operations that intentionally need RLS bypass
 *
 * Do NOT use in user-facing API routes — use createUserScopedClient() instead.
 * This code is security-audited monthly.
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
