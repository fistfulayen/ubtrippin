/**
 * GET    /api/v1/trips/:id  — Get a trip with its items
 * PATCH  /api/v1/trips/:id  — Update trip fields
 * DELETE /api/v1/trips/:id  — Delete a trip (cascades to items via FK)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip, sanitizeItem, sanitizeTripInput } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/service'
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

  const TRIP_FIELDS = `id,
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

  // 4. Fetch the trip — accessible to owner or accepted collaborator
  const { data: trip, error: tripError } = await supabase
    .from('trips')
    .select(TRIP_FIELDS)
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .maybeSingle()

  // If not owner, check collaborator access
  let collabRole: string | null = null
  let effectiveTrip = trip

  if (!trip) {
    const { data: collab } = await supabase
      .from('trip_collaborators')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', auth.userId)
      .not('accepted_at', 'is', null)
      .maybeSingle()

    if (collab) {
      collabRole = collab.role
      const { data: sharedTrip } = await supabase
        .from('trips')
        .select(TRIP_FIELDS)
        .eq('id', tripId)
        .single()
      effectiveTrip = sharedTrip
    }
  }

  if (tripError || !effectiveTrip) {
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
    .order('start_date', { ascending: true })

  if (itemsError) {
    console.error('[v1/trips/[id]] Supabase items error:', itemsError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trip items.' } },
      { status: 500 }
    )
  }

  const sanitizedItems = (items ?? []).map(sanitizeItem)
  const sanitizedTrip = sanitizeTrip(effectiveTrip as Record<string, unknown>)

  return NextResponse.json({
    data: {
      ...sanitizedTrip,
      role: collabRole ?? 'owner',
      items: sanitizedItems,
    },
    meta: { item_count: sanitizedItems.length },
  })
}

export async function PATCH(
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

  // 5. Sanitize (title not required for PATCH)
  const result = sanitizeTripInput(body, false)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const clean = result.data

  if (Object.keys(clean).length === 0) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'No updatable fields provided.' } },
      { status: 400 }
    )
  }

  // 6. Update — verify ownership via .eq('user_id') + check rows affected
  const supabase = createSecretClient()

  // First check ownership
  const { data: existing } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  // Build update — only allowed fields, no mass assignment
  const updates: Record<string, unknown> = {}
  if (clean.title !== undefined) updates.title = clean.title
  if (clean.start_date !== undefined) updates.start_date = clean.start_date
  if (clean.end_date !== undefined) updates.end_date = clean.end_date
  if (clean.primary_location !== undefined) updates.primary_location = clean.primary_location
  if (clean.notes !== undefined) updates.notes = clean.notes
  if (clean.cover_image_url !== undefined) updates.cover_image_url = clean.cover_image_url
  if (clean.share_enabled !== undefined) updates.share_enabled = clean.share_enabled

  const { data: updatedTrip, error } = await supabase
    .from('trips')
    .update(updates)
    .eq('id', tripId)
    .eq('user_id', auth.userId)
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
    .single()

  if (error || !updatedTrip) {
    console.error('[v1/trips/[id] PATCH] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update trip.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: sanitizeTrip(updatedTrip as Record<string, unknown>) })
}

export async function DELETE(
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

  // 4. Verify ownership before deleting
  const { data: existing } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  // 5. Delete (FK constraint cascades to trip_items)
  const { error } = await supabase
    .from('trips')
    .delete()
    .eq('id', tripId)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('[v1/trips/[id] DELETE] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete trip.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
