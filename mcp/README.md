# ubtrippin-mcp

MCP server for [UBTRIPPIN](https://ubtrippin.xyz) — gives any MCP-compatible AI client (Claude Desktop, Cursor, Windsurf, etc.) read access to your travel itineraries.

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
| `UBT_BASE_URL` | ❌ | Override API base URL (default: `https://ubtrippin.xyz`) |

## Tools

### `list_trips`
List all trips ordered by start date (soonest upcoming first).

### `get_upcoming`
Return only future trips, sorted by date ascending. Ideal for "what do I have coming up?"

```
limit?: number   (default: 10, max: 50)
```

### `get_trip`
Get a single trip with all its items (flights, hotels, trains, etc.).

```
trip_id: string (UUID)
```

### `get_item`
Get a single trip item by ID.

```
item_id: string (UUID)
```

### `search_trips`
Search trips by destination, date range, or traveler name.

```
query?:    string         text search across title, location, notes
after?:    YYYY-MM-DD    trips starting on or after this date
before?:   YYYY-MM-DD    trips starting on or before this date
traveler?: string         filter by traveler name (partial match)
```

### `get_calendar`
Generate an iCal (.ics) file for a trip. Returns raw iCal text — save as `.ics` and import anywhere.

```
trip_id: string (UUID)
```

## Resources

### `ubtrippin://trips`
All trips as a JSON resource.

### `ubtrippin://trips/{id}`
Full detail for a single trip including all items.

## Example Usage

Once connected, you can ask your AI assistant:

> "What trips do I have coming up?"
> "What's my itinerary for Tokyo?"
> "When does my next flight depart?"
> "What's the confirmation number for my hotel in Paris?"

## Rate Limits

100 requests/minute per API key. The server will surface API errors directly.

## Adding New Bookings

The MCP server is read-only. To add trips, forward booking confirmation emails from your registered address to **trips@ubtrippin.xyz**. New items appear automatically.

## License

MIT — ubtrippin.xyz
