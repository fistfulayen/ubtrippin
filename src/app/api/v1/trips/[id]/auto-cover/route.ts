/**
 * POST /api/v1/trips/:id/auto-cover
 *
 * Automatically find and set a cover image for a trip based on its items.
 * For event trips: searches Brave Images for performer/event name.
 * For travel trips: searches Unsplash for destination.
 * Skips if the trip already has a cover image.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'
import { searchBraveImages } from '@/lib/images/brave-image-search'
import { storeCoverImage } from '@/lib/images/store-cover-image'
import { getDestinationImageUrl } from '@/lib/images/unsplash'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: tripId } = await params
  if (!isValidUUID(tripId)) {
    return NextResponse.json({ error: 'Invalid ID' }, { status: 400 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Get trip (check ownership and current image)
  const { data: trip } = await supabase
    .from('trips')
    .select('id, title, cover_image_url, user_id')
    .eq('id', tripId)
    .single()

  if (!trip || trip.user_id !== user.id) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Skip if already has a cover image
  if (trip.cover_image_url) {
    return NextResponse.json({ skipped: true, reason: 'already has cover image' })
  }

  // Get trip items to determine search strategy
  const { data: items } = await supabase
    .from('trip_items')
    .select('kind, details_json, start_location')
    .eq('trip_id', tripId)

  if (!items || items.length === 0) {
    return NextResponse.json({ skipped: true, reason: 'no items' })
  }

  // Check if this is an event-driven trip
  const isEventTrip = items.every((i) =>
    i.kind === 'ticket' || i.kind === 'activity' ||
    (i.details_json as Record<string, unknown> | null)?.event_name != null
  )

  let coverImageUrl: string | null = null

  if (isEventTrip) {
    const details = items[0].details_json as Record<string, unknown> | null
    const performer = details?.performer as string | undefined
    const eventName = details?.event_name as string | undefined
    const query = performer || eventName || trip.title

    if (query) {
      // Try Brave Images first (better for performers/events)
      const braveImage = await searchBraveImages(query)
      if (braveImage) {
        coverImageUrl = await storeCoverImage(braveImage, user.id, tripId)
      }
      // Fall back to Unsplash
      if (!coverImageUrl) {
        coverImageUrl = await getDestinationImageUrl(query, trip.title)
      }
    }
  } else {
    // Regular trip — search by location
    const location = items.find((i) => i.start_location)?.start_location
    if (location) {
      const query = location
        .replace(/\s*\([A-Z]{3}\)\s*/g, ' ')
        .replace(/^[A-Z]{3}\s*[-–]\s*/, '')
        .trim()
      coverImageUrl = await getDestinationImageUrl(query, trip.title)
    }
  }

  if (coverImageUrl) {
    await supabase
      .from('trips')
      .update({ cover_image_url: coverImageUrl })
      .eq('id', tripId)
    return NextResponse.json({ set: true, url: coverImageUrl })
  }

  return NextResponse.json({ skipped: true, reason: 'no image found' })
}
