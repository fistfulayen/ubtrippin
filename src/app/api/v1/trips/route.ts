/**
 * GET /api/v1/trips
 *
 * List all trips for the authenticated API key owner.
 * Ordered by start_date desc (soonest upcoming / most recent first).
 *
 * Response: { data: Trip[], meta: { count: number } }
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { sanitizeTrip } from '@/lib/api/sanitize'
import { createSecretClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Fetch trips for this user (service client, filter by user_id)
  const supabase = createSecretClient()

  const { data: trips, error } = await supabase
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
    .eq('user_id', auth.userId)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (error) {
    console.error('[v1/trips] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch trips.' } },
      { status: 500 }
    )
  }

  const sanitized = (trips ?? []).map(sanitizeTrip)

  return NextResponse.json({
    data: sanitized,
    meta: { count: sanitized.length },
  })
}
