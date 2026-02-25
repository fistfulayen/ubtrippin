/**
 * GET /api/v1/activation/status
 *
 * Returns the activation state for the authenticated user.
 * Auth: API key via Authorization: Bearer <key>
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { createSecretClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // Authenticate via API key
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const supabase = createSecretClient()

  const { data: profile, error } = await supabase
    .from('profiles')
    .select(
      'activated_at, first_forward_at, second_trip_at, nudge_1_sent_at, nudge_2_sent_at, nudge_3_sent_at'
    )
    .eq('id', auth.userId)
    .single()

  if (error || !profile) {
    console.error('[v1/activation/status] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch activation status.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({
    activated: profile.activated_at !== null,
    first_forward_at: profile.first_forward_at,
    activated_at: profile.activated_at,
    second_trip_at: profile.second_trip_at,
    nudge_1_sent_at: profile.nudge_1_sent_at,
    nudge_2_sent_at: profile.nudge_2_sent_at,
    nudge_3_sent_at: profile.nudge_3_sent_at,
  })
}
