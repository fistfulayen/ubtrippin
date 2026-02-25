# Collaborative Trips — Agent & API Guide

Collaborative trips let multiple people (and their agents) work on the same itinerary. This doc covers how agents interact with shared trips via the REST API and MCP.

---

## How it works

- Trip **owners** invite collaborators by email with a role of `editor` or `viewer`.
- Once the invite is accepted, the trip appears in the collaborator's dashboard and API responses.
- **Editors** can add and update trip items. **Viewers** can read only.
- Only the **owner** can invite, change roles, remove collaborators, or delete the trip.
- Collaborative trips appear automatically in `GET /api/v1/trips` — no special handling needed.

---

## Roles

| Role    | Read trip | Add items | Edit items | Delete trip | Manage collaborators |
|---------|-----------|-----------|------------|-------------|----------------------|
| owner   | ✅        | ✅        | ✅         | ✅          | ✅                   |
| editor  | ✅        | ✅        | ✅         | ❌          | ❌                   |
| viewer  | ✅        | ❌        | ❌         | ❌          | ❌                   |

---

## Reading shared trips (agent perspective)

Hedvig's agent sees the Turin trip Ian shared with her — just like her own trips:

```http
GET /api/v1/trips
Authorization: Bearer <hedvig_api_key>
```

Response includes a `role` field indicating access level:

```json
{
  "data": [
    {
      "id": "...",
      "title": "Turin trip",
      "primary_location": "Turin",
      "role": "editor",
      ...
    }
  ]
}
```

---

## Writing to a shared trip (editor role)

Hedvig's agent adds the wine bar she found:

```http
POST /api/v1/trips/{turin_trip_id}/items
Authorization: Bearer <hedvig_api_key>
Content-Type: application/json

{
  "kind": "restaurant",
  "summary": "Osteria dell'Angelo — intimate trattoria, great tajarin",
  "start_location": "Via Porta Palatina 10, Turin"
}
```

- The item is created under Hedvig's user context but on Ian's trip.
- Ian sees it on next load.
- Ian gets a notification (`entry_added`) if notification emails are enabled.

---

## API Reference

### Collaboration Management

```
GET    /api/v1/trips/:id/collaborators              List collaborators (owner only)
POST   /api/v1/trips/:id/collaborators              Invite a collaborator (owner only)
PATCH  /api/v1/trips/:id/collaborators/:collab_id   Change role (owner only)
DELETE /api/v1/trips/:id/collaborators/:collab_id   Remove collaborator (owner only)
```

**Invite body:**
```json
{ "email": "friend@example.com", "role": "editor" }
```

**Invite response:**
```json
{
  "data": {
    "id": "<collab_uuid>",
    "invited_email": "friend@example.com",
    "role": "editor",
    "accepted_at": null,
    "created_at": "2026-02-25T04:33:00Z"
  }
}
```

### Notifications

```
GET   /api/v1/notifications               List notifications
GET   /api/v1/notifications?unread=true   Unread only
GET   /api/v1/notifications?limit=50      Up to 100
PATCH /api/v1/notifications/:id           Mark individual notification as read
```

**Notification types:**

| type             | When fired                              |
|------------------|-----------------------------------------|
| `invite_accepted` | A collaborator accepted your invite    |
| `entry_added`     | A collaborator added an item to your trip |

**Notification response shape:**
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

---

## MCP Tools

When connected via MCP, these tools are available:

```
list_collaborators(trip_id)                          — list who has access
invite_collaborator(trip_id, email, role)            — send an invite
update_collaborator_role(trip_id, collaborator_id, role)
remove_collaborator(trip_id, collaborator_id)
get_notifications(unread_only?, limit?)              — poll for events
mark_notification_read(notification_id)
```

---

## CLI Commands

```bash
ubt collab list <trip_id>                         # List collaborators
ubt collab invite <trip_id> friend@example.com    # Invite as editor (default)
ubt collab invite <trip_id> friend@example.com viewer  # Invite as viewer
ubt collab remove <trip_id> <collab_id>           # Remove collaborator

ubt notifications list                            # All recent notifications
ubt notifications list --unread                   # Unread only
ubt notifications read <notification_id>          # Mark as read
```

---

## Agent notification patterns

### Pattern 1: Email-based (works today)
The invite email arrives in Hedvig's inbox. Her email-monitoring agent picks it up, reads the invite link, and she accepts via the web UI or API.

### Pattern 2: API polling
Ian's agent polls for new notifications after trips are edited:

```http
GET /api/v1/notifications?unread=true
```

If `unread_count > 0`, the agent reads the notification details and reports back.

### Pattern 3: Proactive check (via MCP)
```
get_notifications(unread_only=true)
→ { type: "entry_added", data: { actor_name: "Hedvig", item_summary: "Osteria dell'Angelo" } }
```

---

## Free vs Pro tier

| Feature                          | Free | Pro |
|----------------------------------|------|-----|
| Accept a trip invite             | ✅   | ✅  |
| View / read shared trips         | ✅   | ✅  |
| Add items to shared trips (editor) | ✅ | ✅  |
| Invite collaborators to your trips | ❌ | ✅  |
| Unlimited shared trips           | ❌   | ✅  |
| Notification preferences         | ❌   | ✅  |

Free users can receive invites and participate. Only Pro users can send invites.
