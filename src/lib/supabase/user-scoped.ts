import { createSecretClient } from '@/lib/supabase/service'

/**
 * Legacy API-key client. This returns a service-role client and BYPASSES RLS.
 * The transaction-local RPC does not scope later PostgREST requests. Callers
 * must apply explicit owner filters or relationship authorization to every
 * object operation. Never rely on this helper's name for tenant isolation.
 */
export async function createUserScopedClient(userId: string) {
  const supabase = createSecretClient()

  const { error } = await supabase.rpc('set_request_user', { user_id: userId })
  if (error) {
    throw new Error(`Failed to set request user context: ${error.message}`)
  }

  return supabase
}
