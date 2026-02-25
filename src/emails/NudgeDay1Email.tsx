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

interface NudgeDay1EmailProps {
  userName?: string
}

export function NudgeDay1Email({ userName = 'there' }: NudgeDay1EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>One thing to do with UBTRIPPIN</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>One thing to do with UBTRIPPIN</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            You signed up for UBTRIPPIN — here's the one thing that makes it
            useful:
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>trips@ubtrippin.xyz</Text>
          </Section>

          <Text style={text}>
            Forward any booking confirmation email to that address. Flight,
            hotel, train — whatever you have. UBTRIPPIN reads it and builds your
            itinerary automatically.
          </Text>

          <Text style={text}>That's it. Nothing else to set up.</Text>

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

const codeBox = {
  backgroundColor: '#f5f3ff',
  borderRadius: '8px',
  border: '2px solid #a5b4fc',
  padding: '12px 16px',
  marginBottom: '16px',
}

const codeText = {
  color: '#4338ca',
  fontSize: '18px',
  fontFamily: 'monospace',
  fontWeight: '700',
  margin: '0',
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

export default NudgeDay1Email
