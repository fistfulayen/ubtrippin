import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ token: string }> }

export async function POST(_request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 128) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid family invite token.' } },
      { status: 400 }
    )
  }

  const userClient = await createClient()
  const { data: { user }, error: authError } = await userClient.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'You must be signed in to accept a family invite.' } },
      { status: 401 }
    )
  }

  const secret = createSecretClient()

  const { data: invite, error: lookupError } = await secret
    .from('family_members')
    .select('id, family_id, invited_email, accepted_at')
    .eq('invite_token', token)
    .maybeSingle()

  if (lookupError) {
    console.error('[v1/family-invites/:token/accept POST] invite lookup failed', lookupError)
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

  const userEmail = user.email?.trim().toLowerCase() ?? ''
  const invitedEmail = String(invite.invited_email).trim().toLowerCase()

  if (!userEmail || userEmail !== invitedEmail) {
    return NextResponse.json(
      {
        error: {
          code: 'forbidden',
          message: `This invite was sent to ${invite.invited_email}. You are signed in as ${user.email}.`,
        },
      },
      { status: 403 }
    )
  }

  const { error: acceptError } = await secret
    .from('family_members')
    .update({
      user_id: user.id,
      accepted_at: new Date().toISOString(),
      invite_token: null,
    })
    .eq('id', invite.id)

  if (acceptError) {
    if (acceptError.code === '23505') {
      return NextResponse.json(
        {
          error: {
            code: 'conflict',
            message: 'You are already a member of this family.',
          },
        },
        { status: 409 }
      )
    }

    console.error('[v1/family-invites/:token/accept POST] accept failed', acceptError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to accept invite.' } },
      { status: 500 }
    )
  }

  const { data: family } = await secret
    .from('families')
    .select('id, name, created_by, created_at, updated_at')
    .eq('id', invite.family_id as string)
    .maybeSingle()

  if (!family) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Family not found.' } },
      { status: 404 }
    )
  }

  return NextResponse.json({ data: family })
}
