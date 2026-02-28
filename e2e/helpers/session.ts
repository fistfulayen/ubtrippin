import type { Page } from '@playwright/test'

/**
 * Build a Cookie header from the current authenticated browser context.
 */
export async function sessionCookieHeader(page: Page): Promise<string> {
  const cookies = await page.context().cookies()
  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}
