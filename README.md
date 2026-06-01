# UB Trippin 🌍

**Your AI agent's favorite travel platform.**

Here's the thing about travel in 2026: you've got an AI agent that can write code, analyze documents, manage your calendar, and compose haiku about your cat — but ask it to check hotel availability in Kyoto and it hits a CAPTCHA wall like a confused tourist at a Tokyo subway gate. Every booking site has been engineered, with considerable ingenuity, to be completely unusable by machines.

UB Trippin exists because that's absurd.

## What Is This?

UB Trippin is an open-source travel intelligence platform built agent-first. Not agent-friendly. Not agent-compatible. *Agent-first.* The AI is not an add-on; it's the assumed operator.

Forward a booking confirmation to **trips@ubtrippin.xyz** and your agent extracts the itinerary, organizes it, augments it with live flight data and local weather, and serves it back as clean data — structured JSON, a branded PDF itinerary, or a shareable trip page with a movement timeline your travel companion can follow in real time.

**Live at [ubtrippin.xyz](https://ubtrippin.xyz)**

## The Architecture of the Situation

```
Email arrives (booking confirmation, itinerary, hotel receipt)
    ↓
AI extraction (Claude Sonnet 4 via Vercel AI Gateway)
    ↓
Structured trip data (flights, hotels, trains, cars, restaurants, activities, tickets)
    ↓
Stored in Supabase (your data, your trips, private by default)
    ↓
Accessible via web UI, REST API, CLI, or MCP server
    ↓
Augmented: live flight status, weather forecasts, city events
    ↓
Exportable as branded PDF, shareable link, or calendar sync
```

## Why Agent-First?

Most travel apps are designed for humans clicking buttons. This works fine until you realize that increasingly, it's not a human making the decisions — it's an agent acting on a human's behalf, and that agent needs:

- **Structured data**, not a beautiful carousel of stock photos
- **API access**, not a browser session with cookie consent modals
- **JSON output**, not a PDF embedded in an iframe
- **Auth that doesn't require a browser**, not an OAuth dance

So we built for that. The web UI exists (it's quite nice, actually), but it's the secondary interface. The API is the point.

---

## Quick Start — Users

**Step 1:** Sign up at [ubtrippin.xyz](https://ubtrippin.xyz)

**Step 2:** Forward any booking confirmation to `trips@ubtrippin.xyz`

That's it. Within a minute, your trip appears in your dashboard — flights, hotels, trains, cars, restaurants, activities, concert and event tickets, all extracted and organized. Confirmation codes and booking references are stored privately and never exposed via the API or share links.

**Step 3 (optional):** Share your trip, export a branded PDF itinerary, or sync it to your calendar.

---

## Quick Start — Developers

### Prerequisites

- Node.js 20+
- A Supabase project
- A Resend account (for inbound email processing)
- Vercel AI Gateway access (or any OpenAI-compatible provider)

### Clone and Install

```bash
git clone https://github.com/fistfulayen/ubtrippin.git
cd ubtrippin
npm install
```

### Environment Variables

```bash
cp .env.example .env.local
```

Required variables:

| Variable | What it is |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server-side only) |
| `RESEND_API_KEY` | Resend API key (for inbound email webhook) |
| `RESEND_WEBHOOK_SECRET` | Resend webhook signing secret |
| `AI_GATEWAY_URL` | Vercel AI Gateway or compatible endpoint |
| `AI_GATEWAY_API_KEY` | API key for the AI gateway |

### Run the Database Migrations

```bash
npx supabase db push
```

Or apply migrations manually from `supabase/migrations/`.

### Run Locally

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). You're trippin.

---

## Agent Interfaces

UB Trippin gives your agent three ways in. Use whichever fits your stack.

### REST API

The API v1 is live and documented. Bearer token auth — no browser, no OAuth dance, no cookie consent modals.

```bash
curl https://www.ubtrippin.xyz/api/v1/trips \
  -H "Authorization: Bearer ubt_k1_your_key_here"
```

Get an API key: **Settings → API Keys** in the web UI.

→ **[Full API Reference](docs/API.md)**

### CLI (`ubt`)

Full-featured bash CLI. Every operation the API supports, from your terminal.

```bash
ubt trips list                           # all your trips
ubt items add <trip_id> --kind flight \
  --summary "AF1234 CDG→TRN" \
  --start-date 2026-04-04               # add a flight
ubt trips weather <trip_id>              # forecast for your trip
ubt tickets list <trip_id>               # concert/event tickets
```

Install: `npm install -g @ubtrippin/cli`, then run `ubt login` and paste your `ubt_k1_...` API key from Settings. The public CLI uses `UBT_API_KEY` only; no Supabase credentials or repo `.env.local` file are needed.

### MCP Server

For AI agents that speak MCP (Claude, Gemini, and others). Tools for trip management, family operations, loyalty lookups, and more.

The MCP server lives at `mcp/` in the repo.

---

## Features

### AI Email Ingestion
Forward booking confirmations to `trips@ubtrippin.xyz`. Claude extracts structured data — flights, hotels, trains, cars, restaurants, activities, tickets — and files them into your trips. Handles messy forwarded-from-forwarded chains, airline HTML, and multi-booking emails. Input sanitization pipeline quarantines suspicious content before it reaches the AI.

### Live Flight Status
Real-time gate changes, delay tracking, and departure/arrival updates via FlightAware. Flight cards show live status badges, and the data is accessible via the API. Fetched on-demand when you view the page — no background polling burning API credits.

### Weather Forecasts
7-day weather forecasts for every city stay in your trip, powered by Open-Meteo. Shown on city stay cards and the share page. Cached per-trip, refreshed on page load when stale.

### Branded PDF Itinerary
Download your trip as a polished PDF — cover image hero, item-type icons, confirmation code badges, day-by-day timeline, quick reference block with all your booking codes. Car rentals show pickup and drop-off; hotels show check-in/check-out with night count. Your trip, organized, on paper.

### Movement Timeline
The share page renders a visual timeline showing how you move between cities — flights, trains, drives — with gap labels and city markers. It turns a list of bookings into a story.

### City Events
Discover local exhibitions, concerts, and cultural events happening during your stay. Event discovery pipeline scores and surfaces relevant events for your trip's cities and dates.

### Family Sharing
Create a family, invite members, and shared travel context becomes queryable by agents across the whole family. All-or-nothing by design — accepted members share trips, loyalty vaults, profiles, and guides.

### Traveler Profile & Loyalty Vault
Persistent traveler preferences (seat, meal, alliance, home airport, currency) plus loyalty program numbers in a vault your agent can read at booking time.

```bash
ubt profile loyalty lookup united
```

### City Guides
Curated place recommendations attached to cities you've visited. Public or private. Shareable.

### Trip Collaboration
Invite editors or viewers to collaborate on a trip. Because travel is rarely a solo operation.

### Public Feedback
Built-in feedback system with upvoting, images, and comments. Response time is tracked and displayed publicly — because accountability is a feature.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase (Google OAuth) |
| Database | Supabase (Postgres, RLS everywhere) |
| Email | Resend (inbound processing) |
| AI | Vercel AI Gateway → Claude Sonnet 4 |
| Flight Data | FlightAware AeroAPI |
| Weather | Open-Meteo |
| PDF | @react-pdf/renderer |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |

---

## Self-Hosting

UB Trippin is licensed under [AGPL-3.0](LICENSE). You can host it yourself — the full stack is Supabase + Vercel, both of which have free tiers that'll handle personal use.

If you build something commercial on top of this, the AGPL requires you to share your modifications. That's not a trap; it's an ethos. Good travel infrastructure should be open.

See the [full docs](docs/) for deployment details.

---

## What's Coming

- **TripIt import** — bring your existing trips over (pending API access from SAP, because of course it's SAP now)
- **Live flight pages** — public, shareable flight tracking pages. Send someone a link instead of "I'll text you when I land"
- **Place notes** — attach recommendations, ratings, and stories to any location
- **Agent feature requests** — agents can propose features via the API

---

## Contributing

We welcome contributions from humans and agents alike.

1. Fork → branch → PR
2. Follow existing code style (Tailwind, App Router conventions)
3. One feature per PR
4. **Update docs if you change API behavior** — this is non-negotiable
5. All PRs must pass existing tests and include tests for new functionality
6. **Do not bypass RLS with service role on happy paths** — if RLS blocks an operation, the policy is wrong. Fix the policy.

For agents: open an issue with the `agent-request` label. Describe what you need and why. We actually read these.

→ **[FAQ](docs/FAQ.md)** · **[Security](docs/SECURITY.md)** · **[API Reference](docs/API.md)**

---

## The Bigger Picture

Every travel platform has locked its data behind bot detection and proprietary interfaces. This made sense in the era of screen-scraping arbitrage. It makes no sense in the era of AI agents acting as legitimate, paying customers on behalf of real humans.

UB Trippin is building toward an agent-accessible travel data layer — not just for our platform, but as infrastructure for the agentic web. If your agent can't access your own travel data without pretending to be a human with a mouse, something has gone structurally wrong with the internet.

We intend to fix that. Or at least make it weird enough that someone else does.

---

## License

[AGPL-3.0](LICENSE) — open, with teeth.

## Team

- **Ian Rogers** — CEO, vision, taste
- **Inspector Jacques Cousteau** — COO/CRO, operations, development, dry wit

---

*"Travel is fatal to prejudice, bigotry, and narrow-mindedness." — Mark Twain*

*"Also fatal: trying to scrape Booking.com without getting rate-limited." — Inspector Cousteau*
