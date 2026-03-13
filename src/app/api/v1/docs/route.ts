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
      "args": ["-y", "ubtrippin-mcp"],
      "env": { "UBT_API_KEY": "ubt_k1_..." }
    }
  }
}
\`\`\`

**CLI:**
\`\`\`bash
npm install -g ubtrippin-cli   # or clone the repo and use cli/ubt directly
ubt login                     # authenticate with your API key
ubt trips list                # you're in
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
| GET | /api/v1/trips/:id/weather | Weather forecast + packing suggestions (PRO) |
| POST | /api/v1/trips/:id/weather | Force-refresh weather data |
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
| GET | /api/v1/items | Search items across all trips |
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
| kind | string | \`flight\`, \`hotel\`, \`car_rental\`, \`train\`, \`activity\`, \`restaurant\`, \`ticket\`, \`other\` |
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

### Search Items Across Trips

\`\`\`
GET /api/v1/items?date=2026-04-01&kind=flight
Authorization: Bearer ubt_k1_abc123...

200 OK
{
  "data": [
    { "id": "uuid", "trip_id": "uuid", "kind": "flight", "summary": "AF276 CDG→NRT", "start_date": "2026-04-01", "trip_title": "Tokyo Trip", ... }
  ],
  "meta": { "count": 1, "limit": 50, "offset": 0 }
}
\`\`\`

**Query parameters:**
- \`date\` — Items active on this date (YYYY-MM-DD)
- \`from\` / \`to\` — Date range (cannot combine with \`date\`)
- \`kind\` — Filter by item kind (flight, hotel, train, etc.)
- \`limit\` — Results per page (1–200, default 50)
- \`offset\` — Pagination offset (default 0)

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

### Example: Add a Concert/Event Ticket

\`\`\`
POST /api/v1/trips/:id/items
Authorization: Bearer ubt_k1_abc123...
Content-Type: application/json

{
  "kind": "ticket",
  "start_date": "2026-03-18",
  "start_ts": "2026-03-18T20:00:00+01:00",
  "start_location": "Salle Pleyel, Paris",
  "summary": "David Byrne concert — 2 tickets",
  "provider": "Ticketmaster",
  "confirmation_code": "TM-29384756",
  "traveler_names": ["Ian Rogers", "Hedvig Rogers"],
  "details_json": {
    "event_name": "AN EVENING WITH DAVID BYRNE",
    "venue_name": "Salle Pleyel",
    "venue_address": "252 Rue du Faubourg Saint-Honoré, 75008 Paris",
    "performer": "David Byrne",
    "section": "Orchestre",
    "row": "G",
    "seat": "12",
    "ticket_count": 2,
    "ticket_type": "Reserved",
    "door_time": "19:00",
    "apple_wallet_url": "https://wallet.apple.com/...",
    "google_wallet_url": "https://pay.google.com/gp/v/save/..."
  }
}

201 Created
{ "data": { "id": "uuid", "kind": "ticket", ... } }
\`\`\`

**Ticket-specific fields in \`details_json\`:**

| Field | Type | Description |
|-------|------|-------------|
| event_name | string | Full event title |
| venue_name | string | Venue name |
| venue_address | string | Full venue address |
| performer | string | Artist / show name |
| section | string | Seating section |
| row | string | Row identifier |
| seat | string | Seat number |
| ticket_count | number | Number of tickets |
| ticket_type | string | GA, Reserved, VIP, etc. |
| door_time | string | Door open time (HH:MM) |
| apple_wallet_url | string | Apple Wallet pass link |
| google_wallet_url | string | Google Wallet save link |

> **Supported ticket providers:** Ticketmaster, AXS, Eventbrite, Dice, SeeTickets, StubHub, Viagogo, and venue direct sales.

---

## Events & Ticket PDFs

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/trips/:id/items/:itemId/ticket-pdf | Download stored ticket PDF |

Ticket PDFs are automatically stored when a booking email contains a PDF attachment (boarding pass, event ticket, booking confirmation). Access is restricted to the trip owner.

\`\`\`
GET /api/v1/trips/:id/items/:itemId/ticket-pdf?redirect=1
Authorization: Bearer ubt_k1_abc123...

302 → Signed Supabase Storage URL (valid 60 minutes)
\`\`\`

---

## Weather & Packing (Pro)

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/trips/:id/weather | Weather forecast + AI packing suggestions |
| POST | /api/v1/trips/:id/weather | Force-refresh weather data |

Returns weather forecasts for all trip destinations within the 16-day forecast window (Open-Meteo). PRO subscribers also get AI-generated packing suggestions.

\`\`\`
GET /api/v1/trips/:id/weather?unit=celsius
Authorization: Bearer ubt_k1_abc123...

{
  "trip_id": "uuid",
  "temp_range": { "min": 32, "max": 84, "unit": "°C" },
  "destinations": [
    {
      "city": "Paris",
      "dates": { "start": "2026-03-15", "end": "2026-03-18" },
      "daily": [
        { "date": "2026-03-15", "temp_high": 12, "temp_low": 5, "weather_description": "Partly cloudy", ... }
      ]
    }
  ],
  "packing": {
    "essentials": ["Passport", "Phone charger"],
    "clothing": [{ "item": "Light layers for Paris", "reason": "12°C means your jacket is doing overtime." }],
    "tip": "Paris in March: dress like an onion. Layers are your friend."
  }
}
\`\`\`

Query params: \`unit=fahrenheit|celsius\` (defaults to user preference). POST triggers a refresh (rate-limited to once per minute).

---

## Live Status (Pro)

Real-time flight and train status tracking. Status is checked automatically for upcoming trips:
- 48-24h before departure → every 8 hours
- 24-4h before → every 2 hours
- 4-0h before → every 30 minutes
- After departure → every 15 minutes

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/items/:id/status | Get current status (gate, delay, terminal, etc.) |
| POST | /api/v1/items/:id/status/refresh | Force a status refresh |

### Example: Get Flight Status

\`\`\`
GET /api/v1/items/:id/status
Authorization: Bearer ubt_k1_abc123...

200 OK
{
  "data": {
    "status": "on_time",
    "departure_gate": "A42",
    "departure_terminal": "2E",
    "arrival_terminal": "1",
    "departure_delay_minutes": 0,
    "arrival_delay_minutes": 0,
    "aircraft_type": "A320",
    "last_checked_at": "2026-03-06T08:15:00Z",
    "source": "flightaware"
  }
}
\`\`\`

**Flight status fields:**

| Field | Type | Description |
|-------|------|-------------|
| status | string | \`scheduled\`, \`on_time\`, \`delayed\`, \`cancelled\`, \`landed\`, \`diverted\` |
| departure_gate | string | Gate number |
| departure_terminal | string | Terminal |
| arrival_terminal | string | Arrival terminal |
| departure_delay_minutes | number | Delay in minutes (0 = on time) |
| arrival_delay_minutes | number | Arrival delay |
| aircraft_type | string | Aircraft model |
| baggage_claim | string | Baggage carousel |
| last_checked_at | string | ISO timestamp of last status check |
| source | string | \`flightaware\` or \`sncf\` |

> **Powered by FlightAware AeroAPI** for flights and **SNCF real-time API** for French trains.

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

## Referrals

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/referral | Get my referral code and referral stats |

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

## Live Flight Status (Public)

Track any flight in real-time. No auth required. Designed for sharing.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/flights/:ident/:date/live | Live flight status with gate, terminal, delay, aircraft type |

### Parameters

| Param | Type | Description |
|-------|------|-------------|
| ident | string | IATA flight identifier, e.g. \`NK2893\`, \`B0301\` |
| date | string | Flight date: \`YYYY-MM-DD\` |

### Response

Returns origin/destination with IATA codes, local timezone, gate, terminal, scheduled/estimated/actual times, delay minutes, aircraft type, and status. Times are UTC — use the included \`timezone\` fields to convert to local airport time.

Rate limit: 60 requests/minute per IP. Data cached for 5 minutes.

---

## City Events & Exhibitions (Public)

Discover curated events, exhibitions, festivals, and performances by city. No auth required.

| Method | Path | Description |
|--------|------|-------------|
| GET | /api/v1/events | Get events for a city (public, no auth) |
| POST | /api/v1/events/refresh | Trigger pipeline refresh for a city (admin only) |

### Query Parameters

| Param | Type | Required | Description |
|-------|------|----------|-------------|
| city | string | ✅ | City slug, e.g. \`paris\`, \`new-york\`, \`tokyo\` |
| from | string | — | Start date filter: YYYY-MM-DD |
| to | string | — | End date filter: YYYY-MM-DD |
| tier | string | — | \`major\`, \`medium\`, or \`local\` |
| category | string | — | \`art\`, \`music\`, \`theater\`, \`food\`, \`festival\`, \`sports\`, \`architecture\`, \`sacred\`, \`market\`, \`other\` |

### Example

\`\`\`
GET /api/v1/events?city=paris&from=2026-04-01&to=2026-04-07

200 OK
{
  "city": { "slug": "paris", "name": "Paris", "country": "France" },
  "events": [
    {
      "id": "uuid",
      "title": "Monet at Musée d'Orsay",
      "tier": "major",
      "category": "art",
      "venue": "Musée d'Orsay",
      "start_date": "2026-03-01",
      "end_date": "2026-06-30",
      "description": "A major retrospective of Monet's water lily series."
    }
  ],
  "segments": [{ "label": "Major Events", "events": [...] }]
}
\`\`\`

Rate limit: 10 req/min per IP (no auth required).

### POST /api/v1/events/refresh (Admin Only)

Triggers an asynchronous event re-discovery run for a given city. Returns 202 immediately; pipeline runs in background.

\`\`\`
POST /api/v1/events/refresh
Authorization: Bearer ubt_k1_abc123...
Content-Type: application/json

{ "citySlug": "paris" }

202 Accepted
{ "ok": true, "queued": true, "citySlug": "paris" }
\`\`\`

**Errors:** 400 (invalid slug), 403 (not in admin allowlist), 500 (misconfigured / launch failed).

Admin allowlist is set via the \`EVENT_PIPELINE_ADMIN_EMAILS\` environment variable (comma-separated).

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
9. **Flight status:** \`GET /api/v1/items/:id/status\` → gate, delay, terminal
10. **Upcoming events:** \`GET /api/v1/trips\` → filter items where kind = "ticket"
11. **City events & exhibitions:** \`GET /api/v1/events?city=paris&from=2026-04-01\` (no auth)
11. **Download ticket PDF:** \`GET /api/v1/trips/:id/items/:itemId/ticket-pdf\`

---

## CLI Reference

The \`ubt\` CLI wraps the REST API for terminal and agent use.

### Setup

\`\`\`bash
ubt login          # prompts for API key, saves to ~/.ubt/config
ubt whoami         # verify authentication
ubt selftest       # test API connectivity
\`\`\`

### Core Commands

| Command | Description |
|---------|-------------|
| \`ubt trips list\` | List all trips (owned + shared) |
| \`ubt trips show <id>\` | Show trip details + items |
| \`ubt trips search <query>\` | Search by title/location |
| \`ubt trips create <title> --start Y-M-D --end Y-M-D\` | Create a trip |
| \`ubt trips status <id>\` | Live statuses for trip flights/trains |
| \`ubt items search --date Y-M-D --kind flight\` | Search items across all trips |
| \`ubt items add <trip_id> --kind flight --summary "AF276 CDG→NRT" --start-ts ...\` | Add item to trip |
| \`ubt items status <id>\` | Live status for a single item |
| \`ubt items refresh <id>\` | Force-refresh live status |
| \`ubt tickets list\` | List all tickets/events |
| \`ubt guides list\` | List city guides |
| \`ubt guides create <city> --country X\` | Create guide |
| \`ubt guides entry add <id> --name X --category X\` | Add guide entry |
| \`ubt trains status <number>\` | Real-time train status |
| \`ubt profile show\` | Show profile + loyalty vault |
| \`ubt profile loyalty lookup <provider>\` | Lookup loyalty by provider |
| \`ubt family list\` | List families |
| \`ubt family loyalty lookup <id> <provider>\` | Family loyalty lookup |
| \`ubt billing show\` | Current subscription |
| \`ubt calendar get\` | iCal feed URL |
| \`ubt collab list <trip_id>\` | List trip collaborators |
| \`ubt collab invite <trip_id> <email> [role]\` | Invite collaborator |
| \`ubt activation status\` | Account activation status |
| \`ubt image search <query>\` | Search cover images |
| \`ubt webhooks list\` | List registered webhooks |
| \`ubt senders list\` | List allowed email senders |
| \`ubt notifications list --unread\` | Unread notifications |

### Options

- \`FORMAT=json ubt ...\` — raw JSON output (for scripts/agents)
- \`UBT_API_URL=...\` — override API base URL

Full command list: \`ubt help\`

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
