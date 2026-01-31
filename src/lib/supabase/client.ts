import { createBrowserClient } from '@supabase/ssr'

// Using untyped client - generate proper types with `supabase gen types` after schema is deployed
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
