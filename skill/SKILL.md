---
name: ubtrippin
description: Manages travel for your user via UBTRIPPIN — reads trips, items, and booking details. Use when the user asks about their trips, upcoming travel, flights, hotels, train bookings, or wants to add a new booking to their travel tracker. Requires a UBTRIPPIN API key from ubtrippin.xyz/settings.
---

# UBTRIPPIN Skill

**UBTRIPPIN** is a personal travel tracker that parses booking confirmation emails and organises them into trips. As an agent, you can read a user's trips and items via REST API, and add new bookings by forwarding confirmation emails on their behalf.

---

## Setup (First Time)

1. Ask your user to visit **ubtrippin.xyz/settings** and generate an API key.
2. The key looks like: `ubt_k1_<40 hex chars>`. Store it securely.
3. Ask for their **registered sender email** — the email address they use to forward bookings (typically their personal inbox). This is their "allowed sender" in UBTRIPPIN.
4. You'll need both to operate: the API key for reads, the email address for adding new bookings.

---

## Authentication

All API calls use a Bearer token:

```
Authorization: Bearer ubt_k1_<your_key>
```

Base URL: `https://www.ubtrippin.xyz`

**Rate limit:** 100 requests/minute per API key. HTTP 429 if exceeded — back off 60 seconds.

---

## API Endpoints

### List All Trips
```
GET /api/v1/trips
Authorization: Bearer <key>
```

Response:
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Tokyo Spring 2026",
      "start_date": "2026-04-01",
      "end_date": "2026-04-14",
      "primary_location": "Tokyo, Japan",
      "travelers": ["Ian Rogers"],
      "notes": null,
      "cover_image_url": "https://...",
      "share_enabled": false,
      "created_at": "2026-02-15T10:00:00Z",
      "updated_at": "2026-02-15T10:00:00Z"
    }
  ],
  "meta": { "count": 1 }
}
```

Ordered by start_date descending (soonest upcoming / most recent first).

---

### Get Trip with All Items
```
GET /api/v1/trips/:id
Authorization: Bearer <key>
```

Response:
```json
{
  "data": {
    "id": "uuid",
    "title": "Tokyo Spring 2026",
    "start_date": "2026-04-01",
    "end_date": "2026-04-14",
    "primary_location": "Tokyo, Japan",
    "travelers": ["Ian Rogers"],
    "items": [
      {
        "id": "uuid",
        "trip_id": "uuid",
        "kind": "flight",
        "provider": "Air France",
        "traveler_names": ["Ian Rogers"],
        "start_ts": "2026-04-01T08:30:00Z",
        "end_ts": "2026-04-01T18:45:00Z",
        "start_date": "2026-04-01",
        "end_date": "2026-04-01",
        "start_location": "Paris CDG",
        "end_location": "Tokyo NRT",
        "summary": "Flight AF276 Paris → Tokyo",
        "details_json": { "flight_number": "AF276", "seat": "12A", "confirmation": "XYZ123" },
        "status": "confirmed",
        "confidence": 0.98,
        "needs_review": false,
        "created_at": "2026-02-15T10:00:00Z",
        "updated_at": "2026-02-15T10:00:00Z"
      }
    ]
  },
  "meta": { "item_count": 1 }
}
```

**Item kinds:** `flight`, `hotel`, `train`, `car`, `ferry`, `activity`, `other`

---

### Get Single Item
```
GET /api/v1/items/:id
Authorization: Bearer <key>
```

Response: `{ "data": <item> }` — same Item shape as above.

---

## Adding New Bookings (Email Forwarding)

The primary way to add bookings is **email forwarding**. When your user receives a booking confirmation:

1. Forward the email to: **trips@ubtrippin.xyz**
2. **Must forward from their registered sender address** — UBTRIPPIN rejects unknown senders.
3. UBTRIPPIN's AI parser extracts the booking details automatically (usually within 30 seconds).
4. The item appears in the relevant trip (or a new trip is created).

**How to do this as an agent:**
- Use your email sending capability to forward the email from the user's address to trips@ubtrippin.xyz.
- Or instruct the user to do it manually from their inbox.
- PDF attachments (e.g. eTickets) are supported — include them in the forward.

**Works with:** flights, hotels, trains (Eurostar, SNCF, Thalys, etc.), rental cars, ferry bookings, and most major booking platforms (Booking.com, Expedia, Kayak, Trainline, etc.).

---

## Typical Agent Workflows

### "What trips do I have coming up?"
1. `GET /api/v1/trips`
2. Filter by start_date >= today
3. Format and present

### "What's my itinerary for Tokyo?"
1. `GET /api/v1/trips` — find the Tokyo trip ID
2. `GET /api/v1/trips/:id` — get full itinerary with all items
3. Format chronologically by start_ts

### "I just booked a hotel in Tokyo — add it"
1. Ask the user to forward the confirmation email from their registered address to trips@ubtrippin.xyz
2. Or if you have email access: forward it yourself
3. Wait ~30 seconds, then `GET /api/v1/trips/:id` to confirm it appeared

### "Get me a calendar file for my Tokyo trip"
- The `.ics` calendar download is available at `ubtrippin.xyz/trips/:id` (requires the user to be logged in)
- Direct them to the web UI, or use the share link if sharing is enabled

---

## Error Handling

| Status | Code | Meaning |
|--------|------|---------|
| 401 | `unauthorized` | Missing/invalid API key |
| 400 | `invalid_param` | Bad UUID or missing field |
| 404 | `not_found` | Trip/item not found or belongs to another user |
| 429 | _(body varies)_ | Rate limited — wait 60s |
| 500 | `internal_error` | Server error — retry once |

All errors return: `{ "error": { "code": "...", "message": "..." } }`

---

## Notes for Agents

- All IDs are UUIDs.
- Dates are ISO 8601 (`YYYY-MM-DD` for dates, `YYYY-MM-DDTHH:MM:SSZ` for timestamps).
- `details_json` contains raw parsed data — useful for confirmation numbers, seat assignments, loyalty numbers, etc.
- `confidence` (0–1): how confident the AI parser was. Items with `needs_review: true` may have errors.
- API keys are read-only — you cannot create, edit, or delete trips/items via the API (v1). Use email forwarding to add bookings.
- The API key is the user's — never share it, log it, or store it beyond the session unless the user explicitly asks.

---

## Managing API Keys

Users manage keys at **ubtrippin.xyz/settings**. Each key has a name and a masked preview. If a key is compromised, the user can revoke it from the settings page and generate a new one.
