# Traveler Profile & Loyalty Vault — Agent Integration Guide

## Why UBTRIPPIN is the source of truth

UBTRIPPIN is the database of record for traveler loyalty numbers. Agents should read loyalty numbers from UBTRIPPIN at booking time instead of trusting stale local memory, previous chat context, or raw email text.

- Numbers are encrypted at rest and returned as plaintext only through authenticated API/MCP calls.
- Program metadata (provider key, tier, preferred flag, notes) is normalized and queryable.
- Alliance fallback is built in, so one lookup can still produce a usable number when an exact provider match is missing.

## Recommended Agent Workflow

1. Before every booking, call `lookup_loyalty_program(provider_key)`.
2. If `exact_match: true`, apply `program.program_number`.
3. If exact match is not found but `compatible_program` exists, apply that number and note the `alliance` context.
4. If no match exists, continue booking and prompt user to add a program when appropriate.

## Adding New Numbers During Work

Call `add_loyalty_program` whenever a new loyalty number is discovered:

- User states a membership number in chat.
- Agent sees a loyalty signup confirmation email.
- Agent creates a new booking and receives a newly assigned loyalty number.

Store normalized `provider_key` values so lookups and alliance mapping stay reliable.

## Alliance Fallback (Example)

Example:

- User has `delta` in vault.
- Agent is booking `airfrance`.
- `lookup_loyalty_program(provider=airfrance)` returns:
  - `exact_match: false`
  - `compatible_program`: Delta SkyMiles entry
  - `alliance: skyteam`

Agent behavior: apply the Delta number, then annotate booking notes that a SkyTeam-compatible number was used.

## Common Provider Keys

Use these normalized keys whenever possible:

- `united`
- `delta`
- `american`
- `british_airways`
- `lufthansa`
- `airfrance`
- `emirates`
- `singapore_airlines`
- `marriott_bonvoy`
- `hilton_honors`
- `ihg`
- `hyatt`
- `hertz`
- `avis`
- `enterprise`
- `national`

## Booking Detection and `loyalty_flag`

Trip items can carry a `loyalty_flag` object indicating loyalty application status detected during ingestion.

Common `loyalty_flag.status` values:

- `applied`: Matching vault number was found and appears in booking content.
- `missing_from_booking`: Matching vault number exists but is not present in booking content.
- `compatible_available`: Exact provider number missing, but an alliance-compatible program exists.
- `no_vault_entry`: No matching or compatible vault entry exists.

Agents should use this signal for follow-ups, such as prompting to add a missing number or confirming whether to apply an alliance-compatible one.
