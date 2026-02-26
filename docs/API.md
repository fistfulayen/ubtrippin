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

### `POST /api/v1/trips`

Create a new trip.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/trips \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"Paris → New York","start_date":"2026-06-07","end_date":"2026-06-07","primary_location":"New York"}'
```

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `title` | string | ✅ | Trip name (1–200 chars) |
| `start_date` | string (YYYY-MM-DD) | | Trip start date |
| `end_date` | string (YYYY-MM-DD) | | Trip end date |
| `primary_location` | string | | Main destination |
| `notes` | string | | Free-text notes |

#### Response

`201 Created` with `{ data: Trip }`.

---

### `PATCH /api/v1/trips/:id`

Update trip fields. All fields are optional; only provided fields are changed.

#### Request

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title":"NYC June","share_enabled":true}'
```

#### Body

Same fields as `POST /trips` (all optional), plus `cover_image_url` (string | null) and `share_enabled` (boolean).

#### Response

`200 OK` with `{ data: Trip }`.

---

### `DELETE /api/v1/trips/:id`

Delete a trip and **all its items**. Irreversible.

#### Request

```bash
curl -X DELETE https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Response

`204 No Content`.

---

### `POST /api/v1/trips/:id/items`

Add a single item to a trip.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/items \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "kind": "flight",
    "provider": "DL",
    "confirmation_code": "H7MGEF",
    "summary": "Delta Air Lines DL 263 from Paris CDG to New York JFK",
    "start_date": "2026-06-07",
    "end_date": "2026-06-07",
    "start_ts": "2026-06-07T09:30:00Z",
    "end_ts": "2026-06-07T17:46:00Z",
    "start_location": "Paris CDG Terminal 2E",
    "end_location": "New York JFK Terminal 4",
    "traveler_names": ["Ian Rogers"],
    "details_json": {
      "flight_number": "DL 263",
      "cabin_class": "Premium Economy",
      "stops": 0
    }
  }'
```

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `kind` | string | ✅ | Item type: `flight`, `hotel`, `car_rental`, `train`, `activity`, `restaurant`, `other` |
| `start_date` | string (YYYY-MM-DD) | ✅ | Start date |
| `end_date` | string (YYYY-MM-DD) | | End date |
| `provider` | string | | Airline, hotel, etc. (max 200 chars) |
| `confirmation_code` | string | | Booking confirmation (max 200 chars) — stored but never returned by GET |
| `summary` | string | | Human-readable one-liner (max 1000 chars) |
| `traveler_names` | string[] | | Names of travelers (max 20 entries) |
| `start_ts` | string (ISO 8601) | | Start datetime UTC |
| `end_ts` | string (ISO 8601) | | End datetime UTC |
| `start_location` | string | | Departure / check-in location (max 300 chars) |
| `end_location` | string | | Arrival / check-out location (max 300 chars) |
| `details_json` | object | | Type-specific structured data (max 10KB) |
| `status` | string | | `confirmed`, `pending`, `cancelled`, etc. |

#### Response

`201 Created` with `{ data: Item }`.

---

### `POST /api/v1/trips/:id/items/batch`

Add up to 50 items in one call.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/items/batch \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"kind":"flight","start_date":"2026-06-07",...},{"kind":"hotel","start_date":"2026-06-07",...}]}'
```

#### Body

```json
{
  "items": [ <ItemInput>, ... ]
}
```

Max 50 items per request. Each item follows the same schema as `POST /trips/:id/items`.

Validation errors include the item index: `items[2]: "kind" is required.`

#### Response

`201 Created` with `{ data: Item[], meta: { count: number } }`.

---

### `PATCH /api/v1/items/:id`

Update fields on an existing item. All fields optional.

To **move an item to a different trip**, include `trip_id` in the body. The destination trip must belong to the same user. The `auto_expand_trip_dates` DB trigger adjusts the target trip's date range automatically.

#### Request

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/items/$ITEM_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"status":"cancelled"}'
```

#### Move to another trip

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/items/$ITEM_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"trip_id":"b2c3d4e5-f6a7-8901-bcde-f12345678901"}'
```

#### Additional Field

| Field | Type | Description |
|---|---|---|
| `trip_id` | UUID | Move this item to a different trip (must be owned by you) |

#### Response

`200 OK` with `{ data: Item }`.

---

### `DELETE /api/v1/items/:id`

Delete a single item. The parent trip is not affected.

#### Request

```bash
curl -X DELETE https://www.ubtrippin.xyz/api/v1/items/$ITEM_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Response

