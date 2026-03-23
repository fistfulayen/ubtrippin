import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { requireSessionAuth, isSessionAuthError } from '@/lib/api/session-auth'
import {
  canChangePublicUsername,
  getPublicUsernameChangeAllowedAt,
  normalizePublicUsername,
  validatePublicUsername,
} from '@/lib/guides/public'

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
  home_city: string | null
  currency_preference: string
  temperature_unit: 'fahrenheit' | 'celsius'
  notes: string | null
  public_username: string | null
  public_username_changed_at: string | null
  created_at: string
  updated_at: string
}

interface ProfileResponse extends UserProfileRow {
  loyalty_count: number
  public_username_change_allowed_at: string | null
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
    home_city: null,
    currency_preference: 'USD',
    temperature_unit: 'fahrenheit',
    notes: null,
    public_username: null,
    public_username_changed_at: null,
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

async function getPublicGuideCount(
  userId: string,
  supabase: Awaited<ReturnType<typeof createClient>>
): Promise<number> {
  const { count } = await supabase
    .from('city_guides')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('visibility', 'public')

  return count ?? 0
}

export async function GET() {
  const auth = await requireSessionAuth()
  if (isSessionAuthError(auth)) return auth

  const supabase = await createClient()
  const [{ data: profileData, error: userProfileError }, { data: publicData, error: publicProfileError }] =
    await Promise.all([
      supabase
        .from('user_profiles')
        .select('*')
        .eq('id', auth.userId)
        .maybeSingle(),
      supabase
        .from('profiles')
        .select('public_username, public_username_changed_at')
        .eq('id', auth.userId)
        .maybeSingle(),
    ])

  if (userProfileError || publicProfileError) {
    console.error('[v1/me/profile GET] Supabase error:', userProfileError ?? publicProfileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to fetch profile.' } },
      { status: 500 }
    )
  }

  const profile = {
    ...((profileData as Omit<UserProfileRow, 'public_username' | 'public_username_changed_at'> | null) ??
      defaultProfile(auth.userId)),
    public_username: (publicData as { public_username: string | null; public_username_changed_at: string | null } | null)
        ?.public_username ?? null,
    public_username_changed_at: (publicData as { public_username: string | null; public_username_changed_at: string | null } | null)
        ?.public_username_changed_at ?? null,
  } satisfies UserProfileRow
  const loyaltyCount = await getLoyaltyCount(auth.userId, supabase)

  const response: ProfileResponse = {
    ...profile,
    loyalty_count: loyaltyCount,
    public_username_change_allowed_at: getPublicUsernameChangeAllowedAt(profile.public_username_changed_at),
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

  if (
    body.temperature_unit !== undefined &&
    body.temperature_unit !== 'fahrenheit' &&
    body.temperature_unit !== 'celsius'
  ) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'temperature_unit must be fahrenheit or celsius.', field: 'temperature_unit' } },
      { status: 400 }
    )
  }

  const hotelBrand = normalizeNullableString(body.hotel_brand_preference)
  const homeAirport = normalizeNullableString(body.home_airport)
  const homeCity = normalizeNullableString(body.home_city)
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

  if (body.home_city !== undefined && homeCity === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'home_city must be a string or null.', field: 'home_city' } },
      { status: 400 }
    )
  }

  if (body.notes !== undefined && notes === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'notes must be a string or null.', field: 'notes' } },
      { status: 400 }
    )
  }

  const publicUsername = normalizePublicUsername(body.public_username)
  if (body.public_username !== undefined && publicUsername === undefined) {
    return NextResponse.json(
      { error: { code: 'invalid_param', message: 'public_username must be a string or null.', field: 'public_username' } },
      { status: 400 }
    )
  }

  if (typeof publicUsername === 'string') {
    const validationError = validatePublicUsername(publicUsername)
    if (validationError) {
      return NextResponse.json(
        { error: { code: 'invalid_param', message: validationError, field: 'public_username' } },
        { status: 400 }
      )
    }
  }

  const currencyPreference =
    typeof body.currency_preference === 'string' && body.currency_preference.trim()
      ? body.currency_preference.trim().toUpperCase()
      : undefined

  const supabase = await createClient()
  const { data: existingProfile, error: existingProfileError } = await supabase
    .from('profiles')
    .select('public_username, public_username_changed_at')
    .eq('id', auth.userId)
    .maybeSingle()

  if (existingProfileError) {
    console.error('[v1/me/profile POST] Failed to fetch public profile fields:', existingProfileError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to update profile.' } },
      { status: 500 }
    )
  }

  const existingPublicProfile = existingProfile as {
    public_username: string | null
    public_username_changed_at: string | null
  }
  const currentPublicUsername = existingPublicProfile.public_username?.toLowerCase() ?? null
  const nextPublicUsername = publicUsername === undefined ? currentPublicUsername : publicUsername
  const publicUsernameChanged = publicUsername !== undefined && nextPublicUsername !== currentPublicUsername

  if (
    publicUsernameChanged &&
    currentPublicUsername !== null &&
    !canChangePublicUsername(existingPublicProfile.public_username_changed_at)
  ) {
    const allowedAt = getPublicUsernameChangeAllowedAt(existingPublicProfile.public_username_changed_at)
    return NextResponse.json(
      {
        error: {
          code: 'public_username_cooldown',
          message: allowedAt
            ? `Public username can be changed again on ${new Date(allowedAt).toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}.`
            : 'Public username can only be changed every 30 days.',
          field: 'public_username',
        },
      },
      { status: 400 }
    )
  }

  if (publicUsernameChanged && nextPublicUsername === null) {
    const publicGuideCount = await getPublicGuideCount(auth.userId, supabase)
    if (publicGuideCount > 0) {
      return NextResponse.json(
        {
          error: {
            code: 'public_username_required',
            message: 'Make your public guides private before removing your public username.',
            field: 'public_username',
          },
        },
        { status: 400 }
      )
    }
  }

  const payload = {
    id: auth.userId,
    ...(body.seat_preference !== undefined ? { seat_preference: body.seat_preference } : {}),
    ...(body.meal_preference !== undefined ? { meal_preference: body.meal_preference } : {}),
    ...(body.airline_alliance !== undefined ? { airline_alliance: body.airline_alliance } : {}),
    ...(body.hotel_brand_preference !== undefined ? { hotel_brand_preference: hotelBrand } : {}),
    ...(body.home_airport !== undefined ? { home_airport: homeAirport ? homeAirport.toUpperCase() : null } : {}),
    ...(body.home_city !== undefined ? { home_city: homeCity } : {}),
    ...(currencyPreference !== undefined ? { currency_preference: currencyPreference } : {}),
    ...(body.temperature_unit !== undefined ? { temperature_unit: body.temperature_unit } : {}),
    ...(body.notes !== undefined ? { notes } : {}),
    updated_at: new Date().toISOString(),
  }

  if (publicUsernameChanged) {
    const updatedPublicUsernameChangedAt = new Date().toISOString()
    const { error: profileUpdateError } = await supabase
      .from('profiles')
      .update({
        public_username: nextPublicUsername,
        public_username_changed_at: updatedPublicUsernameChangedAt,
      })
      .eq('id', auth.userId)

    if (profileUpdateError) {
      if (profileUpdateError.code === '23505') {
        return NextResponse.json(
          {
            error: {
              code: 'conflict',
              message: 'That public username is already taken.',
              field: 'public_username',
            },
          },
          { status: 409 }
        )
      }

      console.error('[v1/me/profile POST] Failed to update public username:', profileUpdateError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to update profile.' } },
        { status: 500 }
      )
    }

    const { error: guideUpdateError } = await supabase
      .from('city_guides')
      .update({ public_username: nextPublicUsername })
      .eq('user_id', auth.userId)

    if (guideUpdateError) {
      console.error('[v1/me/profile POST] Failed to sync guide usernames:', guideUpdateError)
      return NextResponse.json(
        { error: { code: 'internal_error', message: 'Failed to update profile.' } },
        { status: 500 }
      )
    }
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
  const publicUsernameChangedAt = publicUsernameChanged
    ? new Date().toISOString()
    : existingPublicProfile.public_username_changed_at

  return NextResponse.json({
    data: {
      ...(data as Omit<UserProfileRow, 'public_username' | 'public_username_changed_at'>),
      loyalty_count: loyaltyCount,
      public_username: publicUsernameChanged
        ? nextPublicUsername
        : existingPublicProfile.public_username,
      public_username_changed_at: publicUsernameChanged ? publicUsernameChangedAt : existingPublicProfile.public_username_changed_at,
      public_username_change_allowed_at: getPublicUsernameChangeAllowedAt(publicUsernameChangedAt),
    } satisfies ProfileResponse,
  })
}

export async function PUT(request: NextRequest) {
  return upsertProfile(request)
}

export async function POST(request: NextRequest) {
  return upsertProfile(request)
}
