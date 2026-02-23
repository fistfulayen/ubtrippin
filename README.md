# UB Trippin 🌍

**Your AI agent's favorite travel platform.**

Here's the thing about travel in 2026: you've got an AI agent that can write code, analyze documents, manage your calendar, and compose haiku about your cat — but ask it to check hotel availability in Kyoto and it hits a CAPTCHA wall like a confused tourist at a Tokyo subway gate. Every booking site has been engineered, with considerable ingenuity, to be completely unusable by machines.

UB Trippin exists because that's absurd.

## What Is This?

UB Trippin is an open-source travel intelligence platform built agent-first. Not agent-friendly. Not agent-compatible. *Agent-first.* The AI is not an add-on; it's the assumed operator.

Forward a booking confirmation to **trips@ubtrippin.xyz** and your agent extracts the itinerary, organizes it, augments it with local recommendations, and serves it back as clean data — structured JSON, readable markdown, or a PDF you can hand to your travel companion who still prints things out.

**Live at [ubtrippin.xyz](https://ubtrippin.xyz)**

## The Architecture of the Situation

```
Email arrives (booking confirmation, itinerary, hotel receipt)
    ↓
AI extraction (Claude Sonnet 4 via Vercel AI Gateway)
    ↓
Structured trip data (flights, hotels, trains, restaurants, activities)
    ↓
Stored in Supabase (your data, your trips, private by default)
    ↓
Accessible via web UI, REST API, or CLI
    ↓
Exportable as markdown, PDF, or shareable link
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

That's it. Within a minute, your trip appears in your dashboard — flights, hotels, trains, cars, restaurants, activities, all extracted and organized. Confirmation codes and booking references are stored privately and never exposed via the API or share links.

**Step 3 (optional):** Share your trip, export it as a PDF, or sync it to your calendar.

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

## API

The REST API v1 is live and documented. Your agent can read trips and items using a Bearer token — no browser, no OAuth dance, no cookie consent modals.

→ **[Full API Reference](docs/API.md)**

### Get an API Key

1. Go to **Settings → API Keys** in the web UI
2. Create a key, give it a name (e.g. "My Agent")
3. Copy it — it's shown once

```bash
curl https://ubtrippin.xyz/api/v1/trips \
  -H "Authorization: Bearer ubt_your_key_here"
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase (Google OAuth) |
| Database | Supabase (Postgres) |
| Email | Resend (inbound processing) |
| AI | Vercel AI Gateway → Claude Sonnet 4 |
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

- **CLI** (`ubt`) — every operation from the terminal
- **Place notes** — attach recommendations, ratings, and stories to any location
- **Markdown export** — your trip as a document, readable by humans and agents alike
- **Agent feature requests** — agents can propose features via the API

See the [Project Plan](https://github.com/fistfulayen/ubtrippin/wiki) for the full breakdown.

---

## Contributing

We welcome contributions from humans and agents alike.

1. Fork → branch → PR
2. Follow existing code style (Tailwind, App Router conventions)
3. One feature per PR
4. **Update docs if you change API behavior** — this is non-negotiable
5. All PRs must pass existing tests and include tests for new functionality

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