`204 No Content`.

---

---

### `POST /api/v1/trips/:id/merge`

Merge a source trip into a target trip. All items from the source trip are moved to the target, then the source trip is deleted. The `auto_expand_trip_dates` DB trigger expands the target trip's date range to accommodate any moved items.

Both trips must belong to the authenticated user.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/trips/$TARGET_TRIP_ID/merge \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"source_trip_id":"b2c3d4e5-f6a7-8901-bcde-f12345678901"}'
```

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `source_trip_id` | UUID | ✅ | Trip whose items will be moved into the target (then deleted) |

#### Response

`200 OK`:

```json
{
  "data": {
    "trip": {
      "id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "title": "Japan Spring 2026",
      "start_date": "2026-04-01",
      "end_date": "2026-04-15",
      "...": "..."
    },
    "items": [
      { "id": "...", "kind": "flight", "..." : "..." },
      { "id": "...", "kind": "hotel",  "..." : "..." }
    ]
  },
  "meta": {
    "items_moved": 3
  }
}
```

#### Errors

| Status | Code | When |
|---|---|---|
| `400` | `invalid_param` | `source_trip_id` is not a valid UUID, or equals the target trip ID |
| `404` | `not_found` | Either trip not found or not owned by you |

---

### `GET /api/v1/images/search`

Search for landscape photos via Unsplash. Intended for populating trip cover images. Results are cached for 5 minutes per query on the server side.

#### Request

```bash
curl "https://www.ubtrippin.xyz/api/v1/images/search?q=tokyo" \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Query Parameters

| Param | Required | Description |
|---|---|---|
| `q` | ✅ | Search query (1–200 chars) |

#### Response

`200 OK`:

```json
{
  "data": [
    {
      "url": "https://images.unsplash.com/photo-...?w=1080&fit=max",
      "thumb": "https://images.unsplash.com/photo-...?w=200&fit=max",
      "credit": {
        "name": "Jezael Melgoza",
        "link": "https://unsplash.com/@jezael"
      }
    }
  ],
  "meta": {
    "query": "tokyo",
    "count": 9
  }
}
```

Returns up to 9 landscape-oriented results. Photo credits are provided in compliance with the Unsplash API guidelines.

#### Errors

| Status | Code | When |
|---|---|---|
| `400` | `invalid_param` | `q` is missing or exceeds 200 chars |
| `502` | `internal_error` | Unsplash API request failed |

---

### `GET /api/v1/calendar/token`

Get the current calendar feed token and iCal URL for the authenticated user.

#### Request

```bash
curl https://www.ubtrippin.xyz/api/v1/calendar/token \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Response

`200 OK` — no token yet:

```json
{
  "data": {
    "token": null,
    "feed_url": null
  }
}
```

`200 OK` — token exists:

```json
{
  "data": {
    "token": "abc123xyz...",
    "feed_url": "https://www.ubtrippin.xyz/api/calendar/feed?token=abc123xyz..."
  }
}
```

---

### `POST /api/v1/calendar/token`

Generate or regenerate the calendar feed token. If a token already exists, it is replaced with a new one. Any previously shared calendar URLs will stop working.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/calendar/token \
  -H "Authorization: Bearer $UBT_API_KEY"
```

No request body required.

#### Response

`201 Created`:

```json
{
  "data": {
    "token": "newtoken123...",
    "feed_url": "https://www.ubtrippin.xyz/api/calendar/feed?token=newtoken123..."
  }
}
```

---

### `GET /api/v1/settings/senders`

List all allowed email senders for the authenticated user. Senders are email addresses from which the app will process forwarded travel confirmations.

#### Request

```bash
curl https://www.ubtrippin.xyz/api/v1/settings/senders \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Response

`200 OK`:

```json
{
  "data": [
    {
      "id": "d4e5f6a7-b8c9-0123-defa-234567890123",
      "user_id": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      "email": "alice@example.com",
      "name": "Alice",
      "created_at": "2026-02-10T14:23:11Z"
    }
  ],
  "meta": {
    "count": 1
  }
}
```

---

### `POST /api/v1/settings/senders`

Add an email address to your allowed senders list.

#### Request

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/settings/senders \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"email":"alice@example.com","name":"Alice"}'
```

