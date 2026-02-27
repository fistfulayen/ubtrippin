import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
} from '@react-email/components'

interface FamilyInviteEmailProps {
  inviterName: string
  familyName: string
  inviteUrl: string
}

export function FamilyInviteEmail({
  inviterName,
  familyName,
  inviteUrl,
}: FamilyInviteEmailProps) {
  const previewText = `${inviterName} invited you to join ${familyName} on UBTRIPPIN`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You&apos;re invited</Heading>

          <Text style={text}>Hey,</Text>

          <Text style={text}>
            <strong>{inviterName}</strong> invited you to join{' '}
            <strong>{familyName}</strong> on UBTRIPPIN. Sharing is caring.
          </Text>

          <Text style={text}>
            Once you&apos;re in, you&apos;ll see each other&apos;s trips, loyalty
            numbers, city guides, and travel preferences, everything the family
            needs to travel better together.
          </Text>

          <Button href={inviteUrl} style={button}>
            Join {familyName} {'->'}
          </Button>

          <Text style={smallText}>
            If you don&apos;t have an account yet, you can create one when you click the link.
          </Text>

          <Text style={smallText}>
            - <Link href="https://ubtrippin.xyz" style={link}>UBTRIPPIN</Link>
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
  margin: '32px auto',
  padding: '32px 40px',
  maxWidth: '560px',
  borderRadius: '8px',
}

const h1 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: '700',
  marginBottom: '20px',
}

const text = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '24px',
  marginBottom: '16px',
}

const button = {
  backgroundColor: '#4338ca',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
  marginTop: '8px',
  marginBottom: '20px',
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
