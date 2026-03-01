# ubtrippin-mcp

MCP server for [UBTRIPPIN](https://ubtrippin.xyz) — gives any MCP-compatible AI client (Claude Desktop, Cursor, Windsurf, etc.) full access to your travel data: trips, items, city guides, loyalty vault, family sharing, and more.

## Install

```bash
npx ubtrippin-mcp
```

Or install globally:

```bash
npm install -g ubtrippin-mcp
```

## Setup

1. Go to **ubtrippin.xyz/settings** and generate an API key
2. Add the server to your MCP client config (see below)

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "ubtrippin": {
      "command": "npx",
      "args": ["ubtrippin-mcp"],
      "env": {
        "UBT_API_KEY": "ubt_k1_your_key_here"
      }
    }
  }
}
```

## Cursor / Windsurf / Other MCP Clients

Use the same pattern — `command: npx`, `args: ["ubtrippin-mcp"]`, set `UBT_API_KEY` in the environment.

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `UBT_API_KEY` | ✅ | Your UBTRIPPIN API key from ubtrippin.xyz/settings |
| `UBT_BASE_URL` | ❌ | Override API base URL (default: `https://www.ubtrippin.xyz`) |

## Tools (55 total)

### Trips (read)
- `list_trips` — List all trips ordered by start date
- `get_trip` — Get trip with all items by ID
- `get_upcoming` — Future trips only, sorted ascending
- `search_trips` — Search by destination, dates, or traveler
- `get_calendar` — Generate iCal (.ics) for a trip
- `get_trip_status` — Get processing status for a trip

### Trips (write)
- `create_trip` — Create a new trip
- `update_trip` — Update trip fields
- `delete_trip` — Delete trip and all items
- `rename_trip` — Rename a trip
- `merge_trips` — Merge source trip into target

### Items
- `get_item` — Get a single item by ID
- `add_item` — Add item to a trip
- `add_items` — Batch add up to 50 items
- `update_item` — Update item fields
- `delete_item` — Delete an item
- `move_item` — Move item to another trip
- `get_item_status` — Get live status (delays, gates)
- `refresh_item_status` — Re-check live status

### City Guides
- `list_guides` — List all city guides
- `get_guide` — Get guide with all entries
- `find_or_create_guide` — Find or create guide by city
- `get_guide_markdown` — Get guide as Markdown
- `get_nearby_places` — Find guide entries near a location
- `add_guide_entry` — Add a place to a guide
- `update_guide_entry` — Update a guide entry
- `delete_guide_entry` — Delete a guide entry
- `update_guide` — Update guide metadata
- `delete_guide` — Delete a guide and all entries

### Collaboration
- `list_collaborators` — List trip collaborators
- `invite_collaborator` — Invite someone to a trip
- `update_collaborator_role` — Change collaborator role
- `remove_collaborator` — Remove a collaborator

### Notifications
- `get_notifications` — List notifications
- `mark_notification_read` — Mark notification as read

### Traveler Profile
- `get_traveler_profile` — Get profile and preferences
- `update_traveler_profile` — Update preferences

### Loyalty Vault
- `list_loyalty_programs` — List all loyalty programs
- `add_loyalty_program` — Add a program to the vault
- `update_loyalty_program` — Update a loyalty entry
- `delete_loyalty_program` — Remove a loyalty entry
- `lookup_loyalty_program` — Lookup by provider (with alliance fallback)
- `export_loyalty_data` — Export all loyalty data
- `list_loyalty_providers` — List supported providers

### Family Sharing
- `list_families` — List families you belong to
- `get_family` — Get family details
- `create_family` — Create a new family group
- `update_family` — Update family name
- `delete_family` — Delete a family group
- `invite_family_member` — Invite someone to a family
- `remove_family_member` — Remove a family member
- `get_family_loyalty` — Family loyalty programs
- `lookup_family_loyalty` — Lookup loyalty across family
- `get_family_profiles` — Family member profiles
- `get_family_trips` — Trips across family members
- `get_family_guides` — Guides across family members

### Settings
- `get_calendar_url` — Get iCal subscription URL
- `regenerate_calendar_token` — Regenerate calendar feed token
- `list_senders` — List allowed email senders
- `add_sender` — Add allowed sender
- `delete_sender` — Remove allowed sender
- `list_webhooks` — List webhook endpoints
- `register_webhook` — Register a webhook
- `delete_webhook` — Delete a webhook
- `test_webhook` — Send test ping to webhook
- `list_deliveries` — List webhook delivery logs

### Billing
- `get_subscription` — Current plan and billing period
- `get_billing_portal` — Stripe portal URL
- `get_prices` — Available plans and pricing

### Other
- `list_imports` — List email imports
- `get_import` — Get import details
- `get_train_status` — Real-time train status
- `get_activation_status` — Account activation check
- `search_cover_image` — Search Unsplash for covers

## Resources

- `ubtrippin://trips` — All trips as JSON
- `ubtrippin://trips/{id}` — Trip detail with items
- `ubtrippin://guides` — All city guides
- `ubtrippin://guides/{id}` — Guide detail with entries

## Example Usage

> "What trips do I have coming up?"
> "What's my itinerary for Tokyo?"
> "Add Télescope to my Paris coffee guide"
> "What's my Delta SkyMiles number?"
> "Is my train on time?"
> "Share my trip with friend@example.com"

## Rate Limits

100 requests/minute per API key.

## License

MIT — ubtrippin.xyz
