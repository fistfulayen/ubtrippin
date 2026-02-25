/**
 * Nudge email system — PRD 007-p1
 *
 * Sends time-delayed nudge emails to unactivated users:
 *   Day 1 (>24h)  — "One thing to do with UBTRIPPIN"
 *   Day 3 (>72h)  — "What your trip looks like in UBTRIPPIN"
 *   Day 7 (>168h) — "Need help getting started?"
 */

import { render } from '@react-email/components'
import { createSecretClient } from '@/lib/supabase/server'
import { getResendClient } from '@/lib/resend/client'
import { NudgeDay1Email } from '@/emails/NudgeDay1Email'
import { NudgeDay2Email } from '@/emails/NudgeDay2Email'
import { NudgeDay3Email } from '@/emails/NudgeDay3Email'

interface ProfileRow {
  id: string
  email: string | null
  full_name: string | null
  created_at: string
  activated_at: string | null
  nudge_1_sent_at: string | null
  nudge_2_sent_at: string | null
  nudge_3_sent_at: string | null
}

/** Hours since a given ISO timestamp. */
function hoursSince(isoString: string): number {
  return (Date.now() - new Date(isoString).getTime()) / (1000 * 60 * 60)
}

/**
 * Checks all unactivated users and sends whichever nudge emails are due.
 * Returns the number of emails sent.
 */
export async function checkAndSendNudges(): Promise<number> {
  const supabase = createSecretClient()
  const resend = getResendClient()

  const { data: profiles, error } = await supabase
    .from('profiles')
    .select(
      'id, email, full_name, created_at, activated_at, nudge_1_sent_at, nudge_2_sent_at, nudge_3_sent_at'
    )
    .is('activated_at', null)

  if (error) {
    console.error('[nudge-emails] Failed to fetch profiles:', error)
    throw error
  }

  const rows = (profiles ?? []) as ProfileRow[]
  let sent = 0

  for (const profile of rows) {
    if (!profile.email) continue

    const age = hoursSince(profile.created_at)
    const name = profile.full_name ?? 'there'

    // Nudge 1 — after 24h
    if (age > 24 && !profile.nudge_1_sent_at) {
      try {
        const html = await render(NudgeDay1Email({ userName: name }))
        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: 'One thing to do with UBTRIPPIN',
          html,
        })
        await supabase
          .from('profiles')
          .update({ nudge_1_sent_at: new Date().toISOString() })
          .eq('id', profile.id)
        sent++
        console.log(`[nudge-emails] Sent day-1 nudge to ${profile.email}`)
      } catch (err) {
        console.error(`[nudge-emails] Failed day-1 nudge for ${profile.id}:`, err)
      }
    }

    // Nudge 2 — after 72h
    if (age > 72 && !profile.nudge_2_sent_at) {
      try {
        const html = await render(NudgeDay2Email({ userName: name }))
        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: 'What your trip looks like in UBTRIPPIN',
          html,
        })
        await supabase
          .from('profiles')
          .update({ nudge_2_sent_at: new Date().toISOString() })
          .eq('id', profile.id)
        sent++
        console.log(`[nudge-emails] Sent day-3 nudge to ${profile.email}`)
      } catch (err) {
        console.error(`[nudge-emails] Failed day-3 nudge for ${profile.id}:`, err)
      }
    }

    // Nudge 3 — after 168h (7 days)
    if (age > 168 && !profile.nudge_3_sent_at) {
      try {
        const html = await render(NudgeDay3Email({ userName: name }))
        await resend.emails.send({
          from: 'UBTRIPPIN <hello@ubtrippin.xyz>',
          to: profile.email,
          subject: 'Need help getting started?',
          html,
        })
        await supabase
          .from('profiles')
          .update({ nudge_3_sent_at: new Date().toISOString() })
          .eq('id', profile.id)
        sent++
        console.log(`[nudge-emails] Sent day-7 nudge to ${profile.email}`)
      } catch (err) {
        console.error(`[nudge-emails] Failed day-7 nudge for ${profile.id}:`, err)
      }
    }
  }

  return sent
}
