/**
 * GET /api/v1/join/[code] — Validate an invite code
 *
 * Returns:
 *   { valid: true,  inviter_name: "Ian", expired: false }
 *   { valid: false, reason: "expired" | "used" | "not_found" }
 *
 * No authentication required — this endpoint is called from the public join page.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { consumePublicRateLimit } from '@/lib/api/durable-rate-limit'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  const { code } = await params

  if (!await consumePublicRateLimit(request, 'invite-preview', 30, 60)) {
    return NextResponse.json({ valid: false, reason: 'not_found' }, { status: 429 })
  }

  if (!code || typeof code !== 'string' || !/^[A-Fa-f0-9]{32}$/.test(code)) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }

  const supabase = createSecretClient()

  const { data: invite, error } = await supabase
    .from('invites')
    .select('id, expires_at, used_at, inviter_id, invitee_id')
    .eq('code', code.toUpperCase())
    .maybeSingle()

  if (error) {
    console.error('[v1/join/[code] GET]', error.message)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to validate invite.' } },
      { status: 500 }
    )
  }

  if (!invite) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }

  if (invite.used_at || new Date(invite.expires_at) < new Date()) {
    return NextResponse.json({ valid: false, reason: 'not_found' })
  }

  // Fetch inviter's first name (no PII beyond first name needed here)
  const { data: inviter } = await supabase
    .from('profiles')
    .select('full_name')
    .eq('id', invite.inviter_id)
    .single()

  const fullName = inviter?.full_name ?? ''
  const inviterFirstName = fullName.split(' ')[0] || 'Someone'

  return NextResponse.json({
    valid: true,
    inviter_name: inviterFirstName,
    expires_at: invite.expires_at,
    expired: false,
  })
}
