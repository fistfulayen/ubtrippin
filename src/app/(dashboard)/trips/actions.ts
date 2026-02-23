'use server'

import { render } from '@react-email/components'
import { WelcomeEmail } from '@/components/email/welcome'
import { createSecretClient } from '@/lib/supabase/server'
import { createClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend/client'

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
