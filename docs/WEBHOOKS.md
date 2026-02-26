# Webhooks

UB Trippin webhooks let you receive signed HTTP callbacks when trips and trip items change.

Base URL for API examples: `https://www.ubtrippin.xyz/api/v1`

## Overview

1. Register an endpoint URL and signing secret.
2. Choose specific events, or leave `events` empty to receive all supported events.
3. UB Trippin queues deliveries and retries failures.
4. Your service verifies signatures before processing payloads.

## Registration

### API

```bash
curl -X POST https://www.ubtrippin.xyz/api/v1/webhooks \
  -H "Authorization: Bearer $UBT_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "url":"https://example.com/webhooks/ubtrippin",
    "description":"Primary webhook endpoint",
    "secret":"0123456789abcdef0123456789abcdef",
    "events":["trip.created","item.created","item.updated"]
  }'
```

### MCP

```json
{
  "tool": "register_webhook",
  "arguments": {
    "url": "https://example.com/webhooks/ubtrippin",
    "secret": "0123456789abcdef0123456789abcdef",
    "events": ["trip.created", "item.created", "item.updated"],
    "description": "Primary webhook endpoint"
  }
}
```

### CLI

```bash
ubt webhooks add https://example.com/webhooks/ubtrippin \
  --events trip.created,item.created,item.updated \
  --secret 0123456789abcdef0123456789abcdef
```

## Event Types

| Event | Description |
|---|---|
| `trip.created` | A new trip is created |
| `trip.updated` | Trip metadata is updated |
| `trip.deleted` | A trip is deleted |
| `item.created` | A new item is added to a trip |
| `item.updated` | An item is modified |
| `item.deleted` | An item is removed |
| `items.batch_created` | Multiple items added at once |
| `collaborator.invited` | A collaborator is invited |
| `collaborator.accepted` | A collaborator accepts |
| `collaborator.removed` | A collaborator is removed |
| `ping` | Synthetic event from `test_webhook` endpoint |

## Payload Format

```json
{
  "version": "1",
  "event": "item.updated",
  "webhook_id": "6d6b2c6f-9243-4766-9381-2e136f45b42c",
  "delivery_id": "4869ef8f-1cb5-4f3a-b89f-b3ea51f0ce61",
  "timestamp": "2026-02-26T16:42:13.551Z",
  "data": {
    "trip_id": "f8f7ac08-c6cc-4ed6-a2a7-b744a0e5a05e",
    "item_id": "a4f2db9d-f4ce-4cdb-8fb9-6cb846e16cf9"
  }
}
```

## Signature Verification

Each request includes:

- `X-UBT-Signature`: HMAC-SHA256 hex digest of the request body
- `X-UBT-Timestamp`: ISO timestamp used for replay protection
- `X-UBT-Delivery-Id`: unique delivery ID
- `X-UBT-Event`: event name

### Node.js

```ts
import crypto from 'crypto'

export function verifySignature(rawBody: string, signature: string, secret: string) {
  const expected = crypto
    .createHmac('sha256', secret)
    .update(rawBody, 'utf8')
    .digest('hex')

  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
}
```

### Python

```python
import hmac
import hashlib

def verify_signature(raw_body: str, signature: str, secret: str) -> bool:
    expected = hmac.new(
        secret.encode("utf-8"),
        raw_body.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature, expected)
```

## Retry Policy

- Initial delivery attempts happen as soon as the queue processes.
- Failed deliveries are retried with backoff.
- Maximum attempts: 4 total attempts.
- Delivery status is tracked as `pending`, `success`, or `failed`.

## Security Best Practices

- Use an HTTPS endpoint.
- Verify signature on every request.
- Reject stale timestamps (for example, older than 5 minutes).
- Make handlers idempotent using `delivery_id`.
- Rotate secrets if compromised.
- Do not log full secrets or sensitive payload fields.

## Free vs Pro Limits

| Tier | Webhooks | Delivery logs |
|---|---|---|
| Free | 1 webhook | Last 10 deliveries per webhook |
| Pro | 10 webhooks | Last 100 deliveries per webhook |
