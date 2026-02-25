/**
 * AgentCallout — shared section for nudge emails (PRD 007-p2)
 *
 * A prominent inline callout inviting users to connect an AI agent.
 * Links to /docs/agents which covers OpenClaw, MCP, REST API, and ChatGPT.
 */

import { Hr, Link, Section, Text } from '@react-email/components'

export function AgentCallout() {
  return (
    <>
      <Hr style={hr} />
      <Section style={calloutBox}>
        <Text style={calloutHeading}>🤖 Use an AI agent?</Text>
        <Text style={calloutText}>
          Connect UBTRIPPIN to your AI assistant in 2 minutes. Once connected,
          your agent can search trips, manage bookings, and answer questions like
          "What time does my flight leave?" — no app needed.
        </Text>
        <Text style={calloutList}>
          Works with:{' '}
          <strong>OpenClaw</strong> · <strong>Claude Desktop</strong> ·{' '}
          <strong>Cursor</strong> · <strong>ChatGPT</strong>
        </Text>
        <Section style={calloutButtonContainer}>
          <Link href="https://ubtrippin.xyz/docs/agents" style={calloutButton}>
            Connect in 2 minutes →
          </Link>
        </Section>
      </Section>
    </>
  )
}

const hr = {
  borderColor: '#e5e5e5',
  margin: '24px 0',
}

const calloutBox = {
  backgroundColor: '#f0fdf4',
  borderRadius: '8px',
  border: '1px solid #bbf7d0',
  padding: '16px 20px',
  marginBottom: '24px',
}

const calloutHeading = {
  color: '#166534',
  fontSize: '15px',
  fontWeight: '700',
  margin: '0 0 8px',
}

const calloutText = {
  color: '#15803d',
  fontSize: '14px',
  lineHeight: '1.5',
  margin: '0 0 8px',
}

const calloutList = {
  color: '#166534',
  fontSize: '13px',
  margin: '0 0 12px',
}

const calloutButtonContainer = {
  textAlign: 'left' as const,
}

const calloutButton = {
  backgroundColor: '#16a34a',
  borderRadius: '6px',
  color: '#ffffff',
  display: 'inline-block',
  fontSize: '13px',
  fontWeight: '600',
  padding: '8px 16px',
  textDecoration: 'none',
}
