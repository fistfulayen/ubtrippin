import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Text,
  Button,
  Hr,
  Section,
} from '@react-email/components'

interface CollaboratorInviteEmailProps {
  inviterName: string
  tripLabel: string
  inviteUrl: string
}

export function CollaboratorInviteEmail({
  inviterName,
  tripLabel,
  inviteUrl,
}: CollaboratorInviteEmailProps) {
  const previewText = `${inviterName} invited you to their ${tripLabel} trip on UBTRIPPIN`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>You&apos;re invited! ✈️</Heading>

          <Text style={text}>Hey,</Text>

          <Text style={text}>
            <strong>{inviterName}</strong> invited you to their{' '}
            <strong>{tripLabel}</strong> trip on UBTRIPPIN — you can see the
            full itinerary, add places, and keep everything in one spot.
          </Text>

          <Section style={buttonContainer}>
            <Button href={inviteUrl} style={button}>
              View the {tripLabel} trip →
            </Button>
          </Section>

          <Hr style={hr} />

          <Text style={smallText}>
            If you don&apos;t have an account yet, you can create one when you
            click the link — the trip will be waiting for you.
          </Text>

          <Text style={smallText}>
            If you didn&apos;t expect this invite, you can safely ignore this
            email.
          </Text>

          <Text style={smallText}>
            —{' '}
            <Link href="https://ubtrippin.com" style={link}>
              UBTRIPPIN
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

interface InviteAcceptedEmailProps {
  accepterName: string
  tripLabel: string
  tripUrl: string
}

export function InviteAcceptedEmail({
  accepterName,
  tripLabel,
  tripUrl,
}: InviteAcceptedEmailProps) {
  const previewText = `${accepterName} joined your ${tripLabel} trip`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>New collaborator 🎉</Heading>

          <Text style={text}>
            <strong>{accepterName}</strong> accepted your invite and joined your{' '}
            <strong>{tripLabel}</strong> trip.
          </Text>

          <Section style={buttonContainer}>
            <Button href={tripUrl} style={button}>
              View the trip →
            </Button>
          </Section>

          <Text style={smallText}>
            —{' '}
            <Link href="https://ubtrippin.com" style={link}>
              UBTRIPPIN
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

// Styles
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

const buttonContainer = {
  margin: '24px 0',
}

const button = {
  backgroundColor: '#4338ca',
  borderRadius: '6px',
  color: '#ffffff',
  fontSize: '15px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
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
