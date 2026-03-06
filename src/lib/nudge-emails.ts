/**
 * Onboarding sequence for PRD-035 activation.
 *
 * Email 2 (day 2): no forwarded booking yet
 * Email 3 (day 5): still no forwarded booking, links to sample trip
 * Email 4 (day 14): active users only (non-demo trip exists), Pro upsell
 */

import { render } from '@react-email/components'
import { createSecretClient } from '@/lib/supabase/service'
import { getResendClient } from '@/lib/resend/client'
import { OnboardingDay2Email } from '@/components/email/onboarding-day-2'
import { OnboardingDay5Email } from '@/components/email/onboarding-day-5'
import { OnboardingDay14FamilyEmail } from '@/components/email/onboarding-day-14-family'

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  subscription_tier: string | null
  nudge_1_sent_at: string | null
  nudge_2_sent_at: string | null
  nudge_3_sent_at: string | null
}

interface TripSummary {
  id: string
  is_demo: boolean
}

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://www.ubtrippin.xyz'

function hoursSince(isoString: string): number {
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60)
}

export async function checkAndSendNudges(): Promise<number> {
  const supabase = createSecretClient()
  const resend = getResendClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select('id, email, full_name, created_at, subscription_tier, nudge_1_sent_at, nudge_2_sent_at, nudge_3_sent_at')

  if (error) {
    console.error('[nudge-emails] Failed to fetch profiles:', error)
    throw error
  }

  const rows = (profiles ?? []) as ProfileRow[]
  let sent = 0

  for (const profile of rows) {
    if (!profile.email) continue

    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('id, is_demo')
      .eq('user_id', profile.id)

    if (tripsError) {
      console.error(`[nudge-emails] Failed to fetch trips for ${profile.id}:`, tripsError)
      continue
    }

    const tripRows = (trips ?? []) as TripSummary[]
    const hasNonDemoTrip = tripRows.some((trip) => !trip.is_demo)
    const demoTrip = tripRows.find((trip) => trip.is_demo)

    const age = hoursSince(profile.created_at)
    const name = profile.full_name ?? 'there'

    // Day 2: no forwarded booking yet (no non-demo trip)
    if (!hasNonDemoTrip && age > 48 && !profile.nudge_1_sent_at) {
      try {
        const html = await render(OnboardingDay2Email({ userName: name }))
        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: "Here's what happens when you forward an email",
          html,
        })

        await supabase
          .from('profiles')
          .update({ nudge_1_sent_at: new Date().toISOString() })
          .eq('id', profile.id)

        sent++
        console.log(`[nudge-emails] Sent day-2 onboarding email to ${profile.email}`)
        continue
      } catch (err) {
        console.error(`[nudge-emails] Failed day-2 email for ${profile.id}:`, err)
      }
    }

    // Day 5: still no forwarded booking
    if (!hasNonDemoTrip && age > 120 && !profile.nudge_2_sent_at) {
      try {
        const demoTripUrl = demoTrip ? `${APP_URL}/trips/${demoTrip.id}` : `${APP_URL}/trips`
        const html = await render(
          OnboardingDay5Email({
            userName: name,
            demoTripUrl,
          })
        )

        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: "Still haven't tried it? Check out your sample trip",
          html,
        })

        await supabase
          .from('profiles')
          .update({ nudge_2_sent_at: new Date().toISOString() })
          .eq('id', profile.id)

        sent++
        console.log(`[nudge-emails] Sent day-5 onboarding email to ${profile.email}`)
        continue
      } catch (err) {
        console.error(`[nudge-emails] Failed day-5 email for ${profile.id}:`, err)
      }
    }

    // Day 14: active users only (has non-demo trip), upsell family sharing for free tier users
    if (
      hasNonDemoTrip &&
      profile.subscription_tier !== 'pro' &&
      age > 336 &&
      !profile.nudge_3_sent_at
    ) {
      try {
        const html = await render(OnboardingDay14FamilyEmail({ userName: name }))

        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: 'Did you know about family sharing?',
          html,
        })

        await supabase
          .from('profiles')
          .update({ nudge_3_sent_at: new Date().toISOString() })
          .eq('id', profile.id)

        sent++
        console.log(`[nudge-emails] Sent day-14 onboarding email to ${profile.email}`)
      } catch (err) {
        console.error(`[nudge-emails] Failed day-14 email for ${profile.id}:`, err)
      }
    }
  }

  return sent
}
