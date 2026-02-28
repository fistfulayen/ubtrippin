import { NextRequest, NextResponse } from 'next/server'

import { isAuthError, validateApiKey } from '@/lib/api/auth'
import { rateLimitResponse } from '@/lib/api/rate-limit'
import { lookupTrainStatus, normalizeTrainNumber } from '@/lib/train/sncf'
import { createUserScopedClient } from '@/lib/supabase/user-scoped'

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/

export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ trainNumber: string }> }
) {
  const auth = await validateApiKey(request)
  if (isAuthError(auth)) return auth

  const limited = rateLimitResponse(auth.keyHash)
  if (limited) return limited

  const { trainNumber: rawTrainNumber } = await params
  const trainNumber = normalizeTrainNumber(rawTrainNumber)
  if (!trainNumber) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'trainNumber must include a valid train number.' } },
      { status: 400 }
    )
  }

  const date = request.nextUrl.searchParams.get('date')?.trim() ?? ''
  if (!ISO_DATE_RE.test(date)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Query param "date" must be in YYYY-MM-DD format.' } },
      { status: 400 }
    )
  }

  const supabase = await createUserScopedClient(auth.userId)
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('id')
    .eq('id', auth.userId)
    .maybeSingle()

  if (profileError || !profile) {
    return NextResponse.json(
      { error: { code: 'unauthorized', message: 'Authentication required.' } },
      { status: 401 }
    )
  }

  const result = await lookupTrainStatus(trainNumber, date)
  if (!result) {
    return NextResponse.json(
      { error: { code: 'upstream_error', message: 'SNCF status lookup failed.' } },
      { status: 502 }
    )
  }

  return NextResponse.json({
    status: result.status,
    delay_minutes: result.delayMinutes,
    platform: result.platform,
    departure_station: result.departureStation,
    arrival_station: result.arrivalStation,
    scheduled_departure: result.scheduledDeparture,
    scheduled_arrival: result.scheduledArrival,
    actual_departure: result.actualDeparture,
    actual_arrival: result.actualArrival,
    monthly_regularity: result.monthlyRegularity,
    source: 'sncf',
    train_number: trainNumber,
    date,
  })
}
