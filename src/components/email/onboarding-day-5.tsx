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

interface OnboardingDay5EmailProps {
  userName: string
  demoTripUrl: string
}

export function OnboardingDay5Email({ userName, demoTripUrl }: OnboardingDay5EmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Still haven't tried it? Check out your sample trip</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Still haven't tried it? Check out your sample trip</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We created a sample trip in your account so you can see exactly how UBTRIPPIN organizes travel.
          </Text>

          <Section style={buttonContainer}>
            <Link href={demoTripUrl} style={button}>
              View My Sample Trip
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={text}>
            Ready for real data? Forward a booking confirmation to <strong>trips@ubtrippin.xyz</strong> and we&apos;ll build your trip automatically.
          </Text>

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

const hr = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
  margin: '24px 0',
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

export default OnboardingDay5Email
