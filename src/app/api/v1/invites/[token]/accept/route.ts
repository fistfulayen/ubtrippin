/**
 * POST /api/v1/invites/:token/accept — Accept an invite (session auth required)
 *
 * The user must be signed in. We match their email against invited_email,
 * then mark the collaborator row as accepted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { sendInviteAcceptedEmail } from '@/lib/email/collaborator-invite'

type Params = { params: Promise<{ token: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 64) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid invite token.' } },
      { status: 400 }
    )
  }

  // Require session auth (cookie-based — user must be logged in)
  const supabaseUser = await createClient()
  const { data: { user }, error: authError } = await supabaseUser.auth.getUser()

  if (authError || !user) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'You must be signed in to accept an invite.' } },
      { status: 401 }
    )
  }

  const supabase = createSecretClient()

  // Lookup the invite
  const { data: invite, error: lookupError } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      trip_id,
      role,
      invited_email,
      invited_by,
      accepted_at,
      trip:trips (id, title, primary_location),
      inviter:profiles!invited_by (full_name, email)
    `)
    .eq('invite_token', token)
    .maybeSingle()

  if (lookupError || !invite) {
    return NextResponse.json(
      { error: { code: 'not_found', message: 'Invite not found.' } },
      { status: 404 }
    )
  }

  if (invite.accepted_at) {
    return NextResponse.json(
      { error: { code: 'gone', message: 'This invite has already been accepted.' } },
      { status: 410 }
    )
  }

  // Verify email matches (case-insensitive)
  const userEmail = user.email?.toLowerCase() ?? ''
  if (userEmail !== invite.invited_email.toLowerCase()) {
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

  // Accept the invite
  const { data: updated, error: updateError } = await supabase
    .from('trip_collaborators')
    .update({
      user_id: user.id,
      accepted_at: new Date().toISOString(),
      invite_token: null,   // consume the token
    })
    .eq('id', invite.id)
    .select('id, trip_id, role, invited_email, accepted_at')
    .single()

  if (updateError || !updated) {
    console.error('[v1/invites/accept]', updateError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to accept invite.' } },
      { status: 500 }
    )
  }

  // Get accepter profile name for notification email
  const { data: accepterProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', user.id)
    .single()

  const accepterName = accepterProfile?.full_name || user.email || 'Your collaborator'

  // Notify the trip owner (non-blocking)
  const { data: ownerProfile } = await supabase
    .from('profiles')
    .select('email')
    .eq('id', invite.invited_by)
    .single()

  const tripData = invite.trip as { id?: string; title?: string; primary_location?: string } | null
  const tripLabel = tripData?.primary_location || tripData?.title || 'your trip'

  if (ownerProfile?.email) {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.com'
    const tripUrl = `${appUrl}/trips/${invite.trip_id}`

    await sendInviteAcceptedEmail({
      to: ownerProfile.email,
      accepterName,
      tripLabel,
      tripUrl,
    }).catch((err: Error) => console.error('[accept notification email]', err))
  }

  // In-app notification for trip owner (fire-and-forget)
  void (async () => {
    try {
      const { error } = await supabase
        .from('notifications')
        .insert({
          user_id: invite.invited_by,
          type: 'invite_accepted',
          trip_id: invite.trip_id,
          actor_id: user.id,
          data: {
            trip_title: tripData?.title || tripLabel,
            actor_name: accepterName,
            role: invite.role,
          },
        })
      if (error) console.error('[accept notification in-app]', error)
    } catch (err) {
      console.error('[accept notification in-app]', err)
    }
  })()

  return NextResponse.json({
    data: {
      ...updated,
      trip_id: invite.trip_id,
    },
  })
}
