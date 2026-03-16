import { render } from '@react-email/components'
import { TripUpdateEmail, type TripUpdateEmailChange } from '@/components/email/trip-update'
import { getResendClient } from '@/lib/resend/client'

const FROM = 'UBTRIPPIN <hello@ubtrippin.xyz>'

interface SendTripUpdateEmailParams {
  to: string
  tripTitle: string
  actorName: string
  changes: TripUpdateEmailChange[]
  tripUrl: string
  unsubscribeUrl: string
}

export async function sendTripUpdateEmail({
  to,
  tripTitle,
  actorName,
  changes,
  tripUrl,
  unsubscribeUrl,
}: SendTripUpdateEmailParams): Promise<void> {
  const html = await render(
    TripUpdateEmail({
      tripTitle,
      actorName,
      changes,
      tripUrl,
      unsubscribeUrl,
    })
  )

  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `Trip Updated: ${tripTitle}`,
    html,
    headers: {
      'List-Unsubscribe': `<${unsubscribeUrl}>`,
      'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
    },
  })
}
