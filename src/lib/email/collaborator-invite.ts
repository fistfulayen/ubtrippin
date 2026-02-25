import { render } from '@react-email/components'
import { getResendClient } from '@/lib/resend/client'
import {
  CollaboratorInviteEmail,
  InviteAcceptedEmail,
} from '@/components/email/collaborator-invite'

const FROM = 'UBTRIPPIN <hello@ubtrippin.xyz>'

interface InviteEmailParams {
  to: string
  inviterName: string
  tripLabel: string
  inviteUrl: string
}

export async function sendCollaboratorInviteEmail({
  to,
  inviterName,
  tripLabel,
  inviteUrl,
}: InviteEmailParams): Promise<void> {
  const html = await render(
    CollaboratorInviteEmail({ inviterName, tripLabel, inviteUrl })
  )
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${inviterName} invited you to their ${tripLabel} trip on UBTRIPPIN`,
    html,
  })
}

interface AcceptedEmailParams {
  to: string
  accepterName: string
  tripLabel: string
  tripUrl: string
}

export async function sendInviteAcceptedEmail({
  to,
  accepterName,
  tripLabel,
  tripUrl,
}: AcceptedEmailParams): Promise<void> {
  const html = await render(
    InviteAcceptedEmail({ accepterName, tripLabel, tripUrl })
  )
  const resend = getResendClient()
  await resend.emails.send({
    from: FROM,
    to,
    subject: `${accepterName} joined your ${tripLabel} trip`,
    html,
  })
}
