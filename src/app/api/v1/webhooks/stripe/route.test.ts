import { NextRequest } from 'next/server'
import Stripe from 'stripe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const fixture = vi.hoisted(() => ({ from: vi.fn(), patches: [] as Record<string, unknown>[] }))
vi.mock('@/lib/stripe', async () => {
  const { default: StripeClient } = await import('stripe')
  return { stripe: new StripeClient('sk_test_dummy_offline') }
})
vi.mock('@/lib/supabase/service', () => ({ createSecretClient: () => ({ from: fixture.from }) }))
vi.mock('@/lib/referrals', () => ({ markReferralConverted: vi.fn() }))
import { POST } from './route'

describe('signed Stripe customer identity updates', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    fixture.patches.length = 0
    vi.stubEnv('STRIPE_WEBHOOK_SECRET', 'whsec_offline_dummy')
  })

  function request(email: string, validSignature = true) {
    const payload = JSON.stringify({ id: 'evt_dummy', type: 'customer.updated',
      data: { object: { id: 'cus_dummy', object: 'customer', email } } })
    const signature = Stripe.webhooks.generateTestHeaderString({ payload,
      secret: validSignature ? 'whsec_offline_dummy' : 'whsec_wrong' })
    return new NextRequest('https://example.test/api/v1/webhooks/stripe', {
      method: 'POST', body: payload, headers: { 'stripe-signature': signature },
    })
  }

  function database(profile: Record<string, unknown> | null) {
    const predicates: unknown[][] = []
    fixture.from.mockImplementation(() => {
      const builder: Record<string, unknown> = {
        select: () => builder,
        eq: (...args: unknown[]) => { predicates.push(args); return builder },
        maybeSingle: async () => ({ data: profile, error: null }),
        update: (patch: Record<string, unknown>) => { fixture.patches.push(patch); return builder },
        then: (resolve: (v: unknown) => unknown) => Promise.resolve({ error: null }).then(resolve),
      }
      return builder
    })
    return predicates
  }

  it('stores edited contact email separately and preserves the authentication profile email', async () => {
    const profile = { id: 'user_dummy', email: 'ordinary@example.test', billing_email: null,
      stripe_customer_id: 'cus_dummy' }
    const predicates = database(profile)
    expect((await POST(request(' ADMIN@example.test '))).status).toBe(200)
    expect(fixture.patches).toEqual([{ billing_email: 'admin@example.test' }])
    expect(profile.email).toBe('ordinary@example.test')
    expect(predicates).toContainEqual(['stripe_customer_id', 'cus_dummy'])
  })

  it('does not reassign an unknown customer by their newly edited email', async () => {
    database(null)
    expect((await POST(request('admin@example.test'))).status).toBe(200)
    expect(fixture.from).toHaveBeenCalledTimes(1)
    expect(fixture.patches).toEqual([])
  })

  it('rejects an invalid provider signature before touching profiles', async () => {
    database(null)
    expect((await POST(request('admin@example.test', false))).status).toBe(400)
    expect(fixture.from).not.toHaveBeenCalled()
  })
})
