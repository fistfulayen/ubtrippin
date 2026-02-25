/**
 * Test user fixture.
 *
 * Uses env-configured credentials. The test user must exist in the Supabase
 * project before running tests — create it once via the Supabase dashboard
 * or the admin API.
 *
 * Required env vars:
 *   TEST_USER_EMAIL     — e.g. test@ubtrippin.dev
 *   TEST_USER_PASSWORD  — secure password for the test account
 *   TEST_USER_ID        — UUID of the test user (from Supabase auth.users)
 *   TEST_API_KEY        — UBTRIPPIN API key for the test account
 */

export function testUser() {
  const email = process.env.TEST_USER_EMAIL
  const password = process.env.TEST_USER_PASSWORD
  const userId = process.env.TEST_USER_ID
  const apiKey = process.env.TEST_API_KEY

  if (!email || !password) {
    throw new Error(
      'Missing TEST_USER_EMAIL / TEST_USER_PASSWORD in env. ' +
        'Copy .env.test.example → .env.test and fill in your test credentials.'
    )
  }

  return { email, password, userId: userId ?? '', apiKey: apiKey ?? '' }
}
