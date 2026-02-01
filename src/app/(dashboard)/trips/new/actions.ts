'use server'

import { createClient } from '@/lib/supabase/server'
import { getDestinationImageUrl } from '@/lib/images/unsplash'

export async function fetchAndSetCoverImage(tripId: string, location: string) {
  const coverImageUrl = await getDestinationImageUrl(location)

  if (coverImageUrl) {
    const supabase = await createClient()
    await supabase.from('trips').update({ cover_image_url: coverImageUrl }).eq('id', tripId)
  }

  return coverImageUrl
}
