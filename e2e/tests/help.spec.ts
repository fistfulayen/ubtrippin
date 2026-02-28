import { expect, test } from '@playwright/test'

const HELP_SECTIONS = [
  'getting-started',
  'managing-trips',
  'sharing-collaboration',
  'calendar',
  'loyalty',
  'city-guides',
  'family-sharing',
  'developers-agents',
  'billing-pro',
  'faq',
]

test.describe('Help Center', () => {
  test('page loads with all sections', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    const response = await page.goto('/help')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading', { name: 'Help Center' })).toBeVisible()

    for (const sectionId of HELP_SECTIONS) {
      await expect(page.locator(`#${sectionId}`)).toBeVisible()
    }

    const body = await page.content()
    expect(body).not.toContain('Application error')
    expect(response?.status()).not.toBe(500)
  })

  test('search filters help content', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    await page.goto('/help')
    await page.fill('#help-search', 'calendar')

    await expect(page.locator('#calendar')).toBeVisible()
    await expect(page.locator('#getting-started')).toBeHidden()
  })

  test('deep link /help#calendar lands on calendar section', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()

    await page.goto('/help#calendar')
    await expect(page).toHaveURL(/\/help#calendar$/)

    await expect.poll(async () => {
      return page.evaluate(() => {
        const el = document.getElementById('calendar')
        if (!el) return false
        const rect = el.getBoundingClientRect()
        return rect.top >= 0 && rect.top < window.innerHeight
      })
    }).toBe(true)
  })
})
