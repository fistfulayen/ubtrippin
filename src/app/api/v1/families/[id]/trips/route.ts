import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { requireFamilyAccess } from '../_lib'

type Params = { params: Promise<{ id: string }> }

type TripScope = 'all' | 'current' | 'upcoming' | 'past'

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
}

type TripRow = {
  id: string
  user_id: string
  title: string
  start_date: string | null
  end_date: string | null
  primary_location: string | null
  travelers: string[]
  notes: string | null
  cover_image_url: string | null
  share_enabled: boolean
  created_at: string
  updated_at: string
}

const TRIP_SELECT = `id,
  user_id,
  title,
  start_date,
  end_date,
  primary_location,
  travelers,
  notes,
  cover_image_url,
  share_enabled,
  created_at,
  updated_at`

function parseScope(request: NextRequest): TripScope {
  const params = request.nextUrl.searchParams
  const scopedParam =
    params.get('scope') ??
    params.get('status') ??
    params.get('state') ??
    params.get('filter')

  if (scopedParam === 'current' || scopedParam === 'upcoming' || scopedParam === 'past') {
    return scopedParam
  }

  const truthy = new Set(['1', 'true', 'yes'])
  if (truthy.has((params.get('current') ?? '').toLowerCase())) return 'current'
  if (truthy.has((params.get('upcoming') ?? '').toLowerCase())) return 'upcoming'
  if (truthy.has((params.get('past') ?? '').toLowerCase())) return 'past'

  return 'all'
}

function tripMatchesScope(trip: TripRow, scope: TripScope, today: string): boolean {
  if (scope === 'all') return true

  const start = trip.start_date
  const end = trip.end_date || trip.start_date

  if (scope === 'current') {
    return !!start && start <= today && !!end && end >= today
  }

  if (scope === 'upcoming') {
    return !start || start > today
  }

  return !!start && !!end && end < today
}

export async function GET(request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  const access = await requireFamilyAccess(familyId)
  if ('response' in access) return access.response

  const scope = parseScope(request)
  const memberUserIds = Array.from(new Set(access.ctx.members.map((member) => member.user_id)))

  const { data: tripRows, error: tripsError } = await access.ctx.supabase
    .from('trips')
    .select(TRIP_SELECT)
    .in('user_id', memberUserIds)
    .order('start_date', { ascending: false, nullsFirst: false })

  if (tripsError) {
    console.error('[v1/families/:id/trips GET] trip lookup failed', tripsError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load family trips.' } },
      { status: 500 }
    )
  }

  const secret = createSecretClient()
  const { data: profileRows } = memberUserIds.length
    ? await secret
        .from('profiles')
        .select('id, full_name, email')
        .in('id', memberUserIds)
    : { data: [] }

  const nameByUserId = new Map<string, string | null>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row.full_name || row.email || null])
  )

  const today = new Date().toISOString().split('T')[0]
  const filtered = ((tripRows ?? []) as TripRow[]).filter((trip) =>
    tripMatchesScope(trip, scope, today)
  )

  const data = filtered.map((trip) => ({
    ...trip,
    owner: {
      user_id: trip.user_id,
      full_name: nameByUserId.get(trip.user_id) ?? null,
    },
  }))

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
      scope,
      family_member_count: memberUserIds.length,
    },
  })
}
