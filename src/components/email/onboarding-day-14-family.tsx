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

interface OnboardingDay14FamilyEmailProps {
  userName: string
}

export function OnboardingDay14FamilyEmail({ userName }: OnboardingDay14FamilyEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Did you know about family sharing?</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Did you know about family sharing?</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            You can share trips, loyalty programs, and guides with people you travel with using Family Sharing on Pro.
          </Text>

          <Section style={card}>
            <Text style={cardTitle}>With Family Sharing, you can:</Text>
            <Text style={cardItem}>• Keep one shared itinerary for the whole group</Text>
            <Text style={cardItem}>• Access loyalty numbers and traveler preferences together</Text>
            <Text style={cardItem}>• Let your AI agent plan with the full family context</Text>
          </Section>

          <Hr style={hr} />

          <Section style={buttonContainer}>
            <Link href="https://www.ubtrippin.xyz/settings/billing" style={button}>
              Explore Pro
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

const card = {
  backgroundColor: '#ecfeff',
  borderRadius: '8px',
  border: '1px solid #bae6fd',
  padding: '12px 16px',
}

const cardTitle = {
  color: '#0f172a',
  fontSize: '15px',
  fontWeight: '600',
  margin: '0 0 8px',
}

const cardItem = {
  color: '#334155',
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

export default OnboardingDay14FamilyEmail
