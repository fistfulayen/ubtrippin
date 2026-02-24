/**
 * GET    /api/v1/items/:id  — Get a single trip item
 * PATCH  /api/v1/items/:id  — Update item fields
 * DELETE /api/v1/items/:id  — Delete an item
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem, sanitizeItemInput } from '@/lib/api/sanitize'
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
  const { id: itemId } = await params
  if (!isValidUUID(itemId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Item ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 4. Fetch the item (must belong to this user)
  const { data: item, error } = await supabase
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
    .eq('id', itemId)
    .eq('user_id', auth.userId)
    .single()

  if (error || !item) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Item not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({
    data: sanitizeItem(item as Record<string, unknown>),
  })
}

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
  const { id: itemId } = await params
  if (!isValidUUID(itemId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Item ID must be a valid UUID.' } },
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

  // 5. Sanitize (nothing required for PATCH)
  const result = sanitizeItemInput(body, false)
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

  const supabase = createSecretClient()

  // 6. Verify ownership
  const { data: existing } = await supabase
    .from('trip_items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', auth.userId)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Item not found.' } },
      { status: 404 }
    )
  }

  // 7. Build update — only allowed fields, no mass assignment
  const updates: Record<string, unknown> = {}
  if (clean.kind !== undefined) updates.kind = clean.kind
  if (clean.provider !== undefined) updates.provider = clean.provider
  if (clean.confirmation_code !== undefined) updates.confirmation_code = clean.confirmation_code
  if (clean.summary !== undefined) updates.summary = clean.summary
  if (clean.traveler_names !== undefined) updates.traveler_names = clean.traveler_names
  if (clean.start_ts !== undefined) updates.start_ts = clean.start_ts
  if (clean.end_ts !== undefined) updates.end_ts = clean.end_ts
  if (clean.start_date !== undefined) updates.start_date = clean.start_date
  if (clean.end_date !== undefined) updates.end_date = clean.end_date
  if (clean.start_location !== undefined) updates.start_location = clean.start_location
  if (clean.end_location !== undefined) updates.end_location = clean.end_location
  if (clean.details_json !== undefined) updates.details_json = clean.details_json
  if (clean.status !== undefined) updates.status = clean.status
  if (clean.confidence !== undefined) updates.confidence = clean.confidence
  if (clean.needs_review !== undefined) updates.needs_review = clean.needs_review

  const { data: updatedItem, error } = await supabase
    .from('trip_items')
    .update(updates)
    .eq('id', itemId)
    .eq('user_id', auth.userId)
    .select(ITEM_SELECT)
    .single()

  if (error || !updatedItem) {
    console.error('[v1/items/[id] PATCH] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update item.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: sanitizeItem(updatedItem as Record<string, unknown>) })
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
  const { id: itemId } = await params
  if (!isValidUUID(itemId)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Item ID must be a valid UUID.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  // 4. Verify ownership before deleting
  const { data: existing } = await supabase
    .from('trip_items')
    .select('id')
    .eq('id', itemId)
    .eq('user_id', auth.userId)
    .single()

  if (!existing) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Item not found.' } },
      { status: 404 }
    )
  }

  // 5. Delete
  const { error } = await supabase
    .from('trip_items')
    .delete()
    .eq('id', itemId)
    .eq('user_id', auth.userId)

  if (error) {
    console.error('[v1/items/[id] DELETE] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to delete item.' } },
      { status: 500 }
    )
  }

  return new NextResponse(null, { status: 204 })
}
