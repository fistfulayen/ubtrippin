/**
 * POST /api/v1/trips/:id/merge — Merge a source trip into this trip
 *
 * All items from the source trip are moved to the target trip, then the
 * source trip is deleted. The DB trigger `auto_expand_trip_dates` handles
 * date-range adjustments automatically.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip, sanitizeItem } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

const TRIP_SELECT = `id,
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

const ITEM_SELECT = `id,
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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Validate target trip ID from URL
  const { id: targetTripId } = await params
  if (!isValidUUID(targetTripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Trip ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  // 4. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  // 5. Validate source_trip_id
  const { source_trip_id: sourceTripId } = body
  if (!isValidUUID(sourceTripId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"source_trip_id" must be a valid UUID.' } },
      { status: 400 }
    )
  }

  if (targetTripId === sourceTripId) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Source and target trips must be different.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 6. Verify target trip ownership
  const { data: targetTrip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', targetTripId)
    .eq('user_id', auth.userId)
    .single()

  if (!targetTrip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Target trip not found.' } },
      { status: 404 }
    )
  }

  // 7. Verify source trip ownership
  const { data: sourceTrip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', sourceTripId)
    .eq('user_id', auth.userId)
    .single()

  if (!sourceTrip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Source trip not found.' } },
      { status: 404 }
    )
  }

  // 8. Count items being moved (for meta)
  const { count: itemCount } = await supabase
    .from('trip_items')
    .select('id', { count: 'exact', head: true })
    .eq('trip_id', sourceTripId)
    .eq('user_id', auth.userId)

  const itemsMoved = itemCount ?? 0

  // 9. Move all items from source to target
  const { error: moveError } = await supabase
    .from('trip_items')
    .update({ trip_id: targetTripId })
    .eq('trip_id', sourceTripId)
    .eq('user_id', auth.userId)

  if (moveError) {
    console.error('[v1/trips/[id]/merge] Move items error:', moveError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to move items.' } },
      { status: 500 }
    )
  }

  // 10. Delete source trip
  const { error: deleteError } = await supabase
    .from('trips')
    .delete()
    .eq('id', sourceTripId)
    .eq('user_id', auth.userId)

  if (deleteError) {
    console.error('[v1/trips/[id]/merge] Delete source error:', deleteError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete source trip.' } },
      { status: 500 }
    )
  }

  // 11. Fetch updated target trip
  const { data: updatedTrip, error: tripError } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('id', targetTripId)
    .eq('user_id', auth.userId)
    .single()

  if (tripError || !updatedTrip) {
    console.error('[v1/trips/[id]/merge] Fetch updated trip error:', tripError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Merge succeeded but failed to fetch result.' } },
      { status: 500 }
    )
  }

  // 12. Fetch items for updated trip
  const { data: items, error: itemsError } = await supabase
    .from('trip_items')
    .select(ITEM_SELECT)
    .eq('trip_id', targetTripId)
    .eq('user_id', auth.userId)
    .order('start_date', { ascending: true })

  if (itemsError) {
    console.error('[v1/trips/[id]/merge] Fetch items error:', itemsError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Merge succeeded but failed to fetch items.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    data: {
      trip: sanitizeTrip(updatedTrip as Record<string, unknown>),
      items: (items ?? []).map(sanitizeItem),
    },
    meta: { items_moved: itemsMoved },
  })
}
