import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Hr,
} from '@react-email/components'

interface InviteJoinedEmailProps {
  inviterName: string
  inviteeName: string
}

export function InviteJoinedEmail({ inviterName, inviteeName }: InviteJoinedEmailProps) {
  const previewText = `${inviteeName} just joined UB Trippin using your invite`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Good news, {inviterName}</Heading>

          <Text style={text}>
            <strong>{inviteeName}</strong> just joined UB Trippin using your invite.
          </Text>

          <Text style={text}>
            They&apos;re all set to start organizing their travel. Thanks for spreading the word.
          </Text>

          <Hr style={hr} />

          <Text style={smallText}>
            —{' '}
            <Link href="https://www.ubtrippin.xyz" style={link}>
              UB Trippin
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f8fafc',
  fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
}

const container = {
  backgroundColor: '#ffffff',
  margin: '0 auto',
  padding: '32px 40px',
  maxWidth: '560px',
  borderRadius: '8px',
  marginTop: '32px',
}

const h1 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: '700',
  marginBottom: '24px',
}

const text = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '24px',
  marginBottom: '16px',
}

const hr = {
  borderColor: '#e2e8f0',
  margin: '24px 0',
}

const smallText = {
  color: '#64748b',
  fontSize: '13px',
  lineHeight: '20px',
  marginBottom: '8px',
}

const link = {
  color: '#4338ca',
  textDecoration: 'underline',
}
