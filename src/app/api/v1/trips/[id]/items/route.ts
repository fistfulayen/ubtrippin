/**
 * POST /api/v1/trips/:id/items — Add a single item to a trip
 *
 * Response: { data: Item }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem, sanitizeItemInput } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/server'
import { isValidUUID } from '@/lib/validation'

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

  // 6. Verify trip ownership
  const { data: trip } = await supabase
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', auth.userId)
    .single()

  if (!trip) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Trip not found.' } },
      { status: 404 }
    )
  }

  // 7. Insert — only explicit fields, no mass assignment
  const { data: item, error } = await supabase
    .from('trip_items')
    .insert({
      user_id: auth.userId,
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

  return NextResponse.json(
    { data: sanitizeItem(item as Record<string, unknown>) },
    { status: 201 }
  )
}
