/**
 * P0 Auth tests
 *
 * Tests:
 *   1. Login page renders correctly (unauthenticated)
 *   2. Authenticated user is redirected to /trips (not back to login)
 */

import { test, expect } from '@playwright/test'

test.describe('Login page', () => {
  test('renders without auth', async ({ browser }) => {
    // Create a fresh context with NO stored auth state
    const ctx = await browser.newContext()
    const page = await ctx.newPage()

    await page.goto('/login')

    // Page title
    await expect(page).toHaveTitle(/UBTRIPPIN/i)

    // Logo is visible
    await expect(page.getByAltText('UBTRIPPIN')).toBeVisible()

    // Google sign-in link is present
    await expect(page.getByRole('link', { name: /google/i })).toBeVisible()

    await ctx.close()
  })
})

test.describe('Authenticated access', () => {
  test('authenticated user lands on /trips (not redirected to login)', async ({ page }) => {
    // storageState from global-setup provides auth — skip if no credentials configured
    if (!process.env.TEST_USER_EMAIL) {
      test.skip()
    }

    await page.goto('/trips')

    // Should NOT be redirected to login
    await expect(page).not.toHaveURL(/\/login/)

    // Page content — trips page heading or empty state
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    // At minimum the nav should be present
    await expect(page.locator('nav, header')).toBeVisible()
  })
})
