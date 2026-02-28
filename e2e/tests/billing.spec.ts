import { test, expect } from '@playwright/test'
import { requestJson } from '../helpers/request'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Billing page', () => {
  test('loads /settings/billing without error', async ({ page }) => {
    requireSession()

    const response = await page.goto('/settings/billing')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(response?.status()).not.toBe(500)
    expect(body).not.toContain('Application error')
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()
  })

  test('shows current plan (free or pro)', async ({ page }) => {
    requireSession()

    await page.goto('/settings/billing')
    await expect(page.getByText(/current plan: (free|pro)/i)).toBeVisible()
  })

  test('shows upgrade actions for free users', async ({ page, request }) => {
    requireSession()

    const subscription = await requestJson(request, 'GET', '/api/v1/billing/subscription')
    if (subscription.status !== 200 || !subscription.body || typeof subscription.body !== 'object') {
      test.skip()
      return
    }

    const tier = (subscription.body as { subscription_tier?: string }).subscription_tier
    test.skip(tier !== 'free', 'Only valid for free users')

    await page.goto('/settings/billing')
    await expect(page.getByRole('heading', { name: /upgrade to pro/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /go monthly|go annual|get early adopter/i })).toBeVisible()
  })

  test('GET /api/v1/billing/portal returns URL for pro users', async ({ request }) => {
    requireSession()

    const subscription = await requestJson(request, 'GET', '/api/v1/billing/subscription')
    if (subscription.status !== 200 || !subscription.body || typeof subscription.body !== 'object') {
      test.skip()
      return
    }

    const tier = (subscription.body as { subscription_tier?: string }).subscription_tier
    test.skip(tier !== 'pro', 'Billing portal URL assertion only for pro users')

    const portal = await requestJson(request, 'GET', '/api/v1/billing/portal')
    expect(portal.status).toBe(200)
    expect(portal.body).toBeTruthy()

    const url = (portal.body as { url?: string }).url
    expect(typeof url).toBe('string')
    expect(url).toMatch(/^https:\/\//)
  })
})
