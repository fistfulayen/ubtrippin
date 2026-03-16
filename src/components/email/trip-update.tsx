import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

export interface TripUpdateEmailChange {
  kind: string
  summary: string
}

interface TripUpdateEmailProps {
  tripTitle: string
  actorName: string
  changes: TripUpdateEmailChange[]
  tripUrl: string
  unsubscribeUrl: string
}

export function TripUpdateEmail({
  tripTitle,
  actorName,
  changes,
  tripUrl,
  unsubscribeUrl,
}: TripUpdateEmailProps) {
  const previewText = `${actorName} updated ${tripTitle} on UBTRIPPIN`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Trip updated</Heading>

          <Text style={text}>
            <strong>{actorName}</strong> made changes to <strong>{tripTitle}</strong>.
          </Text>

          <Section style={listSection}>
            {changes.map((change, index) => (
              <Text key={`${change.kind}-${index}`} style={listItem}>
                • {change.summary}
              </Text>
            ))}
          </Section>

          <Button href={tripUrl} style={button}>
            View trip {'->'}
          </Button>

          <Text style={smallText}>
            Manage trip update emails in{' '}
            <Link href={unsubscribeUrl} style={link}>
              Settings
            </Link>
            .
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

const listSection = {
  marginBottom: '20px',
}

const listItem = {
  color: '#334155',
  fontSize: '15px',
  lineHeight: '24px',
  margin: '0 0 8px',
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
