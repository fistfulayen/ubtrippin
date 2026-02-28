import { test, expect } from '@playwright/test'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Feedback page', () => {
  test('/feedback loads without error', async ({ page }) => {
    requireSession()

    const response = await page.goto('/feedback')
    await expect(page).not.toHaveURL(/\/login/)

    const body = await page.content()
    expect(response?.status()).not.toBe(500)
    expect(body).not.toContain('Application error')
    await expect(page.getByRole('heading', { name: /feedback/i })).toBeVisible()
  })

  test('submit form is visible', async ({ page }) => {
    requireSession()

    await page.goto('/feedback')

    await page.getByRole('button', { name: /new idea/i }).click()

    await expect(page.getByText('Share feedback')).toBeVisible()
    await expect(page.locator('#feedback-title')).toBeVisible()
    await expect(page.locator('#feedback-type')).toBeVisible()
    await expect(page.locator('#feedback-body')).toBeVisible()
  })
})
