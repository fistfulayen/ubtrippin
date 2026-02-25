/**
 * GET /api/v1/invites/:token — Lookup invite (returns trip preview, no auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 64) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid invite token.' } },
      { status: 400 }
    )
  }

  const supabase = createSecretClient()

  const { data: invite, error } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      role,
      invited_email,
      accepted_at,
      trip:trips (
        id,
        title,
        primary_location,
        start_date,
        end_date,
        cover_image_url
      ),
      inviter:profiles!invited_by (
        full_name,
        email
      )
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (error) {
    console.error('[v1/invites GET]', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to lookup invite.' } },
      { status: 500 }
    )
  }

  if (!invite) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Invite not found or already used.' } },
      { status: 404 }
    )
  }

  if (invite.accepted_at) {
    return NextResponse.json(
      { error: { code: 'gone', message: 'This invite has already been accepted.' } },
      { status: 410 }
    )
  }

  return NextResponse.json({ data: invite })
}
