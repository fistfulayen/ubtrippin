# Bug Fix: 404 After OAuth Login Redirect

## Problem
When a user clicks "view full itinerary" in an email on a mobile device where they're not logged in, they click "Sign in with Google", and after successful OAuth, they're redirected to a 404 page instead of the intended itinerary.

## Root Cause Analysis
The OAuth callback is likely losing the original `next` redirect URL or the URL is malformed after Google sign-in. Check:
1. How the `next` parameter is passed through the OAuth flow
2. Whether the redirect URL after auth is properly constructed
3. If the trip share URL is valid and accessible post-login

## Files to Investigate
- `src/app/auth/callback/route.ts` — OAuth callback handler
- `src/lib/supabase/auth.ts` — Auth utilities
- `src/components/auth/login-button.tsx` or similar — Sign in button that passes redirectTo
- `src/middleware.ts` — Middleware that might handle redirects
- `src/app/(public)/share/[token]/page.tsx` — Share page that requires auth

## Required Fix

1. **Preserve redirect URL through OAuth flow:**
   - Ensure the `next` query param is encoded and passed to Google's OAuth
   - Verify the redirect URL survives the round-trip to Google
   - Check Supabase auth callback handles the `next` param correctly

2. **Validate the share page route:**
   - Confirm `/share/[token]` exists and handles authenticated users
   - Ensure the share token is valid after login (not expired or tied to session)

3. **Test scenarios:**
   - Click share link while logged out → sign in with Google → should land on share page
   - Share link with query params should preserve them
   - Mobile and desktop behavior should match

## Implementation Notes

- The share page is at `/share/[token]` (public routes)
- After login, user should be redirected back to the share URL they originally clicked
- Check if there's any middleware intercepting `/share/*` routes incorrectly
- Verify `getSession()` vs `getUser()` usage — `getSession` can return stale data

## Success Criteria
- [ ] Clicking share link while logged out, then signing in with Google, lands user on correct share page
- [ ] All query parameters preserved through the flow
- [ ] No 404 errors after successful OAuth
- [ ] TypeScript compiles clean (`npx tsc --noEmit`)

## Commit Message
`fix: preserve redirect URL through OAuth login flow`
