# Auth/RLS Security Review

Reference baseline: `docs/SUPABASE-AUTH-SPEC.md` (Supabase SSR auth, Feb 2026)

## `src/lib/supabase/server.ts`

**Status: DEVIATION**

- **Lines 32-47**: `createSecretClient()` is defined in the same module used by dashboard/server-component code.
  - **Why it matters**: This increases accidental misuse risk in RLS-protected pages (which already happened in `trips` pages). Spec requires dashboard code to use cookie-bound `createClient()` so `auth.uid()` is enforced by DB policies.
  - **Fix**: Keep `createClient()` here, but move `createSecretClient()` to a clearly scoped server-only module for API-key/webhook routes (for example `src/lib/supabase/service.ts`) and ban importing it in `src/app/(dashboard)/**`.

- **Lines 10-11, 36-37**: Environment variable names (`NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY`) match the spec.

## `src/lib/supabase/client.ts`

**Status: CORRECT**

- **Lines 1-9**: Uses `createBrowserClient` with `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` exactly as specified.
- No secret key exposure.

## `src/lib/supabase/middleware.ts`

**Status: BUG**

- **Lines 11-42**: Correctly creates `createServerClient(...)` with publishable key and calls `getClaims()` immediately after client creation.

- **Lines 50-55** (`isProtectedPath && !user`) and **58-62** (`/login` redirect when authenticated): returns fresh `NextResponse.redirect(...)` objects without copying cookies from `supabaseResponse`.
  - **Why it matters**: `getClaims()` may refresh tokens and write updated cookies into `supabaseResponse`. Returning a different response drops those `Set-Cookie` headers, causing stale/missing session cookies and intermittent `auth.uid() = null` behavior (RLS failures).
  - **Fix**: When redirecting, copy cookies from `supabaseResponse` into the redirect response before returning.

Suggested pattern:

```ts
const redirect = NextResponse.redirect(url)
supabaseResponse.cookies.getAll().forEach(({ name, value, ...rest }) => {
  redirect.cookies.set(name, value, rest)
})
return redirect
```

(Equivalent copying logic is acceptable.)

## `src/proxy.ts`

**Status: CORRECT**

- **Lines 4-6**: Uses Next.js 16 `proxy` export and delegates to `updateSession`.
- **Lines 8-18**: Matcher excludes static assets and `api/webhooks` only; protected dashboard routes remain covered.

## `src/app/(auth)/callback/route.ts`

**Status: DEVIATION**

- **Lines 10-11**: Correct flow: server `createClient()` + `exchangeCodeForSession(code)` in Route Handler (cookie writes supported).
- **Lines 14-23**: Redirect host logic deviates from spec’s simpler origin redirect.
  - **Why it matters**: Using `x-forwarded-host` without strict allowlisting can create host-header/open-redirect risk in some deployments.
  - **Fix**: Prefer `origin` + validated internal `redirectTo` path (must start with `/` and not `//`), or enforce explicit host allowlist before using forwarded host.

## `src/app/(dashboard)/trips/page.tsx`

**Status: DEVIATION**

- **Line 1** import and **lines 39-46** query: uses `createSecretClient()` inside dashboard server component for trip reads.
  - **Why it matters**: This bypasses RLS and replaces DB authorization with app-layer `.eq('user_id', user.id)`. Spec marks this as wrong for dashboard pages.
  - **Fix**: Use cookie-bound `createClient()` for trip queries and let RLS policies filter rows.

- **Lines 36-38** comment explicitly documents intentional RLS bypass.
  - **Why it matters**: Confirms spec violation and masks auth/session issues instead of fixing SSR cookie/session flow.
  - **Fix**: Remove workaround and rely on corrected proxy cookie handling.

## `src/app/(dashboard)/trips/[id]/page.tsx`

**Status: BUG**

- **Line 1** import + **lines 22-77**: uses `createSecretClient()` for trip, collaborator, and item reads in dashboard page.
  - **Why it matters**: RLS is bypassed on a user-facing route.

- **Critical exposure path**: **lines 23-27** fetch trip by `id` only, then **no authorization guard** rejects users who are neither owner nor collaborator.
  - **Why it matters**: Any authenticated user who knows/guesses a trip UUID can read trip details and `trip_items` (lines 54-59) via service-role access.
  - **Fix**:
    - Replace all dashboard reads with cookie `createClient()`.
    - Enforce authorization explicitly after fetching row(s): if not owner and not accepted collaborator, return `notFound()`/redirect.
    - Prefer RLS policies that make unauthorized rows unreachable by default.

## `src/components/trips/collaborators-section.tsx`

**Status: CORRECT**

- **Lines 5, 79-85**: Uses browser `createClient()` (publishable key, user session cookies) for collaborator deletion; this is aligned with SSR/browser auth model.
- No service key usage.

---

## Priority Fix Order

1. **`src/lib/supabase/middleware.ts` redirect cookie-copy bug** (likely RLS/session instability root cause).
2. **`src/app/(dashboard)/trips/[id]/page.tsx` service-role data exposure** (critical auth bypass).
3. **`src/app/(dashboard)/trips/page.tsx` secret-client RLS bypass workaround**.
4. **Refactor `createSecretClient` location/import boundaries** to prevent future misuse.
5. **Harden callback redirect host/path validation**.
