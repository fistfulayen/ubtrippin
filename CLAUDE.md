# UBTRIPPIN.XYZ

Travel email-to-itinerary web app using Next.js, Supabase, Resend, and AI extraction.

## Supabase Configuration

- **Important**: Supabase uses "Secret Key" (not "Service Role Key") for server-side operations that bypass RLS
- Environment variable: `SUPABASE_SECRET_KEY` (not `SUPABASE_SERVICE_ROLE_KEY`)
- The secret key is found in Supabase Dashboard → Project Settings → API → `service_role` (labeled as secret)

## Tech Stack

- Next.js 15 (App Router)
- Supabase (Auth, Database, Storage)
- Resend (Inbound email webhooks)
- Vercel AI SDK with Anthropic Claude
- React-PDF for itinerary generation
- Tailwind CSS

## Key Flows

1. **Email Processing**: Resend webhook → `/api/webhooks/resend` → AI extraction → Trip creation
2. **Auth**: Google OAuth via Supabase → Profile auto-created via trigger
3. **PDF Generation**: `/trips/[id]/pdf` → React-PDF render → Download

## Environment Variables

See `.env.local.example` for required variables.
