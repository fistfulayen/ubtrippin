import { render } from '@react-email/components'
import { getResendClient } from '@/lib/resend/client'
import { InviteJoinedEmail } from '@/components/email/invite-joined'

const FROM = process.env.EMAIL_FROM || 'UBTRIPPIN <hello@ubtrippin.xyz>'

interface InviteJoinedParams {
  to: string
  inviterName: string
  inviteeName: string
}

export async function sendInviteJoinedEmail({
  to,
  inviterName,
  inviteeName,
}: InviteJoinedParams): Promise<void> {
  const html = await render(InviteJoinedEmail({ inviterName, inviteeName }))
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviteeName} just joined UB Trippin using your invite`,
    html,
  })
}
