# Remove Demo Trips — Implementation Plan

> **For agents:** Execute this plan using subagent-driven-development.
> Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop creating demo trips in user accounts; clean up existing ones; improve empty states and onboarding emails.

**Architecture:** Remove demo trip creation from dashboard page, delete existing demo trips via migration, update onboarding emails to link to showcase page, polish empty state.

**Tech Stack:** Next.js (App Router), Supabase (migration SQL), React Email

**Spec:** `docs/superpowers/specs/2026-03-24-remove-demo-trips-design.md`

## Project Rules (include in every agent prompt)
- Do NOT use createSecretClient() or service role to bypass RLS
- No real names, hotel names, addresses in code/comments  
- Use `/api/v1/...` for data access, never direct Supabase from user-facing code
- TDD: write failing test first, watch it fail, then implement

---

### Task 1: Remove demo trip creation from dashboard

**Files:**
- Modify: `src/app/(dashboard)/trips/page.tsx`
- Delete: `src/lib/trips/demo-trip.ts`

**Model:** flash-lite (mechanical, clear spec)

- [ ] **Step 1: Remove the demo trip import and creation block**

In `src/app/(dashboard)/trips/page.tsx`:
- Remove import: `import { createDemoTrip } from '@/lib/trips/demo-trip'`
- Remove the entire block (approx lines 43-55):
  ```typescript
  // Create a sample trip for brand new users after email confirmation.
  if (user && profile && (trips?.length ?? 0) === 0) {
    await createDemoTrip({...}).catch(() => {})
    const { data: refreshedTrips } = await supabase...
    trips = refreshedTrips ?? []
  }
  ```

- [ ] **Step 2: Delete the demo trip creation module**

```bash
rm src/lib/trips/demo-trip.ts
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: Build succeeds with no errors about missing demo-trip imports.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): stop creating demo trips for new users

Part of PRD-054. Demo trips caused confusion with real travel data.
Users now see the empty state with link to showcase page instead."
```

---

### Task 2: Remove demo trip UI branching

**Files:**
- Modify: `src/app/(dashboard)/trips/[id]/page.tsx`
- Modify: `src/components/trips/trip-card.tsx`

**Model:** flash-lite (mechanical removal)

- [ ] **Step 1: Remove demo banner from trip detail page**

In `src/app/(dashboard)/trips/[id]/page.tsx`:
- Remove: `import { DemoTripBanner } from '@/components/trips/demo-trip-banner'`
- Remove: `{trip.is_demo && <DemoTripBanner />}`

- [ ] **Step 2: Remove is_demo branching from trip card**

In `src/components/trips/trip-card.tsx`:
- Change line ~162: `{trip.is_demo ? 'Sample itinerary' : 'Trip overview'}` → `Trip overview`
- Remove the `{trip.is_demo && (...)}` conditional block around line ~215

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): remove is_demo UI branching from trip views

Demo banner and sample itinerary label no longer needed since
demo trips are being removed from user accounts."
```

---

### Task 3: Update onboarding emails

**Files:**
- Modify: `src/components/email/onboarding-day-5.tsx`
- Modify: `src/lib/nudge-emails.ts`

**Model:** sonnet (cross-file logic changes)

- [ ] **Step 1: Update Day 5 email template**

In `src/components/email/onboarding-day-5.tsx`:
- Change Preview text: "See how UBTRIPPIN organizes your travel"
- Change Heading: "See how UBTRIPPIN organizes your travel"
- Change body text: "See how a trip looks when you forward a booking email — we put together an example to show you."
- Change button text: "See Example Trip"
- The `demoTripUrl` prop is still used for the button link (now always points to showcase)

- [ ] **Step 2: Update nudge email logic**

In `src/lib/nudge-emails.ts`:
- Day 5: change `demoTripUrl` to always be `${APP_URL}/trips/demo`
- Remove: `const demoTrip = tripRows.find((trip) => trip.is_demo)`
- Day 5 subject: change to "See how UBTRIPPIN organizes your travel"
- Keep `hasNonDemoTrip` logic as-is for backward compatibility (existing users may still have demo trips during transition)

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "feat(onboarding): update day-5 email to link to showcase page

No longer references in-account sample trip. Links to /trips/demo
showcase page instead. Subject and copy updated."
```

---

### Task 4: Polish showcase page

**Files:**
- Modify: `src/app/trips/demo/page.tsx`

**Model:** flash-lite (copy changes only)

- [ ] **Step 1: Update copy on showcase page**

In `src/app/trips/demo/page.tsx`:
- Change "Back to my trips" → "Back to trips"

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```

- [ ] **Step 3: Commit**

```bash
git add -A
git commit -m "feat(onboarding): polish demo showcase page copy"
```

---

### Task 5: Migration — delete existing demo trips

**Files:**
- Create: `supabase/migrations/20260324130000_delete_demo_trips.sql`

**Model:** flash-lite (straightforward SQL)

- [ ] **Step 1: Create migration file**

```sql
-- PRD-054: Remove demo trips from user accounts
-- Demo trips caused confusion with real travel data.
-- The /trips/demo showcase page remains for reference.

-- Delete demo trip items first (FK constraint)
DELETE FROM trip_items
WHERE trip_id IN (SELECT id FROM trips WHERE is_demo = true);

-- Delete demo trips
DELETE FROM trips WHERE is_demo = true;

-- Note: is_demo column kept for backward compatibility.
-- Drop in a future migration after confirming no code references it.
```

- [ ] **Step 2: Commit**

```bash
git add -A
git commit -m "migration: delete existing demo trips from all accounts

15 demo trips removed. is_demo column preserved for now.
Part of PRD-054."
```

---

### Task 6: Final verification

**Model:** sonnet (integration check)

- [ ] **Step 1: Run full test suite**

```bash
npm test
```

- [ ] **Step 2: Run build**

```bash
npm run build
```

- [ ] **Step 3: Verify no remaining references to deleted file**

```bash
grep -r "demo-trip'" --include="*.ts" --include="*.tsx" src/ | grep -v demo-trip-data | grep -v demo-trip-banner | grep -v node_modules
```
Expected: No results (all references to the deleted `demo-trip.ts` are gone).

- [ ] **Step 4: Verify showcase page still works**

The static demo data in `demo-trip-data.ts` should still power `/trips/demo` and `/api/v1/trips/demo`.

- [ ] **Step 5: Commit any fixes, push branch, create PR**

```bash
git push -u origin feat/prd-054-remove-demo-trips
gh pr create --title "feat: remove demo trips from user accounts (PRD-054)" --body "..."
```
