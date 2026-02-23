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

interface WelcomeEmailProps {
  userName: string
  userEmail: string
}

export function WelcomeEmail({ userName, userEmail }: WelcomeEmailProps) {
  const previewText = 'Welcome to UBTRIPPIN — your personal travel tracker'

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Welcome to UBTRIPPIN! 🧳</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            Welcome aboard! UBTRIPPIN is your personal travel tracker that reads
            your booking confirmation emails and turns them into beautiful,
            organized itineraries.
          </Text>

          <Hr style={hr} />

          <Heading as="h2" style={h2}>
            1. Add your first booking
          </Heading>

          <Text style={text}>
            Forward any booking confirmation email to:
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>trips@ubtrippin.xyz</Text>
          </Section>

          <Text style={text}>
            Make sure you send it from <strong>{userEmail}</strong> — the email
            registered to your account. Works with flights, hotels, trains,
            rental cars, and more.
          </Text>

          <Text style={smallText}>
            💡 You can add additional sender email addresses in your{' '}
            <Link href="https://ubtrippin.xyz/settings" style={link}>
              Settings
            </Link>
            .
          </Text>

          <Hr style={hr} />

          <Heading as="h2" style={h2}>
            2. Set up with your AI agent
          </Heading>

          <Text style={text}>
            If you use an AI assistant like OpenClaw or Claude, you can connect
            it to UBTRIPPIN:
          </Text>

          <Section style={codeBox}>
            <Text style={codeText}>npx clawhub install ubtrippin</Text>
          </Section>

          <Text style={text}>
            Then generate an API key at{' '}
            <Link href="https://ubtrippin.xyz/settings" style={link}>
              ubtrippin.xyz/settings
            </Link>{' '}
            and share it with your agent. Your agent can then list trips, get
            itineraries, and help manage your travel.
          </Text>

          <Hr style={hr} />

          <Section style={buttonContainer}>
            <Link href="https://ubtrippin.xyz/trips" style={button}>
              Go to My Trips
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            <Link href="https://ubtrippin.xyz" style={footerLink}>
              ubtrippin.xyz
            </Link>{' '}
            — Turn booking emails into beautiful itineraries
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
  color: '#1e1b4b',
  fontSize: '28px',
  fontWeight: '700',
  lineHeight: '1.3',
  margin: '0 0 24px',
}

const h2 = {
  color: '#1e1b4b',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 12px',
}

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
}

const smallText = {
  color: '#6b7280',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 16px',
}

const codeBox = {
  backgroundColor: '#fff7ed',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '16px',
}

const codeText = {
  color: '#92400e',
  fontSize: '16px',
  fontFamily: 'monospace',
  fontWeight: '600',
  margin: '0',
}

const link = {
  color: '#b45309',
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
  backgroundColor: '#b45309',
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
  margin: '0',
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}

export default WelcomeEmail
