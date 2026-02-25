import { headers } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { SettingsNav } from '@/components/settings/settings-nav'
import { ProfileForm } from './ProfileForm'
import { LoyaltyVault } from './LoyaltyVault'
import { UserRound, Vault } from 'lucide-react'

interface ProfileResponse {
  id: string
  seat_preference: 'window' | 'aisle' | 'middle' | 'no_preference'
  meal_preference: 'standard' | 'vegetarian' | 'vegan' | 'kosher' | 'halal' | 'gluten_free' | 'no_preference'
  airline_alliance: 'star_alliance' | 'oneworld' | 'skyteam' | 'none'
  hotel_brand_preference: string | null
  home_airport: string | null
  currency_preference: string
  notes: string | null
  loyalty_count: number
}

interface LoyaltyProgram {
  id: string
  traveler_name: string
  provider_type: 'airline' | 'hotel' | 'car_rental' | 'other'
  provider_name: string
  provider_key: string
  program_number_masked: string
  program_number: string
  status_tier: string | null
  preferred: boolean
  alliance_group: string | null
}

interface ProviderCatalogItem {
  provider_key: string
  provider_name: string
  provider_type: 'airline' | 'hotel' | 'car_rental' | 'other'
}

function fallbackProfile(userId: string): ProfileResponse {
  return {
    id: userId,
    seat_preference: 'no_preference',
    meal_preference: 'no_preference',
    airline_alliance: 'none',
    hotel_brand_preference: null,
    home_airport: null,
    currency_preference: 'USD',
    notes: null,
    loyalty_count: 0,
  }
}

async function fetchProfile(userId: string): Promise<ProfileResponse> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'

  if (!host) {
    return fallbackProfile(userId)
  }

  const response = await fetch(`${protocol}://${host}/api/v1/me/profile`, {
    method: 'GET',
    cache: 'no-store',
    headers: {
      cookie: headerList.get('cookie') ?? '',
    },
  })

  if (!response.ok) {
    return fallbackProfile(userId)
  }

  const payload = (await response.json()) as { data?: ProfileResponse }
  return payload.data ?? fallbackProfile(userId)
}

async function fetchLoyaltyData(): Promise<{
  programs: LoyaltyProgram[]
  providers: ProviderCatalogItem[]
}> {
  const headerList = await headers()
  const host = headerList.get('x-forwarded-host') ?? headerList.get('host')
  const protocol = headerList.get('x-forwarded-proto') ?? 'http'

  if (!host) {
    return { programs: [], providers: [] }
  }

  const [programsRes, providersRes] = await Promise.all([
    fetch(`${protocol}://${host}/api/v1/me/loyalty`, {
      method: 'GET',
      cache: 'no-store',
      headers: { cookie: headerList.get('cookie') ?? '' },
    }),
    fetch(`${protocol}://${host}/api/v1/loyalty/providers`, {
      method: 'GET',
      cache: 'no-store',
      headers: { cookie: headerList.get('cookie') ?? '' },
    }),
  ])

  const programPayload = programsRes.ok
    ? (await programsRes.json()) as { data?: LoyaltyProgram[] }
    : { data: [] }
  const providerPayload = providersRes.ok
    ? (await providersRes.json()) as { data?: ProviderCatalogItem[] }
    : { data: [] }

  return {
    programs: programPayload.data ?? [],
    providers: providerPayload.data ?? [],
  }
}

export default async function TravelerProfilePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const profileData = await fetchProfile(user.id)
  const loyaltyData = await fetchLoyaltyData()

  const { data: planData } = await supabase
    .from('profiles')
    .select('tier, subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const plan = planData as { tier?: string | null; subscription_tier?: string | null } | null
  const isPro = plan?.tier === 'pro' || plan?.subscription_tier === 'pro'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Traveler Profile</h1>
        <p className="text-gray-600">Set personal travel preferences and loyalty context for your agent.</p>
      </div>

      <SettingsNav />

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UserRound className="h-5 w-5" />
            Travel Preferences
          </CardTitle>
          <CardDescription>
            These preferences are used when your trips are planned, summarized, and assisted by your agent.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initialProfile={profileData} canEditNotes={isPro} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Vault className="h-5 w-5" />
            Loyalty Vault
          </CardTitle>
          <CardDescription>
            Store membership numbers and let UBT check your bookings for missing loyalty numbers.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoyaltyVault
            isPro={isPro}
            initialPrograms={loyaltyData.programs}
            initialProviders={loyaltyData.providers}
          />
        </CardContent>
      </Card>
    </div>
  )
}
