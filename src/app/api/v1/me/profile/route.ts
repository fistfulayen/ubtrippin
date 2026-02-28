import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'

const SEAT_PREFERENCES = ['window', 'aisle', 'middle', 'no_preference'] as const
const MEAL_PREFERENCES = ['standard', 'vegetarian', 'vegan', 'kosher', 'halal', 'gluten_free', 'no_preference'] as const
const ALLIANCE_PREFERENCES = ['star_alliance', 'oneworld', 'skyteam', 'none'] as const

interface UserProfileRow {
  id: string
  seat_preference: (typeof SEAT_PREFERENCES)[number]
  meal_preference: (typeof MEAL_PREFERENCES)[number]
  airline_alliance: (typeof ALLIANCE_PREFERENCES)[number]
  hotel_brand_preference: string | null
  home_airport: string | null
  currency_preference: string
  notes: string | null
  created_at: string
  updated_at: string
}

interface ProfileResponse extends UserProfileRow {
  loyalty_count: number
}

function defaultProfile(userId: string): UserProfileRow {
  const now = new Date().toISOString()
  return {
    id: userId,
    seat_preference: 'no_preference',
    meal_preference: 'no_preference',
    airline_alliance: 'none',
    hotel_brand_preference: null,
    home_airport: null,
    currency_preference: 'USD',
    notes: null,
    created_at: now,
    updated_at: now,
  }
}

function isOneOf<T extends readonly string[]>(value: unknown, allowed: T): value is T[number] {
  return typeof value === 'string' && allowed.includes(value)
}

function normalizeNullableString(value: unknown): string | null | undefined {
  if (value === undefined) return undefined
  if (value === null) return null
  if (typeof value !== 'string') return undefined

  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

async function getLoyaltyCount(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { count } = await supabase
    .from('loyalty_programs')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)

  return count ?? 0
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const supabase = await createClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', auth.userId)
    .maybeSingle()

  if (error) {
    console.error('[v1/me/profile GET] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch profile.' } },
      { status: 500 }
    )
  }

  const profile = (data as UserProfileRow | null) ?? defaultProfile(auth.userId)
  const loyaltyCount = await getLoyaltyCount(auth.userId, supabase)

  const response: ProfileResponse = {
    ...profile,
    loyalty_count: loyaltyCount,
  }

  return NextResponse.json({ data: response })
}

async function upsertProfile(request: NextRequest) {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: { code: 'invalid_json', message: 'Request body must be valid JSON.' } },
      { status: 400 }
    )
  }

  if (body.seat_preference !== undefined && !isOneOf(body.seat_preference, SEAT_PREFERENCES)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid seat_preference.', field: 'seat_preference' } },
      { status: 400 }
    )
  }

  if (body.meal_preference !== undefined && !isOneOf(body.meal_preference, MEAL_PREFERENCES)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid meal_preference.', field: 'meal_preference' } },
      { status: 400 }
    )
  }

  if (body.airline_alliance !== undefined && !isOneOf(body.airline_alliance, ALLIANCE_PREFERENCES)) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'Invalid airline_alliance.', field: 'airline_alliance' } },
      { status: 400 }
    )
  }

  if (body.currency_preference !== undefined && typeof body.currency_preference !== 'string') {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'currency_preference must be a string.', field: 'currency_preference' } },
      { status: 400 }
    )
  }

  const hotelBrand = normalizeNullableString(body.hotel_brand_preference)
  const homeAirport = normalizeNullableString(body.home_airport)
  const notes = normalizeNullableString(body.notes)

  if (body.hotel_brand_preference !== undefined && hotelBrand === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'hotel_brand_preference must be a string or null.', field: 'hotel_brand_preference' } },
      { status: 400 }
    )
  }

  if (body.home_airport !== undefined && homeAirport === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'home_airport must be a string or null.', field: 'home_airport' } },
      { status: 400 }
    )
  }

  if (body.notes !== undefined && notes === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'notes must be a string or null.', field: 'notes' } },
      { status: 400 }
    )
  }

  const currencyPreference =
    typeof body.currency_preference === 'string' && body.currency_preference.trim()
      ? body.currency_preference.trim().toUpperCase()
      : undefined

  const supabase = await createClient()
  const payload = {
    id: auth.userId,
    ...(body.seat_preference !== undefined ? { seat_preference: body.seat_preference } : {}),
    ...(body.meal_preference !== undefined ? { meal_preference: body.meal_preference } : {}),
    ...(body.airline_alliance !== undefined ? { airline_alliance: body.airline_alliance } : {}),
    ...(body.hotel_brand_preference !== undefined ? { hotel_brand_preference: hotelBrand } : {}),
    ...(body.home_airport !== undefined ? { home_airport: homeAirport ? homeAirport.toUpperCase() : null } : {}),
    ...(currencyPreference !== undefined ? { currency_preference: currencyPreference } : {}),
    ...(body.notes !== undefined ? { notes } : {}),
    updated_at: new Date().toISOString(),
  }

  const { data, error } = await supabase
    .from('user_profiles')
    .upsert(payload, { onConflict: 'id' })
    .select('*')
    .single()

  if (error) {
    console.error('[v1/me/profile PUT] Supabase error:', error)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update profile.' } },
      { status: 500 }
    )
  }

  const loyaltyCount = await getLoyaltyCount(auth.userId, supabase)

  return NextResponse.json({
    data: {
      ...(data as UserProfileRow),
      loyalty_count: loyaltyCount,
    } satisfies ProfileResponse,
  })
}

export async function PUT(request: NextRequest) {
  return upsertProfile(request)
}

export async function POST(request: NextRequest) {
  return upsertProfile(request)
}
