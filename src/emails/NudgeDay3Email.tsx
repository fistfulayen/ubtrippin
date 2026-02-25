import {
  Body,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from '@react-email/components'

interface NudgeDay3EmailProps {
  userName?: string
}

export function NudgeDay3Email({ userName = 'there' }: NudgeDay3EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Need help getting started?</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Need help getting started?</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Getting your first trip into UBTRIPPIN is easier than it sounds.
            Here are a few ways to do it:
          </Text>

          <Text style={text}>
            <strong>Option 1 — Forward a booking email</strong>
            <br />
            Send any confirmation from airlines, hotels, or booking sites to{' '}
            <Link href="https://ubtrippin.xyz/trips" style={link}>
              trips@ubtrippin.xyz
            </Link>
            . Takes 30 seconds.
          </Text>

          <Text style={text}>
            <strong>Option 2 — Import a file</strong>
            <br />
            Have a PDF itinerary or calendar export? Upload it directly from{' '}
            your trips page and UBTRIPPIN will parse it for you.
          </Text>

          <Text style={text}>
            <strong>Option 3 — Create a trip manually</strong>
            <br />
            Add a trip by hand from the trips page — no email needed.
          </Text>

          <Hr style={hr} />

          <Section style={buttonContainer}>
            <Link href="https://ubtrippin.xyz/trips" style={button}>
              Go to My Trips
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            <Link href="https://ubtrippin.xyz/docs/agents" style={footerLink}>
              Use an AI agent?
            </Link>{' '}
            Connect it to UBTRIPPIN for hands-free itinerary management.
          </Text>

          <Text style={footer}>
            <Link href="https://ubtrippin.xyz" style={footerLink}>
              ubtrippin.xyz
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f6f6',
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
}

const container = {
  margin: '0 auto',
  padding: '20px 0 48px',
  width: '580px',
  maxWidth: '100%',
}

const h1 = {
  color: '#1e293b',
  fontSize: '24px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px',
}

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
}

const link = {
  color: '#4f46e5',
  textDecoration: 'underline',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#4f46e5',
  borderRadius: '8px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '16px',
  fontWeight: '600',
  padding: '12px 24px',
  textDecoration: 'none',
}

const footer = {
  color: '#9ca3af',
  fontSize: '12px',
  textAlign: 'center' as const,
  margin: '0 0 8px',
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}

export default NudgeDay3Email
