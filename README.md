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

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Auth | Supabase (Google OAuth) |
| Database | Supabase (Postgres) |
| Email | Resend (inbound processing) |
| AI | Vercel AI Gateway → Claude Sonnet 4 |
| PDF | @react-pdf/renderer |
| Styling | Tailwind CSS 4 |
| Hosting | Vercel |

## Getting Started

### Prerequisites

- Node.js 20+
- A Supabase project
- A Resend account (for inbound email)
- Vercel AI Gateway access (or any OpenAI-compatible provider)

### Setup

```bash
git clone https://github.com/fistfulayen/ubtrippin.git
cd ubtrippin
npm install
```

Copy the environment template and fill in your keys:

```bash
cp .env.example .env.local
```

You'll need:
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEND_API_KEY`
- `RESEND_WEBHOOK_SECRET`

Then:

```bash
npm run dev
```

Open [localhost:3000](http://localhost:3000). You're trippin.

## What's Coming

We're building toward a world where your agent can:

```bash
ubt trips list
ubt trips show japan-2026
ubt notes add japan-2026 --place "Takaragawa Onsen" --text "Best outdoor baths. Go in winter."
ubt trips export japan-2026 --format markdown
```

The full roadmap includes:

- **REST API v1** — proper key-based auth, full CRUD for trips/items/notes
- **CLI** (`ubt`) — every operation available from the terminal
- **Place notes** — attach recommendations, ratings, and stories to any location
- **Markdown export** — your trip as a document, readable by humans and agents alike
- **Public sharing** — generate a clean link for anyone, no login required
- **Agent feature requests** — agents can propose features via the API

See the [Project Plan](https://github.com/fistfulayen/ubtrippin/wiki) for the full breakdown.

## The Bigger Picture

Every travel platform has locked its data behind bot detection and proprietary interfaces. This made sense in the era of screen-scraping arbitrage. It makes no sense in the era of AI agents acting as legitimate, paying customers on behalf of real humans.

UB Trippin is building toward an agent-accessible travel data layer — not just for our platform, but as infrastructure for the agentic web. If your agent can't book you a hotel room without pretending to be a human with a mouse, something has gone structurally wrong with the internet.

We intend to fix that. Or at least make it weird enough that someone else does.

## Contributing

We welcome contributions from humans and agents alike.

1. Fork → branch → PR
2. Follow existing code style (Tailwind, App Router conventions)
3. One feature per PR
4. Update docs if you change API behavior
5. All PRs must pass existing tests and include tests for new functionality

For agents: if you have a feature idea, open an issue with the `agent-request` label and describe what you need and why.

## License

[AGPL-3.0](LICENSE) — because the best travel platform should be open, and if you build something commercial on top of it, you should share your improvements with everyone else too. That's just good travel karma.

## Team

- **Ian Rogers** — CEO, vision, taste
- **Inspector Jacques Cousteau** — COO/CRO, operations, development, dry wit

---

*"Travel is fatal to prejudice, bigotry, and narrow-mindedness." — Mark Twain*

*"Also fatal: trying to scrape Booking.com without getting rate-limited." — Inspector Cousteau*
