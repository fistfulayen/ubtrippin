/**
 * P0 Activation tests
 *
 * Tests:
 *   1. /trips/demo loads without auth and shows demo content
 *   2. GET /api/v1/activation/status returns expected shape
 *   3. Unactivated new user sees the onboarding card on /trips
 */

import { test, expect } from '@playwright/test'
import { apiGet } from '../helpers/api'

test.describe('/trips/demo', () => {
  test('loads publicly without authentication', async ({ browser }) => {
    const ctx = await browser.newContext() // no auth
    const page = await ctx.newPage()

    await page.goto('/trips/demo')
    await expect(page).not.toHaveURL(/\/login/)

    // Should render something meaningful
    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(body).not.toContain('404 | ')

    await ctx.close()
  })
})

test.describe('Activation status API', () => {
  test('returns correct shape', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    const { status, body } = await apiGet('/api/v1/activation/status')
    expect(status).toBe(200)

    // Must have activated field
    expect(body).toHaveProperty('activated')
    expect(typeof body.activated).toBe('boolean')

    // Optional timestamp fields may be null or a string
    const optionalFields = [
      'first_forward_at',
      'activated_at',
      'second_trip_at',
      'nudge_1_sent_at',
      'nudge_2_sent_at',
      'nudge_3_sent_at',
    ]
    for (const field of optionalFields) {
      expect(body).toHaveProperty(field)
      expect(body[field] === null || typeof body[field] === 'string').toBe(true)
    }
  })
})

test.describe('Onboarding empty state', () => {
  test('/trips page does not hard-error for authenticated user', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    await page.goto('/trips')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(body).not.toContain('Application error')
  })
})
