# AGENTS.md

Instructions for AI coding agents working on UB Trippin.

## Project Overview

UB Trippin is an agent-first travel intelligence platform. Users forward booking emails to `trips@ubtrippin.xyz`, AI extracts travel data, and it's organized into trip itineraries. The platform is designed to be controlled by AI agents as the primary interface.

**Stack:** Next.js 15 (App Router), Supabase (Postgres + Auth), Resend (inbound email), Vercel AI Gateway (Claude Sonnet 4), Tailwind CSS 4, TypeScript strict mode.

**Live:** ubtrippin.xyz
**Repo:** github.com/fistfulayen/ubtrippin
**License:** AGPL-3.0

## Setup

```bash
# Install dependencies
npm install

# Copy environment variables (get values from team)
cp .env.example .env.local

# Run dev server
npm run dev
# → http://localhost:3000

# Type check
npx tsc --noEmit

# Lint
npm run lint
```

## Required Environment Variables

- `NEXT_PUBLIC_SUPABASE_URL` — Supabase project URL
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — Supabase anon/publishable key
- `SUPABASE_SECRET_KEY` — Supabase service role key (server-side only!)
- `RESEND_API_KEY` — Resend API key for email
- `RESEND_WEBHOOK_SECRET` — Svix webhook verification secret
- `UNSPLASH_ACCESS_KEY` — For trip cover images

## Architecture

```
src/
├── app/                    # Next.js App Router pages and API routes
│   ├── (auth)/            # Login flow
│   ├── (dashboard)/       # Authenticated pages (trips, inbox, settings)
│   ├── api/               # API routes (webhooks, email processing)
│   ├── privacy/           # Privacy policy page
│   └── terms/             # Terms of service page
├── components/            # React components
│   ├── email/             # Email display, correction, extraction editor
│   ├── pdf/               # PDF generation (itinerary documents)
│   ├── trips/             # Trip cards, timeline, item details
│   └── ui/                # Shared UI primitives
├── lib/                   # Core business logic
│   ├── ai/                # AI extraction prompts and logic
│   ├── images/            # Unsplash, airline logos, airport city mapping
│   ├── pdf/               # PDF text extraction
│   ├── resend/            # Email client and webhook verification
│   ├── supabase/          # Supabase client (browser + server)
│   └── trips/             # Trip assignment, date logic
├── types/                 # TypeScript types (database schema)
cli/
└── ubt                    # Bash CLI for Supabase REST API
supabase/
└── migrations/            # Database migrations (SQL)
```

## Key Patterns

### Supabase
- **Client-side:** `createClient()` from `lib/supabase/client.ts` — uses anon key, subject to RLS
- **Server-side:** `createSecretClient()` from `lib/supabase/server.ts` — uses service role key, bypasses RLS
- **CRITICAL:** Never expose `SUPABASE_SECRET_KEY` to client code. Always use it server-side only.
- All tables have Row-Level Security (RLS). Users can only access their own data.

### Email Processing Pipeline
1. User forwards email to `trips@ubtrippin.xyz`
2. Resend webhook hits `/api/webhooks/resend`
3. Webhook verifies Svix signature
4. Checks sender against `allowed_senders` table
5. AI extraction via `lib/ai/extract-travel-data.ts` (Claude Sonnet 4)
6. Results stored in `trip_items` table, assigned to trip
7. Confirmation email sent back to user

### Time Display
- Travel times MUST display in local time (departure city time for departures, arrival city time for arrivals)
- `timestamptz` columns in Supabase convert to UTC — DO NOT rely on `start_ts`/`end_ts` for display
- Use `details_json.departure_local_time` and `details_json.arrival_local_time` (HH:MM strings)
- The `getLocalTimes()` utility in `lib/utils.ts` handles the fallback logic

### Email Routing
- `trips@ubtrippin.xyz` → travel extraction pipeline
- `hello@`, `privacy@`, `support@`, `security@` → forwarded to admin inbox
- Routing logic is in the webhook handler, not DNS

## Database Schema

Key tables (see `supabase/migrations/` for full schema):
- `profiles` — user accounts (synced from Supabase Auth)
- `trips` — trip containers (title, dates, location, travelers)
- `trip_items` — individual reservations (flights, hotels, trains, etc.)
- `source_emails` — raw forwarded emails
- `allowed_senders` — email addresses authorized to create trips

## Code Style

- TypeScript strict mode — no `any` types unless absolutely necessary
- Tailwind CSS for styling — no CSS modules or styled-components
- App Router conventions (server components by default, `'use client'` only when needed)
- One feature per PR with clear commit messages
- All changes must pass `npx tsc --noEmit` before committing

## Security Considerations

- **Email content is untrusted.** Users forward arbitrary emails. Never render raw HTML without sanitization.
- **AI extraction processes untrusted input.** The extraction prompt sandwiches email content between delimiters.
- **Webhook signatures must be verified.** All Resend webhooks use Svix verification.
- **RLS is non-negotiable.** Every new table needs RLS policies. Test that user A cannot see user B's data.
- **Service role key stays server-side.** grep for `SUPABASE_SECRET_KEY` — it should only appear in `lib/supabase/server.ts` and `.env` files.

## Testing

```bash
# Type check (required before every commit)
npx tsc --noEmit

# Lint
npm run lint

# Build (catches SSR issues)
npm run build
```

## Deploy

Push to `main` auto-deploys to Vercel. There is no staging environment — be careful.

## CLI

The `ubt` CLI in `cli/` talks to Supabase REST API:
```bash
ubt trips list
ubt trips show <trip_id>
ubt items list <trip_id>
ubt users
ubt health
```

Set `FORMAT=json` for machine-readable output.
