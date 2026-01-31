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

interface TripItem {
  kind: string
  provider: string
  startLocation: string | null
  endLocation: string | null
  startTs: string | null
  confirmationCode: string | null
}

interface TripConfirmationEmailProps {
  userName: string
  tripTitle: string
  tripStartDate: string | null
  tripEndDate: string | null
  items: TripItem[]
  tripUrl: string
}

const kindEmojis: Record<string, string> = {
  flight: 'Flight',
  hotel: 'Hotel',
  train: 'Train',
  car: 'Car Rental',
  restaurant: 'Restaurant',
  activity: 'Activity',
  other: 'Other',
}

export function TripConfirmationEmail({
  userName,
  tripTitle,
  tripStartDate,
  tripEndDate,
  items,
  tripUrl,
}: TripConfirmationEmailProps) {
  const dateRange =
    tripStartDate && tripEndDate
      ? `${formatDate(tripStartDate)} - ${formatDate(tripEndDate)}`
      : tripStartDate
      ? formatDate(tripStartDate)
      : 'Dates TBD'

  const previewText = `${items.length} new item${items.length !== 1 ? 's' : ''} added to ${tripTitle}`

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={main}>
        <Container style={container}>
          <Heading style={h1}>Trip Updated</Heading>

          <Text style={text}>Hi {userName},</Text>

          <Text style={text}>
            We&apos;ve added {items.length} new item{items.length !== 1 ? 's' : ''} to your trip:
          </Text>

          <Section style={tripCard}>
            <Heading as="h2" style={h2}>
              {tripTitle}
            </Heading>
            <Text style={dateText}>{dateRange}</Text>
          </Section>

          <Heading as="h3" style={h3}>
            New Items:
          </Heading>

          {items.map((item, index) => (
            <Section key={index} style={itemCard}>
              <Text style={itemKind}>{kindEmojis[item.kind] || 'Other'}</Text>
              <Text style={itemProvider}>{item.provider}</Text>
              {item.startLocation && (
                <Text style={itemDetail}>
                  {item.startLocation}
                  {item.endLocation && item.endLocation !== item.startLocation && (
                    <> → {item.endLocation}</>
                  )}
                </Text>
              )}
              {item.startTs && (
                <Text style={itemDetail}>{formatDateTime(item.startTs)}</Text>
              )}
              {item.confirmationCode && (
                <Text style={itemConfirmation}>
                  Confirmation: {item.confirmationCode}
                </Text>
              )}
            </Section>
          ))}

          <Hr style={hr} />

          <Section style={buttonContainer}>
            <Link href={tripUrl} style={button}>
              View Full Itinerary
            </Link>
          </Section>

          <Hr style={hr} />

          <Text style={footer}>
            UBTRIPPIN.XYZ - Turn booking emails into beautiful itineraries
          </Text>
        </Container>
      </Body>
    </Html>
  )
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(dateStr: string): string {
  const date = new Date(dateStr)
  return date.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}

// Styles
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
  color: '#1a1a1a',
  fontSize: '24px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 20px',
}

const h2 = {
  color: '#1a1a1a',
  fontSize: '20px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '0 0 8px',
}

const h3 = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  lineHeight: '1.3',
  margin: '24px 0 12px',
}

const text = {
  color: '#4a4a4a',
  fontSize: '16px',
  lineHeight: '1.5',
  margin: '0 0 16px',
}

const tripCard = {
  backgroundColor: '#fff7ed',
  borderRadius: '8px',
  padding: '16px',
  marginBottom: '8px',
}

const dateText = {
  color: '#92400e',
  fontSize: '14px',
  margin: '0',
}

const itemCard = {
  backgroundColor: '#ffffff',
  borderRadius: '8px',
  border: '1px solid #e5e5e5',
  padding: '12px 16px',
  marginBottom: '8px',
}

const itemKind = {
  color: '#6b7280',
  fontSize: '12px',
  fontWeight: '500',
  textTransform: 'uppercase' as const,
  letterSpacing: '0.5px',
  margin: '0 0 4px',
}

const itemProvider = {
  color: '#1a1a1a',
  fontSize: '16px',
  fontWeight: '600',
  margin: '0 0 4px',
}

const itemDetail = {
  color: '#4a4a4a',
  fontSize: '14px',
  margin: '0 0 2px',
}

const itemConfirmation = {
  color: '#92400e',
  fontSize: '14px',
  fontWeight: '500',
  margin: '4px 0 0',
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
}

const buttonContainer = {
  textAlign: 'center' as const,
}

const button = {
  backgroundColor: '#d97706',
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

export default TripConfirmationEmail
