/**
 * POST /api/v1/trips/:id/items — Add a single item to a trip
 *
 * Accessible by: trip owner + accepted editors (collaborators)
 * Items are stored under the trip owner's user_id for UI compatibility.
 * When a collaborator adds an item, the trip owner receives a notification.
 *
 * Response: { data: Item }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem, sanitizeItemInput } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'
import { applyNoVaultEntryFlag } from '@/lib/loyalty-flag'
import { dispatchWebhookEvent } from '@/lib/webhooks'

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

  // 3. Validate trip ID
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

  // 5. Sanitize & validate (kind + start_date required)
  const result = sanitizeItemInput(body, true)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const clean = result.data

  const supabase = createSecretClient()

  // 6. Resolve trip access: owner OR accepted editor collaborator
  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, title, primary_location')
    .eq('id', tripId)
    .maybeSingle()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  const isOwner = trip.user_id === auth.userId
  let isEditor = false

  if (!isOwner) {
    // Check collaborator editor access
    const { data: collab } = await supabase
      .from('trip_collaborators')
      .select('role')
      .eq('trip_id', tripId)
      .eq('user_id', auth.userId)
      .not('accepted_at', 'is', null)
      .maybeSingle()

    if (!collab) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'Trip not found.' } },
        { status: 404 }
      )
    }

    if (collab.role === 'viewer') {
      return NextResponse.json(
        { error: { code: 'forbidden', message: 'Viewers cannot add items to a trip.' } },
        { status: 403 }
      )
    }

    isEditor = true
  }

  // 7. Insert — items stored under trip owner's user_id for UI compatibility
  const { data: item, error } = await supabase
    .from('trip_items')
    .insert({
      user_id: trip.user_id,   // always the trip owner
      trip_id: tripId,
      kind: clean.kind!,
      start_date: clean.start_date ?? null,
      end_date: clean.end_date ?? null,
      provider: clean.provider ?? null,
      confirmation_code: clean.confirmation_code ?? null,
      summary: clean.summary ?? null,
      traveler_names: clean.traveler_names ?? null,
      start_ts: clean.start_ts ?? null,
      end_ts: clean.end_ts ?? null,
      start_location: clean.start_location ?? null,
      end_location: clean.end_location ?? null,
      details_json: clean.details_json ?? null,
      status: clean.status ?? null,
      confidence: clean.confidence ?? null,
      needs_review: clean.needs_review ?? null,
    })
    .select(ITEM_SELECT)
    .single()

  if (error) {
    console.error('[v1/trips/[id]/items POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create item.' } },
      { status: 500 }
    )
  }

  if (item) {
    void applyNoVaultEntryFlag({
      userId: trip.user_id,
      tripItemId: item.id,
      providerName: item.provider,
    }).catch((err) => {
      console.error('[items/loyalty-flag]', err)
    })
  }

  // 8. Fire notification to trip owner when a collaborator adds an item
  if (isEditor && item) {
    // Get collaborator's display name
    const { data: actorProfile } = await supabase
      .from('profiles')
      .select('full_name, email')
      .eq('id', auth.userId)
      .maybeSingle()

    const actorName = actorProfile?.full_name || actorProfile?.email || 'A collaborator'
    const summary = clean.summary || `${clean.kind} entry`

    void (async () => {
      try {
        const { error } = await supabase
          .from('notifications')
          .insert({
            user_id: trip.user_id,
            type: 'entry_added',
            trip_id: tripId,
            actor_id: auth.userId,
            data: {
              trip_title: trip.title,
              actor_name: actorName,
              entry_summary: summary,
              entry_kind: clean.kind,
            },
          })
        if (error) console.error('[items/notifications]', error)
      } catch (err) {
        console.error('[items/notifications]', err)
      }
    })()
  }

  if (item) {
    void dispatchWebhookEvent({
      userId: trip.user_id as string,
      tripId,
      event: 'item.created',
      data: {
        trip: {
          id: trip.id,
          title: trip.title,
          primary_location: trip.primary_location,
        },
        item: sanitizeItem(item as Record<string, unknown>),
      },
    }).catch((err) => console.error('[webhooks] item.created dispatch failed:', err))
  }

  return NextResponse.json(
    { data: sanitizeItem(item as Record<string, unknown>) },
    { status: 201 }
  )
}
