# Remove Demo Trips — Design Spec

> PRD-054: Onboarding Experience & Sample Trip Rethink  
> Approach: Option C (read-only showcase) + Option D (rich empty states)

**Goal:** Remove auto-seeded demo trips from user accounts. Replace with a read-only showcase page and improved empty states.

**Architecture:** Delete the demo trip creation flow. Keep the static demo data for the standalone showcase page at `/trips/demo`. Redesign the empty state on the trips dashboard. Update onboarding emails to link to the showcase page instead of in-account demo trips. Clean up existing demo trips via migration.

**Tech Stack:** Next.js (App Router), Supabase (migration), React Email (onboarding templates)

---

## 1. Stop Creating Demo Trips

Remove the call to `createDemoTrip()` from `src/app/(dashboard)/trips/page.tsx`. The entire block that checks `trips.length === 0` and calls `createDemoTrip` then re-fetches trips should be removed.

`src/lib/trips/demo-trip.ts` can be deleted entirely — it's only called from the trips page.

## 2. Improve the Empty State (OnboardingCard)

The existing `OnboardingCard` component (`src/components/trips/onboarding-card.tsx`) already renders when `!hasTrips`. It currently has:
- Email forwarding instructions
- Link to `/trips/demo` ("See a demo trip →")
- AI agent connection instructions
- Manual trip creation button

**Changes:**
- Make the "See a demo trip →" link more prominent — change from a text link to a styled card/button that explains what they'll see
- Add a brief "What you'll get" section showing the trip card visualization (static mockup or just descriptive text like "Flights, hotels, and activities organized into a beautiful timeline")
- Keep everything else as-is — the card is already well-designed

## 3. Remove Demo Trip Banner from Trip Detail Page

In `src/app/(dashboard)/trips/[id]/page.tsx`, remove:
- The `{trip.is_demo && <DemoTripBanner />}` conditional
- The import of `DemoTripBanner`

The `DemoTripBanner` component itself (`src/components/trips/demo-trip-banner.tsx`) should be kept — it's still used on the standalone `/trips/demo` page.

## 4. Remove `is_demo` Branching from Trip Card

In `src/components/trips/trip-card.tsx`, line 162:
- Remove `{trip.is_demo ? 'Sample itinerary' : 'Trip overview'}` — always show 'Trip overview'
- Remove the `{trip.is_demo && (...)}` block around line 215

## 5. Update Onboarding Emails

### Day 5 Email (`src/components/email/onboarding-day-5.tsx`)
- Change subject line from "Still haven't tried it? Check out your sample trip" to "See how UBTRIPPIN organizes your travel"
- Change body from "We created a sample trip in your account" to "See how a trip looks when you forward a booking email"
- Change button text from "View My Sample Trip" to "See Example Trip"
- Link to `https://www.ubtrippin.xyz/trips/demo` (the public showcase page, not an in-account trip)

### Nudge Email Logic (`src/lib/nudge-emails.ts`)
- Day 5 email: change `demoTripUrl` to always be `${APP_URL}/trips/demo` instead of looking up the user's demo trip
- Day 5 subject: update to match new email subject
- Remove `demoTrip` variable and the `tripRows.find((trip) => trip.is_demo)` lookup
- Day 2 and Day 14 logic: `hasNonDemoTrip` can become simpler — just `tripRows.length > 0` (since no demo trips will exist for new users). But keep backward compatibility for existing users who still have demo trips during transition.

## 6. Delete Existing Demo Trips (Migration)

Create a Supabase migration that:
1. Deletes all rows from `trip_items` where `trip_id` is in demo trips
2. Deletes all rows from `trips` where `is_demo = true`
3. Does NOT drop the `is_demo` column yet (keep for backward compatibility during rollout; can drop in a future migration)

```sql
-- Delete demo trip items first (FK constraint)
DELETE FROM trip_items
WHERE trip_id IN (SELECT id FROM trips WHERE is_demo = true);

-- Delete demo trips
DELETE FROM trips WHERE is_demo = true;
```

## 7. Polish the Showcase Page

The existing `/trips/demo` page (`src/app/trips/demo/page.tsx`) is functional but basic. Minor improvements:
- Change "Back to my trips" to "Back to trips" (it's a public page, not necessarily the user's)
- Update the `DemoTripBanner` text on this page to be more inviting: "This is an example trip. Forward a booking confirmation to trips@ubtrippin.xyz to create your own!"
- No structural changes needed — the page already displays demo data from the static `demo-trip-data.ts`

## Files Changed

| File | Action |
|------|--------|
| `src/app/(dashboard)/trips/page.tsx` | Remove createDemoTrip call and re-fetch |
| `src/lib/trips/demo-trip.ts` | Delete |
| `src/app/(dashboard)/trips/[id]/page.tsx` | Remove demo banner conditional |
| `src/components/trips/trip-card.tsx` | Remove is_demo branching |
| `src/components/email/onboarding-day-5.tsx` | Update copy and link |
| `src/lib/nudge-emails.ts` | Simplify demo trip logic |
| `src/app/trips/demo/page.tsx` | Minor copy updates |
| `supabase/migrations/YYYYMMDDHHMMSS_delete_demo_trips.sql` | Delete existing demo trips |

## What We're NOT Changing

- `src/lib/trips/demo-trip-data.ts` — kept for showcase page
- `src/components/trips/demo-trip-banner.tsx` — kept for showcase page
- `src/app/api/v1/trips/demo/route.ts` — kept for API demo endpoint
- `src/components/trips/onboarding-card.tsx` — minor enhancement only
- `is_demo` column — kept for now (drop in future migration)
