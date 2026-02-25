/**
 * GET  /api/v1/calendar/token — Get current calendar token and feed URL
 * POST /api/v1/calendar/token — Generate or regenerate calendar token
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/service'
import crypto from 'crypto'

const BASE_URL = 'https://www.ubtrippin.xyz'

function feedUrl(token: string): string {
  return `${BASE_URL}/api/calendar/feed?token=${token}`
}

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Fetch profile
  const supabase = createSecretClient()
  const { data: profile, error } = await supabase
    .from('profiles')
    .select('calendar_token')
    .eq('id', auth.userId)
    .single()

  if (error) {
    console.error('[v1/calendar/token GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch calendar token.' } },
      { status: 500 }
    )
  }

  const token = (profile as { calendar_token: string | null } | null)?.calendar_token ?? null

  return NextResponse.json({
    data: {
      token,
      feed_url: token ? feedUrl(token) : null,
    },
  })
}

export async function POST(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Generate a new token
  const token = crypto.randomBytes(24).toString('base64url')

  // 4. Update profile
  const supabase = createSecretClient()
  const { error } = await supabase
    .from('profiles')
    .update({ calendar_token: token })
    .eq('id', auth.userId)

  if (error) {
    console.error('[v1/calendar/token POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to generate calendar token.' } },
      { status: 500 }
    )
  }

  return NextResponse.json(
    {
      data: {
        token,
        feed_url: feedUrl(token),
      },
    },
    { status: 201 }
  )
}
