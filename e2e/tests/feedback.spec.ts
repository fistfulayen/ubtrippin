import { expect, test } from '@playwright/test'

test.describe('Feedback', () => {
  test('/feedback page loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/feedback')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Feedback' })).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('submit form is visible', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    await page.goto('/feedback')
    await page.getByRole('button', { name: 'New Idea' }).click()

    await expect(page.getByRole('heading', { name: 'Share feedback' })).toBeVisible()
    await expect(page.locator('#feedback-title')).toBeVisible()
    await expect(page.locator('#feedback-type')).toBeVisible()
    await expect(page.locator('#feedback-body')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Submit' })).toBeVisible()
  })
})
