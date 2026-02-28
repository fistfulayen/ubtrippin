import { test, expect } from '@playwright/test'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Feedback page', () => {
  test('/feedback loads without error', async ({ page }) => {
    requireSession()
    const response = await page.goto('/feedback')
    await expect(page).not.toHaveURL(/\/login/)
    expect(response?.status()).not.toBe(500)
    await expect(page.getByRole('heading', { name: 'Feedback', exact: true })).toBeVisible()
  })

  test('submit form is visible', async ({ page }) => {
    requireSession()
    await page.goto('/feedback')
    await page.getByRole('button', { name: /new idea/i }).click()
    await expect(page.getByText('Share feedback')).toBeVisible()
  })
})
