'use server'

import { render } from '@react-email/components'
import { WelcomeEmail } from '@/components/email/welcome'
import { createSecretClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend/client'
import { generateTripName } from '@/lib/trips/naming'

export async function sendWelcomeEmail(
  userId: string,
  userName: string,
  userEmail: string
): Promise<void> {
  const supabase = createSecretClient()

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

  // Use secret client to bypass RLS for the update
  const secretClient = createSecretClient()
  await secretClient
    .from('profiles')
    .update({ onboarding_completed: true })
    .eq('id', user.id)
}

/**
 * Re-generates the trip title based on remaining items.
 * Called after item deletion or move to keep the title accurate.
 */
export async function regenerateTripName(tripId: string): Promise<void> {
  const supabase = createSecretClient()

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
