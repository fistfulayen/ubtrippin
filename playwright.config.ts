import { defineConfig, devices } from '@playwright/test'
import * as path from 'path'

/**
 * Playwright E2E configuration — PRD 008
 *
 * Tests run against the live production (or staging) URL with isolated
 * test users. No local dev server required.
 *
 * Environment variables:
 *   PLAYWRIGHT_BASE_URL         — target app URL (default: https://www.ubtrippin.xyz)
 *   SUPABASE_URL                — Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY   — service role key (for seeding / admin ops)
 *   TEST_USER_EMAIL             — test account email
 *   TEST_USER_PASSWORD          — test account password
 *   TEST_API_KEY                — UBTRIPPIN API key for test account
 */
export default defineConfig({
  testDir: './e2e/tests',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  globalSetup: './e2e/global-setup.ts',

  /* Run tests in parallel — test users are isolated so no DB locking */
  fullyParallel: false,
  workers: 1, // sequential for now; bump to 4 once users are fully isolated per test

  /* Retry once on CI to filter transient network flakiness */
  retries: process.env.CI ? 1 : 0,

  /* Report */
  reporter: process.env.CI
    ? [['github'], ['html', { outputFolder: 'playwright-report', open: 'never' }]]
    : [['list'], ['html', { outputFolder: 'playwright-report', open: 'on-failure' }]],

  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.ubtrippin.xyz',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    headless: true,
    // Load auth session saved by global-setup (file may not exist on first run without creds)
    storageState: path.join(__dirname, 'e2e/auth-state.json'),
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
})
