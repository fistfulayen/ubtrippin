import { NextResponse } from 'next/server'

const DOCS = `# UB Trippin API Reference (v1)

Base URL: \`https://www.ubtrippin.xyz\`

## Quick Start

**For OpenClaw agents:**
\`\`\`bash
clawhub install ubtrippin
\`\`\`
This installs the full skill with all endpoints and agent workflows documented.

**For MCP clients (Claude Desktop, Cursor):**
\`\`\`json
{
  "mcpServers": {
    "ubtrippin": {
      "command": "npx",
      "args": ["ubtrippin-mcp"],
      "env": { "UBT_API_KEY": "ubt_k1_..." }
    }
  }
}
\`\`\`

**For any agent with HTTP access:** Use the REST API below.

---

## Authentication

All endpoints (unless noted) require a Bearer token:

\`\`\`
Authorization: Bearer ubt_k1_<your_key>
\`\`\`

Generate keys at [ubtrippin.xyz/settings](https://www.ubtrippin.xyz/settings).

Rate limit: 100 req/min per key. HTTP 429 → back off 60s.

---

## Trips

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/trips | List all trips (query: ?status=upcoming) |
| POST | /api/v1/trips | Create a trip |
| GET | /api/v1/trips/:id | Get trip with all items |
| PATCH | /api/v1/trips/:id | Update trip |
| DELETE | /api/v1/trips/:id | Delete trip |
| POST | /api/v1/trips/:id/rename | Rename trip |
| POST | /api/v1/trips/:id/merge | Merge another trip into this one |
| GET | /api/v1/trips/:id/status | Trip processing status |
| GET | /api/v1/trips/demo | Demo trip (no auth) |

### Example: List Trips

\`\`\`
GET /api/v1/trips
Authorization: Bearer ubt_k1_abc123...

200 OK
{
  "data": [
    { "id": "uuid", "title": "Tokyo Spring 2026", "start_date": "2026-04-01", "end_date": "2026-04-14", "primary_location": "Tokyo, Japan" }
  ],
  "meta": { "count": 1 }
}
\`\`\`

### Example: Create Trip

\`\`\`
POST /api/v1/trips
Content-Type: application/json
Authorization: Bearer ubt_k1_abc123...

{ "title": "Summer in Provence", "start_date": "2026-07-01", "end_date": "2026-07-14" }

201 Created
{ "data": { "id": "new-uuid", "title": "Summer in Provence", ... } }
\`\`\`

---

## Items

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/items/:id | Get single item |
| PATCH | /api/v1/items/:id | Update item |
| DELETE | /api/v1/items/:id | Delete item |
| GET | /api/v1/items/:id/status | Item status |
| POST | /api/v1/items/:id/status/refresh | Refresh live status |
| POST | /api/v1/trips/:id/items | Add item to trip |
| POST | /api/v1/trips/:id/items/batch | Batch add items (up to 50) |

### Item Schema

**Required:** \`kind\` + \`start_date\`

| Field | Type | Notes |
|-------|------|-------|
| kind | string | \`flight\`, \`hotel\`, \`car_rental\`, \`train\`, \`activity\`, \`restaurant\`, \`other\` |
| start_date | string | YYYY-MM-DD (required) |
| end_date | string | YYYY-MM-DD |
| start_ts | string | ISO 8601 with timezone, e.g. \`2026-04-01T08:30:00+01:00\` |
| end_ts | string | ISO 8601 with timezone |
| start_location | string | Origin / check-in location (max 300 chars) |
| end_location | string | Destination / check-out location (max 300 chars) |
| summary | string | One-line description (max 1000 chars) |
| provider | string | Airline, hotel chain, etc. (max 200 chars) |
| confirmation_code | string | Booking reference (max 200 chars) |
| traveler_names | string[] | Up to 20 names, each max 200 chars |
| details_json | object | Freeform metadata — seat, gate, room type, etc. (max 10KB) |
| notes | string | User notes |

### Example: Add a Flight

\`\`\`
POST /api/v1/trips/:id/items
Authorization: Bearer ubt_k1_abc123...
Content-Type: application/json

{
  "kind": "flight",
  "start_date": "2026-04-01",
  "start_ts": "2026-04-01T08:30:00+01:00",
  "end_ts": "2026-04-01T15:45:00+09:00",
  "start_location": "Paris CDG",
  "end_location": "Tokyo NRT",
  "summary": "AF276 CDG→NRT",
  "provider": "Air France",
  "confirmation_code": "XK7J3M",
  "traveler_names": ["Ian Rogers"],
  "details_json": { "flight_number": "AF276", "seat": "14A", "class": "Economy" }
}

201 Created
{ "data": { "id": "uuid", "kind": "flight", ... } }
\`\`\`

### Example: Add a Hotel

\`\`\`
POST /api/v1/trips/:id/items
Authorization: Bearer ubt_k1_abc123...
Content-Type: application/json

{
  "kind": "hotel",
  "start_date": "2026-04-01",
  "end_date": "2026-04-05",
  "start_location": "Tokyo, Japan",
  "summary": "Park Hyatt Tokyo",
  "provider": "Hyatt",
  "confirmation_code": "HY-889923",
  "traveler_names": ["Ian Rogers", "Hedvig Rogers"],
  "details_json": { "room_type": "King Deluxe", "check_in": "15:00", "check_out": "11:00" }
}
\`\`\`

### Example: Batch Add

\`\`\`
POST /api/v1/trips/:id/items/batch
Authorization: Bearer ubt_k1_abc123...
Content-Type: application/json

{ "items": [
  { "kind": "flight", "start_date": "2026-04-01", "summary": "AF276 CDG→NRT", "provider": "Air France" },
  { "kind": "hotel", "start_date": "2026-04-01", "end_date": "2026-04-05", "summary": "Park Hyatt Tokyo" }
]}

201 Created
{ "data": [...], "meta": { "count": 2 } }
\`\`\`

> **Agent tip:** Parse booking confirmations yourself and POST structured items. You handle extraction; UBTRIPPIN handles storage, grouping, and display.

---

## Loyalty Vault

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/me/loyalty | List my loyalty programs |
| POST | /api/v1/me/loyalty | Add loyalty program |
| GET | /api/v1/me/loyalty/lookup?provider_key=X | Lookup by provider |
| GET | /api/v1/me/loyalty/export | Export all loyalty data |
| PATCH | /api/v1/me/loyalty/:id | Update loyalty program |
| DELETE | /api/v1/me/loyalty/:id | Delete loyalty program |
| GET | /api/v1/loyalty/providers | List known providers (no auth) |

### Example: Lookup Loyalty Number

\`\`\`
GET /api/v1/me/loyalty/lookup?provider_key=delta_skymiles
Authorization: Bearer ubt_k1_abc123...

200 OK
{ "data": { "provider_key": "delta_skymiles", "member_number": "1234567890", "tier": "Gold" } }
\`\`\`

---

## Profile

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/me/profile | Get my profile |
| PUT | /api/v1/me/profile | Update my profile |
| POST | /api/v1/me/profile | Update my profile (alias) |

---

## Family

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/families | List my families |
| POST | /api/v1/families | Create family |
| GET | /api/v1/families/:id | Get family |
| PATCH | /api/v1/families/:id | Update family |
| DELETE | /api/v1/families/:id | Delete family |
| POST | /api/v1/families/:id/members | Invite member |
| DELETE | /api/v1/families/:id/members/:uid | Remove member |
| GET | /api/v1/families/:id/profiles | Member profiles |
| GET | /api/v1/families/:id/trips | Family trips |
| GET | /api/v1/families/:id/loyalty | Family loyalty programs |
| GET | /api/v1/families/:id/loyalty/lookup?provider_key=X | Family loyalty lookup |
| GET | /api/v1/families/:id/guides | Family city guides |
| GET | /api/v1/family-invites/:token | View family invite |
| POST | /api/v1/family-invites/:token/accept | Accept family invite |

---

## Collaborators (Trip Sharing)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/trips/:id/collaborators | List collaborators |
| POST | /api/v1/trips/:id/collaborators | Invite collaborator |
| PATCH | /api/v1/trips/:id/collaborators/:uid | Update role |
| DELETE | /api/v1/trips/:id/collaborators/:uid | Remove collaborator |
| GET | /api/v1/invites/:token | View trip invite |
| POST | /api/v1/invites/:token/accept | Accept trip invite |

---

## City Guides

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/guides | List guides |
| POST | /api/v1/guides | Create guide |
| GET | /api/v1/guides/:id | Get guide |
| PATCH | /api/v1/guides/:id | Update guide |
| DELETE | /api/v1/guides/:id | Delete guide |
| GET | /api/v1/guides/:id/entries | List entries |
| POST | /api/v1/guides/:id/entries | Add entry |
| PATCH | /api/v1/guides/:id/entries/:eid | Update entry |
| DELETE | /api/v1/guides/:id/entries/:eid | Delete entry |
| GET | /api/v1/guides/nearby?lat=X&lng=Y | Nearby guides |

---

## Senders

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/settings/senders | List allowed senders |
| POST | /api/v1/settings/senders | Add sender |
| DELETE | /api/v1/settings/senders/:id | Remove sender |

---

## Calendar

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/calendar/token | Get iCal subscription URL |
| POST | /api/v1/calendar/token | Regenerate token |

---

## Notifications

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/notifications | List notifications (?unread=true) |
| PATCH | /api/v1/notifications/:id | Mark read |

---

## Webhooks

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/webhooks | List webhooks |
| POST | /api/v1/webhooks | Create webhook |
| GET | /api/v1/webhooks/:id | Get webhook |
| PATCH | /api/v1/webhooks/:id | Update webhook |
| DELETE | /api/v1/webhooks/:id | Delete webhook |
| POST | /api/v1/webhooks/:id/test | Test webhook |
| GET | /api/v1/webhooks/:id/deliveries | List deliveries |

---

## Trains

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/trains/:trainNumber/status | Real-time train status |

---

## Images

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/images/search?q=X | Search destination images |

---

## Imports

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/imports | List imports |
| POST | /api/v1/imports | Create import |
| GET | /api/v1/imports/:id | Get import |

---

## Billing

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/billing/subscription | Current subscription |
| GET | /api/v1/billing/portal | Stripe billing portal URL |
| GET | /api/v1/billing/prices | Available plans/pricing |
| POST | /api/v1/checkout | Create checkout session |

---

## Activation

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/activation/status | Account activation status |

---

## Common Agent Workflows

1. **Get upcoming trips:** \`GET /api/v1/trips\` → filter by start_date >= today
2. **Full itinerary:** \`GET /api/v1/trips/:id\` → items sorted by start_ts
3. **Loyalty lookup:** \`GET /api/v1/me/loyalty/lookup?provider_key=delta_skymiles\`
4. **Add booking:** Forward confirmation email to trips@ubtrippin.xyz from registered sender
5. **Family loyalty:** \`GET /api/v1/families/:id/loyalty/lookup?provider_key=X\`
6. **Share trip:** \`POST /api/v1/trips/:id/collaborators\` with email + role
7. **Train status:** \`GET /api/v1/trains/:number/status\`
8. **Calendar sync:** \`GET /api/v1/calendar/token\` → iCal URL

---

## Error Codes

| Status | Code | Meaning |
|--------|------|---------|
| 400 | invalid_param | Bad input or missing field |
| 401 | unauthorized | Missing/invalid API key |
| 404 | not_found | Resource not found or access denied |
| 429 | — | Rate limited (wait 60s) |
| 500 | internal_error | Server error (retry once) |

All errors: \`{ "error": { "code": "...", "message": "..." } }\`

---

## Notes

- All IDs are UUIDs
- Dates: ISO 8601 (YYYY-MM-DD or YYYY-MM-DDTHH:MM:SSZ)
- \`details_json\` on items contains parsed booking data (confirmation #, seats, etc.)
- \`confidence\` (0-1) indicates parser confidence; \`needs_review: true\` = may have errors
`

export async function GET() {
  return new NextResponse(DOCS, {
    status: 200,
    headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
  })
}
