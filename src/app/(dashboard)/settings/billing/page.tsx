import { CreditCard } from 'lucide-react'

import { BillingPanel } from './billing-panel'
import { SettingsNav } from '@/components/settings/settings-nav'
import { createClient } from '@/lib/supabase/server'

type SubscriptionTier = 'free' | 'pro' | 'grace' | 'paused'

function normalizeTier(value: string | null | undefined): SubscriptionTier {
  if (value === 'pro' || value === 'grace' || value === 'paused') {
    return value
  }
  return 'free'
}

export default async function SettingsBillingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return null

  const { data: profileData } = await supabase
    .from('profiles')
    .select('subscription_tier, subscription_current_period_end, subscription_grace_until')
    .eq('id', user.id)
    .maybeSingle()

  const profile = profileData as {
    subscription_tier?: string | null
    subscription_current_period_end?: string | null
    subscription_grace_until?: string | null
  } | null

  const initialSubscription = {
    subscription_tier: normalizeTier(profile?.subscription_tier),
    subscription_current_period_end: profile?.subscription_current_period_end ?? null,
    subscription_grace_until: profile?.subscription_grace_until ?? null,
    earlyAdopterSpotsRemaining: 0,
    current_price: null,
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Billing</h1>
        <p className="text-gray-600">Manage your plan, subscription status, and billing details.</p>
      </div>

      <SettingsNav />

      <div className="rounded-lg border border-[#cbd5e1] bg-white p-4">
        <div className="mb-4 flex items-center gap-2 text-sm font-medium text-[#1e293b]">
          <CreditCard className="h-4 w-4" />
          Billing & Subscription
        </div>
        <BillingPanel initialSubscription={initialSubscription} />
      </div>
    </div>
  )
}
