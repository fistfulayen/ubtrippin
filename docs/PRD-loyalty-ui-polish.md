# Loyalty Programs Page — UI Polish

**Scope:** Visual improvements to `/loyalty` page (`src/components/loyalty/loyalty-vault.tsx` and `src/app/(dashboard)/loyalty/page.tsx`)

## Changes

### 1. Group by traveler name
When there are programs for more than one `traveler_name`, organize the page into sections grouped by person. Each section gets a heading with the traveler's name. Single-traveler accounts show no grouping (flat list as today).

Sort groups alphabetically by traveler name, with the authenticated user's own name first (match against `profiles.full_name`). Within each group, sort by `provider_name`.

### 2. Airline logos on each card
Add provider logos to each loyalty program card, to the left of the provider name. Use the existing `provider-logo.ts` utility at `src/lib/images/provider-logo.ts` which maps provider keys to logo URLs (Google Favicons for most, pics.avs.io for airlines).

Import and call `getProviderLogoUrl(provider_key, provider_type)` — it returns a URL string. Display as a 24x24 image with rounded corners and a fallback to the first letter of the provider name on error.

### 3. Pass user's full_name to the component
The loyalty page server component should query `profiles.full_name` alongside `subscription_tier` and pass it to `LoyaltyVault` as a prop so it can determine which group is "you" vs other travelers.

## Files to modify
- `src/components/loyalty/loyalty-vault.tsx` — grouping logic, logo display
- `src/app/(dashboard)/loyalty/page.tsx` — pass `fullName` prop
- `src/lib/images/provider-logo.ts` — no changes needed, just import it

## Constraints
- TypeScript must compile clean (`npx tsc --noEmit`)
- Use existing UI components (Card, Avatar patterns from the codebase)
- Logos should not break layout if they fail to load — use onError fallback
- Keep the existing reveal/copy/edit/delete/preferred functionality intact
- The "Add loyalty program" modal should default the traveler name to the user's own name

## Commit message
`feat: loyalty page — group by traveler, add provider logos`
