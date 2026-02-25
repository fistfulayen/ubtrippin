/**
 * Playwright global setup — authenticates the test user and saves browser storage state.
 *
 * Signs in via Supabase email+password, injects session cookies into a Playwright context,
 * saves to e2e/auth-state.json. All test files load from that saved state.
 *
 * The test user must exist in Supabase with email+password enabled.
 * Create once: Supabase Dashboard → Authentication → Users → Add user.
 */

import { chromium, FullConfig } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

/** Extract project ref from Supabase URL */
function projectRef(supabaseUrl: string): string {
  return supabaseUrl.match(/https:\/\/([^.]+)/)?.[1] ?? 'unknown'
}

/**
 * Convert a Supabase session into the cookie format used by @supabase/ssr.
 * The SSR package stores the session as JSON, optionally split across multiple
 * chunk cookies if the payload exceeds ~3180 bytes.
 */
function sessionToCookies(
  session: { access_token: string; refresh_token: string; [key: string]: unknown },
  supabaseUrl: string,
  domain: string
): Array<{ name: string; value: string; domain: string; path: string; httpOnly: boolean; secure: boolean; sameSite: 'Lax' | 'Strict' | 'None' }> {
  const ref = projectRef(supabaseUrl)
  const baseName = `sb-${ref}-auth-token`
  const value = JSON.stringify(session)
  const CHUNK_SIZE = 3180
  const cookies = []

  if (value.length <= CHUNK_SIZE) {
    cookies.push({ name: baseName, value, domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const })
  } else {
    const chunks = []
    for (let i = 0; i < value.length; i += CHUNK_SIZE) {
      chunks.push(value.slice(i, i + CHUNK_SIZE))
    }
    for (let i = 0; i < chunks.length; i++) {
      cookies.push({ name: `${baseName}.${i}`, value: chunks[i], domain, path: '/', httpOnly: true, secure: true, sameSite: 'Lax' as const })
    }
  }

  return cookies
}

export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? 'https://www.ubtrippin.xyz'
  const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  const supabaseAnonKey =
    process.env.SUPABASE_ANON_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? ''
  const email = process.env.TEST_USER_EMAIL ?? ''
  const password = process.env.TEST_USER_PASSWORD ?? ''

  if (!email || !password) {
    console.warn('[global-setup] No TEST_USER_EMAIL/PASSWORD — skipping auth setup. Unauthenticated tests only.')
    // Write an empty state file so Playwright doesn't fail
    const authStatePath = path.join(__dirname, 'auth-state.json')
    fs.writeFileSync(authStatePath, JSON.stringify({ cookies: [], origins: [] }))
    return
  }

  // Sign in via Supabase auth (Node.js)
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  })

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data.session) {
    throw new Error(`[global-setup] Supabase sign-in failed: ${error?.message ?? 'no session'}`)
  }

  const session = data.session as unknown as Record<string, unknown>

  // Extract domain from baseURL (e.g. "www.ubtrippin.xyz")
  const domain = new URL(baseURL).hostname

  // Convert session to SSR cookies
  const sessionCookies = sessionToCookies(
    session as { access_token: string; refresh_token: string },
    supabaseUrl,
    domain
  )

  // Boot browser and inject cookies
  const browser = await chromium.launch()
  const context = await browser.newContext({ baseURL })

  await context.addCookies(sessionCookies)

  // Verify by navigating to /trips
  const page = await context.newPage()
  const res = await page.goto('/trips')
  if (res && res.status() === 200) {
    console.log('[global-setup] Auth verified — /trips returned 200')
  } else {
    console.warn(`[global-setup] /trips returned ${res?.status()} — auth may not be fully set`)
  }

  // Save storage state
  const authStatePath = path.join(__dirname, 'auth-state.json')
  await context.storageState({ path: authStatePath })
  console.log(`[global-setup] Auth state saved → ${authStatePath}`)

  await browser.close()
}
