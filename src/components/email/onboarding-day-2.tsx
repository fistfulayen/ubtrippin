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

interface OnboardingDay2EmailProps {
  userName: string
}

export function OnboardingDay2Email({ userName }: OnboardingDay2EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Here's what happens when you forward an email</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Here's what happens when you forward an email</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>Forward one booking email to <strong>trips@ubtrippin.xyz</strong> and UBTRIPPIN will:</Text>

          <Section style={listBox}>
            <Text style={listItem}>1. Extract flight, hotel, and reservation details</Text>
            <Text style={listItem}>2. Organize everything into a trip timeline</Text>
            <Text style={listItem}>3. Keep it ready for you and your AI agent</Text>
          </Section>

          <Text style={text}>No forms. No manual entry. Forward and you're done.</Text>

          <Hr style={hr} />

          <Section style={buttonContainer}>
            <Link href="https://www.ubtrippin.xyz/trips" style={button}>
              Open My Trips
            </Link>
          </Section>

          <Text style={footer}>
            <Link href="https://www.ubtrippin.xyz" style={footerLink}>ubtrippin.xyz</Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

const main = {
  backgroundColor: '#f6f6f6',
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Oxygen-Sans,Ubuntu,Cantarell,"Helvetica Neue",sans-serif',
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
  margin: '0 0 20px',
}

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
}

const listBox = {
  backgroundColor: '#eef2ff',
  borderRadius: '8px',
  border: '1px solid #c7d2fe',
  padding: '12px 16px',
  marginBottom: '16px',
}

const listItem = {
  color: '#1f2937',
  fontSize: '15px',
  lineHeight: '1.45',
  margin: '0 0 8px',
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
  margin: '24px 0 0',
}

const footerLink = {
  color: '#9ca3af',
  textDecoration: 'underline',
}

export default OnboardingDay2Email
