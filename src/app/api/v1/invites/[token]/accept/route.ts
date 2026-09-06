/**
 * POST /api/v1/invites/:token/accept — Accept an invite (session auth required)
 *
 * The user must be signed in. We match their email against invited_email,
 * then mark the collaborator row as accepted.
 */

import { NextRequest, NextResponse } from 'next/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import { sendInviteAcceptedEmail } from '@/lib/email/collaborator-invite'
import { dispatchWebhookEvent } from '@/lib/webhooks'
import { createSecretClient } from '@/lib/supabase/service'

type Params = { params: Promise<{ token: string }> }

function maskEmail(email: string): string {
  const [local, domain] = email.toLowerCase().split('@')
  if (!local || !domain) return '***'
  const head = local.slice(0, 2)
  return `${head}${'•'.repeat(Math.max(1, local.length - 2))}@${domain}`
}

export async function POST(request: NextRequest, { params }: Params) {
  const { token } = await params

  if (!token || token.length > 64) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid invite token.' } },
      { status: 400 }
    )
  }

  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const { data: { user: authUser } } = await auth.supabase.auth.getUser()
  const userEmail = authUser?.email?.toLowerCase() ?? ''
  if (!userEmail) {
    return NextResponse.json(
      { error: { code: 'forbidden', message: 'A verified account email is required.' } },
      { status: 403 }
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
  if (userEmail !== invite.invited_email.toLowerCase()) {
    return NextResponse.json(
      {
        error: {
          code: 'forbidden',
          message: 'This invite was sent to a different email address. Please sign in with the correct account.',
        },
      },
      { status: 403 }
    )
  }

  // Accept the invite
  const { data: acceptedRows, error: updateError } = await supabase.rpc(
    'accept_trip_collaborator',
    { p_token: token, p_user_id: auth.userId, p_email: userEmail }
  )
  const updated = (acceptedRows as Array<{
    id: string
    trip_id: string
    role: string
    invited_email: string
    invited_by: string
    accepted_at: string
  }> | null)?.[0]

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
    .eq('id', auth.userId)
    .single()

  const accepterName = accepterProfile?.full_name || userEmail || 'Your collaborator'

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
          actor_id: auth.userId,
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

  void dispatchWebhookEvent({
    userId: invite.invited_by,
    tripId: invite.trip_id,
    event: 'collaborator.accepted',
    data: {
      trip: {
        id: invite.trip_id,
        title: tripData?.title || null,
        primary_location: tripData?.primary_location || null,
      },
      collaborator: {
        id: updated.id,
        role: updated.role,
        invited_email_masked: maskEmail(updated.invited_email as string),
        accepted_at: updated.accepted_at,
      },
    },
  }).catch((err) => console.error('[webhooks] collaborator.accepted dispatch failed:', err))

  return NextResponse.json({
    data: {
      ...updated,
      trip_id: invite.trip_id,
    },
  })
}
