# Supabase Auth — Correct Implementation Spec

Reference: https://supabase.com/docs/guides/auth/server-side/nextjs (Feb 2026)

This doc defines the correct Supabase SSR auth implementation for UBTRIPPIN.
Compare our code against this spec to find and fix the RLS bug.

---

## Architecture

```
Browser (Client Components)
  └─ createBrowserClient(SUPABASE_URL, PUBLISHABLE_KEY)
     - Auth state managed automatically via cookies
     - RLS works: auth.uid() resolved from session cookie

Proxy (src/proxy.ts → lib/supabase/middleware.ts)
  └─ createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, { cookies from request })
     - Runs on EVERY matched request before server components
     - MUST call getClaims() immediately after creating client
     - getClaims() refreshes expired tokens and writes updated cookies to response
     - MUST return the supabaseResponse object (carries the updated cookies)

Server Components / Server Actions / Route Handlers
  └─ createServerClient(SUPABASE_URL, PUBLISHABLE_KEY, { cookies from next/headers })
     - Reads session from cookies (refreshed by proxy)
     - RLS works: auth.uid() resolved from JWT in cookie
     - setAll may throw in Server Components (ok, proxy handles refresh)

API Routes (webhook, calendar feed, API key auth)
  └─ createServerClient(SUPABASE_URL, SECRET_KEY, { no cookies })
     - Bypasses RLS (service role)
     - ONLY for routes where user auth is handled differently (API keys, webhooks)
```

## File-by-File Spec

### 1. `src/lib/supabase/client.ts` (Browser)

```typescript
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!
  )
}
```

**Rules:**
- No `createSecretClient` equivalent on the client side (ever)
- This client handles its own cookie storage automatically
- RLS works via the session cookie

### 2. `src/lib/supabase/server.ts` (Server)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Server Component — can't write cookies.
            // Proxy handles refresh, so this is safe to ignore.
          }
        },
      },
    }
  )
}
```

**Rules:**
- Uses PUBLISHABLE key, not SECRET key
- The session JWT is read from cookies and sent to PostgREST automatically
- `auth.uid()` in RLS resolves from this JWT
- This is the ONLY client that should be used in dashboard pages

### 3. `src/lib/supabase/middleware.ts` (Proxy logic)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // CRITICAL: Do not run any code between createServerClient and getClaims()
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims

  // ... route protection logic ...

  // CRITICAL: Must return supabaseResponse (carries refreshed cookies)
  return supabaseResponse
}
```

**Rules:**
- Uses PUBLISHABLE key
- `getClaims()` MUST be called immediately after client creation
- `getClaims()` validates JWT locally (no network call), refreshes if needed
- The response object MUST be returned as-is (carries cookie updates)
- If you create a new response, you MUST copy cookies from supabaseResponse

### 4. `src/proxy.ts` (Next.js 16 entry point)

```typescript
import { type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|api/webhooks|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
```

**Rules:**
- Named export `proxy` (not `middleware` — Next.js 16)
- Matcher must NOT exclude auth-protected routes
- Matcher CAN exclude webhook routes (they use API key auth)

### 5. `src/app/(auth)/callback/route.ts` (OAuth callback)

```typescript
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') || '/trips'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_error`)
}
```

**Rules:**
- This is a Route Handler, so `cookies().set()` works
- `exchangeCodeForSession` stores the session in cookies via `setAll`
- The redirect triggers the proxy, which calls `getClaims()` on the fresh session

### 6. Dashboard pages (Server Components)

```typescript
// CORRECT: Use cookie client, let RLS handle authorization
const supabase = await createClient()
const { data: { user } } = await supabase.auth.getUser()
const { data: trips } = await supabase
  .from('trips')
  .select('*')
  .order('start_date', { ascending: true })
// RLS policy (auth.uid() = user_id) filters automatically

// WRONG: Using secret client bypasses RLS
const sc = createSecretClient()
const { data: trips } = await sc
  .from('trips')
  .select('*')
  .eq('user_id', user.id)  // App-layer filter, no DB-level guarantee
```

### 7. API Routes (API key auth)

```typescript
// CORRECT: Service client for API-key-authenticated routes
// Auth is handled by API key verification, not cookies
const supabase = createSecretClient()
const { data } = await supabase
  .from('trips')
  .select('*')
  .eq('user_id', authenticatedUserId)
```

---

## Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL         — Project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY — sb_publishable_... (new) or anon JWT (legacy)
SUPABASE_SECRET_KEY              — sb_secret_... (new) or service_role JWT (legacy)
```

Both new-style and legacy keys work. The docs say:
> "you can use both the current anon and service_role keys and the new
> publishable key... They work roughly the same in terms of permissions
> and data access."

## Known Gotchas

1. **Site URL must be HTTPS** — Supabase Dashboard → Auth → URL Configuration.
   If set to `http://`, cookies get wrong `Secure` flag and aren't sent on HTTPS.
   (We fixed this on Feb 25, 2026.)

2. **Route prefetching** — Next.js `<Link>` and `Router.push()` can trigger
   server requests before the browser processes tokens. Redirect to a single
   post-login page that doesn't prefetch.

3. **Proxy must run on auth-protected routes** — If the matcher excludes a
   route, the session won't be refreshed and `auth.uid()` may be null.

4. **Don't create new response objects** — If you need to modify the response
   in the proxy, copy cookies from `supabaseResponse` to your new response.

5. **getClaims() vs getUser()** — `getClaims()` is local JWT validation (fast).
   `getUser()` calls the auth server (slow, can fail). Use `getClaims()` in
   the proxy. Use `getUser()` in pages only when you need to verify the session
   is still valid server-side.

---

## What To Audit

Codex should compare our implementation against this spec and identify:

1. Any file where `createSecretClient()` is used but `createClient()` should be
2. Any server component or page that bypasses RLS unnecessarily
3. Whether our proxy correctly returns the supabaseResponse with cookies
4. Whether our callback route correctly exchanges the code and sets cookies
5. Whether the proxy matcher accidentally excludes any protected routes
6. Whether there's any code between `createServerClient` and `getClaims()` in the proxy
7. Whether we're creating new response objects without copying cookies
8. Any client components doing Supabase writes that should be server actions
9. Environment variable names — do they match what the docs expect?
10. Whether the `@supabase/ssr` version supports `getClaims()` (need ≥0.6.x)
