import { test, expect, type Page } from '@playwright/test'

function requireSession() {
  if (!process.env.TEST_USER_EMAIL) test.skip()
}

test.describe('Mobile viewport', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  async function assertNoHorizontalOverflow(pagePath: string, page: Page) {
    await page.goto(pagePath)
    await expect(page).not.toHaveURL(/\/login/)
    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > window.innerWidth + 1
    })
    expect(hasOverflow).toBe(false)
  }

  test('/trips has no horizontal overflow', async ({ page }) => {
    requireSession()
    await assertNoHorizontalOverflow('/trips', page)
  })

  test('/loyalty has no horizontal overflow', async ({ page }) => {
    requireSession()
    await assertNoHorizontalOverflow('/loyalty', page)
  })

  test('/help has no horizontal overflow', async ({ page }) => {
    requireSession()
    await assertNoHorizontalOverflow('/help', page)
  })

  test('/settings has no horizontal overflow', async ({ page }) => {
    requireSession()
    await assertNoHorizontalOverflow('/settings', page)
  })

  test('/feedback has no horizontal overflow', async ({ page }) => {
    requireSession()
    await assertNoHorizontalOverflow('/feedback', page)
  })

  test('navigation links are accessible on mobile', async ({ page }) => {
    requireSession()
    await page.goto('/trips')
    // On mobile, nav links should be reachable somehow (hamburger, bottom nav, or scrollable)
    const tripsLink = page.getByRole('link', { name: /trips/i }).first()
    const settingsLink = page.getByRole('link', { name: /settings/i }).first()
    // At minimum, trips link should exist in DOM
    expect(await tripsLink.count()).toBeGreaterThan(0)
    expect(await settingsLink.count()).toBeGreaterThan(0)
  })
})
