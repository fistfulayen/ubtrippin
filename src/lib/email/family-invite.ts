import { render } from '@react-email/components'
import { getResendClient } from '@/lib/resend/client'
import { FamilyInviteEmail } from '@/components/email/family-invite'

const FROM = 'UBTRIPPIN <hello@ubtrippin.xyz>'

interface FamilyInviteParams {
  to: string
  inviterName: string
  familyName: string
  inviteUrl: string
}

export async function sendFamilyInviteEmail({
  to,
  inviterName,
  familyName,
  inviteUrl,
}: FamilyInviteParams): Promise<void> {
  const html = await render(
    FamilyInviteEmail({ inviterName, familyName, inviteUrl })
  )

  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to join ${familyName} on UBTRIPPIN`,
    html,
  })
}
