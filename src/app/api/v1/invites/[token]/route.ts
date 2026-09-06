/**
 * GET /api/v1/invites/:token — Lookup invite (returns trip preview, no auth required)
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 64) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid invite token.' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: previewRows, error } = await supabase.rpc(
    'preview_trip_collaborator_invite',
    { p_token: token }
  )
  const invite = (previewRows as Array<Record<string, unknown>> | null)?.[0]

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

  return NextResponse.json({ data: invite })
}
