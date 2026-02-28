'use server'

import { render } from '@react-email/components'
import { WelcomeEmail } from '@/components/email/welcome'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend/client'
import { generateTripName } from '@/lib/trips/naming'

export async function sendWelcomeEmail(
  userId: string,
  userName: string,
  userEmail: string
): Promise<void> {
  const supabase = await createClient()

  // Check if already sent
  const { data: profile } = await supabase
    .from('profiles')
    .select('welcome_email_sent')
    .eq('id', userId)
    .single()

  if (profile?.welcome_email_sent) return

  const html = await render(WelcomeEmail({ userName, userEmail }))

  const resend = getResendClient()
  await resend.emails.send({
    from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
    to: userEmail,
    subject: 'Welcome to UBTRIPPIN 🧳',
    html,
  })

  await supabase
    .from('profiles')
    .update({ welcome_email_sent: true })
    .eq('id', userId)
}

/**
 * Marks the first-trip celebration banner as dismissed.
 * Sets onboarding_completed = true so it never shows again.
 */
export async function dismissFirstTripBanner(): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  await supabase
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)
}

/**
 * Send a collaborator invite — inserts row + triggers email.
 * Moved from client component to server action to avoid browser RLS issues.
 */
export async function sendCollaboratorInvite(
  tripId: string,
  email: string,
  role: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: 'You must be signed in.' }

  const sc = await createClient()
  const cleanEmail = email.trim().toLowerCase()

  // Verify user owns the trip
  const { data: trip } = await sc
    .from('trips')
    .select('id, user_id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .single()
  if (!trip) return { error: 'Trip not found.' }

  // Check for existing invite
  const { data: existing } = await sc
    .from('trip_collaborators')
    .select('id, accepted_at')
    .eq('trip_id', tripId)
    .eq('invited_email', cleanEmail)
    .maybeSingle()

  if (existing) {
    return {
      error: existing.accepted_at
        ? 'This person is already a collaborator.'
        : 'An invite is already pending for this email.',
    }
  }

  // Generate token
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
  const arr = new Uint8Array(32)
  crypto.getRandomValues(arr)
  const inviteToken = Array.from(arr, (b) => chars[b % chars.length]).join('')

  const { error } = await sc
    .from('trip_collaborators')
    .insert({
      trip_id: tripId,
      role,
      invited_email: cleanEmail,
      invited_by: user.id,
      invite_token: inviteToken,
    })

  if (error) return { error: 'Failed to send invite. Please try again.' }

  // Trigger email (non-blocking)
  fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'}/api/internal/send-invite`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tripId, inviteToken }),
  }).catch(() => {})

  return { success: true }
}

/**
 * Removes a collaborator from a trip.
 * Owner-only operation executed on the server.
 */
export async function removeCollaborator(
  tripId: string,
  collabId: string
): Promise<{ error?: string; success?: boolean }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return { error: 'You must be signed in.' }

  const sc = await createClient()

  // Owner check using service client to avoid relying on client-provided IDs.
  const { data: trip } = await sc
    .from('trips')
    .select('id')
    .eq('id', tripId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!trip) return { error: 'Not authorized.' }

  const { error } = await sc
    .from('trip_collaborators')
    .delete()
    .eq('id', collabId)
    .eq('trip_id', tripId)

  if (error) return { error: 'Failed to remove collaborator.' }

  return { success: true }
}

/**
 * Re-generates the trip title based on remaining items.
 * Called after item deletion or move to keep the title accurate.
 */
export async function regenerateTripName(tripId: string): Promise<void> {
  const supabase = await createClient()

  const { data: trip } = await supabase
    .from('trips')
    .select('id, user_id, title')
    .eq('id', tripId)
    .single()

  if (!trip) return

  const { data: items } = await supabase
    .from('trip_items')
    .select('kind, start_location, end_location, start_date, end_date, provider, summary, traveler_names')
    .eq('trip_id', tripId)
    .order('start_date', { ascending: true })

  if (!items || items.length === 0) return

  const newTitle = await generateTripName(items, trip.title)
  if (newTitle && newTitle !== trip.title) {
    await supabase
      .from('trips')
      .update({ title: newTitle })
      .eq('id', tripId)
  }
}
