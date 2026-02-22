'use server'

import { createClient } from '@/lib/supabase/server'
import { getDestinationImageUrl } from '@/lib/images/unsplash'
import { isValidUUID } from '@/lib/validation'

export async function fetchAndSetCoverImage(tripId: string, location: string) {
  // SECURITY: Validate that tripId is a real UUID (prevents log spam / malformed queries)
  if (!isValidUUID(tripId)) return null

  // SECURITY: Verify user is authenticated before performing any action
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const coverImageUrl = await getDestinationImageUrl(location)

  if (coverImageUrl) {
    // SECURITY: The update is scoped to both tripId and user.id — defense-in-depth on top of RLS
    await supabase
      .from('trips')
      .update({ cover_image_url: coverImageUrl })
      .eq('id', tripId)
      .eq('user_id', user.id)
  }

  return coverImageUrl
}
