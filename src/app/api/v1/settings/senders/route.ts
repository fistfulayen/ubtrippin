/**
 * GET  /api/v1/settings/senders — List allowed email senders
 * POST /api/v1/settings/senders — Add an allowed sender
 *
 * Allowed senders are email addresses from which the app will process
 * forwarded confirmation emails on behalf of the user.
 */

import { NextRequest, NextResponse } from 'next/server'
import { validateApiKey, isAuthError } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { createSecretClient } from '@/lib/supabase/server'

/** Basic email format validation (RFC 5322 simplified). */
function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 254
}

/** Strip HTML tags and trim. */
function stripHtml(value: string): string {
  return value.replace(/<[^>]*>/g, '').trim()
}

export async function GET(request: NextRequest) {
  // 1. Authenticate
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  // 2. Rate limit
  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  // 3. Fetch senders for this user
  const supabase = createSecretClient()
  const { data: senders, error } = await supabase
    .from('allowed_senders')
    .select('*')
    .eq('user_id', auth.userId)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[v1/settings/senders GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch senders.' } },
      { status: 500 }
    )
  }

  const list = senders ?? []
  return NextResponse.json({
    data: list,
    meta: { count: list.length },
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

  // 4. Validate email (required)
  if (typeof body.email !== 'string' || !body.email.trim()) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"email" is required.', field: 'email' } },
      { status: 400 }
    )
  }

  const email = body.email.trim().toLowerCase()

  if (!isValidEmail(email)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: '"email" must be a valid email address (max 254 chars).', field: 'email' } },
      { status: 400 }
    )
  }

  // 5. Sanitize optional name
  let name: string | null = null
  if (body.name !== undefined && body.name !== null) {
    if (typeof body.name !== 'string') {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: '"name" must be a string.', field: 'name' } },
        { status: 400 }
      )
    }
    const cleaned = stripHtml(body.name)
    if (cleaned.length > 200) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: '"name" must be 200 characters or fewer.', field: 'name' } },
        { status: 400 }
      )
    }
    name = cleaned || null
  }

  // 6. Insert
  const supabase = createSecretClient()
  const { data: sender, error } = await supabase
    .from('allowed_senders')
    .insert({
      user_id: auth.userId,
      email,
      name,
    })
    .select('*')
    .single()

  if (error) {
    // Unique constraint violation → duplicate sender
    if (error.code === '23505') {
      return NextResponse.json(
        { error: { code: 'conflict', message: 'This email address is already in your allowed senders list.' } },
        { status: 409 }
      )
    }
    console.error('[v1/settings/senders POST] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to add sender.' } },
      { status: 500 }
    )
  }

  return NextResponse.json({ data: sender }, { status: 201 })
}
