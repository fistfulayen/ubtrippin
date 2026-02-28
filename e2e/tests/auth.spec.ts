import { test, expect } from '@playwright/test'

// Auth tests use a CLEAN browser context — no saved auth state
test.use({ storageState: { cookies: [], origins: [] } })

test.describe('Authentication', () => {
  test('login page loads and shows sign-in options', async ({ page }) => {
    const response = await page.goto('/login')
    expect(response?.status()).toBe(200)
    
    const body = await page.textContent('body')
    expect(body).toBeTruthy()
    // Should show some form of sign-in UI
    expect(body!.toLowerCase()).toMatch(/sign in|log in|google|email|continue/i)
  })

  test('unauthenticated user is redirected from /trips', async ({ page }) => {
    const response = await page.goto('/trips')
    // Should redirect to login or show login UI
    const url = page.url()
    expect(url).toMatch(/login|auth/)
  })

  test('callback route exists', async ({ page }) => {
    const response = await page.goto('/auth/callback')
    // Should not 500
    expect(response?.status()).not.toBe(500)
  })
})
