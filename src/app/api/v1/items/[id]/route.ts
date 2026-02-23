/**
 * GET /api/v1/items/:id
 *
 * Return a single trip item for the authenticated API key owner.
 *
 * Response: { data: Item }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeItem } from '@/lib/api/sanitize'
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
