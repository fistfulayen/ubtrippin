import { test, expect } from '@playwright/test'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Help center', () => {
  test('/help loads core sections', async ({ page }) => {
    requireSession()

    const response = await page.goto('/help')
    await expect(page).not.toHaveURL(/\/login/)

    expect(response?.status()).not.toBe(500)
    await expect(page.getByRole('heading', { name: /help center/i })).toBeVisible()
    await expect(page.locator('#getting-started')).toBeVisible()
    await expect(page.locator('#calendar')).toBeVisible()
    await expect(page.locator('#faq')).toBeVisible()
  })

  test('search filters help content', async ({ page }) => {
    requireSession()

    await page.goto('/help')

    await page.getByLabel('Search help articles').fill('calendar')

    await expect(page.getByText('1 section found')).toBeVisible()
    await expect(page.locator('#calendar')).toBeVisible()
    await expect(page.locator('#getting-started')).toBeHidden()
  })

  test('deep link /help#calendar resolves to calendar section', async ({ page }) => {
    requireSession()

    await page.goto('/help#calendar')
    await expect(page).toHaveURL(/\/help#calendar$/)

    const section = page.locator('#calendar')
    await expect(section).toBeVisible()

    const open = await section.evaluate((el) => (el as HTMLDetailsElement).open)
    expect(open).toBe(true)
  })
})
