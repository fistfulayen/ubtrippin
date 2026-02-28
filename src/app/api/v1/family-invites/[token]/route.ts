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

  const secret = await createClient()

  const { data: invite, error: inviteError } = await secret
    .from('family_members')
    .select('id, family_id, invited_email, invited_by, role, accepted_at')
    .eq('invite_token', token)
    .maybeSingle()

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

  const [{ data: family }, { data: inviterProfile }] = await Promise.all([
    secret
      .from('families')
      .select('id, name')
      .eq('id', invite.family_id as string)
      .maybeSingle(),
    secret
      .from('profiles')
      .select('full_name, email')
      .eq('id', invite.invited_by as string)
      .maybeSingle(),
  ])

  if (!family) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family not found for this invite.' } },
      { status: 404 }
    )
  }

  const inviter = inviterProfile as { full_name?: string | null; email?: string | null } | null
  const invitedByName = inviter?.full_name || inviter?.email || 'Someone'

  return NextResponse.json({
    data: {
      family_id: family.id,
      family_name: family.name,
      invited_email: invite.invited_email,
      invited_by_name: invitedByName,
      role: invite.role,
      already_accepted: invite.accepted_at !== null,
    },
  })
}
