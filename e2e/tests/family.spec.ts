import { expect, test } from '@playwright/test'

import { apiGet } from '../helpers/api'
import { sessionCookieHeader } from '../helpers/session'

test.describe('Family', () => {
  test('GET /api/v1/families returns list', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const cookie = await sessionCookieHeader(page)
    const { status, body } = await apiGet('/api/v1/families', {
      auth: 'none',
      headers: { cookie },
    })

    expect(status).toBe(200)
    expect(body && typeof body === 'object').toBe(true)
    const payload = body as { data?: unknown }
    expect(Array.isArray(payload.data)).toBe(true)
  })

  test('/settings/family page loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/settings/family')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Family' })).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })
})
