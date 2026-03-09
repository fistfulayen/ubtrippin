import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/api/rate-limit'
import { getCityEventsPageData } from '@/lib/events/queries'
import { validateEventsQuery } from '@/lib/events/validate'

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
