import { headers } from 'next/headers'
import { Award } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { LoyaltyVault } from '@/components/loyalty/loyalty-vault'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

type ProviderType = 'airline' | 'hotel' | 'car_rental' | 'other'

interface LoyaltyProgram {
  id: string
  traveler_name: string
  provider_type: ProviderType
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
  provider_type: ProviderType
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

export default async function LoyaltyProgramsPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const loyaltyData = await fetchLoyaltyData()

  const { data: planData } = await supabase
    .from('profiles')
    .select('subscription_tier')
    .eq('id', user.id)
    .maybeSingle()

  const plan = planData as { subscription_tier?: string | null } | null
  const isPro = plan?.subscription_tier === 'pro'

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Loyalty Programs</h1>
        <p className="text-gray-600">Store membership numbers and let UBT check bookings for missing loyalty numbers.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Award className="h-5 w-5" />
            Loyalty Programs
          </CardTitle>
          <CardDescription>
            Add frequent flyer, hotel, and rental memberships for your travelers.
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
