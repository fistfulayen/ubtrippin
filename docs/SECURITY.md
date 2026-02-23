# Security — UB Trippin

A plain account of how UB Trippin handles your data and what we've done to protect it.

Not a marketing document. If something here is wrong, or if you've found a vulnerability, [tell us](#responsible-disclosure).

---

## Data Handling

### What we store

| Data | Where | Notes |
|---|---|---|
| Trip metadata | Supabase (Postgres) | Title, dates, location, notes |
| Trip items | Supabase (Postgres) | Flights, hotels, etc. — structured |
| Confirmation codes | Supabase (Postgres) | Internal only — never returned via API |
| Booking references | Supabase (Postgres) | Internal only — never returned via API |
| Traveler names | Supabase (Postgres) | As extracted from emails |
| API key hashes | Supabase (Postgres) | SHA-256 hash only — plaintext never stored |
| Source email reference | Supabase (Postgres) | For deduplication — not the full body |

### What we don't store

- **Full email bodies** — emails are processed and discarded after extraction
- **Email attachments** — not retained
- **Payment information** — handled entirely by Stripe; we never see card numbers
- **Passwords** — authentication is via Google OAuth (Supabase); no password database

### Data retention

Your data persists until you delete it. Deleting your account removes all trips, items, API keys, and profile data via cascading deletes in the database schema.

---

## API Key Security

### How keys are stored

When you create an API key in Settings, the server:

1. Generates a cryptographically random key (the plaintext you copy)
2. Computes `SHA-256(key)` as a hex digest
3. Stores **only the hash** in the `api_keys` table

The plaintext key is returned to you exactly once — at creation time — and then discarded. We cannot recover it. If you lose it, you delete the record and generate a new key.

```sql
-- The api_keys table — key_hash is all we keep
create table public.api_keys (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  key_hash     text not null unique,   -- SHA-256 hex digest
  name         text not null,
  created_at   timestamptz not null default now(),
  last_used_at timestamptz
);
```

### How authentication works

On every API request:

1. We read the `Authorization: Bearer <key>` header
2. We compute `SHA-256(key)` server-side
3. We look up the hash in the database
4. If found, we retrieve the associated `user_id`
5. All subsequent queries filter by that `user_id`

A database breach exposes hashes, not keys. SHA-256 is a one-way function — you cannot reverse a hash to recover a key. The hashes themselves are not useful for API access without the original key material.

### Key scoping

Each API key is scoped to one user. There is no admin key, no super-key, and no cross-user access. A key can only see data belonging to the account it was created under.

### `last_used_at` tracking

Every successful API authentication updates `last_used_at` on the key record (fire-and-forget, doesn't block the response). This lets you see when a key was last used from the Settings page, which helps you spot keys that are active but shouldn't be.

---

## Row-Level Security (RLS)

All tables in the Supabase database have RLS enabled:

- `trips` — `auth.uid() = user_id`
- `trip_items` — `auth.uid() = user_id`
- `api_keys` — `auth.uid() = user_id`

The REST API uses a service-role client (which bypasses RLS) because API key auth operates outside Supabase's native auth system — but every query includes an explicit `user_id` filter derived from the key lookup. RLS is a second layer, not the first.

The web UI uses the Supabase anon client with a user session, where RLS is the primary enforcement layer.

---

## Sensitive Field Stripping

The following fields are **never returned by the API**, even though they're stored internally:

| Field | Why we store it | Why we strip it |
|---|---|---|
| `confirmation_code` | Deduplication; future features | Sensitive — shouldn't be in API responses or logs |
| `booking_reference` | Deduplication | Same reason |
| `source_email_id` | Deduplication; provenance | Internal bookkeeping only |

This stripping happens in `src/lib/api/sanitize.ts` and is applied to every item before it leaves the server, regardless of endpoint.

```typescript
// Simplified version of what sanitizeItem does
const { confirmation_code, source_email_id, details_json, ...safe } = item;

const { booking_reference, ...cleanDetails } = details_json ?? {};

return { ...safe, details_json: cleanDetails };
```

---

## Share Page Privacy

When you enable sharing on a trip, the public share page shows a deliberately limited view:

**Shown:**
- Trip name and dates
- Primary location
- Item summaries (flight route, hotel name, check-in date)
- Traveler **first names only**

**Never shown:**
- Confirmation codes
- Booking references
- Traveler last names
- Your account email or identity
- Any financial information

The share URL is an opaque token (not your trip UUID). Disabling sharing immediately invalidates the link — there's no cached version.

---

## HTTPS Enforcement

All traffic to `ubtrippin.xyz` is HTTPS. HTTP requests are redirected. This is enforced at the Vercel edge, not just the application layer.

API keys transmitted over HTTP would be vulnerable to interception — we redirect to prevent this. If you're self-hosting, make sure your deployment enforces TLS.

---

## Third-Party Services

| Service | What it sees | Privacy link |
|---|---|---|
| Supabase | Database contents | [supabase.com/privacy](https://supabase.com/privacy) |
| Resend | Inbound email bodies (briefly, during processing) | [resend.com/privacy](https://resend.com/privacy) |
| Vercel | Request logs, function execution | [vercel.com/legal/privacy-policy](https://vercel.com/legal/privacy-policy) |
| Anthropic (via AI Gateway) | Email content during extraction | [anthropic.com/privacy](https://anthropic.com/privacy) |
| Stripe | Payment information | [stripe.com/privacy](https://stripe.com/privacy) |

We do not use Anthropic's API in a way that allows training on your data (the API tier does not use inputs for training by default).

---

## Responsible Disclosure

If you've found a security vulnerability in UB Trippin, please tell us before disclosing publicly.

**Email:** [security@ubtrippin.xyz](mailto:security@ubtrippin.xyz)

Include:
- Description of the issue
- Steps to reproduce (if applicable)
- Impact assessment (what could an attacker do?)
- Your name/handle for credit (optional)

We'll acknowledge your report within 48 hours and keep you updated on our response timeline. We don't have a formal bug bounty program yet, but we take disclosures seriously and will credit you in the fix if you'd like.

Please don't:
- Publicly disclose before we've had a chance to patch
- Access or modify other users' data during testing
- Attempt denial-of-service attacks

---

## Self-Hosting Security Considerations

If you're running your own instance:

1. **Set `SUPABASE_SERVICE_ROLE_KEY` as a server-side secret only** — never expose it to the client
2. **Enforce HTTPS** — API keys in plaintext HTTP are compromised keys
3. **Rotate `RESEND_WEBHOOK_SECRET`** — don't use the example value from `.env.example`
4. **Review your Supabase RLS policies** after any schema changes
5. **Don't disable RLS** on any user-data table — it's there for a reason

---

*Last updated: 2026-02-23*
