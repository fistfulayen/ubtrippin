/**
 * GET /api/v1/trips/:id
 *
 * Return a single trip with its items for the authenticated API key owner.
 *
 * Response: { data: Trip & { items: Item[] }, meta: { item_count: number } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip, sanitizeItem } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Validate param
  const { id: tripId } = await params
  if (!isValidUUID(tripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Trip ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 4. Fetch the trip (must belong to this user)
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select(
      `id,
       title,
       start_date,
       end_date,
       primary_location,
       travelers,
       notes,
       cover_image_url,
       share_enabled,
       created_at,
       updated_at`
    )
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (tripError || !trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  // 5. Fetch items for this trip
  const { data: items, error: itemsError } = await supabase
    .from('trip_items')
    .select(
      `id,
       trip_id,
       kind,
       provider,
       traveler_names,
       start_ts,
       end_ts,
       start_date,
       end_date,
       start_location,
       end_location,
       summary,
       details_json,
       status,
       confidence,
       needs_review,
       created_at,
       updated_at`
    )
    .eq('trip_id', tripId)
    .eq('user_id', auth.userId)
    .order('start_date', { ascending: true })

  if (itemsError) {
    console.error('[v1/trips/[id]] Supabase items error:', itemsError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trip items.' } },
      { status: 500 }
    )
  }

  const sanitizedItems = (items ?? []).map(sanitizeItem)
  const sanitizedTrip = sanitizeTrip(trip as Record<string, unknown>)

  return NextResponse.json({
    data: {
      ...sanitizedTrip,
      items: sanitizedItems,
    },
    meta: { item_count: sanitizedItems.length },
  })
}
