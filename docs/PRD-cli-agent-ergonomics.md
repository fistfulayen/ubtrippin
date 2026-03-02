# PRD: CLI Agent Ergonomics

## Overview
Make the `ubt` CLI a first-class tool for AI agents. An agent should be able to perform any trip management task — add hotels, look up trips, manage items — without hitting papercuts that require workarounds or manual intervention.

## Motivation
Dogfooding exercise: adding a hotel to the Japan trip via CLI required:
1. `trips list` → got truncated 8-char IDs
2. `items add` → rejected the short ID, demanded full UUID
3. Had to call the REST API directly to get the full UUID
4. `trips show <short_id>` → Python KeyError crash instead of helpful message
5. `items list <short_id>` → same crash
6. `UBT_API_KEY` not persisted in `~/.ubt/config` — had to `export` from `.bashrc`

An agent performing this task hit 4 failures before succeeding. Each failure burns tokens, time, and credibility.

## Requirements

### Phase 1 — Short ID Resolution (Critical)

**P1.1: Accept short ID prefixes everywhere**
All commands that take a `trip_id`, `item_id`, `guide_id`, or `entry_id` must accept UUID prefixes (minimum 4 chars). Resolution logic:
- Query the relevant table with `id=like.<prefix>*`
- If exactly 1 match → use it
- If 0 matches → error: "No trip found matching '<prefix>'"
- If 2+ matches → error: "Ambiguous prefix '<prefix>' — matches N items. Use a longer prefix."

Apply to: `trips show/update/rename/delete/status/merge`, `items list/show/add/update/delete/status/refresh/move`, `guides show/delete`, `guides entry add/update/delete`, `collab list/invite/remove`

**P1.2: Show full UUIDs in list output (with short highlight)**
`trips list` and `items list` should show the full UUID but visually highlight the short prefix:
```
055f021a-2cf1-4d23-9d4a-a0d4a6afcad0  Tokyo → Minakami  2026-04-23
```
Or at minimum, provide `FORMAT=json` output with full IDs (already works for `trips list`).

### Phase 2 — Error Handling (Critical)

**P2.1: No raw Python tracebacks**
Every Python block must have try/except that produces a human-readable error. Current crashes:
- `trips show <short_id>` → `KeyError: 0` (no results, tries to index empty list)
- `items list <short_id>` → `AttributeError: 'str' object has no attribute 'get'` (response is error string, not JSON)

Pattern: wrap all Python blocks in try/except, print the raw response on failure for debugging.

**P2.2: Consistent error format**
All errors should follow:
```
Error: <human-readable message>
  Detail: <API response or hint>
  Hint: <suggested fix>
```

Example:
```
Error: No trip found matching '055f021a'
  Hint: Use 'ubt trips list' to see available trips
```

### Phase 3 — Agent-Friendly Output (Important)

**P3.1: `FORMAT=json` support on ALL commands**
Currently only `trips list` supports `FORMAT=json`. Every command should support it — agents need structured output, not formatted text.

**P3.2: Machine-parseable success output**
After mutations (`items add`, `trips create`, etc.), always output the created/updated resource ID on a predictable line:
```
Created: 045f9120-770c-40a4-a50a-2468298885fe
```
So agents can capture IDs with `ubt items add ... | grep '^Created:' | awk '{print $2}'`

**P3.3: `--quiet` flag**
For scripting: only output the resource ID, nothing else.
```
$ ubt items add <trip> --kind hotel --summary "..." --quiet
045f9120-770c-40a4-a50a-2468298885fe
```

### Phase 4 — Configuration (Important)

**P4.1: `ubt login` should persist to `~/.ubt/config`**
Currently `ubt login` may not write the key. Ensure it creates `~/.ubt/config` with:
```
UBT_API_KEY=ubt_k1_...
```
And that all commands read from this file as fallback after env var.

**P4.2: `ubt whoami`**
Print current authenticated user (name, email, tier). Quick sanity check for agents.

### Phase 5 — Missing Agent Workflows (Nice-to-have)

**P5.1: `items add` with `--start-date` / `--end-date` shorthand**
Agents think in dates, not ISO timestamps. Accept `--start-date 2026-04-30` and `--end-date 2026-05-01` as shorthand that auto-converts to midnight local time (or a sensible default with check-in/check-out times for hotels).

**P5.2: `trips search <query>`**
Fuzzy search by title, location, or date range. Saves agents from listing all trips and filtering client-side.

**P5.3: `items move <item_id> <trip_id>` with short IDs**
Already in the CLI but needs short ID support (Phase 1).

## Non-Requirements
- No new API endpoints needed — all operations already exist in the REST API
- No auth changes — API key auth works fine
- No UI changes

## Testing
- `bash -n cli/ubt` (syntax check)
- Selftest: `ubt selftest` should cover new commands
- Agent integration test: script that performs the full "add a hotel to a trip" workflow using only short IDs and verifies success

## Success Criteria
An agent can perform this exact task with zero failures:
1. `ubt trips list` → find the Japan trip
2. `ubt items add 055f021a --kind hotel --summary "..." --start-date 2026-04-30` → item created
3. `ubt items list 055f021a` → verify the item appears

Three commands. Zero crashes. Zero workarounds.
