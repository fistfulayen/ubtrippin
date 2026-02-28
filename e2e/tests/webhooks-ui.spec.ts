import { expect, test } from '@playwright/test'

test.describe('Webhooks settings UI', () => {
  test('/settings/webhooks loads without error', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/settings/webhooks')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Webhooks' })).toBeVisible()
    await expect(page.getByText('Registered webhooks')).toBeVisible()

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('add webhook entrypoint is visible', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    await page.goto('/settings/webhooks')
    await expect(page.getByRole('button', { name: 'Add Webhook' })).toBeVisible()
  })
})
