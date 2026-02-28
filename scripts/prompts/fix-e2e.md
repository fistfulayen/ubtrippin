# Fix E2E Test Suite — 7 Failing Tests

## Results: 20 passed, 7 failed. Auth works, pages render correctly. The failures are test bugs, not app bugs.

## Bug 1: False positive "500" detection (affects guides.spec.ts, settings.spec.ts, trips.spec.ts)

Multiple tests do `expect(body).not.toContain('500')` on the full HTML content. This matches CSS class strings like `text-gray-500` which are everywhere in the rendered HTML. The page is rendering correctly — this assertion is just wrong.

**Fix:** Replace `expect(body).not.toContain('500')` with a check that won't match CSS classes. Options:
- Check for visible text "500" in an error context: `expect(body).not.toMatch(/>\s*500\s*<\/h1/)`
- Or check HTTP status instead: `expect(response?.status()).toBe(200)`
- Or just remove this assertion since we already check for 'Application error'
- **Best approach**: Keep the 'Application error' check, and add `expect(response?.status()).not.toBe(500)` where `response` is from `page.goto()`. Remove the string '500' check entirely.

**Files:**
- `e2e/tests/guides.spec.ts` line 28
- `e2e/tests/settings.spec.ts` line 22
- `e2e/tests/trips.spec.ts` (similar pattern)

## Bug 2: Auth test looks for Google button that doesn't exist (auth.spec.ts)

`e2e/tests/auth.spec.ts` line 26: `page.getByRole('button', { name: /google/i })` — the login page uses an anchor link to Google OAuth, not a `<button>`. 

**Fix:** Look for a link instead: `page.getByRole('link', { name: /google/i })` or just check the page rendered without error and has a sign-in form.

**File:** `e2e/tests/auth.spec.ts` line 26

## Bug 3: seed-guide fixture missing user_id on guide_entries (seed-guide.ts)

`e2e/fixtures/seed-guide.ts` line 55: The `seedGuideEntry()` function inserts into `guide_entries` without passing `user_id`. The `guide_entries` table has a NOT NULL `user_id` column.

**Fix:** Add `user_id` to the insert. The function needs to accept `userId` as a parameter, or look it up from the guide's `user_id`.

Simplest fix — add `userId` to `SeedEntryOptions`:
```typescript
export interface SeedEntryOptions {
  guideId: string
  userId: string  // ADD THIS
  name?: string
  // ...
}
```
Then pass it in the insert: `user_id: opts.userId`

And update the caller in `guides.spec.ts` to pass `userId: process.env.TEST_USER_ID!`

**File:** `e2e/fixtures/seed-guide.ts` around line 50-60, and `e2e/tests/guides.spec.ts` wherever `seedGuideEntry` is called.

## Validation

After all fixes:
1. `pnpm exec tsc --noEmit` must pass
2. `pnpm build` should not be tested (needs env vars)
3. Commit: `git add -A && git commit -m "fix(e2e): false positive 500 check, auth button selector, seed-guide user_id"`
4. Push: `git push origin fix/e2e-tests`

## Important
- Do NOT use `createSecretClient()` or service role to bypass RLS. This code will be security-audited monthly.
- Do NOT modify any app code — only test files under `e2e/`
