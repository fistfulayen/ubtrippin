import { NextRequest, NextResponse } from 'next/server'
import { createSecretClient } from '@/lib/supabase/service'
import { requireFamilyAccess } from '../_lib'

type Params = { params: Promise<{ id: string }> }

interface ProfileRow {
  id: string
  full_name: string | null
  email: string | null
  avatar_url: string | null
}

interface UserProfileRow {
  id: string
  seat_preference: string | null
  meal_preference: string | null
  airline_alliance: string | null
  hotel_brand_preference: string | null
  home_airport: string | null
  currency_preference: string | null
  notes: string | null
}

export async function GET(_request: NextRequest, { params }: Params) {
  const { id: familyId } = await params
  const access = await requireFamilyAccess(familyId)
  if ('response' in access) return access.response

  const memberUserIds = Array.from(new Set(access.ctx.members.map((member) => member.user_id)))
  const secret = createSecretClient()

  const [{ data: profileRows, error: profilesError }, { data: userProfileRows, error: userProfilesError }] =
    await Promise.all([
      memberUserIds.length
        ? secret
            .from('profiles')
            .select('id, full_name, email, avatar_url')
            .in('id', memberUserIds)
        : Promise.resolve({ data: [], error: null }),
      memberUserIds.length
        ? secret
            .from('user_profiles')
            .select('id, seat_preference, meal_preference, airline_alliance, hotel_brand_preference, home_airport, currency_preference, notes')
            .in('id', memberUserIds)
        : Promise.resolve({ data: [], error: null }),
    ])

  if (profilesError || userProfilesError) {
    console.error('[v1/families/:id/profiles GET] profile lookup failed', profilesError || userProfilesError)
    return NextResponse.json(
      { error: { code: 'internal_error', message: 'Failed to load family profiles.' } },
      { status: 500 }
    )
  }

  const profileByUserId = new Map<string, ProfileRow>(
    ((profileRows ?? []) as ProfileRow[]).map((row) => [row.id, row])
  )
  const userProfileByUserId = new Map<string, UserProfileRow>(
    ((userProfileRows ?? []) as UserProfileRow[]).map((row) => [row.id, row])
  )

  const data = memberUserIds.map((memberUserId) => {
    const profile = profileByUserId.get(memberUserId) ?? null
    const userProfile = userProfileByUserId.get(memberUserId) ?? null

    return {
      user_id: memberUserId,
      full_name: profile?.full_name ?? profile?.email ?? null,
      email: profile?.email ?? null,
      avatar_url: profile?.avatar_url ?? null,
      seat_preference: userProfile?.seat_preference ?? null,
      meal_preference: userProfile?.meal_preference ?? null,
      airline_alliance: userProfile?.airline_alliance ?? null,
      hotel_brand_preference: userProfile?.hotel_brand_preference ?? null,
      home_airport: userProfile?.home_airport ?? null,
      currency_preference: userProfile?.currency_preference ?? null,
      notes: userProfile?.notes ?? null,
    }
  })

  return NextResponse.json({
    data,
    meta: {
      count: data.length,
    },
  })
}
