# Build: Cross-Trip Item Search API + CLI

## Problem
When a user asks "what's my flight tomorrow?", the only way to find it is to list all trips and then fetch items for each one. The `GET /api/v1/trips` endpoint only returns trip-level `start_date`/`end_date`, not individual item dates. There's no way to search items across all trips by date or kind.

## What to Build

### 1. New API Endpoint: `GET /api/v1/items`

Create `src/app/api/v1/items/route.ts` with a GET handler that searches across ALL of the authenticated user's trips.

**Query Parameters:**
- `date` — Filter items where `start_date <= date AND end_date >= date` (items active on this date)
- `from` / `to` — Date range filter: `start_date <= to AND end_date >= from`
- `kind` — Filter by item kind (e.g., `flight`, `hotel`, `train`, `activity`, `car_rental`)
- `limit` — Max results (default 50, max 200)
- `offset` — Pagination offset

If no date filters are provided, return items from all trips (ordered by start_date ascending).

**Response shape:**
```json
{
  "data": [
    {
      "id": "...",
      "trip_id": "...",
      "trip_title": "...",
      "kind": "flight",
      "provider": "Spirit Airlines",
      "summary": "Spirit Airlines flight 457 from Newark to Austin",
      "start_date": "2026-03-13",
      "end_date": "2026-03-13",
      "start_ts": "...",
      "end_ts": "...",
      "start_location": "EWR",
      "end_location": "AUS",
      "details_json": { ... },
      "status": "...",
      "created_at": "...",
      "updated_at": "..."
    }
  ],
  "meta": { "count": 1, "limit": 50, "offset": 0 }
}
```

**Important implementation details:**
- Use `validateApiKey` + `rateLimitResponse` from `@/lib/api/auth` and `@/lib/api/rate-limit`
- Use `createUserScopedClient` from `@/lib/supabase/user-scoped`
- Query owned trips AND shared trips (via trip_collaborators with accepted_at NOT NULL)
- Join trip_items with trips to get `trip_title`
- Use `sanitizeItem` from `@/lib/api/sanitize` on each item
- Follow the exact patterns in `src/app/api/v1/trips/route.ts` for auth/error handling
- Do NOT use createSecretClient() or service role to bypass RLS. Fix RLS policies instead if needed.

### 2. Update CLI: `ubt items search`

Add a new CLI command in `cli/ubt`:

```
ubt items search [--date YYYY-MM-DD] [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--kind flight|hotel|train|...] [--limit N]
```

This should call `GET /api/v1/items` with the appropriate query params.

The formatted output should show:
```
  <item_id>  flight     Spirit Airlines      2026-03-13  21:00  EWR → AUS
             Trip: Paris → Miami → Austin → Portland → Charleston
```

Also add to the help text at the top of the CLI file.

### 3. Update Skill Documentation

Update `skill/SKILL.md` to document the new endpoint under the Items section.

## Files to Modify
- `src/app/api/v1/items/route.ts` — CREATE new file with GET handler
- `cli/ubt` — Add `items search` command + help text
- `skill/SKILL.md` — Document the new endpoint

## Files to Reference (read these first)
- `src/app/api/v1/trips/route.ts` — Pattern for auth, shared trips, error handling
- `src/app/api/v1/items/[id]/route.ts` — Existing item endpoint patterns
- `src/app/api/v1/trips/[id]/items/route.ts` — Item select columns, sanitization
- `cli/ubt` — CLI structure, command patterns, formatting functions
- `src/lib/api/auth.ts` — Auth helpers
- `src/lib/api/sanitize.ts` — Sanitization helpers

## Testing
After building, verify with:
```bash
FORMAT=json cli/ubt items search --date 2026-03-13 --kind flight
```

This should return flight items for that date across all trips.

## Do NOT
- Do NOT use createSecretClient() or service role to bypass RLS
- Do NOT modify existing endpoints
- Do NOT change the database schema
- This code will be security-audited monthly
