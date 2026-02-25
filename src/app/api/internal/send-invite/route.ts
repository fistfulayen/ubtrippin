/**
 * POST /api/internal/send-invite — Send collaborator invite email
 *
 * Called from the UI after inserting a trip_collaborators row.
 * Uses session auth (cookie). Looks up invite details and sends email.
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createSecretClient } from '@/lib/supabase/service'
import { sendCollaboratorInviteEmail } from '@/lib/email/collaborator-invite'
import { isValidUUID } from '@/lib/validation'

export async function POST(request: NextRequest) {
  // Session auth
  const userSupabase = await createClient()
  const { data: { user } } = await userSupabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: { tripId?: string; inviteToken?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { tripId, inviteToken } = body

  if (!tripId || !isValidUUID(tripId) || !inviteToken) {
    return NextResponse.json({ error: 'Invalid params' }, { status: 400 })
  }

  const supabase = createSecretClient()

  // Fetch invite details
  const { data: invite } = await supabase
    .from('trip_collaborators')
    .select(`
      id,
      invited_email,
      role,
      trip:trips (title, primary_location),
      inviter:profiles!invited_by (full_name, email)
    `)
    .eq('trip_id', tripId)
    .eq('invite_token', inviteToken)
    .maybeSingle()

  if (!invite) {
    return NextResponse.json({ error: 'Invite not found' }, { status: 404 })
  }

  const inviterData = invite.inviter as { full_name?: string; email?: string } | null
  const tripData = invite.trip as { title?: string; primary_location?: string } | null

  const inviterName = inviterData?.full_name || inviterData?.email || 'Someone'
  const tripLabel = tripData?.primary_location || tripData?.title || 'a trip'
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://ubtrippin.com'
  const inviteUrl = `${appUrl}/invite/${inviteToken}`

  await sendCollaboratorInviteEmail({
    to: invite.invited_email,
    inviterName,
    tripLabel,
    inviteUrl,
  }).catch((err: Error) => console.error('[send-invite]', err))

  return NextResponse.json({ ok: true })
}
