/**
 * GET    /api/v1/trips/:id  — Get a trip with its items
 * PATCH  /api/v1/trips/:id  — Update trip fields
 * DELETE /api/v1/trips/:id  — Delete a trip (cascades to items via FK)
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip, sanitizeItem, sanitizeTripInput } from '@/lib/api/sanitize'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { isValidUUID } from '@/lib/validation'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { resolveTripReadAccess, resolveTripWriteAccess } from '@/lib/trips/access'

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

  const supabase = await createUserScopedClient(auth.userId)
  const access = await resolveTripReadAccess({ supabase, tripId, userId: auth.userId })
  if (!access.allowed) {
    const status = access.reason === 'internal_error' ? 500 : access.reason === 'not_found' ? 404 : 403
    return NextResponse.json(
      { error: { code: status === 500 ? 'internal_error' : status === 404 ? 'not_found' : 'forbidden', message: status === 500 ? 'Failed to authorize trip.' : status === 404 ? 'Trip not found.' : 'You cannot access this trip.' } },
      { status }
    )
  }

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

  // 4. Fetch only after explicit object authorization. This matters for the
  // service-role client used by API-key sessions.
  const { data: effectiveTrip, error: tripError } = await supabase
    .from('trips')
    .select(TRIP_FIELDS)
    .eq('id', tripId)
    .maybeSingle()

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
      role: access.role,
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
    return NextResponse.json(
      { error: { code: result.error.code, message: result.error.message } },
      { status: 400 }
    )
  }
  const clean = result.data

  if (Object.keys(clean).length === 0) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'No updatable fields provided.' } },
      { status: 400 }
    )
  }

  // 6. Resolve write access (owner OR editor collaborator OR family member)
  const supabase = await createUserScopedClient(auth.userId)

  const access = await resolveTripWriteAccess({
    supabase,
    tripId,
    userId: auth.userId,
  })

  if (!access.allowed) {
    if (access.reason === 'internal_error') {
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to check trip permissions.' } },
        { status: 500 }
      )
    }

    if (access.reason === 'viewer') {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'You do not have permission to edit this trip.' } },
        { status: 403 }
      )
    }

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
    .maybeSingle()

  if (error) {
    console.error('[v1/trips/[id] PATCH] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update trip.' } },
      { status: 500 }
    )
  }

  if (!updatedTrip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  void dispatchWebhookEvent({
    userId: access.trip.user_id,
    tripId,
    event: 'trip.updated',
    data: {
      trip: sanitizeTrip(updatedTrip as Record<string, unknown>),
    },
  }).catch((err) => console.error('[webhooks] trip.updated dispatch failed:', err))

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

  const supabase = await createUserScopedClient(auth.userId)

  // 4. Verify ownership before deleting
  const { data: existing } = await supabase
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

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  void dispatchWebhookEvent({
    userId: auth.userId,
    tripId,
    event: 'trip.deleted',
    data: {
      trip: sanitizeTrip(existing as Record<string, unknown>),
    },
  }).catch((err) => console.error('[webhooks] trip.deleted dispatch failed:', err))

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
