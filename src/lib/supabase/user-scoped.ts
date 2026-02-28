import { createSecretClient } from '@/lib/supabase/service'

export async function createUserScopedClient(userId: string) {
  const supabase = createSecretClient()

  const { error } = await supabase.rpc('set_request_user', { user_id: userId })
  if (error) {
    throw new Error(`Failed to set request user context: ${error.message}`)
  }

  return supabase
}
