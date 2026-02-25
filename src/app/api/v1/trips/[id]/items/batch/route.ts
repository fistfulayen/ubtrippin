/**
 * POST /api/v1/trips/:id/items/batch — Insert up to 50 items in one request
 *
 * Body:   { "items": [ <ItemInput>, ... ] }
 * Response: { data: Item[], meta: { count: number } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem, sanitizeItemInput } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/service'
import { isValidUUID } from '@/lib/validation'
import { applyNoVaultEntryFlag } from '@/lib/loyalty-flag'

const BATCH_MAX = 50

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

  // 5. Validate items array
  if (!Array.isArray(body.items)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"items" must be an array.', field: 'items' } },
      { status: 400 }
    )
  }

  if (body.items.length === 0) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"items" array must not be empty.', field: 'items' } },
      { status: 400 }
    )
  }

  if (body.items.length > BATCH_MAX) {
    return NextResponse.json(
      {
        error: {
          code: 'invalid_param',
          message: `Batch limit is ${BATCH_MAX} items per request. Received ${body.items.length}.`,
          field: 'items',
        },
      },
      { status: 400 }
    )
  }

  // 6. Sanitize each item
  const cleanItems: import('@/lib/api/sanitize').SanitizedItemInput[] = []
  for (let i = 0; i < body.items.length; i++) {
    const rawItem = body.items[i]
    if (typeof rawItem !== 'object' || rawItem === null || Array.isArray(rawItem)) {
      return NextResponse.json(
        {
          error: {
            code: 'invalid_param',
            message: `items[${i}] must be a JSON object.`,
            field: `items[${i}]`,
          },
        },
        { status: 400 }
      )
    }
    const result = sanitizeItemInput(rawItem as Record<string, unknown>, true)
    if ('error' in result) {
      return NextResponse.json(
        {
          error: {
            ...result.error,
            message: `items[${i}]: ${result.error.message}`,
            field: `items[${i}].${result.error.field}`,
          },
        },
        { status: 400 }
      )
    }
    cleanItems.push(result.data)
  }

  const supabase = createSecretClient()

  // 7. Verify trip ownership (once for the batch)
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

  // 8. Build insert payload — only explicit fields, no mass assignment
  const insertRows = cleanItems.map((c) => ({
    user_id: auth.userId,
    trip_id: tripId,
    kind: c.kind!,
    start_date: c.start_date ?? null,
    end_date: c.end_date ?? null,
    provider: c.provider ?? null,
    confirmation_code: c.confirmation_code ?? null,
    summary: c.summary ?? null,
    traveler_names: c.traveler_names ?? null,
    start_ts: c.start_ts ?? null,
    end_ts: c.end_ts ?? null,
    start_location: c.start_location ?? null,
    end_location: c.end_location ?? null,
    details_json: c.details_json ?? null,
    status: c.status ?? null,
    confidence: c.confidence ?? null,
    needs_review: c.needs_review ?? null,
  }))

  const { data: items, error } = await supabase
    .from('trip_items')
    .insert(insertRows)
    .select(ITEM_SELECT)

  if (error) {
    console.error('[v1/trips/[id]/items/batch POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to create items.' } },
      { status: 500 }
    )
  }

  for (const item of items ?? []) {
    void applyNoVaultEntryFlag({
      userId: auth.userId,
      tripItemId: item.id as string,
      providerName: (item.provider as string | null) ?? null,
    }).catch((err) => {
      console.error('[items/batch loyalty-flag]', err)
    })
  }

  const sanitized = (items ?? []).map((item) => sanitizeItem(item as Record<string, unknown>))

  return NextResponse.json(
    { data: sanitized, meta: { count: sanitized.length } },
    { status: 201 }
  )
}
