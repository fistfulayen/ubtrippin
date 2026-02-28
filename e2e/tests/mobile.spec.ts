import { expect, test, type Page } from '@playwright/test'

async function assertNoHorizontalOverflow(page: Page) {
  await expect.poll(async () => {
    return page.evaluate(() => {
      return document.documentElement.scrollWidth - window.innerWidth
    })
  }).toBeLessThanOrEqual(2)
}

async function assertMobileNavAccessible(page: Page) {
  const menuButton = page.locator('nav button').first()
  await expect(menuButton).toBeVisible()
  await menuButton.click()
  await expect(page.getByRole('link', { name: 'Trips' }).first()).toBeVisible()
  await menuButton.click()
}

async function assertMobilePage(page: Page, path: string) {
  await page.goto(path)
  await expect(page).not.toHaveURL(/\/login/)
  await assertNoHorizontalOverflow(page)
  await assertMobileNavAccessible(page)
}

test.describe('Mobile viewport checks', () => {
  test.use({ viewport: { width: 375, height: 812 } })

  test('/trips mobile layout', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()
    await assertMobilePage(page, '/trips')
  })

  test('/loyalty mobile layout', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()
    await assertMobilePage(page, '/loyalty')
  })

  test('/help mobile layout', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()
    await assertMobilePage(page, '/help')
  })

  test('/settings mobile layout', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()
    await assertMobilePage(page, '/settings')
  })

  test('/feedback mobile layout', async ({ page }) => {
    if (!process.env.TEST_USER_EMAIL || !process.env.TEST_USER_PASSWORD) test.skip()
    await assertMobilePage(page, '/feedback')
  })
})
