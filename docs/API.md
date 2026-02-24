# UB Trippin REST API v1

The UB Trippin API is how your agent reads your travel data. Clean JSON, Bearer token auth, sensible errors. No browser required.

**Base URL:** `https://www.ubtrippin.xyz/api/v1`

---

## Authentication

All endpoints require a Bearer token in the `Authorization` header.

```
Authorization: Bearer ubt_your_key_here
```

### Getting an API Key

1. Sign in to [ubtrippin.xyz](https://www.ubtrippin.xyz)
2. Go to **Settings → API Keys**
3. Click **New Key**, give it a name (e.g. "Claude", "My Agent", "Home Automation")
4. Copy the key — **it's shown exactly once**

API keys are stored as SHA-256 hashes. The plaintext is never persisted anywhere. If you lose it, delete it and create a new one.

Keys are **user-scoped** — they can only read data belonging to your account. There is no cross-user access.

---

## Rate Limits

**100 requests per minute** per API key.

Every response (including 429s) includes these headers:

| Header | Value |
|---|---|
| `X-RateLimit-Limit` | `100` |
| `X-RateLimit-Remaining` | Requests left in the current window |
| `X-RateLimit-Reset` | Unix timestamp (seconds) when the window resets |

When you're rate-limited, you also get:

| Header | Value |
|---|---|
| `Retry-After` | Seconds until you can retry |

**Note:** The rate limiter is in-process (not Redis-backed). In the current hosted deployment this is single-instance, so counts are accurate. If you're self-hosting behind a load balancer with multiple instances, you'll want to swap in Upstash or similar.

---

## Endpoints

### `GET /api/v1/trips`

List all trips for the authenticated user, ordered by `start_date` descending (most recent / soonest upcoming first).

#### Request

```bash
curl https://www.ubtrippin.xyz/api/v1/trips \
  -H "Authorization: Bearer ubt_your_key_here"
```

#### Response

```json
{
  "data": [
    {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Japan Spring 2026",
      "start_date": "2026-04-01",
      "end_date": "2026-04-15",
      "primary_location": "Tokyo, Japan",
      "travelers": ["Alice", "Bob"],
      "notes": "Cherry blossom season. Book restaurants early.",
      "cover_image_url": "https://cdn.ubtrippin.xyz/covers/a1b2c3d4.jpg",
      "share_enabled": false,
      "created_at": "2026-02-10T14:23:11Z",
      "updated_at": "2026-02-10T14:23:11Z"
    },
    {
      "id": "b2c3d4e5-f6a7-8901-bcde-f12345678901",
      "title": "Berlin Tech Week",
      "start_date": "2026-03-10",
      "end_date": "2026-03-14",
      "primary_location": "Berlin, Germany",
      "travelers": ["Alice"],
      "notes": null,
      "cover_image_url": null,
      "share_enabled": true,
      "created_at": "2026-01-28T09:14:05Z",
      "updated_at": "2026-01-28T09:14:05Z"
    }
  ],
  "meta": {
    "count": 2
  }
}
```

#### Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique trip identifier |
| `title` | string | Trip name (AI-generated or user-edited) |
| `start_date` | string (YYYY-MM-DD) | Trip start date |
| `end_date` | string (YYYY-MM-DD) | Trip end date |
| `primary_location` | string | Main destination |
| `travelers` | string[] | Traveler names (first names only on share pages) |
| `notes` | string \| null | Free-text notes |
| `cover_image_url` | string \| null | Cover photo URL |
| `share_enabled` | boolean | Whether the trip has a public share link |
| `created_at` | string (ISO 8601) | Record creation timestamp |
| `updated_at` | string (ISO 8601) | Last updated timestamp |

---

### `GET /api/v1/trips/:id`

Fetch a single trip with its full item list.

#### Request

```bash
curl https://www.ubtrippin.xyz/api/v1/trips/a1b2c3d4-e5f6-7890-abcd-ef1234567890 \
  -H "Authorization: Bearer ubt_your_key_here"
```

#### Response

```json
{
  "data": {
    "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "title": "Japan Spring 2026",
    "start_date": "2026-04-01",
    "end_date": "2026-04-15",
    "primary_location": "Tokyo, Japan",
    "travelers": ["Alice", "Bob"],
    "notes": "Cherry blossom season. Book restaurants early.",
    "cover_image_url": "https://cdn.ubtrippin.xyz/covers/a1b2c3d4.jpg",
    "share_enabled": false,
    "created_at": "2026-02-10T14:23:11Z",
    "updated_at": "2026-02-10T14:23:11Z",
    "items": [
      {
        "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
        "trip_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "kind": "flight",
        "provider": "Japan Airlines",
        "traveler_names": ["Alice", "Bob"],
        "start_ts": "2026-04-01T10:30:00Z",
        "end_ts": "2026-04-02T06:15:00Z",
        "start_date": "2026-04-01",
        "end_date": "2026-04-02",
        "start_location": "Los Angeles (LAX)",
        "end_location": "Tokyo Narita (NRT)",
        "summary": "JAL 61 · LAX → NRT · 11h 45m",
        "details_json": {
          "flight_number": "JL 061",
          "cabin_class": "Economy",
          "seat": "34A, 34B",
          "terminal": "B",
          "gate": null,
          "meal": "Included",
          "baggage": "2 × 23kg"
        },
        "status": "confirmed",
        "confidence": 0.97,
        "needs_review": false,
        "created_at": "2026-02-10T14:23:15Z",
        "updated_at": "2026-02-10T14:23:15Z"
      },
      {
        "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
        "trip_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
        "kind": "hotel",
        "provider": "Park Hyatt Tokyo",
        "traveler_names": ["Alice", "Bob"],
        "start_ts": null,
        "end_ts": null,
        "start_date": "2026-04-02",
        "end_date": "2026-04-08",
        "start_location": "Shinjuku, Tokyo",
        "end_location": null,
        "summary": "Park Hyatt Tokyo · 6 nights · Check-in Apr 2",
        "details_json": {
          "room_type": "Park King",
          "nights": 6,
          "guests": 2,
          "breakfast_included": false,
          "cancellation_policy": "Free cancellation until 72h before check-in"
        },
        "status": "confirmed",
        "confidence": 0.99,
        "needs_review": false,
        "created_at": "2026-02-10T14:23:17Z",
        "updated_at": "2026-02-10T14:23:17Z"
      }
    ]
  },
  "meta": {
    "item_count": 2
  }
}
```

#### Item Fields

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Unique item identifier |
| `trip_id` | UUID | Parent trip |
| `kind` | string | Item type (see below) |
| `provider` | string \| null | Airline, hotel, car company, etc. |
| `traveler_names` | string[] | Names of travelers on this item |
| `start_ts` | string \| null | Start datetime (ISO 8601, UTC) |
| `end_ts` | string \| null | End datetime (ISO 8601, UTC) |
| `start_date` | string | Start date (YYYY-MM-DD) |
| `end_date` | string \| null | End date (YYYY-MM-DD) |
| `start_location` | string \| null | Departure/checkin location |
| `end_location` | string \| null | Arrival/checkout location |
| `summary` | string | Human-readable one-liner |
| `details_json` | object \| null | Type-specific structured data (see below) |
| `status` | string | `confirmed`, `pending`, `cancelled` |
| `confidence` | number | AI extraction confidence (0–1) |
| `needs_review` | boolean | Flagged for user review if extraction was uncertain |
| `created_at` | string | Record creation timestamp |
| `updated_at` | string | Last updated timestamp |

**Note:** `confirmation_code`, `booking_reference`, and `source_email_id` are never returned by the API. They're stored internally but stripped before any response leaves the server.

#### Item Kinds

| Kind | Description |
|---|---|
| `flight` | Airline booking |
| `hotel` | Hotel or accommodation |
| `train` | Rail booking (Eurostar, Shinkansen, etc.) |
| `car` | Car rental |
| `restaurant` | Dining reservation |
| `activity` | Tour, experience, event |
| `transfer` | Airport transfer, taxi, shuttle |
| `cruise` | Cruise segment |

---

### `GET /api/v1/items/:id`

Fetch a single item by ID, without the parent trip.

Useful when you've stored an item ID and want to check its current state without fetching the full trip.

#### Request

```bash
curl https://www.ubtrippin.xyz/api/v1/items/c3d4e5f6-a7b8-9012-cdef-123456789012 \
  -H "Authorization: Bearer ubt_your_key_here"
```

#### Response

```json
{
  "data": {
    "id": "c3d4e5f6-a7b8-9012-cdef-123456789012",
    "trip_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
    "kind": "flight",
    "provider": "Japan Airlines",
    "traveler_names": ["Alice", "Bob"],
    "start_ts": "2026-04-01T10:30:00Z",
    "end_ts": "2026-04-02T06:15:00Z",
    "start_date": "2026-04-01",
    "end_date": "2026-04-02",
    "start_location": "Los Angeles (LAX)",
    "end_location": "Tokyo Narita (NRT)",
    "summary": "JAL 61 · LAX → NRT · 11h 45m",
    "details_json": {
      "flight_number": "JL 061",
      "cabin_class": "Economy",
      "seat": "34A, 34B"
    },
    "status": "confirmed",
    "confidence": 0.97,
    "needs_review": false,
    "created_at": "2026-02-10T14:23:15Z",
    "updated_at": "2026-02-10T14:23:15Z"
  }
}
```

---

## Error Responses

All errors follow the same shape:

```json
{
  "error": {
    "code": "string",
    "message": "Human-readable description"
  }
}
```

| HTTP Status | Code | When |
|---|---|---|
| `400` | `invalid_param` | Malformed UUID or invalid parameter |
| `401` | `unauthorized` | Missing, malformed, or invalid API key |
| `404` | `not_found` | Trip or item doesn't exist, or belongs to another user |
| `429` | `rate_limited` | Exceeded 100 req/min |
| `500` | `internal_error` | Something went wrong on our end |

### 401 Example

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing or malformed Authorization header. Expected: Authorization: Bearer <api_key>"
  }
}
```

### 429 Example

```json
{
  "error": {
    "code": "rate_limited",
    "message": "Rate limit exceeded. Maximum 100 requests per minute. Retry after 23s."
  }
}
```

Response headers on 429:
```
Retry-After: 23
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1740316800
```

---

## Security Model

### Key Storage

API keys are SHA-256 hashed before storage. The database contains `key_hash`, never the plaintext. When you authenticate, we hash the incoming key and look it up by hash. This means:

- A database breach doesn't expose your keys
- We cannot recover a lost key — delete and regenerate
- Each key is unique per user; there is no shared or global key

### Data Scoping

Every API query filters by `user_id` derived from the key lookup. There is no way to access another user's data, even if you know their trip IDs. A `404` is returned for any trip or item that doesn't belong to your account — same response as a genuinely missing record, to avoid leaking existence information.

### Sensitive Field Stripping

Three fields are stripped from every API response:

- `confirmation_code` — your booking confirmation number
- `booking_reference` (from `details_json`) — internal booking ref
- `source_email_id` — which email the item was extracted from

These are stored for internal use (e.g., deduplication) but never returned externally.

### Row-Level Security

All Supabase tables have RLS enabled. The API uses a service-role client that bypasses RLS (necessary for key lookup), but all queries include explicit `user_id` filters — RLS is a safety net, not the primary guard.

---

## Integration Examples

### curl

```bash
# List trips
curl https://www.ubtrippin.xyz/api/v1/trips \
  -H "Authorization: Bearer $UBT_API_KEY"

