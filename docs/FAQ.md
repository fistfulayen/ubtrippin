# FAQ — UB Trippin

Answers to the questions we get asked most often, from users and developers both.

---

## Using UB Trippin

### How does email extraction work?

You forward a booking confirmation to `trips@ubtrippin.xyz`. That's it.

On the backend: Resend receives the email and fires a webhook to our server. We pass the email body (HTML or plain text, whichever is richer) through Claude Sonnet 4 with a structured extraction prompt. Claude identifies the booking type, extracts dates, locations, traveler names, provider details, and status. The result is a set of typed `trip_items` records stored in your account.

The whole pipeline takes under a minute in normal conditions. Most extractions are done in 10–20 seconds.

### What email providers are supported?

Any email client that can forward messages. Gmail, Apple Mail, Outlook, Fastmail, Proton, Hey — if it can forward an email, it works.

The important thing: **forward the original confirmation**, not a forwarded summary or screenshot. The richer the HTML, the more accurate the extraction.

### What types of travel items get extracted?

| Kind | Examples |
|---|---|
| **flight** | Airline bookings, boarding passes |
| **hotel** | Hotel and apartment stays (Booking.com, Airbnb, direct) |
| **train** | Eurostar, Shinkansen, Amtrak, national rail |
| **car** | Hertz, Avis, Enterprise, local rental agencies |
| **restaurant** | OpenTable reservations, Resy, direct confirmations |
| **activity** | Tours, museums, events, experiences |
| **transfer** | Airport transfers, shared shuttles |
| **cruise** | Cruise segments |

If something doesn't parse cleanly, the item is flagged `needs_review: true` and you'll see it highlighted in the dashboard. Extraction confidence (`0`–`1`) is stored on every item.

### What email doesn't extract well?

- Screenshots of bookings (no text to parse)
- Heavily image-based emails with no text fallback
- Very unusual confirmation formats from small providers
- Emails in languages other than English (this is improving)

When extraction fails or is uncertain, the item is flagged for review — we don't silently create wrong data.

### Does it work for trips with multiple people?

Yes. Traveler names are extracted per item. If a flight confirmation covers two passengers, both names appear on that item's `traveler_names` field.

### Is my data private?

Yes. All trips are private by default. Your data is:

- Stored in a Supabase database scoped to your account
- Never shared with other users
- Never used to train AI models
- Not sold or shared with third parties
- Accessible only via your authenticated session or your API keys

If you choose to share a trip (generate a share link), the share page shows an obfuscated view — traveler last names are redacted, confirmation codes and booking references are never shown.

See [SECURITY.md](SECURITY.md) for the full breakdown.

### What gets stored when I forward an email?

We store:
- The extracted trip structure (dates, locations, provider, status)
- Traveler names as extracted
- Confirmation codes and booking references **internally only** (never returned via API or shown on share pages)
- A reference to the source email (for deduplication)
- The email subject and sender (for display)

We do **not** store the full email body permanently after extraction. The email is processed and discarded.

### Can I delete my data?

Yes. From the dashboard, you can delete individual trips, individual items, or your entire account. Account deletion removes everything — trips, items, API keys — permanently.

---

## API and Agent Access

### How do I give my AI agent access?

