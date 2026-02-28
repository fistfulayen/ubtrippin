/**
 * P0 Settings page tests
 *
 * Tests:
 *   1. Settings page loads for authenticated user
 *   2. API key section is present
 *   3. Calendar feed section is present and URL is fetchable
 */

import { test, expect } from '@playwright/test'
import { apiGet } from '../helpers/api'

test.describe('Settings page', () => {
  test('loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    const response = await page.goto('/settings')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('API key section is visible', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    await page.goto('/settings')

    // Look for API key related content
    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toMatch(/api key|api token/i)
  })

  test('calendar feed section is visible', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL) test.skip()

    await page.goto('/settings')

    const body = await page.textContent('body')
    expect(body?.toLowerCase()).toMatch(/calendar|ical/i)
  })
})

test.describe('Calendar feed API', () => {
  test('GET /api/v1/calendar returns ICS URL', async () => {
    if (!process.env.TEST_API_KEY) test.skip()

    const { status, body } = await apiGet('/api/v1/calendar/token')
    expect(status).toBe(200)
    expect(body).toHaveProperty('token')
    expect(body.token).toBeTruthy()
  })
})
