# CLI Parity — Add Missing Commands to cli/ubt

You are adding commands to `cli/ubt` (a Bash CLI) to achieve full parity with the v1 REST API.

**SECURITY RULE: Do NOT use createSecretClient() or service role to bypass RLS. This code will be security-audited monthly.**

## Context

`cli/ubt` is a Bash script that talks to both Supabase REST (direct) and the v1 API (`https://www.ubtrippin.xyz/api/v1`). Commands that use the v1 API require `UBT_API_KEY` and use the `_api_curl` helper (or similar pattern already in the file).

## Existing Patterns

Look at how existing v1 API commands are implemented in cli/ubt:
- `trips merge` uses `_api_curl` with POST
- `items move` uses `_api_curl` with PATCH  
- `webhooks add` uses `_api_curl` with POST and JSON body
- `collab invite` uses `_api_curl` with POST

Follow these exact patterns. The CLI already has helpers like `_api_curl`, `_require_api_key`, `_jq`, color output, etc. Use them.

## Commands to Add

### Trips CRUD
- `trips create <title> [--start YYYY-MM-DD] [--end YYYY-MM-DD]` — POST /api/v1/trips
- `trips update <trip_id> [--title X] [--notes X] [--start X] [--end X]` — PATCH /api/v1/trips/:id
- `trips rename <trip_id> <new_title>` — POST /api/v1/trips/:id/rename
- `trips delete <trip_id>` — DELETE /api/v1/trips/:id (with confirmation prompt)
- `trips status <trip_id>` — GET /api/v1/trips/:id/status

### Items CRUD
- `items show <item_id>` — GET /api/v1/items/:id
- `items add <trip_id> --kind <kind> --summary <text> [--provider X] [--start-ts X] [--end-ts X] [--start-location X] [--end-location X] [--details-json '{...}']` — POST /api/v1/trips/:id/items
- `items update <item_id> [--summary X] [--start-location X] [--end-location X] [--status X]` — PATCH /api/v1/items/:id
- `items delete <item_id>` — DELETE /api/v1/items/:id (with confirmation prompt)
- `items status <item_id>` — GET /api/v1/items/:id/status
- `items refresh <item_id>` — POST /api/v1/items/:id/status/refresh

### City Guides
- `guides list` — GET /api/v1/guides
- `guides create <city> [--country X] [--country-code XX]` — POST /api/v1/guides
- `guides show <guide_id>` — GET /api/v1/guides/:id (show guide + entries)
- `guides delete <guide_id>` — DELETE /api/v1/guides/:id
- `guides entry add <guide_id> --name <name> --category <cat> [--description X] [--url X] [--tags tag1,tag2] [--status visited|to_try]` — POST /api/v1/guides/:id/entries
- `guides entry update <guide_id> <entry_id> [--name X] [--category X] [--description X]` — PATCH /api/v1/guides/:id/entries/:eid
- `guides entry delete <guide_id> <entry_id>` — DELETE /api/v1/guides/:id/entries/:eid
- `guides nearby --lat X --lng Y` — GET /api/v1/guides/nearby

### Trains
- `trains status <train_number>` — GET /api/v1/trains/:trainNumber/status

### Billing (read-only)
- `billing show` — GET /api/v1/billing/subscription
- `billing portal` — GET /api/v1/billing/portal (print URL)

### Activation
- `activation status` — GET /api/v1/activation/status

## Help Text

Update the usage/help text at the top of the script to include ALL new commands. Follow the existing formatting style exactly.

## Output Formatting

- For `FORMAT=json`, output raw JSON (existing pattern)
- For normal output, use the existing color helpers and formatting style
- Show confirmation prompts for delete operations
- Show success/error messages

## Testing

After adding all commands, verify:
1. `ubt` (no args) shows the full updated help text with all new commands
2. The script has no bash syntax errors: `bash -n cli/ubt`
3. All new commands follow the `_require_api_key` pattern

## Do NOT
- Modify any app code (only cli/ubt)
- Break existing commands
- Remove or change any existing functionality
- Add external dependencies (pure bash + curl + jq)

## Commit
```
git add -A && git commit -m "feat(cli): full API parity — trips/items/guides/trains/billing CRUD"
```
