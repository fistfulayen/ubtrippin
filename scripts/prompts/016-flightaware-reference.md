# FlightAware AeroAPI Reference — February 2026 (Verified)

Use these patterns exactly. Do NOT rely on training data.

## Base URL & Auth
```
Base: https://aeroapi.flightaware.com/aeroapi
Auth header: x-apikey: {FLIGHTAWARE_API_KEY}
```

## Get Flight Status
```
GET /flights/{ident}
```
- `ident` = IATA flight code (e.g., `AF1234`, `DL263`, `BA456`)
- Returns array of flights matching that ident (multiple days)
- Filter by date: `GET /flights/{ident}?start=2026-02-27T00:00:00Z&end=2026-02-28T00:00:00Z`

### Response shape (verified)
```json
{
  "flights": [
    {
      "ident": "AF1234",
      "ident_iata": "AF1234",
      "ident_icao": "AFR1234",
      "fa_flight_id": "AFR1234-1709064000-schedule-0001",
      "operator_iata": "AF",
      "flight_number": "1234",
      "status": "Scheduled",  // or "En Route", "Landed", "Cancelled", "Diverted", "Unknown"
      "cancelled": false,
      "diverted": false,
      "origin": {
        "code": "LFPG",
        "code_iata": "CDG",
        "code_icao": "LFPG",
        "city": "Paris",
        "airport_info_url": "/airports/LFPG"
      },
      "destination": {
        "code": "EDDB",
        "code_iata": "BER",
        "code_icao": "EDDB",
        "city": "Berlin",
        "airport_info_url": "/airports/EDDB"
      },
      "scheduled_off": "2026-03-01T12:55:00Z",
      "estimated_off": "2026-03-01T12:55:00Z",
      "actual_off": null,
      "scheduled_on": "2026-03-01T14:20:00Z",
      "estimated_on": "2026-03-01T14:20:00Z",
      "actual_on": null,
      "gate_origin": null,
      "gate_destination": null,
      "terminal_origin": "2F",
      "terminal_destination": "1",
      "delay_departure": null,
      "delay_arrival": null
    }
  ]
}
```

### Key fields
- `status`: "Scheduled", "En Route", "Landed", "Cancelled", "Diverted", "Unknown"
- `scheduled_off` / `estimated_off` / `actual_off`: departure times (UTC, ISO 8601)
- `scheduled_on` / `estimated_on` / `actual_on`: arrival times (UTC, ISO 8601)
- `gate_origin` / `gate_destination`: gate assignments (string or null)
- `terminal_origin` / `terminal_destination`: terminal (string or null)
- `delay_departure` / `delay_arrival`: delay in seconds (integer or null)
- `cancelled`: boolean
- `diverted`: boolean

### Status mapping for our app
| FlightAware status | Our status | Badge color |
|---|---|---|
| "Scheduled" + no delay | `on_time` | green |
| "Scheduled" + delay > 0 | `delayed` | amber |
| "En Route" | `en_route` | blue |
| "Landed" | `arrived` | green |
| "Cancelled" | `cancelled` | red |
| "Diverted" | `diverted` | red |
| "Unknown" | `unknown` | gray |

### Calculating delay
- If `estimated_off` > `scheduled_off`: delay = difference in minutes
- Or use `delay_departure` field (seconds) if present
- Same for arrival: `estimated_on` vs `scheduled_on` or `delay_arrival`

## Rate Limits
- Personal tier: 500 calls/month free, $1/query after
- We check flights in 48h window only
- Schedule: every 8h (48-24h), every 2h (24-4h), every 30min (4-0h), every 15min (in-flight)
- At current scale (~3 flights/month): well within free tier

## TypeScript fetch pattern
```typescript
async function getFlightStatus(ident: string, date: string): Promise<FlightData | null> {
  const start = `${date}T00:00:00Z`
  const end = `${date}T23:59:59Z`
  const url = `https://aeroapi.flightaware.com/aeroapi/flights/${ident}?start=${start}&end=${end}`
  
  const res = await fetch(url, {
    headers: { 'x-apikey': process.env.FLIGHTAWARE_API_KEY! },
  })
  
  if (!res.ok) {
    console.error(`[flightaware] ${res.status} for ${ident}`)
    return null
  }
  
  const data = await res.json()
  return data.flights?.[0] ?? null
}
```

## SNCF Open Data (for trains, Phase 2)
- Base: `https://api.sncf.com/v1`
- Auth: Basic auth with API key
- Endpoint: `/coverage/sncf/stop_areas/{stop_id}/departures`
- Free, no rate limit issues at our scale
