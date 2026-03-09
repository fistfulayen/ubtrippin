import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { getCityEventsPageData } from '@/lib/events/queries'
import type { EventCategory, EventTier } from '@/types/events'

const VALID_TIERS = new Set<EventTier>(['major', 'medium', 'local'])
const VALID_CATEGORIES = new Set<EventCategory>([
  'art',
  'music',
  'theater',
  'food',
  'festival',
  'sports',
  'architecture',
  'sacred',
  'market',
  'other',
])

export function validateEventsQuery(params: URLSearchParams): {
  city: string
  from?: string
  to?: string
  tier?: EventTier
  category?: EventCategory
} {
  const city = params.get('city')?.trim()
  const from = params.get('from')?.trim() || undefined
  const to = params.get('to')?.trim() || undefined
  const tierParam = params.get('tier')?.trim() || undefined
  const categoryParam = params.get('category')?.trim() || undefined

  if (!city) throw new Error('Missing required "city" slug.')
  if (from && !/^\d{4}-\d{2}-\d{2}$/.test(from)) throw new Error('"from" must be YYYY-MM-DD.')
  if (to && !/^\d{4}-\d{2}-\d{2}$/.test(to)) throw new Error('"to" must be YYYY-MM-DD.')
  if (from && to && from > to) throw new Error('"from" must be before or equal to "to".')
  if (tierParam && !VALID_TIERS.has(tierParam as EventTier)) throw new Error('Invalid "tier" filter.')
  if (categoryParam && !VALID_CATEGORIES.has(categoryParam as EventCategory)) throw new Error('Invalid "category" filter.')

  return {
    city,
    from,
    to,
    tier: tierParam as EventTier | undefined,
    category: categoryParam as EventCategory | undefined,
  }
}

export async function GET(request: NextRequest) {
  try {
    const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'public'
    const rate = checkRateLimit(`events:${forwarded}`)
    if (!rate.allowed) {
      return NextResponse.json(
        { error: { code: 'rate_limited', message: 'Rate limit exceeded for events API.' } },
        { status: 429 }
      )
    }

    const filters = validateEventsQuery(request.nextUrl.searchParams)
    const supabase = await createClient()
    const data = await getCityEventsPageData(supabase, filters.city, filters)

    if (!data) {
      return NextResponse.json(
        { error: { code: 'not_found', message: 'City not found.' } },
        { status: 404 }
      )
    }

    return NextResponse.json({
      city: data.city,
      events: data.events,
      segments: data.segments,
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to fetch events.'
    return NextResponse.json(
      { error: { code: 'invalid_request', message } },
      { status: 400 }
    )
  }
}