#### Body

| Field | Type | Required | Description |
|---|---|---|---|
| `email` | string | ✅ | Valid email address (max 254 chars) |
| `name` | string | | Display name (max 200 chars, HTML stripped) |

#### Response

`201 Created` with `{ data: Sender }`.

#### Errors

| Status | Code | When |
|---|---|---|
| `400` | `invalid_param` | `email` is missing or invalid |
| `409` | `conflict` | This email address is already in your allowed senders list |

---

### `DELETE /api/v1/settings/senders/:id`

Remove an email address from your allowed senders list.

#### Request

```bash
curl -X DELETE https://www.ubtrippin.xyz/api/v1/settings/senders/$SENDER_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

#### Response

`204 No Content`.

#### Errors

| Status | Code | When |
|---|---|---|
| `404` | `not_found` | Sender not found or not owned by you |

---

### Collaboration

#### `GET /api/v1/trips/:id/collaborators`

List all collaborators on a trip. **Owner only.**

```bash
curl https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/collaborators \
  -H "Authorization: Bearer $UBT_API_KEY"
```

Response:
```json
{
  "data": [
    {
      "id": "<collab_uuid>",
      "user_id": "<user_uuid_or_null>",
      "role": "editor",
      "invited_email": "friend@example.com",
      "accepted_at": "2026-02-25T05:00:00Z",
      "created_at": "2026-02-25T04:33:00Z"
    }
  ],
  "meta": { "count": 1 }
}
```

`accepted_at` is `null` for pending invites. `user_id` is `null` until the invite is accepted by a new user.

---

#### `POST /api/v1/trips/:id/collaborators`

Invite a collaborator. Sends an invite email. **Owner only. Requires Pro.**

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/collaborators \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "email": "friend@example.com", "role": "editor" }'
```

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| `email` | string | ✅ | Email address to invite |
| `role` | string | ✅ | `editor` or `viewer` |

Returns `201` with the created collaborator record.

---

#### `PATCH /api/v1/trips/:id/collaborators/:collab_id`

Change a collaborator's role. **Owner only.**

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/collaborators/$COLLAB_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{ "role": "viewer" }'
```

---

#### `DELETE /api/v1/trips/:id/collaborators/:collab_id`

Remove a collaborator. Trip disappears from their dashboard immediately. **Owner only.**

```bash
curl -X DELETE https://www.ubtrippin.xyz/api/v1/trips/$TRIP_ID/collaborators/$COLLAB_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

Returns `204 No Content`.

---

### Notifications

Notifications are fired when collaborators accept invites or add items to your trips.

#### `GET /api/v1/notifications`

List notifications for the authenticated user.

**Query params:**

| Param | Default | Notes |
|-------|---------|-------|
| `unread` | `false` | Set `true` to return only unread |
| `limit` | `20` | Max 100 |

```bash
curl "https://www.ubtrippin.xyz/api/v1/notifications?unread=true" \
  -H "Authorization: Bearer $UBT_API_KEY"
```

Response:
```json
{
  "data": [
    {
      "id": "<uuid>",
      "type": "entry_added",
      "trip_id": "<trip_uuid>",
      "actor_id": "<user_uuid>",
      "data": {
        "actor_name": "Hedvig Lindqvist",
        "item_summary": "Osteria dell'Angelo",
        "item_kind": "restaurant"
      },
      "read_at": null,
      "created_at": "2026-02-25T04:45:00Z"
    }
  ],
  "meta": { "count": 1, "unread_count": 1 }
}
```

**Notification types:**

| type | When |
|------|------|
| `invite_accepted` | A collaborator accepted your invite |
| `entry_added` | A collaborator added an item to your trip |

---

#### `PATCH /api/v1/notifications/:id`

Mark a notification as read.

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/notifications/$NOTIFICATION_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Response:
```json
{ "data": { "id": "<uuid>", "read_at": "2026-02-25T05:00:00Z" } }
```

---

## Profile & Loyalty Vault

These endpoints store traveler preferences and loyalty numbers so agents can apply them during booking.

### `GET /api/v1/me/profile`

Get the authenticated user's traveler profile.

```bash
curl https://www.ubtrippin.xyz/api/v1/me/profile \
  -H "Authorization: Bearer $UBT_API_KEY"
```

