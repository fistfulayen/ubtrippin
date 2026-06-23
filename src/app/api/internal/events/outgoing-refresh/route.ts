import { NextRequest, NextResponse } from 'next/server'

import { getTrackedCities } from '@/lib/events/queries'
import { isOutgoingStale, refreshOutgoingForCity } from '@/lib/events/outgoing'
import { createSecretClient } from '@/lib/supabase/service'

export const dynamic = 'force-dynamic'

function hasValidCronAuth(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[internal/events/outgoing-refresh] CRON_SECRET is not configured. Denying access for security.')
    return false
  }
  return request.headers.get('authorization') === `Bearer ${secret}`
}

async function handleRefresh(request: NextRequest) {
  if (!hasValidCronAuth(request)) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Missing or invalid cron authorization.' } },
      { status: 401 }
    )
  }

  const supabase = createSecretClient()
  const cities = (await getTrackedCities(supabase)).filter((city) => city.event_source === 'outgoing')
  let checked = 0
  let refreshed = 0
  let skipped = 0
  let failed = 0

  for (const city of cities) {
    checked += 1
    if (!isOutgoingStale(city)) {
      skipped += 1
      continue
    }

    try {
      const result = await refreshOutgoingForCity(city)
      if (result.refreshed) refreshed += 1
      if (result.skipped) skipped += 1
    } catch (error) {
      failed += 1
      console.error('[internal/events/outgoing-refresh] refresh failed for', city.slug.replace(/[\r\n]/g, '').slice(0, 100), error)
    }
  }

  return NextResponse.json({ checked, refreshed, skipped, failed })
}

export const GET = handleRefresh
export const POST = handleRefresh
