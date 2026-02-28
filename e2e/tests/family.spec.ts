import { test, expect } from '@playwright/test'
import { requestJson } from '../helpers/request'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Family', () => {
  test('GET /api/v1/families returns list', async ({ request }) => {
    requireSession()

    const result = await requestJson(request, 'GET', '/api/v1/families')
    expect(result.status).toBe(200)

    const data = (result.body as { data?: unknown[] }).data
    expect(Array.isArray(data)).toBe(true)
  })

  test('/settings/family loads without error', async ({ page }) => {
    requireSession()

    const response = await page.goto('/settings/family')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(response?.status()).not.toBe(500)
    expect(body).not.toContain('Application error')
    await expect(page.getByRole('heading', { name: /family/i })).toBeVisible()
  })
})