```json
{
  "data": {
    "id": "<user_uuid>",
    "seat_preference": "window",
    "meal_preference": "no_preference",
    "airline_alliance": "star_alliance",
    "hotel_brand_preference": "Marriott",
    "home_airport": "CDG",
    "currency_preference": "EUR",
    "notes": "Prefer morning departures.",
    "created_at": "2026-02-25T08:00:00Z",
    "updated_at": "2026-02-25T08:00:00Z",
    "loyalty_count": 3
  }
}
```

### `PUT /api/v1/me/profile`

Update any subset of traveler preference fields. Omitted fields are unchanged.

```bash
curl -X PUT https://www.ubtrippin.xyz/api/v1/me/profile \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "seat_preference": "aisle",
    "airline_alliance": "oneworld",
    "home_airport": "JFK"
  }'
```

```json
{
  "data": {
    "id": "<user_uuid>",
    "seat_preference": "aisle",
    "meal_preference": "no_preference",
    "airline_alliance": "oneworld",
    "hotel_brand_preference": "Marriott",
    "home_airport": "JFK",
    "currency_preference": "EUR",
    "notes": "Prefer morning departures.",
    "created_at": "2026-02-25T08:00:00Z",
    "updated_at": "2026-02-25T09:10:00Z",
    "loyalty_count": 3
  }
}
```

### `GET /api/v1/me/loyalty`

List loyalty programs in the vault (includes plaintext `program_number` for agent use).

```bash
curl https://www.ubtrippin.xyz/api/v1/me/loyalty \
  -H "Authorization: Bearer $UBT_API_KEY"
```

```json
{
  "data": [
    {
      "id": "<program_uuid>",
      "user_id": "<user_uuid>",
      "traveler_name": "Ian Rogers",
      "provider_type": "airline",
      "provider_name": "United MileagePlus",
      "provider_key": "united",
      "program_number_masked": "MP•••••2847",
      "program_number": "MP123452847",
      "status_tier": "gold",
      "preferred": true,
      "notes": null,
      "created_at": "2026-02-25T08:10:00Z",
      "updated_at": "2026-02-25T08:10:00Z",
      "alliance_group": "star_alliance"
    }
  ],
  "meta": { "count": 1 }
}
```

### `POST /api/v1/me/loyalty`

Add a loyalty program to the vault.

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/me/loyalty \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "traveler_name": "Ian Rogers",
    "provider_type": "hotel",
    "provider_name": "Marriott Bonvoy",
    "provider_key": "marriott_bonvoy",
    "program_number": "1234567890",
    "status_tier": "titanium",
    "preferred": true
  }'
```

```json
{
  "data": {
    "id": "<program_uuid>",
    "user_id": "<user_uuid>",
    "traveler_name": "Ian Rogers",
    "provider_type": "hotel",
    "provider_name": "Marriott Bonvoy",
    "provider_key": "marriott_bonvoy",
    "program_number_masked": "12•••••890",
    "program_number": "1234567890",
    "status_tier": "titanium",
    "preferred": true,
    "notes": null,
    "created_at": "2026-02-25T08:12:00Z",
    "updated_at": "2026-02-25T08:12:00Z",
    "alliance_group": null
  }
}
```

### `PATCH /api/v1/me/loyalty/:id`

Update one loyalty entry (number, tier, preferred, notes, traveler name).

```bash
curl -X PATCH https://www.ubtrippin.xyz/api/v1/me/loyalty/$PROGRAM_ID \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "status_tier": "platinum",
    "preferred": true,
    "notes": "Primary program for Europe travel."
  }'
```

```json
{
  "data": {
    "id": "<program_uuid>",
    "provider_name": "United MileagePlus",
    "provider_key": "united",
    "program_number_masked": "MP•••••2847",
    "program_number": "MP123452847",
    "status_tier": "platinum",
    "preferred": true,
    "notes": "Primary program for Europe travel."
  }
}
```

### `DELETE /api/v1/me/loyalty/:id`

Delete a loyalty entry.

```bash
curl -X DELETE https://www.ubtrippin.xyz/api/v1/me/loyalty/$PROGRAM_ID \
  -H "Authorization: Bearer $UBT_API_KEY"
