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
    expect(response?.status()).not.toBe(500)
    await expect(page.getByRole('heading', { name: /billing/i })).toBeVisible()
  })

  test('shows plan info', async ({ page }) => {
    requireSession()
    await page.goto('/settings/billing')
    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toMatch(/plan|subscription|billing/i)
  })

  test('GET /api/v1/billing/subscription returns status', async ({ request }) => {
    requireSession()
    const result = await requestJson(request, 'GET', '/api/v1/billing/subscription')
    expect(result.status).toBe(200)
    expect(result.body).toBeTruthy()
  })

  test('GET /api/v1/billing/portal requires stripe customer', async ({ request }) => {
    requireSession()
    const portal = await requestJson(request, 'GET', '/api/v1/billing/portal')
    // 200 if user has stripe_customer_id, 400 otherwise — both are valid
    expect([200, 400]).toContain(portal.status)
  })
})
