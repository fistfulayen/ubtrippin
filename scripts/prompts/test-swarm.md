Fix the loyalty page tier check that we already fixed on main but verify it's correct.

In `src/app/(dashboard)/loyalty/page.tsx` and `src/app/(dashboard)/settings/profile/page.tsx`:
- The profiles query should select `subscription_tier` only (NOT `tier` — that column doesn't exist)
- The `isPro` check should be: `plan?.subscription_tier === 'pro'`

Also add a small improvement: in the loyalty vault component (`src/components/loyalty/loyalty-vault.tsx`), if there are 0 programs and the user is Pro, the empty state message should say "Add your first loyalty program" instead of showing the free tier upsell.

Files to check/modify:
- src/app/(dashboard)/loyalty/page.tsx
- src/app/(dashboard)/settings/profile/page.tsx  
- src/components/loyalty/loyalty-vault.tsx

Constraints:
- TypeScript must compile clean: `npx tsc --noEmit`
- Do not break existing functionality
- Commit message: `fix: loyalty empty state for Pro users`