```

Returns `204 No Content`.

### `GET /api/v1/me/loyalty/lookup?provider=:provider_key`

Lookup a loyalty number for a provider, with alliance fallback.

```bash
curl "https://www.ubtrippin.xyz/api/v1/me/loyalty/lookup?provider=airfrance" \
  -H "Authorization: Bearer $UBT_API_KEY"
```

```json
{
  "exact_match": false,
  "compatible_program": {
    "provider_name": "Delta SkyMiles",
    "provider_key": "delta",
    "program_number_masked": "DL•••••8901",
    "program_number": "DL123458901",
    "traveler_name": "Ian Rogers"
  },
  "alliance": "skyteam"
}
```

### `GET /api/v1/me/loyalty/export`

Export the full loyalty vault as JSON.

```bash
curl https://www.ubtrippin.xyz/api/v1/me/loyalty/export \
  -H "Authorization: Bearer $UBT_API_KEY"
```

```json
{
  "exported_at": "2026-02-25T09:30:00Z",
  "user_id": "<user_uuid>",
  "count": 2,
  "programs": [
    {
      "id": "<program_uuid>",
      "provider_name": "United MileagePlus",
      "provider_key": "united",
      "program_number_masked": "MP•••••2847",
      "program_number": "MP123452847"
    }
  ]
}
```

### `GET /api/v1/loyalty/providers`

Get the provider catalog used for normalized `provider_key` values and alliance matching.

```bash
curl https://www.ubtrippin.xyz/api/v1/loyalty/providers \
  -H "Authorization: Bearer $UBT_API_KEY"
```

```json
{
  "data": [
    {
      "provider_key": "united",
      "provider_name": "United MileagePlus",
      "provider_type": "airline",
      "alliance_group": "star_alliance"
    },
    {
      "provider_key": "marriott_bonvoy",
      "provider_name": "Marriott Bonvoy",
      "provider_type": "hotel",
      "alliance_group": null
    }
  ],
  "meta": { "count": 2 }
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
| `400` | `invalid_json` | Request body is not valid JSON |
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

## Webhooks

Webhook endpoints let you register callback URLs for trip/item/collaborator events.

### `GET /api/v1/webhooks`

List all registered webhooks for the authenticated user.

### `POST /api/v1/webhooks`

Register a webhook endpoint.

Request body:

| Field | Type | Required | Description |
|---|---|---|---|
| `url` | string | ✅ | HTTPS callback URL |
| `secret` | string | ✅ | Signing secret (1–200 chars) |
| `events` | string[] | | Event filter list; empty/omitted means all events |
| `description` | string \| null | | Optional description |

### `GET /api/v1/webhooks/:id`

Get details for a webhook.

### `PATCH /api/v1/webhooks/:id`

Update webhook fields (`url`, `description`, `events`, `enabled`, `secret`).

### `DELETE /api/v1/webhooks/:id`

Delete webhook and cancel pending deliveries.

Returns `204 No Content` on success.

### `POST /api/v1/webhooks/:id/test`

Queue a synthetic `ping` delivery.

### `GET /api/v1/webhooks/:id/deliveries`

List recent delivery logs for a webhook.

Response includes:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Delivery ID |
| `event` | string | Event name |
| `payload` | object | Event payload sent to endpoint |
| `status` | string | `pending`, `success`, `failed` |
| `attempts` | number | Attempt count |
| `last_response_code` | number \| null | Last HTTP status from receiver |
| `last_response_body` | string \| null | Last response body from receiver |
| `created_at` | string | Created timestamp |

See [WEBHOOKS.md](./WEBHOOKS.md) for full event list, signature verification, and retry behavior.

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
| v1.4 | 2026-02-26 | Webhooks — endpoint registration, test ping, delivery logs |
| v1.3 | 2026-02-25 | Collaborative trips — invite system, collaborator CRUD, notifications, `role` field in trip list |
| v1.2 | 2026-02-24 | Feature parity — move item, merge trips, cover image search, calendar token, allowed senders |
| v1.1 | 2026-02-24 | Write endpoints: POST/PATCH/DELETE trips, POST/PATCH/DELETE items, batch insert |
| v1.0 | 2026-02-23 | Initial release: GET trips, GET trips/:id, GET items/:id |

---

*Questions or problems? Open an issue on [GitHub](https://github.com/fistfulayen/ubtrippin) or email [security@ubtrippin.xyz](mailto:security@ubtrippin.xyz) for security matters.*
