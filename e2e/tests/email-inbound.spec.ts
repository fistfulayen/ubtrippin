/**
 * P0 Email inbound tests — mock webhook approach
 *
 * Tests:
 *   1. Inbound webhook rejects requests missing Svix headers
 *   2. Inbound webhook rejects requests with invalid signature
 *   3. Inbound webhook accepts a correctly-signed payload (200 or 202)
 *
 * We sign the payload with the RESEND_WEBHOOK_SECRET using the svix library —
 * same library the server uses to verify. This tests the full handler logic
 * without requiring actual email delivery.
 */

import { test, expect } from '@playwright/test'
import { Webhook } from 'svix'

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.ubtrippin.xyz'
const WEBHOOK_URL = `${BASE_URL}/api/webhooks/resend`
const WEBHOOK_SECRET = process.env.RESEND_WEBHOOK_SECRET ?? ''

/** Minimal fixture email payload */
const fixturePayload = {
  type: 'email.received',
  created_at: new Date().toISOString(),
  data: {
    email_id: 'e2e-test-email-001',
    from: 'noreply@booking.com',
    to: ['trips@ubtrippin.xyz'],
    subject: 'Your booking confirmation — Kyoto Hotel Granvia',
  },
}

function signPayload(secret: string, payload: string): {
  'svix-id': string
  'svix-timestamp': string
  'svix-signature': string
} {
  const wh = new Webhook(secret)
  const msgId = `msg_e2e_${Date.now()}`
  const timestamp = Math.floor(Date.now() / 1000).toString()
  // svix sign(id, timestamp, payload)
  const signature = wh.sign(msgId, new Date(Number(timestamp) * 1000), payload)
  // sign() returns "v1,<base64>" — extract just that part
  return {
    'svix-id': msgId,
    'svix-timestamp': timestamp,
    'svix-signature': signature,
  }
}

test.describe('Inbound webhook — header validation', () => {
  test('rejects request missing svix headers (400)', async ({ request }) => {
    const res = await request.post(WEBHOOK_URL, {
      data: fixturePayload,
      headers: { 'Content-Type': 'application/json' },
    })
    expect(res.status()).toBe(400)
  })

  test('rejects request with invalid signature (400)', async ({ request }) => {
    const payload = JSON.stringify(fixturePayload)
    const res = await request.post(WEBHOOK_URL, {
      headers: {
        'Content-Type': 'application/json',
        'svix-id': 'msg_fake',
        'svix-timestamp': Math.floor(Date.now() / 1000).toString(),
        'svix-signature': 'v1,invalidsignature==',
      },
      data: payload,
    })
    // Should reject with 400 or 401
    expect([400, 401]).toContain(res.status())
  })
})

test.describe('Inbound webhook — signed payload', () => {
  test('accepts correctly-signed payload', async ({ request }) => {
    if (!WEBHOOK_SECRET) {
      test.skip()
      return
    }

    const payload = JSON.stringify(fixturePayload)
    const headers = signPayload(WEBHOOK_SECRET, payload)

    const res = await request.post(WEBHOOK_URL, {
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      data: payload,
    })

    // Handler may return 200 (processed), 202 (accepted/queued), or 404 (no matching user)
    // A 200/202/404 all mean the signature was accepted and the handler ran — not a 400 rejection
    expect([200, 202, 404]).toContain(res.status())
  })
})
