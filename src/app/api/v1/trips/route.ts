/**
 * GET  /api/v1/trips  — List trips for the authenticated user
 * POST /api/v1/trips  — Create a new trip
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip, sanitizeTripInput } from '@/lib/api/sanitize'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'
import { trackTripCreated } from '@/lib/activation'
import { dispatchWebhookEvent } from '@/lib/webhooks'

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

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const supabase = await createUserScopedClient(auth.userId)

  // 3a. Fetch owned trips
  const { data: ownedTrips, error: ownedError } = await supabase
    .from('trips')
    .select(TRIP_SELECT)
    .eq('user_id', auth.userId)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (ownedError) {
    console.error('[v1/trips] Supabase error (owned):', ownedError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trips.' } },
      { status: 500 }
    )
  }

  // 3b. Fetch shared trips (collaborator, accepted)
  const { data: sharedCollabs } = await supabase
    .from('trip_collaborators')
    .select(`trip:trips (${TRIP_SELECT}), role`)
    .eq('user_id', auth.userId)
    .not('accepted_at', 'is', null)

  type SharedTripRow = Record<string, unknown> & { role: string }
  const sharedTrips: SharedTripRow[] = (sharedCollabs ?? [])
    .filter((c) => c.trip)
    .map((c) => ({
      ...(c.trip as unknown as Record<string, unknown>),
      role: c.role as string,
    }))

  // 3c. Merge — owned trips first, then shared (deduplicate by id)
  const ownedIds = new Set((ownedTrips ?? []).map((t) => t.id))
  const newShared = sharedTrips.filter((t) => !ownedIds.has(t.id as string))

  const allTrips = [
    ...(ownedTrips ?? []).map((t) => ({ ...t, role: 'owner' })),
    ...newShared,
  ]

  const sanitized = allTrips.map(sanitizeTrip)

  return NextResponse.json({
    data: sanitized,
    meta: { count: sanitized.length },
  })
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Parse body
  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  // 4. Sanitize & validate (title required)
  const result = sanitizeTripInput(body, true)
  if ('error' in result) {
    return NextResponse.json({ error: result.error }, { status: 400 })
  }
  const clean = result.data

  // 5. Insert — never spread raw body; use only validated fields
  const supabase = await createUserScopedClient(auth.userId)
  const { data: trip, error } = await supabase
    .from('trips')
    .insert({
      user_id: auth.userId,
      title: clean.title!,
      start_date: clean.start_date ?? null,
      end_date: clean.end_date ?? null,
      primary_location: clean.primary_location ?? null,
      notes: clean.notes ?? null,
    })
    .select(TRIP_SELECT)
    .single()

  if (error) {
    console.error('[v1/trips POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create trip.' } },
      { status: 500 }
    )
  }

  // Track activation milestone (idempotent, fire-and-forget)
  trackTripCreated(auth.userId, supabase).catch((err) =>
    console.error('[activation] trackTripCreated failed:', err)
  )

  void dispatchWebhookEvent({
    userId: auth.userId,
    tripId: trip.id as string,
    event: 'trip.created',
    data: {
      trip: sanitizeTrip(trip as Record<string, unknown>),
    },
  }).catch((err) => console.error('[webhooks] trip.created dispatch failed:', err))

  return NextResponse.json({ data: sanitizeTrip(trip as Record<string, unknown>) }, { status: 201 })
}
