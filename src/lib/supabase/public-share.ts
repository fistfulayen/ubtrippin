import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

export function createPublicShareClient(shareToken: string) {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
      global: {
        headers: {
          'x-share-token': shareToken,
        },
      },
    }
  )
}