# Get a specific trip with items
curl https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

### Python

```python
import os
import httpx

API_KEY = os.environ["UBT_API_KEY"]
BASE = "https://www.ubtrippin.xyz/api/v1"

headers = {"Authorization": f"Bearer {API_KEY}"}

# List all trips
resp = httpx.get(f"{BASE}/trips", headers=headers)
resp.raise_for_status()
trips = resp.json()["data"]

for trip in trips:
    print(f"{trip['title']} — {trip['start_date']} to {trip['end_date']}")

# Get a trip with items
trip_id = trips[0]["id"]
resp = httpx.get(f"{BASE}/trips/{trip_id}", headers=headers)
resp.raise_for_status()
trip = resp.json()["data"]

flights = [i for i in trip["items"] if i["kind"] == "flight"]
hotels  = [i for i in trip["items"] if i["kind"] == "hotel"]

print(f"Flights: {len(flights)}, Hotels: {len(hotels)}")
```

### Node.js

```javascript
const API_KEY = process.env.UBT_API_KEY;
const BASE = 'https://www.ubtrippin.xyz/api/v1';

const headers = { Authorization: `Bearer ${API_KEY}` };

// List trips
const listRes = await fetch(`${BASE}/trips`, { headers });
if (!listRes.ok) throw new Error(`API error: ${listRes.status}`);
const { data: trips } = await listRes.json();

// Get next upcoming trip (already sorted desc, so last in array)
const upcoming = trips.at(-1);
console.log(`Next trip: ${upcoming.title} on ${upcoming.start_date}`);

// Get full trip with items
const tripRes = await fetch(`${BASE}/trips/${upcoming.id}`, { headers });
const { data: trip } = await tripRes.json();

const checkIns = trip.items
  .filter(i => i.kind === 'hotel')
  .map(i => `${i.provider} — check in ${i.start_date}`);

console.log(checkIns.join('\n'));
```

### Claude Tool Definition

If you're wiring UB Trippin into a Claude agent as a tool:

```json
{
  "name": "get_trips",
  "description": "List the user's travel itineraries from UB Trippin. Returns structured trip data including flights, hotels, and other travel items.",
  "input_schema": {
    "type": "object",
    "properties": {
      "trip_id": {
        "type": "string",
        "description": "Optional UUID of a specific trip. If omitted, returns all trips."
      }
    }
  }
}
```

---

## Changelog

| Version | Date | Notes |
|---|---|---|
| v1.0 | 2026-02-23 | Initial release: GET trips, GET trips/:id, GET items/:id |

---

*Questions or problems? Open an issue on [GitHub](https://github.com/fistfulayen/ubtrippin) or email [security@ubtrippin.xyz](mailto:security@ubtrippin.xyz) for security matters.*