1. Sign in at [ubtrippin.xyz](https://ubtrippin.xyz)
2. Go to **Settings → API Keys**
3. Create a key, give it a name you'll recognize (e.g. "Claude Desktop", "n8n workflow")
4. Copy the key and add it to your agent's configuration as an environment variable (`UBT_API_KEY` is a good convention)

Your agent can then call the REST API — see [API.md](API.md) for full docs.

### What can the API do?

Currently: **read-only access to your trips and items**.

- `GET /api/v1/trips` — list all trips
- `GET /api/v1/trips/:id` — single trip with items
- `GET /api/v1/items/:id` — single item

Write access (creating/updating trips via API) is on the roadmap.

### Can I create multiple API keys?

Yes. You can create as many as you need — one per agent, one per integration, etc. Each key is independently revocable. If a key is compromised, delete it and create a new one without affecting your other integrations.

### What's the rate limit?

100 requests per minute per key. Every response includes `X-RateLimit-Remaining` and `X-RateLimit-Reset` headers. If you hit the limit, you'll get a `429` with a `Retry-After` header telling you how long to wait.

For most agent use cases, 100 req/min is more than enough. If you need higher limits, reach out.

---

## Plans and Pricing

### What's the free tier?

The free tier supports:
- Unlimited email forwarding and extraction
- Full web dashboard access
- 1 API key
- Basic export (PDF, markdown)

### What's Pro?

Pro adds:
- Multiple API keys
- Calendar sync
- Priority extraction (faster processing queue)
- Advanced export options
- Trip sharing with custom domains (coming soon)

Pricing is at [ubtrippin.xyz/pricing](https://ubtrippin.xyz/pricing).

---

## Features

### How does calendar sync work?

Pro users can connect UB Trippin to Google Calendar. When enabled, your trips and items are synced as calendar events — flights, hotel check-ins, restaurant reservations, and activities all appear in your calendar with the relevant details.

Sync is one-way (UB Trippin → Calendar). Changes you make in UB Trippin propagate to the calendar; changes in the calendar don't affect UB Trippin.

### How does trip sharing work?

Any trip can be shared via a public link (you control this per trip). The share page shows:
- Trip name and dates
- Location
- Timeline of items with summaries

It does **not** show:
- Confirmation codes
- Booking references
- Traveler last names (first names only)
- Your account email or name

You can disable sharing at any time. The link stops working immediately.

### Can I export my trips?

Yes — PDF and markdown export are available. PDF is formatted for printing or sending to a travel companion. Markdown is clean enough for an agent to consume directly.

---

## Self-Hosting

### Can I self-host UB Trippin?

Yes. UB Trippin is [AGPL-3.0](https://github.com/fistfulayen/ubtrippin/blob/main/LICENSE) licensed. You can run your own instance with your own Supabase project, Resend account, and AI gateway.

The main things you need:
- **Supabase** — free tier handles personal use easily
- **Resend** — for inbound email processing
- **Vercel AI Gateway** — or any OpenAI-compatible endpoint (Anthropic direct, OpenRouter, etc.)
- **Vercel** — or any platform that runs Next.js 15

The AGPL requires that if you build something commercial on top of UB Trippin and distribute it (or run it as a service for others), you must share your modifications under the same license.

### Is the hosted version different from the open-source version?

The core product is the same. The hosted version has some operational tooling (billing, tier management, admin functions) that isn't in the public repo — that's normal; it's the same distinction between the software and the business. The product you'd self-host is fully functional.

---

## Troubleshooting

### I forwarded an email but nothing appeared

- Wait a minute — extraction can take 10–60 seconds
- Check that you forwarded to `trips@ubtrippin.xyz` (not `trip@` or `travel@`)
- Check the **Processing** view in your dashboard — items stuck in processing will show there
- If the email was heavily image-based, extraction may have failed — you'll see an error state in the dashboard

### An item extracted incorrectly

Click **Edit** on the item in the dashboard to correct it manually. If a pattern keeps failing for a specific provider (e.g., a new airline format), open an issue on GitHub with a redacted example email and we'll update the extraction prompt.

### My API key isn't working

- Confirm the `Authorization: Bearer <key>` header format (note the space after "Bearer")
- API keys are shown only once — if you didn't copy it, delete and create a new one
- Keys are tied to your account; make sure you're using a key from the right account

---

*Something not answered here? Open an issue at [github.com/fistfulayen/ubtrippin](https://github.com/fistfulayen/ubtrippin) or email [hello@ubtrippin.xyz](mailto:hello@ubtrippin.xyz).*
