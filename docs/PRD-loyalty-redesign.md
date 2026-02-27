# Loyalty Programs Page — Full Redesign

**Goal:** Make `/loyalty` look Airbnb-quality. Current layout is cluttered, logos are broken, navigation between travelers is missing.

## Design Direction

Think Apple Wallet meets Airbnb. Clean cards, generous whitespace, clear visual hierarchy. Each program should feel like a membership card, not a database row.

## Changes Required

### 1. Fix provider logos

The current code calls `getProviderLogoUrl(provider_key)` with keys like `delta`, `air_france`, etc. But the function expects display names or IATA codes. 

**Fix:** Add a mapping in `loyalty-vault.tsx` from `provider_key` to the airline IATA code, then use `https://pics.avs.io/80/80/{IATA}@2x.png` directly for airlines. For non-airlines, use Google Favicons.

Mapping:
```
delta → DL
air_france → AF
united → UA
american → AA
alaska → AS
spirit → NK
finnair → AY
airbaltic → BT
sas → SK
la_compagnie → B0
miles_and_more → LH (Lufthansa group)
```

### 2. Traveler navigation tabs

When multiple travelers exist, show **horizontal pill tabs** at the top of the card list (not section headers). Tabs: one per unique `traveler_name`, plus "All" as default. Clicking a tab filters to that person's programs only. "All" shows everyone grouped with a subtle divider and person name as a small label.

The tabs should be sticky below the page header when scrolling.

### 3. Card redesign — membership card style

Each loyalty program card should look like a sleek membership card:

```
┌─────────────────────────────────────────────────┐
│  [airline logo 40x40]                    ⭐ ✏️ 🗑 │
│  Delta SkyMiles                                  │
│  Ian Rogers                                      │
│                                                   │
│  ••••••3539                    [Copy] [Reveal]   │
│                                          Airline │
└─────────────────────────────────────────────────┘
```

Key design decisions:
- **Logo:** 40x40, rounded-lg, left-aligned at top. On error, show a colored circle with the first letter of the airline name (use a consistent color per provider_key).
- **Provider name:** Large, semibold, `text-gray-900`
- **Traveler name:** Below provider, `text-sm text-gray-500`
- **Masked number:** Bottom left, `font-mono text-base text-gray-700`
- **Copy and Reveal:** Small outline buttons, bottom right, subtle
- **Type badge (Airline):** Small pill, bottom right, very subtle (`text-xs text-gray-400 bg-gray-50`)
- **Action icons (edit, delete):** Top right, small, `text-gray-400 hover:text-gray-600`. Preferred star also top right.
- **Card:** `bg-white rounded-xl border border-gray-100 shadow-sm hover:shadow-md transition-shadow p-5`
- **Grid:** 1 column on mobile, 2 columns on desktop (`grid grid-cols-1 md:grid-cols-2 gap-4`)
- **No dividers or separators between fields** — use whitespace

### 4. Summary header

Replace the current double-header with a clean single header:

```
Loyalty Programs                    [+ Add program]
21 programs · 4 travelers
```

The count line uses `text-sm text-gray-500`. The Add button is the primary action, top right.

### 5. Empty state

If no programs exist:
```
No loyalty programs yet.
Add your frequent flyer and hotel membership numbers
so we can check your bookings automatically.

[+ Add your first program]
```

Centered, with the mascot or Award icon above.

## Files to modify
- `src/components/loyalty/loyalty-vault.tsx` — full rewrite of the card layout and list
- `src/app/(dashboard)/loyalty/page.tsx` — simplify header (remove outer card wrapper)

## Constraints
- TypeScript must compile clean (`npx tsc --noEmit`)
- Keep ALL existing functionality: reveal, copy-to-clipboard, edit modal, delete, preferred toggle, add modal
- Use existing Tailwind classes — no new CSS files
- Responsive: single column mobile, two columns desktop
- Alliance badge can stay if the program has one, shown near the preferred star
- The "Add loyalty program" modal should continue to work as-is
- `traveler_name` field in the add modal should default to the current user's `fullName`

## Commit message
`feat: loyalty page redesign — card layout, traveler tabs, fixed logos`
