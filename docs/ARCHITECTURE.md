# UBTRIPPIN Site Architecture

**Read this before building any new page or component.**

## Layout Structure

The app has two layout contexts. Every new page must fit into one of them.

### 1. Dashboard — `src/app/(dashboard)/layout.tsx`

**For:** Authenticated pages. Anything behind login.

- Auto-redirects to `/login` if not authenticated
- Includes `<DashboardNav>` (sidebar with user avatar, all nav links)
- Includes `<UpgradeBanner>` (Pro upsell, hidden on billing page)
- Includes footer with Privacy/Terms links
- Content wrapped in `max-w-7xl` container

**Pages in this group:**
- `/trips`, `/trips/[id]`, `/trips/[id]/add-item`, `/trips/[id]/pdf`
- `/inbox`, `/inbox/[id]`
- `/guides`, `/guides/[id]`, `/guides/new`
- `/loyalty`
- `/settings`, `/settings/billing`, `/settings/family`, `/settings/profile`, `/settings/webhooks`
- `/help`
- `/feedback`, `/feedback/[id]`

**To add a new dashboard page:** Create it inside `src/app/(dashboard)/your-page/page.tsx`. It automatically gets nav, footer, auth check.

### 2. Public — `src/app/layout.tsx` (root)

**For:** Unauthenticated/public pages. Marketing, legal, content.

- No automatic auth check
- No shared nav or footer — each public page manages its own
- Root layout only provides `<html>`, `<body>`, fonts, analytics

**Pages in this group:**
- `/` (homepage) — has its own full nav + hero + footer
- `/login`, `/auth/reset-password`
- `/privacy`, `/terms`
- `/dispatches`, `/dispatches/[slug]` — public blog (has own nav/footer)
- `/docs/agents`
- `/invite/[token]`, `/invite/family/[token]`
- `/share/[token]`, `/guide/[token]`

### Public page requirements

Every public page MUST use the shared components:
1. **`<PublicNav />`** — `src/components/public-nav.tsx` — UBTRIPPIN logo, Features, Pricing, Agents, Story, "Get Started Free" button. Identical to homepage nav.
2. **`<PublicFooter />`** — `src/components/public-footer.tsx` — Docs, API Reference, GitHub, Privacy, Terms, "Made by humans and agents". Identical to homepage footer.
3. **Never build inline nav/footer** — always use these shared components so all public pages match.

```tsx
import { PublicNav } from '@/components/public-nav'
import { PublicFooter } from '@/components/public-footer'

export default function MyPublicPage() {
  return (
    <>
      <PublicNav />
      <main>...</main>
      <PublicFooter />
    </>
  )
}
```

## Component Patterns

### Item rendering on trips

Trip items are rendered by `kind`. Each kind has:
- An icon (from `lucide-react`)
- A title source (e.g., `details.hotel_name` for hotels, `details.flight_number` for flights)
- A subtitle (provider, location, etc.)
- Date/time display

When adding a new item `kind`, update:
1. The extraction prompt (`src/lib/ai/prompts.ts`)
2. The item display component (wherever items are rendered in trip detail)
3. The icon mapping
4. The API docs endpoint (`/api/v1/docs`)
5. The CLI skill file

### Images

- Trip covers: Unsplash search → `src/lib/images/unsplash.ts`
- User uploads: Supabase Storage → crop tool → `react-image-crop`
- Fallback chain: specific location → trip title → generic category

### Auth patterns

- Cookie auth: `createClient()` from `@/lib/supabase/server` (for pages)
- API key auth: `validateApiKey()` → `createUserScopedClient()` (for API routes)
- Dual auth: `requireSessionAuth()` tries cookie first, falls back to API key
- **Never use `createSecretClient()`** on happy paths — fix RLS instead

## Adding New Features Checklist

Before building any new page or feature:

- [ ] Decide: dashboard (authenticated) or public?
- [ ] If dashboard: put it in `src/app/(dashboard)/` — nav/footer automatic
- [ ] If public: include your own nav header and footer
- [ ] Check mobile responsiveness (`sm:` breakpoints)
- [ ] If adding a new item kind: update extraction prompt, display, icon, API docs, CLI
- [ ] If adding nav links: update `src/components/dashboard-nav.tsx`
- [ ] Run `pnpm build` — zero errors before committing
- [ ] Check the live site in a browser after deploying

## File Map

```
src/app/
├── layout.tsx                    # Root layout (html, body, fonts)
├── page.tsx                      # Homepage (public, own nav)
├── (dashboard)/
│   ├── layout.tsx                # Dashboard layout (nav, footer, auth)
│   ├── trips/                    # Trip pages
│   ├── inbox/                    # Email inbox
│   ├── guides/                   # City guides
│   ├── loyalty/                  # Loyalty vault
│   ├── settings/                 # User settings
│   ├── help/                     # Help center
│   └── feedback/                 # Feedback board
├── dispatches/                   # Public blog
│   ├── page.tsx                  # Dispatch list (own nav/footer)
│   ├── [slug]/page.tsx           # Individual dispatch (own nav/footer)
│   └── feed.xml/route.ts        # RSS feed
├── api/                          # API routes
├── auth/                         # Auth callbacks
├── login/                        # Login page
├── privacy/                      # Privacy policy
└── terms/                        # Terms of service
```
