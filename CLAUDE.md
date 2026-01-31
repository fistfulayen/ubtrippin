# UBTRIPPIN.XYZ

Travel email-to-itinerary web app using Next.js, Supabase, Resend, and AI extraction.

**Live URL**: https://www.ubtrippin.xyz/
**Inbound Email**: trips@ubtrippin.xyz
**Resend Webhook**: https://www.ubtrippin.xyz/api/webhooks/resend

## Supabase Configuration

### API Keys (as of 2025+)

Supabase uses new key naming conventions:

- **Publishable Key** (`sb_publishable_...`) - Replaces the old "anon" key
  - Safe for client-side use, respects RLS
  - Environment variable: `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

- **Secret Key** (`sb_secret_...`) - Replaces the old "service_role" key
  - Server-side only, bypasses RLS
  - Environment variable: `SUPABASE_SECRET_KEY`
  - Found in Supabase Dashboard → Project Settings → API

**Important**: Never use "anon key" or "service role key" terminology - use "publishable key" and "secret key" respectively.

## Tech Stack

- Next.js 15 (App Router)
- Supabase (Auth, Database, Storage)
- Resend (Inbound email webhooks)
- Vercel AI Gateway (Claude via `gateway('anthropic/claude-sonnet-4')`)
- React-PDF for itinerary generation
- Tailwind CSS

## Vercel AI Gateway

This project uses Vercel AI Gateway for AI model access. Key points:

- **No API key needed** - Vercel handles authentication via OIDC when deployed
- **Model format**: Use `gateway('anthropic/claude-sonnet-4')` from the `ai` package
- **Local development**: Run `vercel dev` for automatic token refresh
- **Observability**: Usage tracked in Vercel dashboard

See `src/lib/ai/extract-travel-data.ts` for implementation.

## Key Flows

1. **Email Processing**: Resend webhook → `/api/webhooks/resend` → AI extraction → Trip creation
2. **Auth**: Google OAuth via Supabase → Profile auto-created via trigger
3. **PDF Generation**: `/trips/[id]/pdf` → React-PDF render → Download

## Environment Variables

See `.env.local.example` for required variables.
