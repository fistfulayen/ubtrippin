import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

type Params = { params: Promise<{ token: string }> }

export async function GET(_request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 128) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid family invite token.' } },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: previewRows, error: inviteError } = await supabase.rpc(
    'preview_family_invite',
    { p_token: token }
  )
  const invite = (previewRows as Array<{
    family_id: string
    family_name: string
    invited_email_hint: string
    inviter_name: string
    role: string
  }> | null)?.[0]

  if (inviteError) {
    console.error('[v1/family-invites/:token GET] invite lookup failed', inviteError)
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

  return NextResponse.json({
    data: {
      family_id: invite.family_id,
      family_name: invite.family_name,
      invited_email_hint: invite.invited_email_hint,
      invited_by_name: invite.inviter_name,
      role: invite.role,
      already_accepted: false,
    },
  })
}
