# Email Payload Fixtures

Snapshot payloads from real booking confirmation emails.
Used in `email-inbound.spec.ts` to test the webhook handler with realistic inputs.

## Structure

Each fixture is a JSON file representing the Resend `email.received` webhook payload
(the metadata the webhook endpoint receives — NOT the full email body, which requires
a separate Resend API call).

```json
{
  "type": "email.received",
  "created_at": "2026-02-25T00:00:00.000Z",
  "data": {
    "email_id": "fixture-001",
    "from": "noreply@booking.com",
    "to": ["trips@ubtrippin.xyz"],
    "subject": "Your booking confirmation — Hotel Granvia Kyoto"
  }
}
```

## Adding Real Fixtures

Ian: forward booking confirmation emails from different providers to
`inspectorclouseau90@gmail.com` with subject prefix `[E2E FIXTURE]`.
Jacques will snapshot the metadata and save it here.

### Providers we want coverage for
- [ ] Booking.com — hotel
- [ ] Airbnb — accommodation
- [ ] Air France — flight
- [ ] airBaltic — flight
- [ ] Eurostar — train
- [ ] Hertz / Avis — car rental
- [ ] GetYourGuide / Viator — activity/tour
- [ ] Booking.com / Expedia — flight + hotel bundle

## Current Fixtures

| File | Provider | Type | Status |
|------|----------|------|--------|
| `booking-com-hotel.json` | Booking.com | Hotel | ⚠️ Synthetic (structure only) |
| `airbaltic-flight.json` | airBaltic | Flight | ⚠️ Synthetic (structure only) |
| `eurostar-train.json` | Eurostar | Train | ⚠️ Synthetic (structure only) |

⚠️ Synthetic = correct webhook structure, fake data. Replace with real forwards for full coverage.
