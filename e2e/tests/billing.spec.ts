import { expect, test } from '@playwright/test'

import { apiGet } from '../helpers/api'
import { sessionCookieHeader } from '../helpers/session'

type BillingTier = 'free' | 'pro' | 'grace' | 'paused'

function readTier(body: unknown): BillingTier | null {
  if (!body || typeof body !== 'object') return null
  const value = (body as Record<string, unknown>).subscription_tier
  if (value === 'free' || value === 'pro' || value === 'grace' || value === 'paused') {
    return value
  }
  return null
}

test.describe('Billing', () => {
  test('settings billing page loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/settings/billing')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Billing' })).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('shows current plan and free users see upgrade CTA', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const cookie = await sessionCookieHeader(page)
    const { status, body } = await apiGet('/api/v1/billing/subscription', {
      auth: 'none',
      headers: { cookie },
    })
    expect(status).toBe(200)

    const tier = readTier(body)
    expect(tier).toBeTruthy()

    await page.goto('/settings/billing')

    if (tier === 'free') {
      await expect(page.getByText(/Current Plan:\s*Free/i)).toBeVisible()
      await expect(page.getByText(/Upgrade to Pro/i)).toBeVisible()
    } else if (tier === 'pro') {
      await expect(page.getByText(/Current Plan:\s*Pro/i)).toBeVisible()
    } else if (tier === 'grace') {
      await expect(page.getByText(/Payment Failed/i)).toBeVisible()
    } else {
      await expect(page.getByText(/subscription is paused/i)).toBeVisible()
    }
  })

  test('GET /api/v1/billing/portal returns valid URL (pro users)', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const cookie = await sessionCookieHeader(page)

    const subscription = await apiGet('/api/v1/billing/subscription', {
      auth: 'none',
      headers: { cookie },
    })
    expect(subscription.status).toBe(200)

    const tier = readTier(subscription.body)
    if (tier !== 'pro') {
      test.skip()
      return
    }

    const { status, body } = await apiGet('/api/v1/billing/portal', {
      auth: 'none',
      headers: { cookie },
    })

    expect(status).toBe(200)
    const url = body && typeof body === 'object' ? (body as Record<string, unknown>).url : null
    expect(typeof url).toBe('string')
    expect((url as string).startsWith('https://')).toBe(true)
  })
})
